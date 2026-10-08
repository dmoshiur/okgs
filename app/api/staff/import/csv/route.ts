import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { defaultFairSlug, fail, ok, staff } from "@/lib/api";
import {
  allRoles,
  createUser,
  listClasses,
  logActivity,
  publicUser,
  syncClassFeeDues,
  type PortalRole,
} from "@/lib/portal-db";
import { hashPassword } from "@/lib/portal-auth";
import { isEmailAddress, normalizeEmail } from "@/lib/portal-db";
import { mailAvailable, sendMail, welcomeCredentialsMail } from "@/lib/mailer";
import { normalizePortalRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Smart CSV Import with Role Mapping
 * Handles CSV file uploads with automatic role detection and mapping
 */
export async function POST(request: NextRequest) {
  const guard = await staff();
  if ("status" in guard) return guard;
  const { session } = guard;
  
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const fairSlug = formData.get("fair_slug") as string || (await defaultFairSlug());
  const roleMappingStr = formData.get("role_mapping") as string || "{}";
  const generatePasswords = formData.get("generate_passwords") === "true";
  const passwordLength = parseInt(formData.get("password_length") as string || "8");
  const sendCredentials = formData.get("send_credentials") === "true";
  
  if (!file) return fail("No CSV file uploaded", 400);
  
  try {
    // Parse the CSV file
    const text = await file.text();
    const parsedData = parseCSV(text);
    
    if (!parsedData.headers || parsedData.rows.length === 0) {
      return fail("CSV file must have headers and data rows", 400);
    }
    
    // Parse role mapping
    let roleMapping: Record<string, string> = {};
    try {
      roleMapping = JSON.parse(roleMappingStr);
    } catch {
      roleMapping = {};
    }
    
    // Process CSV rows
    const roleMappingLower: Record<string, string> = {};
    Object.entries(roleMapping).forEach(([key, value]) => {
      roleMappingLower[key.toLowerCase().trim()] = value;
    });
    
    const created: Array<{ 
      id: string; 
      name: string; 
      email: string; 
      student_id: string; 
      role: PortalRole; 
      class_level: string 
    }> = [];
    const credentials: Array<{ name: string; email: string; student_id: string; role: PortalRole; password: string }> = [];
    const problems: Array<{ line: number; message: string }> = [];
    const rowsToMail: Array<{ name: string; email: string; password: string; line: number }> = [];
    const touchedClasses = new Set<string>();
    const canAssignAllRoles = session.role === "superadmin";
    
    for (const [index, row] of parsedData.rows.entries()) {
      const line = index + 2; // +2 because line 1 is headers
      
      // Extract fields from the row
      const name = extractField(row, ["name", "student_name", "full_name", "নাম"]);
      const emailRaw = extractField(row, ["email", "ইমেইল"]);
      const email = normalizeEmail(emailRaw);
      const studentId = extractField(row, ["student_id", "id", "student id", "স্কুল আইডি"]).toUpperCase();
      const classLevel = extractField(row, ["class", "class_level", "শ্রেণি"]);
      const section = extractField(row, ["section", "শাখা"]);
      const roll = extractField(row, ["roll", "রোল"]);
      const phone = extractField(row, ["phone", "mobile", "ফোন"]);
      const rawRole = extractField(row, ["role", "type", "ভূমিকা"]).toLowerCase().trim();
      
      // Map role using the provided mapping
      let role: PortalRole | null = null;
      if (rawRole) {
        // Check if we have a mapping for this role
        const mappedRole = roleMappingLower[rawRole];
        if (mappedRole && allRoles.includes(mappedRole as PortalRole)) {
          role = mappedRole as PortalRole;
        } else if (allRoles.includes(rawRole as PortalRole)) {
          role = rawRole as PortalRole;
        } else {
          // Default to student for unknown roles
          role = "student";
        }
      } else {
        // Default to student if no role specified
        role = "student";
      }
      
      // Validate
      if (!name) { problems.push({ line, message: "Name is required" }); continue; }
      if (!role || !allRoles.includes(role)) { problems.push({ line, message: "Invalid role" }); continue; }
      if (role === "superadmin" && !canAssignAllRoles) { problems.push({ line, message: "Only SuperAdmin can assign SuperAdmin role" }); continue; }
      if (role === "admin" && session.role !== "superadmin") { problems.push({ line, message: "Only SuperAdmin can assign Admin role" }); continue; }
      if (emailRaw && !isEmailAddress(email)) { problems.push({ line, message: "Invalid email address" }); continue; }
      if (!email && !studentId) { problems.push({ line, message: "Email or Student ID is required" }); continue; }
      
      // Generate password
      const password = generatePassword(passwordLength);
      const { hash, salt } = hashPassword(password);
      
      try {
        const user = await createUser({
          role,
          name,
          name_en: extractField(row, ["name_en", "english_name"]),
          email,
          student_id: studentId,
          class_level: classLevel,
          section,
          roll,
          phone,
          designation: extractField(row, ["designation", "পদবী"]),
          session_year: extractField(row, ["session", "session_year", "সেশন"]),
          blood_group: extractField(row, ["blood_group", "রক্তের গ্রুপ"]),
          address: extractField(row, ["address", "ঠিকানা"]),
          guardian_name: extractField(row, ["guardian_name", "guardian", "অভিভাবকের নাম"]),
          guardian_phone: extractField(row, ["guardian_phone", "guardian_mobile", "অভিভাবকের ফোন"]),
          club_slug: extractField(row, ["club", "club_slug", "ক্লাব"]),
          password_hash: hash,
          password_salt: salt,
          must_change_password: generatePasswords ? 1 : 0,
          is_active: 1,
        });
        
        created.push({ 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          student_id: user.student_id, 
          role: user.role, 
          class_level: user.class_level 
        });
        
        if (role === "student" && classLevel) touchedClasses.add(classLevel);
        if (email && sendCredentials && mailAvailable()) {
          rowsToMail.push({ name, email, password, line });
        } else if (!email) {
          credentials.push({ name, email, student_id: studentId, role, password });
        }
        
      } catch (error) {
        const message = error instanceof Error && /UNIQUE/i.test(error.message) 
          ? "Email/ID already registered" 
          : "Failed to save";
        problems.push({ line, message });
      }
    }
    
    // Sync class fees for new students
    for (const classLevel of touchedClasses) {
      await syncClassFeeDues(classLevel, fairSlug);
    }
    
    // Send welcome emails if SMTP is configured
    if (sendCredentials && mailAvailable() && rowsToMail.length > 0) {
      try {
        await sendWelcomeEmails(rowsToMail, fairSlug);
      } catch (mailError) {
        // Log email errors but don't fail the import
        console.error("Failed to send welcome emails:", mailError);
      }
    }
    
    // Log activity
    await logActivity({
      actor_id: session.user.id,
      actor_name: session.user.name,
      actor_role: session.role,
      action: "csv.import",
      entity: "users",
      detail: `${created.length} users imported, ${problems.length} errors`,
    });
    
    return ok({
      imported: created.length,
      problems,
      credentials,
      message: `Successfully imported ${created.length} users with ${problems.length} errors`,
    }, problems.length > 0 ? 207 : 201);
    
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to process CSV import", 500);
  }
}

/**
 * Parse CSV content into headers and rows
 */
function parseCSV(content: string) {
  const lines = content.split("\n").filter(line => line.trim());
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }
  
  // Parse headers
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      const cleanHeader = header.trim();
      const cleanValue = values[index]?.trim() || "";
      row[cleanHeader] = cleanValue;
      // Also store with lowercase key for case-insensitive lookup
      row[cleanHeader.toLowerCase()] = cleanValue;
    });
    
    rows.push(row);
  }
  
  return { headers, rows };
}

/**
 * Parse a single CSV line
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result.map(cell => cell.replace(/^"|"$/g, "").trim());
}

/**
 * Extract a field from a row, trying multiple possible header names
 */
function extractField(row: Record<string, string>, possibleHeaders: string[]): string {
  for (const header of possibleHeaders) {
    const value = row[header] || row[header.toLowerCase()] || row[header.toUpperCase()];
    if (value) return value;
  }
  return "";
}

/**
 * Generate a secure password
 */
function generatePassword(length: number): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  let password = "";
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  return password;
}

/**
 * Send welcome emails to imported users
 */
async function sendWelcomeEmails(
  rows: Array<{ name: string; email: string; password: string; line: number }>,
  fairSlug: string
) {
  for (const row of rows) {
    try {
      await sendMail({
        to: row.email,
        subject: `Welcome to OKGS Science Fair ${fairSlug} - Your Account Credentials`,
        html: welcomeCredentialsMail(row.name, row.email, row.password, fairSlug),
      });
    } catch (error) {
      console.error(`Failed to send welcome email to ${row.email}:`, error);
      // Continue with other emails even if one fails
    }
  }
}
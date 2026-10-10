import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { isStaffRole } from "@/lib/roles";
import { listUsers } from "@/lib/portal-db";
import { getPublicContent } from "@/lib/db";
import { ticketSchoolName } from "@/lib/ticket-locale";
import { PrintButton } from "@/components/print/PrintButton";
import { SchoolLogo } from "@/components/public/SchoolLogo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student cards", robots: { index: false, follow: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;
export default async function StudentCardPrintPage({ searchParams }: { searchParams: Search }) {
  const session = await getPortalSession();
  if (!session) redirect("/sf/login?next=/sf");
  if (!isStaffRole(session.role)) redirect("/me");
  const params = await searchParams;
  const classLevel = String(params.class ?? "");
  const section = String(params.section ?? "");
  const [content, allStudents] = await Promise.all([
    getPublicContent(),
    listUsers({ role: "student", class_level: classLevel || undefined, section: section || undefined, limit: 3000 }),
  ]);
  const students = allStudents.filter((student) => Number(student.is_active) === 1);
  const settings = Object.fromEntries(content.settings.map((item) => [item.key, item.value]));
  const school = ticketSchoolName(settings.site_name_en || settings.site_name);
  const logo = settings.logo_url || "";

  return (
    <main className="print-page v2 student-card-print-page">
      <div className="print-actions"><PrintButton label="Print student cards" /></div>
      <header className="student-card-print-heading"><p className="print-kicker">STUDENT IDENTIFICATION CARDS</p><h1>{school}</h1><p>{classLevel || "All classes"}{section ? ` · Section ${section}` : ""} · {students.length.toLocaleString("en-US")} students</p></header>
      <div className="student-card-grid">
        {students.map((student) => (
          <article className="student-id-card" key={student.id}>
            <div className="student-id-card-head"><SchoolLogo src={logo} name={school} /><div><strong>{school}</strong><small>STUDENT IDENTITY CARD</small></div></div>
            <div className="student-id-card-body"><div className="student-id-photo">{student.photo_url ? <img src={student.photo_url} alt="" /> : <span>{student.name.slice(0, 1)}</span>}</div><div className="student-id-details"><h2>{student.name}</h2><p>{student.name_en || ""}</p><dl><div><dt>Student ID</dt><dd>{student.student_id || "—"}</dd></div><div><dt>Class / Section</dt><dd>{student.class_level || "—"}{student.section ? ` · ${student.section}` : ""}</dd></div><div><dt>Roll</dt><dd>{student.roll || "—"}</dd></div><div><dt>Session</dt><dd>{student.session_year || "2026"}</dd></div></dl></div></div>
            <div className="student-id-card-foot"><span>{student.phone || student.guardian_phone || "School office"}</span><span>Authorized signature</span></div>
          </article>
        ))}
        {!students.length ? <p>No student records match the selected filters.</p> : null}
      </div>
    </main>
  );
}

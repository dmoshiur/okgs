"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  Ban,
  CircleDashed,
  FileSpreadsheet,
  ImagePlus,
  Pencil,
  Printer,
  LayoutGrid,
  RotateCcw,
  ScanLine,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { en, formatDateTimeEn } from "@/lib/format";
import { guestRelations } from "@/lib/student-schema";
import { ticketLangOptions, type TicketLang } from "@/lib/ticket-locale";
import { Empty, Notice, Panel, postJson, useApi } from "@/components/sf/console/ui";
import { StudentPhoto } from "@/components/sf/StudentPhoto";
import { StudentEditModal } from "@/components/sf/console/StudentEditModal";
import { PhotoImportPanel } from "@/components/sf/console/PhotoImportPanel";

export interface StudentListRow {
  id: string;
  serial_no: number;
  student_code: string;
  roll: string;
  photo_url: string;
  name: string;
  branch: string;
  shift: string;
  class_name: string;
  section: string;
  student_group: string;
  sms_contact: string;
  father_contact: string;
  father_name: string;
  mother_name: string;
  tags: string;
  payment_status: "PAID" | "UNPAID";
  paid_at: string;
  print_count: number;
  entered_at: string;
  guest_count: number;
}

export interface GuestItem {
  id: string;
  name: string;
  contact: string;
  relation: string;
  status: string;
  related_student_id: string;
  related_student_name?: string;
  related_student_code?: string;
  related_student_class?: string;
  related_student_section?: string;
  created_at: string;
}

interface StudentsResponse {
  students: StudentListRow[];
  options: { classes: string[]; sections: string[]; shifts: string[] };
  summary: { total: number; paid: number; unpaid: number; printed: number; entered: number };
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

const EMPTY_FILTERS = { class_name: "", section: "", shift: "", payment: "", q: "", rolls: "" };
type FilterKey = keyof typeof EMPTY_FILTERS;
/** URL query names that pre-fill the filters (`/sf/students?class=Class 8&section=A`). */
const FILTER_PARAM: Record<FilterKey, string> = { class_name: "class", section: "section", shift: "shift", payment: "payment", q: "q", rolls: "rolls" };
/** Rows per request. Small pages are what keep a 1,000-student roster fast. */
const PAGE_SIZE = 50;

function errorText(issue: unknown) {
  return issue instanceof Error ? issue.message : "Something went wrong. Please try again.";
}

/** Waits for a pause in typing before the query changes — one request, not one per key. */
function useDebouncedValue(value: string, delay = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/** Class-wise student roster, payment marking, Excel import, guest registration and ticket printing. */
export function StudentsPanel({ fairSlug, fairName, canProvision = false }: { fairSlug: string; fairName: string; canProvision?: boolean }) {
  // A link from the report page can open the panel already filtered — the URL is
  // the state, nothing is kept in the browser.
  const params = useSearchParams();
  const [filters, setFilters] = useState<typeof EMPTY_FILTERS>(() => {
    const initial = { ...EMPTY_FILTERS };
    for (const [key, name] of Object.entries(FILTER_PARAM) as [FilterKey, string][]) {
      const value = params.get(name);
      if (value) initial[key] = value;
    }
    return initial;
  });
  const search = useDebouncedValue(filters.q);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StudentListRow[]>([]);
  const [credentials, setCredentials] = useState<{ studentId: string; password: string } | null>(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busyId, setBusyId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  // “Mark the whole class as paid” — an intentional switch, not a button you can
  // hit by accident, because it rewrites payment_status for every row in the class.
  const [allClass, setAllClass] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ file: string; total: number; inserted: number; updated: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const [guestOpen, setGuestOpen] = useState<{ studentId: string } | null>(null);
  const [printFor, setPrintFor] = useState<StudentListRow | null>(null);
  const [editFor, setEditFor] = useState<StudentListRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  // One page at a time. `q` is deliberately excluded from the loop below: the
  // debounced value is what reaches the URL, so typing never fires a request.
  const query = useMemo(() => {
    const searchParams = new URLSearchParams({ fair: fairSlug, page: String(page), page_size: String(PAGE_SIZE) });
    for (const [key, value] of Object.entries(filters)) {
      if (!value || key === "q") continue;
      searchParams.set(key === "class_name" ? "class" : key, value);
    }
    if (search) searchParams.set("q", search);
    return `/api/staff/students?${searchParams.toString()}`;
  }, [fairSlug, filters, search, page]);

  const students = useApi<StudentsResponse>(query, [query]);
  const guests = useApi<{ guests: GuestItem[] }>(`/api/staff/guests?fair=${encodeURIComponent(fairSlug)}`, [fairSlug]);

  const options = students.data?.options ?? { classes: [], sections: [], shifts: [] };
  const summary = students.data?.summary ?? { total: 0, paid: 0, unpaid: 0, printed: 0, entered: 0 };
  const total = students.data?.total ?? 0;
  const hasMore = Boolean(students.data?.has_more);
  const allGuests = guests.data?.guests ?? [];

  // Pages accumulate into one table; page 1 replaces the list.
  useEffect(() => {
    const payload = students.data;
    if (!payload) return;
    setRows((current) => (payload.page <= 1 ? payload.students : [...current.slice(0, (payload.page - 1) * payload.page_size), ...payload.students]));
  }, [students.data]);

  // Any filter change starts over at page 1.
  useEffect(() => {
    setPage(1);
  }, [fairSlug, filters, search]);

  // Infinite scroll: fetch the next page a little before the sentinel appears.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || students.loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setPage((current) => current + 1);
      },
      { rootMargin: "480px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, students.loading, query]);

  function update<K extends FilterKey>(key: K, value: string) {
    setFilters((state) => ({ ...state, [key]: value }));
  }

  async function createPortalAccount(student: StudentListRow) {
    const email = prompt("Registered email for password resets (optional). No email? The office must handle recovery.", "");
    if (email === null) return;
    setBusyId(student.id); setProblem(""); setCredentials(null);
    try {
      const result = await postJson<{ temporaryPassword: string }>(`/api/staff/students/${student.id}/account`, { email });
      setCredentials({ studentId: student.student_code, password: result.temporaryPassword });
    } catch (issue) { setProblem(errorText(issue)); }
    finally { setBusyId(""); }
  }

  async function reloadAll() {
    await Promise.all([students.reload(), guests.reload()]);
  }

  async function setStatus(student: StudentListRow, status: "PAID" | "UNPAID") {
    setBusyId(student.id);
    setProblem("");
    try {
      await postJson("/api/staff/students/payments", { fair_slug: fairSlug, status, student_ids: [student.id] });
      setMessage(`${student.name} (roll ${student.roll || "—"}) marked ${status}.`);
      await students.reload();
    } catch (issue) {
      setProblem(errorText(issue));
    } finally {
      setBusyId("");
    }
  }

  async function bulkMark(status: "PAID" | "UNPAID", allInClass: boolean) {
    if (!filters.class_name) {
      setProblem("Choose a class first.");
      return;
    }
    if (!allInClass && !filters.rolls.trim()) {
      setProblem("Enter roll numbers (for example 1, 2, 5, 8, 12-15) or use “Select all class students”.");
      return;
    }
    const scopeText = [filters.class_name, filters.section && `section ${filters.section}`, filters.shift && `${filters.shift} shift`].filter(Boolean).join(" · ");
    const target = allInClass ? `every student in ${scopeText}` : `roll ${filters.rolls.trim()} in ${scopeText}`;
    if (!window.confirm(`Mark ${target} as ${status}?`)) return;

    setBulkBusy(true);
    setProblem("");
    try {
      const result = await postJson<{ updated: number; rolls: string[] }>("/api/staff/students/payments", {
        fair_slug: fairSlug,
        status,
        scope: {
          class_name: filters.class_name,
          section: filters.section,
          shift: filters.shift,
          rolls: allInClass ? "" : filters.rolls,
          all_in_class: allInClass,
        },
      });
      setMessage(`${en(result.updated)} student(s) marked ${status}. ${result.rolls.length ? `Rolls: ${result.rolls.join(", ")}.` : ""}`);
      if (allClass) setAllClass(false);
      await students.reload();
    } catch (issue) {
      setProblem(errorText(issue));
    } finally {
      setBulkBusy(false);
    }
  }

  async function submitImport() {
    if (!importFile) {
      setProblem("Choose an .xlsx file first.");
      return;
    }
    setImportBusy(true);
    setProblem("");
    setImportResult(null);
    try {
      const body = new FormData();
      body.append("file", importFile);
      const response = await fetch("/api/staff/students/import", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> & { error?: string; ok?: boolean };
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "The file could not be imported.");
      setImportResult(payload as never);
      setMessage(`Import complete: ${en(Number(payload.inserted ?? 0))} new, ${en(Number(payload.updated ?? 0))} updated.`);
      setImportFile(null);
      await reloadAll();
    } catch (issue) {
      setProblem(errorText(issue));
    } finally {
      setImportBusy(false);
    }
  }

  async function setGuestStatus(guest: GuestItem, status: "active" | "revoked") {
    setProblem("");
    try {
      await postJson(`/api/staff/guests/${guest.id}`, { status }, "PATCH");
      setMessage(`${guest.name} is now ${status === "active" ? "active" : "revoked"}.`);
      await guests.reload();
    } catch (issue) {
      setProblem(errorText(issue));
    }
  }

  const rollsActive = Boolean(filters.rolls.trim());
  const scopeLabel = [filters.class_name, filters.section ? `section ${filters.section}` : "", filters.shift ? `${filters.shift} shift` : "", filters.rolls.trim() ? `rolls ${filters.rolls.trim()}` : ""].filter(Boolean).join(" · ");

  return (
    <div className="sf-stack">
      {credentials ? <div className="no-print" role="status"><Notice>Student ID: <strong>{credentials.studentId}</strong> · Temporary password: <code>{credentials.password}</code>. Share securely. This password is shown only once; the student can change it in their portal.</Notice><button className="v2-btn v2-btn-sm v2-btn-ghost" type="button" onClick={() => setCredentials(null)}>Dismiss credentials</button></div> : null}
      {message ? <Notice>{message}</Notice> : null}
      {problem ? <Notice kind="bad">{problem}</Notice> : null}

      <div className="sf-stat-row">
        <span className="sf-stat"><Users size={14} /> Students <b>{en(summary.total)}</b></span>
        <span className="sf-stat sf-stat-good"><BadgeCheck size={14} /> Paid <b>{en(summary.paid)}</b></span>
        <span className="sf-stat sf-stat-bad"><CircleDashed size={14} /> Unpaid <b>{en(summary.unpaid)}</b></span>
        <span className="sf-stat"><Printer size={14} /> Printed <b>{en(summary.printed)}</b></span>
        <span className="sf-stat"><ScanLine size={14} /> Entered <b>{en(summary.entered)}</b></span>
        <button type="button" className="v2-btn v2-btn-sm sf-stat-action" onClick={() => setBulkOpen(true)} disabled={!summary.paid}>
          <LayoutGrid size={14} /> Print bulk tickets
        </button>
        <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost sf-stat-action" onClick={() => setImportOpen((open) => !open)}>
          <FileSpreadsheet size={14} /> {importOpen ? "Close import" : "Import Excel roster"}
        </button>
        <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost sf-stat-action" onClick={() => setPhotoOpen((open) => !open)}>
          <ImagePlus size={14} /> {photoOpen ? "Close photo update" : "Update photos"}
        </button>
        <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost sf-stat-action" onClick={() => setGuestOpen({ studentId: "" })}>
          <UserPlus size={14} /> Register outside guest
        </button>
      </div>

      {importOpen ? (
        <Panel title="Import student roster (.xlsx)">
          <div className="sf-import-box">
            <p className="v2-muted sf-help">
              Row 1 is the sheet title. Row 2 must contain these exact headers: <code>SL, ID, Roll, Photo, Name, Branch, Shift, Class, Section, Group, SMS Contact, Father Contact, Father Name, Mother Name, Tags</code>. Data starts on row 3. Existing students are updated by their ID.
            </p>
            <div className="sf-import-row">
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
              <button type="button" className="v2-btn" disabled={!importFile || importBusy} onClick={submitImport}>
                <Upload size={15} /> {importBusy ? "Importing…" : "Import"}
              </button>
            </div>
            {importResult ? (
              <div className="sf-import-result">
                <strong>{importResult.file}</strong>
                <span>{en(importResult.total)} rows read · {en(importResult.inserted)} new · {en(importResult.updated)} updated · {en(importResult.skipped)} skipped</span>
                {importResult.errors.length ? (
                  <ul>
                    {importResult.errors.slice(0, 20).map((item) => (
                      <li key={`${item.row}-${item.message}`}>Row {en(item.row)}: {item.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {photoOpen ? (
        <PhotoImportPanel
          onApplied={async (updated) => {
            setMessage(`${en(updated)} student photo(s) updated from the spreadsheet.`);
            await students.reload();
          }}
        />
      ) : null}

      <Panel title="Students by class">
        <div className="sf-filter-grid">
          <label><span className="v2-label">Class</span>
            <select className="v2-select" value={filters.class_name} onChange={(event) => setFilters((state) => ({ ...state, class_name: event.target.value, section: "" }))}>
              <option value="">All classes</option>
              {options.classes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label><span className="v2-label">Section</span>
            <select className="v2-select" value={filters.section} onChange={(event) => update("section", event.target.value)}>
              <option value="">All sections</option>
              {options.sections.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label><span className="v2-label">Shift</span>
            <select className="v2-select" value={filters.shift} onChange={(event) => update("shift", event.target.value)}>
              <option value="">All shifts</option>
              {options.shifts.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label><span className="v2-label">Payment</span>
            <select className="v2-select" value={filters.payment} onChange={(event) => update("payment", event.target.value)}>
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>
          <label><span className="v2-label">Roll numbers {allClass ? <em className="v2-muted">(whole class selected)</em> : null}</span>
            <input className="v2-input" placeholder="e.g. 1, 2, 5, 8-12" value={filters.rolls} disabled={allClass} onChange={(event) => update("rolls", event.target.value)} />
          </label>
          <label><span className="v2-label">Search</span>
            <input className="v2-input" placeholder="Name, ID or roll" value={filters.q} onChange={(event) => update("q", event.target.value)} />
          </label>
        </div>

        <div className="sf-bulk-box">
          <div className="sf-bulk-scope">
            <strong>Bulk payment</strong>
            <span className="v2-muted">
              {filters.class_name
                ? allClass
                  ? `Marked paid: all ${en(summary.total)} student(s) shown for ${filters.class_name}${filters.section ? ` · section ${filters.section}` : ""}${filters.shift ? ` · ${filters.shift} shift` : ""}.`
                  : `Applies to ${filters.class_name}${filters.section ? ` · section ${filters.section}` : ""}${filters.shift ? ` · ${filters.shift} shift` : ""}${rollsActive ? ` · rolls ${filters.rolls.trim()}` : " · no rolls entered"}.`
                : "Choose a class above to use bulk payment."}
            </span>
          </div>

          <label className={`sf-switch ${allClass ? "is-on" : ""}`} title="Applies to every student in the class, not just the rolls typed above">
            <input type="checkbox" role="switch" checked={allClass} onChange={(event) => setAllClass(event.target.checked)} disabled={!filters.class_name} />
            <span className="sf-switch-track" aria-hidden="true"><span className="sf-switch-thumb" /></span>
            <span className="sf-switch-label">Mark all class as paid</span>
          </label>

          <div className="sf-bulk-actions">
            <button type="button" className="v2-btn v2-btn-sm" disabled={bulkBusy || !filters.class_name || allClass} onClick={() => bulkMark("PAID", false)}>
              <BadgeCheck size={14} /> Mark rolls above PAID
            </button>
            <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" disabled={bulkBusy || !filters.class_name || allClass} onClick={() => bulkMark("UNPAID", false)}>
              <CircleDashed size={14} /> Mark rolls above UNPAID
            </button>
            <button type="button" className="v2-btn v2-btn-sm" disabled={bulkBusy || !filters.class_name || !allClass} onClick={() => bulkMark("PAID", true)}>
              <BadgeCheck size={14} /> {bulkBusy ? "Saving…" : `Mark ${en(summary.total)} student(s) PAID`}
            </button>
            <button type="button" className="v2-btn v2-btn-sm v2-btn-danger" disabled={bulkBusy || !filters.class_name || !allClass} onClick={() => bulkMark("UNPAID", true)}>
              <CircleDashed size={14} /> Mark class UNPAID
            </button>
          </div>
          <p className="v2-muted sf-help">Roll numbers accept ranges — <code>1, 2, 5, 8-12</code> marks rolls 1, 2, 5, 8, 9, 10, 11 and 12. Every change is written to the database at once; reloading the page shows the same status.</p>
        </div>

        {students.error ? <Notice kind="bad">{students.error}</Notice> : null}
        {students.loading && !students.data ? <Empty>Loading students…</Empty> : null}

        <div className="sf-table-wrap">
          <table className="sf-table">
            <thead>
              <tr>
                <th>Roll</th>
                <th>ID</th>
                <th>Student</th>
                <th>Class</th>
                <th>Section</th>
                <th>Shift</th>
                <th>Payment</th>
                <th>Tickets</th>
                <th>Entry</th>
                <th>Guests</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => {
                const paid = student.payment_status === "PAID";
                return (
                  <tr key={student.id} className="sf-row-fade">
                    <td>{student.roll || "—"}</td>
                    <td className="sf-nowrap">{student.student_code}</td>
                    <td className="sf-wrap-cell">
                      <span className="sf-student-cell">
                        <StudentPhoto src={student.photo_url} name={student.name} size="xs" />
                        <span className="sf-student-copy">
                          <strong>{student.name}</strong>
                          {student.father_name ? <small className="v2-muted sf-block">Father: {student.father_name}</small> : null}
                        </span>
                      </span>
                    </td>
                    <td>{student.class_name || "—"}</td>
                    <td>{student.section || "—"}</td>
                    <td>{student.shift || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className={`sf-pay ${paid ? "is-paid" : "is-unpaid"}`}
                        disabled={busyId === student.id}
                        onClick={() => setStatus(student, paid ? "UNPAID" : "PAID")}
                        title="Click to switch status — saved immediately"
                      >
                        {busyId === student.id ? "Saving…" : student.payment_status}
                      </button>
                    </td>
                    <td>{student.print_count ? `${en(student.print_count)} printed` : "—"}</td>
                    <td>{student.entered_at ? <span className="sf-badge is-good">Entered</span> : <span className="v2-muted">Not yet</span>}</td>
                    <td>{student.guest_count ? en(student.guest_count) : "—"}</td>
                    <td className="sf-actions">
                      <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={() => setEditFor(student)} title="Edit student details and photo">
                        <Pencil size={14} /> Edit
                      </button>
                      {canProvision ? <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" disabled={busyId === student.id} onClick={() => void createPortalAccount(student)}><UserPlus size={14} /> Portal login</button> : null}
                      <button type="button" className="v2-btn v2-btn-sm" disabled={!paid} title={paid ? "Open the A4 landscape ticket" : "Mark the fee PAID before printing a ticket"} onClick={() => setPrintFor(student)}>
                        <Printer size={14} /> Print ticket
                      </button>
                      <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={() => setGuestOpen({ studentId: student.id })}>
                        <UserPlus size={14} /> Guest
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && !students.loading ? (
                <tr><td colSpan={11}><Empty>No students match these filters. Import a roster or change the filters.</Empty></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {/* Sentinel for infinite scroll — the next page is fetched before it is reached. */}
        <div ref={sentinel} className="sf-scroll-sentinel" aria-hidden="true" />
        {hasMore ? <Empty>Loading more students…</Empty> : null}
        <p className="v2-muted sf-help">
          Showing {en(rows.length)} of {en(total)} student(s) for {fairName}. Payments are saved as soon as you change them.
        </p>
      </Panel>

      <Panel title="External guests & guardians">
        {guests.error ? <Notice kind="bad">{guests.error}</Notice> : null}
        <div className="sf-table-wrap">
          <table className="sf-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Relation</th>
                <th>Visiting student</th>
                <th>Contact</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {allGuests.map((guest) => (
                <tr key={guest.id}>
                  <td className="sf-wrap-cell"><strong>{guest.name}</strong><small className="v2-muted sf-block">Registered {formatDateTimeEn(guest.created_at)}</small></td>
                  <td>{guest.relation}</td>
                  <td className="sf-wrap-cell">
                    {guest.related_student_name || "—"}
                    <small className="v2-muted sf-block">{[guest.related_student_code, guest.related_student_class, guest.related_student_section].filter(Boolean).join(" · ")}</small>
                  </td>
                  <td>{guest.contact || "—"}</td>
                  <td><span className={`sf-badge ${guest.status === "active" ? "is-good" : "is-bad"}`}>{guest.status === "active" ? "Active" : "Revoked"}</span></td>
                  <td className="sf-actions">
                    <a className="v2-btn v2-btn-sm" href={`/sf/print/guest/${guest.id}?fair=${encodeURIComponent(fairSlug)}`} target="_blank" rel="noreferrer">
                      <Printer size={14} /> Pass
                    </a>
                    {guest.status === "active" ? (
                      <button type="button" className="v2-btn v2-btn-sm v2-btn-danger" onClick={() => setGuestStatus(guest, "revoked")}><Ban size={14} /> Revoke</button>
                    ) : (
                      <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={() => setGuestStatus(guest, "active")}><RotateCcw size={14} /> Restore</button>
                    )}
                  </td>
                </tr>
              ))}
              {!allGuests.length && !guests.loading ? <tr><td colSpan={6}><Empty>No outside guests registered yet.</Empty></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      {guestOpen ? (
        <GuestModal
          fairSlug={fairSlug}
          students={rows}
          initialStudentId={guestOpen.studentId}
          onClose={() => setGuestOpen(null)}
          onSaved={async (name) => {
            setGuestOpen(null);
            setMessage(`${name} registered as an outside guest.`);
            await guests.reload();
          }}
        />
      ) : null}

      {printFor ? (
        <PrintTicketModal
          fairSlug={fairSlug}
          student={printFor}
          guests={allGuests.filter((guest) => guest.related_student_id === printFor.id && guest.status === "active")}
          onClose={() => setPrintFor(null)}
          onPrinted={async (copies) => {
            setMessage(`Ticket sent to print for ${printFor.name} (${copies} ${copies === 1 ? "copy" : "copies"}).`);
            setPrintFor(null);
            await reloadAll();
          }}
          onError={setProblem}
        />
      ) : null}

      {editFor ? (
        <StudentEditModal
          student={editFor}
          fairSlug={fairSlug}
          classes={options.classes}
          sections={options.sections}
          shifts={options.shifts}
          onClose={() => setEditFor(null)}
          onSaved={async (name, changed) => {
            setEditFor(null);
            setMessage(`${name} updated${changed.length ? ` — ${changed.join(", ")}` : ""}.`);
            await students.reload();
          }}
        />
      ) : null}

      {bulkOpen ? (
        <BulkPrintModal
          fairSlug={fairSlug}
          scopeLabel={scopeLabel || "the whole roster"}
          paid={summary.paid}
          unpaid={summary.unpaid}
          onClose={() => setBulkOpen(false)}
          onOpened={(tickets, sheets) => {
            setBulkOpen(false);
            setMessage(`Bulk ticket sheet opened: ${en(tickets)} paid student(s) on ${en(sheets)} A4 page(s), 4 tickets per page.`);
            void reloadAll();
          }}
          onError={setProblem}
        />
      ) : null}
    </div>
  );
}

function GuestModal({
  fairSlug,
  students,
  initialStudentId,
  onClose,
  onSaved,
}: {
  fairSlug: string;
  students: StudentListRow[];
  initialStudentId: string;
  onClose: () => void;
  onSaved: (name: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [relation, setRelation] = useState<string>(guestRelations[0]);
  const [studentId, setStudentId] = useState(initialStudentId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postJson("/api/staff/guests", { fair_slug: fairSlug, name, contact, relation, related_student_id: studentId });
      await onSaved(name);
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sf-modal-backdrop" role="presentation" onClick={onClose}>
      <form className="sf-modal" role="dialog" aria-modal="true" aria-labelledby="guest-modal-title" onClick={(event) => event.stopPropagation()} onSubmit={save}>
        <header className="sf-modal-head">
          <h3 id="guest-modal-title">Register outside guest</h3>
          <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </header>
        <p className="v2-muted sf-help">A temporary guest (for example a Mama, Fufa or Chacha) who may accompany a student. The guest gets a signed QR pass that is scanned at the gate.</p>
        {error ? <Notice kind="bad">{error}</Notice> : null}
        <div className="sf-form-grid">
          <label><span className="v2-label">Guest name *</span><input className="v2-input" required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><span className="v2-label">Contact</span><input className="v2-input" inputMode="tel" placeholder="01XXXXXXXXX" value={contact} onChange={(event) => setContact(event.target.value)} /></label>
          <label><span className="v2-label">Guardian relation *</span>
            <select className="v2-select" value={relation} onChange={(event) => setRelation(event.target.value)}>
              {guestRelations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label><span className="v2-label">Related student *</span>
            <select className="v2-select" required value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              <option value="">Choose a student…</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} · ID {student.student_code} · Roll {student.roll || "—"} · {student.class_name}{student.section ? ` ${student.section}` : ""}
                </option>
              ))}
            </select>
            <small className="v2-muted">Only students in the current list are shown. Adjust the filters to find others.</small>
          </label>
        </div>
        <footer className="sf-modal-foot">
          <button type="button" className="v2-btn v2-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="v2-btn" disabled={busy || !name.trim() || !studentId}><UserPlus size={15} /> {busy ? "Saving…" : "Register guest"}</button>
        </footer>
      </form>
    </div>
  );
}

function PrintTicketModal({
  fairSlug,
  student,
  guests,
  onClose,
  onPrinted,
  onError,
}: {
  fairSlug: string;
  student: StudentListRow;
  guests: GuestItem[];
  onClose: () => void;
  onPrinted: (copies: number) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [copies, setCopies] = useState(1);
  const [guestId, setGuestId] = useState("");
  const [lang, setLang] = useState<TicketLang>("en");
  const [busy, setBusy] = useState(false);

  async function print() {
    setBusy(true);
    try {
      const result = await postJson<{ url: string }>(`/api/staff/students/${student.id}/print`, { fair_slug: fairSlug, copies, guest_id: guestId, lang });
      window.open(result.url, "_blank", "noopener");
      await onPrinted(copies);
    } catch (issue) {
      onError(errorText(issue));
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sf-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="sf-modal" role="dialog" aria-modal="true" aria-labelledby="print-modal-title" onClick={(event) => event.stopPropagation()}>
        <header className="sf-modal-head">
          <h3 id="print-modal-title">Print ticket — {student.name}</h3>
          <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </header>
        <p className="v2-muted sf-help">Landscape A4 ticket with the school ID, roll, class, section, the student photo and a signed QR code. Copies 2 and 3 also print the father&apos;s and mother&apos;s names and every approved external guardian (Mama, Fufa, Chacha, guest), with two blank lines left for a walk-in relative.</p>
        <div className="sf-form-grid">
          <fieldset className="sf-copies">
            <legend className="v2-label">Copies</legend>
            {[1, 2, 3].map((count) => (
              <label key={count} className={`sf-radio ${copies === count ? "is-on" : ""}`}>
                <input type="radio" name="copies" checked={copies === count} onChange={() => setCopies(count)} />
                {count} {count === 1 ? "copy (student)" : count === 2 ? "copies (+ parent)" : "copies (+ parent, parent)"}
              </label>
            ))}
          </fieldset>
          <fieldset className="sf-copies">
            <legend className="v2-label">Ticket language</legend>
            {ticketLangOptions.map((option) => (
              <label key={option.id} className={`sf-radio ${lang === option.id ? "is-on" : ""}`} title={option.hint}>
                <input type="radio" name="ticket-lang" checked={lang === option.id} onChange={() => setLang(option.id)} />
                {option.label}
              </label>
            ))}
          </fieldset>
          <label>
            <span className="v2-label">Guardian whose pass is printed with this ticket</span>
            <select className="v2-select" value={guestId} onChange={(event) => setGuestId(event.target.value)} disabled={copies < 2}>
              <option value="">None — the family block still lists every registered guardian</option>
              {guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name} · {guest.relation}{guest.contact ? ` · ${guest.contact}` : ""}</option>)}
            </select>
            {copies < 2 ? <small className="v2-muted">The family and guardian block prints from copy 2 onward.</small> : (guests.length ? <small className="v2-muted">{en(guests.length)} approved guardian(s) will be listed on the ticket.</small> : <small className="v2-muted">No approved outside guest for this student yet — the ticket prints blank lines to fill in by hand.</small>)}
          </label>
        </div>
        <dl className="sf-print-summary">
          <div><dt>Father</dt><dd>{student.father_name || "—"}</dd></div>
          <div><dt>Mother</dt><dd>{student.mother_name || "—"}</dd></div>
          <div><dt>Fee status</dt><dd>{student.payment_status}</dd></div>
        </dl>
        <footer className="sf-modal-foot">
          <button type="button" className="v2-btn v2-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="v2-btn" disabled={busy} onClick={print}><Printer size={15} /> {busy ? "Preparing…" : "Open ticket to print"}</button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Bulk ticket printing — A4 portrait, four tickets per page.
 *
 * Only PAID students are printed. The count shown here comes from the same filter
 * the roster uses, and the server applies the PAID rule again in SQL, so the
 * office cannot print a ticket for a student whose fee is still due.
 */
function BulkPrintModal({
  fairSlug,
  scopeLabel,
  paid,
  unpaid,
  onClose,
  onOpened,
  onError,
}: {
  fairSlug: string;
  scopeLabel: string;
  paid: number;
  unpaid: number;
  onClose: () => void;
  onOpened: (tickets: number, sheets: number) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [size, setSize] = useState(20);
  const [page, setPage] = useState(1);
  const [lang, setLang] = useState<TicketLang>("en");
  const [busy, setBusy] = useState(false);
  const runs = Math.max(1, Math.ceil(paid / size));
  const sheets = Math.ceil(paid / 4);

  async function open() {
    setBusy(true);
    try {
      const scope = Object.fromEntries(
        new URLSearchParams(window.location.search).entries(),
      ) as Record<string, string>;
      const result = await postJson<{ url: string; paid: number; runs: number; sheets_total: number }>("/api/staff/students/bulk-print", {
        fair_slug: fairSlug,
        class_name: scope.class ?? "",
        section: scope.section ?? "",
        shift: scope.shift ?? "",
        rolls: scope.rolls ?? "",
        size,
        page,
        lang,
      });
      window.open(result.url, "_blank", "noopener");
      await onOpened(result.paid, result.sheets_total);
    } catch (issue) {
      onError(errorText(issue));
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sf-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="sf-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-print-title" onClick={(event) => event.stopPropagation()}>
        <header className="sf-modal-head">
          <h3 id="bulk-print-title">Print bulk tickets</h3>
          <button type="button" className="v2-btn v2-btn-sm v2-btn-ghost" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </header>
        <p className="v2-muted sf-help">
          A4 portrait sheets, four tickets per page in a 2 × 2 grid, with a page break after every fourth ticket. Scope: <strong>{scopeLabel}</strong>.
        </p>
        <dl className="sf-print-summary">
          <div><dt>Will print</dt><dd>{en(paid)} paid student(s)</dd></div>
          <div><dt>Excluded</dt><dd>{en(unpaid)} unpaid / pending</dd></div>
          <div><dt>A4 sheets</dt><dd>{en(sheets)} page(s), 4 per page</dd></div>
        </dl>
        <div className="sf-form-grid">
          <fieldset className="sf-copies">
            <legend className="v2-label">Tickets per print run</legend>
            {[20, 40, 100].map((value) => (
              <label key={value} className={`sf-radio ${size === value ? "is-on" : ""}`}>
                <input type="radio" name="bulk-size" checked={size === value} onChange={() => { setSize(value); setPage(1); }} />
                {en(value)} tickets — {en(value / 4)} A4 page(s)
              </label>
            ))}
          </fieldset>
          <fieldset className="sf-copies">
            <legend className="v2-label">Ticket language</legend>
            {ticketLangOptions.map((option) => (
              <label key={option.id} className={`sf-radio ${lang === option.id ? "is-on" : ""}`} title={option.hint}>
                <input type="radio" name="bulk-lang" checked={lang === option.id} onChange={() => setLang(option.id)} />
                {option.label}
              </label>
            ))}
          </fieldset>
          {runs > 1 ? (
            <label>
              <span className="v2-label">Start at print run</span>
              <input className="v2-input" type="number" min={1} max={runs} value={page} onChange={(event) => setPage(Math.min(runs, Math.max(1, Number(event.target.value) || 1)))} />
              <small className="v2-muted">Each run covers {en(size)} tickets ({en(size / 4)} A4 pages); use the run arrows on the print page to continue.</small>
            </label>
          ) : null}
        </div>
        <footer className="sf-modal-foot">
          <button type="button" className="v2-btn v2-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="v2-btn" disabled={busy || !paid} onClick={open}>
            <LayoutGrid size={15} /> {busy ? "Preparing sheets…" : `Open ${en(Math.min(size, paid))} ticket(s)`}
          </button>
        </footer>
      </div>
    </div>
  );
}

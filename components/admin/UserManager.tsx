"use client";

/**
 * UserManager — email-first account administration (SuperAdmin only).
 *
 * The email typed here is written to `users.email` in the primary database and is
 * the same address the single-field login authenticates against. Creating an
 * account either sets a password straight away, or mails a single-use
 * “set your password” link (the invite reuses the password-reset pipeline).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  UserX,
} from "lucide-react";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  student_id: string;
  class_level: string;
  section: string;
  is_active: number;
  last_login_at: string;
}

interface RoleOption {
  value: string;
  label: string;
}

const emptyForm = {
  name: "",
  email: "",
  studentId: "",
  role: "teacher",
  designation: "",
  password: "",
  sendInvite: true,
};

export function UserManager({ initialUsers, roles }: { initialUsers: ManagedUser[]; roles: RoleOption[] }) {
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/superadmin/users", { cache: "no-store" });
      const data = (await response.json()) as { users?: ManagedUser[]; error?: string };
      if (data.users) setUsers(data.users);
      else setError(data.error || "Unable to load accounts.");
    } catch {
      setError("Unable to load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (!needle) return true;
      return [user.name, user.email, user.student_id, user.designation, user.class_level]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [users, search, roleFilter]);

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setInviteLink("");
    try {
      const response = await fetch("/api/superadmin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          student_id: form.studentId.trim().toUpperCase(),
          role: form.role,
          designation: form.designation,
          password: form.password || undefined,
          sendInvite: form.sendInvite,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        user?: ManagedUser;
        invite?: { sent: boolean; link?: string };
        message?: string;
        errorEn?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.user) {
        setError(data.errorEn || data.error || "The account could not be created.");
        return;
      }
      setUsers((current) => [data.user as ManagedUser, ...current]);
      setForm({ ...emptyForm });
      setNotice(data.message ?? "Account created.");
      if (data.invite?.link && !data.invite.sent) setInviteLink(data.invite.link);
    } catch {
      setError("The server could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(user: ManagedUser, patchBody: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/superadmin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ...patchBody }),
      });
      const data = (await response.json()) as { ok?: boolean; user?: ManagedUser; errorEn?: string; error?: string };
      if (!response.ok || !data.ok || !data.user) {
        setError(data.errorEn || data.error || "The account could not be updated.");
        return;
      }
      setUsers((current) => current.map((row) => (row.id === user.id ? (data.user as ManagedUser) : row)));
      setNotice(message);
    } catch {
      setError("The server could not be reached. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      /* clipboard blocked — the value is visible in the field anyway */
    }
  }

  return (
    <div className="users-manager">
      <section className="panel users-create">
        <div className="panel-heading">
          <div>
            <span className="panel-eyebrow">
              <UserPlus size={13} /> New account
            </span>
            <h2>Create an account from an email address</h2>
          </div>
        </div>

        <form className="settings-grid" onSubmit={createAccount}>
          <div className="field-block">
            <label className="v2-label" htmlFor="user-name">
              Full name
            </label>
            <input
              id="user-name"
              className="v2-input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Md. Sakib Hasan"
            />
          </div>

          <div className="field-block">
            <label className="v2-label" htmlFor="user-email">
              Email address *
            </label>
            <div className="icon-input">
              <Mail size={15} aria-hidden="true" />
              <input
                id="user-email"
                className="v2-input"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="name@okgs.info"
              />
            </div>
            <small className="field-help">Stored in the primary database and used as the sign-in address.</small>
          </div>

          <div className="field-block">
            <label className="v2-label" htmlFor="user-school-id">
              School ID
            </label>
            <input
              id="user-school-id"
              className="v2-input"
              value={form.studentId}
              onChange={(event) => setForm({ ...form, studentId: event.target.value })}
              placeholder="e.g. 2026-0042"
            />
            <small className="field-help">Optional. Students can sign in with this ID instead of an email — it must be unique.</small>
          </div>

          <div className="field-block">
            <label className="v2-label" htmlFor="user-role">
              Role *
            </label>
            <select
              id="user-role"
              className="v2-input"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <small className="field-help">The role decides the dashboard this account lands on.</small>
          </div>

          <div className="field-block">
            <label className="v2-label" htmlFor="user-designation">
              Designation
            </label>
            <input
              id="user-designation"
              className="v2-input"
              value={form.designation}
              onChange={(event) => setForm({ ...form, designation: event.target.value })}
              placeholder="e.g. Assistant Teacher"
            />
          </div>

          <div className="field-block">
            <label className="v2-label" htmlFor="user-password">
              Initial password
            </label>
            <div className="icon-input">
              <KeyRound size={15} aria-hidden="true" />
              <input
                id="user-password"
                className="v2-input"
                type="text"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Leave empty to email a set-password link"
              />
            </div>
            <small className="field-help">At least 8 characters. Empty → the account starts on the shared default and is asked to change it.</small>
          </div>

          <label className="toggle-field is-on users-invite-toggle">
            <span>
              <b>Email the invite link</b>
              <small>A single-use link (7 days) that lets the person choose their own password.</small>
            </span>
            <input
              type="checkbox"
              checked={form.sendInvite}
              onChange={(event) => setForm({ ...form, sendInvite: event.target.checked })}
            />
            <i />
          </label>

          <div className="settings-actions is-wide">
            <button className="admin-primary-button" type="submit" disabled={busy}>
              {busy ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />} Create account
            </button>
          </div>
        </form>

        {inviteLink ? (
          <div className="login-note">
            <span>Set-password link (no mail provider configured)</span>
            <p>
              <code className="user-invite-link">{inviteLink}</code>
              <button type="button" className="secondary-button" onClick={() => void copy(inviteLink, "invite")}>
                {copied === "invite" ? <Check size={14} /> : <Copy size={14} />} {copied === "invite" ? "Copied" : "Copy"}
              </button>
            </p>
          </div>
        ) : null}
      </section>

      <section className="panel users-list">
        <div className="panel-heading">
          <div>
            <span className="panel-eyebrow">
              <ShieldCheck size={13} /> Accounts
            </span>
            <h2>
              {filtered.length} of {users.length} accounts
            </h2>
          </div>
          <div className="users-toolbar">
            <label className="search-box">
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, ID…" />
            </label>
            <select className="v2-input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <button type="button" className="secondary-button" onClick={() => void reload()} disabled={loading}>
              <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        <div className="users-table">
          <div className="users-head" role="row">
            <span>Account</span>
            <span>Role</span>
            <span>Status</span>
            <span>Last sign-in</span>
            <span aria-label="Actions" />
          </div>
          {filtered.length ? (
            filtered.map((user) => (
              <div className="users-row" key={user.id}>
                <span className="users-row-identity">
                  <b className="truncate">{user.name || "—"}</b>
                  <small className="truncate">
                    {user.email || "no email"}
                    {user.student_id ? ` · ${user.student_id}` : ""}
                    {user.designation ? ` · ${user.designation}` : ""}
                  </small>
                </span>
                <select
                  className="v2-input users-role-select"
                  value={user.role}
                  disabled={busy}
                  onChange={(event) => void patch(user, { role: event.target.value }, `Role updated for ${user.email}.`)}
                  aria-label={`Role for ${user.name}`}
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`status-pill ${Number(user.is_active) ? "" : "is-draft"}`}
                  onClick={() => void patch(user, { is_active: Number(user.is_active) ? 0 : 1 }, Number(user.is_active) ? "Account disabled." : "Account enabled.")}
                  disabled={busy}
                >
                  <i />
                  {Number(user.is_active) ? "Active" : "Disabled"}
                </button>
                <span className="users-row-date">
                  {user.last_login_at ? new Date(user.last_login_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never"}
                </span>
                <span className="users-row-actions">
                  <button
                    type="button"
                    title="Send a password-reset link"
                    onClick={async () => {
                      await fetch("/api/auth/forgot", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: user.email }),
                      });
                      setNotice(`Reset link queued for ${user.email}.`);
                    }}
                    disabled={!user.email}
                  >
                    <KeyRound size={14} />
                  </button>
                  <button
                    type="button"
                    title={Number(user.is_active) ? "Disable account" : "Enable account"}
                    onClick={() => void patch(user, { is_active: Number(user.is_active) ? 0 : 1 }, Number(user.is_active) ? "Account disabled." : "Account enabled.")}
                    disabled={busy}
                  >
                    {Number(user.is_active) ? <UserX size={14} /> : <BadgeCheck size={14} />}
                  </button>
                </span>
              </div>
            ))
          ) : (
            <p className="empty-note">No account matches that search.</p>
          )}
        </div>
      </section>

      {error ? (
        <p className="studio-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="form-ok" role="status">
          <Check size={15} /> {notice}
        </p>
      ) : null}
    </div>
  );
}

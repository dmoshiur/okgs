import type { EntryOutcome, EntrySubject, LunchOutcome, LunchState, ScanMode, ScanTone } from "@/lib/scan-types";

export interface ScanDisplay {
  mode: ScanMode;
  tone: ScanTone;
  label: string;
  title: string;
  message: string;
  subject: EntrySubject | null;
  lunch?: LunchState;
  outcome?: EntryOutcome | LunchOutcome;
}

export interface ScannerLog {
  id: string;
  subject_type: string;
  subject_name: string;
  subject_code: string;
  method: string;
  action?: string;
  result: string;
  entry_time?: string;
  claim_time?: string;
  scanned_at: string;
  scanned_by_name: string;
  note: string;
}

export interface ScannerLogsResponse {
  logs: ScannerLog[];
  summary: { success: number; duplicate: number; expired: number; invalid: number; admitted?: number; denied?: number; ready?: number; claimed?: number };
  day: string;
  next_reset_at: string;
  server_time: string;
}

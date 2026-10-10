/**
 * Class-wise budget & collected-amount accounting for one fair.
 *
 * One query path builds the whole dashboard picture:
 *   · student collections — PAID students per class × that class's fee,
 *   · guest entry fees — 50 BDT × every paid outside guest,
 *   · guest lunch box sales — 150 BDT × every paid lunch box,
 *   · the SuperAdmin-set budget target per class, and the school-wide total.
 *
 * Fee and budget amounts come from the `classes` table; the guest amounts from
 * the stored guest rows (never from a client payload). See lib/guest-fees.ts
 * for the fixed guest price structure.
 */
import { GUEST_ENTRY_FEE, GUEST_LUNCH_FEE } from "@/lib/guest-fees";
import { listClasses } from "@/lib/portal-db";
import { guestFeeSummary, paidStudentsByClass } from "@/lib/student-db";

export interface ClassCollectionRow {
  class_name: string;
  /** Per-student ticket fee set on the class. */
  fee_amount: number;
  /** SuperAdmin-set ticket/fair budget target for the class. */
  budget_amount: number;
  students: number;
  paid: number;
  /** paid × fee_amount — the student money collected from this class. */
  collected: number;
  /** budget − collected (negative when the class overshot its target). */
  remaining: number;
}

export interface FairBudgetSummary {
  rows: ClassCollectionRow[];
  /** Sum of the class-wise student collections. */
  studentCollected: number;
  guestEntry: { fee: number; count: number; total: number };
  guestLunch: { fee: number; count: number; total: number };
  guestRegistered: number;
  /** Student collections + guest entry fees + lunch box sales. */
  totalCollected: number;
  /** Sum of every class budget target. */
  totalBudget: number;
  /** Budget still to reach (never below zero). */
  remainingBudget: number;
}

const classKey = (value: string) => value.trim().toLowerCase();

/** Build the complete budget/collection summary for one fair. */
export async function fairBudgetSummary(fairSlug: string): Promise<FairBudgetSummary> {
  const [classes, byClass, guestFees] = await Promise.all([listClasses(), paidStudentsByClass(fairSlug), guestFeeSummary(fairSlug)]);

  const roster = new Map(byClass.map((row) => [classKey(row.class_name), row]));
  const seen = new Set<string>();
  const rows: ClassCollectionRow[] = [];

  for (const item of classes) {
    const key = classKey(item.name);
    const match = roster.get(key);
    seen.add(key);
    const feeAmount = Number(item.fee_amount ?? 0);
    const budgetAmount = Number(item.budget_amount ?? 0);
    const paid = Number(match?.paid ?? 0);
    const collected = paid * feeAmount;
    rows.push({
      class_name: item.name,
      fee_amount: feeAmount,
      budget_amount: budgetAmount,
      students: Number(match?.total ?? 0),
      paid,
      collected,
      remaining: Math.max(0, budgetAmount - collected),
    });
  }
  // Roster classes with no entry in the classes table still show their counts.
  for (const row of byClass) {
    if (seen.has(classKey(row.class_name))) continue;
    rows.push({
      class_name: row.class_name,
      fee_amount: 0,
      budget_amount: 0,
      students: row.total,
      paid: row.paid,
      collected: 0,
      remaining: 0,
    });
  }

  const studentCollected = rows.reduce((sum, row) => sum + row.collected, 0);
  const totalBudget = rows.reduce((sum, row) => sum + row.budget_amount, 0);
  const totalCollected = studentCollected + guestFees.entryTotal + guestFees.lunchTotal;

  return {
    rows,
    studentCollected,
    guestEntry: { fee: GUEST_ENTRY_FEE, count: guestFees.entryCount, total: guestFees.entryTotal },
    guestLunch: { fee: GUEST_LUNCH_FEE, count: guestFees.lunchCount, total: guestFees.lunchTotal },
    guestRegistered: guestFees.registered,
    totalCollected,
    totalBudget,
    remainingBudget: Math.max(0, totalBudget - totalCollected),
  };
}

"use server";

import { requireProductionMember } from "@/lib/authz";
import { deleteEntityFile, uploadEntityFile } from "@/lib/file-storage";
import type { Expense } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq, inArray, sql } from "drizzle-orm";

export interface ExpenseInput {
  vendor: string;
  department: string;
  amount: number;
  status: Expense["status"];
  date: string;
  invoiceNumber: string;
}

function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validate(input: ExpenseInput) {
  const vendor = input.vendor.trim();
  const department = input.department.trim();
  if (!vendor) throw new Error("Vendor is required.");
  if (!department) throw new Error("Department is required.");
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("Amount must be a non-negative number.");
  return {
    vendor,
    department,
    amount: input.amount,
    status: input.status,
    date: input.date.trim(),
    invoiceNumber: toNullable(input.invoiceNumber),
  };
}

/**
 * `budget_lines.actual` is derived, not hand-entered — recomputed here from
 * every Approved/Paid expense in the department, inside the same
 * transaction as the expense write. Creates a budget line (budgeted: 0) on
 * demand if the department has spend but nobody's set a budget for it yet,
 * so "actual" tracking never silently drops a department.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle transaction type varies by driver; matches the pattern used elsewhere in this file's callers
async function recomputeActual(tx: any, productionId: string, department: string) {
  const [{ total }] = await tx
    .select({ total: sql<string>`coalesce(sum(${schema.expenses.amount}), 0)` })
    .from(schema.expenses)
    .where(
      and(
        eq(schema.expenses.productionId, productionId),
        eq(schema.expenses.department, department),
        inArray(schema.expenses.status, ["Approved", "Paid"]),
      ),
    );

  await tx
    .insert(schema.budgetLines)
    .values({ id: crypto.randomUUID(), productionId, department, budgeted: "0", actual: total })
    .onConflictDoUpdate({
      target: [schema.budgetLines.productionId, schema.budgetLines.department],
      set: { actual: total },
    });
}

export async function setBudget(productionId: string, department: string, budgeted: number) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const trimmedDepartment = department.trim();
  if (!trimmedDepartment) throw new Error("Department is required.");
  if (!Number.isFinite(budgeted) || budgeted < 0) throw new Error("Budget must be a non-negative number.");

  await runAsUser(user.id, (db) =>
    db
      .insert(schema.budgetLines)
      .values({ id: crypto.randomUUID(), productionId, department: trimmedDepartment, budgeted: String(budgeted), actual: "0" })
      .onConflictDoUpdate({
        target: [schema.budgetLines.productionId, schema.budgetLines.department],
        set: { budgeted: String(budgeted) },
      }),
  );
}

export async function createExpense(productionId: string, input: ExpenseInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);
  const id = crypto.randomUUID();

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      await tx.insert(schema.expenses).values({ id, productionId, ...values, amount: String(values.amount) });
      await recomputeActual(tx, productionId, values.department);
    }),
  );
  return id;
}

export async function updateExpense(productionId: string, id: string, input: ExpenseInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ department: schema.expenses.department })
        .from(schema.expenses)
        .where(and(eq(schema.expenses.id, id), eq(schema.expenses.productionId, productionId)))
        .limit(1);
      if (!existing) throw new Error("Invoice not found in this production.");

      await tx
        .update(schema.expenses)
        .set({ ...values, amount: String(values.amount) })
        .where(and(eq(schema.expenses.id, id), eq(schema.expenses.productionId, productionId)));

      await recomputeActual(tx, productionId, values.department);
      if (existing.department !== values.department) await recomputeActual(tx, productionId, existing.department);
    }),
  );
}

export async function deleteExpense(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ department: schema.expenses.department, documentPath: schema.expenses.documentPath })
        .from(schema.expenses)
        .where(and(eq(schema.expenses.id, id), eq(schema.expenses.productionId, productionId)))
        .limit(1);
      if (!existing) return;

      await tx.delete(schema.expenses).where(and(eq(schema.expenses.id, id), eq(schema.expenses.productionId, productionId)));
      await recomputeActual(tx, productionId, existing.department);
      if (existing.documentPath) await deleteEntityFile(existing.documentPath);
    }),
  );
}

export async function uploadExpenseFile(productionId: string, id: string, formData: FormData) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No file selected.");

  const [existing] = await runAsUser(user.id, (db) =>
    db
      .select({ documentPath: schema.expenses.documentPath })
      .from(schema.expenses)
      .where(and(eq(schema.expenses.id, id), eq(schema.expenses.productionId, productionId)))
      .limit(1),
  );
  if (!existing) throw new Error("Invoice not found in this production.");

  const path = await uploadEntityFile(productionId, "expense", id, file);
  await runAsUser(user.id, (db) =>
    db.update(schema.expenses).set({ documentPath: path }).where(and(eq(schema.expenses.id, id), eq(schema.expenses.productionId, productionId))),
  );
  if (existing.documentPath) await deleteEntityFile(existing.documentPath);
}

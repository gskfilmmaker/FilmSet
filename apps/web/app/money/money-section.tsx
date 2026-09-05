"use client";

import { STANDARD_DEPARTMENTS, type BudgetLine, type Expense } from "@filmset/core";
import {
  Button,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  useToast,
} from "@filmset/ui";
import { Paperclip, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createExpense, deleteExpense, setBudget, updateExpense, uploadExpenseFile, type ExpenseInput } from "./actions";

const EXPENSE_STATUSES: Expense["status"][] = ["Pending", "Approved", "Paid"];
const statusTone: Record<Expense["status"], "success" | "warning" | "info"> = { Pending: "warning", Approved: "info", Paid: "success" };

const OTHER_DEPARTMENT = "Other";
const DEPARTMENT_OPTIONS = [...STANDARD_DEPARTMENTS, OTHER_DEPARTMENT] as const;

function currency(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const emptyForm: ExpenseInput = {
  vendor: "",
  department: "",
  amount: 0,
  status: "Pending",
  date: "",
  invoiceNumber: "",
};

function DepartmentPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const isStandard = (STANDARD_DEPARTMENTS as readonly string[]).includes(value);
  const [custom, setCustom] = React.useState(() => !isStandard && value !== "");
  return (
    <div className="flex items-end gap-[var(--fs-space-8)]">
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Department</label>
        <Select
          value={custom ? OTHER_DEPARTMENT : value}
          onValueChange={(v) => {
            if (v === OTHER_DEPARTMENT) {
              setCustom(true);
              onChange("");
            } else {
              setCustom(false);
              onChange(v);
            }
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENT_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {custom && <Input label="Department name" value={value} onChange={(e) => onChange(e.target.value)} containerClassName="min-w-[130px]" />}
    </div>
  );
}

function ExpenseForm({ value, onChange }: { value: ExpenseInput; onChange: (next: ExpenseInput) => void }) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <Input label="Vendor" value={value.vendor} onChange={(e) => onChange({ ...value, vendor: e.target.value })} containerClassName="min-w-[140px] flex-1" />
      <DepartmentPicker value={value.department} onChange={(department) => onChange({ ...value, department })} />
      <Input
        label="Amount"
        type="number"
        min="0"
        step="0.01"
        value={value.amount || ""}
        onChange={(e) => onChange({ ...value, amount: Number(e.target.value) || 0 })}
        containerClassName="w-[110px]"
      />
      <Input label="Date" type="date" value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} containerClassName="w-[150px]" />
      <Input
        label="Invoice #"
        value={value.invoiceNumber}
        onChange={(e) => onChange({ ...value, invoiceNumber: e.target.value })}
        containerClassName="w-[110px]"
      />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Status</label>
        <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as Expense["status"] })}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function AttachFileButton({ expenseId, productionId, hasFile }: { expenseId: string; productionId: string; hasFile: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      await uploadExpenseFile(productionId, expenseId, formData);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't attach file", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" className="hidden" onChange={onFileChange} />
      <Button
        type="button"
        variant="quiet"
        iconOnly
        icon={<Paperclip className="size-[14px]" aria-hidden="true" />}
        aria-label={hasFile ? "Replace attached invoice" : "Attach invoice/receipt"}
        loading={uploading}
        onClick={() => inputRef.current?.click()}
      />
    </>
  );
}

export function MoneySection({
  productionId,
  expenses,
  budgetLines,
  fileUrls,
}: {
  productionId: string;
  expenses: Expense[];
  budgetLines: BudgetLine[];
  fileUrls: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<ExpenseInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<ExpenseInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [budgetDrafts, setBudgetDrafts] = React.useState<Record<string, string>>({});
  const [savingBudget, setSavingBudget] = React.useState<string | null>(null);

  const departments = React.useMemo(() => {
    const names = new Set<string>([...budgetLines.map((b) => b.department), ...expenses.map((e) => e.department)]);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [budgetLines, expenses]);

  const totals = React.useMemo(() => {
    const budgeted = budgetLines.reduce((sum, b) => sum + b.budgeted, 0);
    const actual = budgetLines.reduce((sum, b) => sum + b.actual, 0);
    return { budgeted, actual, remaining: budgeted - actual };
  }, [budgetLines]);

  async function onSaveBudget(department: string) {
    const raw = budgetDrafts[department];
    const amount = Number(raw);
    if (raw === undefined || !Number.isFinite(amount) || amount < 0) return;
    setSavingBudget(department);
    try {
      await setBudget(productionId, department, amount);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save budget", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSavingBudget(null);
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createExpense(productionId, addForm);
      toast({ tone: "success", title: "Invoice added", description: addForm.vendor });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add invoice", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setEditForm({
      vendor: expense.vendor,
      department: expense.department,
      amount: expense.amount,
      status: expense.status,
      date: expense.date,
      invoiceNumber: expense.invoiceNumber ?? "",
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateExpense(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(id: string) {
    setPendingId(id);
    try {
      await deleteExpense(productionId, id);
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't remove invoice", description: "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-24)]">
      <div className="grid grid-cols-1 gap-[var(--fs-space-16)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)] sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">Total Budgeted</p>
          <p className="text-[18px] font-semibold text-[var(--color-text-primary)]">{currency(totals.budgeted)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">Total Actual</p>
          <p className="text-[18px] font-semibold text-[var(--color-text-primary)]">{currency(totals.actual)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">Remaining</p>
          <p className={`text-[18px] font-semibold ${totals.remaining < 0 ? "text-[var(--color-status-danger)]" : "text-[var(--color-text-primary)]"}`}>
            {currency(totals.remaining)}
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-[var(--fs-space-8)]">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">Budget by Department</h2>
        {departments.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-tertiary)]">No budget set yet — add an invoice below, or set a budget for a department.</p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border-standard)] text-left text-[12px] text-[var(--color-text-tertiary)]">
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Department</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Budgeted</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Actual</th>
                <th className="py-[6px] pr-[var(--fs-space-8)] font-medium">Variance</th>
                <th className="py-[6px] font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => {
                const line = budgetLines.find((b) => b.department === department) ?? { department, budgeted: 0, actual: 0 };
                const variance = line.budgeted > 0 ? ((line.actual - line.budgeted) / line.budgeted) * 100 : 0;
                const draft = budgetDrafts[department] ?? String(line.budgeted);
                return (
                  <tr key={department} className="border-b border-[var(--color-border-subtle)]">
                    <td className="py-[6px] pr-[var(--fs-space-8)] text-[var(--color-text-primary)]">{department}</td>
                    <td className="py-[6px] pr-[var(--fs-space-8)]">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft}
                        onChange={(e) => setBudgetDrafts((prev) => ({ ...prev, [department]: e.target.value }))}
                        onBlur={() => onSaveBudget(department)}
                        containerClassName="w-[110px]"
                      />
                    </td>
                    <td className="py-[6px] pr-[var(--fs-space-8)] tabular-nums text-[var(--color-text-secondary)]">{currency(line.actual)}</td>
                    <td className="py-[6px] pr-[var(--fs-space-8)]">
                      {line.budgeted > 0 && (
                        <StatusBadge tone={variance > 0 ? "warning" : "success"}>
                          {variance >= 0 ? "+" : ""}
                          {variance.toFixed(1)}%
                        </StatusBadge>
                      )}
                    </td>
                    <td className="py-[6px]">{savingBudget === department && <span className="text-[11px] text-[var(--color-text-tertiary)]">Saving…</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-[var(--fs-space-8)]">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">Invoices</h2>

        {expenses.length === 0 && !adding && (
          <EmptyState icon={<Wallet className="size-full" />} title="No invoices yet" description="Add an invoice to start tracking real spend against budget." action={<Button onClick={() => setAdding(true)}>Add invoice</Button>} />
        )}

        {expenses.length > 0 && (
          <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
            {expenses.map((expense) =>
              editingId === expense.id ? (
                <li key={expense.id} className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                  <form onSubmit={(e) => onSaveEdit(e, expense.id)} className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
                    <ExpenseForm value={editForm} onChange={setEditForm} />
                    <Button type="submit" loading={pendingId === expense.id} disabled={pendingId !== null}>
                      Save
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={pendingId !== null}>
                      Cancel
                    </Button>
                  </form>
                </li>
              ) : (
                <li key={expense.id} className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-[6px] truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                      {expense.vendor}
                      <span className="font-normal text-[var(--color-text-tertiary)]">— {expense.department}</span>
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                      {expense.date || "No date"}
                      {expense.invoiceNumber && ` · Invoice ${expense.invoiceNumber}`}
                      {fileUrls[expense.documentPath ?? ""] && (
                        <>
                          {" · "}
                          <a href={fileUrls[expense.documentPath ?? ""]} target="_blank" rel="noreferrer" className="text-[var(--color-action-primary)] hover:underline">
                            Attachment
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                    <span className="tabular-nums text-[13px] font-medium text-[var(--color-text-primary)]">{currency(expense.amount)}</span>
                    <StatusBadge tone={statusTone[expense.status]}>{expense.status}</StatusBadge>
                    <AttachFileButton expenseId={expense.id} productionId={productionId} hasFile={Boolean(expense.documentPath)} />
                    <Button
                      variant="quiet"
                      iconOnly
                      icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                      aria-label={`Edit ${expense.vendor}`}
                      onClick={() => startEdit(expense)}
                      disabled={pendingId !== null}
                    />
                    <Button
                      variant="quiet"
                      iconOnly
                      icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                      aria-label={`Remove ${expense.vendor}`}
                      loading={pendingId === expense.id}
                      disabled={pendingId !== null}
                      onClick={() => onDelete(expense.id)}
                    />
                  </div>
                </li>
              ),
            )}
          </ul>
        )}

        {expenses.length > 0 && !adding && (
          <Button variant="secondary" icon={<Plus className="size-[14px]" aria-hidden="true" />} onClick={() => setAdding(true)} className="self-start">
            Add invoice
          </Button>
        )}

        {adding && (
          <form onSubmit={onAdd} className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap">
            <ExpenseForm value={addForm} onChange={setAddForm} />
            <Button type="submit" loading={saving} disabled={saving}>
              Add
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

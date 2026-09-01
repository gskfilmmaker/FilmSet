"use client";

import { Shell } from "@/components/shell";
import type { Production, Scene } from "@filmset/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@filmset/ui";
import { MoreHorizontal, UserCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { addDepartmentMember, changeDepartmentMemberRole, removeDepartmentMember, setDepartmentHead } from "../actions";

export interface EligibleMember {
  userId: string;
  label: string;
}

export interface DepartmentMemberRow {
  userId: string;
  label: string;
  roleId: string | null;
  roleName: string;
  since: string;
}

export interface RoleOption {
  id: string;
  name: string;
}

/** DEPARTMENT_UX_SPEC.md §3 — Membership screen, with §4's HOD assignment folded in as the "Change HOD" dialog rather than a separate route. */
export function DepartmentMembership({
  production,
  scenes,
  userEmail,
  departmentId,
  departmentName,
  head,
  members,
  eligibleMembers,
  roleOptions,
}: {
  production: Pick<Production, "id" | "name" | "phase">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
  userEmail: string | null;
  departmentId: string;
  departmentName: string;
  head: { userId: string; label: string } | null;
  members: DepartmentMemberRow[];
  eligibleMembers: EligibleMember[];
  roleOptions: RoleOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const UNASSIGNED = "__unassigned__";
  const [hodDialogOpen, setHodDialogOpen] = React.useState(false);
  const [hodChoice, setHodChoice] = React.useState<string>(head?.userId ?? UNASSIGNED);
  const [savingHod, setSavingHod] = React.useState(false);

  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [addUserId, setAddUserId] = React.useState<string>("");
  const [addRoleId, setAddRoleId] = React.useState<string>(roleOptions.find((r) => r.id === "role_department_member")?.id ?? roleOptions[0]?.id ?? "");
  const [adding, setAdding] = React.useState(false);

  const [pendingUserId, setPendingUserId] = React.useState<string | null>(null);

  const memberIds = React.useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  async function onSaveHod() {
    setSavingHod(true);
    try {
      const chosenUserId = hodChoice === UNASSIGNED ? null : hodChoice;
      // If the chosen HOD isn't already a member, add them as one first —
      // DEPARTMENT_UX_SPEC.md §3's "add as member and assign HOD in one step".
      if (chosenUserId && !memberIds.has(chosenUserId)) {
        const roleId = roleOptions.find((r) => r.id === "role_department_head")?.id ?? roleOptions[0]?.id;
        if (roleId) await addDepartmentMember(production.id, departmentId, chosenUserId, roleId);
      }
      await setDepartmentHead(production.id, departmentId, chosenUserId);
      toast({ tone: "success", title: chosenUserId ? "Department head updated" : "Department head cleared" });
      setHodDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't update department head", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSavingHod(false);
    }
  }

  async function onAddMember() {
    if (!addUserId || !addRoleId) return;
    setAdding(true);
    try {
      await addDepartmentMember(production.id, departmentId, addUserId, addRoleId);
      toast({ tone: "success", title: "Member added" });
      setAddDialogOpen(false);
      setAddUserId("");
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add member", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setAdding(false);
    }
  }

  async function onChangeRole(userId: string, roleId: string) {
    setPendingUserId(userId);
    try {
      await changeDepartmentMemberRole(production.id, departmentId, userId, roleId);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't change role", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingUserId(null);
    }
  }

  async function onRemoveMember(userId: string) {
    setPendingUserId(userId);
    try {
      await removeDepartmentMember(production.id, departmentId, userId);
      toast({ tone: "success", title: "Member removed" });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove member", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <Shell production={production} scenes={scenes} userEmail={userEmail ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div className="flex flex-col gap-[var(--fs-space-4)]">
          <Link href="/settings/departments" className="text-[13px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
            ← Departments
          </Link>
          <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
            <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">{departmentName}</h1>
            <Link href={`/settings/departments/${departmentId}/permissions`} className="text-[13px] text-[var(--color-action-primary)] hover:underline">
              View permissions →
            </Link>
          </div>
        </div>

        <section className="flex flex-col gap-[var(--fs-space-8)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Head of Department</h2>
          <div className="flex items-center justify-between gap-[var(--fs-space-16)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)]">
            <div className="flex items-center gap-[var(--fs-space-8)]">
              <UserCircle2 className="size-[20px] text-[var(--color-text-tertiary)]" aria-hidden="true" />
              <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{head?.label ?? "— Unassigned —"}</span>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setHodChoice(head?.userId ?? UNASSIGNED);
                setHodDialogOpen(true);
              }}
            >
              Change HOD
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-[var(--fs-space-8)]">
          <div className="flex items-center justify-between gap-[var(--fs-space-16)]">
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Members</h2>
            <Button variant="secondary" onClick={() => setAddDialogOpen(true)} disabled={eligibleMembers.length === 0}>
              Add member
            </Button>
          </div>

          {members.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border-subtle)] p-[var(--fs-space-16)] text-center text-[13px] text-[var(--color-text-tertiary)]">
              No members yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
                  <span className="min-w-0 truncate text-[13px] font-medium text-[var(--color-text-primary)]">{m.label}</span>
                  <div className="flex shrink-0 items-center gap-[var(--fs-space-12)]">
                    <Select value={m.roleId ?? undefined} onValueChange={(v) => onChangeRole(m.userId, v)} disabled={pendingUserId === m.userId}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={m.roleName} />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-[12px] text-[var(--color-text-tertiary)]">Since {m.since}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="quiet"
                          iconOnly
                          icon={<MoreHorizontal className="size-[14px]" aria-hidden="true" />}
                          aria-label={`Actions for ${m.label}`}
                          disabled={pendingUserId === m.userId}
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onRemoveMember(m.userId)}>Remove from department</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={hodDialogOpen} onOpenChange={setHodDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Head of Department</DialogTitle>
          </DialogHeader>
          <div className="mt-[var(--fs-space-16)] flex flex-col gap-[4px]">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Head of Department</label>
            <Select value={hodChoice} onValueChange={setHodChoice}>
              <SelectTrigger>
                <SelectValue placeholder="— Unassigned —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.label} (member)
                  </SelectItem>
                ))}
                {eligibleMembers.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.label} (add as member)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setHodDialogOpen(false)} disabled={savingHod}>
              Cancel
            </Button>
            <Button onClick={onSaveHod} loading={savingHod} disabled={savingHod}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member to {departmentName}</DialogTitle>
          </DialogHeader>
          <div className="mt-[var(--fs-space-16)] flex flex-col gap-[var(--fs-space-12)]">
            <div className="flex flex-col gap-[4px]">
              <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Person</label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a production member" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-[4px]">
              <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Role</label>
              <Select value={addRoleId} onValueChange={setAddRoleId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddDialogOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={onAddMember} loading={adding} disabled={adding || !addUserId}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

"use client";

import type { TeamMember } from "@/lib/queries";
import { PRODUCTION_ROLES, type ProductionRole } from "@filmset/auth";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  useToast,
} from "@filmset/ui";
import { UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { inviteMember, removeMember, updateMemberRole } from "./team-actions";

/**
 * Reads server-fetched `members` directly rather than keeping local copy
 * state: an invite doesn't know the new member's real user id until the
 * server assigns one, so router.refresh() (re-running the Server
 * Component's getProductionSnapshot) is the correct source of truth here,
 * not a hand-rolled optimistic splice. Team edits are infrequent enough
 * that the refresh round-trip is the right tradeoff over local state.
 */
export function TeamSection({
  productionId,
  members,
  myUserId,
  myRole,
}: {
  productionId: string;
  members: TeamMember[];
  myUserId: string;
  myRole: ProductionRole;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<ProductionRole>("Crew");
  const [inviting, setInviting] = React.useState(false);
  const [pendingUserId, setPendingUserId] = React.useState<string | null>(null);
  const { toast } = useToast();
  const isOwner = myRole === "Producer";

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      await inviteMember(productionId, email, role);
      toast({ tone: "success", title: "Member added", description: email });
      setEmail("");
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add member", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setInviting(false);
    }
  }

  async function onRoleChange(userId: string, nextRole: ProductionRole) {
    setPendingUserId(userId);
    try {
      await updateMemberRole(productionId, userId, nextRole);
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't change role", description: "Please try again." });
    } finally {
      setPendingUserId(null);
    }
  }

  async function onRemove(userId: string) {
    setPendingUserId(userId);
    try {
      await removeMember(productionId, userId);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't remove member", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-[var(--fs-space-16)] py-[var(--fs-space-8)] first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{m.fullName || m.email}</p>
              {m.fullName && <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">{m.email}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
              {isOwner ? (
                <Select value={m.role} onValueChange={(v) => onRoleChange(m.userId, v as ProductionRole)}>
                  <SelectTrigger className="h-[28px] w-[160px] text-[12px]" disabled={pendingUserId === m.userId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <StatusBadge tone="neutral">{m.role}</StatusBadge>
              )}
              {(isOwner || m.userId === myUserId) && (
                <Button
                  variant="quiet"
                  iconOnly
                  icon={<UserMinus className="size-[14px]" aria-hidden="true" />}
                  aria-label={m.userId === myUserId ? "Leave production" : `Remove ${m.email}`}
                  loading={pendingUserId === m.userId}
                  disabled={pendingUserId !== null}
                  onClick={() => onRemove(m.userId)}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={onInvite} className="flex items-end gap-[var(--fs-space-8)] border-t border-[var(--color-border-subtle)] pt-[var(--fs-space-16)]">
          <Input
            label="Add by email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            containerClassName="flex-1"
          />
          <Select value={role} onValueChange={(v) => setRole(v as ProductionRole)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTION_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" loading={inviting} disabled={inviting}>
            Add
          </Button>
        </form>
      )}
    </div>
  );
}

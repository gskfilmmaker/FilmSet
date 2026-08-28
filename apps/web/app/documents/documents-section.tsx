"use client";

import { documentTypeSchema, type CastMember, type Character, type CrewMember, type DocumentRecord, type Location } from "@filmset/core";
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
import { FolderOpen, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createDocument, deleteDocument, updateDocument, uploadDocumentFile, type DocumentInput } from "./actions";

const DOCUMENT_TYPES = documentTypeSchema.options;
const DOCUMENT_STATUSES: DocumentRecord["status"][] = ["Draft", "Review", "Approved", "Published", "Locked", "Superseded"];
const statusTone: Record<DocumentRecord["status"], "neutral" | "warning" | "info" | "success" | "danger"> = {
  Draft: "neutral",
  Review: "warning",
  Approved: "info",
  Published: "success",
  Locked: "success",
  Superseded: "danger",
};

const NONE = "none";
type LinkValue = string; // "none" | `cast:${id}` | `crew:${id}` | `location:${id}`

function linkValueFor(input: DocumentInput): LinkValue {
  if (input.linkedCastMemberId) return `cast:${input.linkedCastMemberId}`;
  if (input.linkedCrewMemberId) return `crew:${input.linkedCrewMemberId}`;
  if (input.linkedLocationId) return `location:${input.linkedLocationId}`;
  return NONE;
}

function applyLinkValue(input: DocumentInput, value: LinkValue): DocumentInput {
  const [kind, id] = value.split(":");
  return {
    ...input,
    linkedCastMemberId: kind === "cast" ? (id ?? null) : null,
    linkedCrewMemberId: kind === "crew" ? (id ?? null) : null,
    linkedLocationId: kind === "location" ? (id ?? null) : null,
  };
}

function isExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  const days = (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days <= 30;
}

const emptyForm: DocumentInput = {
  name: "",
  type: "Other",
  status: "Draft",
  expiryDate: "",
  linkedCastMemberId: null,
  linkedCrewMemberId: null,
  linkedLocationId: null,
};

function DocumentForm({
  value,
  onChange,
  castOptions,
  crewOptions,
  locationOptions,
}: {
  value: DocumentInput;
  onChange: (next: DocumentInput) => void;
  castOptions: { id: string; label: string }[];
  crewOptions: { id: string; label: string }[];
  locationOptions: { id: string; label: string }[];
}) {
  return (
    <div className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
      <Input label="Name" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} containerClassName="min-w-[160px] flex-1" />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Type</label>
        <Select value={value.type} onValueChange={(v) => onChange({ ...value, type: v as DocumentRecord["type"] })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Status</label>
        <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as DocumentRecord["status"] })}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input label="Expiry" type="date" value={value.expiryDate} onChange={(e) => onChange({ ...value, expiryDate: e.target.value })} containerClassName="w-[150px]" />
      <div className="flex flex-col gap-[4px]">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Linked to</label>
        <Select value={linkValueFor(value)} onValueChange={(v) => onChange(applyLinkValue(value, v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Nothing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nothing specific</SelectItem>
            {castOptions.map((c) => (
              <SelectItem key={`cast:${c.id}`} value={`cast:${c.id}`}>
                Cast — {c.label}
              </SelectItem>
            ))}
            {crewOptions.map((c) => (
              <SelectItem key={`crew:${c.id}`} value={`crew:${c.id}`}>
                Crew — {c.label}
              </SelectItem>
            ))}
            {locationOptions.map((l) => (
              <SelectItem key={`location:${l.id}`} value={`location:${l.id}`}>
                Location — {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function AttachFileButton({ documentId, productionId }: { documentId: string; productionId: string }) {
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
      await uploadDocumentFile(productionId, documentId, formData);
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
        aria-label="Attach or replace file"
        loading={uploading}
        onClick={() => inputRef.current?.click()}
      />
    </>
  );
}

export function DocumentsSection({
  productionId,
  documents,
  castMembers,
  characters,
  crewMembers,
  locations,
  fileUrls,
}: {
  productionId: string;
  documents: DocumentRecord[];
  castMembers: CastMember[];
  characters: Character[];
  crewMembers: CrewMember[];
  locations: Location[];
  fileUrls: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState<DocumentInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<DocumentInput>(emptyForm);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const castOptions = React.useMemo(
    () => castMembers.map((c) => ({ id: c.id, label: `${characters.find((ch) => ch.id === c.characterId)?.name ?? "Unknown"} — ${c.actorName || "Not yet cast"}` })),
    [castMembers, characters],
  );
  const crewOptions = React.useMemo(() => crewMembers.map((c) => ({ id: c.id, label: `${c.name} (${c.department})` })), [crewMembers]);
  const locationOptions = React.useMemo(() => locations.map((l) => ({ id: l.id, label: l.name })), [locations]);

  function linkedLabel(doc: DocumentRecord): string | null {
    if (doc.linkedCastMemberId) return castOptions.find((c) => c.id === doc.linkedCastMemberId)?.label ?? null;
    if (doc.linkedCrewMemberId) return crewOptions.find((c) => c.id === doc.linkedCrewMemberId)?.label ?? null;
    if (doc.linkedLocationId) return locationOptions.find((l) => l.id === doc.linkedLocationId)?.label ?? null;
    return null;
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDocument(productionId, addForm);
      toast({ tone: "success", title: "Document added", description: addForm.name });
      setAddForm(emptyForm);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't add document", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(doc: DocumentRecord) {
    setEditingId(doc.id);
    setEditForm({
      name: doc.name,
      type: doc.type,
      status: doc.status,
      expiryDate: doc.expiryDate ?? "",
      linkedCastMemberId: doc.linkedCastMemberId,
      linkedCrewMemberId: doc.linkedCrewMemberId,
      linkedLocationId: doc.linkedLocationId,
    });
  }

  async function onSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setPendingId(id);
    try {
      await updateDocument(productionId, id, editForm);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save changes", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function onDelete(doc: DocumentRecord) {
    setPendingId(doc.id);
    try {
      await deleteDocument(productionId, doc.id);
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't remove document", description: "Please try again." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      {documents.length === 0 && !adding && (
        <EmptyState
          icon={<FolderOpen className="size-full" />}
          title="No documents yet"
          description="Upload contracts, permits, deal memos, and anything else worth tracking."
          action={<Button onClick={() => setAdding(true)}>Add document</Button>}
        />
      )}

      {documents.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {documents.map((doc) =>
            editingId === doc.id ? (
              <li key={doc.id} className="flex items-end gap-[var(--fs-space-8)] p-[var(--fs-space-12)]">
                <form onSubmit={(e) => onSaveEdit(e, doc.id)} className="flex flex-1 flex-wrap items-end gap-[var(--fs-space-8)]">
                  <DocumentForm value={editForm} onChange={setEditForm} castOptions={castOptions} crewOptions={crewOptions} locationOptions={locationOptions} />
                  <Button type="submit" loading={pendingId === doc.id} disabled={pendingId !== null}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={pendingId !== null}>
                    Cancel
                  </Button>
                </form>
              </li>
            ) : (
              <li key={doc.id} className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-[6px] truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                    {doc.name}
                    <span className="font-normal text-[var(--color-text-tertiary)]">— {doc.type}</span>
                  </p>
                  <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">
                    Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    {linkedLabel(doc) && ` · ${linkedLabel(doc)}`}
                    {fileUrls[doc.filePath ?? ""] && (
                      <>
                        {" · "}
                        <a href={fileUrls[doc.filePath ?? ""]} target="_blank" rel="noreferrer" className="text-[var(--color-action-primary)] hover:underline">
                          Open file
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-[var(--fs-space-8)]">
                  {isExpiringSoon(doc.expiryDate) && <StatusBadge tone="warning">Expiring soon</StatusBadge>}
                  <StatusBadge tone={statusTone[doc.status]}>{doc.status}</StatusBadge>
                  <AttachFileButton documentId={doc.id} productionId={productionId} />
                  <Button
                    variant="quiet"
                    iconOnly
                    icon={<Pencil className="size-[14px]" aria-hidden="true" />}
                    aria-label={`Edit ${doc.name}`}
                    onClick={() => startEdit(doc)}
                    disabled={pendingId !== null}
                  />
                  <Button
                    variant="quiet"
                    iconOnly
                    icon={<Trash2 className="size-[14px]" aria-hidden="true" />}
                    aria-label={`Remove ${doc.name}`}
                    loading={pendingId === doc.id}
                    disabled={pendingId !== null}
                    onClick={() => onDelete(doc)}
                  />
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {documents.length > 0 && !adding && (
        <Button variant="secondary" icon={<Plus className="size-[14px]" aria-hidden="true" />} onClick={() => setAdding(true)} className="self-start">
          Add document
        </Button>
      )}

      {adding && (
        <form onSubmit={onAdd} className="flex flex-col items-end gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-12)] sm:flex-row sm:flex-wrap">
          <DocumentForm value={addForm} onChange={setAddForm} castOptions={castOptions} crewOptions={crewOptions} locationOptions={locationOptions} />
          <Button type="submit" loading={saving} disabled={saving}>
            Add
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(false)} disabled={saving}>
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}

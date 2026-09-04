"use client";

import { commitImport, previewDocumentImport, previewTabularImport } from "@/app/import/actions";
import { IMPORT_FIELDS, type ImportCandidate, type ImportEntityType } from "@/lib/import/types";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Input,
  StatusBadge,
  useToast,
} from "@filmset/ui";
import { Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

const ENTITY_LABEL: Record<ImportEntityType, string> = {
  cast: "cast",
  crew: "crew",
  location: "locations",
  expense: "invoices",
  vehicle: "vehicles",
  driver: "drivers",
  property: "properties",
  vendor: "vendors",
  equipmentVendor: "equipment vendors",
  equipmentCatalogItem: "equipment",
};
const DOCUMENT_CAPABLE: ImportEntityType[] = ["cast", "crew", "location", "vehicle", "driver", "property", "vendor", "equipmentVendor", "equipmentCatalogItem"];

function isTabular(file: File): boolean {
  return /\.(csv|xlsx|xls)$/i.test(file.name);
}
function isDocument(file: File): boolean {
  return /\.(pdf|docx)$/i.test(file.name);
}

export function ImportPanel({ productionId, entityType }: { productionId: string; entityType: ImportEntityType }) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const [candidates, setCandidates] = React.useState<ImportCandidate[]>([]);
  const [skipped, setSkipped] = React.useState<string[]>([]);
  const [logId, setLogId] = React.useState<string | undefined>(undefined);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const fields = IMPORT_FIELDS[entityType];
  const acceptsDocument = DOCUMENT_CAPABLE.includes(entityType);
  const accept = acceptsDocument ? ".csv,.xlsx,.xls,.pdf,.docx" : ".csv,.xlsx,.xls";

  function reset() {
    setCandidates([]);
    setSkipped([]);
    setLogId(undefined);
    setFileName(null);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setFileName(file.name);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = isDocument(file)
        ? await previewDocumentImport(productionId, entityType, formData)
        : isTabular(file)
          ? await previewTabularImport(productionId, entityType, formData)
          : null;
      if (!result) throw new Error(`Unsupported file type — use ${accept}.`);
      setCandidates(result.candidates);
      setSkipped(result.skipped);
      setLogId(result.logId);
      toast({
        tone: "success",
        title: "File read",
        description: `Found ${result.candidates.length} row${result.candidates.length === 1 ? "" : "s"}${result.skipped.length > 0 ? ` (${result.skipped.length} skipped — see below)` : ""}. Review below, then import.`,
      });
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't read that file", description: err instanceof Error ? err.message : "Please try again." });
      setFileName(null);
    } finally {
      setLoading(false);
    }
  }

  function updateField(id: string, key: string, value: string) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, fields: { ...c.fields, [key]: value } } : c)));
  }
  function toggleSelected(id: string) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));
  }
  function removeCandidate(id: string) {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  }

  const selectedCount = candidates.filter((c) => c.selected).length;

  async function onCommit() {
    setCommitting(true);
    try {
      const result = await commitImport(productionId, entityType, candidates, logId);
      toast({
        tone: "success",
        title: "Import complete",
        description: `${result.created} added${result.updated ? `, ${result.updated} updated` : ""}.`,
      });
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't finish import", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setCommitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DrawerTrigger asChild>
        <Button variant="secondary" icon={<Upload className="size-[14px]" aria-hidden="true" />}>
          Import
        </Button>
      </DrawerTrigger>
      <DrawerContent className="flex w-[min(520px,100vw)] flex-col">
        <DrawerHeader>
          <DrawerTitle>Import {ENTITY_LABEL[entityType]}</DrawerTitle>
          <p className="text-[12px] text-[var(--color-text-tertiary)]">
            Upload a CSV or Excel contact list{acceptsDocument ? ", or a PDF/Word document" : ""}. Nothing is saved until you review it below and import.
          </p>
        </DrawerHeader>

        <DrawerBody className="flex min-h-0 flex-1 flex-col gap-[var(--fs-space-12)]">
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onFileChange} />
          <Button type="button" variant="secondary" loading={loading} onClick={() => inputRef.current?.click()}>
            {fileName ?? `Choose a file (${accept})`}
          </Button>

          {skipped.length > 0 && (
            <p className="text-[12px] text-[var(--color-status-warning)]">
              {skipped.length} row{skipped.length === 1 ? "" : "s"} couldn&apos;t be read — missing a required column.
            </p>
          )}

          {candidates.map((candidate) => (
            <div key={candidate.id} className="flex flex-col gap-[6px] rounded-md border border-[var(--color-border-subtle)] p-[var(--fs-space-8)]">
              <div className="flex items-center gap-[var(--fs-space-8)]">
                <input
                  type="checkbox"
                  checked={candidate.selected}
                  onChange={() => toggleSelected(candidate.id)}
                  className="size-[14px] accent-[var(--color-action-primary)]"
                  aria-label="Include this row"
                />
                <StatusBadge tone={candidate.action === "update" ? "info" : "success"}>{candidate.action === "update" ? "Update" : "New"}</StatusBadge>
                <Button
                  variant="quiet"
                  iconOnly
                  icon={<Trash2 className="size-[12px]" aria-hidden="true" />}
                  aria-label="Discard this row"
                  className="ml-auto"
                  onClick={() => removeCandidate(candidate.id)}
                />
              </div>
              <div className="grid grid-cols-2 gap-[6px]">
                {fields.map((field) => (
                  <Input
                    key={field.key}
                    label={field.label}
                    value={candidate.fields[field.key] ?? ""}
                    onChange={(e) => updateField(candidate.id, field.key, e.target.value)}
                    containerClassName={field.key === fields[0]?.key ? "col-span-2" : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" disabled={committing}>
              Cancel
            </Button>
          </DrawerClose>
          <Button onClick={onCommit} loading={committing} disabled={selectedCount === 0 || committing}>
            Import {selectedCount > 0 ? selectedCount : ""}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

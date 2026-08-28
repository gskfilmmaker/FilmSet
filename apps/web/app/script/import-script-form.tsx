"use client";

import { Button, Textarea, useToast } from "@filmset/ui";
import { Upload } from "lucide-react";
import * as React from "react";
import { importRevision, importScript } from "./import-actions";

const PLACEHOLDER = `INT. TAXI - NIGHT

Rain hammers the windshield. FARID grips the wheel, knuckles white.

FARID
We are almost there.

RAJ
Almost is not good enough.`;

export function ImportScriptForm({
  productionId,
  onImported,
  mode = "new",
}: {
  productionId: string;
  onImported: () => void;
  /** "new" for a scene-less production's first import; "revision" re-matches against the existing script and only touches what changed. */
  mode?: "new" | "revision";
}) {
  const [text, setText] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const content = await file.text();
      setText(content);
    } catch {
      toast({ tone: "danger", title: "Couldn't read file", description: "Please try again or paste the text directly." });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setImporting(true);
    try {
      if (mode === "revision") {
        const result = await importRevision(productionId, text);
        if (result.changedCount === 0 && result.newCount === 0) {
          toast({
            tone: result.castCount > 0 ? "success" : "info",
            title: result.castCount > 0 ? `${result.castCount} cast slot${result.castCount === 1 ? "" : "s"} linked` : "No changes found",
            description:
              result.castCount > 0
                ? "Script content matches what's on file — no revision needed, but Cast is now caught up with it."
                : "This matches the script already on file.",
          });
        } else {
          const parts = [
            result.changedCount > 0 ? `${result.changedCount} scene${result.changedCount === 1 ? "" : "s"} updated` : null,
            result.newCount > 0 ? `${result.newCount} new scene${result.newCount === 1 ? "" : "s"}` : null,
            result.castCount > 0 ? `${result.castCount} cast slot${result.castCount === 1 ? "" : "s"} linked` : null,
          ].filter(Boolean);
          toast({ tone: "success", title: `${result.revisionColor} revision imported`, description: parts.join(", ") });
        }
      } else {
        const result = await importScript(productionId, text);
        toast({
          tone: "success",
          title: `Imported ${result.sceneCount} scene${result.sceneCount === 1 ? "" : "s"}`,
          description: `${result.locationCount} location${result.locationCount === 1 ? "" : "s"} and ${result.castCount} cast slot${result.castCount === 1 ? "" : "s"} found or created.`,
        });
      }
      setText("");
      onImported();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't import script", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[var(--fs-space-16)] p-[var(--fs-space-24)]">
      <div className="text-center">
        <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{mode === "revision" ? "Import a revision" : "No scenes yet"}</p>
        <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">
          {mode === "revision" ? (
            <>
              Upload or paste the <strong>full, current</strong> script. Scenes are matched to the existing ones by their
              position in the script — only what actually changed gets updated and moved to the next revision color; new
              scenes are added at the end.
            </>
          ) : (
            <>
              Upload a plain-text (.txt/.fountain) screenplay, or paste one below. Scene headings like &quot;INT. TAXI -
              NIGHT&quot; become scenes; action, character cues, and dialogue underneath each one are parsed automatically —
              and every character who speaks gets a Cast slot, linked to the scenes they appear in.
            </>
          )}{" "}
          PDF and Final Draft (.fdx) files aren&apos;t supported yet — export or copy the text first.
        </p>
      </div>
      <input ref={fileInputRef} type="file" accept=".txt,.fountain,text/plain" onChange={onFileSelected} className="hidden" />
      <Button
        type="button"
        variant="secondary"
        icon={<Upload className="size-[14px]" aria-hidden="true" />}
        onClick={() => fileInputRef.current?.click()}
        className="self-center"
      >
        Upload a file
      </Button>
      <form onSubmit={onSubmit} className="flex flex-col gap-[var(--fs-space-12)]">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder={PLACEHOLDER}
          className="font-mono text-[13px]"
        />
        <Button type="submit" loading={importing} disabled={importing || !text.trim()} className="self-center">
          {mode === "revision" ? "Import revision" : "Import script"}
        </Button>
      </form>
    </div>
  );
}

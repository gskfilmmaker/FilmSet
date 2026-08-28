"use client";

import { Button, Textarea, useToast } from "@filmset/ui";
import { Upload } from "lucide-react";
import * as React from "react";
import { importScript } from "./import-actions";

const PLACEHOLDER = `INT. TAXI - NIGHT

Rain hammers the windshield. FARID grips the wheel, knuckles white.

FARID
We are almost there.

RAJ
Almost is not good enough.`;

export function ImportScriptForm({ productionId, onImported }: { productionId: string; onImported: () => void }) {
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
      const result = await importScript(productionId, text);
      toast({
        tone: "success",
        title: `Imported ${result.sceneCount} scene${result.sceneCount === 1 ? "" : "s"}`,
        description: `${result.locationCount} location${result.locationCount === 1 ? "" : "s"} found or created.`,
      });
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
        <p className="text-[14px] font-medium text-[var(--color-text-primary)]">No scenes yet</p>
        <p className="mt-[4px] text-[13px] text-[var(--color-text-secondary)]">
          Upload a plain-text (.txt/.fountain) screenplay, or paste one below. Scene headings like &quot;INT. TAXI -
          NIGHT&quot; become scenes; action, character cues, and dialogue underneath each one are parsed automatically.
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
          Import script
        </Button>
      </form>
    </div>
  );
}

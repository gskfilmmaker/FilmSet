"use client";

import { Button, Textarea, useToast } from "@filmset/ui";
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
  const { toast } = useToast();

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
          Paste a screenplay below. Scene headings like &quot;INT. TAXI - NIGHT&quot; become scenes; action, character
          cues, and dialogue underneath each one are parsed automatically.
        </p>
      </div>
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

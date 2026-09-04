"use client";

import { Printer } from "lucide-react";
import { Button } from "@filmset/ui";

export function PrintButton() {
  return (
    <Button
      variant="secondary"
      icon={<Printer className="size-[14px]" aria-hidden="true" />}
      onClick={() => window.print()}
    >
      Print
    </Button>
  );
}

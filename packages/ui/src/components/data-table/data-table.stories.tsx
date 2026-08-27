import type { ColumnDef } from "@tanstack/react-table";
import type { Meta, StoryObj } from "@storybook/react";
import { Trash2 } from "lucide-react";
import { Button } from "../button/button";
import { EmptyState } from "../empty-state/empty-state";
import { StatusBadge } from "../status-badge/status-badge";
import { DataTable } from "./data-table";

interface CastRow {
  id: string;
  character: string;
  actor: string;
  status: "Confirmed" | "Offer Out" | "Unavailable";
  scenes: number;
  contract: "Signed" | "Pending" | "Missing";
}

const roleNames = [
  "Abraham",
  "Aisha",
  "Rohan Kapoor",
  "Meera",
  "Inspector Vaid",
  "Farid",
  "Nasreen",
  "Deepak",
  "Sunita",
  "Karim",
];
const actorNames = [
  "Rahul Verma",
  "Priya Nair",
  "Arjun Malhotra",
  "Kavita Rao",
  "Sameer Khan",
  "Anjali Gupta",
  "Vikram Singh",
  "Divya Menon",
  "Tarun Shah",
  "Ritu Bhatt",
];

const castData: CastRow[] = Array.from({ length: 180 }, (_, i) => ({
  id: `cast_${i}`,
  character: `${roleNames[i % roleNames.length]}${i >= roleNames.length ? ` (${Math.floor(i / roleNames.length) + 1})` : ""}`,
  actor: actorNames[i % actorNames.length]!,
  status: (["Confirmed", "Offer Out", "Unavailable"] as const)[i % 3]!,
  scenes: ((i * 7) % 40) + 1,
  contract: (["Signed", "Pending", "Missing"] as const)[i % 3]!,
}));

const statusTone = {
  Confirmed: "success",
  "Offer Out": "warning",
  Unavailable: "danger",
} as const;

const contractTone = {
  Signed: "success",
  Pending: "warning",
  Missing: "danger",
} as const;

const columns: ColumnDef<CastRow, unknown>[] = [
  { accessorKey: "character", header: "Character" },
  { accessorKey: "actor", header: "Actor" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const value = getValue<CastRow["status"]>();
      return <StatusBadge tone={statusTone[value]}>{value}</StatusBadge>;
    },
  },
  {
    accessorKey: "scenes",
    header: "Scenes",
    cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span>,
  },
  {
    accessorKey: "contract",
    header: "Contract",
    cell: ({ getValue }) => {
      const value = getValue<CastRow["contract"]>();
      return <StatusBadge tone={contractTone[value]}>{value}</StatusBadge>;
    },
  },
];

const meta: Meta<typeof DataTable> = {
  title: "FRAME/DataTable",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof DataTable>;

export const Cast: Story = {
  render: () => (
    <div style={{ width: 720 }}>
      <DataTable
        columns={columns}
        data={castData}
        getRowId={(row) => row.id}
        enableRowSelection
        searchPlaceholder="Filter cast…"
        bulkActions={(selected) => (
          <Button variant="destructive" icon={<Trash2 className="size-[14px]" aria-hidden="true" />}>
            Remove {selected.length}
          </Button>
        )}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div style={{ width: 720 }}>
      <DataTable
        columns={columns}
        data={[]}
        emptyState={
          <EmptyState
            title="No cast added yet"
            description="Import a screenplay or add cast manually to start tracking availability and contracts."
            action={<Button>Add cast member</Button>}
          />
        }
      />
    </div>
  ),
};

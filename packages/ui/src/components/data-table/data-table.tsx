"use client";

import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Search } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";
import { Checkbox } from "../checkbox/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "../dropdown-menu/dropdown-menu";

/**
 * The FilmSet data-table foundation (§23/§24) — one exceptional
 * implementation reused everywhere structured data appears (Cast, Crew,
 * Locations, Budget, Expenses, Elements, Documents, Rights), rather than
 * dozens of mediocre ad hoc tables.
 *
 * This pass covers: sort, global filter, column visibility, multi-select +
 * bulk actions, sticky header, row virtualization (thousands of rows
 * without slowdown), keyboard row navigation, and density (via
 * --fs-table-row-height, already resolved by [data-density]).
 *
 * Deliberately not yet built: column pin/reorder/resize persistence,
 * grouping, saved views (beyond the pattern), inline editing, export. Each
 * needs real design + a11y work of its own — see docs/design-system.
 */
export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  enableRowSelection?: boolean;
  getRowId?: (row: TData, index: number) => string;
  /** Rendered in the toolbar once at least one row is selected. */
  bulkActions?: (selected: TData[]) => React.ReactNode;
  searchPlaceholder?: string;
  emptyState?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  className?: string;
  /** Caps the scrollable body height; virtualization only pays off past a few dozen rows. */
  maxHeight?: string;
}

const SELECT_COLUMN_ID = "__select";

export function DataTable<TData>({
  columns,
  data,
  enableRowSelection = false,
  getRowId,
  bulkActions,
  searchPlaceholder = "Filter…",
  emptyState,
  onRowClick,
  className,
  maxHeight = "560px",
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const tableColumns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!enableRowSelection) return columns;
    const selectColumn: ColumnDef<TData, unknown> = {
      id: SELECT_COLUMN_ID,
      size: 36,
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows"
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select row ${row.id}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    };
    return [selectColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter, columnVisibility, rowSelection },
    getRowId,
    enableRowSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 40,
    overscan: 12,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom = virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0);

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const hideableColumns = table.getAllColumns().filter((c) => c.getCanHide());

  function focusRowByModelIndex(index: number) {
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    // With virtualization, only a window of rows exists in the DOM (plus
    // spacer rows), so raw `children[index]` doesn't correspond to the
    // row-model index. Ask the virtualizer to render the target row first,
    // then focus it by its stable data-index once the DOM catches up.
    virtualizer.scrollToIndex(clamped, { align: "auto" });
    requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`tr[data-index="${clamped}"]`);
      el?.focus();
    });
  }

  function handleRowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRowByModelIndex(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRowByModelIndex(index - 1);
    } else if (event.key === "Enter" && onRowClick) {
      onRowClick(rows[index]!.original);
    }
  }

  return (
    <div className={cn("flex flex-col gap-[var(--fs-space-8)]", className)}>
      <div className="flex items-center justify-between gap-[var(--fs-space-8)]">
        <div className="relative w-full max-w-[280px]">
          <Search className="pointer-events-none absolute left-[8px] top-1/2 size-[14px] -translate-y-1/2 text-[var(--color-text-tertiary)]" aria-hidden="true" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className={cn(
              "h-[var(--fs-control-height)] w-full rounded-md border border-[var(--color-border-standard)]",
              "bg-[var(--color-background-surface)] pl-[28px] pr-[var(--fs-space-12)] text-[13px] text-[var(--color-text-primary)]",
              "outline-none placeholder:text-[var(--color-text-tertiary)] focus-visible:border-[var(--color-action-primary)]",
              "focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]/30",
            )}
          />
        </div>
        <div className="flex items-center gap-[var(--fs-space-8)]">
          {selectedRows.length > 0 && bulkActions && (
            <div className="flex items-center gap-[var(--fs-space-8)]">
              <span className="text-[12px] tabular-nums text-[var(--color-text-secondary)]">
                {selectedRows.length} selected
              </span>
              {bulkActions(selectedRows)}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Choose visible columns"
                className={cn(
                  "flex size-[var(--fs-control-height)] items-center justify-center rounded-md border border-[var(--color-border-standard)]",
                  "text-[var(--color-text-secondary)] hover:bg-[var(--color-background-elevated)] hover:text-[var(--color-text-primary)]",
                  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
                )}
              >
                <Columns3 className="size-[14px]" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hideableColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {rows.length === 0 ? (
        emptyState
      ) : (
        <div
          ref={scrollRef}
          className="overflow-auto rounded-md border border-[var(--color-border-standard)]"
          style={{ maxHeight }}
        >
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-[var(--fs-z-sticky)] bg-[var(--color-background-elevated)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-[var(--color-border-standard)]">
                  {headerGroup.headers.map((header) => {
                    const sortState = header.column.getIsSorted();
                    const sortable = header.column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        style={{ width: header.column.id === SELECT_COLUMN_ID ? 36 : undefined }}
                        className="h-[var(--fs-table-row-height)] px-[var(--fs-space-12)] text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]"
                      >
                        {header.isPlaceholder ? null : sortable ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex items-center gap-[var(--fs-space-4)] outline-none hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortState === "asc" ? (
                              <ArrowUp className="size-[12px]" aria-hidden="true" />
                            ) : sortState === "desc" ? (
                              <ArrowDown className="size-[12px]" aria-hidden="true" />
                            ) : (
                              <ArrowUpDown className="size-[12px] opacity-40" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr aria-hidden="true">
                  <td style={{ height: paddingTop }} colSpan={tableColumns.length} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index]!;
                return (
                  <tr
                    key={row.id}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    tabIndex={0}
                    onClick={() => onRowClick?.(row.original)}
                    onKeyDown={(e) => handleRowKeyDown(e, virtualRow.index)}
                    className={cn(
                      "h-[var(--fs-table-row-height)] border-b border-[var(--color-border-subtle)] outline-none",
                      "focus-visible:bg-[var(--color-background-elevated)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]",
                      onRowClick && "cursor-pointer hover:bg-[var(--color-background-elevated)]",
                      row.getIsSelected() && "bg-[var(--color-background-elevated)]",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-[var(--fs-space-12)] text-[var(--color-text-primary)]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr aria-hidden="true">
                  <td style={{ height: paddingBottom }} colSpan={tableColumns.length} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { ChevronDown, ChevronLeft, ChevronRight, Columns3, Download, Filter, Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { exportWorkbook } from "@/lib/export";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  /** قيمة الفرز/البحث النصية */
  value?: (row: T) => string | number | null | undefined;
};

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (typeof node === "object") {
    const props = (node as { props?: { children?: unknown } }).props;
    if (props && "children" in props) return textOf(props.children);
  }
  return "";
}

export function DataTable<T>({
  columns,
  rows,
  searchPlaceholder = "بحث",
  selectable = false,
  showColumnsButton = false,
  showFilter = true,
  rowClassName,
  toolbarExtra,
  emptyState,
  draggableRows = true,
  dragLabel,
  onRowClick,
  bulkActions,
  exportFileName = "بيانات",
}: {
  columns: Column<T>[];
  rows: T[];
  searchPlaceholder?: string;
  selectable?: boolean;
  showColumnsButton?: boolean;
  showFilter?: boolean;
  rowClassName?: (row: T) => string | undefined;
  toolbarExtra?: ReactNode;
  emptyState?: ReactNode;
  /** السماح بسحب الصفوف إلى شات الذكاء الاصطناعي */
  draggableRows?: boolean;
  dragLabel?: string;
  /** فتح صفحة الصف عند الضغط على أي مكان فيه */
  onRowClick?: (row: T) => void;
  /** إجراءات جماعية على الصفوف المحددة */
  bulkActions?: (rows: T[], clear: () => void) => ReactNode;
  /** اسم ملف Excel، ويظهر زر التصدير تلقائيًا لكل جدول */
  exportFileName?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sort, setSort] = useState<{ header: string; dir: "asc" | "desc" } | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [showCols, setShowCols] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const visibleColumns = columns.filter((c) => !hidden.includes(c.header));

  const rowText = (row: T) =>
    columns
      .map((c) => (c.value ? String(c.value(row) ?? "") : textOf(c.cell(row))))
      .join(" ");

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    const list = q ? rows.filter((r) => normalizeSearch(rowText(r)).includes(q)) : [...rows];
    if (sort) {
      const col = columns.find((c) => c.header === sort.header);
      if (col) {
        list.sort((a, b) => {
          const av = col.value ? col.value(a) : textOf(col.cell(a));
          const bv = col.value ? col.value(b) : textOf(col.cell(b));
          if (typeof av === "number" && typeof bv === "number")
            return sort.dir === "asc" ? av - bv : bv - av;
          const res = String(av ?? "").localeCompare(String(bv ?? ""), "ar");
          return sort.dir === "asc" ? res : -res;
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pages);
  const start = (current - 1) * perPage;
  const pageRows = filtered.slice(start, start + perPage);

  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pages || Math.abs(p - current) <= 1,
  );

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="h-11 w-[300px] max-w-full rounded-xl border border-border bg-card pe-9 ps-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
          />
        </div>
        {toolbarExtra}
        <button
          type="button"
          onClick={() =>
            void exportWorkbook(exportFileName, [
              {
                name: "البيانات",
                rows: filtered.map((row) =>
                  Object.fromEntries(
                    columns.map((column) => [
                      column.header,
                      column.value ? column.value(row) ?? "" : textOf(column.cell(row)),
                    ]),
                  ),
                ),
              },
            ])
          }
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
          title="تنزيل النتائج الحالية بصيغة Excel"
        >
          <Download className="size-4 text-primary" />
          Excel
        </button>
        {showFilter ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="relative grid size-10 place-items-center rounded-lg text-primary transition-colors hover:bg-accent"
            aria-label="مسح التصفية"
            title="مسح البحث"
          >
            <Filter className="size-[18px]" />
            <span className="absolute -top-0.5 end-0 rounded-full bg-destructive/10 px-1 text-[10px] font-bold text-destructive">
              {query ? 1 : 0}
            </span>
          </button>
        ) : null}
        {showColumnsButton ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCols((v) => !v)}
              className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
              aria-label="الأعمدة"
            >
              <Columns3 className="size-[18px]" />
            </button>
            {showCols ? (
              <div className="absolute z-20 mt-1 w-52 rounded-xl border border-border bg-card p-2 shadow-lg">
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className="text-[12px] font-bold text-foreground">الأعمدة الظاهرة</span>
                  <button type="button" onClick={() => setShowCols(false)} aria-label="إغلاق">
                    <X className="size-4 text-muted-foreground" />
                  </button>
                </div>
                {columns.map((c) => (
                  <label
                    key={c.header}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-[12.5px] hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={!hidden.includes(c.header)}
                      onChange={() =>
                        setHidden((prev) =>
                          prev.includes(c.header)
                            ? prev.filter((h) => h !== c.header)
                            : [...prev, c.header],
                        )
                      }
                    />
                    {c.header}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {selected.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-semibold text-primary">
              تم تحديد {selected.length}
            </span>
            {bulkActions?.(
              selected.map((i) => pageRows[i]).filter(Boolean) as T[],
              () => setSelected([]),
            )}
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        (emptyState ?? (
          <div className="px-6 py-14 text-center text-[13px] text-muted-foreground">
            لا توجد نتائج مطابقة
          </div>
        ))
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-right">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                {selectable ? (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.length === pageRows.length && pageRows.length > 0}
                      onChange={(e) =>
                        setSelected(e.target.checked ? pageRows.map((_, i) => i) : [])
                      }
                      aria-label="تحديد الكل"
                    />
                  </th>
                ) : null}
                {visibleColumns.map((col) => (
                  <th
                    key={col.header}
                    className={cn(
                      "px-4 py-3 text-[12.5px] font-bold whitespace-nowrap text-foreground",
                      col.className,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSort((prev) =>
                            prev?.header === col.header
                              ? { header: col.header, dir: prev.dir === "asc" ? "desc" : "asc" }
                              : { header: col.header, dir: "asc" },
                          )
                        }
                        className="inline-flex items-center gap-1"
                      >
                        {col.header}
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-muted-foreground transition-transform",
                            sort?.header === col.header && sort.dir === "asc" && "rotate-180",
                            sort?.header === col.header && "text-primary",
                          )}
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr
                  key={i}
                  draggable={draggableRows}
                  onDragStart={
                    draggableRows
                      ? (e) => {
                          const label = dragLabel ? `${dragLabel}: ` : "";
                          e.dataTransfer.setData(
                            "text/plain",
                            label +
                              visibleColumns
                                .map(
                                  (c) =>
                                    `${c.header}=${c.value ? (c.value(row) ?? "") : textOf(c.cell(row))}`,
                                )
                                .join(" | "),
                          );
                        }
                      : undefined
                  }
                  onClick={
                    onRowClick
                      ? (e) => {
                          const el = e.target as HTMLElement;
                          if (el.closest("a,button,input,select,textarea,label")) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                  className={cn(
                    "border-b border-border/70 last:border-0 hover:bg-muted/40",
                    onRowClick && "cursor-pointer",
                    draggableRows && !onRowClick && "cursor-grab active:cursor-grabbing",
                    rowClassName?.(row),
                  )}
                >
                  {selectable ? (
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.includes(i)}
                        onChange={() =>
                          setSelected((prev) =>
                            prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
                          )
                        }
                        aria-label="تحديد الصف"
                      />
                    </td>
                  ) : null}
                  {visibleColumns.map((col) => (
                    <td
                      key={col.header}
                      className={cn(
                        "px-4 py-3.5 text-[13px] whitespace-nowrap text-foreground",
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4">
        <p className="text-[12.5px] text-muted-foreground">
          عرض {filtered.length === 0 ? 0 : start + 1} إلى {start + pageRows.length} من{" "}
          {filtered.length} نتيجة
        </p>

        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <span>لكل صفحة</span>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-card px-2 text-[12.5px] font-semibold text-foreground outline-none"
            aria-label="عدد النتائج لكل صفحة"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <PageBtn disabled={current >= pages} onClick={() => setPage(current + 1)}>
            <ChevronLeft className="size-4" />
          </PageBtn>
          {pageNumbers
            .slice()
            .reverse()
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center gap-1">
                {idx > 0 && arr[idx - 1]! - p > 1 ? (
                  <span className="px-1 text-muted-foreground">…</span>
                ) : null}
                <PageBtn active={p === current} onClick={() => setPage(p)}>
                  {p}
                </PageBtn>
              </span>
            ))}
          <PageBtn disabled={current <= 1} onClick={() => setPage(current - 1)}>
            <ChevronRight className="size-4" />
          </PageBtn>
        </div>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-9 place-items-center rounded-lg border text-[12.5px] font-semibold transition-colors disabled:opacity-40",
        active
          ? "border-primary/30 bg-accent text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/** تطبيع عربي للبحث: يتجاهل المسافات والهمزات والتاء المربوطة */
export function normalizeSearch(v: string) {
  return v
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, "");
}

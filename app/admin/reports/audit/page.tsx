"use client";

import { supabase } from "@/app/supabase";
import { useState, useEffect, useMemo } from "react";
import SelectDropdown from "@/components/ui/SelectDropdown";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { MoonLoader } from "react-spinners";
import { Temporal } from "temporal-polyfill";

type AuditLog = {
  id: string;
  recorded_at: string;
  actor_id: string | null;
  actor_email: string | null;
  source: string | null;
  operation: string;
  table_name: string;
  row_primary_key: string | null;
  context: Record<string, any>;
};

const DEFAULT_LIMIT = 500;
const pacificFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const pacificIsoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function formatPacific(dateString: string) {
  return pacificFormatter.format(new Date(dateString)) + " PT";
}

function formatPacificIso(dateString: string) {
  const parts = pacificIsoFormatter.formatToParts(new Date(dateString));
  const map: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== "literal") map[part.type] = part.value;
  });
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} PT`;
}

function pacificStartInstant(dateString: string | null | undefined) {
  if (!dateString) return null;
  const plain = Temporal.PlainDate.from(dateString);
  const zoned = plain.toZonedDateTime({
    timeZone: "America/Los_Angeles",
    plainTime: Temporal.PlainTime.from("00:00:00"),
  });
  return zoned.toInstant().toString();
}

function pacificEndInstant(dateString: string | null | undefined) {
  if (!dateString) return null;
  const plain = Temporal.PlainDate.from(dateString);
  const zoned = plain
    .toZonedDateTime({
      timeZone: "America/Los_Angeles",
      plainTime: Temporal.PlainTime.from("23:59:59.999999999"),
    });
  return zoned.toInstant().toString();
}

export default function AuditReportPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [operationFilter, setOperationFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [hideCron, setHideCron] = useState<boolean>(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);

    try {
        let query = supabase
          .from("audit_logs" as any)
          .select("*")
          .order("recorded_at", { ascending: false })
          .limit(DEFAULT_LIMIT);

        const startInstant = pacificStartInstant(startDate);
        const endInstant = pacificEndInstant(endDate);

        if (startInstant) {
          query = query.gte("recorded_at", startInstant);
        }
        if (endInstant) {
          query = query.lte("recorded_at", endInstant);
        }
        if (tableFilter !== "all") {
          query = query.eq("table_name", tableFilter);
        }
        if (operationFilter !== "all") {
          query = query.eq("operation", operationFilter);
        }
        if (sourceFilter !== "all") {
          query = query.eq("source", sourceFilter);
        }
        if (actorFilter !== "all") {
          query = query.eq("actor_email", actorFilter);
        }

        const { data, error } = (await query) as {
          data: AuditLog[] | null;
          error: any;
        };
        if (error) {
          throw error;
        }
        setLogs(data ?? []);
      } catch (err: any) {
        console.error("Failed to fetch audit logs", err);
        setError(err.message ?? "Failed to fetch audit logs");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs().catch(console.error);
  }, [startDate, endDate, tableFilter, operationFilter, sourceFilter, actorFilter]);

  const tableOptions = useMemo(() => {
    const tables = new Set<string>();
    logs.forEach((log) => {
      if (log.table_name) tables.add(log.table_name);
    });
    return ["all", ...Array.from(tables).sort()];
  }, [logs]);

  const operationOptions = useMemo(() => {
    const ops = new Set<string>();
    logs.forEach((log) => {
      if (log.operation) ops.add(log.operation);
    });
    return ["all", ...Array.from(ops).sort()];
  }, [logs]);

  const sourceOptions = useMemo(() => {
    const sources = new Set<string>();
    logs.forEach((log) => {
      if (log.source) sources.add(log.source);
    });
    return ["all", ...Array.from(sources).sort()];
  }, [logs]);

  const actorOptions = useMemo(() => {
    const actors = new Set<string>();
    logs.forEach((log) => {
      if (log.actor_email) actors.add(log.actor_email);
    });
    return ["all", ...Array.from(actors).sort()];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const isCron = (src: string | null | undefined) =>
      (src ?? "").toLowerCase().includes("cron");
    return hideCron ? logs.filter((log) => !isCron(log.source)) : logs;
  }, [hideCron, logs]);

  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      alert("No audit entries to export");
      return;
    }

    const headers = [
      "Timestamp (PT)",
      "Actor Email",
      "Source",
      "Operation",
      "Table",
      "Row Primary Key",
      "Context",
    ];

    const rows = filteredLogs.map((log) => [
      formatPacificIso(log.recorded_at),
      log.actor_email ?? "",
      log.source ?? "",
      log.operation,
      log.table_name,
      log.row_primary_key ?? "",
      JSON.stringify(log.context ?? {}),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\r\n");

    const filename = `audit_logs_${startDate || "all"}_${endDate || "all"}.csv`;
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToXLSX = async () => {
    if (logs.length === 0) {
      alert("No audit entries to export");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Audit Logs");

    worksheet.columns = [
      { header: "Timestamp (PT)", key: "timestamp", width: 28 },
      { header: "Actor Email", key: "actor_email", width: 32 },
      { header: "Source", key: "source", width: 16 },
      { header: "Operation", key: "operation", width: 14 },
      { header: "Table", key: "table_name", width: 20 },
      { header: "Row PK", key: "row_primary_key", width: 16 },
      { header: "Context", key: "context", width: 50 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { horizontal: "center" };

    filteredLogs.forEach((log) => {
      worksheet.addRow({
        timestamp: formatPacificIso(log.recorded_at),
        actor_email: log.actor_email ?? "",
        source: log.source ?? "",
        operation: log.operation,
        table_name: log.table_name,
        row_primary_key: log.row_primary_key ?? "",
        context: JSON.stringify(log.context ?? {}),
      });
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4472C4" },
          };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        });
      } else if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" },
          };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `audit_logs_${startDate || "all"}_${endDate || "all"}.xlsx`;
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, filename);
  };

  return (
    <div className="flex h-full w-full flex-col bg-gray-100">
      <div className="flex w-full grow flex-col items-center justify-center overflow-y-auto">
        <div className="flex h-[95%] w-[98%] flex-row items-center gap-4">
          <div className="flex h-full w-full flex-col items-center">
            <div className="flex h-full w-full flex-col gap-3">
              <div className="flex w-full flex-row flex-wrap gap-3 rounded-lg bg-white p-4 shadow-sm">
                <div className="flex min-w-[220px] flex-col">
                  <label className="text-sm font-semibold">
                    Start Date (PT)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white p-2"
                  />
                </div>
                <div className="flex min-w-[220px] flex-col">
                  <label className="text-sm font-semibold">
                    End Date (PT)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white p-2"
                  />
                </div>
                <div className="flex min-w-[180px] flex-col">
                  <label className="text-sm font-semibold">Table</label>
                  <SelectDropdown
                    options={tableOptions}
                    selectedOption={tableFilter}
                    setSelectedOption={setTableFilter}
                  />
                </div>
                <div className="flex min-w-[180px] flex-col">
                  <label className="text-sm font-semibold">Operation</label>
                  <SelectDropdown
                    options={operationOptions}
                    selectedOption={operationFilter}
                    setSelectedOption={setOperationFilter}
                  />
                </div>
                <div className="flex min-w-[180px] flex-col">
                  <label className="text-sm font-semibold">Source</label>
                  <SelectDropdown
                    options={sourceOptions}
                    selectedOption={sourceFilter}
                    setSelectedOption={setSourceFilter}
                  />
                </div>
                <div className="flex min-w-[220px] flex-col">
                  <label className="text-sm font-semibold">Actor Email</label>
                  <SelectDropdown
                    options={actorOptions}
                    selectedOption={actorFilter}
                    setSelectedOption={setActorFilter}
                  />
                </div>
                <div className="flex grow items-center justify-end gap-4">
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={hideCron}
                      onChange={(e) => setHideCron(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Hide cron entries
                  </label>
                  <button
                    className="h-10 rounded-lg bg-red-500 px-4 font-semibold text-white"
                    onClick={exportToCSV}
                  >
                    Export CSV
                  </button>
                  <button
                    className="h-10 rounded-lg bg-green-600 px-4 font-semibold text-white"
                    onClick={exportToXLSX}
                  >
                    Export XLSX
                  </button>
                </div>
              </div>

              <div className="w-full grow overflow-y-auto rounded-xl bg-white shadow-sm">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <MoonLoader />
                  </div>
                ) : error ? (
                  <div className="flex h-full items-center justify-center p-8 text-red-500">
                    {error}
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-8 text-gray-500">
                    No audit records match the selected filters.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr>
                        <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                          Timestamp (PT)
                        </th>
                        <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                          Actor Email
                        </th>
                        <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                          Source
                        </th>
                        <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                          Operation
                        </th>
                        <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                          Table
                        </th>
                        <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                          Row PK
                        </th>
                        <th className="sticky top-0 z-20 bg-white p-3 font-semibold">
                          Context
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log, index) => (
                        <tr
                          key={log.id}
                          className={`border-t transition-colors ${
                            index % 2 === 1 ? "bg-orange-50" : "bg-white"
                          }`}
                        >
                          <td className="p-3 text-sm">{formatPacific(log.recorded_at)}</td>
                          <td className="p-3 text-sm">{log.actor_email ?? "—"}</td>
                          <td className="p-3 text-sm">{log.source ?? "—"}</td>
                          <td className="p-3 text-sm uppercase tracking-wide">
                            {log.operation}
                          </td>
                          <td className="p-3 text-sm">{log.table_name}</td>
                          <td className="p-3 text-sm">{log.row_primary_key ?? "—"}</td>
                          <td className="p-3 text-xs">
                            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-orange-50 p-3 text-[11px] leading-snug text-gray-700">
                              {JSON.stringify(log.context ?? {}, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="text-xs text-gray-500">
                Showing up to {DEFAULT_LIMIT} most recent entries. Adjust your filters
                for a narrower window if needed.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

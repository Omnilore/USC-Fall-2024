/** True for automated audit rows (cron jobs, service account), based on `audit_logs.source`. */
export function isAutomatedAuditSource(
  source: string | null | undefined,
): boolean {
  const s = (source ?? "").toLowerCase();
  return s.includes("cron") || s === "service";
}

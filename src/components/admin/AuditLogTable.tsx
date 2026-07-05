"use client";

import { useMemo, useState } from "react";
import { Badge, Card } from "@/components/ui";

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actorName: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  diff: Record<string, unknown>;
  created_at: string;
};

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function summarise(diff: Record<string, unknown>): string {
  const keys = Object.keys(diff);
  if (keys.length === 0) return "—";
  try {
    const json = JSON.stringify(diff);
    return json.length > 140 ? `${json.slice(0, 140)}…` : json;
  } catch {
    return "—";
  }
}

export function AuditLogTable({ logs }: { logs: AuditLogRow[] }) {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const actions = useMemo(() => ["all", ...new Set(logs.map((l) => l.action))], [logs]);
  const entities = useMemo(() => ["all", ...new Set(logs.map((l) => l.entity))], [logs]);

  const filtered = useMemo(
    () =>
      logs.filter((l) => {
        if (actionFilter !== "all" && l.action !== actionFilter) return false;
        if (entityFilter !== "all" && l.entity !== entityFilter) return false;
        return true;
      }),
    [logs, actionFilter, entityFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-xl border border-brand-100 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Action</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {actions.map((a) => (
              <option key={a} value={a}>{a === "all" ? "All" : toLabel(a)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Entity type</span>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {entities.map((e) => (
              <option key={e} value={e}>{e === "all" ? "All" : toLabel(e)}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <Card><p className="text-sm text-gray-600">No audit log entries match these filters.</p></Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white">
          <table className="w-full min-w-[840px] text-sm">
            <thead className="border-b border-brand-100 bg-brand-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Entity ID</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="border-b border-brand-50 last:border-0">
                  <td className="px-4 py-3 text-gray-700">{log.actorName ?? "System"}</td>
                  <td className="px-4 py-3"><Badge>{toLabel(log.action)}</Badge></td>
                  <td className="px-4 py-3 text-gray-600">{toLabel(log.entity)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.entity_id ?? "—"}</td>
                  <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-gray-500" title={summarise(log.diff)}>
                    {summarise(log.diff)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

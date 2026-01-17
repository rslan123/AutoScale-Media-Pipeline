import React, { useEffect, useMemo, useState } from "react";
import { fetchAllLogs } from "./services/imageService";

function Badge({ children }) {
  return (
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
      {children}
    </span>
  );
}

function formatDate(ts) {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString();
}

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchAllLogs();
      setLogs(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!query) return logs;
    const q = query.toLowerCase();
    return logs.filter((l) =>
      String(l.user_id).toLowerCase().includes(q) ||
      String(l.file_name).toLowerCase().includes(q)
    );
  }, [logs, query]);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Admin Logs</h2>
          <p className="mt-1 text-sm text-slate-600">
            Global activity across all users (admin-only view)
          </p>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search user or file…"
          className="w-64 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
          <div className="col-span-4">User</div>
          <div className="col-span-4">File</div>
          <div className="col-span-2">Savings</div>
          <div className="col-span-2">Date</div>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">
            Loading admin logs…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">
            No logs found
          </div>
        ) : (
          filtered.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-center border-t border-slate-200 px-4 py-3 text-sm"
            >
              <div className="col-span-4 truncate font-medium text-slate-900">
                {l.user_id}
              </div>
              <div className="col-span-4 truncate text-slate-700">
                {l.file_name}
              </div>
              <div className="col-span-2">
                <Badge>{l.savings_percent || "-"}</Badge>
              </div>
              <div className="col-span-2 text-slate-600">
                {formatDate(l.timestamp)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        Tip: This page demonstrates role-based access + DynamoDB metadata usage.
      </div>
    </div>
  );
}

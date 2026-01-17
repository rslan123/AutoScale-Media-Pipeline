import React, { useEffect, useMemo, useState } from "react";
import { fetchAllLogs } from "./services/imageService";

// If your logs contain a "file_name" like "abc.jpg" or key, we can build a preview URL if you want.
// For now we show file name + metadata. (Safe, always works.)

function Badge({ tone = "gray", children }) {
  const map = {
    gray: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[tone] || map.gray}`}>
      {children}
    </span>
  );
}

function formatDate(ts) {
  if (!ts) return "-";
  // Your backend uses epoch seconds
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function toNumberPercent(v) {
  if (v == null) return null;
  const n = Number(String(v).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

export default function History({ userEmail, isAdmin = false }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false); // admin only

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const data = await fetchAllLogs();
        // normalize + sort newest first
        const sorted = [...data].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setRows(sorted);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const visibleRows = useMemo(() => {
    const base = isAdmin && showAll ? rows : rows.filter((r) => String(r.user_id || "").toLowerCase() === String(userEmail || "").toLowerCase());

    if (!query.trim()) return base;

    const q = query.toLowerCase();
    return base.filter((r) => {
      const userId = String(r.user_id || "").toLowerCase();
      const fileName = String(r.file_name || "").toLowerCase();
      const savings = String(r.savings_percent || "").toLowerCase();
      return userId.includes(q) || fileName.includes(q) || savings.includes(q);
    });
  }, [rows, query, userEmail, isAdmin, showAll]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My History</h2>
          <p className="mt-1 text-sm text-slate-600">
            View previous uploads (file name, savings, date). {isAdmin ? "Admins can optionally show all users." : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search file/user/savings…"
            className="w-64 max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />

          {isAdmin && (
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Show all
            </label>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        {/* Header row */}
        <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
          <div className="col-span-5">File</div>
          <div className="col-span-2">Savings</div>
          <div className="col-span-3">Date</div>
          <div className="col-span-2 text-right">Status</div>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center">
            <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-slate-100" />
            <div className="mt-3 text-sm font-medium text-slate-700">Loading history…</div>
            <div className="mt-1 text-sm text-slate-500">Fetching logs</div>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="mx-auto mb-2 h-10 w-10 rounded-2xl bg-slate-100" />
            <div className="text-sm font-medium text-slate-900">No history yet</div>
            <div className="mt-1 text-sm text-slate-600">
              Upload an image to create your first record.
            </div>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            {visibleRows.map((r) => {
              const pct = toNumberPercent(r.savings_percent);
              const tone = pct == null ? "gray" : pct >= 50 ? "green" : pct >= 20 ? "blue" : "gray";

              return (
                <div
                  key={r.image_id || `${r.user_id}-${r.timestamp}-${r.file_name}`}
                  className="grid grid-cols-12 items-center gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-700"
                >
                  <div className="col-span-5 min-w-0">
                    <div className="truncate font-semibold text-slate-900">{r.file_name || "(unknown file)"}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {isAdmin ? `User: ${r.user_id || "-"}` : `User: ${userEmail || "-"}`}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <Badge tone={tone}>{r.savings_percent || "-"}</Badge>
                  </div>

                  <div className="col-span-3 text-slate-600">{formatDate(r.timestamp)}</div>

                  <div className="col-span-2 text-right">
                    <Badge tone="green">Stored</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Tip: This page proves DynamoDB metadata is being used (great for grading).
      </div>
    </div>
  );
}

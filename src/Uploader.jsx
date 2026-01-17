import React, { useEffect, useMemo, useRef, useState } from "react";
import { uploadAndProcessImage, fetchAllLogs, fetchImageMetadata } from "./services/imageService";

// --- UTILITY FUNCTIONS ---

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/** Normalizes percentage strings/numbers to a valid 0-100 range */
function toPercentNumber(v) {
  if (v == null) return 0;
  if (typeof v === "number") return clamp(v, 0, 100);
  const n = Number(String(v).replace("%", "").trim());
  return Number.isFinite(n) ? clamp(n, 0, 100) : 0;
}

// --- SHARED UI COMPONENTS ---

function StatusPill({ status }) {
  const cfg =
    status === "idle"
      ? { label: "Ready", cls: "bg-slate-100 text-slate-700" }
      : status === "uploading"
      ? { label: "Uploading…", cls: "bg-blue-100 text-blue-700" }
      : status === "processing"
      ? { label: "Optimizing…", cls: "bg-indigo-100 text-indigo-700" }
      : status === "success"
      ? { label: "Done", cls: "bg-emerald-100 text-emerald-700" }
      : { label: "Error", cls: "bg-red-100 text-red-700" };

  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function SmallButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function ImageCard({ label, dim, ratio, url }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{dim}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{ratio}</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <img src={url} alt={label} className="h-44 w-full object-cover" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copyToClipboard(url)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Copy URL
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Open
          </a>
        </div>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---

export default function Uploader({ userRole, user }) {
  const isAdmin = userRole === "admin";

  // --- STATE MANAGEMENT ---
  
  // File & Upload state
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState("idle"); 

  // Configuration state
  const [quality, setQuality] = useState(80);
  const [keepOriginal, setKeepOriginal] = useState(false);

  // Result state (from DB/Service)
  const [optimizedImages, setOptimizedImages] = useState(null);
  const [stats, setStats] = useState(null);

  // Admin/Logging state
  const [showLogs, setShowLogs] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [globalLogs, setGlobalLogs] = useState([]);
  const [logQuery, setLogQuery] = useState("");

  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // --- DERIVED DATA ---
  
  const busy = status === "uploading" || status === "processing";
  const savingsPct = toPercentNumber(stats?.savings_percent);

  const fileMeta = useMemo(() => {
    if (!file) return null;
    return { name: file.name, kb: Math.round(file.size / 1024), type: file.type };
  }, [file]);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  // --- SIDE EFFECTS ---

  /** Memory management for local file previews */
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /** UX: Auto-scroll to results when optimization finishes */
  useEffect(() => {
    if (status === "success" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [status]);

  // --- EVENT HANDLERS ---

  const validateFile = () => {
    if (!file) return "Please choose a file.";
    if (file.size > 10 * 1024 * 1024) return "File too large. Max 10MB.";
    const ok = ["image/jpeg", "image/jpg", "image/png"];
    if (!ok.includes(file.type)) return "Supported formats: JPG, JPEG, PNG.";
    return null;
  };

  const resetAll = () => {
    setFile(null);
    setDragActive(false);
    setStatus("idle");
    setOptimizedImages(null);
    setStats(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Drag and Drop Logic
  const onBrowse = () => inputRef.current?.click();
  const onDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  /** Core logic: Uploads file then polls for backend processing completion */
  const handleUpload = async () => {
    const err = validateFile();
    if (err) return alert(err);

    setStatus("uploading");
    setStats(null);
    setOptimizedImages(null);

    try {
      // 1) Get presigned URL and perform S3 upload
      const results = await uploadAndProcessImage(file, user.email, userRole, Number(quality), keepOriginal);

      // 2) Poll DynamoDB metadata (Lambda might still be processing)
      setStatus("processing");
      let dbData = null;

      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        dbData = await fetchImageMetadata(results.originalKey);
        // Break when processing metrics are available
        if (dbData && dbData.savings_percent) break;
      }

      if (!dbData) {
        setStatus("error");
        return;
      }

      setStats(dbData);
      setOptimizedImages(results);
      setStatus("success");
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  };

  /** Admin feature: Toggles and fetches global processing logs */
  const toggleLogs = async () => {
    if (showLogs) {
      setShowLogs(false);
      return;
    }

    setLogsLoading(true);
    try {
      const data = await fetchAllLogs();
      const sorted = [...data].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setGlobalLogs(sorted);
      setShowLogs(true);
    } catch (e) {
      console.error(e);
      alert("Could not load logs.");
    } finally {
      setLogsLoading(false);
    }
  };

  /** Search/Filter logic for Admin logs */
  const filteredLogs = useMemo(() => {
    if (!logQuery.trim()) return globalLogs;
    const q = logQuery.toLowerCase();
    return globalLogs.filter((l) => {
      const userId = String(l.user_id || "").toLowerCase();
      const fileName = String(l.file_name || "").toLowerCase();
      const savings = String(l.savings_percent || "").toLowerCase();
      return userId.includes(q) || fileName.includes(q) || savings.includes(q);
    });
  }, [globalLogs, logQuery]);

  // --- VIEW RENDERING ---

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* LEFT MAIN: Contains Header, Dropzone, and Results */}
      <div className="md:col-span-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">Media Accelerator</h2>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                TEST MODE
              </span>
              <StatusPill status={status} />
            </div>

            <p className="mt-1 text-sm text-slate-600">
              Upload an image, generate multiple resolutions, and view compression savings.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {isAdmin ? "Admin" : "User"}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {user?.email || "user"}
            </span>
          </div>
        </div>

        {/* HERO CARD: Input Area */}
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-5">
            {/* Dropzone Area */}
            <div className="lg:col-span-3">
              <div
                className={[
                  "rounded-2xl border-2 border-dashed p-8 text-center transition",
                  dragActive ? "border-blue-500 bg-blue-50" : file ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50",
                ].join(" ")}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />

                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <span className="text-xl">⬆️</span>
                </div>

                {!file ? (
                  <>
                    <div className="text-sm font-semibold text-slate-900">
                      <button
                        type="button"
                        onClick={onBrowse}
                        className="underline underline-offset-4 decoration-slate-300 hover:decoration-blue-500"
                      >
                        Click to upload
                      </button>{" "}
                      <span className="font-normal text-slate-600">or drag and drop</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">PNG/JPG • up to 10MB</div>

                    <div className="mt-4 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={onBrowse}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                      >
                        Choose file
                      </button>
                      <button
                        type="button"
                        onClick={() => alert("Supported: JPG/PNG up to 10MB")}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        File rules
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-4 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">📄 {fileMeta.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {fileMeta.kb} KB • {fileMeta.type || "image"}
                        </div>
                      </div>

                      <SmallButton onClick={resetAll}>Remove</SmallButton>
                    </div>

                    {busy && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>{status === "uploading" ? "Uploading" : "Optimizing"}</span>
                          <span className="font-semibold">…</span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-2 w-1/2 animate-pulse rounded-full bg-blue-600" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || busy}
                className={[
                  "mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition",
                  !file || busy
                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]",
                ].join(" ")}
              >
                {status === "uploading"
                  ? "Uploading…"
                  : status === "processing"
                  ? "Optimizing…"
                  : "Optimize & Generate Assets"}
              </button>

              {status === "error" && (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Something went wrong. Please try again.
                </div>
              )}
            </div>

            {/* Preview + Settings Panel */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-700">Preview</div>
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {previewUrl ? (
                    <img src={previewUrl} alt="preview" className="h-44 w-full object-cover" />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-sm text-slate-500">
                      No file selected
                    </div>
                  )}
                </div>
              </div>

              {/* Quality Settings */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    Quality: <span className="text-blue-600">{quality}%</span>
                  </div>
                  <div className="text-xs text-slate-500">Lower = smaller file</div>
                </div>

                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="mt-3 w-full accent-blue-600"
                />

                <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={keepOriginal}
                    onChange={(e) => setKeepOriginal(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Convert Original Resolution (keep 1:1 output too)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* RESULTS SECTION: Visual metrics and asset gallery */}
        {status === "success" && stats && optimizedImages && (
          <div ref={resultsRef} className="mt-8 space-y-6">
            {/* Efficiency Metrics */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Efficiency <span className="text-slate-500 font-medium">({stats.quality_used || quality}%)</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Savings and performance metrics from the serverless pipeline.
                  </div>
                </div>
                <div className="text-2xl font-semibold text-slate-900">{stats.savings_percent}</div>
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${savingsPct}%` }} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <StatCard label="Latency" value={`${stats.processing_time_ms} ms`} />
                <StatCard
                  label="Reduced"
                  value={`${Math.round((stats.original_size_kb || 0) - (stats.total_output_kb || 0))} KB`}
                />
                <StatCard label="Total Output" value={`${stats.total_output_kb} KB`} />
              </div>
            </div>

            {/* Assets Gallery */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Generated Assets</h3>
                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Optimize Another
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <ImageCard label="Thumbnail" dim="150×150" ratio="1:1" url={optimizedImages.thumbnail} />
                <ImageCard label="Standard" dim="800×800" ratio="1:1" url={optimizedImages.medium} />
                <ImageCard label="Desktop" dim="1920×1080" ratio="16:9" url={optimizedImages.large} />
                {keepOriginal && optimizedImages.original && (
                  <ImageCard label="Original (1:1)" dim="Native" ratio="Match" url={optimizedImages.original} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ADMIN AUDIT LOGS */}
        {isAdmin && (
          <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">System Administration</h3>
                <p className="text-sm text-slate-600">Audit logs and global user activity</p>
              </div>

              <div className="flex items-center gap-2">
                {showLogs && (
                  <input
                    value={logQuery}
                    onChange={(e) => setLogQuery(e.target.value)}
                    placeholder="Search logs…"
                    className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                )}

                <button
                  type="button"
                  onClick={toggleLogs}
                  className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  {logsLoading ? "Loading…" : showLogs ? "Hide Logs" : "View Global Logs"}
                </button>
              </div>
            </div>

            {showLogs && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 sticky top-0">
                  <div>User</div>
                  <div>File</div>
                  <div>Savings</div>
                  <div>Date</div>
                </div>

                <div className="max-h-72 overflow-auto">
                  {filteredLogs.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-600">No logs found.</div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div
                        key={log.image_id || `${log.user_id}-${log.timestamp}`}
                        className="grid grid-cols-4 gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-700"
                      >
                        <div className="truncate">{log.user_id}</div>
                        <div className="truncate font-mono text-xs">{log.file_name}</div>
                        <div className="font-semibold text-emerald-700">{log.savings_percent}</div>
                        <div>{log.timestamp ? new Date(log.timestamp * 1000).toLocaleDateString() : "-"}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Quick session info and technical pipeline overview */}
      <div className="space-y-4">
        <StatCard label="Signed in" value={user?.email || "-"} />
        <StatCard label="Role" value={userRole} />
        <StatCard label="Quality" value={`${quality}%`} hint="Adjust compression strength" />
        <StatCard label="Original kept" value={keepOriginal ? "Yes" : "No"} />

        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white">
          <div className="text-sm font-semibold">Pipeline</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>• Upload stored in S3</li>
            <li>• Lambda validates + triggers workflow</li>
            <li>• Status saved in DynamoDB</li>
            <li>• Assets served back to UI</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
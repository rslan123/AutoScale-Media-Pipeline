import React, { useState } from "react";
import {
  signIn,
  signOut,
  fetchAuthSession,
  getCurrentUser,
} from "aws-amplify/auth";

export default function Login({ onLogin }) {
  // --- STATE MANAGEMENT ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // --- AUTHENTICATION LOGIC ---

  /** Core sign-in handler using AWS Amplify v6 syntax */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Attempt Authentication
      const result = await signIn({
        username: email,
        password,
      });

      // 2. Process Successful Login & Extract RBAC Roles
      if (result.isSignedIn) {
        const session = await fetchAuthSession();
        // Access Cognito Groups to determine if user is an Admin
        const groups =
          session.tokens?.accessToken?.payload?.["cognito:groups"] || [];

        const role = groups.includes("Admins") ? "admin" : "user";

        // Lift state to parent component
        onLogin({ email, role });
        return;
      }

      // Handle multi-factor auth or other intermediate steps
      setError(
        `Additional step required: ${result.nextStep?.signInStep || "Unknown"}`
      );
    } catch (err) {
      const msg = err?.message || "";

      // 3. Error Handling: Resolve stale session conflicts
      // This specifically handles the case where a user tries to log in while a 
      // cookie session still exists but is invalid/expired.
      if (msg.toLowerCase().includes("already a signed in user")) {
        try {
          await signOut(); // Force clear local storage/cookies
          setError(
            "A previous session was detected and cleared. Please click Sign In again."
          );
        } catch {
          setError(
            "Session conflict detected. Please refresh the page and try again."
          );
        }
      } else {
        setError(msg || "Incorrect email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- VIEW RENDERING ---

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
      {/* Visual background elements */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-slate-200/50 blur-3xl" />

      <div className="relative grid md:grid-cols-2">
        {/* LEFT PANEL: Marketing & Project Context */}
        <div className="hidden md:block p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold shadow-sm">
              A
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">AutoScale</div>
              <div className="text-xs text-slate-500">
                Secure Media Pipeline
              </div>
            </div>
          </div>

          <h2 className="mt-8 text-3xl font-semibold tracking-tight text-slate-900">
            Sign in to optimize media <span className="text-blue-600">at scale</span>.
          </h2>

          <p className="mt-3 text-sm text-slate-600">
            Upload images, generate multiple resolutions, and track savings —
            powered by AWS serverless services.
          </p>

          <div className="mt-6 grid gap-3">
            <Feature
              title="Role-based access"
              desc="Admins audit logs. Users see their own results."
            />
            <Feature
              title="Serverless workflow"
              desc="S3 → Lambda → DynamoDB"
            />
            <Feature
              title="Measurable savings"
              desc="Compression stats and latency included."
            />
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white/60 p-4">
            <div className="text-xs font-semibold text-slate-700">Tip for the demo</div>
            <div className="mt-1 text-sm text-slate-600">
              Use both <strong>admin</strong> and <strong>user</strong> accounts to show permissions.
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Cognito Auth Form */}
        <div className="p-6 md:p-8">
          <div className="mx-auto max-w-md">
            <div className="text-center md:text-left">
              <h1 className="text-xl font-semibold text-slate-900">CloudScale Auth</h1>
              <p className="mt-1 text-sm text-slate-600">Secure sign-in via AWS Cognito</p>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Email Input */}
              <div>
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password Input with Visibility Toggle */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>

                <input
                  type={showPw ? "text" : "password"}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={[
                  "w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
                  loading ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700",
                ].join(" ")}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>

              <div className="text-center text-xs text-slate-500">
                Demo usage for final project presentation.
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function Feature({ title, desc }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{desc}</div>
    </div>
  );
}
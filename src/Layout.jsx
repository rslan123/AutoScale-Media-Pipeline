import React from "react";

function NavItem({ active, onClick, children, badge, disabled, icon }) {
  return (
    <button
      type="button"
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={[
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition",
        active && !disabled && "bg-slate-900 text-white shadow-sm",
        !active && !disabled && "text-slate-700 hover:bg-slate-50",
        disabled && "cursor-not-allowed text-slate-400 opacity-60",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="text-lg">{icon}</span>
      <span className="flex-1 text-left">{children}</span>

      {badge && (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function Layout({ user, activeTab, setActiveTab, onLogout, children }) {
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      {/* Topbar */}
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
              A
            </div>

            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">AutoScale</div>
              <div className="text-xs text-slate-500">Secure Media Pipeline</div>
            </div>

            <span className="hidden sm:inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              Efficient Image Optimiser &amp; Scaler
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-slate-200" />
              <div className="leading-tight">
                <div className="text-xs text-slate-500">Signed in as</div>
                <div className="text-sm font-semibold text-slate-800">{user.email}</div>
              </div>
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {user.role}
              </span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Page header */}
        <header className="mb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            <span className="text-blue-600">AutoScale Media Pipeline</span>
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Serverless-ready UI • Cognito Auth • Role-based access
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">Navigation</div>

              <div className="mt-3 space-y-1">
                <NavItem
                  icon="📤"
                  active={activeTab === "uploader"}
                  onClick={() => setActiveTab("uploader")}
                >
                  Uploader
                </NavItem>

                <NavItem
                  icon="🕒"
                  active={activeTab === "history"}
                  onClick={() => setActiveTab("history")}
                >
                  My History
                </NavItem>

                <NavItem
                  icon="🛡️"
                  active={activeTab === "admin"}
                  onClick={() => setActiveTab("admin")}
                  badge="Admin"
                  disabled={!isAdmin}
                >
                  Admin Logs
                </NavItem>

                <NavItem
                  icon="ℹ️"
                  active={activeTab === "about"}
                  onClick={() => setActiveTab("about")}
                >
                  About
                </NavItem>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                🔒 Access is controlled by Cognito groups.
                <br />
                Admins see global logs, users see only their history.
              </div>
            </div>
          </aside>

          {/* Content */}
          <section className="lg:col-span-9">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
              {children}
            </div>

            <div className="mt-5 text-center text-xs text-slate-400">
              AutoScale • UI Draft • Tailwind
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

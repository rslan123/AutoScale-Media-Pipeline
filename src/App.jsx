import React, { useEffect, useState } from "react";
import { signOut, fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

import AdminLogs from "./AdminLogs";
import Layout from "./Layout";
import Login from "./Login";
import Uploader from "./Uploader";
import History from "./History";

function About() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">About</h2>
      <p className="mt-2 text-sm text-slate-600">
        This system uploads media to S3, triggers Lambda processing, and stores results in DynamoDB.
      </p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        <div className="font-semibold text-slate-900">Flow</div>
        <ol className="mt-2 space-y-1">
          <li>1) User requests a presigned URL</li>
          <li>2) Upload goes to S3</li>
          <li>3) Lambda triggers optimization</li>
          <li>4) Metadata saved in DynamoDB</li>
          <li>5) UI displays results and history</li>
        </ol>
      </div>
    </div>
  );
}

function AdminPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Admin Logs</h2>
      <p className="mt-2 text-sm text-slate-600">
        You already have Admin logs inside the Uploader page. We can move them here as a dedicated admin page.
      </p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        Next step: reuse the existing logs table from the uploader and show it here.
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState("uploader"); // uploader | history | admin | about

  useEffect(() => {
    const init = async () => {
      try {
        const current = await getCurrentUser();
        const session = await fetchAuthSession();
        const groups = session.tokens?.accessToken?.payload?.["cognito:groups"] || [];
        const role = groups.includes("Admins") ? "admin" : "user";
        const email = current?.signInDetails?.loginId || current?.username || "signed-in-user";
        setUser({ email, role });
      } catch {
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    };
    init();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
      setActiveTab("uploader");
    } catch (e) {
      console.error(e);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-slate-100" />
          <div className="mt-3 text-sm font-medium text-slate-700">Loading your session…</div>
          <div className="mt-1 text-sm text-slate-500">Please wait</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <Login onLogin={(u) => setUser(u)} />
        </div>
      </div>
    );
  }

  return (
    <Layout user={user} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout}>
      {activeTab === "uploader" && <Uploader userRole={user.role} user={user} />}
      {activeTab === "history" && <History userEmail={user.email} isAdmin={user.role === "admin"} />}
      {activeTab === "admin" && user.role === "admin" && <AdminPage />}
      {activeTab === "about" && <About />}
      {activeTab === "admin" && user.role === "admin" && <AdminLogs />}

    </Layout>
  );
}

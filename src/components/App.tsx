"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type User, type AllData } from "@/lib/client";
import { ToastProvider } from "./ui";
import Login from "./Login";
import AdminDashboard from "./AdminDashboard";
import TenantDashboard from "./TenantDashboard";

const EMPTY: AllData = { units: [], repairs: [], payments: [], expenses: [] };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<AllData>(EMPTY);
  const [booting, setBooting] = useState(true);

  const refresh = useCallback(async () => {
    const r = await api<AllData>("data");
    if (r.success) {
      setData({
        units: r.units ?? [],
        repairs: r.repairs ?? [],
        payments: r.payments ?? [],
        expenses: r.expenses ?? [],
      });
    }
  }, []);

  // Restore session on load.
  useEffect(() => {
    (async () => {
      const r = await api<{ user: User | null }>("auth/me");
      if (r.success && r.user) {
        setUser(r.user);
        await refresh();
      }
      setBooting(false);
    })();
  }, [refresh]);

  const handleLogin = useCallback(
    async (u: User) => {
      setUser(u);
      await refresh();
    },
    [refresh]
  );

  const handleLogout = useCallback(async () => {
    await api("auth/logout", "POST");
    setUser(null);
    setData(EMPTY);
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        載入中…
      </div>
    );
  }

  return (
    <ToastProvider>
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : user.role === "admin" ? (
        <AdminDashboard
          user={user}
          data={data}
          refresh={refresh}
          onLogout={handleLogout}
          onTierChange={(tier) => setUser({ ...user, tier })}
          onUserChange={(patch) => setUser({ ...user, ...patch })}
        />
      ) : (
        <TenantDashboard user={user} data={data} refresh={refresh} onLogout={handleLogout} />
      )}
    </ToastProvider>
  );
}

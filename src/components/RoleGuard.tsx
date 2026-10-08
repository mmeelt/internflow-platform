"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { restoreSession } from "@/lib/auth";
import { ShieldOff } from "lucide-react";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

type AuthState = "loading" | "authorized" | "unauthorized";

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>("loading");

  useEffect(() => {
    let cancelled = false;
    void restoreSession().then((user) => {
      if (cancelled) return;
      if (!user) {
        router.replace("/login");
        setState("unauthorized");
        return;
      }
      if (!allowedRoles.includes(user.role.toLowerCase())) {
        const dashboard = user.role === "admin" ? "/admin" : user.role === "supervisor" ? "/supervisor" : "/student";
        router.replace(dashboard);
        setState("unauthorized");
        return;
      }
      setState("authorized");
    });
    return () => { cancelled = true; };
  }, [router, allowedRoles]);

  // While checking, show nothing (full black-out prevents content flash)
  if (state === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <p className="text-gray-400 text-sm font-medium">Loading...</p>
      </div>
    );
  }

  // If unauthorized, show a locked screen while the redirect runs
  if (state === "unauthorized") {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <ShieldOff className="w-10 h-10 text-slate-300" />
        <p className="text-slate-500 text-sm font-medium">Access denied. Redirecting…</p>
      </div>
    );
  }

  return <>{children}</>;
}

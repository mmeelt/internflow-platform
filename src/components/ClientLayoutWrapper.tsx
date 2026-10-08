"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { getLoggedInUser, restoreSession } from "@/lib/auth";
import { api } from "@/lib/api";
import { applyAxisTheme, axisFromSpecialization } from "@/lib/axis-theme";

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<ReturnType<typeof getLoggedInUser> | undefined>(undefined);

  useEffect(() => {
    const isPublicPage = pathname === "/" || pathname === "/axes" || pathname === "/login"
      || pathname === "/setup" || pathname === "/signup-supervisor";
    if (isPublicPage) {
      setSession(null);
      return;
    }
    let cancelled = false;
    const refreshSession = () => {
      void restoreSession().then((user) => {
        if (cancelled) return;
        setSession(user);
        // The axis is profile data, not a role or permission. Loading it after
        // the authenticated refresh keeps the visual workspace consistent on
        // every device and never grants access to another Centre of Excellence.
        if (user?.role !== "admin") {
          void api.get<{ specialization?: string | null }>("/api/profile")
            .then((profile) => {
              const axis = axisFromSpecialization(profile.specialization);
              if (!cancelled && axis) applyAxisTheme(axis);
            })
            .catch(() => undefined);
        }
      });
    };
    refreshSession();
    window.addEventListener("internflow-session-changed", refreshSession);
    return () => {
      cancelled = true;
      window.removeEventListener("internflow-session-changed", refreshSession);
    };
  }, [pathname]);

  // ✅ FIXED: Added "/signup-supervisor" to bypass the dashboard layout entirely
  if (
    pathname === "/" ||
    pathname === "/axes" ||
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname === "/signup-supervisor"
  ) {
    return <>{children}</>;
  }

  // Do not render navigation for a guessed role while the browser session is
  // still loading. This prevents a valid user from briefly receiving links
  // intended for another role.
  if (session === undefined) {
    return <div className="min-h-screen bg-cream" />;
  }

  const role = session?.role ?? "student";
  
  // The signed-in account is the source of truth. A user registered in the
  // database may not exist in the legacy demo store, so never dereference it
  // here while rendering the application shell.
  const userName = session?.name || "User";

  // Auto-detect active nav based on path and search params
  // NOTE: isActive() in Layout relies exclusively on activeNav, so we must cover every route.
  let activeNav: string;

  if (pathname.startsWith("/supervisor")) {
    if (searchParams.get("tab") === "interns" || pathname.includes("/intern/")) {
      activeNav = "My Interns";
    } else {
      activeNav = "Statistics";
    }
  } else if (pathname.startsWith("/calendar")) {
    activeNav = "Calendar";
  } else if (pathname.startsWith("/documents")) {
    activeNav = "Documents";
  } else if (pathname.startsWith("/projects")) {
    activeNav = "Project Library";
  } else if (pathname.startsWith("/messaging")) {
    activeNav = "Messages";
  } else if (pathname.startsWith("/notifications")) {
    activeNav = "Notifications";
  } else if (pathname.startsWith("/admin/users")) {
    activeNav = "User Management";
  } else if (pathname.startsWith("/admin")) {
    activeNav = "Dashboard";
  } else if (pathname.startsWith("/student") || pathname === "/student") {
    activeNav = "My Project";
  } else if (pathname.startsWith("/profile")) {
    // Profile is not a nav item — keep the previous section active
    // Default to My Project for students, Statistics for supervisors
    activeNav = role === "supervisor" ? "Statistics" : role === "admin" ? "Dashboard" : "My Project";
  } else {
    activeNav = role === "supervisor" ? "Statistics" : role === "admin" ? "Dashboard" : "My Project";
  }

  return (
    <Layout
      role={role}
      userName={userName}
      userPost={session?.post ?? undefined}
      userPhotoUrl={session?.photoUrl ?? undefined}
      activeNav={activeNav}
    >
      {children}
    </Layout>
  );
}

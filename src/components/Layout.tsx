"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { logout } from "@/lib/auth";
import { api } from "@/lib/api";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, FileText, MessageSquare, Bell,
  HelpCircle, Headphones, Users, LogOut,
  Library, BarChart2, Menu, X, Calendar,
  Moon, Sun
} from "lucide-react";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  exact?: boolean;
  badge?: number;
}

interface LayoutProps {
  children: React.ReactNode;
  role: "student" | "supervisor" | "admin";
  userName: string;
  userPost?: string;
  userPhotoUrl?: string;
  userInitials?: string;
  activeNav?: string;
}

const studentNav: NavItem[] = [
  { icon: LayoutDashboard, label: "My Project",      path: "/student",      exact: true },
  { icon: Calendar,        label: "Calendar",        path: "/calendar" },
  { icon: FileText,        label: "Documents",       path: "/documents" },
  { icon: Library,         label: "Project Library", path: "/projects" },
  { icon: MessageSquare,   label: "Messages",        path: "/messaging" },
  { icon: Bell,            label: "Notifications",   path: "/notifications" },
];

const supervisorNav: NavItem[] = [
  { icon: BarChart2,     label: "Statistics",      path: "/supervisor",              exact: true },
  { icon: Users,         label: "My Interns",      path: "/supervisor?tab=interns",  exact: true },
  { icon: Calendar,      label: "Calendar",        path: "/calendar" },
  { icon: FileText,      label: "Documents",       path: "/documents" },
  { icon: MessageSquare, label: "Messages",        path: "/messaging" },
  { icon: Library,       label: "Project Library", path: "/projects" },
  { icon: Bell,            label: "Notifications",   path: "/notifications" },
];

const adminNav: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",       path: "/admin" },
  { icon: Users,           label: "User Management", path: "/admin/users" },
  { icon: Library,         label: "Project Library", path: "/projects" },
  { icon: Bell,            label: "Notifications",   path: "/notifications" },
];

export function Layout({ children, role, userName, userPost, userPhotoUrl, userInitials, activeNav }: LayoutProps) {
  const router = useRouter();
  const location = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [internCount, setInternCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);

  // ─── HYDRATION SAFE GUARD LAYER ───
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, [router]);

  useEffect(() => {
    if (!mounted) return;

    const refreshBadges = async () => {
      const requests: Promise<void>[] = [
        api.get<{ count: number }>("/api/notifications/unread-count", { cache: "no-store" })
          .then(response => setUnreadNotifications(Number(response.count) || 0))
          .catch(() => setUnreadNotifications(0)),
      ];

      if (role === "supervisor") {
        requests.push(
          api.get<unknown[]>("/api/supervisors/interns", { cache: "no-store" })
            .then(interns => setInternCount(interns.length))
            .catch(() => setInternCount(0))
        );
      }
      if (role === "admin") {
        requests.push(
          api.get<{ totalElements: number }>("/api/admin/users?status=Need%20Review&size=1", { cache: "no-store" })
            .then(response => setPendingUserCount(Number(response.totalElements) || 0))
            .catch(() => setPendingUserCount(0))
        );
      }
      await Promise.all(requests);
    };

    refreshBadges();
    window.addEventListener("focus", refreshBadges);
    window.addEventListener("nav-badges-refresh", refreshBadges);
    const timer = window.setInterval(refreshBadges, 30000);
    return () => {
      window.removeEventListener("focus", refreshBadges);
      window.removeEventListener("nav-badges-refresh", refreshBadges);
      window.clearInterval(timer);
    };
  }, [mounted, role, location]);

  const navItems = role === "supervisor" ? supervisorNav : role === "admin" ? adminNav : studentNav;
  const initials = userInitials ?? userName.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const isActive = (item: NavItem) => {
    if (activeNav) return activeNav === item.label;
    const cleanPath = item.path.split("?")[0];
    return item.exact
      ? location === cleanPath
      : location === cleanPath || location.startsWith(cleanPath + "/");
  };

  const notifPath = `/notifications?role=${role}`;

  const badgeFor = (item: NavItem) => {
    if (item.label === "Notifications") return unreadNotifications;
    if (role === "supervisor" && item.label === "My Interns") return internCount;
    if (role === "admin" && item.label === "User Management") return pendingUserCount;
    return 0;
  };

  const handleNav = (item: NavItem) => {
    if (item.label === "Notifications") router.push(notifPath);
    else if (item.label === "My Interns") router.push("/supervisor?tab=interns");
    else if (item.label === "Statistics") router.push("/supervisor");
    else if (item.label === "Messages" && role === "supervisor") router.push("/messaging?role=supervisor");
    else router.push(item.path);
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl border border-border bg-white flex items-center justify-center overflow-hidden shrink-0">
            <Image src="/logo.svg" alt="InternFlow logo" width={28} height={28} unoptimized className="object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-charcoal tracking-tight">INTERNFLOW</p>
            <p className="text-[10px] text-muted font-medium uppercase tracking-widest">Internship management</p>
          </div>
        </div>
        <div className="axis-theme-ribbon mt-4 h-1 w-full rounded-full" />
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold text-muted-light uppercase tracking-widest">Menu</p>
        {mounted && navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          const badge = badgeFor(item);
          return (
            <button
              key={item.label}
              onClick={() => { handleNav(item); setMobileOpen(false); }}
              onMouseEnter={() => router.prefetch(item.path.split("?")[0])}
              onFocus={() => router.prefetch(item.path.split("?")[0])}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                active
                  ? "bg-cream-dark text-charcoal font-semibold axis-active-nav"
                  : "text-muted hover:bg-cream-dark/70 hover:text-charcoal"
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                active ? "bg-charcoal text-white axis-active-icon" : "bg-white border border-border text-muted"
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="flex-1 text-left">{item.label}</span>
              {badge > 0 && (
                <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  active ? "bg-charcoal text-white" : "bg-cream-dark text-muted"
                }`}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Projects section — Clean Grayscale Monochrome Update */}
      </nav>

      {/* Members / profile */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <p className="px-3 mb-2 text-[10px] font-semibold text-muted-light uppercase tracking-widest">Account</p>
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:bg-cream-dark/70 hover:text-charcoal transition-all"
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          >
            <div className="w-8 h-8 rounded-xl bg-white border border-border flex items-center justify-center shrink-0">
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </div>
            <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        )}
        {mounted && (
          role === "admin" ? (
            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl">
              {userPhotoUrl ? (
                <img src={userPhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-border shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-charcoal text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0 text-left flex-1">
                <p className="text-sm font-medium text-charcoal truncate">{userName}</p>
                <p className="text-[10px] text-muted capitalize">Administrator</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { router.push("/profile"); setMobileOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-cream-dark/70 transition-all"
            >
              {userPhotoUrl ? (
                <img src={userPhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-border shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-charcoal text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0 text-left flex-1">
                <p className="text-sm font-medium text-charcoal truncate">
                  {userName}{role === "supervisor" && userPost ? ` · ${userPost}` : ""}
                </p>
                <p className="text-[10px] text-muted capitalize">{role === "student" ? "Intern" : role}</p>
              </div>
            </button>
          )
        )}
        <button
          onClick={() => { logout(); router.push("/login"); setMobileOpen(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:bg-cream-dark/70 hover:text-red-600 transition-all"
        >
          <div className="w-8 h-8 rounded-xl bg-white border border-border flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4" />
          </div>
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex md:flex-row flex-col min-h-screen bg-cream">
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between px-5 py-3 bg-cream border-b border-border h-[60px] w-full sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl border border-border bg-white flex items-center justify-center">
            <Image src="/logo.svg" alt="InternFlow logo" width={24} height={24} unoptimized className="object-contain" />
          </div>
          <span className="text-sm font-bold text-charcoal">INTERNFLOW</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 text-muted hover:text-charcoal rounded-xl hover:bg-cream-dark transition-colors">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-charcoal/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative flex flex-col w-[280px] max-w-[88vw] bg-cream h-[100dvh] overflow-y-auto shadow-float animate-in slide-in-from-left duration-200">
            <div className="flex justify-end p-3">
              <button onClick={() => setMobileOpen(false)} className="p-2 text-muted hover:text-charcoal rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="bg-cream border-r border-border md:flex hidden flex-col w-[260px] shrink-0"
        style={{ position: "sticky", top: 0, height: "100vh" }}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-x-hidden relative">
        {children}
      </div>
    </div>
  );
}

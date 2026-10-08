"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Bell, BellRing, Check, CheckCircle2, Clock, FileText,
  Mail, Search, ShieldCheck, Star,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { PageTransition } from "@/components/PageTransition";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Notification {
  id: number;
  type: string;
  title: string;
  description: string | null;
  read: boolean;
  createdAt: string;
}

const typeStyles: Record<string, { icon: React.ElementType; color: string; background: string; label: string }> = {
  access: { icon: ShieldCheck, color: "#2563EB", background: "#EFF6FF", label: "Project access" },
  deadline: { icon: Clock, color: "#DC2626", background: "#FEF2F2", label: "Deadline" },
  submission: { icon: FileText, color: "#7C3AED", background: "#F5F3FF", label: "Submission" },
  feedback: { icon: CheckCircle2, color: "#059669", background: "#ECFDF5", label: "Feedback" },
  review: { icon: Star, color: "#D97706", background: "#FFFBEB", label: "Review" },
  message: { icon: Mail, color: "#4F46E5", background: "#EEF2FF", label: "Message" },
  system: { icon: Bell, color: "#475569", background: "#F1F5F9", label: "System" },
};

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get<{ content: Notification[] }>("/api/notifications?size=50", { cache: "no-store" })
      .then((response) => setNotifications(response.content))
      .catch(() => toast.error("Could not load notifications"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const visible = useMemo(() => notifications.filter((notification) => {
    const query = search.trim().toLowerCase();
    return (filter === "all" || !notification.read)
      && (!query || `${notification.title} ${notification.description ?? ""}`.toLowerCase().includes(query));
  }), [notifications, search, filter]);

  const markRead = async (notification: Notification) => {
    if (notification.read) return;
    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    try {
      await api.patch(`/api/notifications/${notification.id}/read`);
      window.dispatchEvent(new Event("nav-badges-refresh"));
    } catch { load(); }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/api/notifications/read-all");
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
      window.dispatchEvent(new Event("nav-badges-refresh"));
    } catch {
      toast.error("Could not mark notifications as read");
    }
  };

  return (
    <PageTransition>
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-background">
        <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:py-10">
          <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                <BellRing className="h-4 w-4" /> Activity center
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-charcoal">Notifications</h1>
              <p className="mt-1 text-sm text-muted">{unreadCount ? `${unreadCount} notification${unreadCount === 1 ? "" : "s"} need your attention` : "You’re all caught up"}</p>
            </div>
            {unreadCount > 0 && <button onClick={markAllRead} className="btn-secondary self-start text-xs sm:self-auto"><Check className="h-4 w-4" />Mark all as read</button>}
          </header>

          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm sm:flex-row dark:bg-card">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-light" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="input-field border-0 bg-grey-50 pl-9 shadow-none dark:bg-muted" placeholder="Search notifications" />
            </div>
            <div className="flex rounded-xl bg-grey-100 p-1 dark:bg-muted">
              {(["all", "unread"] as const).map((item) => (
                <button key={item} onClick={() => setFilter(item)} className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold capitalize transition-all sm:flex-none ${filter === item ? "bg-white text-charcoal shadow-sm dark:bg-card" : "text-muted"}`}>{item}</button>
              ))}
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-card">
            {loading ? <div className="p-10 text-center text-sm text-muted">Loading notifications…</div>
              : visible.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-16 text-center">
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-grey-100"><Bell className="h-6 w-6 text-muted" /></span>
                  <h2 className="text-sm font-semibold text-charcoal">No notifications here</h2>
                  <p className="mt-1 text-xs text-muted">New project decisions and platform updates will appear here.</p>
                </div>
              ) : visible.map((notification, index) => {
                const style = typeStyles[notification.type] ?? typeStyles.system;
                const Icon = style.icon;
                return (
                  <button key={notification.id} onClick={() => markRead(notification)} className={`relative flex w-full gap-4 px-4 py-5 text-left transition-colors hover:bg-grey-50 dark:hover:bg-muted sm:px-6 ${index > 0 ? "border-t border-border" : ""} ${!notification.read ? "bg-blue-50/30 dark:bg-blue-950/30" : ""}`}>
                    {!notification.read && <span className="absolute left-0 top-0 h-full w-0.5 bg-blue-600" />}
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: style.background }}><Icon className="h-5 w-5" style={{ color: style.color }} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start">
                        <span className={`text-sm ${notification.read ? "font-medium text-charcoal-soft" : "font-semibold text-charcoal"}`}>{notification.title}</span>
                        <span className="shrink-0 text-[11px] text-muted-light">{relativeTime(notification.createdAt)}</span>
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">{notification.description || "No additional details."}</span>
                      <span className="mt-2 inline-flex rounded-md bg-grey-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{style.label}</span>
                    </span>
                    {!notification.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                  </button>
                );
              })}
          </section>
        </div>
      </div>
    </PageTransition>
  );
}

export default function Notifications() {
  return <RoleGuard allowedRoles={["student", "supervisor", "admin"]}><Suspense fallback={null}><NotificationsContent /></Suspense></RoleGuard>;
}

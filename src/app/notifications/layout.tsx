"use client";
import RoleGuard from "@/components/RoleGuard";

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["student", "supervisor", "admin"]}>
      {children}
    </RoleGuard>
  );
}

"use client";
import RoleGuard from "@/components/RoleGuard";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["student", "supervisor", "admin"]}>
      {children}
    </RoleGuard>
  );
}

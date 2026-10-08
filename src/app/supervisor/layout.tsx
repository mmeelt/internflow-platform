"use client";
import RoleGuard from "@/components/RoleGuard";

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["supervisor"]}>
      {children}
    </RoleGuard>
  );
}

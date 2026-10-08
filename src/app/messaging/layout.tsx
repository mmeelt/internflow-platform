"use client";
import RoleGuard from "@/components/RoleGuard";

export default function MessagingLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["student", "supervisor"]}>
      {children}
    </RoleGuard>
  );
}

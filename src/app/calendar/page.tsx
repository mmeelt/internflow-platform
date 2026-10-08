"use client";

import RoleGuard from "@/components/RoleGuard";
import { CalendarPage } from "@/components/calendar/CalendarPage";
import { getLoggedInUser } from "@/lib/auth";

export default function CalendarRoute() {
  const session = getLoggedInUser();
  const role = session?.role === "supervisor" ? "supervisor" : "student";

  return (
    <RoleGuard allowedRoles={["student", "supervisor", "admin"]}>
      <CalendarPage role={role} />
    </RoleGuard>
  );
}

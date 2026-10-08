"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/PageTransition";
import { api, ApiError } from "@/lib/api";
import {
  Search, Shield, Users, GraduationCap, ArrowLeft, UserCheck, UserX, Eye,
} from "lucide-react";
import { toast } from "sonner";

interface UserSummary {
  id: number;
  email: string;
  name: string;
  role: string;   // "student" | "supervisor" | "admin"
  status: string; // "Active" | "Need Review" | "Revoked"
  photoUrl: string | null;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
}

const roleBadge = (role: string) => {
  const m: Record<string, string> = {
    student:         "bg-[#E5E7EB] text-[#3730a3]",
    supervisor:      "bg-[#D1FAE5] text-[#065F46]",
    admin:           "bg-[#FEF3C7] text-[#92400E]",
    ROLE_STUDENT:    "bg-[#E5E7EB] text-[#3730a3]",
    ROLE_SUPERVISOR: "bg-[#D1FAE5] text-[#065F46]",
    ROLE_ADMIN:      "bg-[#FEF3C7] text-[#92400E]",
  };
  const label = role.replace("ROLE_", "").toLowerCase();
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${m[role] || "bg-[#F3F4F6] text-[#374151]"}`}>
      {label}
    </span>
  );
};

const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    Active:         "bg-[#D1FAE5] text-[#065F46]",
    "Need Review":  "bg-[#FEF3C7] text-[#92400E]",
    Revoked:        "bg-[#FEE2E2] text-[#991B1B]",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${m[s] || "bg-[#E5E7EB] text-[#374151]"}`}>
      {s}
    </span>
  );
};

export default function UserManagement() {
  const router = useRouter();
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ content: UserSummary[] }>("/api/admin/users?size=100");
      setAllUsers(res.content ?? []);
    } catch (e) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateUserStatus = async (userId: number, newStatus: string) => {
    setUpdatingId(userId);
    try {
      const updated = await api.patch<UserSummary>(`/api/admin/users/${userId}/status`, { status: newStatus });
      setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: updated.status } : u));
      toast.success(`User status updated to ${newStatus}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update user status");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const roleLabel = u.role.replace("ROLE_", "").toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        roleLabel.includes(q)
      );
    });
  }, [allUsers, search]);

  const pendingUsers = useMemo(() => {
    return allUsers.filter((u) => u.status === "Need Review");
  }, [allUsers]);

  const regularUsers = useMemo(() => {
    return filteredUsers.filter((u) => u.status !== "Need Review");
  }, [filteredUsers]);

  return (
    <PageTransition>
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-8 py-5 shrink-0">
        <button
          onClick={() => router.push("/admin")}
          className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#111827]">User Management</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Manage profiles and permissions for all program members</p>
          </div>
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or role…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#D1D5DB] text-sm outline-none focus:border-[#111827] transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 space-y-6">
        {/* Pending user accounts section */}
        {!loading && pendingUsers.length > 0 && (
          <div className="bg-white rounded-xl border border-[#FEF3C7] p-6">
            <h2 className="text-sm font-semibold text-[#111827] mb-1">Pending user accounts</h2>
            <p className="text-xs text-[#6B7280] mb-4">Confirm each user before they can access the platform</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingUsers.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111827] truncate">{s.name}</p>
                    <p className="text-xs text-[#6B7280] truncate">{s.email}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {roleBadge(s.role)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      disabled={updatingId === s.id}
                      onClick={() => updateUserStatus(s.id, "Active")}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#059669] text-white hover:bg-[#047857] transition-all disabled:opacity-60"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      disabled={updatingId === s.id}
                      onClick={() => updateUserStatus(s.id, "Revoked")}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-60"
                    >
                      <UserX className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users list table */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-12 w-full bg-[#E5E7EB] rounded animate-pulse" />
              ))}
            </div>
          ) : regularUsers.length === 0 ? (
            <div className="py-20 text-center text-sm text-[#9CA3AF]">
              {search ? `No users match "${search}"` : "No registered users yet."}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#F3F4F6] border-b border-[#E5E7EB]">
                  <th className="px-6 py-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">User</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Email</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Account Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {regularUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#E5E7EB] text-[#374151] text-xs font-semibold flex items-center justify-center shrink-0">
                          {getInitials(user.name)}
                        </div>
                        {user.role.toLowerCase().includes("student") ? (
                          <button onClick={() => router.push(`/admin/student/${user.id}`)} className="text-sm font-medium text-[#111827] hover:underline">
                            {user.name}
                          </button>
                        ) : <span className="text-sm font-medium text-[#111827]">{user.name}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6B7280]">{user.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.role.includes("ADMIN") && <Shield className="w-4 h-4 text-[#92400E]" />}
                        {user.role.includes("SUPERVISOR") && <Users className="w-4 h-4 text-[#3730a3]" />}
                        {user.role.includes("STUDENT") && <GraduationCap className="w-4 h-4 text-[#065F46]" />}
                        {roleBadge(user.role)}
                      </div>
                    </td>
                    <td className="px-6 py-4">{statusBadge(user.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {user.role.toLowerCase().includes("student") && (
                          <button
                            onClick={() => router.push(`/admin/student/${user.id}`)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-medium text-[#374151] hover:bg-[#F3F4F6] transition-all flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" /> View record
                          </button>
                        )}
                        {user.status === "Active" ? (
                          <button
                            disabled={updatingId === user.id}
                            onClick={() => updateUserStatus(user.id, "Revoked")}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-medium text-[#374151] hover:bg-[#FEE2E2] hover:text-[#B91C1C] hover:border-[#FCA5A5] transition-all disabled:opacity-60 flex items-center gap-1.5"
                          >
                            <UserX className="w-3.5 h-3.5" /> Revoke
                          </button>
                        ) : (
                          <button
                            disabled={updatingId === user.id}
                            onClick={() => updateUserStatus(user.id, "Active")}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-medium text-[#374151] hover:bg-[#D1FAE5] hover:text-[#065F46] hover:border-[#6EE7B7] transition-all disabled:opacity-60 flex items-center gap-1.5"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

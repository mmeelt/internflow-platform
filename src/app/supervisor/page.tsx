"use client";
import { Suspense } from "react";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import { PageTransition } from "@/components/PageTransition";
import { getLoggedInUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Users, TrendingUp, Clock, CheckCircle2, Search,
  FileText, MessageSquare, ChevronRight,
  AlertCircle, Paperclip, ArrowUpRight, UserCheck, UserX, Code2, Film, Plus,
} from "lucide-react";

// ─── Backend intern type ────────────────────────────────────────────────────
interface BackendIntern {
  id: number;
  name: string;
  email: string;
  photoUrl: string | null;
  avatarColor: string | null;
  userStatus: string;        // "Active" | "Need Review" | "Revoked"
  internshipId: number;
  title: string;             // project title
  internRole: string;
  progress: number;
  internshipStatus: string;
  taskCount: number;
  reviewedCount: number;
  doneCount: number;
  submissionCount: number;
}

interface ProjectAccessRequest {
  id: number;
  projectId: number;
  projectTitle: string;
  assetType: "code" | "video";
  message: string | null;
  status: "pending" | "approved" | "denied";
  requesterName: string;
  requesterEmail: string;
}

interface StudentActivity {
  id: number;
  internName: string;
  action: string;
  occurredAt: string;
}

interface CoSupervisionInvitation {
  internshipId: number;
  studentName: string;
  projectTitle: string;
  invitedBy: string;
  createdAt: string;
}

// ─── Static / mocked data that will stay until those endpoints exist ─────────

interface UpcomingDeadline {
  taskId: number;
  internshipId: number;
  title: string;
  internName: string;
  dueDate: string;
  daysRemaining: number;
  urgency: "high" | "medium" | "low";
}

interface PendingReviewDocument {
  id: number;
  internshipId: number;
  taskId: number;
  taskTitle: string;
  taskStatus: string;
  internId: number;
  internName: string;
  name: string;
  uploadedAt: string;
}

// ─── Badge helpers ───────────────────────────────────────────────────────────
const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    Active: "bg-[#D1FAE5] text-[#065F46]",
    "Need Review": "bg-[#FEF3C7] text-[#92400E]",
    Revoked: "bg-[#FEE2E2] text-[#991B1B]",
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${m[s] || "bg-[#E5E7EB] text-[#374151]"}`}>{s}</span>;
};

// Derive initials from a name string
function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function normaliseInternStatus(status: string) {
  const normalized = status.replace(/[_-]+/g, " ").trim().toLowerCase();
  if (normalized === "need review") return "Need Review";
  if (normalized === "active") return "Active";
  if (normalized === "revoked") return "Revoked";
  return status;
}

function activityTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

// ─── Custom tooltip for BarChart ─────────────────────────────────────────────
const ProgressTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-lg px-4 py-3">
      <p className="text-sm font-semibold text-[#111827] mb-1">{label}</p>
      <p className="text-xs text-[#111827]">Progress: <strong>{payload[0]?.value}%</strong></p>
    </div>
  );
};

const ProgressChart = dynamic(
  () => import("@/components/supervisor/DashboardCharts").then((module) => module.ProgressChart),
  { ssr: false, loading: () => <div className="h-[220px] animate-pulse rounded-xl bg-grey-100" /> }
);
const TaskStatusChart = dynamic(
  () => import("@/components/supervisor/DashboardCharts").then((module) => module.TaskStatusChart),
  { ssr: false, loading: () => <div className="h-[160px] animate-pulse rounded-full bg-grey-100" /> }
);

type InternTab = "All" | "Active" | "Need Review";

// ─── Main ─────────────────────────────────────────────────────────────────────
function SupervisorDashboardContent() {
  const router  = useRouter();
  const session = getLoggedInUser();
  const [loading,          setLoading]          = useState(true);
  const [myInterns,        setMyInterns]        = useState<BackendIntern[]>([]);
  const [pendingStudents,  setPendingStudents]  = useState<any[]>([]);
  const [pendingReviews,   setPendingReviews]   = useState<any[]>([]);
  const [workflowRefresh,  setWorkflowRefresh]  = useState(0);
  const [accessRequests, setAccessRequests] = useState<ProjectAccessRequest[]>([]);
  const [recentActivities, setRecentActivities] = useState<StudentActivity[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadline[]>([]);
  const [coSupervisionInvitations, setCoSupervisionInvitations] = useState<CoSupervisionInvitation[]>([]);

  // ── Fetch both pending students and assigned interns from the backend ──────
  useEffect(() => {
    const load = async () => {
      try {
        const [interns, pending, projectRequests, activities, deadlines, invitations, documents] = await Promise.all([
          api.get<BackendIntern[]>("/api/supervisors/interns"),
          api.get<any[]>("/api/supervisors/interns/pending"),
          api.get<ProjectAccessRequest[]>("/api/projects/access-requests/supervisor"),
          api.get<StudentActivity[]>("/api/supervisors/activities/recent"),
          api.get<UpcomingDeadline[]>("/api/supervisors/deadlines/upcoming"),
          api.get<CoSupervisionInvitation[]>("/api/supervisors/co-supervision-invitations"),
          api.get<PendingReviewDocument[]>("/api/documents"),
        ]);
        setMyInterns(interns.map((intern) => ({ ...intern, userStatus: normaliseInternStatus(intern.userStatus) })));
        setPendingStudents(pending);
        setAccessRequests(projectRequests);
        setRecentActivities(activities);
        setUpcomingDeadlines(deadlines);
        setCoSupervisionInvitations(invitations);
        // Render the dashboard immediately; review details can continue loading
        // in the background instead of blocking the whole page.
        setLoading(false);
        
        // Pending Reviews must be based on actual submitted files, not only on
        // a task status. A student can submit a file while its task remains in progress.
        const reviews = documents
          .filter((document) => document.taskStatus !== "reviewed")
          .map((document) => ({
            id: String(document.id),
            taskId: document.taskId,
            intern: document.internName,
            initials: getInitials(document.internName),
            internId: document.internId,
            document: document.name,
            submittedDate: new Date(document.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            type: document.taskTitle,
          }));
        setPendingReviews(reviews);
      } catch (e) {
        console.error("Failed to load supervisor data", e);
        toast.error("Unable to load interns from the database. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workflowRefresh]);

  // ── Approve / reject ──────────────────────────────────────────────────────
  const approveStudent = async (internId: number | string) => {
    try {
      await api.post(`/api/supervisors/interns/${internId}/approve`);
      setWorkflowRefresh((k) => k + 1);
      window.dispatchEvent(new Event("nav-badges-refresh"));
      toast.success("Student account approved — they appear in My Interns now.");
    } catch (e) {
      toast.error("Failed to approve student");
    }
  };

  const rejectStudent = async (internId: number | string) => {
    try {
      await api.post(`/api/supervisors/interns/${internId}/reject`);
      setWorkflowRefresh((k) => k + 1);
      window.dispatchEvent(new Event("nav-badges-refresh"));
      toast.success("Student account rejected");
    } catch (e) {
      toast.error("Failed to reject student");
    }
  };

  const handleAccessRequest = async (id: number, approved: boolean) => {
    try {
      await api.patch(`/api/projects/access-requests/${id}`, { status: approved ? "approved" : "denied" });
      setAccessRequests((requests) => requests.filter((request) => request.id !== id));
      toast.success(approved ? "Access granted" : "Access denied");
    } catch {
      toast.error("Could not update the access request");
    }
  };

  const respondToCoSupervision = async (internshipId: number, accept: boolean) => {
    try {
      await api.patch(`/api/internships/${internshipId}/co-supervisors/me`, { accept });
      setWorkflowRefresh((key) => key + 1);
      window.dispatchEvent(new Event("nav-badges-refresh"));
      toast.success(accept ? "Invitation accepted. The student is now in your dashboard." : "Invitation declined.");
    } catch {
      toast.error("Could not update the co-supervision invitation");
    }
  };

  const params  = useSearchParams();
  const pageTab = params.get("tab") === "interns" ? "interns" : "statistics";

  const [internSearch, setInternSearch] = useState("");
  const [internTab,    setInternTab]    = useState<InternTab>("All");

  // ── Computed values from real data ────────────────────────────────────────
  const totalReviewedAll  = myInterns.reduce((a, i) => a + i.reviewedCount, 0);
  const avgProgressMy     = myInterns.length
    ? Math.round(myInterns.reduce((a, i) => a + i.progress, 0) / myInterns.length)
    : 0;

  const internColors = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#6366F1"];
  const progressData = myInterns.map((i, index) => ({
    name:     i.name.split(" ")[0],
    progress: i.progress,
    color: internColors[index % internColors.length],
  }));

  const taskStatusData = myInterns.length > 0 ? [
    { name: "Reviewed",    value: myInterns.reduce((a, i) => a + i.reviewedCount, 0),                             color: "#7C3AED" },
    { name: "Done",        value: myInterns.reduce((a, i) => a + (i.doneCount - i.reviewedCount), 0),              color: "#10B981" },
    { name: "In Progress", value: myInterns.reduce((a, i) => a + Math.max(0, i.taskCount - i.doneCount), 0),       color: "#111827" },
  ].filter((d) => d.value > 0) : [];

  // "Need Review" means a submitted document is waiting for this supervisor.
  // It is separate from account approval, which belongs in Available interns.
  const internIdsNeedingReview = useMemo(
    () => new Set(pendingReviews.map((review) => String(review.internId))),
    [pendingReviews]
  );
  const needsReview = (intern: BackendIntern) => internIdsNeedingReview.has(String(intern.id));

  const filteredInterns = myInterns.filter((i) => {
    const s = internSearch.toLowerCase();
    const matchSearch = !s || i.name.toLowerCase().includes(s) || i.title.toLowerCase().includes(s) || i.internRole.toLowerCase().includes(s);
    const matchTab = internTab === "All"
      || (internTab === "Need Review" && needsReview(i))
      || (internTab === "Active" && i.userStatus === "Active" && !needsReview(i));
    return matchSearch && matchTab;
  });

  return (
    <PageTransition>
      {loading ? (
        <div className="flex-1 overflow-auto p-8 space-y-6">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-[#E5E7EB] rounded skeleton animate-pulse" />
            <div className="h-4 w-96 bg-[#E5E7EB] rounded skeleton animate-pulse" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-3">
                <div className="h-4 w-24 bg-[#E5E7EB] rounded skeleton animate-pulse" />
                <div className="h-8 w-16 bg-[#E5E7EB] rounded skeleton animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4">
              <div className="h-5 w-48 bg-[#E5E7EB] rounded skeleton animate-pulse" />
              <div className="h-48 w-full bg-[#E5E7EB] rounded skeleton animate-pulse" />
            </div>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4">
              <div className="h-5 w-36 bg-[#E5E7EB] rounded skeleton animate-pulse" />
              <div className="space-y-3 pt-2">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-10 w-full bg-[#E5E7EB] rounded skeleton animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>

      {/* ════════════════════════ STATISTICS ════════════════════════ */}
      {pageTab === "statistics" && (
        <>
          <div className="bg-white border-b border-[#E5E7EB] px-8 py-5 shrink-0">
            <h1 className="text-xl font-semibold text-[#111827]">Statistics</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Overview of your {myInterns.length} interns</p>
          </div>

          <div className="flex-1 overflow-auto p-8 space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Interns",   value: String(myInterns.length),  icon: Users,        color: "#111827", bg: "#E5E7EB" },
                { label: "Avg. Progress",   value: `${avgProgressMy}%`,        icon: TrendingUp,   color: "#D97706", bg: "#FEF3C7" },
                { label: "Tasks Reviewed",  value: String(totalReviewedAll),   icon: CheckCircle2, color: "#7C3AED", bg: "#FDF4FF" },
                { label: "Pending Reviews", value: String(pendingReviews.length), icon: Clock,     color: "#059669", bg: "#D1FAE5" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                        <Icon className="w-5 h-5" style={{ color: s.color }} />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-[#9CA3AF]" />
                    </div>
                    <p className="text-3xl font-bold text-[#111827]">{s.value}</p>
                    <p className="text-sm text-[#6B7280] mt-0.5">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Progress bar chart */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-[#111827]">Progress by Intern</h3>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">Current project completion</p>
                  </div>
                  <button onClick={() => router.push("/supervisor?tab=interns")} className="text-xs text-[#111827] hover:underline flex items-center gap-1">
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {progressData.length > 0 ? (
                  <ProgressChart data={progressData} />
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-sm text-[#9CA3AF]">
                    No interns yet — approve a student to see their progress here.
                  </div>
                )}
              </div>

              {/* Task status pie */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                <h3 className="font-semibold text-[#111827] mb-1">Task Status</h3>
                <p className="text-xs text-[#9CA3AF] mb-4">
                  All {myInterns.reduce((a, i) => a + i.taskCount, 0)} tasks across interns
                </p>
                {taskStatusData.length > 0 ? (
                  <TaskStatusChart data={taskStatusData} />
                ) : (
                  <div className="h-[160px] flex items-center justify-center text-sm text-[#9CA3AF]">No tasks yet</div>
                )}
                <div className="space-y-2 mt-2">
                  {taskStatusData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-xs text-[#6B7280]">{d.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#374151]">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Approvals & access requests */}
            {(pendingStudents.length > 0 || accessRequests.length > 0 || coSupervisionInvitations.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {coSupervisionInvitations.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#DBEAFE] p-6">
                    <h3 className="font-semibold text-[#111827] mb-1">Co-supervision invitations</h3>
                    <p className="text-xs text-[#9CA3AF] mb-4">Accept an invitation to add the student to your dashboard</p>
                    <div className="space-y-3">
                      {coSupervisionInvitations.map((invitation) => (
                        <div key={invitation.internshipId} className="p-3 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE]">
                          <p className="text-sm font-medium text-[#111827]">{invitation.studentName}</p>
                          <p className="text-xs text-[#6B7280] mt-0.5">{invitation.projectTitle} · invited by {invitation.invitedBy}</p>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => respondToCoSupervision(invitation.internshipId, true)} className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-[#111827] text-white">Accept</button>
                            <button onClick={() => respondToCoSupervision(invitation.internshipId, false)} className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[#D1D5DB] bg-white">Deny</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {pendingStudents.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#FEF3C7] p-6">
                    <h3 className="font-semibold text-[#111827] mb-1">Pending student accounts</h3>
                    <p className="text-xs text-[#9CA3AF] mb-4">Confirm accounts before students can access the platform</p>
                    <div className="space-y-3">
                      {pendingStudents.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#111827]">{s.name}</p>
                            <p className="text-xs text-[#6B7280] truncate">{s.email}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => approveStudent(s.id)} className="p-2 rounded-lg bg-[#111827] text-white hover:bg-[#1F2937] transition-colors">
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button onClick={() => rejectStudent(s.id)} className="p-2 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
                              <UserX className="w-4 h-4 text-[#6B7280]" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {accessRequests.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                    <h3 className="font-semibold text-[#111827] mb-1">Project library access requests</h3>
                    <p className="text-xs text-[#9CA3AF] mb-4">Approve demo or code access for your archived projects</p>
                    <div className="space-y-3">
                      {accessRequests.map((r) => (
                        <div key={r.id} className="p-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
                          <div className="flex items-start gap-2 mb-2">
                            {r.assetType === "code" ? <Code2 className="w-4 h-4 text-[#111827] mt-0.5" /> : <Film className="w-4 h-4 text-[#7C3AED] mt-0.5" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[#111827]">{r.projectTitle}</p>
                              <p className="text-xs text-[#6B7280]">{r.requesterName} · {r.assetType === "video" ? "demo video" : "source code"}</p>
                              {r.message && <p className="text-xs text-[#9CA3AF] mt-1 italic">"{r.message}"</p>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleAccessRequest(r.id, true)} className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-[#111827] text-white">Approve</button>
                            <button onClick={() => handleAccessRequest(r.id, false)} className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[#E5E7EB]">Deny</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pending reviews & deadlines */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-[#111827]">Pending Reviews</h3>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">Submissions waiting for your feedback</p>
                  </div>
                  <button onClick={() => router.push("/documents")} className="text-xs text-[#111827] hover:underline flex items-center gap-1">
                    Open Documents <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-3">
                  {pendingReviews.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E7EB] hover:border-[#111827]/30 hover:bg-[#F3F4F6] transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E5E7EB] text-[#6B7280] text-xs font-semibold flex items-center justify-center">{r.initials}</div>
                        <div>
                          <p className="text-sm font-medium text-[#111827]">{r.document}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-[#6B7280]">{r.intern}</span>
                            <span className="text-[#D1D5DB]">·</span>
                            <span className="text-xs text-[#6B7280]">{r.submittedDate}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[#E5E7EB] text-[#6B7280]">{r.type}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/documents?student=${r.internId}&document=${r.id}`)}
                        className="px-3 py-1.5 rounded-lg bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] transition-colors"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                <h3 className="font-semibold text-[#111827] mb-4">Upcoming Deadlines</h3>
                <div className="space-y-3">
                  {upcomingDeadlines.length === 0 ? (
                    <p className="py-5 text-center text-xs text-[#9CA3AF]">No upcoming student deadlines.</p>
                  ) : upcomingDeadlines.map((d) => (
                    <button key={d.taskId} onClick={() => router.push(`/supervisor/intern/${d.internshipId}?tab=tasks&taskId=${d.taskId}`)} className="flex w-full items-start gap-3 rounded-lg p-1 text-left transition-colors hover:bg-[#F9FAFB]">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${d.urgency === "high" ? "bg-red-500" : d.urgency === "medium" ? "bg-amber-400" : "bg-[#e5e7eb]"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#374151] truncate">{d.title}</p>
                        <p className="text-xs text-[#9CA3AF]">{d.internName} · {new Date(`${d.dueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${d.urgency === "high" ? "text-red-500" : "text-[#9CA3AF]"}`}>{d.daysRemaining === 0 ? "Today" : `${d.daysRemaining}d`}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity feed */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
              <h3 className="font-semibold text-[#111827] mb-4">Recent Activity</h3>
              {recentActivities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D1D5DB] px-5 py-8 text-center">
                  <Paperclip className="mx-auto mb-2 h-5 w-5 text-[#9CA3AF]" />
                  <p className="text-sm text-[#6B7280]">No recent student activity.</p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">New student uploads will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6]">
                        <Paperclip className="h-4 w-4 text-[#374151]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#374151]">{activity.internName}</p>
                        <p className="truncate text-xs text-[#6B7280]">{activity.action}</p>
                      </div>
                      <time className="shrink-0 text-xs text-[#9CA3AF]" dateTime={activity.occurredAt}>{activityTime(activity.occurredAt)}</time>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════ MY INTERNS ════════════════════════ */}
      {pageTab === "interns" && (
        <>
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#111827]">My Interns</h1>
              <p className="text-sm text-[#6B7280] mt-0.5">{myInterns.length} assigned interns</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  value={internSearch}
                  onChange={(e) => setInternSearch(e.target.value)}
                  placeholder="Search by name, project or role…"
                  className="pl-9 pr-4 py-2 rounded-lg border border-[#D1D5DB] text-sm outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/20 w-72 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8">
            {pendingStudents.length > 0 && (
              <section className="mb-6 rounded-xl border border-[#FEF3C7] bg-[#FFFBEB] p-5">
                <div className="mb-4">
                  <h2 className="font-semibold text-[#111827]">Available interns</h2>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Assign a student to your supervision list. They will then appear below and you can create tasks for them.
                  </p>
                </div>
                <div className="space-y-3">
                  {pendingStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-4 rounded-lg border border-[#FDE68A] bg-white px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#111827]">{student.name}</p>
                        <p className="truncate text-xs text-[#6B7280]">{student.email}</p>
                      </div>
                      <button
                        onClick={() => approveStudent(student.id)}
                        className="shrink-0 rounded-lg bg-[#111827] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1F2937]"
                      >
                        Assign intern
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Filter tabs */}
            <div className="flex gap-2 mb-6">
              {(["All", "Active", "Need Review"] as InternTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setInternTab(t)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${internTab === t ? "bg-[#111827] text-white" : "border border-[#D1D5DB] text-[#6B7280] hover:border-[#111827] hover:text-[#111827]"}`}
                >
                  {t}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${internTab === t ? "bg-white/20 text-white" : "bg-[#E5E7EB] text-[#6B7280]"}`}>
                    {t === "All" ? myInterns.length : t === "Need Review"
                      ? myInterns.filter(needsReview).length
                      : myInterns.filter((i) => i.userStatus === "Active" && !needsReview(i)).length}
                  </span>
                </button>
              ))}
            </div>

            {myInterns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-[#9CA3AF]" />
                </div>
                <p className="text-[#111827] font-semibold">No interns yet</p>
                <p className="text-sm text-[#6B7280] mt-1">Approve a pending student to see them here.</p>
              </div>
            ) : (
              /* Kanban board */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {(["Active", "Need Review", "Revoked"] as const).map((column) => {
                  const items = internTab === "All"
                    ? filteredInterns.filter((i) => column === "Need Review"
                      ? needsReview(i)
                      : column === "Active"
                        ? i.userStatus === "Active" && !needsReview(i)
                        : i.userStatus === "Revoked")
                    : filteredInterns.filter(() => column === internTab);

                  if (internTab !== "All" && internTab !== column) return null;
                  const columnItems = items;

                  return (
                    <div key={column} className="kanban-column">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-charcoal">{column}</h3>
                        <span className="text-xs font-medium text-muted bg-white px-2 py-0.5 rounded-full border border-border">
                          {columnItems.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {columnItems.map((intern) => {
                          const isHighlighted = needsReview(intern);
                          const initials      = getInitials(intern.name);
                          return (
                            <div
                              key={intern.id}
                              onClick={() => router.push(`/supervisor/intern/${intern.internshipId}`)}
                              className={isHighlighted ? "kanban-card-active group" : "kanban-card group"}
                            >
                              <div className="flex items-center gap-3 mb-3">
                                {intern.photoUrl ? (
                                  <img src={intern.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                                ) : (
                                  <div
                                    className="w-10 h-10 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: isHighlighted ? "#333" : (intern.avatarColor || "#6B7280") }}
                                  >
                                    {initials}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={`font-semibold text-sm truncate ${isHighlighted ? "text-white" : "text-charcoal"}`}>{intern.name}</p>
                                  <p className={`text-xs truncate ${isHighlighted ? "text-white/70" : "text-muted"}`}>{intern.email}</p>
                                </div>
                              </div>
                              <p className={`text-xs mb-3 line-clamp-2 ${isHighlighted ? "text-white/80" : "text-muted"}`}>{intern.title}</p>
                              <div className="flex items-center gap-3 text-xs mb-3">
                                <span className={isHighlighted ? "text-white/70" : "text-muted"}>{intern.doneCount}/{intern.taskCount} tasks</span>
                                <span className={isHighlighted ? "text-white/70" : "text-muted"}>{intern.submissionCount} files</span>
                              </div>
                              <div className="h-1 bg-white/20 rounded-full overflow-hidden mb-2">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${intern.progress}%`, backgroundColor: isHighlighted ? "#fff" : "#111827" }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs ${isHighlighted ? "text-white/60" : "text-muted-light"}`}>{intern.progress}%</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      router.push(`/projects/new?studentId=${intern.id}`);
                                    }}
                                    className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${isHighlighted ? "border-white/40 text-white hover:bg-white/15" : "border-border text-charcoal hover:bg-grey-100"}`}
                                  >
                                    <Plus className="mr-1 inline h-3 w-3" />Create project
                                  </button>
                                  <ChevronRight className={`w-3.5 h-3.5 ${isHighlighted ? "text-white" : "text-muted"}`} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {columnItems.length === 0 && (
                          <p className="text-xs text-muted text-center py-6">No interns</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
        </>
      )}
    </PageTransition>
  );
}

export default function SupervisorDashboard() {
  return <Suspense fallback={<div>Loading…</div>}><SupervisorDashboardContent /></Suspense>;
}

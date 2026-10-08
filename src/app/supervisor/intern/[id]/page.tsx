"use client";
import { Suspense } from "react";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { PageTransition } from "@/components/PageTransition";
import { DocumentsPageContent } from "@/app/documents/page";
import type { Task, TaskPriority, TaskStatus } from "@/lib/store";
import { getLoggedInUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { draftStudentFeedbackWithAi } from "@/lib/ai";
import {
  ArrowLeft, CheckCircle2, Clock, FileText, Code2, Film,
  File, Image, Archive, MessageSquare,
  TrendingUp, ChevronDown, ChevronUp, Paperclip, AlertCircle,
  Sparkles, Check, X, Edit2, Users, UserPlus, Plus, Download, Trash2, ShieldOff, Upload,
} from "lucide-react";
import { toast } from "sonner";

// ─── Badge helpers ────────────────────────────────────────────────────────────
const priorityBadge = (p: string) => {
  const m: Record<string, string> = { high: "bg-[#FEE2E2] text-[#991B1B]", medium: "bg-[#FEF3C7] text-[#92400E]", low: "bg-[#DCFCE7] text-[#166534]" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m[p]}`}>{p[0].toUpperCase() + p.slice(1)}</span>;
};

const statusBadge = (s: TaskStatus) => {
  const m: Record<string, string> = { done: "bg-[#D1FAE5] text-[#065F46]", "in-progress": "bg-[#E5E7EB] text-[#3730a3]", todo: "bg-[#F3F4F6] text-[#374151]", reviewed: "bg-[#FDF4FF] text-[#7E22CE]" };
  const l: Record<string, string> = { done: "Done", "in-progress": "In Progress", todo: "To Do", reviewed: "✓ Reviewed" };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${m[s]}`}>{l[s]}</span>;
};

const fileIcon = (type: string) => {
  const m: Record<string, React.ElementType> = { pdf: FileText, code: Code2, video: Film, image: Image, archive: Archive };
  const Icon = m[type] || File;
  const c: Record<string, string> = { pdf: "text-red-500", code: "text-blue-500", video: "text-purple-500", image: "text-green-500", archive: "text-orange-500" };
  return <Icon className={`w-4 h-4 ${c[type] || "text-[#6B7280]"}`} />;
};

// ─── Backend DTOs ─────────────────────────────────────────────────────────────
interface CoSupervisorSummary {
  id: number;
  name: string;
  email: string;
  photoUrl: string | null;
  avatarColor: string | null;
  status: "pending" | "accepted" | "declined";
}

interface SupervisorOption {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  photoUrl: string | null;
  post: string | null;
}

interface InternshipDto {
  id: number;
  title: string;
  domain: string | null;
  description: string | null;
  internRole: string | null;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  status: string;
  intern: { id: number; name: string; photoUrl: string | null; avatarColor: string | null };
  supervisor: { id: number; name: string; photoUrl: string | null; avatarColor: string | null } | null;
  coSupervisors: CoSupervisorSummary[];
}

interface TaskDto {
  id: number;
  internshipId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  progress: number;
  feedback: string | null;
  reviewedAt: string | null;
  submissions?: Array<{
    id: number;
    name: string;
    size: string;
    type: string;
    uploadedAt: string;
  }>;
  feedbacks?: Array<{
    id: number;
    taskId: number;
    authorId: number;
    authorName: string;
    content: string;
    createdAt: string;
  }>;
}

interface StudentRecordDto {
  studentId: number;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  bio: string | null;
  university: string | null;
  department: string | null;
  year: string | null;
  previousInternships: string | null;
  enterprise: string | null;
  subjectOfInternship: string | null;
  skills: string[];
  projectTitle: string | null;
  projectDomain: string | null;
  startDate: string | null;
  endDate: string | null;
  identityCardName: string | null;
  internshipAgreementName: string | null;
  signedInternshipAgreementName: string | null;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function mapTaskDto(dto: TaskDto): Task {
  return {
    id: String(dto.id),
    title: dto.title,
    description: dto.description ?? "",
    dueDate: dto.dueDate ?? undefined,
    priority: dto.priority as TaskPriority,
    status: dto.status as TaskStatus,
    progress: dto.progress,
    submissions: (dto.submissions ?? []).map((s) => ({
      id: String(s.id),
      name: s.name,
      size: s.size,
      type: s.type.toLowerCase(),
      uploadedAt: new Date(s.uploadedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    })),
    feedback: dto.feedback ?? undefined,
    feedbacks: (dto.feedbacks ?? []).map((f) => ({
      id: String(f.id),
      taskId: String(f.taskId),
      authorId: f.authorId,
      authorName: f.authorName,
      content: f.content,
      createdAt: new Date(f.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    })),
    reviewedAt: dto.reviewedAt
      ? new Date(dto.reviewedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : undefined,
    supervisorAssigned: true,
  };
}

// Co-supervisor status badge
const coSupStatusBadge = (status: string) => {
  const config: Record<string, { label: string; className: string }> = {
    pending:  { label: "Pending",  className: "bg-[#FEF3C7] text-[#92400E]" },
    accepted: { label: "Accepted", className: "bg-[#D1FAE5] text-[#065F46]" },
    declined: { label: "Declined", className: "bg-[#FEE2E2] text-[#991B1B]" },
  };
  const cfg = config[status] ?? config.pending;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.className}`}>{cfg.label}</span>;
};

// ─── Main ─────────────────────────────────────────────────────────────────────
type InternDetailTab = "overview" | "documents" | "tasks";

function InternDetailContent() {
  const { id: internshipIdParam } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminView = searchParams.get("view") === "admin";
  const session = getLoggedInUser();

  // ── Core state ────────────────────────────────────────────────────────────
  const [accessChecked, setAccessChecked] = useState(false);
  const [internship, setInternship] = useState<InternshipDto | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [studentRecord, setStudentRecord] = useState<StudentRecordDto | null>(null);
  const [activeTab, setActiveTab] = useState<InternDetailTab>("overview");
  const signedAgreementInput = useRef<HTMLInputElement>(null);

  // Co-supervisor state (driven entirely by real API data)
  const [coSupervisors, setCoSupervisors] = useState<CoSupervisorSummary[]>([]);
  const [allSupervisors, setAllSupervisors] = useState<SupervisorOption[]>([]);
  const [coSupervisorPick, setCoSupervisorPick] = useState("");
  const [coSupLoading, setCoSupLoading] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);

  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, { open: boolean; draft: string; aiLoading: boolean }>>({})
  const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);
  const [assignTaskTitle, setAssignTaskTitle] = useState("");
  const [assignTaskDesc, setAssignTaskDesc] = useState("");
  const [assignTaskDueDate, setAssignTaskDueDate] = useState("");
  const [assignTaskHasDeadline, setAssignTaskHasDeadline] = useState(false);
  const [assignTaskPriority, setAssignTaskPriority] = useState<TaskPriority>("medium");
  const [assigningTask, setAssigningTask] = useState(false);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "overview" || requestedTab === "documents" || requestedTab === "tasks") {
      setActiveTab(requestedTab);
    }
    const requestedTask = searchParams.get("taskId");
    if (requestedTask) setExpandedTask(requestedTask);
  }, [searchParams]);

  const isActualAdmin = session?.role === "admin";
  const resolvedAdminView = isAdminView && isActualAdmin;

  // Determine roles relative to this internship
  const isPrimarySupervisor = internship
    ? internship.supervisor?.id === session?.id
    : false;

  const isAcceptedCoSupervisor = coSupervisors.some(
    (c) => c.id === session?.id && c.status === "accepted"
  );

  const isReadOnly = resolvedAdminView;
  const canManageTasks = (isPrimarySupervisor || isAcceptedCoSupervisor) && !resolvedAdminView;
  const canWriteFeedback = (isPrimarySupervisor || isAcceptedCoSupervisor) && !resolvedAdminView;

  // Supervisors already assigned (pending or accepted) — exclude from picker
  const assignedSupervisorIds = new Set(coSupervisors.map((c) => c.id));
  const availableCoSupervisors = allSupervisors.filter(
    (s) => s.id !== internship?.supervisor?.id && !assignedSupervisorIds.has(s.id)
  );

  // ── Load internship + tasks ────────────────────────────────────────────────
  const loadInternship = useCallback(async () => {
    if (!internshipIdParam || !session) return;
    try {
      const [internshipData, taskDtos, record] = await Promise.all([
        api.get<InternshipDto>(`/api/internships/${internshipIdParam}`),
        api.get<TaskDto[]>(`/api/internships/${internshipIdParam}/tasks`),
        api.get<StudentRecordDto>(`/api/internships/${internshipIdParam}/student-record`),
      ]);
      setInternship(internshipData);
      // Embed co-supervisors from the internship response (all statuses)
      setCoSupervisors(internshipData.coSupervisors ?? []);
      setTasks(taskDtos.map(mapTaskDto));
      setStudentRecord(record);
      setAccessChecked(true);
    } catch (err) {
      console.error("Failed to load internship", err);
      router.replace(session.role === "admin" ? "/admin" : "/supervisor");
    }
  }, [internshipIdParam, session, router]);

  // ── Load full supervisor list (for the picker) — primary supervisor only ──
  const loadAllSupervisors = useCallback(async () => {
    if (session?.role !== "supervisor") return;
    try {
      const supervisors = await api.get<SupervisorOption[]>("/api/supervisors");
      setAllSupervisors(supervisors);
    } catch (err) {
      console.error("Failed to load supervisors", err);
    }
  }, [session?.role]);

  useEffect(() => {
    if (!session) { router.replace("/login"); return; }
    if (!internshipIdParam) { router.replace(session.role === "admin" ? "/admin" : "/supervisor"); return; }
    void loadInternship();
    void loadAllSupervisors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internshipIdParam]);

  // ── Co-supervisor actions ─────────────────────────────────────────────────
  const addCoSupervisor = async () => {
    if (!coSupervisorPick || !internship) return;
    setCoSupLoading(true);
    try {
      await api.post(`/api/internships/${internship.id}/co-supervisors/${coSupervisorPick}`);
      // Re-fetch updated internship so co-supervisor list reflects server state
      const updated = await api.get<InternshipDto>(`/api/internships/${internship.id}`);
      setCoSupervisors(updated.coSupervisors ?? []);
      setCoSupervisorPick("");
      const picked = allSupervisors.find((s) => String(s.id) === coSupervisorPick);
      toast.success(`${picked?.name ?? "Supervisor"} invited — they will see the invite in their notifications.`);
    } catch (err) {
      console.error("Failed to invite co-supervisor", err);
      toast.error(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setCoSupLoading(false);
    }
  };

  const removeCoSupervisor = async (supervisorId: number) => {
    if (!internship) return;
    try {
      await api.delete(`/api/internships/${internship.id}/co-supervisors/${supervisorId}`);
      setCoSupervisors((prev) => prev.filter((c) => c.id !== supervisorId));
      toast.success("Co-supervisor removed.");
    } catch (err) {
      console.error("Failed to remove co-supervisor", err);
      toast.error(err instanceof Error ? err.message : "Could not remove co-supervisor");
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!accessChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <p className="text-gray-400 text-sm font-medium">Verifying access…</p>
      </div>
    );
  }

  if (!internship) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center text-[#6B7280]">
        Internship not found.
      </div>
    );
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const intern = internship.intern;
  const internName = intern.name;
  const internInitials = getInitials(internName);
  const internAvatarColor = intern.avatarColor ?? "#111827";

  const totalSubs = tasks.filter(t => t.supervisorAssigned).reduce((a, t) => a + t.submissions.length, 0);
  const doneTasks = tasks.filter(t => t.supervisorAssigned && (t.status === "done" || t.status === "reviewed")).length;
  const reviewedTasks = tasks.filter(t => t.supervisorAssigned && t.status === "reviewed").length;
  const projectTasks = tasks
    .filter((t) => t.supervisorAssigned)
    .sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31"));

  // ── Feedback helpers ───────────────────────────────────────────────────────
  const openFeedback = (taskId: string) =>
    setFeedbackState((p) => ({ ...p, [taskId]: { open: true, draft: "", aiLoading: false } }));

  const closeFeedback = (taskId: string) =>
    setFeedbackState((p) => ({ ...p, [taskId]: { ...p[taskId], open: false } }));

  const setDraft = (taskId: string, draft: string) =>
    setFeedbackState((p) => ({ ...p, [taskId]: { ...p[taskId], draft } }));

  const generateWithAI = async (taskId: string) => {
    if (!internship || feedbackState[taskId]?.aiLoading) return;
    setFeedbackState((p) => ({ ...p, [taskId]: { ...p[taskId], aiLoading: true } }));
    try {
      const result = await draftStudentFeedbackWithAi(internship.id, taskId);
      setFeedbackState((p) => ({ ...p, [taskId]: { ...p[taskId], draft: result.answer, aiLoading: false } }));
      toast.success("AI draft is ready. Review it before sending.");
    } catch (error) {
      setFeedbackState((p) => ({ ...p, [taskId]: { ...p[taskId], aiLoading: false } }));
      toast.error(error instanceof Error ? error.message : "Could not create an AI feedback draft");
    }
  };

  const submitFeedback = async (taskId: string) => {
    const fb = feedbackState[taskId];
    if (!fb?.draft.trim()) return;
    try {
      const updated = await api.post<TaskDto>(
        `/api/internships/${internship.id}/tasks/${taskId}/feedbacks`,
        { content: fb.draft }
      );
      setTasks((prev) => prev.map((t) => (t.id === taskId ? mapTaskDto(updated) : t)));
      closeFeedback(taskId);
      toast.success("Feedback submitted");
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      toast.error(err instanceof Error ? err.message : "Failed to submit feedback");
    }
  };

  const assignTask = async () => {
    if (!internship || assigningTask) return;
    if (!assignTaskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    if (assignTaskHasDeadline && !assignTaskDueDate) {
      toast.error("Please choose a deadline or turn it off");
      return;
    }
    setAssigningTask(true);
    try {
      const createdTask = await api.post<TaskDto>(`/api/internships/${internship.id}/tasks`, {
        title: assignTaskTitle.trim(),
        description: assignTaskDesc.trim(),
        priority: assignTaskPriority,
        dueDate: assignTaskHasDeadline ? assignTaskDueDate : null,
      });
      setTasks((prev) => [...prev, mapTaskDto(createdTask)]);
      setAssignTaskTitle("");
      setAssignTaskDesc("");
      setAssignTaskDueDate("");
      setAssignTaskHasDeadline(false);
      setAssignTaskPriority("medium");
      setIsAssignTaskOpen(false);
      toast.success("Task assigned successfully");
    } catch (err) {
      console.error("Failed to assign task:", err);
      toast.error(err instanceof Error ? err.message : "Failed to assign task");
    } finally {
      setAssigningTask(false);
    }
  };

  const downloadSubmission = async (taskId: string, submission: Task["submissions"][number]) => {
    try {
      const file = await api.download(
        `/api/internships/${internship.id}/tasks/${taskId}/submissions/${submission.id}/download`
      );
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename ?? submission.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download submission", error);
      toast.error("Could not download this file");
    }
  };

  // ── Revoke student access ─────────────────────────────────────────────────
  const revokeAccess = async () => {
    if (!internship) return;
    setRevokeLoading(true);
    try {
      await api.post(`/api/supervisors/interns/${intern.id}/reject`);
      // Refresh internship to reflect updated status
      const updated = await api.get<InternshipDto>(`/api/internships/${internship.id}`);
      setInternship(updated);
      setRevokeConfirmOpen(false);
      toast.success(`${internName}'s access has been revoked.`);
    } catch (err) {
      console.error("Failed to revoke access", err);
      toast.error(err instanceof Error ? err.message : "Could not revoke access");
    } finally {
      setRevokeLoading(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task and its submitted files? This cannot be undone.")) return;
    try {
      await api.delete(`/api/internships/${internship.id}/tasks/${taskId}`);
      setTasks((current) => current.filter((task) => task.id !== taskId));
      setExpandedTask(null);
      toast.success("Task deleted");
    } catch (error) {
      console.error("Failed to delete task", error);
      toast.error("Could not delete this task");
    }
  };

  const downloadRegistrationDocument = async (type: "identity-card" | "internship-agreement" | "signed-internship-agreement") => {
    if (!internship) return;
    try {
      const file = await api.download(`/api/internships/${internship.id}/student-record/${type}/download`);
      const link = window.document.createElement("a");
      const url = URL.createObjectURL(file.blob);
      link.href = url;
      link.download = file.filename || (type === "identity-card" ? "identity-card" : "internship-agreement.pdf");
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download the registration document");
    }
  };

  const uploadSignedAgreement = async (file?: File) => {
    if (!file || !internship) return;
    if (file.type !== "application/pdf") { toast.error("Please upload the signed agreement as a PDF."); return; }
    try {
      const form = new FormData(); form.append("file", file);
      const updated = await api.post<StudentRecordDto>(`/api/internships/${internship.id}/student-record/signed-agreement`, form);
      setStudentRecord(updated);
      toast.success("Signed internship agreement uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the signed agreement");
    } finally {
      if (signedAgreementInput.current) signedAgreementInput.current.value = "";
    }
  };

  // ── All submitted docs across tasks ──────────────────────────────────────
  const allDocuments = projectTasks.flatMap((task) =>
    task.submissions.map((sub) => ({ ...sub, taskTitle: task.title, taskId: task.id, taskStatus: task.status }))
  );

  return (
    <PageTransition>
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-8 py-5 shrink-0">
        <button onClick={() => router.push(isAdminView ? "/admin" : "/supervisor")} className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] mb-4">
          <ArrowLeft className="w-4 h-4" /> {isAdminView ? "Back to Admin Dashboard" : "Back to Dashboard"}
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full text-white text-lg font-semibold flex items-center justify-center shrink-0" style={{ backgroundColor: internAvatarColor }}>
              {internInitials}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-[#111827]">{internName}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${internship.status === "Active" ? "bg-[#D1FAE5] text-[#065F46]" : internship.status === "Revoked" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{internship.status}</span>
              </div>
              <p className="text-sm text-[#6B7280] mt-0.5">{internship.title}</p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                {internship.internRole ?? "Intern"} · {internship.domain ?? ""} · {internship.startDate ?? ""} → {internship.endDate ?? ""}
              </p>
            </div>
          </div>
          {!isAdminView && (
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/messaging?recipientId=${intern.id}`)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D1D5DB] text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors shrink-0"
              >
                <MessageSquare className="w-4 h-4" /> Message
              </button>
              {isPrimarySupervisor && internship.status !== "Revoked" && (
                <button
                  onClick={() => setRevokeConfirmOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-sm text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors shrink-0"
                >
                  <ShieldOff className="w-4 h-4" /> Revoke Access
                </button>
              )}
            </div>
          )}
          {isAdminView && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E]">Read-only view</span>
          )}
          {!isAdminView && isAcceptedCoSupervisor && !isPrimarySupervisor && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#1D4ED8]">Co-supervisor</span>
          )}
        </div>
      </div>

      {/* ── Revoke Access Confirmation Modal ── */}
      {revokeConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 border border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <ShieldOff className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#111827]">Revoke Access</h2>
                <p className="text-xs text-[#6B7280]">This action cannot be easily undone</p>
              </div>
            </div>
            <p className="text-sm text-[#374151] mb-6">
              Are you sure you want to revoke <span className="font-semibold text-[#111827]">{internName}</span>'s access?
              They will no longer be able to log in to the platform.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRevokeConfirmOpen(false)}
                disabled={revokeLoading}
                className="px-4 py-2 rounded-lg border border-[#D1D5DB] text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={revokeAccess}
                disabled={revokeLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {revokeLoading
                  ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <ShieldOff className="w-4 h-4" />
                }
                {revokeLoading ? "Revoking…" : "Yes, Revoke Access"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab navigation ── */}
      <div className="bg-white border-b border-[#E5E7EB] px-8 shrink-0">
        <div className="flex gap-1">
          {(["overview", "documents", "tasks"] as InternDetailTab[]).map((tab) => {
            const labels: Record<InternDetailTab, string> = { overview: "Overview", documents: "Documents", tasks: "Tasks & Feedback" };
            const counts: Record<InternDetailTab, number | null> = { overview: null, documents: allDocuments.length, tasks: projectTasks.length };
            const cnt = counts[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab
                    ? "border-[#111827] text-[#111827]"
                    : "border-transparent text-[#6B7280] hover:text-[#374151] hover:border-[#D1D5DB]"
                }`}
              >
                {labels[tab]}
                {cnt !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === tab ? "bg-[#111827] text-white" : "bg-[#F3F4F6] text-[#6B7280]"
                  }`}>{cnt}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 space-y-6">

      {/* ══════════════════════ OVERVIEW TAB ══════════════════════ */}
      {activeTab === "overview" && (
        <>
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Progress",        value: `${internship.progress}%`, icon: TrendingUp,  color: "#111827", bg: "#E5E7EB" },
            { label: "Tasks Done",      value: `${doneTasks}/${projectTasks.length}`, icon: CheckCircle2, color: "#059669", bg: "#D1FAE5" },
            { label: "Reviewed",        value: String(reviewedTasks),  icon: Check,        color: "#7C3AED", bg: "#FDF4FF" },
            { label: "Files Submitted", value: String(totalSubs),      icon: Paperclip,    color: "#D97706", bg: "#FEF3C7" },
          ].map((s) => { const Icon = s.icon; return (
            <div key={s.label} className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: s.bg }}>
                <Icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-semibold text-[#111827]">{s.value}</p>
              <p className="text-sm text-[#6B7280] mt-0.5">{s.label}</p>
            </div>
          ); })}
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-[#111827]">Project Progress</h3>
            <span className="text-sm font-semibold text-[#111827]">{internship.progress}%</span>
          </div>
          <div className="h-3 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${internship.progress}%`, backgroundColor: internship.progress >= 70 ? "#10B981" : "#111827" }} />
          </div>
          <p className="text-xs text-[#9CA3AF] mt-2">{internship.title}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-[#111827]">Student registration record</h3>
              <p className="mt-1 text-xs text-[#6B7280]">Information and official files provided during registration.</p>
            </div>
            {isAdminView && <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[10px] font-semibold text-[#92400E]">Read-only</span>}
          </div>
          {studentRecord ? (
            <>
              <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Email", studentRecord.email], ["Phone", studentRecord.phone], ["University", studentRecord.university],
                  ["Department", studentRecord.department], ["Internship type", studentRecord.year], ["Company", studentRecord.enterprise],
                  ["Subject", studentRecord.subjectOfInternship], ["Project domain", studentRecord.projectDomain],
                  ["Internship dates", studentRecord.startDate && studentRecord.endDate ? `${studentRecord.startDate} → ${studentRecord.endDate}` : null],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{label}</p>
                    <p className="mt-1 text-sm text-[#374151]">{(value as string) || "Not provided"}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-[#F3F4F6] pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Skills</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {studentRecord.skills.length ? studentRecord.skills.map((skill) => <span key={skill} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#374151]">{skill}</span>) : <span className="text-sm text-[#6B7280]">No skills provided</span>}
                </div>
              </div>
              {studentRecord.bio && <p className="mt-5 rounded-lg bg-[#F9FAFB] p-3 text-sm leading-relaxed text-[#4B5563]">{studentRecord.bio}</p>}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { type: "identity-card" as const, label: "Identity card", name: studentRecord.identityCardName },
                  { type: "internship-agreement" as const, label: "Original agreement", name: studentRecord.internshipAgreementName },
                  { type: "signed-internship-agreement" as const, label: "Signed agreement", name: studentRecord.signedInternshipAgreementName },
                ].map((document) => (
                  <div key={document.type} className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#374151]">{document.label}</p>
                      <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">{document.name || (document.type === "signed-internship-agreement" ? "Not signed and uploaded yet" : "Not uploaded for this account")}</p>
                    </div>
                    <button onClick={() => downloadRegistrationDocument(document.type)} disabled={!document.name} className="shrink-0 rounded-lg bg-[#111827] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-40">
                      Download
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-[#F3F4F6] pt-4">
                <input ref={signedAgreementInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => void uploadSignedAgreement(event.target.files?.[0])} />
                <button onClick={() => signedAgreementInput.current?.click()} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"><Upload className="h-4 w-4" /> Upload signed agreement (PDF)</button>
                <p className="mt-2 text-xs text-[#6B7280]">The signed copy is available to this student from their profile.</p>
              </div>
            </>
          ) : <p className="text-sm text-[#6B7280]">Loading registration record…</p>}
        </div>

        {/* ── Co-supervisors panel ── */}
        {!isAdminView && (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-[#6B7280]" />
              <h3 className="font-semibold text-[#111827]">Co-supervisors</h3>
            </div>
            <p className="text-xs text-[#9CA3AF] mb-4">
              {isPrimarySupervisor
                ? "Invite another supervisor to co-manage this student's internship"
                : "Other supervisors co-managing this internship"}
            </p>

            {/* Primary supervisor label */}
            {internship.supervisor && (
              <p className="text-xs text-[#6B7280] mb-3">
                Primary supervisor:{" "}
                <span className="font-medium text-[#111827]">{internship.supervisor.name}</span>
              </p>
            )}

            {/* Co-supervisor chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {coSupervisors.length === 0 ? (
                <span className="text-sm text-[#9CA3AF]">No co-supervisors yet</span>
              ) : (
                coSupervisors.map((cosup) => (
                  <span
                    key={cosup.id}
                    title={cosup.email}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#E5E7EB] text-[#374151]"
                  >
                    {cosup.name}
                    {coSupStatusBadge(cosup.status)}
                    {/* Only primary supervisor can remove; can't remove if already declined */}
                    {isPrimarySupervisor && cosup.status !== "declined" && (
                      <button
                        type="button"
                        onClick={() => removeCoSupervisor(cosup.id)}
                        className="text-[#9CA3AF] hover:text-red-500 transition-colors"
                        title={`Remove ${cosup.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>

            {/* Add co-supervisor — primary supervisor only */}
            {isPrimarySupervisor && availableCoSupervisors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <select
                  value={coSupervisorPick}
                  onChange={(e) => setCoSupervisorPick(e.target.value)}
                  className="flex-1 min-w-[200px] text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#111827] bg-white text-[#374151] cursor-pointer"
                >
                  <option value="">Select a supervisor to invite…</option>
                  {availableCoSupervisors.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}{s.post ? ` · ${s.post}` : ""} ({s.email})
                    </option>
                  ))}
                </select>
                <button
                  onClick={addCoSupervisor}
                  disabled={!coSupervisorPick || coSupLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111827] text-white text-sm font-medium disabled:opacity-40 hover:bg-[#1F2937] transition-all"
                >
                  {coSupLoading
                    ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <UserPlus className="w-4 h-4" />
                  }
                  Invite
                </button>
              </div>
            )}

            {isPrimarySupervisor && availableCoSupervisors.length === 0 && allSupervisors.length > 0 && (
              <p className="text-xs text-[#9CA3AF]">All active supervisors have been invited.</p>
            )}
          </div>
        )}
        </>
      )}

      {/* ══════════════════════ DOCUMENTS TAB ══════════════════════ */}
      {activeTab === "documents" && (
        <>
          <DocumentsPageContent fixedStudentId={String(intern.id)} embedded />
          <div className="hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">Submitted Documents</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">{allDocuments.length} file{allDocuments.length !== 1 ? "s" : ""} submitted across {projectTasks.filter(t => t.submissions.length > 0).length} task{projectTasks.filter(t => t.submissions.length > 0).length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {allDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-[#E5E7EB]">
              <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-4">
                <Paperclip className="w-8 h-8 text-[#9CA3AF]" />
              </div>
              <p className="text-[#111827] font-semibold">No documents submitted yet</p>
              <p className="text-sm text-[#6B7280] mt-1">Files submitted by the intern on their tasks will appear here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {projectTasks.filter(t => t.submissions.length > 0).map((task) => (
                <div key={task.id} className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
                  {/* Task header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] bg-[#FAFAFA]">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        task.status === "reviewed" ? "bg-[#7C3AED]" : task.status === "done" ? "bg-[#10B981]" : task.status === "in-progress" ? "bg-[#111827]" : "bg-[#D1D5DB]"
                      }`} />
                      <p className="text-sm font-semibold text-[#111827]">{task.title}</p>
                      {statusBadge(task.status)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9CA3AF]">{task.submissions.length} file{task.submissions.length !== 1 ? "s" : ""}</span>
                      <button
                        onClick={() => { setActiveTab("tasks"); setExpandedTask(task.id); }}
                        className="text-xs text-[#111827] font-medium hover:underline flex items-center gap-1"
                      >
                        View task
                      </button>
                    </div>
                  </div>
                  {/* File list */}
                  <div className="divide-y divide-[#F3F4F6]">
                    {task.submissions.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F9FAFB] transition-colors group">
                        <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center shrink-0">
                          {fileIcon(sub.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#374151] truncate">{sub.name}</p>
                          <p className="text-xs text-[#9CA3AF] mt-0.5">{sub.size} · Uploaded {sub.uploadedAt}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB] shrink-0">{sub.type}</span>
                        <button
                          onClick={() => downloadSubmission(task.id, sub)}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] transition-all hover:border-[#111827] hover:text-[#111827] hover:shadow-sm opacity-0 group-hover:opacity-100"
                          title={`Download ${sub.name}`}
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </>
      )}

      {/* ══════════════════════ TASKS TAB ══════════════════════ */}
      {activeTab === "tasks" && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">Tasks &amp; Submissions</h2>
              <p className="text-xs text-[#6B7280]">{reviewedTasks} of {projectTasks.length} reviewed</p>
            </div>
            {canManageTasks && (
              <button
                onClick={() => setIsAssignTaskOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#111827] text-white text-sm font-medium rounded-lg hover:bg-[#1F2937] transition-all"
              >
                <Plus className="w-4 h-4" /> Assign Task
              </button>
            )}
          </div>
          <div className="space-y-4">
            {projectTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-[#9CA3AF] bg-white rounded-xl border border-[#E5E7EB]">
                <Clock className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm font-medium text-[#374151]">No tasks assigned yet</p>
                {canManageTasks && (
                  <button
                    onClick={() => setIsAssignTaskOpen(true)}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#111827] text-white text-sm font-medium rounded-lg hover:bg-[#1F2937] transition-all"
                  >
                    <Plus className="w-4 h-4" /> Assign First Task
                  </button>
                )}
              </div>
            )}
            {projectTasks.map((task) => {
              const fb = feedbackState[task.id];
              const isExpanded = expandedTask === task.id;
              const isReviewed = task.status === "reviewed";
              const canReview = task.status === "done" || task.status === "in-progress";

              return (
                <div key={task.id} className={`bg-white rounded-xl border transition-all ${isExpanded ? "border-[#111827]/30 shadow-sm" : "border-[#E5E7EB]"} ${isReviewed ? "border-l-4 border-l-[#7C3AED]" : ""}`}>
                  {/* Task header */}
                  <div className="px-5 py-4 flex items-start gap-4 cursor-pointer" onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${isReviewed ? "border-[#7C3AED] bg-[#7C3AED]" : task.status === "done" ? "border-[#10B981] bg-[#10B981]" : task.status === "in-progress" ? "border-[#111827]" : "border-[#D1D5DB]"}`}>
                      {(isReviewed || task.status === "done") && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[#111827]">{task.title}</p>
                        {priorityBadge(task.priority)}
                        {statusBadge(task.status)}
                        <span className="text-xs text-[#9CA3AF]">Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A"}</span>
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5 truncate">{task.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                           <div className="h-full rounded-full" style={{ width: `${task.progress}%`, backgroundColor: isReviewed ? "#7C3AED" : task.status === "done" ? "#10B981" : "#111827" }} />
                        </div>
                        <span className="text-xs font-medium text-[#6B7280] w-7">{task.progress}%</span>
                      </div>
                      {task.submissions.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-[#111827] bg-[#E5E7EB] px-2 py-0.5 rounded-full">
                          <Paperclip className="w-3 h-3" />{task.submissions.length}
                        </span>
                      )}
                      {canManageTasks && (
                        <button
                          onClick={(event) => { event.stopPropagation(); void deleteTask(task.id); }}
                          className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7280]" /> : <ChevronDown className="w-4 h-4 text-[#6B7280]" />}
                    </div>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-[#E5E7EB] pt-4 space-y-4">
                      {/* Submissions */}
                      {task.submissions.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-[#9CA3AF] py-2">
                          <AlertCircle className="w-4 h-4" /> No files submitted yet for this task.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Submitted Files</p>
                          {task.submissions.map((sub) => (
                            <div key={sub.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6]">
                              <div className="w-9 h-9 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
                                {fileIcon(sub.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#374151] truncate">{sub.name}</p>
                                <p className="text-xs text-[#9CA3AF]">{sub.size} · Submitted {sub.uploadedAt}</p>
                              </div>
                              <button
                                onClick={() => downloadSubmission(task.id, sub)}
                                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#374151] transition-colors hover:border-[#111827] hover:text-[#111827]"
                                title={`Download ${sub.name}`}
                              >
                                <Download className="h-3.5 w-3.5" /> Download
                              </button>
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-[#E5E7EB] text-[#6B7280] shrink-0 uppercase">{sub.type}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Feedbacks list */}
                      {task.feedbacks && task.feedbacks.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Feedbacks</p>
                          {task.feedbacks.map((f) => (
                            <div key={f.id} className="bg-[#FDF4FF] border border-[#e9d5ff] rounded-xl p-4">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-[#7E22CE] flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5" />
                                  {f.authorName} · {f.createdAt}
                                </p>
                              </div>
                              <p className="text-sm text-[#6b21a8] leading-relaxed whitespace-pre-line">{f.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Legacy feedback fallback */}
                      {(!task.feedbacks || task.feedbacks.length === 0) && isReviewed && task.feedback && !fb?.open && (
                        <div className="bg-[#FDF4FF] border border-[#e9d5ff] rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-[#7E22CE] flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5" />
                              Supervisor Feedback · {task.reviewedAt}
                            </p>
                          </div>
                          <p className="text-sm text-[#6b21a8] leading-relaxed whitespace-pre-line">{task.feedback}</p>
                        </div>
                      )}

                      {/* Feedback panel */}
                      {canWriteFeedback && fb?.open ? (
                        <div className="border border-[#111827]/30 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 bg-[#E5E7EB] border-b border-[#c7d2fe]">
                            <p className="text-sm font-semibold text-[#111827]">Write Feedback</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => generateWithAI(task.id)}
                                disabled={fb.aiLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#c7d2fe] text-[#111827] hover:bg-[#f0f4ff] transition-colors disabled:opacity-60"
                              >
                                {fb.aiLoading ? (
                                  <><span className="inline-block w-3 h-3 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />Drafting…</>
                                ) : (
                                  <><Sparkles className="w-3.5 h-3.5" />Draft with AI</>
                                )}
                              </button>
                              <button onClick={() => closeFeedback(task.id)} className="p-1 text-[#9CA3AF] hover:text-[#6B7280]"><X className="w-4 h-4" /></button>
                            </div>
                          </div>
                          <div className="p-4 bg-white">
                            <textarea
                              value={fb.draft}
                              onChange={(e) => setDraft(task.id, e.target.value)}
                              placeholder="Write your feedback for this task… or click 'Draft with AI' to generate a starting point."
                              rows={6}
                              className="w-full text-sm text-[#374151] placeholder:text-[#9CA3AF] outline-none resize-none leading-relaxed"
                            />
                          </div>
                          <div className="flex items-center justify-between px-4 py-3 bg-[#F3F4F6] border-t border-[#E5E7EB]">
                            <p className="text-xs text-[#9CA3AF]">{fb.draft.length} characters · Submitting adds feedback to the task thread</p>
                            <div className="flex gap-2">
                              <button onClick={() => closeFeedback(task.id)} className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-xs text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">Cancel</button>
                              <button
                                onClick={() => submitFeedback(task.id)}
                                disabled={!fb.draft.trim()}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#7C3AED] text-white text-xs font-medium hover:bg-[#6d28d9] transition-colors disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />Submit Feedback
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        canWriteFeedback && !fb?.open && (
                          <button
                            onClick={() => openFeedback(task.id)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[#c7d2fe] text-sm text-[#111827] hover:border-[#111827] hover:bg-[#E5E7EB] transition-all w-full justify-center"
                          >
                            <Edit2 className="w-4 h-4" />
                            {task.feedbacks && task.feedbacks.length > 0 ? "Add Another Feedback Comment" : "Write Feedback & Mark as Reviewed"}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>

      {/* Assign Task modal */}
      {isAssignTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F3F4F6] shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex shrink-0 items-start justify-between border-b border-[#E5E7EB] bg-white px-6 pt-5 pb-4">
              <div>
                <h2 className="text-base font-bold text-charcoal">Assign Task</h2>
                <p className="mt-1 text-xs text-muted">Add a deadline only when this task needs one.</p>
              </div>
              <button
                onClick={() => !assigningTask && setIsAssignTaskOpen(false)}
                disabled={assigningTask}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-soft">Title</label>
                <input
                  type="text"
                  value={assignTaskTitle}
                  onChange={(e) => setAssignTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  className="input-field mt-1.5 bg-white border-[#E5E7EB]"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-soft">Description</label>
                <textarea
                  value={assignTaskDesc}
                  onChange={(e) => setAssignTaskDesc(e.target.value)}
                  placeholder="Optional description..."
                  className="input-field mt-1.5 min-h-[80px] resize-none bg-white border-[#E5E7EB]"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3 transition-colors hover:border-[#D1D5DB]">
                <input
                  type="checkbox"
                  checked={assignTaskHasDeadline}
                  onChange={(event) => {
                    setAssignTaskHasDeadline(event.target.checked);
                    if (!event.target.checked) setAssignTaskDueDate("");
                  }}
                  className="h-4 w-4 rounded border-[#D1D5DB] text-charcoal focus:ring-charcoal/20"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-charcoal">Set a deadline</span>
                  <span className="mt-0.5 block text-[11px] text-muted">The student can work without a deadline when this is off.</span>
                </span>
              </label>

              {assignTaskHasDeadline && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-soft">Deadline</label>
                  <input
                    type="date"
                    value={assignTaskDueDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setAssignTaskDueDate(e.target.value)}
                    className="input-field mt-1.5 bg-white border-[#E5E7EB]"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-soft">Priority</label>
                <select
                  value={assignTaskPriority}
                  onChange={(e) => setAssignTaskPriority(e.target.value as TaskPriority)}
                  className="input-field mt-1.5 bg-white border-[#E5E7EB]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-[#E5E7EB] bg-white px-6 py-4">
              <button
                onClick={() => setIsAssignTaskOpen(false)}
                disabled={assigningTask}
                className="btn-secondary flex-1 bg-[#F3F4F6] border-[#E5E7EB] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={assignTask}
                disabled={assigningTask}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {assigningTask ? "Saving..." : "Assign to Intern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}


export default function InternDetail() {
  return <Suspense fallback={<div>Loading...</div>}><InternDetailContent /></Suspense>;
}

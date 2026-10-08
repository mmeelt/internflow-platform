"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/PageTransition";
import type { Task, TaskPriority, TaskStatus, Submission } from "@/lib/store";
import { getLoggedInUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import {
  Upload, CheckCircle2, Clock, FileText, MessageSquare,
  TrendingUp, BookOpen, ChevronRight, Plus, Trash2,
  Paperclip, X, Code2, Film, File, Image, Archive,
  Check, ChevronDown, ChevronUp, Bell, Edit2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Backend response shapes (mirrors InternshipDto / TaskDto on the server) ──

interface InternshipUserRef {
  id: number;
  name: string;
  photoUrl: string | null;
  avatarColor: string | null;
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
  intern: InternshipUserRef;
  supervisor: InternshipUserRef | null;
  createdAt: string;
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
  createdAt: string;
  submissions?: Array<{
    id: number;
    name: string;
    size: string;
    type: string;
    uploadedAt: string;
    url?: string;
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

// ─── Refined Premium Badge helpers ───────────────────────────────────────────

const priorityBadge = (p: TaskPriority) => {
  const m = {
    high: "bg-red-50 text-red-700 border border-red-100",
    medium: "bg-amber-50 text-amber-700 border border-amber-100",
    low: "bg-slate-50 text-slate-600 border border-slate-200"
  };
  return <span className={`px-2 py-0.5 rounded border text-[11px] font-medium tracking-wide ${m[p]}`}>{p[0].toUpperCase() + p.slice(1)}</span>;
};

const statusBadge = (s: TaskStatus) => {
  const m = {
    done: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    "in-progress": "bg-blue-50 text-blue-700 border border-blue-100",
    todo: "bg-slate-50 text-slate-600 border border-slate-200",
    reviewed: "bg-purple-50 text-purple-700 border border-purple-100"
  };
  const l = { done: "Done", "in-progress": "In Progress", todo: "To Do", reviewed: "✓ Reviewed" };
  return <span className={`px-2 py-0.5 rounded border text-[11px] font-medium tracking-wide ${m[s]}`}>{l[s]}</span>;
};

const fileIconComp = (type: string) => {
  const m: Record<string, React.ElementType> = { pdf: FileText, code: Code2, video: Film, image: Image, archive: Archive };
  const Icon = m[type] || File;
  return (
    <div className="w-7 h-7 bg-slate-100 rounded border border-slate-200 flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-slate-600" />
    </div>
  );
};

const fileTypeFromName = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf", "doc", "docx"].includes(ext)) return "pdf";
  if (["py", "js", "ts", "ipynb", "java", "c", "cpp", "go", "rs", "sol"].includes(ext)) return "code";
  if (["mp4", "mov", "avi", "webm"].includes(ext)) return "video";
  if (["png", "jpg", "jpeg", "gif", "svg", "fig"].includes(ext)) return "image";
  if (["zip", "tar", "gz"].includes(ext)) return "archive";
  return "file";
};

export default function StudentDashboard() {
  const router = useRouter();

  // Hydration protection states
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [internship, setInternship] = useState<InternshipDto | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectDesc, setProjectDesc] = useState("");

  const [tab, setTab] = useState<"overview" | "project">("overview");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editingDesc, setEditingDesc] = useState(false);

  // Fetch the student's internship + tasks from the real backend.
  useEffect(() => {
    setMounted(true);

    (async () => {
      try {
        const internships = await api.get<InternshipDto[]>("/api/internships");
        const current = internships[0] ?? null;
        setInternship(current);
        setProjectDesc(current?.description ?? "");
        // Show the project shell as soon as the internship arrives. Tasks and
        // submissions continue loading without blocking the entire dashboard.
        setLoading(false);

        if (current) {
          const taskDtos = await api.get<TaskDto[]>(`/api/internships/${current.id}/tasks`);
          setTasks(
            taskDtos.map((dto): Task => ({
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
                url: s.url,
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
              reviewedAt: dto.reviewedAt ?? undefined,
              supervisorAssigned: true,
            }))
          );
        }
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Could not load your internship data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const session = mounted ? getLoggedInUser() : null;

  const milestones = useMemo(() => {
    if (tasks.length === 0) {
      return [
        { title: "No tasks assigned yet", status: "pending", date: "—" }
      ];
    }
    return [...tasks]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((t) => {
        let status = "pending";
        if (t.status === "reviewed" || t.status === "done") {
          status = "completed";
        } else if (t.status === "in-progress") {
          status = "in-progress";
        }

        let dateStr = "No due date";
        if (t.dueDate) {
          try {
            dateStr = new Date(t.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
          } catch (e) {
            dateStr = t.dueDate;
          }
        }
        return {
          title: t.title,
          status,
          date: dateStr,
        };
      });
  }, [tasks]);

  const orderedTasks = [...tasks].sort((a, b) =>
    (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31")
  );
  const doneTasks = tasks.filter((t) => t.status === "done" || t.status === "reviewed").length;
  const overallProgress = tasks.length === 0 ? 0 : Math.round((doneTasks * 100) / tasks.length);
  const totalSubs = tasks.reduce((a, t) => a + t.submissions.length, 0);
  const daysRemaining = useMemo(() => {
    if (!internship?.endDate) return null;
    const endDate = new Date(`${internship.endDate}T00:00:00`);
    if (Number.isNaN(endDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / 86_400_000));
  }, [internship?.endDate]);
  const internshipEndLabel = internship?.endDate
    ? new Date(`${internship.endDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "No end date set";

  const updateProgress = async (id: string, value: number) => {
    const target = tasks.find((t) => t.id === id);
    if (!target || target.status === "reviewed" || !internship) return; // reviewed tasks are locked

    const nextStatus: TaskStatus = value === 100 ? "done" : value > 0 ? "in-progress" : "todo";

    // Optimistic UI update
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, progress: value, status: nextStatus } : t)));

    try {
      await api.patch(`/api/internships/${internship.id}/tasks/${id}`, {
        status: nextStatus,
        progress: value,
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save progress");
      // Revert on failure
      setTasks((p) => p.map((t) => (t.id === id ? { ...t, progress: target.progress, status: target.status } : t)));
    }
  };

  // File uploads: fully integrated with backend SubmissionController
  const handleFiles = async (taskId: string, files: FileList | null) => {
    if (!files || files.length === 0 || !internship) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      
      try {
        const newSub = await api.post<any>(`/api/internships/${internship.id}/tasks/${taskId}/submissions`, formData);
        
        const formattedSub = {
          id: newSub.id.toString(),
          name: newSub.name,
          size: newSub.size,
          type: newSub.type,
          uploadedAt: new Date(newSub.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          url: newSub.url
        };
        
        setTasks((p) => p.map((t) => (t.id === taskId ? { ...t, submissions: [...t.submissions, formattedSub] } : t)));
        toast.success(`File ${file.name} uploaded successfully`);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : `Failed to upload ${file.name}`);
      }
    }
    setDragOver(null);
  };

  const removeSub = async (taskId: string, subId: string) => {
    if (!internship) return;
    try {
      await api.delete(`/api/internships/${internship.id}/tasks/${taskId}/submissions/${subId}`);
      setTasks((p) => p.map((t) => (t.id === taskId ? { ...t, submissions: t.submissions.filter((s) => s.id !== subId) } : t)));
      toast.success("File deleted");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to delete file");
    }
  };

  const tabItems = [
    { id: "overview", label: "Overview" },
    { id: "project", label: "My Project & Tasks", count: tasks.filter((t) => t.status !== "done" && t.status !== "reviewed").length },
  ] as const;

  return (
    <PageTransition>
      {(!mounted || loading) ? (
        <div className="flex-1 overflow-auto p-8 space-y-6">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-[#E5E7EB] rounded skeleton animate-pulse" />
            <div className="h-4 w-96 bg-[#E5E7EB] rounded skeleton animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-3">
                <div className="h-4 w-24 bg-[#E5E7EB] rounded skeleton animate-pulse" />
                <div className="h-8 w-16 bg-[#E5E7EB] rounded skeleton animate-pulse" />
                <div className="h-3 w-32 bg-[#E5E7EB] rounded skeleton animate-pulse" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4">
                <div className="h-5 w-36 bg-[#E5E7EB] rounded skeleton animate-pulse" />
                <div className="space-y-2 pt-2">
                  <div className="h-4 w-full bg-[#E5E7EB] rounded skeleton animate-pulse" />
                  <div className="h-4 w-full bg-[#E5E7EB] rounded skeleton animate-pulse" />
                  <div className="h-4 w-2/3 bg-[#E5E7EB] rounded skeleton animate-pulse" />
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4">
                <div className="h-5 w-28 bg-[#E5E7EB] rounded skeleton animate-pulse" />
                <div className="space-y-3 pt-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex justify-between items-center">
                      <div className="h-4 w-24 bg-[#E5E7EB] rounded skeleton animate-pulse" />
                      <div className="h-4 w-12 bg-[#E5E7EB] rounded skeleton animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="page-header pb-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold text-[#111827]">My Internship</h1>
                <p className="text-sm text-[#6B7280] mt-0.5">{internship?.title ?? "No internship assigned yet"}</p>
              </div>
              <button onClick={() => router.push("/messaging")} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#111827] text-white text-sm hover:bg-[#1F2937] transition-colors">
                <MessageSquare className="w-4 h-4" /> Message Supervisor
              </button>
            </div>
            <div className="flex gap-0 -mb-px">
              {tabItems.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-[#111827] text-[#111827]" : "border-transparent text-[#6B7280] hover:text-[#374151]"}`}
                >
                  {t.label}
                  {"count" in t && t.count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${tab === t.id ? "bg-[#111827] text-white" : "bg-[#E5E7EB] text-[#6B7280]"}`}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <div className="p-8 space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Overall Progress", value: `${overallProgress}%`, icon: TrendingUp },
                    { label: "Days Remaining", value: daysRemaining === null ? "—" : String(daysRemaining), icon: Clock },
                    { label: "Tasks Done", value: `${doneTasks}/${tasks.length}`, icon: CheckCircle2 },
                    { label: "Submissions", value: String(totalSubs), icon: BookOpen },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.label} className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-slate-50 border border-slate-200">
                          <Icon className="w-5 h-5 text-slate-700" />
                        </div>
                        <p className="text-2xl font-semibold text-[#111827]">{s.value}</p>
                        <p className="text-sm text-[#6B7280] mt-0.5">{s.label}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    {/* Project card */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded border text-[11px] font-medium bg-emerald-50 text-emerald-700 border-emerald-100">Active</span>
                        <span className="text-xs text-[#9CA3AF]">Ends {internshipEndLabel}</span>
                      </div>
                      <h2 className="text-base font-semibold text-[#111827] mb-1">{internship?.title ?? "No internship assigned yet"}</h2>
                      <p className="text-sm text-[#6B7280] mb-4">{internship?.description ?? "Once a supervisor sets up your internship, its details will appear here."}</p>
                      <div className="mb-3">
                        <div className="flex justify-between mb-1.5"><span className="text-sm text-[#374151]">Progress</span><span className="text-sm font-medium text-[#111827]">{overallProgress}%</span></div>
                        <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#111827] progress-animate" style={{ "--target-w": `${overallProgress}%` } as React.CSSProperties} /></div>
                      </div>
                      <p className="text-sm text-[#6B7280]">Supervisor: {internship?.supervisor?.name ?? "Not yet assigned"}</p>
                    </div>

                    {/* Recent tasks */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-[#111827]">Recent Tasks</h3>
                        <button onClick={() => setTab("project")} className="text-sm text-[#111827] hover:underline flex items-center gap-1">
                          Manage all <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {orderedTasks.slice(0, 4).map((t) => (
                          <div key={t.id} className="flex items-center gap-4 py-2.5 px-3 rounded-lg border border-transparent hover:border-slate-100 hover:bg-[#F9FAFB]">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <p className="text-sm font-medium text-[#111827] truncate">{t.title}</p>
                                {statusBadge(t.status)}
                                {t.status === "reviewed" && t.feedback && (
                                  <span className="text-[11px] font-medium text-[#7E22CE] flex items-center gap-0.5"><Bell className="w-3 h-3" /> Feedback received</span>
                                )}
                              </div>
                              <div className="h-1 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div className="h-full rounded-full progress-animate" style={{ "--target-w": `${t.progress}%`, backgroundColor: t.status === "reviewed" ? "#7C3AED" : t.status === "done" ? "#10B981" : "#111827" } as React.CSSProperties} />
                              </div>
                            </div>
                            <span className="text-sm font-medium text-[#6B7280] shrink-0 w-8 text-right">{t.progress}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Supervisor Feedback */}
                    {tasks.some((t) => t.feedback || (t.feedbacks && t.feedbacks.length > 0)) && (
                      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                        <h3 className="font-semibold text-[#111827] mb-4">Feedback History</h3>
                        <div className="space-y-4">
                          {tasks.filter((t) => t.feedback || (t.feedbacks && t.feedbacks.length > 0)).map((t) => (
                            <div key={t.id} className="border-l-2 border-[#7C3AED] pl-4 py-1">
                              <p className="text-sm font-semibold text-[#374151] mb-2">{t.title}</p>
                              <div className="space-y-2">
                                {t.feedbacks && t.feedbacks.length > 0 ? (
                                  t.feedbacks.map((f) => (
                                    <div key={f.id} className="bg-[#FDF4FF] p-2.5 rounded-lg border border-[#e9d5ff]">
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-semibold text-[#7E22CE]">{f.authorName}</span>
                                        <span className="text-[10px] text-[#9CA3AF]">{f.createdAt}</span>
                                      </div>
                                      <p className="text-xs text-[#6b21a8] leading-relaxed whitespace-pre-line">{f.content}</p>
                                    </div>
                                  ))
                                ) : t.feedback ? (
                                  <div className="bg-[#FDF4FF] p-2.5 rounded-lg border border-[#e9d5ff]">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-xs font-semibold text-[#7E22CE]">Supervisor</span>
                                      <span className="text-[10px] text-[#9CA3AF]">{t.reviewedAt}</span>
                                    </div>
                                    <p className="text-xs text-[#6b21a8] leading-relaxed whitespace-pre-line">{t.feedback}</p>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Milestones */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                    <h3 className="font-semibold text-[#111827] mb-5">Milestones</h3>
                    {milestones.map((m, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${m.status === "completed" ? "bg-emerald-50 border-emerald-200 text-emerald-600" : m.status === "in-progress" ? "bg-slate-900 border-slate-900 text-white" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                            {m.status === "completed" ? <Check className="w-3 h-3" /> : <div className={`w-1.5 h-1.5 rounded-full ${m.status === "in-progress" ? "bg-white" : "bg-slate-300"}`} />}
                          </div>
                          {i < milestones.length - 1 && <div className={`w-0.5 h-10 my-1 ${m.status === "completed" ? "bg-emerald-200" : "bg-[#e5e7eb]"}`} />}
                        </div>
                        <div className="flex-1 pb-2 pt-0.5">
                          <p className={`text-sm font-medium ${m.status === "completed" ? "text-[#9CA3AF] line-through" : m.status === "in-progress" ? "text-[#111827]" : "text-[#374151]"}`}>{m.title}</p>
                          <p className="text-xs text-[#9CA3AF]">{m.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── MY PROJECT & TASKS ── */}
            {tab === "project" && (
              <div className="p-8">
                {/* Project workspace header */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded border text-[11px] font-medium bg-slate-100 text-slate-800 border-slate-200">Active Project</span>
                        <span className="text-xs text-[#9CA3AF]">{internship?.startDate ?? "—"} → {internship?.endDate ?? "—"}</span>
                      </div>
                      <h2 className="text-lg font-semibold text-[#111827] mb-1">{internship?.title ?? "No internship assigned yet"}</h2>
                      {editingDesc ? (
                        <div className="flex gap-2 mt-2">
                          <textarea value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} rows={2} className="flex-1 px-3 py-2 rounded-lg border border-[#111827] text-sm resize-none outline-none" />
                          <button onClick={() => setEditingDesc(false)} className="px-3 py-1.5 rounded-lg bg-[#111827] text-white text-xs"><Check className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <p className="text-sm text-[#6B7280] leading-relaxed">{projectDesc}
                          <button onClick={() => setEditingDesc(true)} className="ml-2 text-[#9CA3AF] hover:text-[#111827]"><Edit2 className="w-3 h-3 inline" /></button>
                        </p>
                      )}
                      <div className="mt-3">
                        <div className="flex justify-between mb-1"><span className="text-xs text-[#6B7280]">Overall Progress</span><span className="text-xs font-medium text-[#111827]">{overallProgress}%</span></div>
                        <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#111827] progress-animate" style={{ "--target-w": `${overallProgress}%` } as React.CSSProperties} /></div>
                      </div>
                    </div>
                    <div className="ml-6 text-right shrink-0">
                      <p className="text-xs text-[#9CA3AF]">Supervisor</p>
                      <p className="text-sm font-semibold text-[#374151]">{internship?.supervisor?.name ?? "Not yet assigned"}</p>
                      <p className="text-xs text-[#9CA3AF] mt-3">Domain</p>
                      <p className="text-sm font-medium text-[#374151]">{internship?.internRole ?? "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Tasks header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-[#111827]">Tasks</h3>
                    <p className="text-xs text-[#6B7280] mt-0.5">{doneTasks} of {tasks.length} completed · {totalSubs} file{totalSubs !== 1 ? "s" : ""} submitted</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-[#D1D5DB] bg-white text-center">
                      <AlertCircle className="w-10 h-10 text-[#9CA3AF] mb-3 opacity-60" />
                      <h4 className="text-sm font-semibold text-[#111827]">No tasks assigned yet</h4>
                      <p className="text-xs text-[#6B7280] mt-1 mb-4 max-w-[280px]">Your supervisor has not assigned any tasks yet.</p>
                    </div>
                  ) : (
                    orderedTasks.map((task) => (
                      <StudentTaskCard
                        key={task.id}
                        task={task}
                        expanded={expandedTask === task.id}
                        onToggle={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                        onProgressChange={(v) => updateProgress(task.id, v)}
                        onFiles={(files) => handleFiles(task.id, files)}
                        onRemoveSub={(sid) => removeSub(task.id, sid)}
                        dragOver={dragOver === task.id}
                        onDragOver={() => setDragOver(task.id)}
                        onDragLeave={() => setDragOver(null)}
                        fileRef={(el) => { fileRefs.current[task.id] = el; }}
                        onBrowse={() => fileRefs.current[task.id]?.click()}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </PageTransition>
  );
}

// ─── StudentTaskCard ──────────────────────────────────────────────────────────

function StudentTaskCard({
  task, expanded, onToggle, onProgressChange,
  onFiles, onRemoveSub, dragOver, onDragOver, onDragLeave, fileRef, onBrowse,
}: {
  task: Task; expanded: boolean; onToggle: () => void;
  onProgressChange: (v: number) => void;
  onFiles: (f: FileList | null) => void; onRemoveSub: (id: string) => void;
  dragOver: boolean; onDragOver: () => void; onDragLeave: () => void;
  fileRef: (el: HTMLInputElement | null) => void; onBrowse: () => void;
}) {
  const isReviewed = task.status === "reviewed";
  const progressColor = isReviewed ? "#7C3AED" : task.status === "done" ? "#10B981" : "#111827";

  return (
    <div className={`bg-white rounded-xl border transition-all ${expanded ? "border-slate-400 shadow-sm" : "border-[#E5E7EB]"} ${isReviewed ? "border-l-4 border-l-[#7C3AED]" : ""}`}>
      <div className="px-5 py-4 flex items-start gap-4 cursor-pointer" onClick={onToggle}>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${isReviewed || task.status === "done" ? "border-[#10B981] bg-[#10B981]" : task.status === "in-progress" ? "border-[#111827]" : "border-[#D1D5DB]"}`}>
          {(isReviewed || task.status === "done") && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold ${task.status === "done" || isReviewed ? "text-[#6B7280]" : "text-[#111827]"}`}>{task.title}</p>
            {priorityBadge(task.priority)}
            {statusBadge(task.status)}
            {task.dueDate && <span className="text-xs text-[#9CA3AF]">Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
          </div>
          {task.description && <p className="text-xs text-[#6B7280] mt-1 truncate">{task.description}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-medium text-[#6B7280]">{task.progress}%</span>
          {task.submissions.length > 0 && <span className="flex items-center gap-1 text-xs text-[#111827] font-medium"><Paperclip className="w-3 h-3 text-slate-400" />{task.submissions.length}</span>}
          {(task.feedback || (task.feedbacks && task.feedbacks.length > 0)) && <Bell className="w-3.5 h-3.5 text-[#7C3AED]" />}
          {expanded ? <ChevronUp className="w-4 h-4 text-[#6B7280]" /> : <ChevronDown className="w-4 h-4 text-[#6B7280]" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-[#E5E7EB] pt-4">
          {task.description && <p className="text-sm text-[#6B7280] leading-relaxed">{task.description}</p>}

          {/* Feedback from supervisor(s) — shows each author's name */}
          {isReviewed && (task.feedbacks && task.feedbacks.length > 0 ? (
            <div className="space-y-3">
              {task.feedbacks.map((fb) => (
                <div key={fb.id} className="bg-[#FDF4FF] border border-[#e9d5ff] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[#7E22CE] flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5" /> {fb.authorName}
                    </p>
                    <span className="text-[10px] text-[#9CA3AF]">{fb.createdAt}</span>
                  </div>
                  <p className="text-sm text-[#6b21a8] leading-relaxed whitespace-pre-line">{fb.content}</p>
                </div>
              ))}
            </div>
          ) : task.feedback ? (
            <div className="bg-[#FDF4FF] border border-[#e9d5ff] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[#7E22CE] flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" /> Supervisor Feedback
                </p>
                <span className="text-[10px] text-[#9CA3AF]">{task.reviewedAt}</span>
              </div>
              <p className="text-sm text-[#6b21a8] leading-relaxed">{task.feedback}</p>
            </div>
          ) : null)}

          {/* Progress */}
          {!isReviewed && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[#374151]">My Progress</label>
                <span className="text-sm font-semibold" style={{ color: progressColor }}>{task.progress}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={task.progress} onChange={(e) => onProgressChange(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer" style={{ accentColor: progressColor }} />
              <div className="flex justify-between mt-1.5">{["0%","25%","50%","75%","100%"].map((l) => <span key={l} className="text-xs text-[#9CA3AF]">{l}</span>)}</div>
            </div>
          )}

          {/* Files */}
          <div>
            <p className="text-sm font-medium text-[#374151] mb-2">Submitted Work ({task.submissions.length})</p>
            {task.submissions.length > 0 && (
              <div className="space-y-2 mb-3">
                {task.submissions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                    <div className="flex items-center gap-3">
                      {fileIconComp(sub.type)}
                      <div>
                        <p className="text-sm font-medium text-[#374151]">{sub.name}</p>
                        <p className="text-xs text-[#9CA3AF]">{sub.size} · {sub.uploadedAt}</p>
                      </div>
                    </div>
                    {!isReviewed && <button onClick={() => onRemoveSub(sub.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
              </div>
            )}
            {!isReviewed && (
              <>
                <div
                  onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
                  onClick={onBrowse}
                  className={`border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${dragOver ? "border-[#111827] bg-[#E5E7EB]" : "border-[#D1D5DB] hover:border-slate-400 hover:bg-[#F9FAFB]"}`}
                >
                  <Upload className="w-5 h-5 text-[#9CA3AF] mx-auto mb-1.5" />
                  <p className="text-xs text-[#6B7280] font-medium">Drop files or click to upload</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">Code, PDF, video, image — any format</p>
                </div>
                <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.csv,.png,.jpg,.jpeg,.zip" className="hidden" onChange={(e) => onFiles(e.target.files)} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

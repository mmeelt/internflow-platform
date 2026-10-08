"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/PageTransition";

import type { EnterpriseProject } from "@/app/projects/page";
import { api, ApiError } from "@/lib/api";
import {
  Users, GraduationCap, BookOpen, TrendingUp, Eye, ChevronRight,
  Star, CheckCircle2, Clock, AlertCircle, Search, Shield, UserCheck, UserX,
  Plus, Sparkles, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Backend types ──────────────────────────────────────────────────────────

interface AdminIntern {
  id: number;
  name: string;
  email: string;
  photoUrl: string | null;
  avatarColor: string | null;
  userStatus: string;
  internshipId: number;
  title: string;
  internRole: string;
  progress: number;
  supervisorName: string;
  supervisorEmail: string;
  taskCount: number;
  reviewedCount: number;
  doneCount: number;
  submissionCount: number;
  adminRating: number | null;
}

interface UserSummary {
  id: number;
  email: string;
  name: string;
  role: string;   // "student" | "supervisor" | "admin"
  status: string; // "Active" | "Need Review" | "Revoked"
  photoUrl: string | null;
  post: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const domainColors: Record<string, { bg: string; text: string }> = {
  "Machine Learning": { bg: "#E5E7EB",   text: "#3730a3" },
  "Full-Stack":       { bg: "#D1FAE5",   text: "#065F46" },
  "NLP / AI":         { bg: "#FEF3C7",   text: "#92400E" },
  "Mobile":           { bg: "#FDF4FF",   text: "#7E22CE" },
  "DevOps / Cloud":   { bg: "#FFF7ED",   text: "#9a3412" },
  "Blockchain":       { bg: "#F0F9FF",   text: "#0369a1" },
};

const impactBadge = (impact: string) => {
  const m: Record<string, string> = {
    High:   "bg-[#FEE2E2] text-[#991B1B]",
    Medium: "bg-[#FEF3C7] text-[#92400E]",
    Low:    "bg-[#F3F4F6] text-[#374151]",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m[impact] || m.Low}`}>
      <Star className="w-2.5 h-2.5 inline mr-0.5" />{impact}
    </span>
  );
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
}

const roleBadge = (role: string) => {
  const m: Record<string, string> = {
    student:    "bg-[#E5E7EB] text-[#3730a3]",
    supervisor: "bg-[#D1FAE5] text-[#065F46]",
    admin:      "bg-[#FEF3C7] text-[#92400E]",
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

type AdminTab = "overview" | "students" | "supervisors" | "projects";

const emptyProjectForm = {
  title: "", description: "", domain: "", year: String(new Date().getFullYear()),
  internName: "", internId: "", invitedStudentName: "", invitedStudentEmail: "",
  supervisorId: "", invitedSupervisorName: "", invitedSupervisorEmail: "", projectRating: "", completionRate: 100,
  methodology: "", results: "", tech: "", keyFindings: "",
  hasCode: false, hasReport: false, hasVideo: false,
};

const suggestedDomains = [
  "Machine Learning", "Web Development", "Full-Stack", "NLP / AI",
  "Mobile", "DevOps / Cloud", "Cybersecurity", "Blockchain",
  "Data Engineering", "Computer Vision", "IoT / Embedded",
];

const suggestedTechnologies = [
  "Python", "Java", "Spring Boot", "React", "Next.js", "Node.js",
  "TypeScript", "PostgreSQL", "MongoDB", "Docker", "AWS",
  "PyTorch", "TensorFlow", "FastAPI", "Flutter", "Redis",
];

export default function AdminDashboard() {
  const router = useRouter();

  const [tab,           setTab]           = useState<AdminTab>("overview");
  const [search,        setSearch]        = useState("");
  const [interns,       setInterns]       = useState<AdminIntern[]>([]);
  const [allUsers,      setAllUsers]      = useState<UserSummary[]>([]);
  const [supervisors,   setSupervisors]   = useState<UserSummary[]>([]);
  const [projects,      setProjects]      = useState<EnterpriseProject[]>([]);
  const [loadingInterns, setLoadingInterns] = useState(true);
  const [loadingUsers,   setLoadingUsers]   = useState(true);
  const [updatingId,    setUpdatingId]    = useState<number | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [customDomain, setCustomDomain] = useState("");
  const [showCustomDomain, setShowCustomDomain] = useState(false);
  const [customTechnology, setCustomTechnology] = useState("");
  const [projectFiles, setProjectFiles] = useState<{ report: File | null; code: File | null; video: File | null }>({
    report: null, code: null, video: null,
  });

  // ── Fetch interns (students with internships) ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoadingInterns(true);
        const data = await api.get<AdminIntern[]>("/api/admin/interns");
        setInterns(data);
      } catch (e) {
        toast.error("Could not load students");
      } finally {
        setLoadingInterns(false);
      }
    })();
  }, []);

  useEffect(() => {
    api.get<EnterpriseProject[]>("/api/projects").then(setProjects).catch(() => toast.error("Could not load projects"));
  }, []);

  // ── Fetch ALL users from backend ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoadingUsers(true);
        // The protected API caps a page at 100 users. This is enough for the
        // dashboard summary and keeps the user-management request valid.
        const data = await api.get<{ content: UserSummary[] }>("/api/admin/users?size=100");
        const users = data.content ?? [];
        setAllUsers(users);
        setSupervisors(users.filter((u) =>
          u.role === "supervisor" || u.role === "ROLE_SUPERVISOR"
        ));
      } catch (e) {
        toast.error("Could not load users");
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, []);

  // ── Update user status (Approve / Revoke) ───────────────────────────────
  const updateUserStatus = async (userId: number, newStatus: string) => {
    setUpdatingId(userId);
    try {
      const updated = await api.patch<UserSummary>(`/api/admin/users/${userId}/status`, { status: newStatus });
      setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: updated.status } : u));
      setSupervisors((prev) => prev.map((u) => u.id === userId ? { ...u, status: updated.status } : u));
      toast.success(`User marked as ${newStatus}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update user status");
    } finally {
      setUpdatingId(null);
    }
  };

  const createProject = async () => {
    if (!projectForm.title.trim()) {
      toast.error("Project title is required");
      return;
    }
    if (!projectForm.domain.trim()) {
      toast.error("Choose a domain or add another one");
      return;
    }
    if (!projectForm.supervisorId && !(projectForm.invitedSupervisorName.trim() && projectForm.invitedSupervisorEmail.trim())) {
      toast.error("Choose a supervisor or enter a new supervisor's name and email");
      return;
    }
    const optionalRating = projectForm.projectRating.trim();
    if (optionalRating && (!Number.isFinite(Number(optionalRating)) || Number(optionalRating) < 0 || Number(optionalRating) > 10)) {
      toast.error("Project rating must be between 0 and 10");
      return;
    }
    setCreatingProject(true);
    try {
      const { projectRating, ...projectDetails } = projectForm;
      const created = await api.post<EnterpriseProject>("/api/projects", {
        ...projectDetails,
        impact: "Medium",
        supervisorId: projectForm.supervisorId ? Number(projectForm.supervisorId) : null,
        internId: projectForm.internId ? Number(projectForm.internId) : null,
        hasCode: projectForm.hasCode || !!projectFiles.code,
        hasReport: projectForm.hasReport || !!projectFiles.report,
        hasVideo: projectForm.hasVideo || !!projectFiles.video,
        tech: projectForm.tech.split(",").map((value) => value.trim()).filter(Boolean),
        keyFindings: projectForm.keyFindings.split("\n").map((value) => value.trim()).filter(Boolean),
      });
      const uploadedAssets: EnterpriseProject["assets"] = [];
      for (const type of ["report", "code", "video"] as const) {
        const file = projectFiles[type];
        if (!file) continue;
        const formData = new FormData();
        formData.append("type", type);
        formData.append("file", file);
        uploadedAssets.push(await api.post<EnterpriseProject["assets"][number]>(`/api/projects/${created.id}/assets`, formData));
      }
      if (optionalRating) {
        await api.patch(`/api/projects/${created.id}/rating`, { rating: Number(optionalRating) });
      }
      setProjects((current) => [{ ...created, assets: uploadedAssets }, ...current]);
      setProjectForm(emptyProjectForm);
      setCustomDomain("");
      setShowCustomDomain(false);
      setCustomTechnology("");
      setProjectFiles({ report: null, code: null, video: null });
      setShowProjectForm(false);
      toast.success("Project added to the library");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create project");
    } finally {
      setCreatingProject(false);
    }
  };

  const deleteProject = async (project: EnterpriseProject) => {
    if (!window.confirm(`Delete “${project.title}” and all its uploaded files? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/projects/${project.id}`);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      toast.success("Project deleted");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete project");
    }
  };

  const publishProjectToLibrary = async (project: EnterpriseProject) => {
    try {
      const updated = await api.patch<EnterpriseProject>(`/api/projects/${project.id}/visibility`, {
        visibleInLibrary: true,
        availableForStudentSelection: project.availableForStudentSelection,
      });
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success("Project is now visible in the shared library");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not publish the project");
    }
  };

  const approveProjectForStudents = async (project: EnterpriseProject) => {
    try {
      const updated = await api.post<EnterpriseProject>(`/api/projects/${project.id}/approve`);
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success("Project approved for student access");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not approve the project");
    }
  };

  const selectedTechnologies = projectForm.tech.split(",").map((value) => value.trim()).filter(Boolean);
  const selectedDomains = projectForm.domain.split(",").map((value) => value.trim()).filter(Boolean);
  const toggleDomain = (domain: string) => {
    const next = selectedDomains.some((item) => item.toLowerCase() === domain.toLowerCase())
      ? selectedDomains.filter((item) => item.toLowerCase() !== domain.toLowerCase())
      : [...selectedDomains, domain];
    setProjectForm((form) => ({ ...form, domain: next.join(", ") }));
  };
  const addCustomDomain = () => {
    const domain = customDomain.trim();
    if (!domain) return;
    if (!selectedDomains.some((item) => item.toLowerCase() === domain.toLowerCase())) {
      setProjectForm((form) => ({ ...form, domain: [...selectedDomains, domain].join(", ") }));
    }
    setCustomDomain("");
    setShowCustomDomain(false);
  };
  const toggleTechnology = (technology: string) => {
    const next = selectedTechnologies.some((item) => item.toLowerCase() === technology.toLowerCase())
      ? selectedTechnologies.filter((item) => item.toLowerCase() !== technology.toLowerCase())
      : [...selectedTechnologies, technology];
    setProjectForm((form) => ({ ...form, tech: next.join(", ") }));
  };
  const addCustomTechnology = () => {
    const technology = customTechnology.trim();
    if (!technology) return;
    if (!selectedTechnologies.some((item) => item.toLowerCase() === technology.toLowerCase())) {
      setProjectForm((form) => ({ ...form, tech: [...selectedTechnologies, technology].join(", ") }));
    }
    setCustomTechnology("");
  };
  const availableDomains = Array.from(new Set([
    ...suggestedDomains,
    ...projects.flatMap((project) => project.domain?.split(",").map((item) => item.trim()).filter(Boolean) ?? []),
  ]));

  // ── Computed stats ───────────────────────────────────────────────────────
  const avgProgress   = interns.length ? Math.round(interns.reduce((a, i) => a + i.progress, 0) / interns.length) : 0;
  const totalReviewed = interns.reduce((a, i) => a + i.reviewedCount, 0);
  const totalTasks    = interns.reduce((a, i) => a + i.taskCount, 0);
  const totalDone     = interns.reduce((a, i) => a + i.doneCount, 0);
  const totalInProgress = Math.max(0, totalTasks - totalDone);

  // ── Filtered lists ───────────────────────────────────────────────────────
  const filteredInterns = useMemo(() =>
    interns.filter((i) =>
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.title.toLowerCase().includes(search.toLowerCase())
    ), [interns, search]);

  const filteredSupervisors = useMemo(() =>
    supervisors.filter((s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
    ), [supervisors, search]);

  const filteredProjects = useMemo(() =>
    projects.filter((p) =>
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.domain?.toLowerCase().includes(search.toLowerCase())
    ), [projects, search]);

  const pendingSupervisorAccounts = allUsers.filter((user) =>
    (user.role === "supervisor" || user.role === "ROLE_SUPERVISOR") && user.status === "Need Review"
  );
  const pendingProjectApprovals = projects.filter((project) => !project.availableForStudentSelection);

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "overview",    label: "Overview"     },
    { id: "students",    label: "Students"     },
    { id: "supervisors", label: "Supervisors"  },
    { id: "projects",    label: "Projects"     },
  ];

  return (
    <PageTransition>
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-8 pt-5 pb-0 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="InternFlow Logo" className="w-10 h-10 object-contain rounded-lg border border-slate-100 bg-white" />
            <div>
              <h1 className="text-xl font-semibold text-[#111827]">INTERNFLOW</h1>
              <p className="text-sm text-[#6B7280] mt-0.5">INTERNFLOW · Internship Program 2026</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E]">Administrator</span>
        </div>
        <div className="flex gap-0 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSearch(""); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-[#111827] text-[#111827]" : "border-transparent text-[#6B7280] hover:text-[#374151]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {pendingSupervisorAccounts.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[#111827]">Supervisor accounts awaiting approval</h2>
                    <p className="mt-1 text-xs text-[#6B7280]">Approve or deny newly verified supervisor registrations.</p>
                  </div>
                  <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900">{pendingSupervisorAccounts.length}</span>
                </div>
                <div className="space-y-2">
                  {pendingSupervisorAccounts.map((supervisor) => (
                    <div key={supervisor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">{supervisor.name}</p>
                        <p className="text-xs text-[#6B7280]">{supervisor.email}{supervisor.post ? ` · ${supervisor.post}` : ""}</p>
                      </div>
                      <div className="flex gap-2">
                        <button disabled={updatingId === supervisor.id} onClick={() => updateUserStatus(supervisor.id, "Active")} className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Approve</button>
                        <button disabled={updatingId === supervisor.id} onClick={() => updateUserStatus(supervisor.id, "Revoked")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50">Deny</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {pendingProjectApprovals.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[#111827]">Projects awaiting approval</h2>
                    <p className="mt-1 text-xs text-[#6B7280]">Approve a project before its assigned student can see it or receive an email.</p>
                  </div>
                  <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900">{pendingProjectApprovals.length}</span>
                </div>
                <div className="space-y-2">
                  {pendingProjectApprovals.slice(0, 5).map((project) => (
                    <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111827]">{project.title}</p>
                        <p className="truncate text-xs text-[#6B7280]">Supervisor: {project.supervisorName || "Not assigned"}{project.studentName ? ` Â· Student: ${project.studentName}` : ""}</p>
                      </div>
                      <button onClick={() => void approveProjectForStudents(project)} className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#374151]">
                        Approve project
                      </button>
                    </div>
                  ))}
                </div>
                {pendingProjectApprovals.length > 5 && <button onClick={() => setTab("projects")} className="mt-3 text-xs font-semibold text-[#111827] hover:underline">View all pending projects</button>}
              </section>
            )}
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Active Students",    value: String(interns.length),                                              icon: GraduationCap, color: "#111827", bg: "#E5E7EB" },
                { label: "Supervisors",         value: String(supervisors.length),                                         icon: Users,         color: "#059669", bg: "#D1FAE5" },
                { label: "Enterprise Projects", value: String(projects.length),                                           icon: BookOpen,      color: "#7C3AED", bg: "#EDE9FE" },
                { label: "Avg. Progress",       value: `${avgProgress}%`,                                                  icon: TrendingUp,    color: "#D97706", bg: "#FEF3C7" },
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Student progress table */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
                  <h3 className="font-semibold text-[#111827]">Student Progress</h3>
                  <button onClick={() => setTab("students")} className="text-sm text-[#111827] hover:underline flex items-center gap-1">
                    See all<ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {loadingInterns ? (
                  <div className="p-6 space-y-3">
                    {[1,2,3].map((n) => <div key={n} className="h-10 w-full bg-[#E5E7EB] rounded animate-pulse" />)}
                  </div>
                ) : interns.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#9CA3AF]">No approved interns yet.</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6]">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Student</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Supervisor</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {interns.slice(0, 6).map((i) => (
                        <tr key={i.id} className="hover:bg-[#F3F4F6] transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              {i.photoUrl ? (
                                <img src={i.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#E5E7EB] shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0" style={{ backgroundColor: i.avatarColor || "#6B7280" }}>
                                  {getInitials(i.name)}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium text-[#111827]">{i.name}</p>
                                <p className="text-xs text-[#6B7280]">{i.internRole}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#6B7280]">{i.supervisorName}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${i.userStatus === "Active" ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
                              {i.userStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${i.progress}%`, backgroundColor: i.progress >= 70 ? "#10B981" : "#111827" }} />
                              </div>
                              <span className="text-xs text-[#6B7280]">{i.progress}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-5">
                {/* Task review stats */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                  <h3 className="font-semibold text-[#111827] mb-4">Review Status</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Tasks Reviewed",   value: totalReviewed,                color: "#7C3AED", icon: CheckCircle2 },
                      { label: "In Progress",       value: totalInProgress,              color: "#111827", icon: Clock },
                      { label: "Awaiting Feedback", value: Math.max(0, totalDone - totalReviewed), color: "#D97706", icon: AlertCircle },
                    ].map((s) => { const Icon = s.icon; return (
                      <div key={s.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color: s.color }} />
                          <span className="text-sm text-[#6B7280]">{s.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-[#111827]">{s.value}</span>
                      </div>
                    ); })}
                    {totalTasks > 0 && (
                      <div className="pt-2 border-t border-[#E5E7EB]">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-[#9CA3AF]">Overall review rate</span>
                          <span className="text-xs font-medium text-[#111827]">{Math.round((totalReviewed / totalTasks) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#7C3AED]" style={{ width: `${Math.round((totalReviewed / totalTasks) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Domain breakdown */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                  <h3 className="font-semibold text-[#111827] mb-3">Projects by Domain</h3>
                  {Object.entries(
                    projects.reduce((acc, p) => { const domain = p.domain || "General"; acc[domain] = (acc[domain] || 0) + 1; return acc; }, {} as Record<string, number>)
                  ).map(([domain, count]) => {
                    const dc = domainColors[domain] || { bg: "#F3F4F6", text: "#374151" };
                    return (
                      <div key={domain} className="flex items-center justify-between py-1.5">
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: dc.bg, color: dc.text }}>{domain}</span>
                        <span className="text-sm font-semibold text-[#374151]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STUDENTS ── */}
        {tab === "students" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or project…" className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#D1D5DB] text-sm outline-none focus:border-[#111827] transition-all" />
            </div>

            {loadingInterns ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1,2,3].map((n) => <div key={n} className="h-48 bg-[#E5E7EB] rounded-xl animate-pulse" />)}
              </div>
            ) : filteredInterns.length === 0 ? (
              <div className="py-20 text-center text-sm text-[#9CA3AF]">
                {search ? `No results for "${search}"` : "No approved interns yet."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredInterns.map((i) => (
                  <button key={i.id} onClick={() => router.push(`/admin/student/${i.id}`)} className="w-full text-left bg-white rounded-xl border border-[#E5E7EB] p-5 hover:border-[#111827]/30 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      {i.photoUrl ? (
                        <img src={i.photoUrl} alt="" className="w-11 h-11 rounded-full object-cover border border-[#E5E7EB] shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-full text-white font-semibold flex items-center justify-center" style={{ backgroundColor: i.avatarColor || "#6B7280" }}>
                          {getInitials(i.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#111827]">{i.name}</p>
                        <p className="text-xs text-[#6B7280] truncate">{i.email}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${i.userStatus === "Active" ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
                        {i.userStatus}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] line-clamp-2 mb-3">{i.title}</p>
                    <p className="text-xs text-[#9CA3AF] mb-3">Supervisor: <span className="font-medium text-[#374151]">{i.supervisorName}</span></p>
                    <p className="text-xs text-[#9CA3AF] mb-3">Admin rating: <span className="font-semibold text-[#111827]">{i.adminRating == null ? "Not rated" : `${i.adminRating}/10`}</span></p>
                    <div className="mb-3">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-[#9CA3AF]">Progress</span>
                        <span className="text-xs font-medium text-[#111827]">{i.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${i.progress}%`, backgroundColor: i.progress >= 70 ? "#10B981" : "#111827" }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#6B7280]">
                      <span>{i.doneCount}/{i.taskCount} tasks done</span>
                      <span className="text-[#7C3AED]">{i.reviewedCount} reviewed</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex justify-between items-center">
                      <span className="text-xs text-[#9CA3AF]">{i.internRole}</span>
                      <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SUPERVISORS ── */}
        {tab === "supervisors" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supervisors…" className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#D1D5DB] text-sm outline-none focus:border-[#111827] transition-all" />
            </div>

            {loadingUsers ? (
              <div className="space-y-3">{[1,2,3].map((n) => <div key={n} className="h-20 bg-[#E5E7EB] rounded-xl animate-pulse" />)}</div>
            ) : filteredSupervisors.length === 0 ? (
              <div className="py-20 text-center text-sm text-[#9CA3AF]">
                {search ? `No results for "${search}"` : "No supervisors found."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSupervisors.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                    <div className="flex items-center gap-4 flex-wrap">
                      {s.photoUrl ? (
                        <img src={s.photoUrl} alt="" className="w-11 h-11 rounded-full object-cover border border-[#E5E7EB] shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#E5E7EB] text-[#374151] font-semibold flex items-center justify-center text-sm shrink-0">
                          {getInitials(s.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold text-[#111827]">
                            {s.name}{s.post ? ` · ${s.post}` : ""}
                          </p>
                          {statusBadge(s.status)}
                        </div>
                        <p className="text-xs text-[#9CA3AF]">{s.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Interns count for this supervisor */}
                        <span className="text-sm text-[#6B7280]">
                          {interns.filter((i) => i.supervisorEmail === s.email).length} intern(s)
                        </span>
                        {s.status === "Need Review" && (
                          <>
                            <button
                              disabled={updatingId === s.id}
                              onClick={() => updateUserStatus(s.id, "Active")}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#059669] text-white text-xs font-semibold rounded-lg hover:bg-[#047857] transition-all disabled:opacity-60"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              disabled={updatingId === s.id}
                              onClick={() => updateUserStatus(s.id, "Revoked")}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#DC2626] text-white text-xs font-semibold rounded-lg hover:bg-[#B91C1C] transition-all disabled:opacity-60"
                            >
                              <UserX className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {s.status === "Active" && (
                          <button
                            disabled={updatingId === s.id}
                            onClick={() => updateUserStatus(s.id, "Revoked")}
                            className="flex items-center gap-1 px-3 py-1.5 border border-[#E5E7EB] text-[#374151] text-xs font-medium rounded-lg hover:bg-[#FEE2E2] hover:text-[#B91C1C] hover:border-[#FCA5A5] transition-all disabled:opacity-60"
                          >
                            <UserX className="w-3.5 h-3.5" /> Revoke
                          </button>
                        )}
                        {s.status === "Revoked" && (
                          <button
                            disabled={updatingId === s.id}
                            onClick={() => updateUserStatus(s.id, "Active")}
                            className="flex items-center gap-1 px-3 py-1.5 border border-[#E5E7EB] text-[#374151] text-xs font-medium rounded-lg hover:bg-[#D1FAE5] hover:text-[#065F46] hover:border-[#6EE7B7] transition-all disabled:opacity-60"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Restore
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {/* ── PROJECTS (kept as-is) ── */}
        {tab === "projects" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">Project Library Management</h2>
                <p className="text-sm text-[#6B7280]">Create complete project records and publish them to the shared library.</p>
              </div>
              <button
                onClick={() => setShowProjectForm((open) => !open)}
                className="btn-primary shrink-0"
              >
                {showProjectForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showProjectForm ? "Close form" : "Add project"}
              </button>
            </div>

            {showProjectForm && (
              <section className="app-card p-5 sm:p-6 space-y-5">
                <div className="border-b border-border pb-4">
                  <div>
                    <h3 className="font-semibold text-charcoal">New enterprise project</h3>
                    <p className="text-xs text-muted mt-1">All information is saved in the database and displayed in the original project-library format.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="md:col-span-2 text-xs font-semibold text-muted">Project title
                    <input value={projectForm.title} onChange={(event) => setProjectForm((form) => ({ ...form, title: event.target.value }))} className="input-field mt-1.5" placeholder="Customer Churn Prediction System" />
                  </label>
                  <div className="text-xs font-semibold text-muted">
                    <span>Domain</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availableDomains.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleDomain(item)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs transition-all ${selectedDomains.some((domain) => domain.toLowerCase() === item.toLowerCase()) ? "border-charcoal bg-charcoal text-white" : "border-border bg-white text-muted hover:border-charcoal hover:text-charcoal"}`}
                        >
                          {item}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShowCustomDomain((visible) => !visible)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs transition-all ${showCustomDomain ? "border-charcoal bg-charcoal text-white" : "border-border bg-white text-muted hover:border-charcoal hover:text-charcoal"}`}
                      >
                        Other
                      </button>
                    </div>
                    {showCustomDomain && (
                      <div className="mt-2 flex gap-2">
                        <input value={customDomain} onChange={(event) => setCustomDomain(event.target.value)} onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addCustomDomain();
                          }
                        }} className="input-field" placeholder="Enter another domain" />
                        <button type="button" onClick={addCustomDomain} className="btn-secondary shrink-0">Add</button>
                      </div>
                    )}
                    {selectedDomains.length > 0 && <span className="mt-2 block font-normal text-emerald-600">Selected: {selectedDomains.join(", ")}</span>}
                  </div>
                  <label className="text-xs font-semibold text-muted">Year
                    <input value={projectForm.year} onChange={(event) => setProjectForm((form) => ({ ...form, year: event.target.value }))} className="input-field mt-1.5" placeholder="2026" />
                  </label>
                  <label className="text-xs font-semibold text-muted">Intern
                    <select value={projectForm.internName} onChange={(event) => {
                      const student = allUsers.find((user) => user.name === event.target.value);
                      setProjectForm((form) => ({ ...form, internId: student ? String(student.id) : "", internName: student?.name || "", invitedStudentName: "", invitedStudentEmail: "" }));
                    }} className="input-field mt-1.5">
                      <option value="">Choose student</option>
                      {allUsers.filter((user) => user.role === "student" || user.role === "ROLE_STUDENT").map((user) => <option key={user.id} value={user.name}>{user.name} · {user.email}</option>)}
                    </select>
                  </label>
                  <div className="rounded-xl border border-dashed border-border bg-grey-50 p-3 text-xs font-semibold text-muted">Add a new student
                    <p className="mt-1 font-normal text-muted">If they are not listed, save the assignment to their email. They can register normally later.</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2"><input value={projectForm.invitedStudentName} onChange={(event) => setProjectForm((form) => ({ ...form, invitedStudentName: event.target.value, internId: "", internName: "" }))} className="input-field" placeholder="First and last name" /><input type="email" value={projectForm.invitedStudentEmail} onChange={(event) => setProjectForm((form) => ({ ...form, invitedStudentEmail: event.target.value, internId: "", internName: "" }))} className="input-field" placeholder="Email address" /></div>
                  </div>
                  <label className="text-xs font-semibold text-muted">Supervisor
                    <select value={projectForm.supervisorId} onChange={(event) => setProjectForm((form) => ({ ...form, supervisorId: event.target.value }))} className="input-field mt-1.5">
                      <option value="">Choose supervisor</option>
                      {supervisors.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
                    </select>
                  </label>
                  <div className="rounded-xl border border-dashed border-border bg-grey-50 p-3 text-xs font-semibold text-muted">Add a new supervisor
                    <p className="mt-1 font-normal text-muted">If they are not listed, save the assignment to their email. They can register normally later.</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2"><input value={projectForm.invitedSupervisorName} onChange={(event) => setProjectForm((form) => ({ ...form, invitedSupervisorName: event.target.value, supervisorId: "" }))} className="input-field" placeholder="First and last name" /><input type="email" value={projectForm.invitedSupervisorEmail} onChange={(event) => setProjectForm((form) => ({ ...form, invitedSupervisorEmail: event.target.value, supervisorId: "" }))} className="input-field" placeholder="Email address" /></div>
                  </div>
                  <label className="text-xs font-semibold text-muted">Project rating <span className="font-normal">(optional)</span>
                    <input type="number" min={0} max={10} step={0.5} value={projectForm.projectRating} onChange={(event) => {
                      const value = event.target.value;
                      setProjectForm((form) => ({ ...form, projectRating: value === "" ? "" : String(Math.min(10, Math.max(0, Number(value)))) }));
                    }} className="input-field mt-1.5" placeholder="0–10" />
                  </label>
                  <label className="text-xs font-semibold text-muted">Completion rate
                    <input type="number" min={0} max={100} value={projectForm.completionRate} onChange={(event) => setProjectForm((form) => ({ ...form, completionRate: Math.min(100, Math.max(0, Number(event.target.value) || 0)) }))} className="input-field mt-1.5" />
                  </label>
                  <label className="md:col-span-2 text-xs font-semibold text-muted">Description
                    <textarea value={projectForm.description} onChange={(event) => setProjectForm((form) => ({ ...form, description: event.target.value }))} className="input-field mt-1.5 min-h-24 resize-y" placeholder="Project objective, problem and solution…" />
                  </label>
                  <div className="md:col-span-2 text-xs font-semibold text-muted">
                    <span>Technology stack</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestedTechnologies.map((technology) => {
                        const selected = selectedTechnologies.some((item) => item.toLowerCase() === technology.toLowerCase());
                        return (
                          <button key={technology} type="button" onClick={() => toggleTechnology(technology)} className={`rounded-full border px-3 py-1.5 text-xs transition-all ${selected ? "border-charcoal bg-charcoal text-white" : "border-border bg-white text-muted hover:border-charcoal hover:text-charcoal"}`}>
                            {selected ? "✓ " : "+ "}{technology}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input value={customTechnology} onChange={(event) => setCustomTechnology(event.target.value)} onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCustomTechnology();
                        }
                      }} className="input-field" placeholder="Other technology" />
                      <button type="button" onClick={addCustomTechnology} className="btn-secondary shrink-0">Add to stack</button>
                    </div>
                    {selectedTechnologies.length > 0 && (
                      <div className="mt-3 rounded-xl bg-grey-50 p-3">
                        <span className="mb-2 block font-normal text-muted-light">Selected stack</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedTechnologies.map((technology) => (
                            <button key={technology} type="button" onClick={() => toggleTechnology(technology)} className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-charcoal shadow-sm" title="Remove">
                              {technology} ×
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <label className="md:col-span-2 text-xs font-semibold text-muted">Methodology
                    <textarea value={projectForm.methodology} onChange={(event) => setProjectForm((form) => ({ ...form, methodology: event.target.value }))} className="input-field mt-1.5 min-h-24 resize-y" placeholder="Approach, architecture, dataset and implementation process…" />
                  </label>
                  <label className="md:col-span-2 text-xs font-semibold text-muted">Results
                    <textarea value={projectForm.results} onChange={(event) => setProjectForm((form) => ({ ...form, results: event.target.value }))} className="input-field mt-1.5 min-h-24 resize-y" placeholder="Measured results and business impact…" />
                  </label>
                  <label className="md:col-span-2 text-xs font-semibold text-muted">Key findings
                    <textarea value={projectForm.keyFindings} onChange={(event) => setProjectForm((form) => ({ ...form, keyFindings: event.target.value }))} className="input-field mt-1.5 min-h-28 resize-y" placeholder={"89% AUC-ROC score\n74% of churners identified\nDeployed to production"} />
                    <span className="block mt-1 font-normal text-muted-light">Write one finding per line.</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-4">
                  {([
                    ["hasCode", "Source code"],
                    ["hasReport", "Project report"],
                    ["hasVideo", "Demo video"],
                  ] as const).map(([field, label]) => (
                    <label key={field} className="flex items-center gap-2 text-sm text-charcoal-soft">
                      <input type="checkbox" checked={projectForm[field]} onChange={(event) => setProjectForm((form) => ({ ...form, [field]: event.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border pt-5">
                  <label className="rounded-xl border border-dashed border-border bg-grey-50 p-4 text-sm text-charcoal-soft">
                    <span className="flex items-center gap-2 font-semibold"><BookOpen className="w-4 h-4" /> Project PDF</span>
                    <span className="block text-xs text-muted mt-1 mb-3">Upload the final report in PDF format.</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) => setProjectFiles((files) => ({ ...files, report: event.target.files?.[0] ?? null }))}
                      className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-charcoal file:px-3 file:py-2 file:text-white"
                    />
                    {projectFiles.report && <span className="block mt-2 text-xs text-muted truncate">{projectFiles.report.name}</span>}
                  </label>
                  <label className="rounded-xl border border-dashed border-border bg-grey-50 p-4 text-sm text-charcoal-soft">
                    <span className="flex items-center gap-2 font-semibold"><BookOpen className="w-4 h-4" /> Source code</span>
                    <span className="block text-xs text-muted mt-1 mb-3">Upload the project's source code, preferably as a ZIP archive.</span>
                    <input
                      type="file"
                      accept=".zip,.rar,.7z,.tar,.gz,.java,.js,.jsx,.ts,.tsx,.py,.html,.css,.json"
                      onChange={(event) => setProjectFiles((files) => ({ ...files, code: event.target.files?.[0] ?? null }))}
                      className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-charcoal file:px-3 file:py-2 file:text-white"
                    />
                    {projectFiles.code && <span className="block mt-2 text-xs text-muted truncate">{projectFiles.code.name}</span>}
                  </label>
                  <label className="rounded-xl border border-dashed border-border bg-grey-50 p-4 text-sm text-charcoal-soft">
                    <span className="flex items-center gap-2 font-semibold"><BookOpen className="w-4 h-4" /> Demo video</span>
                    <span className="block text-xs text-muted mt-1 mb-3">Upload an MP4, MOV, AVI, or another video format.</span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(event) => setProjectFiles((files) => ({ ...files, video: event.target.files?.[0] ?? null }))}
                      className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-charcoal file:px-3 file:py-2 file:text-white"
                    />
                    {projectFiles.video && <span className="block mt-2 text-xs text-muted truncate">{projectFiles.video.name}</span>}
                  </label>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setProjectForm(emptyProjectForm); setCustomDomain(""); setShowCustomDomain(false); setCustomTechnology(""); setProjectFiles({ report: null, code: null, video: null }); setShowProjectForm(false); }} className="btn-secondary">Cancel</button>
                  <button type="button" disabled={creatingProject} onClick={createProject} className="btn-primary disabled:opacity-60">
                    {creatingProject ? "Saving…" : "Save and publish project"}
                  </button>
                </div>
              </section>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…" className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#D1D5DB] text-sm outline-none focus:border-[#111827] transition-all" />
            </div>
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F3F4F6] border-b border-[#E5E7EB]">
                    {["Project", "Domain", "Intern", "Supervisor", "Year", "Student rating", "Completion", ""].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredProjects.map((p) => {
                    const dc = domainColors[p.domain || ""] || { bg: "#F3F4F6", text: "#374151" };
                    return (
                      <tr key={p.id} className="hover:bg-[#F3F4F6] transition-colors">
                        <td className="px-5 py-3 max-w-[220px]"><p className="text-sm font-medium text-[#111827] line-clamp-2">{p.title}</p></td>
                        <td className="px-4 py-3"><span className="px-2.5 py-0.5 rounded-lg text-xs font-medium" style={{ backgroundColor: dc.bg, color: dc.text }}>{p.domain}</span></td>
                        <td className="px-4 py-3 text-sm text-[#6B7280]">{p.internName || "—"}</td>
                        <td className="px-4 py-3 text-sm text-[#6B7280]">{p.supervisorName}</td>
                        <td className="px-4 py-3 text-sm text-[#6B7280]">{p.year}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[#111827]">{p.studentRating == null ? "Not rated" : `${p.studentRating}/10`}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${p.completionRate}%` }} />
                            </div>
                            <span className="text-xs text-[#6B7280]">{p.completionRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => router.push(`/projects/${p.id}`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#111827] border border-[#c7d2fe] hover:bg-[#E5E7EB] transition-colors">
                              <Eye className="w-3 h-3" />View
                            </button>
                            {p.visibleInLibrary ? (
                              <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">Visible</span>
                            ) : !p.availableForStudentSelection ? (
                              <button onClick={() => void approveProjectForStudents(p)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700">
                                Approve
                              </button>
                            ) : (
                              <button onClick={() => void publishProjectToLibrary(p)} className="rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#374151]">
                                Publish
                              </button>
                            )}
                            <button onClick={() => deleteProject(p)} aria-label={`Delete ${p.title}`} className="flex items-center justify-center rounded-lg border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </PageTransition>
  );
}

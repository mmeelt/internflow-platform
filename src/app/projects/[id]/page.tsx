"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Calendar, ChevronRight, Code2, Download, ExternalLink, FileText, Film,
  Lock, Send, Sparkles, Star, TrendingUp, Users, X,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { PageTransition } from "@/components/PageTransition";
import { api } from "@/lib/api";
import { askProjectReportAi } from "@/lib/ai";
import { getLoggedInUser } from "@/lib/auth";
import type { EnterpriseProject, ProjectAsset } from "../page";
import { toast } from "sonner";

const domainColors: Record<string, { backgroundColor: string; color: string }> = {
  "Machine Learning": { backgroundColor: "#EEF2FF", color: "#4338CA" },
  "Full-Stack": { backgroundColor: "#ECFDF5", color: "#047857" },
  "NLP / AI": { backgroundColor: "#FFFBEB", color: "#B45309" },
  "Mobile": { backgroundColor: "#FDF4FF", color: "#A21CAF" },
  "DevOps / Cloud": { backgroundColor: "#FFF7ED", color: "#C2410C" },
  "Blockchain": { backgroundColor: "#F0F9FF", color: "#0369A1" },
};

function ProjectDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const session = getLoggedInUser();
  const [project, setProject] = useState<EnterpriseProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState("");
  const [studentRating, setStudentRating] = useState("");
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; text: string; sources?: string[] }[]>([]);
  const [askingProject, setAskingProject] = useState(false);
  const [accessStatuses, setAccessStatuses] = useState<Record<string, string>>({});
  const aiBottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    api.get<EnterpriseProject>(`/api/projects/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(setProject)
      .catch((cause) => {
        setProject(null);
        setError(cause instanceof Error ? cause.message : "Could not load project");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api.get<{ assetType: string; status: string }[]>(`/api/projects/${encodeURIComponent(id)}/access-requests/mine`)
      .then((requests) => setAccessStatuses(Object.fromEntries(requests.map((request) => [request.assetType, request.status]))))
      .catch(() => undefined);
  }, [id]);

  const downloadAsset = async (asset: ProjectAsset) => {
    try {
      const result = await api.download(`/api/projects/${encodeURIComponent(id)}/assets/${asset.id}`);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename || asset.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download this project file");
    }
  };

  const viewPdf = async (asset: ProjectAsset) => {
    try {
      const result = await api.download(`/api/projects/${encodeURIComponent(id)}/assets/${asset.id}`);
      setPdfUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(result.blob);
      });
    } catch {
      toast.error("Could not open this PDF");
    }
  };

  const askProject = async (question?: string) => {
    const text = (question ?? aiInput).trim();
    if (!text || !project || askingProject) return;
    setAiMessages((messages) => [...messages, { role: "user", text }]);
    setAiInput("");
    setAskingProject(true);
    try {
      const result = await askProjectReportAi(id, text);
      setAiMessages((messages) => [...messages, { role: "assistant", text: result.answer, sources: result.sources }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not analyse this project report.";
      setAiMessages((messages) => [...messages, { role: "assistant", text: message }]);
      toast.error(message);
    } finally {
      setAskingProject(false);
      window.setTimeout(() => aiBottom.current?.scrollIntoView({ behavior: "smooth" }), 0);
    }
  };

  const requestAccess = async (type: "report" | "code" | "video") => {
    try {
      const request = await api.post<{ status: string }>(`/api/projects/${encodeURIComponent(id)}/access-requests`, {
        assetType: type,
        message: `Access requested for ${project?.title || "this project"}`,
      });
      setAccessStatuses((statuses) => ({ ...statuses, [type]: request.status }));
      toast.success("Access request sent to the project supervisor");
    } catch {
      toast.error("Could not send the access request");
    }
  };

  const submitRating = async () => {
    const value = Number(rating);
    if (!Number.isFinite(value) || value < 0 || value > 10) {
      toast.error("Rating must be between 0 and 10");
      return;
    }
    try {
      const updated = await api.patch<EnterpriseProject>(`/api/projects/${id}/rating`, { rating: value });
      setProject(updated);
      setRating("");
      toast.success("Rating saved");
    } catch {
      toast.error("Could not save rating");
    }
  };

  const updateVisibility = async (field: "visibleInLibrary" | "availableForStudentSelection") => {
    if (!project) return;
    try {
      const updated = await api.patch<EnterpriseProject>(`/api/projects/${id}/visibility`, {
        visibleInLibrary: field === "visibleInLibrary" ? !project.visibleInLibrary : project.visibleInLibrary,
        availableForStudentSelection: field === "availableForStudentSelection"
          ? !project.availableForStudentSelection
          : project.availableForStudentSelection,
      });
      setProject(updated);
      toast.success("Project visibility updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update project visibility");
    }
  };

  const approveProject = async () => {
    if (!project) return;
    try {
      const updated = await api.post<EnterpriseProject>(`/api/projects/${id}/approve`);
      setProject(updated);
      toast.success("Project approved for student access");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve project");
    }
  };

  const submitStudentRating = async () => {
    const value = Number(studentRating);
    if (!project?.studentId || !Number.isFinite(value) || value < 0 || value > 10) {
      toast.error("Student rating must be between 0 and 10");
      return;
    }
    try {
      const saved = await api.patch<number>(`/api/admin/students/${project.studentId}/rating`, { rating: value });
      setProject((current) => current ? { ...current, studentRating: saved } : current);
      setStudentRating("");
      toast.success("Student rating saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save student rating");
    }
  };

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading project…</div>;
  }
  if (!project) {
    return <div className="flex flex-1 items-center justify-center p-8 text-sm text-red-600">{error || "Project not found."}</div>;
  }

  const technologies = project.tech ?? [];
  const findings = project.keyFindings ?? [];
  const assets = project.assets ?? [];
  const projectDomains = project.domain?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
  const internFirstName = project.internName?.split(" ")[0] || "Unknown";
  const isProjectOwner = session?.role === "supervisor"
    && project.supervisorId === session.id;
  const hasDirectResourceAccess = session?.role === "admin" || isProjectOwner;
  const isSupervisor = session?.role === "supervisor";
  const hasReportAccess = hasDirectResourceAccess || isSupervisor || accessStatuses.report === "approved";
  const reportExists = assets.some((asset) => asset.type === "report");

  return (
    <PageTransition>
      <div className="shrink-0 border-b border-[#E5E7EB] bg-white px-4 py-5 sm:px-6 lg:px-8 dark:border-border dark:bg-card">
        <button onClick={() => router.push("/projects")} className="mb-4 flex items-center gap-2 text-sm text-muted transition-colors hover:text-charcoal">
          <ArrowLeft className="h-4 w-4" /> Back to Project Library
        </button>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {(projectDomains.length ? projectDomains : ["General"]).map((domain) => (
                <span key={domain} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={domainColors[domain] ?? { backgroundColor: "#F3F4F6", color: "#374151" }}>{domain}</span>
              ))}
              <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                <Star className="h-3 w-3 fill-current" /> {project.supervisorRating == null ? "No rating" : `${project.supervisorRating}/10`}
              </span>
              <span className="text-xs text-muted">{project.year || "Year not specified"}</span>
            </div>
            <h1 className="text-xl font-semibold text-charcoal">{project.title}</h1>
            <p className="mt-1 text-sm text-muted">{project.internName || "Unknown intern"} · Supervisor: {project.supervisorName || "Not assigned"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.hasCode && <ResourcePill icon={Code2} label="Source code" />}
            {project.hasReport && <ResourcePill icon={FileText} label="PDF report" />}
            {project.hasVideo && <ResourcePill icon={Film} label="Demo video" />}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 dark:bg-background">
          <div className="mx-auto max-w-6xl space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Metric label="Completion" value={`${project.completionRate}%`} icon={TrendingUp} color="#10B981" background="#E6F4EA" />
            <Metric label="Average rating" value={project.supervisorRating == null ? "Not rated" : `${project.supervisorRating}/10 (${project.ratingCount})`} icon={Star} color="#D97706" background="#FEF3C7" />
            <Metric label="Intern" value={internFirstName} icon={Users} color="#111827" background="#F3F4F6" />
            <Metric label="Year" value={project.year || "N/A"} icon={Calendar} color="#4F46E5" background="#EEF2FF" />
          </div>

          <section className="app-card p-5 sm:p-6">
            <h2 className="mb-3 font-semibold text-charcoal">Project Overview</h2>
            <p className="text-sm leading-relaxed text-muted">{project.description || "No description provided."}</p>
          </section>

          {session?.role === "admin" && (
            <section className="app-card p-5 sm:p-6">
              <h2 className="font-semibold text-charcoal">Admin publication controls</h2>
              <p className="mt-1 text-sm text-muted">Approval grants student access only. Publishing to the shared Project Library is a separate action in the Admin Projects table.</p>
              {!project.availableForStudentSelection ? (
                <button type="button" onClick={() => void approveProject()} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
                  Approve project
                </button>
              ) : (
                <p className="mt-4 inline-flex rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Approved for student access</p>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-xl border p-4 ${project.availableForStudentSelection ? "border-emerald-200 bg-emerald-50" : "border-border bg-grey-50"}`}>
                  <p className="font-semibold text-charcoal">Student access</p>
                  <p className="mt-1 text-sm text-muted">{project.availableForStudentSelection ? "Approved for the assigned student or student selection" : "Awaiting admin approval"}</p>
                </div>
                <div className={`rounded-xl border p-4 ${project.visibleInLibrary ? "border-emerald-200 bg-emerald-50" : "border-border bg-grey-50"}`}>
                  <p className="font-semibold text-charcoal">Project Library</p>
                  <p className="mt-1 text-sm text-muted">{project.visibleInLibrary ? "Published to all library users" : "Use Publish in the Admin Projects table"}</p>
                </div>
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="app-card p-5 sm:p-6">
              <h2 className="mb-4 font-semibold text-charcoal">Key Findings</h2>
              {findings.length ? (
                <ul className="space-y-3">
                  {findings.map((finding, index) => (
                    <li key={`${finding}-${index}`} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-grey-100 text-[10px] font-bold text-charcoal">{index + 1}</span>
                      <span className="text-sm text-muted">{finding}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No key findings recorded.</p>}
            </section>

            <section className="app-card p-5 sm:p-6">
              <h2 className="mb-3 font-semibold text-charcoal">Result</h2>
              <p className="mb-4 text-sm leading-relaxed text-muted">{project.results || "No results recorded."}</p>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-grey-200">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, project.completionRate))}%` }} />
                </div>
                <span className="shrink-0 text-sm font-semibold text-emerald-600">{project.completionRate}%</span>
              </div>
              <p className="mt-1 text-xs text-muted">Project completion</p>
            </section>
          </div>

          <section className="app-card p-5 sm:p-6">
            <h2 className="mb-3 font-semibold text-charcoal">Methodology</h2>
            <p className="text-sm leading-relaxed text-muted">{project.methodology || "No methodology recorded."}</p>
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="app-card p-5 sm:p-6">
              <h2 className="mb-3 font-semibold text-charcoal">Technology Stack</h2>
              <div className="flex flex-wrap gap-2">
                {technologies.length ? technologies.map((technology) => (
                  <span key={technology} className="rounded-lg border border-border bg-grey-100 px-3.5 py-1.5 text-sm font-medium text-charcoal">{technology}</span>
                )) : <p className="text-sm text-muted">No technologies recorded.</p>}
              </div>
            </section>

            {(session?.role === "supervisor" || session?.role === "admin") && (
              <section className="app-card p-5 sm:p-6">
                <h2 className="mb-3 font-semibold text-charcoal">Rate this Project</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="number" min="0" max="10" step="0.5" value={rating} onChange={(event) => setRating(event.target.value)} placeholder="Note / 10" className="input-field w-28" />
                  <button onClick={submitRating} className="btn-primary">Submit Rating</button>
                </div>
              </section>
            )}
            {session?.role === "admin" && (
              <section className="app-card p-5 sm:p-6">
                <h2 className="mb-3 font-semibold text-charcoal">Rate Student</h2>
                {project.studentId ? <>
                  <p className="mb-3 text-sm text-muted">{project.studentName || "Assigned student"}{project.studentRating == null ? " has not been rated yet." : `: ${project.studentRating}/10`}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="number" min="0" max="10" step="0.5" value={studentRating} onChange={(event) => setStudentRating(event.target.value)} placeholder="Note / 10" className="input-field w-28" />
                    <button onClick={submitStudentRating} className="btn-primary">Save Student Rating</button>
                  </div>
                </> : <p className="text-sm text-muted">A student can be rated after they are assigned to this project.</p>}
              </section>
            )}
          </div>

          <section className="app-card p-5 sm:p-6">
            <h2 className="font-semibold text-charcoal">Available Resources</h2>
            <p className="mb-4 mt-1 text-xs text-muted">Download the files uploaded by the administrator for this project.</p>
            {assets.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    status={hasDirectResourceAccess || (isSupervisor && (asset.type === "report" || asset.type === "video")) ? "approved" : accessStatuses[asset.type]}
                    onDownload={() => downloadAsset(asset)}
                    onView={() => viewPdf(asset)}
                    onRequest={() => requestAccess(asset.type as "report" | "code" | "video")}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-grey-50 p-4 text-sm text-muted">No files have been uploaded for this project.</div>
            )}
          </section>
          </div>
        </div>

        <aside className="flex h-[430px] shrink-0 flex-col border-t border-border bg-white xl:h-auto xl:w-80 xl:border-l xl:border-t-0 dark:bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-grey-100 to-white px-5 py-4 dark:from-grey-100 dark:to-card">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-charcoal"><Sparkles className="h-4 w-4 text-white" /></span>
            <div><p className="text-sm font-semibold text-charcoal">Ask AI</p><p className="text-xs text-muted">Explore this project</p></div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!reportExists ? <div className="py-6 text-center"><FileText className="mx-auto mb-2 h-8 w-8 text-muted-light" /><p className="text-xs leading-relaxed text-muted">This project has no PDF report to analyse yet.</p></div>
              : !hasReportAccess ? <div className="py-6 text-center"><Lock className="mx-auto mb-2 h-8 w-8 text-muted-light" /><p className="text-xs leading-relaxed text-muted">Report access is required before AI can answer from this project’s report.</p><button onClick={() => requestAccess("report")} disabled={accessStatuses.report === "pending"} className="btn-secondary mt-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60">{accessStatuses.report === "pending" ? "Request pending" : "Request report access"}</button></div>
              : aiMessages.length === 0 && <div className="py-6 text-center"><Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-light" /><p className="text-xs leading-relaxed text-muted">Ask questions about this project and its approved report.</p></div>}
            {aiMessages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${message.role === "user" ? "bg-charcoal text-white" : "border border-border bg-grey-100 text-charcoal"}`}><p className="whitespace-pre-line">{message.text}</p>{message.sources?.length ? <p className="mt-2 text-[10px] text-muted">Source: {message.sources.join(", ")}</p> : null}</div>
              </div>
            ))}
            <div ref={aiBottom} />
          </div>
          <div className="space-y-2.5 border-t border-border p-3">
            {["Summarize the project", "What is the tech stack?", "Key findings & results"].map((prompt) => (
              <button key={prompt} onClick={() => void askProject(prompt)} disabled={!hasReportAccess || !reportExists || askingProject} className="group flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-xs text-charcoal-soft hover:border-charcoal disabled:cursor-not-allowed disabled:opacity-50">
                {prompt}<ChevronRight className="h-3 w-3 text-muted group-hover:text-charcoal" />
              </button>
            ))}
            <div className="flex gap-1.5">
              <input value={aiInput} disabled={!hasReportAccess || !reportExists || askingProject} onChange={(event) => setAiInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void askProject()} placeholder={hasReportAccess ? "Ask about this project…" : "Request report access first"} className="input-field py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60" />
              <button onClick={() => void askProject()} disabled={!hasReportAccess || !reportExists || askingProject || !aiInput.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-charcoal text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </aside>
      </div>

      {pdfUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-charcoal"><FileText className="h-4 w-4" /> Project PDF</p>
              <button onClick={() => { URL.revokeObjectURL(pdfUrl); setPdfUrl(""); }} className="rounded-lg p-2 text-muted hover:bg-grey-100 hover:text-charcoal"><X className="h-4 w-4" /></button>
            </div>
            <iframe src={pdfUrl} title="Project PDF" className="h-full w-full" />
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function Metric({ label, value, icon: Icon, color, background }: {
  label: string; value: string; icon: typeof TrendingUp; color: string; background: string;
}) {
  return (
    <div className="app-card p-4 sm:p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: background }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <p className="truncate text-base font-bold text-charcoal sm:text-lg">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function ResourcePill({ icon: Icon, label }: { icon: typeof Code2; label: string }) {
  return <span className="flex items-center gap-1 rounded-full border border-border bg-grey-100 px-2.5 py-1 text-xs font-medium text-charcoal-soft"><Icon className="h-3 w-3" />{label}</span>;
}

function AssetCard({ asset, status, onDownload, onView, onRequest }: {
  asset: ProjectAsset;
  status?: string;
  onDownload: () => void;
  onView: () => void;
  onRequest: () => void;
}) {
  const Icon = asset.type === "report" ? FileText : asset.type === "video" ? Film : Code2;
  const label = asset.type === "report" ? "PDF Report" : asset.type === "video" ? "Demo Video" : "Source Code";
  const approved = status === "approved";
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-charcoal/30 hover:shadow-sm">
      <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-grey-100"><Icon className="h-5 w-5 text-charcoal" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-medium text-charcoal">{asset.name}</span>
        <span className="block text-xs text-muted">{(asset.size / 1024 / 1024).toFixed(1)} MB</span>
      </span>
      {!approved && <Lock className="h-4 w-4 shrink-0 text-muted" />}
      </div>
      {approved && asset.type === "report" ? (
        <div className="flex gap-2">
          <button onClick={onView} className="btn-secondary flex-1 py-2 text-xs"><ExternalLink className="h-3.5 w-3.5" />View PDF</button>
          <button onClick={onDownload} className="btn-primary flex-1 py-2 text-xs"><Download className="h-3.5 w-3.5" />Download</button>
        </div>
      ) : approved ? (
        <button onClick={onDownload} className="btn-primary w-full py-2 text-xs"><Download className="h-3.5 w-3.5" />Download</button>
      ) : (
        <button onClick={onRequest} disabled={status === "pending"} className="btn-secondary w-full py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60">
          <Lock className="h-3.5 w-3.5" />{status === "pending" ? "Request pending" : "Request access"}
        </button>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  return <RoleGuard allowedRoles={["student", "supervisor", "admin"]}><ProjectDetailContent /></RoleGuard>;
}

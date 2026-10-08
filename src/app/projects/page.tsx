"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Code2, FileText, Film, Filter, Plus, Search, Star, X } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { PageTransition } from "@/components/PageTransition";
import { api } from "@/lib/api";
import { getLoggedInUser } from "@/lib/auth";
import { toast } from "sonner";

export interface EnterpriseProject {
  id: number;
  title: string;
  description: string | null;
  domain: string | null;
  year: string | null;
  internName: string | null;
  supervisorName: string | null;
  supervisorId: number | null;
  supervisorAxis: string | null;
  impact: string;
  completionRate: number;
  methodology: string | null;
  results: string | null;
  hasCode: boolean;
  hasReport: boolean;
  hasVideo: boolean;
  tech: string[];
  keyFindings: string[];
  supervisorRating: number | null;
  ratingCount: number;
  assets: ProjectAsset[];
  visibleInLibrary: boolean;
  availableForStudentSelection: boolean;
  studentId: number | null;
  studentName: string | null;
  studentRating: number | null;
}

export interface ProjectAsset {
  id: number;
  type: "report" | "code" | "video";
  name: string;
  contentType: string | null;
  size: number;
  uploadedAt: string;
}

interface SupervisorOption {
  id: number;
  name: string;
  post: string | null;
  axis: string | null;
}

const emptyProjectForm = {
  title: "",
  description: "",
  domain: "",
  year: String(new Date().getFullYear()),
  internName: "",
  supervisorId: "",
  completionRate: "0",
};

const CENTRE_OF_EXCELLENCE_AXES = [
  "AI Centre of Excellence",
  "Industry 4.0 Centre of Excellence",
] as const;

const domainColors: Record<string, { bg: string; text: string }> = {
  "Machine Learning": { bg: "#EEF2FF", text: "#4338CA" },
  "Web Development": { bg: "#F0F9FF", text: "#0369A1" },
  "Full-Stack": { bg: "#ECFDF5", text: "#047857" },
  "NLP / AI": { bg: "#FFFBEB", text: "#B45309" },
  "Mobile": { bg: "#FDF4FF", text: "#A21CAF" },
  "DevOps / Cloud": { bg: "#FFF7ED", text: "#C2410C" },
  "Blockchain": { bg: "#F0F9FF", text: "#0369A1" },
};

const ratingColor = (rating: number | null) => {
  if (rating == null) return "bg-[#F3F4F6] text-[#374151]";
  if (rating >= 8.5) return "border border-[#FEE2E2] bg-[#FEF2F2] text-[#991B1B]";
  if (rating >= 7) return "border border-[#FEF3C7] bg-[#FFFBEB] text-[#92400E]";
  return "bg-[#F3F4F6] text-[#374151]";
};

function ProjectLibraryContent() {
  const router = useRouter();
  const [projects, setProjects] = useState<EnterpriseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("All");
  const [axis, setAxis] = useState("All");
  const [year, setYear] = useState("All");
  const [isAdmin, setIsAdmin] = useState(false);
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [projectFiles, setProjectFiles] = useState<{ report: File | null; code: File | null; video: File | null }>({ report: null, code: null, video: null });

  useEffect(() => {
    const role = getLoggedInUser()?.role;
    setIsAdmin(role === "admin");
    setCanCreateProject(role === "admin" || role === "supervisor");
  }, []);

  useEffect(() => {
    api.get<EnterpriseProject[]>("/api/projects")
      .then(setProjects)
      .catch(() => setError("Could not load projects."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api.get<SupervisorOption[]>("/api/auth/supervisors")
      .then(setSupervisors)
      .catch(() => toast.error("Could not load active supervisors"));
  }, [isAdmin]);

  const closeCreateProject = () => {
    setShowCreateProject(false);
    setProjectForm(emptyProjectForm);
    setProjectFiles({ report: null, code: null, video: null });
  };

  const createProject = async () => {
    if (!projectForm.title.trim() || !projectForm.domain.trim() || !projectForm.supervisorId) {
      toast.error("Enter a project title, domain, and active supervisor");
      return;
    }
    setCreatingProject(true);
    try {
      const created = await api.post<EnterpriseProject>("/api/projects", {
        title: projectForm.title.trim(),
        description: projectForm.description.trim() || null,
        domain: projectForm.domain.trim(),
        year: projectForm.year.trim() || null,
        internName: projectForm.internName.trim() || null,
        supervisorId: Number(projectForm.supervisorId),
        impact: "Medium",
        completionRate: Number(projectForm.completionRate) || 0,
        methodology: null,
        results: null,
        hasReport: !!projectFiles.report,
        hasCode: !!projectFiles.code,
        hasVideo: !!projectFiles.video,
        tech: [],
        keyFindings: [],
      });
      const assets: ProjectAsset[] = [];
      for (const type of ["report", "code", "video"] as const) {
        const file = projectFiles[type];
        if (!file) continue;
        const data = new FormData();
        data.append("type", type);
        data.append("file", file);
        assets.push(await api.post<ProjectAsset>(`/api/projects/${created.id}/assets`, data));
      }
      setProjects((current) => [{ ...created, assets }, ...current]);
      closeCreateProject();
      toast.success("Project added to the library");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create project");
    } finally {
      setCreatingProject(false);
    }
  };

  const domains = useMemo(
    () => ["All", ...Array.from(new Set(projects.flatMap((project) => project.domain?.split(",").map((item) => item.trim()).filter(Boolean) ?? [])))],
    [projects],
  );
  const years = useMemo(
    () => ["All", ...Array.from(new Set(projects.map((project) => project.year).filter(Boolean) as string[])).sort().reverse()],
    [projects],
  );
  const axes = ["All", ...CENTRE_OF_EXCELLENCE_AXES];
  const filtered = useMemo(() => projects.filter((project) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      project.title, project.internName, project.supervisorName, ...(project.tech ?? []),
    ].some((value) => value?.toLowerCase().includes(query));
    return matchesSearch
      && (domain === "All" || project.domain?.split(",").map((item) => item.trim()).includes(domain))
      && (axis === "All" || project.supervisorAxis === axis)
      && (year === "All" || project.year === year);
  }), [projects, search, domain, axis, year]);

  return (
    <PageTransition>
      <div className="shrink-0 border-b border-[#E5E7EB] bg-white px-4 py-5 sm:px-6 lg:px-8 dark:border-border dark:bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-charcoal">Project Library</h1>
            <p className="mt-0.5 text-sm text-muted">{projects.length} internship project{projects.length === 1 ? "" : "s"} from this enterprise</p>
          </div>
          {canCreateProject && <button onClick={() => router.push("/projects/new")} className="inline-flex items-center gap-2 rounded-lg bg-charcoal px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-charcoal-soft"><Plus className="h-4 w-4" />Add project</button>}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-light" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, intern, or technology…" className="input-field pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-light" />
            <div className="flex max-w-full flex-wrap gap-1">
              {domains.map((item) => (
                <button key={item} onClick={() => setDomain(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${domain === item ? "bg-charcoal text-white" : "border border-border text-muted hover:border-charcoal hover:text-charcoal"}`}>
                  {item}
                </button>
              ))}
            </div>
            <select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted outline-none dark:bg-card">
              {years.map((item) => <option key={item} value={item}>{item === "All" ? "All years" : item}</option>)}
            </select>
            <select value={axis} onChange={(event) => setAxis(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted outline-none dark:bg-card">
              {axes.map((item) => <option key={item} value={item}>{item === "All" ? "All axes" : item}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {loading ? <p className="text-sm text-muted">Loading projects…</p>
          : error ? <p className="text-sm text-red-600">{error}</p>
          : filtered.length === 0 ? <div className="flex h-64 items-center justify-center text-sm text-muted">No projects match your search.</div>
          : (
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-2">
              {filtered.map((project) => {
                const projectDomains = project.domain?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
                const rating = project.supervisorRating;
                const technologies = project.tech ?? [];
                return (
                  <button key={project.id} onClick={() => router.push(`/projects/${project.id}`)} className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] dark:border-border dark:bg-card">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-400/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        {(projectDomains.length ? projectDomains : ["General"]).slice(0, 2).map((item) => {
                          const colors = domainColors[item] ?? { bg: "#F3F4F6", text: "#374151" };
                          return <span key={item} className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: colors.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.text }} />{item}</span>;
                        })}
                        {projectDomains.length > 2 && <span className="text-[11px] text-muted">+{projectDomains.length - 2}</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-light">
                        <span className="flex items-center font-semibold text-charcoal-soft">
                          <Star className={`mr-1 h-3 w-3 ${rating != null ? "fill-current text-amber-500" : ""}`} />
                          {rating == null ? "No rating" : `${rating}/10`}
                        </span>
                        <span className="text-xs text-muted-light">{project.year || "—"}</span>
                      </div>
                    </div>

                    <h3 className="mb-3 text-lg font-semibold leading-snug tracking-tight text-charcoal">{project.title}</h3>
                    <p className="mb-6 line-clamp-3 flex-1 text-sm leading-6 text-muted">{project.description || "No description provided."}</p>

                    <div className="mb-5">
                      <div className="mb-2 flex justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-light">Project progress</span>
                        <span className="text-xs font-semibold text-emerald-600">{project.completionRate}%</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-grey-200">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, project.completionRate))}%` }} />
                      </div>
                    </div>

                    <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      {technologies.slice(0, 5).map((technology, index) => <span key={technology} className="flex items-center gap-2">{index > 0 && <span className="text-slate-300">/</span>}{technology}</span>)}
                      {technologies.length > 5 && <span className="text-muted-light">+{technologies.length - 5}</span>}
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-charcoal-soft">{project.internName || "Unknown intern"}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-light">Supervised by {project.supervisorName || "Not assigned"}</p>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-2 text-muted">
                        {project.hasCode && <Code2 className="h-4 w-4" />}
                        {project.hasReport && <FileText className="h-4 w-4" />}
                        {project.hasVideo && <Film className="h-4 w-4" />}
                        <ArrowRight className="ml-1 h-4 w-4 transition-colors group-hover:text-charcoal" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
      </div>

      {showCreateProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Add project">
          <form onSubmit={(event) => { event.preventDefault(); void createProject(); }} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-semibold text-charcoal">Add project</h2><p className="mt-1 text-sm text-muted">Create a library project and optionally upload its protected files.</p></div>
              <button type="button" onClick={closeCreateProject} aria-label="Close" className="rounded-lg p-2 text-muted hover:bg-grey-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-medium text-charcoal">Project title<input required value={projectForm.title} onChange={(event) => setProjectForm((form) => ({ ...form, title: event.target.value }))} className="input-field mt-1" /></label>
              <label className="sm:col-span-2 text-sm font-medium text-charcoal">Description<textarea value={projectForm.description} onChange={(event) => setProjectForm((form) => ({ ...form, description: event.target.value }))} rows={3} className="input-field mt-1 resize-y" /></label>
              <label className="text-sm font-medium text-charcoal">Domain<input required value={projectForm.domain} onChange={(event) => setProjectForm((form) => ({ ...form, domain: event.target.value }))} placeholder="e.g. Web Development" className="input-field mt-1" /></label>
              <label className="text-sm font-medium text-charcoal">Year<input value={projectForm.year} onChange={(event) => setProjectForm((form) => ({ ...form, year: event.target.value }))} className="input-field mt-1" /></label>
              <label className="text-sm font-medium text-charcoal">Student name (optional)<input value={projectForm.internName} onChange={(event) => setProjectForm((form) => ({ ...form, internName: event.target.value }))} className="input-field mt-1" /></label>
              <label className="text-sm font-medium text-charcoal">Supervisor<select required value={projectForm.supervisorId} onChange={(event) => setProjectForm((form) => ({ ...form, supervisorId: event.target.value }))} className="input-field mt-1"><option value="">Select an active supervisor</option>{supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}{supervisor.post ? ` · ${supervisor.post}` : ""}{supervisor.axis ? ` · ${supervisor.axis}` : ""}</option>)}</select></label>
              <label className="text-sm font-medium text-charcoal">Completion (%)<input type="number" min="0" max="100" value={projectForm.completionRate} onChange={(event) => setProjectForm((form) => ({ ...form, completionRate: event.target.value }))} className="input-field mt-1" /></label>
              <label className="text-sm font-medium text-charcoal">Report (PDF, DOCX, TXT, CSV, or ZIP)<input type="file" accept=".pdf,.docx,.txt,.csv,.zip" onChange={(event) => setProjectFiles((files) => ({ ...files, report: event.target.files?.[0] ?? null }))} className="mt-1 block w-full text-xs text-muted" /></label>
              <label className="text-sm font-medium text-charcoal">Source code (ZIP or source file)<input type="file" accept=".zip,.java,.kt,.py,.js,.jsx,.ts,.tsx,.css,.json,.md,.sql,.xml,.yml,.yaml" onChange={(event) => setProjectFiles((files) => ({ ...files, code: event.target.files?.[0] ?? null }))} className="mt-1 block w-full text-xs text-muted" /></label>
              <label className="text-sm font-medium text-charcoal">Demo video<input type="file" accept="video/*" onChange={(event) => setProjectFiles((files) => ({ ...files, video: event.target.files?.[0] ?? null }))} className="mt-1 block w-full text-xs text-muted" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeCreateProject} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-grey-100">Cancel</button><button disabled={creatingProject} className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{creatingProject ? "Adding project…" : "Add project"}</button></div>
          </form>
        </div>
      )}
    </PageTransition>
  );
}

export default function ProjectLibrary() {
  return <RoleGuard allowedRoles={["student", "supervisor", "admin"]}><ProjectLibraryContent /></RoleGuard>;
}

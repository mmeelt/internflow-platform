"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen, Check, FileCode2, Film, Plus, X } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { PageTransition } from "@/components/PageTransition";
import { api } from "@/lib/api";
import { getLoggedInUser } from "@/lib/auth";
import { toast } from "sonner";

type Supervisor = { id: number; name: string; post: string | null; axis: string | null };
type User = { id: number; name: string; email: string; role: string };
type Project = { id: number };

const DOMAINS = ["Machine Learning", "Web Development", "Full-Stack", "NLP / AI", "Mobile", "DevOps / Cloud", "Cybersecurity", "Blockchain", "Data Engineering", "Computer Vision", "IoT / Embedded"];
const TECHNOLOGIES = ["Python", "Java", "Spring Boot", "React", "Next.js", "Node.js", "TypeScript", "PostgreSQL", "MongoDB", "Docker", "AWS", "PyTorch", "TensorFlow", "FastAPI", "Flutter", "Redis"];
const initialForm = { title: "", description: "", year: String(new Date().getFullYear()), internName: "", internId: "", invitedStudentName: "", invitedStudentEmail: "", supervisorId: "", invitedSupervisorName: "", invitedSupervisorEmail: "", completionRate: "0", methodology: "", results: "", keyFindings: "", hasCode: false, hasReport: false, hasVideo: false };
const MAX_UPLOAD_BYTES = 350 * 1024 * 1024;

function AddProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStudentId = searchParams.get("studentId");
  const currentUser = getLoggedInUser();
  const creatingAsSupervisor = currentUser?.role === "supervisor";
  const [form, setForm] = useState(initialForm);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [customDomain, setCustomDomain] = useState("");
  const [customTechnology, setCustomTechnology] = useState("");
  const [files, setFiles] = useState<{ report: File | null; code: File | null; video: File | null }>({ report: null, code: null, video: null });
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      api.get<Supervisor[]>("/api/auth/supervisors"),
      api.get<User[]>("/api/projects/assignees/students"),
    ])
      .then(([supervisorResult, studentResult]) => {
        if (supervisorResult.status === "fulfilled") {
          setSupervisors(supervisorResult.value);
          if (creatingAsSupervisor) {
            const currentSupervisor = supervisorResult.value.find((supervisor) => supervisor.id === currentUser?.id);
            if (currentSupervisor) {
              setForm((current) => ({ ...current, supervisorId: String(currentSupervisor.id) }));
            }
          }
        } else {
          toast.error("Could not load active supervisors. Please refresh and try again.");
        }
        if (studentResult.status === "fulfilled") {
          setStudents(studentResult.value);
          const requestedStudent = requestedStudentId
            ? studentResult.value.find((student) => student.id === Number(requestedStudentId))
            : undefined;
          if (requestedStudent) {
            setForm((current) => ({
              ...current,
              internName: requestedStudent.name,
              internId: String(requestedStudent.id),
              invitedStudentName: "",
              invitedStudentEmail: "",
            }));
          }
        } else {
          toast.error("Could not load registered students.");
        }
      })
      .finally(() => setLoadingPeople(false));
  }, [creatingAsSupervisor, currentUser?.id, requestedStudentId]);

  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => setValues(values.some((item) => item.toLowerCase() === value.toLowerCase()) ? values.filter((item) => item.toLowerCase() !== value.toLowerCase()) : [...values, value]);
  const addValue = (value: string, values: string[], setValues: (next: string[]) => void, clear: () => void) => {
    const cleaned = value.trim();
    if (cleaned && !values.some((item) => item.toLowerCase() === cleaned.toLowerCase())) setValues([...values, cleaned]);
    clear();
  };

  const saveProject = async () => {
    if (!form.title.trim() || !domains.length || (!form.supervisorId && !(form.invitedSupervisorName.trim() && form.invitedSupervisorEmail.trim()))) {
      toast.error("Add a title, at least one domain, and a supervisor.");
      return;
    }
    const oversizedFile = Object.values(files).find((file) => file && file.size > MAX_UPLOAD_BYTES);
    if (oversizedFile) {
      toast.error(`${oversizedFile.name} is larger than the 350 MB upload limit.`);
      return;
    }
    setSaving(true);
    try {
      const project = await api.post<Project>("/api/projects", {
        title: form.title.trim(), description: form.description.trim() || null, domain: domains.join(", "),
        year: form.year.trim() || null, internName: form.internName || null, internId: form.internId ? Number(form.internId) : null,
        invitedStudentName: form.invitedStudentName.trim() || null, invitedStudentEmail: form.invitedStudentEmail.trim() || null,
        supervisorId: form.supervisorId ? Number(form.supervisorId) : null,
        invitedSupervisorName: form.invitedSupervisorName.trim() || null, invitedSupervisorEmail: form.invitedSupervisorEmail.trim() || null,
        impact: "Medium", completionRate: Math.max(0, Math.min(100, Number(form.completionRate) || 0)),
        methodology: form.methodology.trim() || null, results: form.results.trim() || null,
        hasReport: form.hasReport || !!files.report, hasCode: form.hasCode || !!files.code, hasVideo: form.hasVideo || !!files.video,
        tech: technologies, keyFindings: form.keyFindings.split("\n").map((item) => item.trim()).filter(Boolean),
      });
      for (const type of ["report", "code", "video"] as const) {
        const file = files[type];
        if (!file) continue;
        const payload = new FormData();
        payload.append("type", type);
        payload.append("file", file);
        await api.post(`/api/projects/${project.id}/assets`, payload);
      }
      toast.success("Project created. An administrator can now choose its visibility.");
      router.replace("/projects");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish the project.");
    } finally { setSaving(false); }
  };

  const inputFileClass = "block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-charcoal file:px-3 file:py-2 file:font-medium file:text-white hover:file:bg-charcoal-soft";
  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs transition-all ${active ? "border-charcoal bg-charcoal text-white" : "border-border bg-white text-muted hover:border-charcoal hover:text-charcoal"}`;

  return <PageTransition>
    <header className="border-b border-[#E5E7EB] bg-white px-4 py-5 sm:px-6 lg:px-8 dark:border-border dark:bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><button type="button" onClick={() => router.push("/projects")} className="mt-0.5 rounded-lg p-2 text-muted transition-colors hover:bg-grey-100 hover:text-charcoal" aria-label="Back to project library"><ArrowLeft className="h-5 w-5" /></button><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Project library</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-charcoal">Add a complete project</h1><p className="mt-1 text-sm text-muted">Create the project record, link registered people, and upload its deliverables.</p></div></div>
        <span className="w-fit rounded-full bg-grey-100 px-3 py-1.5 text-xs font-semibold text-charcoal">Project assignment</span>
      </div>
    </header>
    <main className="flex-1 overflow-auto bg-[#FAFAF9] px-4 py-6 sm:px-6 lg:px-8 dark:bg-background">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="app-card overflow-hidden"><div className="border-b border-border bg-charcoal px-5 py-5 text-white sm:px-6"><h2 className="text-lg font-semibold">Project information</h2><p className="mt-1 text-sm text-white/70">Fields marked with an asterisk are required to publish the project.</p></div><div className="space-y-5 p-5 sm:p-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-muted md:col-span-2">Project title *<input value={form.title} onChange={(event) => update("title", event.target.value)} className="input-field mt-1.5" placeholder="Customer Churn Prediction System" /></label>
          <div className="text-xs font-semibold text-muted md:col-span-2"><span>Domains *</span><div className="mt-2 flex flex-wrap gap-2">{DOMAINS.map((item) => { const active = domains.includes(item); return <button key={item} type="button" onClick={() => toggle(item, domains, setDomains)} className={chip(active)}>{active && <Check className="mr-1 inline h-3 w-3" />}{item}</button>; })}</div><div className="mt-3 flex gap-2"><input value={customDomain} onChange={(event) => setCustomDomain(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addValue(customDomain, domains, setDomains, () => setCustomDomain("")); } }} className="input-field" placeholder="Add another domain" /><button type="button" onClick={() => addValue(customDomain, domains, setDomains, () => setCustomDomain(""))} className="btn-secondary shrink-0"><Plus className="h-4 w-4" />Add</button></div>{domains.length > 0 && <p className="mt-2 font-normal text-emerald-700">Selected: {domains.join(", ")}</p>}</div>
          <label className="text-xs font-semibold text-muted">Academic year<input value={form.year} onChange={(event) => update("year", event.target.value)} className="input-field mt-1.5" placeholder="2026" /></label>
          <label className="text-xs font-semibold text-muted">Student (optional)<select value={form.internName} onChange={(event) => { const student = students.find((item) => item.name === event.target.value); setForm((current) => ({ ...current, internName: student?.name || "", internId: student ? String(student.id) : "", invitedStudentName: "", invitedStudentEmail: "" })); }} disabled={loadingPeople} className="input-field mt-1.5 disabled:opacity-60"><option value="">{loadingPeople ? "Loading registered students…" : "Choose student"}</option>{students.map((student) => <option key={student.id} value={student.name}>{student.name} · {student.email}</option>)}</select></label><div className="rounded-xl border border-dashed border-border bg-grey-50 p-3 text-xs font-semibold text-muted">Add a new student<p className="mt-1 font-normal">Not listed? Save the assignment to their email. They can register normally later.</p><div className="mt-2 grid grid-cols-2 gap-2"><input value={form.invitedStudentName} onChange={(event) => update("invitedStudentName", event.target.value)} className="input-field" placeholder="First and last name" /><input type="email" value={form.invitedStudentEmail} onChange={(event) => update("invitedStudentEmail", event.target.value)} className="input-field" placeholder="Email address" /></div></div><label className="text-xs font-semibold text-muted">Supervisor *<select value={form.supervisorId} onChange={(event) => setForm((current) => ({ ...current, supervisorId: event.target.value, invitedSupervisorName: "", invitedSupervisorEmail: "" }))} disabled={loadingPeople} className="input-field mt-1.5 disabled:opacity-60"><option value="">{loadingPeople ? "Loading active supervisors…" : "Choose supervisor"}</option>{supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}{supervisor.post ? ` · ${supervisor.post}` : ""}{supervisor.axis ? ` · ${supervisor.axis}` : ""}</option>)}</select></label><div className="rounded-xl border border-dashed border-border bg-grey-50 p-3 text-xs font-semibold text-muted">Add a new supervisor<p className="mt-1 font-normal">Not listed? Save the assignment to their email. They can register normally later.</p><div className="mt-2 grid grid-cols-2 gap-2"><input value={form.invitedSupervisorName} onChange={(event) => update("invitedSupervisorName", event.target.value)} className="input-field" placeholder="First and last name" /><input type="email" value={form.invitedSupervisorEmail} onChange={(event) => update("invitedSupervisorEmail", event.target.value)} className="input-field" placeholder="Email address" /></div></div>
          <label className="text-xs font-semibold text-muted">Completion rate (%)<input type="number" min="0" max="100" value={form.completionRate} onChange={(event) => update("completionRate", event.target.value)} className="input-field mt-1.5" /></label><div />
          <label className="text-xs font-semibold text-muted md:col-span-2">Description<textarea value={form.description} onChange={(event) => update("description", event.target.value)} className="input-field mt-1.5 min-h-28 resize-y" placeholder="Explain the problem, objective, and solution delivered by this project…" /></label>
        </div></div></section>

        <section className="app-card p-5 sm:p-6"><h2 className="text-lg font-semibold text-charcoal">Implementation and outcomes</h2><p className="mt-1 text-sm text-muted">These details make the library useful for future students and supervisors.</p><div className="mt-5 space-y-5"><div className="text-xs font-semibold text-muted"><span>Technology stack</span><div className="mt-2 flex flex-wrap gap-2">{TECHNOLOGIES.map((item) => { const active = technologies.includes(item); return <button key={item} type="button" onClick={() => toggle(item, technologies, setTechnologies)} className={chip(active)}>{active && <Check className="mr-1 inline h-3 w-3" />}{item}</button>; })}</div><div className="mt-3 flex gap-2"><input value={customTechnology} onChange={(event) => setCustomTechnology(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addValue(customTechnology, technologies, setTechnologies, () => setCustomTechnology("")); } }} className="input-field" placeholder="Add another technology" /><button type="button" onClick={() => addValue(customTechnology, technologies, setTechnologies, () => setCustomTechnology(""))} className="btn-secondary shrink-0"><Plus className="h-4 w-4" />Add</button></div>{technologies.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{technologies.map((item) => <button key={item} type="button" onClick={() => toggle(item, technologies, setTechnologies)} className="rounded-md bg-grey-100 px-2.5 py-1.5 font-medium text-charcoal">{item} <X className="inline h-3.5 w-3.5" /></button>)}</div>}</div><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><label className="text-xs font-semibold text-muted">Methodology<textarea value={form.methodology} onChange={(event) => update("methodology", event.target.value)} className="input-field mt-1.5 min-h-28 resize-y" placeholder="Architecture, process, data, and development approach…" /></label><label className="text-xs font-semibold text-muted">Result<textarea value={form.results} onChange={(event) => update("results", event.target.value)} className="input-field mt-1.5 min-h-28 resize-y" placeholder="Measured outcomes and evaluation…" /></label></div><label className="block text-xs font-semibold text-muted">Key findings<textarea value={form.keyFindings} onChange={(event) => update("keyFindings", event.target.value)} className="input-field mt-1.5 min-h-28 resize-y" placeholder={"89% AUC-ROC score\n74% of churners identified\nDeployed to production"} /><span className="mt-1 block font-normal text-muted-light">Write one finding per line.</span></label></div></section>

        <section className="app-card p-5 sm:p-6"><h2 className="text-lg font-semibold text-charcoal">Deliverables</h2><p className="mt-1 text-sm text-muted">Upload the files now or record that they exist and add them later.</p><div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">{([ ["hasReport", "Project report available"], ["hasCode", "Source code available"], ["hasVideo", "Demo video available"] ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-charcoal-soft"><input type="checkbox" checked={form[key]} onChange={(event) => update(key, event.target.checked)} className="h-4 w-4 accent-charcoal" />{label}</label>)}</div><div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3"><label className="rounded-xl border border-dashed border-border bg-grey-50 p-4"><span className="flex items-center gap-2 text-sm font-semibold text-charcoal"><BookOpen className="h-4 w-4" />Project report</span><span className="mt-1 mb-3 block text-xs text-muted">PDF, DOCX, TXT, CSV, or a safe ZIP archive.</span><input type="file" accept=".pdf,.docx,.txt,.csv,.zip" onChange={(event) => setFiles((current) => ({ ...current, report: event.target.files?.[0] ?? null }))} className={inputFileClass} />{files.report && <span className="mt-2 block truncate text-xs text-muted">{files.report.name}</span>}</label><label className="rounded-xl border border-dashed border-border bg-grey-50 p-4"><span className="flex items-center gap-2 text-sm font-semibold text-charcoal"><FileCode2 className="h-4 w-4" />Source code</span><span className="mt-1 mb-3 block text-xs text-muted">ZIP or an accepted source-file format.</span><input type="file" accept=".zip,.java,.kt,.py,.js,.jsx,.ts,.tsx,.css,.json,.md,.sql,.xml,.yml,.yaml" onChange={(event) => setFiles((current) => ({ ...current, code: event.target.files?.[0] ?? null }))} className={inputFileClass} />{files.code && <span className="mt-2 block truncate text-xs text-muted">{files.code.name}</span>}</label><label className="rounded-xl border border-dashed border-border bg-grey-50 p-4"><span className="flex items-center gap-2 text-sm font-semibold text-charcoal"><Film className="h-4 w-4" />Demo video</span><span className="mt-1 mb-3 block text-xs text-muted">MP4, MOV, or WEBM.</span><input type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" onChange={(event) => setFiles((current) => ({ ...current, video: event.target.files?.[0] ?? null }))} className={inputFileClass} />{files.video && <span className="mt-2 block truncate text-xs text-muted">{files.video.name}</span>}</label></div></section>
        <div className="flex flex-col-reverse gap-3 pb-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => router.push("/projects")} disabled={saving} className="btn-secondary">Cancel</button><button type="button" onClick={saveProject} disabled={saving || loadingPeople} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Publishing project…" : "Save and publish project"}</button></div>
      </div>
    </main>
  </PageTransition>;
}

export default function AddProjectPage() {
  return <RoleGuard allowedRoles={["admin", "supervisor"]}><Suspense fallback={<div>Loading…</div>}><AddProjectContent /></Suspense></RoleGuard>;
}

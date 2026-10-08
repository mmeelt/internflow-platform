"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Download, FileText, GraduationCap, Mail, Phone, Upload } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { ApiError, api } from "@/lib/api";
import { toast } from "sonner";

interface SupervisorIntern { id: number; internshipId: number; }
interface StudentRecord {
  studentId: number; name: string; email: string; phone: string | null; photoUrl: string | null; bio: string | null;
  university: string | null; department: string | null; year: string | null; previousInternships: string | null;
  enterprise: string | null; subjectOfInternship: string | null; skills: string[]; projectTitle: string | null;
  projectDomain: string | null; startDate: string | null; endDate: string | null;
  identityCardName: string | null; internshipAgreementName: string | null; signedInternshipAgreementName: string | null;
}

export default function SupervisorStudentRecordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [internshipId, setInternshipId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const signedAgreementInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const interns = await api.get<SupervisorIntern[]>("/api/supervisors/interns");
        const intern = interns.find((item) => String(item.id) === id);
        if (!intern) throw new Error("Student not found in your supervision list.");
        const studentRecord = await api.get<StudentRecord>(`/api/internships/${intern.internshipId}/student-record`);
        if (active) { setInternshipId(intern.internshipId); setRecord(studentRecord); }
      } catch (error) { toast.error(error instanceof ApiError || error instanceof Error ? error.message : "Could not load the student record"); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  const download = async (type: "identity-card" | "internship-agreement" | "signed-internship-agreement") => {
    if (!internshipId) return;
    try {
      const file = await api.download(`/api/internships/${internshipId}/student-record/${type}/download`);
      const url = URL.createObjectURL(file.blob); const link = window.document.createElement("a");
      link.href = url; link.download = file.filename || "registration-document"; link.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not download this document"); }
  };

  const uploadSignedAgreement = async (file?: File) => {
    if (!file || !internshipId) return;
    if (file.type !== "application/pdf") { toast.error("Please upload the signed agreement as a PDF."); return; }
    try {
      const form = new FormData(); form.append("file", file);
      const updated = await api.post<StudentRecord>(`/api/internships/${internshipId}/student-record/signed-agreement`, form);
      setRecord(updated); toast.success("Signed internship agreement uploaded");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not upload the signed agreement"); }
    finally { if (signedAgreementInput.current) signedAgreementInput.current.value = ""; }
  };

  if (loading) return <div className="flex flex-1 items-center justify-center text-sm text-[#6B7280]">Loading student record…</div>;
  if (!record) return <div className="flex flex-1 flex-col items-center justify-center gap-4 text-sm text-[#6B7280]"><p>Student record not found.</p><button onClick={() => router.push("/supervisor?tab=interns")} className="btn-secondary">Back to My Interns</button></div>;
  const details = [["University", record.university], ["Department", record.department], ["Internship type", record.year], ["Company", record.enterprise], ["Subject", record.subjectOfInternship], ["Project domain", record.projectDomain], ["Previous internships", record.previousInternships], ["Dates", record.startDate && record.endDate ? `${record.startDate} → ${record.endDate}` : null]];

  return <PageTransition><div className="flex-1 overflow-auto bg-[#F8F9FA] p-6 md:p-8"><button onClick={() => router.push("/supervisor?tab=interns")} className="mb-6 flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827]"><ArrowLeft className="h-4 w-4" /> Back to My Interns</button><div className="mx-auto max-w-5xl space-y-6">
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 md:p-8"><div className="flex items-center gap-4">{record.photoUrl ? <img src={record.photoUrl} alt="" className="h-16 w-16 rounded-full border border-[#E5E7EB] object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#111827] text-xl font-bold text-white">{record.name.split(" ").map(n => n[0]).join("").slice(0,2)}</div>}<div><h1 className="text-xl font-semibold text-[#111827]">{record.name}</h1><p className="mt-1 text-sm text-[#6B7280]">Student registration and project record</p></div></div><div className="mt-6 flex flex-wrap gap-4 border-t border-[#F3F4F6] pt-5 text-sm text-[#4B5563]"><span className="flex items-center gap-2"><Mail className="h-4 w-4" />{record.email}</span><span className="flex items-center gap-2"><Phone className="h-4 w-4" />{record.phone || "No phone"}</span><span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{record.startDate || "—"} → {record.endDate || "—"}</span></div></section>
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 md:p-8"><div className="mb-5 flex items-center gap-2"><GraduationCap className="h-5 w-5 text-[#111827]" /><h2 className="font-semibold text-[#111827]">Registration details</h2></div><div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{details.map(([label, value]) => <div key={label as string}><p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{label}</p><p className="mt-1 text-sm text-[#374151]">{(value as string) || "Not provided"}</p></div>)}</div>{record.skills.length > 0 && <div className="mt-6 border-t border-[#F3F4F6] pt-5"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Skills</p><div className="mt-2 flex flex-wrap gap-2">{record.skills.map(skill => <span key={skill} className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs text-[#374151]">{skill}</span>)}</div></div>}{record.bio && <p className="mt-6 rounded-xl bg-[#F9FAFB] p-4 text-sm leading-relaxed text-[#4B5563]">{record.bio}</p>}</section>
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 md:p-8"><div className="mb-5 flex items-center gap-2"><FileText className="h-5 w-5 text-[#111827]" /><h2 className="font-semibold text-[#111827]">Internship agreement</h2></div><div className="grid gap-3 sm:grid-cols-2">{[{ type: "identity-card" as const, label: "Identity card", name: record.identityCardName }, { type: "internship-agreement" as const, label: "Original agreement", name: record.internshipAgreementName }, { type: "signed-internship-agreement" as const, label: "Signed agreement", name: record.signedInternshipAgreementName }].map(doc => <div key={doc.type} className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4"><div className="min-w-0"><p className="text-sm font-medium text-[#374151]">{doc.label}</p><p className="mt-1 truncate text-xs text-[#9CA3AF]">{doc.name || (doc.type === "signed-internship-agreement" ? "Not signed and uploaded yet" : "Not uploaded for this account")}</p></div><button onClick={() => download(doc.type)} disabled={!doc.name} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#111827] px-3 py-2 text-xs font-medium text-white disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Download</button></div>)}</div><div className="mt-4 border-t border-[#F3F4F6] pt-4"><input ref={signedAgreementInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => void uploadSignedAgreement(event.target.files?.[0])} /><button onClick={() => signedAgreementInput.current?.click()} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white"><Upload className="h-4 w-4" /> Upload signed agreement (PDF)</button><p className="mt-2 text-xs text-[#6B7280]">The signed copy becomes available in the student&apos;s profile.</p></div></section>
  </div></div></PageTransition>;
}

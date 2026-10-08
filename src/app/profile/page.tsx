"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { PageTransition } from "@/components/PageTransition";
import { getLoggedInUser, updateStoredSession, changePassword, Role } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { readProfilePhoto } from "@/lib/profile-photo";
import { toast } from "sonner";
import {
  Edit2, Check, X, Camera, Mail, Phone, Building2,
  BookOpen, Briefcase, ChevronRight, GraduationCap,
  Users, Shield, Download, FileText,
} from "lucide-react";

// Detect role from session
// Default fallback if no session


const SKILL_COLORS = [
  "bg-[#E5E7EB] text-[#3730a3]", "bg-[#D1FAE5] text-[#065F46]",
  "bg-[#FEF3C7] text-[#92400E]", "bg-[#FDF4FF] text-[#7E22CE]",
  "bg-[#FFF7ED] text-[#9a3412]", "bg-[#F0F9FF] text-[#0369a1]",
];

function Field({
  label, value, onSave, multiline = false, type = "text", editable = true,
}: {
  label: string; value: string; onSave: (v: string) => void; multiline?: boolean; type?: string; editable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  return (
    <div className="group">
      <label className="block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</label>
      {editing ? (
        <div className="flex gap-2">
          {multiline ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="flex-1 px-3 py-2 rounded-lg border border-[#111827] text-sm text-[#374151] outline-none resize-none" />
          ) : (
            <input type={type} value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-[#111827] text-sm text-[#374151] outline-none" />
          )}
          <button onClick={save} className="p-2 rounded-lg bg-[#111827] text-white hover:bg-[#1F2937]"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={cancel} className="p-2 rounded-lg border border-[#D1D5DB] text-[#6B7280] hover:bg-[#F3F4F6]"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <p className="text-sm text-[#374151] leading-relaxed">{value || <span className="text-[#9CA3AF] italic">Not set</span>}</p>
          {editable && <button onClick={() => { setDraft(value); setEditing(true); }} className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-[#111827] transition-all shrink-0 ml-2">
            <Edit2 className="w-3.5 h-3.5" />
          </button>}
        </div>
      )}
    </div>
  );
}

function SkillsField({ skills, onSave }: { skills: string[]; onSave: (s: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const add = () => {
    if (draft.trim() && !skills.includes(draft.trim())) {
      onSave([...skills, draft.trim()]);
    }
    setDraft("");
    setAdding(false);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Skills</label>
      <div className="flex flex-wrap gap-2">
        {skills.map((s, i) => (
          <span key={s} className={`flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-medium ${SKILL_COLORS[i % SKILL_COLORS.length]}`}>
            {s}
            <button onClick={() => onSave(skills.filter((x) => x !== s))} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
          </span>
        ))}
        {adding ? (
          <div className="flex items-center gap-1">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add skill…" autoFocus className="w-28 px-2.5 py-1 rounded-full border border-[#111827] text-xs outline-none" />
            <button onClick={add} className="p-1 rounded-full bg-[#111827] text-white"><Check className="w-3 h-3" /></button>
            <button onClick={() => setAdding(false)} className="p-1 rounded-full border border-[#D1D5DB] text-[#6B7280]"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-[#D1D5DB] text-xs text-[#6B7280] hover:border-[#111827] hover:text-[#111827] transition-colors">+ Add skill</button>
        )}
      </div>
    </div>
  );
}

function ProfileContent() {
  const router = useRouter();
  const session = getLoggedInUser();
  const role: Role = session?.role || "student";

  // Admins don't have a profile page — bounce straight to their dashboard.
  useEffect(() => {
    if (role === "admin") {
      router.replace("/admin");
    }
  }, [role, router]);

  // ── Student profile state ──
  const [profile, setProfile] = useState({
    name: "", email: "", phone: "", university: "", department: "", year: "",
    bio: "", previousInternships: "", enterprise: "", subjectOfInternship: "",
    skills: [] as string[],
  });

  // ── Supervisor profile state ──
  const [supProfile, setSupProfile] = useState({
    name: "", email: "", phone: "", bio: "", organization: "", department: "",
    post: "", specialization: "", otherEncadrantInfo: "", yearsExperience: 0, totalInterns: 0,
  });
  const [admProfile, setAdmProfile] = useState({
    name: "", email: "", phone: "", organization: "", department: "", title: "", bio: "",
  });
  const [internship, setInternship] = useState<{
    id: number; title: string; domain: string | null; startDate: string | null; endDate: string | null; progress: number;
    supervisor?: { name?: string | null } | null;
  } | null>(null);
  const [signedAgreement, setSignedAgreement] = useState<string | null>(null);

  // ── Admin profile state ──

  // ── Photo state ──
  const [photo, setPhoto] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [replacementPassword, setReplacementPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const profileReady = useRef(false);
  const skipInitialSave = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api.get<any>("/api/profile").then((data) => {
      if (cancelled) return;
      skipInitialSave.current = true;
      if (role === "student") setProfile((current) => ({ ...current, name: data.name ?? "", email: data.email ?? "", phone: data.phone ?? "", bio: data.bio ?? "", university: data.university ?? "", department: data.department ?? "", year: data.year ?? "", previousInternships: data.previousInternships ?? "", enterprise: data.enterprise ?? "", subjectOfInternship: data.subjectOfInternship ?? "", skills: data.skills ?? [] }));
      if (role === "supervisor") setSupProfile((current) => ({ ...current, name: data.name ?? "", email: data.email ?? "", phone: data.phone ?? "", bio: data.bio ?? "", organization: data.organization ?? "", department: data.department ?? "", post: data.post ?? "", specialization: data.specialization ?? "", otherEncadrantInfo: data.otherEncadrantInfo ?? "", yearsExperience: data.yearsExperience ?? 0, totalInterns: data.totalInterns ?? 0 }));
      setPhoto(data.photoUrl ?? null);
      profileReady.current = true;
    }).catch((error) => toast.error(error instanceof ApiError ? error.message : "Could not load profile"));
    return () => { cancelled = true; };
  }, [role]);

  useEffect(() => {
    if (role !== "student") return;
    api.get<Array<{ id: number; title: string; domain: string | null; startDate: string | null; endDate: string | null; progress: number; supervisor?: { name?: string | null } | null }>>("/api/internships")
      .then(async (items) => {
        const current = items[0] ?? null;
        setInternship(current);
        if (!current) { setSignedAgreement(null); return; }
        const record = await api.get<{ signedInternshipAgreementName: string | null }>(`/api/internships/${current.id}/student-record`);
        setSignedAgreement(record.signedInternshipAgreementName);
      })
      .catch(() => { setInternship(null); setSignedAgreement(null); });
  }, [role]);

  const downloadSignedAgreement = async () => {
    if (!internship || !signedAgreement) return;
    try {
      const file = await api.download(`/api/internships/${internship.id}/student-record/signed-internship-agreement/download`);
      const url = URL.createObjectURL(file.blob);
      const link = window.document.createElement("a");
      link.href = url; link.download = file.filename || "signed-internship-agreement.pdf"; link.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not download the signed agreement"); }
  };

  useEffect(() => {
    if (!profileReady.current || role === "admin") return;
    if (skipInitialSave.current) {
      skipInitialSave.current = false;
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        await api.patch("/api/profile", role === "student" ? { name: profile.name, phone: profile.phone, bio: profile.bio, university: profile.university, department: profile.department, year: profile.year, previousInternships: profile.previousInternships, enterprise: profile.enterprise, subjectOfInternship: profile.subjectOfInternship, skills: profile.skills } : { name: supProfile.name, phone: supProfile.phone, bio: supProfile.bio, organization: supProfile.organization, department: supProfile.department, post: supProfile.post, specialization: supProfile.specialization, otherEncadrantInfo: supProfile.otherEncadrantInfo, yearsExperience: Number(supProfile.yearsExperience) || 0 });
      } catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not save profile"); }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [profile, supProfile, role]);

  const avatarBg = role === "admin" ? "#374151" : "#111827";

  // Calculate dynamic initials
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
  };
  const userName = role === "student" ? profile.name : role === "supervisor" ? supProfile.name : admProfile.name;
  const initials = getInitials(userName);

  const handlePhotoChange = async (file?: File) => {
    if (!file) return;
    try {
      const photoUrl = await readProfilePhoto(file);
      const updated = await api.patch<any>("/api/profile", { photoUrl });
      setPhoto(updated.photoUrl ?? photoUrl);
      updateStoredSession({ photoUrl: updated.photoUrl ?? photoUrl });
      toast.success("Profile photo saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile photo");
    }
  };

  const handleChangePassword = async () => {
    if (replacementPassword.length < 12 || !/[A-Za-z]/.test(replacementPassword) || !/\d/.test(replacementPassword)) {
      toast.error("Use a new password with at least 12 characters, including letters and digits.");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, replacementPassword);
      toast.success("Password changed. Please sign in again.");
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not change password");
    } finally {
      setChangingPassword(false);
    }
  };

  // Admins are redirected above — render nothing while that happens.
  if (role === "admin") {
    return null;
  }

  return (
    <PageTransition>
      <div className="bg-white border-b border-[#E5E7EB] px-8 py-5 shrink-0">
        <h1 className="text-xl font-semibold text-[#111827]">My Profile</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">View and edit your personal information</p>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Avatar + name hero */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 flex items-center gap-6">
            <div className="relative w-20 h-20 group">
              {photo ? (
                <img src={photo} alt="Profile" className="w-20 h-20 rounded-full object-cover border border-[#E5E7EB] shadow-sm" />
              ) : (
                <div className="w-20 h-20 rounded-full text-white text-2xl font-bold flex items-center justify-center shadow-sm" style={{ backgroundColor: avatarBg }}>
                  {initials}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#111827] text-white flex items-center justify-center hover:bg-[#1F2937] transition-colors border-2 border-white cursor-pointer shadow-md">
                <Camera className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  title="Upload profile photo"
                  onChange={(e) => void handlePhotoChange(e.target.files?.[0])}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold text-[#111827]">
                  {userName}{role === "supervisor" && supProfile.post ? ` · ${supProfile.post}` : ""}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${(role as string) === "admin" ? "bg-[#FEF3C7] text-[#92400E]" : (role as string) === "supervisor" ? "bg-[#E5E7EB] text-[#3730a3]" : "bg-[#D1FAE5] text-[#065F46]"}`}>
                  {(role as string) === "admin" ? "Administrator" : (role as string) === "supervisor" ? "Supervisor" : "Intern"}
                </span>
              </div>
              <p className="text-sm text-[#6B7280]">
                {role === "student" ? `${profile.department} · ${profile.university}` : role === "supervisor" ? `${supProfile.department} · ${supProfile.organization}` : `${admProfile.department} · ${admProfile.organization}`}
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                {role === "student" ? profile.email : role === "supervisor" ? supProfile.email : admProfile.email}
              </p>
            </div>
          </div>

          {/* ── STUDENT fields ── */}
          {role === "student" && (
            <>
              <Section title="Personal Information" icon={GraduationCap}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Full Name"   value={profile.name}       onSave={() => {}} editable={false} />
                  <Field label="Email"       value={profile.email}      onSave={() => {}} type="email" editable={false} />
                  <Field label="Phone"       value={profile.phone}      onSave={() => {}} type="tel" editable={false} />
                  <Field label="University"  value={profile.university} onSave={() => {}} editable={false} />
                  <Field label="Department"  value={profile.department} onSave={() => {}} editable={false} />
                  <Field label="Year / Level" value={profile.year}     onSave={() => {}} editable={false} />
                  <Field label="Target Enterprise" value={profile.enterprise} onSave={(v) => setProfile((p) => ({ ...p, enterprise: v }))} />
                  <Field label="Previous Internships" value={profile.previousInternships} onSave={(v) => setProfile((p) => ({ ...p, previousInternships: v }))} />
                  <Field label="Subject of Internship" value={profile.subjectOfInternship} onSave={(v) => setProfile((p) => ({ ...p, subjectOfInternship: v }))} />
                </div>
                <div className="mt-5">
                  <Field label="Bio" value={profile.bio} onSave={(v) => setProfile((p) => ({ ...p, bio: v }))} multiline />
                </div>
                <div className="mt-5">
                  <SkillsField skills={profile.skills} onSave={(s) => setProfile((p) => ({ ...p, skills: s }))} />
                </div>
              </Section>

              <Section title="Internship" icon={Briefcase}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InfoRow label="Project" value={internship?.title ?? profile.subjectOfInternship} />
                  <InfoRow label="Domain" value={internship?.domain ?? "Not set"} />
                  <InfoRow label="Supervisor" value={internship?.supervisor?.name ?? "Not assigned"} />
                  <InfoRow label="Start Date" value={internship?.startDate ?? "Not set"} />
                  <InfoRow label="End Date" value={internship?.endDate ?? "Not set"} />
                  <InfoRow label="Role" value="Intern" />
                  <InfoRow label="Progress" value={`${internship?.progress ?? 0}%`} />
                </div>
                <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                  <button onClick={() => router.push("/student")} className="flex items-center gap-2 text-sm text-[#111827] hover:underline">
                    Go to My Project <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Section>
              <Section title="Internship Agreement" icon={FileText}>
                <div className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="text-sm font-medium text-[#374151]">Signed internship agreement</p><p className="mt-1 truncate text-xs text-[#6B7280]">{signedAgreement || "Your supervisor or administrator has not uploaded a signed copy yet."}</p></div>
                  <button onClick={downloadSignedAgreement} disabled={!signedAgreement} className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4" /> Download signed copy</button>
                </div>
              </Section>
            </>
          )}

          {/* ── SUPERVISOR fields ── */}
          {role === "supervisor" && (
            <>
              <Section title="Professional Information" icon={Users}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Full Name"       value={supProfile.name}           onSave={() => {}} editable={false} />
                  <Field label="Email"           value={supProfile.email}          onSave={() => {}} type="email" editable={false} />
                  <Field label="Phone"           value={supProfile.phone}          onSave={() => {}} type="tel" editable={false} />
                  <Field label="Organisation"    value={supProfile.organization}   onSave={(v) => setSupProfile((p) => ({ ...p, organization: v }))} />
                  <Field label="Department"      value={supProfile.department}     onSave={(v) => setSupProfile((p) => ({ ...p, department: v }))} />
                  <Field label="Post / Job Title" value={supProfile.post || ""}     onSave={(v) => setSupProfile((p) => ({ ...p, post: v }))} />
                  <Field label="Specialisation"  value={supProfile.specialization} onSave={(v) => setSupProfile((p) => ({ ...p, specialization: v }))} />
                  <Field label="Additional Supervisor Info" value={supProfile.otherEncadrantInfo || ""} onSave={(v) => setSupProfile((p) => ({ ...p, otherEncadrantInfo: v }))} />
                </div>
                <div className="mt-5">
                  <Field label="Bio" value={supProfile.bio} onSave={(v) => setSupProfile((p) => ({ ...p, bio: v }))} multiline />
                </div>
              </Section>
            </>
          )}

          {(role === "student" || role === "supervisor") && (
            <Section title="Account Security" icon={Shield}>
              <p className="mb-4 text-sm text-[#6B7280]">Changing your password signs out every device for your protection.</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" className="rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm" />
                <input type="password" value={replacementPassword} onChange={(event) => setReplacementPassword(event.target.value)} placeholder="New password (12+ chars, letters and digits)" className="rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm" />
              </div>
              <button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !replacementPassword} className="mt-4 rounded-xl bg-[#111827] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {changingPassword ? "Changing password..." : "Change password"}
              </button>
            </Section>
          )}

          {/* ── ADMIN fields ── */}
          {(role as string) === "admin" && (
            <>
              <Section title="Administrator Profile" icon={Shield}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Full Name"     value={admProfile.name}         onSave={(v) => setAdmProfile((p) => ({ ...p, name: v }))} />
                  <Field label="Email"         value={admProfile.email}        onSave={(v) => setAdmProfile((p) => ({ ...p, email: v }))} type="email" />
                  <Field label="Phone"         value={admProfile.phone}        onSave={(v) => setAdmProfile((p) => ({ ...p, phone: v }))} type="tel" />
                  <Field label="Organisation"  value={admProfile.organization} onSave={(v) => setAdmProfile((p) => ({ ...p, organization: v }))} />
                  <Field label="Department"    value={admProfile.department}   onSave={(v) => setAdmProfile((p) => ({ ...p, department: v }))} />
                  <Field label="Title"         value={admProfile.title}        onSave={(v) => setAdmProfile((p) => ({ ...p, title: v }))} />
                </div>
                <div className="mt-5">
                  <Field label="Bio" value={admProfile.bio} onSave={(v) => setAdmProfile((p) => ({ ...p, bio: v }))} multiline />
                </div>
              </Section>
              <Section title="Platform Overview" icon={BookOpen}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InfoCard label="Active Students"   value="5" />
                  <InfoCard label="Supervisors"       value="3" />
                  <InfoCard label="Projects"          value="6" />
                </div>
                <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                  <button onClick={() => router.push("/admin")} className="flex items-center gap-2 text-sm text-[#111827] hover:underline">
                    Open Admin Dashboard <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Section>
            </>
          )}

          <p className="text-xs text-center text-[#9CA3AF]">Hover any field and click the pencil icon to edit · Changes are saved instantly</p>
        </div>
      </div>
    </PageTransition>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[#E5E7EB]">
        <div className="w-7 h-7 rounded-lg bg-[#E5E7EB] flex items-center justify-center"><Icon className="w-4 h-4 text-[#111827]" /></div>
        <h3 className="font-semibold text-[#111827]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-[#374151]">{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F3F4F6] rounded-xl p-4 text-center">
      <p className="text-2xl font-bold text-[#111827]">{value}</p>
      <p className="text-xs text-[#6B7280] mt-1">{label}</p>
    </div>
  );
}

export default function Profile() {
  return (
    <RoleGuard allowedRoles={["student", "supervisor", "admin"]}>
      <ProfileContent />
    </RoleGuard>
  );
}

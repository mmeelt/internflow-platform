"use client";

import { useState, useRef, useEffect } from "react";
import { register as registerUser, verifyRegistrationCode, resendRegistrationCode, uploadStudentRegistrationDocuments, ApiError } from "@/lib/auth";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Camera,
  Building2,
  Upload,
  User,
  Mail,
  Phone,
  Linkedin,
  Github,
  Globe,
  FileText,
  IdCard,
  GraduationCap,
  CalendarDays,
  Briefcase,
  X,
  ExternalLink,
  Shield,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { readProfilePhoto } from "@/lib/profile-photo";
import { useVerificationCountdown } from "@/lib/useVerificationCountdown";

/* ─────────────────────────── CONSTANTS ─────────────────────────── */

const SOUSSE_UNIVERSITIES = [
  { id: "eniso",    label: "ENISO",    full: "National Engineering School of Sousse",                    url: "https://www.eniso.rnu.tn" },
  { id: "fss",      label: "FSS",      full: "Faculty of Sciences of Sousse",                            url: "https://fss.rnu.tn" },
  { id: "isims",    label: "ISIMS",    full: "Higher Institute of Computer Science and Multimedia of Sousse", url: "https://isims.rnu.tn" },
  { id: "essths",   label: "ESSTHS",   full: "Higher School of Sciences and Technology of Hammam Sousse", url: "https://essths.rnu.tn" },
  { id: "isbas",    label: "ISBAS",    full: "Higher Institute of Fine Arts of Sousse",               url: "https://www.isbas.rnu.tn" },
  { id: "ihec",     label: "IHEC",     full: "Higher Institute of Commercial Studies of Sousse",         url: "https://ihec.rnu.tn" },
  { id: "isg",      label: "ISG",      full: "Higher Institute of Management of Sousse",                  url: "https://www.isg.rnu.tn" },
  { id: "issat",    label: "ISSAT",    full: "Higher Institute of Applied Sciences and Technology of Sousse", url: "https://issat.rnu.tn" },
  { id: "supcom",   label: "Sup'Com",  full: "Higher School of Communications of Tunis",              url: "https://www.supcom.tn" },
  { id: "esprit",   label: "ESPRIT",   full: "Private Higher School of Engineering and Technologies",  url: "https://esprit.tn" },
  { id: "autre",    label: "Other",    full: "Other university (specify)",                               url: "" },
];

const DOMAINS = [
  "Web Development",
  "Mobile Development",
  "Artificial Intelligence & Data Science",
  "DevOps & Cloud",
  "Cybersecurity",
  "Embedded Systems",
  "Networks & Telecom",
  "UI/UX Design",
  "Other"
];

const TECH_STACKS = [
  "React / Next.js", "Angular", "Vue.js",
  "Spring Boot", "Node.js / Express", "Django / Flask",
  "Laravel / PHP", ".NET / C#",
  "Flutter", "React Native", "Swift / iOS", "Kotlin / Android",
  "Python", "Java", "C++",
  "Docker / Kubernetes", "AWS / Azure / GCP"
];

const STAGE_TYPES = [
  { id: "pfa",   label: "PFA",           desc: "End of Year Project" },
  { id: "pfe",   label: "PFE",           desc: "End of Studies Project" },
  { id: "summer", label: "Summer Internship", desc: "Summer observation internship" },
  { id: "professional", label: "Professional Internship", desc: "Professional work placement" },
];

const CENTRE_OF_EXCELLENCE_AXES = [
  "AI Centre of Excellence",
  "Industry 4.0 Centre of Excellence",
];

const steps = [
  { id: 1, label: "Personal Information",   short: "Profile" },
  { id: 2, label: "University & Documents", short: "University" },
  { id: 3, label: "Internship Details",     short: "Internship" },
  { id: 4, label: "Confirmation",           short: "Confirm" },
  { id: 5, label: "Email Verification",     short: "Verify" },
];

/* ─────────────────────────── MAIN PAGE ─────────────────────────── */

export default function Setup() {
  const router = useRouter();
  // Signup uses the curated client-side lists. Profile-derived catalog values
  // are intentionally not exposed before authentication.
  const catalogDomains = DOMAINS;
  const catalogTechnologies = TECH_STACKS;
  const [step, setStep] = useState(1);
  const [supervisors, setSupervisors] = useState<{id: number, name: string, post: string | null, axis: string | null}[]>([]);
  const [availableProjects, setAvailableProjects] = useState<{id: number, title: string, domain: string | null, description: string | null, supervisorId: number | null, supervisorName: string | null}[]>([]);

  useEffect(() => {
    api.get<any[]>("/api/auth/supervisors", { skipAuth: true })
      .then(data => setSupervisors(data))
      .catch(err => console.error("Failed to load supervisors", err));
  }, []);
  const conventionRef = useRef<HTMLInputElement>(null);
  const idCardRef     = useRef<HTMLInputElement>(null);
  const [verifCode, setVerifCode] = useState("");
  const [verifError, setVerifError] = useState("");
  const [resendingCode, setResendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const verificationRefs = useRef<Array<HTMLInputElement | null>>([]);
  const { secondsRemaining, expired, restart: restartCountdown } = useVerificationCountdown();

  const [data, setData] = useState({
    // Step 1
    firstName:    "",
    lastName:     "",
    email:        "",
    phone:        "",
    photo:        "",           // profile photo (data URL)
    idCardFile:   null as File | null,
    idCardPreview:"",

    // Step 2
    universityId:   "",
    universityName: "",         // custom name if "autre"
    universityUrl:  "",         // custom url if "autre"
    academicDepartment: "",
    conventionFile: null as File | null,
    conventionName: "",

    // Step 3
    stageType:    "",
    specialization: "",
    projectId:    "",
    projectTitle: "",
    projectDomain:"",
    customDomain: "",
    projectStack: [] as string[],
    customTechnology: "",
    projectDescription: "",
    startDate:    "",
    endDate:      "",
    encadrant:    "",
    linkedin:     "",
    github:       "",
    password:     "",
    confirmPassword: "",
  });

  useEffect(() => {
    api.get<{id: number, title: string, domain: string | null, description: string | null, supervisorId: number | null, supervisorName: string | null}[]>(
      "/api/projects/selectable",
      { skipAuth: true, cache: "no-store" },
    )
      .then(setAvailableProjects)
      .catch(err => {
        setAvailableProjects([]);
        console.error("Failed to load selectable projects", err);
      });
  }, []);

  const set = (k: keyof typeof data, v: any) =>
    setData(p => ({ ...p, [k]: v }));

  /* Verification is performed by the backend during sign-in. */
  const sendVerificationEmail = async () => {
    if (!challengeId || resendingCode) return;
    setResendingCode(true);
    setVerifError("");
    try {
      const challenge = await resendRegistrationCode(challengeId);
      setChallengeId(challenge.challengeId);
      setCodeSent(true);
      restartCountdown(challenge.expiresIn);
      toast.success(`A new verification code was sent to ${data.email}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Unable to resend the code. Please try again.";
      setVerifError(message === "Invalid verification request"
        ? "This verification session is no longer active. Please submit your registration again."
        : message);
    } finally {
      setResendingCode(false);
    }
  };

  const updateVerificationDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const digits = verifCode.padEnd(6, " ").split("");
    digits[index] = digit || " ";
    setVerifCode(digits.join("").trimEnd());
    setVerifError("");
    if (digit && index < 5) verificationRefs.current[index + 1]?.focus();
  };

  const handleVerificationKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !verifCode[index] && index > 0) {
      verificationRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      verificationRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      verificationRefs.current[index + 1]?.focus();
    }
  };

  const handleVerificationPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    setVerifCode(pasted);
    setVerifError("");
    verificationRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  /* ── Validation per step ── */
  const canNext = () => {
    if (step === 1) return (
      data.firstName.trim() && data.lastName.trim() &&
      data.email.trim() && data.email.includes("@") &&
      data.phone.trim()
    );
    if (step === 2) return (
      data.universityId &&
      (data.universityId !== "autre" || (data.universityName.trim() && data.universityUrl.trim())) &&
      data.academicDepartment.trim() &&
      data.conventionFile !== null
    );
    if (step === 3) return (
      data.stageType && data.specialization && data.startDate && data.endDate &&
      (data.password || "").length >= 12 && /[A-Za-z]/.test(data.password || "") && /\d/.test(data.password || "") && data.password === data.confirmPassword
    );
    return true;
  };

  const next   = () => { if (canNext() && step < 4) setStep(s => s + 1); };
  const back   = () => { if (step > 1) setStep(s => s - 1); };

  /* ── Submit registration → real backend call → then go to email verification ── */
  const submitRegistration = async () => {
    setSubmitError("");
    setSubmitting(true);
    try {
      const result = await registerUser({
        email:    data.email.trim().toLowerCase(),
        password: data.password,
        name:     `${data.firstName.trim()} ${data.lastName.trim()}`,
        role:     "student",
        photoUrl: data.photo || null,
        phone: data.phone.trim(),
        bio: data.projectDescription.trim(),
        university: universityDisplayName,
        department: data.academicDepartment.trim(),
        domain: (data.projectDomain === "Other" ? data.customDomain : data.projectDomain).trim(),
        year: data.stageType,
        specialization: data.specialization,
        enterprise: "InternFlow",
        subjectOfInternship: data.projectTitle.trim(),
        skills: data.projectStack,
        projectId: data.projectId ? Number(data.projectId) : undefined,
        supervisorId: data.encadrant ? Number(data.encadrant) : undefined,
        startDate: data.startDate,
        endDate: data.endDate,
      });
      await uploadStudentRegistrationDocuments(result.challengeId, data.idCardFile!, data.conventionFile!);
      // Account created with status "Need Review" — now send simulated verification email
      setChallengeId(result.challengeId);
      restartCountdown(result.expiresIn);
      setCodeSent(true);
      setStep(5);
      toast.success(`Verification code sent to ${data.email}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Registration failed. Please try again.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Verify code & redirect ── */
  const finish = async () => {
    if (!challengeId || !/^\d{6}$/.test(verifCode)) return;
    if (expired) {
      setVerifError("This code has expired. Resend a new code to continue.");
      return;
    }
    setSubmitting(true);
    setVerifError("");
    try {
      await verifyRegistrationCode(challengeId, verifCode);
      toast.success("Email verified. Your account is now awaiting administrator approval.");
      router.push("/login");
    } catch {
      setVerifError("Verify your code.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Helpers ── */
  const selectedUniversity = SOUSSE_UNIVERSITIES.find(u => u.id === data.universityId);
  const universityDisplayName = data.universityId === "autre"
    ? data.universityName
    : selectedUniversity?.full ?? "";

  const BrandLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
    <img src="/logo.svg" alt="InternFlow Logo" className={`${className} object-contain rounded-xl`} />
  );

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden grid grid-cols-1 md:grid-cols-12 font-sans antialiased bg-[#F8F9FA]">

      {/* ── LEFT PANEL ── */}
      <div className="hidden md:flex md:col-span-5 p-8 lg:p-12 xl:p-16 flex-col justify-between relative overflow-hidden select-none h-full bg-slate-950">
        <div className="absolute inset-0 bg-cover bg-center brightness-[0.22] scale-105" style={{ backgroundImage: "url('/images.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/90 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 via-transparent to-slate-950/20 pointer-events-none" />

        <button onClick={() => router.push("/login")} className="group flex items-center gap-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors relative z-10 w-fit">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to login
        </button>

        <div className="relative z-10 max-w-sm my-auto space-y-6">
          <div className="flex items-center gap-4 text-white">
            <BrandLogo className="w-11 h-11 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
            <div>
              <div className="text-xl font-black tracking-wider leading-none">INTERNFLOW</div>
              <div className="text-[10px] font-bold tracking-widest text-slate-300 mt-1 uppercase">Internship Management Platform</div>
            </div>
          </div>

          <h2 className="text-2xl xl:text-3xl font-black tracking-tight text-white leading-tight pt-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            Join the InternFlow ecosystem.
          </h2>
          <p className="text-xs xl:text-sm text-slate-200/90 font-medium leading-relaxed">
            Create your intern profile, submit your official documents and join your workspace in a few steps.
          </p>

          {/* Step indicators */}
          <div className="space-y-2 pt-2">
            {steps.map(s => (
              <div key={s.id} className={`flex items-center gap-3 transition-all ${step >= s.id ? "opacity-100" : "opacity-30"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all ${step > s.id ? "bg-emerald-500 border-emerald-500 text-white" : step === s.id ? "bg-white border-white text-slate-900" : "bg-transparent border-slate-500 text-slate-400"}`}>
                  {step > s.id ? <Check className="w-3 h-3" /> : s.id}
                </div>
                <span className={`text-xs font-semibold ${step === s.id ? "text-white" : "text-slate-400"}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400 font-medium flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5" />
          <span>InternFlow Platform &copy; 2026</span>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="col-span-1 md:col-span-7 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-10 xl:p-12 md:h-full md:overflow-hidden relative">

        {/* Mobile top bar */}
        <div className="w-full max-w-[640px] flex justify-between items-center lg:hidden mb-4 px-2 pt-2">
          <button onClick={() => router.push("/login")} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-2 text-[#0D1926]">
            <BrandLogo className="w-4 h-4" />
            <span className="text-xs font-bold tracking-wider">INTERNFLOW</span>
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-[640px] bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col lg:max-h-[90vh] my-auto">

          {/* Progress header */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 bg-white sticky top-0 z-20">
            <div className="flex justify-between mb-3 items-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step {step} / 5</span>
                <h2 className="text-sm font-bold text-slate-900 mt-0.5">{steps[step - 1].label}</h2>
              </div>
              <span className="text-[10px] font-bold text-[#0D1926] bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">Intern Registration</span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#0D1926] to-[#2563EB] rounded-full transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
            </div>
            {/* Step dots */}
            <div className="flex justify-between mt-2.5">
              {steps.map(s => (
                <div key={s.id} className="flex flex-col items-center gap-1">
                  <div className={`w-2 h-2 rounded-full transition-all ${step > s.id ? "bg-emerald-500" : step === s.id ? "bg-[#0D1926]" : "bg-slate-200"}`} />
                  <span className={`text-[9px] font-semibold hidden sm:block ${step === s.id ? "text-[#0D1926]" : "text-slate-400"}`}>{s.short}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-white">

            {/* ═══════════ STEP 1 : INFORMATIONS PERSONNELLES ═══════════ */}
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <SectionHeader
                  icon={User}
                  title="Personal Information"
                  subtitle="Enter your personal details and upload your profile photo and ID card."
                />

                {/* Profile photo + ID card row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Profile photo */}
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 flex flex-col items-center gap-2">
                    <div className="relative w-16 h-16 rounded-xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center group overflow-hidden cursor-pointer hover:border-[#0D1926] transition-colors">
                      {data.photo ? (
                        <img src={data.photo} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-5 h-5 text-slate-300 group-hover:text-[#0D1926] transition-colors" />
                      )}
                      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) void readProfilePhoto(file).then((value) => set("photo", value)).catch((error) => toast.error(error.message));
                        }} />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-slate-700">Profile photo</p>
                      <p className="text-[10px] text-slate-400">JPG, PNG</p>
                    </div>
                  </div>

                  {/* ID Card */}
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 flex flex-col items-center gap-2">
                    <div
                      className="relative w-16 h-16 rounded-xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center group overflow-hidden cursor-pointer hover:border-[#0D1926] transition-colors"
                      onClick={() => idCardRef.current?.click()}
                    >
                      {data.idCardPreview ? (
                        <img src={data.idCardPreview} alt="CIN" className="w-full h-full object-cover" />
                      ) : (
                        <IdCard className="w-5 h-5 text-slate-300 group-hover:text-[#0D1926] transition-colors" />
                      )}
                      <input ref={idCardRef} type="file" accept="image/*" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) { set("idCardFile", f); set("idCardPreview", URL.createObjectURL(f)); }
                        }} />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-slate-700">ID card</p>
                      <p className="text-[10px] text-slate-400">{data.idCardFile ? data.idCardFile.name.slice(0,18)+"…" : "ID card (front)"}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name *">
                    <InputIcon icon={User} placeholder="e.g. Ahmed" value={data.firstName} onChange={v => set("firstName", v)} />
                  </Field>
                  <Field label="Last name *">
                    <InputIcon icon={User} placeholder="e.g. Ben Ali" value={data.lastName} onChange={v => set("lastName", v)} />
                  </Field>
                </div>

                <Field label="Email address *">
                  <InputIcon icon={Mail} type="email" placeholder="you@example.com" value={data.email} onChange={v => set("email", v)} />
                </Field>

                <Field label="Phone number *">
                  <InputIcon icon={Phone} type="tel" placeholder="+216 XX XXX XXX" value={data.phone} onChange={v => set("phone", v)} />
                </Field>
              </div>
            )}

            {/* ═══════════ STEP 2 : UNIVERSITÉ & DOCUMENTS ═══════════ */}
            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <SectionHeader
                  icon={GraduationCap}
                  title="University & Official Documents"
                  subtitle="Select your institution and upload your signed internship agreement."
                />

                {/* University dropdown */}
                <Field label="University / Institution *">
                  <div className="relative">
                    <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                      value={data.universityId}
                      onChange={e => {
                        const uid = e.target.value;
                        const uni = SOUSSE_UNIVERSITIES.find(u => u.id === uid);
                        set("universityId", uid);
                        if (uid !== "autre") {
                          set("universityUrl", uni?.url ?? "");
                          set("universityName", uni?.full ?? "");
                        } else {
                          set("universityUrl", "");
                          set("universityName", "");
                        }
                      }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/30 text-xs sm:text-sm text-slate-900 outline-none focus:border-[#0D1926] focus:ring-2 focus:ring-[#0D1926]/10 transition-all hover:border-slate-300 appearance-none cursor-pointer"
                    >
                      <option value="">-- Select an institution --</option>
                      {SOUSSE_UNIVERSITIES.map(u => (
                        <option key={u.id} value={u.id}>{u.label} — {u.full}</option>
                      ))}
                    </select>
                  </div>
                </Field>

                {/* If "autre" selected → custom name + URL */}
                {data.universityId === "autre" && (
                  <div className="space-y-3 bg-blue-50/50 border border-blue-100 rounded-xl p-4 animate-in fade-in duration-200">
                    <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Specify your institution</p>
                    <Field label="University name *">
                      <InputIcon icon={Building2} placeholder="e.g. University of Monastir" value={data.universityName} onChange={v => set("universityName", v)} />
                    </Field>
                    <Field label="University website *">
                      <InputIcon icon={Globe} type="url" placeholder="https://www.universite.tn" value={data.universityUrl} onChange={v => set("universityUrl", v)} />
                    </Field>
                  </div>
                )}

                {/* Show university URL for known universities */}
                {data.universityId && data.universityId !== "autre" && selectedUniversity?.url && (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2">
                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a href={selectedUniversity.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline font-medium flex-1 truncate">
                      {selectedUniversity.url}
                    </a>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </div>
                )}

                <Field label="Department / Program *">
                  <InputIcon
                    icon={GraduationCap}
                    placeholder="e.g. Software Engineering"
                    value={data.academicDepartment}
                    onChange={value => set("academicDepartment", value)}
                  />
                </Field>

                {/* Convention de stage upload */}
                <Field label="Internship Agreement *" hint="Upload the PDF signed by the company.">
                  <div
                    onClick={() => conventionRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:border-[#0D1926] hover:bg-slate-50 group ${data.conventionFile ? "border-emerald-400 bg-emerald-50/40" : "border-slate-200 bg-slate-50/30"}`}
                  >
                    <input ref={conventionRef} type="file" accept=".pdf" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { set("conventionFile", f); set("conventionName", f.name); }
                      }} />
                    {data.conventionFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-emerald-700">{data.conventionName}</p>
                          <p className="text-[10px] text-emerald-500">File uploaded successfully ✓</p>
                        </div>
                        <button
                          type="button"
                          className="ml-2 p-1 rounded-lg hover:bg-emerald-100 transition-colors"
                          onClick={e => { e.stopPropagation(); set("conventionFile", null); set("conventionName", ""); }}
                        >
                          <X className="w-3.5 h-3.5 text-emerald-500" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2 group-hover:bg-[#0D1926]/10 transition-colors">
                          <Upload className="w-5 h-5 text-slate-400 group-hover:text-[#0D1926] transition-colors" />
                        </div>
                        <p className="text-xs font-bold text-slate-600 group-hover:text-[#0D1926] transition-colors">Click to upload PDF</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Internship agreement — PDF format only</p>
                      </div>
                    )}
                  </div>
                </Field>
              </div>
            )}

            {/* ═══════════ STEP 3 : DÉTAILS DU STAGE ═══════════ */}
            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <SectionHeader
                  icon={Briefcase}
                  title="Internship Details"
                  subtitle="Specify the type and period of your internship, your supervisor and your online profiles."
                />

                {/* Stage type */}
                <Field label="Internship Type *">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {STAGE_TYPES.map(st => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => set("stageType", st.id)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                          data.stageType === st.id
                            ? "border-[#0D1926] bg-[#0D1926] text-white shadow-md"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        <span className={`text-sm font-black ${data.stageType === st.id ? "text-white" : "text-[#0D1926]"}`}>{st.label}</span>
                        <span className={`text-[10px] font-medium leading-tight ${data.stageType === st.id ? "text-slate-300" : "text-slate-400"}`}>{st.desc}</span>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Centre of Excellence Axis *" hint="Your axis personalizes your workspace. You can still choose any approved project.">
                  <select value={data.specialization} onChange={e => {
                    setData(current => ({ ...current, specialization: e.target.value, projectId: "", projectTitle: "", projectDomain: "", projectDescription: "" }));
                  }} className={inputCls}>
                    <option value="">Select your axis</option>
                    {CENTRE_OF_EXCELLENCE_AXES.map(axis => <option key={axis} value={axis}>{axis}</option>)}
                  </select>
                </Field>

                <Field label="Choose an internship project (optional)" hint="Only administrator-approved projects that have not been assigned to another student are shown. You can leave this empty and an administrator can assign a project later.">
                  <select value={data.projectId} onChange={e => {
                    const selected = availableProjects.find(project => String(project.id) === e.target.value);
                    setData(current => ({ ...current, projectId: e.target.value, projectTitle: selected?.title ?? "", projectDomain: selected?.domain ?? "", projectDescription: selected?.description ?? "" }));
                  }} className={inputCls}>
                    <option value="">No project yet — choose later</option>
                    {availableProjects.map(project => <option key={project.id} value={String(project.id)}>{project.title}{project.supervisorName ? ` · ${project.supervisorName}` : ""}</option>)}
                  </select>
                  {availableProjects.length === 0 && <p className="mt-2 text-xs text-slate-500">No approved projects are currently available. You can continue without one and choose later.</p>}
                  {data.projectId && <p className="mt-2 text-xs text-slate-600">The project details come from the official project record. Choose your mentor below.</p>}
                </Field>
                <Field label="Technologies (Stack) *" hint="Select the technologies used.">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                    {catalogTechnologies.map(ts => (
                      <label key={ts} className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-700 bg-white border border-slate-200 p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <input type="checkbox" checked={(data.projectStack || []).includes(ts)} onChange={e => {
                          const stack = data.projectStack || [];
                          if (e.target.checked) set("projectStack", [...stack, ts]);
                          else set("projectStack", stack.filter(s => s !== ts));
                        }} className="rounded border-slate-300 text-[#0D1926] focus:ring-[#0D1926]" />
                        <span className="truncate">{ts}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <input
                      value={data.customTechnology}
                      onChange={e => set("customTechnology", e.target.value)}
                      className={inputCls}
                      placeholder="Other technology"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const value = data.customTechnology.trim();
                        if (value && !data.projectStack.includes(value)) {
                          set("projectStack", [...data.projectStack, value]);
                        }
                        set("customTechnology", "");
                      }}
                      className="px-4 rounded-xl bg-[#0D1926] text-white text-xs font-semibold"
                    >
                      Add
                    </button>
                  </div>
                  {data.projectStack.filter(value => !catalogTechnologies.includes(value)).map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set("projectStack", data.projectStack.filter(item => item !== value))}
                      className="mt-2 mr-2 inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"
                    >
                      {value} <X className="w-3 h-3" />
                    </button>
                  ))}
                </Field>

                {/* Période */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date *">
                    <input
                      type="date" value={data.startDate}
                      onChange={e => set("startDate", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="End date *">
                    <input
                      type="date" value={data.endDate} min={data.startDate}
                      onChange={e => set("endDate", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>

                {/* Encadrant entreprise */}
                <Field label="Company Mentor" hint="Choose your mentor, unless an administrator has already assigned you and your supervisor to a project.">
                  <select
                    value={data.encadrant}
                    onChange={e => set("encadrant", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">No mentor selected — use my administrator assignment</option>
                    {(supervisors || []).map(s => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name}{s.post ? ` · ${s.post}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* LinkedIn */}
                <Field label="LinkedIn URL">
                  <InputIcon icon={Linkedin} type="url" placeholder="https://linkedin.com/in/your-profile" value={data.linkedin} onChange={v => set("linkedin", v)} />
                </Field>

                {/* GitHub */}
                <Field label="GitHub URL">
                  <InputIcon icon={Github} type="url" placeholder="https://github.com/your-username" value={data.github} onChange={v => set("github", v)} />
                </Field>

                {/* Password */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Create a password</p>
                  <Field label="Password * (min. 12 chars with letters and digits)">
                    <InputIcon icon={User} type="password" placeholder="••••••••" value={data.password} onChange={v => set("password", v)} />
                  </Field>
                  <Field label="Confirm password *">
                    <div className="relative">
                      <InputIcon icon={Check} type="password" placeholder="••••••••" value={data.confirmPassword} onChange={v => set("confirmPassword", v)} />
                      {data.confirmPassword && data.password !== data.confirmPassword && (
                        <p className="text-[11px] text-red-500 mt-1 font-medium">Passwords do not match.</p>
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {/* ═══════════ STEP 4 : CONFIRMATION ═══════════ */}
            {step === 4 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">All set!</h3>
                    <p className="text-[11px] text-slate-500">Check your information before submitting your registration. A verification code will be sent to your email.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Identity */}
                  <ConfirmCard icon={User} title="Identity">
                    <div className="flex items-center gap-3">
                      {data.photo && <img src={data.photo} alt="Profile" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />}
                      <div>
                        <p className="text-xs font-bold text-slate-900">{data.firstName} {data.lastName}</p>
                        <p className="text-[11px] text-slate-500">{data.email}</p>
                        <p className="text-[11px] text-slate-500">{data.phone}</p>
                      </div>
                    </div>
                    {data.idCardFile && (
                      <div className="flex items-center gap-2 mt-2 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                        <IdCard className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[11px] text-slate-600 font-medium">CIN : {data.idCardFile.name}</span>
                      </div>
                    )}
                  </ConfirmCard>

                  {/* University */}
                  <ConfirmCard icon={GraduationCap} title="University & Documents">
                    <p className="text-xs font-bold text-slate-800">{universityDisplayName}</p>
                    {(data.universityId !== "autre" ? selectedUniversity?.url : data.universityUrl) && (
                      <a href={data.universityId !== "autre" ? selectedUniversity?.url : data.universityUrl} target="_blank" rel="noreferrer"
                        className="text-[11px] text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                        <Globe className="w-3 h-3" />
                        {data.universityId !== "autre" ? selectedUniversity?.url : data.universityUrl}
                      </a>
                    )}
                    {data.conventionFile && (
                      <div className="flex items-center gap-2 mt-2 bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-100">
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[11px] text-emerald-700 font-medium">{data.conventionName}</span>
                      </div>
                    )}
                  </ConfirmCard>

                  {/* Internship */}
                  <ConfirmCard icon={Briefcase} title="Internship">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#0D1926] text-white uppercase">
                        {STAGE_TYPES.find(s => s.id === data.stageType)?.label ?? "—"}
                      </span>
                      <span className="text-[11px] text-slate-500">{data.startDate} → {data.endDate}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2"><span className="font-bold text-slate-700">Project: </span>{data.projectTitle} ({data.projectDomain})</p>
                    <p className="text-[11px] text-slate-600 mt-1"><span className="font-bold text-slate-700">Stack: </span>{(data.projectStack || []).join(", ")}</p>
                    <p className="text-[11px] text-slate-600 mt-1"><span className="font-bold text-slate-700">Description: </span>{data.projectDescription}</p>
                    <p className="text-[11px] text-slate-600 mt-1"><span className="font-bold text-slate-700">Supervisor: </span>{supervisors.find((s) => String(s.id) === data.encadrant)?.name ?? "—"}</p>
                    {data.linkedin && (
                      <a href={data.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] text-blue-500 hover:underline mt-1">
                        <Linkedin className="w-3 h-3" /> LinkedIn
                      </a>
                    )}
                    {data.github && (
                      <a href={data.github} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:underline mt-1">
                        <Github className="w-3 h-3" /> GitHub
                      </a>
                    )}
                  </ConfirmCard>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    By clicking &ldquo;Submit Registration&rdquo;, a verification code will be sent to <strong>{data.email}</strong>. You will need to enter it to activate your account.
                  </p>
                </div>
              </div>
            )}

            {/* ═══════════ STEP 5 : VÉRIFICATION EMAIL ═══════════ */}
            {step === 5 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Email Verification</h2>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-relaxed">
                      A verification code has been sent to <strong className="text-slate-700">{data.email}</strong>. Check your email inbox.
                    </p>
                  </div>
                </div>

                {/* Inbox hint */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-blue-800">Code sent!</p>
                    <p className="text-[11px] text-blue-600 mt-0.5 leading-relaxed">
                      For security, the code was sent only to your real email address.
                    </p>
                  </div>
                </div>

                {/* Code input */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Verification code *</label>
                  <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={handleVerificationPaste}>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <input
                        key={index}
                        ref={(element) => { verificationRefs.current[index] = element; }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        value={verifCode[index] ?? ""}
                        onChange={(e) => updateVerificationDigit(index, e.target.value)}
                        onKeyDown={(e) => handleVerificationKey(index, e)}
                        aria-label={`Verification code digit ${index + 1}`}
                        className={`aspect-square min-w-0 w-full rounded-xl border bg-white text-center text-xl sm:text-2xl font-semibold text-[#0D1926] outline-none transition-all ${
                          verifError
                            ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
                            : "border-slate-200 focus:border-[#0D1926] focus:ring-2 focus:ring-[#0D1926]/10"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-center text-[11px] font-semibold ${expired ? "text-red-600" : "text-slate-400"}`}>
                    {expired
                      ? "Code expired. Resend a new code to continue."
                      : `Code expires in 00:${String(secondsRemaining).padStart(2, "0")}`}
                  </p>
                  {verifError && (
                    <p className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                      <X className="w-3 h-3" /> {verifError}
                    </p>
                  )}
                </div>

                {/* Resend */}
                <button
                  type="button"
                  onClick={() => {
                    void sendVerificationEmail();
                    setVerifCode("");
                    setVerifError("");
                  }}
                  disabled={!expired || resendingCode}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#0D1926] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendingCode ? "Sending code…" : expired ? "Resend code" : "Resend available when the timer ends"}
                </button>
              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <button
              onClick={back}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm ${step === 1 || step === 5 ? "invisible" : ""}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>

            {step < 4 ? (
              <button
                onClick={next}
                disabled={!canNext()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#0D1926] text-white text-xs font-bold hover:bg-[#152332] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : step === 4 ? (
              <div className="flex flex-col items-end gap-2">
                {submitError && (
                  <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg font-medium w-full text-center">
                    {submitError}
                  </div>
                )}
                <button
                  onClick={submitRegistration}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mail className="w-3.5 h-3.5" /> {submitting ? "Sending..." : "Submit Registration"}
                </button>
              </div>
            ) : (
              <button
                onClick={finish}
                disabled={verifCode.length !== 6 || expired}
                className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-[#0D1926] text-white text-xs font-bold hover:bg-[#152332] transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5" /> Verify & Activate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/30 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#0D1926] focus:ring-2 focus:ring-[#0D1926]/10 transition-all hover:border-slate-300";

function InputIcon({
  icon: Icon, placeholder, value, onChange, type = "text"
}: { icon: React.ElementType; placeholder: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} pl-10`}
      />
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-700">{label}</label>
      {hint && <p className="text-[11px] text-slate-400 font-medium leading-tight">{hint}</p>}
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#0D1926]/8 border border-[#0D1926]/10 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-[#0D1926]" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
}

function ConfirmCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <div className="w-5 h-5 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center">
          <Icon className="w-3 h-3 text-[#0D1926]" />
        </div>
        <p className="text-[10px] font-bold text-[#0D1926] uppercase tracking-wider">{title}</p>
      </div>
      {children}
    </div>
  );
}

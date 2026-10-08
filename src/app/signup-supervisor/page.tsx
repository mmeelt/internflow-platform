"use client";

import { useState, useRef } from "react";
import { register as registerUser, verifyRegistrationCode, resendRegistrationCode, ApiError } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Camera,
  User as UserIcon, // Renamed here to avoid global namespace collision
  Mail,
  Phone,
  Briefcase,
  LayoutGrid,
  Eye,
  EyeOff,
  Check,
  ChevronRight,
  ChevronLeft,
  Shield,
  KeyRound,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { readProfilePhoto } from "@/lib/profile-photo";
import { useVerificationCountdown } from "@/lib/useVerificationCountdown";

/* ─────────────────────────── CONSTANTS ─────────────────────────── */

const POSTES = [
  "AI Consultant",
  "Data Consultant",
  "Industry 4.0 Consultant",
  "Business Developer",
  "Process Manager",
  "Automation Consultant",
  "Supply Chain Consultant",
  "Other",
];

const DEPARTEMENTS = [
  "Innovation",
  "Other",
];

const SPECIALIZATIONS = [
  "AI Centre of Excellence",
  "Industry 4.0 Centre of Excellence",
];

const steps = [
  { id: 1, label: "Personal Information", short: "Profile" },
  { id: 2, label: "Role & Department",    short: "Role" },
  { id: 3, label: "Confirmation",         short: "Confirm" },
  { id: 4, label: "Email Verification",   short: "Verify" },
];

/* ─────────────────────────── MAIN PAGE ─────────────────────────── */

export default function SignUpSupervisor() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [verifCode, setVerifCode] = useState("");
  const [verifError, setVerifError] = useState("");
  const [resendingCode, setResendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const verificationRefs = useRef<Array<HTMLInputElement | null>>([]);
  const { secondsRemaining, expired, restart: restartCountdown } = useVerificationCountdown();
  // Keep signup options curated instead of exposing values collected from
  // existing profiles through an unauthenticated endpoint.
  const catalog = { posts: POSTES, departments: DEPARTEMENTS, specializations: SPECIALIZATIONS };

  const [data, setData] = useState({
    firstName: "",
    lastName:  "",
    email:     "",
    phone:     "",
    photo:     "",
    password:  "",
    confirmPassword: "",
    poste:      "",
    customPost: "",
    department: "Innovation",
    customDepartment: "",
    specialization: "",
    customSpecialization: "",
    entreprise: "InternFlow",
    bio:        "",
  });

  const set = (k: keyof typeof data, v: any) =>
    setData(p => ({ ...p, [k]: v }));

  const selectedPost = data.poste === "Other" ? data.customPost.trim() : data.poste;
  const selectedDepartment = data.department === "Other" ? data.customDepartment.trim() : data.department;

  const canNext = () => {
    if (step === 1) return (
      data.firstName.trim() && data.lastName.trim() &&
      data.email.trim() && data.email.includes("@") &&
      data.phone.trim() &&
      data.password.length >= 12 && /[A-Za-z]/.test(data.password) && /\d/.test(data.password) && data.password === data.confirmPassword
    );
    if (step === 2) return data.poste && data.department && data.specialization
      && (data.poste !== "Other" || data.customPost.trim())
      && (data.department !== "Other" || data.customDepartment.trim())
      && (data.specialization !== "Other" || data.customSpecialization.trim());
    return true;
  };

  const next   = () => { if (canNext() && step < 3) setStep(s => s + 1); };
  const back   = () => { if (step > 1) setStep(s => s - 1); };

  const sendVerificationEmail = async () => {
    if (!challengeId || resendingCode) return;
    setResendingCode(true);
    setVerifError("");
    try {
      const challenge = await resendRegistrationCode(challengeId);
      setChallengeId(challenge.challengeId);
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

  const submitRegistration = async () => {
    setSubmitError("");
    setSubmitting(true);
    try {
      const result = await registerUser({
        email:    data.email.trim().toLowerCase(),
        password: data.password,
        name:     `${data.firstName.trim()} ${data.lastName.trim()}`,
        role:     "supervisor",
        photoUrl: data.photo || null,
        phone: data.phone.trim(),
        bio: data.bio.trim(),
        organization: data.entreprise.trim(),
        department: (data.department === "Other" ? data.customDepartment : data.department).trim(),
        post: (data.poste === "Other" ? data.customPost : data.poste).trim(),
        specialization: (data.specialization === "Other" ? data.customSpecialization : data.specialization).trim(),
      });
      setChallengeId(result.challengeId);
      restartCountdown(result.expiresIn);
      setStep(4);
      toast.success(`Verification code sent to ${data.email}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Registration failed. Please try again.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

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

  const BrandLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
    <img src="/logo.svg" alt="InternFlow Logo" className={`${className} object-contain`} />
  );

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden grid grid-cols-1 md:grid-cols-12 font-sans antialiased bg-cream">

      {/* ── LEFT PANEL ── */}
        <div className="hidden md:flex md:col-span-5 p-8 lg:p-12 xl:p-16 flex-col justify-between relative overflow-hidden select-none h-full bg-slate-950">
          <div className="absolute inset-0 bg-cover bg-center brightness-[0.25] scale-105" style={{ backgroundImage: "url('/images.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/90 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 via-transparent to-slate-950/20 pointer-events-none" />

          <button onClick={() => router.push("/login")} className="group flex items-center gap-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors relative z-10 w-fit drop-shadow-md">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to login
          </button>

          <div className="relative z-10 max-w-sm my-auto space-y-6">
            <div className="flex items-center gap-4 text-white drop-shadow-xl">
              <BrandLogo className="w-11 h-11 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
              <div>
                <div className="text-xl font-black tracking-wider leading-none">INTERNFLOW</div>
                <div className="text-[10px] font-bold tracking-widest text-slate-300 mt-1 uppercase">Internship Management Platform</div>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Company Supervisor Portal</span>
            </div>

            <h2 className="text-2xl xl:text-3xl font-black tracking-tight text-white leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              Create your supervisor profile.
            </h2>
            <p className="text-xs xl:text-sm text-slate-200/90 font-medium leading-relaxed drop-shadow-sm">
              Manage your interns, track their progress and coordinate their projects from a dedicated dashboard.
            </p>

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

          <div className="relative z-10 text-xs text-slate-400 font-medium flex items-center gap-2 drop-shadow-md">
            <Building2 className="w-3.5 h-3.5" />
            <span>InternFlow Platform &copy; 2026</span>
          </div>
        </div>

      {/* ── RIGHT PANEL ── */}
      <div className="col-span-1 md:col-span-7 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 xl:p-16 md:h-full md:overflow-y-auto relative bg-cream">

        {(
          <div className="w-full max-w-[600px] flex justify-between items-center lg:hidden mb-4 px-2 pt-2">
            <button onClick={() => router.push("/login")} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="flex items-center gap-2 text-[#0D1926]">
              <BrandLogo className="w-4 h-4" />
              <span className="text-xs font-bold tracking-wider">INTERNFLOW</span>
            </div>
          </div>
        )}

        <div className="w-full max-w-[560px] bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col my-auto transition-all">

          {/* Progress header */}
          <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-slate-100 bg-white sticky top-0 z-20">
            <div className="flex justify-between mb-3 items-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step {step} / 4</span>
                <h2 className="text-sm font-bold text-slate-900 mt-0.5">{steps[step - 1].label}</h2>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                <Shield className="w-3 h-3 text-amber-600" />
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Supervisor</span>
              </div>
            </div>

            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }} />
            </div>

            <div className="flex justify-between mt-2.5 max-w-[200px]">
              {steps.map(s => (
                <div key={s.id} className="flex flex-col items-center gap-1">
                  <div className={`w-2 h-2 rounded-full transition-all ${step > s.id ? "bg-emerald-500" : step === s.id ? "bg-amber-500" : "bg-slate-200"}`} />
                  <span className={`text-[9px] font-semibold hidden sm:block ${step === s.id ? "text-amber-600" : "text-slate-400"}`}>{s.short}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white">

            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <SectionHeader icon={UserIcon} title="Personal Information" subtitle="Enter your personal details and create your account credentials." />

                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="relative w-14 h-14 rounded-xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center group overflow-hidden cursor-pointer hover:border-amber-400 transition-colors shrink-0">
                    {data.photo ? (
                      <img src={data.photo} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) void readProfilePhoto(file).then((value) => set("photo", value)).catch((error) => toast.error(error.message));
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Profile photo</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Click to add a professional photo</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name *">
                    <InputIcon iconElement={UserIcon} placeholder="e.g. Sami" value={data.firstName} onChange={v => set("firstName", v)} />
                  </Field>
                  <Field label="Last name *">
                    <InputIcon iconElement={UserIcon} placeholder="e.g. Trabelsi" value={data.lastName} onChange={v => set("lastName", v)} />
                  </Field>
                </div>

                <Field label="Professional email *">
                  <InputIcon iconElement={Mail} type="email" placeholder="s.trabelsi@company.com" value={data.email} onChange={v => set("email", v)} />
                </Field>

                <Field label="Phone number *">
                  <InputIcon iconElement={Phone} type="tel" placeholder="+216 XX XXX XXX" value={data.phone} onChange={v => set("phone", v)} />
                </Field>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <Field label="Password * (min. 12 chars with letters and digits)">
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input type={showPwd ? "text" : "password"} value={data.password} onChange={e => set("password", e.target.value)} placeholder="••••••••" className={`${inputCls} pl-10 pr-10`} />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">{showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                  </Field>

                  <Field label="Confirm password *">
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input type={showConfirmPwd ? "text" : "password"} value={data.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} placeholder="••••••••" className={`${inputCls} pl-10 pr-10`} />
                      <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">{showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                    {data.confirmPassword && data.password !== data.confirmPassword && (
                      <p className="text-[11px] text-red-500 mt-1 font-medium">Passwords do not match.</p>
                    )}
                  </Field>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <SectionHeader icon={Briefcase} title="Role & Department" subtitle="Indicate your role within your organisation." />

                <Field label="Company / Organization">
                  <InputIcon iconElement={Building2} placeholder="Company name" value={data.entreprise} onChange={v => set("entreprise", v)} />
                </Field>

                <Field label="Position / Title *">
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select value={data.poste} onChange={e => set("poste", e.target.value)} className={`${inputCls} pl-10 appearance-none cursor-pointer`}>
                      <option value="">-- Select your position --</option>
                      {catalog.posts.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </Field>
                {data.poste === "Other" && (
                  <Field label="New position *">
                    <InputIcon iconElement={Briefcase} placeholder="Write your position" value={data.customPost} onChange={v => set("customPost", v)} />
                  </Field>
                )}

                <Field label="Department *">
                  <div className="relative">
                    <LayoutGrid className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select value={data.department} onChange={e => set("department", e.target.value)} className={`${inputCls} pl-10 appearance-none cursor-pointer`}>
                      <option value="">-- Select your department --</option>
                      {catalog.departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </Field>
                {data.department === "Other" && (
                  <Field label="New department *">
                    <InputIcon iconElement={LayoutGrid} placeholder="Write your department" value={data.customDepartment} onChange={v => set("customDepartment", v)} />
                  </Field>
                )}

                <Field label="Centre of Excellence Axis *">
                  <div className="relative">
                    <LayoutGrid className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select value={data.specialization} onChange={e => set("specialization", e.target.value)} className={`${inputCls} pl-10 appearance-none cursor-pointer`}>
                      <option value="">-- Select your axis --</option>
                      {catalog.specializations.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                </Field>

                <Field label="Bio / Introduction (optional)">
                  <textarea value={data.bio} onChange={e => set("bio", e.target.value)} placeholder="e.g. Specialized in R&D and AI coordination..." rows={3} className={`${inputCls} resize-none`} />
                </Field>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 p-4 rounded-xl">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Account ready!</h3>
                    <p className="text-[11px] text-slate-500">A confirmation code will be sent to your email.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <ConfirmCard icon={UserIcon} title="Identity">
                    <p className="text-xs font-bold text-slate-900">{data.firstName} {data.lastName}</p>
                    <p className="text-[11px] text-slate-500">{data.email}</p>
                  </ConfirmCard>

                  <ConfirmCard icon={Briefcase} title="Role">
                    <p className="text-[11px] text-slate-700 font-semibold">{selectedPost} — {data.specialization}</p>
                  </ConfirmCard>
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <div className="space-y-5 animate-in zoom-in-95 duration-300">
                <div className="flex items-start gap-3">
                  <KeyRound className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Security Verification</h2>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Enter the code sent to <span className="text-slate-700 font-semibold">{data.email}</span></p>
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-800 leading-relaxed">
                  For security, your access code was sent only to your real email address.
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Secret code *</label>
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
                  {verifError && <p className="text-[11px] text-red-500 font-medium flex items-center gap-1"><X className="w-3 h-3" /> {verifError}</p>}
                </div>

                <button type="button" onClick={() => { void sendVerificationEmail(); setVerifCode(""); }} disabled={!expired || resendingCode} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D1926] transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                  <RefreshCw className="w-3.5 h-3.5" /> {resendingCode ? "Sending code…" : expired ? "Resend code" : "Resend available when the timer ends"}
                </button>
              </div>
            )}
          </div>

          {/* Navigation Action Buttons footer */}
          <div className="p-4 sm:px-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <button
              onClick={back}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all ${step === 1 || step === 4 ? "invisible" : ""}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>

            {step < 3 ? (
              <button onClick={next} disabled={!canNext()} className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-all disabled:opacity-40 shadow-sm">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : step === 3 ? (
              <div className="flex flex-col items-end gap-2">
                {submitError && (
                  <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg font-medium w-full text-center">
                    {submitError}
                  </div>
                )}
                <button
                  onClick={submitRegistration}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-[#0D1926] text-white text-xs font-bold hover:bg-[#152332] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Creating..." : "Create my supervisor account"}
                </button>
              </div>
            ) : (
              <button onClick={finish} disabled={verifCode.length !== 6 || expired} className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-[#0D1926] text-white text-xs font-bold hover:bg-[#152332] transition-all disabled:opacity-40">
                <Check className="w-3.5 h-3.5" /> Activate my account
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Already have an account?{" "}
          <button onClick={() => router.push("/login")} className="text-[#0D1926] font-bold hover:underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

const inputCls = "w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/30 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#0D1926] focus:ring-2 focus:ring-[#0D1926]/10 transition-all hover:border-slate-300";

// Changed prop name to iconElement to break global namespace collision
function InputIcon({ iconElement: IconComponent, placeholder, value, onChange, type = "text" }: { iconElement: React.ElementType; placeholder: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="relative">
      <IconComponent className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} pl-10`} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-700">{label}</label>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 pb-2">
      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>
      </div>
    </div>
  );
}

function ConfirmCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-50/50 rounded-xl border border-slate-200/60 p-4 space-y-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Building2, ShieldCheck, RefreshCw } from "lucide-react";

import { ApiError, login, logout, verifyLoginCode, resendLoginCode, requestPasswordReset, verifyPasswordResetCode, confirmPasswordReset } from "@/lib/auth";
import { useVerificationCountdown } from "@/lib/useVerificationCountdown";

const LOGIN_ERROR_MESSAGE = "Please verify your email and password.";

const roleDestination: Record<string, { signin: string }> = {
  student:    { signin: "/student" },
  supervisor: { signin: "/supervisor" },
  admin:      { signin: "/admin" },
};

export default function Login() {
  const router = useRouter();

  const [role, setRole] = useState("student");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetChallengeId, setResetChallengeId] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetCodeVerified, setResetCodeVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const resetCodeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const { secondsRemaining, expired, restart: restartCountdown } = useVerificationCountdown();
  const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    Object.values(roleDestination).forEach((dest) => {
      router.prefetch(dest.signin);
    });
  }, [router]);

  useEffect(() => {
    if (challengeId) {
      requestAnimationFrame(() => codeRefs.current[0]?.focus());
    }
  }, [challengeId]);

  useEffect(() => {
    if (resetChallengeId && !resetCodeVerified) {
      requestAnimationFrame(() => resetCodeRefs.current[0]?.focus());
    }
  }, [resetChallengeId, resetCodeVerified]);

const validate = (): string => {
  if (!email.trim()) return "Email is required.";
  if (!email.includes("@")) return "Enter a valid email address.";
  if (!password) return "Password is required.";
  return "";
};

const handleSubmit = async () => {
  setError("");
  const err = validate();
  if (err) { setError(err); return; }

  setSubmitting(true);
  try {
    const result = await login(email, password);
    if (!result.mfaRequired) {
      if (result.user.role !== role) {
        logout();
        setError(LOGIN_ERROR_MESSAGE);
        setSubmitting(false);
        return;
      }
      // A full navigation is deliberate here. It guarantees that the freshly
      // written session cookies are available to the protected dashboard and
      // prevents the sign-in button from being left in its loading state when
      // an App Router transition is interrupted.
      window.location.assign(roleDestination[result.user.role].signin);
      return;
    }
    setChallengeId(result.challengeId);
    restartCountdown(result.expiresIn);
    setPassword("");
    setSubmitting(false);
    return;
  } catch {
    setError(LOGIN_ERROR_MESSAGE);
    setSubmitting(false);
  }
};

const handleVerify = async () => {
  setError("");
  if (expired) {
    setError("This code has expired. Resend a new code to continue.");
    return;
  }
  if (!/^\d{6}$/.test(verificationCode)) {
    setError("Enter the 6-digit code sent to your email.");
    return;
  }
  setSubmitting(true);
  try {
    const session = await verifyLoginCode(challengeId, verificationCode);

    if (session.role !== role) {
      logout();
      setError(LOGIN_ERROR_MESSAGE);
      setSubmitting(false);
      return;
    }

    window.location.assign(roleDestination[session.role].signin);
  } catch {
    setError("Verify your code.");
    setSubmitting(false);
  }
};

const handleResend = async () => {
  if (!challengeId) return;
  setSubmitting(true);
  setError("");
  try {
    const challenge = await resendLoginCode(challengeId);
    setChallengeId(challenge.challengeId);
    setVerificationCode("");
    restartCountdown(challenge.expiresIn);
    requestAnimationFrame(() => codeRefs.current[0]?.focus());
  } catch {
    setError("Unable to resend the code. Please sign in again.");
  } finally {
    setSubmitting(false);
  }
};

const handlePasswordResetRequest = async () => {
  if (!email.includes("@")) {
    setError("Enter the email address for your account.");
    return;
  }
  setSubmitting(true);
  setError("");
  try {
    const challenge = await requestPasswordReset(email);
    if (!challenge.accountFound) {
      setResetChallengeId("");
      setResetMessage("");
      setError("Verify your email first. No active, verified account was found for this email address.");
      return;
    }
    setResetChallengeId(challenge.challengeId);
    setResetCode("");
    setResetCodeVerified(false);
    setNewPassword("");
    setConfirmNewPassword("");
    setResetMessage("A verification code has been sent to your email.");
    restartCountdown(challenge.expiresIn);
  } catch (requestError) {
    setError(requestError instanceof ApiError
      ? requestError.message
      : "Unable to start password reset. Please try again later.");
  } finally {
    setSubmitting(false);
  }
};

const handlePasswordResetCodeVerify = async () => {
  if (expired) {
    setError("This code has expired. Start again to receive a new one.");
    return;
  }
  if (!/^\d{6}$/.test(resetCode)) {
    setError("Enter the 6-digit code from your email.");
    return;
  }
  setSubmitting(true);
  setError("");
  try {
    await verifyPasswordResetCode(resetChallengeId, resetCode);
    setResetCodeVerified(true);
  } catch {
    setError("That reset code is invalid or expired. Request a new one.");
  } finally {
    setSubmitting(false);
  }
};

const handlePasswordResetConfirm = async () => {
  if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    setError("Use a password with at least 12 characters, including letters and digits.");
    return;
  }
  if (newPassword !== confirmNewPassword) {
    setError("The new password and confirmation do not match.");
    return;
  }
  setSubmitting(true);
  setError("");
  try {
    const session = await confirmPasswordReset(resetChallengeId, resetCode, newPassword);
    setShowResetModal(false);
    setResetChallengeId("");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPassword("");
    setResetMessage("");
    window.location.assign(roleDestination[session.role].signin);
  } catch {
    setError("That reset code is invalid or expired. Request a new one.");
  } finally {
    setSubmitting(false);
  }
};

const updateCodeDigit = (index: number, value: string) => {
  const digit = value.replace(/\D/g, "").slice(-1);
  const digits = verificationCode.padEnd(6, " ").split("");
  digits[index] = digit || " ";
  setVerificationCode(digits.join("").trimEnd());
  setError("");
  if (digit && index < 5) codeRefs.current[index + 1]?.focus();
};

const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
    codeRefs.current[index - 1]?.focus();
  } else if (e.key === "ArrowLeft" && index > 0) {
    codeRefs.current[index - 1]?.focus();
  } else if (e.key === "ArrowRight" && index < 5) {
    codeRefs.current[index + 1]?.focus();
  } else if (e.key === "Enter") {
    void handleVerify();
  }
};

const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  e.preventDefault();
  const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
  setVerificationCode(pasted);
  setError("");
  codeRefs.current[Math.min(pasted.length, 5)]?.focus();
};

const updateResetCodeDigit = (index: number, value: string) => {
  const digit = value.replace(/\D/g, "").slice(-1);
  const digits = resetCode.padEnd(6, " ").split("");
  digits[index] = digit || " ";
  setResetCode(digits.join("").trimEnd());
  setError("");
  if (digit && index < 5) resetCodeRefs.current[index + 1]?.focus();
};

const handleResetCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Backspace" && !resetCode[index] && index > 0) {
    resetCodeRefs.current[index - 1]?.focus();
  } else if (e.key === "ArrowLeft" && index > 0) {
    resetCodeRefs.current[index - 1]?.focus();
  } else if (e.key === "ArrowRight" && index < 5) {
    resetCodeRefs.current[index + 1]?.focus();
  } else if (e.key === "Enter") {
    void handlePasswordResetCodeVerify();
  }
};

const handleResetCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  e.preventDefault();
  const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
  setResetCode(pasted);
  setError("");
  resetCodeRefs.current[Math.min(pasted.length, 5)]?.focus();
};

  const handleKey = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") challengeId ? handleVerify() : handleSubmit();
  };

  // Re-usable component referencing the absolute location of your transparent logo image asset
  const BrandLogo = ({ className = "w-5 h-5" }: { className?: string; isDark?: boolean }) => (
    <img
      src="/logo.svg"
      alt="InternFlow Logo"
      className={`${className} object-contain`}
    />
  );

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 font-sans antialiased bg-cream">

      {/* ── LEFT PANEL WITH HIGH-TECH SHADOWED BACKGROUND IMAGE ── */}
      <div className="hidden lg:flex lg:col-span-5 p-12 xl:p-16 flex-col justify-between relative overflow-hidden select-none h-full bg-slate-950">

        {/* Dynamic Background Image Layer using images.jpg */}
        <div
          className="absolute inset-0 bg-cover bg-center brightness-[0.25] scale-105 transition-all duration-700"
          style={{ backgroundImage: "url('/images.jpg')" }}
        />

        {/* Deep Multi-directional Gradient Shadows to enhance text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/90 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 via-transparent to-slate-950/20 pointer-events-none" />

        {/* Written content placed cleanly on top of shadowed background image */}
        <div className="relative z-10 max-w-sm my-auto space-y-6">
          <div className="flex items-center gap-4 text-white drop-shadow-xl">
            {/* Swapped custom vector nodes directly for the clean asset image wrapper component */}
            <BrandLogo className="w-11 h-11 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
            <div>
              <div className="text-xl font-black tracking-wider leading-none">INTERNFLOW</div>
              <div className="text-[10px] font-bold tracking-widest text-slate-300 mt-1 uppercase">
                Internship Management Platform
              </div>
            </div>
          </div>

          <h2 className="text-2xl xl:text-3xl font-black tracking-tight text-white leading-tight pt-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            The ecosystem driving future-ready technology.
          </h2>

          <p className="text-xs xl:text-sm text-slate-200/90 font-medium leading-relaxed drop-shadow-sm">
            Access your secure portal workspace to manage innovative research, coordinate enterprise solutions, and track division outcomes.
          </p>
        </div>

        <div className="relative z-10 text-xs text-slate-400 font-medium flex items-center gap-2 drop-shadow-md">
          <Building2 className="w-3.5 h-3.5" />
          <span>InternFlow Platform &copy; 2026</span>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="col-span-1 lg:col-span-7 flex flex-col justify-center items-center p-4 sm:p-10 lg:p-12 xl:p-16 lg:h-full lg:overflow-y-auto relative bg-cream">
        <button
          type="button"
          onClick={() => router.push("/axes")}
          className="absolute left-5 top-5 hidden items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 lg:flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Change centre
        </button>

        {/* Mobile Top Bar */}
        <div className="w-full max-w-md flex justify-between items-center lg:hidden mb-6 px-2 pt-4">
          <button
            onClick={() => router.push("/axes")}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-2 text-[#0D1926]">
            <BrandLogo className="w-4 h-4" isDark={true} />
            <span className="text-xs font-bold tracking-wider">INTERNFLOW</span>
          </div>
        </div>

        <div className="w-full max-w-[440px] bg-white p-6 sm:p-8 rounded-3xl border border-border shadow-card my-auto">
          <div className="mb-5">
            {showResetModal ? (
              <div className="text-center pt-1">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#0D1926] text-white">
                  <Mail className="h-5 w-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1 tracking-tight">
                  {resetChallengeId ? (resetCodeVerified ? "Create a new password" : "Verify your code") : "Reset your password"}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  {!resetChallengeId
                    ? "Step 1 of 3: enter your account email."
                    : resetCodeVerified
                      ? "Step 3 of 3: choose your new password."
                      : `Step 2 of 3: enter the six-digit code sent to ${email}.`}
                </p>
              </div>
            ) : challengeId ? (
              <div className="text-center pt-1">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#0D1926] text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1 tracking-tight">Confirm your email</h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  We sent a six-digit code to <strong className="text-slate-700">{email}</strong>
                </p>
              </div>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1 tracking-tight">Welcome Back</h1>
                <p className="text-xs sm:text-sm text-slate-500">Please enter your workspace details to continue.</p>
              </>
            )}
          </div>

          {!challengeId && !showResetModal && <div className="flex gap-1 mb-5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/40">
            {[
              { id: "student", label: "Student" },
              { id: "supervisor", label: "Supervisor" },
              { id: "admin", label: "Admin" }
            ].map(r => (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); setError(""); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  role === r.id
                    ? "bg-white text-[#0D1926] shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-900 border border-transparent"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>}

          <div className="space-y-3.5">
            {showResetModal ? (
              resetChallengeId ? (
                <>
                  {!resetCodeVerified ? <>
                  {resetMessage && <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-center text-xs text-emerald-700">{resetMessage}</p>}
                  <div className="py-1">
                    <label className="mb-2 block text-xs font-semibold text-slate-700">Verification code</label>
                    <div className="grid grid-cols-6 gap-2 sm:gap-2.5" onPaste={handleResetCodePaste}>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <input
                          key={index}
                          ref={(element) => { resetCodeRefs.current[index] = element; }}
                          type="text"
                          inputMode="numeric"
                          autoComplete={index === 0 ? "one-time-code" : "off"}
                          maxLength={1}
                          value={resetCode[index] ?? ""}
                          onChange={(e) => updateResetCodeDigit(index, e.target.value)}
                          onKeyDown={(e) => handleResetCodeKeyDown(index, e)}
                          aria-label={`Reset code digit ${index + 1}`}
                          className="aspect-square min-w-0 w-full rounded-xl border border-slate-200 bg-white text-center text-xl sm:text-2xl font-semibold text-[#0D1926] outline-none transition-all focus:border-[#0D1926] focus:ring-2 focus:ring-[#0D1926]/10"
                        />
                      ))}
                    </div>
                    <p className={`mt-2 text-center text-[11px] font-medium ${expired ? "text-red-600" : "text-slate-400"}`}>
                      {expired ? "Code expired. Start again to receive a new one." : `Code expires in ${formatCountdown(secondsRemaining)}`}
                    </p>
                  </div>
                  </> : <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">New password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(""); }} placeholder="12+ characters, including a digit" className="w-full rounded-xl border border-slate-200 bg-slate-50/30 py-2 pl-10 pr-10 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-[#0D1926] focus:bg-white focus:ring-2 focus:ring-[#0D1926]/10" />
                      <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} aria-label={showNewPassword ? "Hide password" : "Show password"} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800">{showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">Use at least 12 characters, including letters and digits.</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Confirm new password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type={showNewPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => { setConfirmNewPassword(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") void handlePasswordResetConfirm(); }} placeholder="Repeat your new password" className="w-full rounded-xl border border-slate-200 bg-slate-50/30 py-2 pl-10 pr-4 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-[#0D1926] focus:bg-white focus:ring-2 focus:ring-[#0D1926]/10" />
                    </div>
                  </div>
                  </>}
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") void handlePasswordResetRequest(); }} placeholder="name@domain.com" className="w-full rounded-xl border border-slate-200 bg-slate-50/30 py-2 pl-10 pr-4 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-[#0D1926] focus:bg-white focus:ring-2 focus:ring-[#0D1926]/10" />
                  </div>
                </div>
              )
            ) : challengeId ? (
              <div className="py-2">
                <div className="grid grid-cols-6 gap-2 sm:gap-2.5" onPaste={handleCodePaste}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <input
                      key={index}
                      ref={(element) => { codeRefs.current[index] = element; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={verificationCode[index] ?? ""}
                      onChange={(e) => updateCodeDigit(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      aria-label={`Verification code digit ${index + 1}`}
                      className="aspect-square min-w-0 w-full rounded-xl border border-slate-200 bg-white text-center text-xl sm:text-2xl font-semibold text-[#0D1926] outline-none transition-all focus:border-[#0D1926] focus:ring-2 focus:ring-[#0D1926]/10"
                    />
                  ))}
                </div>
                <p className={`mt-3 text-center text-[11px] font-medium ${expired ? "text-red-600" : "text-slate-400"}`}>
                  {expired
                    ? "Code expired. Resend a new code to continue."
                    : `Code expires in ${formatCountdown(secondsRemaining)}`}
                </p>
              </div>
            ) : (
              <>
            {!challengeId && <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  onKeyDown={handleKey}
                  placeholder="name@domain.com"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/30 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#0D1926] focus:ring-2 focus:ring-[#0D1926]/10 transition-all hover:border-slate-300"
                />
              </div>
            </div>}
              </>
            )}

            {!challengeId && !showResetModal && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={handleKey}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 rounded-xl border border-slate-200 bg-slate-50/30 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#0D1926] focus:ring-2 focus:ring-[#0D1926]/10 transition-all hover:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            )}

            <div className="min-h-5 empty:hidden">
              {error && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg font-medium">
                  {error}
                </div>
              )}
            </div>

            <button
              onClick={showResetModal ? (resetChallengeId ? (resetCodeVerified ? handlePasswordResetConfirm : handlePasswordResetCodeVerify) : handlePasswordResetRequest) : (challengeId ? handleVerify : handleSubmit)}
              disabled={submitting || (Boolean(challengeId || resetChallengeId) && expired)}
              className="w-full py-2 rounded-xl font-semibold text-white text-xs sm:text-sm shadow-sm transition-all disabled:opacity-50 hover:bg-[#152332] bg-[#0D1926]"
            >
              {submitting
                ? "Please wait..."
                : showResetModal
                  ? (resetChallengeId ? (resetCodeVerified ? "Reset password and sign in" : "Verify code") : "Send verification code")
                  : challengeId ? "Verify and sign in" : "Sign in to Workspace"}
            </button>
            {!challengeId && !showResetModal && (
              <button
                type="button"
                onClick={() => { setShowResetModal(true); setError(""); setResetMessage(""); setResetChallengeId(""); setResetCode(""); setResetCodeVerified(false); setNewPassword(""); setConfirmNewPassword(""); }}
                className="w-full text-xs font-semibold text-[#0D1926] hover:underline"
              >
                Forgot your password?
              </button>
            )}
            {challengeId && (
              <button
                type="button"
                onClick={handleResend}
                disabled={submitting || !expired}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-[#0D1926] hover:underline disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> {expired ? "Resend code" : "Resend available when the timer ends"}
              </button>
            )}
            {challengeId && (
              <button
                type="button"
                onClick={() => { setChallengeId(""); setVerificationCode(""); setError(""); restartCountdown(0); }}
                className="w-full text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                Use a different email
              </button>
            )}
            {showResetModal && (
              <button
                type="button"
                onClick={() => { setShowResetModal(false); setResetChallengeId(""); setResetCode(""); setResetCodeVerified(false); setNewPassword(""); setConfirmNewPassword(""); setResetMessage(""); setError(""); restartCountdown(0); }}
                className="w-full text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                {resetChallengeId ? "Use a different email" : "Back to sign in"}
              </button>
            )}
          </div>



          {!challengeId && !showResetModal && <div className="mt-5 space-y-2 text-center">
            <span className="text-xs text-slate-500 block">
              Intern student?{" "}
              <button onClick={() => router.push("/setup")} className="text-[#0D1926] font-bold hover:underline transition-colors">
                Create a student account
              </button>
            </span>
            <span className="text-xs text-slate-500 block">
              Company supervisor?{" "}
              <button onClick={() => router.push("/signup-supervisor")} className="text-amber-600 font-bold hover:underline transition-colors">
                Create a supervisor account
              </button>
            </span>
          </div>}

        </div>
      </div>
    </div>
  );
}

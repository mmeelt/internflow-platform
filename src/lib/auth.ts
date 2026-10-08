"use client";

import { api, setTokens, clearTokens, getAccessToken, ApiError } from "./api";

export type Role = "student" | "supervisor" | "admin";

export interface Session {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: string;
  photoUrl: string | null;
  post: string | null;
}

interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: Session;
}

const SESSION_KEY = "internflow_session";
let restorePromise: Promise<Session | null> | null = null;

/** Set lightweight cookies readable by the Next.js middleware (not httpOnly). */
function setAuthCookies(role: Role) {
  if (typeof document === "undefined") return;
  // 7-day expiry — same as typical refresh token lifetime
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `internflow_logged_in=1; path=/; expires=${expires}; SameSite=Lax`;
  document.cookie = `internflow_role=${role}; path=/; expires=${expires}; SameSite=Lax`;
}

/** Clear the middleware cookies on logout. */
function clearAuthCookies() {
  if (typeof document === "undefined") return;
  document.cookie = "internflow_logged_in=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "internflow_role=; path=/; max-age=0; SameSite=Lax";
}

function persistSession(user: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("internflow-session-changed"));
}

export interface MfaChallenge {
  challengeId: string;
  mfaRequired: true;
  expiresIn: number;
}

export type LoginResult =
  | MfaChallenge
  | { mfaRequired: false; user: Session };

export interface RegistrationResult {
  message: string;
  challengeId: string;
  expiresIn: number;
}

export interface PasswordResetChallenge {
  challengeId: string;
  expiresIn: number;
  accountFound: boolean;
}

export function getLoggedInUser(): Session | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as Session;
  } catch {
    return null;
  }
}

export function updateStoredSession(patch: Partial<Session>) {
  const current = getLoggedInUser();
  if (!current) return;
  persistSession({ ...current, ...patch });
  window.dispatchEvent(new Event("internflow-session-changed"));
}

/** Rebuilds the in-memory access token from the HttpOnly refresh cookie. */
export async function restoreSession(): Promise<Session | null> {
  const current = getLoggedInUser();
  if (current && getAccessToken()) return current;
  if (restorePromise) return restorePromise;

  restorePromise = (async () => {
    try {
      const res = await api.post<AuthResponse>("/api/auth/refresh", undefined, { skipAuth: true });
      setTokens(res.accessToken);
      persistSession(res.user);
      setAuthCookies(res.user.role);
      return res.user;
    } catch {
      clearTokens();
      if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
      clearAuthCookies();
      return null;
    }
  })();

  try {
    return await restorePromise;
  } finally {
    restorePromise = null;
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const result = await api.post<MfaChallenge | AuthResponse>(
    "/api/auth/login",
    { email, password },
    { skipAuth: true },
  );
  if ("accessToken" in result) {
    setTokens(result.accessToken);
    persistSession(result.user);
    setAuthCookies(result.user.role);
    return { mfaRequired: false, user: result.user };
  }
  return result;
}

export async function verifyLoginCode(challengeId: string, code: string): Promise<Session> {
  const res = await api.post<AuthResponse>(
    "/api/auth/login/verify",
    { challengeId, code },
    { skipAuth: true },
  );
  setTokens(res.accessToken);
  persistSession(res.user);
  setAuthCookies(res.user.role);
  return res.user;
}

export async function resendLoginCode(challengeId: string): Promise<MfaChallenge> {
  return api.post<MfaChallenge>(
    `/api/auth/login/resend/${challengeId}`,
    undefined,
    { skipAuth: true },
  );
}

export function requestPasswordReset(email: string): Promise<PasswordResetChallenge> {
  return api.post<PasswordResetChallenge>("/api/auth/password-reset", { email }, { skipAuth: true });
}

export function verifyPasswordResetCode(challengeId: string, code: string): Promise<void> {
  return api.post<void>("/api/auth/password-reset/verify", { challengeId, code }, { skipAuth: true });
}

export async function confirmPasswordReset(challengeId: string, code: string, newPassword: string): Promise<Session> {
  const res = await api.post<AuthResponse>(
    "/api/auth/password-reset/confirm",
    { challengeId, code, newPassword },
    { skipAuth: true },
  );
  setTokens(res.accessToken);
  persistSession(res.user);
  setAuthCookies(res.user.role);
  return res.user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post<void>("/api/auth/password/change", { currentPassword, newPassword });
  logout();
}

export async function register(params: {
  email: string;
  password: string;
  name: string;
  role: "student" | "supervisor";
  photoUrl?: string | null;
  phone?: string;
  bio?: string;
  university?: string;
  department?: string;
  domain?: string;
  year?: string;
  previousInternships?: string;
  enterprise?: string;
  subjectOfInternship?: string;
  skills?: string[];
  supervisorId?: number;
  projectId?: number;
  startDate?: string;
  endDate?: string;
  organization?: string;
  post?: string;
  specialization?: string;
  otherEncadrantInfo?: string;
  yearsExperience?: number;
}): Promise<RegistrationResult> {
  return api.post<RegistrationResult>("/api/auth/register", params, { skipAuth: true });
}

export async function verifyRegistrationCode(challengeId: string, code: string): Promise<void> {
  await api.post<void>("/api/auth/register/verify", { challengeId, code }, { skipAuth: true });
}

export async function uploadStudentRegistrationDocuments(challengeId: string, identityCard: File, internshipAgreement: File): Promise<void> {
  const form = new FormData();
  form.append("identityCard", identityCard);
  form.append("internshipAgreement", internshipAgreement);
  await api.post<void>(`/api/auth/register/${encodeURIComponent(challengeId)}/documents`, form, { skipAuth: true });
}

export async function resendRegistrationCode(challengeId: string): Promise<MfaChallenge> {
  return api.post<MfaChallenge>(`/api/auth/register/resend/${challengeId}`, undefined, { skipAuth: true });
}

export function logout() {
  // Clearing the HttpOnly cookie has to be performed by the API; JS cannot
  // inspect or delete it directly.
  void api.post<void>("/api/auth/logout", undefined, { skipAuth: true }).catch(() => undefined);
  clearTokens();
  localStorage.removeItem(SESSION_KEY);
  clearAuthCookies();
}

export { ApiError };

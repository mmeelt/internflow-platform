"use client";

/**
 * Central API client. Every real request to the Spring Boot backend goes
 * through here so token attachment, refresh, and error handling live in
 * exactly one place instead of being copy-pasted into every page.
 *
 * Set NEXT_PUBLIC_API_URL in .env.local, e.g.:
 *   NEXT_PUBLIC_API_URL=http://localhost:8081
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

const GET_CACHE_TTL_MS = 15_000;
const getCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();
let accessToken: string | null = null;

export function clearRequestCache() {
  getCache.clear();
}

// The short-lived access token lives only in this module's memory. The backend
// keeps the refresh token in an HttpOnly, SameSite cookie, so browser scripts
// cannot read either long-lived credential.

export function getAccessToken(): string | null {
  return accessToken;
}

export function setTokens(token: string) {
  clearRequestCache();
  accessToken = token;
  // Remove credentials left by the pre-cookie implementation.
  if (typeof window !== "undefined") {
    localStorage.removeItem("internflow_access_token");
    localStorage.removeItem("internflow_refresh_token");
  }
}

export function clearTokens() {
  clearRequestCache();
  accessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("internflow_access_token");
    localStorage.removeItem("internflow_refresh_token");
  }
}

export class ApiError extends Error {
  status: number;
  details?: Record<string, string>;
  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let refreshPromise: Promise<string> | null = null;

/** Calls POST /api/auth/refresh at most once even if several requests 401 simultaneously. */
async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      clearTokens();
      throw new ApiError(res.status, "Session expired, please log in again");
    }

    const data = await res.json();
    setTokens(data.accessToken);
    return data.accessToken as string;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip attaching Authorization header (e.g. login/register calls) */
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;

  const isFormData = body instanceof FormData;
  const finalHeaders: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
    credentials: "include",
  });

  // Access token expired mid-session -> refresh once, then retry the original call
  if (res.status === 401 && !skipAuth && !isRetry) {
    try {
      await refreshAccessToken();
      return request<T>(path, options, true);
    } catch {
      clearTokens();
      throw new ApiError(401, "Session expired");
    }
  }

  if (!res.ok) {
    let message = res.statusText;
    let details: Record<string, string> | undefined;
    try {
      const errBody = await res.json();
      message = errBody.message ?? message;
      details = errBody.details;
    } catch {
      /* non-JSON error body, keep default message */
    }
    throw new ApiError(res.status, message, details);
  }

  // 204 = explicit no content. For any other 2xx, read body as text first and only
  // JSON-parse when non-empty — this covers Spring's .build() responses that return
  // 201 with no body (e.g. POST /co-supervisors/{id}).
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function cachedGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.cache === "no-store") return request<T>(path, { ...options, method: "GET" });
  const now = Date.now();
  const cached = getCache.get(path);
  if (cached && cached.expiresAt > now) return cached.promise as Promise<T>;

  const promise = request<T>(path, { ...options, method: "GET" }).catch((error) => {
    getCache.delete(path);
    throw error;
  });
  getCache.set(path, { expiresAt: now + GET_CACHE_TTL_MS, promise });
  return promise;
}

function mutate<T>(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown, options?: RequestOptions) {
  clearRequestCache();
  return request<T>(path, { ...options, method, body });
}

async function download(path: string, isRetry = false): Promise<{ blob: Blob; filename: string | null }> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { headers, credentials: "include" });
  if (res.status === 401 && !isRetry) {
    await refreshAccessToken();
    return download(path, true);
  }
  if (!res.ok) {
    let message = res.statusText;
    try { message = (await res.json()).message ?? message; } catch { /* keep status text */ }
    throw new ApiError(res.status, message);
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const filename = /filename=\"?([^\";]+)\"?/i.exec(disposition)?.[1] ?? null;
  return { blob: await res.blob(), filename };
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => cachedGet<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    mutate<T>(path, "POST", body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    mutate<T>(path, "PUT", body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    mutate<T>(path, "PATCH", body, options),
  delete: <T>(path: string, options?: RequestOptions) => mutate<T>(path, "DELETE", undefined, options),
  download,
};

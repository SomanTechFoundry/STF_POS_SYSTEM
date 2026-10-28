import { clearSession, getStoredToken } from "@/lib/client/auth";

export const SESSION_NOTICE_KEY = "sessionNotice";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  details?: unknown;
};

export class ApiClientError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

function resolveLocaleHeader(): string {
  if (typeof window === "undefined") return "en-IN";

  const appLanguage = String(localStorage.getItem("appLanguage") || "en").toLowerCase();
  if (appLanguage === "ta") return "ta-IN";

  try {
    const override = JSON.parse(localStorage.getItem("businessProfileOverride") || "{}");
    const locale = String(override?.locale || "").trim();
    if (locale) return locale;
  } catch {
    // ignore malformed local storage
  }

  return "en-IN";
}

function handleSessionExpiry() {
  clearSession();
  sessionStorage.setItem(SESSION_NOTICE_KEY, "Your session expired. Please login again.");
  if (typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.assign("/login");
  }
}

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (!headers.has("Content-Type") && !(init instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (typeof window !== "undefined") {
    const impersonationId = localStorage.getItem("impersonationBusinessId");
    if (impersonationId) {
      headers.set("x-business-id", impersonationId);
    }
    headers.set("x-locale", resolveLocaleHeader());
  }

  return headers;
}

export function extractApiError(error: unknown, fallbackMessage = "Something went wrong"): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallbackMessage;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { query?: Record<string, string | number | undefined | null> } = {},
): Promise<T> {
  const { query, ...init } = options;
  let url = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;

  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init.headers),
  });

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }

  if (!response.ok || body?.success === false) {
    const message = body?.message || response.statusText || "Request failed";
    const hasToken = Boolean(getStoredToken());
    const lower = message.toLowerCase();
    const isExpiredToken =
      response.status === 401 &&
      hasToken &&
      (lower.includes("expired") || lower.includes("invalid or expired token") || lower.includes("invalid token"));

    if (isExpiredToken) {
      handleSessionExpiry();
    }

    throw new ApiClientError(message, response.status, body?.details);
  }

  return (body?.data ?? null) as T;
}

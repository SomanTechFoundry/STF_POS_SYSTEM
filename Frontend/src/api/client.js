import axios from "axios";

const SESSION_NOTICE_KEY = "sessionNotice";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: 15000
});

function resolveLocaleHeader() {
  const appLanguage = String(localStorage.getItem("appLanguage") || "en").toLowerCase();
  if (appLanguage === "ta") return "ta-IN";

  try {
    const override = JSON.parse(localStorage.getItem("businessProfileOverride") || "{}");
    const locale = String(override?.locale || "").trim();
    if (locale) return locale;
  } catch {
    // ignore malformed local storage and continue with app language
  }

  return "en-IN";
}

function handleSessionExpiry() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("authUser");
  localStorage.removeItem("impersonationBusinessId");
  sessionStorage.setItem(SESSION_NOTICE_KEY, "Your session expired. Please login again.");

  if (window.location.pathname !== "/") {
    window.location.assign("/");
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const impersonationId = localStorage.getItem("impersonationBusinessId");
  if (impersonationId) {
    config.headers["x-business-id"] = impersonationId;
  }
  config.headers["x-locale"] = resolveLocaleHeader();

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.message || "").toLowerCase();
    const hasToken = Boolean(localStorage.getItem("accessToken"));

    const isExpiredToken = status === 401 && hasToken && (
      message.includes("expired") ||
      message.includes("invalid or expired token") ||
      message.includes("invalid token")
    );

    if (isExpiredToken) {
      handleSessionExpiry();
    }

    return Promise.reject(error);
  }
);

export function extractApiError(error, fallbackMessage = "Something went wrong") {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.message) {
    return error.message;
  }

  return fallbackMessage;
}

export { SESSION_NOTICE_KEY };
export default api;

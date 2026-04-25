const LOCAL_DEV_API_URL = "http://127.0.0.1:8080";

function normalizeApiUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.replace(/\/+$/, "");
}

function isLoopbackUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export function getApiBaseUrl() {
  const configured = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL ?? "");
  if (configured) {
    if (process.env.NODE_ENV === "production" && isLoopbackUrl(configured)) {
      return "";
    }

    return configured;
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_DEV_API_URL;
  }

  return "";
}

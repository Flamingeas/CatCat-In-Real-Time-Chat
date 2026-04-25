const DEFAULT_WS_PATH = "/ws";
const LOCAL_DEV_WS_URL = "ws://127.0.0.1:8080/ws";

function getSameOriginWsUrl(path: string) {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
    return null;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

function normalizeWsUrl(value: string, path: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = path;
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  if (trimmed.startsWith("/")) {
    return getSameOriginWsUrl(trimmed) ?? getLocalDevWsUrl();
  }

  return trimmed;
}

export function getWebSocketUrl(path = DEFAULT_WS_PATH) {
  const configured = normalizeWsUrl(process.env.NEXT_PUBLIC_WS_URL ?? "", path);
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_DEV_WS_URL;
  }

  const sameOriginUrl = getSameOriginWsUrl(path);
  if (sameOriginUrl) return sameOriginUrl;

  return getLocalDevWsUrl();
}

function getLocalDevWsUrl() {
  if (process.env.NODE_ENV !== "production") {
    return LOCAL_DEV_WS_URL;
  }

  throw new Error("NEXT_PUBLIC_WS_URL must be set when no browser origin is available.");
}

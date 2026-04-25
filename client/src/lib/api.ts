import { getApiBaseUrl } from "@/lib/api-url";

const API_BASE = getApiBaseUrl();

export class ApiError extends Error {
  status: number;
  statusText: string;
  code?: string;
  details?: string;
  payload?: unknown;

  constructor(params: {
    status: number;
    statusText: string;
    message: string;
    code?: string;
    details?: string;
    payload?: unknown;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.code = params.code;
    this.details = params.details;
    this.payload = params.payload;
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      window.location.replace("/");
    }
    throw new ApiError({
      status: 401,
      statusText: response.statusText,
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let payload: any = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {}

    const message =
      payload?.message ??
      payload?.error ??
      (text || `${response.status} ${response.statusText}`);

    throw new ApiError({
      status: response.status,
      statusText: response.statusText,
      message,
      code: payload?.code,
      details: payload?.details,
      payload,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

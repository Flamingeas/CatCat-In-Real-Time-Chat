const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";

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

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText} - ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
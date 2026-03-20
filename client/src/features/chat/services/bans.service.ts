import { api } from "@/lib/api";

export type ServerBan = {
  user_id: string;
  username: string;
  reason?: string | null;
  created_at: string;
  expires_at?: string | null;
};

export async function banMember(
  serverId: string,
  userId: string
): Promise<void> {
  await api<void>(`/api/servers/${serverId}/bans/${userId}`, {
    method: "POST",
  });
}

export async function getServerBans(serverId: string): Promise<ServerBan[]> {
  return api<ServerBan[]>(`/api/servers/${serverId}/bans`);
}

export async function unbanMember(serverId: string, userId: string): Promise<void> {
  await api<void>(`/api/servers/${serverId}/bans/${userId}`, {
    method: "DELETE",
  });
}

export async function banTemporaryMember(
  serverId: string,
  userId: string
): Promise<void> {
  await api<void>(`/api/servers/${serverId}/bans-temporary/${userId}`, {
    method: "POST",
  });
}
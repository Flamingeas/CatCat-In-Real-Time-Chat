import { api } from "@/lib/api";

export type MemberRole = "owner" | "admin" | "member";

export type Member = {
  user_id: string;
  username: string;
  role?: MemberRole;
};

export async function getServerMembers(serverId: string): Promise<Member[]> {
  return api<Member[]>(`/api/servers/${serverId}/members`);
}

export async function kickMember(serverId: string, userId: string): Promise<void> {
  await api<void>(`/api/servers/${serverId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function setMemberRole(
  serverId: string,
  userId: string,
  role: MemberRole
): Promise<{ message: string }> {
  return api<{ message: string }>(`/api/servers/${serverId}/members/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function transferOwner(
  serverId: string,
  newOwnerId: string
): Promise<void> {
  await api<void>(`/api/servers/${serverId}/transfer-owner`, {
    method: "POST",
    body: JSON.stringify({ new_owner_id: newOwnerId }),
  });
}

export async function leaveServer(serverId: string): Promise<void> {
  await api<void>(`/api/servers/${serverId}/leave`, {
    method: "DELETE",
  });
}

export async function joinServerByCode(
  invitationCode: string
): Promise<{
  id: string;
  name: string;
  owner_id: string;
  invitation_code: string;
  created_at: string;
  updated_at: string;
}> {
  return api(`/api/servers/join`, {
    method: "POST",
    body: JSON.stringify({ invitation_code: invitationCode }),
  });
}
import { api } from "@/lib/api";

export type ConversationItem = {
  id: string;
  other_user_id: string;
  other_username: string;
  created_at: string;
};

export type DmMessage = {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_username: string;
  recipient_id: string;
  content: string;
  created_at: string;
  updated_at?: string | null;
  is_edited: boolean;
  is_deleted: boolean;
};

export async function getConversations(): Promise<ConversationItem[]> {
  return api<ConversationItem[]>("/api/dm/conversations");
}

export async function startConversation(recipient_id: string): Promise<ConversationItem> {
  return api<ConversationItem>("/api/dm/conversations", {
    method: "POST",
    body: JSON.stringify({ recipient_id }),
  });
}

export async function getDmMessages(
  conversation_id: string,
  opts?: { limit?: number; before?: string }
): Promise<DmMessage[]> {
  let url = `/api/dm/conversations/${conversation_id}/messages?limit=${opts?.limit ?? 50}`;
  if (opts?.before) url += `&before=${encodeURIComponent(opts.before)}`;
  return api<DmMessage[]>(url);
}

export async function sendDmMessage(conversation_id: string, content: string): Promise<DmMessage> {
  return api<DmMessage>(`/api/dm/conversations/${conversation_id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function updateDmMessage(message_id: string, content: string): Promise<DmMessage> {
  return api<DmMessage>(`/api/dm/messages/${message_id}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function deleteDmMessage(message_id: string): Promise<void> {
  return api<void>(`/api/dm/messages/${message_id}`, { method: "DELETE" });
}

export type Server = {
    id: string;
    name: string;
    owner_id: string;
    invitation_code: string;
    created_at: string;
    updated_at: string;
};

export type Channel = {
    id: string;
    name: string;
    created_at?: string;
    updated_at?: string;
};

export type Message = {
    message_id: string;
    content: string;
    user_id: string;
    username: string;
    channel_id: string;
    server_id: string;
    created_at: string;
    updated_at?: string | null;
    is_edited: boolean;
    is_deleted: boolean;
    reactions?: Reaction[];
};

export type Reaction = {
    emoji: string;
    users: string[];
};

export type WsEvent =
    | { type: "presence_snapshot"; server_id: string; online: any[] }
    | { type: "presence"; server_id: string; user_id: string; status: "online" | "offline"; username?: string }
    | { type: "authed"; user_id: string; username?: string }
    | { type: "user_connected"; server_id: string; user_id: string; username?: string; status?: string }
    | { type: "user_disconnected"; server_id: string; user_id: string; username?: string }
    | { type: "user_status_changed"; server_id: string; user_id: string; username?: string; status?: string }
    | { type: "server_member_joined"; server_id: string; user_id: string; username: string }
    | { type: "server_member_left"; server_id: string; user_id: string; username: string }
    | { type: "server_member_role_updated"; server_id: string; user_id: string; username: string; role: string }
    | { type: "server_member_kicked"; server_id: string; user_id: string; username: string }
    | { type: "server_deleted"; server_id: string }
    | { type: "server_updated"; server_id: string }
    | { type: "channel_created"; server_id: string; channel_id: string; name: string; created_at: string }
    | { type: "channel_deleted"; server_id: string; channel_id: string }
    | { type: "channel_updated"; server_id: string; channel_id: string }
    | { type: "new_message"; message_id: string; channel_id: string; user_id: string; username: string; content: string; created_at: string }
    | { type: "user_typing"; channel_id: string; user_id: string; username?: string }
    | { type: "typing"; channel_id: string; user_id: string; username?: string }
    | { type: "message_deleted"; message_id: string; channel_id: string; server_id: string }
    | { type: "server_member_banned"; server_id: string; user_id: string; username: string }
    | { type: "server_member_unbanned"; server_id: string; user_id: string; username: string }
    | { type: "message_updated"; message_id: string; channel_id: string; content: string; updated_at: string }
    | { type: "new_direct_message"; conversation_id: string; message_id: string; sender_id: string; sender_username: string; content: string; created_at: string }
    | { type: "direct_message_updated"; conversation_id: string; message_id: string; content: string; updated_at: string }
    | { type: "direct_message_deleted"; conversation_id: string; message_id: string }
    | { type: "server_member_temporary_banned"; server_id: string; user_id: string; username: string; until?: string }
    | { type: "server_member_temporary_ban_lifted"; server_id: string; user_id: string; username: string }
    | { type: "message_reaction_added"; message_id: string; channel_id: string; user_id: string; emoji: string }
    | { type: "message_reaction_removed"; message_id: string; channel_id: string; user_id: string; emoji: string }
    | { type: string; [k: string]: any };

export type Toast = { id: string; text: string; kind: "info" | "success" | "warn" };

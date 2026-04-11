"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import {
  getServerMembers,
  kickMember,
  setMemberRole as setMemberRoleRequest,
  transferOwner as transferOwnerRequest,
  leaveServer as leaveServerRequest,
  joinServerByCode,
  type Member,
  type MemberRole,
} from "@/features/chat/services/members.service";
import { api } from "@/lib/api";
import logoImage from "../images/logo_catcat.svg";
import { MemberActionsMenu } from "@/features/chat/components/member-actions-menu";
import { banMember } from "@/features/chat/services/bans.service";
import BanList from "@/features/chat/components/ban-list";

const miskan = localFont({ src: "../fonts/Miskan.woff", variable: "--font-miskan" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "700"] });

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8080/ws") as string;

type Server = {
    id: string;
    name: string;
    owner_id: string;
    invitation_code: string;
    created_at: string;
    updated_at: string;
};

type Channel = {
    id: string;
    name: string;
    created_at?: string;
    updated_at?: string;
};

type Reaction = {
    emoji: string;
    users: string[];
};

type Message = {
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

type WsEvent =
    | { type: "presence_snapshot"; server_id: string; online: any[] }
    | { type: "authed"; user_id: string; username?: string }
    | { type: "user_connected"; server_id: string; user_id: string; username?: string; status?: string }
    | { type: "user_disconnected"; server_id: string; user_id: string; username?: string }
    | { type: "user_status_changed"; server_id: string; user_id: string; username?: string; status?: string }
    | { type: "server_member_joined"; server_id: string; user_id: string; username: string }
    | { type: "server_member_left"; server_id: string; user_id: string; username: string }
    | { type: "server_member_role_updated"; server_id: string; user_id: string; username: string; role: MemberRole | string }
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
    | { type: string; [k: string]: any }
    | { type: "message_reaction_added"; message_id: string; channel_id: string; user_id: string; emoji: string }
    | { type: "message_reaction_removed"; message_id: string; channel_id: string; user_id: string; emoji: string };


function getInitials(username?: string) {
    if (!username || username.length < 1) return "??";
    const first = username[0].toUpperCase();
    const last = username[username.length - 1].toUpperCase();
    return `${first}${last}`;
}

function CrownIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 13H5L3 7zm4.1 11h9.8l.9-6.1-3 2.3L12 9.2l-2.8 4.9-3-2.3L7.1 18z" />
        </svg>
    );
}

function GearIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.303.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function UserPlusIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11a4 4 0 100-8 4 4 0 000 8z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M23 11h-6" />
        </svg>
    );
}

function EnterIcon() {
    return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 19V5a2 2 0 00-2-2h-6" />
        </svg>
    );
}

function LeaveIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 19V5a2 2 0 00-2-2h-6" />
        </svg>
    );
}

function PencilIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
    );
}

type Toast = { id: string; text: string; kind: "info" | "success" | "warn" };

function formatDateTimeFR(input?: string) {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return input;
    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(d);
}

function formatTimeFR(input?: string) {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return input;
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

export default function ChatPage() {
    const [initials, setInitials] = useState("??");
    const [me, setMe] = useState<{ id: string; username: string } | null>(null);

    const [servers, setServers] = useState<Server[]>([]);
    const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [serverName, setServerName] = useState("");
    const [createError, setCreateError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const [isJoinOpen, setIsJoinOpen] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    const [members, setMembers] = useState<Member[]>([]);
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

    const [isChannelCreateOpen, setIsChannelCreateOpen] = useState(false);
    const [channelName, setChannelName] = useState("");
    const [channelCreateError, setChannelCreateError] = useState<string | null>(null);
    const [isChannelCreating, setIsChannelCreating] = useState(false);

    const [isChannelEditOpen, setIsChannelEditOpen] = useState(false);
    const [channelEditName, setChannelEditName] = useState("");
    const [channelEditError, setChannelEditError] = useState<string | null>(null);
    const [isChannelSaving, setIsChannelSaving] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const myIdRef = useRef<string | null>(null);
    const selectedServerIdRef = useRef<string | null>(null);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsName, setSettingsName] = useState("");
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState("");

    const [isLeaveOpen, setIsLeaveOpen] = useState(false);
    const [leaveError, setLeaveError] = useState<string | null>(null);
    const [isLeaving, setIsLeaving] = useState(false);

    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);

    const [toasts, setToasts] = useState<Toast[]>([]);
    const lastJoinedToastRef = useRef<Record<string, boolean>>({});
    const lastLeftToastRef = useRef<Record<string, boolean>>({});
    const seenPresenceRef = useRef<Record<string, boolean>>({});

    const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const [activePickerId, setActivePickerId] = useState<string | null>(null);

    const router = useRouter();
    const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

    const selectedServer = useMemo(() => servers.find((s) => s.id === selectedServerId) ?? null, [servers, selectedServerId]);
    const selectedChannel = useMemo(() => channels.find((c) => String(c.id) === String(selectedChannelId)) ?? null, [channels, selectedChannelId]);

    const channelCreatedLabel = useMemo(() => formatDateTimeFR(selectedChannel?.created_at), [selectedChannel?.created_at]);
    const channelUpdatedLabel = useMemo(() => formatDateTimeFR(selectedChannel?.updated_at), [selectedChannel?.updated_at]);
    const [showBans, setShowBans] = useState(false);

    const myRole: MemberRole = useMemo(() => {
        if (!me || !selectedServerId) return "member";
        if (selectedServer?.owner_id && String(selectedServer.owner_id) === String(me.id)) {
            return "owner";
        }
        const found = members.find((m) => String(m.user_id) === String(me.id));
        return (found?.role ?? "member") as MemberRole;
    }, [me, members, selectedServerId, selectedServer?.owner_id]);

    const isOwner = myRole === "owner";
    const canCreateChannel = myRole === "owner" || myRole === "admin";
    const canInviteMember = myRole === "owner" || myRole === "admin";
    const canEditChannel = myRole === "owner" || myRole === "admin";
    const canModerateMessages = myRole === "owner" || myRole === "admin";
    const [messages, setMessages] = useState<Message[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [messagesError, setMessagesError] = useState<string | null>(null);

    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);

    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const messagesBoxRef = useRef<HTMLDivElement | null>(null);
    const selectedChannelIdRef = useRef<string | null>(null);

    const typingTimeoutsRef = useRef<Map<string, number>>(new Map());
    const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; channelId: string }>>({});
    const lastTypingSentAtRef = useRef<number>(0);

    useEffect(() => {
        selectedChannelIdRef.current = selectedChannelId;
    }, [selectedChannelId]);

    function pushToast(text: string, kind: Toast["kind"] = "info") {
        const id = `${Date.now()}_${Math.random()}`;
        setToasts((prev) => [...prev, { id, text, kind }]);
        window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    }

    useEffect(() => {
        myIdRef.current = me?.id ?? null;
    }, [me?.id]);

    useEffect(() => {
        selectedServerIdRef.current = selectedServerId;
    }, [selectedServerId]);

    useEffect(() => {
        function onDown(e: MouseEvent) {
            if (!openMenuFor) return;
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuFor(null);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpenMenuFor(null);
        }
        document.addEventListener("mousedown", onDown);
        // @ts-ignore
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            // @ts-ignore
            document.removeEventListener("keydown", onKey);
        };
    }, [openMenuFor]);

    function wsSend(obj: any) {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify(obj));
    }

    function addOnline(id: string) {
        setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }

    function removeOnline(id: string) {
        setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }

    async function refreshServers(selectId?: string) {
        const list = await api<Server[]>("/api/servers");
        setServers(list);
        if (selectId) setSelectedServerId(selectId);
        else if (!selectedServerId && list.length > 0) setSelectedServerId(list[0].id);
    }

    async function transferOwner(serverId: string, newOwnerId: string) {
        try {
            await transferOwnerRequest(serverId, newOwnerId);
            pushToast("Propriétaire modifié", "success");
            await refreshServers(serverId);
            await reloadMembers(serverId);
        } catch (e: any) {
            pushToast("Action refusée", "warn");
            console.error(e);
        }
    }

    function removeMember(serverId: string, user_id: string) {
        const currentSid = selectedServerIdRef.current;
        if (!currentSid || String(serverId) !== String(currentSid)) return;
        const idStr = String(user_id);
        setMembers((prev) => prev.filter((m) => String(m.user_id) !== idStr));
        removeOnline(idStr);
    }

    function upsertMember(serverId: string, user_id: string, username: string) {
        const currentSid = selectedServerIdRef.current;
        if (!currentSid || String(serverId) !== String(currentSid)) return;

        setMembers((prev) => {
            const idStr = String(user_id);
            const idx = prev.findIndex((m) => String(m.user_id) === idStr);
            if (idx >= 0) {
                const copy = prev.slice();
                copy[idx] = { ...copy[idx], username: username ?? copy[idx].username };
                return copy;
            }
            return [...prev, { user_id: idStr, username }];
        });
    }

    async function handleBanMember(serverId: string, userId: string) {
        try {
            await banMember(serverId, userId)

            removeMember(serverId, userId)

            pushToast("Membre banni définitivement", "warn")
        } catch (e) {
            pushToast("Action refusée", "warn")
        }
    }

    function setMemberRoleLocal(serverId: string, user_id: string, role: MemberRole) {
        const currentSid = selectedServerIdRef.current;
        if (!currentSid || String(serverId) !== String(currentSid)) return;

        setMembers((prev) => {
            const idStr = String(user_id);
            const idx = prev.findIndex((m) => String(m.user_id) === idStr);
            if (idx >= 0) {
                const copy = prev.slice();
                copy[idx] = { ...copy[idx], role };
                return copy;
            }
            return prev;
        });
    }

    async function reloadMembers(serverId: string) {
        try {
            const m = await getServerMembers(serverId);
            setMembers(m.map((x) => ({ ...x, role: (x.role ?? "member") as MemberRole })));
        } catch (e: any) {
            const msg = String(e?.message ?? "");
            if (msg.startsWith("403")) pushToast("Accès refusé aux membres (403)", "warn");
            if (msg.startsWith("404")) pushToast("Serveur introuvable (404)", "warn");
            setMembers([]);
        }
    }

    async function reloadChannels(serverId: string) {
        try {
            const list = await api<Channel[]>(`/api/servers/${serverId}/channels`);
            setChannels(list);
            setSelectedChannelId((prev) => {
                if (prev && list.some((c) => String(c.id) === String(prev))) return prev;
                return list.length ? String(list[0].id) : null;
            });
        } catch (e: any) {
            const msg = String(e?.message ?? "");
            if (msg.startsWith("403")) pushToast("Accès refusé aux salons (403)", "warn");
            if (msg.startsWith("404")) pushToast("Salons introuvables (404)", "warn");
            setChannels([]);
            setSelectedChannelId(null);
        }
    }

    function openEditChannel() {
        if (!canEditChannel) return;
        if (!selectedChannel) return;
        setChannelEditError(null);
        setChannelEditName(selectedChannel.name ?? "");
        setIsChannelEditOpen(true);
    }

    async function saveChannelEdit() {
        if (!canEditChannel) return;
        if (!selectedServerId) return;
        if (!selectedChannel) return;

        setChannelEditError(null);
        const name = channelEditName.trim();

        if (name.length < 3) return setChannelEditError("Le nom doit faire au moins 3 caractères.");
        if (name.length > 50) return setChannelEditError("Le nom doit faire maximum 50 caractères.");

        try {
            setIsChannelSaving(true);

            const updated = await api<Channel>(`/api/channels/${String(selectedChannel.id)}`, {
                method: "PUT",
                body: JSON.stringify({ name }),
            });

            setChannels((prev) =>
                prev.map((c) =>
                    String(c.id) === String(selectedChannel.id) ? { ...c, name: updated.name ?? name, updated_at: updated.updated_at ?? c.updated_at } : c
                )
            );

            setIsChannelEditOpen(false);
            pushToast("Salon renommé", "success");

            await reloadChannels(selectedServerId);
        } catch (e: any) {
            setChannelEditError(e?.message ?? "Impossible de renommer le salon.");
        } finally {
            setIsChannelSaving(false);
        }
    }

    async function fetchMessages(channelId: string, opts?: { before?: string; append?: boolean }) {
        const before = opts?.before ? encodeURIComponent(opts.before) : null;
        const url = before ? `/api/channels/${channelId}/messages?limit=50&before=${before}` : `/api/channels/${channelId}/messages?limit=50`;

        const list = await api<Message[]>(url);

        setMessages((prev) => {
            if (opts?.append) {
                const map = new Map<string, Message>();
                for (const m of prev) map.set(String(m.message_id), m);
                for (const m of list) map.set(String(m.message_id), m);
                return Array.from(map.values()).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
            }
            return list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        });

        setHasMoreMessages(list.length >= 50);
    }

    useEffect(() => {
        if (!selectedServerId || !selectedChannelId) {
            setMessages([]);
            setHasMoreMessages(true);
            setMessagesError(null);
            return;
        }

        setMessagesLoading(true);
        setMessagesError(null);
        setHasMoreMessages(true);

        fetchMessages(String(selectedChannelId))
            .then(() => {
                window.setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
                }, 0);
            })
            .catch((e: any) => setMessagesError(e?.message ?? "Impossible de charger les messages"))
            .finally(() => setMessagesLoading(false));
    }, [selectedServerId, selectedChannelId]);

    async function loadMoreMessages() {
        if (!selectedChannelId) return;
        if (loadingMore) return;
        if (!hasMoreMessages) return;
        if (messages.length === 0) return;

        try {
            setLoadingMore(true);
            const oldest = messages[0];
            await fetchMessages(String(selectedChannelId), { before: oldest.created_at, append: true });
        } catch (e: any) {
            pushToast("Impossible de charger plus", "warn");
        } finally {
            setLoadingMore(false);
        }
    }

    async function sendMessage() {
        if (!selectedChannelId) return;
        const content = messageText.trim();
        if (!content) return;

        try {
            setIsSending(true);

            const created = await api<Message>(`/api/channels/${String(selectedChannelId)}/messages`, {
                method: "POST",
                body: JSON.stringify({ content }),
            });

            setMessages((prev) => {
                if (prev.some((m) => String(m.message_id) === String(created.message_id))) return prev;
                const next = [...prev, created];
                next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
                return next;
            });

            setMessageText("");

            window.setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 0);
        } catch (e: any) {
            pushToast("Envoi refusé", "warn");
        } finally {
            setIsSending(false);
        }
    }

    async function deleteMyMessage(messageId: string) {
        if (!messageId) return;

        try {
            await api<void>(`/api/messages/${String(messageId)}`, { method: "DELETE" });

            setMessages((prev) =>
                prev.map((m) =>
                    String(m.message_id) === String(messageId)
                        ? {
                            ...m,
                            is_deleted: true,
                            content: "",
                        }
                        : m
                )
            );

            pushToast("Message supprimé", "warn");
        } catch (e: any) {
            pushToast("Suppression refusée", "warn");
            console.error(e);
        }
    }

    function onMessageKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!isSending) sendMessage();
        }
    }

    function sendTyping() {
        if (!me?.id || !me.username) return;
        if (!selectedChannelId) return;

        const now = Date.now();
        if (now - lastTypingSentAtRef.current < 800) return;
        lastTypingSentAtRef.current = now;

        wsSend({
            type: "user_typing",
            user_id: me.id,
            username: me.username,
            channel_id: selectedChannelId,
        });
    }

    const typingLabel = useMemo(() => {
        if (!selectedChannelId) return null;
        const list = Object.values(typingUsers)
            .filter((x) => String(x.channelId) === String(selectedChannelId))
            .map((x) => x.username);

        if (list.length === 0) return null;
        if (list.length === 1) return `${list[0]} écrit…`;
        if (list.length === 2) return `${list[0]} et ${list[1]} écrivent…`;
        return `${list[0]}, ${list[1]} et ${list.length - 2} autres écrivent…`;
    }, [typingUsers, selectedChannelId]);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) return;
        try {
            const user = JSON.parse(storedUser);
            const id = String(user?.id ?? "");
            const username = String(user?.username ?? "");
            setMe(id ? { id, username } : null);
            setInitials(getInitials(username));
        } catch {
            setMe(null);
            setInitials("??");
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        const storedUser = localStorage.getItem("user");
        if (!token || !storedUser) {
            router.replace("/");
            return;
        }
        setHasCheckedAuth(true);
    }, [router]);

    async function setMemberRole(serverId: string, userId: string, role: MemberRole) {
        if (!serverId) return;

        try {
            await setMemberRoleRequest(serverId, userId, role);

            setMemberRoleLocal(serverId, userId, role);

            if (role === "owner") {
                setServers((prev) =>
                    prev.map((s) => (String(s.id) === String(serverId) ? { ...s, owner_id: String(userId) } : s))
                );
                await refreshServers(serverId);
                await reloadMembers(serverId);
            }

            switch (role) {
                case "admin":
                    pushToast("Admin ajouté", "success");
                    break;
                case "owner":
                    pushToast("Propriétaire modifié", "success");
                    break;
                default:
                    pushToast("Admin retiré", "success");
                    break;
            }
        } catch (e: any) {
            pushToast("Action refusée", "warn");
            console.error(e);
        }
    }

    async function handleKickMember(serverId: string, userId: string) {
        try {
            await kickMember(serverId, userId);
            removeMember(serverId, userId);
            pushToast("Membre expulsé", "warn");
        } catch (e: any) {
            pushToast("Action refusée", "warn");
            console.error(e);
        }
    }

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "auth", token }));
            const sid = selectedServerIdRef.current;
            if (sid) ws.send(JSON.stringify({ type: "join_server", server_id: sid }));
        };

        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data) as WsEvent;
                if (!msg || typeof msg !== "object") return;
                console.log(msg)

                if (msg.type === "presence_snapshot" && msg.server_id && Array.isArray(msg.online)) {
                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && String(msg.server_id) !== String(currentSid)) return;

                    seenPresenceRef.current[String(msg.server_id)] = true;

                    const ids: string[] = [];
                    for (const item of msg.online) {
                        if (Array.isArray(item) && item.length >= 1) ids.push(String(item[0]));
                        else if (item && typeof item === "object" && "user_id" in item) ids.push(String((item as any).user_id));
                        else if (typeof item === "string") ids.push(String(item));
                    }
                    setOnlineUserIds(new Set(ids));
                    return;
                }

                if (msg.type === "authed") {
                    const meId = String((msg as any).user_id ?? myIdRef.current ?? "");
                    if (meId) addOnline(meId);
                    return;
                }
                if (msg.type === "channel_created") {
                    const sid = String(msg.server_id ?? "");
                    if (sid !== String(selectedServerIdRef.current)) return;

                    reloadChannels(sid).catch(() => {});
                    pushToast(`Salon #${msg.name} créé`, "success");
                    return;
                }
                if (msg.type === "channel_deleted") {
                    const sid = String(msg.server_id ?? "");
                    const cid = String(msg.channel_id ?? "");

                    if (!sid || !cid) return;

                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && sid !== String(currentSid)) return;

                    setChannels((prev) => {
                        const next = prev.filter((c) => String(c.id) !== cid);

                        setSelectedChannelId((prevSelected) => {
                            if (prevSelected && String(prevSelected) !== cid) return prevSelected;
                            return next.length ? String(next[0].id) : null;
                        });

                        return next;
                    });

                    pushToast("Salon supprimé", "warn");
                    return;
                }
                if (msg.type === "channel_updated") {
                    const sid = String(msg.server_id ?? "");
                    const cid = String(msg.channel_id ?? "");

                    if (!sid || !cid) return;

                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && sid !== String(currentSid)) return;

                    reloadChannels(sid).catch(() => {});
                    pushToast("Salon modifié", "info");
                    return;
                }
                if (msg.type === "server_member_joined") {
                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && String(msg.server_id) !== String(currentSid)) return;

                    upsertMember(String(msg.server_id), String(msg.user_id), String(msg.username ?? "quelqu’un"));

                    const key = `${msg.server_id}:${msg.user_id}`;
                    if (!lastJoinedToastRef.current[key]) {
                        lastJoinedToastRef.current[key] = true;
                        const isMe = myIdRef.current && String(myIdRef.current) === String(msg.user_id);
                        if (!isMe) pushToast(`${msg.username} a rejoint le serveur`, "success");
                    }
                    return;
                }

                if (msg.type === "server_member_left") {
                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && String(msg.server_id) !== String(currentSid)) return;

                    removeMember(String(msg.server_id), String(msg.user_id));

                    const key = `${msg.server_id}:${msg.user_id}`;
                    if (!lastLeftToastRef.current[key]) {
                        lastLeftToastRef.current[key] = true;
                        const isMe = myIdRef.current && String(myIdRef.current) === String(msg.user_id);
                        if (!isMe) pushToast(`${msg.username} a quitté le serveur`, "warn");
                    }
                    return;
                }

                if (msg.type === "server_member_role_updated") {
                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && String(msg.server_id) !== String(currentSid)) return;

                    const roleRaw = (msg as any).role;
                    const role = (roleRaw === "owner" || roleRaw === "admin" || roleRaw === "member" ? roleRaw : "member") as MemberRole;

                    upsertMember(String(msg.server_id), String(msg.user_id), String(msg.username ?? "quelqu’un"));
                    setMemberRoleLocal(String(msg.server_id), String(msg.user_id), role);

                    if (role === "owner") {
                        setServers((prev) =>
                            prev.map((s) => (String(s.id) === String(msg.server_id) ? { ...s, owner_id: String(msg.user_id) } : s))
                        );
                    }

                    const isMe = myIdRef.current && String(myIdRef.current) === String(msg.user_id);
                    if (!isMe) pushToast(`${msg.username} est maintenant ${role}`, "info");
                    return;
                }
                if (msg.type === "server_member_kicked") {
                    const sid = String(msg.server_id ?? "");
                    const uid = String(msg.user_id ?? "");
                    const username = String(msg.username ?? "quelqu’un");

                    if (!sid || !uid) return;

                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && sid !== String(currentSid)) return;

                    const isMe = !!myIdRef.current && String(myIdRef.current) === uid;

                    removeMember(sid, uid);

                    if (isMe) {
                        wsSend({ type: "leave_server", server_id: sid });

                        pushToast("Tu as été expulsé du serveur", "warn");

                        setSelectedServerId(null);
                        setMembers([]);
                        setChannels([]);
                        setSelectedChannelId(null);
                        setOnlineUserIds(new Set());
                        setMessages([]);
                        setShowBans(false);

                        api<Server[]>("/api/servers")
                            .then((list) => {
                                setServers(list);
                                setSelectedServerId(list.length ? list[0].id : null);
                            })
                            .catch(() => {});
                    } else {
                        pushToast(`${username} a été expulsé`, "warn");
                    }

                    return;
                }

                if (msg.type === "server_deleted") {
                    const sid = String(msg.server_id ?? "");
                    if (!sid) return;

                    pushToast("Serveur supprimé", "warn");

                    if (selectedServerIdRef.current && String(selectedServerIdRef.current) === sid) {
                        setSelectedServerId(null);
                        setMembers([]);
                        setChannels([]);
                        setSelectedChannelId(null);
                        setOnlineUserIds(new Set());
                    }
                    setServers((prev) => prev.filter((s) => String(s.id) !== sid));
                    return;
                }
                if (msg.type === "server_updated") {
                    const sid = String(msg.server_id ?? "");
                    if (!sid) return;

                    refreshServers(sid).catch(() => {});
                    pushToast("Serveur modifié", "info");
                    return;
                }
                if (msg.type === "user_connected" || msg.type === "user_disconnected" || msg.type === "user_status_changed") {
                    const currentSid = selectedServerIdRef.current;
                    const sid = msg.server_id != null ? String(msg.server_id) : null;
                    if (!sid) return;
                    if (currentSid && sid !== String(currentSid)) return;

                    const id = msg.user_id != null ? String(msg.user_id) : null;
                    if (!id) return;

                    const status = typeof (msg as any).status === "string" ? String((msg as any).status) : null;
                    const offline = msg.type === "user_disconnected" || status === "offline";

                    if (offline) removeOnline(id);
                    else addOnline(id);

                    const isMe = myIdRef.current && String(myIdRef.current) === String(id);
                    const isBoot = !seenPresenceRef.current[sid];

                    if (!isMe && !isBoot) {
                        const username = typeof (msg as any).username === "string" ? String((msg as any).username) : "quelqu’un";
                        if (msg.type === "user_connected") pushToast(`${username} est en ligne`, "info");
                        if (msg.type === "user_disconnected") pushToast(`${username} est hors ligne`, "warn");
                    }
                    return;
                }

                if (msg.type === "user_typing" || msg.type === "typing") {
                    const currentChannel = selectedChannelIdRef.current;
                    if (!currentChannel) return;

                    const chId = String((msg as any).channel_id ?? "");
                    if (!chId || String(chId) !== String(currentChannel)) return;

                    const uid = String((msg as any).user_id ?? "");
                    if (!uid) return;

                    const uname = String((msg as any).username ?? "unknown");

                    if (myIdRef.current && String(myIdRef.current) === uid) return;

                    setTypingUsers((prev) => ({
                        ...prev,
                        [uid]: { username: uname, channelId: String(chId) },
                    }));

                    const prevTimeout = typingTimeoutsRef.current.get(uid);
                    if (prevTimeout) window.clearTimeout(prevTimeout);

                    const t = window.setTimeout(() => {
                        typingTimeoutsRef.current.delete(uid);
                        setTypingUsers((prev) => {
                            const copy = { ...prev };
                            delete copy[uid];
                            return copy;
                        });
                    }, 5000);

                    typingTimeoutsRef.current.set(uid, t);
                    return;
                }

                if (msg.type === "new_message") {
                    const currentChannel = selectedChannelIdRef.current;
                    const currentServer = selectedServerIdRef.current;
                    if (!currentChannel || !currentServer) return;
                    if (String(msg.channel_id) !== String(currentChannel)) return;

                    setMessages((prev) => {
                        if (prev.some((m) => String(m.message_id) === String(msg.message_id))) return prev;
                        const next = [
                            ...prev,
                            {
                                message_id: String(msg.message_id),
                                content: String(msg.content ?? ""),
                                user_id: String(msg.user_id),
                                username: String(msg.username ?? "unknown"),
                                channel_id: String(msg.channel_id),
                                server_id: String(currentServer),
                                created_at: String(msg.created_at),
                                updated_at: null,
                                is_edited: false,
                                is_deleted: false,
                            },
                        ];
                        next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
                        return next;
                    });

                    setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                    }, 0);

                    return;
                }

                if (msg.type === "message_deleted") {
                    const mid = String(msg.message_id ?? "");
                    const chId = String(msg.channel_id ?? "");
                    const sid = String(msg.server_id ?? "");

                    if (!mid || !chId || !sid) return;

                    const currentSid = selectedServerIdRef.current;
                    const currentCh = selectedChannelIdRef.current;

                    if (!currentSid || !currentCh) return;
                    if (sid !== String(currentSid)) return;
                    if (chId !== String(currentCh)) return;

                    setMessages((prev) => prev.map((m) => (String(m.message_id) === mid ? { ...m, is_deleted: true, content: "" } : m)));
                    return;
                }
                if (msg.type === "server_member_banned") {
                    const sid = String((msg as any).server_id ?? "");
                    const uid = String((msg as any).user_id ?? "");
                    const username = String((msg as any).username ?? "quelqu’un");

                    if (!sid || !uid) return;

                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && sid !== String(currentSid)) return;

                    const isMe = myIdRef.current && String(myIdRef.current) === uid;

                    removeMember(sid, uid);

                    if (isMe) {
                        pushToast("Tu as été banni du serveur", "warn");

                        setSelectedServerId(null);
                        setMembers([]);
                        setChannels([]);
                        setSelectedChannelId(null);
                        setOnlineUserIds(new Set());
                        setMessages([]);

                        api<Server[]>("/api/servers")
                            .then((list) => {
                                setServers(list);
                                setSelectedServerId(list.length ? list[0].id : null);
                            })
                            .catch(() => {});
                    } else {
                        pushToast(`${username} a été banni`, "warn");
                    }

                    return;
                }
                if (msg.type === "server_member_unbanned") {
                    const sid = String(msg.server_id ?? "");
                    const uid = String(msg.user_id ?? "");
                    const username = String(msg.username ?? "quelqu’un");

                    if (!sid || !uid) return;

                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && sid !== String(currentSid)) return;

                    pushToast(`${username} a été débanni`, "success");

                    return;
                }
                if (msg.type === "message_reaction_added") {
                    setMessages((prev) => prev.map(m => {
                        if (m.message_id !== msg.message_id) return m;
                        const reactions = m.reactions || [];
                        const existing = reactions.find(r => r.emoji === msg.emoji);
                        
                        if (existing) {
                            if (existing.users.includes(msg.user_id)) return m;
                            return {
                                ...m,
                                reactions: reactions.map(r => r.emoji === msg.emoji 
                                    ? { ...r, users: [...r.users, msg.user_id] } : r)
                            };
                        }
                        return { ...m, reactions: [...reactions, { emoji: msg.emoji, users: [msg.user_id] }] };
                    }));
                    return;
                }

                if (msg.type === "message_reaction_removed") {
                    setMessages((prev) => prev.map(m => {
                        if (m.message_id !== msg.message_id) return m;
                        const reactions = (m.reactions || [])
                            .map(r => r.emoji === msg.emoji 
                                ? { ...r, users: r.users.filter(uid => uid !== msg.user_id) } : r)
                            .filter(r => r.users.length > 0);
                        return { ...m, reactions };
                    }));
                    return;
                }
            } catch {}
        };

        ws.onerror = (err) => console.error("WS error:", err);

        ws.onclose = () => {
            wsRef.current = null;
            setOnlineUserIds(new Set());
        };

        const heartbeatId = window.setInterval(() => {
            wsSend({ type: "ping", t: Date.now() });
        }, 15000);

        return () => {
            window.clearInterval(heartbeatId);
            ws.close();
        };
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const list = await api<Server[]>("/api/servers");
                setServers(list);
                if (!selectedServerId && list.length > 0) setSelectedServerId(list[0].id);
            } catch (e) {
                console.error("Failed to load servers:", e);
            }
        })();
    }, []);

    useEffect(() => {
        if (!selectedServerId) {
            setMembers([]);
            setChannels([]);
            setSelectedChannelId(null);
            setOnlineUserIds(new Set());
            return;
        }

        setIsLeaveOpen(false);
        setLeaveError(null);
        setOpenMenuFor(null);

        seenPresenceRef.current[String(selectedServerId)] = false;
        wsSend({ type: "join_server", server_id: selectedServerId });

        reloadMembers(selectedServerId);
        reloadChannels(selectedServerId);

        return () => {
            wsSend({ type: "leave_server", server_id: selectedServerId });
        };
    }, [selectedServerId]);

    useEffect(() => {
        if (!me?.id) return;

        const channelId = selectedChannelId ? String(selectedChannelId) : null;
        if (!channelId) return;

        wsSend({ type: "join_channel", channel_id: channelId });

        return () => {
            wsSend({ type: "leave_channel", channel_id: channelId });
            setTypingUsers({});
            typingTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
            typingTimeoutsRef.current.clear();
        };
    }, [selectedChannelId, me?.id]);

    async function createServer() {
        setCreateError(null);
        const name = serverName.trim();

        if (name.length < 3) return setCreateError("Le nom doit faire au moins 3 caractères.");
        if (name.length > 50) return setCreateError("Le nom doit faire maximum 50 caractères.");

        try {
            setIsCreating(true);
            const created = await api<Server>("/api/servers", { method: "POST", body: JSON.stringify({ name }) });
            setIsCreateOpen(false);
            setServerName("");
            await refreshServers(created.id);
        } catch (e: any) {
            setCreateError(e?.message ?? "Impossible de créer le serveur.");
        } finally {
            setIsCreating(false);
        }
    }

    async function joinServer() {
        setJoinError(null);
        const code = joinCode.trim().toUpperCase();
        if (code.length !== 8) {
            setJoinError("Le code doit faire 8 caractères.");
            return;
        }
        try {
            setIsJoining(true);
            const joined = await joinServerByCode(code);

            setIsJoinOpen(false);
            setJoinCode("");

            await refreshServers(joined.id);

            wsSend({ type: "join_server", server_id: joined.id });
            await reloadMembers(joined.id);
            await reloadChannels(joined.id);

            pushToast(`Tu as rejoint ${joined.name}`, "success");
        } catch (e: any) {
            setJoinError(e?.message ?? "Impossible de rejoindre ce serveur.");
        } finally {
            setIsJoining(false);
        }
    }

    function openCreateChannel() {
        if (!canCreateChannel) return;
        if (!selectedServerId) return;
        setChannelCreateError(null);
        setChannelName("");
        setIsChannelCreateOpen(true);
    }

    async function createChannel() {
        if (!selectedServerId) return;

        setChannelCreateError(null);
        const name = channelName.trim();

        if (name.length < 3) return setChannelCreateError("Le nom doit faire au moins 3 caractères.");
        if (name.length > 50) return setChannelCreateError("Le nom doit faire maximum 50 caractères.");

        try {
            setIsChannelCreating(true);
            const created = await api<Channel>(`/api/servers/${selectedServerId}/channels`, {
                method: "POST",
                body: JSON.stringify({ name }),
            });

            setIsChannelCreateOpen(false);
            setChannelName("");

            await reloadChannels(selectedServerId);
            setSelectedChannelId(String(created.id));
            pushToast(`Salon #${created.name} créé`, "success");
        } catch (e: any) {
            setChannelCreateError(e?.message ?? "Impossible de créer le salon.");
        } finally {
            setIsChannelCreating(false);
        }
    }

    async function deleteChannel(channelId: string) {
        if (!selectedServerId) return;
        if (!canCreateChannel) return;

        try {
            await api<void>(`/api/channels/${channelId}`, { method: "DELETE" });

            setChannels((prev) => {
                const next = prev.filter((c) => String(c.id) !== String(channelId));

                setSelectedChannelId((prevSelected) => {
                    if (prevSelected && String(prevSelected) !== String(channelId)) return prevSelected;
                    return next.length ? String(next[0].id) : null;
                });

                return next;
            });

            pushToast("Salon supprimé", "warn");

            await reloadChannels(selectedServerId);
        } catch (e: any) {
            pushToast("Suppression refusée", "warn");
            console.error(e);
        }
    }

    function openInviteMember() {
        if (!selectedServerId || !selectedServer) return;
        if (!canInviteMember) return;
        setInviteError(null);
        setInviteCopied(false);
        setIsInviteOpen(true);
    }

    function openServerSettings() {
        if (!selectedServer || !isOwner) return;
        setSettingsError(null);
        setDeleteConfirm("");
        setSettingsName(selectedServer.name);
        setIsSettingsOpen(true);
    }

    async function saveServerSettings() {
        if (!selectedServer || !isOwner) return;

        setSettingsError(null);
        const name = settingsName.trim();
        if (name.length < 3) return setSettingsError("Le nom doit faire au moins 3 caractères.");
        if (name.length > 50) return setSettingsError("Le nom doit faire maximum 50 caractères.");

        try {
            setIsSavingSettings(true);
            await api<Server>(`/api/servers/${selectedServer.id}`, {
                method: "PUT",
                body: JSON.stringify({ name }),
            });

            setIsSettingsOpen(false);
            await refreshServers(selectedServer.id);
        } catch (e: any) {
            setSettingsError(e?.message ?? "Impossible de renommer le serveur.");
        } finally {
            setIsSavingSettings(false);
        }
    }

    async function deleteServer() {
        if (!selectedServer || !isOwner) return;

        if (deleteConfirm.trim().toLowerCase() !== "delete") {
            setSettingsError("Tape DELETE pour confirmer la suppression.");
            return;
        }

        try {
            setIsSavingSettings(true);
            await api<void>(`/api/servers/${selectedServer.id}`, { method: "DELETE" });

            wsSend({ type: "leave_server", server_id: selectedServer.id });

            setIsSettingsOpen(false);

            const list = await api<Server[]>("/api/servers");
            setServers(list);
            setSelectedServerId(list.length ? list[0].id : null);
        } catch (e: any) {
            setSettingsError(e?.message ?? "Impossible de supprimer le serveur.");
        } finally {
            setIsSavingSettings(false);
        }
    }

    async function leaveServer() {
        if (!selectedServerId) return;
        if (isOwner) return;

        setLeaveError(null);
        try {
            setIsLeaving(true);

            await leaveServerRequest(selectedServerId);
            wsSend({ type: "leave_server", server_id: selectedServerId });

            setMembers([]);
            setChannels([]);
            setSelectedChannelId(null);
            setOnlineUserIds(new Set());
            setIsLeaveOpen(false);

            const list = await api<Server[]>("/api/servers");
            setServers(list);

            const nextId = list.length ? list[0].id : null;
            setSelectedServerId(nextId);

            if (nextId) {
                wsSend({ type: "join_server", server_id: nextId });
                await reloadMembers(nextId);
                await reloadChannels(nextId);
            }

            pushToast("Tu as quitté le serveur", "warn");
        } catch (e: any) {
            setLeaveError(e?.message ?? "Impossible de quitter le serveur.");
        } finally {
            setIsLeaving(false);
        }
    }

    async function toggleReaction(messageId: string, emoji: string, hasReacted: boolean) {
        if (!selectedChannelId || !me) return;
        
        // ⚡️ 1. MISE À JOUR OPTIMISTE : On modifie l'écran instantanément !
        setMessages((prev) => prev.map(m => {
            if (m.message_id !== messageId) return m;
            
            const reactions = m.reactions || [];
            const existing = reactions.find(r => r.emoji === emoji);
            
            if (hasReacted) {
                // On retire notre ID de la liste
                const newReactions = reactions
                    .map(r => r.emoji === emoji ? { ...r, users: r.users.filter(uid => String(uid) !== String(me.id)) } : r)
                    .filter(r => r.users.length > 0); // On supprime l'emoji si le compteur tombe à 0
                return { ...m, reactions: newReactions };
            } else {
                // On ajoute notre ID à la liste
                if (existing) {
                    return {
                        ...m,
                        reactions: reactions.map(r => r.emoji === emoji ? { ...r, users: [...r.users, String(me.id)] } : r)
                    };
                } else {
                    return { ...m, reactions: [...reactions, { emoji, users: [String(me.id)] }] };
                }
            }
        }));

        // 🌍 2. APPEL API : On prévient le serveur en arrière-plan
        try {
            if (hasReacted) {
                await api(`/api/messages/${messageId}/reactions`, {
                    method: "DELETE",
                    body: JSON.stringify({ emoji, channel_id: selectedChannelId })
                });
            } else {
                await api(`/api/messages/${messageId}/reactions`, {
                    method: "POST",
                    body: JSON.stringify({ emoji, channel_id: selectedChannelId })
                });
            }
        } catch (e) {
            pushToast("Erreur de synchronisation de la réaction", "warn");
        }
    }

    if (!hasCheckedAuth) return null;

    return (
        <div className={`flex h-screen bg-black text-[#DCCBC4] ${miskan.variable} ${nunito.variable} font-sans overflow-hidden p-[8px] gap-[8px]`}>
            {toasts.length > 0 && (
                <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
                    {toasts.map((t) => (
                        <div
                            key={t.id}
                            className={[
                                "px-4 py-3 rounded-2xl border shadow-xl text-sm font-[family-name:var(--font-nunito)]",
                                t.kind === "success" ? "bg-[#0a0605] border-green-500/30 text-green-200" : "",
                                t.kind === "warn" ? "bg-[#0a0605] border-red-500/30 text-red-200" : "",
                                t.kind === "info" ? "bg-[#0a0605] border-[#ffffff]/10 text-[#DCCBC4]" : "",
                            ].join(" ")}
                        >
                            {t.text}
                        </div>
                    ))}
                </div>
            )}

            <div className="w-[72px] bg-[#1E1211] rounded-[20px] flex flex-col items-center py-6 gap-4 z-20 h-full shadow-lg">
                <Link href="/" className="w-12 h-12 flex items-center justify-center hover:rounded-xl transition-all cursor-pointer group">
                    <div className="relative w-12 h-12 transition-transform duration-300 group-hover:rotate-12">
                        <Image src={logoImage} alt="Logo CatCat" />
                    </div>
                </Link>
                <div className="w-8 h-[2px] bg-[#ffffff]/10 rounded-full" />
                <div className="flex flex-col items-center gap-3 w-full px-2">
                    {servers.map((s) => {
                        const active = s.id === selectedServerId;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setSelectedServerId(s.id)}
                                title={s.name}
                                className={[
                                    "w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all cursor-pointer flex items-center justify-center",
                                    active ? "bg-[#EB5E28] text-white" : "bg-[#2A1A18] text-[#EB5E28] hover:bg-[#EB5E28] hover:text-white",
                                ].join(" ")}
                            >
                                <span className="font-bold text-sm">{s.name?.slice(0, 2).toUpperCase() || "SV"}</span>
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    title="Créer un serveur"
                    className="w-12 h-12 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
                <button
                    onClick={() => setIsJoinOpen(true)}
                    title="Rejoindre un serveur"
                    className="w-12 h-12 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer mt-2"
                >
                    <EnterIcon />
                </button>
                <div className="mt-auto w-10 h-10 bg-[#bef264] rounded-full flex items-center justify-center text-[#1E1211] font-bold text-xs border-2 border-[#1E1211]">
                    {initials}
                </div>
            </div>

            <div className="w-60 bg-[#150d0c] rounded-[20px] flex flex-col hidden md:flex h-full shadow-lg overflow-hidden">
                <div className="h-16 flex items-center px-4 font-[family-name:var(--font-nunito)] font-bold text-[#FFF8F0] border-b border-[#ffffff]/5">
                    <span className="mr-2 text-[#EB5E28]">&gt;</span>
                    {selectedServer ? selectedServer.name : "Aucun serveur"}
                    {selectedServer &&
                        (isOwner ? (
                            <button
                                onClick={openServerSettings}
                                title="Paramètres du serveur"
                                className="ml-auto p-2 rounded-xl hover:bg-[#1E1211] border border-transparent hover:border-[#ffffff]/10 transition-colors text-[#DCCBC4]/70 hover:text-white cursor-pointer"
                            >
                                <GearIcon />
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    if (!selectedServerId) return;
                                    setLeaveError(null);
                                    setIsLeaveOpen(true);
                                }}
                                title="Quitter le serveur"
                                className="ml-auto p-2 rounded-xl hover:bg-[#1E1211] border border-transparent hover:border-red-500/30 transition-colors text-red-300 hover:text-red-200 cursor-pointer"
                            >
                                <LeaveIcon />
                            </button>
                        ))}
                </div>

                <div className="flex-1 flex flex-col">
                    <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider text-[#DCCBC4]/50 font-[family-name:var(--font-nunito)] flex items-center">
                        Salons
                        <button
                            onClick={openCreateChannel}
                            disabled={!selectedServerId || !canCreateChannel}
                            title={!selectedServerId ? "Sélectionne un serveur" : canCreateChannel ? "Créer un salon" : "Seuls owner/admin"}
                            className={[
                                "ml-auto w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer",
                                selectedServerId && canCreateChannel ? "border-[#ffffff]/10 hover:bg-[#1E1211] text-[#EB5E28]" : "border-[#ffffff]/5 text-[#DCCBC4]/30 cursor-not-allowed",
                            ].join(" ")}
                        >
                            +
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 pb-3">
                        {!selectedServerId ? (
                            <div className="px-2 py-2 text-sm text-[#DCCBC4]/50">Sélectionne / crée un serveur.</div>
                        ) : channels.length === 0 ? (
                            <div className="px-2 py-2 text-sm text-[#DCCBC4]/50">Aucun salon.</div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {channels.map((c) => {
                                    const active = String(c.id) === String(selectedChannelId);

                                    return (
                                        <div
                                            key={c.id}
                                            className={[
                                                "group flex items-center gap-2 px-3 py-2 rounded-xl transition-colors font-[family-name:var(--font-nunito)]",
                                                active ? "bg-[#1E1211] text-white" : "hover:bg-[#1E1211] text-[#DCCBC4]/80",
                                            ].join(" ")}
                                            title={`#${c.name}`}
                                        >
                                            <button onClick={() => setSelectedChannelId(String(c.id))} className="flex-1 text-left min-w-0 cursor-pointer">
                                                <span className="text-[#EB5E28] mr-2">#</span>
                                                <span className="truncate">{c.name}</span>
                                            </button>

                                            {active && canEditChannel && (
                                                <button
                                                    onClick={openEditChannel}
                                                    title="Renommer le salon"
                                                    className="p-2 rounded-xl border border-[#ffffff]/10 text-[#DCCBC4]/70 hover:bg-[#1E1211] hover:text-white cursor-pointer"
                                                >
                                                    <PencilIcon />
                                                </button>
                                            )}

                                            {canCreateChannel && (
                                                <button
                                                    onClick={() => {
                                                        if (!window.confirm(`Supprimer le salon #${c.name} ?`)) return;
                                                        deleteChannel(String(c.id));
                                                    }}
                                                    title="Supprimer"
                                                    className="group-hover:opacity-100 transition-opacity text-red-300 hover:text-red-200 px-2 cursor-pointer"
                                                >
                                                    🗑
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-[#0F0908] rounded-[20px] relative h-full shadow-lg overflow-hidden">
                <div className="h-auto py-4 px-6 flex flex-col gap-3 border-b border-[#ffffff]/5">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h2 className="font-[family-name:var(--font-nunito)] font-bold text-xl text-white">{selectedServer ? selectedServer.name : "Chat"}</h2>
                            </div>

                            {selectedServerId && selectedChannel ? (
                                <div className="text-sm text-[#DCCBC4]/60">
                                    Salon actuel: <span className="text-[#DCCBC4]/80">#{selectedChannel.name}</span>
                                </div>
                            ) : selectedServerId ? (
                                <div className="text-sm text-[#DCCBC4]/60">Aucun salon sélectionné</div>
                            ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={openInviteMember}
                                disabled={!selectedServerId || !canInviteMember}
                                title={!selectedServerId ? "Sélectionne un serveur" : canInviteMember ? "Inviter un membre" : "Seuls les proprio/admins peuvent inviter"}
                                className={[
                                    "px-3 py-2 rounded-xl border border-[#ffffff]/10 flex items-center gap-2 transition-colors cursor-pointer",
                                    selectedServerId && canInviteMember ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white" : "bg-transparent text-[#DCCBC4]/40 cursor-not-allowed",
                                ].join(" ")}
                            >
                                <UserPlusIcon />
                                <span className="text-sm font-bold">Inviter</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 font-[family-name:var(--font-nunito)] relative">
                    {selectedServerId && selectedChannel && (channelCreatedLabel || channelUpdatedLabel) && (
                        <div className="absolute top-4 right-6 text-right">
                            {channelCreatedLabel && <div className="text-xs text-[#DCCBC4]/60">Créé le {channelCreatedLabel}</div>}
                            {channelUpdatedLabel && <div className="text-xs text-[#DCCBC4]/40">Mis à jour le {channelUpdatedLabel}</div>}
                        </div>
                    )}

                    {!selectedServerId ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg">
                                <div className="text-white font-bold text-lg mb-2">Choisis un serveur</div>
                                <div className="text-sm text-[#DCCBC4]/60">
                                    Sélectionne un serveur à gauche, ou crée-en un avec le bouton <span className="text-[#EB5E28] font-bold">+</span>.
                                </div>
                            </div>
                        </div>
                    ) : channels.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-[#1E1211] border border-[#ffffff]/10 flex items-center justify-center text-[#EB5E28]">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-white font-bold text-lg">Aucun salon pour l’instant</div>
                                        <div className="text-sm text-[#DCCBC4]/60 mt-1">
                                            Crée ton premier salon pour commencer à discuter. (ex: <span className="text-[#DCCBC4]/80">général</span>)
                                        </div>
                                        <div className="mt-4 flex items-center gap-2">
                                            <button
                                                onClick={openCreateChannel}
                                                disabled={!canCreateChannel}
                                                className={[
                                                    "px-4 py-2 rounded-xl font-bold transition-colors cursor-pointer",
                                                    canCreateChannel ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white" : "bg-transparent border border-[#ffffff]/10 text-[#DCCBC4]/40 cursor-not-allowed",
                                                ].join(" ")}
                                                title={canCreateChannel ? "Créer un salon" : "Seuls les owners/admins peuvent créer un salon"}
                                            >
                                                Créer mon premier salon
                                            </button>
                                            {!canCreateChannel && <span className="text-xs text-[#DCCBC4]/40">Demande au(x) proprio/admin de créer un salon.</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : !selectedChannelId ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg">
                                <div className="text-white font-bold text-lg mb-2">Choisis un salon</div>
                                <div className="text-sm text-[#DCCBC4]/60">Sélectionne un salon dans la colonne de gauche.</div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            <div className="flex-1 overflow-y-auto pr-2" ref={messagesBoxRef}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-xs text-[#DCCBC4]/50">{messagesLoading ? "Chargement..." : `${messages.length} message(s)`}</div>

                                    {hasMoreMessages && messages.length > 0 && (
                                        <button
                                            onClick={loadMoreMessages}
                                            disabled={loadingMore}
                                            className="text-xs px-3 py-1 rounded-full border border-[#ffffff]/10 hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                                        >
                                            {loadingMore ? "Chargement..." : "Charger plus"}
                                        </button>
                                    )}
                                </div>

                                {messagesError && <div className="text-sm text-red-400 mb-3">{messagesError}</div>}

                                {!selectedChannelId ? (
                                    <div className="text-sm text-[#DCCBC4]/50">Choisis un salon.</div>
                                ) : messagesLoading ? (
                                    <div className="text-sm text-[#DCCBC4]/50">Chargement des messages...</div>
                                ) : messages.length === 0 ? (
                                    <div className="text-sm text-[#DCCBC4]/50">Aucun message pour l’instant.</div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {messages.map((m) => {
                                            const isMe = me && String(me.id) === String(m.user_id);
                                            const time = formatTimeFR(m.created_at);
                                            const canDeleteThis = !m.is_deleted && (isMe || canModerateMessages);

                                            return (
                                                <div key={m.message_id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                    {!isMe && (
                                                        <div className="mr-3 mt-1 shrink-0">
                                                            <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4]">
                                                                {getInitials(m.username)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className={`min-w-0 max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col group`}>
    
                                                        {/* 1. Header (Nom d'utilisateur) - Uniquement pour les autres */}
                                                        {!isMe && (
                                                            <div className="flex items-center gap-2 mb-1 px-1">
                                                                <span className="text-xs font-bold text-[#EB5E28]">@{m.username}</span>
                                                                {time && <span className="text-[10px] text-[#DCCBC4]/40">{time}</span>}
                                                            </div>
                                                        )}

                                                        {/* 2. Bulle de message */}
                                                        <div
                                                            className={[
                                                                "px-4 py-3 rounded-2xl border border-[#ffffff]/10 shadow-sm",
                                                                "whitespace-pre-wrap break-words text-sm leading-relaxed",
                                                                isMe ? "bg-[#2563EB] text-white rounded-br-md" : "bg-[#1E1211] text-[#DCCBC4] rounded-bl-md",
                                                            ].join(" ")}
                                                        >
                                                            {m.is_deleted ? <span className="text-white/60 italic">message supprimé</span> : m.content}
                                                        </div>

                                                        {/* 3. Les Réactions (juste sous la bulle) */}
                                                        {m.reactions && m.reactions.length > 0 && (
                                                            <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                                                {m.reactions.map((r) => {
                                                                    const hasReacted = me ? r.users.includes(me.id) : false;
                                                                    return (
                                                                        <button
                                                                            key={r.emoji}
                                                                            onClick={() => toggleReaction(m.message_id, r.emoji, hasReacted)}
                                                                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] transition-all cursor-pointer
                                                                                ${hasReacted 
                                                                                    ? "bg-[#EB5E28]/20 border-[#EB5E28] text-[#EB5E28]" 
                                                                                    : "bg-[#0F0908] border-[#ffffff]/10 text-[#DCCBC4]/70 hover:border-[#ffffff]/30"}`}
                                                                        >
                                                                            <span>{r.emoji}</span>
                                                                            <span className="font-bold">{r.users.length}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* 4. Footer (Moi, édité, Supprimer, Réagir) */}
                                                        <div className={`flex items-center gap-2 mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                                            {isMe && <span className="text-[10px] text-white/70">moi</span>}
                                                            {isMe && time && <span className="text-[10px] text-white/40">{time}</span>}
                                                            {m.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">• édité</span>}
                                                            
                                                            {/* Actions rapides au survol du message */}
                                                            {/* Actions rapides au survol du message */}
                                                            {/* On force l'opacité à 100% si le menu est ouvert pour éviter qu'il disparaisse quand on bouge la souris */}
                                                            <div className={`flex items-center gap-2 transition-opacity ${activePickerId === m.message_id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                                                
                                                                {/* BOUTON + 😀 */}
                                                                <div className="relative">
                                                                    <button 
                                                                        onClick={() => setActivePickerId(prev => prev === m.message_id ? null : m.message_id)}
                                                                        className="text-[10px] px-1 text-[#DCCBC4]/40 hover:text-white cursor-pointer"
                                                                        title="Ajouter une réaction"
                                                                    >
                                                                        + 😀
                                                                    </button>
                                                                </div>

                                                                {canDeleteThis && (
                                                                    <button
                                                                        onClick={() => deleteMyMessage(m.message_id)}
                                                                        className="text-[10px] text-[#DCCBC4]/40 hover:text-red-300 cursor-pointer"
                                                                    >
                                                                        🗑
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 pt-2 border-t border-[#ffffff]/5">
                    {typingLabel && <div className="px-6 pb-2 text-xs text-[#DCCBC4]/50 font-[family-name:var(--font-nunito)]">{typingLabel}</div>}
                    <div className="bg-[#1E1211] rounded-full flex items-center px-6 py-3 border border-[#ffffff]/5">
                        <input
                            type="text"
                            value={messageText}
                            onChange={(e) => {
                                setMessageText(e.target.value);
                                sendTyping();
                            }}
                            onKeyDown={onMessageKeyDown}
                            disabled={!selectedServerId || !selectedChannelId || isSending}
                            placeholder={selectedServerId && selectedChannel ? `Message dans #${selectedChannel.name}…` : "Choisis un salon pour commencer…"}
                            className="flex-1 bg-transparent text-[#DCCBC4] placeholder-[#DCCBC4]/30 focus:outline-none font-[family-name:var(--font-nunito)]"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!selectedServerId || !selectedChannelId || isSending || !messageText.trim()}
                            className={[
                                "ml-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                                selectedServerId && selectedChannelId && messageText.trim()
                                    ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white cursor-pointer"
                                    : "bg-[#2A1A18] text-[#DCCBC4]/30 cursor-not-allowed",
                            ].join(" ")}
                            title="Envoyer"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                        </button>
                    </div>
                </div>
                {activePickerId && (
            <div className="absolute bottom-24 right-8 z-[9999] shadow-2xl rounded-xl overflow-hidden border border-[#ffffff]/10">
                <EmojiPicker 
                    theme={Theme.DARK} 
                    onEmojiClick={(emojiData) => {
                        // 1. On retrouve le message concerné
                        const msg = messages.find(m => m.message_id === activePickerId);
                        if (!msg) return;
                        
                        // 2. On vérifie si on a déjà mis cet emoji
                        const hasReacted = msg.reactions?.find(r => r.emoji === emojiData.emoji)?.users.includes(me?.id || "");
                        
                        // 3. On déclenche la fonction
                        toggleReaction(activePickerId, emojiData.emoji, !!hasReacted);
                        
                        // 4. On ferme le menu
                        setActivePickerId(null);
                    }}
                />
            </div>
        )}
            </div>

            <div className="w-72 bg-[#0a0605] rounded-[20px] hidden xl:flex flex-col h-full shadow-lg overflow-hidden">
                <div className="h-16 flex items-center px-4 font-[family-name:var(--font-nunito)] font-bold text-[#FFF8F0] border-b border-[#ffffff]/5">
                    Membres
                    <span className="ml-auto text-xs text-[#DCCBC4]/40 font-normal">{members.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                    {!selectedServerId ? (
                        <div className="text-sm text-[#DCCBC4]/50 px-2 py-2">Sélectionne un serveur.</div>
                    ) : members.length === 0 ? (
                        <div className="text-sm text-[#DCCBC4]/50 px-2 py-2">Aucun membre.</div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-1">
                                {members.map((m) => {
                                    const online = onlineUserIds.has(String(m.user_id));
                                    const ownerByServerField = selectedServer?.owner_id && String(selectedServer.owner_id) === String(m.user_id);
                                    const ownerByRole = m.role === "owner";
                                    const isOwnerMember = ownerByRole || ownerByServerField;
                                    
                                    const isMe = myIdRef.current && String(myIdRef.current) === String(m.user_id);
                                    const canManageThis = Boolean(selectedServerId && isOwner && !isOwnerMember && !isMe);
                                    
                                    const isTyping =
                                    !!selectedChannelId &&
                                    !!typingUsers[String(m.user_id)] &&
                                    String(typingUsers[String(m.user_id)]?.channelId) === String(selectedChannelId);
                                    
                                    return (
                                        <div key={m.user_id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#1E1211] transition-colors">
                                            <div className="relative">
                                                <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4]">
                                                    {getInitials(m.username)}
                                                </div>
                                                <span
                                                    className={[
                                                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0605]",
                                                        isTyping ? "bg-[#EB5E28]" : online ? "bg-green-500" : "bg-[#ffffff]/20",
                                                    ].join(" ")}
                                                    />
                                            </div>
                                            <div className="flex flex-col leading-tight min-w-0 flex-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-white font-bold text-sm truncate">@{m.username}</span>
                                                    {isOwnerMember && (
                                                        <span title="Owner" className="text-[#FBBF24]">
                                                            <CrownIcon />
                                                        </span>
                                                    )}
                                                    {m.role === "admin" && !isOwnerMember && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#1E1211] border border-[#ffffff]/10 text-[#DCCBC4]/70">
                                                            admin
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-[#DCCBC4]/50">{isTyping ? "Écrit…" : online ? "En ligne" : "Hors ligne"}</span>
                                            </div>

                                            {canManageThis && (
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setOpenMenuFor((prev) => (prev === String(m.user_id) ? null : String(m.user_id)))}
                                                        className="w-9 h-9 rounded-xl border border-[#ffffff]/10 text-[#DCCBC4]/70 hover:bg-[#0F0908] hover:text-white cursor-pointer flex items-center justify-center"
                                                        title="Actions"
                                                        >
                                                        ⋯
                                                    </button>
                                                    {openMenuFor === String(m.user_id) && (
                                                        <MemberActionsMenu
                                                        username={m.username}
                                                        userId={String(m.user_id)}
                                                        serverId={selectedServerId}
                                                        role={m.role}
                                                        onKick={handleKickMember}
                                                        onBan={handleBanMember}
                                                        onSetRole={setMemberRole}
                                                        onTransferOwner={transferOwner}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {myRole != "member" &&
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#1E1211] transition-colors">
                                        <button
                                            onClick={() => setShowBans(true)}
                                            className="text-xs text-[#DCCBC4]/60 hover:text-white cursor-pointer"
                                            >
                                            Utilisateurs bannis
                                        </button>
                                    </div>
                                </div>
                            }
                        </>
                    )}
                </div>
            </div>
            {showBans && myRole != "member" && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl p-6 w-[420px]">
                    
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">Utilisateurs bannis</h2>

                        <button
                        onClick={() => setShowBans(false)}
                        className="text-[#DCCBC4]/60 hover:text-white cursor-pointer"
                        >
                        ✕
                        </button>
                    </div>

                    <BanList serverId={selectedServerId!} />

                    </div>
                </div>
            )}
            {isChannelEditOpen && selectedChannel && canEditChannel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isChannelSaving && setIsChannelEditOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Renommer le salon</h3>
                            <button onClick={() => !isChannelSaving && setIsChannelEditOpen(false)} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer">
                                ✕
                            </button>
                        </div>

                        <label className="block text-sm text-[#DCCBC4]/70 mb-2">Nom du salon</label>
                        <input
                            value={channelEditName}
                            onChange={(e) => setChannelEditName(e.target.value)}
                            placeholder="ex: general"
                            className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                        />

                        {channelEditError && <div className="mt-3 text-sm text-red-400">{channelEditError}</div>}

                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                onClick={() => setIsChannelEditOpen(false)}
                                disabled={isChannelSaving}
                                className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={saveChannelEdit}
                                disabled={isChannelSaving}
                                className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                            >
                                {isChannelSaving ? "Sauvegarde..." : "Sauvegarder"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isChannelCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isChannelCreating && setIsChannelCreateOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Créer un salon</h3>
                            <button onClick={() => !isChannelCreating && setIsChannelCreateOpen(false)} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer">
                                ✕
                            </button>
                        </div>

                        <label className="block text-sm text-[#DCCBC4]/70 mb-2">Nom du salon</label>
                        <input
                            value={channelName}
                            onChange={(e) => setChannelName(e.target.value)}
                            placeholder="ex: general"
                            className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                        />

                        {channelCreateError && <div className="mt-3 text-sm text-red-400">{channelCreateError}</div>}

                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                onClick={() => setIsChannelCreateOpen(false)}
                                disabled={isChannelCreating}
                                className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={createChannel}
                                disabled={isChannelCreating}
                                className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                            >
                                {isChannelCreating ? "Création..." : "Créer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isCreating && setIsCreateOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Créer un serveur</h3>
                            <button onClick={() => !isCreating && setIsCreateOpen(false)} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer">
                                ✕
                            </button>
                        </div>
                        <label className="block text-sm text-[#DCCBC4]/70 mb-2">Nom du serveur</label>
                        <input
                            value={serverName}
                            onChange={(e) => setServerName(e.target.value)}
                            placeholder="ex: CatCat Dev Server"
                            className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                        />
                        {createError && <div className="mt-3 text-sm text-red-400">{createError}</div>}
                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                onClick={() => setIsCreateOpen(false)}
                                disabled={isCreating}
                                className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={createServer}
                                disabled={isCreating}
                                className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                            >
                                {isCreating ? "Création..." : "Créer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isJoinOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isJoining && setIsJoinOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Rejoindre un serveur</h3>
                            <button onClick={() => !isJoining && setIsJoinOpen(false)} className="text-[#DCCBC4]/60 hover:text-white">
                                ✕
                            </button>
                        </div>
                        <label className="block text-sm text-[#DCCBC4]/70 mb-2">Code d’invitation</label>
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="ex: 7F2K9A1B"
                            className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                        />
                        {joinError && <div className="mt-3 text-sm text-red-400">{joinError}</div>}
                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                onClick={() => setIsJoinOpen(false)}
                                disabled={isJoining}
                                className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={joinServer}
                                disabled={isJoining}
                                className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                            >
                                {isJoining ? "Rejoindre..." : "Rejoindre"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isInviteOpen && selectedServer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => setIsInviteOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Inviter un membre</h3>
                                <div className="text-xs text-[#DCCBC4]/50 mt-1">Serveur: {selectedServer.name}</div>
                            </div>
                            <button onClick={() => setIsInviteOpen(false)} className="text-[#DCCBC4]/60 hover:text-white">
                                ✕
                            </button>
                        </div>
                        <div className="rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-4">
                            <div className="text-white font-bold mb-2">Code d’invitation</div>
                            <div className="text-sm text-[#DCCBC4]/60 mb-3">Partage ce code à ton pote.</div>
                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={selectedServer.invitation_code ?? ""}
                                    className="flex-1 bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none"
                                />
                                <button
                                    onClick={async () => {
                                        setInviteError(null);
                                        const code = selectedServer?.invitation_code?.trim();
                                        if (!code) return setInviteError("Aucun code d’invitation disponible.");
                                        try {
                                            await navigator.clipboard.writeText(code);
                                            setInviteCopied(true);
                                            window.setTimeout(() => setInviteCopied(false), 1200);
                                        } catch {
                                            setInviteError("Impossible de copier. Sélectionne le texte et fais Ctrl+C.");
                                        }
                                    }}
                                    className="px-4 py-3 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white transition-colors cursor-pointer"
                                >
                                    {inviteCopied ? "Copié" : "Copier"}
                                </button>
                            </div>
                            {inviteError && <div className="mt-3 text-sm text-red-400">{inviteError}</div>}
                        </div>
                        <div className="mt-4 text-xs text-[#DCCBC4]/40">Tip: tu peux aussi coller ce code dans “Rejoindre un serveur”.</div>
                    </div>
                </div>
            )}

            {isSettingsOpen && selectedServer && isOwner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isSavingSettings && setIsSettingsOpen(false)} />
                    <div className="relative w-full max-w-lg rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Paramètres du serveur</h3>
                                <div className="text-xs text-[#DCCBC4]/50 mt-1">Serveur: {selectedServer.name}</div>
                            </div>
                            <button onClick={() => !isSavingSettings && setIsSettingsOpen(false)} className="text-[#DCCBC4]/60 hover:text-white">
                                ✕
                            </button>
                        </div>
                        <div className="rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-4">
                            <div className="text-white font-bold mb-2">Renommer le serveur</div>
                            <label className="block text-sm text-[#DCCBC4]/70 mb-2">Nom</label>
                            <input
                                value={settingsName}
                                onChange={(e) => setSettingsName(e.target.value)}
                                className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                            />
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={saveServerSettings}
                                    disabled={isSavingSettings}
                                    className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                                >
                                    {isSavingSettings ? "Sauvegarde..." : "Sauvegarder"}
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 rounded-2xl border border-red-500/20 bg-[#0a0605] p-4">
                            <div className="text-red-300 font-bold mb-1">Supprimer le serveur</div>
                            <div className="text-sm text-[#DCCBC4]/60">
                                Cette action est <span className="text-red-300 font-bold">irréversible</span>. Même s’il y a des membres dedans.
                            </div>
                            <div className="mt-3">
                                <div className="text-xs text-[#DCCBC4]/50 mb-2">
                                    Tape <span className="text-red-300 font-bold">DELETE</span> pour confirmer
                                </div>
                                <input
                                    value={deleteConfirm}
                                    onChange={(e) => setDeleteConfirm(e.target.value)}
                                    placeholder="DELETE"
                                    className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-red-500/20 focus:outline-none focus:ring-1 focus:ring-red-400"
                                />
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={deleteServer}
                                    disabled={isSavingSettings}
                                    className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 disabled:opacity-50 cursor-pointer"
                                >
                                    {isSavingSettings ? "Suppression..." : "Supprimer"}
                                </button>
                            </div>
                        </div>
                        {settingsError && <div className="mt-4 text-sm text-red-400">{settingsError}</div>}
                    </div>
                </div>
            )}

            {isLeaveOpen && selectedServer && !isOwner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => !isLeaving && setIsLeaveOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Quitter le serveur</h3>
                                <div className="text-xs text-[#DCCBC4]/50 mt-1">Serveur: {selectedServer.name}</div>
                            </div>
                            <button onClick={() => !isLeaving && setIsLeaveOpen(false)} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer">
                                ✕
                            </button>
                        </div>

                        <div className="rounded-2xl border border-red-500/20 bg-[#0a0605] p-4">
                            <div className="text-sm text-[#DCCBC4]/70">
                                Tu vas quitter ce serveur. Tu pourras le rejoindre de nouveau uniquement avec un code d’invitation.
                            </div>

                            {leaveError && <div className="mt-3 text-sm text-red-400">{leaveError}</div>}

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    onClick={() => setIsLeaveOpen(false)}
                                    disabled={isLeaving}
                                    className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={leaveServer}
                                    disabled={isLeaving}
                                    className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 disabled:opacity-50 cursor-pointer"
                                >
                                    {isLeaving ? "Quitte..." : "Quitter"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

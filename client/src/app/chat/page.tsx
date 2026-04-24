"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";
import { useRouter } from "next/navigation";
import {
  getServerMembers,
  kickMember,
  setMemberRole as setMemberRoleRequest,
  transferOwner as transferOwnerRequest,
  leaveServer as leaveServerRequest,
  type Member,
  type MemberRole,
} from "@/features/chat/services/members.service";
import { api } from "@/lib/api";
import { banMember, banTemporaryMember } from "@/features/chat/services/bans.service";
import { ServerList } from "@/components/chat/ServerList";
import { ServerChannelsSidebar } from "@/components/chat/ServerChannelsSidebar";
import { ChannelChatPanel } from "@/components/chat/ChannelChatPanel";
import { MembersSidebar } from "@/components/chat/MembersSidebar";
import { ToastStack } from "@/components/chat/ToastStack";
import { CreateServerModal } from "@/components/chat/modals/CreateServerModal";
import { JoinServerModal } from "@/components/chat/modals/JoinServerModal";
import { ChannelCreateModal } from "@/components/chat/modals/ChannelCreateModal";
import { ChannelEditModal } from "@/components/chat/modals/ChannelEditModal";
import { ServerSettingsModal } from "@/components/chat/modals/ServerSettingsModal";
import { LeaveServerModal } from "@/components/chat/modals/LeaveServerModal";
import { TemporaryBanModal } from "@/components/chat/modals/TemporaryBanModal";
import { InviteMemberModal } from "@/components/chat/modals/InviteMemberModal";
import { BannedUsersModal } from "@/components/chat/modals/BannedUsersModal";
import { DirectMessageSidebar } from "@/components/chat/direct-message/DirectMessageSidebar";
import { DirectMessagePanel } from "@/components/chat/direct-message/DirectMessagePanel";
import { Server, Channel, WsEvent, Toast } from "@/types/chat";
import { getInitials, formatDateTime } from "@/utils/chat";
import { getFriendlyErrorMessage } from "@/utils/errors";
import { useServers } from "@/hooks/useServers";
import { useChannels } from "@/hooks/useChannels";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { useChannelMessages } from "@/hooks/useChannelMessages";
import { useWebSocket } from "@/lib/WebSocketProvider";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

const miskan = localFont({ src: "../fonts/Miskan.woff", variable: "--font-miskan" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "700"] });

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8080/ws") as string;

export default function ChatPage() {
    const t = useTranslations("chatPage");
    const locale = useLocale();
    const [initials, setInitials] = useState("??");
    const [me, setMe] = useState<{ id: string; username: string } | null>(null);
    const serversData = useServers();
    const {
        servers,
        setServers,
        selectedServerId,
        setSelectedServerId,
        refreshServers,
        isCreateOpen,
        setIsCreateOpen,
        serverName,
        setServerName,
        createError,
        isCreating,
        createServer,
        isJoinOpen,
        setIsJoinOpen,
        joinCode,
        setJoinCode,
        joinError,
        isJoining,
        joinServer,
    } = serversData;
    const channelsData = useChannels();
    const {
        channels,
        setChannels,
        isChannelCreateOpen,
        setIsChannelCreateOpen,
        channelName,
        setChannelName,
        channelCreateError,
        setChannelCreateError,
        isChannelCreating,
        createChannel: createChannelHook,
        isChannelEditOpen,
        setIsChannelEditOpen,
        editingChannelId,
        channelEditName,
        setChannelEditName,
        channelEditError,
        isChannelEditing,
        editChannel,
        openEditChannel: openEditChannelHook,
    } = channelsData;
    const [members, setMembers] = useState<Member[]>([]);
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const onlineUserIdsRef = useRef<Set<string>>(new Set());
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
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
    const toastDedupeRef = useRef<Record<string, number>>({});
    const seenPresenceRef = useRef<Record<string, boolean>>({});

    const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [activePickerId, setActivePickerId] = useState<string | null>(null);
    const router = useRouter();
    const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

    const selectedServer = useMemo(() => servers.find((s) => s.id === selectedServerId) ?? null, [servers, selectedServerId]);
    const selectedChannel = useMemo(() => channels.find((c) => String(c.id) === String(selectedChannelId)) ?? null, [channels, selectedChannelId]);

    const channelCreatedLabel = useMemo(() => formatDateTime(selectedChannel?.created_at, locale), [selectedChannel?.created_at, locale]);
    const channelUpdatedLabel = useMemo(() => formatDateTime(selectedChannel?.updated_at, locale), [selectedChannel?.updated_at, locale]);
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
    const selectedChannelIdRef = useRef<string | null>(null);

    const typingTimeoutsRef = useRef<Map<string, number>>(new Map());
    const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; channelId: string }>>({});
    const lastTypingSentAtRef = useRef<number>(0);

    const [temporaryBanModal, setTemporaryBanModal] = useState<{
    open: boolean;
    userId: string;
    username: string;
    } | null>(null);

    const [temporaryBanDuration, setTemporaryBanDuration] = useState("60");
    const [temporaryBanError, setTemporaryBanError] = useState<string | null>(null);
    const [isTemporaryBanning, setIsTemporaryBanning] = useState(false);

    useEffect(() => {
        selectedChannelIdRef.current = selectedChannelId;
    }, [selectedChannelId]);

    useEffect(() => {
        onlineUserIdsRef.current = onlineUserIds;
    }, [onlineUserIds]);

    function pushToast(text: string, kind: Toast["kind"] = "info") {
        const id = `${Date.now()}_${Math.random()}`;
        setToasts((prev) => [...prev, { id, text, kind }]);
        window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    }

    function pushToastOnce(key: string, text: string, kind: Toast["kind"] = "info", ttlMs = 3500) {
        const now = Date.now();
        const lastSeenAt = toastDedupeRef.current[key] ?? 0;
        if (now - lastSeenAt < ttlMs) return;
        toastDedupeRef.current[key] = now;

        for (const [storedKey, timestamp] of Object.entries(toastDedupeRef.current)) {
            if (now - timestamp > 30000) delete toastDedupeRef.current[storedKey];
        }

        pushToast(text, kind);
    }

    const dm = useDirectMessages({ myIdRef, pushToast });
    const { view, setView } = dm;
    const channelMessages = useChannelMessages({
        selectedServerId,
        selectedChannelId,
        currentUserId: me?.id ?? null,
        pushToast,
    });

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
        onlineUserIdsRef.current = new Set(onlineUserIdsRef.current).add(id);
        setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }

    function removeOnline(id: string) {
        const nextOnline = new Set(onlineUserIdsRef.current);
        nextOnline.delete(id);
        onlineUserIdsRef.current = nextOnline;
        setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }

    async function transferOwner(serverId: string, newOwnerId: string) {
        try {
            await transferOwnerRequest(serverId, newOwnerId);
            pushToast(t("toast.ownerTransferred"), "success");
            await refreshServers(serverId);
            await reloadMembers(serverId);
        } catch (e: any) {
            pushToast(t("toast.actionDenied"), "warn");
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

    function removeServerAfterOwnBan(serverId: string, user_id: string) {
        const sid = String(serverId);
        const isMe = String(myIdRef.current ?? "") === String(user_id);
        if (!isMe) return;

        const isCurrentServer = selectedServerIdRef.current && String(selectedServerIdRef.current) === sid;

        if (isCurrentServer && selectedChannelIdRef.current) {
            wsSend({ type: "leave_channel", channel_id: selectedChannelIdRef.current });
        }
        wsSend({ type: "leave_server", server_id: sid });

        setServers((prev) => prev.filter((server) => String(server.id) !== sid));
        setSelectedServerId((current) => (current && String(current) !== sid ? current : null));

        if (isCurrentServer) {
            setMembers([]);
            setOnlineUserIds(new Set());
            setChannels([]);
            setSelectedChannelId(null);
            channelMessages.clearMessages();
            setTypingUsers({});
            setShowBans(false);

            typingTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
            typingTimeoutsRef.current.clear();
        }

        api<Server[]>("/api/servers")
            .then((list) => {
                setServers(list);
                setSelectedServerId((current) => {
                    if (current && list.some((server) => String(server.id) === String(current))) return current;
                    return list.length ? list[0].id : null;
                });
            })
            .catch(() => {});
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

            pushToastOnce(`member_banned:${serverId}:${userId}`, t("toast.memberBannedPermanently"), "warn")
        } catch (e) {
            pushToast(getFriendlyErrorMessage(e, "generic"), "warn")
        }
    }

    async function handleBanTemporaryMember(serverId: string, userId: string, durationMinutes: number) {
        try {
            setIsTemporaryBanning(true);
            setTemporaryBanError(null);

            await banTemporaryMember(serverId, userId, durationMinutes);

            removeMember(serverId, userId);

            if (String(userId) === String(me?.id ?? "")) {
                removeServerAfterOwnBan(serverId, userId);
            }

            setTemporaryBanModal(null);
            setTemporaryBanDuration("60");
        } catch (e) {
            setTemporaryBanError(getFriendlyErrorMessage(e, "temporaryBan"));
        } finally {
            setIsTemporaryBanning(false);
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
        } catch (e) {
            pushToast(getFriendlyErrorMessage(e, "loadMembers"), "warn");
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
        } catch (e) {
            pushToast(getFriendlyErrorMessage(e, "loadChannels"), "warn");
            setChannels([]);
            setSelectedChannelId(null);
        }
    }

    function handleOpenEditChannel() {
        if (!canEditChannel) return;
        if (!selectedChannel) return;
        openEditChannelHook(selectedChannel);
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
        if (list.length === 1) return t("typing.one", { user: list[0] });
        if (list.length === 2) return t("typing.two", { user1: list[0], user2: list[1] });
        return t("typing.many", { user1: list[0], user2: list[1], count: list.length - 2 });
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
        try {
            const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
            if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("user");
                router.replace("/");
                return;
            }
        } catch {
            localStorage.removeItem("access_token");
            localStorage.removeItem("user");
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
                    pushToast(t("toast.adminAdded"), "success");
                    break;
                case "owner":
                    pushToast(t("toast.ownerTransferred"), "success");
                    break;
                default:
                    pushToast(t("toast.adminRemoved"), "success");
                    break;
            }
        } catch (e: any) {
            pushToast(t("toast.actionDenied"), "warn");
            console.error(e);
        }
    }

    async function handleKickMember(serverId: string, userId: string) {
        try {
            await kickMember(serverId, userId);
            removeMember(serverId, userId);
            pushToastOnce(`member_kicked:${serverId}:${userId}`, t("toast.memberKicked"), "warn");
        } catch (e: any) {
            pushToast(t("toast.actionDenied"), "warn");
            console.error(e);
        }
    }

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const sid = selectedServerIdRef.current;
            if (sid) wsRef.current.send(JSON.stringify({ type: "join_server", server_id: sid }));
            return;
        }

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "auth", token }));
            const sid = selectedServerIdRef.current;
            if (sid) ws.send(JSON.stringify({ type: "join_server", server_id: sid }));

            // Send ping every 30 seconds to keep connection alive
            const pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "ping" }));
                }
            }, 30000);
            (ws as any).pingInterval = pingInterval;
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
                    const onlineSet = new Set(ids);
                    onlineUserIdsRef.current = onlineSet;
                    setOnlineUserIds(onlineSet);
                    return;
                }

                if (msg.type === "error") {
                    if ((msg as any).message === "invalid_or_expired_token") {
                        localStorage.removeItem("access_token");
                        localStorage.removeItem("user");
                        router.replace("/");
                    }
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
                    pushToastOnce(`channel_created:${sid}:${msg.channel_id ?? msg.name}`, t("toast.channelCreated", { name: msg.name }), "success");
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

                    pushToastOnce(`channel_deleted:${sid}:${cid}`, t("toast.channelDeleted"), "warn");
                    return;
                }
                if (msg.type === "channel_updated") {
                    const sid = String(msg.server_id ?? "");
                    const cid = String(msg.channel_id ?? "");

                    if (!sid || !cid) return;

                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && sid !== String(currentSid)) return;

                    reloadChannels(sid).catch(() => {});
                    pushToastOnce(`channel_updated:${sid}:${cid}`, t("toast.channelUpdated"), "info");
                    return;
                }
                if (msg.type === "server_member_joined") {
                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && String(msg.server_id) !== String(currentSid)) return;

                    upsertMember(String(msg.server_id), String(msg.user_id), String(msg.username ?? t("fallbackUsername")));

                    const isMe = myIdRef.current && String(myIdRef.current) === String(msg.user_id);
                    if (!isMe) pushToastOnce(`member_joined:${msg.server_id}:${msg.user_id}`, t("toast.memberJoined", { username: msg.username }), "success");
                    return;
                }

                if (msg.type === "server_member_left") {
                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && String(msg.server_id) !== String(currentSid)) return;

                    removeMember(String(msg.server_id), String(msg.user_id));

                    const isMe = myIdRef.current && String(myIdRef.current) === String(msg.user_id);
                    if (!isMe) pushToastOnce(`member_left:${msg.server_id}:${msg.user_id}`, t("toast.memberLeft", { username: msg.username }), "warn");
                    return;
                }

                if (msg.type === "server_member_role_updated") {
                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && String(msg.server_id) !== String(currentSid)) return;

                    const roleRaw = (msg as any).role;
                    const role = (roleRaw === "owner" || roleRaw === "admin" || roleRaw === "member" ? roleRaw : "member") as MemberRole;

                    upsertMember(String(msg.server_id), String(msg.user_id), String(msg.username ?? t("fallbackUsername")));
                    setMemberRoleLocal(String(msg.server_id), String(msg.user_id), role);

                    if (role === "owner") {
                        setServers((prev) =>
                            prev.map((s) => (String(s.id) === String(msg.server_id) ? { ...s, owner_id: String(msg.user_id) } : s))
                        );
                    }

                    const isMe = myIdRef.current && String(myIdRef.current) === String(msg.user_id);
                    if (!isMe) pushToastOnce(`member_role:${msg.server_id}:${msg.user_id}:${role}`, t("toast.memberNowRole", { username: msg.username, role }), "info");
                    return;
                }
                if (msg.type === "server_member_kicked") {
                    const sid = String(msg.server_id ?? "");
                    const uid = String(msg.user_id ?? "");
                    const username = String(msg.username ?? t("fallbackUsername"));

                    if (!sid || !uid) return;

                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && sid !== String(currentSid)) return;

                    const isMe = !!myIdRef.current && String(myIdRef.current) === uid;

                    removeMember(sid, uid);

                    if (isMe) {
                        wsSend({ type: "leave_server", server_id: sid });

                        pushToastOnce(`member_kicked:${sid}:${uid}:me`, t("toast.kickedSelf"), "warn");

                        setSelectedServerId(null);
                        setMembers([]);
                        setChannels([]);
                        setSelectedChannelId(null);
                        setOnlineUserIds(new Set());
                        channelMessages.clearMessages();
                        setShowBans(false);

                        api<Server[]>("/api/servers")
                            .then((list) => {
                                setServers(list);
                                setSelectedServerId(list.length ? list[0].id : null);
                            })
                            .catch(() => {});
                    } else {
                        pushToastOnce(`member_kicked:${sid}:${uid}`, t("toast.kickedOther", { username }), "warn");
                    }

                    return;
                }

                if (msg.type === "server_deleted") {
                    const sid = String(msg.server_id ?? "");
                    if (!sid) return;

                    pushToastOnce(`server_deleted:${sid}`, t("toast.serverDeleted"), "warn");

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
                    pushToastOnce(`server_updated:${sid}`, t("toast.serverUpdated"), "info");
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

                    const wasOnline = onlineUserIdsRef.current.has(id);
                    if (offline) removeOnline(id);
                    else addOnline(id);
                    const presenceChanged = offline ? wasOnline : !wasOnline;

                    const isMe = myIdRef.current && String(myIdRef.current) === String(id);
                    const isBoot = !seenPresenceRef.current[sid];

                    if (!isMe && !isBoot && presenceChanged) {
                        const username = typeof (msg as any).username === "string" ? String((msg as any).username) : t("fallbackUsername");
                        if (msg.type === "user_connected") pushToastOnce(`presence:online:${sid}:${id}`, t("toast.userOnline", { username }), "info");
                        if (msg.type === "user_disconnected") pushToastOnce(`presence:offline:${sid}:${id}`, t("toast.userOffline", { username }), "warn");
                    }
                    return;
                }

                if (msg.type === "presence") {
                    const currentSid = selectedServerIdRef.current;
                    const sid = msg.server_id != null ? String(msg.server_id) : null;
                    if (!sid) return;
                    if (currentSid && sid !== String(currentSid)) return;

                    const id = msg.user_id != null ? String(msg.user_id) : null;
                    if (!id) return;

                    const status = msg.status;
                    const offline = status === "offline";

                    const wasOnline = onlineUserIdsRef.current.has(id);
                    if (offline) removeOnline(id);
                    else addOnline(id);
                    const presenceChanged = offline ? wasOnline : !wasOnline;

                    const isMe = myIdRef.current && String(myIdRef.current) === String(id);
                    const isBoot = !seenPresenceRef.current[sid];

                    if (!isMe && !isBoot && presenceChanged) {
                        const username = typeof (msg as any).username === "string" ? String((msg as any).username) : t("fallbackUsername");
                        if (status === "online") pushToastOnce(`presence:online:${sid}:${id}`, t("toast.userOnline", { username }), "info");
                        if (status === "offline") pushToastOnce(`presence:offline:${sid}:${id}`, t("toast.userOffline", { username }), "warn");
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

                if (channelMessages.handleWsEvent(msg)) return;
                if (msg.type === "server_member_banned") {
                    const sid = String((msg as any).server_id ?? "");
                    const uid = String((msg as any).user_id ?? "");
                    const username = String((msg as any).username ?? t("fallbackUsername"));

                    if (!sid || !uid) return;

                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && sid !== String(currentSid)) return;

                    const isMe = myIdRef.current && String(myIdRef.current) === uid;

                    removeMember(sid, uid);

                    if (isMe) {
                        pushToastOnce(`member_banned:${sid}:${uid}:me`, t("toast.bannedSelf"), "warn");

                        setSelectedServerId(null);
                        setMembers([]);
                        setChannels([]);
                        setSelectedChannelId(null);
                        setOnlineUserIds(new Set());
                        channelMessages.clearMessages();

                        api<Server[]>("/api/servers")
                            .then((list) => {
                                setServers(list);
                                setSelectedServerId(list.length ? list[0].id : null);
                            })
                            .catch(() => {});
                    } else {
                        pushToastOnce(`member_banned:${sid}:${uid}`, t("toast.bannedOther", { username }), "warn");
                    }

                    return;
                }
                if (msg.type === "server_member_unbanned") {
                    const sid = String(msg.server_id ?? "");
                    const uid = String(msg.user_id ?? "");
                    const username = String(msg.username ?? t("fallbackUsername"));

                    if (!sid || !uid) return;

                    const currentSid = selectedServerIdRef.current;
                    if (currentSid && sid !== String(currentSid)) return;

                    pushToastOnce(`member_unbanned:${sid}:${uid}`, t("toast.unbanned", { username }), "success");

                    return;
                }

                if (dm.handleWsEvent(msg)) return;
                if (msg.type === "server_member_banned_temporary") {
                    const sid = String(msg.server_id ?? "");
                    const uid = String(msg.user_id ?? "");
                    const username = String(msg.username ?? t("fallbackUsername"));

                    if (!sid || !uid) return;

                    const isMe = String(myIdRef.current ?? "") === uid;

                    removeMember(sid, uid);

                    if (isMe) {
                        const until = msg.until;
                        let durationText = "";
                        if (until) {
                            const end = new Date(until);
                            const now = new Date();
                            const diffMs = end.getTime() - now.getTime();
                            if (diffMs > 0) {
                                const minutes = Math.ceil(diffMs / 60000);
                                if (minutes < 60) {
                                    durationText = t("duration.minutes", { count: minutes });
                                } else {
                                    const hours = Math.ceil(minutes / 60);
                                    durationText = t("duration.hours", { count: hours });
                                }
                            }
                        }

                        pushToastOnce(
                            `member_temp_banned:${sid}:${uid}:me`,
                            durationText
                                ? t("toast.tempBannedSelf", { duration: durationText })
                                : t("toast.tempBannedSelfNoDuration"),
                            "warn"
                        );
                        removeServerAfterOwnBan(sid, uid);
                    } else {
                        pushToastOnce(`member_temp_banned:${sid}:${uid}`, t("toast.tempBannedOther", { username }), "warn");
                    }
                    return;
                }

               if (msg.type === "server_member_temporary_ban_lifted") {
                    const sid = String(msg.server_id ?? "");
                    const uid = String(msg.user_id ?? "");
                    const username = String(msg.username ?? t("fallbackUsername"));

                    if (!sid || !uid) return;

                    const isMe = String(myIdRef.current ?? "") === uid;

                    if (isMe) {
                        pushToastOnce(`member_temp_ban_lifted:${sid}:${uid}:me`, t("toast.tempBanLiftedSelf"), "success");
                    } else {
                        pushToastOnce(`member_temp_ban_lifted:${sid}:${uid}`, t("toast.tempBanLiftedOther", { username }), "success");
                    }

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
            // ws.close(); // Keep WS open to stay online when navigating away
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

    function openCreateChannel() {
        if (!canCreateChannel) return;
        if (!selectedServerId) return;
        setChannelCreateError(null);
        setChannelName("");
        setIsChannelCreateOpen(true);
    }

    async function createChannel() {
        if (!selectedServerId) return;

        const created = await createChannelHook(selectedServerId);
        if (created) {
            setSelectedChannelId(String(created.id));
            pushToastOnce(`channel_created:${selectedServerId}:${created.id}`, t("toast.channelCreated", { name: created.name }), "success");
        }
    }
    function openTemporaryBanModal(userId: string, username: string) {
        setOpenMenuFor(null);
        setTemporaryBanError(null);
        setTemporaryBanDuration("60");
        setTemporaryBanModal({
            open: true,
            userId,
            username,
        });
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

            pushToastOnce(`channel_deleted:${selectedServerId}:${channelId}`, t("toast.channelDeleted"), "warn");

            await reloadChannels(selectedServerId);
        } catch (e: any) {
            pushToast(t("toast.deletionDenied"), "warn");
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
        if (name.length < 3) return setSettingsError(t("errors.nameTooShort"));
        if (name.length > 50) return setSettingsError(t("errors.nameTooLong"));

        try {
            setIsSavingSettings(true);
            await api<Server>(`/api/servers/${selectedServer.id}`, {
                method: "PUT",
                body: JSON.stringify({ name }),
            });

            setIsSettingsOpen(false);
            await refreshServers(selectedServer.id);
        } catch (e) {
            setSettingsError(getFriendlyErrorMessage(e, "serverSettings"));
        } finally {
            setIsSavingSettings(false);
        }
    }

    async function deleteServer() {
        if (!selectedServer || !isOwner) return;

        if (deleteConfirm.trim().toLowerCase() !== "delete") {
            setSettingsError(t("errors.deleteConfirm"));
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
        } catch (e) {
            setSettingsError(getFriendlyErrorMessage(e, "deleteServer"));
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

            pushToast(t("toast.leftServer"), "warn");
        } catch (e) {
            setLeaveError(getFriendlyErrorMessage(e, "leaveServer"));
        } finally {
            setIsLeaving(false);
        }
    }
    if (!hasCheckedAuth) return null;

    return (
        /* 1. LE CONTENEUR GLOBAL : 
           - bg-background : Fond principal de l'app (Orange clair / Marron foncé)
           - text-primary : Texte de base (Noir / Blanc)
           - p-2 gap-2 : Espacement automatique et parfait entre chaque colonne !
        */
        <div className={`flex h-screen bg-background text-primary ${miskan.variable} ${nunito.variable} font-sans overflow-hidden p-2 gap-2`}>
            
            <ToastStack toasts={toasts} />
            
            {/* === COLONNE 1 : SERVEURS === */}
            <ServerList
                servers={servers}
                selectedServerId={selectedServerId}
                onSelectServer={(id) => {
                    setView("servers");
                    setSelectedServerId(id);
                }}
                onCreate={() => setIsCreateOpen(true)}
                onJoin={() => setIsJoinOpen(true)}
                initials={initials}
                view={view}
                onToggleView={() => setView((v) => (v === "dm" ? "servers" : "dm"))}
                unreadDmCount={dm.totalUnreadCount}
            />

            {/* === COLONNE 2 : LISTE DES SALONS OU DM === */}
            {/* Retrait de my-2, ajout de border-border-custom et bg-secondary */}
            <div className="w-64 flex flex-col bg-secondary border border-border-custom overflow-hidden rounded-[20px] shadow-sm">
                {view === "dm" ? (
                    <DirectMessageSidebar
                        conversations={dm.conversations}
                        selectedConvId={dm.selectedConvId}
                        onSelectConversation={dm.setSelectedConvId}
                        unreadCounts={dm.unreadCounts}
                    />
                ) : (
                    <ServerChannelsSidebar
                        selectedServer={selectedServer}
                        selectedServerId={selectedServerId}
                        selectedChannelId={selectedChannelId}
                        channels={channels}
                        isOwner={isOwner}
                        canCreateChannel={canCreateChannel}
                        canEditChannel={canEditChannel}
                        onOpenServerSettings={openServerSettings}
                        onOpenLeaveServer={() => {
                            if (!selectedServerId) return;
                            setLeaveError(null);
                            setIsLeaveOpen(true);
                        }}
                        onSelectChannel={setSelectedChannelId}
                        onCreateChannel={openCreateChannel}
                        onEditChannel={handleOpenEditChannel}
                        onDeleteChannel={deleteChannel}
                    />
                )}
            </div>

            {/* === COLONNE 3 : PANNEAU CENTRAL (CHAT) === */}
            {/* Retrait de my-2 et mr-2 car le parent (gap-2) gère déjà l'espace. Ajout de bg-background */}
            <div className="flex-1 flex flex-col bg-surface border border-border-custom rounded-[20px] overflow-hidden shadow-sm">
                {view === "dm" ? (
                    <DirectMessagePanel
                        conversations={dm.conversations}
                        selectedConvId={dm.selectedConvId}
                        messages={dm.messages}
                        messagesLoading={dm.messagesLoading}
                        hasMore={dm.hasMore}
                        loadingMore={dm.loadingMore}
                        onLoadMore={dm.loadMoreMessages}
                        me={me}
                        editingMessageId={dm.editingMessageId}
                        editingContent={dm.editingContent}
                        onStartEdit={(messageId, content) => {
                            dm.setEditingMessageId(messageId);
                            dm.setEditingContent(content);
                        }}
                        onChangeEditingContent={dm.setEditingContent}
                        onSaveEdit={dm.editMessage}
                        onCancelEdit={() => {
                            dm.setEditingMessageId(null);
                            dm.setEditingContent("");
                        }}
                        onDeleteMessage={(messageId) => {
                            if (!window.confirm(t("confirmDeleteMessage"))) return;
                            dm.deleteMessage(messageId);
                        }}
                        messageText={dm.messageText}
                        setMessageText={dm.setMessageText}
                        isSending={dm.isSending}
                        onSendMessage={dm.sendMessage}
                        onSendGif={dm.sendGifMessage}
                        onToggleReaction={dm.toggleReaction}
                        onMessageKeyDown={dm.onMessageKeyDown}
                        messagesEndRef={dm.messagesEndRef}
                    />
                ) : (
                    <ChannelChatPanel
                        selectedServer={selectedServer}
                        selectedServerId={selectedServerId}
                        selectedChannel={selectedChannel}
                        selectedChannelId={selectedChannelId}
                        channelsCount={channels.length}
                        channelCreatedLabel={channelCreatedLabel}
                        channelUpdatedLabel={channelUpdatedLabel}
                        canInviteMember={canInviteMember}
                        canCreateChannel={canCreateChannel}
                        canModerateMessages={canModerateMessages}
                        messages={channelMessages.messages}
                        messagesLoading={channelMessages.messagesLoading}
                        messagesError={channelMessages.messagesError}
                        messageText={channelMessages.messageText}
                        setMessageText={channelMessages.setMessageText}
                        isSending={channelMessages.isSending}
                        editingMessageId={channelMessages.editingMessageId}
                        setEditingMessageId={channelMessages.setEditingMessageId}
                        editingContent={channelMessages.editingContent}
                        setEditingContent={channelMessages.setEditingContent}
                        hasMoreMessages={channelMessages.hasMoreMessages}
                        loadingMore={channelMessages.loadingMore}
                        messagesEndRef={channelMessages.messagesEndRef}
                        onLoadMoreMessages={channelMessages.loadMoreMessages}
                        onSendMessage={channelMessages.sendMessage}
                        onSendGif={channelMessages.sendGifMessage}
                        onEditMessage={channelMessages.editMessage}
                        onDeleteMessage={channelMessages.deleteMessage}
                        onToggleReaction={channelMessages.toggleReaction}
                        onMessageKeyDown={channelMessages.onMessageKeyDown}
                        me={me}
                        typingLabel={typingLabel}
                        onInviteMember={openInviteMember}
                        onCreateChannel={openCreateChannel}
                        onSendTyping={sendTyping}
                    />
                )}
            </div>

            {/* === COLONNE 4 : MEMBRES === */}
            {view !== "dm" && (
                <MembersSidebar
                    members={members}
                    onlineUserIds={onlineUserIds}
                    selectedServer={selectedServer}
                    selectedServerId={selectedServerId}
                    selectedChannelId={selectedChannelId}
                    myId={myIdRef.current}
                    myRole={myRole}
                    isOwner={isOwner}
                    typingUsers={typingUsers}
                    openMenuFor={openMenuFor}
                    menuRef={menuRef}
                    onToggleMenu={(userId) => setOpenMenuFor((prev) => (prev === userId ? null : userId))}
                    onStartDm={dm.startWithMember}
                    onKickMember={handleKickMember}
                    onBanMember={handleBanMember}
                    onOpenTemporaryBanModal={openTemporaryBanModal}
                    onSetMemberRole={setMemberRole}
                    onTransferOwner={transferOwner}
                    onShowBans={() => setShowBans(true)}
                />
            )}

            {/* === MODALES === */}
            {showBans && myRole !== "member" && selectedServerId && (
                <BannedUsersModal serverId={selectedServerId} onClose={() => setShowBans(false)} />
            )}
            
            {/* Reste des Modales inchangées ... */}
            {isChannelEditOpen && selectedChannel && canEditChannel && (
                <ChannelEditModal
                    isOpen={true}
                    onClose={() => setIsChannelEditOpen(false)}
                    channelEditName={channelEditName}
                    setChannelEditName={setChannelEditName}
                    channelEditError={channelEditError}
                    isChannelSaving={isChannelEditing}
                    onSave={async () => await editChannel(selectedServerId!, editingChannelId!)}
                />
            )}

            <ChannelCreateModal isOpen={isChannelCreateOpen} onClose={() => setIsChannelCreateOpen(false)} channelName={channelName} setChannelName={setChannelName} channelCreateError={channelCreateError} isChannelCreating={isChannelCreating} onCreate={createChannel} />
            <CreateServerModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} serverName={serverName} setServerName={setServerName} createError={createError} isCreating={isCreating} onCreate={createServer} />
            <JoinServerModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} joinCode={joinCode} setJoinCode={setJoinCode} joinError={joinError} isJoining={isJoining} onJoin={joinServer} />
            <InviteMemberModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} selectedServer={selectedServer} inviteError={inviteError} setInviteError={setInviteError} inviteCopied={inviteCopied} setInviteCopied={setInviteCopied} />
            <ServerSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} selectedServer={selectedServer} settingsName={settingsName} setSettingsName={setSettingsName} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} settingsError={settingsError} isSavingSettings={isSavingSettings} onSave={saveServerSettings} onDelete={deleteServer} />
            <LeaveServerModal isOpen={isLeaveOpen} onClose={() => setIsLeaveOpen(false)} selectedServer={selectedServer} leaveError={leaveError} isLeaving={isLeaving} onLeave={leaveServer} />
            
            {temporaryBanModal?.open && selectedServerId && (
                <TemporaryBanModal isOpen={true} onClose={() => setTemporaryBanModal(null)} username={temporaryBanModal.username} duration={temporaryBanDuration} setDuration={setTemporaryBanDuration} error={temporaryBanError} isBanning={isTemporaryBanning} onBan={() => handleBanTemporaryMember( selectedServerId, temporaryBanModal.userId, Number(temporaryBanDuration) )} />
            )}
        </div>
    );
}

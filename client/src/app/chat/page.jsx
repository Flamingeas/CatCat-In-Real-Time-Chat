"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import emailjs from '@emailjs/browser';
import { UserSettingsModal } from "@/components/chat/UserSettingsModal";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  getServerMembers,
  kickMember,
  setMemberRole as setMemberRoleRequest,
  transferOwner as transferOwnerRequest,
  leaveServer as leaveServerRequest,
  joinServerByCode,
} from "@/features/chat/services/members.service";
import { banMember } from "@/features/chat/services/bans.service";
import BanList from "@/features/chat/components/ban-list";

import { ServerSidebar } from "@/components/chat/ServerSidebar";
import { ChannelSidebar } from "@/components/chat/ChannelSidebar";
import { MessageArea } from "@/components/chat/MessageArea";
import { MemberArea } from "@/components/chat/MemberArea"; 

const miskan = localFont({ src: "../fonts/Miskan.woff", variable: "--font-miskan" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "700"] });

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8080/ws";

export default function ChatPage() {
    useEffect(() => {
        emailjs.init("A22AlDWX2y_yw9yXz");
    }, []);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMemberAreaOpen, setIsMemberAreaOpen] = useState(false); 
    const [isMobile, setIsMobile] = useState(false);

    // --- GESTION DU SWIPE MOBILE ---
    const [touchStartX, setTouchStartX] = useState(null);
    const [touchEndX, setTouchEndX] = useState(null);
    const [touchStartY, setTouchStartY] = useState(null);
    const [touchEndY, setTouchEndY] = useState(null);
    const minSwipeDistance = 60; // Distance minimum pour déclencher le swipe

    const onTouchStart = (e) => {
        setTouchEndX(null);
        setTouchEndY(null);
        setTouchStartX(e.targetTouches[0].clientX);
        setTouchStartY(e.targetTouches[0].clientY);
    };

    const onTouchMove = (e) => {
        setTouchEndX(e.targetTouches[0].clientX);
        setTouchEndY(e.targetTouches[0].clientY);
    };

    const onTouchEnd = () => {
        if (!touchStartX || !touchEndX || !touchStartY || !touchEndY) return;
        
        const distanceX = touchStartX - touchEndX;
        const distanceY = touchStartY - touchEndY;
        
        // Si l'utilisateur scroll verticalement, on ignore le swipe
        if (Math.abs(distanceY) > Math.abs(distanceX)) return;

        const isLeftSwipe = distanceX > minSwipeDistance;  // ⬅️ Vers la gauche
        const isRightSwipe = distanceX < -minSwipeDistance; // ➡️ Vers la droite

        if (isMobile) {
            if (isLeftSwipe) {
                if (isSidebarOpen) {
                    setIsSidebarOpen(false); // Ferme les salons
                } else if (!isSidebarOpen && !isMemberAreaOpen) {
                    setIsMemberAreaOpen(true); // Ouvre les membres
                }
            } else if (isRightSwipe) {
                if (isMemberAreaOpen) {
                    setIsMemberAreaOpen(false); // Ferme les membres
                } else if (!isSidebarOpen && !isMemberAreaOpen) {
                    setIsSidebarOpen(true); // Ouvre les salons
                }
            }
        }
    };

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [initials, setInitials] = useState("??");
    const [me, setMe] = useState(null);

    const [servers, setServers] = useState([]);
    const [selectedServerId, setSelectedServerId] = useState(null);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [serverName, setServerName] = useState("");
    const [createError, setCreateError] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    const [isJoinOpen, setIsJoinOpen] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState(null);
    const [isJoining, setIsJoining] = useState(false);

    const [members, setMembers] = useState([]);
    const [onlineUserIds, setOnlineUserIds] = useState(new Set());
    const [channels, setChannels] = useState([]);
    const [selectedChannelId, setSelectedChannelId] = useState(null);

    const [isChannelCreateOpen, setIsChannelCreateOpen] = useState(false);
    const [channelName, setChannelName] = useState("");
    const [channelCreateError, setChannelCreateError] = useState(null);
    const [isChannelCreating, setIsChannelCreating] = useState(false);

    const [isChannelEditOpen, setIsChannelEditOpen] = useState(false);
    const [channelEditName, setChannelEditName] = useState("");
    const [channelEditError, setChannelEditError] = useState(null);
    const [isChannelSaving, setIsChannelSaving] = useState(false);

    const wsRef = useRef(null);
    const myIdRef = useRef(null);
    const selectedServerIdRef = useRef(null);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsName, setSettingsName] = useState("");
    const [settingsError, setSettingsError] = useState(null);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState("");

    const [isLeaveOpen, setIsLeaveOpen] = useState(false);
    const [leaveError, setLeaveError] = useState(null);
    const [isLeaving, setIsLeaving] = useState(false);

    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [inviteError, setInviteError] = useState(null);

    const [toasts, setToasts] = useState([]);
    const lastJoinedToastRef = useRef({});
    const lastLeftToastRef = useRef({});
    const seenPresenceRef = useRef({});

    const [openMenuFor, setOpenMenuFor] = useState(null);
    const menuRef = useRef(null);

    const router = useRouter();
    const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

    const selectedServer = useMemo(() => servers.find((s) => s.id === selectedServerId) ?? null, [servers, selectedServerId]);
    const selectedChannel = useMemo(() => channels.find((c) => String(c.id) === String(selectedChannelId)) ?? null, [channels, selectedChannelId]);
    const [showBans, setShowBans] = useState(false);

    const myRole = useMemo(() => {
        if (!me || !selectedServerId) return "member";
        if (selectedServer?.owner_id && String(selectedServer.owner_id) === String(me.id)) return "owner";
        const found = members.find((m) => String(m.user_id) === String(me.id));
        return found?.role ?? "member";
    }, [me, members, selectedServerId, selectedServer?.owner_id]);

    const isOwner = myRole === "owner";
    const canCreateChannel = myRole === "owner" || myRole === "admin";
    const canInviteMember = myRole === "owner" || myRole === "admin";
    const canEditChannel = myRole === "owner" || myRole === "admin";
    const canModerateMessages = myRole === "owner" || myRole === "admin";
    
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [messagesError, setMessagesError] = useState(null);

    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);

    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const messagesEndRef = useRef(null);
    const messagesBoxRef = useRef(null);
    const selectedChannelIdRef = useRef(null);

    const typingTimeoutsRef = useRef(new Map());
    const [typingUsers, setTypingUsers] = useState({});
    const lastTypingSentAtRef = useRef(0);

    const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";

    async function handleLogout() {
        try {
            await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
        } catch (e) {
            console.error("Erreur deconnexion API", e);
        } finally {
            localStorage.removeItem("access_token");
            localStorage.removeItem("user");
            wsRef.current?.close(); 
            router.push("/");
        }
    }

    const sendNotificationEmail = (username, email, type = "welcome") => {
        const templateParams = {
            to_name: username,
            user_email: email,
            message_type: type === "welcome" ? "Bienvenue sur CatCat !" : "Tes paramètres ont bien été mis à jour.",
        };

        emailjs.send('service_zeojaxu', 'template_mwuys08', templateParams)
            .then(() => {
                pushToast("Un email t'a été envoyé !", "info");
            })
            .catch((err) => {
                console.error("Erreur EmailJS:", err);
            });
    };

    useEffect(() => { selectedChannelIdRef.current = selectedChannelId; }, [selectedChannelId]);
    useEffect(() => { myIdRef.current = me?.id ?? null; }, [me?.id]);
    useEffect(() => { selectedServerIdRef.current = selectedServerId; }, [selectedServerId]);

    function pushToast(text, kind = "info") {
        const id = `${Date.now()}_${Math.random()}`;
        setToasts((prev) => [...prev, { id, text, kind }]);
        window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    }

    useEffect(() => {
        function onDown(e) {
            if (!openMenuFor) return;
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuFor(null);
        }
        function onKey(e) { if (e.key === "Escape") setOpenMenuFor(null); }
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
    }, [openMenuFor]);

    function wsSend(obj) {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify(obj));
    }

    function addOnline(id) { setOnlineUserIds((prev) => new Set(prev).add(id)); }
    function removeOnline(id) { setOnlineUserIds((prev) => { const next = new Set(prev); next.delete(id); return next; }); }

    async function refreshServers(selectId) {
        const list = await api("/api/servers");
        setServers(list);
        if (selectId) setSelectedServerId(selectId);
        else if (!selectedServerId && list.length > 0) setSelectedServerId(list[0].id);
    }

    async function transferOwner(serverId, newOwnerId) {
        try {
            await transferOwnerRequest(serverId, newOwnerId);
            pushToast("Propriétaire modifié", "success");
            await refreshServers(serverId);
            await reloadMembers(serverId);
        } catch (e) { pushToast("Action refusée", "warn"); }
    }

    function removeMember(serverId, user_id) {
        const currentSid = selectedServerIdRef.current;
        if (!currentSid || String(serverId) !== String(currentSid)) return;
        setMembers((prev) => prev.filter((m) => String(m.user_id) !== String(user_id)));
        removeOnline(String(user_id));
    }

    function upsertMember(serverId, user_id, username) {
        const currentSid = selectedServerIdRef.current;
        if (!currentSid || String(serverId) !== String(currentSid)) return;
        setMembers((prev) => {
            const idx = prev.findIndex((m) => String(m.user_id) === String(user_id));
            if (idx >= 0) { const copy = prev.slice(); copy[idx] = { ...copy[idx], username: username ?? copy[idx].username }; return copy; }
            return [...prev, { user_id: String(user_id), username }];
        });
    }

    async function handleBanMember(serverId, userId) {
        try { await banMember(serverId, userId); removeMember(serverId, userId); pushToast("Membre banni", "warn"); } 
        catch (e) { pushToast("Action refusée", "warn"); }
    }

    function setMemberRoleLocal(serverId, user_id, role) {
        const currentSid = selectedServerIdRef.current;
        if (!currentSid || String(serverId) !== String(currentSid)) return;
        setMembers((prev) => {
            const idx = prev.findIndex((m) => String(m.user_id) === String(user_id));
            if (idx >= 0) { const copy = prev.slice(); copy[idx] = { ...copy[idx], role }; return copy; }
            return prev;
        });
    }

    async function reloadMembers(serverId) {
        try { const m = await getServerMembers(serverId); setMembers(m.map((x) => ({ ...x, role: x.role ?? "member" }))); } 
        catch (e) { setMembers([]); }
    }

    async function reloadChannels(serverId) {
        try {
            const list = await api(`/api/servers/${serverId}/channels`);
            setChannels(list);
            
            if (!isMobile) {
                setSelectedChannelId((prev) => {
                    if (prev && list.some((c) => String(c.id) === String(prev))) return prev;
                    return list.length ? String(list[0].id) : null;
                });
            }
        } catch (e) { setChannels([]); setSelectedChannelId(null); }
    }

    async function saveChannelEdit() {
        if (!canEditChannel || !selectedServerId || !selectedChannel) return;
        setChannelEditError(null);
        const name = channelEditName.trim();
        if (name.length < 3 || name.length > 50) return setChannelEditError("Nom invalide (3-50 char).");
        try {
            setIsChannelSaving(true);
            const updated = await api(`/api/channels/${String(selectedChannel.id)}`, { method: "PUT", body: JSON.stringify({ name }) });
            setChannels((prev) => prev.map((c) => String(c.id) === String(selectedChannel.id) ? { ...c, name: updated.name ?? name } : c));
            setIsChannelEditOpen(false);
            pushToast("Salon renommé", "success");
        } catch (e) { setChannelEditError(e?.message ?? "Erreur."); } 
        finally { setIsChannelSaving(false); }
    }

    async function fetchMessages(channelId, opts) {
        const before = opts?.before ? encodeURIComponent(opts.before) : null;
        const url = before ? `/api/channels/${channelId}/messages?limit=50&before=${before}` : `/api/channels/${channelId}/messages?limit=50`;
        const list = await api(url);
        setMessages((prev) => {
            if (opts?.append) {
                const map = new Map();
                for (const m of prev) map.set(String(m.message_id), m);
                for (const m of list) map.set(String(m.message_id), m);
                return Array.from(map.values()).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
            }
            return list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        });
        setHasMoreMessages(list.length >= 50);
    }

    useEffect(() => {
        if (!selectedServerId || !selectedChannelId) { setMessages([]); setHasMoreMessages(true); setMessagesError(null); return; }
        setMessagesLoading(true); setMessagesError(null); setHasMoreMessages(true);
        fetchMessages(String(selectedChannelId))
            .then(() => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 0))
            .catch((e) => setMessagesError(e?.message ?? "Erreur de chargement"))
            .finally(() => setMessagesLoading(false));
    }, [selectedServerId, selectedChannelId]);

    async function loadMoreMessages() {
        if (!selectedChannelId || loadingMore || !hasMoreMessages || messages.length === 0) return;
        try { setLoadingMore(true); await fetchMessages(String(selectedChannelId), { before: messages[0].created_at, append: true }); } 
        catch (e) { pushToast("Impossible de charger plus", "warn"); } 
        finally { setLoadingMore(false); }
    }

    async function sendMessage(replyToId = null) {
        if (!selectedChannelId) return;
        const content = messageText.trim();
        if (!content) return;
        
        try {
            setIsSending(true);
            
            // On prépare le payload avec le reply_to_message_id s'il existe
            const payload = { content };
            if (replyToId) {
                payload.reply_to_message_id = replyToId;
            }

            const created = await api(`/api/channels/${String(selectedChannelId)}/messages`, {
                method: "POST", 
                body: JSON.stringify(payload),
            });
            
            setMessages((prev) => {
                if (prev.some((m) => String(m.message_id) === String(created.message_id))) return prev;
                return [...prev, created].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            });
            
            setMessageText("");
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
        } catch (e) { 
            pushToast("Envoi refusé", "warn"); 
        } finally { 
            setIsSending(false); 
        }
    }

    function sendGifMessage(gifUrl, replyToId = null) {
        if (!selectedChannelId) return;

        wsSend({
            type: "send_message", // 👈 Modifié ici pour matcher ton Rust !
            channel_id: String(selectedChannelId),
            content: gifUrl,
            reply_to_message_id: replyToId ? String(replyToId) : null
        });
    }

    async function deleteMyMessage(messageId) {
        if (!messageId) return;
        try {
            await api(`/api/messages/${String(messageId)}`, { method: "DELETE" });
            setMessages((prev) => prev.map((m) => String(m.message_id) === String(messageId) ? { ...m, is_deleted: true, content: "" } : m));
            pushToast("Message supprimé", "warn");
        } catch (e) { pushToast("Suppression refusée", "warn"); }
    }

    function sendTyping() {
        if (!me?.id || !me.username || !selectedChannelId) return;
        const now = Date.now();
        if (now - lastTypingSentAtRef.current < 800) return;
        lastTypingSentAtRef.current = now;
        wsSend({ type: "user_typing", user_id: me.id, username: me.username, channel_id: selectedChannelId });
    }

    const typingLabel = useMemo(() => {
        if (!selectedChannelId) return null;
        const list = Object.values(typingUsers).filter((x) => String(x.channelId) === String(selectedChannelId)).map((x) => x.username);
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
            if (user?.id) {
                setMe({ id: String(user.id), username: String(user.username || "") });
                setInitials(String(user.username || "")?.slice(0, 2).toUpperCase() || "??");
            }
        } catch { setMe(null); setInitials("??"); }
    }, []);

    useEffect(() => {
        if (!localStorage.getItem("access_token") || !localStorage.getItem("user")) return router.replace("/");
        setHasCheckedAuth(true);
    }, [router]);

    async function setMemberRole(serverId, userId, role) {
        if (!serverId) return;
        try {
            await setMemberRoleRequest(serverId, userId, role);
            setMemberRoleLocal(serverId, userId, role);
            if (role === "owner") { setServers((prev) => prev.map((s) => (String(s.id) === String(serverId) ? { ...s, owner_id: String(userId) } : s))); await refreshServers(serverId); await reloadMembers(serverId); }
            pushToast(`Rôle ${role} attribué`, "success");
        } catch (e) { pushToast("Action refusée", "warn"); }
    }

    async function handleKickMember(serverId, userId) {
        try { await kickMember(serverId, userId); removeMember(serverId, userId); pushToast("Expulsé", "warn"); } 
        catch (e) { pushToast("Refusé", "warn"); }
    }

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) return;
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "auth", token }));
            if (selectedServerIdRef.current) ws.send(JSON.stringify({ type: "join_server", server_id: selectedServerIdRef.current }));
        };

        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (!msg || typeof msg !== "object") return;
                
                if (msg.type === "presence_snapshot") {
                    if (selectedServerIdRef.current && String(msg.server_id) !== String(selectedServerIdRef.current)) return;
                    seenPresenceRef.current[String(msg.server_id)] = true;
                    const ids = msg.online.map(item => String(item.user_id || item[0] || item));
                    setOnlineUserIds(new Set(ids));
                } else if (msg.type === "authed") {
                    if (msg.user_id) addOnline(String(msg.user_id));
                } else if (msg.type === "channel_created" || msg.type === "channel_updated") {
                    if (String(msg.server_id) === String(selectedServerIdRef.current)) reloadChannels(String(msg.server_id));
                } else if (msg.type === "channel_deleted") {
                    setChannels((prev) => {
                        const next = prev.filter((c) => String(c.id) !== String(msg.channel_id));
                        setSelectedChannelId((sel) => (sel === String(msg.channel_id) ? (next.length ? String(next[0].id) : null) : sel));
                        return next;
                    });
                } else if (msg.type === "server_member_joined") {
                    upsertMember(String(msg.server_id), String(msg.user_id), msg.username || "quelqu'un");
                } else if (msg.type === "server_member_left" || msg.type === "server_member_kicked" || msg.type === "server_member_banned") {
                    removeMember(String(msg.server_id), String(msg.user_id));
                    if (myIdRef.current && String(myIdRef.current) === String(msg.user_id)) {
                        setSelectedServerId(null); setMembers([]); setChannels([]); setSelectedChannelId(null);
                        api("/api/servers").then(setServers).catch(()=>{});
                    }
                } else if (msg.type === "user_connected" || msg.type === "user_disconnected" || msg.type === "user_status_changed") {
                    const id = msg.user_id;
                    if (id) {
                        const offline = msg.type === "user_disconnected" || msg.status === "offline";
                        offline ? removeOnline(String(id)) : addOnline(String(id));
                    }
                } else if (msg.type === "user_typing" || msg.type === "typing") {
                    if (String(msg.channel_id) === String(selectedChannelIdRef.current)) {
                        const uid = String(msg.user_id);
                        if (uid !== String(myIdRef.current)) {
                            setTypingUsers((prev) => ({ ...prev, [uid]: { username: msg.username, channelId: String(msg.channel_id) } }));
                            if (typingTimeoutsRef.current.has(uid)) clearTimeout(typingTimeoutsRef.current.get(uid));
                            typingTimeoutsRef.current.set(uid, setTimeout(() => { setTypingUsers((p) => { const c = {...p}; delete c[uid]; return c; }); }, 5000));
                        }
                    }
} else if (msg.type === "new_message") {
                    if (String(msg.channel_id) === String(selectedChannelIdRef.current)) {
                        setMessages((prev) => {
                            if (prev.some((m) => String(m.message_id) === String(msg.message_id))) return prev;
                            
                            // 👇 C'est ici qu'on force l'enregistrement de l'ID de réponse
                            const newMessage = { 
                                ...msg, 
                                is_edited: false, 
                                is_deleted: false, 
                                message_id: String(msg.message_id),
                                reply_to_message_id: msg.reply_to_message_id ? String(msg.reply_to_message_id) : null 
                            };
                            
                            return [...prev, newMessage].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
                        });
                        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
                    }
                } else if (msg.type === "message_reaction_added") {
                    console.log("Réaction reçue du serveur !", msg); // AJOUTE CE LOG
                    setMessages((prev) => prev.map(m => {
                        if (String(m.message_id) !== String(msg.message_id)) return m;
                        
                        const reactions = m.reactions || [];
                        // On vérifie si l'emoji existe déjà dans la liste
                        const existingReaction = reactions.find(r => r.emoji === msg.emoji);

                        if (existingReaction) {
                            return {
                                ...m,
                                reactions: reactions.map(r => 
                                    r.emoji === msg.emoji 
                                        ? { ...r, users: [...new Set([...r.users, msg.user_id])] } // Set pour éviter les doublons
                                        : r
                                )
                            };
                        }
                        // Sinon on crée une nouvelle entrée pour cet emoji
                        return {
                            ...m,
                            reactions: [...reactions, { emoji: msg.emoji, users: [msg.user_id] }]
                        };
                    }));
                } else if (msg.type === "message_reaction_removed") {
                    setMessages((prev) => prev.map(m => {
                        if (m.message_id !== msg.message_id) return m;
                        return { ...m, reactions: (m.reactions || []).map(r => r.emoji === msg.emoji ? { ...r, users: r.users.filter(u => u !== msg.user_id) } : r).filter(r => r.users.length > 0) };
                    }));
                }
            } catch {}        };

        ws.onerror = () => {}; 
        ws.onclose = () => { wsRef.current = null; setOnlineUserIds(new Set()); };
        const heartbeat = setInterval(() => wsSend({ type: "ping", t: Date.now() }), 15000);
        return () => { clearInterval(heartbeat); ws.close(); };
    }, []);

    useEffect(() => {
        api("/api/servers").then((list) => { setServers(list); if (!selectedServerId && list.length > 0) setSelectedServerId(list[0].id); }).catch(()=>{});
    }, []);

    useEffect(() => {
        if (!selectedServerId) { setMembers([]); setChannels([]); setSelectedChannelId(null); setOnlineUserIds(new Set()); return; }
        setIsLeaveOpen(false); setOpenMenuFor(null);
        seenPresenceRef.current[String(selectedServerId)] = false;
        wsSend({ type: "join_server", server_id: selectedServerId });
        reloadMembers(selectedServerId); reloadChannels(selectedServerId);
        return () => wsSend({ type: "leave_server", server_id: selectedServerId });
    }, [selectedServerId]);

    useEffect(() => {
        if (me?.id && selectedChannelId) {
            wsSend({ type: "join_channel", channel_id: String(selectedChannelId) });
            if (isMobile) setIsSidebarOpen(false);
            
            return () => { wsSend({ type: "leave_channel", channel_id: String(selectedChannelId) }); setTypingUsers({}); };
        }
    }, [selectedChannelId, me?.id, isMobile]);

    async function createServer() {
        if (serverName.trim().length < 3) return setCreateError("Min 3 char.");
        try { setIsCreating(true); const created = await api("/api/servers", { method: "POST", body: JSON.stringify({ name: serverName.trim() }) }); setIsCreateOpen(false); setServerName(""); await refreshServers(created.id); } 
        catch (e) { setCreateError("Erreur création"); } finally { setIsCreating(false); }
    }

    async function joinServer() {
        try { setIsJoining(true); const joined = await joinServerByCode(joinCode.trim().toUpperCase()); setIsJoinOpen(false); setJoinCode(""); await refreshServers(joined.id); pushToast("Serveur rejoint"); } 
        catch (e) { setJoinError("Code invalide"); } finally { setIsJoining(false); }
    }

    async function createChannel() {
        if (channelName.trim().length < 3) return setChannelCreateError("Min 3 char.");
        try { setIsChannelCreating(true); const created = await api(`/api/servers/${selectedServerId}/channels`, { method: "POST", body: JSON.stringify({ name: channelName.trim() }) }); setIsChannelCreateOpen(false); setChannelName(""); await reloadChannels(selectedServerId); setSelectedChannelId(String(created.id)); } 
        catch (e) { setChannelCreateError("Erreur"); } finally { setIsChannelCreating(false); }
    }

    async function deleteChannel(channelId) {
        try { await api(`/api/channels/${channelId}`, { method: "DELETE" }); setChannels((prev) => prev.filter(c => String(c.id) !== channelId)); setSelectedChannelId(null); } catch (e) {}
    }

    async function deleteServer() {
        if (deleteConfirm !== "DELETE") return setSettingsError("Tape DELETE");
        try { await api(`/api/servers/${selectedServer.id}`, { method: "DELETE" }); setIsSettingsOpen(false); api("/api/servers").then(setServers).catch(()=>{}); } catch (e) { setSettingsError("Erreur"); }
    }

    async function saveServerSettings() {
        try { await api(`/api/servers/${selectedServer.id}`, { method: "PUT", body: JSON.stringify({ name: settingsName.trim() }) }); setIsSettingsOpen(false); refreshServers(selectedServer.id); } catch(e){}
    }

    async function leaveServer() {
        try { await leaveServerRequest(selectedServerId); setIsLeaveOpen(false); api("/api/servers").then(setServers).catch(()=>{}); } catch(e){}
    }

    function toggleReaction(messageId, emoji, currentlyReacted) {
        if (!me?.id || !selectedChannelId) return;

        const payload = {
            type: currentlyReacted ? "remove_reaction" : "add_reaction",
            channel_id: selectedChannelId, // Doit être un UUID string
            message_id: messageId,         // Doit être un UUID string
            emoji: emoji
        };
        
        console.log("Envoi réaction:", payload); // Ajoute ce log pour voir si ça part !
        wsSend(payload);
    }

    if (!hasCheckedAuth) return null;

    const showSidebarMobile = !selectedChannelId || isSidebarOpen;
    const showMessageAreaMobile = selectedChannelId && !isSidebarOpen && !isMemberAreaOpen;
    const showMemberAreaMobile = isMemberAreaOpen;

    return (
        <div 
            className={`flex h-[100dvh] bg-black text-[#DCCBC4] ${miskan.variable} ${nunito.variable} font-sans overflow-hidden p-2 gap-2 pt-[env(safe-area-inset-top)]`}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {toasts.length > 0 && (
                <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
                    {toasts.map((t) => (
                        <div key={t.id} className={`px-4 py-3 rounded-2xl border shadow-xl text-sm font-[family-name:var(--font-nunito)] ${t.kind === "success" ? "bg-[#0a0605] border-green-500/30 text-green-200" : t.kind === "warn" ? "bg-[#0a0605] border-red-500/30 text-red-200" : "bg-[#0a0605] border-[#ffffff]/10 text-[#DCCBC4]"}`}>{t.text}</div>
                    ))}
                </div>
            )}

            <div className={`${(showMessageAreaMobile || showMemberAreaMobile) ? 'hidden md:block' : 'block'}`}>
                <ServerSidebar 
                    servers={servers} 
                    selectedServerId={selectedServerId} 
                    onSelectServer={(id) => {
                        setSelectedServerId(id);
                        if (isMobile) {
                            setSelectedChannelId(null);
                            setIsSidebarOpen(true);
                            setIsMemberAreaOpen(false);
                        }
                    }} 
                    onOpenCreate={() => setIsCreateOpen(true)} 
                    onOpenJoin={() => setIsJoinOpen(true)} 
                    initials={initials} 
                    onOpenUserSettings={() => setIsUserSettingsOpen(true)}
                    onLogout={handleLogout}
                />
            </div>

            <div className={`
                h-full transition-all duration-300 ease-in-out overflow-hidden
                ${isSidebarOpen 
                    ? 'flex-1 md:flex-none md:w-60' 
                    : 'hidden md:flex md:w-0'
                }
            `}>
                {/* On ne rend le composant que s'il y a un serveur sélectionné */}
                {selectedServerId && (
                    <ChannelSidebar 
                        selectedServer={selectedServer}
                        isOwner={isOwner} 
                        onOpenServerSettings={() => { setSettingsError(null); setSettingsName(selectedServer.name); setIsSettingsOpen(true); }} 
                        onLeaveServer={() => setIsLeaveOpen(true)} 
                        canCreateChannel={canCreateChannel} 
                        onOpenCreateChannel={() => { setChannelName(""); setIsChannelCreateOpen(true); }} 
                        channels={channels} 
                        selectedChannelId={selectedChannelId} 
                        onSelectChannel={setSelectedChannelId} 
                        canEditChannel={canEditChannel} 
                        onOpenEditChannel={() => { setChannelEditName(selectedChannel?.name ?? ""); setIsChannelEditOpen(true); }} 
                        onDeleteChannel={deleteChannel} 
                        onCloseSidebar={() => setIsSidebarOpen(false)}
                    />
                )}
            </div>

            <div className={`flex-1 h-full min-w-0 ${showMessageAreaMobile ? 'block' : 'hidden md:block'}`}>
                <MessageArea 
                    me={me} 
                    selectedServerId={selectedServerId} 
                    selectedServer={selectedServer} 
                    selectedChannelId={selectedChannelId} 
                    selectedChannel={selectedChannel} 
                    messages={messages} 
                    messagesLoading={messagesLoading} 
                    messagesError={messagesError} 
                    hasMoreMessages={hasMoreMessages} 
                    loadingMore={loadingMore} 
                    onLoadMore={loadMoreMessages} 
                    messagesEndRef={messagesEndRef} 
                    messagesBoxRef={messagesBoxRef} 
                    messageText={messageText} 
                    setMessageText={setMessageText} 
                    isSending={isSending} 
                    onSendMessage={sendMessage} 
                    onSendGif={sendGifMessage} 
                    onSendTyping={sendTyping} 
                    typingLabel={typingLabel} 
                    members={members}
                    canModerateMessages={canModerateMessages} 
                    onDeleteMessage={deleteMyMessage} 
                    onToggleReaction={toggleReaction} 
                    canInviteMember={canInviteMember} 
                    onOpenInvite={() => { setInviteCopied(false); setIsInviteOpen(true); }} 
                    isSidebarOpen={isSidebarOpen}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    isMemberAreaOpen={isMemberAreaOpen}
                    onToggleMemberArea={() => setIsMemberAreaOpen(!isMemberAreaOpen)}
                />
            </div>

            {/* Member Area Container */}
            <div className={`
                /* Sur mobile : occupe tout l'écran ou rien */
                /* Sur laptop : largeur fixe (w-60) ou largeur nulle (w-0) */
                ${isMemberAreaOpen 
                    ? 'flex-1 md:flex-none md:w-60' 
                    : 'hidden md:flex md:w-0'
                } 
                h-full overflow-hidden transition-all duration-300 ease-in-out
            `}>
                <MemberArea 
                    members={members}
                    onlineUserIds={onlineUserIds}
                    selectedServerId={selectedServerId}
                    selectedServer={selectedServer}
                    selectedChannelId={selectedChannelId}
                    me={me}
                    isOwner={isOwner}
                    myRole={myRole}
                    typingUsers={typingUsers}
                    openMenuFor={openMenuFor}
                    setOpenMenuFor={setOpenMenuFor}
                    onKick={handleKickMember}
                    onBan={handleBanMember}
                    onSetRole={setMemberRole}
                    onTransferOwner={transferOwner}
                    onShowBans={() => setShowBans(true)}
                    onCloseMemberArea={() => setIsMemberAreaOpen(false)}
                />
            </div>

            {isCreateOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <div className="absolute inset-0 bg-black/70" onClick={() => setIsCreateOpen(false)} /> <div className="relative bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl p-5 w-full max-w-md"> <h3 className="text-lg font-bold mb-4">Créer un serveur</h3> <input value={serverName} onChange={(e) => setServerName(e.target.value)} className="w-full bg-[#1E1211] p-3 rounded-xl mb-4" /> <div className="flex justify-end gap-2"><button onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-white">Annuler</button><button onClick={createServer} className="px-4 py-2 bg-[#EB5E28] text-black font-bold rounded-xl">Créer</button></div> </div> </div> )}
            {isJoinOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <div className="absolute inset-0 bg-black/70" onClick={() => setIsJoinOpen(false)} /> <div className="relative bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl p-5 w-full max-w-md"> <h3 className="text-lg font-bold mb-4">Rejoindre un serveur</h3> <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} className="w-full bg-[#1E1211] p-3 rounded-xl mb-4" /> <div className="flex justify-end gap-2"><button onClick={() => setIsJoinOpen(false)} className="px-4 py-2 text-white">Annuler</button><button onClick={joinServer} className="px-4 py-2 bg-[#EB5E28] text-black font-bold rounded-xl">Rejoindre</button></div> </div> </div> )}
            {isChannelCreateOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <div className="absolute inset-0 bg-black/70" onClick={() => setIsChannelCreateOpen(false)} /> <div className="relative bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl p-5 w-full max-w-md"> <h3 className="text-lg font-bold mb-4">Créer un salon</h3> <input value={channelName} onChange={(e) => setChannelName(e.target.value)} className="w-full bg-[#1E1211] p-3 rounded-xl mb-4" /> <div className="flex justify-end gap-2"><button onClick={() => setIsChannelCreateOpen(false)} className="px-4 py-2 text-white">Annuler</button><button onClick={createChannel} className="px-4 py-2 bg-[#EB5E28] text-black font-bold rounded-xl">Créer</button></div> </div> </div> )}
            {isChannelEditOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <div className="absolute inset-0 bg-black/70" onClick={() => setIsChannelEditOpen(false)} /> <div className="relative bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl p-5 w-full max-w-md"> <h3 className="text-lg font-bold mb-4">Renommer le salon</h3> <input value={channelEditName} onChange={(e) => setChannelEditName(e.target.value)} className="w-full bg-[#1E1211] p-3 rounded-xl mb-4" /> <div className="flex justify-end gap-2"><button onClick={() => setIsChannelEditOpen(false)} className="px-4 py-2 text-white">Annuler</button><button onClick={saveChannelEdit} className="px-4 py-2 bg-[#EB5E28] text-black font-bold rounded-xl">Sauvegarder</button></div> </div> </div> )}
            {isSettingsOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <div className="absolute inset-0 bg-black/70" onClick={() => setIsSettingsOpen(false)} /> <div className="relative bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl p-5 w-full max-w-md"> <h3 className="text-lg font-bold mb-4">Paramètres du serveur</h3> <input value={settingsName} onChange={(e) => setSettingsName(e.target.value)} className="w-full bg-[#1E1211] p-3 rounded-xl mb-4" /> <div className="flex justify-end gap-2 mb-6"><button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 text-white">Annuler</button><button onClick={saveServerSettings} className="px-4 py-2 bg-[#EB5E28] text-black font-bold rounded-xl">Sauvegarder</button></div> <div className="border border-red-500/30 p-4 rounded-xl"> <p className="text-red-400 text-sm mb-2">Tape DELETE pour supprimer ce serveur.</p> <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="w-full bg-[#1E1211] p-2 rounded border border-red-500/30 mb-2 text-white"/> <button onClick={deleteServer} className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold w-full">Supprimer</button></div> </div> </div> )}
            {isLeaveOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <div className="absolute inset-0 bg-black/70" onClick={() => setIsLeaveOpen(false)} /> <div className="relative bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl p-5 w-full max-w-md"> <h3 className="text-lg font-bold mb-4">Quitter le serveur ?</h3> <div className="flex justify-end gap-2"><button onClick={() => setIsLeaveOpen(false)} className="px-4 py-2 text-white">Annuler</button><button onClick={leaveServer} className="px-4 py-2 bg-red-500 text-white font-bold rounded-xl">Quitter</button></div> </div> </div> )}
            {isInviteOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <div className="absolute inset-0 bg-black/70" onClick={() => setIsInviteOpen(false)} /> <div className="relative bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl p-5 w-full max-w-md"> <h3 className="text-lg font-bold mb-4">Code d'invitation</h3> <div className="flex gap-2"> <input readOnly value={selectedServer?.invitation_code || ""} className="flex-1 bg-[#1E1211] p-3 rounded-xl" /> <button onClick={() => { navigator.clipboard.writeText(selectedServer?.invitation_code); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 1200); }} className="px-4 py-2 bg-[#EB5E28] text-black font-bold rounded-xl">{inviteCopied ? "Copié!" : "Copier"}</button> </div> </div> </div> )}
            {showBans && ( <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"> <div className="bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl p-6 w-[420px]"> <div className="flex justify-between items-center mb-4"> <h2 className="text-lg font-semibold">Utilisateurs bannis</h2> <button onClick={() => setShowBans(false)} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer"> ✕ </button> </div> <BanList serverId={selectedServerId} /> </div> </div> )}

            {isUserSettingsOpen && ( 
                <UserSettingsModal 
                    onClose={() => setIsUserSettingsOpen(false)} 
                    me={me} 
                    onSendEmail={sendNotificationEmail}
                /> 
            )}
        </div>
    );
}
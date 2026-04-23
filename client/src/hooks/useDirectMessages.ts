import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { api } from "@/lib/api";
import {
    type ConversationItem,
    type DmMessage,
    getConversations,
    startConversation as startDmConversation,
} from "@/features/direct-message/services/dm.service";
import { Toast, WsEvent } from "@/types/chat";
import { useTranslations } from "next-intl";

interface UseDirectMessagesOptions {
    myIdRef: { current: string | null };
    pushToast: (text: string, kind?: Toast["kind"]) => void;
}

const DM_VIEW_STORAGE_KEY = "catcat_chat_view";
const DM_SELECTED_CONVERSATION_STORAGE_KEY = "catcat_selected_dm_conversation";
const DM_UNREAD_COUNTS_STORAGE_KEY = "catcat_dm_unread_counts";

function getInitialView(): "servers" | "dm" {
    if (typeof window === "undefined") return "servers";
    return localStorage.getItem(DM_VIEW_STORAGE_KEY) === "dm" ? "dm" : "servers";
}

function getInitialSelectedConversationId() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(DM_SELECTED_CONVERSATION_STORAGE_KEY);
}

function getInitialUnreadCounts(): Record<string, number> {
    if (typeof window === "undefined") return {};

    try {
        const raw = localStorage.getItem(DM_UNREAD_COUNTS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

        return Object.entries(parsed).reduce<Record<string, number>>((acc, [conversationId, count]) => {
            const unreadCount = Number(count);
            if (Number.isFinite(unreadCount) && unreadCount > 0) {
                acc[conversationId] = unreadCount;
            }
            return acc;
        }, {});
    } catch {
        return {};
    }
}

export function useDirectMessages({ myIdRef, pushToast }: UseDirectMessagesOptions) {
    const t = useTranslations("directMessages");
    const [view, setView] = useState<"servers" | "dm">(getInitialView);
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [selectedConvId, setSelectedConvId] = useState<string | null>(getInitialSelectedConversationId);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(getInitialUnreadCounts);
    const [messages, setMessages] = useState<DmMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState("");
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const selectedConvIdRef = useRef<string | null>(null);
    const viewRef = useRef<"servers" | "dm">(view);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        viewRef.current = view;
    }, [view]);

    useEffect(() => {
        selectedConvIdRef.current = selectedConvId;
    }, [selectedConvId]);

    useEffect(() => {
        localStorage.setItem(DM_VIEW_STORAGE_KEY, view);
    }, [view]);

    useEffect(() => {
        if (selectedConvId) localStorage.setItem(DM_SELECTED_CONVERSATION_STORAGE_KEY, selectedConvId);
        else localStorage.removeItem(DM_SELECTED_CONVERSATION_STORAGE_KEY);
    }, [selectedConvId]);

    useEffect(() => {
        localStorage.setItem(DM_UNREAD_COUNTS_STORAGE_KEY, JSON.stringify(unreadCounts));
    }, [unreadCounts]);

    useEffect(() => {
        if (view !== "dm" || !selectedConvId) return;
        setUnreadCounts((prev) => {
            if (!prev[selectedConvId]) return prev;
            const next = { ...prev };
            delete next[selectedConvId];
            return next;
        });
    }, [view, selectedConvId]);

    function incrementUnreadCount(conversationId: string) {
        setUnreadCounts((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] ?? 0) + 1,
        }));
    }

    async function loadConversations() {
        try {
            const list = await getConversations();
            setConversations(list);
        } catch (e) {
            console.error("Failed to load conversations:", e);
        }
    }

    async function loadMessages(convId: string, opts?: { before?: string; append?: boolean }) {
        const before = opts?.before ? encodeURIComponent(opts.before) : null;
        const url = before
            ? `/api/dm/conversations/${convId}/messages?limit=50&before=${before}`
            : `/api/dm/conversations/${convId}/messages?limit=50`;
        const list = await api<DmMessage[]>(url);

        setMessages((prev) => {
            if (opts?.append) {
                const map = new Map<string, DmMessage>();
                for (const message of prev) map.set(message.message_id, message);
                for (const message of list) map.set(message.message_id, message);
                return Array.from(map.values()).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
            }
            return list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        });
        setHasMore(list.length >= 50);
    }

    async function sendMessage() {
        if (!selectedConvId) return;
        const content = messageText.trim();
        if (!content) return;

        try {
            setIsSending(true);
            const created = await api<DmMessage>(`/api/dm/conversations/${selectedConvId}/messages`, {
                method: "POST",
                body: JSON.stringify({ content }),
            });
            setMessages((prev) => {
                if (prev.some((message) => message.message_id === created.message_id)) return prev;
                return [...prev, created].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
            });
            setMessageText("");
            window.setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 0);
        } catch {
            pushToast(t("sendDenied"), "warn");
        } finally {
            setIsSending(false);
        }
    }

    async function sendGifMessage(gifUrl: string) {
        if (!selectedConvId || !gifUrl.trim()) return;

        try {
            setIsSending(true);
            const created = await api<DmMessage>(`/api/dm/conversations/${selectedConvId}/messages`, {
                method: "POST",
                body: JSON.stringify({ content: gifUrl.trim() }),
            });
            setMessages((prev) => {
                if (prev.some((message) => message.message_id === created.message_id)) return prev;
                return [...prev, created].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
            });
            window.setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 0);
        } catch {
            pushToast(t("gifDenied"), "warn");
        } finally {
            setIsSending(false);
        }
    }

    async function editMessage(messageId: string, newContent: string) {
        if (!newContent.trim()) return;
        try {
            await api(`/api/dm/messages/${messageId}`, {
                method: "PUT",
                body: JSON.stringify({ content: newContent }),
            });
            setMessages((prev) =>
                prev.map((message) => message.message_id === messageId ? { ...message, content: newContent, is_edited: true } : message)
            );
            setEditingMessageId(null);
            setEditingContent("");
            pushToast(t("updated"), "success");
        } catch {
            pushToast(t("editDenied"), "warn");
        }
    }

    async function deleteMessage(messageId: string) {
        try {
            await api<void>(`/api/dm/messages/${messageId}`, { method: "DELETE" });
            setMessages((prev) =>
                prev.map((message) => message.message_id === messageId ? { ...message, is_deleted: true, content: "" } : message)
            );
            pushToast(t("deleted"), "warn");
        } catch {
            pushToast(t("deleteDenied"), "warn");
        }
    }

    async function loadMoreMessages() {
        if (!selectedConvId || loadingMore || !hasMore || messages.length === 0) return;
        try {
            setLoadingMore(true);
            const oldest = messages[0];
            await loadMessages(selectedConvId, { before: oldest.created_at, append: true });
        } catch {
            pushToast(t("loadMoreDenied"), "warn");
        } finally {
            setLoadingMore(false);
        }
    }

    function onMessageKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!isSending) sendMessage();
        }
    }

    function applyReaction(messageId: string, emoji: string, userId: string, action: "add" | "remove") {
        setMessages((prev) =>
            prev.map((message) => {
                if (String(message.message_id) !== String(messageId)) return message;

                const reactions = message.reactions ?? [];

                if (action === "remove") {
                    const nextReactions = reactions
                        .map((reaction) =>
                            reaction.emoji === emoji
                                ? { ...reaction, users: reaction.users.filter((id) => String(id) !== String(userId)) }
                                : reaction
                        )
                        .filter((reaction) => reaction.users.length > 0);

                    return { ...message, reactions: nextReactions };
                }

                const existing = reactions.find((reaction) => reaction.emoji === emoji);
                if (!existing) {
                    return { ...message, reactions: [...reactions, { emoji, users: [String(userId)] }] };
                }
                if (existing.users.some((id) => String(id) === String(userId))) return message;

                return {
                    ...message,
                    reactions: reactions.map((reaction) =>
                        reaction.emoji === emoji
                            ? { ...reaction, users: [...reaction.users, String(userId)] }
                            : reaction
                    ),
                };
            })
        );
    }

    async function toggleReaction(messageId: string, emoji: string, hasReacted: boolean) {
        const currentUserId = myIdRef.current;
        if (!selectedConvId || !currentUserId) return;

        const action = hasReacted ? "remove" : "add";
        applyReaction(messageId, emoji, currentUserId, action);

        try {
            await api(`/api/dm/messages/${messageId}/reactions`, {
                method: hasReacted ? "DELETE" : "POST",
                body: JSON.stringify({ emoji }),
            });
        } catch (e) {
            applyReaction(messageId, emoji, currentUserId, hasReacted ? "add" : "remove");
            pushToast(t("reactionSyncDenied"), "warn");
            console.error(e);
        }
    }

    async function startWithMember(userId: string) {
        try {
            const conv = await startDmConversation(userId);
            setConversations((prev) => {
                if (prev.some((conversation) => conversation.id === conv.id)) return prev;
                return [conv, ...prev];
            });
            setView("dm");
            setSelectedConvId(conv.id);
        } catch {
            pushToast(t("startConversationDenied"), "warn");
        }
    }

    function handleWsEvent(msg: WsEvent) {
        if (msg.type === "new_direct_message") {
            const convId = String(msg.conversation_id ?? "");
            const currentConv = selectedConvIdRef.current;
            const isOwnMessage = myIdRef.current && String(msg.sender_id) === String(myIdRef.current);
            const isActiveConversationOpen = viewRef.current === "dm" && currentConv === convId;

            if (currentConv && convId === String(currentConv)) {
                const newMsg: DmMessage = {
                    message_id: String(msg.message_id ?? ""),
                    conversation_id: convId,
                    sender_id: String(msg.sender_id ?? ""),
                    sender_username: String(msg.sender_username ?? ""),
                    recipient_id: "",
                    content: String(msg.content ?? ""),
                    created_at: String(msg.created_at ?? ""),
                    updated_at: null,
                    is_edited: false,
                    is_deleted: false,
                    reactions: [],
                };
                setMessages((prev) => {
                    if (prev.some((message) => message.message_id === newMsg.message_id)) return prev;
                    return [...prev, newMsg].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
                });
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 0);
            }

            if (!isOwnMessage && !isActiveConversationOpen) {
                incrementUnreadCount(convId);
            }

            if (!isActiveConversationOpen) {
                const senderName = String(msg.sender_username ?? t("fallbackUser"));
                if (!isOwnMessage) {
                    pushToast(t("newMessageFrom", { username: senderName }), "info");
                }
            }
            return true;
        }

        if (msg.type === "direct_message_reaction_added") {
            const convId = String(msg.conversation_id ?? "");
            const currentConv = selectedConvIdRef.current;
            if (currentConv && convId === String(currentConv)) {
                applyReaction(String(msg.message_id), String(msg.emoji), String(msg.user_id), "add");
            }
            return true;
        }

        if (msg.type === "direct_message_reaction_removed") {
            const convId = String(msg.conversation_id ?? "");
            const currentConv = selectedConvIdRef.current;
            if (currentConv && convId === String(currentConv)) {
                applyReaction(String(msg.message_id), String(msg.emoji), String(msg.user_id), "remove");
            }
            return true;
        }

        if (msg.type === "direct_message_updated") {
            const convId = String(msg.conversation_id ?? "");
            const currentConv = selectedConvIdRef.current;
            if (currentConv && convId === String(currentConv)) {
                setMessages((prev) =>
                    prev.map((message) =>
                        message.message_id === String(msg.message_id)
                            ? { ...message, content: String(msg.content ?? ""), is_edited: true, updated_at: String(msg.updated_at ?? "") }
                            : message
                    )
                );
            }
            return true;
        }

        if (msg.type === "direct_message_deleted") {
            const convId = String(msg.conversation_id ?? "");
            const currentConv = selectedConvIdRef.current;
            if (currentConv && convId === String(currentConv)) {
                setMessages((prev) =>
                    prev.map((message) =>
                        message.message_id === String(msg.message_id)
                            ? { ...message, is_deleted: true, content: "" }
                            : message
                    )
                );
            }
            return true;
        }

        return false;
    }

    useEffect(() => {
        if (view === "dm") {
            loadConversations();
        }
    }, [view]);

    useEffect(() => {
        if (!selectedConvId || view !== "dm") {
            setMessages([]);
            setHasMore(true);
            return;
        }

        setMessagesLoading(true);
        loadMessages(selectedConvId)
            .then(() => {
                window.setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
                }, 0);
            })
            .catch(() => {})
            .finally(() => setMessagesLoading(false));
    }, [selectedConvId, view]);

    return {
        view,
        setView,
        conversations,
        selectedConvId,
        setSelectedConvId,
        unreadCounts,
        totalUnreadCount: Object.values(unreadCounts).reduce((total, count) => total + count, 0),
        messages,
        messagesLoading,
        messageText,
        setMessageText,
        isSending,
        editingMessageId,
        setEditingMessageId,
        editingContent,
        setEditingContent,
        hasMore,
        loadingMore,
        messagesEndRef,
        sendMessage,
        sendGifMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        loadMoreMessages,
        onMessageKeyDown,
        startWithMember,
        handleWsEvent,
    };
}

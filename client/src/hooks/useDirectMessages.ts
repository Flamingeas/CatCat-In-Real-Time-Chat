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

interface UseDirectMessagesOptions {
    myIdRef: { current: string | null };
    pushToast: (text: string, kind?: Toast["kind"]) => void;
}

export function useDirectMessages({ myIdRef, pushToast }: UseDirectMessagesOptions) {
    const [view, setView] = useState<"servers" | "dm">("servers");
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<DmMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState("");
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const selectedConvIdRef = useRef<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        selectedConvIdRef.current = selectedConvId;
    }, [selectedConvId]);

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
            pushToast("Envoi refusé", "warn");
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
            pushToast("Envoi du GIF refusé", "warn");
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
            pushToast("Message modifié", "success");
        } catch {
            pushToast("Édition refusée", "warn");
        }
    }

    async function deleteMessage(messageId: string) {
        try {
            await api<void>(`/api/dm/messages/${messageId}`, { method: "DELETE" });
            setMessages((prev) =>
                prev.map((message) => message.message_id === messageId ? { ...message, is_deleted: true, content: "" } : message)
            );
            pushToast("Message supprimé", "warn");
        } catch {
            pushToast("Suppression refusée", "warn");
        }
    }

    async function loadMoreMessages() {
        if (!selectedConvId || loadingMore || !hasMore || messages.length === 0) return;
        try {
            setLoadingMore(true);
            const oldest = messages[0];
            await loadMessages(selectedConvId, { before: oldest.created_at, append: true });
        } catch {
            pushToast("Impossible de charger plus", "warn");
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
            pushToast("Erreur de synchronisation de la réaction", "warn");
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
            pushToast("Impossible de démarrer la conversation.", "warn");
        }
    }

    function handleWsEvent(msg: WsEvent) {
        if (msg.type === "new_direct_message") {
            const convId = String(msg.conversation_id ?? "");
            const currentConv = selectedConvIdRef.current;

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
            } else {
                const senderName = String(msg.sender_username ?? "quelqu’un");
                if (myIdRef.current && String(msg.sender_id) !== String(myIdRef.current)) {
                    pushToast(`Nouveau message de ${senderName}`, "info");
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

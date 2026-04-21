import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { api } from "@/lib/api";
import { Message, Toast, WsEvent } from "@/types/chat";
import { getFriendlyErrorMessage } from "@/utils/errors";

interface UseChannelMessagesOptions {
    selectedServerId: string | null;
    selectedChannelId: string | null;
    pushToast: (text: string, kind?: Toast["kind"]) => void;
}

export function useChannelMessages({
    selectedServerId,
    selectedChannelId,
    pushToast,
}: UseChannelMessagesOptions) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [messagesError, setMessagesError] = useState<string | null>(null);
    const [messageText, setMessageText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState("");
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const selectedServerIdRef = useRef<string | null>(null);
    const selectedChannelIdRef = useRef<string | null>(null);

    useEffect(() => {
        selectedServerIdRef.current = selectedServerId;
    }, [selectedServerId]);

    useEffect(() => {
        selectedChannelIdRef.current = selectedChannelId;
    }, [selectedChannelId]);

    function clearMessages() {
        setMessages([]);
    }

    async function fetchMessages(channelId: string, opts?: { before?: string; append?: boolean }) {
        const before = opts?.before ? encodeURIComponent(opts.before) : null;
        const url = before ? `/api/channels/${channelId}/messages?limit=50&before=${before}` : `/api/channels/${channelId}/messages?limit=50`;
        const list = await api<Message[]>(url);

        setMessages((prev) => {
            if (opts?.append) {
                const map = new Map<string, Message>();
                for (const message of prev) map.set(String(message.message_id), message);
                for (const message of list) map.set(String(message.message_id), message);
                return Array.from(map.values()).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
            }
            return list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        });
        setHasMoreMessages(list.length >= 50);
    }

    async function loadMoreMessages() {
        if (!selectedChannelId || loadingMore || !hasMoreMessages || messages.length === 0) return;

        try {
            setLoadingMore(true);
            const oldest = messages[0];
            await fetchMessages(String(selectedChannelId), { before: oldest.created_at, append: true });
        } catch {
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
                if (prev.some((message) => String(message.message_id) === String(created.message_id))) return prev;
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

    async function editMessage(messageId: string, newContent: string) {
        if (!newContent.trim()) {
            alert("Le message ne peut pas être vide");
            return;
        }
        try {
            await api(`/api/messages/${messageId}`, {
                method: "PUT",
                body: JSON.stringify({ content: newContent }),
            });
            setMessages((prev) =>
                prev.map((message) =>
                    message.message_id === messageId
                        ? { ...message, content: newContent, is_edited: true }
                        : message
                )
            );
            setEditingMessageId(null);
            setEditingContent("");
            pushToast("Message modifié", "success");
        } catch (err) {
            pushToast("Édition refusée", "warn");
            console.error("Edit error:", err);
        }
    }

    async function deleteMessage(messageId: string) {
        if (!messageId) return;
        try {
            await api<void>(`/api/messages/${String(messageId)}`, { method: "DELETE" });
            setMessages((prev) =>
                prev.map((message) =>
                    String(message.message_id) === String(messageId)
                        ? { ...message, is_deleted: true, content: "" }
                        : message
                )
            );
            pushToast("Message supprimé", "warn");
        } catch (e) {
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

    function handleWsEvent(msg: WsEvent) {
        if (msg.type === "new_message") {
            const currentChannel = selectedChannelIdRef.current;
            const currentServer = selectedServerIdRef.current;
            if (!currentChannel || !currentServer) return true;
            if (String(msg.channel_id) !== String(currentChannel)) return true;

            setMessages((prev) => {
                if (prev.some((message) => String(message.message_id) === String(msg.message_id))) return prev;
                return [
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
                ].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
            });

            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 0);
            return true;
        }

        if (msg.type === "message_updated") {
            const currentChannel = selectedChannelIdRef.current;
            if (!currentChannel) return true;
            if (String(msg.channel_id) !== String(currentChannel)) return true;

            setMessages((prev) =>
                prev.map((message) =>
                    String(message.message_id) === String(msg.message_id)
                        ? {
                            ...message,
                            content: String(msg.content ?? ""),
                            updated_at: String(msg.updated_at ?? new Date().toISOString()),
                            is_edited: true,
                        }
                        : message
                )
            );
            return true;
        }

        if (msg.type === "message_deleted") {
            const mid = String(msg.message_id ?? "");
            const chId = String(msg.channel_id ?? "");
            const sid = String(msg.server_id ?? "");
            const currentSid = selectedServerIdRef.current;
            const currentCh = selectedChannelIdRef.current;

            if (!mid || !chId || !sid || !currentSid || !currentCh) return true;
            if (sid !== String(currentSid) || chId !== String(currentCh)) return true;

            setMessages((prev) => prev.map((message) => (String(message.message_id) === mid ? { ...message, is_deleted: true, content: "" } : message)));
            return true;
        }

        return false;
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
            .catch((e) => setMessagesError(getFriendlyErrorMessage(e, "loadMessages")))
            .finally(() => setMessagesLoading(false));
    }, [selectedServerId, selectedChannelId]);

    return {
        messages,
        messagesLoading,
        messagesError,
        messageText,
        setMessageText,
        isSending,
        editingMessageId,
        setEditingMessageId,
        editingContent,
        setEditingContent,
        hasMoreMessages,
        loadingMore,
        messagesEndRef,
        clearMessages,
        loadMoreMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        onMessageKeyDown,
        handleWsEvent,
    };
}

export type ChannelMessagesState = ReturnType<typeof useChannelMessages>;

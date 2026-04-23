"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { GifMessage } from "@/components/chat/GifMessage";
import { Message } from "@/types/chat";
import { getInitials, formatTimeFR } from "@/utils/chat";
import { isGifMessage } from "@/utils/message-content";

interface User {
    id: string;
    username: string;
}

interface MessageListProps {
    messages: Message[];
    messagesLoading: boolean;
    messagesError: string | null;
    hasMoreMessages: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    me: User | null;
    canModerateMessages: boolean;
    editingMessageId: string | null;
    editingContent: string;
    onStartEdit: (id: string) => void;
    onChangeEditingContent: (content: string) => void;
    onDeleteMessage: (id: string) => void;
    onToggleReaction: (messageId: string, emoji: string, hasReacted: boolean) => void;
    onSaveEdit: (id: string, content: string) => void;
    onCancelEdit: () => void;
    selectedChannelId: string | null;
}

export function MessageList({
    messages,
    messagesLoading,
    messagesError,
    hasMoreMessages,
    loadingMore,
    onLoadMore,
    me,
    canModerateMessages,
    editingMessageId,
    editingContent,
    onStartEdit,
    onChangeEditingContent,
    onDeleteMessage,
    onToggleReaction,
    onSaveEdit,
    onCancelEdit,
    selectedChannelId,
}: MessageListProps) {
    const t = useTranslations("common");
    const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-[#DCCBC4]/50">
                        {messagesLoading ? t("loading") : t("messageCount", { count: messages.length })}
                    </div>

                    {hasMoreMessages && messages.length > 0 && (
                        <button
                            onClick={onLoadMore}
                            disabled={loadingMore}
                            className="text-xs px-3 py-1 rounded-full border border-[#ffffff]/10 hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                        >
                            {loadingMore ? t("loading") : t("loadMore")}
                        </button>
                    )}
                </div>

                {messagesError && <div className="text-sm text-red-400 mb-3">{messagesError}</div>}

                {!selectedChannelId ? (
                    <div className="text-sm text-[#DCCBC4]/50">{t("noMessages")}</div>
                ) : messagesLoading ? (
                    <div className="text-sm text-[#DCCBC4]/50">{t("loadingMessages")}</div>
                ) : messages.length === 0 ? (
                    <div className="text-sm text-[#DCCBC4]/50">{t("noMessages")}</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {messages.map((m) => {
                            const isMe = me && String(me.id) === String(m.user_id);
                            const time = formatTimeFR(m.created_at);
                            const canDeleteThis = !m.is_deleted && (isMe || canModerateMessages);
                            const canEditThis = isMe && !m.is_deleted;
                            const isEditing = editingMessageId === m.message_id;
                            const canReact = !!me && !m.is_deleted && !isEditing;

                            return (
                                <div key={m.message_id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                    {!isMe && (
                                        <div className="mr-3 mt-1 shrink-0">
                                            <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4]">
                                                {getInitials(m.username)}
                                            </div>
                                        </div>
                                    )}

                                    <div className={`min-w-0 max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                                        {!isMe && (
                                            <div className="flex items-center gap-2 mb-1 px-1 min-w-0">
                                                <span className="text-xs font-bold text-[#EB5E28] truncate">@{m.username}</span>
                                                {time && <span className="text-[10px] text-[#DCCBC4]/40">{time}</span>}
                                                {m.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">{t("edited")}</span>}

                                                {canDeleteThis && (
                                                    <button
                                                        onClick={() => {
                                                            if (!window.confirm(t("messageDeleted"))) return;
                                                            onDeleteMessage(String(m.message_id));
                                                        }}
                                                        className="ml-auto text-[10px] text-[#DCCBC4]/60 hover:text-red-200 cursor-pointer"
                                                        title={t("delete")}
                                                    >
                                                        {t("deleteAction")}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {isEditing ? (
                                            <div className="w-full">
                                                <textarea
                                                    value={editingContent}
                                                    onChange={(e) => onChangeEditingContent(e.target.value)}
                                                    className="w-full px-4 py-3 rounded-2xl border border-[#EB5E28] bg-[#1E1211] text-[#DCCBC4] focus:outline-none resize-none"
                                                    rows={3}
                                                    autoFocus
                                                />
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        onClick={() => onSaveEdit(m.message_id, editingContent)}
                                                        className="px-3 py-1 rounded-xl bg-[#EB5E28] text-white text-xs font-bold hover:bg-white hover:text-[#1E1211] transition-colors"
                                                    >
                                                        {t("save")}
                                                    </button>
                                                    <button
                                                        onClick={onCancelEdit}
                                                        className="px-3 py-1 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] text-xs hover:bg-[#1E1211] transition-colors"
                                                    >
                                                        {t("cancel")}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div
                                                    className={`px-4 py-3 rounded-2xl ${
                                                        isMe
                                                            ? "bg-[#EB5E28] text-white"
                                                            : "bg-[#1E1211] border border-[#ffffff]/5 text-[#DCCBC4]"
                                                    }`}
                                                >
                                                    {m.is_deleted ? (
                                                        <span className="text-[#DCCBC4]/50 italic">{t("messageDeleted")}</span>
                                                    ) : isGifMessage(m.content) ? (
                                                        <GifMessage src={m.content} />
                                                    ) : (
                                                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                                                    )}
                                                </div>

                                                {m.reactions && m.reactions.length > 0 && (
                                                    <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                                        {m.reactions.map((reaction) => {
                                                            const hasReacted = !!me && reaction.users.some((id) => String(id) === String(me.id));
                                                            return (
                                                                <button
                                                                    key={reaction.emoji}
                                                                    onClick={() => onToggleReaction(m.message_id, reaction.emoji, hasReacted)}
                                                                    className={[
                                                                        "flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] transition-all cursor-pointer",
                                                                        hasReacted
                                                                            ? "bg-[#EB5E28]/20 border-[#EB5E28] text-[#EB5E28]"
                                                                            : "bg-[#0F0908] border-[#ffffff]/10 text-[#DCCBC4]/70 hover:border-[#ffffff]/30",
                                                                    ].join(" ")}
                                                                    title={hasReacted ? t("removeReaction") : t("reactAlso")}
                                                                >
                                                                    <span>{reaction.emoji}</span>
                                                                    <span className="font-bold">{reaction.users.length}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {canReact && (
                                                    <div className={`relative mt-1 px-1 ${isMe ? "self-end" : "self-start"}`}>
                                                        <button
                                                            onClick={() => setEmojiPickerFor((current) => (current === m.message_id ? null : m.message_id))}
                                                            className="text-[11px] text-[#DCCBC4]/50 hover:text-white transition-colors cursor-pointer"
                                                            title={t("addReactionTitle")}
                                                        >
                                                            {t("addReactionShort")}
                                                        </button>
                                                        {emojiPickerFor === m.message_id && (
                                                            <div className={`absolute z-30 top-6 ${isMe ? "right-0" : "left-0"}`}>
                                                                <EmojiPicker
                                                                    theme={Theme.DARK}
                                                                    width={320}
                                                                    height={380}
                                                                    previewConfig={{ showPreview: false }}
                                                                    onEmojiClick={(emojiData: EmojiClickData) => {
                                                                        const emoji = emojiData.emoji;
                                                                        const alreadyReacted = (m.reactions ?? []).some(
                                                                            (reaction) =>
                                                                                reaction.emoji === emoji &&
                                                                                me &&
                                                                                reaction.users.some((id) => String(id) === String(me.id))
                                                                        );
                                                                        onToggleReaction(m.message_id, emoji, alreadyReacted);
                                                                        setEmojiPickerFor(null);
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {isMe && time && (
                                            <div className="flex items-center gap-2 mt-1 px-1">
                                                {time && <span className="text-[10px] text-[#DCCBC4]/40">{time}</span>}
                                                {m.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">{t("edited")}</span>}
                                                {canEditThis && (
                                                    <button
                                                        onClick={() => onStartEdit(m.message_id)}
                                                        className="text-[10px] text-[#DCCBC4]/60 hover:text-white cursor-pointer"
                                                        title={t("edit")}
                                                    >
                                                        {t("editAction")}
                                                    </button>
                                                )}
                                                {canDeleteThis && (
                                                    <button
                                                        onClick={() => {
                                                            if (!window.confirm(t("messageDeleted"))) return;
                                                            onDeleteMessage(String(m.message_id));
                                                        }}
                                                        className="ml-auto text-[10px] text-[#DCCBC4]/60 hover:text-red-200 cursor-pointer"
                                                        title={t("delete")}
                                                    >
                                                        {t("deleteAction")}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

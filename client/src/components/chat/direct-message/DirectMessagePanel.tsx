"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { GifMessage } from "@/components/chat/GifMessage";
import { GifPicker } from "@/components/chat/GifPicker";
import { ConversationItem, DmMessage } from "@/features/direct-message/services/dm.service";
import { getInitials, formatTimeFR } from "@/utils/chat";
import { isGifMessage } from "@/utils/message-content";

interface User {
    id: string;
    username: string;
}

interface DirectMessagePanelProps {
    conversations: ConversationItem[];
    selectedConvId: string | null;
    messages: DmMessage[];
    messagesLoading: boolean;
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    me: User | null;
    editingMessageId: string | null;
    editingContent: string;
    onStartEdit: (messageId: string, content: string) => void;
    onChangeEditingContent: (content: string) => void;
    onSaveEdit: (messageId: string, content: string) => void;
    onCancelEdit: () => void;
    onDeleteMessage: (messageId: string) => void;
    messageText: string;
    setMessageText: (text: string) => void;
    isSending: boolean;
    onSendMessage: () => void;
    onSendGif: (gifUrl: string) => void;
    onToggleReaction: (messageId: string, emoji: string, hasReacted: boolean) => void;
    onMessageKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function DirectMessagePanel({
    conversations,
    selectedConvId,
    messages,
    messagesLoading,
    hasMore,
    loadingMore,
    onLoadMore,
    me,
    editingMessageId,
    editingContent,
    onStartEdit,
    onChangeEditingContent,
    onSaveEdit,
    onCancelEdit,
    onDeleteMessage,
    messageText,
    setMessageText,
    isSending,
    onSendMessage,
    onSendGif,
    onToggleReaction,
    onMessageKeyDown,
    messagesEndRef,
}: DirectMessagePanelProps) {
    const t = useTranslations("directMessage");
    const tCommon = useTranslations("common");
    const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
    const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
    const selectedConversation = selectedConvId
        ? conversations.find((conversation) => conversation.id === selectedConvId) ?? null
        : null;
    const canSendGif = Boolean(selectedConvId && !isSending);

    return (
        <>
            <div className="h-auto py-4 px-6 flex items-center border-b border-[#ffffff]/5">
                {selectedConversation ? (
                    <>
                        <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4] mr-3 shrink-0">
                            {getInitials(selectedConversation.other_username)}
                        </div>
                        <h2 className="font-[family-name:var(--font-nunito)] font-bold text-xl text-white">
                            @{selectedConversation.other_username}
                        </h2>
                    </>
                ) : (
                    <h2 className="font-[family-name:var(--font-nunito)] font-bold text-xl text-white">{t("title")}</h2>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-[family-name:var(--font-nunito)]">
                {!selectedConvId ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg">
                            <div className="text-white font-bold text-lg mb-2">{t("selectConversation")}</div>
                            <div className="text-sm text-[#DCCBC4]/60">
                                {t("selectConversationHint")}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto pr-2">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-xs text-[#DCCBC4]/50">
                                    {messagesLoading ? tCommon("loading") : tCommon("messageCount", { count: messages.length })}
                                </div>
                                {hasMore && messages.length > 0 && (
                                    <button
                                        onClick={onLoadMore}
                                        disabled={loadingMore}
                                        className="text-xs px-3 py-1 rounded-full border border-[#ffffff]/10 hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                                    >
                                        {loadingMore ? tCommon("loading") : tCommon("loadMore")}
                                    </button>
                                )}
                            </div>

                            {messagesLoading ? (
                                <div className="text-sm text-[#DCCBC4]/50">{tCommon("loadingMessages")}</div>
                            ) : messages.length === 0 ? (
                                <div className="text-sm text-[#DCCBC4]/50">{tCommon("noMessages")}</div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {messages.map((message) => {
                                        const isMe = me && String(me.id) === String(message.sender_id);
                                        const time = formatTimeFR(message.created_at);
                                        const isEditing = editingMessageId === message.message_id;
                                        const canReact = !!me && !message.is_deleted && !isEditing;

                                        return (
                                            <div key={message.message_id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                {!isMe && (
                                                    <div className="mr-3 mt-1 shrink-0">
                                                        <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4]">
                                                            {getInitials(message.sender_username)}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className={`min-w-0 max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                                                    {!isMe && (
                                                        <div className="flex items-center gap-2 mb-1 px-1 min-w-0">
                                                            <span className="text-xs font-bold text-[#EB5E28] truncate">@{message.sender_username}</span>
                                                            {time && <span className="text-[10px] text-[#DCCBC4]/40">{time}</span>}
                                                            {message.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">{tCommon("edited")}</span>}
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
                                                                    onClick={() => onSaveEdit(message.message_id, editingContent)}
                                                                    className="px-3 py-1 rounded-xl bg-[#EB5E28] text-white text-xs font-bold hover:bg-white hover:text-[#1E1211] transition-colors"
                                                                >
                                                                    {tCommon("save")}
                                                                </button>
                                                                <button
                                                                    onClick={onCancelEdit}
                                                                    className="px-3 py-1 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] text-xs hover:bg-[#1E1211] transition-colors"
                                                                >
                                                                    {tCommon("cancel")}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div
                                                                className={[
                                                                    "px-4 py-3 rounded-2xl border border-[#ffffff]/10 shadow-sm",
                                                                    "text-sm leading-relaxed",
                                                                    isMe ? "bg-[#2563EB] text-white rounded-br-md" : "bg-[#1E1211] text-[#DCCBC4] rounded-bl-md",
                                                                ].join(" ")}
                                                            >
                                                                {message.is_deleted ? (
                                                                    <span className="text-white/60 italic">{t("messageSuppressed")}</span>
                                                                ) : isGifMessage(message.content) ? (
                                                                    <GifMessage src={message.content} />
                                                                ) : (
                                                                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                                                                )}
                                                            </div>

                                                            {message.reactions && message.reactions.length > 0 && (
                                                                <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                                                    {message.reactions.map((reaction) => {
                                                                        const hasReacted = !!me && reaction.users.some((id) => String(id) === String(me.id));
                                                                        return (
                                                                            <button
                                                                                key={reaction.emoji}
                                                                                onClick={() => onToggleReaction(message.message_id, reaction.emoji, hasReacted)}
                                                                                className={[
                                                                                    "flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] transition-all cursor-pointer",
                                                                                    hasReacted
                                                                                        ? "bg-[#EB5E28]/20 border-[#EB5E28] text-[#EB5E28]"
                                                                                        : "bg-[#0F0908] border-[#ffffff]/10 text-[#DCCBC4]/70 hover:border-[#ffffff]/30",
                                                                                ].join(" ")}
                                                                                title={hasReacted ? tCommon("removeReaction") : tCommon("reactAlso")}
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
                                                                        onClick={() => setEmojiPickerFor((current) => (current === message.message_id ? null : message.message_id))}
                                                                        className={`text-[11px] transition-colors cursor-pointer ${isMe ? "text-white/70 hover:text-white" : "text-[#DCCBC4]/50 hover:text-white"}`}
                                                                        title={tCommon("addReactionTitle")}
                                                                    >
                                                                        {tCommon("addReactionShort")}
                                                                    </button>
                                                                    {emojiPickerFor === message.message_id && (
                                                                        <div className={`absolute z-30 top-6 ${isMe ? "right-0" : "left-0"}`}>
                                                                            <EmojiPicker
                                                                                theme={Theme.DARK}
                                                                                width={320}
                                                                                height={380}
                                                                                previewConfig={{ showPreview: false }}
                                                                                onEmojiClick={(emojiData: EmojiClickData) => {
                                                                                    const emoji = emojiData.emoji;
                                                                                    const alreadyReacted = (message.reactions ?? []).some(
                                                                                        (reaction) =>
                                                                                            reaction.emoji === emoji &&
                                                                                            me &&
                                                                                            reaction.users.some((id) => String(id) === String(me.id))
                                                                                    );
                                                                                    onToggleReaction(message.message_id, emoji, alreadyReacted);
                                                                                    setEmojiPickerFor(null);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                    <div className={`flex items-center gap-2 mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                                        {time && <span className={`text-[10px] ${isMe ? "text-white/70" : "text-[#DCCBC4]/40"}`}>{time}</span>}
                                                        {message.is_edited && <span className={`text-[10px] ${isMe ? "text-white/70" : "text-[#DCCBC4]/40"}`}>{tCommon("edited")}</span>}

                                                        {isMe && !message.is_deleted && !isEditing && (
                                                            <button
                                                                onClick={() => onStartEdit(message.message_id, message.content)}
                                                                className="text-[10px] text-white/70 hover:text-[#EB5E28] cursor-pointer"
                                                                title={tCommon("edit")}
                                                            >
                                                                {tCommon("editAction")}
                                                            </button>
                                                        )}
                                                        {isMe && !message.is_deleted && (
                                                            <button
                                                                onClick={() => onDeleteMessage(message.message_id)}
                                                                className="text-[10px] text-white/70 hover:text-red-200 cursor-pointer"
                                                                title={tCommon("delete")}
                                                            >
                                                                {tCommon("deleteAction")}
                                                            </button>
                                                        )}
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
                <div className="relative bg-[#1E1211] rounded-full flex items-center px-6 py-3 border border-[#ffffff]/5">
                    <button
                        type="button"
                        onClick={() => setIsGifPickerOpen((current) => !current)}
                        disabled={!canSendGif}
                        className={[
                            "mr-3 text-sm font-bold transition-colors",
                            canSendGif ? "text-[#DCCBC4]/60 hover:text-[#EB5E28] cursor-pointer" : "text-[#DCCBC4]/30 cursor-not-allowed",
                        ].join(" ")}
                    >
                        GIF
                    </button>
                    <GifPicker
                        isOpen={isGifPickerOpen}
                        onClose={() => setIsGifPickerOpen(false)}
                        onSelectGif={onSendGif}
                    />
                    <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={onMessageKeyDown}
                        disabled={!selectedConvId || isSending}
                        placeholder={selectedConvId ? t("sendPlaceholder") : t("selectConvPlaceholder")}
                        className="flex-1 bg-transparent text-[#DCCBC4] placeholder-[#DCCBC4]/30 focus:outline-none font-[family-name:var(--font-nunito)]"
                    />
                    <button
                        onClick={onSendMessage}
                        disabled={!selectedConvId || isSending || !messageText.trim()}
                        className={[
                            "ml-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                            selectedConvId && messageText.trim()
                                ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white cursor-pointer"
                                : "bg-[#2A1A18] text-[#DCCBC4]/30 cursor-not-allowed",
                        ].join(" ")}
                        title={tCommon("send")}
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
}

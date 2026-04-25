"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { GifMessage } from "@/components/chat/GifMessage";
import { Message } from "@/types/chat";
import { getInitials, formatTime } from "@/utils/chat";
import { isGifMessage } from "@/utils/message-content";
import { SmilePlus, Pencil, Trash2, Plus } from "lucide-react";

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

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

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
    const locale = useLocale();
    
    const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
    const [showFullPicker, setShowFullPicker] = useState(false);
    const reactionPickerBottomPadding = emojiPickerFor ? (showFullPicker ? "pb-[480px]" : "pb-24") : "pb-0";

    const closePicker = () => {
        setEmojiPickerFor(null);
        setShowFullPicker(false);
    };

    return (
        <div className="h-full flex flex-col relative">
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
                    <div className={`flex flex-col gap-4 transition-[padding] duration-200 ${reactionPickerBottomPadding}`}>
                        {messages.map((m) => {
                            const isMe = me && String(me.id) === String(m.user_id);
                            const time = formatTime(m.created_at, locale);
                            const canDeleteThis = !m.is_deleted && (isMe || canModerateMessages);
                            const canEditThis = isMe && !m.is_deleted;
                            const isEditing = editingMessageId === m.message_id;
                            const canReact = !!me && !m.is_deleted && !isEditing;

                            return (
                                <div key={m.message_id} className={`flex group ${isMe ? "justify-end" : "justify-start"}`}>
                                    
                                    {!isMe && (
                                        <div className="mr-3 mt-1 shrink-0">
                                            <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4]">
                                                {getInitials(m.username)}
                                            </div>
                                        </div>
                                    )}

                                    <div className={`min-w-0 max-w-[85%] ${isMe ? "items-end" : "items-start"} flex flex-col relative`}>
                                        
                                        {!isMe && (
                                            <div className="flex items-center gap-2 mb-1 px-1 min-w-0">
                                                <span className="text-xs font-bold text-[#EB5E28] truncate">@{m.username}</span>
                                                {time && <span className="text-[10px] text-[#DCCBC4]/40">{time}</span>}
                                                {m.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">{t("edited")}</span>}
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
                                            <div className="relative">
                                                
                                                {/* 1. CONTENEUR FLEX : Bulle + Actions au survol */}
                                                <div className={`flex items-center gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                                                    
                                                    {/* La Bulle */}
                                                    <div
                                                        className={`px-4 py-3 rounded-2xl shadow-sm ${
                                                            isMe
                                                                ? "bg-[#EB5E28] text-[#1E1211] rounded-tr-sm"
                                                                : "bg-[#1E1211] border border-[#ffffff]/5 text-[#DCCBC4] rounded-tl-sm"
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

                                                    {/* Barre d'actions (Apparaît au survol) */}
                                                    {!m.is_deleted && (
                                                        <div className={`flex items-center gap-1 bg-[#0F0908] border border-[#ffffff]/10 rounded-full shadow-lg p-0.5 shrink-0 transition-opacity duration-200 ${emojiPickerFor === m.message_id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                                            {canReact && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEmojiPickerFor(m.message_id);
                                                                        setShowFullPicker(false);
                                                                    }}
                                                                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${emojiPickerFor === m.message_id ? "bg-[#ffffff]/10 text-white" : "text-[#DCCBC4]/70 hover:text-white hover:bg-[#ffffff]/10"}`}
                                                                    title={t("addReactionTitle")}
                                                                >
                                                                    <SmilePlus className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canEditThis && (
                                                                <button
                                                                    onClick={() => onStartEdit(m.message_id)}
                                                                    className="p-1.5 text-[#DCCBC4]/70 hover:text-white hover:bg-[#ffffff]/10 rounded-full transition-colors cursor-pointer"
                                                                    title={t("edit")}
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canDeleteThis && (
                                                                <button
                                                                    onClick={() => {
                                                                        if (!window.confirm(t("messageDeleted"))) return;
                                                                        onDeleteMessage(String(m.message_id));
                                                                    }}
                                                                    className="p-1.5 text-[#DCCBC4]/70 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors cursor-pointer"
                                                                    title={t("delete")}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 2. SYSTÈME D'EMOJIS (Menu Rapide + Palette) */}
                                                {emojiPickerFor === m.message_id && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={closePicker} />
                                                        <div className={`absolute z-50 mt-2 top-full ${isMe ? "right-0" : "left-0"}`}>
                                                            <div className={`flex flex-col gap-2 ${isMe ? "items-end" : "items-start"}`}>
                                                                
                                                                <div className="flex items-center gap-1.5 bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in duration-200 relative z-50">
                                                                    {QUICK_EMOJIS.map(emoji => {
                                                                        const alreadyReacted = (m.reactions ?? []).some(
                                                                            r => r.emoji === emoji && me && r.users.some(id => String(id) === String(me.id))
                                                                        );
                                                                        return (
                                                                            <button
                                                                                key={emoji}
                                                                                onClick={() => {
                                                                                    onToggleReaction(m.message_id, emoji, alreadyReacted);
                                                                                    closePicker();
                                                                                }}
                                                                                className={`text-2xl p-1.5 rounded-xl hover:bg-[#ffffff]/10 hover:scale-125 transition-all cursor-pointer ${alreadyReacted ? "bg-[#ffffff]/10" : ""}`}
                                                                            >
                                                                                {emoji}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                    <div className="w-px h-6 bg-[#ffffff]/10 mx-1" />
                                                                    <button 
                                                                        onClick={() => setShowFullPicker(!showFullPicker)}
                                                                        className={`p-2 rounded-xl transition-all cursor-pointer ${showFullPicker ? "bg-[#EB5E28] text-[#1E1211]" : "text-[#DCCBC4] hover:text-white hover:bg-[#ffffff]/10"}`}
                                                                        title="Plus d'emojis"
                                                                    >
                                                                        <Plus className={`w-5 h-5 transition-transform duration-300 ${showFullPicker ? "rotate-45" : ""}`} />
                                                                    </button>
                                                                </div>

                                                                {showFullPicker && (
                                                                    <div className="shadow-2xl rounded-2xl overflow-hidden border border-[#ffffff]/10 animate-in fade-in slide-in-from-top-2 duration-200 relative z-50 bg-[#0F0908]">
                                                                        <EmojiPicker
                                                                            theme={Theme.DARK}
                                                                            width={320}
                                                                            height={380}
                                                                            previewConfig={{ showPreview: false }}
                                                                            onEmojiClick={(emojiData: EmojiClickData) => {
                                                                                const emoji = emojiData.emoji;
                                                                                const alreadyReacted = (m.reactions ?? []).some(
                                                                                    (r) => r.emoji === emoji && me && r.users.some((id) => String(id) === String(me.id))
                                                                                );
                                                                                onToggleReaction(m.message_id, emoji, alreadyReacted);
                                                                                closePicker();
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {/* 3. AFFICHAGE DES RÉACTIONS SÉLECTIONNÉES SOUS LE MESSAGE */}
                                                {m.reactions && m.reactions.length > 0 && (
                                                    <div className={`flex flex-wrap gap-1 mt-1.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                                        {m.reactions.map((reaction) => {
                                                            const hasReacted = !!me && reaction.users.some((id) => String(id) === String(me.id));
                                                            return (
                                                                <button
                                                                    key={reaction.emoji}
                                                                    onClick={() => onToggleReaction(m.message_id, reaction.emoji, hasReacted)}
                                                                    className={[
                                                                        "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all cursor-pointer hover:scale-105",
                                                                        hasReacted
                                                                            ? "bg-[#EB5E28]/20 border-[#EB5E28]/50 text-[#EB5E28]"
                                                                            : "bg-[#0F0908] border-[#ffffff]/10 text-[#DCCBC4]/70 hover:border-[#ffffff]/30 hover:bg-[#ffffff]/5",
                                                                    ].join(" ")}
                                                                    title={hasReacted ? t("removeReaction") : t("reactAlso")}
                                                                >
                                                                    <span className="text-sm">{reaction.emoji}</span>
                                                                    <span className="font-bold text-[11px]">{reaction.users.length}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                            </div>
                                        )}

                                        {isMe && time && (
                                            <div className="flex items-center gap-2 mt-1 px-1">
                                                <span className="text-[10px] text-[#DCCBC4]/40">{time}</span>
                                                {m.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">{t("edited")}</span>}
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

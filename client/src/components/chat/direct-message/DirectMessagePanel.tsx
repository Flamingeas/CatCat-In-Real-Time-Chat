"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { GifMessage } from "@/components/chat/GifMessage";
import { GifPicker } from "@/components/chat/GifPicker";
import { ConversationItem, DmMessage } from "@/features/direct-message/services/dm.service";
import { getInitials, formatTime } from "@/utils/chat";
import { isGifMessage } from "@/utils/message-content";
// Import des icônes pour la barre d'action
import { SmilePlus, Pencil, Trash2, Plus } from "lucide-react";

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

// Les 6 emojis rapides
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

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
    const locale = useLocale();
    
    const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
    
    // États pour le menu d'emojis
    const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
    const [showFullPicker, setShowFullPicker] = useState(false);
    const reactionPickerBottomPadding = emojiPickerFor ? (showFullPicker ? "pb-[480px]" : "pb-24") : "pb-0";

    const selectedConversation = selectedConvId
        ? conversations.find((conversation) => conversation.id === selectedConvId) ?? null
        : null;
    const canSendGif = Boolean(selectedConvId && !isSending);

    // Fonction pour fermer les menus proprement
    const closePicker = () => {
        setEmojiPickerFor(null);
        setShowFullPicker(false);
    };

    return (
        /* Le conteneur principal */
        <div className="flex-1 flex flex-col relative h-full w-full">
            
            {/* === HEADER DES DM === */}
            <div className="h-auto py-4 px-6 flex items-center border-b border-border-custom bg-surface/40 backdrop-blur-md shrink-0 z-10">
                {selectedConversation ? (
                    <>
                        <div className="w-9 h-9 rounded-full bg-secondary border border-border-custom flex items-center justify-center text-xs font-bold text-accent mr-3 shrink-0">
                            {getInitials(selectedConversation.other_username)}
                        </div>
                        <h2 className="font-[family-name:var(--font-nunito)] font-bold text-xl text-primary">
                            @{selectedConversation.other_username}
                        </h2>
                    </>
                ) : (
                    <h2 className="font-[family-name:var(--font-nunito)] font-bold text-xl text-primary">{t("title")}</h2>
                )}
            </div>

            {/* === ZONE PRINCIPALE === */}
            <div className="flex-1 overflow-y-auto p-6 font-[family-name:var(--font-nunito)] relative">
                {!selectedConvId ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-border-custom bg-surface p-6 shadow-lg">
                            <div className="text-primary font-bold text-lg mb-2">{t("selectConversation")}</div>
                            <div className="text-sm text-muted">
                                {t("selectConversationHint")}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto pr-2">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-xs text-muted/50">
                                    {messagesLoading ? tCommon("loading") : tCommon("messageCount", { count: messages.length })}
                                </div>
                                {hasMore && messages.length > 0 && (
                                    <button
                                        onClick={onLoadMore}
                                        disabled={loadingMore}
                                        className="text-xs px-3 py-1 rounded-full border border-border-custom hover:bg-secondary disabled:opacity-50 cursor-pointer text-muted hover:text-primary transition-colors"
                                    >
                                        {loadingMore ? tCommon("loading") : tCommon("loadMore")}
                                    </button>
                                )}
                            </div>

                            {messagesLoading ? (
                                <div className="text-sm text-muted">{tCommon("loadingMessages")}</div>
                            ) : messages.length === 0 ? (
                                <div className="text-sm text-muted">{tCommon("noMessages")}</div>
                            ) : (
                                <div className={`flex flex-col gap-4 transition-[padding] duration-200 ${reactionPickerBottomPadding}`}>
                                    {messages.map((message) => {
                                        const isMe = me && String(me.id) === String(message.sender_id);
                                        const time = formatTime(message.created_at, locale);
                                        const isEditing = editingMessageId === message.message_id;
                                        const canReact = !!me && !message.is_deleted && !isEditing;
                                        // On suppose qu'on peut toujours éditer/supprimer ses propres messages dans les DM
                                        const canEditThis = isMe && !message.is_deleted;
                                        const canDeleteThis = isMe && !message.is_deleted;

                                        return (
                                            <div key={message.message_id} className={`flex group ${isMe ? "justify-end" : "justify-start"}`}>
                                                {!isMe && (
                                                    <div className="mr-3 mt-1 shrink-0">
                                                        <div className="w-9 h-9 rounded-full bg-secondary border border-border-custom flex items-center justify-center text-xs font-bold text-accent">
                                                            {getInitials(message.sender_username)}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className={`min-w-0 max-w-[85%] ${isMe ? "items-end" : "items-start"} flex flex-col relative`}>
                                                    {!isMe && (
                                                        <div className="flex items-center gap-2 mb-1 px-1 min-w-0">
                                                            <span className="text-xs font-bold text-accent truncate">@{message.sender_username}</span>
                                                            {time && <span className="text-[10px] text-muted/60">{time}</span>}
                                                            {message.is_edited && <span className="text-[10px] text-muted/60">{tCommon("edited")}</span>}
                                                        </div>
                                                    )}

                                                    {isEditing ? (
                                                        <div className="w-full">
                                                            <textarea
                                                                value={editingContent}
                                                                onChange={(e) => onChangeEditingContent(e.target.value)}
                                                                className="w-full px-4 py-3 rounded-2xl border border-accent bg-surface text-primary focus:outline-none resize-none"
                                                                rows={3}
                                                                autoFocus
                                                            />
                                                            <div className="flex gap-2 mt-2">
                                                                <button
                                                                    onClick={() => onSaveEdit(message.message_id, editingContent)}
                                                                    className="px-3 py-1 rounded-xl bg-accent text-[#1E1211] text-xs font-bold hover:bg-white transition-colors"
                                                                >
                                                                    {tCommon("save")}
                                                                </button>
                                                                <button
                                                                    onClick={onCancelEdit}
                                                                    className="px-3 py-1 rounded-xl bg-transparent border border-border-custom text-muted text-xs hover:bg-surface transition-colors"
                                                                >
                                                                    {tCommon("cancel")}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            
                                                            {/* === BULLE + BARRE D'ACTIONS === */}
                                                            <div className={`flex items-center gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                                                                <div
                                                                    className={[
                                                                        "px-4 py-3 shadow-sm",
                                                                        "text-sm leading-relaxed break-words whitespace-pre-wrap",
                                                                        isMe 
                                                                            ? "bg-accent text-[#1E1211] rounded-2xl rounded-br-sm" 
                                                                            : "bg-surface border border-border-custom text-primary rounded-2xl rounded-bl-sm",
                                                                    ].join(" ")}
                                                                >
                                                                    {message.is_deleted ? (
                                                                        <span className="opacity-60 italic">{t("messageSuppressed")}</span>
                                                                    ) : isGifMessage(message.content) ? (
                                                                        <GifMessage src={message.content} />
                                                                    ) : (
                                                                        message.content
                                                                    )}
                                                                </div>

                                                                {/* Barre d'actions (survol) */}
                                                                {!message.is_deleted && (
                                                                    <div className={`flex items-center gap-1 bg-surface border border-border-custom rounded-full shadow-lg p-0.5 shrink-0 transition-opacity duration-200 ${emojiPickerFor === message.message_id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                                                        {canReact && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEmojiPickerFor(message.message_id);
                                                                                    setShowFullPicker(false);
                                                                                }}
                                                                                className={`p-1.5 rounded-full transition-colors cursor-pointer ${emojiPickerFor === message.message_id ? "bg-background text-primary" : "text-muted hover:text-primary hover:bg-background"}`}
                                                                                title={tCommon("addReactionTitle")}
                                                                            >
                                                                                <SmilePlus className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        {canEditThis && (
                                                                            <button
                                                                                onClick={() => onStartEdit(message.message_id, message.content)}
                                                                                className="p-1.5 text-muted hover:text-primary hover:bg-background rounded-full transition-colors cursor-pointer"
                                                                                title={tCommon("edit")}
                                                                            >
                                                                                <Pencil className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        {canDeleteThis && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (!window.confirm(tCommon("confirmDeleteMessage"))) return;
                                                                                    onDeleteMessage(message.message_id);
                                                                                }}
                                                                                className="p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors cursor-pointer"
                                                                                title={tCommon("delete")}
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* === MENU EMOJI === */}
                                                            {emojiPickerFor === message.message_id && (
                                                                <>
                                                                    <div className="fixed inset-0 z-40" onClick={closePicker} />
                                                                    <div className={`absolute z-50 mt-2 top-full ${isMe ? "right-0" : "left-0"}`}>
                                                                        <div className={`flex flex-col gap-2 ${isMe ? "items-end" : "items-start"}`}>
                                                                            
                                                                            <div className="flex items-center gap-1.5 bg-surface border border-border-custom rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in duration-200 relative z-50">
                                                                                {QUICK_EMOJIS.map(emoji => {
                                                                                    const alreadyReacted = (message.reactions ?? []).some(
                                                                                        r => r.emoji === emoji && me && r.users.some(id => String(id) === String(me.id))
                                                                                    );
                                                                                    return (
                                                                                        <button
                                                                                            key={emoji}
                                                                                            onClick={() => {
                                                                                                onToggleReaction(message.message_id, emoji, alreadyReacted);
                                                                                                closePicker();
                                                                                            }}
                                                                                            className={`text-2xl p-1.5 rounded-xl hover:bg-background hover:scale-125 transition-all cursor-pointer ${alreadyReacted ? "bg-background" : ""}`}
                                                                                        >
                                                                                            {emoji}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                                <div className="w-px h-6 bg-border-custom mx-1" />
                                                                                <button 
                                                                                    onClick={() => setShowFullPicker(!showFullPicker)}
                                                                                    className={`p-2 rounded-xl transition-all cursor-pointer ${showFullPicker ? "bg-accent text-[#1E1211]" : "text-muted hover:text-primary hover:bg-background"}`}
                                                                                    title="Plus d'emojis"
                                                                                >
                                                                                    <Plus className={`w-5 h-5 transition-transform duration-300 ${showFullPicker ? "rotate-45" : ""}`} />
                                                                                </button>
                                                                            </div>

                                                                            {showFullPicker && (
                                                                                <div className="shadow-2xl rounded-2xl overflow-hidden border border-border-custom animate-in fade-in slide-in-from-top-2 duration-200 relative z-50 bg-surface">
                                                                                    <EmojiPicker
                                                                                        theme={Theme.DARK} // Tu peux le rendre dynamique plus tard si tu veux
                                                                                        width={320}
                                                                                        height={380}
                                                                                        previewConfig={{ showPreview: false }}
                                                                                        onEmojiClick={(emojiData: EmojiClickData) => {
                                                                                            const emoji = emojiData.emoji;
                                                                                            const alreadyReacted = (message.reactions ?? []).some(
                                                                                                (r) => r.emoji === emoji && me && r.users.some((id) => String(id) === String(me.id))
                                                                                            );
                                                                                            onToggleReaction(message.message_id, emoji, alreadyReacted);
                                                                                            closePicker();
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}

                                                            {/* === RÉACTIONS SOUS LA BULLE === */}
                                                            {message.reactions && message.reactions.length > 0 && (
                                                                <div className={`flex flex-wrap gap-1 mt-1.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                                                    {message.reactions.map((reaction) => {
                                                                        const hasReacted = !!me && reaction.users.some((id) => String(id) === String(me.id));
                                                                        return (
                                                                            <button
                                                                                key={reaction.emoji}
                                                                                onClick={() => onToggleReaction(message.message_id, reaction.emoji, hasReacted)}
                                                                                className={[
                                                                                    "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all cursor-pointer hover:scale-105",
                                                                                    hasReacted
                                                                                        ? "bg-accent/20 border-accent/50 text-accent"
                                                                                        : "bg-surface border-border-custom text-muted hover:border-muted/50 hover:bg-background",
                                                                                ].join(" ")}
                                                                                title={hasReacted ? tCommon("removeReaction") : tCommon("reactAlso")}
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

                                                    {/* Heure du message (pour moi) */}
                                                    {isMe && time && (
                                                        <div className="flex items-center gap-2 mt-1 px-1 justify-end">
                                                            <span className="text-[10px] text-muted/60">{time}</span>
                                                            {message.is_edited && <span className="text-[10px] text-muted/60">{tCommon("edited")}</span>}
                                                        </div>
                                                    )}
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

            {/* === ZONE D'INPUT (BAS DE PAGE) === */}
            <div className="p-6 pt-2 shrink-0">
                <div className="relative bg-surface rounded-full flex items-center px-6 py-3 border border-border-custom shadow-sm">
                    <button
                        type="button"
                        onClick={() => setIsGifPickerOpen((current) => !current)}
                        disabled={!canSendGif}
                        className={[
                            "mr-3 text-sm font-bold transition-colors",
                            canSendGif ? "text-muted hover:text-accent cursor-pointer" : "text-muted/30 cursor-not-allowed",
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
                        className="flex-1 bg-transparent text-primary placeholder-muted/50 focus:outline-none font-[family-name:var(--font-nunito)]"
                    />
                    <button
                        onClick={onSendMessage}
                        disabled={!selectedConvId || isSending || !messageText.trim()}
                        className={[
                            "ml-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                            selectedConvId && messageText.trim()
                                ? "bg-accent text-[#1E1211] hover:bg-white cursor-pointer"
                                : "bg-secondary text-muted/40 cursor-not-allowed",
                        ].join(" ")}
                        title={tCommon("send")}
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

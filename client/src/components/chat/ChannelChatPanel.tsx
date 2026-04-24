"use client";

import { useTranslations } from "next-intl";
import { MessageList } from "@/components/chat/MessageList";
import { GifPicker } from "@/components/chat/GifPicker";
import { UserPlusIcon } from "@/components/icons";
import { Channel, Message, Server } from "@/types/chat";
import { useState } from "react";
import type { KeyboardEvent, RefObject } from "react";

interface User {
    id: string;
    username: string;
}

interface ChannelChatPanelProps {
    selectedServer: Server | null;
    selectedServerId: string | null;
    selectedChannel: Channel | null;
    selectedChannelId: string | null;
    channelsCount: number;
    channelCreatedLabel: string | null;
    channelUpdatedLabel: string | null;
    canInviteMember: boolean;
    canCreateChannel: boolean;
    canModerateMessages: boolean;
    messages: Message[];
    messagesLoading: boolean;
    messagesError: string | null;
    messageText: string;
    setMessageText: (text: string) => void;
    isSending: boolean;
    editingMessageId: string | null;
    setEditingMessageId: (id: string | null) => void;
    editingContent: string;
    setEditingContent: (content: string) => void;
    hasMoreMessages: boolean;
    loadingMore: boolean;
    messagesEndRef: RefObject<HTMLDivElement | null>;
    onLoadMoreMessages: () => void;
    onSendMessage: () => void;
    onSendGif: (gifUrl: string) => void;
    onEditMessage: (id: string, content: string) => void;
    onDeleteMessage: (id: string) => void;
    onToggleReaction: (messageId: string, emoji: string, hasReacted: boolean) => void;
    onMessageKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    me: User | null;
    typingLabel: string | null;
    onInviteMember: () => void;
    onCreateChannel: () => void;
    onSendTyping: () => void;
}

export function ChannelChatPanel({
    selectedServer,
    selectedServerId,
    selectedChannel,
    selectedChannelId,
    channelsCount,
    channelCreatedLabel,
    channelUpdatedLabel,
    canInviteMember,
    canCreateChannel,
    canModerateMessages,
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
    onLoadMoreMessages,
    onSendMessage,
    onSendGif,
    onEditMessage,
    onDeleteMessage,
    onToggleReaction,
    onMessageKeyDown,
    me,
    typingLabel,
    onInviteMember,
    onCreateChannel,
    onSendTyping,
}: ChannelChatPanelProps) {
    const t = useTranslations("channelPanel");
    const tCommon = useTranslations("common");
    const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
    const canSendMessage = selectedServerId && selectedChannelId && messageText.trim();
    const canSendGif = Boolean(selectedServerId && selectedChannelId && !isSending);

    return (
        /* Le conteneur prend juste flex-1 pour remplir son parent à 100%.
           On retire les rounded, margins et borders car page.tsx s'en occupe !
        */
        <div className="flex-1 flex flex-col relative h-full w-full">
            
            {/* === HEADER DU CHAT === */}
            <div className="h-auto py-4 px-6 flex flex-col gap-3 border-b border-border-custom bg-surface/40 backdrop-blur-md shrink-0 z-10">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h2 className="font-[family-name:var(--font-nunito)] font-bold text-xl text-primary">
                                {selectedServer ? selectedServer.name : "Chat"}
                            </h2>
                        </div>

                        {selectedServerId && selectedChannel ? (
                            <div className="text-sm text-muted">
                                {t("currentChannel")} <span className="text-primary font-medium">#{selectedChannel.name}</span>
                            </div>
                        ) : selectedServerId ? (
                            <div className="text-sm text-muted">{t("noChannelSelected")}</div>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onInviteMember}
                            disabled={!selectedServerId || !canInviteMember}
                            title={!selectedServerId ? t("selectServerTitle") : canInviteMember ? t("inviteMemberTitle") : t("inviteOnlyAdmins")}
                            className={[
                                "px-3 py-2 rounded-xl border border-border-custom flex items-center gap-2 transition-colors cursor-pointer",
                                selectedServerId && canInviteMember ? "bg-accent text-[#1E1211] hover:bg-white" : "bg-transparent text-muted/40 cursor-not-allowed",
                            ].join(" ")}
                        >
                            <UserPlusIcon />
                            <span className="text-sm font-bold">{t("invite")}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* === ZONE PRINCIPALE (MESSAGES & EMPTY STATES) === */}
            <div className="flex-1 overflow-y-auto p-6 font-[family-name:var(--font-nunito)] relative">
                {selectedServerId && selectedChannel && (channelCreatedLabel || channelUpdatedLabel) && (
                    <div className="absolute top-4 right-14 text-right z-10">
                        {channelCreatedLabel && <div className="text-xs text-muted/60">{t("channelCreatedAt", { date: channelCreatedLabel })}</div>}
                        {channelUpdatedLabel && <div className="text-xs text-muted/40">{t("channelUpdatedAt", { date: channelUpdatedLabel })}</div>}
                    </div>
                )}

                {!selectedServerId ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-border-custom bg-surface p-6 shadow-lg">
                            <div className="text-primary font-bold text-lg mb-2">{t("chooseServer")}</div>
                            <div className="text-sm text-muted">
                                {t("selectServerHint")}
                            </div>
                        </div>
                    </div>
                ) : channelsCount === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-border-custom bg-surface p-6 shadow-lg">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-background border border-border-custom flex items-center justify-center text-accent">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <div className="text-primary font-bold text-lg">{t("noChannelYet")}</div>
                                    <div className="text-sm text-muted mt-1">{t("noChannelHint")}</div>
                                    <div className="mt-4 flex items-center gap-2">
                                        <button
                                            onClick={onCreateChannel}
                                            disabled={!canCreateChannel}
                                            className={[
                                                "px-4 py-2 rounded-xl font-bold transition-colors cursor-pointer",
                                                canCreateChannel ? "bg-accent text-[#1E1211] hover:bg-white" : "bg-transparent border border-border-custom text-muted/40 cursor-not-allowed",
                                            ].join(" ")}
                                            title={canCreateChannel ? t("createChannelTitle") : t("createChannelOnlyAdmins")}
                                        >
                                            {t("createFirstChannel")}
                                        </button>
                                        {!canCreateChannel && <span className="text-xs text-muted">{t("askAdminToCreate")}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : !selectedChannelId ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-border-custom bg-surface p-6 shadow-lg">
                            <div className="text-primary font-bold text-lg mb-2">{t("chooseChannel")}</div>
                            <div className="text-sm text-muted">{t("selectChannelHint")}</div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto pr-2">
                            {hasMoreMessages && messages.length > 0 && (
                                <div className="flex items-center justify-end mb-3">
                                    <button
                                        onClick={onLoadMoreMessages}
                                        disabled={loadingMore}
                                        className="text-xs px-3 py-1 rounded-full border border-border-custom hover:bg-secondary disabled:opacity-50 cursor-pointer text-muted hover:text-primary transition-colors"
                                    >
                                        {loadingMore ? tCommon("loading") : tCommon("loadMore")}
                                    </button>
                                </div>
                            )}

                            {messagesError && <div className="text-sm text-red-500 mb-3">{messagesError}</div>}

                            <MessageList
                                messages={messages}
                                messagesLoading={messagesLoading}
                                messagesError={messagesError}
                                hasMoreMessages={hasMoreMessages}
                                loadingMore={loadingMore}
                                onLoadMore={onLoadMoreMessages}
                                me={me}
                                canModerateMessages={canModerateMessages}
                                editingMessageId={editingMessageId}
                                editingContent={editingContent}
                                onStartEdit={(id) => {
                                    setEditingMessageId(id);
                                    setEditingContent(messages.find((message) => message.message_id === id)?.content || "");
                                }}
                                onChangeEditingContent={setEditingContent}
                                onDeleteMessage={onDeleteMessage}
                                onToggleReaction={onToggleReaction}
                                onSaveEdit={onEditMessage}
                                onCancelEdit={() => {
                                    setEditingMessageId(null);
                                    setEditingContent("");
                                }}
                                selectedChannelId={selectedChannelId}
                            />
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                )}
            </div>

            {/* === ZONE D'INPUT (BAS DE PAGE) === */}
            <div className="p-6 pt-2 shrink-0">
                {typingLabel && <div className="px-6 pb-2 text-xs text-muted font-[family-name:var(--font-nunito)]">{typingLabel}</div>}
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
                        onChange={(e) => {
                            setMessageText(e.target.value);
                            onSendTyping();
                        }}
                        onKeyDown={onMessageKeyDown}
                        disabled={!selectedServerId || !selectedChannelId || isSending}
                        placeholder={
                            selectedServerId && selectedChannel
                                ? t("messagePlaceholder", { name: selectedChannel.name })
                                : t("chooseChannelPlaceholder")
                        }
                        className="flex-1 bg-transparent text-primary placeholder-muted/50 focus:outline-none font-[family-name:var(--font-nunito)]"
                    />
                    <button
                        onClick={onSendMessage}
                        disabled={!selectedServerId || !selectedChannelId || isSending || !messageText.trim()}
                        className={[
                            "ml-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                            canSendMessage ? "bg-accent text-[#1E1211] hover:bg-white cursor-pointer" : "bg-secondary text-muted/40 cursor-not-allowed",
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
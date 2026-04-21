import { MessageList } from "@/components/chat/MessageList";
import { UserPlusIcon } from "@/components/icons";
import { Channel, Message, Server } from "@/types/chat";
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
    onEditMessage: (id: string, content: string) => void;
    onDeleteMessage: (id: string) => void;
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
    onEditMessage,
    onDeleteMessage,
    onMessageKeyDown,
    me,
    typingLabel,
    onInviteMember,
    onCreateChannel,
    onSendTyping,
}: ChannelChatPanelProps) {
    const canSendMessage = selectedServerId && selectedChannelId && messageText.trim();

    return (
        <>
            <div className="h-auto py-4 px-6 flex flex-col gap-3 border-b border-[#ffffff]/5">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h2 className="font-[family-name:var(--font-nunito)] font-bold text-xl text-white">{selectedServer ? selectedServer.name : "Chat"}</h2>
                        </div>

                        {selectedServerId && selectedChannel ? (
                            <div className="text-sm text-[#DCCBC4]/60">
                                Salon actuel: <span className="text-[#DCCBC4]/80">#{selectedChannel.name}</span>
                            </div>
                        ) : selectedServerId ? (
                            <div className="text-sm text-[#DCCBC4]/60">Aucun salon sélectionné</div>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onInviteMember}
                            disabled={!selectedServerId || !canInviteMember}
                            title={!selectedServerId ? "Sélectionne un serveur" : canInviteMember ? "Inviter un membre" : "Seuls les proprio/admins peuvent inviter"}
                            className={[
                                "px-3 py-2 rounded-xl border border-[#ffffff]/10 flex items-center gap-2 transition-colors cursor-pointer",
                                selectedServerId && canInviteMember ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white" : "bg-transparent text-[#DCCBC4]/40 cursor-not-allowed",
                            ].join(" ")}
                        >
                            <UserPlusIcon />
                            <span className="text-sm font-bold">Inviter</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-[family-name:var(--font-nunito)] relative">
                {selectedServerId && selectedChannel && (channelCreatedLabel || channelUpdatedLabel) && (
                    <div className="absolute top-4 right-14 text-right">
                        {channelCreatedLabel && <div className="text-xs text-[#DCCBC4]/60">Créé le {channelCreatedLabel}</div>}
                        {channelUpdatedLabel && <div className="text-xs text-[#DCCBC4]/40">Mis à jour le {channelUpdatedLabel}</div>}
                    </div>
                )}

                {!selectedServerId ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg">
                            <div className="text-white font-bold text-lg mb-2">Choisis un serveur</div>
                            <div className="text-sm text-[#DCCBC4]/60">
                                Sélectionne un serveur à gauche, ou crée-en un avec le bouton <span className="text-[#EB5E28] font-bold">+</span>.
                            </div>
                        </div>
                    </div>
                ) : channelsCount === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#1E1211] border border-[#ffffff]/10 flex items-center justify-center text-[#EB5E28]">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <div className="text-white font-bold text-lg">Aucun salon pour l’instant</div>
                                    <div className="text-sm text-[#DCCBC4]/60 mt-1">
                                        Crée ton premier salon pour commencer à discuter. (ex: <span className="text-[#DCCBC4]/80">général</span>)
                                    </div>
                                    <div className="mt-4 flex items-center gap-2">
                                        <button
                                            onClick={onCreateChannel}
                                            disabled={!canCreateChannel}
                                            className={[
                                                "px-4 py-2 rounded-xl font-bold transition-colors cursor-pointer",
                                                canCreateChannel ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white" : "bg-transparent border border-[#ffffff]/10 text-[#DCCBC4]/40 cursor-not-allowed",
                                            ].join(" ")}
                                            title={canCreateChannel ? "Créer un salon" : "Seuls les owners/admins peuvent créer un salon"}
                                        >
                                            Créer mon premier salon
                                        </button>
                                        {!canCreateChannel && <span className="text-xs text-[#DCCBC4]/40">Demande au(x) proprio/admin de créer un salon.</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : !selectedChannelId ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg">
                            <div className="text-white font-bold text-lg mb-2">Choisis un salon</div>
                            <div className="text-sm text-[#DCCBC4]/60">Sélectionne un salon dans la colonne de gauche.</div>
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
                                        className="text-xs px-3 py-1 rounded-full border border-[#ffffff]/10 hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                                    >
                                        {loadingMore ? "Chargement..." : "Charger plus"}
                                    </button>
                                </div>
                            )}

                            {messagesError && <div className="text-sm text-red-400 mb-3">{messagesError}</div>}

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

            <div className="p-6 pt-2 border-t border-[#ffffff]/5">
                {typingLabel && <div className="px-6 pb-2 text-xs text-[#DCCBC4]/50 font-[family-name:var(--font-nunito)]">{typingLabel}</div>}
                <div className="bg-[#1E1211] rounded-full flex items-center px-6 py-3 border border-[#ffffff]/5">
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
                                ? `Message dans #${selectedChannel.name}…`
                                : "Choisis un salon pour commencer…"
                        }
                        className="flex-1 bg-transparent text-[#DCCBC4] placeholder-[#DCCBC4]/30 focus:outline-none font-[family-name:var(--font-nunito)]"
                    />
                    <button
                        onClick={onSendMessage}
                        disabled={!selectedServerId || !selectedChannelId || isSending || !messageText.trim()}
                        className={[
                            "ml-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                            canSendMessage ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white cursor-pointer" : "bg-[#2A1A18] text-[#DCCBC4]/30 cursor-not-allowed",
                        ].join(" ")}
                        title="Envoyer"
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

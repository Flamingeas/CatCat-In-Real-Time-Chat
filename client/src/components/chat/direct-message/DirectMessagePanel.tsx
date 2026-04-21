import type { KeyboardEvent, RefObject } from "react";
import { ConversationItem, DmMessage } from "@/features/direct-message/services/dm.service";
import { getInitials, formatTimeFR } from "@/utils/chat";

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
    onMessageKeyDown,
    messagesEndRef,
}: DirectMessagePanelProps) {
    const selectedConversation = selectedConvId
        ? conversations.find((conversation) => conversation.id === selectedConvId) ?? null
        : null;

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
                    <h2 className="font-[family-name:var(--font-nunito)] font-bold text-xl text-white">Messages directs</h2>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-[family-name:var(--font-nunito)]">
                {!selectedConvId ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg">
                            <div className="text-white font-bold text-lg mb-2">Sélectionne une conversation</div>
                            <div className="text-sm text-[#DCCBC4]/60">
                                Choisis une conversation à gauche ou démarre-en une nouvelle avec le bouton <span className="text-[#EB5E28] font-bold">+</span>.
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto pr-2">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-xs text-[#DCCBC4]/50">{messagesLoading ? "Chargement..." : `${messages.length} message(s)`}</div>
                                {hasMore && messages.length > 0 && (
                                    <button
                                        onClick={onLoadMore}
                                        disabled={loadingMore}
                                        className="text-xs px-3 py-1 rounded-full border border-[#ffffff]/10 hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                                    >
                                        {loadingMore ? "Chargement..." : "Charger plus"}
                                    </button>
                                )}
                            </div>

                            {messagesLoading ? (
                                <div className="text-sm text-[#DCCBC4]/50">Chargement des messages...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-sm text-[#DCCBC4]/50">Aucun message pour l&apos;instant.</div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {messages.map((message) => {
                                        const isMe = me && String(me.id) === String(message.sender_id);
                                        const time = formatTimeFR(message.created_at);
                                        const isEditing = editingMessageId === message.message_id;

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
                                                            {message.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">• édité</span>}
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
                                                                    Sauvegarder
                                                                </button>
                                                                <button
                                                                    onClick={onCancelEdit}
                                                                    className="px-3 py-1 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] text-xs hover:bg-[#1E1211] transition-colors"
                                                                >
                                                                    Annuler
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={[
                                                                "px-4 py-3 rounded-2xl border border-[#ffffff]/10 shadow-sm",
                                                                "whitespace-pre-wrap break-words text-sm leading-relaxed",
                                                                isMe ? "bg-[#2563EB] text-white rounded-br-md" : "bg-[#1E1211] text-[#DCCBC4] rounded-bl-md",
                                                            ].join(" ")}
                                                        >
                                                            {message.is_deleted ? <span className="text-white/60 italic">message supprimé</span> : message.content}
                                                        </div>
                                                    )}

                                                    <div className={`flex items-center gap-2 mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                                        {time && <span className={`text-[10px] ${isMe ? "text-white/70" : "text-[#DCCBC4]/40"}`}>{time}</span>}
                                                        {message.is_edited && <span className={`text-[10px] ${isMe ? "text-white/70" : "text-[#DCCBC4]/40"}`}>• édité</span>}

                                                        {isMe && !message.is_deleted && !isEditing && (
                                                            <button
                                                                onClick={() => onStartEdit(message.message_id, message.content)}
                                                                className="text-[10px] text-white/70 hover:text-[#EB5E28] cursor-pointer"
                                                                title="Éditer"
                                                            >
                                                                ✏️ Éditer
                                                            </button>
                                                        )}
                                                        {isMe && !message.is_deleted && (
                                                            <button
                                                                onClick={() => onDeleteMessage(message.message_id)}
                                                                className="text-[10px] text-white/70 hover:text-red-200 cursor-pointer"
                                                                title="Supprimer"
                                                            >
                                                                🗑 Supprimer
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
                <div className="bg-[#1E1211] rounded-full flex items-center px-6 py-3 border border-[#ffffff]/5">
                    <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={onMessageKeyDown}
                        disabled={!selectedConvId || isSending}
                        placeholder={selectedConvId ? "Envoyer un message…" : "Sélectionne une conversation…"}
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

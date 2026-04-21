import { Message } from "@/types/chat";
import { getInitials, formatTimeFR } from "@/utils/chat";

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
    onSaveEdit,
    onCancelEdit,
    selectedChannelId,
}: MessageListProps) {
    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-[#DCCBC4]/50">{messagesLoading ? "Chargement..." : `${messages.length} message(s)`}</div>

                    {hasMoreMessages && messages.length > 0 && (
                        <button
                            onClick={onLoadMore}
                            disabled={loadingMore}
                            className="text-xs px-3 py-1 rounded-full border border-[#ffffff]/10 hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                        >
                            {loadingMore ? "Chargement..." : "Charger plus"}
                        </button>
                    )}
                </div>

                {messagesError && <div className="text-sm text-red-400 mb-3">{messagesError}</div>}

                {!selectedChannelId ? (
                    <div className="text-sm text-[#DCCBC4]/50">Choisis un salon.</div>
                ) : messagesLoading ? (
                    <div className="text-sm text-[#DCCBC4]/50">Chargement des messages...</div>
                ) : messages.length === 0 ? (
                    <div className="text-sm text-[#DCCBC4]/50">Aucun message pour l’instant.</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {messages.map((m) => {
                            const isMe = me && String(me.id) === String(m.user_id);
                            const time = formatTimeFR(m.created_at);
                            const canDeleteThis = !m.is_deleted && (isMe || canModerateMessages);
                            const canEditThis = isMe && !m.is_deleted;
                            const isEditing = editingMessageId === m.message_id;

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
                                                {m.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">• édité</span>}

                                                {canDeleteThis && (
                                                    <button
                                                        onClick={() => {
                                                            if (!window.confirm("Supprimer ce message ?")) return;
                                                            onDeleteMessage(String(m.message_id));
                                                        }}
                                                        className="ml-auto text-[10px] text-[#DCCBC4]/60 hover:text-red-200 cursor-pointer"
                                                        title="Supprimer"
                                                    >
                                                        🗑 Supprimer
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
                                                className={`px-4 py-3 rounded-2xl ${
                                                    isMe
                                                        ? "bg-[#EB5E28] text-white"
                                                        : "bg-[#1E1211] border border-[#ffffff]/5 text-[#DCCBC4]"
                                                }`}
                                            >
                                                {m.is_deleted ? (
                                                    <span className="text-[#DCCBC4]/50 italic">Message supprimé</span>
                                                ) : (
                                                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                                                )}
                                            </div>
                                        )}

                                        {isMe && time && (
                                            <div className="flex items-center gap-2 mt-1 px-1">
                                                {time && <span className="text-[10px] text-[#DCCBC4]/40">{time}</span>}
                                                {m.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">• édité</span>}
                                                {canEditThis && (
                                                    <button
                                                        onClick={() => onStartEdit(m.message_id)}
                                                        className="text-[10px] text-[#DCCBC4]/60 hover:text-white cursor-pointer"
                                                        title="Éditer"
                                                    >
                                                        ✏️ Éditer
                                                    </button>
                                                )}
                                                {canDeleteThis && (
                                                    <button
                                                        onClick={() => {
                                                            if (!window.confirm("Supprimer ce message ?")) return;
                                                            onDeleteMessage(String(m.message_id));
                                                        }}
                                                        className="ml-auto text-[10px] text-[#DCCBC4]/60 hover:text-red-200 cursor-pointer"
                                                        title="Supprimer"
                                                    >
                                                        🗑 Supprimer
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

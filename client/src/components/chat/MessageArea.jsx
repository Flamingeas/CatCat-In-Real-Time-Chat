import { useState } from "react";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Grid } from '@giphy/react-components';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { UserPlus, PanelLeftOpen, PanelRightOpen, SendHorizontal, Trash2, Heart, SmilePlus, MessageCircle, Pencil } from "lucide-react";

const gf = new GiphyFetch('ENOkgZEpFQKApnReETozPZEGXXeJUQ4l');

function getInitials(username) {
    if (!username || username.length < 1) return "??";
    return `${username[0].toUpperCase()}${username[username.length - 1].toUpperCase()}`;
}

function formatTimeFR(input) {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return input;
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

const QUICK_EMOJIS = ["❤️", "😂", "👍", "🔥", "👀"];

export function MessageArea({
    me,
    selectedServerId,
    selectedServer,
    selectedChannelId,
    selectedChannel,
    messages,
    messagesLoading,
    messagesError,
    hasMoreMessages,
    loadingMore,
    onLoadMore,
    messagesEndRef,
    messagesBoxRef,
    messageText,
    setMessageText,
    isSending,
    onSendMessage,
    onSendGif,
    onSendTyping,
    typingLabel,
    canModerateMessages,
    onDeleteMessage,
    
    // Props d'édition
    editingMessageId,
    setEditingMessageId,
    editingContent,
    setEditingContent,
    onEditMessage,

    onToggleReaction,
    canInviteMember,
    onOpenInvite,
    isSidebarOpen,
    onToggleSidebar,
    isMemberAreaOpen,
    onToggleMemberArea
}) {
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [gifSearch, setGifSearch] = useState("");
    const [activePickerId, setActivePickerId] = useState(null);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [showQuickReactions, setShowQuickReactions] = useState(null);

    const fetchDynamicGifs = async (offset) => {
        if (gifSearch.trim() !== "") {
            return await gf.search(gifSearch, { offset, limit: 21 });
        }
        return await gf.trending({ offset, limit: 21 });
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!isSending) onSendMessage();
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-[#0F0908] rounded-[20px] relative h-full shadow-lg overflow-hidden">
            <div className="h-auto py-4 px-6 flex flex-col gap-3 border-b border-[#ffffff]/5">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            {!isSidebarOpen && (
                                <button 
                                    onClick={onToggleSidebar} 
                                    title="Afficher les salons" 
                                    className="hidden md:flex p-2 -ml-2 rounded-xl hover:bg-[#1E1211] transition-colors text-[#DCCBC4]/70 hover:text-white cursor-pointer"
                                >
                                    <PanelLeftOpen className="w-5 h-5" />
                                </button>
                            )}
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
                            onClick={onOpenInvite}
                            disabled={!selectedServerId || !canInviteMember}
                            className={[
                                "px-3 py-2 rounded-xl border border-[#ffffff]/10 flex items-center gap-2 transition-colors cursor-pointer",
                                selectedServerId && canInviteMember ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white" : "bg-transparent text-[#DCCBC4]/40 cursor-not-allowed",
                            ].join(" ")}
                        >
                            <UserPlus className="w-5 h-5" />
                            <span className="text-sm font-bold hidden md:block">Inviter</span>
                        </button>

                        {!isMemberAreaOpen && (
                            <button 
                                onClick={onToggleMemberArea} 
                                className="hidden md:flex p-2 ml-1 rounded-xl hover:bg-[#1E1211] transition-colors text-[#DCCBC4]/70 hover:text-white cursor-pointer"
                            >
                                <PanelRightOpen className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-[family-name:var(--font-nunito)] relative">
                {!selectedServerId ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg text-center">
                            <div className="text-white font-bold text-lg mb-2">Choisis un serveur</div>
                            <div className="text-sm text-[#DCCBC4]/60">Sélectionne un serveur à gauche, ou crée-en un.</div>
                        </div>
                    </div>
                ) : !selectedChannelId ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg text-center">
                            <div className="text-white font-bold text-lg mb-2">Choisis un salon</div>
                            <div className="text-sm text-[#DCCBC4]/60">Sélectionne un salon dans la colonne de gauche.</div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        <div 
                            className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#EB5E28]/40 hover:[&::-webkit-scrollbar-thumb]:bg-[#EB5E28] [&::-webkit-scrollbar-thumb]:rounded-full pb-8" 
                            style={{ scrollbarWidth: 'thin', scrollbarColor: '#EB5E2866 transparent' }}
                            ref={messagesBoxRef}
                        >
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

                            {messagesLoading ? (
                                <div className="text-sm text-[#DCCBC4]/50 text-center py-4">Chargement des messages...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-sm text-[#DCCBC4]/50 text-center py-4 flex flex-col items-center gap-2">
                                    <MessageCircle className="w-8 h-8 opacity-20" />
                                    Aucun message pour l’instant. Soyez le premier !
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6">
                                    {messages.map((m) => {
                                        const isMe = me && String(me.id) === String(m.user_id);
                                        const time = formatTimeFR(m.created_at);
                                        const canDeleteThis = !m.is_deleted && (isMe || canModerateMessages);
                                        const canEditThis = isMe && !m.is_deleted && !m.content.includes("giphy.com/media"); // On n'édite pas les GIFs
                                        const isHovered = hoveredMessageId === m.message_id;
                                        const isEditing = editingMessageId === m.message_id;

                                        return (
                                            <div 
                                                key={m.message_id} 
                                                className={`flex relative group ${isMe ? "justify-end" : "justify-start"} ${isHovered ? "z-50" : "z-10"}`}
                                                onMouseEnter={() => setHoveredMessageId(m.message_id)}
                                                onMouseLeave={() => { setHoveredMessageId(null); setShowQuickReactions(null); }}
                                            >
                                                {!isMe && (
                                                    <div className="mr-3 mt-1 shrink-0">
                                                        <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4]">
                                                            {getInitials(m.username)}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                                    
                                                    {!isMe && (
                                                        <div className="flex items-center gap-2 mb-1 px-1">
                                                            <span className="text-xs font-bold text-[#EB5E28]">@{m.username}</span>
                                                            {time && <span className="text-[10px] text-[#DCCBC4]/40">{time}</span>}
                                                        </div>
                                                    )}

                                                    <div className={`relative flex flex-col w-fit max-w-full ${isMe ? "items-end" : "items-start"}`}>
                                                        
                                                        {isEditing ? (
                                                            // --- MODE ÉDITION ---
                                                            <div className="w-full min-w-[250px] mb-1">
                                                                <textarea
                                                                    value={editingContent}
                                                                    onChange={(e) => setEditingContent(e.target.value)}
                                                                    className="w-full px-4 py-3 rounded-[20px] rounded-br-[6px] border border-[#EB5E28] bg-[#1E1211] text-[#DCCBC4] focus:outline-none resize-none"
                                                                    rows={3}
                                                                    autoFocus
                                                                />
                                                                <div className="flex gap-2 mt-2 justify-end">
                                                                    <button onClick={() => { setEditingMessageId(null); setEditingContent(""); }} className="px-3 py-1.5 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] text-xs hover:bg-[#1E1211] transition-colors cursor-pointer">
                                                                        Annuler
                                                                    </button>
                                                                    <button onClick={() => onEditMessage(m.message_id, editingContent)} className="px-3 py-1.5 rounded-xl bg-[#EB5E28] text-white text-xs font-bold hover:bg-white hover:text-[#1E1211] transition-colors cursor-pointer">
                                                                        Sauvegarder
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            // --- MODE LECTURE NORMALE ---
                                                            <div className={[
                                                                    "px-4 py-3 rounded-[20px] border border-[#ffffff]/10 shadow-sm whitespace-pre-wrap break-words text-sm leading-relaxed",
                                                                    isMe ? "bg-[#EB5E28] text-[#1E1211] rounded-br-[6px] border-transparent" : "bg-[#1E1211] text-[#DCCBC4] rounded-bl-[6px]",
                                                                    m.is_deleted ? "opacity-50" : ""
                                                                ].join(" ")}
                                                            >
                                                                {m.is_deleted ? (
                                                                    <span className="italic">Ce message a été supprimé.</span>
                                                                ) : m.content.includes("giphy.com/media") ? (
                                                                    <img src={m.content} alt="GIF" className="rounded-lg max-w-[250px] object-cover" />
                                                                ) : (
                                                                    m.content
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* BARRE D'ACTIONS AU SURVOL (Placée en dessous de la bulle, avant les réactions) */}
                                                        {!m.is_deleted && !isEditing && isHovered && (
                                                            <div className={`absolute top-full mt-1.5 ${isMe ? "right-0" : "left-0"} z-50 flex`}>
                                                                <div className="bg-[#0F0908] border border-[#ffffff]/10 shadow-[0_4px_15px_rgba(0,0,0,0.5)] rounded-[14px] flex items-center overflow-hidden h-9">
                                                                    
                                                                    {/* Quick Reactions */}
                                                                    {showQuickReactions === m.message_id && (
                                                                        <div className="flex items-center px-1 border-r border-[#ffffff]/10 bg-[#1E1211] h-full">
                                                                            {QUICK_EMOJIS.map(emoji => (
                                                                                <button 
                                                                                    key={emoji} 
                                                                                    onClick={() => {
                                                                                        const hasReacted = m.reactions?.find(r => r.emoji === emoji)?.users.includes(me?.id);
                                                                                        onToggleReaction(m.message_id, emoji, !!hasReacted);
                                                                                        setShowQuickReactions(null);
                                                                                    }}
                                                                                    className="hover:scale-125 transition-transform px-1.5 cursor-pointer"
                                                                                >
                                                                                    {emoji}
                                                                                </button>
                                                                            ))}
                                                                            <button 
                                                                                onClick={() => setActivePickerId(m.message_id)} 
                                                                                className="hover:bg-[#ffffff]/10 rounded p-1 mx-1 text-[#DCCBC4]/70 hover:text-white cursor-pointer"
                                                                            >
                                                                                <SmilePlus className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    <button 
                                                                        onMouseEnter={() => setShowQuickReactions(m.message_id)}
                                                                        className="px-3 h-full flex items-center justify-center text-[#DCCBC4]/70 hover:bg-[#ffffff]/10 hover:text-[#EB5E28] transition-colors cursor-pointer"
                                                                        title="Réagir"
                                                                    >
                                                                        <Heart className="w-4 h-4" />
                                                                    </button>

                                                                    {canEditThis && <div className="w-[1px] h-4 bg-[#ffffff]/10" />}

                                                                    {canEditThis && (
                                                                        <button 
                                                                            onClick={() => {
                                                                                setEditingMessageId(m.message_id);
                                                                                setEditingContent(m.content);
                                                                                setHoveredMessageId(null); // On cache la barre quand on édite
                                                                            }}
                                                                            className="px-3 h-full flex items-center justify-center text-[#DCCBC4]/70 hover:bg-[#ffffff]/10 hover:text-blue-400 transition-colors cursor-pointer"
                                                                            title="Modifier le message"
                                                                        >
                                                                            <Pencil className="w-4 h-4" />
                                                                        </button>
                                                                    )}

                                                                    {canDeleteThis && <div className="w-[1px] h-4 bg-[#ffffff]/10" />}

                                                                    {canDeleteThis && (
                                                                        <button 
                                                                            onClick={() => onDeleteMessage(m.message_id)}
                                                                            className="px-3 h-full flex items-center justify-center text-[#DCCBC4]/70 hover:bg-[#ffffff]/10 hover:text-red-400 transition-colors cursor-pointer"
                                                                            title="Supprimer le message"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* RÉACTIONS ENREGISTRÉES */}
                                                    {/* On rajoute un margin-top plus grand (mt-3 ou mt-10 au hover) pour laisser la place à la barre d'action */}
                                                    {m.reactions && m.reactions.length > 0 && (
                                                        <div className={`flex flex-wrap gap-1 transition-all duration-200 ${isHovered && !m.is_deleted && !isEditing ? "mt-12" : "mt-1.5"} ${isMe ? "justify-end" : "justify-start"}`}>
                                                            {m.reactions.map((r) => {
                                                                const hasReacted = me ? r.users.includes(me.id) : false;
                                                                return (
                                                                    <button
                                                                        key={r.emoji}
                                                                        onClick={() => onToggleReaction(m.message_id, r.emoji, hasReacted)}
                                                                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                                                                            hasReacted ? "bg-[#EB5E28]/20 border-[#EB5E28] text-[#EB5E28]" : "bg-[#0F0908] border-[#ffffff]/10 text-[#DCCBC4]/70 hover:border-[#ffffff]/30"
                                                                        }`}
                                                                    >
                                                                        <span>{r.emoji}</span><span className="font-bold">{r.users.length}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    <div className={`flex items-center gap-2 mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                                        {isMe && time && <span className="text-[10px] text-[#DCCBC4]/40">{time}</span>}
                                                        {m.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">• édité</span>}
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
                {typingLabel && <div className="px-6 pb-2 text-xs text-[#DCCBC4]/50 font-[family-name:var(--font-nunito)]">{typingLabel}</div>}
                <div className="relative bg-[#1E1211] rounded-2xl flex items-center px-4 py-2 border border-[#ffffff]/5 shadow-inner">
                    <button 
                        onClick={() => setShowGifPicker(!showGifPicker)}
                        className="mr-3 bg-[#ffffff]/5 hover:bg-[#ffffff]/10 px-3 py-1.5 rounded-xl text-[#DCCBC4]/70 hover:text-[#EB5E28] font-bold text-xs transition-colors cursor-pointer"
                    >GIF</button>

                    {showGifPicker && (
                        <div className="absolute bottom-full left-0 mb-4 z-[9999] bg-[#0F0908] rounded-2xl border border-[#ffffff]/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] w-[320px] flex flex-col overflow-hidden">
                            <div className="p-3 border-b border-[#ffffff]/5 bg-[#1E1211]/50">
                                <input type="text" placeholder="Rechercher un GIF..." value={gifSearch} onChange={(e) => setGifSearch(e.target.value)} className="w-full bg-[#0a0605] text-sm text-[#DCCBC4] rounded-xl px-4 py-2.5 border border-[#ffffff]/5 focus:outline-none focus:border-[#EB5E28] transition-colors" />
                            </div>
                            <div className="flex gap-2 p-3 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                                {['Tendances', 'Réactions', 'Mèmes', 'Anime'].map(cat => (
                                    <button key={cat} onClick={() => setGifSearch(cat === 'Tendances' ? '' : cat)} className={`text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${(cat === 'Tendances' && gifSearch === '') || gifSearch === cat ? 'bg-[#EB5E28] text-[#1E1211]' : 'bg-[#1E1211] border border-[#ffffff]/5 hover:bg-[#ffffff]/10 text-[#DCCBC4]/70 hover:text-white'}`}>{cat}</button>
                                ))}
                            </div>
                            <div className="h-[280px] overflow-y-auto p-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                                {/* @ts-ignore */}
                                <Grid key={gifSearch} width={300} columns={3} gutter={6} borderRadius={8} fetchGifs={fetchDynamicGifs} noResultsMessage={<div className="text-center text-sm text-[#DCCBC4]/50 mt-8">Aucun GIF trouvé 😿</div>}
                                    onGifClick={(gif, e) => {
                                        e.preventDefault();
                                        setShowGifPicker(false);
                                        setGifSearch("");
                                        onSendGif(gif.images.original.url);
                                    }} 
                                />
                            </div>
                        </div>
                    )}
                    
                    <input
                        type="text" value={messageText} onChange={(e) => { setMessageText(e.target.value); onSendTyping(); }} onKeyDown={handleKeyDown} disabled={!selectedServerId || !selectedChannelId || isSending}
                        placeholder={selectedServerId && selectedChannel ? `Message dans #${selectedChannel.name}…` : "Choisis un salon pour commencer…"}
                        className="flex-1 bg-transparent text-[#DCCBC4] placeholder-[#DCCBC4]/30 focus:outline-none font-[family-name:var(--font-nunito)] py-2"
                    />
                    
                    <button onClick={onSendMessage} disabled={!selectedServerId || !selectedChannelId || isSending || !messageText.trim()} className={["ml-3 w-10 h-10 rounded-xl flex items-center justify-center transition-all", selectedServerId && selectedChannelId && messageText.trim() ? "bg-[#EB5E28] text-[#1E1211] hover:scale-105 shadow-[0_0_15px_rgba(235,94,40,0.3)] cursor-pointer" : "bg-[#2A1A18] text-[#DCCBC4]/30 cursor-not-allowed"].join(" ")} title="Envoyer">
                        <SendHorizontal className="h-5 ml-0.5" />
                    </button>
                </div>
            </div>
            
            {activePickerId && (
                <div className="absolute bottom-24 right-8 z-[9999] shadow-[0_0_40px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden border border-[#ffffff]/10">
                    <EmojiPicker theme={Theme.DARK} onEmojiClick={(emojiData) => {
                        const msg = messages.find(m => m.message_id === activePickerId);
                        if (!msg) return;
                        const hasReacted = msg.reactions?.find(r => r.emoji === emojiData.emoji)?.users.includes(me?.id || "");
                        onToggleReaction(activePickerId, emojiData.emoji, !!hasReacted);
                        setActivePickerId(null);
                    }} />
                </div>
            )}
        </div>
    );
}
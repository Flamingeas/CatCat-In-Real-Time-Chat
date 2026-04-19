import { useState } from "react";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Grid } from '@giphy/react-components';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { UserPlus, PanelLeftOpen, PanelRightOpen, Send, SmilePlus, Trash2 } from "lucide-react";

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
    onToggleReaction,
    canInviteMember,
    onOpenInvite,
    isSidebarOpen,
    onToggleSidebar,
    isMemberAreaOpen,      // <-- NOUVELLE PROP
    onToggleMemberArea     // <-- NOUVELLE PROP
}) {
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [gifSearch, setGifSearch] = useState("");
    const [activePickerId, setActivePickerId] = useState(null);

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
                            {/* BOUTON POUR ROUVRIR LE VOLET GAUCHE (SALONS) */}
                            {!isSidebarOpen && (
                                <button 
                                    onClick={onToggleSidebar} 
                                    title="Afficher les salons" 
                                    className="p-2 -ml-2 rounded-xl hover:bg-[#1E1211] transition-colors text-[#DCCBC4]/70 hover:text-white cursor-pointer"
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
                            title={!selectedServerId ? "Sélectionne un serveur" : canInviteMember ? "Inviter un membre" : "Seuls les proprio/admins peuvent inviter"}
                            className={[
                                "px-3 py-2 rounded-xl border border-[#ffffff]/10 flex items-center gap-2 transition-colors cursor-pointer",
                                selectedServerId && canInviteMember ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white" : "bg-transparent text-[#DCCBC4]/40 cursor-not-allowed",
                            ].join(" ")}
                        >
                            <UserPlus className="w-5 h-5" />
                            <span className="text-sm font-bold">Inviter</span>
                        </button>

                        {/* BOUTON POUR ROUVRIR LE VOLET DROIT (MEMBRES) */}
                        {!isMemberAreaOpen && (
                            <button 
                                onClick={onToggleMemberArea} 
                                title="Afficher les membres" 
                                className="p-2 ml-1 rounded-xl hover:bg-[#1E1211] transition-colors text-[#DCCBC4]/70 hover:text-white cursor-pointer"
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
                        <div className="max-w-xl w-full rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-6 shadow-lg">
                            <div className="text-white font-bold text-lg mb-2">Choisis un serveur</div>
                            <div className="text-sm text-[#DCCBC4]/60">Sélectionne un serveur à gauche, ou crée-en un.</div>
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
                        <div 
                            className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#EB5E28]/40 hover:[&::-webkit-scrollbar-thumb]:bg-[#EB5E28] [&::-webkit-scrollbar-thumb]:rounded-full" 
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
                            {messagesError && <div className="text-sm text-red-400 mb-3">{messagesError}</div>}
                            {messagesLoading ? (
                                <div className="text-sm text-[#DCCBC4]/50">Chargement des messages...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-sm text-[#DCCBC4]/50">Aucun message pour l’instant.</div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {messages.map((m) => {
                                        const isMe = me && String(me.id) === String(m.user_id);
                                        const time = formatTimeFR(m.created_at);
                                        const canDeleteThis = !m.is_deleted && (isMe || canModerateMessages);

                                        return (
                                            <div key={m.message_id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                {!isMe && (
                                                    <div className="mr-3 mt-1 shrink-0">
                                                        <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4]">
                                                            {getInitials(m.username)}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className={`min-w-0 max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col group`}>
                                                    {!isMe && (
                                                        <div className="flex items-center gap-2 mb-1 px-1">
                                                            <span className="text-xs font-bold text-[#EB5E28]">@{m.username}</span>
                                                            {time && <span className="text-[10px] text-[#DCCBC4]/40">{time}</span>}
                                                        </div>
                                                    )}
                                                    <div className={[
                                                            "px-4 py-3 rounded-2xl border border-[#ffffff]/10 shadow-sm whitespace-pre-wrap break-words text-sm leading-relaxed",
                                                            isMe ? "bg-[#2563EB] text-white rounded-br-md" : "bg-[#1E1211] text-[#DCCBC4] rounded-bl-md",
                                                        ].join(" ")}
                                                    >
                                                        {m.is_deleted ? (
                                                            <span className="text-white/60 italic">message supprimé</span>
                                                        ) : m.content.includes("giphy.com/media") ? (
                                                            <img src={m.content} alt="GIF" className="rounded-lg max-w-[250px] object-cover" />
                                                        ) : (
                                                            m.content
                                                        )}
                                                    </div>

                                                    {m.reactions && m.reactions.length > 0 && (
                                                        <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
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
                                                        {isMe && <span className="text-[10px] text-white/70">moi</span>}
                                                        {isMe && time && <span className="text-[10px] text-white/40">{time}</span>}
                                                        {m.is_edited && <span className="text-[10px] text-[#DCCBC4]/40">• édité</span>}
                                                        <div className={`flex items-center gap-2 transition-opacity ${activePickerId === m.message_id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                                            <div className="relative">
                                                                <button 
                                                                    onClick={() => setActivePickerId(prev => prev === m.message_id ? null : m.message_id)}
                                                                    className="text-[#DCCBC4]/40 hover:text-[#EB5E28] cursor-pointer"
                                                                >
                                                                    <SmilePlus className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            {canDeleteThis && (
                                                                <button onClick={() => onDeleteMessage(m.message_id)} className="text-[#DCCBC4]/40 hover:text-red-300 cursor-pointer ml-1">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
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
                <div className="relative bg-[#1E1211] rounded-full flex items-center px-6 py-3 border border-[#ffffff]/5">
                    <button 
                        onClick={() => setShowGifPicker(!showGifPicker)}
                        className="mr-3 text-[#DCCBC4]/50 hover:text-[#EB5E28] font-bold text-sm transition-colors cursor-pointer"
                    >GIF</button>

                    {showGifPicker && (
                        <div className="absolute bottom-full left-0 mb-4 z-[9999] bg-[#0F0908] rounded-xl border border-[#ffffff]/10 shadow-2xl w-[320px] flex flex-col overflow-hidden">
                            <div className="p-2 border-b border-[#ffffff]/5">
                                <input type="text" placeholder="Rechercher un GIF..." value={gifSearch} onChange={(e) => setGifSearch(e.target.value)} className="w-full bg-[#1E1211] text-sm text-[#DCCBC4] rounded-lg px-3 py-2 border border-[#ffffff]/5 focus:outline-none focus:border-[#EB5E28] transition-colors" />
                            </div>
                            <div className="flex gap-2 p-2 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                                {['Tendances', 'Réactions', 'Mèmes', 'Anime', 'Fail'].map(cat => (
                                    <button key={cat} onClick={() => setGifSearch(cat === 'Tendances' ? '' : cat)} className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border border-[#ffffff]/5 cursor-pointer ${(cat === 'Tendances' && gifSearch === '') || gifSearch === cat ? 'bg-[#EB5E28] text-[#1E1211]' : 'bg-[#1E1211] hover:bg-[#ffffff]/10 text-[#DCCBC4]/70 hover:text-white'}`}>{cat}</button>
                                ))}
                            </div>
                            <div className="h-[280px] overflow-y-auto p-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                                {/* @ts-ignore */}
                                <Grid key={gifSearch} width={300} columns={3} gutter={4} borderRadius={6} fetchGifs={fetchDynamicGifs} noResultsMessage={<div className="text-center text-sm text-[#DCCBC4]/50 mt-4">Aucun GIF trouvé 😿</div>}
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
                        className="flex-1 bg-transparent text-[#DCCBC4] placeholder-[#DCCBC4]/30 focus:outline-none font-[family-name:var(--font-nunito)]"
                    />
                    <button onClick={onSendMessage} disabled={!selectedServerId || !selectedChannelId || isSending || !messageText.trim()} className={["ml-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors", selectedServerId && selectedChannelId && messageText.trim() ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white cursor-pointer" : "bg-[#2A1A18] text-[#DCCBC4]/30 cursor-not-allowed"].join(" ")} title="Envoyer">
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
            {activePickerId && (
                <div className="absolute bottom-24 right-8 z-[9999] shadow-2xl rounded-xl overflow-hidden border border-[#ffffff]/10">
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
import { useState } from "react";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Grid } from '@giphy/react-components';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { 
    UserPlus, PanelLeftOpen, PanelRightOpen, SendHorizontal, Trash2, 
    Heart, SmilePlus, MessageCircle, Pencil, X, Reply 
} from "lucide-react";

const gf = new GiphyFetch('ENOkgZEpFQKApnReETozPZEGXXeJUQ4l');

// 👇 NOUVEAU : La fonction super-robuste pour détecter images & GIFs
function isGifMessage(content) {
    if (!content) return false;
    return content.includes("tenor.com") || 
           content.includes("giphy.com") || 
           content.match(/\.(gif|jpeg|jpg|png)$/i);
}

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
    members,
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
    const [reactionDetails, setReactionDetails] = useState(null); 
    const [replyingTo, setReplyingTo] = useState(null);

    const fetchDynamicGifs = async (offset) => {
        if (gifSearch.trim() !== "") return await gf.search(gifSearch, { offset, limit: 21 });
        return await gf.trending({ offset, limit: 21 });
    };

    const handleSendMessage = () => {
        if (!isSending && messageText.trim()) {
            onSendMessage(replyingTo?.message_id);
            setReplyingTo(null);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const getUsernameById = (id) => {
        const member = members?.find(m => String(m.user_id) === String(id));
        return member ? member.username : "Utilisateur inconnu";
    };

    const getRepliedMessage = (replyId) => {
        return messages.find(m => String(m.message_id) === String(replyId));
    };

    return (
        <div className="flex-1 flex flex-col bg-[#0F0908] rounded-[20px] relative h-full shadow-lg overflow-hidden">
            {/* --- HEADER --- */}
            <div className="h-auto py-4 px-6 flex flex-col gap-3 border-b border-[#ffffff]/5">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            {!isSidebarOpen && (
                                <button onClick={onToggleSidebar} className="hidden md:flex p-2 -ml-2 rounded-xl hover:bg-[#1E1211] text-[#DCCBC4]/70 hover:text-white cursor-pointer">
                                    <PanelLeftOpen className="w-5 h-5" />
                                </button>
                            )}
                            <h2 className="font-[family-name:var(--font-nunito)] font-bold text-xl text-white">{selectedServer ? selectedServer.name : "Chat"}</h2>
                        </div>
                        {selectedServerId && selectedChannel && (
                            <div className="text-sm text-[#DCCBC4]/60">Salon: <span className="text-[#DCCBC4]/80">#{selectedChannel.name}</span></div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onOpenInvite} disabled={!selectedServerId || !canInviteMember} className={`px-3 py-2 rounded-xl border border-[#ffffff]/10 flex items-center gap-2 transition-colors cursor-pointer ${selectedServerId && canInviteMember ? "bg-[#EB5E28] text-[#1E1211] hover:bg-white" : "bg-transparent text-[#DCCBC4]/40 cursor-not-allowed"}`}>
                            <UserPlus className="w-5 h-5" />
                            <span className="text-sm font-bold hidden md:block">Inviter</span>
                        </button>
                        {!isMemberAreaOpen && (
                            <button onClick={onToggleMemberArea} className="hidden md:flex p-2 ml-1 rounded-xl hover:bg-[#1E1211] text-[#DCCBC4]/70 hover:text-white cursor-pointer">
                                <PanelRightOpen className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* --- ZONE MESSAGES --- */}
            <div className="flex-1 overflow-y-auto p-6 font-[family-name:var(--font-nunito)] relative">
                {(!selectedServerId || !selectedChannelId) ? (
                    <div className="h-full flex items-center justify-center text-[#DCCBC4]/50">Choisis un salon pour commencer</div>
                ) : (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#EB5E28]/40 hover:[&::-webkit-scrollbar-thumb]:bg-[#EB5E28] [&::-webkit-scrollbar-thumb]:rounded-full pb-8" style={{ scrollbarWidth: 'thin', scrollbarColor: '#EB5E2866 transparent' }} ref={messagesBoxRef}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-xs text-[#DCCBC4]/50">{messagesLoading ? "Chargement..." : `${messages.length} message(s)`}</div>
                                {hasMoreMessages && messages.length > 0 && (
                                    <button onClick={onLoadMore} disabled={loadingMore} className="text-xs px-3 py-1 rounded-full border border-[#ffffff]/10 hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer">
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
                                <div className="flex flex-col gap-6 mt-4">
                                    {messages.map((m) => {
                                        const isMe = me && String(me.id) === String(m.user_id);
                                        const time = formatTimeFR(m.created_at);
                                        const canDeleteThis = !m.is_deleted && (isMe || canModerateMessages);
                                        // On empêche l'édition si c'est un GIF !
                                        const canEditThis = isMe && !m.is_deleted && !isGifMessage(m.content);
                                        const isHovered = hoveredMessageId === m.message_id;
                                        const isEditing = editingMessageId === m.message_id;
                                        
                                        const repliedMessage = m.reply_to_message_id ? getRepliedMessage(m.reply_to_message_id) : null;

                                        return (
                                            <div 
                                                key={m.message_id} 
                                                id={`msg-${m.message_id}`}
                                                className={`flex flex-col relative group transition-all duration-500 ${isMe ? "items-end" : "items-start"} ${isHovered ? "z-50" : "z-10"}`}
                                                onMouseEnter={() => setHoveredMessageId(m.message_id)}
                                                onMouseLeave={() => { setHoveredMessageId(null); setShowQuickReactions(null); }}>
                                                
                                                <div className={`flex ${isMe ? "flex-row-reverse" : "flex-row"} max-w-[85%] relative`}>
                                                    {!isMe && (
                                                        <div className="mr-3 mt-1 shrink-0">
                                                            <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4]">{getInitials(m.username)}</div>
                                                        </div>
                                                    )}
                                                    
                                                    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} min-w-0`}>
                                                        {!isMe && <div className="text-xs font-bold text-[#EB5E28] mb-1 px-1">@{m.username}</div>}

                                                        <div className={`relative flex flex-col w-fit max-w-full ${isMe ? "items-end" : "items-start"}`}>
                                                            {isEditing ? (
                                                                <div className="w-full min-w-[250px] mb-1">
                                                                    <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="w-full px-4 py-3 rounded-[20px] rounded-br-[6px] border border-[#EB5E28] bg-[#1E1211] text-[#DCCBC4] focus:outline-none resize-none" rows={3} autoFocus />
                                                                    <div className="flex gap-2 mt-2 justify-end">
                                                                        <button onClick={() => { setEditingMessageId(null); setEditingContent(""); }} className="text-xs text-[#DCCBC4] hover:underline cursor-pointer">Annuler</button>
                                                                        <button onClick={() => onEditMessage(m.message_id, editingContent)} className="px-3 py-1.5 rounded-xl bg-[#EB5E28] text-white text-xs font-bold cursor-pointer">Sauvegarder</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className={[
                                                                        "px-3 py-2 md:px-4 md:py-3 flex flex-col gap-1.5 rounded-[20px] border border-[#ffffff]/10 shadow-sm text-sm leading-relaxed",
                                                                        isMe ? "bg-[#EB5E28] text-[#1E1211] rounded-br-[6px] border-transparent" : "bg-[#1E1211] text-[#DCCBC4] rounded-bl-[6px]",
                                                                        m.is_deleted ? "opacity-50" : ""
                                                                    ].join(" ")}
                                                                >
                                                                    {/* --- ENCART WHATSAPP STYLE (DANS LA BULLE) --- */}
                                                                    {repliedMessage && !m.is_deleted && (
                                                                        <div 
                                                                            onClick={() => {
                                                                                const el = document.getElementById(`msg-${repliedMessage.message_id}`);
                                                                                if (el) {
                                                                                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                                                                                    el.classList.add("bg-[#ffffff]/10", "rounded-2xl", "p-2", "-mx-2");
                                                                                    setTimeout(() => el.classList.remove("bg-[#ffffff]/10", "rounded-2xl", "p-2", "-mx-2"), 1500);
                                                                                }
                                                                            }}
                                                                            className={`flex flex-col px-3 py-1.5 rounded-lg rounded-l-[4px] border-l-[3px] cursor-pointer transition-colors ${
                                                                                isMe ? "bg-black/10 hover:bg-black/20 border-[#1E1211]" : "bg-black/30 hover:bg-black/50 border-[#EB5E28]"
                                                                            }`}
                                                                        >
                                                                            <span className={`text-xs font-bold mb-0.5 ${isMe ? "text-[#1E1211]" : "text-[#EB5E28]"}`}>
                                                                                {String(repliedMessage.user_id) === String(me?.id) ? "Vous" : repliedMessage.username}
                                                                            </span>
                                                                            {/* 👇 MISE A JOUR ICI: On affiche "GIF" si la réponse pointe vers un GIF */}
                                                                            <span className={`text-xs truncate max-w-[200px] md:max-w-[300px] ${isMe ? "text-[#1E1211]/80" : "text-[#DCCBC4]/70"}`}>
                                                                                {isGifMessage(repliedMessage.content) ? "GIF" : repliedMessage.content}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {/* 👇 MISE A JOUR ICI: MESSAGE TEXTE OU GIF */}
                                                                    <div>
                                                                        {m.is_deleted ? (
                                                                            <span className="italic">Message supprimé</span>
                                                                        ) : isGifMessage(m.content) ? (
                                                                            <img src={m.content} alt="GIF" className="rounded-lg max-w-[250px] object-contain" />
                                                                        ) : (
                                                                            <span className="whitespace-pre-wrap break-words">{m.content}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* --- BARRE D'ACTIONS AU SURVOL --- */}
                                                            {!m.is_deleted && !isEditing && isHovered && (
                                                                <div className={`absolute top-full mt-1.5 ${isMe ? "right-0" : "left-0"} z-50 flex`}>
                                                                    <div className="bg-[#0F0908] border border-[#ffffff]/10 shadow-xl rounded-[14px] flex items-center overflow-hidden h-9">
                                                                        {showQuickReactions === m.message_id && (
                                                                            <div 
                                                                                className="flex items-center px-1 border-r border-[#ffffff]/10 bg-[#1E1211] h-full"
                                                                                onMouseLeave={() => setShowQuickReactions(null)}
                                                                            >
                                                                                {QUICK_EMOJIS.map(emoji => {
                                                                                    // On vérifie si l'utilisateur actuel a déjà réagi avec cet emoji
                                                                                    const reaction = m.reactions?.find(r => r.emoji === emoji);
                                                                                    const hasReacted = reaction?.users?.includes(me?.id);

                                                                                    return (
                                                                                        <button 
                                                                                            key={emoji} 
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation(); // Empeche le scroll vers la réponse
                                                                                                onToggleReaction(m.message_id, emoji, !!hasReacted);
                                                                                                setShowQuickReactions(null);
                                                                                            }} 
                                                                                            className="hover:scale-125 transition-transform px-1.5 cursor-pointer text-base"
                                                                                        >
                                                                                            {emoji}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                                <button 
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setActivePickerId(m.message_id);
                                                                                    }} 
                                                                                    className="p-1 mx-1 text-[#DCCBC4]/70 hover:text-white cursor-pointer"
                                                                                >
                                                                                    <SmilePlus className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                        
                                                                        <button 
                                                                            onMouseEnter={() => setShowQuickReactions(m.message_id)}
                                                                            onClick={(e) => e.stopPropagation()} // Évite les bugs de clic sur mobile
                                                                            className="px-3 h-full flex items-center justify-center text-[#DCCBC4]/70 hover:bg-[#ffffff]/10 hover:text-[#EB5E28] transition-colors cursor-pointer" 
                                                                            title="Réagir"
                                                                        >
                                                                            <Heart className={`w-4 h-4 ${m.reactions?.some(r => r.users.includes(me?.id)) ? "fill-[#EB5E28] text-[#EB5E28]" : ""}`} />
                                                                        </button>

                                                                        <div className="w-[1px] h-4 bg-[#ffffff]/10" />
                                                                        
                                                                        <button 
                                                                            onClick={(e) => { 
                                                                                e.stopPropagation(); 
                                                                                setReplyingTo(m); 
                                                                                setHoveredMessageId(null); 
                                                                            }} 
                                                                            className="px-3 h-full flex items-center justify-center text-[#DCCBC4]/70 hover:bg-[#ffffff]/10 hover:text-white transition-colors cursor-pointer" 
                                                                            title="Répondre"
                                                                        >
                                                                            <Reply className="w-4 h-4" />
                                                                        </button>

                                                                        {canEditThis && <div className="w-[1px] h-4 bg-[#ffffff]/10" />}
                                                                        {canEditThis && (
                                                                            <button 
                                                                                onClick={(e) => { 
                                                                                    e.stopPropagation(); 
                                                                                    setEditingMessageId(m.message_id); 
                                                                                    setEditingContent(m.content); 
                                                                                    setHoveredMessageId(null); 
                                                                                }} 
                                                                                className="px-3 h-full flex items-center justify-center text-[#DCCBC4]/70 hover:bg-[#ffffff]/10 hover:text-blue-400 cursor-pointer" 
                                                                                title="Éditer"
                                                                            >
                                                                                <Pencil className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        
                                                                        {canDeleteThis && <div className="w-[1px] h-4 bg-[#ffffff]/10" />}
                                                                        {canDeleteThis && (
                                                                            <button 
                                                                                onClick={(e) => { 
                                                                                    e.stopPropagation(); 
                                                                                    onDeleteMessage(m.message_id); 
                                                                                }} 
                                                                                className="px-3 h-full flex items-center justify-center text-[#DCCBC4]/70 hover:bg-[#ffffff]/10 hover:text-red-400 cursor-pointer" 
                                                                                title="Supprimer"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* --- RÉACTIONS ENREGISTRÉES --- */}
                                                        {m.reactions && m.reactions.length > 0 && (
                                                            <div className={`flex flex-wrap gap-1 transition-all duration-200 ${isHovered && !m.is_deleted && !isEditing ? "mt-12" : "mt-1.5"} ${isMe ? "justify-end" : "justify-start"}`}>
                                                                {m.reactions.map((r) => {
                                                                    const hasReacted = me ? r.users.includes(me.id) : false;
                                                                    return (
                                                                        <div key={r.emoji} className="relative group/pill">
                                                                            <button onClick={() => setReactionDetails({ emoji: r.emoji, users: r.users })} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] transition-all cursor-pointer ${hasReacted ? "bg-[#EB5E28]/20 border-[#EB5E28] text-[#EB5E28]" : "bg-[#0F0908] border-[#ffffff]/10 text-[#DCCBC4]/70 hover:border-[#ffffff]/30"}`}>
                                                                                <span>{r.emoji}</span><span className="font-bold">{r.users.length}</span>
                                                                            </button>
                                                                            {hasReacted && (
                                                                                <button onClick={(e) => { e.stopPropagation(); onToggleReaction(m.message_id, r.emoji, true); }} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/pill:opacity-100 transition-opacity shadow-lg hover:bg-red-600 z-10 cursor-pointer">
                                                                                <X className="w-2.5 h-2.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        <div className={`flex items-center gap-2 mt-1 px-1 text-[10px] text-[#DCCBC4]/40 ${isMe ? "justify-end" : "justify-start"}`}>
                                                            {time} {m.is_edited && "• édité"}
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

            {/* --- INPUT MESSAGE & BANDEAU RÉPONSE --- */}
            <div className="p-6 pt-2 border-t border-[#ffffff]/5">
                {typingLabel && <div className="px-6 pb-2 text-xs text-[#DCCBC4]/50">{typingLabel}</div>}
                
                <div className="relative">
                    {replyingTo && (
                        <div className="absolute bottom-full left-0 right-0 bg-[#1E1211] border-x border-t border-[#ffffff]/5 rounded-t-2xl px-4 py-2 flex items-center justify-between z-0 translate-y-2">
                            <div className="flex items-center gap-2 text-xs text-[#DCCBC4]/70 min-w-0">
                                <Reply className="w-4 h-4 shrink-0" />
                                <span className="shrink-0">Réponse à <span className="font-bold text-[#EB5E28]">@{replyingTo.username}</span></span>
                                {/* 👇 MISE A JOUR ICI: On affiche "GIF" si on répond à un GIF */}
                                <span className="truncate opacity-50 ml-2">
                                    {isGifMessage(replyingTo.content) ? "GIF" : replyingTo.content}
                                </span>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="ml-2 text-[#DCCBC4]/50 hover:text-white cursor-pointer bg-[#0F0908] rounded-full p-0.5">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    <div className={`relative bg-[#1E1211] flex items-center px-4 py-2 border border-[#ffffff]/5 shadow-inner z-10 transition-all ${replyingTo ? "rounded-b-2xl rounded-t-none border-t-0" : "rounded-2xl"}`}>
                        <button onClick={() => setShowGifPicker(!showGifPicker)} className="mr-3 bg-[#ffffff]/5 hover:bg-[#ffffff]/10 px-3 py-1.5 rounded-xl text-[#DCCBC4]/70 hover:text-[#EB5E28] font-bold text-xs transition-colors cursor-pointer">GIF</button>
                        
                        {showGifPicker && (
                            <div className="absolute bottom-full left-0 mb-4 z-[9999] bg-[#0F0908] rounded-2xl border border-[#ffffff]/10 shadow-2xl w-[320px] flex flex-col overflow-hidden">
                                <div className="p-3 bg-[#1E1211]/50"><input type="text" placeholder="Rechercher..." value={gifSearch} onChange={(e) => setGifSearch(e.target.value)} className="w-full bg-[#0a0605] text-sm text-[#DCCBC4] rounded-xl px-3 py-2 border border-[#ffffff]/5 focus:outline-none" /></div>
                                <div className="h-[280px] overflow-y-auto p-2">
                                    <Grid key={gifSearch} width={300} columns={3} gutter={6} fetchGifs={fetchDynamicGifs} onGifClick={(gif, e) => { e.preventDefault(); setShowGifPicker(false); onSendGif(gif.images.original.url, replyingTo?.message_id); setReplyingTo(null); }} />
                                </div>
                            </div>
                        )}
                        
                        <input type="text" value={messageText} onChange={(e) => { setMessageText(e.target.value); onSendTyping(); }} onKeyDown={handleKeyDown} disabled={!selectedServerId || !selectedChannelId || isSending} placeholder={`Message…`} className="flex-1 bg-transparent text-[#DCCBC4] focus:outline-none py-2" />
                        
                        <button onClick={handleSendMessage} disabled={!selectedServerId || !selectedChannelId || isSending || !messageText.trim()} className={`ml-3 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedServerId && selectedChannelId && messageText.trim() ? "bg-[#EB5E28] text-[#1E1211] hover:scale-105 shadow-[0_0_15px_rgba(235,94,40,0.3)] cursor-pointer" : "bg-[#2A1A18] text-[#DCCBC4]/30 cursor-not-allowed"}`}>
                            <SendHorizontal className="w-4 h-4 ml-0.5" />
                        </button>
                    </div>
                </div>
            </div>
            
            {/* --- MODAL LISTE DES RÉACTEURS --- */}
            {reactionDetails && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReactionDetails(null)} />
                    <div className="relative bg-[#1E1211] border border-[#ffffff]/10 rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        <div className="p-4 border-b border-[#ffffff]/5 flex justify-between items-center bg-[#2A1A18]/50">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{reactionDetails.emoji}</span>
                                <span className="text-white font-bold">Réactions ({reactionDetails.users.length})</span>
                            </div>
                            <button onClick={() => setReactionDetails(null)} className="text-[#DCCBC4] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-2">
                            {reactionDetails.users.map(userId => (
                                <div key={userId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#ffffff]/5 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-[#EB5E28] flex items-center justify-center text-[#1E1211] font-bold text-xs">{getInitials(getUsernameById(userId))}</div>
                                    <span className="text-[#DCCBC4] font-semibold">@{getUsernameById(userId)}</span>
                                    {String(userId) === String(me?.id) && <span className="text-[10px] bg-[#EB5E28]/10 text-[#EB5E28] px-1.5 py-0.5 rounded-md ml-auto">Toi</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- EMOJI PICKER --- */}
            {activePickerId && (
                <div className="absolute bottom-24 right-8 z-[9999] shadow-2xl rounded-2xl overflow-hidden border border-[#ffffff]/10">
                    <EmojiPicker theme={Theme.DARK} onEmojiClick={(emojiData) => {
                        const msg = messages.find(m => m.message_id === activePickerId);
                        const hasReacted = msg?.reactions?.find(r => r.emoji === emojiData.emoji)?.users.includes(me?.id || "");
                        onToggleReaction(activePickerId, emojiData.emoji, !!hasReacted);
                        setActivePickerId(null);
                    }} />
                </div>
            )}
        </div>
    );
}
import { MemberActionsMenu } from "@/features/chat/components/member-actions-menu";
import { Crown, MoreHorizontal, PanelRightClose } from "lucide-react";

function getInitials(username) {
    if (!username || username.length < 1) return "??";
    return `${username[0].toUpperCase()}${username[username.length - 1].toUpperCase()}`;
}

export function MemberArea({
    members,
    onlineUserIds,
    selectedServerId,
    selectedServer,
    selectedChannelId,
    me,
    isOwner,
    myRole,
    typingUsers,
    openMenuFor,
    setOpenMenuFor,
    onKick,
    onBan,
    onSetRole,
    onTransferOwner,
    onShowBans,
    onCloseMemberArea // <-- NOUVELLE PROP ICI
}) {
    return (
        <div className="w-72 bg-[#0a0605] rounded-[20px] hidden xl:flex flex-col h-full shadow-lg overflow-hidden">
            <div className="h-16 flex items-center px-4 font-[family-name:var(--font-nunito)] font-bold text-[#FFF8F0] border-b border-[#ffffff]/5">
                {/* NOUVEAU BOUTON POUR FERMER LE VOLET MEMBRES */}
                <button 
                    onClick={onCloseMemberArea} 
                    title="Masquer les membres" 
                    className="mr-3 p-2 rounded-xl hover:bg-[#1E1211] text-[#DCCBC4]/70 hover:text-white cursor-pointer transition-colors"
                >
                    <PanelRightClose className="w-5 h-5" />
                </button>
                
                Membres
                <span className="ml-auto text-xs text-[#DCCBC4]/40 font-normal">{members.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
                {!selectedServerId ? (
                    <div className="text-sm text-[#DCCBC4]/50 px-2 py-2">Sélectionne un serveur.</div>
                ) : members.length === 0 ? (
                    <div className="text-sm text-[#DCCBC4]/50 px-2 py-2">Aucun membre.</div>
                ) : (
                    <>
                        <div className="flex flex-col gap-1">
                            {members.map((m) => {
                                const online = onlineUserIds.has(String(m.user_id));
                                const ownerByServerField = selectedServer?.owner_id && String(selectedServer.owner_id) === String(m.user_id);
                                const ownerByRole = m.role === "owner";
                                const isOwnerMember = ownerByRole || ownerByServerField;
                                const isMe = me && String(me.id) === String(m.user_id);
                                const canManageThis = Boolean(selectedServerId && isOwner && !isOwnerMember && !isMe);
                                const isTyping = !!selectedChannelId && !!typingUsers[String(m.user_id)] && String(typingUsers[String(m.user_id)]?.channelId) === String(selectedChannelId);
                                
                                return (
                                    <div key={m.user_id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#1E1211] transition-colors">
                                        <div className="relative">
                                            <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4]">
                                                {getInitials(m.username)}
                                            </div>
                                            <span className={["absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0605]", isTyping ? "bg-[#EB5E28]" : online ? "bg-green-500" : "bg-[#ffffff]/20"].join(" ")} />
                                        </div>
                                        <div className="flex flex-col leading-tight min-w-0 flex-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-white font-bold text-sm truncate">@{m.username}</span>
                                                {isOwnerMember && <span title="Owner" className="text-[#FBBF24]"><Crown className="w-4 h-4" /></span>}
                                                {m.role === "admin" && !isOwnerMember && <span className="text-xs px-2 py-0.5 rounded-full bg-[#1E1211] border border-[#ffffff]/10 text-[#DCCBC4]/70">admin</span>}
                                            </div>
                                            <span className="text-xs text-[#DCCBC4]/50">{isTyping ? "Écrit…" : online ? "En ligne" : "Hors ligne"}</span>
                                        </div>
                                        {canManageThis && (
                                            <div className="relative">
                                                <button onClick={() => setOpenMenuFor((prev) => (prev === String(m.user_id) ? null : String(m.user_id)))} className="w-9 h-9 rounded-xl border border-[#ffffff]/10 text-[#DCCBC4]/70 hover:bg-[#0F0908] hover:text-white cursor-pointer flex items-center justify-center">
                                                    <MoreHorizontal className="w-5 h-5" />
                                                </button>
                                                {openMenuFor === String(m.user_id) && (
                                                    <MemberActionsMenu username={m.username} userId={String(m.user_id)} serverId={selectedServerId} role={m.role} onKick={onKick} onBan={onBan} onSetRole={onSetRole} onTransferOwner={onTransferOwner} />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {myRole !== "member" && (
                            <div className="flex flex-col gap-1 mt-4 border-t border-[#ffffff]/5 pt-4">
                                <button onClick={onShowBans} className="text-xs text-left px-3 text-[#DCCBC4]/60 hover:text-white cursor-pointer">Utilisateurs bannis</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
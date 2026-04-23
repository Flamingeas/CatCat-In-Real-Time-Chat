"use client";

import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { Member, MemberRole } from "@/features/chat/services/members.service";
import { MemberActionsMenu } from "@/features/chat/components/member-actions-menu";
import { Server } from "@/types/chat";
import { CrownIcon } from "@/components/icons";
import { getInitials } from "@/utils/chat";

interface MembersSidebarProps {
    members: Member[];
    onlineUserIds: Set<string>;
    selectedServer: Server | null;
    selectedServerId: string | null;
    selectedChannelId: string | null;
    myId: string | null;
    myRole: MemberRole;
    isOwner: boolean;
    typingUsers: Record<string, { username: string; channelId: string }>;
    openMenuFor: string | null;
    menuRef: RefObject<HTMLDivElement | null>;
    onToggleMenu: (userId: string) => void;
    onStartDm: (userId: string) => void;
    onKickMember: (serverId: string, userId: string) => void;
    onBanMember: (serverId: string, userId: string) => void;
    onOpenTemporaryBanModal: (userId: string, username: string) => void;
    onSetMemberRole: (serverId: string, userId: string, role: MemberRole) => void;
    onTransferOwner: (serverId: string, userId: string) => void;
    onShowBans: () => void;
}

export function MembersSidebar({
    members,
    onlineUserIds,
    selectedServer,
    selectedServerId,
    selectedChannelId,
    myId,
    myRole,
    isOwner,
    typingUsers,
    openMenuFor,
    menuRef,
    onToggleMenu,
    onStartDm,
    onKickMember,
    onBanMember,
    onOpenTemporaryBanModal,
    onSetMemberRole,
    onTransferOwner,
    onShowBans,
}: MembersSidebarProps) {
    const t = useTranslations("membersSidebar");

    return (
        <div className="w-72 bg-[#0a0605] rounded-[20px] hidden xl:flex flex-col h-full shadow-lg overflow-hidden">
            <div className="h-16 flex items-center px-4 font-[family-name:var(--font-nunito)] font-bold text-[#FFF8F0] border-b border-[#ffffff]/5">
                {t("members")}
                <span className="ml-auto text-xs text-[#DCCBC4]/40 font-normal">{members.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
                {!selectedServerId ? (
                    <div className="text-sm text-[#DCCBC4]/50 px-2 py-2">{t("selectServer")}</div>
                ) : members.length === 0 ? (
                    <div className="text-sm text-[#DCCBC4]/50 px-2 py-2">{t("noMembers")}</div>
                ) : (
                    <>
                        <div className="flex flex-col gap-1">
                            {members.map((member) => {
                                const userId = String(member.user_id);
                                const online = onlineUserIds.has(userId);
                                const ownerByServerField = selectedServer?.owner_id && String(selectedServer.owner_id) === userId;
                                const ownerByRole = member.role === "owner";
                                const isOwnerMember = ownerByRole || ownerByServerField;
                                const isMe = myId && String(myId) === userId;
                                const canManageThis = Boolean(
                                    (selectedServerId && isOwner && !isOwnerMember && !isMe) ||
                                    (myRole === "admin" && !isMe && !isOwnerMember)
                                );
                                const isTyping =
                                    !!selectedChannelId &&
                                    !!typingUsers[userId] &&
                                    String(typingUsers[userId]?.channelId) === String(selectedChannelId);

                                return (
                                    <div key={member.user_id} className="group flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#1E1211] transition-colors">
                                        <div className="relative">
                                            <div className="w-9 h-9 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4]">
                                                {getInitials(member.username)}
                                            </div>
                                            <span
                                                className={[
                                                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0605]",
                                                    isTyping ? "bg-[#EB5E28]" : online ? "bg-green-500" : "bg-[#ffffff]/20",
                                                ].join(" ")}
                                            />
                                        </div>
                                        <div className="flex flex-col leading-tight min-w-0 flex-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-white font-bold text-sm truncate">@{member.username}</span>
                                                {isOwnerMember && (
                                                    <span title={t("ownerTitle")} className="text-[#FBBF24]">
                                                        <CrownIcon />
                                                    </span>
                                                )}
                                                {member.role === "admin" && !isOwnerMember && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#1E1211] border border-[#ffffff]/10 text-[#DCCBC4]/70">
                                                        {t("adminRole")}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-[#DCCBC4]/50">
                                                {isTyping ? t("typing") : online ? t("online") : t("offline")}
                                            </span>
                                        </div>

                                        {!isMe && (
                                            <button
                                                onClick={() => onStartDm(userId)}
                                                title={t("sendMessageTo", { username: member.username })}
                                                className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-xl border border-[#ffffff]/10 text-[#EB5E28] hover:bg-[#EB5E28] hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                </svg>
                                            </button>
                                        )}

                                        {canManageThis && (
                                            <div className="relative" ref={openMenuFor === userId ? menuRef : undefined}>
                                                <button
                                                    onClick={() => onToggleMenu(userId)}
                                                    className="w-9 h-9 rounded-xl border border-[#ffffff]/10 text-[#DCCBC4]/70 hover:bg-[#0F0908] hover:text-white cursor-pointer flex items-center justify-center"
                                                    title={t("actions")}
                                                >
                                                    ⋯
                                                </button>
                                                {openMenuFor === userId && (
                                                    <MemberActionsMenu
                                                        username={member.username}
                                                        userId={userId}
                                                        serverId={selectedServerId}
                                                        role={member.role}
                                                        onKick={onKickMember}
                                                        onBan={onBanMember}
                                                        onOpenTemporaryBanModal={onOpenTemporaryBanModal}
                                                        onSetRole={myRole === "owner" ? onSetMemberRole : undefined}
                                                        onTransferOwner={myRole === "owner" ? onTransferOwner : undefined}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {myRole !== "member" && (
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#1E1211] transition-colors">
                                    <button
                                        onClick={onShowBans}
                                        className="text-xs text-[#DCCBC4]/60 hover:text-white cursor-pointer"
                                    >
                                        {t("bannedUsersButton")}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

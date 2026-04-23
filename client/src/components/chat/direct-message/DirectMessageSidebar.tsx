"use client";

import { useTranslations } from "next-intl";
import { ConversationItem } from "@/features/direct-message/services/dm.service";
import { getInitials } from "@/utils/chat";

interface DirectMessageSidebarProps {
    conversations: ConversationItem[];
    selectedConvId: string | null;
    onSelectConversation: (id: string) => void;
    unreadCounts: Record<string, number>;
}

export function DirectMessageSidebar({
    conversations,
    selectedConvId,
    onSelectConversation,
    unreadCounts,
}: DirectMessageSidebarProps) {
    const t = useTranslations("directMessage");
    return (
        <>
            <div className="h-16 flex items-center px-4 font-[family-name:var(--font-nunito)] font-bold text-[#FFF8F0] border-b border-[#ffffff]/5">
                <span className="mr-2 text-[#EB5E28]">✉</span>
                {t("title")}
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">
                {conversations.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-[#DCCBC4]/50">{t("noConversations")}</div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {conversations.map((conversation) => {
                            const active = conversation.id === selectedConvId;
                            const unreadCount = unreadCounts[conversation.id] ?? 0;

                            return (
                                <button
                                    key={conversation.id}
                                    onClick={() => onSelectConversation(conversation.id)}
                                    className={[
                                        "flex items-center gap-3 px-3 py-2 rounded-xl transition-colors font-[family-name:var(--font-nunito)] w-full text-left",
                                        active ? "bg-[#1E1211] text-white" : "hover:bg-[#1E1211] text-[#DCCBC4]/80",
                                    ].join(" ")}
                                >
                                    <div className="w-8 h-8 rounded-full bg-[#2A1A18] border border-[#ffffff]/5 flex items-center justify-center text-xs font-bold text-[#DCCBC4] shrink-0">
                                        {getInitials(conversation.other_username)}
                                    </div>
                                    <span className="truncate text-sm flex-1">@{conversation.other_username}</span>
                                    {unreadCount > 0 && (
                                        <span className="min-w-5 h-5 px-1 rounded-full bg-[#EB5E28] text-[#1E1211] text-[10px] font-black flex items-center justify-center">
                                            {unreadCount > 99 ? "99+" : unreadCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

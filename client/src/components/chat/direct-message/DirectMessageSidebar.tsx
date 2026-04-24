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
            {/* === HEADER === */}
            <div className="h-16 flex items-center px-4 font-[family-name:var(--font-nunito)] font-bold text-primary border-b border-border-custom">
                <span className="mr-2 text-accent">✉</span>
                {t("title")}
            </div>
            
            {/* === LISTE DES CONVERSATIONS === */}
            <div className="flex-1 overflow-y-auto px-2 py-3">
                {conversations.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted">{t("noConversations")}</div>
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
                                        "flex items-center gap-3 px-3 py-2 rounded-xl transition-colors font-[family-name:var(--font-nunito)] w-full text-left cursor-pointer",
                                        active 
                                            ? "bg-secondary text-primary font-bold" 
                                            : "hover:bg-secondary/50 text-muted hover:text-primary",
                                    ].join(" ")}
                                >
                                    {/* Avatar */}
                                    <div className="w-8 h-8 rounded-full bg-background border border-border-custom flex items-center justify-center text-xs font-bold text-accent shrink-0">
                                        {getInitials(conversation.other_username)}
                                    </div>
                                    
                                    {/* Nom d'utilisateur */}
                                    <span className="truncate text-sm flex-1">@{conversation.other_username}</span>
                                    
                                    {/* Badge non lus */}
                                    {unreadCount > 0 && (
                                        <span className="min-w-5 h-5 px-1 rounded-full bg-accent text-[#1E1211] text-[10px] font-black flex items-center justify-center shadow-sm">
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
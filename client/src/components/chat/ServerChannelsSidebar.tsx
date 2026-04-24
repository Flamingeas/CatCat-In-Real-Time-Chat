"use client";

import { ChannelList } from "@/components/chat/ChannelList";
import { GearIcon, LeaveIcon } from "@/components/icons";
import { Channel, Server } from "@/types/chat";
import { useTranslations } from "next-intl";

interface ServerChannelsSidebarProps {
    selectedServer: Server | null;
    selectedServerId: string | null;
    selectedChannelId: string | null;
    channels: Channel[];
    isOwner: boolean;
    canCreateChannel: boolean;
    canEditChannel: boolean;
    onOpenServerSettings: () => void;
    onOpenLeaveServer: () => void;
    onSelectChannel: (id: string) => void;
    onCreateChannel: () => void;
    onEditChannel: () => void;
    onDeleteChannel: (id: string) => void;
}

export function ServerChannelsSidebar({
    selectedServer,
    selectedServerId,
    selectedChannelId,
    channels,
    isOwner,
    canCreateChannel,
    canEditChannel,
    onOpenServerSettings,
    onOpenLeaveServer,
    onSelectChannel,
    onCreateChannel,
    onEditChannel,
    onDeleteChannel,
}: ServerChannelsSidebarProps) {
    const t = useTranslations("serverSidebar");
    const tCommon = useTranslations("common");
    
    return (
        <>
            {/* Header du serveur : Remplacement par text-primary et border-border-custom */}
            <div className="h-16 flex items-center px-4 font-bold text-primary border-b border-border-custom bg-transparent">
                {/* La flèche passe en couleur accent */}
                <span className="mr-2 text-accent">&gt;</span>
                {selectedServer ? selectedServer.name : tCommon("noServer")}
                
                {selectedServer &&
                    (isOwner ? (
                        <button
                            onClick={onOpenServerSettings}
                            title={t("settings")}
                            // Paramètres : bg-secondary au survol, text-muted vers text-primary
                            className="ml-auto p-2 rounded-xl hover:bg-secondary border border-transparent hover:border-border-custom transition-colors text-muted hover:text-primary cursor-pointer"
                        >
                            <GearIcon />
                        </button>
                    ) : (
                        <button
                            onClick={onOpenLeaveServer}
                            title={t("leave")}
                            // Bouton Quitter : On gère le rouge dynamiquement selon le mode (clair/sombre)
                            className="ml-auto p-2 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 cursor-pointer"
                        >
                            <LeaveIcon />
                        </button>
                    ))}
            </div>

            <ChannelList
                channels={channels}
                selectedChannelId={selectedChannelId}
                onSelectChannel={onSelectChannel}
                canCreateChannel={canCreateChannel}
                canEditChannel={canEditChannel}
                onCreateChannel={onCreateChannel}
                onEditChannel={onEditChannel}
                onDeleteChannel={onDeleteChannel}
                selectedServerId={selectedServerId}
            />
        </>
    );
}
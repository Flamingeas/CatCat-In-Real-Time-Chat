import { ChannelList } from "@/components/chat/ChannelList";
import { GearIcon, LeaveIcon } from "@/components/icons";
import { Channel, Server } from "@/types/chat";

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
    return (
        <>
            <div className="h-16 flex items-center px-4 font-[family-name:var(--font-nunito)] font-bold text-[#FFF8F0] border-b border-[#ffffff]/5">
                <span className="mr-2 text-[#EB5E28]">&gt;</span>
                {selectedServer ? selectedServer.name : "Aucun serveur"}
                {selectedServer &&
                    (isOwner ? (
                        <button
                            onClick={onOpenServerSettings}
                            title="Paramètres du serveur"
                            className="ml-auto p-2 rounded-xl hover:bg-[#1E1211] border border-transparent hover:border-[#ffffff]/10 transition-colors text-[#DCCBC4]/70 hover:text-white cursor-pointer"
                        >
                            <GearIcon />
                        </button>
                    ) : (
                        <button
                            onClick={onOpenLeaveServer}
                            title="Quitter le serveur"
                            className="ml-auto p-2 rounded-xl hover:bg-[#1E1211] border border-transparent hover:border-red-500/30 transition-colors text-red-300 hover:text-red-200 cursor-pointer"
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

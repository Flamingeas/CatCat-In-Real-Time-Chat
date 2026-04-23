"use client";

import { useTranslations } from "next-intl";
import { PencilIcon } from "../icons";

interface Channel {
    id: string;
    name: string;
    created_at?: string;
    updated_at?: string;
}

interface ChannelListProps {
    channels: Channel[];
    selectedChannelId: string | null;
    onSelectChannel: (id: string) => void;
    canCreateChannel: boolean;
    canEditChannel: boolean;
    onCreateChannel: () => void;
    onEditChannel: () => void;
    onDeleteChannel: (id: string) => void;
    selectedServerId: string | null;
}

export function ChannelList({
    channels,
    selectedChannelId,
    onSelectChannel,
    canCreateChannel,
    canEditChannel,
    onCreateChannel,
    onEditChannel,
    onDeleteChannel,
    selectedServerId,
}: ChannelListProps) {
    const t = useTranslations("channelList");

    return (
        <div className="flex-1 flex flex-col">
            <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider text-[#DCCBC4]/50 font-[family-name:var(--font-nunito)] flex items-center">
                {t("channels")}
                <button
                    onClick={onCreateChannel}
                    disabled={!selectedServerId || !canCreateChannel}
                    title={!selectedServerId ? t("selectServerTitle") : canCreateChannel ? t("createChannelTitle") : t("onlyOwnerAdmin")}
                    className={[
                        "ml-auto w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer",
                        selectedServerId && canCreateChannel ? "border-[#ffffff]/10 hover:bg-[#1E1211] text-[#EB5E28]" : "border-[#ffffff]/5 text-[#DCCBC4]/30 cursor-not-allowed",
                    ].join(" ")}
                >
                    +
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
                {!selectedServerId ? (
                    <div className="px-2 py-2 text-sm text-[#DCCBC4]/50">{t("noServerForChannel")}</div>
                ) : channels.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-[#DCCBC4]/50">{t("noChannels")}</div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {channels.map((c) => {
                            const active = String(c.id) === String(selectedChannelId);

                            return (
                                <div
                                    key={c.id}
                                    className={[
                                        "group flex items-center gap-2 px-3 py-2 rounded-xl transition-colors font-[family-name:var(--font-nunito)]",
                                        active ? "bg-[#1E1211] text-white" : "hover:bg-[#1E1211] text-[#DCCBC4]/80",
                                    ].join(" ")}
                                    title={`#${c.name}`}
                                >
                                    <button onClick={() => onSelectChannel(String(c.id))} className="flex-1 text-left min-w-0 cursor-pointer">
                                        <span className="text-[#EB5E28] mr-2">#</span>
                                        <span className="truncate">{c.name}</span>
                                    </button>

                                    {active && canEditChannel && (
                                        <button
                                            onClick={onEditChannel}
                                            title={t("renameChannel")}
                                            className="p-2 rounded-xl border border-[#ffffff]/10 text-[#DCCBC4]/70 hover:bg-[#1E1211] hover:text-white cursor-pointer"
                                        >
                                            <PencilIcon />
                                        </button>
                                    )}

                                    {canCreateChannel && (
                                        <button
                                            onClick={() => {
                                                if (!window.confirm(t("deleteChannelConfirm", { name: c.name }))) return;
                                                onDeleteChannel(String(c.id));
                                            }}
                                            title={t("deleteChannel")}
                                            className="group-hover:opacity-100 transition-opacity text-red-300 hover:text-red-200 px-2 cursor-pointer"
                                        >
                                            🗑
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

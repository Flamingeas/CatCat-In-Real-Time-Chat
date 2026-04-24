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
            <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider text-muted font-[family-name:var(--font-nunito)] flex items-center">
                {t("channels")}
                <button
                    onClick={onCreateChannel}
                    disabled={!selectedServerId || !canCreateChannel}
                    title={!selectedServerId ? t("selectServerTitle") : canCreateChannel ? t("createChannelTitle") : t("onlyOwnerAdmin")}
                    className={[
                        "ml-auto w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer",
                        selectedServerId && canCreateChannel 
                            ? "border-border-custom hover:bg-secondary text-accent" 
                            : "border-border-custom text-muted opacity-40 cursor-not-allowed",
                    ].join(" ")}
                >
                    +
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
                {!selectedServerId ? (
                    <div className="px-2 py-2 text-sm text-muted">{t("noServerForChannel")}</div>
                ) : channels.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted">{t("noChannels")}</div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {channels.map((c) => {
                            const active = String(c.id) === String(selectedChannelId);

                            return (
                                <div
                                    key={c.id}
                                    className={[
                                        "group flex items-center gap-2 px-3 py-2 rounded-xl transition-colors font-[family-name:var(--font-nunito)]",
                                        active ? "bg-secondary text-primary font-bold" : "hover:bg-secondary text-muted hover:text-primary",
                                    ].join(" ")}
                                    title={`#${c.name}`}
                                >
                                    <button onClick={() => onSelectChannel(String(c.id))} className="flex-1 text-left min-w-0 cursor-pointer">
                                        <span className="text-accent mr-2">#</span>
                                        <span className="truncate">{c.name}</span>
                                    </button>

                                    {active && canEditChannel && (
                                        <button
                                            onClick={onEditChannel}
                                            title={t("renameChannel")}
                                            className="p-2 rounded-xl border border-border-custom text-muted hover:bg-background hover:text-primary cursor-pointer"
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
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 px-2 cursor-pointer"
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
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";

import logoImage from "../images/logo_catcat.svg";

type Server = {
    id: string;
    name: string;
    owner_id: string;
    invitation_code: string;
    created_at: string;
    updated_at: string;
};

type ChannelBarProps = {
    selectedServerId: string | null;
    servers: Server[];
    isOwner: boolean;
    canCreateChannel: boolean;
    channels: Channel[];
    onOpenServerSettings: () => void;
    selectedChannelId: string | null;
};

function LeaveIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 19V5a2 2 0 00-2-2h-6" />
        </svg>
    );
}

function GearIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.303.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

export default function ChannelBar({selectedServerId, servers, isOwner, canCreateChannel, channels, onOpenServerSettings, selectedChannelId}: ChannelBarProps) {

    //const [servers, setServers] = useState<Server[]>([]);
    //const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
    const selectedServer = useMemo(() => servers.find((s) => s.id === selectedServerId) ?? null, [servers, selectedServerId]);

    function openCreateChannel() {
        if (!canCreateChannel) return;
        if (!selectedServerId) return;
        setChannelCreateError(null);
        setChannelName("");
        setIsChannelCreateOpen(true);
    }

    return(
        <div>
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
                            onClick={() => {
                                if (!selectedServerId) return;
                                setLeaveError(null);
                                setIsLeaveOpen(true);
                            }}
                            title="Quitter le serveur"
                            className="ml-auto p-2 rounded-xl hover:bg-[#1E1211] border border-transparent hover:border-red-500/30 transition-colors text-red-300 hover:text-red-200 cursor-pointer"
                        >
                            <LeaveIcon />
                        </button>
                    ))}
            </div>

            <div className="flex-1 flex flex-col">
                <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider text-[#DCCBC4]/50 font-[family-name:var(--font-nunito)] flex items-center">
                    Salons
                    <button
                        onClick={openCreateChannel}
                        disabled={!selectedServerId || !canCreateChannel}
                        title={!selectedServerId ? "Sélectionne un serveur" : canCreateChannel ? "Créer un salon" : "Seuls owner/admin"}
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
                        <div className="px-2 py-2 text-sm text-[#DCCBC4]/50">Sélectionne / crée un serveur.</div>
                    ) : channels.length === 0 ? (
                        <div className="px-2 py-2 text-sm text-[#DCCBC4]/50">Aucun salon.</div>
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
                                        <button onClick={() => setSelectedChannelId(String(c.id))} className="flex-1 text-left min-w-0 cursor-pointer">
                                            <span className="text-[#EB5E28] mr-2">#</span>
                                            <span className="truncate">{c.name}</span>
                                        </button>

                                        {active && canEditChannel && (
                                            <button
                                                onClick={openEditChannel}
                                                title="Renommer le salon"
                                                className="p-2 rounded-xl border border-[#ffffff]/10 text-[#DCCBC4]/70 hover:bg-[#1E1211] hover:text-white cursor-pointer"
                                            >
                                                <PencilIcon />
                                            </button>
                                        )}

                                        {canCreateChannel && (
                                            <button
                                                onClick={() => {
                                                    if (!window.confirm(`Supprimer le salon #${c.name} ?`)) return;
                                                    deleteChannel(String(c.id));
                                                }}
                                                title="Supprimer"
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
        </div>
    );
}
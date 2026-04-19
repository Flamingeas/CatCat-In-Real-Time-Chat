import { Settings, LogOut, Pencil, PanelLeftClose, Plus, Trash2 } from "lucide-react";

function formatDateOnlyFR(input) {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return input;
    return new Intl.DateTimeFormat("fr-FR", { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export function ChannelSidebar({
    selectedServer,
    isOwner,
    onOpenServerSettings,
    onLeaveServer,
    canCreateChannel,
    onOpenCreateChannel,
    channels,
    selectedChannelId,
    onSelectChannel,
    canEditChannel,
    onOpenEditChannel,
    onDeleteChannel,
    onCloseSidebar
}) {
    return (
        <div className="flex w-full h-full bg-[#0F0908] rounded-[20px] flex-col overflow-hidden shrink-0">
            <div className="min-h-[72px] py-3 flex items-center px-4 font-[family-name:var(--font-nunito)] border-b border-[#ffffff]/5">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="font-bold text-[#FFF8F0] flex items-center">
                        <span className="mr-2 text-[#EB5E28]">&gt;</span>
                        <span className="truncate">{selectedServer ? selectedServer.name : "Aucun serveur"}</span>
                    </div>
                    {selectedServer && selectedServer.created_at && (
                        <div className="text-[10px] text-[#DCCBC4]/50 ml-5 font-normal truncate mt-0.5">
                            Créé le {formatDateOnlyFR(selectedServer.created_at)}
                        </div>
                    )}
                </div>
                
                {selectedServer && (
                    <div className="ml-2 flex items-center gap-1 flex-shrink-0">
                        {isOwner ? (
                            <button onClick={onOpenServerSettings} title="Paramètres du serveur" className="p-2 rounded-xl hover:bg-[#1E1211] border border-transparent hover:border-[#ffffff]/10 transition-colors text-[#DCCBC4]/70 hover:text-white cursor-pointer">
                                <Settings className="w-5 h-5" />
                            </button>
                        ) : (
                            <button onClick={onLeaveServer} title="Quitter le serveur" className="p-2 rounded-xl hover:bg-[#1E1211] border border-transparent hover:border-red-500/30 transition-colors text-red-300 hover:text-red-200 cursor-pointer">
                                <LogOut className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={onCloseSidebar} title="Masquer les salons" className="p-2 rounded-xl hover:bg-[#1E1211] border border-transparent hover:border-[#ffffff]/10 transition-colors text-[#DCCBC4]/70 hover:text-white cursor-pointer">
                            <PanelLeftClose className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col">
                <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider text-[#DCCBC4]/50 font-[family-name:var(--font-nunito)] flex items-center">
                    Salons
                    <button
                        onClick={onOpenCreateChannel}
                        disabled={!selectedServer || !canCreateChannel}
                        title={!selectedServer ? "Sélectionne un serveur" : canCreateChannel ? "Créer un salon" : "Seuls owner/admin"}
                        className={[
                            "ml-auto w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer",
                            selectedServer && canCreateChannel ? "border-[#ffffff]/10 hover:bg-[#1E1211] text-[#EB5E28]" : "border-[#ffffff]/5 text-[#DCCBC4]/30 cursor-not-allowed",
                        ].join(" ")}
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-3">
                    {!selectedServer ? (
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
                                        <button onClick={() => onSelectChannel(String(c.id))} className="flex-1 text-left min-w-0 cursor-pointer flex flex-col">
                                            <div className="flex items-center">
                                                <span className="text-[#EB5E28] mr-2">#</span>
                                                <span className="truncate">{c.name}</span>
                                            </div>
                                        </button>

                                        {active && canEditChannel && (
                                            <button
                                                onClick={onOpenEditChannel}
                                                title="Renommer le salon"
                                                className="p-2 rounded-xl border border-[#ffffff]/10 text-[#DCCBC4]/70 hover:bg-[#1E1211] hover:text-white cursor-pointer"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        )}

                                        {canCreateChannel && (
                                            <button
                                                onClick={() => {
                                                    if (!window.confirm(`Supprimer le salon #${c.name} ?`)) return;
                                                    onDeleteChannel(String(c.id));
                                                }}
                                                title="Supprimer"
                                                className="group-hover:opacity-100 transition-opacity text-red-300 hover:text-red-200 px-2 cursor-pointer opacity-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
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
interface LeaveServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedServer: { name: string } | null;
    leaveError: string | null;
    isLeaving: boolean;
    onLeave: () => void;
}

export function LeaveServerModal({
    isOpen,
    onClose,
    selectedServer,
    leaveError,
    isLeaving,
    onLeave,
}: LeaveServerModalProps) {
    if (!isOpen || !selectedServer) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => !isLeaving && onClose()} />
            <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Quitter le serveur</h3>
                        <div className="text-xs text-[#DCCBC4]/50 mt-1">Serveur: {selectedServer.name}</div>
                    </div>
                    <button onClick={() => !isLeaving && onClose()} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer">
                        ✕
                    </button>
                </div>

                <div className="rounded-2xl border border-red-500/20 bg-[#0a0605] p-4">
                    <div className="text-sm text-[#DCCBC4]/70">
                        Tu vas quitter ce serveur. Tu pourras le rejoindre de nouveau uniquement avec un code d’invitation.
                    </div>

                    {leaveError && <div className="mt-3 text-sm text-red-400">{leaveError}</div>}

                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            disabled={isLeaving}
                            className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={onLeave}
                            disabled={isLeaving}
                            className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 disabled:opacity-50 cursor-pointer"
                        >
                            {isLeaving ? "Quitte..." : "Quitter"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
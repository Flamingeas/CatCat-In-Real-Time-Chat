interface ChannelCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    channelName: string;
    setChannelName: (name: string) => void;
    channelCreateError: string | null;
    isChannelCreating: boolean;
    onCreate: () => void;
}

export function ChannelCreateModal({
    isOpen,
    onClose,
    channelName,
    setChannelName,
    channelCreateError,
    isChannelCreating,
    onCreate,
}: ChannelCreateModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => !isChannelCreating && onClose()} />
            <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">Créer un salon</h3>
                    <button onClick={() => !isChannelCreating && onClose()} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer">
                        ✕
                    </button>
                </div>

                <label className="block text-sm text-[#DCCBC4]/70 mb-2">Nom du salon</label>
                <input
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="ex: general"
                    className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                />

                {channelCreateError && <div className="mt-3 text-sm text-red-400">{channelCreateError}</div>}

                <div className="mt-5 flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isChannelCreating}
                        className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={onCreate}
                        disabled={isChannelCreating}
                        className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                    >
                        {isChannelCreating ? "Création..." : "Créer"}
                    </button>
                </div>
            </div>
        </div>
    );
}
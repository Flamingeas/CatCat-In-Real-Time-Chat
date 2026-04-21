interface TemporaryBanModalProps {
    isOpen: boolean;
    onClose: () => void;
    username: string;
    duration: string;
    setDuration: (duration: string) => void;
    error: string | null;
    isBanning: boolean;
    onBan: () => void;
}

export function TemporaryBanModal({
    isOpen,
    onClose,
    username,
    duration,
    setDuration,
    error,
    isBanning,
    onBan,
}: TemporaryBanModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/70"
                onClick={() => !isBanning && onClose()}
            />

            <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">
                            Bannir temporairement
                        </h3>
                        <div className="text-xs text-[#DCCBC4]/50 mt-1">
                            Utilisateur : {username}
                        </div>
                    </div>

                    <button
                        onClick={() => !isBanning && onClose()}
                        className="text-[#DCCBC4]/60 hover:text-white cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                <label className="block text-sm text-[#DCCBC4]/70 mb-2">
                    Durée du bannissement
                </label>

                <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    disabled={isBanning}
                    className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                >
                    <option value="5">5 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 heure</option>
                    <option value="180">3 heures</option>
                    <option value="720">12 heures</option>
                    <option value="1440">24 heures</option>
                    <option value="10080">7 jours</option>
                </select>

                {error && (
                    <div className="mt-3 text-sm text-red-400">{error}</div>
                )}

                <div className="mt-5 flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isBanning}
                        className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                    >
                        Annuler
                    </button>

                    <button
                        onClick={onBan}
                        disabled={isBanning}
                        className="px-4 py-2 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-400 disabled:opacity-50 cursor-pointer"
                    >
                        {isBanning ? "Bannissement..." : "Confirmer"}
                    </button>
                </div>
            </div>
        </div>
    );
}
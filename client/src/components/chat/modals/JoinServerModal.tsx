"use client";

import { useTranslations } from "next-intl";

interface JoinServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    joinCode: string;
    setJoinCode: (code: string) => void;
    joinError: string | null;
    isJoining: boolean;
    onJoin: () => void;
}

export function JoinServerModal({
    isOpen,
    onClose,
    joinCode,
    setJoinCode,
    joinError,
    isJoining,
    onJoin,
}: JoinServerModalProps) {
    const t = useTranslations("joinServerModal");
    const tCommon = useTranslations("common");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => !isJoining && onClose()} />
            <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">{t("title")}</h3>
                    <button onClick={() => !isJoining && onClose()} className="text-[#DCCBC4]/60 hover:text-white">
                        ✕
                    </button>
                </div>
                <label className="block text-sm text-[#DCCBC4]/70 mb-2">{t("codeLabel")}</label>
                <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                    placeholder={t("codePlaceholder")}
                    maxLength={8}
                    className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                />
                {joinError && (
                    <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {joinError}
                    </div>
                )}
                <div className="mt-5 flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isJoining}
                        className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                    >
                        {tCommon("cancel")}
                    </button>
                    <button
                        onClick={onJoin}
                        disabled={isJoining}
                        className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                    >
                        {isJoining ? t("joining") : t("join")}
                    </button>
                </div>
            </div>
        </div>
    );
}

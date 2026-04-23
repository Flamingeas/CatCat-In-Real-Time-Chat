"use client";

import { useTranslations } from "next-intl";

interface CreateServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverName: string;
    setServerName: (name: string) => void;
    createError: string | null;
    isCreating: boolean;
    onCreate: () => void;
}

export function CreateServerModal({
    isOpen,
    onClose,
    serverName,
    setServerName,
    createError,
    isCreating,
    onCreate,
}: CreateServerModalProps) {
    const t = useTranslations("createServerModal");
    const tCommon = useTranslations("common");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => !isCreating && onClose()} />
            <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">{t("title")}</h3>
                    <button onClick={() => !isCreating && onClose()} className="text-[#DCCBC4]/60 hover:text-white cursor-pointer">
                        ✕
                    </button>
                </div>
                <label className="block text-sm text-[#DCCBC4]/70 mb-2">{t("nameLabel")}</label>
                <input
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                />
                {createError && <div className="mt-3 text-sm text-red-400">{createError}</div>}
                <div className="mt-5 flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="px-4 py-2 rounded-xl bg-transparent border border-[#ffffff]/10 text-[#DCCBC4] hover:bg-[#1E1211] disabled:opacity-50 cursor-pointer"
                    >
                        {tCommon("cancel")}
                    </button>
                    <button
                        onClick={onCreate}
                        disabled={isCreating}
                        className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                    >
                        {isCreating ? tCommon("creating") : tCommon("create")}
                    </button>
                </div>
            </div>
        </div>
    );
}

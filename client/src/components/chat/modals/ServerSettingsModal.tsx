"use client";
import { useTranslations } from "next-intl";

interface ServerSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedServer: { name: string } | null;
    settingsName: string;
    setSettingsName: (name: string) => void;
    deleteConfirm: string;
    setDeleteConfirm: (confirm: string) => void;
    settingsError: string | null;
    isSavingSettings: boolean;
    onSave: () => void;
    onDelete: () => void;
}

export function ServerSettingsModal({
    isOpen,
    onClose,
    selectedServer,
    settingsName,
    setSettingsName,
    deleteConfirm,
    setDeleteConfirm,
    settingsError,
    isSavingSettings,
    onSave,
    onDelete,
}: ServerSettingsModalProps) {
    const t = useTranslations("serverSettingsModal");
    const tCommon = useTranslations("common");

    if (!isOpen || !selectedServer) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => !isSavingSettings && onClose()} />
            <div className="relative w-full max-w-lg rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">{t("title")}</h3>
                        <div className="text-xs text-[#DCCBC4]/50 mt-1">{tCommon("server")} {selectedServer.name}</div>
                    </div>
                    <button onClick={() => !isSavingSettings && onClose()} className="text-[#DCCBC4]/60 hover:text-white">
                        ✕
                    </button>
                </div>
                <div className="rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-4">
                    <div className="text-white font-bold mb-2">{t("renameTitle")}</div>
                    <label className="block text-sm text-[#DCCBC4]/70 mb-2">{t("nameLabel")}</label>
                    <input
                        value={settingsName}
                        onChange={(e) => setSettingsName(e.target.value)}
                        className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none focus:ring-1 focus:ring-[#EB5E28]"
                    />
                    <div className="mt-4 flex justify-end gap-2">
                        <button
                            onClick={onSave}
                            disabled={isSavingSettings}
                            className="px-4 py-2 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white disabled:opacity-50 cursor-pointer"
                        >
                            {isSavingSettings ? tCommon("saving") : tCommon("save")}
                        </button>
                    </div>
                </div>
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-[#0a0605] p-4">
                    <div className="text-red-300 font-bold mb-1">{t("deleteTitle")}</div>
                    <div className="text-sm text-[#DCCBC4]/60">
                        {t("deleteWarning")}
                    </div>
                    <div className="mt-3">
                        <div className="text-xs text-[#DCCBC4]/50 mb-2">
                            {t("deleteConfirmHint")}
                        </div>
                        <input
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder="DELETE"
                            className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-red-500/20 focus:outline-none focus:ring-1 focus:ring-red-400"
                        />
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={onDelete}
                            disabled={isSavingSettings}
                            className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 disabled:opacity-50 cursor-pointer"
                        >
                            {isSavingSettings ? t("deleting") : tCommon("delete")}
                        </button>
                    </div>
                </div>
                {settingsError && <div className="mt-4 text-sm text-red-400">{settingsError}</div>}
            </div>
        </div>
    );
}
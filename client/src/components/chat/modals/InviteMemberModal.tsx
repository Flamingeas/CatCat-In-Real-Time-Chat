"use client";

import { useTranslations } from "next-intl";

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedServer: { name: string; invitation_code?: string } | null;
    inviteError: string | null;
    setInviteError: (error: string | null) => void;
    inviteCopied: boolean;
    setInviteCopied: (copied: boolean) => void;
}

export function InviteMemberModal({
    isOpen,
    onClose,
    selectedServer,
    inviteError,
    setInviteError,
    inviteCopied,
    setInviteCopied,
}: InviteMemberModalProps) {
    const t = useTranslations("inviteMemberModal");
    const tCommon = useTranslations("common");

    if (!isOpen || !selectedServer) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl bg-[#0F0908] border border-[#ffffff]/10 shadow-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-white font-bold font-[family-name:var(--font-nunito)] text-lg">{t("title")}</h3>
                        <div className="text-xs text-[#DCCBC4]/50 mt-1">{tCommon("server")} {selectedServer.name}</div>
                    </div>
                    <button onClick={onClose} className="text-[#DCCBC4]/60 hover:text-white">
                        ✕
                    </button>
                </div>
                <div className="rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] p-4">
                    <div className="text-white font-bold mb-2">{t("codeTitle")}</div>
                    <div className="text-sm text-[#DCCBC4]/60 mb-3">{t("codeHint")}</div>
                    <div className="flex gap-2">
                        <input
                            readOnly
                            value={selectedServer.invitation_code ?? ""}
                            className="flex-1 bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/10 focus:outline-none"
                        />
                        <button
                            onClick={async () => {
                                setInviteError(null);
                                const code = selectedServer?.invitation_code?.trim();
                                if (!code) return setInviteError(t("noCode"));
                                try {
                                    await navigator.clipboard.writeText(code);
                                    setInviteCopied(true);
                                    window.setTimeout(() => setInviteCopied(false), 1200);
                                } catch {
                                    setInviteError(t("copyFailed"));
                                }
                            }}
                            className="px-4 py-3 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white transition-colors cursor-pointer"
                        >
                            {inviteCopied ? t("copied") : t("copy")}
                        </button>
                    </div>
                    {inviteError && <div className="mt-3 text-sm text-red-400">{inviteError}</div>}
                </div>
                <div className="mt-4 text-xs text-[#DCCBC4]/40">{t("tip")}</div>
            </div>
        </div>
    );
}

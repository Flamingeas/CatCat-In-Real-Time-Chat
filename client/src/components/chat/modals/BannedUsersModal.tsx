"use client";
import { useTranslations } from "next-intl";
import BanList from "@/features/chat/components/ban-list";

interface BannedUsersModalProps {
    serverId: string;
    onClose: () => void;
}

export function BannedUsersModal({ serverId, onClose }: BannedUsersModalProps) {
    const t = useTranslations("bannedUsersModal");
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl p-6 w-[420px]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">{t("title")}</h2>
                    <button
                        onClick={onClose}
                        className="text-[#DCCBC4]/60 hover:text-white cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                <BanList serverId={serverId} />
            </div>
        </div>
    );
}

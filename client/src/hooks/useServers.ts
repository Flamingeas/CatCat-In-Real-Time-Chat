import { useState } from "react";
import { Server } from "@/types/chat";
import { api } from "@/lib/api";
import { joinServerByCode } from "@/features/chat/services/members.service";
import { formatDateTime } from "@/utils/chat";
import { getFriendlyErrorMessage, getTemporaryBanUntilFromError } from "@/utils/errors";
import { useTranslations, useLocale } from "next-intl";

export function useServers() {
    const t = useTranslations("joinServerModal");
    const tChat = useTranslations("chatPage");
    const locale = useLocale();
    const [servers, setServers] = useState<Server[]>([]);
    const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [serverName, setServerName] = useState("");
    const [createError, setCreateError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const [isJoinOpen, setIsJoinOpen] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    async function refreshServers(selectId?: string) {
        const list = await api<Server[]>("/api/servers");
        setServers(list);
        if (selectId) setSelectedServerId(selectId);
        else if (!selectedServerId && list.length > 0) setSelectedServerId(list[0].id);
    }

    async function createServer() {
        setCreateError(null);
        const name = serverName.trim();

        if (name.length < 3) {
            setCreateError(tChat("errors.nameTooShort"));
            return;
        }
        if (name.length > 50) {
            setCreateError(tChat("errors.nameTooLong"));
            return;
        }

        try {
            setIsCreating(true);
            const newServer = await api<Server>("/api/servers", {
                method: "POST",
                body: JSON.stringify({ name }),
            });
            await refreshServers(newServer.id);
            setIsCreateOpen(false);
            setServerName("");
        } catch (e) {
            setCreateError(getFriendlyErrorMessage(e, "createServer"));
        } finally {
            setIsCreating(false);
        }
    }

    async function joinServer() {
        setJoinError(null);
        const code = joinCode.trim().toUpperCase();
        if (code.length !== 8) {
            setJoinError(t("invalidLength"));
            return;
        }

        try {
            setIsJoining(true);
            const server = await joinServerByCode(code);
            await refreshServers(server.id);
            setIsJoinOpen(false);
            setJoinCode("");
        } catch (e) {
            const temporaryBanUntil = getTemporaryBanUntilFromError(e);
            if (temporaryBanUntil) {
                setJoinError(t("bannedUntil", { date: formatDateTime(temporaryBanUntil, locale) ?? temporaryBanUntil }));
            } else {
                setJoinError(getFriendlyErrorMessage(e, "joinServer"));
            }
        } finally {
            setIsJoining(false);
        }
    }

    return {
        servers,
        setServers,
        selectedServerId,
        setSelectedServerId,
        refreshServers,
        isCreateOpen,
        setIsCreateOpen,
        serverName,
        setServerName,
        createError,
        isCreating,
        createServer,
        isJoinOpen,
        setIsJoinOpen,
        joinCode,
        setJoinCode,
        joinError,
        isJoining,
        joinServer,
    };
}

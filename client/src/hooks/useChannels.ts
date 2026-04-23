import { useState } from "react";
import { Channel } from "@/types/chat";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/utils/errors";
import { useTranslations } from "next-intl";

export function useChannels() {
    const t = useTranslations("chatPage.errors");
    const [channels, setChannels] = useState<Channel[]>([]);

    const [isChannelCreateOpen, setIsChannelCreateOpen] = useState(false);
    const [channelName, setChannelName] = useState("");
    const [channelCreateError, setChannelCreateError] = useState<string | null>(null);
    const [isChannelCreating, setIsChannelCreating] = useState(false);

    const [isChannelEditOpen, setIsChannelEditOpen] = useState(false);
    const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
    const [channelEditName, setChannelEditName] = useState("");
    const [channelEditError, setChannelEditError] = useState<string | null>(null);
    const [isChannelEditing, setIsChannelEditing] = useState(false);

    async function createChannel(serverId: string) {
        setChannelCreateError(null);
        const name = channelName.trim();

        if (name.length < 3) {
            setChannelCreateError(t("nameTooShort"));
            return null;
        }
        if (name.length > 50) {
            setChannelCreateError(t("nameTooLong"));
            return null;
        }

        try {
            setIsChannelCreating(true);
            const newChannel = await api<Channel>(`/api/servers/${serverId}/channels`, {
                method: "POST",
                body: JSON.stringify({ name }),
            });
            setChannels((prev) => [...prev, newChannel]);
            setIsChannelCreateOpen(false);
            setChannelName("");
            return newChannel;
        } catch (e) {
            setChannelCreateError(getFriendlyErrorMessage(e, "createChannel"));
            return null;
        } finally {
            setIsChannelCreating(false);
        }
    }

    async function editChannel(serverId: string, channelId: string) {
        setChannelEditError(null);
        const name = channelEditName.trim();

        if (name.length < 3) {
            setChannelEditError(t("nameTooShort"));
            return;
        }
        if (name.length > 50) {
            setChannelEditError(t("nameTooLong"));
            return;
        }

        try {
            setIsChannelEditing(true);
            await api(`/api/servers/${serverId}/channels/${channelId}`, {
                method: "PATCH",
                body: JSON.stringify({ name }),
            });
            setChannels((prev) => prev.map((c) => (String(c.id) === String(channelId) ? { ...c, name } : c)));
            setIsChannelEditOpen(false);
            setEditingChannelId(null);
            setChannelEditName("");
        } catch (e) {
            setChannelEditError(getFriendlyErrorMessage(e, "editChannel"));
        } finally {
            setIsChannelEditing(false);
        }
    }

    function openEditChannel(channel: Channel) {
        setEditingChannelId(String(channel.id));
        setChannelEditName(channel.name);
        setChannelEditError(null);
        setIsChannelEditOpen(true);
    }

    return {
        channels,
        setChannels,
        isChannelCreateOpen,
        setIsChannelCreateOpen,
        channelName,
        setChannelName,
        channelCreateError,
        setChannelCreateError,
        isChannelCreating,
        createChannel,
        isChannelEditOpen,
        setIsChannelEditOpen,
        editingChannelId,
        channelEditName,
        setChannelEditName,
        channelEditError,
        isChannelEditing,
        editChannel,
        openEditChannel,
    };
}

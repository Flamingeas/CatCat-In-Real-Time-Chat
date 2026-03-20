import { api } from "@/lib/api";
import { pushToast } from "@/features/chat/handlers/toast.handler";

type Channel = {
    id: string;
    name: string;
    created_at?: string;
    updated_at?: string;
};

type ReloadChannelsParams = {
    serverId: string;
    setChannels: React.Dispatch<React.SetStateAction<Channel[]>>;
    setSelectedChannelId: React.Dispatch<React.SetStateAction<string | null>>;
};

export default async function reloadChannels({
    serverId,
    setChannels,
    setSelectedChannelId,
}: ReloadChannelsParams) {
    try {
        const list = await api<Channel[]>(`/api/servers/${serverId}/channels`);

        setChannels(list);
        setSelectedChannelId((prev) => {
            if (prev && list.some((c) => String(c.id) === String(prev))) {
                return prev;
            }
            return list.length ? String(list[0].id) : null;
        });
    } catch (e: any) {
        const msg = String(e?.message ?? "");

        if (msg.startsWith("403")) pushToast("Accès refusé aux salons (403)", "warn");
        if (msg.startsWith("404")) pushToast("Salons introuvables (404)", "warn");

        setChannels([]);
        setSelectedChannelId(null);
    }
}
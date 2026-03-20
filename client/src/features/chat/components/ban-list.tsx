"use client";

import { useEffect, useState } from "react";
import { getServerBans, unbanMember, type ServerBan } from "../services/bans.service";

type WsBanEvent =
  | {
      type: "server_member_unbanned";
      server_id: string;
      user_id: string;
      username: string;
    }
  | {
      type: "server_member_banned";
      server_id: string;
      user_id: string;
      username: string;
    };

export default function BanList({ serverId }: { serverId: string }) {
  const [bans, setBans] = useState<ServerBan[]>([]);

  useEffect(() => {
    getServerBans(serverId).then(setBans);
  }, [serverId]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const ws = new WebSocket("ws://127.0.0.1:8080/ws");

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
      ws.send(JSON.stringify({ type: "join_server", server_id: serverId }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as WsBanEvent;

      if (msg.type === "server_member_unbanned") {
        if (String(msg.server_id) !== String(serverId)) return;

        setBans((prev) => prev.filter((b) => String(b.user_id) !== String(msg.user_id)));
      }

      if (msg.type === "server_member_banned") {
        if (String(msg.server_id) !== String(serverId)) return;

        getServerBans(serverId).then(setBans);
      }
    };

    return () => {
      ws.close();
    };
  }, [serverId]);

  async function handleUnban(userId: string) {
    await unbanMember(serverId, userId);
    setBans((prev) => prev.filter((b) => b.user_id !== userId));
  }

  function getBanLabel(expiresAt?: string | null) {
    if (!expiresAt) return "Ban permanent";
    return `Ban temporaire jusqu’au ${new Date(expiresAt).toLocaleString("fr-FR")}`;
  }

  return (
    <div className="flex flex-col gap-2">
      {bans.length === 0 && (
        <div className="text-sm text-[#DCCBC4]/50">
          Aucun ban actif.
        </div>
      )}

      {bans.map((ban) => (
        <div
          key={ban.user_id}
          className="flex justify-between items-start p-3 bg-[#0F0908] rounded-xl border border-[#ffffff]/10"
        >
          <div className="flex flex-col gap-1">
            <span className="text-white font-semibold">{ban.username}</span>

            <span className="text-xs text-[#DCCBC4]/60">
              {getBanLabel(ban.expires_at)}
            </span>

            {ban.reason && (
              <span className="text-xs text-[#DCCBC4]/40">
                Raison : {ban.reason}
              </span>
            )}
          </div>

          <button
            onClick={() => handleUnban(ban.user_id)}
            className="text-red-400 hover:text-red-300 text-sm cursor-pointer"
          >
            Retirer le bannissement
          </button>
        </div>
      ))}
    </div>
  );
}
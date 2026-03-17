import { MemberRole } from "../services/members.service"

type Props = {
  username: string
  userId: string
  serverId: string
  role?: MemberRole
  onKick: (serverId: string, userId: string) => void
  onBan: (serverId: string, userId: string) => void
  onSetRole: (serverId: string, userId: string, role: MemberRole) => void
  onTransferOwner: (serverId: string, userId: string) => void
}

export function MemberActionsMenu({
  username,
  userId,
  serverId,
  role,
  onKick,
  onBan,
  onSetRole,
  onTransferOwner,
}: Props) {
  return (
    <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-[#ffffff]/10 bg-[#0a0605] shadow-2xl overflow-hidden z-50">
      <button
        onClick={() => {
          const nextRole = role === "admin" ? "member" : "admin"
          if (!window.confirm(`${nextRole === "admin" ? "Rendre admin" : "Retirer admin"} ${username} ?`)) return
          onSetRole(serverId, userId, nextRole)
        }}
        className="w-full text-left px-4 py-3 text-sm hover:bg-[#0F0908] cursor-pointer"
      >
        {role === "admin" ? "Retirer admin" : "Rendre admin"}
      </button>

      <div className="h-px bg-[#ffffff]/10" />

      <button
        onClick={() => {
          if (!window.confirm(`Mettre ${username} owner ?`)) return
          onTransferOwner(serverId, userId)
        }}
        className="w-full text-left px-4 py-3 text-sm hover:bg-[#0F0908] cursor-pointer"
      >
        Rendre propriétaire
      </button>

      <div className="h-px bg-[#ffffff]/10" />

      <button
        onClick={() => {
          if (!window.confirm(`Expulser ${username} ?`)) return
          onKick(serverId, userId)
        }}
        className="w-full text-left px-4 py-3 text-sm text-red-300 hover:bg-[#0F0908] cursor-pointer"
      >
        Expulser
      </button>

      <button
        onClick={() => {
          if (!window.confirm(`Bannir définitivement ${username} ?`)) return
          onBan(serverId, userId)
        }}
        className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-[#0F0908] cursor-pointer"
      >
        Bannir définitivement
      </button>
    </div>
  )
}
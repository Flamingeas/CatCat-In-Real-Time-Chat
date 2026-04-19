import { useState } from "react";
import { X, Save } from "lucide-react";

export function UserSettingsModal({ onClose, me, onSendEmail }) {
    const [username, setUsername] = useState(me?.username || "");
    const [email, setEmail] = useState(me?.email || "");
    const [password, setPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    async function handleSave(e) {
        e.preventDefault();
        setIsSaving(true);
        try {
            // TODO: Ton appel API réel pour modifier l'utilisateur en base de données
            console.log("Sauvegarde des données:", { username, email, password });
            await new Promise(r => setTimeout(r, 800)); // Simule l'attente réseau
            
            // On déclenche l'email de notification !
            if (onSendEmail) {
                onSendEmail(username, email, "update");
            }
            
            onClose();
        } catch (error) {
            console.error("Erreur de sauvegarde");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 font-[family-name:var(--font-nunito)]">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-[#0F0908] border border-[#ffffff]/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-[#ffffff]/5 flex justify-between items-center bg-[#1E1211]/50">
                    <h2 className="text-xl font-bold text-white">Paramètres Utilisateur</h2>
                    <button onClick={onClose} className="text-[#DCCBC4]/50 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-[#ffffff]/5">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs uppercase tracking-wider text-[#DCCBC4]/70 font-bold">Nom d'utilisateur</label>
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/5 focus:outline-none focus:border-[#EB5E28] transition-colors" placeholder="Ton pseudo..." />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs uppercase tracking-wider text-[#DCCBC4]/70 font-bold">Adresse Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/5 focus:outline-none focus:border-[#EB5E28] transition-colors" placeholder="ton@email.com" />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs uppercase tracking-wider text-[#DCCBC4]/70 font-bold">Nouveau mot de passe</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#1E1211] text-[#DCCBC4] rounded-xl px-4 py-3 border border-[#ffffff]/5 focus:outline-none focus:border-[#EB5E28] transition-colors" placeholder="Laisser vide pour ne pas changer" />
                    </div>

                    <div className="mt-4 flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-white font-bold hover:bg-[#ffffff]/5 transition-colors cursor-pointer">Annuler</button>
                        <button type="submit" disabled={isSaving} className="px-5 py-2.5 rounded-xl bg-[#EB5E28] text-[#1E1211] font-bold hover:bg-white transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50">
                            <Save className="w-4 h-4" />
                            {isSaving ? "Sauvegarde..." : "Enregistrer"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
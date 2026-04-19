"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { Nunito, Fredoka } from "next/font/google";
import { 
    MessageSquare, Hash, Plus, LogIn, Settings, LogOut, 
    Send, Smile, Image as ImageIcon, Trash2, Heart, ArrowRight, X
} from "lucide-react";

import logoImage from "../../images/logo_catcat.svg"; // Ajuste le chemin

// --- POLICES ---
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", weight: ["600", "700"] });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "700"] });

export default function DemoPage() {
    // --- ÉTATS LOCAUX (Rien n'est sauvegardé en base) ---
    const [servers, setServers] = useState([{ id: 1, name: "CatCat Accueil", initials: "CC" }]);
    const [messages, setMessages] = useState([
        { id: 1, author: "Système", content: "Bienvenue dans le bac à sable ! 🐾", time: "12:00", isSystem: true },
    ]);
    const [inputText, setInputText] = useState("");
    const [hoveredMessage, setHoveredMessage] = useState(null);

    // --- SYSTÈME DE TUTORIEL ---
    const [step, setStep] = useState(0);

    const steps = [
        { id: 0, title: "Bienvenue dans la Démo !", text: "Ici, rien n'est sauvegardé. Faisons un petit tour rapide de l'interface ensemble.", target: "center" },
        { id: 1, title: "Étape 1 : Les Serveurs", text: "C'est ici que tu navigues. Clique sur le bouton '+' pour simuler la création d'un nouveau serveur.", target: "sidebar-add" },
        { id: 2, title: "Étape 2 : Le Chat", text: "Écris un message dans la barre en bas et appuie sur Entrée ou sur le bouton Envoyer.", target: "chat-input" },
        { id: 3, title: "Étape 3 : Interactions", text: "Passe ta souris sur ton message. Tu peux réagir avec un emoji ou cliquer sur la corbeille pour le supprimer.", target: "message-list" },
        { id: 4, title: "Étape 4 : La Communauté", text: "À droite, tu vois les membres. Sur le vrai CatCat, tu pourras gérer les rôles, bannir ou expulser.", target: "member-area" },
        { id: 5, title: "Tu es prêt ! 🎉", text: "Tu as compris les bases. Amuse-toi à tester, ou crée ton vrai compte pour rejoindre la communauté !", target: "center" }
    ];

    const currentStep = steps[step];

    // --- ACTIONS DE DÉMO ---
    const handleAddServer = () => {
        if (step === 1) setStep(2);
        setServers([...servers, { id: Date.now(), name: "Nouveau Serveur", initials: "NS" }]);
    };

    const handleSendMessage = (e) => {
        e?.preventDefault();
        if (!inputText.trim()) return;
        if (step === 2) setStep(3);
        
        const newMsg = {
            id: Date.now(),
            author: "Toi (Invité)",
            content: inputText,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            reactions: 0
        };
        setMessages([...messages, newMsg]);
        setInputText("");
    };

    const handleDeleteMessage = (id) => {
        setMessages(messages.filter(m => m.id !== id));
        if (step === 3) setStep(4);
    };

    const handleReactMessage = (id) => {
        setMessages(messages.map(m => m.id === id ? { ...m, reactions: (m.reactions || 0) + 1 } : m));
        if (step === 3) setStep(4);
    };

    const nextStep = () => { if (step < steps.length - 1) setStep(step + 1); };

    // Composant Tooltip (La popup orange du tuto)
    const TutorialTooltip = ({ title, text, positionClasses }) => (
        <div className={`absolute z-50 w-72 bg-[#EB5E28] text-[#1E1211] p-5 rounded-2xl shadow-[0_0_40px_rgba(235,94,40,0.4)] animate-bounce-slow ${positionClasses}`}>
            <h3 className="font-[family-name:var(--font-fredoka)] font-bold text-xl mb-2">{title}</h3>
            <p className="font-[family-name:var(--font-nunito)] font-bold text-sm mb-4 leading-relaxed">{text}</p>
            <div className="flex justify-between items-center">
                <span className="text-xs font-bold opacity-60">{step + 1} / {steps.length}</span>
                <button onClick={nextStep} className="px-3 py-1.5 bg-[#1E1211] text-[#EB5E28] rounded-lg text-xs font-bold hover:bg-white transition-colors flex items-center gap-1">
                    Passer <ArrowRight className="w-3 h-3" />
                </button>
            </div>
        </div>
    );

    return (
        <div className={`flex h-screen bg-black text-[#DCCBC4] ${fredoka.variable} ${nunito.variable} font-sans overflow-hidden p-[8px] gap-[8px]`}>
            
            {/* BOUTON QUITTER LA DÉMO */}
            <Link href="/" className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-2 bg-[#1E1211] text-[#DCCBC4] border border-[#ffffff]/10 rounded-full font-bold text-sm hover:bg-[#EB5E28] hover:text-[#1E1211] hover:border-transparent transition-all flex items-center gap-2 shadow-xl">
                <X className="w-4 h-4" /> Quitter la Démo
            </Link>

            {/* OVERLAY BIENVENUE & FIN */}
            {(step === 0 || step === 5) && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#1E1211] border border-[#EB5E28]/50 p-8 rounded-3xl max-w-md text-center shadow-[0_0_60px_rgba(235,94,40,0.2)]">
                        <div className="w-16 h-16 bg-[#EB5E28] rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl">
                            {step === 0 ? "👋" : "🚀"}
                        </div>
                        <h2 className="font-[family-name:var(--font-fredoka)] font-bold text-3xl text-white mb-4">{currentStep.title}</h2>
                        <p className="font-[family-name:var(--font-nunito)] text-lg text-[#DCCBC4]/80 mb-8">{currentStep.text}</p>
                        
                        {step === 0 ? (
                            <button onClick={nextStep} className="w-full py-3 bg-[#EB5E28] text-[#1E1211] rounded-xl font-bold text-lg hover:bg-white transition-colors">
                                Commencer la visite
                            </button>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <Link href="/login" className="w-full py-3 bg-[#EB5E28] text-[#1E1211] rounded-xl font-bold text-lg hover:bg-white transition-colors block">
                                    Créer un vrai compte
                                </Link>
                                <button onClick={() => setStep(1)} className="w-full py-3 bg-[#0F0908] text-[#DCCBC4] rounded-xl font-bold text-sm hover:bg-[#ffffff]/5 transition-colors">
                                    Recommencer la visite
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* === COLONNE 1 : SERVEURS === */}
            <div className="relative w-[72px] bg-[#1E1211] rounded-[20px] flex flex-col items-center py-6 gap-4 z-20 shadow-lg shrink-0">
                <div className="w-12 h-12 relative flex items-center justify-center">
                    <Image src={logoImage} alt="Logo" className="w-10 h-10 object-contain" />
                </div>
                <div className="w-8 h-[2px] bg-[#ffffff]/10 rounded-full" />
                
                {/* Liste des faux serveurs */}
                <div className="flex flex-col gap-3">
                    {servers.map((s, i) => (
                        <div key={s.id} className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all cursor-pointer flex items-center justify-center font-bold text-sm ${i === 0 ? "bg-[#EB5E28] text-white" : "bg-[#2A1A18] text-[#EB5E28]"}`}>
                            {s.initials}
                        </div>
                    ))}
                </div>

                {/* Bouton Ajouter */}
                <div className="relative mt-2">
                    <button onClick={handleAddServer} className={`w-12 h-12 bg-[#2A1A18] rounded-[24px] hover:rounded-[16px] text-[#EB5E28] hover:text-white hover:bg-[#EB5E28] flex items-center justify-center transition-all cursor-pointer ${step === 1 ? "ring-4 ring-[#EB5E28] ring-offset-4 ring-offset-[#1E1211] animate-pulse" : ""}`}>
                        <Plus className="w-6 h-6" />
                    </button>
                    {step === 1 && <TutorialTooltip title={currentStep.title} text={currentStep.text} positionClasses="left-16 top-0" />}
                </div>

                {/* Faux profil en bas */}
                <div className="mt-auto w-10 h-10 bg-[#bef264] rounded-full flex items-center justify-center text-[#1E1211] font-bold text-xs border-2 border-[#1E1211]" >
                    IN
                </div>
            </div>

            {/* === COLONNE 2 : SALONS === */}
            <div className="hidden md:flex w-60 bg-[#0F0908] rounded-[20px] flex-col overflow-hidden shrink-0">
                <div className="h-14 flex items-center px-4 border-b border-[#ffffff]/5 font-bold text-white shadow-sm font-[family-name:var(--font-fredoka)]">
                    CatCat Accueil
                </div>
                <div className="p-3 flex flex-col gap-1 flex-1 overflow-y-auto">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#ffffff]/10 text-white font-bold cursor-pointer">
                        <Hash className="w-4 h-4 opacity-50" /> général
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#DCCBC4]/60 hover:bg-[#ffffff]/5 cursor-pointer font-bold">
                        <Hash className="w-4 h-4 opacity-50" /> memes-et-chats
                    </div>
                </div>
            </div>

            {/* === COLONNE 3 : CHAT === */}
            <div className="flex-1 bg-[#0a0605] rounded-[20px] flex flex-col overflow-hidden relative border border-[#ffffff]/5">
                
                {/* Header */}
                <div className="h-14 flex items-center px-4 border-b border-[#ffffff]/5 bg-[#0a0605]/80 backdrop-blur-md z-10 shrink-0">
                    <Hash className="w-5 h-5 text-[#DCCBC4]/40 mr-2" />
                    <span className="font-bold text-white font-[family-name:var(--font-fredoka)]">général</span>
                </div>

                {/* Liste des messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 flex flex-col relative">
                    {step === 3 && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
                            <TutorialTooltip title={currentStep.title} text={currentStep.text} positionClasses="" />
                        </div>
                    )}
                    
                    {messages.map((msg) => (
                        <div 
                            key={msg.id} 
                            className={`flex gap-4 group px-4 py-2 hover:bg-[#ffffff]/5 rounded-xl transition-colors relative ${step === 3 && !msg.isSystem ? "ring-2 ring-[#EB5E28]/50 bg-[#EB5E28]/5" : ""}`}
                            onMouseEnter={() => setHoveredMessage(msg.id)}
                            onMouseLeave={() => setHoveredMessage(null)}
                        >
                            <div className={`w-10 h-10 rounded-full flex shrink-0 items-center justify-center font-bold text-sm ${msg.isSystem ? "bg-[#EB5E28] text-[#1E1211]" : "bg-[#1E1211] text-[#DCCBC4]"}`}>
                                {msg.isSystem ? "🐾" : "IN"}
                            </div>
                            <div className="flex flex-col w-full">
                                <div className="flex items-baseline gap-2">
                                    <span className={`font-bold font-[family-name:var(--font-fredoka)] ${msg.isSystem ? "text-[#EB5E28]" : "text-white"}`}>{msg.author}</span>
                                    <span className="text-xs text-[#DCCBC4]/40">{msg.time}</span>
                                </div>
                                <p className="text-[#DCCBC4] font-[family-name:var(--font-nunito)] mt-1">{msg.content}</p>
                                
                                {msg.reactions > 0 && (
                                    <div className="mt-2 flex gap-1">
                                        <div className="bg-[#EB5E28]/20 border border-[#EB5E28]/30 text-[#EB5E28] px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1">
                                            ❤️ {msg.reactions}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Options au survol (Uniquement sur nos propres messages) */}
                            {hoveredMessage === msg.id && !msg.isSystem && (
                                <div className="absolute -top-4 right-4 bg-[#1E1211] border border-[#ffffff]/10 rounded-lg shadow-xl flex items-center overflow-hidden">
                                    <button onClick={() => handleReactMessage(msg.id)} className="p-2 hover:bg-[#ffffff]/10 text-[#DCCBC4] hover:text-[#EB5E28] transition-colors" title="Réagir">
                                        <Heart className="w-4 h-4" />
                                    </button>
                                    <div className="w-px h-4 bg-[#ffffff]/10" />
                                    <button onClick={() => handleDeleteMessage(msg.id)} className="p-2 hover:bg-[#ffffff]/10 text-[#DCCBC4] hover:text-red-400 transition-colors" title="Supprimer">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="p-4 shrink-0 relative">
                    {step === 2 && <TutorialTooltip title={currentStep.title} text={currentStep.text} positionClasses="bottom-full mb-4 left-1/2 -translate-x-1/2" />}
                    
                    <form onSubmit={handleSendMessage} className={`bg-[#1E1211] rounded-2xl p-2 flex items-center gap-2 border ${step === 2 ? "border-[#EB5E28] shadow-[0_0_20px_rgba(235,94,40,0.2)]" : "border-[#ffffff]/5 focus-within:border-[#ffffff]/20"} transition-all`}>
                        <button type="button" className="p-2 text-[#DCCBC4]/50 hover:text-white transition-colors bg-[#ffffff]/5 rounded-xl">
                            <Plus className="w-5 h-5" />
                        </button>
                        <input 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Envoyer un message de test..." 
                            className="flex-1 bg-transparent border-none focus:outline-none text-white px-2 placeholder-[#DCCBC4]/30 font-[family-name:var(--font-nunito)]"
                        />
                        <button type="button" className="p-2 text-[#DCCBC4]/50 hover:text-white transition-colors hidden sm:block">
                            <Smile className="w-5 h-5" />
                        </button>
                        <button type="submit" disabled={!inputText.trim()} className="p-2 bg-[#EB5E28] text-[#1E1211] rounded-xl disabled:opacity-50 disabled:bg-[#ffffff]/5 disabled:text-[#DCCBC4]/30 hover:bg-white transition-colors">
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>

            {/* === COLONNE 4 : MEMBRES === */}
            <div className="hidden lg:flex w-60 bg-[#0F0908] rounded-[20px] flex-col overflow-hidden shrink-0 relative">
                
                {step === 4 && <TutorialTooltip title={currentStep.title} text={currentStep.text} positionClasses="right-[105%] top-1/2 -translate-y-1/2" />}
                
                <div className="p-4 flex-1 overflow-y-auto">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#DCCBC4]/50 mb-3 font-[family-name:var(--font-fredoka)]">
                        En ligne — 2
                    </h3>
                    
                    {/* Membre Admin (Bot/Système) */}
                    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#ffffff]/5 cursor-pointer group mb-1">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-[#EB5E28] flex items-center justify-center text-xs font-bold text-[#1E1211]">🐾</div>
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#0F0908] rounded-full" />
                        </div>
                        <span className="font-bold text-[#EB5E28] truncate text-sm">Bot CatCat</span>
                    </div>

                    {/* Membre Invité (Nous) */}
                    <div className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer group ${step === 4 ? "bg-[#EB5E28]/10 ring-2 ring-[#EB5E28]/50" : "hover:bg-[#ffffff]/5"}`}>
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-[#1E1211] flex items-center justify-center text-xs font-bold text-[#DCCBC4]">IN</div>
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#0F0908] rounded-full" />
                        </div>
                        <span className="font-bold text-[#DCCBC4] truncate text-sm">Toi (Invité)</span>
                    </div>
                </div>
            </div>
            
            {/* Ajout d'une balise de style pour la petite animation de la popup */}
            <style jsx global>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 3s ease-in-out infinite;
                }
            `}</style>

        </div>
    );
}
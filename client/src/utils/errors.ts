type ErrorContext =
    | "createServer"
    | "joinServer"
    | "createChannel"
    | "editChannel"
    | "loadMembers"
    | "loadChannels"
    | "loadMessages"
    | "serverSettings"
    | "deleteServer"
    | "leaveServer"
    | "temporaryBan"
    | "generic";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error ?? "");
}

function getStatusCode(message: string) {
    const match = message.match(/^(\d{3})\b/);
    return match ? Number(match[1]) : null;
}

function extractErrorBody(rawMessage: string) {
    const separator = rawMessage.indexOf(" - ");
    return separator >= 0 ? rawMessage.slice(separator + 3).trim() : rawMessage.trim();
}

function findDateValue(value: unknown): string | null {
    if (!value) return null;

    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : value;
    }

    if (typeof value !== "object") return null;

    const banDateKeys = [
        "until",
        "expires_at",
        "expiresAt",
        "banned_until",
        "bannedUntil",
        "ban_until",
        "banUntil",
        "temporary_ban_until",
        "temporaryBanUntil",
    ];
    const record = value as Record<string, unknown>;

    for (const key of banDateKeys) {
        const found = findDateValue(record[key]);
        if (found) return found;
    }

    for (const nested of Object.values(record)) {
        if (!nested || typeof nested !== "object") continue;
        const found = findDateValue(nested);
        if (found) return found;
    }

    return null;
}

export function getTemporaryBanUntilFromError(error: unknown) {
    const rawMessage = getErrorMessage(error);
    const body = extractErrorBody(rawMessage);

    try {
        const payload = JSON.parse(body);
        const found = findDateValue(payload);
        if (found) return found;
    } catch {}

    const isoDateMatch = body.match(/\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/);
    if (!isoDateMatch) return null;

    const found = isoDateMatch[0];
    const parsed = new Date(found);
    return Number.isNaN(parsed.getTime()) ? null : found;
}

export function getFriendlyErrorMessage(error: unknown, context: ErrorContext = "generic") {
    const rawMessage = getErrorMessage(error);
    const message = rawMessage.toLowerCase();
    const status = getStatusCode(rawMessage);

    if (message.includes("failed to fetch") || message.includes("network")) {
        return "Impossible de contacter le serveur. Vérifie ta connexion puis réessaie.";
    }

    if (context === "joinServer") {
        if (status === 400) return "Ce code d’invitation n’est pas valide. Vérifie les 8 caractères et réessaie.";
        if (status === 403) return message.includes("ban") ? "Tu ne peux pas rejoindre ce serveur pour le moment." : "Tu n’as pas l’autorisation de rejoindre ce serveur.";
        if (status === 404) return "Aucun serveur ne correspond à ce code. Vérifie le code ou demande une nouvelle invitation.";
        if (status === 409 || message.includes("already") || message.includes("déjà")) return "Tu es déjà membre de ce serveur.";
    }

    if (status === 400) {
        if (context === "createServer") return "Le nom du serveur n’est pas valide. Utilise entre 3 et 50 caractères.";
        if (context === "createChannel" || context === "editChannel") return "Le nom du salon n’est pas valide. Utilise entre 3 et 50 caractères.";
        if (context === "temporaryBan") return "La durée du bannissement n’est pas valide.";
        return "La demande envoyée n’est pas valide. Vérifie les informations et réessaie.";
    }

    if (status === 401) return "Ta session a expiré. Reconnecte-toi pour continuer.";
    if (status === 403) return "Tu n’as pas les droits nécessaires pour effectuer cette action.";

    if (status === 404) {
        if (context === "loadMembers") return "Impossible de charger les membres: serveur introuvable.";
        if (context === "loadChannels") return "Impossible de charger les salons: serveur introuvable.";
        if (context === "loadMessages") return "Impossible de charger les messages: salon introuvable.";
        if (context === "deleteServer" || context === "serverSettings" || context === "leaveServer") return "Ce serveur n’existe plus.";
        return "L’élément demandé est introuvable.";
    }

    if (status === 409) return "Cette action entre en conflit avec l’état actuel. Rafraîchis la page puis réessaie.";
    if (status && status >= 500) return "Le serveur a rencontré un problème. Réessaie dans quelques instants.";

    switch (context) {
        case "createServer":
            return "Impossible de créer le serveur pour le moment.";
        case "createChannel":
            return "Impossible de créer le salon pour le moment.";
        case "editChannel":
            return "Impossible de modifier le salon pour le moment.";
        case "loadMembers":
            return "Impossible de charger les membres.";
        case "loadChannels":
            return "Impossible de charger les salons.";
        case "loadMessages":
            return "Impossible de charger les messages.";
        case "serverSettings":
            return "Impossible de sauvegarder les paramètres du serveur.";
        case "deleteServer":
            return "Impossible de supprimer le serveur.";
        case "leaveServer":
            return "Impossible de quitter le serveur.";
        case "temporaryBan":
            return "Impossible de bannir temporairement ce membre.";
        default:
            return "Une erreur est survenue. Réessaie dans quelques instants.";
    }
}

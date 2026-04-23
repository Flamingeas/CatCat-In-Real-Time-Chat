import { ApiError } from "@/lib/api";

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

type Locale = "fr" | "en";

function getClientLocale(): Locale {
  if (typeof document !== "undefined") {
    const cookie = document.cookie
      .split("; ")
      .find((part) => part.startsWith("locale="))
      ?.split("=")[1];
    if (cookie === "en" || cookie === "fr") return cookie;
  }

  if (typeof window !== "undefined") {
    const lang = window.localStorage.getItem("locale");
    if (lang === "en" || lang === "fr") return lang;
  }

  return "fr";
}

function t(locale: Locale, fr: string, en: string) {
  return locale === "en" ? en : fr;
}

function normalizeError(error: unknown) {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) return new ApiError({ status: 0, statusText: "", message: error.message });
  return new ApiError({ status: 0, statusText: "", message: String(error ?? "") });
}

function findDateValue(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : value;
  }

  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const keys = ["until", "expires_at", "expiresAt", "banned_until", "bannedUntil"];

  for (const key of keys) {
    const found = findDateValue(record[key]);
    if (found) return found;
  }

  for (const nested of Object.values(record)) {
    const found = findDateValue(nested);
    if (found) return found;
  }

  return null;
}

export function getTemporaryBanUntilFromError(error: unknown) {
  const apiError = normalizeError(error);
  return findDateValue(apiError.payload) ?? findDateValue(apiError.message);
}

export function getFriendlyErrorMessage(error: unknown, context: ErrorContext = "generic") {
  const locale = getClientLocale();
  const apiError = normalizeError(error);
  const code = apiError.code;
  const status = apiError.status;
  const message = apiError.message.toLowerCase();

  if (message.includes("failed to fetch") || message.includes("network")) {
    return t(
      locale,
      "Impossible de contacter le serveur. Vérifie ta connexion puis réessaie.",
      "Unable to reach the server. Check your connection and try again."
    );
  }

  switch (code) {
    case "INVALID_INVITATION_CODE":
      return t(locale, "Ce code d’invitation n’est pas valide. Vérifie les 8 caractères et réessaie.", "This invitation code is invalid. Check the 8 characters and try again.");
    case "SERVER_NOT_FOUND":
      return t(locale, "Ce serveur n’existe plus.", "This server no longer exists.");
    case "ALREADY_SERVER_MEMBER":
      return t(locale, "Tu es déjà membre de ce serveur.", "You are already a member of this server.");
    case "INVALID_BAN_DURATION":
      return t(locale, "La durée du bannissement n’est pas valide.", "The ban duration is not valid.");
    case "VALIDATION_ERROR":
      if (context === "createServer") return t(locale, "Le nom du serveur n’est pas valide. Utilise entre 3 et 50 caractères.", "The server name is invalid. Use between 3 and 50 characters.");
      if (context === "createChannel" || context === "editChannel") return t(locale, "Le nom du salon n’est pas valide. Utilise entre 3 et 50 caractères.", "The channel name is invalid. Use between 3 and 50 characters.");
      return t(locale, "La demande envoyée n’est pas valide. Vérifie les informations et réessaie.", "The request is invalid. Check the information and try again.");
    case "PERMISSION_DENIED":
      return t(locale, "Tu n’as pas les droits nécessaires pour effectuer cette action.", "You do not have permission to perform this action.");
    case "UNAUTHORIZED":
    case "AUTH_LOGIN_FAILED":
      return t(locale, "Ta session a expiré. Reconnecte-toi pour continuer.", "Your session has expired. Sign in again to continue.");
  }

  if (context === "joinServer") {
    if (status === 400) return t(locale, "Ce code d’invitation n’est pas valide. Vérifie les 8 caractères et réessaie.", "This invitation code is invalid. Check the 8 characters and try again.");
    if (status === 403) return t(locale, "Tu ne peux pas rejoindre ce serveur pour le moment.", "You cannot join this server right now.");
    if (status === 404) return t(locale, "Aucun serveur ne correspond à ce code. Vérifie le code ou demande une nouvelle invitation.", "No server matches this code. Check the code or ask for a new invitation.");
    if (status === 409) return t(locale, "Tu es déjà membre de ce serveur.", "You are already a member of this server.");
  }

  if (status === 400) {
    if (context === "temporaryBan") return t(locale, "La durée du bannissement n’est pas valide.", "The ban duration is not valid.");
    return t(locale, "La demande envoyée n’est pas valide. Vérifie les informations et réessaie.", "The request is invalid. Check the information and try again.");
  }

  if (status === 401) return t(locale, "Ta session a expiré. Reconnecte-toi pour continuer.", "Your session has expired. Sign in again to continue.");
  if (status === 403) return t(locale, "Tu n’as pas les droits nécessaires pour effectuer cette action.", "You do not have permission to perform this action.");

  if (status === 404) {
    if (context === "loadMembers") return t(locale, "Impossible de charger les membres: serveur introuvable.", "Unable to load members: server not found.");
    if (context === "loadChannels") return t(locale, "Impossible de charger les salons: serveur introuvable.", "Unable to load channels: server not found.");
    if (context === "loadMessages") return t(locale, "Impossible de charger les messages: salon introuvable.", "Unable to load messages: channel not found.");
    return t(locale, "L’élément demandé est introuvable.", "The requested item could not be found.");
  }

  if (status === 409) return t(locale, "Cette action entre en conflit avec l’état actuel. Rafraîchis la page puis réessaie.", "This action conflicts with the current state. Refresh the page and try again.");
  if (status >= 500) return t(locale, "Le serveur a rencontré un problème. Réessaie dans quelques instants.", "The server encountered a problem. Try again in a moment.");

  switch (context) {
    case "createServer":
      return t(locale, "Impossible de créer le serveur pour le moment.", "Unable to create the server right now.");
    case "createChannel":
      return t(locale, "Impossible de créer le salon pour le moment.", "Unable to create the channel right now.");
    case "editChannel":
      return t(locale, "Impossible de modifier le salon pour le moment.", "Unable to edit the channel right now.");
    case "loadMembers":
      return t(locale, "Impossible de charger les membres.", "Unable to load members.");
    case "loadChannels":
      return t(locale, "Impossible de charger les salons.", "Unable to load channels.");
    case "loadMessages":
      return t(locale, "Impossible de charger les messages.", "Unable to load messages.");
    case "serverSettings":
      return t(locale, "Impossible de sauvegarder les paramètres du serveur.", "Unable to save server settings.");
    case "deleteServer":
      return t(locale, "Impossible de supprimer le serveur.", "Unable to delete the server.");
    case "leaveServer":
      return t(locale, "Impossible de quitter le serveur.", "Unable to leave the server.");
    case "temporaryBan":
      return t(locale, "Impossible de bannir temporairement ce membre.", "Unable to temporarily ban this member.");
    default:
      return t(locale, "Une erreur est survenue. Réessaie dans quelques instants.", "Something went wrong. Try again in a moment.");
  }
}

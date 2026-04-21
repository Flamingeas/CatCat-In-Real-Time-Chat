export function getInitials(username?: string) {
    if (!username || username.length < 1) return "??";
    const first = username[0].toUpperCase();
    const last = username[username.length - 1].toUpperCase();
    return `${first}${last}`;
}

export function formatDateTimeFR(input?: string) {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return input;
    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(d);
}

export function formatTimeFR(input?: string) {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return input;
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
}
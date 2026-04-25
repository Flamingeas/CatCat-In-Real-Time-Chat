function isTauri(): boolean {
  if (typeof window === "undefined") return false;

  const tauriWindow = window as typeof window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return (
    "__TAURI__" in tauriWindow ||
    "__TAURI_INTERNALS__" in tauriWindow ||
    navigator.userAgent.toLowerCase().includes("tauri")
  );
}

async function ensureBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export async function ensureDesktopNotificationsEnabled(): Promise<boolean> {
  if (!isTauri()) {
    return ensureBrowserNotificationPermission();
  }

  const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
  }

  return permissionGranted;
}

export async function notifyDesktop(title: string, body: string): Promise<void> {
  const permissionGranted = await ensureDesktopNotificationsEnabled();
  if (!permissionGranted) return;

  if (!isTauri()) {
    new Notification(title, { body });
    return;
  }

  const { sendNotification } = await import("@tauri-apps/plugin-notification");
  if (permissionGranted) {
    sendNotification({ title, body });
  }
}

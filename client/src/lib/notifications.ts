function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export async function notifyDesktop(title: string, body: string): Promise<void> {
  if (!isTauri()) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    return;
  }

  const { isPermissionGranted, requestPermission, sendNotification } =
    await import('@tauri-apps/plugin-notification');

  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }
  if (permissionGranted) {
    sendNotification({ title, body });
  }
}

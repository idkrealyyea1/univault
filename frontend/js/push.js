// =====================================================================
// UniVault — Push notifications subscription (§20)
// =====================================================================

const VAPID_PUBLIC_KEY = UNIVAULT_CONFIG.VAPID_PUBLIC_KEY; // same value as the backend env var; safe to expose

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast('Push notifications are not supported in this browser.', 'error');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast('Notifications were blocked. You can enable them in your browser settings.', 'error');
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    await apiFetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(sub)
    });
    toast('Notifications enabled!', 'success');
    return true;
  } catch (err) {
    toast(err.message || 'Could not subscribe to notifications.', 'error');
    return false;
  }
}

function wirePushButton(selector) {
  const btn = document.querySelector(selector);
  if (btn) btn.addEventListener('click', subscribeToPush);
}

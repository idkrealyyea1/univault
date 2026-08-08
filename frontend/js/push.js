// =====================================================================
// Studora — Push notifications subscription (§20)
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
    let reg = await navigator.serviceWorker.register('./sw.js');
    if (!navigator.serviceWorker.controller) {
      // First install — make sure the worker is active before subscribing
      await navigator.serviceWorker.ready;
    }

    // Reuse an existing subscription if the browser already has one
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      } catch (err) {
        // One retry — "Registration failed - push service error" is often
        // a transient push-service hiccup, not a permanent failure.
        await new Promise(function (r) { setTimeout(r, 1200); });
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
    }

    await apiFetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(sub)
    });
    toast('Notifications enabled!', 'success');
    return true;
  } catch (err) {
    console.error('push subscribe failed:', err);
    toast('Could not enable notifications right now. Try again in a moment.', 'error');
    return false;
  }
}

function wirePushButton(selector) {
  const btn = document.querySelector(selector);
  if (btn) btn.addEventListener('click', subscribeToPush);
}

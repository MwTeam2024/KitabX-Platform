/** Firebase Phone OTP + FCM web push (§1, §15). Fill in env vars before calling initializeApp. */
import { initializeApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp() {
  if (!firebaseConfig.apiKey) return null; // not configured yet in this environment
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

/**
 * Asks the browser for notification permission and, once Firebase is configured,
 * registers the FCM token with NestJS. The DB notification record is still the
 * source of truth for history and read state (§15) — this only enables delivery.
 */
export async function requestPushPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;

  const app = getFirebaseApp();
  if (!app) return 'granted'; // permission held; token registration waits on config

  try {
    // ServiceWorkerRegistrar.js deliberately skips registering `sw.js` in
    // development (so HMR isn't intercepted by a cached shell) — so there's
    // nothing for FCM to attach to here. `navigator.serviceWorker.ready`
    // would hang forever waiting for a controller that will never arrive in
    // that case, so check with the non-blocking `getRegistration()` instead.
    // Without an explicit registration, getToken() would otherwise try to
    // register its own default `/firebase-messaging-sw.js`, a file this app
    // doesn't have (push is already handled by the app's own `sw.js`).
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return 'granted'; // no SW active (e.g. local dev) — in-app notifications still work

    const { getMessaging, getToken } = await import('firebase/messaging');
    const token = await getToken(getMessaging(app), {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (token) {
      const { notificationsService } = await import('@/services/notifications.service');
      await notificationsService.registerDevice(token, 'web').catch(() => null);
    }
  } catch {
    // Messaging unavailable (unsupported browser, missing VAPID key, SW
    // registration failure, ...) — in-app notifications still work.
  }
  return 'granted';
}

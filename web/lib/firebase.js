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
    const { getMessaging, getToken } = await import('firebase/messaging');
    const token = await getToken(getMessaging(app), {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });
    if (token) {
      const { notificationsService } = await import('@/services/notifications.service');
      await notificationsService.registerPushToken(token).catch(() => null);
    }
  } catch {
    // Messaging unavailable (unsupported browser or missing VAPID key) — in-app still works.
  }
  return 'granted';
}

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAJnYbO8Gj7kxvVup38OMkU4Ij5SYE1vMQ",
  authDomain: "sanjaya-567d3.firebaseapp.com",
  databaseURL: "https://sanjaya-567d3-default-rtdb.firebaseio.com",
  projectId: "sanjaya-567d3",
  storageBucket: "sanjaya-567d3.firebasestorage.app",
  messagingSenderId: "949733148132",
  appId: "1:949733148132:web:03066fca97c32bfbdaf3f1",
  measurementId: "G-J3MFTYRZWP"
};

// VAPID key for web push (you need to generate this in Firebase Console > Project Settings > Cloud Messaging)
const VAPID_KEY = "BJwXdt3a21p4UWXPB--5I_Bz5ZTAKZpOdk_rs36ioTMGeA6iuchkfMGb78zvqSXLWkOOdx2YjjCVd5Hi1TrZrjg"; // TODO: Replace with your VAPID key

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Secondary app for creating users without affecting main auth state
const secondaryApp = initializeApp(firebaseConfig, 'secondary');

// Initialize Firebase services
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp); // For creating users
export const database = getDatabase(app);

// Initialize Analytics (only in browser)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// Initialize Firebase Cloud Messaging
let messaging: ReturnType<typeof getMessaging> | null = null;

export const initializeMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      return messaging;
    }
  } catch (error) {
    console.error('FCM not supported:', error);
  }
  return null;
};

export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    if (!messaging) {
      await initializeMessaging();
    }
    if (!messaging) return null;

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service Worker registered:', registration);

    // Get FCM token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};

export { analytics, messaging };
export default app;

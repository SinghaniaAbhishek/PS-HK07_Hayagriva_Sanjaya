// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const database = getDatabase(app);

// Initialize Analytics (only in browser)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
export default app;

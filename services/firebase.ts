
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCOvOrHRrk1HswEyPB8hwDgtU-ZuDDonP0",
  authDomain: "lofo-2e788.firebaseapp.com",
  projectId: "lofo-2e788",
  storageBucket: "lofo-2e788.firebasestorage.app",
  messagingSenderId: "389275815940",
  appId: "1:389275815940:web:c6a744589e9efdd3fc2551",
  measurementId: "G-53WC7C4H19"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with settings to avoid connection timeouts
// experimentalForceLongPolling helps in environments where WebSockets are blocked or unstable
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Analytics can fail in some environments (e.g. strict ad blockers), so we wrap it
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Firebase Analytics failed to initialize:", e);
}
export { analytics };

export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

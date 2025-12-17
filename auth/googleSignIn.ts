
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../services/firebase";
import { User } from "../types";

export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;

    const userRef = doc(db, "users", fbUser.uid);
    const userSnap = await getDoc(userRef);

    let appUser: User;

    if (userSnap.exists()) {
      // User exists, do nothing (sync happens in App.tsx via onAuthStateChanged)
      appUser = userSnap.data() as User;
    } else {
      // Create new user document
      appUser = {
        id: fbUser.uid,
        name: fbUser.displayName || "Google User",
        email: fbUser.email || "",
        avatar: fbUser.photoURL || "",
        isGuest: false,
        emailVerified: true, // Google accounts are implicitly verified
        phoneVerified: false,
        isBlocked: false
      };

      await setDoc(userRef, {
        ...appUser,
        provider: "google",
        createdAt: new Date().toISOString()
      });
    }

    return appUser;
  } catch (error: any) {
    console.error("Google Sign In Error:", error);
    
    // Return readable error for unauthorized domain
    if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname || window.location.host || 'localhost';
        throw new Error(`Domain Unauthorized! Please add "${domain}" to Firebase Console > Authentication > Settings > Authorized Domains.`);
    }

    // Handle popup closed by user
    if (error.code === 'auth/popup-closed-by-user') {
        throw new Error("Sign in was cancelled.");
    }

    if (error.code === 'auth/popup-blocked') {
        throw new Error("Popup was blocked by the browser. Please allow popups for this site.");
    }
    
    throw new Error(error.message || "Failed to sign in with Google");
  }
}

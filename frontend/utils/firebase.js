// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider} from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "allverseai-172f9.firebaseapp.com",
  projectId: "allverseai-172f9",
  storageBucket: "allverseai-172f9.firebasestorage.app",
  messagingSenderId: "428104212065",
  appId: "1:428104212065:web:7948e58a8bb47cda0d1420"
};

// Firebase is optional for local development. When no web API key is
// configured, the app falls back to the local demo login instead of
// crashing on startup.
let app = null
let auth = null
let googleProvider = null

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  googleProvider = new GoogleAuthProvider()
}

export { app, auth, googleProvider }

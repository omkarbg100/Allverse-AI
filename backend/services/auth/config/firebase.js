import { cert, initializeApp } from "firebase-admin";
import { createRequire } from "module";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, "../serviceAccountKey.json");

let app = null;
let firebaseEnabled = false;

try {
  const require = createRequire(import.meta.url);
  const serviceAccount = require(keyPath);

  // Validate the private key looks like a real PEM key
  if (
    serviceAccount.private_key &&
    serviceAccount.private_key.length > 500 &&
    !serviceAccount.private_key.includes("placeholder") &&
    !serviceAccount.private_key.includes("1234567890abcdef")
  ) {
    app = initializeApp({ credential: cert(serviceAccount) });
    firebaseEnabled = true;
    console.log("✅ Firebase Admin SDK initialized successfully");
  } else {
    console.warn(
      "⚠️  Firebase serviceAccountKey.json contains a placeholder key. " +
      "Firebase token verification is DISABLED. " +
      "Replace serviceAccountKey.json with your real Firebase service account key to enable auth."
    );
  }
} catch (err) {
  console.warn(
    "⚠️  Failed to initialize Firebase Admin SDK:", err.message,
    "\nFirebase token verification is DISABLED."
  );
}

export { app, firebaseEnabled };
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Import Firestore

const firebaseConfig = {
  apiKey: "AIzaSyCy-kpe0RjUnplN52WwsVk2ulXLLJawL_0",
  authDomain: "salescope-7f11d.firebaseapp.com",
  projectId: "salescope-7f11d",
  storageBucket: "salescope-7f11d.appspot.com",
  messagingSenderId: "322391987629",
  appId: "1:322391987629:web:704f5388c14ac8dc513d24",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

export { auth, db }; // Export Firestore (db) along with auth
export default app;

import React, { createContext, useContext, useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import app from "./firebase-config"; // Assuming this imports your Firebase app config

// Create the AuthContext
const AuthContext = createContext();

// Custom Hook to use the AuthContext
export const useAuth = () => useContext(AuthContext);

// AuthProvider Component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null); // Stores current user from Firebase Auth
  const [subscription, setSubscription] = useState(null); // Stores subscription data from Firestore
  const [loading, setLoading] = useState(true); // Tracks whether user state is still loading

  const auth = getAuth(app); // Initialize Firebase Auth
  const db = getFirestore(app); // Initialize Firestore

  useEffect(() => {
    // Listen for Auth State Changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user); // Set Firebase Auth user
        try {
          // Fetch additional user data from Firestore
          const userDocRef = doc(db, "users", user.uid); // Adjust collection name as needed
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setSubscription(userDoc.data().subscription || null); // Example: fetch subscription data
          }
        } catch (error) {
          console.error("Error fetching user data from Firestore:", error);
        }
      } else {
        setCurrentUser(null); // Clear user data on logout
        setSubscription(null);
      }
      setLoading(false); // Set loading to false once user state is resolved
    });

    return unsubscribe; // Cleanup listener on unmount
  }, [auth, db]);

  // Login Function
  const login = (email, password) => {
    return auth.signInWithEmailAndPassword(email, password);
  };

  // Logout Function
  const logout = () => {
    return auth.signOut();
  };

  // Context Value
  const value = {
    currentUser,
    subscription,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} {/* Render children only after loading is complete */}
    </AuthContext.Provider>
  );
};


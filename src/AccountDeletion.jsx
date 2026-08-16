import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./firebase-config"; // Ensure the correct path
import { deleteUser } from "firebase/auth";
import { getFirestore, doc, deleteDoc } from "firebase/firestore";
import "./account.css";

const AccountDeletion = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmation, setConfirmation] = useState(false);

  const navigate = useNavigate();
  const db = getFirestore();

  const handleAccountDeletion = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    const user = auth.currentUser;

    if (!user) {
      setError("No user is currently logged in.");
      setLoading(false);
      return;
    }

    try {
      // Step 1: Delete user data from Firestore
      const userDocRef = doc(db, "users", user.uid); // Assumes user data is stored under `users` collection
      await deleteDoc(userDocRef);

      // Step 2: Delete the user account
      await deleteUser(user);

      setSuccess("Your account has been successfully deleted.");
      setLoading(false);

      // Step 3: Redirect to the homepage or login page
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      console.error("Error deleting account:", error);
      setError("Failed to delete account. Please try again or contact support.");
      setLoading(false);
    }
  };

  return (
    <div className="account-deletion">
      <h2>Delete Account</h2>
      {success && <p className="success-message">{success}</p>}
      {error && <p className="error-message">{error}</p>}

      {!confirmation ? (
        <>
          <p>
            Are you sure you want to delete your account? This action cannot be
            undone, and all your data will be permanently removed.
          </p>
          <button
            className="delete-button"
            onClick={() => setConfirmation(true)}
            disabled={loading}
          >
            Delete My Account
          </button>
          <button
            className="cancel-button"
            onClick={() => navigate("/account")}
            disabled={loading}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <p>
            Please confirm your decision. Click "Confirm" to permanently delete
            your account.
          </p>
          <button
            className="confirm-button"
            onClick={handleAccountDeletion}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Confirm Deletion"}
          </button>
          <button
            className="cancel-button"
            onClick={() => setConfirmation(false)}
            disabled={loading}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
};

export default AccountDeletion;

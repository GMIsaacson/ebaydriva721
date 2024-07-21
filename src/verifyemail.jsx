import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./firebase-config";
import { sendEmailVerification, onAuthStateChanged } from "firebase/auth";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        navigate("/dashboard"); // Redirect when verified
      }
    });

    return unsubscribe; // Cleanup subscription
  }, [navigate]);

  const resendEmailVerification = async () => {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
      setEmailSent(true);
    }
  };

  return (
    <div className="verify-email">
      <h1>Verify Your Email Address</h1>
      <p>
        Please check your email inbox for a verification link to proceed. If you
        haven't received it, you can resend the email.
      </p>
      {!emailSent && (
        <button onClick={resendEmailVerification}>Resend Email</button>
      )}
      {emailSent && <p>Email sent! Check your inbox again.</p>}
    </div>
  );
};

export default VerifyEmail;

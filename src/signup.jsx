import React, { useState, useEffect } from "react";
import { auth } from "./firebase-config";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const checkEmailVerification = async (user) => {
    await user.reload();
    if (user.emailVerified) {
      // Redirect or unlock features
      navigate("/products");
    } else {
      console.log("Please verify your email first.");
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      checkEmailVerification(user);
    }
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setError(""); // Clear any previous errors
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // Send an email verification
      await sendEmailVerification(user);
      console.log("Verification email sent. Please check your email.");

      setError("Please check your email for verification to log in.");
      navigate("/verifyemail"); // Redirect them to a page to wait for verification
    } catch (error) {
      console.error("Signup error:", error);
      setError(error.message); // Set firebase error messages
    }
  };

  return (
    <div className="login-form">
      <h2>Sign Up</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSignup}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit">Sign Up</button>
        <p>
          Already have an account?{" "}
          <Link to="/login" className="link">
            Login
          </Link>
        </p>
        <p>
          Forgot your password?{" "}
          <Link to="/resetpassword" className="link">
            Reset Password
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Signup;

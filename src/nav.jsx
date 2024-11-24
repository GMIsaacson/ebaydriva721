import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import "./nav.css";

const Nav = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser, logout } = useAuth();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="navbar">
      <div className="logo">
        <Link to="/">DataScout</Link>
      </div>
      <div className={`nav-links ${isOpen ? "open" : ""}`}>
        <li>
          <Link to="/products" onClick={() => setIsOpen(false)}>
            Products
          </Link>
        </li>
        <li>
          <Link to="/dashboard" onClick={() => setIsOpen(false)}>
            Dashboard
          </Link>
        </li>
        <li>
          <Link to="/resources" onClick={() => setIsOpen(false)}>
            Resources
          </Link>
        </li>
        {currentUser ? (
          <>
            <li>
              <Link
                to="/accounts"
                onClick={() => setIsOpen(false)}
                className="account-link"
              >
                Account
              </Link>
            </li>
            <li>
              <button
                className="logout"
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
              >
                Logout
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link
                to="/login"
                className="login"
                onClick={() => setIsOpen(false)}
              >
                Login
              </Link>
            </li>
            <li>
              <Link
                to="/signup"
                className="signup"
                onClick={() => setIsOpen(false)}
              >
                Signup
              </Link>
            </li>
          </>
        )}
      </div>
      <div className="menu-icon" onClick={toggleMenu}>
        ☰
      </div>
    </nav>
  );
};

export default Nav;


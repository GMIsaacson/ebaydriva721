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
      {/* Logo Section */}
      <div className="logo">
        <Link to="/">DataScout</Link>
      </div>

      {/* Navigation Links */}
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

        {/* User Section */}
        {currentUser ? (
          <div className="user-menu">
            {/* User Info */}
            <div className="user-info">
              {currentUser.photoURL && (
                <img
                  src={currentUser.photoURL}
                  alt="Profile"
                  className="profile-img"
                />
              )}
              <span className="user-email">{currentUser.email}</span>
            </div>

            {/* Dropdown for User Actions */}
            <div className="dropdown">
              <button className="dropdown-btn">▼</button>
              <div className="dropdown-content">
                <Link to="/accounts">Account</Link>
                <Link to="/notifications">
                  Notifications
                  <span className="notification-badge">3</span>
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <li>
              <Link to="/login" onClick={() => setIsOpen(false)}>
                Login
              </Link>
            </li>
            <li>
              <Link to="/signup" onClick={() => setIsOpen(false)}>
                Signup
              </Link>
            </li>
          </>
        )}
      </div>

      {/* Hamburger Menu Icon for Mobile View */}
      <div className="menu-icon" onClick={toggleMenu}>
        ☰
      </div>
    </nav>
  );
};

export default Nav;





import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import "./nav.css";

const Nav = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const closeMenus = () => {
    setIsOpen(false);
    setAccountOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    closeMenus();
    navigate("/");
  };

  const navClass = ({ isActive }) => (isActive ? "ds-nav-link active" : "ds-nav-link");
  const initials = currentUser?.email?.slice(0, 1)?.toUpperCase() || "U";

  return (
    <header className="ds-navbar-wrap">
      <nav className="ds-navbar ds-shell" aria-label="Primary navigation">
        <Link className="ds-brand" to="/" onClick={closeMenus}>
          <span className="ds-brand-mark">D</span>
          <span>DataScout</span>
        </Link>

        <button
          className="ds-menu-button"
          type="button"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`ds-nav-content ${isOpen ? "open" : ""}`}>
          <div className="ds-nav-links">
            {currentUser && (
              <>
                <NavLink className={navClass} to="/sourcing" onClick={closeMenus}>Sourcing</NavLink>
                <NavLink className={navClass} to="/products" onClick={closeMenus}>Products</NavLink>
                <NavLink className={navClass} to="/dashboard" onClick={closeMenus}>Dashboard</NavLink>
              </>
            )}
            <NavLink className={navClass} to="/resources" onClick={closeMenus}>Resources</NavLink>
          </div>

          <div className="ds-nav-actions">
            {currentUser ? (
              <div className="ds-account" ref={accountRef}>
                <button
                  type="button"
                  className="ds-account-trigger"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((value) => !value)}
                >
                  <span className="ds-avatar">{initials}</span>
                  <span className="ds-account-label">Account</span>
                  <span aria-hidden="true">⌄</span>
                </button>
                {accountOpen && (
                  <div className="ds-account-menu">
                    <div className="ds-account-email" title={currentUser.email}>{currentUser.email}</div>
                    <Link to="/accounts" onClick={closeMenus}>Account settings</Link>
                    <button type="button" onClick={handleLogout}>Log out</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link className="ds-login-link" to="/login" onClick={closeMenus}>Log in</Link>
                <Link className="ds-button ds-button-primary ds-signup-link" to="/signup" onClick={closeMenus}>Start free</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Nav;

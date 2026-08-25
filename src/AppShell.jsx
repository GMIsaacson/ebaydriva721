import React, { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaChartBar,
  FaChevronRight,
  FaCog,
  FaDatabase,
  FaLayerGroup,
  FaSignOutAlt,
  FaTimes,
  FaTools,
} from "react-icons/fa";
import { useAuth } from "./AuthProvider";
import "./app-shell.css";

const navigation = [
  { to: "/products", label: "Opportunities", icon: FaLayerGroup },
  { to: "/dashboard", label: "Catalog admin", icon: FaDatabase },
  { to: "/resources", label: "Resources", icon: FaTools, publicRoute: true },
];

const pageLabels = {
  "/products": "Opportunities",
  "/dashboard": "Catalog admin",
  "/accounts": "Account settings",
};

const AppShell = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const pageLabel = useMemo(() => {
    const matchingPath = Object.keys(pageLabels).find((path) => location.pathname.startsWith(path));
    return matchingPath ? pageLabels[matchingPath] : "Workspace";
  }, [location.pathname]);

  const initials = currentUser?.email?.slice(0, 1)?.toUpperCase() || "U";

  const closeMobile = () => setMobileOpen(false);

  const handleLogout = async () => {
    await logout();
    closeMobile();
    navigate("/");
  };

  return (
    <div className="ds-app-shell">
      <aside className={`ds-app-sidebar ${mobileOpen ? "open" : ""}`} aria-label="DataScout workspace navigation">
        <div className="ds-app-sidebar-head">
          <Link className="ds-app-brand" to="/products" onClick={closeMobile}>
            <span className="ds-app-brand-mark">D</span>
            <span className="ds-app-brand-copy">
              <strong>DataScout</strong>
              <small>Intelligence workspace</small>
            </span>
          </Link>
          <button className="ds-app-sidebar-close" type="button" onClick={closeMobile} aria-label="Close workspace navigation">
            <FaTimes />
          </button>
        </div>

        <div className="ds-app-sidebar-section">
          <span className="ds-app-sidebar-label">Workspace</span>
          <nav className="ds-app-nav">
            {navigation.map(({ to, label, icon: Icon, publicRoute }) => (
              publicRoute ? (
                <Link className="ds-app-nav-link" to={to} key={to} onClick={closeMobile}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  <FaChevronRight className="ds-app-nav-chevron" aria-hidden="true" />
                </Link>
              ) : (
                <NavLink
                  className={({ isActive }) => `ds-app-nav-link ${isActive ? "active" : ""}`}
                  to={to}
                  key={to}
                  onClick={closeMobile}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              )
            ))}
          </nav>
        </div>

        <div className="ds-app-sidebar-spacer" />

        <div className="ds-app-sidebar-section ds-app-sidebar-account">
          <span className="ds-app-sidebar-label">Account</span>
          <NavLink className={({ isActive }) => `ds-app-nav-link ${isActive ? "active" : ""}`} to="/accounts" onClick={closeMobile}>
            <FaCog aria-hidden="true" />
            <span>Settings</span>
          </NavLink>
          <button className="ds-app-nav-link ds-app-logout" type="button" onClick={handleLogout}>
            <FaSignOutAlt aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>

        <div className="ds-app-user-card" title={currentUser?.email || "Signed-in user"}>
          <span className="ds-app-user-avatar">{initials}</span>
          <span className="ds-app-user-copy">
            <strong>{currentUser?.email?.split("@")[0] || "DataScout user"}</strong>
            <small>{currentUser?.email || "Signed in"}</small>
          </span>
        </div>
      </aside>

      {mobileOpen && <button className="ds-app-sidebar-scrim" type="button" aria-label="Close workspace navigation" onClick={closeMobile} />}

      <section className="ds-app-workspace">
        <header className="ds-app-topbar">
          <div className="ds-app-topbar-left">
            <button className="ds-app-menu-button" type="button" onClick={() => setMobileOpen(true)} aria-label="Open workspace navigation">
              <FaBars />
            </button>
            <div className="ds-app-breadcrumb">
              <span>DataScout</span>
              <FaChevronRight aria-hidden="true" />
              <strong>{pageLabel}</strong>
            </div>
          </div>
          <div className="ds-app-topbar-right">
            <span className="ds-app-status"><i /> Workspace online</span>
            <Link className="ds-app-topbar-avatar" to="/accounts" title={currentUser?.email || "Account"}>{initials}</Link>
          </div>
        </header>

        <div className="ds-app-content">
          <Outlet />
        </div>
      </section>
    </div>
  );
};

export default AppShell;

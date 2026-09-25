import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import "./factory-shell.css";

export default function FactoryShell() {
  return (
    <div className="factory-shell">
      <Outlet />
      <nav className="factory-switcher" aria-label="Factory control navigation">
        <NavLink end to="/factory-control" className={({ isActive }) => isActive ? "active" : ""}>
          <span>⌂</span> Work Control
        </NavLink>
        <NavLink to="/factory-control/ui-hub" className={({ isActive }) => isActive ? "active" : ""}>
          <span>▦</span> UI Hub
        </NavLink>
        <NavLink to="/factory-control/n8n" className={({ isActive }) => isActive ? "active" : ""}>
          <span>⌁</span> n8n
        </NavLink>
      </nav>
    </div>
  );
}

import React from "react";
import { useAuth } from "./AuthProvider";
import { Link, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import ProfileEdit from "./ProfileEdit";
import ResetPassword from "./resetpassword";
import ActivityLogs from "./ActivityLogs";
import AccountDeletion from "./AccountDeletion";
import "./account.css";

const AccountPage = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout Failed", error);
    }
  };

  return (
    <div className="account-page">
      {/* Header Section */}
      <header className="account-header">
        <div className="header-content">
          <h1>My Account</h1>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Section */}
      <main className="account-main">
        <aside className="account-sidebar">
          <nav>
            <ul>
              <li>
                <Link to="profile">Profile</Link>
              </li>
              <li>
                <Link to="password">Change Password</Link>
              </li>
              <li>
                <Link to="activity">Activity Logs</Link>
              </li>
              <li>
                <Link to="delete">Delete Account</Link>
              </li>
            </ul>
          </nav>
        </aside>

        <section className="account-content">
          <Routes>
            <Route path="/" element={<h2>Welcome to your account page!</h2>} />
            <Route path="profile" element={<ProfileEdit />} />
            <Route path="password" element={<ResetPassword />} />
            <Route path="activity" element={<ActivityLogs />} />
            <Route path="delete" element={<AccountDeletion />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </section>
      </main>
    </div>
  );
};

export default AccountPage;








import React from "react";
import { useAuth } from "./AuthProvider";
import { Link, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import ProfileEdit from "./ProfileEdit";
import ResetPassword from "./resetpassword";
// Uncomment when these components are implemented
// import SecuritySettings from "./SecuritySettings";
// import Preferences from "./Preferences";
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
      {/* User Info Section */}
      <div className="account-header">
        <h2>Welcome, {currentUser.displayName || "User"}!</h2>
        <p>Email: {currentUser.email}</p>
        <p>Account Created: {new Date(currentUser.metadata.creationTime).toLocaleString()}</p>
        <p>Last Login: {new Date(currentUser.metadata.lastSignInTime).toLocaleString()}</p>
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="account-main">
        {/* Sidebar Navigation */}
        <div className="account-sidebar">
          <ul>
            <li>
              <Link to="profile">
                <i className="icon-profile"></i> Profile
              </Link>
            </li>
            <li>
              <Link to="password">
                <i className="icon-password"></i> Change Password
              </Link>
            </li>
            <li>
              <Link to="security">
                <i className="icon-security"></i> Security Settings
              </Link>
            </li>
            <li>
              <Link to="preferences">
                <i className="icon-preferences"></i> Preferences
              </Link>
            </li>
            <li>
              <Link to="activity">
                <i className="icon-activity"></i> Activity Logs
              </Link>
            </li>
            <li>
              <Link to="delete">
                <i className="icon-delete"></i> Delete Account
              </Link>
            </li>
          </ul>
        </div>

        {/* Main Content */}
        <div className="account-content">
          <Routes>
            <Route path="/" element={<h2>Welcome to your account page!</h2>} />
            <Route path="profile" element={<ProfileEdit />} />
            <Route path="password" element={<ResetPassword />} />
            {/* Uncomment when these components are implemented */}
            {/* <Route path="security" element={<SecuritySettings />} /> */}
            {/* <Route path="preferences" element={<Preferences />} /> */}
            <Route path="activity" element={<ActivityLogs />} />
            <Route path="delete" element={<AccountDeletion />} />
            {/* Redirect any unknown sub-route back to the default */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;







// src/AccountPage.js

import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import "./account.css";

const AccountPage = () => {
  const { currentUser, logout } = useAuth();
  const [activityLogs, setActivityLogs] = useState([]);

  useEffect(() => {
    if (currentUser) {
      const fetchActivityLogs = async () => {
        const db = getFirestore();
        const logsQuery = query(
          collection(db, "activity_logs"),
          orderBy("timestamp", "desc"),
          limit(10),
        );
        const querySnapshot = await getDocs(logsQuery);
        const logs = querySnapshot.docs.map((doc) => {
          console.log(doc.data()); // Debug: Log the data to inspect the timestamp
          return {
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp
              ? doc.data().timestamp.toDate()
              : new Date(), // Fallback to current date if timestamp is invalid
          };
        });
        setActivityLogs(logs);
      };

      fetchActivityLogs();
    }
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
      console.log("Logged out successfully!");
    } catch (error) {
      console.error("Logout Failed", error);
    }
  };

  if (!currentUser) {
    return <h1>Please log in to view this page.</h1>;
  }

  return (
    <div className="account-page">
      <div className="header">
        <h4>Welcome, {currentUser.email}</h4>
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
      <div className="activity-log">
        <h2>Recent Activity</h2>
        {activityLogs.length > 0 ? (
          <ul>
            {activityLogs.map((log) => (
              <li key={log.id}>
                <strong>{log.type}:</strong> {log.id} on{" "}
                {log.timestamp.toLocaleString()}
              </li>
            ))}
          </ul>
        ) : (
          <p>No recent activity found.</p>
        )}
      </div>
    </div>
  );
};

export default AccountPage;

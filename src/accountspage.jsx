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
  const [filterType, setFilterType] = useState("all");

  const filteredLogs = activityLogs.filter(
    (log) => filterType === "all" || log.type === filterType
  );

  useEffect(() => {
    if (currentUser) {
      const fetchActivityLogs = async () => {
        const db = getFirestore();
        const logsQuery = query(
          collection(db, "activity_logs"),
          orderBy("timestamp", "desc"),
          limit(10)
        );
        const querySnapshot = await getDocs(logsQuery);
        const logs = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          // Log to check for timestamp
          console.log(data);

          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp ? data.timestamp.toDate() : new Date(), // Convert Firestore Timestamp to Date object
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
    <>
    <div className="account-page">
      <h1>Activity Logs</h1>
      <select onChange={(e) => setFilterType(e.target.value)} value={filterType}>
        <option value="all">All Logs</option>
        <option value="add">Add Logs</option>
        <option value="update">Update Logs</option>
        <option value="delete">Delete Logs</option>
      </select>
      <div>
        {filteredLogs.map((log) => (
          <div key={log.id}>
            <p>
              {log.type}: {log.product_title}{" "}
              <span>{new Date(log.timestamp).toLocaleString()}</span> {/* Display formatted timestamp */}
            </p>
          </div>
        ))}
      </div>
      <button onClick={handleLogout}>Logout</button>
    </div>
    // Displaying Enhanced Logs
<div>
  <select onChange={(e) => setFilterType(e.target.value)} value={filterType}>
    <option value="all">All Logs</option>
    <option value="add">Add Logs</option>
    <option value="update">Update Logs</option>
    <option value="delete">Delete Logs</option>
  </select>

  <div>
    {filteredLogs.map((log) => (
      <div key={log.id}>
        <p>
          {log.type} by {log.userEmail} on {new Date(log.timestamp).toLocaleString()}
        </p>
        <p>Changes: {log.changesCount} </p>
        <p>Changed Fields: {log.changedFields ? log.changedFields.join(", ") : "N/A"}</p>
      </div>
    ))}
  </div>
</div>
</>
  );
};

export default AccountPage;


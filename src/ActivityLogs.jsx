// src/ActivityLogs.jsx
import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuth } from './AuthProvider';
//import './activityLogs.css'; // Create this CSS file for styling

const ActivityLogs = () => {
  const { currentUser } = useAuth();
  const [activityLogs, setActivityLogs] = useState([]);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (currentUser) {
      const fetchActivityLogs = async () => {
        const db = getFirestore();
        const logsQuery = query(
          collection(db, 'activity_logs'),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        const querySnapshot = await getDocs(logsQuery);
        const logs = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
          };
        });
        setActivityLogs(logs);
      };

      fetchActivityLogs();
    }
  }, [currentUser]);

  const filteredLogs = activityLogs.filter(
    (log) => filterType === 'all' || log.type === filterType
  );

  return (
    <div className="activity-logs">
      <h2>Activity Logs</h2>
      <select onChange={(e) => setFilterType(e.target.value)} value={filterType}>
        <option value="all">All Logs</option>
        <option value="add">Add Logs</option>
        <option value="update">Update Logs</option>
        <option value="delete">Delete Logs</option>
      </select>
      <div className="logs-container">
        {filteredLogs.map((log) => (
          <div key={log.id} className="log-entry">
            <p>
              <strong>{log.type.toUpperCase()}</strong>: {log.product_title}
            </p>
            <p>Date: {new Date(log.timestamp).toLocaleString()}</p>
            <p>User: {log.userEmail}</p>
            <p>Changes: {log.changesCount}</p>
            <p>
              Changed Fields: {log.changedFields ? log.changedFields.join(', ') : 'N/A'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityLogs;

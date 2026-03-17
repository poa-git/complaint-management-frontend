import React, { useEffect, useState } from "react";
import "./NotificationBell.css";

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const toggleDropdown = () => setOpen(!open);

  const fetchActivities = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/history/latest/20`, {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();
      setActivities(data);
    } catch (err) {
      console.error("Failed to load activities", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchActivities();
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      {/* Bell Icon */}
      <button className="notification-bell-btn" onClick={toggleDropdown}>
        🔔
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="notification-dropdown">
          <div className="notification-header">Latest Activities</div>

          {loading ? (
            <div className="loading">Loading...</div>
          ) : activities.length === 0 ? (
            <div className="no-activity">No recent activity.</div>
          ) : (
            activities.map((a, i) => (
              <div key={i} className="activity-item">
                {/* Title */}
                <div className="activity-title">
                  {a.fieldName} updated
                </div>

                {/* Old & New values */}
                <div className="change-values">
                  <span className="value-old">Old: {a.oldValue}</span>
                  <span className="value-new">New: {a.newValue}</span>
                </div>

                {/* Meta info */}
                <div className="activity-meta">
                  Complaint: <b>{a.complaintId}</b><br />
                  By: {a.changedBy}<br />
                  On: {new Date(a.changeDate).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

import React from "react";
import NotificationBell from "../NotificationBell/NotificationBell";

const DashboardHeader = () => (
  <header className="dashboard-header" 
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}
  >
    <div>
      <h1>Welcome to Your Dashboard</h1>
      <p>
        Here you can find an overview of your recent activities and key metrics.
      </p>
    </div>

    {/* 🔔 Add notification bell here */}
    <NotificationBell />
  </header>
);

export default DashboardHeader;

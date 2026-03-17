import React, { useState } from "react";
import Logo from "../../assets/logo.gif";

const Sidebar = ({ handleNavigation }) => {
  const [isCourierTrackingOpen, setIsCourierTrackingOpen] = useState(false);
  const [isMetricsDropdownOpen, setIsMetricsDropdownOpen] = useState(false);
  const [isLabDropdownOpen, setIsLabDropdownOpen] = useState(false);

  const username = localStorage.getItem("username") || "User";
  const userType = localStorage.getItem("userType");
  // console.log("Sidebar userType is:", userType);
  const toggleCourierTracking = () => {
    setIsCourierTrackingOpen(!isCourierTrackingOpen);
  };

  const toggleMetricsDropdown = () => {
    setIsMetricsDropdownOpen(!isMetricsDropdownOpen);
  };

  const toggleLabDropdown = () => {
    setIsLabDropdownOpen(!isLabDropdownOpen);
  };
  const handleLogout = async () => {
    // 1. Tell the backend to log out (invalidates session cookie)
    await fetch(`${process.env.REACT_APP_API_BASE_URL}/logout`, {
      method: "POST",
      credentials: "include",
    });
  
    // 2. Clear any local storage
    localStorage.clear();
  
    // 3. Redirect to login
    window.location.href = "/login";
  };
  
  const renderSidebarItems = () => {
      if (userType === "LAB_USER" && username !== "qamar") {
        return (
          <>
            <button className="nav-item" onClick={toggleLabDropdown}>
              <span className="icon">🔬</span> Lab
            </button>
            {isLabDropdownOpen && (
              <div className="submenu">
                <button
                  className="nav-item submenu-item"
                  onClick={() => handleNavigation("lab")}
                >
                  <span className="icon">🔬</span> Lab Dashboard
                </button>
                <button
                  className="nav-item submenu-item"
                  onClick={() => handleNavigation("lab-assigned")}
                >
                  <span className="icon">👨‍🔬</span> Lab Assigned
                </button>
              </div>
            )}
          </>
        );
      }
      else if(userType === "OFFICE_USER" && username === "abdullah"){
        <button
      className="nav-item"
      onClick={() => handleNavigation("isb-rwp-complaints")}
    >
      <span className="icon">🏢</span> ISB/RWP Complaints
    </button>
      }
      else{
        return (
          <>
            <button
              className="nav-item"
              onClick={() => handleNavigation("dashboard")}
            >
              <span className="icon">🏠</span> Dashboard
            </button>
            <button
              className="nav-item"
              onClick={() => handleNavigation("new-complaint")}
            >
              <span className="icon">➕</span> Register New Complaint
            </button>
            <button
              className="nav-item"
              onClick={() => handleNavigation("scheduler")}
            >
              <span className="icon">📅</span> Scheduler
            </button>
            <button className="nav-item" onClick={toggleCourierTracking}>
              <span className="icon">🖥️</span> Courier Tracking
            </button>
            {isCourierTrackingOpen && (
              <div className="submenu">
                <button
                  className="nav-item submenu-item"
                  onClick={() => handleNavigation("incoming-hardware")}
                >
                  <span className="icon">⬅️</span> Incoming Hardware
                </button>
                <button
                  className="nav-item submenu-item"
                  onClick={() => handleNavigation("outgoing-hardware")}
                >
                  <span className="icon">➡️</span> Outgoing Hardware
                </button>
              </div>
            )}
            <button
              className="nav-item submenu-item"
              onClick={() => handleNavigation("lab")}
            >
              <span className="icon">🔬</span> Lab
            </button>
            {isLabDropdownOpen && (
              <div className="submenu">
                <button
                  className="nav-item submenu-item"
                  onClick={() => handleNavigation("lab")}
                >
                  <span className="icon">🔬</span> Lab Dashboard
                </button>
                <button
                  className="nav-item submenu-item"
                  onClick={() => handleNavigation("lab-assigned")}
                >
                  <span className="icon">👨‍🔬</span> Lab Assigned
                </button>
              </div>
            )}
          
            <button className="nav-item" onClick={toggleMetricsDropdown}>
              <span className="icon">📊</span> Metrics
            </button>
            {isMetricsDropdownOpen && (
              <div className="submenu">
                <button
                  className="nav-item submenu-item"
                  onClick={() => handleNavigation("todays-metrics")}
                >
                  <span className="icon">📅</span> Today's Metrics
                </button>
                <button
                  className="nav-item submenu-item"
                  onClick={() => handleNavigation("overall-metrics")}
                >
                  <span className="icon">📊</span> Overall Metrics
                </button>
              </div>
            )}
            <button className="nav-item" onClick={() => handleNavigation("map")}>
              <span className="icon">🗺️</span> Map
            </button>
          </>
        );
      }
    // For all other users, show full menu
   
  };

  const renderLogoutButton = () => (
    <button className="nav-item logout-button" onClick={handleLogout}>
      <span className="icon">🚪</span> Logout
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="user-info">
        <img src={Logo} alt="User" className="user-avatar" />
        <h3>User - {username}</h3>
      </div>
      <nav className="sidebar-nav">
        {renderSidebarItems()}
        {renderLogoutButton()}
      </nav>
    </aside>
  );
};

export default Sidebar;

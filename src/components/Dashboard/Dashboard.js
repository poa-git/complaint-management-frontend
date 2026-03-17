// Dashboard.js
import React, { Suspense, useEffect, useState } from "react";
import ComplaintForm from "../ComplaintForm/ComplaintForm";
import ComplaintDashboard from "../ComplaintDashboard/ComplaintDashboard";
import Maps from "../Map/Maps";
// import Scheduler from "../Scheduler/Scheduler";
import TodaysMetrics from "../Metrics/TodaysMetrics";
import OverallMetrics from "../Metrics/OverallMetrics";
import "./dashboard.css";
import axios from "axios";
import ComplaintModal from "../ComplaintDashboard/ComplaintModal/ComplaintModal";
import RemarksModal from "../ComplaintDashboard/RemarksModal/RemarksModal";
import DashboardHeader from "./DashboardHeader";
import StatusCards from "./StatusCards";
import DailyStatusCards from "./DailyStatusCards";
import Sidebar from "./Sidebar";
import IncomingHardwareLogList from "../HardwareLogList/IncomingHardware/IncomingHardwareLogList";
import OutgoingHardwareLogList from "../HardwareLogList/OutgoingHardware/OutgoingHardwareLogList";
import TodayComplaintsTable from "../ComplaintDashboard/DailyComplaintTable/TodayComplaintsTable";
import DailyPendingForClosedComplaintsTable from "../ComplaintDashboard/DailyComplaintTable/DailyPendingForClosedComplaintsTable";
import useComplaintReportsLive from "../../hooks/useComplaintReportsLive";
import { FiltersProvider } from "../../context/FiltersContext";
import CourierStatusWidget from "./CourierStatusWidget";
import { connectWebSocket, disconnectWebSocket } from "../../utils/websocketClient";

// ⬇️ NEW: lightweight UI for the daily stats block
import { Box, Paper, TextField, Typography } from "@mui/material";
import DashboardStats from "./DashboardStats";

// ---------------------------------------------
// LAZY-LOADED COMPONENTS
// ---------------------------------------------
const Scheduler = React.lazy(() => import("../Scheduler/Scheduler"));
const IslamabadComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/IslamabadComplaintTable/IslamabadComplaintTable")
);
const ClosedComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/ComplaintTable/ClosedComplaintsTable")
);
const OpenComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/ComplaintTable/OpenComplaintsTable")
);
const InProgressComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/ComplaintTable/InProgressComplaintsTable")
);
const ApprovedComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/ComplaintTable/ApprovedComplaintsTable")
);
const WaitForApprovalComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/ComplaintTable/WaitForApprovalComplaintsTable")
);
const OverallComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/ComplaintTable/OverallComplaintsTable")
);
const DailyClosedComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/DailyComplaintTable/DailyClosedComplaintsTable")
);
const DailyApprovedComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/DailyComplaintTable/DailyApprovedComplaintsTable")
);
const DailyInProgressComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/DailyComplaintTable/DailyInProgressComplaintsTable")
);
const DailyOpenComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/DailyComplaintTable/DailyOpenComplaintsTable")
);
const DailyWaitForApprovalComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/DailyComplaintTable/DailyWaitForApprovalComplaintsTable")
);
const PendingForClosedComplaintsTable = React.lazy(() =>
  import("../ComplaintDashboard/ComplaintTable/PendingForClosedComplaintsTable")
);
const Lab = React.lazy(() => import("../Lab/Lab"));
const LabAssigned = React.lazy(() => import("../Lab/LabAssigned/LabAssigned"));

function Dashboard() {
  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");

  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [showComplaintLog, setShowComplaintLog] = useState(false);
  const [viewStatus, setViewStatus] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [error, setError] = useState(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [isDailyView, setIsDailyView] = useState(false);
  const [showIncomingHardware, setShowIncomingHardware] = useState(false);
  const [showOutgoingHardware, setShowOutgoingHardware] = useState(false);
  const [showTodaysMetrics, setShowTodaysMetrics] = useState(false);
  const [showOverallMetrics, setShowOverallMetrics] = useState(false);
  const [showISBRWPComplaints, setShowISBRWPComplaints] = useState(false);
  const [complaintsRefreshKey, setComplaintsRefreshKey] = useState(0);

  // Dashboard Count
  const [dashboardCounts, setDashboardCounts] = useState(null);
  const [dashboardCountsLoading, setDashboardCountsLoading] = useState(true);
  const [dashboardCountsError, setDashboardCountsError] = useState(null);

  // Courier Status Counts (Donut)
  const [courierCounts, setCourierCounts] = useState(null);
  const [courierCountsLoading, setCourierCountsLoading] = useState(true);
  const [courierCountsError, setCourierCountsError] = useState(null);

  // Trends per date (multi-series line)
  const [trendsData, setTrendsData] = useState(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsError, setTrendsError] = useState(null);

  // Modals
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [changedFields, setChangedFields] = useState({});
  const [remarksUpdate, setRemarksUpdate] = useState("");
  const [latestRemarks, setLatestRemarks] = useState(null);
  const [remarksHistory, setRemarksHistory] = useState([]);
  const [isRemarksModalOpen, setIsRemarksModalOpen] = useState(false);

  // Others
  const [showMap, setShowMap] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [showLabAssigned, setShowLabAssigned] = useState(false);

  const currentDate = new Date().toISOString().split("T")[0];
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // ---- Daily stats (Scheduler-style) ----
  const [statsDate, setStatsDate] = useState(new Date().toISOString().slice(0, 10)); // default to today
  const [statsResources, setStatsResources] = useState([]);
  const [statsSchedules, setStatsSchedules] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // Dashboard Count
  useEffect(() => {
    fetchDashboardCounts();
  }, []);

  // -------------------------------------------------------------------------
  // EFFECT: WebSocket subscriptions for courier + trends live updates
  // -------------------------------------------------------------------------
  useEffect(() => {
    connectWebSocket(
      // On courier update
      (updatedCounts) => {
        setCourierCounts(updatedCounts);
        setCourierCountsLoading(false);
        setCourierCountsError(null);
      },
      // On trends update
      (updatedTrends) => {
        setTrendsData(updatedTrends);
        setTrendsLoading(false);
        setTrendsError(null);
      }
    );
    return () => {
      disconnectWebSocket();
    };
  }, []);

  const fetchDashboardCounts = async () => {
    setDashboardCountsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/complaints/dashboard-counts`, {
        withCredentials: true,
      });
      setDashboardCounts(res.data);
      setDashboardCountsError(null);
    } catch (err) {
      setDashboardCountsError("Error fetching dashboard counts");
      setDashboardCounts(null);
    } finally {
      setDashboardCountsLoading(false);
    }
  };

  useComplaintReportsLive(() => {
    fetchDashboardCounts();
  });

  // -------------------------------------------------------------------------
  // EFFECT: Grab role/username & initial data
  // -------------------------------------------------------------------------
  useEffect(() => {
    const userRole = localStorage.getItem("role") || "";
    const userName = localStorage.getItem("username") || "";
    const userId = localStorage.getItem("userId") || "";
    const userType = localStorage.getItem("userType") || "";
    setRole(userRole);
    setUsername(userName);

    if (userName === "abdullah" && userType === "OFFICE_USER") {
      setShowISBRWPComplaints(true);
      setViewStatus("Overall");
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get("tab");
    if (tab === "lab-assigned") setShowLabAssigned(true);
    if (tab === "isb-rwp-complaints") {
      setShowISBRWPComplaints(true);
      setViewStatus("Overall");
    }

    fetchStatuses();
  }, []);

  // Fetch courier counts + trends
  useEffect(() => {
    fetchDashboardCounts();
    fetchCourierCounts();
    fetchTrendsPerDate();
  }, []);

  useComplaintReportsLive(() => {
    fetchDashboardCounts();
    fetchCourierCounts();
    fetchTrendsPerDate();
  });

  const fetchCourierCounts = async () => {
    setCourierCountsLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/hardware-logs/courier-status-counts`,
        { withCredentials: true }
      );
      setCourierCounts(res.data);
      setCourierCountsError(null);
    } catch (err) {
      console.error(err);
      setCourierCounts(null);
      setCourierCountsError("Error fetching courier status counts");
    } finally {
      setCourierCountsLoading(false);
    }
  };

  // NEW: trends-per-date (multi series)
  const fetchTrendsPerDate = async () => {
    setTrendsLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/hardware-logs/trends-per-date`,
        { withCredentials: true }
      );
      setTrendsData(res.data); // map like { "YYYY-MM-DD": { hardwareReady: n, dispatchInward: n, ... } }
      setTrendsError(null);
    } catch (err) {
      console.error(err);
      setTrendsData(null);
      setTrendsError("Error fetching hardware trends");
    } finally {
      setTrendsLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // FETCH STATUSES
  // -------------------------------------------------------------------------
  const fetchStatuses = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/data/statuses`, {
        withCredentials: true,
      });
      setStatuses(response.data || []);
    } catch (err) {
      console.error("Error fetching statuses:", err);
    }
  };

  // -------------------------------------------------------------------------
  // ⬇️ NEW: FETCH RESOURCES + SCHEDULES FOR SELECTED DAY (for stats panel)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const fetchStatsData = async () => {
      if (!statsDate) return;
      setStatsLoading(true);
      setStatsError(null);
      try {
        const [visitorsRes, schedulesRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/data/visitors`, { withCredentials: true }),
          axios.get(
            `${API_BASE_URL}/schedules/by-range?start=${statsDate}&end=${statsDate}`,
            { withCredentials: true }
          ),
        ]);
        setStatsResources(visitorsRes.data || []);
        const all = schedulesRes.data || [];
        setStatsSchedules(all.filter(e => e.scheduledFor === statsDate));
      } catch (err) {
        console.error("Stats fetch failed:", err);
        setStatsError("Could not load daily schedule stats.");
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStatsData();
  }, [statsDate, API_BASE_URL]);

  // -------------------------------------------------------------------------
  // MODAL HANDLERS
  // -------------------------------------------------------------------------
  const handleOpenModal = (complaint) => {
    setSelectedComplaint(complaint);
    setChangedFields({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedComplaint(null);
  };

  const handleUpdateComplaintLog = async (e, data) => {
    e.preventDefault();
    try {
      const updateData = { ...changedFields };

      if (
        selectedComplaint?.complaintStatus === "Closed" &&
        !changedFields.closedDate
      ) {
        updateData.closedDate = new Date().toISOString().split("T")[0];
      }
      if (selectedComplaint?.complaintStatus === "Wait For Approval") {
        updateData.quotationDate =
          changedFields.quotationDate ||
          selectedComplaint.quotationDate ||
          new Date().toISOString().split("T")[0];
      }
      if (selectedComplaint?.complaintStatus === "Approved") {
        updateData.approvedDate =
          changedFields.approvedDate ||
          selectedComplaint.approvedDate ||
          new Date().toISOString().split("T")[0];
      }
      if (
        selectedComplaint?.complaintStatus === "Visit Schedule" &&
        data?.scheduleDate
      ) {
        updateData.scheduleDate = formatDateToLocal(data.scheduleDate);
      }

      await axios.put(
        `${API_BASE_URL}/complaints/${selectedComplaint?.id}`,
        updateData,
        { withCredentials: true }
      );

      setComplaints((prev) =>
        prev.map((c) =>
          c.id === selectedComplaint?.id
            ? {
                ...c,
                ...changedFields,
                complaintStatus: selectedComplaint?.complaintStatus,
                closedDate:
                  selectedComplaint?.complaintStatus === "Closed"
                    ? updateData.closedDate
                    : c.closedDate,
                quotationDate:
                  selectedComplaint?.complaintStatus === "Wait For Approval"
                    ? updateData.quotationDate
                    : c.quotationDate,
                approvedDate:
                  selectedComplaint?.complaintStatus === "Approved"
                    ? updateData.approvedDate
                    : c.approvedDate,
                scheduleDate:
                  selectedComplaint?.complaintStatus === "Visit Schedule"
                    ? updateData.scheduleDate
                    : c.scheduleDate,
                hardwarePickedDate:
                  selectedComplaint?.complaintStatus === "Hardware Picked"
                    ? updateData.hardwarePickedDate
                    : c.hardwarePickedDate,
                pendingForClosedDate:
                  selectedComplaint?.complaintStatus === "Pending For Closed"
                    ? updateData.pendingForClosedDate
                    : c.pendingForClosedDate,
                focDate:
                  selectedComplaint?.complaintStatus === "FOC"
                    ? updateData.focDate
                    : c.focDate,
              }
            : c
        )
      );

      fetchDashboardCounts();
      handleCloseModal();
    } catch (err) {
      console.error("Error updating complaint:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelectedComplaint((prev) => ({ ...prev, [name]: value }));
    setChangedFields((prev) => ({ ...prev, [name]: value }));
  };

  // -------------------------------------------------------------------------
  // REMARKS MODAL
  // -------------------------------------------------------------------------
  const openRemarksModal = (complaint) => {
    setSelectedComplaint(complaint);
    setIsRemarksModalOpen(true);
    fetchLatestRemarks(complaint.id);
    fetchRemarksHistory(complaint.id);
  };

  const closeRemarksModal = () => {
    setIsRemarksModalOpen(false);
    setLatestRemarks(null);
    setRemarksHistory([]);
    setRemarksUpdate("");
  };

  const handleAddRemarks = async () => {
    if (!remarksUpdate) return;
    try {
      await axios.post(
        `${API_BASE_URL}/complaints/${selectedComplaint?.id}/remarks`,
        { remarks: remarksUpdate },
        { withCredentials: true }
      );
      setRemarksUpdate("");
      fetchLatestRemarks(selectedComplaint?.id);
      fetchRemarksHistory(selectedComplaint?.id);
    } catch (err) {
      console.error("Error adding remarks:", err);
    }
  };

  const fetchLatestRemarks = async (complaintId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/complaints/${complaintId}/remarks/latest`,
        { withCredentials: true }
      );
      setLatestRemarks(response.data);
    } catch (err) {
      console.error("Error fetching latest remarks:", err);
    }
  };

  const fetchRemarksHistory = async (complaintId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/complaints/${complaintId}/remarks/history`,
        { withCredentials: true }
      );
      setRemarksHistory(response.data);
    } catch (err) {
      console.error("Error fetching remarks history:", err);
    }
  };

  // -------------------------------------------------------------------------
  // UTILITY FUNCTIONS
  // -------------------------------------------------------------------------
  const refreshComplaints = () => setComplaintsRefreshKey((k) => k + 1);

  const formatDateToLocal = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split("T")[0];
  };

  const calculateAgingDays = (date) => {
    const complaintDate = new Date(date);
    const now = new Date();
    return Math.floor((now - complaintDate) / (1000 * 60 * 60 * 24));
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Pending For Closed":
        return "status-pending-for-closed";
      case "Wait For Approval":
        return "status-wait-for-approval";
      case "Approved":
        return "status-approved";
      case "In Progress":
        return "status-in-progress";
      case "Closed":
        return "status-closed";
      case "FOC":
        return "status-foc";
      case "Quotation":
        return "status-qout";
      case "Network Issue":
        return "status-network-issue";
      case "Visit Schedule":
        return "status-visit-schedule";
      case "Marked In Pool":
        return "status-marked-in-pool";
      case "Hardware Picked":
        return "status-hardware-picked";
      case "Visit On Hold":
        return "status-visit-on-hold";
      case "dispatch inward":
        return "status-dispatch-inward";
      case "dispatch outward":
        return "status-dispatch-outward";
      case "received inward":
        return "status-received-inward";
      case "received outward":
        return "status-received-outward";
      case "hardware ready":
        return "status-hardware-ready";
      case "On Call":
        return "status-on-call";
      case "Renovation":
        return "status-renovation";
      case "Testing":
        return "status-testing";
      case "Disapproved":
        return "status-disapproved";
      case "Additional Counter":
        return "status-additional-counter";
      case "Verify Approval":
        return "status-verify-approval";
      case "BFC Approval":
        return "status-bfc-approval";
      case "AHO Approval":
        return "status-aho-approval";
      case "BFC/AHO":
        return "status-bfc-aho";
      case "Pre Approved":
        return "status-pre-approved";
      default:
        return "status-open";
    }
  };

  const getCourierStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case "dispatch inward":
        return "courier-status-dispatch-inward";
      case "dispatch outward":
        return "courier-status-dispatch-outward";
      case "received inward":
        return "courier-status-received-inward";
      case "received outward":
        return "courier-status-received-outward";
      case "hardware ready":
        return "status-hardware-ready";
      case "observation":
        return "status-observation";
      case "out of stock":
        return "status-out-of-stock";
      default:
        return "courier-status-na";
    }
  };

  // -------------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------------
  const handleComplaintSubmit = () => {
    setShowComplaintForm(false);
    fetchDashboardCounts();
  };

  const handleStatusCardClick = (status, isDaily) => {
    setViewStatus(status);
    setIsDailyView(isDaily);
    setShowComplaintForm(false);
    setShowComplaintLog(false);
    setShowMap(false);
  };

  const handleNavigation = (view) => {
    setShowComplaintForm(false);
    setShowComplaintLog(false);
    setShowScheduler(false);
    setShowMap(false);
    setViewStatus("");
    setIsDailyView(false);
    setShowIncomingHardware(false);
    setShowOutgoingHardware(false);
    setShowLab(false);
    setShowTodaysMetrics(false);
    setShowOverallMetrics(false);
    setShowISBRWPComplaints(false);

    switch (view) {
      case "dashboard":
        break;
      case "new-complaint":
        setShowComplaintForm(true);
        break;
     
      case "complaint-history":
        setShowComplaintLog(true);
        break;
      case "map":
        setShowMap(true);
        break;
      case "scheduler":
        setShowScheduler(true);
        break;
      case "incoming-hardware":
        setShowIncomingHardware(true);
        break;
      case "outgoing-hardware":
        setShowOutgoingHardware(true);
        break;
      case "lab":
        setShowLab(true);
        break;
      case "lab-assigned":
        setShowLabAssigned(true);
        break;
      case "todays-metrics":
        setShowTodaysMetrics(true);
        break;
      case "overall-metrics":
        setShowOverallMetrics(true);
        break;
      case "isb-rwp-complaints":
        setShowISBRWPComplaints(true);
        setViewStatus("Overall");
        break;
      default:
        break;
    }
  };

  // -------------------------------------------------------------------------
  // MAIN CONTENT RENDER
  // -------------------------------------------------------------------------
  const renderMainContent = () => {
    if (error) return <div className="error-message">{error}</div>;

    if (showComplaintForm)
      return <ComplaintForm onSubmit={handleComplaintSubmit} />;
    if (showComplaintLog) return <ComplaintDashboard complaints={complaints} />;
    if (showMap) return <Maps />;
    if (showScheduler)
      return (
        <Suspense fallback={<div>Loading Scheduler...</div>}>
          <Scheduler />
        </Suspense>
      );
    if (showIncomingHardware) {
      return (
        <IncomingHardwareLogList
          openRemarksModal={openRemarksModal}
          statuses={statuses}
          complaints={complaints}
        />
      );
    }
    if (showOutgoingHardware) {
      return (
        <OutgoingHardwareLogList
          openRemarksModal={openRemarksModal}
          statuses={statuses}
          complaints={complaints}
        />
      );
    }
    if (showLab) {
      return (
        <Suspense fallback={<div>Loading Lab...</div>}>
          <Lab openRemarksModal={openRemarksModal} />
        </Suspense>
      );
    }
    if (showLabAssigned) {
      return (
        <Suspense fallback={<div>Loading Lab...</div>}>
          <LabAssigned openRemarksModal={openRemarksModal} />
        </Suspense>
      );
    }
    if (showISBRWPComplaints)
      return (
        <Suspense fallback={<div>Loading ISB/RWP Complaints...</div>}>
          <IslamabadComplaintsTable
            handleOpenModal={handleOpenModal}
            openRemarksModal={openRemarksModal}
            calculateAgingDays={calculateAgingDays}
            getStatusClass={getStatusClass}
            getCourierStatusClass={getCourierStatusClass}
            refreshComplaints={refreshComplaints}
            complaintsRefreshKey={complaintsRefreshKey}
          />
        </Suspense>
      );

    if (showTodaysMetrics) return <TodaysMetrics />;
    if (showOverallMetrics) return <OverallMetrics />;

    if (viewStatus) {
      return (
        <>
          <h2>
            {isDailyView
              ? `Daily ${viewStatus} Complaints (for ${currentDate})`
              : `All ${viewStatus} Complaints`}
          </h2>

          {viewStatus === "Closed" && !isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <ClosedComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
              />
            </Suspense>
          )}
          {viewStatus === "Overall" && (
            <Suspense fallback={<div>Loading...</div>}>
              <OverallComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                complaintsRefreshKey={complaintsRefreshKey}
              />
            </Suspense>
          )}

          {viewStatus === "Open" && !isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <OpenComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                complaintsRefreshKey={complaintsRefreshKey}
                fetchDashboardCounts={fetchDashboardCounts}
              />
            </Suspense>
          )}

          {viewStatus === "In Progress" && !isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <InProgressComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                complaintsRefreshKey={complaintsRefreshKey}
              />
            </Suspense>
          )}

          {viewStatus === "Approved" && !isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <ApprovedComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                complaintsRefreshKey={complaintsRefreshKey}
              />
            </Suspense>
          )}

          {viewStatus === "Wait For Approval" && !isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <WaitForApprovalComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                complaintsRefreshKey={complaintsRefreshKey}
              />
            </Suspense>
          )}

          {viewStatus === "Pending For Closed" && !isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <PendingForClosedComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                complaintsRefreshKey={complaintsRefreshKey}
              />
            </Suspense>
          )}

          {/* Daily views */}
          {viewStatus === "Closed" && isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <DailyClosedComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                currentDate={currentDate}
                closedMode="openAndClosedSameDate"
              />
            </Suspense>
          )}
          {viewStatus === "Today Closed" && isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <DailyClosedComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                currentDate={currentDate}
                closedMode="closedOnly"
              />
            </Suspense>
          )}

          {viewStatus === "Open" && isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <DailyOpenComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                currentDate={currentDate}
                complaintsRefreshKey={complaintsRefreshKey}
              />
            </Suspense>
          )}
          {viewStatus === "In Progress" && isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <DailyInProgressComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                currentDate={currentDate}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                complaintsRefreshKey={complaintsRefreshKey}
              />
            </Suspense>
          )}
          {viewStatus === "Approved" && isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <DailyApprovedComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                currentDate={currentDate}
                complaintsRefreshKey={complaintsRefreshKey}
              />
            </Suspense>
          )}
          {viewStatus === "Wait For Approval" && isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <DailyWaitForApprovalComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                currentDate={currentDate}
                complaintsRefreshKey={complaintsRefreshKey}
              />
            </Suspense>
          )}
          {viewStatus === "Pending For Closed" && isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <DailyPendingForClosedComplaintsTable
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
                getCourierStatusClass={getCourierStatusClass}
                refreshComplaints={refreshComplaints}
                currentDate={currentDate}
                complaintsRefreshKey={complaintsRefreshKey}
              />
            </Suspense>
          )}
          {viewStatus === "Today Registered" && isDailyView && (
            <Suspense fallback={<div>Loading...</div>}>
              <TodayComplaintsTable
                complaints={complaints.filter(
                  (complaint) => complaint.date === currentDate
                )}
                handleOpenModal={handleOpenModal}
                openRemarksModal={openRemarksModal}
                calculateAgingDays={calculateAgingDays}
                getStatusClass={getStatusClass}
              />
            </Suspense>
          )}
        </>
      );
    }

    // Default dashboard
    return (
      <>
        <DashboardHeader />
        <StatusCards
          complaints={complaints}
          onStatusCardClick={handleStatusCardClick}
          dashboardCounts={dashboardCounts}
          dashboardCountsLoading={dashboardCountsLoading}
          dashboardCountsError={dashboardCountsError}
        />
        <DailyStatusCards
          complaints={complaints}
          onStatusCardClick={handleStatusCardClick}
          currentDate={currentDate}
          dashboardCounts={dashboardCounts}
          dashboardCountsLoading={dashboardCountsLoading}
          dashboardCountsError={dashboardCountsError}
        />

        {/* Courier status donut + trends line */}
        <CourierStatusWidget
          data={courierCounts}
          trendData={trendsData} // map-of-dates with series
          loading={courierCountsLoading || trendsLoading}
          error={courierCountsError || trendsError}
          onSliceClick={(status) => {
            // Optional: wire navigation/filter by courier status
            setViewStatus("");
          }}
        />

        {/* ---------------- Daily Success Stats (from Scheduler data) ---------------- */}
        {/* <Paper style={{ padding: 16, marginTop: 16 }}>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <Typography variant="h6" sx={{ mr: 2 }}>
              Daily Success Stats
            </Typography>
            <TextField
              label="Date"
              type="date"
              size="small"
              value={statsDate}
              onChange={(e) => setStatsDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <Box mt={2}>
            {statsLoading ? (
              <Typography variant="body2" color="text.secondary">Loading stats…</Typography>
            ) : statsError ? (
              <Typography variant="body2" color="error">{statsError}</Typography>
            ) : (
              <DashboardStats
                schedules={statsSchedules}
                resources={statsResources}
                filterDate={statsDate}
                showVisitorTable={true}
              />
            )}
          </Box>
        </Paper> */}
      </>
    );
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <FiltersProvider>
      <div className="dashboard-container">
        <Sidebar role={role} handleNavigation={handleNavigation} />

        <main className="main-content">
          {renderMainContent()}

          {/* Complaint Modal */}
          <ComplaintModal
            isOpen={isModalOpen}
            selectedComplaint={selectedComplaint}
            handleCloseModal={handleCloseModal}
            handleChange={handleChange}
            handleUpdateComplaintLog={handleUpdateComplaintLog}
            statuses={statuses}
            role={role}
            fetchLatestRemarks={fetchLatestRemarks}
            handleAddRemarks={handleAddRemarks}
            setRemarksUpdate={setRemarksUpdate}
          />

          {/* Remarks Modal */}
          <RemarksModal
            isOpen={isRemarksModalOpen}
            latestRemarks={latestRemarks}
            remarksHistory={remarksHistory}
            fetchLatestRemarks={fetchLatestRemarks}
            fetchRemarksHistory={fetchRemarksHistory}
            handleAddRemarks={handleAddRemarks}
            remarksUpdate={remarksUpdate}
            setRemarksUpdate={setRemarksUpdate}
            closeRemarksModal={closeRemarksModal}
            selectedComplaint={selectedComplaint}
          />
        </main>
      </div>
    </FiltersProvider>
  );
}

export default Dashboard;

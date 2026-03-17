import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import ComplaintReport from "../../ComplaintReport/ComplaintReport";
import "./ComplaintTable.css";
import ReportModal from "../../Lab/ReportModal";
import ComplaintFilters from "../ComplaintFilters/ComplaintFilters";
import { generateExcelReport } from "../../ExcelReportGenerator/ExcelReportGenerator";
import { generateDaySummaryReport } from "../../ExcelReportGenerator/generateDaySummaryReport";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import Loader from "../../../utils/Loader";
import { useFilters } from "../../../context/FiltersContext"; // ✅ shared filters context

// WebSocket auto-refresh hook (kept local as in your file)
function useComplaintReportsLive(onUpdate) {
  useEffect(() => {
    const wsUrl = (process.env.REACT_APP_API_BASE_URL || "") + "/ws";
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 5000,
      debug: () => {},
      onConnect: () => {
        client.subscribe("/topic/paginated-by-status", (message) => {
          try {
            const data =
              typeof message.body === "string"
                ? JSON.parse(message.body)
                : message.body;
            if (onUpdate) onUpdate(data);
          } catch {}
        });
      },
    });
    client.activate();
    return () => client.deactivate();
  }, [onUpdate]);
}

const pageSize = 100;

const OpenComplaintsTable = ({
  handleOpenModal,
  openRemarksModal,
  calculateAgingDays,
  getStatusClass,
  getCourierStatusClass,
  complaintsRefreshKey,
  fetchDashboardCounts,
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // ✅ Use global/shared filters, keep status local to this component
  const { filters: globalFilters, setFilters, defaultFilters } = useFilters();
  const [status] = useState("Open");

  const [remarksCounts, setRemarksCounts] = useState({});
  const [groups, setGroups] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [bankList, setBankList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [progress, setProgress] = useState(0);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [hoveredComplaintId, setHoveredComplaintId] = useState(null);

  // 🔹 full complaint object for report modal (so we can pass bank/branch/city + internal id)
  const [selectedComplaintForReports, setSelectedComplaintForReports] =
    useState(null);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportAvailability, setReportAvailability] = useState({});

  // 🔹 parts cache keyed by internal complaint id (same as Lab uses complaintLog.id)
  const [hardwarePartsByComplaintId, setHardwarePartsByComplaintId] =
    useState({});

  // NEW: backend-provided running serial offset (complaints before this page)
  const [complaintsBeforePage, setComplaintsBeforePage] = useState(0);

  // Helper for all complaints flat array
  const allComplaintsFlat = groups.flatMap((g) => g.complaints || []);

  // Dropdowns for filters
  const uniqueBanks = Array.from(
    new Set(allComplaintsFlat.map((c) => c.bankName).filter(Boolean))
  );
  const uniqueEngineers = Array.from(
    new Set(allComplaintsFlat.map((c) => c.engineerName).filter(Boolean))
  );
  const uniqueCities = Array.from(
    new Set(allComplaintsFlat.map((c) => c.city).filter(Boolean))
  );
  const uniqueSubStatuses = Array.from(
    new Set(allComplaintsFlat.map((c) => c.subStatus).filter(Boolean))
  );

  // Report types
  const reportTypes = [
    { value: "standard", label: "Standard" },
    { value: "untouched", label: "Untouched" },
    { value: "ageing", label: "Aging" },
    { value: "daySummaryMulti", label: "Day Summary" },
  ];

  // small util
  const pick = (obj, keys) =>
    Object.fromEntries(
      keys
        .map((k) => [k, obj?.[k]])
        .filter(([, v]) => v !== undefined && v !== "")
    );

  // Only the fields this component cares about (avoid cross-tab leaks)
  const OPEN_ALLOWED_KEYS = [
    "bankName",
    "branchCode",
    "branchName",
    "engineerName",
    "city",
    "complaintStatus",
    "subStatus",
    "priority",
    "inPool",
    "hasReport",
    // open date keys:
    "date",
    "dateFrom",
    "dateTo",
    // export only:
    "reportType",
  ];

  // Live websocket refresh
  useComplaintReportsLive(async (wsData) => {
    if (!wsData || !wsData.complaintId) return;

    // Check if the complaint is visible in the current groups
    const isVisible = groups.some((group) =>
      (group.complaints || []).some((c) => c.complaintId === wsData.complaintId)
    );

    if (wsData.action === "created") {
      try {
        // Fetch the new complaint by complaintId
        const res = await axios.get(`${API_BASE_URL}/complaints/by-id`, {
          params: { complaintId: wsData.complaintId },
          withCredentials: true,
        });
        const newComplaint = res.data;
        setGroups((prevGroups) => {
          const groupKey = `${newComplaint.bankName}|${newComplaint.branchCode}|${newComplaint.branchName}`;
          let found = false;
          const newGroups = prevGroups.map((group) => {
            const gKey = `${group.bankName}|${group.branchCode}|${group.branchName}`;
            if (gKey === groupKey) {
              found = true;
              return {
                ...group,
                complaints: [newComplaint, ...(group.complaints || [])],
              };
            }
            return group;
          });
          if (!found) {
            // If the group doesn't exist, add it to the top
            return [
              {
                bankName: newComplaint.bankName,
                branchCode: newComplaint.branchCode,
                branchName: newComplaint.branchName,
                complaints: [newComplaint],
              },
              ...prevGroups,
            ];
          }
          return newGroups;
        });
        fetchDashboardCounts && fetchDashboardCounts();
      } catch (e) {
        // fallback to full reload only if needed
        fetchComplaints();
        fetchDashboardCounts && fetchDashboardCounts();
      }
      return;
    }

    if (!isVisible) return;

    try {
      // Fetch the updated complaint by complaintId
      const res = await axios.get(`${API_BASE_URL}/complaints/by-id`, {
        params: { complaintId: wsData.complaintId },
        withCredentials: true,
      });
      const updatedComplaint = res.data;
      console.log("Updated complaint:", updatedComplaint.courierStatus);
      setGroups((prevGroups) =>
        prevGroups.map((group) => ({
          ...group,
          complaints: (group.complaints || []).map((c) =>
            c.complaintId === wsData.complaintId ? updatedComplaint : c
          ),
        }))
      );

      fetchDashboardCounts && fetchDashboardCounts();
    } catch {
      // fallback to full refresh only if needed
      // fetchComplaints();
    }
  });

  // Fetch complaints (with filters)
  const fetchComplaints = async () => {
    setLoading(true);
    setProgress(0); // reset loader percentage

    // simulate progress increase until 90%
    let interval = setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + 10 : prev));
    }, 300);

    try {
      // Use shared filters (whitelisted) + local status
      const shared = pick(globalFilters, OPEN_ALLOWED_KEYS);
      const { reportType, ...filtersForApi } = shared; // don't send reportType to list API

      const params = {
        page: currentPage,
        size: pageSize,
        status, // ⬅️ force local status
        ...filtersForApi,
        hasReport: shared.hasReport ? true : undefined,
      };

      // Remove empty/undefined
      Object.keys(params).forEach(
        (key) =>
          (params[key] === undefined || params[key] === "") && delete params[key]
      );

      const res = await axios.get(
        `${API_BASE_URL}/complaints/paginated-by-status`,
        {
          params,
          withCredentials: true,
        }
      );

      // Defensive: sort each group's complaints by date (latest first)
      const nextGroups = Array.isArray(res.data.content)
        ? res.data.content.map((group) => ({
            ...group,
            complaints: (group.complaints || []).sort(
              (a, b) => new Date(b.date) - new Date(a.date)
            ),
          }))
        : [];

      setGroups(nextGroups);
      setTotalPages(res.data.totalPages || 1);
      setTotalRecords(res.data.totalElements || 0);

      // NEW: read backend header for continuous S.No offset
      const beforePageHeader =
        res.headers?.["x-complaints-before-page"] ??
        res.headers?.["X-Complaints-Before-Page"];
      setComplaintsBeforePage(Number.parseInt(beforePageHeader, 10) || 0);

      // complete progress
      setProgress(100);
    } catch (err) {
      setGroups([]);
      setTotalPages(1);
      setTotalRecords(0);
      setComplaintsBeforePage(0); // reset offset on error
      setProgress(100); // still show 100% if error
    } finally {
      clearInterval(interval);
      setTimeout(() => setLoading(false), 500); // short delay to let 100% show
    }
  };

  // Fetch remarks counts for all complaints in current groups
  useEffect(() => {
    const idsToFetch = allComplaintsFlat
      .map((c) => c.id)
      .filter((id) => id && remarksCounts[id] === undefined);

    if (idsToFetch.length) {
      axios
        .post(`${API_BASE_URL}/complaints/remarks/counts`, idsToFetch, {
          withCredentials: true,
        })
        .then((res) => {
          setRemarksCounts((prev) => ({ ...prev, ...res.data }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, [groups]);

  // Fetch complaints when filters/page/refresh change
  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line
  }, [globalFilters, status, currentPage, complaintsRefreshKey]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [globalFilters]);

  // Fetch report availability for all visible complaints
  useEffect(() => {
    const visibleComplaintIds = allComplaintsFlat
      .map((c) => c.complaintId)
      .filter((id) => id && reportAvailability[id] === undefined);

    if (visibleComplaintIds.length > 0) {
      axios
        .post(
          `${API_BASE_URL}/hardware-logs/reports/availability`,
          visibleComplaintIds,
          { withCredentials: true }
        )
        .then((response) => {
          setReportAvailability((prev) => ({ ...prev, ...response.data }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, [groups]);

  // Fetch dropdown options from backend on mount
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/data/banks`, { withCredentials: true })
      .then((res) => setBankList(res.data))
      .catch(() => setBankList([]));
    axios
      .get(`${API_BASE_URL}/data/cities`, { withCredentials: true })
      .then((res) => setCityList(res.data))
      .catch(() => setCityList([]));
    axios
      .get(`${API_BASE_URL}/data/statuses`, { withCredentials: true })
      .then((res) => setStatusList(res.data))
      .catch(() => setStatusList([]));
    axios
      .get(`${API_BASE_URL}/data/visitors`, { withCredentials: true })
      .then((res) => setEngineers(res.data))
      .catch(() => setEngineers([]));
  }, [API_BASE_URL]);

  // Clear filters: reset shared filters (status stays local)
  const handleClearFilters = () => {
    setFilters(defaultFilters);
  };

  // Export helpers
  const EXPORT_PAGE_SIZE = 1000; // bigger chunk size for export
  const EXPORT_BATCH_SIZE = 3; // safe parallel requests per batch

  const fetchAllComplaintsForExport = async () => {
    const shared = pick(globalFilters, OPEN_ALLOWED_KEYS);
    const { reportType, ...filtersForApi } = shared;

    // 1) First page request to get totalPages + initial data
    const firstRes = await axios.get(
      `${API_BASE_URL}/complaints/paginated-by-status`,
      {
        params: { ...filtersForApi, status, page: 0, size: EXPORT_PAGE_SIZE },
        withCredentials: true,
      }
    );

    let allFetched = Array.isArray(firstRes.data?.content)
      ? firstRes.data.content.flatMap((g) => g.complaints || [])
      : [];

    const totalPages = firstRes.data?.totalPages || 1;
    if (totalPages <= 1) return allFetched;

    // 2) Remaining pages fetched in parallel batches
    const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 1);

    for (let i = 0; i < pages.length; i += EXPORT_BATCH_SIZE) {
      const slice = pages.slice(i, i + EXPORT_BATCH_SIZE);

      const responses = await Promise.all(
        slice.map((p) =>
          axios.get(`${API_BASE_URL}/complaints/paginated-by-status`, {
            params: { ...filtersForApi, status, page: p, size: EXPORT_PAGE_SIZE },
            withCredentials: true,
          })
        )
      );

      responses.forEach((res) => {
        if (Array.isArray(res.data?.content)) {
          allFetched = allFetched.concat(
            res.data.content.flatMap((g) => g.complaints || [])
          );
        }
      });
    }

    return allFetched;
  };

  const handleGenerateReport = async (passedFilters) => {
    const filtersToUse = passedFilters || globalFilters;

    if (!filtersToUse.reportType) {
      alert("Please select a report type before generating.");
      return;
    }

    if (filtersToUse.reportType === "daySummaryMulti") {
      const [summaryResp, hardwareResp, engineerResp] = await Promise.all([
        fetch(`${API_BASE_URL}/complaints/complaints-summary`, {
          credentials: "include",
        }),
        fetch(`${API_BASE_URL}/hardware-logs/hardware-dispatch-detail`, {
          credentials: "include",
        }),
        fetch(`${API_BASE_URL}/complaints/city-wise-summary`, {
          credentials: "include",
        }),
      ]);
      if (!summaryResp.ok || !hardwareResp.ok || !engineerResp.ok) {
        alert("Failed to fetch one or more report sections!");
        return;
      }
      const summaryData = await summaryResp.json();
      const hardwareData = await hardwareResp.json();
      const engineerData = await engineerResp.json();
      await generateDaySummaryReport(summaryData, hardwareData, engineerData);
      return;
    }

    try {
      setLoading(true);
      const allComplaints = await fetchAllComplaintsForExport();

      // ⬅️ Exclude "Wait For Approval" complaints
      const filteredComplaints = allComplaints.filter(
        (c) => c.complaintStatus !== "Wait For Approval"
      );

      await generateExcelReport(
        filteredComplaints,
        status, // ⬅️ sheet/status label
        API_BASE_URL,
        uniqueCities,
        filtersToUse.reportType
      );
    } catch (err) {
      alert("Failed to fetch all data for export.");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (complaintId) => {
    setSelectedRow((prevSelectedRow) =>
      prevSelectedRow === complaintId ? null : complaintId
    );
  };

  const isSpecialCity = (city) => {
    if (!city) return false;
    const normalized = city.trim().toLowerCase();
    return (
      normalized === "lahore" ||
      normalized === "islamabad" ||
      normalized === "rawalpindi"
    );
  };

  const handleViewHistory = (complaintId) => {
    setSelectedComplaintId(complaintId);
  };

  const handleBackToTable = () => {
    setSelectedComplaintId(null);
  };

  const shouldHighlightRow = (complaint) => {
    const complaintDate = new Date(complaint.date);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - complaintDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 3;
  };

  // 🔹 fetch parts for a complaint's internal id (same endpoint style as Lab)
  const fetchPartsForComplaint = useCallback(
    async (internalId) => {
      if (!internalId) return;
      try {
        const res = await axios.get(
          `${API_BASE_URL}/hardware-logs/${internalId}/parts`,
          { withCredentials: true }
        );
        setHardwarePartsByComplaintId((prev) => ({
          ...prev,
          [internalId]: res.data,
        }));
      } catch {
        setHardwarePartsByComplaintId((prev) => ({
          ...prev,
          [internalId]: [],
        }));
      }
    },
    [API_BASE_URL]
  );

  // 🔹 Use full complaint when opening reports, and load its parts
  const openReportsForComplaint = (complaint) => {
    setSelectedComplaintForReports(complaint);
    setIsReportModalOpen(true);

    if (complaint?.id) {
      fetchPartsForComplaint(complaint.id);
    }
  };

  const closeReportModal = () => {
    setSelectedComplaintForReports(null);
    setIsReportModalOpen(false);
  };

  const togglePriority = async (complaint) => {
    try {
      const newPriority = !complaint.priority;
      await axios.put(
        `${API_BASE_URL}/complaints/${complaint.id}`,
        { isPriority: newPriority },
        { withCredentials: true }
      );
      fetchComplaints();
    } catch (error) {}
  };

  const toggleInPool = async (complaint) => {
    try {
      const newMarkedInPool = !complaint.markedInPool;
      await axios.patch(
        `${API_BASE_URL}/complaints/${complaint.id}/in-pool`,
        { markedInPool: newMarkedInPool },
        { withCredentials: true }
      );
      fetchComplaints();
    } catch (error) {}
  };

  // S.No. offset comes from backend (continuous across pages)
  let serialCounter = complaintsBeforePage;

  return (
    <div>
      {/* FILTERS BAR */}
      <ComplaintFilters
        filters={globalFilters} // ⬅️ shared filters
        onFiltersChange={setFilters} // ⬅️ update shared filters
        banks={bankList}
        cities={cityList}
        statuses={statusList}
        engineers={engineers}
        uniqueSubStatuses={uniqueSubStatuses}
        reportTypes={reportTypes}
        totalRecords={totalRecords}
        onClear={handleClearFilters}
        onGenerateReport={handleGenerateReport}
        dateFieldConfig={{
          field: "date",
          label: "Complaint Date",
          placeholder: "yyyy-mm-dd",
        }}
        apiBase={API_BASE_URL}
      />

      {/* Complaint Table */}
      {selectedComplaintId ? (
        <div>
          <button onClick={handleBackToTable} className="back-button">
            Back to Table
          </button>
          <ComplaintReport complaintId={selectedComplaintId} />
        </div>
      ) : (
        <>
          <table className="complaint-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Complaint Status</th>
                <th>Courier Status</th>
                <th>Actions</th>
                <th>In Pool</th>
                <th>Remarks</th>
                <th>Report</th>
                <th>Date</th>
                <th>Bank Name</th>
                <th>Branch Code</th>
                <th>Branch Name</th>
                <th>City</th>
                <th>Reference Number</th>
                <th>Complaint Type</th>
                <th>Details</th>
                <th>Hardware</th>
                <th>Visitor Name</th>
                <th>Repeat Complaint</th>
                <th>Aging Days</th>
                <th>Visit Schedule Date</th>
                <th>Complaint ID</th>
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <Loader progress={progress} />
              ) : groups.length > 0 ? (
                groups.map((group, groupIdx) => (
                  <React.Fragment
                    key={group.bankName + group.branchCode + groupIdx}
                  >
                    {/* Group Header Row */}
                    <tr className="group-header-row">
                      <td
                        className="group-header-row-data"
                        colSpan="22"
                        style={{
                          fontSize: "16px",
                          fontWeight: "bold",
                          backgroundColor: "#d6eaf8",
                          padding: "10px",
                          lineHeight: "1.6",
                        }}
                      >
                        <span>Bank Name: {group.bankName}</span>
                        {" | "}
                        <span>Branch Code: {group.branchCode}</span>
                        {" | "}
                        <span>Branch Name: {group.branchName}</span>
                      </td>
                    </tr>
                    {(group.complaints || []).map((complaint) => {
                      serialCounter++;
                      return (
                        <tr
                          key={complaint.id}
                          onClick={() => handleRowClick(complaint.id)}
                          className={`
                            ${
                              selectedRow === complaint.id ? "selected-row" : ""
                            }
                            ${
                              shouldHighlightRow(complaint)
                                ? "highlight-row"
                                : ""
                            }
                            ${complaint.priority ? "priority-row" : ""}
                          `}
                        >
                          <td>{serialCounter}</td>
                          <td
                            className={getStatusClass(
                              complaint.complaintStatus
                            )}
                          >
                            <div
                              className="status-hover-container"
                              onMouseEnter={() =>
                                setHoveredComplaintId(complaint.id)
                              }
                              onMouseLeave={() => setHoveredComplaintId(null)}
                            >
                              {complaint.complaintStatus || "Open"}
                              {hoveredComplaintId === complaint.id &&
                                complaint.complaintStatus ===
                                  "Visit Schedule" && (
                                  <div className="visit-schedule-tooltip">
                                    <p>
                                      Schedule Date:{" "}
                                      {complaint.scheduleDate || "N/A"}
                                    </p>
                                    <p>
                                      Engineer: {complaint.visitorName || "N/A"}
                                    </p>
                                    <p>Bank: {complaint.bankName || "N/A"}</p>
                                    <p>
                                      Branch Code:{" "}
                                      {complaint.branchCode || "N/A"}
                                    </p>
                                  </div>
                                )}
                            </div>
                          </td>
                          <td
                            className={getCourierStatusClass(
                              complaint.courierStatus
                            )}
                          >
                            {complaint.courierStatus || "N/A"}
                          </td>
                          <td>
                            <button
                              className="update-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(complaint);
                              }}
                            >
                              Update
                            </button>
                            <button
                              className={`priority-button ${
                                complaint.priority ? "priority-active" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePriority(complaint);
                              }}
                              title={
                                complaint.priority
                                  ? "Unmark Priority"
                                  : "Mark as Priority"
                              }
                              aria-label={
                                complaint.priority
                                  ? "Unmark Priority"
                                  : "Mark as Priority"
                              }
                            >
                              {complaint.priority
                                ? "High Priority"
                                : "Mark as Priority"}
                            </button>
                          </td>
                          {isSpecialCity(complaint.city) ? (
                            <td>
                              <button
                                className={`pool-button ${
                                  complaint.markedInPool ? "active" : ""
                                }`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await toggleInPool(complaint);
                                }}
                                title={
                                  complaint.markedInPool
                                    ? "Remove from Pool"
                                    : "Mark as In Pool"
                                }
                              >
                                {complaint.markedInPool
                                  ? "Remove from Pool"
                                  : "Mark In Pool"}
                                <span
                                  className="city-badge"
                                  title={`Special: ${complaint.city}`}
                                >
                                  🏙️
                                </span>
                              </button>
                            </td>
                          ) : (
                            <td />
                          )}
                          <td>
                            <button
                              className={`remark-button ${
                                remarksCounts[complaint.id] === undefined
                                  ? "remark-button-loading"
                                  : remarksCounts[complaint.id] > 0
                                  ? "remark-button-green"
                                  : "remark-button-red"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openRemarksModal(complaint);
                              }}
                              disabled={
                                remarksCounts[complaint.id] === undefined
                              }
                            >
                              {remarksCounts[complaint.id] === undefined
                                ? "Loading..."
                                : "Remarks"}
                              <span
                                className={`remarks-count ${
                                  remarksCounts[complaint.id] > 0
                                    ? "remarks-count-green"
                                    : "remarks-count-red"
                                }`}
                              >
                                {remarksCounts[complaint.id] || 0}
                              </span>
                            </button>
                          </td>

                          <td>
                            {reportAvailability[complaint.complaintId] ===
                            undefined ? (
                              <button
                                className="view-report-button loading-btn"
                                disabled
                              >
                                Checking...
                              </button>
                            ) : reportAvailability[complaint.complaintId] ? (
                              <button
                                className="view-report-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReportsForComplaint(complaint); // ✅ full complaint
                                }}
                              >
                                View Reports
                              </button>
                            ) : (
                              <button
                                className="view-report-button grey-button"
                                disabled
                              >
                                No Reports
                              </button>
                            )}
                          </td>
                          <td>{complaint.date}</td>
                          <td>{complaint.bankName}</td>
                          <td>{complaint.branchCode}</td>
                          <td>{complaint.branchName}</td>
                          <td>{complaint.city}</td>
                          <td>{complaint.referenceNumber || "N/A"}</td>
                          <td>{complaint.complaintType || "N/A"}</td>
                          <td
                            className="truncated-cell"
                            title={complaint.details || "No details provided"}
                          >
                            {complaint.details || "No details provided"}
                          </td>
                          <td>{complaint.equipmentDescription}</td>
                          <td>{complaint.visitorName}</td>
                          <td>{complaint.repeatComplaint ? "Yes" : "No"}</td>
                          <td>{calculateAgingDays(complaint.date)}</td>
                          <td>{complaint.scheduleDate || "N/A"}</td>
                          <td>{complaint.complaintId}</td>
                          <td>
                            <button
                              className="view-history-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewHistory(complaint.complaintId);
                              }}
                            >
                              View History
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="22" style={{ textAlign: "center" }}>
                    No open complaints to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-container">
              <button
                className="page-button"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 0}
              >
                &lt; Previous
              </button>
              <span style={{ margin: "0 1em" }}>
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                className="page-button"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage + 1 >= totalPages}
              >
                Next &gt;
              </button>
            </div>
          )}
        </>
      )}

      {/* 🔻 ReportModal wired like Lab's ReportModal */}
      <ReportModal
        isOpen={isReportModalOpen}
        complaintId={selectedComplaintForReports?.complaintId}
        handleClose={closeReportModal}
        /* parts / management context */
        partsLogId={selectedComplaintForReports?.id} // internal complaint id → /hardware-logs/{id}/parts
        API_BASE_URL={API_BASE_URL}
        hardwareParts={
          selectedComplaintForReports?.id
            ? hardwarePartsByComplaintId[selectedComplaintForReports.id]
            : []
        }
        refreshParts={() => {
          if (selectedComplaintForReports?.id) {
            fetchPartsForComplaint(selectedComplaintForReports.id);
          }
        }}
        bankName={selectedComplaintForReports?.bankName}
        branchCode={selectedComplaintForReports?.branchCode}
        branchName={selectedComplaintForReports?.branchName}
        complaintCity={selectedComplaintForReports?.city}
      />
    </div>
  );
};

export default OpenComplaintsTable;

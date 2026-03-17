import React, { useState, useEffect } from "react";
import axios from "axios";
import ComplaintReport from "../../ComplaintReport/ComplaintReport";
import "./ComplaintTable.css";
import ReportModal from "../../Lab/ReportModal";
import ComplaintFilters from "../ComplaintFilters/ComplaintFilters";
import { generateExcelReport } from "../../ExcelReportGenerator/ExcelReportGenerator";
import { generateDaySummaryReport } from "../../ExcelReportGenerator/generateDaySummaryReport";
import useComplaintReportsLive from "../../../hooks/useComplaintReportsLive";
import Loader from "../../../utils/Loader";
import { useFilters } from "../../../context/FiltersContext"; // ⬅️ shared/global filters

const pageSize = 5;

const OverallComplaintsTable = ({
  handleOpenModal,
  openRemarksModal,
  calculateAgingDays,
  getStatusClass,
  getCourierStatusClass,
  complaintsRefreshKey,
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // ⬅️ Use global filters (shared across components), but keep status local
  const { filters: globalFilters, setFilters, defaultFilters } = useFilters();
  const [status] = useState("Overall");

  const [branchGroups, setBranchGroups] = useState([]); // groups from API
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [remarksCounts, setRemarksCounts] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [hoveredComplaintId, setHoveredComplaintId] = useState(null);
  const [selectedComplaintIdForReports, setSelectedComplaintIdForReports] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportAvailability, setReportAvailability] = useState({});
  const [bankList, setBankList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [progress, setProgress] = useState(0);

  // NEW: backend-provided serial offset (complaints before this page)
  const [complaintsBeforePage, setComplaintsBeforePage] = useState(0);

  const reportTypes = [
    { value: "standard", label: "Standard" },
    { value: "untouched", label: "Untouched" },
    { value: "ageing", label: "Aging" },
    { value: "daySummaryMulti", label: "Day Summary" },
  ];

  // For report generation filters and dropdown sources
  const allComplaints = branchGroups.flatMap((group) => group.complaints || []);
  // const uniqueBanks = Array.from(new Set(allComplaints.map((c) => c.bankName).filter(Boolean)));
  // const uniqueEngineers = Array.from(new Set(allComplaints.map((c) => c.engineerName).filter(Boolean)));
  const uniqueCities = Array.from(new Set(allComplaints.map((c) => c.city).filter(Boolean)));
  const uniqueSubStatuses = Array.from(new Set(allComplaints.map((c) => c.subStatus).filter(Boolean)));

  // --- Fetch complaints (UPDATED to read header X-Complaints-Before-Page)
  const fetchComplaints = async () => {
    setLoading(true);
    setProgress(0);

    // simulate progress increment
    let interval = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 10 : p)); // up to 90%
    }, 300);

    try {
      const { reportType, ...filtersForApi } = globalFilters;
      const params = { page: currentPage, size: pageSize, ...filtersForApi, status }; // ⬅️ enforce local status

      const res = await axios.get(`${API_BASE_URL}/complaints/paginated-by-status`, {
        params,
        withCredentials: true,
      });

      // --- Update table data ---
      setBranchGroups(res.data?.content || []);
      setTotalPages(res.data?.totalPages || 1);
      setTotalRecords(res.data?.totalElements || 0);

      // --- Read complaintsBeforePage from backend header (axios lowercases header names)
      const beforePageHeader =
        res.headers?.["x-complaints-before-page"] ??
        res.headers?.["X-Complaints-Before-Page"]; // just in case
      setComplaintsBeforePage(Number.parseInt(beforePageHeader, 10) || 0);
    } catch (e) {
      setBranchGroups([]);
      setTotalPages(1);
      setTotalRecords(0);
      setComplaintsBeforePage(0);
    } finally {
      clearInterval(interval);
      setProgress(100); // complete
      setTimeout(() => setLoading(false), 500); // small delay for smoothness
    }
  };

  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalFilters, status, currentPage, complaintsRefreshKey]);

  useEffect(() => {
    setCurrentPage(0);
  }, [globalFilters]);

  // --- Live updates via WebSocket
  useComplaintReportsLive(async (wsData) => {
    if (!wsData || !wsData.complaintId) return;

    // Check if the complaint is visible in the current groups
    const isVisible = branchGroups.some((group) =>
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
        setBranchGroups((prevGroups) => {
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
            // If group doesn't exist, add new group to top
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
      } catch {
        fetchComplaints(); // fallback to full reload only if needed
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

      setBranchGroups((prevGroups) =>
        prevGroups.map((group) => ({
          ...group,
          complaints: (group.complaints || []).map((c) =>
            c.complaintId === wsData.complaintId ? updatedComplaint : c
          ),
        }))
      );
    } catch {
      // fallback: fetchComplaints();
    }
  });

  // --- Fetch remarks counts for visible (flat) complaints
  useEffect(() => {
    const idsToFetch = allComplaints.map((c) => c.id).filter((id) => id && remarksCounts[id] === undefined);
    if (idsToFetch.length) {
      axios
        .post(`${API_BASE_URL}/complaints/remarks/counts`, idsToFetch, { withCredentials: true })
        .then((res) => setRemarksCounts((prev) => ({ ...prev, ...res.data })))
        .catch(() => {});
    }
  }, [branchGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fetch report availability for visible (flat) complaints
  useEffect(() => {
    const visibleComplaintIds = allComplaints
      .map((c) => c.complaintId)
      .filter((id) => id && reportAvailability[id] === undefined);
    if (visibleComplaintIds.length > 0) {
      axios
        .post(`${API_BASE_URL}/hardware-logs/reports/availability`, visibleComplaintIds, { withCredentials: true })
        .then((response) => setReportAvailability((prev) => ({ ...prev, ...response.data })))
        .catch(() => {});
    }
  }, [branchGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fetch dropdown options
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

  // --- Clear shared filters (keep local status)
  const handleClearFilters = () => {
    setFilters(defaultFilters);
  };

  // --- Export helpers
  const EXPORT_PAGE_SIZE = 2000; // larger chunk for export
  const EXPORT_BATCH_SIZE = 3; // safe parallel batch size

  const fetchAllComplaintsForExport = async () => {
    const { reportType, ...filtersForApi } = globalFilters;

    // 1) First request to discover totalPages + collect first chunk
    const firstRes = await axios.get(`${API_BASE_URL}/complaints/paginated-by-status`, {
      params: { ...filtersForApi, status, page: 0, size: EXPORT_PAGE_SIZE },
      withCredentials: true,
    });

    let allFetched = Array.isArray(firstRes.data?.content)
      ? firstRes.data.content.flatMap((g) => g.complaints || [])
      : [];

    const totalPages = firstRes.data?.totalPages || 1;
    if (totalPages <= 1) return allFetched;

    // 2) Fetch remaining pages in parallel batches
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
          allFetched = allFetched.concat(res.data.content.flatMap((g) => g.complaints || []));
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
      const allComplaints = await fetchAllComplaintsForExport(filtersToUse);
      await generateExcelReport(
        allComplaints,
        status, // ⬅️ use local status for report title/sheet
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

  // --- row helpers
  const handleRowClick = (complaintId) => {
    setSelectedRow((prevSelectedRow) => (prevSelectedRow === complaintId ? null : complaintId));
  };

  const handleViewHistory = (complaintId) => setSelectedComplaintId(complaintId);
  const handleBackToTable = () => setSelectedComplaintId(null);

  const openReportsForComplaint = (complaintId) => {
    setSelectedComplaintIdForReports(complaintId);
    setIsReportModalOpen(true);
  };
  const closeReportModal = () => {
    setSelectedComplaintIdForReports(null);
    setIsReportModalOpen(false);
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
    } catch (error) {
      console.error("Error toggling In Pool status:", error);
    }
  };

  const isSpecialCity = (city) => {
    if (!city) return false;
    const normalized = city.trim().toLowerCase();
    return normalized === "lahore" || normalized === "islamabad" || normalized === "rawalpindi";
  };

  // --- Serial number: start from backend-provided offset
  let serialCounter = complaintsBeforePage;

  return (
    <div>
      <ComplaintFilters
        filters={globalFilters} // ⬅️ shared filters
        onFiltersChange={setFilters} // ⬅️ shared setter
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
      />

      {selectedComplaintId ? (
        <div>
          <button onClick={handleBackToTable} className="back-button" style={{ marginBottom: "10px" }}>
            Back to Table
          </button>
          <div style={{ padding: "10px", border: "1px solid #ccc" }}>
            <ComplaintReport complaintId={selectedComplaintId} />
          </div>
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
                <th>Closed Date</th>
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
                <th>Pending Closed Date</th>
                <th>Quotation Date</th>
                <th>Approved Date</th>
                <th>Document Received</th>
                <th>Complaint ID</th>
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <Loader progress={progress} />
              ) : branchGroups.length > 0 ? (
                branchGroups.map((group, groupIndex) => (
                  <React.Fragment key={groupIndex}>
                    <tr className="group-header-row">
                      <td
                        className="group-header-row-data"
                        colSpan="26"
                        style={{
                          fontWeight: "bold",
                          backgroundColor: "#d6eaf8",
                          padding: "10px",
                          lineHeight: "1.6",
                        }}
                      >
                        <span>Bank Name: {group.bankName}</span>{" "}
                        <span>Branch Code: {group.branchCode}</span>{" "}
                        <span>Branch Name: {group.branchName}</span>
                      </td>
                    </tr>
                    {(group.complaints || []).map((complaint) => {
                      serialCounter++;
                      return (
                        <tr
                          key={complaint.id}
                          onClick={() => handleRowClick(complaint.id)}
                          className={selectedRow === complaint.id ? "selected-row" : ""}
                        >
                          <td>{serialCounter}</td>
                          <td className={getStatusClass(complaint.complaintStatus)}>
                            <div
                              className="status-hover-container"
                              onMouseEnter={() => setHoveredComplaintId(complaint.id)}
                              onMouseLeave={() => setHoveredComplaintId(null)}
                            >
                              {complaint.complaintStatus || "Open"}
                              {hoveredComplaintId === complaint.id &&
                                complaint.complaintStatus === "Visit Schedule" && (
                                  <div className="visit-schedule-tooltip">
                                    <p>Schedule Date: {complaint.scheduleDate || "N/A"}</p>
                                    <p>Engineer: {complaint.visitorName || "N/A"}</p>
                                    <p>Bank: {complaint.bankName || "N/A"}</p>
                                    <p>Branch Code: {complaint.branchCode || "N/A"}</p>
                                  </div>
                                )}
                            </div>
                          </td>
                          <td className={getCourierStatusClass(complaint.courierStatus)}>
                            {complaint.courierStatus || "N/A"}
                          </td>
                          <td>
                            <button
                              className="update-button"
                              disabled={complaint.complaintStatus === "Closed"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(complaint);
                              }}
                            >
                              Update
                            </button>
                          </td>
                          {isSpecialCity(complaint.city) ? (
                            <td>
                              <button
                                className={`pool-button ${complaint.markedInPool ? "active" : ""}`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await toggleInPool(complaint);
                                }}
                                title={complaint.markedInPool ? "Remove from Pool" : "Mark as In Pool"}
                              >
                                {complaint.markedInPool ? "Remove from Pool" : "Mark In Pool"}
                                <span className="city-badge" title={`Special: ${complaint.city}`}>
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
                              disabled={remarksCounts[complaint.id] === undefined}
                            >
                              {remarksCounts[complaint.id] === undefined ? "Loading..." : "Remarks"}
                              <span
                                className={`remarks-count ${
                                  remarksCounts[complaint.id] > 0 ? "remarks-count-green" : "remarks-count-red"
                                }`}
                              >
                                {remarksCounts[complaint.id] || 0}
                              </span>
                            </button>
                          </td>
                          <td>
                            <button
                              className={`view-report-button ${
                                reportAvailability[complaint.complaintId] === false ? "grey-button" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openReportsForComplaint(complaint.complaintId);
                              }}
                            >
                              {reportAvailability[complaint.complaintId] === false ? "No Reports" : "View Reports"}
                            </button>
                          </td>
                          <td>{complaint.date}</td>
                          <td>{complaint.closedDate}</td>
                          <td>{complaint.bankName}</td>
                          <td>{complaint.branchCode}</td>
                          <td>{complaint.branchName}</td>
                          <td>{complaint.city}</td>
                          <td>{complaint.referenceNumber}</td>
                          <td>{complaint.complaintType}</td>
                          <td className="truncated-cell" title={complaint.details || "No details provided"}>
                            {complaint.details || "No details provided"}
                          </td>
                          <td>{complaint.equipmentDescription}</td>
                          <td>{complaint.visitorName}</td>
                          <td>{complaint.repeatComplaint ? "Yes" : "No"}</td>
                          <td>{calculateAgingDays(complaint.date)}</td>
                          <td>{complaint.pendingForClosedDate}</td>
                          <td>{complaint.quotationDate}</td>
                          <td>{complaint.approvedDate}</td>
                          <td>{complaint.documentReceived ? "YES" : "No"}</td>
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
                  <td colSpan="26" style={{ textAlign: "center" }}>
                    No complaints to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-container" style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
              <button className="page-button" onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>
                &lt;&lt; First
              </button>
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
              <button
                className="page-button"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage + 1 === totalPages}
              >
                Last &gt;&gt;
              </button>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage + 1}
                style={{ width: 60, marginLeft: "1em" }}
                onChange={(e) => {
                  let page = parseInt(e.target.value, 10) - 1;
                  if (isNaN(page)) page = 0;
                  if (page < 0) page = 0;
                  if (page >= totalPages) page = totalPages - 1;
                  setCurrentPage(page);
                }}
              />
              <span> / {totalPages}</span>
            </div>
          )}
        </>
      )}

      {/* Multi-report modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        complaintId={selectedComplaintIdForReports}
        handleClose={closeReportModal}
      />
    </div>
  );
};

export default OverallComplaintsTable;

import React, { useState, useEffect } from "react";
import axios from "axios";
import ComplaintReport from "../../ComplaintReport/ComplaintReport";
import ReportModal from "../../Lab/ReportModal";
import ComplaintFilters from "../ComplaintFilters/ComplaintFilters";
import { generateExcelReport } from "../../ExcelReportGenerator/ExcelReportGenerator";
import { generateDaySummaryReport } from "../../ExcelReportGenerator/generateDaySummaryReport";
import "../ComplaintTable/ComplaintTable.css";
import useComplaintReportsLive from "../../../hooks/useComplaintReportsLive";

const allowedCities = ["Islamabad", "Rawalpindi"];
const pageSize = 100;

function groupComplaintsByBankAndBranch(complaintsArr) {
  const groups = {};
  complaintsArr.forEach((complaint) => {
    const key = `${complaint.bankName || ""}__${complaint.branchCode || ""}`;
    if (!groups[key]) {
      groups[key] = {
        bankName: complaint.bankName,
        branchCode: complaint.branchCode,
        branchName: complaint.branchName,
        complaints: [],
      };
    }
    groups[key].complaints.push(complaint);
  });
  return Object.values(groups);
}

const IslamabadComplaintsTable = ({
  handleOpenModal,
  openRemarksModal,
  calculateAgingDays,
  getStatusClass,
  getCourierStatusClass,
  complaintsRefreshKey,
  fetchDashboardCounts,
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const [filters, setFilters] = useState({
    status: "Open",
    bankName: "",
    branchCode: "",
    branchName: "",
    engineerName: "",
    city: "", // Will be forced to allowedCities
    complaintStatus: "",
    subStatus: "",
    date: "",
    dateFrom: "",
    dateTo: "",
    priority: "",
    inPool: "",
    hasReport: false,
    reportType: "",
  });

  const [complaints, setComplaints] = useState([]);
  const [remarksCounts, setRemarksCounts] = useState({});
  const [reportAvailability, setReportAvailability] = useState({});
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [hoveredComplaintId, setHoveredComplaintId] = useState(null);
  const [selectedComplaintIdForReports, setSelectedComplaintIdForReports] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);

  // Unique filter options
  const uniqueBanks = Array.from(new Set(complaints.map((c) => c.bankName).filter(Boolean)));
  const uniqueEngineers = Array.from(new Set(complaints.map((c) => c.engineerName).filter(Boolean)));
  const uniqueCities = allowedCities;
  const uniqueSubStatuses = Array.from(new Set(complaints.map((c) => c.subStatus).filter(Boolean)));

  // Match master report types
  const reportTypes = [
    { value: "standard", label: "Standard" },
    { value: "untouched", label: "Untouched" },
    { value: "ageing", label: "Aging" },
    { value: "daySummaryMulti", label: "Day Summary" },
  ];

  // Always restrict API to allowedCities
  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        page: currentPage,
        size: pageSize,
        city: allowedCities.join(","),
      };

      // Remove empty fields
      Object.keys(params).forEach(
        (key) => (params[key] === undefined || params[key] === "") && delete params[key]
      );

      // Only add hasReport if checked
      if (filters.hasReport) params.hasReport = true;

      // Always remove reportType for list queries
      delete params.reportType;

      const res = await axios.get(`${API_BASE_URL}/complaints/paginated-by-status`, {
        params,
        withCredentials: true,
      });
      const sortedComplaints = (res.data.content || []).sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      setComplaints(sortedComplaints);
      setTotalPages(res.data.totalPages || 1);
      setTotalRecords(res.data.totalElements || 0);
    } catch (err) {
      setComplaints([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch remarks counts
  useEffect(() => {
    const idsToFetch = complaints
      .map((c) => c.id)
      .filter((id) => id && remarksCounts[id] === undefined);

    if (idsToFetch.length) {
      axios
        .post(`${API_BASE_URL}/complaints/remarks/counts`, idsToFetch, {
          withCredentials: true,
        })
        .then((res) => setRemarksCounts((prev) => ({ ...prev, ...res.data })))
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, [complaints]);

  // Fetch complaints on filters/page change
  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line
  }, [filters, currentPage, complaintsRefreshKey]);

  // Reset to page 0 on filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [filters]);

  // Fetch report availability for visible complaints
  useEffect(() => {
    const visibleComplaintIds = complaints
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
  }, [complaints]);

  useComplaintReportsLive(() => {
    fetchComplaints();
  });

  // --- EXPORT REPORTS LOGIC ---

  // Fetch all complaints for export, restrict to allowedCities
  const fetchAllComplaintsForExport = async () => {
    let page = 0;
    let allComplaints = [];
    let totalPages = 1;
    do {
      const params = {
        ...filters,
        page,
        size: pageSize,
        city: allowedCities.join(","),
      };
      delete params.reportType;
      Object.keys(params).forEach(
        (key) => (params[key] === undefined || params[key] === "") && delete params[key]
      );
      const res = await axios.get(
        `${API_BASE_URL}/complaints/paginated-by-status`,
        { params, withCredentials: true }
      );
      allComplaints = allComplaints.concat(res.data.content || []);
      totalPages = res.data.totalPages || 1;
      page += 1;
    } while (page < totalPages);

    return allComplaints;
  };

  const handleGenerateReport = async () => {
    if (!filters.reportType) {
      alert("Please select a report type before generating.");
      return;
    }
    if (filters.reportType === "daySummaryMulti") {
      // For day summary report, fetch the same as master
      const [summaryResp, hardwareResp, engineerResp] = await Promise.all([
        fetch(`${API_BASE_URL}/complaints/complaints-summary?city=${allowedCities.join(",")}`, {
          credentials: "include",
        }),
        fetch(`${API_BASE_URL}/hardware-logs/hardware-dispatch-detail?city=${allowedCities.join(",")}`, {
          credentials: "include",
        }),
        fetch(`${API_BASE_URL}/complaints/city-wise-summary?city=${allowedCities.join(",")}`, {
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
    // Otherwise Excel
    try {
      setLoading(true);
      const allComplaints = await fetchAllComplaintsForExport();
      await generateExcelReport(
        allComplaints,
        filters.status,
        API_BASE_URL,
        uniqueCities,
        filters.reportType
      );
    } catch (err) {
      alert("Failed to fetch all data for export.");
    } finally {
      setLoading(false);
    }
  };

  // --- UI Handlers ---
  const handleClearFilters = () => {
    setFilters({
      status: "Open",
      bankName: "",
      branchCode: "",
      branchName: "",
      engineerName: "",
      city: "",
      complaintStatus: "",
      subStatus: "",
      date: "",
      dateFrom: "",
      dateTo: "",
      priority: "",
      inPool: "",
      hasReport: false,
      reportType: "",
    });
  };

  const handleRowClick = (complaintId) => {
    setSelectedRow((prevSelectedRow) =>
      prevSelectedRow === complaintId ? null : complaintId
    );
  };
  const handleViewHistory = (complaintId) => setSelectedComplaintId(complaintId);
  const handleBackToTable = () => setSelectedComplaintId(null);

  const shouldHighlightRow = (complaint) => {
    const complaintDate = new Date(complaint.date);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - complaintDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 3;
  };

  const openReportsForComplaint = (complaintId) => {
    setSelectedComplaintIdForReports(complaintId);
    setIsReportModalOpen(true);
  };
  const closeReportModal = () => {
    setSelectedComplaintIdForReports(null);
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

  const groupedComplaints = groupComplaintsByBankAndBranch(complaints);
  let serialCounter = currentPage * pageSize;

  // --- Main Render ---
  return (
    <div>
      {/* FILTER BAR */}
      <ComplaintFilters
        filters={filters}
        onFiltersChange={setFilters}
        uniqueBanks={uniqueBanks}
        uniqueEngineers={uniqueEngineers}
        uniqueCities={uniqueCities}
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
                <tr>
                  <td colSpan="21" style={{ textAlign: "center" }}>
                    Loading...
                  </td>
                </tr>
              ) : groupedComplaints.length > 0 ? (
                groupedComplaints.map((group, groupIdx) => (
                  <React.Fragment
                    key={group.bankName + group.branchCode + groupIdx}
                  >
                    {/* Group Header Row */}
                    <tr className="group-header-row">
                      <td
                        className="group-header-row-data"
                        colSpan="21"
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
                    {group.complaints.map((complaint, idx) => {
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
                          <td className={getStatusClass(complaint.complaintStatus)}>
                            <div
                              className="status-hover-container"
                              onMouseEnter={() =>
                                setHoveredComplaintId(complaint.id)
                              }
                              onMouseLeave={() => setHoveredComplaintId(null)}
                            >
                              {complaint.complaintStatus || "Open"}
                              {hoveredComplaintId === complaint.id &&
                                complaint.complaintStatus === "Visit Schedule" && (
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
                          <td className={getCourierStatusClass(complaint.courierStatus)}>
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
                          <td />
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
                            {reportAvailability[complaint.complaintId] === undefined ? (
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
                                  openReportsForComplaint(complaint.complaintId);
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
                  <td colSpan="21" style={{ textAlign: "center" }}>
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

      <ReportModal
        isOpen={isReportModalOpen}
        complaintId={selectedComplaintIdForReports}
        handleClose={closeReportModal}
      />
    </div>
  );
};

export default IslamabadComplaintsTable;

import React, { useState, useEffect } from "react";
import axios from "axios";
import ComplaintReport from "../../ComplaintReport/ComplaintReport";
import ReportModal from "../../Lab/ReportModal";
import ComplaintFilters from "../ComplaintFilters/ComplaintFilters";
import { generateExcelReport } from "../../ExcelReportGenerator/ExcelReportGenerator";
import "./../ComplaintTable/ComplaintTable.css";
import useComplaintReportsLive from "../../../hooks/useComplaintReportsLive";

function groupComplaintsByBankAndBranch(complaintsArr) {
  const groups = {};
  complaintsArr.forEach((complaint) => {
    const key = `${complaint.bankName || ""}__${complaint.branchCode || ""}`;
    if (!groups[key]) {
      groups[key] = {
        bankName: complaint.bankName,
        city: complaint.city,
        branchCode: complaint.branchCode,
        branchName: complaint.branchName,
        complaints: [],
      };
    }
    groups[key].complaints.push(complaint);
  });
  return Object.values(groups);
}

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}
const recordsPerPage = 100;
const maxVisiblePages = 5;

// --- Statuses to exclude from "Daily Open" view ---
const STATUSES_TO_EXCLUDE = ["Approved", "Wait For Approval"];

const DailyOpenComplaintsTable = ({
  handleOpenModal,
  openRemarksModal,
  calculateAgingDays,
  getStatusClass,
  getCourierStatusClass,
  refreshComplaints,
  currentDate,
  complaintsRefreshKey = 0,
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const effectiveDate = currentDate || getTodayISO();

  const [filters, setFilters] = useState({
    status: "Open",
    bankName: "",
    branchCode: "",
    branchName: "",
    engineerName: "",
    city: "",
    complaintStatus: "",
    subStatus: "",
    date: effectiveDate,
    dateFrom: "",
    dateTo: "",
    priority: "",
    inPool: "",
    hasReport: false,
    reportType: "",
  });

  const [groups, setGroups] = useState([]);
  const [remarksCounts, setRemarksCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [selectedComplaintIdForReports, setSelectedComplaintIdForReports] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportAvailability, setReportAvailability] = useState({});
  const [totalRecords, setTotalRecords] = useState(0);

  // Fetch & group
  const fetchComplaints = async () => {
    setLoading(true);
    const params = {
      ...filters,
      date: effectiveDate,
      page: currentPage - 1,
      size: recordsPerPage,
    };
    Object.keys(params).forEach(
      (key) => (params[key] === undefined || params[key] === "") && delete params[key]
    );

    try {
      const res = await axios.get(`${API_BASE_URL}/complaints/paginated-by-status`, {
        params,
        withCredentials: true,
      });
      // 1. Flatten, filter out "Approved" and "Wait For Approval"
      const filteredComplaints = (res.data.content || []).flatMap(group =>
        (group.complaints || []).filter(
          c => !STATUSES_TO_EXCLUDE.includes((c.complaintStatus || "").trim())
        )
      );
      // 2. Group again using our grouping function
      const grouped = groupComplaintsByBankAndBranch(filteredComplaints);
      setGroups(grouped);
      setTotalRecords(filteredComplaints.length);
    } catch (err) {
      setGroups([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
      setSelectedRow(null);
    }
  };

  // Flattened for remarks/reports
  const allComplaints = groups.flatMap(group => group.complaints);
  const uniqueBanks = Array.from(new Set(allComplaints.map((c) => c.bankName).filter(Boolean)));
  const uniqueEngineers = Array.from(new Set(allComplaints.map((c) => c.engineerName).filter(Boolean)));
  const uniqueCities = Array.from(new Set(allComplaints.map((c) => c.city).filter(Boolean)));
  const uniqueSubStatuses = Array.from(new Set(allComplaints.map((c) => c.subStatus).filter(Boolean)));

  const reportTypes = [
    { value: "standard", label: "Standard" },
    { value: "untouched", label: "Untouched" },
    { value: "ageing", label: "Aging" },
    { value: "daySummaryMulti", label: "Day Summary" }
  ];

  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line
  }, [API_BASE_URL, effectiveDate, filters, currentPage, complaintsRefreshKey]);

  useComplaintReportsLive(() => {
    fetchComplaints();
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    const visibleComplaintIds = allComplaints
      .filter(c => c && remarksCounts[c.id] === undefined)
      .map(c => c.id)
      .filter(Boolean);

    if (visibleComplaintIds.length > 0) {
      axios.post(
        `${API_BASE_URL}/complaints/remarks/counts`,
        visibleComplaintIds,
        { withCredentials: true }
      ).then((response) => {
        setRemarksCounts((prevCounts) => ({
          ...prevCounts,
          ...response.data,
        }));
      }).catch(() => { });
    }
    // eslint-disable-next-line
  }, [groups, API_BASE_URL]);

  useEffect(() => {
    const ids = allComplaints
      .map((c) => c.complaintId)
      .filter((id) => id && reportAvailability[id] === undefined);
    if (ids.length > 0) {
      axios.post(
        `${API_BASE_URL}/hardware-logs/reports/availability`,
        ids,
        { withCredentials: true }
      ).then(res => {
        setReportAvailability((prev) => ({ ...prev, ...res.data }));
      }).catch(() => {});
    }
    // eslint-disable-next-line
  }, [groups]);

  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const getVisiblePages = () => {
    const pages = [];
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, currentPage + half);
    if (currentPage <= half) end = Math.min(totalPages, maxVisiblePages);
    if (currentPage > totalPages - half) start = Math.max(1, totalPages - maxVisiblePages + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) setCurrentPage(pageNumber);
  };
  const handleRowClick = (complaintId) => setSelectedRow(selectedRow === complaintId ? null : complaintId);
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
  const togglePriority = async (complaint) => {
    try {
      const newPriority = !complaint.priority;
      await axios.put(
        `${API_BASE_URL}/complaints/${complaint.id}`,
        { isPriority: newPriority },
        { withCredentials: true }
      );
      if (refreshComplaints) refreshComplaints();
      else fetchComplaints();
    } catch (error) { }
  };

  const handleExportExcel = async () => {
    if (!allComplaints.length) {
      alert("No data to export!");
      return;
    }
    await generateExcelReport(
      allComplaints,
      "Open",
      API_BASE_URL,
      uniqueCities,
      "standard"
    );
  };

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
      date: effectiveDate,
      dateFrom: "",
      dateTo: "",
      priority: "",
      inPool: "",
      hasReport: false,
      reportType: "",
    });
  };

  let serialCounter = (currentPage - 1) * recordsPerPage;

  return (
    <div>
      <ComplaintFilters
        filters={filters}
        onFiltersChange={(f) => setFilters({ ...f, date: effectiveDate })}
        uniqueBanks={uniqueBanks}
        uniqueEngineers={uniqueEngineers}
        uniqueCities={uniqueCities}
        uniqueSubStatuses={uniqueSubStatuses}
        reportTypes={reportTypes}
        totalRecords={totalRecords}
        onClear={handleClearFilters}
        onGenerateReport={handleExportExcel}
        dateLocked={true}
        dateLabel="(Daily View: Today only)"
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button className="export-excel-button" onClick={handleExportExcel}>
          Export Excel
        </button>
      </div>
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
                <th>Remarks</th>
                <th>Report</th>
                <th>Date</th>
                <th>City</th>
                <th>Reference #</th>
                <th>Complaint Type</th>
                <th>Details</th>
                <th>Hardware</th>
                <th>Visitor Name</th>
                <th>Repeat?</th>
                <th>Aging</th>
                <th>Schedule Date</th>
                <th>Complaint ID</th>
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="18" style={{ textAlign: "center" }}>
                    Loading...
                  </td>
                </tr>
              ) : groups.length > 0 ? (
                groups.map((group, groupIndex) => (
                  <React.Fragment key={group.bankName + group.branchCode + groupIndex}>
                    <tr className="group-header-row">
                      <td colSpan="18" style={{
                        fontSize: "16px",
                        fontWeight: "bold",
                        backgroundColor: "#d6eaf8",
                        padding: "10px",
                        lineHeight: "1.6"
                      }}>
                        <span>Bank: {group.bankName}</span>{" | "}
                        <span>Branch Code: {group.branchCode}</span>{" | "}
                        <span>Branch: {group.branchName}</span>
                      </td>
                    </tr>
                    {group.complaints.map((complaint, complaintIndex) => {
                      serialCounter++;
                      return (
                        <tr
                          key={complaint.id}
                          onClick={() => handleRowClick(complaint.id)}
                          className={selectedRow === complaint.id ? "selected-row" : ""}
                        >
                          <td>{serialCounter}</td>
                          <td className={getStatusClass(complaint.complaintStatus)}>
                            {complaint.complaintStatus}
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
                              className={`priority-button ${complaint.priority ? "priority-active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePriority(complaint);
                              }}
                              title={complaint.priority ? "Unmark Priority" : "Mark as Priority"}
                            >
                              {complaint.priority ? "High Priority" : "Mark as Priority"}
                            </button>
                          </td>
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
                          <td>{complaint.city}</td>
                          <td>{complaint.referenceNumber || "N/A"}</td>
                          <td>{complaint.complaintType || "N/A"}</td>
                          <td>{complaint.details || "No details provided"}</td>
                          <td>{complaint.equipmentDescription || "N/A"}</td>
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
                              <i className="fas fa-history"></i> View History
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="18" style={{ textAlign: "center" }}>
                    No daily open complaints to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="pagination-container">
              <button
                className="page-button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                &lt;
              </button>
              {getVisiblePages().map((page) => (
                <button
                  key={page}
                  className={`page-button ${currentPage === page ? "active" : ""}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="page-button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                &gt;
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

export default DailyOpenComplaintsTable;

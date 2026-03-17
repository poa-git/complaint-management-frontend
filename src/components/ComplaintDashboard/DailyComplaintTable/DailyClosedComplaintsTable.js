import React, { useState, useEffect } from "react";
import axios from "axios";
import ComplaintReport from "../../ComplaintReport/ComplaintReport";
import ReportModal from "../../Lab/ReportModal";
import { generateExcelReport } from "../../ExcelReportGenerator/ExcelReportGenerator";
import ComplaintFilters from "../ComplaintFilters/ComplaintFilters";
import "./../ComplaintTable/ComplaintTable.css";
import useComplaintReportsLive from "../../../hooks/useComplaintReportsLive";

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

const recordsPerPage = 20;
const maxVisiblePages = 5;

const DailyClosedComplaintsTable = ({
  handleOpenModal,
  openRemarksModal,
  calculateAgingDays,
  getStatusClass,
  getCourierStatusClass,
  refreshComplaints,
  currentDate,
  closedMode = "openAndClosedSameDate", // Default prop
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const effectiveDate = currentDate || getTodayISO();

  // Filters
  const [filters, setFilters] = useState({
    bankName: "",
    branchCode: "",
    branchName: "",
    city: "",
    complaintStatus: "",
    subStatus: "",
    dateFrom: "",
    dateTo: "",
    priority: "",
    inPool: "",
    hasReport: false,
    reportType: "",
  });

  const [branchGroups, setBranchGroups] = useState([]);
  const [remarksCounts, setRemarksCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [selectedComplaintIdForReports, setSelectedComplaintIdForReports] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Dropdown values
  const allComplaints = branchGroups.flatMap(g => g.complaints || []);
  const uniqueBanks = Array.from(new Set(allComplaints.map((c) => c.bankName).filter(Boolean)));
  const uniqueCities = Array.from(new Set(allComplaints.map((c) => c.city).filter(Boolean)));
  const uniqueSubStatuses = Array.from(new Set(allComplaints.map((c) => c.subStatus).filter(Boolean)));
  const uniqueEngineers = [];
  const reportTypes = [];

  // Fetch complaints (get backend-grouped branchGroups)
  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const params = {
        page: 0,
        size: 100, // Get ALL for today (usually small, can adjust)
        status: "Closed",
        ...filters,
      };
      // Remove empty filter values
      Object.keys(params).forEach((k) => (params[k] === "" || params[k] === undefined) && delete params[k]);
      const res = await axios.get(`${API_BASE_URL}/complaints/paginated-by-status`, {
        params,
        withCredentials: true,
      });
      setBranchGroups(Array.isArray(res.data?.content) ? res.data.content : []);
    } catch (error) {
      setBranchGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line
  }, [API_BASE_URL, filters, effectiveDate, refreshComplaints]);

  useComplaintReportsLive((wsData) => {
    if (!wsData || !wsData.complaintId) return;
    // Only update if visible
    const isVisible = branchGroups.some(group =>
      (group.complaints || []).some(c => c.complaintId === wsData.complaintId)
    );
    if (wsData.action === "created") {
      // Pull fresh for the day
      fetchComplaints();
      return;
    }
    if (!isVisible) return;
    // Refresh only that complaint (optional: you can optimize for very large sets)
    fetchComplaints();
  });

  // FILTER LOGIC (adjusted for closedMode)
  function complaintMatchesDateMode(complaint) {
    const closedDate = complaint.closedDate ? complaint.closedDate.slice(0, 10) : "";
    const openDate = complaint.date ? complaint.date.slice(0, 10) : "";
    if (closedMode === "openAndClosedSameDate") {
      return (
        complaint.complaintStatus === "Closed" &&
        closedDate === effectiveDate &&
        openDate === effectiveDate
      );
    } else if (closedMode === "closedOnly") {
      return (
        complaint.complaintStatus === "Closed" &&
        closedDate === effectiveDate
      );
    }
    return false;
  }

  // Filtered branchGroups for display
  const filteredGroups = branchGroups
    .map(group => ({
      ...group,
      complaints: (group.complaints || []).filter(complaintMatchesDateMode)
    }))
    .filter(group => (group.complaints || []).length > 0);

  // Pagination for groups
  const totalPages = Math.ceil(filteredGroups.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const currentGroups = filteredGroups.slice(startIndex, startIndex + recordsPerPage);

  // S.No calculation (continuous across groups)
  const cumulativeComplaintCounts = [];
  let totalComplaints = 0;
  currentGroups.forEach((group, index) => {
    cumulativeComplaintCounts[index] = totalComplaints;
    totalComplaints += group.complaints.length;
  });

  // Remarks
  useEffect(() => {
    const visibleComplaintIds = currentGroups
      .flatMap((group) => group.complaints)
      .filter((complaint) => remarksCounts[complaint.id] === undefined)
      .map((complaint) => complaint.id);
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
  }, [currentGroups, API_BASE_URL]);

  // Pagination helpers
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

  // Table action handlers
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

  // Excel Export Handler
  const handleExportExcel = async () => {
    const exportList = filteredGroups.flatMap(g => g.complaints || []);
    if (!exportList.length) {
      alert("No data to export!");
      return;
    }
    await generateExcelReport(
      exportList,
      closedMode === "openAndClosedSameDate"
        ? "Closed (Open+Closed Today)"
        : "Today Closed",
      API_BASE_URL,
      uniqueCities,
      "standard"
    );
  };

  // Filter section with ComplaintFilters
  const handleClearFilters = () => {
    setFilters({
      bankName: "",
      branchCode: "",
      branchName: "",
      city: "",
      complaintStatus: "",
      subStatus: "",
      dateFrom: "",
      dateTo: "",
      priority: "",
      inPool: "",
      hasReport: false,
      reportType: "",
    });
  };

  return (
    <div>
      <ComplaintFilters
        filters={filters}
        onFiltersChange={setFilters}
        uniqueBanks={uniqueBanks}
        uniqueEngineers={uniqueEngineers}
        uniqueCities={uniqueCities}
        uniqueSubStatuses={uniqueSubStatuses}
        reportTypes={reportTypes}
        totalRecords={filteredGroups.flatMap(g => g.complaints || []).length}
        onClear={handleClearFilters}
        onGenerateReport={handleExportExcel}
        dateLocked={true}
        dateLabel={
          closedMode === "openAndClosedSameDate"
            ? "(Closed complaints opened and closed today only)"
            : "(All complaints closed today, any open date)"
        }
        hideDate={true}
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
                <th>Closed Date</th>
                <th>Bank Name</th>
                <th>Branch Code</th>
                <th>Branch Name</th>
                <th>City</th>
                <th>Reference Number</th>
                <th>Complaint Type</th>
                <th>Details</th>
                <th>Visitor Name</th>
                <th>Repeat Complaint</th>
                <th>Aging Days</th>
                <th>Quotation Date</th>
                <th>Approved Date</th>
                <th>Complaint ID</th>
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="22" style={{ textAlign: "center" }}>
                    Loading...
                  </td>
                </tr>
              ) : currentGroups.length > 0 ? (
                currentGroups.map((group, groupIndex) => (
                  <React.Fragment key={group.bankName + group.branchCode + groupIndex}>
                    <tr className="group-header-row">
                      <td colSpan="22" style={{
                        fontSize: "16px",
                        fontWeight: "bold",
                        backgroundColor: "#d6eaf8",
                        padding: "10px",
                        lineHeight: "1.6"
                      }}>
                        <span>Bank Name: {group.bankName}</span>{" "}
                        <span>Branch Code: {group.branchCode}</span>{" "}
                        <span>Branch Name: {group.branchName}</span>
                      </td>
                    </tr>
                    {group.complaints.map((complaint, complaintIndex) => {
                      const sNo = cumulativeComplaintCounts[groupIndex] + complaintIndex + 1;
                      return (
                        <tr
                          key={complaint.id}
                          onClick={() => handleRowClick(complaint.id)}
                          className={selectedRow === complaint.id ? "selected-row" : ""}
                        >
                          <td>{sNo}</td>
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
                              disabled={complaint.complaintStatus === "Closed"}
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
                            <button
                              className="view-report-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openReportsForComplaint(complaint.complaintId);
                              }}
                              disabled={!complaint.report}
                            >
                              {complaint.report ? "View Reports" : "No Report"}
                            </button>
                          </td>
                          <td>{complaint.date}</td>
                          <td>{complaint.closedDate}</td>
                          <td>{complaint.bankName}</td>
                          <td>{complaint.branchCode}</td>
                          <td>{complaint.branchName}</td>
                          <td>{complaint.city}</td>
                          <td>{complaint.referenceNumber || "N/A"}</td>
                          <td>{complaint.complaintType || "N/A"}</td>
                          <td>{complaint.details || "No details provided"}</td>
                          <td>{complaint.visitorName}</td>
                          <td>{complaint.repeatComplaint ? "Yes" : "No"}</td>
                          <td>{calculateAgingDays(complaint.date)}</td>
                          <td>{complaint.quotationDate || "N/A"}</td>
                          <td>{complaint.approvedDate || "N/A"}</td>
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
                  <td colSpan="22" style={{ textAlign: "center" }}>
                    No daily closed complaints to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredGroups.length > recordsPerPage && (
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

export default DailyClosedComplaintsTable;

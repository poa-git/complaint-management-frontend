import React, { useState, useEffect } from "react";
import axios from "axios";
import ReportModal from "../../Lab/ReportModal";
import ComplaintFilters from "../ComplaintFilters/ComplaintFilters";
import { generateExcelReport } from "../../ExcelReportGenerator/ExcelReportGenerator";
import "./../ComplaintTable/ComplaintTable.css";
import useComplaintReportsLive from "../../../hooks/useComplaintReportsLive";

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}
const recordsPerPage = 20;
const maxVisiblePages = 5;

const TodayComplaintsTable = ({
  handleOpenModal,
  openRemarksModal,
  calculateAgingDays,
  getStatusClass,
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const todayDate = getTodayISO();

  const [filters, setFilters] = useState({
    bankName: "",
    branchCode: "",
    branchName: "",
    engineerName: "",
    city: "",
    complaintStatus: "",
    subStatus: "",
    date: todayDate, // locked to today
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
  const [selectedComplaintIdForReports, setSelectedComplaintIdForReports] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Flatten all complaints for dropdowns
  const allComplaints = branchGroups.flatMap(g => g.complaints || []);
  const uniqueBanks = Array.from(new Set(allComplaints.map((c) => c.bankName).filter(Boolean)));
  const uniqueEngineers = Array.from(new Set(allComplaints.map((c) => c.engineerName).filter(Boolean)));
  const uniqueCities = Array.from(new Set(allComplaints.map((c) => c.city).filter(Boolean)));
  const uniqueSubStatuses = Array.from(new Set(allComplaints.map((c) => c.subStatus).filter(Boolean)));
  const reportTypes = [
    { value: "standard", label: "Standard" },
    { value: "untouched", label: "Untouched" },
    { value: "ageing", label: "Aging" },
    { value: "daySummaryMulti", label: "Day Summary" },
  ];

  // Fetch backend-grouped branch data
  const fetchComplaints = async () => {
    setLoading(true);
    const params = {
      ...filters,
      date: todayDate, // always today
      page: 0,
      size: 2000, // get all for the day
    };
    Object.keys(params).forEach(
      (key) =>
        (params[key] === undefined || params[key] === "") && delete params[key]
    );
    try {
      const res = await axios.get(
        `${API_BASE_URL}/complaints/paginated-by-status`,
        {
          params,
          withCredentials: true,
        }
      );
      setBranchGroups(Array.isArray(res.data?.content) ? res.data.content : []);
    } catch {
      setBranchGroups([]);
    } finally {
      setLoading(false);
      setSelectedRow(null);
    }
  };

  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line
  }, [API_BASE_URL, todayDate, filters]);

  useComplaintReportsLive(() => {
    fetchComplaints();
  });

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Filter for today only (if backend gives more)
  function complaintIsToday(complaint) {
    const openDate = complaint.date ? complaint.date.slice(0, 10) : "";
    return openDate === todayDate;
  }
  const filteredGroups = branchGroups
    .map(group => ({
      ...group,
      complaints: (group.complaints || []).filter(complaintIsToday),
    }))
    .filter(group => (group.complaints || []).length > 0);

  // Pagination by branch group
  const totalPages = Math.ceil(filteredGroups.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const currentGroups = filteredGroups.slice(startIndex, startIndex + recordsPerPage);
  const totalRecords = filteredGroups.flatMap(g => g.complaints || []).length;

  // S.No cumulative per group page
  const cumulativeComplaintCounts = [];
  let totalComplaints = 0;
  currentGroups.forEach((group, index) => {
    cumulativeComplaintCounts[index] = totalComplaints;
    totalComplaints += group.complaints.length;
  });

  // Remarks count for visible
  useEffect(() => {
    const visibleComplaintIds = currentGroups
      .flatMap((group) => group.complaints)
      .filter((complaint) => remarksCounts[complaint.id] === undefined)
      .map((complaint) => complaint.id);

    if (visibleComplaintIds.length > 0) {
      axios
        .post(
          `${API_BASE_URL}/complaints/remarks/counts`,
          visibleComplaintIds,
          { withCredentials: true }
        )
        .then((response) => {
          setRemarksCounts((prevCounts) => ({
            ...prevCounts,
            ...response.data,
          }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, [currentGroups, API_BASE_URL]);

  // Export ALL visible
  const handleExportExcel = async () => {
    const allTodayComplaints = filteredGroups.flatMap(g => g.complaints || []);
    if (!allTodayComplaints.length) {
      alert("No data to export!");
      return;
    }
    await generateExcelReport(
      allTodayComplaints,
      "Today Complaints",
      API_BASE_URL,
      uniqueCities,
      "standard"
    );
  };

  const handleClearFilters = () => {
    setFilters({
      bankName: "",
      branchCode: "",
      branchName: "",
      engineerName: "",
      city: "",
      complaintStatus: "",
      subStatus: "",
      date: todayDate,
      priority: "",
      inPool: "",
      hasReport: false,
      reportType: "",
    });
  };

  // Table actions
  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handleRowClick = (complaintId) => {
    setSelectedRow((prevSelectedRow) =>
      prevSelectedRow === complaintId ? null : complaintId
    );
  };

  const openReportsForComplaint = (complaintId) => {
    setSelectedComplaintIdForReports(complaintId);
    setIsReportModalOpen(true);
  };

  const closeReportModal = () => {
    setSelectedComplaintIdForReports(null);
    setIsReportModalOpen(false);
  };

  // Pagination helper
  const getVisiblePages = () => {
    const pages = [];
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, currentPage + half);
    if (currentPage <= half) end = Math.min(totalPages, maxVisiblePages);
    if (currentPage > totalPages - half)
      start = Math.max(1, totalPages - maxVisiblePages + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div>
      <ComplaintFilters
        filters={filters}
        onFiltersChange={(f) => setFilters({ ...f, date: todayDate })}
        uniqueBanks={uniqueBanks}
        uniqueEngineers={uniqueEngineers}
        uniqueCities={uniqueCities}
        uniqueSubStatuses={uniqueSubStatuses}
        reportTypes={reportTypes}
        totalRecords={totalRecords}
        onClear={handleClearFilters}
        onGenerateReport={handleExportExcel}
        dateLocked={true}
        approvedDateLocked={false}
        pendingForClosedDateLocked={false}
        approvedDateLabel="(Only today's complaints shown)"
      />
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: 10,
      }}>
        <button className="export-excel-button" onClick={handleExportExcel}>
          Export Excel
        </button>
      </div>
      <h3>Today's Complaints ({totalRecords})</h3>
      <table className="complaint-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Status</th>
            <th>Actions</th>
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
            <th>Visitor Name</th>
            <th>Repeat Complaint</th>
            <th>Aging Days</th>
            <th>Complaint ID</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan="17" style={{ textAlign: "center" }}>
                Loading...
              </td>
            </tr>
          ) : currentGroups.length > 0 ? (
            currentGroups.map((group, groupIndex) => (
              <React.Fragment key={group.bankName + group.branchCode + groupIndex}>
                <tr className="group-header-row">
                  <td colSpan="17" style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    backgroundColor: "#d6eaf8",
                    padding: "10px",
                    lineHeight: "1.6",
                  }}>
                    <span>Bank Name: {group.bankName}</span>{" "}
                    <span>Branch Code: {group.branchCode}</span>{" "}
                    <span>Branch Name: {group.branchName}</span>{" "}
                    {/* <span>City: {group.city}</span> */}
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
                        {complaint.complaintStatus || "Open"}
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
                      <td>{complaint.bankName}</td>
                      <td>{complaint.branchCode}</td>
                      <td>{complaint.branchName}</td>
                      <td>{complaint.city}</td>
                      <td>{complaint.referenceNumber || "N/A"}</td>
                      <td>{complaint.complaintType || "N/A"}</td>
                      <td className="truncated-cell" title={complaint.details || "No details provided"}>
                        {complaint.details || "No details provided"}
                      </td>
                      <td>{complaint.visitorName}</td>
                      <td>{complaint.repeatComplaint ? "Yes" : "No"}</td>
                      <td>{calculateAgingDays(complaint.date)}</td>
                      <td>{complaint.complaintId}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))
          ) : (
            <tr>
              <td colSpan="17" style={{ textAlign: "center" }}>
                No complaints registered today.
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
      <ReportModal
        isOpen={isReportModalOpen}
        complaintId={selectedComplaintIdForReports}
        handleClose={closeReportModal}
      />
    </div>
  );
};

export default TodayComplaintsTable;

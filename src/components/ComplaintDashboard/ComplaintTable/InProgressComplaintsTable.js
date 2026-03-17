import React, { useState, useEffect } from "react";
import axios from "axios";
import ComplaintReport from "../../ComplaintReport/ComplaintReport";
import "./ComplaintTable.css";
import ReportModal from "../../Lab/ReportModal";
import ComplaintFilters from "../ComplaintFilters/ComplaintFilters";
import { generateExcelReport } from "../../ExcelReportGenerator/ExcelReportGenerator";
import { generateDaySummaryReport } from "../../ExcelReportGenerator/generateDaySummaryReport";

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

const pageSize = 100;

const InProgressComplaintsTable = ({
  handleOpenModal,
  openRemarksModal,
  calculateAgingDays,
  getStatusClass,
  getCourierStatusClass,
  complaintsRefreshKey
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const [filters, setFilters] = useState({
    status: "In Progress",
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

  const [remarksCounts, setRemarksCounts] = useState({});
  const [complaints, setComplaints] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [bankList, setBankList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [engineers, setEngineers] = useState([]);
  // Modal state
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedComplaintIdForReports, setSelectedComplaintIdForReports] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportAvailability, setReportAvailability] = useState({});

  // Dropdown values
  const uniqueBanks = Array.from(new Set(complaints.map((c) => c.bankName).filter(Boolean)));
  const uniqueEngineers = Array.from(new Set(complaints.map((c) => c.engineerName).filter(Boolean)));
  const uniqueCities = Array.from(new Set(complaints.map((c) => c.city).filter(Boolean)));
  const uniqueSubStatuses = Array.from(new Set(complaints.map((c) => c.subStatus).filter(Boolean)));
  const reportTypes = [
    { value: "standard", label: "Standard" },
    { value: "untouched", label: "Untouched" },
    { value: "ageing", label: "Aging" },
    { value: "daySummaryMulti", label: "Day Summary" }
  ];

  // Fetch complaints with filters (EXCLUDE reportType from params)
  const fetchComplaints = async () => {
    setLoading(true);
    try {
      // Remove reportType before sending to API
      const { reportType, ...filtersForApi } = filters;

      const params = {
        page: currentPage,
        size: pageSize,
        ...Object.fromEntries(
          Object.entries(filtersForApi)
            .filter(([k, v]) => v !== undefined && v !== "" && !(k === "hasReport" && v === false))
        ),
        ...(filters.hasReport ? { hasReport: true } : {}),
      };
      const res = await axios.get(`${API_BASE_URL}/complaints/paginated-by-status`, {
        params,
        withCredentials: true,
      });

      setComplaints(res.data.content || []);
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

  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line
  }, [filters, currentPage, complaintsRefreshKey]);

  useEffect(() => {
    setCurrentPage(0);
  }, [filters]);

  // Fetch remarks counts
  useEffect(() => {
    const idsToFetch = complaints.map((c) => c.id).filter((id) => id && remarksCounts[id] === undefined);
    if (idsToFetch.length) {
      axios
        .post(`${API_BASE_URL}/complaints/remarks/counts`, idsToFetch, { withCredentials: true })
        .then((res) => setRemarksCounts((prev) => ({ ...prev, ...res.data })))
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, [complaints]);

  // Fetch report availability
  useEffect(() => {
    const visibleComplaintIds = complaints.map((c) => c.complaintId).filter((id) => id && reportAvailability[id] === undefined);
    if (visibleComplaintIds.length > 0) {
      axios
        .post(`${API_BASE_URL}/hardware-logs/reports/availability`, visibleComplaintIds, { withCredentials: true })
        .then((response) => setReportAvailability((prev) => ({ ...prev, ...response.data })))
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, [complaints]);
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
  const handleClearFilters = () => {
    setFilters({
      status: "In Progress",
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

  // --------- FULL REPORT GENERATION LOGIC -----------
  const handleGenerateReport = async () => {
    if (!filters.reportType) {
      alert("Please select a report type before generating.");
      return;
    }

    if (filters.reportType === "daySummaryMulti") {
      try {
        const [summaryResp, hardwareResp, engineerResp] = await Promise.all([
          fetch(`${API_BASE_URL}/complaints/complaints-summary`, { credentials: "include" }),
          fetch(`${API_BASE_URL}/hardware-logs/hardware-dispatch-detail`, { credentials: "include" }),
          fetch(`${API_BASE_URL}/complaints/city-wise-summary`, { credentials: "include" }),
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
      } catch (error) {
        alert("An error occurred while generating the day summary report.");
        return;
      }
    }

    // For all other types, just pass filtered complaints
    await generateExcelReport(
      complaints,
      filters.status,
      API_BASE_URL,
      uniqueCities,
      filters.reportType
    );
  };
  // --------------------------------------------------

  const handleRowClick = (complaintId) => {
    setSelectedRow((prevSelectedRow) =>
      prevSelectedRow === complaintId ? null : complaintId
    );
  };

  const handleViewHistory = (complaintId) => setSelectedComplaintId(complaintId);
  const handleBackToTable = () => setSelectedComplaintId(null);

  // Multi-reports modal
  const openReportsForComplaint = (complaintId) => {
    setSelectedComplaintIdForReports(complaintId);
    setIsReportModalOpen(true);
  };
  const closeReportModal = () => {
    setSelectedComplaintIdForReports(null);
    setIsReportModalOpen(false);
  };

  // S.No. offset
  let serialCounter = currentPage * pageSize;
  const groupedComplaints = groupComplaintsByBankAndBranch(complaints);

  return (
    <div>
      <ComplaintFilters
        filters={filters}
        onFiltersChange={setFilters}
        banks={bankList}
        cities={cityList}
        statuses={statusList}
        engineers={engineers}
        uniqueSubStatuses={uniqueSubStatuses}
        reportTypes={reportTypes}
        totalRecords={totalRecords}
        onClear={handleClearFilters}
        onGenerateReport={handleGenerateReport}
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
              ) : groupedComplaints.length > 0 ? (
                groupedComplaints.map((group, groupIdx) => (
                  <React.Fragment key={group.bankName + group.branchCode + groupIdx}>
                    <tr className="group-header-row">
                      <td
                        className="group-header-row-data"
                        colSpan="18"
                        style={{
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
                    {group.complaints.map((complaint) => {
                      serialCounter++;
                      return (
                        <tr
                          key={complaint.id}
                          onClick={() => handleRowClick(complaint.id)}
                          className={selectedRow === complaint.id ? "selected-row" : ""}
                        >
                          <td>{serialCounter}</td>
                          <td className={getStatusClass(complaint.complaintStatus)}>
                            {complaint.complaintStatus || "In Progress"}
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
                                  remarksCounts[complaint.id] > 0 ? "remarks-count-green" : "remarks-count-red"
                                }`}
                              >
                                {remarksCounts[complaint.id] || 0}
                              </span>
                            </button>
                          </td>
                          <td>
                            {reportAvailability[complaint.complaintId] === undefined ? (
                              <button className="view-report-button loading-btn" disabled>
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
                              <button className="view-report-button grey-button" disabled>
                                No Reports
                              </button>
                            )}
                          </td>
                          <td>{complaint.date}</td>
                          <td>{complaint.bankName}</td>
                          <td>{complaint.branchCode}</td>
                          <td>{complaint.branchName}</td>
                          <td>{complaint.city}</td>
                          <td>{complaint.referenceNumber}</td>
                          <td>{complaint.complaintType}</td>
                          <td className="truncated-cell" title={complaint.details || "No details provided"}>
                            {complaint.details || "No details provided"}
                          </td>
                          <td>{complaint.visitorName}</td>
                          <td>{complaint.repeatComplaint ? "Yes" : "No"}</td>
                          <td>{calculateAgingDays(complaint.date)}</td>
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
                  <td colSpan="18" style={{ textAlign: "center" }}>
                    No "In Progress" complaints to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="pagination-container">
              <button
                className="page-button"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 0}
              >
                &lt;
              </button>
              <span style={{ margin: "0 1em" }}>
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                className="page-button"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage + 1 >= totalPages}
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

export default InProgressComplaintsTable;

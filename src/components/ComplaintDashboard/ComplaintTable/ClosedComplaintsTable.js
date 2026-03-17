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
import { useFilters } from "../../../context/FiltersContext"; // ✅ shared filters

const pageSize = 10;

const ClosedComplaintsTable = ({
  handleOpenModal,
  openRemarksModal,
  calculateAgingDays,
  getStatusClass,
  getCourierStatusClass,
  complaintsRefreshKey,
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // ✅ Use global/shared filters, keep status local
  const { filters: globalFilters, setFilters, defaultFilters } = useFilters();
  const [status] = useState("Closed");

  const [branchGroups, setBranchGroups] = useState([]); // GROUPED complaints
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [remarksCounts, setRemarksCounts] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
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

  // Flat complaints for dropdowns and count
  const allComplaints = branchGroups.flatMap((group) => group.complaints || []);
  const uniqueBanks = Array.from(new Set(allComplaints.map((c) => c.bankName).filter(Boolean)));
  const uniqueEngineers = Array.from(new Set(allComplaints.map((c) => c.engineerName).filter(Boolean)));
  const uniqueCities = Array.from(new Set(allComplaints.map((c) => c.city).filter(Boolean)));
  const uniqueSubStatuses = Array.from(new Set(allComplaints.map((c) => c.subStatus).filter(Boolean)));
  const EXPORT_PAGE_SIZE = 1000; // try 1000–2000
  const EXPORT_BATCH_SIZE = 3;   // 6–12 is usually safe
  
  // ---- helpers
  const pick = (obj, keys) =>
    Object.fromEntries(
      keys
        .map((k) => [k, obj?.[k]])
        .filter(([, v]) => v !== undefined && v !== "")
    );

  // Only the fields this component cares about (avoid cross-tab leaks)
  const CLOSED_ALLOWED_KEYS = [
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
    // closed-date specific:
    "closedDate",
    "closedDateFrom",
    "closedDateTo",
    // export only:
    "reportType",
  ];

  // --- Fetch complaints, returns groups from API ---
  const fetchComplaints = async () => {
    setLoading(true);
    setProgress(0);

    // simulate progress increase until 90%
    let interval = setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + 10 : prev));
    }, 300);

    try {
      const shared = pick(globalFilters, CLOSED_ALLOWED_KEYS);
      const { reportType, ...filtersForApi } = shared; // don't send reportType to list API

      const params = {
        page: currentPage,
        size: pageSize,
        status, // ⬅️ force local status
        ...filtersForApi,
      };

      const res = await axios.get(`${API_BASE_URL}/complaints/paginated-by-status`, {
        params,
        withCredentials: true,
      });

      setBranchGroups(res.data.content || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalRecords(res.data.totalElements || 0);

      // read backend header for running serial offset
      const beforePageHeader =
        res.headers?.["x-complaints-before-page"] ?? res.headers?.["X-Complaints-Before-Page"];
      setComplaintsBeforePage(Number.parseInt(beforePageHeader, 10) || 0);

      // complete progress
      setProgress(100);
    } catch (err) {
      setBranchGroups([]);
      setTotalPages(1);
      setTotalRecords(0);
      setComplaintsBeforePage(0); // reset offset on error
      setProgress(100); // still finish the progress bar on error
    } finally {
      clearInterval(interval);
      setTimeout(() => setLoading(false), 500); // short delay to show 100%
    }
  };

  // --- Live updates via WebSocket! ---
  useComplaintReportsLive(async (wsData) => {
    if (!wsData || !wsData.complaintId) return;

    // Check if visible in current groups
    const isVisible = branchGroups.some((group) =>
      (group.complaints || []).some((c) => c.complaintId === wsData.complaintId)
    );

    if (wsData.action === "created") {
      try {
        // Fetch new complaint by complaintId
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
            // Add new group to top
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
      } catch (e) {
        fetchComplaints(); // fallback to reload
      }
      return;
    }

    if (!isVisible) return;

    try {
      // Fetch updated complaint by complaintId
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

  // --- Fetch complaints on filter/page/refresh change ---
  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line
  }, [globalFilters, status, currentPage, complaintsRefreshKey]);

  // --- Reset to first page when filters change ---
  useEffect(() => {
    setCurrentPage(0);
  }, [globalFilters]);

  // --- Fetch remarks counts for visible (flat) complaints ---
  useEffect(() => {
    const idsToFetch = allComplaints
      .map((c) => c.id)
      .filter((id) => id && remarksCounts[id] === undefined);
    if (idsToFetch.length) {
      axios
        .post(`${API_BASE_URL}/complaints/remarks/counts`, idsToFetch, { withCredentials: true })
        .then((res) => setRemarksCounts((prev) => ({ ...prev, ...res.data })))
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, [branchGroups]);

  // --- Fetch report availability for visible (flat) complaints ---
  useEffect(() => {
    const visibleComplaintIds = allComplaints
      .map((c) => c.complaintId)
      .filter((id) => id && reportAvailability[id] === undefined);
    if (visibleComplaintIds.length > 0) {
      axios
        .post(`${API_BASE_URL}/hardware-logs/reports/availability`, visibleComplaintIds, {
          withCredentials: true,
        })
        .then((response) => setReportAvailability((prev) => ({ ...prev, ...response.data })))
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, [branchGroups]);

  // --- Fetch dropdown options ---
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

  // --- Clear filters: reset shared filters (status remains local) ---
  const handleClearFilters = () => {
    setFilters(defaultFilters);
  };

  // --------- FULL REPORT GENERATION LOGIC -----------
  const fetchAllComplaintsForExport = async () => {
    const shared = pick(globalFilters, CLOSED_ALLOWED_KEYS);
    const { reportType, ...filtersForApi } = shared;
  
    // 1) first page (discover totalPages)
    const firstRes = await axios.get(`${API_BASE_URL}/complaints/paginated-by-status`, {
      params: { ...filtersForApi, status, page: 0, size: EXPORT_PAGE_SIZE },
      withCredentials: true,
    });
  
    let allFetched = Array.isArray(firstRes.data?.content)
      ? firstRes.data.content.flatMap((g) => g.complaints || [])
      : [];
  
    const totalPages = firstRes.data?.totalPages || 1;
    if (totalPages <= 1) return allFetched;
  
    // 2) fetch remaining pages in small parallel batches
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
      const allComplaints = await fetchAllComplaintsForExport();
      await generateExcelReport(
        allComplaints,
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
  // --------------------------------------------------

  const handleRowClick = (complaintId) => {
    setSelectedRow((prevSelectedRow) =>
      prevSelectedRow === complaintId ? null : complaintId
    );
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

  // S.No. offset from backend (continuous across pages)
  let serialCounter = complaintsBeforePage;

  return (
    <div>
      <ComplaintFilters
        filters={globalFilters}          // ⬅️ shared filters
        onFiltersChange={setFilters}     // ⬅️ update shared
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
          field: "closedDate",
          label: "Closed Date",
          placeholder: "yyyy-mm-dd",
        }}
      />
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
                <th>Status</th>
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
                  <React.Fragment key={group.bankName + group.branchCode + groupIndex}>
                    <tr className="group-header-row">
                      <td
                        colSpan="25"
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
                            {complaint.complaintStatus || "Closed"}
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
                              aria-label={complaint.priority ? "Unmark Priority" : "Mark as Priority"}
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
                          <td>{complaint.closedDate}</td>
                          <td>{complaint.bankName}</td>
                          <td>{complaint.branchCode}</td>
                          <td>{complaint.branchName}</td>
                          <td>{complaint.city}</td>
                          <td>{complaint.referenceNumber || "N/A"}</td>
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
                  <td colSpan="25" style={{ textAlign: "center" }}>
                    No closed complaints to display
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
      {/* Multi-report modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        complaintId={selectedComplaintIdForReports}
        handleClose={closeReportModal}
      />
    </div>
  );
};

export default ClosedComplaintsTable;

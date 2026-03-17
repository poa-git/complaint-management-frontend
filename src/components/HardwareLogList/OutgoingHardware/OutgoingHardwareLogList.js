import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import OutgoingHardwareLogModal from "./OutgoingHardwareLogModal";
import HardwarePartsModal from "../../Lab/HardwarePartsModal/HardwarePartsModal";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import "./OutgoingHardwareLogList.css";
import qs from "qs";
import Loader from "../../../utils/Loader";

const initialFilters = {
  bankName: "",
  branchName: "",
  branchCode: "",
  city: "",
  complaintStatus: "",
  dispatchOutwardDate: "",
  receivedOutwardDate: "",
  hardwarePickedDate: "",
  equipmentDescription: "",
  complaintId: "",
  cnNumber: "",
  courierStatus: "",
};

const OutgoingHardwareLogList = ({ openRemarksModal, statuses }) => {
  const [hardwareLogs, setHardwareLogs] = useState([]);
  const [remarksCounts, setRemarksCounts] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courierStatusOptions, setCourierStatusOptions] = useState([]);
  // Loader state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  // Manage Parts state
  const [showPartsModal, setShowPartsModal] = useState(false);
  const [selectedHardwareLogId, setSelectedHardwareLogId] = useState(null);
  const [hardwarePartsByLog, setHardwarePartsByLog] = useState({});

  // Tooltip management
  const [tooltipData, setTooltipData] = useState({
    content: "",
    position: { x: 0, y: 0 },
    isVisible: false,
  });

  const showTooltip = (e, content) => {
    const rect = e.target.getBoundingClientRect();
    setTooltipData({
      content,
      position: {
        x: rect.left + window.scrollX + rect.width / 2,
        y: rect.top + window.scrollY + rect.height + 10,
      },
      isVisible: true,
    });
  };

  const hideTooltip = () => {
    setTooltipData((prev) => ({ ...prev, isVisible: false }));
  };

  // Filters (courierStatus included)
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);

  // Dropdown options
  const [bankOptions, setBankOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [complaintStatusOptions, setComplaintStatusOptions] = useState([]);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const recordsPerPage = 50;
  const maxVisiblePages = 5;

  // Clear all filters
  const clearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setCurrentPage(1);
  };

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    setAppliedFilters(filters);
  }, [filters]);

  const handleFilterKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
  );

  // Always send courierStatus param
  const fetchHardwareLogs = useCallback(async () => {
    setLoading(true);
    setProgress(0);

    // simulate progress until axios finishes
    let interval = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 10 : p));
    }, 300);

    try {
      const params = {
        page: currentPage - 1,
        size: recordsPerPage,
        ...appliedFilters,
        equipment: appliedFilters.equipmentDescription,
        courierStatus: appliedFilters.courierStatus
          ? [appliedFilters.courierStatus]
          : ["Dispatch Outward", "Received Outward"],
      };
      delete params.equipmentDescription;

      Object.keys(params).forEach(
        (key) =>
          key !== "courierStatus" &&
          (params[key] === "" || params[key] === undefined) &&
          delete params[key]
      );

      const response = await axios.get(
        `${API_BASE_URL}/hardware-logs/paginated`,
        {
          params,
          paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "repeat" }),
          withCredentials: true,
        }
      );

      setHardwareLogs(response.data.content || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error("Error fetching hardware logs:", error);
      setHardwareLogs([]);
      setTotalPages(1);
    } finally {
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => setLoading(false), 500);
    }
  }, [API_BASE_URL, currentPage, appliedFilters]);

  // Fetch parts for a log (by complaintLog.id, always outgoing)
  const fetchPartsForLog = async (logId) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/hardware-logs/${logId}/parts`,
        { withCredentials: true }
      );
      setHardwarePartsByLog((prev) => ({
        ...prev,
        [logId]: res.data,
      }));
    } catch (e) {
      setHardwarePartsByLog((prev) => ({
        ...prev,
        [logId]: [],
      }));
    }
  };

  // Refetch when applied filters/page change
  useEffect(() => {
    fetchHardwareLogs();
  }, [fetchHardwareLogs]);

  // Fetch parts for all logs on page
  useEffect(() => {
    hardwareLogs.forEach((log) => {
      const partKey = log.complaintLog?.id;
      if (partKey && hardwarePartsByLog[partKey] === undefined) {
        fetchPartsForLog(partKey);
      }
    });
    // eslint-disable-next-line
  }, [hardwareLogs]);

  // Build dropdown options dynamically (from current page)
  useEffect(() => {
    const bankSet = new Set();
    const citySet = new Set();
    const complaintStatusSet = new Set();
    const courierStatusSet = new Set();

    hardwareLogs.forEach((log) => {
      if (log.complaintLog?.bankName)
        bankSet.add(log.complaintLog.bankName.trim());
      if (log.complaintLog?.city) citySet.add(log.complaintLog.city.trim());
      if (log.complaintLog?.complaintStatus)
        complaintStatusSet.add(log.complaintLog.complaintStatus.trim());
      if (log.courierStatus) courierStatusSet.add(log.courierStatus.trim());
    });

    setBankOptions(["", ...Array.from(bankSet)]);
    setCityOptions(["", ...Array.from(citySet)]);
    setComplaintStatusOptions(["", ...Array.from(complaintStatusSet)]);
    setCourierStatusOptions(["", ...Array.from(courierStatusSet)]);
  }, [hardwareLogs]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Pagination helpers
  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const getVisiblePages = () => {
    const pages = [];
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, currentPage + half);

    if (currentPage <= half) {
      end = Math.min(totalPages, maxVisiblePages);
    }
    if (currentPage > totalPages - half) {
      start = Math.max(1, totalPages - maxVisiblePages + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  // Fetch remarks counts for current page's logs
  useEffect(() => {
    const fetchRemarksCounts = async () => {
      const visibleComplaintIds = hardwareLogs
        .map((log) => log.complaintLog?.id)
        .filter((id) => id && remarksCounts[id] === undefined);

      if (visibleComplaintIds.length > 0) {
        try {
          const response = await axios.post(
            `${API_BASE_URL}/complaints/remarks/counts`,
            visibleComplaintIds,
            { withCredentials: true }
          );
          setRemarksCounts((prevCounts) => ({
            ...prevCounts,
            ...response.data,
          }));
        } catch (error) {
          console.error("Error fetching remarks counts:", error);
        }
      }
    };

    fetchRemarksCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardwareLogs]);

  const handleRowClick = (logId) => {
    setSelectedRow((prevSelectedRow) =>
      prevSelectedRow === logId ? null : logId
    );
  };

  const openModal = (log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedLog(null);
    setIsModalOpen(false);
  };

  // Manage Parts modal (outgoing mode)
  const openPartsModal = (partKey) => {
    if (partKey && hardwarePartsByLog[partKey] === undefined) {
      fetchPartsForLog(partKey);
    }
    setSelectedHardwareLogId(partKey);
    setShowPartsModal(true);
  };

  // Refetch logs (useful after a status update in the modal)
  const refreshLogs = async () => {
    await fetchHardwareLogs();
  };

  // Assign color classes for statuses
  const getStatusClass = (status) => {
    switch ((status || "").toLowerCase()) {
      case "dispatch inward":
        return "status-dispatch-inward";
      case "dispatch outward":
        return "status-dispatch-outward";
      case "pending":
        return "status-pending";
      case "lost":
        return "status-lost";
      case "received inward":
        return "status-received-inward";
      case "received outward":
        return "status-received-outward";
      case "hardware ready":
        return "status-hardware-ready";
      case "pending for closed":
        return "pending-for-closed";
      case "wait for approval":
        return "wait-for-approval";
      case "approved":
        return "approved";
      case "in progress":
        return "status-in-progress";
      case "closed":
        return "status-closed";
      case "foc":
        return "status-foc";
      case "quotation":
        return "status-qout";
      case "network issue":
        return "status-network-issue";
      case "visit schedule":
        return "status-visit-schedule";
      case "hardware picked":
        return "status-hardware-picked";
      case "visit on hold":
        return "status-visit-on-hold";
      case "dispatched":
        return "status-dispatched";
      case "delivered":
        return "status-delivered";
      default:
        return "status-default";
    }
  };

  // Export the currently shown data to Excel
  const exportToExcel = async () => {
    try {
      // Step 1: Get ALL records by requesting a huge page size (e.g., 10000)
      const params = {
        ...appliedFilters,
        equipment: appliedFilters.equipmentDescription,
        courierStatus: appliedFilters.courierStatus
          ? [appliedFilters.courierStatus]
          : ["Dispatch Outward", "Received Outward"],
        page: 0,
        size: 10000,
      };
      delete params.equipmentDescription;

      // Remove empty params except courierStatus
      Object.keys(params).forEach(
        (key) =>
          key !== "courierStatus" &&
          (params[key] === "" || params[key] === undefined) &&
          delete params[key]
      );

      const response = await axios.get(
        `${API_BASE_URL}/hardware-logs/paginated`,
        {
          params,
          paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "repeat" }),
          withCredentials: true,
        }
      );

      const allLogs = response.data.content || [];

      // Step 2: Fetch all parts for all logs (parallel)
      const partsByLog = {};
      await Promise.all(
        allLogs.map(async (log) => {
          const logId = log.complaintLog?.id;
          if (logId) {
            try {
              const res = await axios.get(
                `${API_BASE_URL}/hardware-logs/${logId}/parts`,
                { withCredentials: true }
              );
              partsByLog[logId] = res.data;
            } catch {
              partsByLog[logId] = [];
            }
          }
        })
      );

      // Step 3: ExcelJS code (use allLogs)
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Outgoing Hardware Logs");
      worksheet.columns = [
        { header: "S.No", key: "s_no", width: 6 },
        { header: "Dispatch CN No.", key: "dispatch_cn_number", width: 20 },
        {
          header: "Dispatch Outward Date",
          key: "dispatch_outward_date",
          width: 20,
        },
        {
          header: "Hardware Picked Date",
          key: "hardware_picked_date",
          width: 20,
        },
        {
          header: "Received Outward Date",
          key: "received_outward_date",
          width: 20,
        },
        { header: "Complaint Status", key: "complaint_status", width: 20 },
        { header: "Courier Status", key: "courier_status", width: 20 },
        { header: "Bank Name", key: "bank_name", width: 20 },
        { header: "Branch Name", key: "branch_name", width: 25 },
        { header: "Branch Code", key: "branch_code", width: 15 },
        { header: "City", key: "city", width: 15 },
        {
          header: "Equipment Description",
          key: "equipment_description",
          width: 30,
        },
        { header: "Extra Hardware", key: "extra_hardware", width: 30 },
        { header: "Parts", key: "parts", width: 44 },
        { header: "Complaint ID", key: "complaint_id", width: 20 },
      ];

      // Header Row: style and borders
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "4F81BD" },
      };
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: "medium" },
          left: { style: "medium" },
          bottom: { style: "medium" },
          right: { style: "medium" },
        };
      });

      allLogs.forEach((log, index) => {
        const logId = log.complaintLog?.id;
        const parts = partsByLog[logId] || [];
        const partsString = parts.length
          ? parts
              .map((p, i) => {
                const dateStr =
                  p.status === "repaired" && p.repairedAt
                    ? `, ${new Date(p.repairedAt).toLocaleDateString()}`
                    : p.status === "not_repairable" && p.notRepairableAt
                    ? `, ${new Date(p.notRepairableAt).toLocaleDateString()}`
                    : "";
                return (
                  `(${i + 1}) ${p.hardwareName || "Unknown"}` +
                  (p.status ? ` [${p.status}]` : "") +
                  (p.assignedEngineer ? `, Eng: ${p.assignedEngineer}` : "") +
                  dateStr
                );
              })
              .join("\n")
          : " ";

        const row = worksheet.addRow({
          s_no: index + 1,
          dispatch_cn_number: log.dispatchCnNumber || "N/A",
          dispatch_outward_date: log.dispatchOutwardDate || "N/A",
          hardware_picked_date: log.complaintLog?.hardwarePickedDate || "N/A",
          received_outward_date: log.receivedOutwardDate || "N/A",
          complaint_status: log.complaintLog?.complaintStatus || "N/A",
          courier_status: log.courierStatus || "N/A",
          bank_name: log.complaintLog?.bankName || "N/A",
          branch_name: log.complaintLog?.branchName || "N/A",
          branch_code: log.complaintLog?.branchCode || "N/A",
          city: log.complaintLog?.city || "N/A",
          equipment_description: log.equipmentDescription || "N/A",
          extra_hardware: log.extraHardware || "N/A",
          parts: partsString,
          complaint_id: log.complaintLog?.complaintId || "N/A",
        });

        // Borders, zebra striping, alignment, wrapping for every cell in row
        const bgColor = (index + 2) % 2 === 0 ? "DCE6F1" : "FFFFFF";
        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bgColor },
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          // If "Parts" column, wrap text and left-align; else center-align
          if (worksheet.getColumn(colNumber).key === "parts") {
            cell.alignment = {
              wrapText: true,
              vertical: "top",
              horizontal: "left",
            };
            cell.font = { ...cell.font, bold: true };
          } else {
            cell.alignment = {
              wrapText: true,
              vertical: "middle",
              horizontal: "center",
            };
          }
        });
        // Adjust row height based on parts line count (for better readability)
        if (partsString) {
          const lineCount = (partsString.match(/\n/g) || []).length;
          row.height = 20 + lineCount * 5;
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), "OutgoingHardwareLogs.xlsx");
    } catch (error) {
      alert("Failed to export. Please try again.");
      console.error("Export error:", error);
    }
  };

  return (
    <div className="hardware-log-container">
      <h2 className="hardware-log-heading">Outgoing Hardware Logs</h2>

      {/* ---------- FILTERS SECTION ---------- */}
      <h3>Filters</h3>
      <div className="filter-section">
        {/* Bank Name */}
        <div className="filter-group">
          <label className="filter-label">Bank Name:</label>
          <input
            type="text"
            name="bankName"
            value={filters.bankName}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Partial match"
          />
        </div>
        {/* City */}
        <div className="filter-group">
          <label className="filter-label">City:</label>
          <input
            type="text"
            name="city"
            value={filters.city}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Partial match"
          />
        </div>
        {/* Complaint Status */}
        <div className="filter-group">
          <label className="filter-label">Complaint Status:</label>
          <input
            type="text"
            name="complaintStatus"
            value={filters.complaintStatus}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Partial match"
          />
        </div>
        {/* Courier Status */}
        <div className="filter-group">
          <label className="filter-label">Courier Status:</label>
          <select
            name="courierStatus"
            value={filters.courierStatus}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
          >
            <option value="">All</option>
            <option value="Dispatch Outward">Dispatch Outward</option>
            <option value="Received Outward">Received Outward</option>
          </select>
        </div>

        {/* Dispatch Outward Date */}
        <div className="filter-group">
          <label className="filter-label">Dispatch Outward Date:</label>
          <input
            type="date"
            name="dispatchOutwardDate"
            value={filters.dispatchOutwardDate}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input date-filter"
          />
        </div>
        {/* Hardware Picked Date */}
        <div className="filter-group">
          <label className="filter-label">Hardware Picked Date:</label>
          <input
            type="date"
            name="hardwarePickedDate"
            value={filters.hardwarePickedDate}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input date-filter"
          />
        </div>
        {/* Received Outward Date */}
        <div className="filter-group">
          <label className="filter-label">Received Outward Date:</label>
          <input
            type="date"
            name="receivedOutwardDate"
            value={filters.receivedOutwardDate}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input date-filter"
          />
        </div>
        {/* Branch Name */}
        <div className="filter-group">
          <label className="filter-label">Branch Name:</label>
          <input
            type="text"
            name="branchName"
            value={filters.branchName}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Partial match"
          />
        </div>
        {/* Branch Code */}
        <div className="filter-group">
          <label className="filter-label">Branch Code:</label>
          <input
            type="text"
            name="branchCode"
            value={filters.branchCode}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Partial match"
          />
        </div>
        {/* Equipment Description */}
        <div className="filter-group">
          <label className="filter-label">Equipment Desc.:</label>
          <input
            type="text"
            name="equipmentDescription"
            value={filters.equipmentDescription}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Partial match"
          />
        </div>
        {/* Complaint ID */}
        <div className="filter-group">
          <label className="filter-label">Complaint ID:</label>
          <input
            type="text"
            name="complaintId"
            value={filters.complaintId}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Partial match"
          />
        </div>
        {/* CN Number */}
        <div className="filter-group">
          <label className="filter-label">CN Number:</label>
          <input
            type="text"
            name="cnNumber"
            value={filters.cnNumber}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Partial match"
          />
        </div>

        <button className="search-filters" onClick={handleSearch}>
          Search
        </button>
        <button className="clear-filters" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      {/* ---------- EXPORT BUTTON ---------- */}
      <div className="export-button-container">
        <button onClick={exportToExcel} className="generate-report">
          Generate Report (Excel)
        </button>
      </div>

      {/* ---------- TABLE SECTION ---------- */}
      <div className="table-wrapper">
        <table className="complaint-table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Update</th>
              <th>Manage Parts</th>
              <th>Remarks</th>
              <th>Complaint Status</th>
              <th>Courier Status</th>
              <th>Bank Name</th>
              <th>Branch Name</th>
              <th>Branch Code</th>
              <th>City</th>
              <th>Visitor Name</th>
              <th>Dispatch CN No.</th>
              <th>Hardware Picked Date</th>
              <th>Dispatch Outward Date</th>
              <th>Received Outward Date</th>
              <th>Equipment Description</th>
              <th>Extra Hardware</th>
              <th>Complaint ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="18" style={{ textAlign: "center" }}>
                  <Loader progress={progress} />
                </td>
              </tr>
            ) : hardwareLogs.length > 0 ? (
              [...hardwareLogs]
                .sort((a, b) => {
                  // Sort "Dispatch Outward" first, then others
                  const aStatus = (a.courierStatus || "").toLowerCase();
                  const bStatus = (b.courierStatus || "").toLowerCase();
                  if (
                    aStatus === "dispatch outward" &&
                    bStatus !== "dispatch outward"
                  )
                    return -1;
                  if (
                    bStatus === "dispatch outward" &&
                    aStatus !== "dispatch outward"
                  )
                    return 1;
                  return 0; // Keep original order otherwise
                })
                .map((log, index) => {
                  const partKey = log.complaintLog?.id;
                  const parts = hardwarePartsByLog[partKey] || [];
                  const total = parts.length;
                  const repaired = parts.filter((p) => p.repaired).length;
                  let color = "gray";
                  if (total > 0 && repaired === total) color = "green";
                  else if (repaired > 0) color = "orange";

                  return (
                    <tr
                      key={log.id}
                      onClick={() => handleRowClick(log.id)}
                      className={selectedRow === log.id ? "selected-row" : ""}
                    >
                      <td>{index + 1 + (currentPage - 1) * recordsPerPage}</td>
                      {/* Update button */}
                      <td>
                        <button
                          className="update-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(log);
                          }}
                        >
                          Update
                        </button>
                      </td>
                      {/* Manage Parts button */}
                      <td>
                        <button
                          className="manage-parts-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPartsModal(partKey);
                          }}
                        >
                          Manage Parts
                        </button>
                        {hardwarePartsByLog[partKey] === undefined ? (
                          <Loader progress={progress} size="small" />
                        ) : (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 12,
                              color,
                              fontWeight:
                                repaired === total && total > 0
                                  ? "bold"
                                  : "normal",
                            }}
                          >
                            {repaired}/{total} parts
                          </span>
                        )}
                      </td>
                      {/* Remarks */}
                      <td>
                        <button
                          className={`remark-button ${
                            remarksCounts[log.complaintLog?.id] === undefined
                              ? "remark-button-loading"
                              : remarksCounts[log.complaintLog?.id] > 0
                              ? "remark-button-green"
                              : "remark-button-red"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openRemarksModal(log.complaintLog);
                          }}
                          disabled={
                            remarksCounts[log.complaintLog?.id] === undefined
                          }
                        >
                          {remarksCounts[log.complaintLog?.id] === undefined ? (
                            <Loader progress={progress} size="tiny" />
                          ) : (
                            "Remarks"
                          )}
                          <span
                            className={`remarks-count ${
                              remarksCounts[log.complaintLog?.id] > 0
                                ? "remarks-count-green"
                                : "remarks-count-red"
                            }`}
                          >
                            {remarksCounts[log.complaintLog?.id] || 0}
                          </span>
                        </button>
                      </td>
                      {/* Complaint Status */}
                      <td
                        className={`status-cell ${getStatusClass(
                          log.complaintLog?.complaintStatus
                        )}`}
                      >
                        {log.complaintLog?.complaintStatus || "N/A"}
                      </td>
                      {/* Courier Status */}
                      <td
                        className={`status-cell ${getStatusClass(
                          log.courierStatus
                        )}`}
                      >
                        {log.courierStatus || "N/A"}
                      </td>
                      {/* Bank Name */}
                      <td>{log.complaintLog?.bankName || "N/A"}</td>
                      {/* Branch Name */}
                      <td>{log.complaintLog?.branchName || "N/A"}</td>
                      {/* Branch Code */}
                      <td>{log.complaintLog?.branchCode || "N/A"}</td>
                      {/* City */}
                      <td>{log.complaintLog?.city || "N/A"}</td>
                      {/* Visitor Name */}
                      <td>{log.complaintLog?.visitorName || "N/A"}</td>
                      {/* Dispatch CN No. */}
                      <td>{log.dispatchCnNumber || "N/A"}</td>
                      {/* Hardware Picked Date */}
                      <td>{log.complaintLog?.hardwarePickedDate || "N/A"}</td>
                      {/* Dispatch Outward Date */}
                      <td>{log.dispatchOutwardDate || "N/A"}</td>
                      {/* Received Outward Date */}
                      <td>{log.receivedOutwardDate || "N/A"}</td>
                      {/* Equipment Description */}
                      <td>
                        <div
                          className="tooltip-container"
                          onMouseEnter={(e) =>
                            showTooltip(e, log.equipmentDescription || "N/A")
                          }
                          onMouseLeave={hideTooltip}
                        >
                          <span className="truncate-text">
                            {log.equipmentDescription || "N/A"}
                          </span>
                        </div>
                      </td>
                      {/* Extra Hardware */}
                      <td>
                        <div
                          className="tooltip-container"
                          onMouseEnter={(e) =>
                            showTooltip(e, log.extraHardware || "N/A")
                          }
                          onMouseLeave={hideTooltip}
                        >
                          <span className="truncate-text">
                            {log.extraHardware || "N/A"}
                          </span>
                        </div>
                      </td>
                      {/* Complaint ID */}
                      <td>{log.complaintLog?.complaintId || "N/A"}</td>
                    </tr>
                  );
                })
            ) : (
              <tr>
                <td colSpan="18" className="no-data">
                  No hardware logs available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {/* Tooltip */}
        {tooltipData.isVisible && (
          <div
            className="portal-tooltip"
            style={{
              top: tooltipData.position.y,
              left: tooltipData.position.x,
            }}
          >
            {tooltipData.content}
          </div>
        )}
      </div>

      {/* ---------- PAGINATION ---------- */}
      {hardwareLogs.length > 0 && (
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

      {/* ---------- MODAL ---------- */}
      <OutgoingHardwareLogModal
        isOpen={isModalOpen}
        selectedLog={selectedLog}
        handleCloseModal={closeModal}
        refreshLogs={refreshLogs}
        statuses={statuses}
      />

      {/* ---------- MANAGE PARTS MODAL ---------- */}
      {showPartsModal && selectedHardwareLogId && (
        <HardwarePartsModal
          logId={selectedHardwareLogId}
          hardwareParts={hardwarePartsByLog[selectedHardwareLogId]}
          refreshParts={() => fetchPartsForLog(selectedHardwareLogId)}
          onClose={() => setShowPartsModal(false)}
          API_BASE_URL={API_BASE_URL}
          isOpen={showPartsModal}
          mode="outgoing"
          bankName={
            hardwareLogs.find(
              (log) => log.complaintLog?.id === selectedHardwareLogId
            )?.complaintLog?.bankName || ""
          }
          branchCode={
            hardwareLogs.find(
              (log) => log.complaintLog?.id === selectedHardwareLogId
            )?.complaintLog?.branchCode || ""
          }
          branchName={
            hardwareLogs.find(
              (log) => log.complaintLog?.id === selectedHardwareLogId
            )?.complaintLog?.branchName || ""
          }
        />
      )}
    </div>
  );
};

export default OutgoingHardwareLogList;
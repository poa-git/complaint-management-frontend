import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import axios from "axios";
import "./Lab.css";
import LabLogModal from "./LabLogModal";
import "../ComplaintDashboard/FilterSection/FilterSection.css";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import ReportModal from "./ReportModal";
import ComplaintReport from "../ComplaintReport/ComplaintReport";
import HardwarePartsModal from "./HardwarePartsModal/HardwarePartsModal";
import Loader from "../../utils/Loader";

const recordsPerPage = 20;
const maxVisiblePages = 5;

const currentUsername = (localStorage.getItem("username") || "User")
  .trim()
  .toLowerCase();
const currentUserRole = (localStorage.getItem("role") || "")
  .trim()
  .toLowerCase();

const initialFilters = {
  bankName: "",
  branchCode: "",
  branchName: "",
  complaintStatus: "",
  city: "",
  courierStatus: "",
  staff: "",
  dispatchInwardDate: "",
  receivedInwardDate: "",
  equipmentDescription: "",
  dispatchCnNumber: "",
  labEngineer: "",
  hOkDate: "",
  onlyFOCApproved: false,
  workedTodayByUser: "",
  done: "",
};

const Lab = ({ openRemarksModal }) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // -------------------------
  // State
  // -------------------------
  const [hardwareLogs, setHardwareLogs] = useState([]); // store page logs
  const [remarksCounts, setRemarksCounts] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reportAvailability, setReportAvailability] = useState({});
  const [reportContents, setReportContents] = useState({});
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workedTodayByUser, setWorkedTodayByUser] = useState({});
  const [hardwarePartsByLog, setHardwarePartsByLog] = useState({});
  const [showPartsModal, setShowPartsModal] = useState(false);
  const [apiComplaintStatuses, setApiComplaintStatuses] = useState([]);
  const [selectedComplaintIdForParts, setSelectedComplaintIdForParts] =
    useState(null);

  const [selectedComplaintIdForReports, setSelectedComplaintIdForReports] =
    useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // NEW: carry parts log id into ReportModal
  const [selectedPartsLogIdForReports, setSelectedPartsLogIdForReports] =
    useState(null);

  // Loader state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Filters
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);

  // Tooltip
  const [tooltipData, setTooltipData] = useState({
    content: "",
    position: { x: 0, y: 0 },
    isVisible: false,
  });

  // To detect "new logs"
  const previousLogCountRef = useRef(0);

  // -------------------------
  // Worked today API
  // -------------------------
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/hardware-logs/lab-user/reports-today`, {
        withCredentials: true,
      })
      .then((res) => {
        setWorkedTodayByUser(res.data || {});
      })
      .catch(() => setWorkedTodayByUser({}));
  }, [API_BASE_URL]);

  // Fetch canonical complaint statuses
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/data/statuses`, {
          withCredentials: true,
        });
        const list = Array.isArray(res.data)
          ? res.data.map((s) => s?.statusValue?.trim()).filter(Boolean)
          : [];
        setApiComplaintStatuses(list);
      } catch (e) {
        console.warn(
          "Failed to fetch complaint statuses; falling back to page-derived list.",
          e
        );
        setApiComplaintStatuses([]); // fallback handled in memo below
      }
    };
    fetchStatuses();
  }, [API_BASE_URL]);

  const reloadWorkedTodayByUser = useCallback(() => {
    axios
      .get(`${API_BASE_URL}/hardware-logs/lab-user/reports-today`, {
        withCredentials: true,
      })
      .then((res) => setWorkedTodayByUser(res.data || {}))
      .catch(() => setWorkedTodayByUser({}));
  }, [API_BASE_URL]);

  // -------------------------
  // Notification + Sound
  // -------------------------
  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    const audio = new Audio("/sounds/notification.mp3");
    audio.play().catch((err) => console.error("Audio play error:", err));
  }, []);

  const showNotification = useCallback((title, message) => {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body: message,
        icon: "/icon.png",
      });
    }
  }, []);

  // -------------------------
  // Data Fetch with paginated API and server-side filtering
  // -------------------------
  const fetchHardwareLogs = useCallback(
    async (
      page = currentPage - 1,
      pageSize = recordsPerPage,
      filtersObj = appliedFilters
    ) => {
      setLoading(true);
      setProgress(0);

      // Increment progress until request completes
      let interval = setInterval(() => {
        setProgress((p) => (p < 90 ? p + 10 : p));
      }, 300);

      try {
        const params = new URLSearchParams();
        params.append("page", page);
        params.append("size", pageSize);
        params.append("sortBy", "id");
        params.append("direction", "desc");

        Object.entries(filtersObj).forEach(([key, value]) => {
          if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            value !== false
          ) {
            if (key === "courierStatus" && Array.isArray(value)) {
              value.forEach((status) => params.append("courierStatus", status));
            } else if (key === "onlyFOCApproved") {
              params.append("onlyFOCApproved", value);
            } else {
              params.append(key, value);
            }
          }
        });

        const response = await axios.get(
          `${API_BASE_URL}/hardware-logs/lab/paginated?${params.toString()}`,
          { withCredentials: true }
        );
        const pageResult = response.data;

        setHardwareLogs(pageResult.content || []);
        if ((pageResult.content || []).length > previousLogCountRef.current) {
          playNotificationSound();
          showNotification(
            "New Hardware Log",
            "A new hardware log has been detected!"
          );
        }
        previousLogCountRef.current = (pageResult.content || []).length;

        setTotalPages(pageResult.totalPages || 1);
        setCurrentPage(pageResult.number + 1);
      } catch (error) {
        console.error("Error fetching hardware logs:", error);
        setHardwareLogs([]);
        setTotalPages(1);
      } finally {
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => setLoading(false), 500);
      }
    },
    [
      API_BASE_URL,
      appliedFilters,
      playNotificationSound,
      showNotification,
      currentPage,
    ]
  );

  // -------------------------
  // Parts fetching logic
  // -------------------------
  const fetchPartsForLog = useCallback(
    async (logId) => {
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
    },
    [API_BASE_URL]
  );

  const openPartsModal = (logId) => {
    // Find extra info to log:
    const logObj = hardwareLogs.find((l) => l.id === logId);
    console.log("OPEN PARTS MODAL:", {
      logId,
      branchCode: logObj?.complaintLog?.branchCode,
      complaintId: logObj?.complaintLog?.complaintId,
      logObj,
    });
    fetchPartsForLog(logId); // Always refetch
    setSelectedComplaintIdForParts(logId);
    setShowPartsModal(true);
  };

  // -------------------------
  // Fetch data when filters/page changes
  // -------------------------
  useEffect(() => {
    fetchHardwareLogs(currentPage - 1, recordsPerPage, appliedFilters);
    // eslint-disable-next-line
  }, [fetchHardwareLogs, currentPage, appliedFilters]);

  // -------------------------
  // Derived Options (Memoized)
  // -------------------------
  const courierStatusOptions = useMemo(() => {
    const courierSet = new Set();
    hardwareLogs.forEach((log) => {
      if (log.courierStatus) {
        courierSet.add(log.courierStatus.trim());
      }
    });
    return ["", ...Array.from(courierSet)];
  }, [hardwareLogs]);

  // Complaint Status dropdown options from API + union extras from page data.
  const complaintStatusOptions = useMemo(() => {
    const base = Array.isArray(apiComplaintStatuses)
      ? apiComplaintStatuses
      : [];
    const extras = new Set();
    hardwareLogs.forEach((log) => {
      const s = log.complaintLog?.complaintStatus?.trim();
      if (s && !base.includes(s)) extras.add(s);
    });
    return ["", ...base, ...Array.from(extras)];
  }, [apiComplaintStatuses, hardwareLogs]);

  // -------------------------
  // Clear Filters
  // -------------------------
  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setCurrentPage(1);
  }, []);

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

  // -------------------------
  // Pagination helpers
  // -------------------------
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

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // -------------------------
  // Table row click handlers
  // -------------------------
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

  const refreshLogs = () => {
    fetchHardwareLogs(currentPage - 1, recordsPerPage, appliedFilters);
  };

  // -------------------------
  // "View Reports" Modal
  // -------------------------
  const openReportsForComplaint = (complaintId, partsLogId) => {
    setSelectedComplaintIdForReports(complaintId);
    setSelectedPartsLogIdForReports(partsLogId); // NEW
    setIsReportModalOpen(true);
  };

  const closeReportModal = () => {
    setSelectedComplaintIdForReports(null);
    setSelectedPartsLogIdForReports(null); // NEW
    setIsReportModalOpen(false);
  };

  // -------------------------
  // History
  // -------------------------
  const handleViewHistory = (complaintId) => {
    setSelectedComplaintId(complaintId);
  };

  const handleBackToTable = () => {
    setSelectedComplaintId(null);
  };

  // -------------------------
  // getStatusClass helper (extended to cover API statuses)
  // -------------------------
  const getStatusClass = (status) => {
    const s = status?.trim()?.toLowerCase();
    switch (s) {
      // Canonical/known mappings
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
        return "status-pending-for-closed";
      case "wait for approval":
        return "status-wait-for-approval";
      case "approved":
        return "status-approved";
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
      case "observation":
        return "status-observation";
      case "out of stock":
        return "status-out-of-stock";
      case "pre approved":
        return "status-pre-approved";

      // API-only / extras mapped to closest existing classes
      case "open":
        return "status-pending";
      case "verify approval":
      case "bfc approval":
      case "aho approval":
      case "bfc/aho":
        return "wait-for-approval";
      case "dc generated":
        // If you have a dedicated class, e.g. "status-dc-generated", use that.
        return "status-dispatched";
      case "disapproved":
        return "status-lost";
      case "marked in pool":
      case "testing":
      case "renovation":
      case "on call":
        return "status-pending";

      default:
        return "status-default";
    }
  };

  // -------------------------
  // handleFilterChange
  // -------------------------
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleToggleDcGenerated = async (log, newValue) => {
    try {
      await axios.patch(
        `${API_BASE_URL}/complaints/${log.complaintLog.id}/dc-generated`,
        { dcGenerated: newValue },
        { withCredentials: true }
      );
      fetchHardwareLogs(currentPage - 1, recordsPerPage, appliedFilters);
    } catch (err) {
      alert("Failed to update DC Generated status: " + err.message);
    }
  };

  // -------------------------
  // Export to Excel
  // -------------------------
  const exportToExcel = async () => {
    try {
      // 1. Prepare filters and params for backend
      const filtersObj = appliedFilters;
      const params = new URLSearchParams();
      params.append("size", 1000);
      params.append("sortBy", "id");
      params.append("direction", "desc");

      Object.entries(filtersObj).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          value !== "" &&
          value !== false
        ) {
          if (key === "courierStatus" && Array.isArray(value)) {
            value.forEach((status) => params.append("courierStatus", status));
          } else if (key === "onlyFOCApproved") {
            params.append("onlyFOCApproved", value);
          } else {
            params.append(key, value);
          }
        }
      });

      // 2. Fetch all pages
      let allLogs = [];
      let page = 0;
      let totalPages = 1;
      do {
        params.set("page", page);
        const response = await axios.get(
          `${API_BASE_URL}/hardware-logs/lab/paginated?${params.toString()}`,
          { withCredentials: true }
        );
        const pageResult = response.data;
        allLogs = allLogs.concat(pageResult.content || []);
        totalPages = pageResult.totalPages || 1;
        page++;
      } while (page < totalPages);

      if (allLogs.length === 0) {
        alert("No records found for export.");
        return;
      }

      const localReportContents = {};
      const localPartsByLog = {};

      // 3a. Fetch all reports for complaints (with sorting applied)
      await Promise.all(
        allLogs.map(async (log) => {
          const complaintId = log.complaintLog?.complaintId;
          if (complaintId) {
            try {
              const response = await axios.get(
                `${API_BASE_URL}/hardware-logs/${complaintId}/reports`,
                { withCredentials: true }
              );

              const reports = Array.isArray(response.data) ? response.data : [];

              // ✅ Sort oldest → newest by createdAt (replace with actual field if different)
              const contents = reports
                .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                .map((r, i) => `Report ${i + 1}: ${(r.content || "").trim()}`)
                .join("\n");

              localReportContents[complaintId] = contents || "No Reports";
            } catch {
              localReportContents[complaintId] = "No Reports";
            }
          }
        })
      );

      // 3b. Fetch all parts for logs
      await Promise.all(
        allLogs.map(async (log) => {
          const partKey = log.complaintLog?.id;
          if (partKey) {
            try {
              const res = await axios.get(
                `${API_BASE_URL}/hardware-logs/${partKey}/parts`,
                { withCredentials: true }
              );
              localPartsByLog[partKey] = res.data;
            } catch {
              localPartsByLog[partKey] = [];
            }
          }
        })
      );

      // 4. Generate Excel file
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Lab Report");

      worksheet.columns = [
        { header: "S.No", key: "s_no", width: 8 },
        { header: "Complaint Status", key: "complaint_status", width: 20 },
        { header: "Courier Status", key: "courier_status", width: 20 },
        { header: "DC Generated", key: "dc_generated", width: 16 },
        { header: "Reports", key: "reports", width: 44 },
        { header: "Lab Engineer", key: "lab_engineer", width: 20 },
        { header: "Bank Name", key: "bank_name", width: 18 },
        { header: "Branch Name", key: "branch_name", width: 18 },
        { header: "Branch Code", key: "branch_code", width: 13 },
        { header: "City", key: "city", width: 13 },
        { header: "CN No.", key: "cn_no", width: 13 },
        { header: "Hardware OK Date", key: "hok_date", width: 18 },
        { header: "Dispatch Inward Date", key: "dispatch_inward_date", width: 18 },
        { header: "Received Inward Date", key: "received_inward_date", width: 18 },
        { header: "Equipment Description", key: "equipment_description", width: 26 },
        { header: "Extra Hardware", key: "extra_hardware", width: 15 },
        { header: "Done", key: "done", width: 10 },
        { header: "Worked Today", key: "worked_today", width: 16 },
        { header: "Parts", key: "parts", width: 44 },
        { header: "Complaint ID", key: "complaint_id", width: 15 },
      ];

      worksheet.getRow(1).eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.font = { bold: true, color: { argb: "002060" }, size: 12 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "B8CCE4" } };
        cell.border = {
          top: { style: "medium" },
          left: { style: "medium" },
          bottom: { style: "medium" },
          right: { style: "medium" },
        };
      });

      allLogs.forEach((log, index) => {
        const partKey = log.complaintLog?.id;
        const parts = localPartsByLog[partKey] || [];
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

        const reportContent =
          localReportContents[log.complaintLog?.complaintId] || " ";

        const workedByUsers = Object.entries(workedTodayByUser)
          .filter(([user, ids]) =>
            ids.map(String).includes(String(log.complaintLog?.complaintId))
          )
          .map(([user]) => user)
          .join(", ");
        const workedTodayStatus = workedByUsers || "NO";

        const row = worksheet.addRow({
          s_no: index + 1,
          complaint_status: log.complaintLog?.complaintStatus || "N/A",
          courier_status: log.courierStatus || "N/A",
          dc_generated: log.complaintLog?.dcGenerated ? "YES" : "NO",
          reports: reportContent,
          lab_engineer: log.labEngineer || "",
          bank_name: log.complaintLog?.bankName || "N/A",
          branch_name: log.complaintLog?.branchName || "N/A",
          branch_code: log.complaintLog?.branchCode || "N/A",
          city: log.complaintLog?.city || "N/A",
          cn_no: log.receivingCnNumber || "N/A",
          hok_date: log.hokDate || "N/A",
          dispatch_inward_date: log.dispatchInwardDate || "N/A",
          received_inward_date: log.receivedInwardDate || "N/A",
          equipment_description: log.equipmentDescription || "N/A",
          extra_hardware: log.extraHardware || "N/A",
          done: log.done ? "YES" : "NO",
          worked_today: workedTodayStatus,
          parts: partsString,
          complaint_id: log.complaintLog?.complaintId || "N/A",
        });

        row.eachCell((cell, colNumber) => {
          const colKey = worksheet.getColumn(colNumber).key;
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: (index + 2) % 2 === 0 ? "F3F6FA" : "FFFFFF" },
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          if (colKey === "reports") {
            cell.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
          } else if (colKey === "parts") {
            cell.alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9E1F2" } };
            cell.font = { ...cell.font, bold: true };
          } else {
            cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
          }
        });

        const approxCharPerLineReports = 50;
        const approxCharPerLineParts = 50;

        const reportLines =
          Math.ceil(reportContent.length / approxCharPerLineReports) +
          (reportContent.match(/\n/g) || []).length;

        const partLines =
          Math.ceil(partsString.length / approxCharPerLineParts) +
          (partsString.match(/\n/g) || []).length;

        const totalLines = Math.max(reportLines, partLines, 1);
        row.height = totalLines * 15;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), "LabReport.xlsx");
    } catch (error) {
      console.error("Error generating Excel file:", error);
    }
  };

  // -------------------------
  // Tooltip logic
  // -------------------------
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

  // -------------------------
  // Fetch remarks counts, report status, parts, etc.
  // -------------------------
  useEffect(() => {
    // Remarks counts
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
  }, [hardwareLogs, remarksCounts, API_BASE_URL]);

  useEffect(() => {
    // Report availability
    const fetchReportStatus = async () => {
      const complaintIdsToCheck = hardwareLogs
        .map((log) => log.complaintLog?.complaintId)
        .filter((id) => id && reportAvailability[id] === undefined);

      if (complaintIdsToCheck.length > 0) {
        try {
          const response = await axios.post(
            `${API_BASE_URL}/hardware-logs/reports/availability`,
            complaintIdsToCheck,
            { withCredentials: true }
          );
          setReportAvailability((prev) => ({
            ...prev,
            ...response.data,
          }));
        } catch (err) {
          console.error("Error checking report availability:", err);
        }
      }
    };

    fetchReportStatus();
  }, [hardwareLogs, reportAvailability, API_BASE_URL]);

  useEffect(() => {
    hardwareLogs.forEach((log) => {
      const partKey = log.complaintLog?.id;
      if (partKey && hardwarePartsByLog[partKey] === undefined) {
        fetchPartsForLog(partKey);
      }
    });
  }, [hardwareLogs, hardwarePartsByLog, fetchPartsForLog]);

  //Report content
  useEffect(() => {
    const fetchReportData = async () => {
      const complaintIdsToFetch = hardwareLogs
        .map((log) => log.complaintLog?.complaintId)
        .filter((id) => id && reportContents[id] === undefined);

      await Promise.all(
        complaintIdsToFetch.map(async (complaintId) => {
          try {
            const response = await axios.get(
              `${API_BASE_URL}/hardware-logs/${complaintId}/reports`,
              { withCredentials: true }
            );
            const contents = response.data
              .map((r, i) => `Report ${i + 1}:\n${(r.content || "").trim()}`)
              .join("\n");
            setReportContents((prev) => ({
              ...prev,
              [complaintId]: contents || "No Reports",
            }));
          } catch (err) {
            // ignore
          }
        })
      );
    };
    fetchReportData();
  }, [hardwareLogs, API_BASE_URL, reportContents]);

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="hardware-log-container">
      <h2 className="hardware-log-heading">Lab Hardware</h2>
      <h3>Filters</h3>
      <div className="filter-section">
        {/* Filters */}
        <div className="filter-group">
          <label className="filter-label">Bank Name:</label>
          <input
            type="text"
            name="bankName"
            value={filters.bankName}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Bank Name"
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">Branch Name:</label>
          <input
            type="text"
            name="branchName"
            value={filters.branchName}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Branch Name"
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">Branch Code:</label>
          <input
            type="text"
            name="branchCode"
            value={filters.branchCode}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Branch Code"
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">City:</label>
          <input
            type="text"
            name="city"
            value={filters.city}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="City"
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">Complaint Status:</label>
          <select
            name="complaintStatus"
            value={filters.complaintStatus}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
          >
            {complaintStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status || "All Statuses"}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Courier Status:</label>
          <select
            name="courierStatus"
            value={filters.courierStatus}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
          >
            {courierStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status || "All"}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Worked Today By User:</label>
          <select
            name="workedTodayByUser"
            value={filters.workedTodayByUser}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
          >
            <option value="">All</option>
            <option value="qamar">qamar</option>
            <option value="salman">salman</option>
            <option value="osama">osama</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Hardware OK Date:</label>
          <input
            type="date"
            name="hOkDate"
            value={filters.hOkDate}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input date-filter"
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">Done:</label>
          <select
            name="done"
            value={filters.done || ""}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
          >
            <option value="">All</option>
            <option value="true">Done</option>
            <option value="false">Not Done</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Equipment:</label>
          <input
            type="text"
            name="equipmentDescription"
            value={filters.equipmentDescription}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
            placeholder="Equipment"
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">Lab Engineer:</label>
          <select
            name="labEngineer"
            value={filters.labEngineer}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKeyDown}
            className="filter-input"
          >
            <option value="">All</option>
            <option value="qamar">qamar</option>
            <option value="salman">salman</option>
            <option value="osama">osama</option>
          </select>
        </div>
        <div className="filter-group filter-checkbox-group">
          <label className="filter-label">
            <input
              type="checkbox"
              name="onlyFOCApproved"
              checked={filters.onlyFOCApproved}
              onChange={handleFilterChange}
              onKeyDown={handleFilterKeyDown}
              className="filter-checkbox"
            />
            Only FOC / Approved (Hardware Ready)
          </label>
        </div>
        <button className="search-filters" onClick={handleSearch}>
          Search
        </button>
        <button className="clear-filters" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      <div className="export-button-container">
        <button onClick={exportToExcel} className="generate-report">
          Generate Report
        </button>
      </div>

      <div className="table-wrapper">
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
                  <th>Update</th>
                  <th>Remarks</th>
                  <th>Complaint Status</th>
                  <th>Courier Status</th>
                  <th>DC Generated</th>
                  <th>Reports</th>
                  <th>Hardware Parts</th>
                  <th>Done</th>
                  <th>Lab Engineer</th>
                  <th>Bank Name</th>
                  <th>Branch Name</th>
                  <th>Branch Code</th>
                  <th>City</th>
                  <th>Equipment Description</th>
                  <th>Worked Today By</th>
                  <th>Hardware Ok Date</th>
                  <th>Complaint ID</th>
                  <th>History</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="19"
                      style={{ textAlign: "center", padding: "20px" }}
                    >
                      <Loader progress={progress} />
                    </td>
                  </tr>
                ) : hardwareLogs.length > 0 ? (
                  hardwareLogs.map((log, index) => {
                    const partKey = log.complaintLog?.id;
                    const parts = hardwarePartsByLog[partKey] || [];
                    const total = parts.length;
                    const repaired = parts.filter((p) => p.repaired).length;

                    return (
                      <tr
                        key={log.id}
                        onClick={() => handleRowClick(log.id)}
                        className={selectedRow === log.id ? "selected-row" : ""}
                      >
                        <td>
                          {index + 1 + (currentPage - 1) * recordsPerPage}
                        </td>
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
                        <td>
                          <button
                            className={`remark-button ${
                              remarksCounts[partKey] === undefined
                                ? "remark-button-loading"
                                : remarksCounts[partKey] > 0
                                ? "remark-button-green"
                                : "remark-button-red"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openRemarksModal(log.complaintLog);
                            }}
                            disabled={remarksCounts[partKey] === undefined}
                          >
                            {remarksCounts[partKey] === undefined
                              ? "Loading..."
                              : "Remarks"}
                            <span
                              className={`remarks-count ${
                                remarksCounts[partKey] > 0
                                  ? "remarks-count-green"
                                  : "remarks-count-red"
                              }`}
                            >
                              {remarksCounts[partKey] || 0}
                            </span>
                          </button>
                        </td>
                        <td
                          className={`status-cell ${getStatusClass(
                            log.complaintLog?.complaintStatus
                          )}`}
                        >
                          {log.complaintLog?.complaintStatus || "N/A"}
                        </td>
                        <td
                          className={`status-cell ${getStatusClass(
                            log.courierStatus
                          )}`}
                        >
                          {log.courierStatus || "N/A"}
                        </td>
                        <td>
                          {(log.complaintLog?.complaintStatus === "Approved" || log.complaintLog?.complaintStatus === "Pre Approved") &&
                            (log.complaintLog?.dcGenerated ? (
                              <span
                                className="dc-chip dc-on"
                                style={{ cursor: "not-allowed", opacity: 0.7 }}
                                title="DC Generated (not editable)"
                              >
                                DC Generated
                              </span>
                            ) : currentUsername === "khurram" ||
                              currentUserRole === "admin" ? (
                              <span
                                className="dc-chip dc-off"
                                onClick={() =>
                                  handleToggleDcGenerated(log, true)
                                }
                                style={{ cursor: "pointer" }}
                                title="Click to mark DC as generated"
                              >
                                Mark DC
                              </span>
                            ) : (
                              <span
                                className="dc-chip dc-off"
                                style={{ cursor: "not-allowed", opacity: 0.7 }}
                                title="Not Generated (not editable)"
                              >
                                Mark DC
                              </span>
                            ))}
                        </td>
                        <td>
                          <button
                            className={`view-report-button ${
                              reportAvailability[
                                log.complaintLog?.complaintId
                              ] === false
                                ? "grey-button"
                                : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              // pass BOTH complaintId and parts log id into the modal
                              openReportsForComplaint(
                                log.complaintLog?.complaintId,
                                partKey
                              );
                            }}
                          >
                            {reportAvailability[
                              log.complaintLog?.complaintId
                            ] === false
                              ? "No Reports"
                              : "View Reports"}
                          </button>
                        </td>

                        {/* Hardware Parts column now read-only preview (button moved to ReportModal) */}
                        <td>
                          {hardwarePartsByLog[partKey] === undefined ? (
                            <span
                              style={{
                                fontSize: 12,
                                color: "#aaa",
                              }}
                            >
                              Loading...
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 12,
                                color:
                                  total > 0 && repaired === total
                                    ? "green"
                                    : repaired > 0
                                    ? "orange"
                                    : "gray",
                                fontWeight:
                                  repaired === total && total > 0
                                    ? "bold"
                                    : "normal",
                              }}
                            >
                              {repaired}/{total} parts
                            </span>
                          )}

                          <div
                            className="inline-parts-list"
                            style={{
                              marginTop: 7,
                              fontSize: "0.98em",
                              fontWeight: 500,
                              maxWidth: 320,
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              display: "inline",
                            }}
                          >
                            {parts.length > 0 ? (
                              <>
                                {parts.slice(0, 2).map((part, idx) => (
                                  <span key={idx} style={{ marginRight: 10 }}>
                                    <b>{part.hardwareName}</b>{" "}
                                    {part.assignedEngineer}{" "}
                                    {part.notRepairable ? (
                                      <span
                                        style={{
                                          color: "#e01b24",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Not Repairable
                                      </span>
                                    ) : part.repaired ? (
                                      <span
                                        style={{
                                          color: "#14b014",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Repaired
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          color: "#d9a400",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Pending
                                      </span>
                                    )}
                                  </span>
                                ))}
                                {/* removed "+N more" click target since editing is now inside ReportModal */}
                                {parts.length > 2 && (
                                  <span
                                    style={{
                                      color: "#3498db",
                                      marginLeft: 5,
                                      fontWeight: 600,
                                    }}
                                  >
                                    +{parts.length - 2} more
                                  </span>
                                )}
                              </>
                            ) : (
                              <span>No Parts</span>
                            )}
                          </div>
                        </td>

                        <td>
                          {log.done ? (
                            <span
                              className="done-chip done-yes"
                              title="Marked as Done"
                            >
                              ✔ Done
                            </span>
                          ) : (
                            <span
                              className="done-chip done-no"
                              title="Not Done"
                            >
                              Not Done
                            </span>
                          )}
                        </td>
                        <td>{log.labEngineer}</td>
                        <td>{log.complaintLog?.bankName || "N/A"}</td>
                        <td>{log.complaintLog?.branchName || "N/A"}</td>
                        <td>{log.complaintLog?.branchCode || "N/A"}</td>
                        <td>{log.complaintLog?.city || "N/A"}</td>
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
                        <td>
                          {Object.entries(workedTodayByUser)
                            .filter(([user, ids]) =>
                              ids
                                .map(String)
                                .includes(String(log.complaintLog?.complaintId))
                            )
                            .map(([user]) => user)
                            .join(", ")}
                        </td>
                        <td>{log.hokDate || "N/A"}</td>
                        <td>{log.complaintLog?.complaintId || "N/A"}</td>
                        <td>
                          <button
                            className="view-history-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewHistory(log.complaintLog?.complaintId);
                            }}
                          >
                            View History
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="19" className="no-data">
                      No hardware logs available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
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
      <LabLogModal
        isOpen={isModalOpen}
        selectedLog={selectedLog}
        handleCloseModal={closeModal}
        refreshLogs={refreshLogs}
        complaintStatus={selectedLog?.complaintLog?.complaintStatus}
      />
      <ReportModal
        isOpen={isReportModalOpen}
        complaintId={selectedComplaintIdForReports}
        handleClose={closeReportModal}
        allowAdd
        onReportAdded={async (complaintId) => {
          // ✅ 1. Optimistically update UI (turn button green instantly)
          setReportAvailability((prev) => ({
            ...prev,
            [complaintId]: true,
          }));

          // ✅ 2. Keep existing behavior (reload worked-today state)
          reloadWorkedTodayByUser();

          // ✅ 3. Verify from backend in background (ensures correctness)
          try {
            const res = await axios.post(
              `${API_BASE_URL}/hardware-logs/reports/availability`,
              [complaintId],
              { withCredentials: true }
            );
            setReportAvailability((prev) => ({
              ...prev,
              ...res.data,
            }));
          } catch (err) {
            console.warn("Background refresh of report availability failed:", err);
          }
        }}
        /* NEW: provide parts context so ReportModal can manage parts */
        partsLogId={selectedPartsLogIdForReports}
        API_BASE_URL={API_BASE_URL}
        hardwareParts={
          selectedPartsLogIdForReports
            ? hardwarePartsByLog[selectedPartsLogIdForReports]
            : []
        }
        refreshParts={() => {
          if (selectedPartsLogIdForReports) {
            fetchPartsForLog(selectedPartsLogIdForReports);
          }
        }}
        /* Optional: pass bank/branch context if your HardwarePartsModal shows it */
        bankName={
          hardwareLogs.find(
            (l) => l.complaintLog?.id === selectedPartsLogIdForReports
          )?.complaintLog?.bankName
        }
        branchCode={
          hardwareLogs.find(
            (l) => l.complaintLog?.id === selectedPartsLogIdForReports
          )?.complaintLog?.branchCode
        }
        branchName={
          hardwareLogs.find(
            (l) => l.complaintLog?.id === selectedPartsLogIdForReports
          )?.complaintLog?.branchName
        }
        /* NEW: forward the city so only qamar can add parts when it's Karachi */
        complaintCity={
          hardwareLogs.find(
            (l) => l.complaintLog?.id === selectedPartsLogIdForReports
          )?.complaintLog?.city ??
          hardwareLogs.find(
            (l) => l.complaintLog?.id === selectedPartsLogIdForReports
          )?.complaintLog?.complaintCity
        }
      />

      {/* Keeping legacy parts modal wiring intact (not used anymore by the table) */}
      {showPartsModal && selectedComplaintIdForParts && (
        <HardwarePartsModal
          logId={selectedComplaintIdForParts}
          hardwareParts={hardwarePartsByLog[selectedComplaintIdForParts]}
          refreshParts={() => fetchPartsForLog(selectedComplaintIdForParts)}
          onClose={() => setShowPartsModal(false)}
          API_BASE_URL={API_BASE_URL}
          isOpen={showPartsModal}
          mode="lab"
          bankName={
            hardwareLogs.find(
              (l) => l.complaintLog?.id === selectedComplaintIdForParts
            )?.complaintLog?.bankName
          }
          branchCode={
            hardwareLogs.find(
              (l) => l.complaintLog?.id === selectedComplaintIdForParts
            )?.complaintLog?.branchCode
          }
          branchName={
            hardwareLogs.find(
              (l) => l.complaintLog?.id === selectedComplaintIdForParts
            )?.complaintLog?.branchName
          }
        />
      )}
    </div>
  );
};

export default Lab;
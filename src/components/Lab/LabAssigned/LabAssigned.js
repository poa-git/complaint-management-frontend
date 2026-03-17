import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import axios from "axios";
import LabLogModal from "../LabLogModal";
import ReportModal from "../ReportModal";
import ComplaintReport from "../../ComplaintReport/ComplaintReport";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "../Lab.css";
import "../../ComplaintDashboard/FilterSection/FilterSection.css";

const recordsPerPage = 50;
const maxVisiblePages = 5;

const currentUsername = (localStorage.getItem("username") || "User")
  .trim()
  .toLowerCase();
const currentUserRole = (localStorage.getItem("role") || "")
  .trim()
  .toLowerCase();

const getStatusClass = (status) => {
  switch (status?.toLowerCase()) {
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
    case "observation":
      return "status-observation";
    default:
      return "status-default";
  }
};

const InlineLoader = ({ text = "Loading..." }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      color: "#666",
      fontWeight: 500,
    }}
  >
    <span
      style={{
        width: 14,
        height: 14,
        border: "2px solid #d0d7de",
        borderTop: "2px solid #3498db",
        borderRadius: "50%",
        display: "inline-block",
        animation: "spin 0.8s linear infinite",
      }}
    />
    {text}
  </span>
);

const FullSectionLoader = ({ text = "Loading data..." }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: 220,
      width: "100%",
      flexDirection: "column",
      gap: 14,
    }}
  >
    <span
      style={{
        width: 34,
        height: 34,
        border: "4px solid #dfe6e9",
        borderTop: "4px solid #3498db",
        borderRadius: "50%",
        display: "inline-block",
        animation: "spin 0.8s linear infinite",
      }}
    />
    <span style={{ fontSize: 15, fontWeight: 600, color: "#555" }}>{text}</span>
  </div>
);

const LabAssigned = ({ openRemarksModal }) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const [viewMode, setViewMode] = useState("table");

  // -------------------- Table View States ------------------------
  const [allLogs, setAllLogs] = useState([]);
  const [hardwareLogs, setHardwareLogs] = useState([]);
  const [remarksCounts, setRemarksCounts] = useState({});
  const [reportAvailability, setReportAvailability] = useState({});
  const [reportContents, setReportContents] = useState({});
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workedTodayByUser, setWorkedTodayByUser] = useState({});
  const [selectedComplaintIdForReports, setSelectedComplaintIdForReports] =
    useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const previousLogCountRef = useRef(0);

  const [selectedPartsLogIdForReports, setSelectedPartsLogIdForReports] =
    useState(null);

  const [tooltipData, setTooltipData] = useState({
    content: "",
    position: { x: 0, y: 0 },
    isVisible: false,
  });

  const [filters, setFilters] = useState({
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
    hOkDate: "",
    onlyFOCApproved: false,
    workedTodayUser: "",
  });

  // -------------------- Per-Part View States ------------------------
  const [hardwareLogsParts, setHardwareLogsParts] = useState([]);
  const [hardwarePartsByLog, setHardwarePartsByLog] = useState({});
  const [partsFilters, setPartsFilters] = useState({
    bankName: "",
    branchCode: "",
    branchName: "",
    city: "",
    courierStatus: "",
    complaintStatus: "",
    equipmentDescription: "",
  });
  const [partsCurrentPage, setPartsCurrentPage] = useState(1);

  // -------------------- Loading States ------------------------
  const [tableLoading, setTableLoading] = useState(false);
  const [partsLoading, setPartsLoading] = useState(false);
  const [workedTodayLoading, setWorkedTodayLoading] = useState(false);
  const [exportingTable, setExportingTable] = useState(false);
  const [exportingParts, setExportingParts] = useState(false);
  const [openingReportFor, setOpeningReportFor] = useState(null);
  const [markingDoneId, setMarkingDoneId] = useState(null);
  const [dcUpdatingId, setDcUpdatingId] = useState(null);
  const [loadingPartsMap, setLoadingPartsMap] = useState({});
  const [reportAvailabilityLoading, setReportAvailabilityLoading] =
    useState(false);

  // -------------------- Notifications and Sound ----------------------
  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (viewMode === "table") {
      setWorkedTodayLoading(true);
      axios
        .get(`${API_BASE_URL}/hardware-logs/lab-user/reports-today`, {
          withCredentials: true,
        })
        .then((res) => setWorkedTodayByUser(res.data || {}))
        .catch(() => setWorkedTodayByUser({}))
        .finally(() => setWorkedTodayLoading(false));
    }
  }, [API_BASE_URL, viewMode]);

  const reloadWorkedTodayByUser = useCallback(() => {
    setWorkedTodayLoading(true);
    axios
      .get(`${API_BASE_URL}/hardware-logs/lab-user/reports-today`, {
        withCredentials: true,
      })
      .then((res) => setWorkedTodayByUser(res.data || {}))
      .catch(() => setWorkedTodayByUser({}))
      .finally(() => setWorkedTodayLoading(false));
  }, [API_BASE_URL]);

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

  // -------------------- Table View Data Fetch ------------------------
  const fetchHardwareLogs = useCallback(
    async (showLoader = true) => {
      if (showLoader) setTableLoading(true);

      try {
        const response = await axios.get(
          `${API_BASE_URL}/hardware-logs/assigned/${currentUsername}`,
          { withCredentials: true }
        );
        const logs = Array.isArray(response.data) ? response.data : [];
        setAllLogs(logs);

        const relevantLogs = logs.filter((log) => {
          if (
            log.complaintLog?.complaintStatus === "Closed" ||
            log.complaintLog?.complaintStatus === "Pending For Closed"
          ) {
            return false;
          }

          if (
            log.complaintLog?.city?.toLowerCase() === "karachi" &&
            log.courierStatus === "Received Outward"
          ) {
            if (log.complaintLog?.complaintStatus === "Approved") {
              return !log.complaintLog?.dcGenerated;
            } else {
              return false;
            }
          }

          if (
            log.courierStatus === "Received Outward" &&
            log.complaintLog?.city?.toLowerCase() !== "karachi"
          ) {
            return false;
          }

          if (log.done) return false;

          if (log.courierStatus === "Dispatch Outward") {
            if (log.complaintLog?.complaintStatus === "Approved") {
              return !log.complaintLog?.dcGenerated;
            } else {
              return false;
            }
          }

          const allowedStatuses = [
            "Dispatch Inward",
            "Received Inward",
            "Hardware Ready",
            "Additional Counter",
            "Dispatch Outward",
            "Observation",
          ];

          return allowedStatuses.includes(log.courierStatus);
        });

        if (relevantLogs.length > previousLogCountRef.current) {
          playNotificationSound();
          showNotification(
            "New Hardware Log",
            "A new hardware log has been detected!"
          );
        }

        previousLogCountRef.current = relevantLogs.length;
        setHardwareLogs(relevantLogs);
      } catch (error) {
        setAllLogs([]);
        setHardwareLogs([]);
      } finally {
        if (showLoader) setTableLoading(false);
      }
    },
    [API_BASE_URL, playNotificationSound, showNotification]
  );

  useEffect(() => {
    if (viewMode === "table") {
      fetchHardwareLogs(true);
      const interval = setInterval(() => fetchHardwareLogs(false), 120000);
      return () => clearInterval(interval);
    }
  }, [fetchHardwareLogs, viewMode]);

  // -------------------- Part View Data Fetch ------------------------
  const fetchHardwareLogsParts = useCallback(
    async (showLoader = true) => {
      if (showLoader) setPartsLoading(true);

      try {
        const response = await axios.get(
          `${API_BASE_URL}/hardware-logs/parts-assigned/${currentUsername}`,
          { withCredentials: true }
        );
        setHardwareLogsParts(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        setHardwareLogsParts([]);
      } finally {
        if (showLoader) setPartsLoading(false);
      }
    },
    [API_BASE_URL]
  );

  useEffect(() => {
    if (viewMode === "parts") {
      fetchHardwareLogsParts(true);
      const interval = setInterval(() => fetchHardwareLogsParts(false), 120000);
      return () => clearInterval(interval);
    }
  }, [fetchHardwareLogsParts, viewMode]);

  const fetchPartsForLog = useCallback(
    async (complaintLogId) => {
      if (!complaintLogId) return;

      setLoadingPartsMap((prev) => ({ ...prev, [complaintLogId]: true }));

      try {
        const res = await axios.get(
          `${API_BASE_URL}/hardware-logs/${complaintLogId}/parts`,
          { withCredentials: true }
        );
        setHardwarePartsByLog((prev) => ({
          ...prev,
          [complaintLogId]: Array.isArray(res.data) ? res.data : [],
        }));
      } catch (e) {
        setHardwarePartsByLog((prev) => ({
          ...prev,
          [complaintLogId]: [],
        }));
      } finally {
        setLoadingPartsMap((prev) => ({ ...prev, [complaintLogId]: false }));
      }
    },
    [API_BASE_URL]
  );

  useEffect(() => {
    if (viewMode !== "parts") return;

    hardwareLogsParts.forEach((log) => {
      const partKey = log.complaintLog?.id;
      if (partKey && hardwarePartsByLog[partKey] === undefined) {
        fetchPartsForLog(partKey);
      }
    });
  }, [hardwareLogsParts, hardwarePartsByLog, fetchPartsForLog, viewMode]);

  // -------------------- Report availability ------------------------
  useEffect(() => {
    const fetchReportStatus = async () => {
      const ids = [
        ...new Set(
          [
            ...hardwareLogs.map((l) => l.complaintLog?.complaintId),
            ...hardwareLogsParts.map((l) => l.complaintLog?.complaintId),
          ].filter(Boolean)
        ),
      ].filter((id) => reportAvailability[id] === undefined);

      if (ids.length === 0) return;

      setReportAvailabilityLoading(true);
      try {
        const res = await axios.post(
          `${API_BASE_URL}/hardware-logs/reports/availability`,
          ids,
          { withCredentials: true }
        );
        setReportAvailability((prev) => ({ ...prev, ...res.data }));
      } catch (e) {
        // silent
      } finally {
        setReportAvailabilityLoading(false);
      }
    };

    fetchReportStatus();
  }, [API_BASE_URL, hardwareLogs, hardwareLogsParts, reportAvailability]);

  // -------------------- Filter Options ------------------------
  const bankOptions = useMemo(() => {
    const setVals = new Set();
    const logs = viewMode === "table" ? hardwareLogs : hardwareLogsParts;
    logs.forEach((log) => {
      if (log.complaintLog?.bankName) setVals.add(log.complaintLog.bankName);
    });
    return ["", ...Array.from(setVals)];
  }, [hardwareLogs, hardwareLogsParts, viewMode]);

  const cityOptions = useMemo(() => {
    const setVals = new Set();
    const logs = viewMode === "table" ? hardwareLogs : hardwareLogsParts;
    logs.forEach((log) => {
      if (log.complaintLog?.city) setVals.add(log.complaintLog.city);
    });
    return ["", ...Array.from(setVals)];
  }, [hardwareLogs, hardwareLogsParts, viewMode]);

  const courierStatusOptions = useMemo(() => {
    const setVals = new Set();
    const logs = viewMode === "table" ? hardwareLogs : hardwareLogsParts;
    logs.forEach((log) => {
      if (log.courierStatus) setVals.add(log.courierStatus);
    });
    return ["", ...Array.from(setVals)];
  }, [hardwareLogs, hardwareLogsParts, viewMode]);

  const complaintStatusOptions = useMemo(() => {
    const setVals = new Set();
    const logs = viewMode === "table" ? hardwareLogs : hardwareLogsParts;
    logs.forEach((log) => {
      if (log.complaintLog?.complaintStatus) {
        setVals.add(log.complaintLog.complaintStatus);
      }
    });
    return ["", ...Array.from(setVals)];
  }, [hardwareLogs, hardwareLogsParts, viewMode]);

  // -------------------- Filtering: Table View ------------------------
  const userFilteredLogs = useMemo(() => {
    if (viewMode !== "table") return [];

    return hardwareLogs.filter((log) => {
      const {
        bankName,
        branchName,
        branchCode,
        city,
        courierStatus,
        complaintStatus,
        staff,
        dispatchInwardDate,
        receivedInwardDate,
        equipmentDescription,
        dispatchCnNumber,
        hOkDate,
        onlyFOCApproved,
      } = filters;

      const diDate = log.dispatchInwardDate
        ? new Date(log.dispatchInwardDate)
        : null;
      const riDate = log.receivedInwardDate
        ? new Date(log.receivedInwardDate)
        : null;
      const hDate = log.hOkDate ? new Date(log.hOkDate) : null;

      const isSameDate = (logDate, filterDate) => {
        if (!filterDate) return true;
        if (!logDate) return false;
        return logDate.toISOString().slice(0, 10) === filterDate;
      };

      if (
        bankName &&
        (log.complaintLog?.bankName || "").toLowerCase() !==
          bankName.toLowerCase()
      )
        return false;

      if (
        branchName &&
        !(log.complaintLog?.branchName || "")
          .toLowerCase()
          .includes(branchName.toLowerCase())
      )
        return false;

      if (
        city &&
        (log.complaintLog?.city || "").toLowerCase() !== city.toLowerCase()
      )
        return false;

      if (filters.workedTodayUser) {
        const userIds = workedTodayByUser[filters.workedTodayUser] || [];
        if (!userIds.map(String).includes(String(log.complaintLog?.complaintId)))
          return false;
      }

      if (
        courierStatus &&
        (log.courierStatus || "").toLowerCase() !== courierStatus.toLowerCase()
      )
        return false;

      if (
        complaintStatus &&
        (log.complaintLog?.complaintStatus || "").toLowerCase() !==
          complaintStatus.toLowerCase()
      )
        return false;

      if (
        equipmentDescription &&
        !(log.equipmentDescription || "")
          .toLowerCase()
          .includes(equipmentDescription.toLowerCase())
      )
        return false;

      if (staff && (log.staff || "").toLowerCase() !== staff.toLowerCase()) {
        return false;
      }

      if (
        dispatchCnNumber &&
        !(log.dispatchCnNumber || "")
          .toLowerCase()
          .includes(dispatchCnNumber.toLowerCase())
      )
        return false;

      if (
        branchCode &&
        !(log.complaintLog?.branchCode || "")
          .toLowerCase()
          .includes(branchCode.toLowerCase())
      )
        return false;

      if (!isSameDate(diDate, dispatchInwardDate)) return false;
      if (!isSameDate(riDate, receivedInwardDate)) return false;
      if (!isSameDate(hDate, hOkDate)) return false;

      if (onlyFOCApproved) {
        const isFOCOrApproved =
          log.complaintLog?.complaintStatus === "FOC" ||
          log.complaintLog?.complaintStatus === "Approved";

        const isHardwareReadyOrDispatchOutward =
          log.courierStatus === "Hardware Ready" ||
          log.courierStatus === "Dispatch Outward" ||
          log.courierStatus === "Received Outward";

        if (!(isFOCOrApproved && isHardwareReadyOrDispatchOutward)) {
          return false;
        }
      }

      return true;
    });
  }, [hardwareLogs, filters, workedTodayByUser, viewMode]);

  // -------------------- Filtering: Parts View ------------------------
  const filteredLogsParts = useMemo(() => {
    if (viewMode !== "parts") return [];

    return hardwareLogsParts.filter((log) => {
      const partKey = log.complaintLog?.id;
      const parts = hardwarePartsByLog[partKey] || [];

      const {
        bankName,
        branchName,
        branchCode,
        city,
        courierStatus,
        complaintStatus,
        equipmentDescription,
      } = partsFilters;

      if (
        bankName &&
        (log.complaintLog?.bankName || "").toLowerCase() !==
          bankName.toLowerCase()
      )
        return false;

      if (
        branchName &&
        !(log.complaintLog?.branchName || "")
          .toLowerCase()
          .includes(branchName.toLowerCase())
      )
        return false;

      if (
        branchCode &&
        !(log.complaintLog?.branchCode || "")
          .toLowerCase()
          .includes(branchCode.toLowerCase())
      )
        return false;

      if (
        city &&
        (log.complaintLog?.city || "").toLowerCase() !== city.toLowerCase()
      )
        return false;

      if (
        complaintStatus &&
        (log.complaintLog?.complaintStatus || "").toLowerCase() !==
          complaintStatus.toLowerCase()
      )
        return false;

      if (
        courierStatus &&
        (log.courierStatus || "").toLowerCase() !== courierStatus.toLowerCase()
      )
        return false;

      if (
        equipmentDescription &&
        !(log.equipmentDescription || "")
          .toLowerCase()
          .includes(equipmentDescription.toLowerCase())
      )
        return false;

      return parts.some(
        (p) =>
          p.assignedEngineer?.trim().toLowerCase() === currentUsername &&
          !p.repaired &&
          !p.notRepairable
      );
    });
  }, [hardwareLogsParts, hardwarePartsByLog, partsFilters, viewMode]);

  // -------------------- Pagination ------------------------
  const tableTotalPages = useMemo(() => {
    return Math.ceil(userFilteredLogs.length / recordsPerPage);
  }, [userFilteredLogs.length]);

  const tableCurrentRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * recordsPerPage;
    return userFilteredLogs.slice(startIndex, startIndex + recordsPerPage);
  }, [userFilteredLogs, currentPage]);

  const partsTotalPages = useMemo(() => {
    return Math.ceil(filteredLogsParts.length / recordsPerPage);
  }, [filteredLogsParts.length]);

  const partsCurrentRecords = useMemo(() => {
    const startIndex = (partsCurrentPage - 1) * recordsPerPage;
    return filteredLogsParts.slice(startIndex, startIndex + recordsPerPage);
  }, [filteredLogsParts, partsCurrentPage]);

  const getVisiblePages = (totalPages, currPage) => {
    const pages = [];
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currPage - half);
    let end = Math.min(totalPages, currPage + half);

    if (currPage <= half) end = Math.min(totalPages, maxVisiblePages);
    if (currPage > totalPages - half) {
      start = Math.max(1, totalPages - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  // -------------------- Export to Excel ------------------------
  const exportToExcelTable = async () => {
    setExportingTable(true);
    try {
      const complaintIdsToFetch = userFilteredLogs
        .map((log) => log.complaintLog?.complaintId)
        .filter((id) => id && reportContents[id] === undefined);

      const fetchedReports = {};

      await Promise.all(
        complaintIdsToFetch.map(async (complaintId) => {
          try {
            const response = await axios.get(
              `${API_BASE_URL}/hardware-logs/${complaintId}/reports`,
              { withCredentials: true }
            );
            const contents = response.data
              .map((r, i) => `Report ${i + 1}:\n${r.content.trim()}`)
              .join("\n\n");
            fetchedReports[complaintId] = contents || "No Reports";
          } catch (err) {
            fetchedReports[complaintId] = "No Reports";
          }
        })
      );

      if (Object.keys(fetchedReports).length > 0) {
        setReportContents((prev) => ({ ...prev, ...fetchedReports }));
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Lab Report");

      worksheet.columns = [
        { header: "S.No", key: "s_no", width: 10 },
        { header: "Complaint Status", key: "complaint_status", width: 20 },
        { header: "Courier Status", key: "courier_status", width: 20 },
        { header: "DC Generated", key: "dc_generated", width: 20 },
        { header: "Reports", key: "reports", width: 40 },
        { header: "Bank Name", key: "bank_name", width: 20 },
        { header: "Branch Name", key: "branch_name", width: 20 },
        { header: "Branch Code", key: "branch_code", width: 15 },
        { header: "City", key: "city", width: 15 },
        { header: "CN No.", key: "cn_no", width: 15 },
        {
          header: "Dispatch Inward Date",
          key: "dispatch_inward_date",
          width: 25,
        },
        {
          header: "Received Inward Date",
          key: "received_inward_date",
          width: 25,
        },
        {
          header: "Equipment Description",
          key: "equipment_description",
          width: 30,
        },
        { header: "Worked Today", key: "worked_today", width: 18 },
        { header: "Extra Hardware", key: "extra_hardware", width: 25 },
        { header: "Complaint ID", key: "complaint_id", width: 20 },
      ];

      worksheet.getRow(1).eachCell((cell) => {
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.font = { bold: true };
      });

      const cleanText = (text) => {
        if (!text) return "No Reports";
        return text.replace(/\n+/g, " • ").replace(/\s+/g, " ").trim();
      };

      userFilteredLogs.forEach((log, index) => {
        const currentReportContents = {
          ...reportContents,
          ...fetchedReports,
        };

        const reportContent = cleanText(
          currentReportContents[log.complaintLog?.complaintId] || "No Reports"
        );

        const workedByUsers = Object.entries(workedTodayByUser)
          .filter(([user, ids]) =>
            ids.map(String).includes(String(log.complaintLog?.complaintId))
          )
          .map(([user]) => user)
          .join(", ");

        const row = worksheet.addRow({
          s_no: index + 1,
          complaint_status: log.complaintLog?.complaintStatus || "N/A",
          courier_status: log.courierStatus || "N/A",
          dc_generated: log.complaintLog?.dcGenerated ? "YES" : "NO",
          reports: reportContent,
          bank_name: log.complaintLog?.bankName || "N/A",
          branch_name: log.complaintLog?.branchName || "N/A",
          branch_code: log.complaintLog?.branchCode || "N/A",
          city: log.complaintLog?.city || "N/A",
          cn_no: log.receivingCnNumber || "N/A",
          dispatch_inward_date: log.dispatchInwardDate || "N/A",
          received_inward_date: log.receivedInwardDate || "N/A",
          equipment_description: log.equipmentDescription || "N/A",
          worked_today: workedByUsers || "NO",
          extra_hardware: log.extraHardware || "N/A",
          complaint_id: log.complaintLog?.complaintId || "N/A",
        });

        row.eachCell((cell) => {
          cell.alignment = {
            wrapText: true,
            vertical: "middle",
            horizontal: "center",
          };
        });
      });

      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex > 1) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: rowIndex % 2 === 0 ? "DCE6F1" : "FFFFFF" },
            };
          });
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), "LabReport.xlsx");
    } catch (error) {
      alert("Failed to export table report.");
    } finally {
      setExportingTable(false);
    }
  };

  const exportToExcelParts = async () => {
    setExportingParts(true);
    try {
      const complaintIdsToFetch = filteredLogsParts
        .map((log) => log.complaintLog?.complaintId)
        .filter((id) => id && reportContents[id] === undefined);

      const fetchedReports = {};

      await Promise.all(
        complaintIdsToFetch.map(async (complaintId) => {
          try {
            const response = await axios.get(
              `${API_BASE_URL}/hardware-logs/${complaintId}/reports`,
              { withCredentials: true }
            );
            const contents = response.data
              .map((r, i) => `Report ${i + 1}:\n${r.content.trim()}`)
              .join("\n\n");
            fetchedReports[complaintId] = contents || "No Reports";
          } catch (err) {
            fetchedReports[complaintId] = "No Reports";
          }
        })
      );

      if (Object.keys(fetchedReports).length > 0) {
        setReportContents((prev) => ({ ...prev, ...fetchedReports }));
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Lab Report");

      worksheet.columns = [
        { header: "S.No", key: "s_no", width: 8 },
        { header: "Complaint ID", key: "complaint_id", width: 15 },
        { header: "Status", key: "complaint_status", width: 18 },
        { header: "Courier Status", key: "courier_status", width: 18 },
        { header: "Bank Name", key: "bank_name", width: 18 },
        { header: "Branch Name", key: "branch_name", width: 18 },
        { header: "Branch Code", key: "branch_code", width: 12 },
        { header: "City", key: "city", width: 15 },
        { header: "Equipment", key: "equipment_description", width: 20 },
        { header: "Reports", key: "reports", width: 40 },
      ];

      worksheet.getRow(1).eachCell((cell) => {
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.font = { bold: true };
      });

      const cleanText = (text) =>
        (text || "No Reports")
          .replace(/\n+/g, " • ")
          .replace(/\s+/g, " ")
          .trim();

      filteredLogsParts.forEach((log, index) => {
        const currentReportContents = {
          ...reportContents,
          ...fetchedReports,
        };

        worksheet.addRow({
          s_no: index + 1,
          complaint_id: log.complaintLog?.complaintId || "N/A",
          complaint_status: log.complaintLog?.complaintStatus || "N/A",
          courier_status: log.courierStatus || "N/A",
          bank_name: log.complaintLog?.bankName || "N/A",
          branch_name: log.complaintLog?.branchName || "N/A",
          branch_code: log.complaintLog?.branchCode || "N/A",
          city: log.complaintLog?.city || "N/A",
          equipment_description: log.equipmentDescription || "N/A",
          reports: cleanText(
            currentReportContents[log.complaintLog?.complaintId] || "No Reports"
          ),
        });
      });

      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex > 1) {
          row.eachCell((cell) => {
            cell.alignment = {
              wrapText: true,
              vertical: "middle",
              horizontal: "center",
            };
          });
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), "LabAssigned.xlsx");
    } catch (error) {
      alert("Failed to export parts report.");
    } finally {
      setExportingParts(false);
    }
  };

  // -------------------- Other Handlers ------------------------
  const handleMarkDone = async (log) => {
    setMarkingDoneId(log.id);
    try {
      await axios.patch(
        `${API_BASE_URL}/hardware-logs/${log.id}/done`,
        { done: true },
        { withCredentials: true }
      );
      setHardwareLogs((prev) => prev.filter((l) => l.id !== log.id));
    } catch (error) {
      alert("Failed to mark as done: " + error.message);
    } finally {
      setMarkingDoneId(null);
    }
  };

  const handleToggleDcGenerated = async (log, newValue) => {
    setDcUpdatingId(log.id);
    try {
      await axios.patch(
        `${API_BASE_URL}/complaints/${log.complaintLog.id}/dc-generated`,
        { dcGenerated: newValue },
        { withCredentials: true }
      );
      await fetchHardwareLogs(false);
    } catch (err) {
      alert("Failed to update DC Generated status: " + err.message);
    } finally {
      setDcUpdatingId(null);
    }
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
    fetchHardwareLogs(false);
  };

  const getLogByPartId = useCallback(
    (partId) =>
      hardwareLogs.find((l) => l.complaintLog?.id === partId) ||
      hardwareLogsParts.find((l) => l.complaintLog?.id === partId),
    [hardwareLogs, hardwareLogsParts]
  );

  const openReportsForComplaint = async (complaintId, partsLogId) => {
    setOpeningReportFor(complaintId);
    try {
      setSelectedComplaintIdForReports(complaintId);
      setSelectedPartsLogIdForReports(partsLogId || null);

      if (partsLogId) {
        await fetchPartsForLog(partsLogId);
      }

      setIsReportModalOpen(true);
    } finally {
      setOpeningReportFor(null);
    }
  };

  const closeReportModal = () => {
    setSelectedComplaintIdForReports(null);
    setSelectedPartsLogIdForReports(null);
    setIsReportModalOpen(false);
  };

  const handleViewHistory = (complaintId) => {
    setSelectedComplaintId(complaintId);
  };

  const handleBackToTable = () => setSelectedComplaintId(null);

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

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setCurrentPage(1);
  };

  const clearFilters = useCallback(() => {
    setFilters({
      bankName: "",
      branchCode: "",
      branchName: "",
      city: "",
      courierStatus: "",
      complaintStatus: "",
      staff: "",
      dispatchInwardDate: "",
      receivedInwardDate: "",
      equipmentDescription: "",
      dispatchCnNumber: "",
      hOkDate: "",
      onlyFOCApproved: false,
      workedTodayUser: "",
    });
    setCurrentPage(1);
  }, []);

  const handlePartsFilterChange = (e) => {
    const { name, value } = e.target;
    setPartsFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
    setPartsCurrentPage(1);
  };

  return (
    <div className="hardware-log-container">
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .loading-button {
            opacity: 0.8;
            cursor: not-allowed !important;
            pointer-events: none;
          }
        `}
      </style>

      <div className="lab-toggle-switch">
        <input
          type="radio"
          id="view-table"
          name="labview"
          checked={viewMode === "table"}
          onChange={() => setViewMode("table")}
          hidden
        />
        <input
          type="radio"
          id="view-parts"
          name="labview"
          checked={viewMode === "parts"}
          onChange={() => setViewMode("parts")}
          hidden
        />
        <label
          htmlFor="view-table"
          className={`lab-toggle-option ${
            viewMode === "table" ? "active" : ""
          }`}
        >
          Lab Hardware Table View
        </label>
        <label
          htmlFor="view-parts"
          className={`lab-toggle-option ${
            viewMode === "parts" ? "active" : ""
          }`}
        >
          Assigned Hardware Logs (Per Part)
        </label>
        <span className={`lab-toggle-slider ${viewMode}`}></span>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <>
          <h2 className="hardware-log-heading">Lab Hardware</h2>
          <h3>Filters</h3>

          <div className="filter-section">
            <div className="filter-group">
              <label className="filter-label">Bank Name:</label>
              <select
                name="bankName"
                value={filters.bankName}
                onChange={handleFilterChange}
                className="filter-input"
              >
                {bankOptions.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank || "All Banks"}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Branch Name:</label>
              <input
                type="text"
                name="branchName"
                value={filters.branchName}
                onChange={handleFilterChange}
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
                className="filter-input"
                placeholder="Branch Code"
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">City:</label>
              <select
                name="city"
                value={filters.city}
                onChange={handleFilterChange}
                className="filter-input"
              >
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c || "All Cities"}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Complaint Status:</label>
              <select
                name="complaintStatus"
                value={filters.complaintStatus}
                onChange={handleFilterChange}
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
              <label className="filter-label">CN Number:</label>
              <input
                type="text"
                name="dispatchCnNumber"
                value={filters.dispatchCnNumber}
                onChange={handleFilterChange}
                className="filter-input"
                placeholder="Enter CN Number"
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Dispatch Inward Date:</label>
              <input
                type="date"
                name="dispatchInwardDate"
                value={filters.dispatchInwardDate}
                onChange={handleFilterChange}
                className="filter-input date-filter"
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Received Inward Date:</label>
              <input
                type="date"
                name="receivedInwardDate"
                value={filters.receivedInwardDate}
                onChange={handleFilterChange}
                className="filter-input date-filter"
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Hardware OK Date:</label>
              <input
                type="date"
                name="hOkDate"
                value={filters.hOkDate}
                onChange={handleFilterChange}
                className="filter-input date-filter"
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Equipment:</label>
              <input
                type="text"
                name="equipmentDescription"
                value={filters.equipmentDescription}
                onChange={handleFilterChange}
                className="filter-input"
                placeholder="Partial match"
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Worked Today By User:</label>
              <select
                name="workedTodayUser"
                value={filters.workedTodayUser}
                onChange={handleFilterChange}
                className="filter-input"
                disabled={workedTodayLoading}
              >
                <option value="">
                  {workedTodayLoading ? "Loading users..." : "All Users"}
                </option>
                {Object.keys(workedTodayByUser).map((user) => (
                  <option key={user} value={user}>
                    {user}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group filter-checkbox-group">
              <label className="filter-label">
                <input
                  type="checkbox"
                  name="onlyFOCApproved"
                  checked={filters.onlyFOCApproved}
                  onChange={handleFilterChange}
                  className="filter-checkbox"
                />
                Only FOC / Approved (Hardware Ready)
              </label>
            </div>

            <button className="clear-filters" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>

          <div className="export-button-container">
            <button
              onClick={exportToExcelTable}
              className={`generate-report ${exportingTable ? "loading-button" : ""}`}
              disabled={exportingTable || tableLoading}
            >
              {exportingTable ? "Generating Excel..." : "Generate Report"}
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
            ) : tableLoading ? (
              <FullSectionLoader text="Loading hardware logs..." />
            ) : (
              <>
                <table className="complaint-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Update</th>
                      <th>Done</th>
                      <th>Complaint Status</th>
                      <th>Courier Status</th>
                      <th>DC Generated</th>
                      <th>Reports</th>
                      <th>Bank Name</th>
                      <th>Branch Name</th>
                      <th>Branch Code</th>
                      <th>City</th>
                      <th>Equipment Description</th>
                      <th>Extra Hardware</th>
                      <th>Worked Today</th>
                      <th>Complaint ID</th>
                      <th>History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableCurrentRecords.length > 0 ? (
                      tableCurrentRecords.map((log, index) => (
                        <tr
                          key={log.id}
                          onClick={() =>
                            setSelectedRow((prevSelectedRow) =>
                              prevSelectedRow === log.id ? null : log.id
                            )
                          }
                          className={
                            selectedRow === log.id ? "selected-row" : ""
                          }
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
                            {!log.done && (
                              <button
                                className={`done-button ${
                                  markingDoneId === log.id ? "loading-button" : ""
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkDone(log);
                                }}
                                disabled={markingDoneId === log.id}
                              >
                                {markingDoneId === log.id ? "Processing..." : "Done"}
                              </button>
                            )}
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
                            {log.complaintLog?.complaintStatus === "Approved" &&
                              (log.complaintLog?.dcGenerated ? (
                                <span
                                  className="dc-chip dc-on"
                                  style={{
                                    cursor: "not-allowed",
                                    opacity: 0.7,
                                  }}
                                  title="DC Generated (not editable)"
                                >
                                  DC Generated
                                </span>
                              ) : currentUsername === "khurram" ||
                                currentUserRole === "admin" ? (
                                <span
                                  className="dc-chip dc-off"
                                  onClick={() =>
                                    dcUpdatingId !== log.id &&
                                    handleToggleDcGenerated(log, true)
                                  }
                                  style={{
                                    cursor:
                                      dcUpdatingId === log.id
                                        ? "not-allowed"
                                        : "pointer",
                                    opacity: dcUpdatingId === log.id ? 0.7 : 1,
                                  }}
                                  title="Click to mark DC as generated"
                                >
                                  {dcUpdatingId === log.id
                                    ? "Updating..."
                                    : "Mark DC"}
                                </span>
                              ) : (
                                <span
                                  className="dc-chip dc-off"
                                  style={{
                                    cursor: "not-allowed",
                                    opacity: 0.7,
                                  }}
                                  title="Not Generated (not editable)"
                                >
                                  Mark DC
                                </span>
                              ))}
                          </td>

                          <td>
                            <button
                              className={`view-report-button ${
                                reportAvailability[log.complaintLog?.complaintId] ===
                                false
                                  ? "grey-button"
                                  : ""
                              } ${
                                openingReportFor === log.complaintLog?.complaintId
                                  ? "loading-button"
                                  : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openReportsForComplaint(
                                  log.complaintLog?.complaintId,
                                  log.complaintLog?.id
                                );
                              }}
                              disabled={
                                openingReportFor === log.complaintLog?.complaintId
                              }
                            >
                              {openingReportFor === log.complaintLog?.complaintId
                                ? "Opening..."
                                : reportAvailability[log.complaintLog?.complaintId] ===
                                  false
                                ? "No Reports"
                                : reportAvailabilityLoading &&
                                  reportAvailability[log.complaintLog?.complaintId] ===
                                    undefined
                                ? "Checking..."
                                : "View Reports"}
                            </button>
                          </td>

                          <td>{log.complaintLog?.bankName || "N/A"}</td>
                          <td>{log.complaintLog?.branchName || "N/A"}</td>
                          <td>{log.complaintLog?.branchCode || "N/A"}</td>
                          <td>{log.complaintLog?.city || "N/A"}</td>

                          <td>
                            <div
                              className="tooltip-container"
                              onMouseEnter={(e) =>
                                showTooltip(
                                  e,
                                  log.equipmentDescription || "N/A"
                                )
                              }
                              onMouseLeave={hideTooltip}
                            >
                              <span className="truncate-text">
                                {log.equipmentDescription || "N/A"}
                              </span>
                            </div>
                          </td>

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

                          <td>
                            {workedTodayLoading ? (
                              <span style={{ color: "#888", fontSize: 12 }}>
                                Loading...
                              </span>
                            ) : (
                              Object.entries(workedTodayByUser)
                                .filter(([user, ids]) =>
                                  ids
                                    .map(String)
                                    .includes(
                                      String(log.complaintLog?.complaintId)
                                    )
                                )
                                .map(([user]) => user)
                                .join(", ")
                            )}
                          </td>

                          <td>{log.complaintLog?.complaintId || "N/A"}</td>

                          <td>
                            <button
                              className="view-history-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewHistory(
                                  log.complaintLog?.complaintId
                                );
                              }}
                            >
                              View History
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="16" className="no-data">
                          No hardware logs available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

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
              </>
            )}
          </div>

          {!tableLoading && userFilteredLogs.length > 0 && (
            <div className="pagination-container">
              <button
                className="page-button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                &lt;
              </button>

              {getVisiblePages(tableTotalPages, currentPage).map((page) => (
                <button
                  key={page}
                  className={`page-button ${
                    currentPage === page ? "active" : ""
                  }`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}

              <button
                className="page-button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(tableTotalPages, p + 1))
                }
                disabled={currentPage === tableTotalPages}
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
              setReportAvailability((prev) => ({
                ...prev,
                [complaintId]: true,
              }));

              reloadWorkedTodayByUser();

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
              } catch {}
            }}
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
            bankName={
              getLogByPartId(selectedPartsLogIdForReports)?.complaintLog
                ?.bankName
            }
            branchCode={
              getLogByPartId(selectedPartsLogIdForReports)?.complaintLog
                ?.branchCode
            }
            branchName={
              getLogByPartId(selectedPartsLogIdForReports)?.complaintLog
                ?.branchName
            }
          />
        </>
      )}

      {/* Parts View */}
      {viewMode === "parts" && (
        <>
          <h2 className="hardware-log-heading">
            Assigned Hardware Logs (Per Part)
          </h2>

          <div className="filter-section">
            <div className="filter-group">
              <label className="filter-label">Bank Name:</label>
              <select
                name="bankName"
                value={partsFilters.bankName}
                onChange={handlePartsFilterChange}
                className="filter-input"
              >
                {bankOptions.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank || "All Banks"}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Branch Name:</label>
              <input
                type="text"
                name="branchName"
                value={partsFilters.branchName}
                onChange={handlePartsFilterChange}
                className="filter-input"
                placeholder="Branch Name"
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Branch Code:</label>
              <input
                type="text"
                name="branchCode"
                value={partsFilters.branchCode}
                onChange={handlePartsFilterChange}
                className="filter-input"
                placeholder="Branch Code"
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">City:</label>
              <select
                name="city"
                value={partsFilters.city}
                onChange={handlePartsFilterChange}
                className="filter-input"
              >
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c || "All Cities"}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Complaint Status:</label>
              <select
                name="complaintStatus"
                value={partsFilters.complaintStatus}
                onChange={handlePartsFilterChange}
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
                value={partsFilters.courierStatus}
                onChange={handlePartsFilterChange}
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
              <label className="filter-label">Equipment:</label>
              <input
                type="text"
                name="equipmentDescription"
                value={partsFilters.equipmentDescription}
                onChange={handlePartsFilterChange}
                className="filter-input"
                placeholder="Partial match"
              />
            </div>

            <button
              className={`generate-report ${exportingParts ? "loading-button" : ""}`}
              style={{ marginLeft: 20 }}
              onClick={exportToExcelParts}
              disabled={exportingParts || partsLoading}
            >
              {exportingParts ? "Generating Excel..." : "Generate Report (Excel)"}
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
            ) : partsLoading ? (
              <FullSectionLoader text="Loading assigned parts logs..." />
            ) : (
              <table className="complaint-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Status</th>
                    <th>Courier Status</th>
                    <th>Bank Name</th>
                    <th>Branch Name</th>
                    <th>Branch Code</th>
                    <th>City</th>
                    <th>Equipment</th>
                    <th>Reports</th>
                    <th>Parts</th>
                    <th>Complaint ID</th>
                    <th>History</th>
                  </tr>
                </thead>
                <tbody>
                  {partsCurrentRecords.length > 0 ? (
                    partsCurrentRecords.map((log, idx) => {
                      const partKey = log.complaintLog?.id;
                      const parts = hardwarePartsByLog[partKey] || [];
                      const total = parts.length;
                      const repaired = parts.filter((p) => p.repaired).length;
                      const isPartsLoading = loadingPartsMap[partKey];

                      return (
                        <tr key={log.id}>
                          <td>
                            {idx + 1 + (partsCurrentPage - 1) * recordsPerPage}
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

                          <td>{log.complaintLog?.bankName || "N/A"}</td>
                          <td>{log.complaintLog?.branchName || "N/A"}</td>
                          <td>{log.complaintLog?.branchCode || "N/A"}</td>
                          <td>{log.complaintLog?.city || "N/A"}</td>
                          <td>{log.equipmentDescription || "N/A"}</td>

                          <td>
                            <button
                              className={`view-report-button ${
                                reportAvailability[log.complaintLog?.complaintId] ===
                                false
                                  ? "grey-button"
                                  : ""
                              } ${
                                openingReportFor === log.complaintLog?.complaintId
                                  ? "loading-button"
                                  : ""
                              }`}
                              onClick={() =>
                                openReportsForComplaint(
                                  log.complaintLog?.complaintId,
                                  partKey
                                )
                              }
                              disabled={
                                openingReportFor === log.complaintLog?.complaintId
                              }
                            >
                              {openingReportFor === log.complaintLog?.complaintId
                                ? "Opening..."
                                : reportAvailability[log.complaintLog?.complaintId] ===
                                  false
                                ? "No Reports"
                                : reportAvailabilityLoading &&
                                  reportAvailability[log.complaintLog?.complaintId] ===
                                    undefined
                                ? "Checking..."
                                : "View Reports"}
                            </button>
                          </td>

                          <td>
                            {isPartsLoading ? (
                              <InlineLoader text="Loading parts..." />
                            ) : (
                              <>
                                {(() => {
                                  let color = "gray";
                                  if (total > 0 && repaired === total)
                                    color = "green";
                                  else if (repaired > 0) color = "orange";

                                  return (
                                    <span
                                      style={{
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
                                  );
                                })()}

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
                                      {parts.slice(0, 2).map((part, idx2) => (
                                        <span
                                          key={idx2}
                                          style={{ marginRight: 10 }}
                                        >
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
                              </>
                            )}
                          </td>

                          <td>{log.complaintLog?.complaintId || "N/A"}</td>

                          <td>
                            <button
                              className="view-history-button"
                              onClick={() =>
                                handleViewHistory(log.complaintLog?.complaintId)
                              }
                            >
                              View History
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={12} className="no-data">
                        No hardware logs assigned with unrepaired parts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {!partsLoading && filteredLogsParts.length > 0 && (
            <div className="pagination-container">
              <button
                className="page-button"
                onClick={() => setPartsCurrentPage((p) => Math.max(1, p - 1))}
                disabled={partsCurrentPage === 1}
              >
                &lt;
              </button>

              {getVisiblePages(partsTotalPages, partsCurrentPage).map((page) => (
                <button
                  key={page}
                  className={`page-button ${
                    partsCurrentPage === page ? "active" : ""
                  }`}
                  onClick={() => setPartsCurrentPage(page)}
                >
                  {page}
                </button>
              ))}

              <button
                className="page-button"
                onClick={() =>
                  setPartsCurrentPage((p) => Math.min(partsTotalPages, p + 1))
                }
                disabled={partsCurrentPage === partsTotalPages}
              >
                &gt;
              </button>
            </div>
          )}

          <ReportModal
            isOpen={isReportModalOpen}
            complaintId={selectedComplaintIdForReports}
            handleClose={closeReportModal}
            allowAdd
            onReportAdded={async (complaintId) => {
              setReportAvailability((prev) => ({
                ...prev,
                [complaintId]: true,
              }));
              reloadWorkedTodayByUser();

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
              } catch {}
            }}
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
            bankName={
              getLogByPartId(selectedPartsLogIdForReports)?.complaintLog
                ?.bankName
            }
            branchCode={
              getLogByPartId(selectedPartsLogIdForReports)?.complaintLog
                ?.branchCode
            }
            branchName={
              getLogByPartId(selectedPartsLogIdForReports)?.complaintLog
                ?.branchName
            }
          />
        </>
      )}
    </div>
  );
};

export default LabAssigned;
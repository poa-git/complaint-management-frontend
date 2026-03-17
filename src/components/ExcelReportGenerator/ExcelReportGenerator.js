/*******************************************************
 * ExcelReportGenerator.js
 *******************************************************/
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";

/**
 * Order of city names for grouping and sorting
 */
const cityOrder = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Peshawar",
  "Hyderabad",
  "Quetta",
  "Sukkur",
  "Sadiqabad",
  "Bahawalpur",
  "Multan",
  "Sahiwal",
  "Jhang",
  "Faisalabad",
  "Sargodha",
  "Sialkot",
  "Jhelum",
  "Abbottabad",
  "Others",
];

/**
 * Fetch remarks for a given complaint ID
 */

const fetchAllRemarksInBatch = async (complaintIds, API_BASE_URL) => {
  try {
    const url = `${API_BASE_URL}/complaints/remarks/history/batch`;
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(complaintIds),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch remarks in batch");
    }

    const remarksMap = await response.json(); // { [id]: [remarksArray] }

    const formattedMap = {};
    for (const [id, remarks] of Object.entries(remarksMap)) {
      const sorted = remarks.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      const allRemarksString = sorted
        .map((r) =>
          `${r.timestamp.replace("T", " ").replace("Z", "")}: ${r.remarks}`
        )
        .join("\n");

      const latest = sorted[sorted.length - 1];
      const latestRemark = latest
        ? `${latest.timestamp.replace("T", " ").replace("Z", "")}: ${latest.remarks}`
        : "";

      formattedMap[id] = {
        allRemarksString,
        latestRemark,
      };
    }

    return formattedMap;
  } catch (error) {
    console.error("Batch fetch error:", error);
    return {};
  }
};

/**
 * Utility to remove extraneous tabs from text
 */
const sanitizeText = (text) => {
  if (!text) return "";
  return text.toString().replace(/[\t]+/g, " ");
};

/**
 * Group complaints by Bank Name
 */
const groupComplaintsByBankName = (complaints) => {
  const grouped = {};
  complaints.forEach((complaint) => {
    const bankName = (complaint.bankName || "").trim() || "Others";
    if (!grouped[bankName]) {
      grouped[bankName] = [];
    }
    grouped[bankName].push(complaint);
  });

  // Sort so "Others" is last
  return Object.entries(grouped).sort(([bankA], [bankB]) => {
    if (bankA === "Others") return 1;
    if (bankB === "Others") return -1;
    return bankA.localeCompare(bankB);
  });
};

/**
 * Group complaints by City, ensuring "Others" is always last
 */
const groupComplaintsByCity = (complaints) => {
  const lowerCityOrder = cityOrder.map((city) => city.toLowerCase());

  const unifyCityName = (cityString) => {
    if (!cityString) return "Others";
    const trimmed = cityString.trim();
    const lower = trimmed.toLowerCase();
    const matchedIndex = lowerCityOrder.indexOf(lower);
    return matchedIndex !== -1 ? cityOrder[matchedIndex] : "Others";
  };

  const grouped = {};
  complaints.forEach((complaint) => {
    const cityKey = unifyCityName(complaint.city || "");
    if (!grouped[cityKey]) {
      grouped[cityKey] = [];
    }
    grouped[cityKey].push(complaint);
  });

  return Object.entries(grouped).sort(([cityA], [cityB]) => {
    const aLower = cityA.toLowerCase();
    const bLower = cityB.toLowerCase();
    if (aLower === "others" && bLower === "others") return 0;
    if (aLower === "others") return 1;
    if (bLower === "others") return -1;
    return lowerCityOrder.indexOf(aLower) - lowerCityOrder.indexOf(bLower);
  });
};

/**
 * Main Excel generator
 * @param {Array} filteredComplaints   - The filtered array of complaints
 * @param {string} viewStatus          - "Open", "Approved", "Closed", etc.
 * @param {string} API_BASE_URL        - Base URL for fetching remarks
 * @param {Array} [knownCities]        - (optional) Known city list
 * @param {string} [selectedReport]    - "standard" (default), "ageing", or "untouched"
 */
export const generateExcelReport = async (
  filteredComplaints,
  viewStatus,
  API_BASE_URL,
  knownCities = [],
  selectedReport = "standard"
) => {
  try {
    if (selectedReport === "daySummaryMulti") {
      const { summaryData, hardwareData, engineerData } = filteredComplaints;
      const workbook = new ExcelJS.Workbook();

      // ---- 1) Day Summary Sheet ----
      const wsSummary = workbook.addWorksheet("Day Summary");
      let idx = 1;
      wsSummary.addRow([`Date: ${new Date().toLocaleDateString()}`]);
      wsSummary.mergeCells(`A${idx}:B${idx}`);
      idx++;
      wsSummary.addRow(["TODAY COMPLAINT LOGGED", ""]);
      idx++;
      Object.entries(summaryData.todayComplaintLogged || {}).forEach(([k, v]) =>
        wsSummary.addRow([k, v])
      );
      idx += Object.keys(summaryData.todayComplaintLogged || {}).length;
      wsSummary.addRow([]);
      idx++;
      wsSummary.addRow(["OLD COMPLAINT LOGGED", ""]);
      idx++;
      Object.entries(summaryData.oldComplaintLogged || {}).forEach(([k, v]) =>
        wsSummary.addRow([k, v])
      );
      idx += Object.keys(summaryData.oldComplaintLogged || {}).length;
      wsSummary.addRow([]);
      idx++;
      wsSummary.addRow(["COMPLETE DETAIL", ""]);
      idx++;
      Object.entries(summaryData.completeDetail || {}).forEach(([k, v]) =>
        wsSummary.addRow([k, v])
      );
      // Optionally add more formatting here

      // ---- 2) Hardware Dispatch Detail Sheet ----
      const wsHardware = workbook.addWorksheet("Hardware Dispatch");
      // If hardwareData is an array of objects, get all keys as columns
      if (Array.isArray(hardwareData) && hardwareData.length > 0) {
        wsHardware.columns = Object.keys(hardwareData[0]).map((key) => ({
          header: key,
          key,
          width: 20,
        }));
        hardwareData.forEach((row) => {
          wsHardware.addRow(row);
        });
      } else {
        wsHardware.addRow(["No data"]);
      }

      // ---- 3) City-wise Engineer Summary Sheet ----
      const wsEngineer = workbook.addWorksheet("Engineer Summary");
      // We'll flatten the engineerData map
      wsEngineer.addRow([
        "City",
        "Engineer Name",
        "Complaints Attended",
        "Service Visit",
        "Total",
        "Today Pending",
        "Old Pending",
        "Total Pending",
      ]);
      Object.entries(engineerData).forEach(([city, cityBlock]) => {
        (cityBlock.engineers || []).forEach((eng) => {
          wsEngineer.addRow([
            city,
            eng.name,
            eng.complaints,
            eng.serviceVisit,
            "", // Will fill totals in the next row
            "",
            "",
            ""
          ]);
        });
        if (cityBlock.totals) {
          wsEngineer.addRow([
            city,
            "TOTAL",
            cityBlock.totals.complaintsAttended,
            cityBlock.totals.serviceVisit,
            cityBlock.totals.total,
            cityBlock.totals.todayPending,
            cityBlock.totals.oldPending,
            cityBlock.totals.totalPending,
          ]);
        }
        wsEngineer.addRow([]);
      });

      // ---- Save as XLSX (ExcelJS style) ----
      const buffer = await workbook.xlsx.writeBuffer();
      const blobData = new Blob([buffer], { type: "application/octet-stream" });
      saveAs(blobData, `Day_Summary_Report_${new Date().toLocaleDateString()}.xlsx`);
      alert("Day Summary report generated!");
      return;
    }
    // 1) Quick guard
    if (!filteredComplaints || filteredComplaints.length === 0) {
      alert("No complaints found for the selected filters.");
      return;
    }

    // 2) Fetch remarks & compute 'ageing' + 'lastActionDate'
    const complaintIds = filteredComplaints.map((c) => c.id);
const remarksMap = await fetchAllRemarksInBatch(complaintIds, API_BASE_URL);

let complaintsWithRemarks = filteredComplaints.map((c) => {
  const { allRemarksString = "Error fetching remarks", latestRemark = "Error fetching remarks" } =
    remarksMap[c.id] || {};

  let ageing = "";
  if (c.date) {
    const today = new Date();
    const dateVal = new Date(c.date);
    ageing = Math.floor((today - dateVal) / (1000 * 60 * 60 * 24));
  }

  let lastActionDate = "";
  switch (c.complaintStatus) {
    case "Open":
      lastActionDate = c.date || "";
      break;
    case "Visit Schedule":
      lastActionDate = c.scheduleDate || "";
      break;
    case "Closed":
      lastActionDate = c.closedDate || "";
      break;
    case "Wait For Approval":
      lastActionDate = c.quotationDate || "";
      break;
    case "Approved":
      lastActionDate = c.approvedDate || "";
      break;
    case "FOC":
      lastActionDate = c.focDate || "";
      break;
    default:
      lastActionDate = "";
  }

  return {
    ...c,
    allRemarksString,
    latestRemark,
    ageing,
    lastActionDate,
  };
});

    // 3) If "untouched", filter to only "Open"
    if (selectedReport === "untouched") {
      complaintsWithRemarks = complaintsWithRemarks.filter(
        (c) => c.complaintStatus === "Open"
      );
      if (complaintsWithRemarks.length === 0) {
        alert("No 'Open' complaints for 'untouched' report.");
        return;
      }
    }

    // 4) Group the data
    const groupedComplaints =
      viewStatus === "Approved" || viewStatus === "Wait For Approval"
        ? groupComplaintsByBankName(complaintsWithRemarks)
        : groupComplaintsByCity(complaintsWithRemarks);

    // 5) Create a workbook & one worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Complaints Report");

    // 6) Common heading rows
    let rowIndex = 1;
    const reportDate = new Date().toLocaleDateString();

    // -- Row 1: date
    const dateRow = worksheet.addRow([`Date: ${reportDate}`]);
    dateRow.font = { size: 10, bold: true };
    dateRow.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.mergeCells(`A${rowIndex}:G${rowIndex}`);
    rowIndex++;

    // -- Row 2: status
    const displayStatus = viewStatus || "All";
    const statusRow = worksheet.addRow([`${displayStatus} Complaints Status`]);
    statusRow.font = { size: 12, bold: true };
    statusRow.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.mergeCells(`A${rowIndex}:G${rowIndex}`);
    statusRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "B6D7A8" },
    };
    rowIndex++;

    // 7) Re-usable styles
    const groupHeaderStyle = {
      font: { bold: true, size: 16 },
      alignment: { horizontal: "center", vertical: "middle" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "6AA84F" } },
    };
    const columnHeaderStyle = {
      font: { bold: true, size: 10 },
      alignment: { horizontal: "center", vertical: "middle" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2CC" } },
    };
    const dataCellStyle = {
      font: { size: 10 },
      alignment: { vertical: "top", horizontal: "center", wrapText: true },
    };

    // 8) For each group, decide columns & fill data
    groupedComplaints.forEach(([groupKey, groupData]) => {
      let ageingColumn = false;
      let hasQuotationDate = false;
      let hasLastActionDate = true;
      let hasClosedDate = false;

      if (viewStatus === "Wait For Approval") {
        ageingColumn = true;
        hasQuotationDate = true;
      } else if (viewStatus === "Approved") {
        ageingColumn = true;
        hasQuotationDate = true;
      } else if (viewStatus === "Open") {
        ageingColumn = true;
      } else if (viewStatus === "Closed") {
        hasClosedDate = true;
      } else if (viewStatus === "Overall") {
        ageingColumn = true;
        hasQuotationDate = true;
        hasClosedDate = true;
      }

      // Build column headers
      const columnHeaders = ["Serial No."];

      if (selectedReport === "ageing") {
        columnHeaders.push(
          "Date",
          "Ageing",
          "Bank Name",
          "Branch Code",
          "Branch Name",
          "Remarks",
          "Status"
        );
      } else if (selectedReport === "untouched") {
        columnHeaders.push(
          "Date",
          "Ageing",
          "Bank Name",
          "Branch Code",
          "Branch Name",
          "Latest Remarks",
          "Status"
        );
      } else {
        // standard report
        if (ageingColumn) columnHeaders.push("Ageing");
        columnHeaders.push(
          "Date",
          "Bank Name",
          "Branch Code",
          "Branch Name",
          "City",
          "Reference Number",
          "Details",
          "Equipment Description",
          "Remarks",
          "Engineer Name",
          "Repeat Complaint",
          "Status",
          "Courier Status"
        );
        if (hasQuotationDate) columnHeaders.push("Quotation Date");
        if (hasLastActionDate) columnHeaders.push("Last Action Date");
        if (hasClosedDate) columnHeaders.push("Closed Date");
        columnHeaders.push("Complaint ID");
      }

      // Group header row
      const groupRow = worksheet.addRow([groupKey]);
      groupRow.eachCell((cell) => {
        cell.style = groupHeaderStyle;
      });
      worksheet.mergeCells(
        `A${rowIndex}:${String.fromCharCode(64 + columnHeaders.length)}${rowIndex}`
      );
      rowIndex++;

      // Column header row
      const headerRow = worksheet.addRow(columnHeaders);
      headerRow.eachCell((cell) => {
        cell.style = columnHeaderStyle;
      });
      rowIndex++;

      // Data rows
      groupData.forEach((complaint, idx) => {
        const rowData = [idx + 1];

        if (selectedReport === "ageing") {
          rowData.push(
            complaint.date || "",
            complaint.ageing || "",
            complaint.bankName || "",
            complaint.branchCode || "",
            complaint.branchName || "",
            sanitizeText(complaint.allRemarksString),
            complaint.complaintStatus || ""
          );
        } else if (selectedReport === "untouched") {
          rowData.push(
            complaint.date || "",
            complaint.ageing || "",
            complaint.bankName || "",
            complaint.branchCode || "",
            complaint.branchName || "",
            sanitizeText(complaint.latestRemark),
            complaint.complaintStatus || ""
          );
        } else {
          // standard
          if (ageingColumn) {
            rowData.push(complaint.ageing || "");
          }
          rowData.push(
            complaint.date || "",
            complaint.bankName || "",
            complaint.branchCode || "",
            complaint.branchName || "",
            complaint.city || "",
            complaint.referenceNumber || "",
            sanitizeText(complaint.details),
            complaint.equipmentDescription|| "",
            sanitizeText(complaint.allRemarksString),
            complaint.visitorName || "",
            complaint.repeatComplaint ? "Yes" : "No",
            complaint.complaintStatus || "",
            complaint.courierStatus || ""
          );
          if (hasQuotationDate) {
            rowData.push(complaint.quotationDate || "");
          }
          if (hasLastActionDate) {
            rowData.push(complaint.lastActionDate || "");
          }
          if (hasClosedDate) {
            rowData.push(complaint.closedDate || "");
          }
          rowData.push(complaint.complaintId || "");
        }

        const dataRow = worksheet.addRow(rowData);
        dataRow.eachCell((cell) => {
          cell.style = dataCellStyle;
        });
        rowIndex++;
      });

      // Blank row
      worksheet.addRow([]);
      rowIndex++;
    });

    // 9) Set column widths
    worksheet.columns = worksheet.columns.map((col) => ({
      ...col,
      width: 18,
    }));

    // 10) Save as XLSX
    const buffer = await workbook.xlsx.writeBuffer();
    const blobData = new Blob([buffer], { type: "application/octet-stream" });
    const fileName = `${displayStatus}_Complaints_Report_${reportDate}.xlsx`;
    saveAs(blobData, fileName);

    alert(`${selectedReport.toUpperCase()} report generated successfully!`);
  } catch (error) {
    console.error("Error generating report:", error);
    alert("An error occurred while generating the report. Please try again.");
  }
};

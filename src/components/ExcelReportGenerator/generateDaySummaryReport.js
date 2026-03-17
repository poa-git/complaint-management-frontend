import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const borderStyle = {
  top: { style: "thin" }, left: { style: "thin" },
  bottom: { style: "thin" }, right: { style: "thin" }
};
const headerCellStyle = {
  font: { bold: true },
  alignment: { horizontal: "center", vertical: "middle" },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } }
};
const yellowCellStyle = {
  font: { bold: true },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF00" } },
  alignment: { horizontal: "center", vertical: "middle" }
};

// Map labels to keys for readable Excel output (fixed casing)
const labelToKey = {
  "Logged": "logged",
  "Hardware Picked": "hardwarePicked",
  "Approved": "approved",
  "FOC": "foc",
  "Wait For Approval": "waitForApproval",
  "Same Day Closed": "sameDayClose", // For today only
  "Pending": "pending",
  "Closed": "Closed" // <-- Capital "C" to match backend
};

function addDynamicBox(ws, startRow, startCol, title, dataObj, rowOrder, visitValue = null, highlightTotalKey = null) {
  ws.mergeCells(startRow, startCol + 1, startRow, startCol + 2);
  ws.getCell(startRow, startCol).value = title;
  ws.getCell(startRow, startCol).style = headerCellStyle;
  if (visitValue !== null) {
    ws.getCell(startRow, startCol + 1).value = visitValue;
    ws.getCell(startRow, startCol + 1).style = headerCellStyle;
    ws.getCell(startRow, startCol + 2).value = "visit";
    ws.getCell(startRow, startCol + 2).style = headerCellStyle;
  }
  for (let c = 0; c < 3; c++) ws.getCell(startRow, startCol + c).border = borderStyle;

  let i = 0;
  rowOrder.forEach(label => {
    let key = labelToKey[label] || label; // fallback to label if not mapped
    let value = dataObj?.[key] ?? "";

    ws.getCell(startRow + 1 + i, startCol).value = label;
    ws.getCell(startRow + 1 + i, startCol + 1).value = value;
    if (highlightTotalKey && key === highlightTotalKey) {
      ws.getCell(startRow + 1 + i, startCol + 2).style = yellowCellStyle;
    }
    for (let c = 0; c < 3; c++) ws.getCell(startRow + 1 + i, startCol + c).border = borderStyle;
    ws.getRow(startRow + 1 + i).alignment = { horizontal: "center", vertical: "middle" };
    i++;
  });
  return startRow + 1 + rowOrder.length;
}

export const generateDaySummaryReport = async (summaryData, hardwareData, engineerData) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Day Summary", { properties: { defaultRowHeight: 22 } });

    // -- Main Title
    ws.mergeCells(`B2:G2`);
    ws.getCell(`B2`).value = "Day Summary Report";
    ws.getCell(`B2`).font = { size: 16, bold: true };
    ws.getCell(`B2`).alignment = { horizontal: "center", vertical: "middle" };

    // -- Date Row
    ws.mergeCells(`B3:G3`);
    ws.getCell(`B3`).value = `Date: ${new Date().toLocaleDateString()}`;
    ws.getCell(`B3`).font = { size: 12, bold: true };
    ws.getCell(`B3`).alignment = { horizontal: "center", vertical: "middle" };

    // ---- DESIRED ORDER ----
    const todaySummaryRowOrder = [
      "Logged",
      "Hardware Picked",
      "Approved",
      "FOC",
      "Wait For Approval",
      "Same Day Closed",
      "Pending"
    ];
    const oldSummaryRowOrder = [
      "Logged",
      "Hardware Picked",
      "Approved",
      "FOC",
      "Wait For Approval",
      "closed",
      "Pending"
    ];
    const detailSummaryRowOrder = [
      "Logged",
      "Hardware Picked",
      "Approved",
      "FOC",
      "Wait For Approval",
      "Closed",
      "Pending"
    ];

    // --- Summary Boxes (dynamic) ---
    let boxRow = 5;
    const todayVisit = summaryData?.todayComplaintLogged?.visit || null;
    const oldVisit = summaryData?.oldComplaintLogged?.visit || null;
    const todayObj = { ...summaryData?.todayComplaintLogged };
    const oldObj = { ...summaryData?.oldComplaintLogged };
    const detailObj = { ...summaryData?.completeDetail };
    if (todayObj.visit !== undefined) delete todayObj.visit;
    if (oldObj.visit !== undefined) delete oldObj.visit;
    if (detailObj.totalVisit !== undefined) delete detailObj.totalVisit;

    // DEBUG: Show which keys you actually get in detailObj
    // console.log("Keys in completeDetail:", Object.keys(detailObj));

    // Today complaint box starts at col 2 ("B")
    addDynamicBox(ws, boxRow, 2, "Today complaint logged", todayObj, todaySummaryRowOrder, todayVisit);

    // Old complaint box (next to today, e.g. col 6 "F")
    addDynamicBox(ws, boxRow, 6, "Old complaint logged", oldObj, oldSummaryRowOrder, oldVisit);

    // Complete detail (below both, centered col 4 "D")
    let detailBoxStartRow = boxRow + todaySummaryRowOrder.length + 2;
    addDynamicBox(ws, detailBoxStartRow, 4, "Complete detail", detailObj, detailSummaryRowOrder, null, "Logged");

    // Total Visit value (yellow)
    if (summaryData?.completeDetail?.totalVisit !== undefined) {
      const totalRow = detailBoxStartRow + detailSummaryRowOrder.length;
      ws.getCell(totalRow, 6).value = summaryData?.completeDetail?.totalVisit;
      ws.getCell(totalRow, 6).style = yellowCellStyle;
    }

    // Set wide columns (start from col 2 to col 12)
    for (let i = 2; i <= 12; i++) ws.getColumn(i).width = 26;

    // --- Engineer Summary Table ---
    let engineerStartRow = detailBoxStartRow + detailSummaryRowOrder.length + 4;
    ws.mergeCells(`B${engineerStartRow}:I${engineerStartRow}`);
    ws.getCell(`B${engineerStartRow}`).value = "Engineer Summary";
    ws.getCell(`B${engineerStartRow}`).font = { size: 14, bold: true };
    ws.getCell(`B${engineerStartRow}`).alignment = { horizontal: "center" };

    engineerStartRow += 2;
    Object.entries(engineerData || {}).forEach(([city, cityBlock]) => {
      ws.mergeCells(`B${engineerStartRow}:I${engineerStartRow}`);
      ws.getCell(`B${engineerStartRow}`).value = city;
      ws.getCell(`B${engineerStartRow}`).style = {
        font: { bold: true },
        alignment: { horizontal: "center" },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "BFBFBF" } }
      };

      engineerStartRow++;
      const tableHeader = [
        "S. No.", "Eng. Name", "City", "Complaints", "Service visit", "Total", "", ""
      ];
      for (let i = 0; i < tableHeader.length; i++) {
        ws.getCell(engineerStartRow, 2 + i).value = tableHeader[i];
        ws.getCell(engineerStartRow, 2 + i).font = { bold: true };
        ws.getCell(engineerStartRow, 2 + i).alignment = { horizontal: "center" };
        ws.getCell(engineerStartRow, 2 + i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
        ws.getCell(engineerStartRow, 2 + i).border = borderStyle;
      }
      let engineers = cityBlock.engineers || [];
      for (let i = 0; i < engineers.length; i++) {
        let eng = engineers[i];
        let rowNum = engineerStartRow + 1 + i;
        ws.getCell(rowNum, 2).value = i + 1;
        ws.getCell(rowNum, 3).value = eng.name;
        ws.getCell(rowNum, 4).value = eng.city || city;
        ws.getCell(rowNum, 5).value = eng.complaints;
        ws.getCell(rowNum, 6).value = eng.serviceVisit;
        ws.getCell(rowNum, 7).value = ""; // total
        ws.getCell(rowNum, 8).value = "";
        ws.getCell(rowNum, 9).value = "";
        for (let j = 0; j < 8; j++) {
          ws.getCell(rowNum, 2 + j).border = borderStyle;
          ws.getCell(rowNum, 2 + j).alignment = { horizontal: "center", vertical: "middle" };
        }
      }
      let summaryRow = engineerStartRow + 1 + engineers.length;
      ws.getCell(summaryRow, 3).value = "Total Complaint Attended";
      ws.getCell(summaryRow, 5).value = cityBlock.totals?.complaintsAttended || "";
      ws.getCell(summaryRow, 6).value = cityBlock.totals?.serviceVisit || "";
      ws.getCell(summaryRow, 7).value = cityBlock.totals?.total || "";
      for (let j = 0; j < 8; j++) {
        ws.getCell(summaryRow, 2 + j).font = { bold: true };
        ws.getCell(summaryRow, 2 + j).border = borderStyle;
        ws.getCell(summaryRow, 2 + j).alignment = { horizontal: "center", vertical: "middle" };
      }
      ws.getCell(summaryRow + 1, 3).value = "Today pending";
      ws.getCell(summaryRow + 1, 5).value = cityBlock.totals?.todayPending || "";
      ws.getCell(summaryRow + 2, 3).value = "old Pending";
      ws.getCell(summaryRow + 2, 5).value = cityBlock.totals?.oldPending || "";
      ws.getCell(summaryRow + 3, 3).value = "Total Pending";
      ws.getCell(summaryRow + 3, 5).value = cityBlock.totals?.totalPending || "";
      for (let k = 1; k <= 3; k++) {
        ws.getCell(summaryRow + k, 3).font = { bold: true };
        ws.getCell(summaryRow + k, 5).font = { bold: true };
        ws.getCell(summaryRow + k, 3).border = borderStyle;
        ws.getCell(summaryRow + k, 5).border = borderStyle;
        ws.getCell(summaryRow + k, 3).alignment = { horizontal: "center" };
        ws.getCell(summaryRow + k, 5).alignment = { horizontal: "center" };
      }
      engineerStartRow = summaryRow + 5;
    });

    // --- Hardware Dispatch List (centered at bottom) ---
    let hardwareStartRow = engineerStartRow + 2;
    ws.mergeCells(`B${hardwareStartRow}:I${hardwareStartRow}`);
    ws.getCell(`B${hardwareStartRow}`).value = "Dispatched Hardware List";
    ws.getCell(`B${hardwareStartRow}`).font = { size: 14, bold: true };
    ws.getCell(`B${hardwareStartRow}`).alignment = { horizontal: "center" };

    hardwareStartRow++;
    if (Array.isArray(hardwareData) && hardwareData.length > 0) {
      const hardwareKeys = Object.keys(hardwareData[0]);
      for (let i = 0; i < hardwareKeys.length; i++) {
        ws.getCell(hardwareStartRow, 2 + i).value = hardwareKeys[i];
        ws.getCell(hardwareStartRow, 2 + i).font = { bold: true };
        ws.getCell(hardwareStartRow, 2 + i).alignment = { horizontal: "center" };
        ws.getCell(hardwareStartRow, 2 + i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } };
        ws.getCell(hardwareStartRow, 2 + i).border = borderStyle;
      }
      for (let r = 0; r < hardwareData.length; r++) {
        let rowNum = hardwareStartRow + 1 + r;
        for (let c = 0; c < hardwareKeys.length; c++) {
          ws.getCell(rowNum, 2 + c).value = hardwareData[r][hardwareKeys[c]];
          ws.getCell(rowNum, 2 + c).alignment = { horizontal: "center" };
          ws.getCell(rowNum, 2 + c).border = borderStyle;
        }
      }
    } else {
      ws.getCell(hardwareStartRow, 2).value = "No data";
    }

    // Save file
    const buffer = await workbook.xlsx.writeBuffer();
    const blobData = new Blob([buffer], { type: "application/octet-stream" });
    saveAs(blobData, `Day_Summary_Report_${new Date().toLocaleDateString()}.xlsx`);
    alert("Day Summary report generated!");
  } catch (error) {
    console.error("Error generating Day Summary report:", error);
    alert("An error occurred while generating the Day Summary report. Please try again.");
  }
};

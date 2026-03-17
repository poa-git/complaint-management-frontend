import React, { useEffect, useState } from "react";
import axios from "axios";
import OverallComplaints from "./OverallComplaints/OverallComplaints";
import OverallBankWiseComplaints from "./OverallBankWiseComplaints/OverallBankWiseComplaints";
import OverallCityWiseComplaints from "./OverallCityWiseComplaints/OverallCityWiseComplaints";
import { saveAs } from "file-saver"; // For downloading the file in the browser
import ExcelJS from "exceljs"; // For building the Excel workbook
import "./Metrics.css";

const OverallMetrics = () => {
  // State variables for complaints data
  const [overallComplaints, setOverallComplaints] = useState({
    totalOpenComplaints: 0,
    totalClosedComplaints: 0,
    totalWaitForApprovalComplaints: 0,
    totalApprovedComplaints: 0,
  });
  const [cityWiseOverallComplaints, setCityWiseOverallComplaints] = useState({});
  const [bankWiseOverallComplaints, setBankWiseOverallComplaints] = useState({});

  // Fetch metrics on component mount
  useEffect(() => {
    fetchAllMetrics();
  }, []);

  const fetchAllMetrics = async () => {
    try {
      await Promise.all([
        fetchOverallComplaints(),
        fetchCityWiseOverallComplaints(),
        fetchBankWiseOverallComplaints(),
      ]);
    } catch (error) {
      console.error("Error fetching metrics data:", error);
    }
  };

  const fetchOverallComplaints = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/complaints/overall-metrics`,
        { withCredentials: true }
      );
      setOverallComplaints(response.data || {});
    } catch (error) {
      console.error("Error fetching overall complaints metrics:", error);
    }
  };

  const fetchCityWiseOverallComplaints = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/complaints/city-wise-all-metrics`,
        { withCredentials: true }
      );

      // Example: normalize city names
      const normalizedData = Object.fromEntries(
        Object.entries(response.data || {}).map(([city, metrics]) => [
          city.charAt(0).toUpperCase() + city.slice(1).toLowerCase(),
          metrics,
        ])
      );
      setCityWiseOverallComplaints(normalizedData);
    } catch (error) {
      console.error("Error fetching city-wise overall complaints metrics:", error);
    }
  };

  const fetchBankWiseOverallComplaints = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/complaints/bank-wise-all-metrics`,
        { withCredentials: true }
      );

      // Example: normalize bank names
      const normalizedData = Object.fromEntries(
        Object.entries(response.data || {}).map(([bank, metrics]) => [
          bank.charAt(0).toUpperCase() + bank.slice(1).toLowerCase(),
          metrics,
        ])
      );
      setBankWiseOverallComplaints(normalizedData);
    } catch (error) {
      console.error("Error fetching bank-wise overall complaints metrics:", error);
    }
  };

  /**
   * A reusable function to add a worksheet that merges:
   *  - "Open + Visit Schedule"
   *  - "FOC + Approved + Hardware Picked"
   * for any given data object (BankWise or CityWise).
   */
  const addComplaintsSheet = ({
    workbook,
    sheetName,
    dataObject,
    firstColumnLabel, // e.g., "Bank" or "City"
  }) => {
    const sheet = workbook.addWorksheet(sheetName);

    // 1) Define which keys to exclude from individual columns (because we'll merge them)
    const excludedKeys = new Set([
      "allOpenComplaints",
      "allVisitScheduleComplaints",
      "allFocComplaints",
      "allApprovedComplaints",
      "allHardwarePickedComplaints",
      "allClosedComplaints", // if you don't want "Closed" as a separate column, exclude it
    ]);

    // 2) display names for certain columns
    const complaintTypeDisplayNames = {
      allQuotationComplaints: "Quotation",
      allWaitForApprovalComplaints: "Wait for Approval",
    };

    // 3) Collect all unique keys (excluding the ones we are merging)
    const uniqueKeys = new Set();
    Object.values(dataObject).forEach((metrics) => {
      Object.keys(metrics).forEach((key) => {
        if (!excludedKeys.has(key)) {
          uniqueKeys.add(key);
        }
      });
    });

    // 4) Define final column order: merging first + middle + merging last
    const orderedKeys = [
      "Open + Visit Schedule",
      ...Array.from(uniqueKeys),
      "FOC + Approved + Hardware Picked",
    ];

    // 5) Convert each key into a human-readable header
    const headers = orderedKeys.map(
      (key) => complaintTypeDisplayNames[key] || key
    );

    // 6) Prepare a "Grand Total" row
    //    We have "firstColumnLabel" + all ordered columns + "Total" => length = orderedKeys.length + 2
    const grandTotalRow = new Array(orderedKeys.length + 2).fill(0);
    grandTotalRow[0] = "Grand Total";

    // 7) Add the header row, plus a "Total" column at the end
    sheet.addRow([firstColumnLabel, ...headers, "Total"]);

    // 8) Fill data rows
    Object.entries(dataObject).forEach(([labelValue, metrics]) => {
      const rowData = [labelValue];
      let rowTotal = 0;

      orderedKeys.forEach((key, idx) => {
        let cellValue = 0;

        if (key === "Open + Visit Schedule") {
          // Merge allOpenComplaints + allVisitScheduleComplaints
          const openVal = parseInt(metrics.allOpenComplaints ?? 0, 10);
          const visitVal = parseInt(metrics.allVisitScheduleComplaints ?? 0, 10);
          cellValue = openVal + visitVal;
        } else if (key === "FOC + Approved + Hardware Picked") {
          // Merge allFocComplaints + allApprovedComplaints + allHardwarePickedComplaints
          const focVal = parseInt(metrics.allFocComplaints ?? 0, 10);
          const approvedVal = parseInt(metrics.allApprovedComplaints ?? 0, 10);
          const hardwareVal = parseInt(metrics.allHardwarePickedComplaints ?? 0, 10);
          cellValue = focVal + approvedVal + hardwareVal;
        } else {
          // Normal column
          cellValue = parseInt(metrics[key] ?? 0, 10);
        }

        rowData.push(cellValue);
        rowTotal += cellValue;

        // Sum into the grand total row for this column
        grandTotalRow[idx + 1] += cellValue;
      });

      // Finally push the row total, and also add it to the grand total's "Total" cell
      rowData.push(rowTotal);
      grandTotalRow[grandTotalRow.length - 1] += rowTotal;

      sheet.addRow(rowData);
    });

    // 9) Add the grand total row at the end
    sheet.addRow(grandTotalRow);

    // 10) Make header row and grand total row bold
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(sheet.rowCount).font = { bold: true };

    // 11) Auto-fit column widths
    sheet.columns.forEach((col) => {
      col.width = 25;
    });
  };

  /**
   * Export all metrics to Excel using ExcelJS & file-saver
   */
  const handleExportToExcel = async () => {
    try {
      // 1) Create a new ExcelJS Workbook
      const workbook = new ExcelJS.Workbook();

      // 2) BANK-WISE COMPLAINTS SHEET (with merged columns & grand total)
      addComplaintsSheet({
        workbook,
        sheetName: "BankWiseComplaints",
        dataObject: bankWiseOverallComplaints,
        firstColumnLabel: "Bank",
      });

      // 3) CITY-WISE COMPLAINTS SHEET (using the same approach)
      addComplaintsSheet({
        workbook,
        sheetName: "CityWiseComplaints",
        dataObject: cityWiseOverallComplaints,
        firstColumnLabel: "City",
      });

      // 4) OVERALL COMPLAINTS SHEET (simple key-value pairs)
      const overallSheet = workbook.addWorksheet("OverallComplaints");
      overallSheet.addRow(["Metric", "Value"]).font = { bold: true };
      overallSheet.addRow(["Total Open Complaints", overallComplaints.totalOpenComplaints]);
      overallSheet.addRow(["Total Closed Complaints", overallComplaints.totalClosedComplaints]);
      overallSheet.addRow(["Total Wait For Approval Complaints", overallComplaints.totalWaitForApprovalComplaints]);
      overallSheet.addRow(["Total Approved Complaints", overallComplaints.totalApprovedComplaints]);

      // 5) Generate a buffer & trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), "MetricsReport.xlsx");
    } catch (error) {
      console.error("Error exporting metrics to Excel:", error);
    }
  };

  return (
    <div className="metrics-container">
      <h1 className="metrics-title">Overall Metrics Overview</h1>

      {/* Export Button */}
      <div className="metrics-btn-container">
        <button className="metrics-excel-btn" onClick={handleExportToExcel}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
          >
            <path fill="none" d="M0 0h24v24H0z"></path>
            <path
              fill="currentColor"
              d="M1 14.5a6.496 6.496 0 0 1 3.064-5.519 8.001 8.001 0 0 1 15.872 0 6.5 6.5 0 0 1-2.936 12L7 21c-3.356-.274-6-3.078-6-6.5zm15.848 4.487a4.5 4.5 0 0 0 2.03-8.309l-.807-.503-.12-.942a6.001 6.001 0 0 0-11.903 0l-.12.942-.805.503a4.5 4.5 0 0 0 2.029 8.309l.173.013h9.35l.173-.013zM13 12h3l-4 5-4-5h3V8h2v4z"
            ></path>
          </svg>
          <span>Export Metrics to Excel</span>
        </button>
      </div>

      {/* Section: Overall Complaints */}
      <section className="metrics-section">
        <h2 className="metrics-subtitle">Overall Complaints</h2>
        <OverallComplaints
          totalOpenComplaints={overallComplaints.totalOpenComplaints}
          totalClosedComplaints={overallComplaints.totalClosedComplaints}
          totalWaitForApprovalComplaints={overallComplaints.totalWaitForApprovalComplaints}
          totalApprovedComplaints={overallComplaints.totalApprovedComplaints}
        />
      </section>

      {/* Section: City-Wise Complaints */}
      <section className="metrics-section">
        <h2 className="metrics-subtitle">City-Wise Overall Complaints</h2>
        <OverallCityWiseComplaints cityWiseData={cityWiseOverallComplaints} />
      </section>

      {/* Section: Bank-Wise Complaints */}
      <section className="metrics-section">
        <h2 className="metrics-subtitle">Bank-Wise Overall Complaints</h2>
        <OverallBankWiseComplaints bankWiseData={bankWiseOverallComplaints} />
      </section>
    </div>
  );
};

export default OverallMetrics;

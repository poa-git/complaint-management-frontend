import React, { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import "./ComplaintReport.css";

const ComplaintReport = ({ complaintId }) => {
  const [complaintDetails, setComplaintDetails] = useState(null);
  const [history, setHistory] = useState([]);
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hardwareReports, setHardwareReports] = useState([]);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        // Fetch complaint report (history & remarks)
        const response = await axios.get(
          `${API_BASE_URL}/complaints/${complaintId}/history`,
          { withCredentials: true }
        );
        const {
          complaintDetails,
          history: historyEntries,
          remarks: remarkEntries,
        } = response.data;

        setComplaintDetails(complaintDetails || null);
        setHistory(historyEntries || []);
        setRemarks(remarkEntries || []);

        // Fetch hardware reports
        const hardwareReportRes = await axios.get(
          `${API_BASE_URL}/hardware-logs/${complaintId}/reports`,
          { withCredentials: true }
        );
        setHardwareReports(hardwareReportRes.data || []);
      } catch (err) {
        console.error("Error fetching complaint report:", err.response || err);
        setError(err.message || "Failed to fetch complaint report.");
      } finally {
        setLoading(false);
      }
    };

    if (complaintId) {
      fetchReport();
    }
  }, [complaintId]);

  const generatePDF = () => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text("Complaint Report", 14, 20);

    // Add Complaint Details
    if (complaintDetails) {
      doc.setFontSize(14);
      doc.text("Complaint Details", 14, 30);
      const details = [
        ["Complaint ID", complaintDetails.complaintId],
        ["Status", complaintDetails.complaintStatus],
        ["Description", complaintDetails.details],
        ["Logged By", complaintDetails.loggedBy],
      ];
      details.forEach((detail, index) => {
        doc.text(`${detail[0]}: ${detail[1] || "N/A"}`, 14, 40 + index * 10);
      });
    }

    // Add History Table
    if (history.length > 0) {
      doc.text("History", 14, 90);
      doc.autoTable({
        startY: 100,
        head: [
          [
            "Field Name",
            "Old Value",
            "New Value",
            "Change Date & Time",
            "Changed By",
            "Reason",
            "Logged By",
          ],
        ], // Updated header
        body: history.map((entry) => [
          entry.fieldName,
          entry.oldValue || "N/A",
          entry.newValue || "N/A",
          new Date(entry.changeDate).toLocaleString(), // Updated
          entry.changedBy || "N/A",
          entry.reasonForChange || "N/A",
          entry.loggedBy || "N/A",
        ]),
        theme: "grid",
        styles: { fontSize: 10 },
      });
    }

    // Add Remarks Table
    if (remarks.length > 0) {
      const remarksStartY = doc.lastAutoTable
        ? doc.lastAutoTable.finalY + 10
        : 110;
      doc.text("Remarks", 14, remarksStartY);
      doc.autoTable({
        startY: remarksStartY + 10,
        head: [["Remark", "Timestamp", "Commented By"]],
        body: remarks.map((remark) => [
          remark.remarks,
          new Date(remark.timestamp).toLocaleString(),
          remark.commentedBy || "N/A",
        ]),
        theme: "grid",
        styles: { fontSize: 10 },
      });
    }
// Add Hardware Reports Table
if (hardwareReports.length > 0) {
  const reportsStartY = doc.lastAutoTable
    ? doc.lastAutoTable.finalY + 10
    : 110;
  doc.text("Hardware Reports", 14, reportsStartY);
  doc.autoTable({
    startY: reportsStartY + 10,
    head: [["Content", "Created By", "Created At"]],
    body: hardwareReports.map((report) => [
      report.content,
      report.createdBy || "N/A",
      new Date(report.createdAt).toLocaleString(),
    ]),
    theme: "grid",
    styles: { fontSize: 10 },
  });
}

    // Save the PDF
    doc.save(`Complaint_Report_${complaintId}.pdf`);
  };

  if (loading) {
    return <div className="loading-message">Loading complaint report...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return (
    <div className="complaint-report-container">
      <h1 className="complaint-report-title">Complaint Report</h1>

      {complaintDetails ? (
        <div className="complaint-details">
          <h2>Complaint Details</h2>
          <div className="complaint-card">
            <p>
              <strong>Complaint ID:</strong> {complaintDetails.complaintId}
            </p>
            <p>
              <strong>Status:</strong> {complaintDetails.complaintStatus}
            </p>
            <p>
              <strong>Description:</strong> {complaintDetails.details}
            </p>
            <p>
              <strong>Logged By:</strong> {complaintDetails.loggedBy}
            </p>
          </div>
        </div>
      ) : (
        <p className="no-history-message">
          No details available for this complaint.
        </p>
      )}

      <div className="table-container">
        <h2>History</h2>
        {history.length === 0 ? (
          <p className="no-history-message">
            No history available for this complaint.
          </p>
        ) : (
          <table className="complaint-report-table">
            <thead>
              <tr>
                <th>Field Name</th>
                <th>Old Value</th>
                <th>New Value</th>
                <th>Change Date</th>
                <th>Changed By</th>
                <th>Reason</th>
                <th>Logged By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, index) => (
                <tr
                  key={entry.id}
                  className={index % 2 === 0 ? "even-row" : "odd-row"}
                >
                  <td>{entry.fieldName}</td>
                  <td>{entry.oldValue || "N/A"}</td>
                  <td>{entry.newValue || "N/A"}</td>
                  <td>{new Date(entry.changeDate).toLocaleString()}</td>{" "}
                  {/* Updated */}
                  <td>{entry.changedBy || "N/A"}</td>
                  <td>{entry.reasonForChange || "N/A"}</td>
                  <td>{entry.loggedBy || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="table-container">
        <h2>Remarks</h2>
        {remarks.length === 0 ? (
          <p className="no-history-message">
            No remarks available for this complaint.
          </p>
        ) : (
          <table className="complaint-report-table">
            <thead>
              <tr>
                <th>Remark</th>
                <th>Timestamp</th>
                <th>Commented By</th>
              </tr>
            </thead>
            <tbody>
              {remarks.map((remark, index) => (
                <tr
                  key={remark.id}
                  className={index % 2 === 0 ? "even-row" : "odd-row"}
                >
                  <td>{remark.remarks}</td>
                  <td>{new Date(remark.timestamp).toLocaleString()}</td>
                  <td>{remark.commentedBy || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="table-container">
        <h2>Hardware Reports</h2>
        {hardwareReports.length === 0 ? (
          <p className="no-history-message">
            No hardware reports available for this complaint.
          </p>
        ) : (
          <table className="complaint-report-table">
            <thead>
              <tr>
                <th>Content</th>
                <th>Created By</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {hardwareReports.map((report, index) => (
                <tr
                  key={report.id}
                  className={index % 2 === 0 ? "even-row" : "odd-row"}
                >
                  <td>{report.content}</td>
                  <td>{report.createdBy || "N/A"}</td>
                  <td>{new Date(report.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button onClick={generatePDF} className="generate-pdf-button">
        Download PDF Report
      </button>
    </div>
  );
};

export default ComplaintReport;

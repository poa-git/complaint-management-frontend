import React from "react";
import "./ReportModal.css";
import ReportList from "./ReportList";

/**
 * Props:
 * - isOpen, complaintId, handleClose, allowAdd, onReportAdded
 * - partsLogId, API_BASE_URL, hardwareParts, refreshParts
 * - bankName, branchCode, branchName
 * - complaintCity  // NEW: used to allow Qamar to add parts when city is Karachi
 */
const ReportModal = ({
  isOpen,
  complaintId,
  handleClose,
  allowAdd,
  onReportAdded,
  // parts/management context
  partsLogId,
  API_BASE_URL,
  hardwareParts = [],
  refreshParts,
  bankName,
  branchCode,
  branchName,
  // NEW
  complaintCity,
}) => {
  if (!isOpen) return null;

  return (
    <div className="report-modal-overlay">
      <div className="report-modal">
        <button className="report-modal-close" onClick={handleClose}>
          &times;
        </button>

        <h2>Hardware Reports</h2>

        {/* ReportList now embeds full parts management + part-linked reports */}
        <ReportList
          complaintId={complaintId}
          allowAdd={allowAdd}
          onReportAdded={() => {
            if (onReportAdded) onReportAdded(complaintId);
          }}
          /* provide parts + api so ReportList can manage parts inline */
          partsLogId={partsLogId}
          hardwareParts={hardwareParts}
          refreshParts={refreshParts}
          apiBaseUrl={API_BASE_URL}
          mode="lab" // keep same behavior as your modal by default
          bankName={bankName}
          branchCode={branchCode}
          branchName={branchName}
          /* NEW: gates "Add Part" to Qamar when city is Karachi */
          complaintCity={complaintCity}
        />
      </div>
    </div>
  );
};

export default ReportModal;

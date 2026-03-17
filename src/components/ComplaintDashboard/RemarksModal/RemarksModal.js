import React, { useState } from "react";
import "./RemarksModal.css";
import ComplaintReport from "../../ComplaintReport/ComplaintReport";

const RemarksModal = ({
  isOpen,
  latestRemarks,
  remarksHistory,
  fetchLatestRemarks,
  fetchRemarksHistory,
  handleAddRemarks,
  remarksUpdate,
  setRemarksUpdate,
  closeRemarksModal,
  selectedComplaint,
}) => {
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);

  if (!isOpen || !selectedComplaint) return null;

  const toggleRemarksHistory = () => {
    if (isHistoryVisible) {
      setIsHistoryVisible(false);
    } else {
      fetchRemarksHistory(selectedComplaint.id);
      setIsHistoryVisible(true);
    }
  };

  const handleViewHistory = (complaintId) => {
    setSelectedComplaintId(complaintId);
    setIsHistoryView(true);
  };

  // const handleBackToModal = () => {
  //   setSelectedComplaintId(null);
  //   setIsHistoryView(false);
  // };
  const handleBackToRemarks = () => {
    setIsHistoryView(false);
  };

  return (
    <div className="modal">
      <div
        className="remarks-modal-content"
        style={{
          width: isHistoryView ? "90%" : "500px",
          height: isHistoryView ? "90%" : "auto",
          maxWidth: isHistoryView ? "1200px" : "500px",
          maxHeight: "90vh",
          overflowY: "auto",
          transition: "all 0.3s ease",
        }}
      >
        {isHistoryView ? (
          <>
            {/* ComplaintReport View */}
            <button
              onClick={handleBackToRemarks}
              style={{
                marginBottom: "20px",
                padding: "10px 15px",
                fontSize: "14px",
                fontWeight: "bold",
                color: "#fff",
                backgroundColor: "#007bff",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Back to Remarks
            </button>
            <div style={{ padding: "10px", border: "1px solid #ccc" }}>
              <ComplaintReport complaintId={selectedComplaintId} />
            </div>
          </>
        ) : (
          <>
            {/* Main Remarks Modal */}
            <div className="modal-header">
              <h3>Remarks Details</h3>
              <button className="close-button" onClick={closeRemarksModal}>
                ✖
              </button>
            </div>

            {/* View Latest Remark */}
            <button
              className="remarks-button"
              onClick={() => fetchLatestRemarks(selectedComplaint.id)}
            >
              View Latest Remark
            </button>
            {latestRemarks && (
              <div className="remarks-display">
                <div className="timestamp">
                  <span className="date">
                    {latestRemarks.timestamp.split("T")[0]}
                  </span>
                  <span className="time">
                    {latestRemarks.timestamp.split("T")[1]}
                  </span>
                </div>
                <span className="remark-text">{latestRemarks.remarks}</span>
              </div>
            )}

            {/* Toggle Inline Remarks History */}
            <button className="remarks-button" onClick={toggleRemarksHistory}>
              {isHistoryVisible
                ? "Hide Remarks History"
                : "View Remarks History"}
            </button>
            {isHistoryVisible && remarksHistory.length > 0 && (
              <div className="remarks-history">
                <ul>
                  {remarksHistory.map((entry) => {
                    const [date, time] = entry.timestamp.split("T");
                    return (
                      <li key={entry.id}>
                        <div className="timestamp">
                          <span className="date">{date}</span>
                          <span className="time">{time}</span>
                        </div>
                        <span className="remark-text">{entry.remarks}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Add New Remark Section */}
            <div className="add-remarks">
              <textarea
                className="remarks-textarea"
                value={remarksUpdate}
                onChange={(e) => setRemarksUpdate(e.target.value)}
                placeholder="Add new remark"
              />

              {selectedComplaint.complaintStatus !=="Closed" && (
                <button
                  className="remarks-add-button"
                  onClick={handleAddRemarks}
                >
                  Add
                </button>
              )}
            </div>
            {/* View Full History Button */}
            <div
              className="view-history-container"
              style={{ textAlign: "center", marginTop: "20px" }}
            >
              <button
                className="view-history-btn"
                onClick={() => handleViewHistory(selectedComplaint.complaintId)}
                style={{
                  padding: "10px 20px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#fff",
                  backgroundColor: "#007bff",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  transition: "background-color 0.3s ease",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.backgroundColor = "#0056b3")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.backgroundColor = "#007bff")
                }
              >
                View Full History
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RemarksModal;

import React, { useState, useEffect } from "react";
import "./ComplaintModal.css";
import axios from "axios";
import DatePicker from "react-datepicker";
import ComplaintReport from "../../ComplaintReport/ComplaintReport";
import "react-datepicker/dist/react-datepicker.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const HARDWARE_LOG_STATUSES = ["Hardware Picked", "FOC", "Quotation"];
const HARDWARE_PICKED_STATUS = "Hardware Picked";
const currentUsername = (localStorage.getItem("username") || "User").trim().toLowerCase();

const ComplaintModal = ({
  isOpen,
  selectedComplaint,
  handleCloseModal,
  handleChange,
  handleUpdateComplaintLog,
  statuses,
  handleAddRemarks,
  remarksUpdate,
  setRemarksUpdate,
  role,
}) => {
  const [visitors, setVisitors] = useState([]);
  const [scheduleDate, setScheduleDate] = useState(null);
  const [partList, setPartList] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(
    (localStorage.getItem("username") || "User").trim().toLowerCase()
  );
  
  useEffect(() => {
    // Re-read username from localStorage whenever modal opens
    if (isOpen) {
      setCurrentUsername(
        (localStorage.getItem("username") || "User").trim().toLowerCase()
      );
    }
  }, [isOpen]);
  
  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/data/visitors`, {
          withCredentials: true,
        });
        setVisitors(response.data || []);
      } catch (error) {
        console.error("Error fetching visitors:", error);
      }
    };

    if (isOpen) {
      fetchVisitors();
      if (selectedComplaint) {
        setSelectedEquipment(selectedComplaint.equipmentDescription || "");
      }
    }
  }, [isOpen, selectedComplaint]);

  // STATUS FILTERING
  let filteredStatuses = [];
  if (currentUsername === "abdullah") {
    filteredStatuses = Array.isArray(statuses)
      ? statuses.filter(
          (status) =>
            (status.statusValue || "").trim().toLowerCase() === "visit schedule"
        )
      : [];
  } else {
    filteredStatuses = Array.isArray(statuses)
      ? statuses.filter((status) => {
          const value = (status.statusValue || "").trim().toLowerCase();
          return !(
            (value === "closed" && role !== "ADMIN") ||
            (value === "pending for closed" && currentUsername === "saqib.luqman")
          );
        })
      : [];
  }

  // VISITOR FILTERING
  let filteredVisitors = visitors;
  if (currentUsername === "abdullah") {
    filteredVisitors = visitors.filter(
      (v) => (v.city || "").trim().toLowerCase() === "islamabad"
    );
  }

  if (!isOpen || !selectedComplaint) {
    return null;
  }

  const handleStatusChange = (e) => {
    handleChange(e);
    if (e.target.value === HARDWARE_PICKED_STATUS) {
      setSelectedEquipment("");
    }
  };

  const submitEquipmentUpdate = async () => {
    try {
      await axios.put(
        `${API_BASE_URL}/hardware-logs/${selectedComplaint.complaintId}`,
        { equipmentDescription: selectedEquipment },
        { withCredentials: true }
      );
    } catch (error) {
      console.error("Error updating equipment:", error);
      throw error;
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      await handleUpdateComplaintLog(e, {
        scheduleDate,
        remarks: remarksUpdate,
      });

      if (
        selectedComplaint.complaintStatus === HARDWARE_PICKED_STATUS &&
        selectedEquipment
      ) {
        await submitEquipmentUpdate();
      }

      await handleAddRemarks(remarksUpdate);
      handleCloseModal();
    } catch (error) {
      console.error("Error submitting the form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewHistory = (complaintId) => {
    setSelectedComplaintId(complaintId);
    setIsHistoryView(true);
  };

  const handleBackToModal = () => {
    setSelectedComplaintId(null);
    setIsHistoryView(false);
  };

  const closeModal = () => {
    setScheduleDate(null);
    handleCloseModal();
  };

  return (
    <div className="modal">
      <div
        className="modal-content"
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
            <button
              onClick={handleBackToModal}
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
              Back to Complaint Details
            </button>
            <div style={{ padding: "10px", border: "1px solid #ccc" }}>
              <ComplaintReport complaintId={selectedComplaintId} />
            </div>
          </>
        ) : (
          <>
            <h3>Update Complaint Log</h3>
            <form onSubmit={handleFormSubmit}>
              <label>
                Status:
                <select
                  name="complaintStatus"
                  value={selectedComplaint.complaintStatus || ""}
                  onChange={handleStatusChange}
                >
                  <option value="">Select Status</option>
                  {filteredStatuses.map((status) => (
                    <option key={status.id} value={status.statusValue}>
                      {status.statusValue}
                    </option>
                  ))}
                </select>
              </label>

              {selectedComplaint.complaintStatus === "Visit Schedule" && (
                <label>
                  Schedule Date:
                  <DatePicker
                    selected={scheduleDate}
                    onChange={(date) => setScheduleDate(date)}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="Select a date"
                    required
                  />
                </label>
              )}

              <label>
                Remarks:
                <textarea
                  value={remarksUpdate}
                  onChange={(e) => setRemarksUpdate(e.target.value)}
                  placeholder="Enter remarks"
                />
              </label>

              <label>
                Select Visitor:
                <select
                  name="visitorName"
                  value={selectedComplaint.visitorName || ""}
                  onChange={(e) => {
                    const selectedVisitor = filteredVisitors.find(
                      (visitor) => visitor.name === e.target.value
                    );
                    handleChange({
                      target: {
                        name: "visitorName",
                        value: e.target.value,
                      },
                    });
                    handleChange({
                      target: {
                        name: "visitorId",
                        value: selectedVisitor?.id || "",
                      },
                    });
                  }}
                >
                  <option value="">Select Visitor</option>
                  {filteredVisitors.map((visitor) => (
                    <option key={visitor.id} value={visitor.name}>
                      {visitor.name} - {visitor.city || "No City"}
                    </option>
                  ))}
                </select>
              </label>

              {selectedComplaint.complaintStatus === HARDWARE_PICKED_STATUS && (
                <label>
                  Enter Equipment:
                  <input
                    type="text"
                    name="equipment"
                    value={selectedEquipment}
                    onChange={(e) => setSelectedEquipment(e.target.value)}
                    placeholder="Enter equipment name"
                    required
                    className="equipment-input"
                  />
                </label>
              )}

              <div className="btn-container">
                <button className="btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
                <button className="btn" type="button" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </form>

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
                View History
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComplaintModal;

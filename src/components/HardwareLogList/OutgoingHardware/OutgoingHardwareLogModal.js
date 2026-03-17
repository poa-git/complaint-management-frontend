import React, { useState, useEffect } from "react";
import "./OutgoingHardwareLogModal.css";
import axios from "axios";

const OutgoingHardwareLogModal = ({
  isOpen,
  selectedLog,
  handleCloseModal,
  refreshLogs,
}) => {
  const [courierStatus, setCourierStatus] = useState("");
  const [dispatchCnNumber, setDispatchCnNumber] = useState("");
  const [receivedOutwardDate, setReceivedOutwardDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // Populate initial data on modal open
  useEffect(() => {
    if (isOpen && selectedLog) {
      setCourierStatus(selectedLog?.courierStatus || "");
      setDispatchCnNumber(selectedLog?.dispatchCnNumber || "");
      setReceivedOutwardDate(selectedLog?.receivedOutwardDate || "");
    }
  }, [isOpen, selectedLog]);

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleCourierStatusChange = (event) => {
    const value = event.target.value;
    setCourierStatus(value);

    if (value === "Received Outward") {
      setReceivedOutwardDate(formatDate(new Date())); // Set today's date
    } else {
      setReceivedOutwardDate(""); // Clear the date
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!courierStatus) {
      alert("Courier Status is required.");
      setIsSubmitting(false);
      return;
    }

    if (courierStatus === "Received Outward" && !receivedOutwardDate) {
      alert("Received Outward Date is required for this status.");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        courierStatus,
        dispatchCnNumber,
        receivedOutwardDate: receivedOutwardDate || null,
      };

      console.log("Updating HardwareLog with payload:", payload);

      const hardwareLogResponse = await axios.put(
        `${API_BASE_URL}/hardware-logs/${selectedLog.complaintLog.complaintId}`,
        payload,
        { withCredentials: true }
      );

      if (hardwareLogResponse.status === 200) {
        console.log("Hardware Log updated successfully:", hardwareLogResponse.data);

        if (courierStatus === "Received Outward") {
          const complaintStatusUpdate = { complaintStatus: "Delivered" };

          const complaintResponse = await axios.put(
            `${API_BASE_URL}/complaints/${selectedLog.complaintLog.id}`,
            complaintStatusUpdate,
            { withCredentials: true }
          );

          if (complaintResponse.status === 200) {
            console.log("Complaint status updated to Delivered:", complaintResponse.data);
          } else {
            console.error("Failed to update complaint status:", complaintResponse.status);
            alert("Failed to update complaint status. Please try again.");
          }
        }

        refreshLogs();
        handleCloseModal();
      } else {
        alert("Failed to update hardware log. Please try again.");
      }
    } catch (error) {
      console.error("Error while updating hardware log:", error);

      if (error.response) {
        const { status, data } = error.response;
        alert(`Error ${status}: ${data.message || "Unexpected error occurred."}`);
      } else {
        alert("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !selectedLog) return null;

  return (
    <div className="hardware-modal">
      <div className="hardware-modal-content">
        <button
          className="hardware-modal-close"
          aria-label="Close Modal"
          onClick={handleCloseModal}
        >
          &times;
        </button>
        <h3 className="hardware-modal-title">Update Outgoing Hardware Log</h3>
        <form onSubmit={handleSubmit} className="hardware-modal-form">
          <div>
            <label htmlFor="courierStatus">Courier Status:</label>
            <select
              id="courierStatus"
              value={courierStatus}
              onChange={handleCourierStatusChange}
             
            >
              <option value="">Select Courier Status</option>
              <option value="Received Outward">Received Outward</option>
              {/* Add other status options if needed */}
            </select>
          </div>

          <div>
            <label htmlFor="dispatchCnNumber">Dispatch CN Number:</label>
            <input
              type="text"
              id="dispatchCnNumber"
              value={dispatchCnNumber || ""}
              onChange={(e) => setDispatchCnNumber(e.target.value)}
              placeholder="Enter Dispatch CN Number"
            />
          </div>

          {courierStatus === "Received Outward" && (
            <div>
              <label htmlFor="receivedOutwardDate">Received Outward Date:</label>
              <input
                type="date"
                id="receivedOutwardDate"
                value={receivedOutwardDate || ""}
                onChange={(e) => setReceivedOutwardDate(e.target.value)}
                
              />
            </div>
          )}

          <div className="form-buttons">
            <button
              className="btn-primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={handleCloseModal}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OutgoingHardwareLogModal;

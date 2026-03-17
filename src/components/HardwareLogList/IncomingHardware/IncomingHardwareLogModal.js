import React, { useState, useEffect } from "react";
import axios from "axios";
import "./IncomingHardwareLogModal.css";

const IncomingHardwareLogModal = ({
  isOpen,
  selectedLog,
  handleCloseModal,
  refreshLogs,
}) => {
  const [courierStatus, setCourierStatus] = useState("");
  const [dispatchInwardDate, setDispatchInwardDate] = useState("");
  const [receivingCnNumber, setReceivingCnNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    if (isOpen && selectedLog) {
      setCourierStatus(selectedLog?.courierStatus || "");
      setDispatchInwardDate(selectedLog?.dispatchInwardDate || "");
      setReceivingCnNumber(selectedLog?.receivingCnNumber || "");
    }
  }, [isOpen, selectedLog]);

  if (!isOpen || !selectedLog) return null;

  const handleCourierStatusChange = (event) => {
    setCourierStatus(event.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!courierStatus) {
      alert("Courier Status is required.");
      return;
    }
    if (courierStatus === "Dispatch Inward" && !dispatchInwardDate) {
      alert("Dispatch Inward Date is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        courierStatus,
        dispatchInwardDate,
        receivingCnNumber,
      };

      const response = await axios.put(
        `${API_BASE_URL}/hardware-logs/${selectedLog.complaintLog.complaintId}`,
        payload,
        { withCredentials: true }
      );

      if (response.status === 200) {
        alert("Hardware log updated successfully!");
        refreshLogs();
        handleCloseModal();
      } else {
        alert("Failed to update hardware log. Please try again.");
      }
    } catch (error) {
      console.error("Error updating hardware log:", error);
      alert(
        error.response?.data?.message ||
          "An error occurred while updating the hardware log."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <h3 className="hardware-modal-title">Update Incoming Hardware Log</h3>
        <form onSubmit={handleSubmit} className="hardware-modal-form">
          <div>
            <label htmlFor="courierStatus">Courier Status:</label>
            <select
              id="courierStatus"
              value={courierStatus}
              onChange={handleCourierStatusChange}
              required
            >
              <option value="">Select Courier Status</option>
              <option value="Dispatch Inward">Dispatch Inward</option>
              {/* Add other status options if needed */}
            </select>
          </div>

          {courierStatus === "Dispatch Inward" && (
            <div>
              <label htmlFor="dispatchInwardDate">Dispatch Inward Date:</label>
              <input
                type="date"
                id="dispatchInwardDate"
                value={dispatchInwardDate}
                onChange={(e) => setDispatchInwardDate(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="receivingCnNumber">CN Number:</label>
            <input
              type="text"
              id="receivingCnNumber"
              value={receivingCnNumber}
              onChange={(e) => setReceivingCnNumber(e.target.value)}
              placeholder="Enter Receiving CN Number"
            />
          </div>

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

export default IncomingHardwareLogModal;

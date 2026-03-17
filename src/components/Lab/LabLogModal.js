import React, { useState, useEffect } from "react";
import "./LabLogModal.css";
import axios from "axios";

const LabLogModal = ({
  isOpen,
  selectedLog,
  handleCloseModal,
  refreshLogs,
  complaintStatus,
}) => {
  const [courierStatus, setCourierStatus] = useState("");
  const [receivedInwardDate, setReceivedInwardDate] = useState("");
  const [receivedOutwardDate, setReceivedOutwardDate] = useState("");
  const [hOkDate, setHOkDate] = useState("");
  const [outOfStockDate,setOutOfStockDate] = useState("");
  const [dispatchOutwardDate, setDispatchOutwardDate] = useState("");
  const [extraHardware, setExtraHardware] = useState("");
  const [report, setReport] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [labEngineers, setLabEngineers] = useState([]);
  const [labEngineer, setLabEngineer] = useState(""); // <-- this is for the selected engineer
  const [initialLabEngineer, setInitialLabEngineer] = useState("");
  const [reassign, setReassign] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const resetModalFields = () => {
    setCourierStatus("");
    setReceivedInwardDate("");
    setReceivedOutwardDate("");
    setHOkDate("");
    setOutOfStockDate("")
    setDispatchOutwardDate("");
    setExtraHardware("");
    setReport("");
    setLabEngineer("");
  };

  // Populate initial data on modal open
  useEffect(() => {
    if (isOpen && selectedLog) {
      setCourierStatus(selectedLog?.courierStatus || "");
      setReceivedInwardDate(formatDate(selectedLog?.receivedInwardDate || ""));
      setHOkDate(formatDate(selectedLog?.hOkDate || ""));
      setOutOfStockDate(formatDate(selectedLog?.outOfStockDate || ""));
      setDispatchOutwardDate(
        formatDate(selectedLog?.dispatchOutwardDate || "")
      );
      setExtraHardware(selectedLog?.extraHardware || "");
      setReport(selectedLog?.report || "");
      setLabEngineer(selectedLog?.labEngineer || ""); // Corrected!
      setInitialLabEngineer(selectedLog?.labEngineer || ""); // Track initial
      setReassign(false);
    }
  }, [isOpen, selectedLog]);

  useEffect(() => {
    if (isOpen) {
      axios
        .get(`${API_BASE_URL}/data/lab-engineers`, { withCredentials: true })
        .then((res) => setLabEngineers(res.data))
        .catch((err) => {
          setLabEngineers([]);
          // handle error as needed
        });
    }
  }, [isOpen, API_BASE_URL]);

  // Helper function to format dates as yyyy-MM-dd
  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Early return if modal is closed or no log is selected
  if (!isOpen || !selectedLog) {
    return null;
  }

  // Handle courier status change
  const handleCourierStatusChange = (event) => {
    const value = event.target.value;
    const today = formatDate(new Date());
    const isKarachi = selectedLog?.complaintLog?.city === "Karachi";

    if (value === "Dispatch Outward") {
      if (isKarachi) {
        setCourierStatus("Received Outward");
        setDispatchOutwardDate(today);
        setReceivedOutwardDate(today);
      } else {
        setCourierStatus(value);
        setDispatchOutwardDate(today);
      }
      setReceivedInwardDate("");
      setHOkDate("");
    } else if (value === "Received Inward") {
      setCourierStatus(value);
      setReceivedInwardDate(today);
      setHOkDate("");
      setDispatchOutwardDate("");
    } else if (value === "Hardware Ready") {
      setCourierStatus(value);
      setHOkDate(today);
      setReceivedInwardDate("");
      setDispatchOutwardDate("");
    } else if (value === "Out Of Stock") {
      setCourierStatus(value);
      setOutOfStockDate(today);
      setReceivedInwardDate("");
      setDispatchOutwardDate("");
      setHOkDate("");
    }else {
      setCourierStatus(value);
      setReceivedInwardDate("");
      setHOkDate("");
      setDispatchOutwardDate("");
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const hardwareLogUpdate = {
        courierStatus,
        receivedInwardDate: receivedInwardDate || null,
        hOkDate: hOkDate || null,
        outOfStockDate: outOfStockDate || null, 
        dispatchOutwardDate: dispatchOutwardDate || null,
        extraHardware,
        labEngineer,
      };

      // Only set done=false if the engineer was changed (and is not blank)
      if (labEngineer && (labEngineer !== initialLabEngineer || reassign)) {
        hardwareLogUpdate.done = false;
      }

      console.log("Updating HardwareLog with payload:", hardwareLogUpdate);

      const hardwareLogResponse = await axios.put(
        `${API_BASE_URL}/hardware-logs/${selectedLog.complaintLog.complaintId}`,
        hardwareLogUpdate,
        { withCredentials: true }
      );

      if (hardwareLogResponse.status === 200) {
        console.log(
          "Hardware Log updated successfully:",
          hardwareLogResponse.data
        );
        refreshLogs();
        resetModalFields();
        handleCloseModal();
      } else {
        console.error(
          "Unexpected response status:",
          hardwareLogResponse.status
        );
        alert("Failed to update hardware log. Please try again.");
      }
    } catch (error) {
      console.error("Error while updating hardware log:", error);

      if (error.response) {
        const { status, data } = error.response;
        console.error("Error Response Data:", data);
        alert(
          `Error ${status}: ${data.message || "Unexpected error occurred."}`
        );
      } else {
        alert("An unexpected error occurred. Please try again.");
      }
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
        <h3 className="hardware-modal-title">Update Lab Hardware</h3>
        <form onSubmit={handleSubmit} className="hardware-modal-form">
          {/* Courier Status */}
          <div>
            <label htmlFor="courierStatus">Courier Status:</label>
            <select
              id="courierStatus"
              value={courierStatus}
              onChange={handleCourierStatusChange}
              aria-label="Courier Status"
            >
              <option value="">Select Courier Status</option>
              <option value="Received Inward">Received Inward</option>
              <option value="Hardware Ready">Hardware Ready</option>
              <option value="Dispatch Outward">Dispatch Outward</option>
              <option value="Observation">Observation</option>
              <option value="Out Of Stock">Out Of Stock</option>
            </select>
          </div>

          {/* Received Inward Date */}
          <div>
            <label htmlFor="receivedInwardDate">Received Inward Date:</label>
            <input
              type="date"
              id="receivedInwardDate"
              value={receivedInwardDate || ""}
              onChange={(e) => setReceivedInwardDate(e.target.value)}
              placeholder="Select received inward date"
              readOnly
            />
          </div>

          {/* HOK Date */}
          <div>
            <label htmlFor="hOkDate">HOK Date:</label>
            <input
              type="date"
              id="hOkDate"
              value={hOkDate || ""}
              onChange={(e) => setHOkDate(e.target.value)}
              placeholder="Select HOK date"
              readOnly
            />
          </div>

          {/* Dispatch Outward Date */}
          <div>
            <label htmlFor="dispatchOutwardDate">Dispatch Outward Date:</label>
            <input
              type="date"
              id="dispatchOutwardDate"
              value={dispatchOutwardDate || ""}
              onChange={(e) => setDispatchOutwardDate(e.target.value)}
              placeholder="Select dispatch outward date"
              readOnly
            />
          </div>

          {/* Extra Hardware */}
          <div>
            <label htmlFor="extraHardware">Extra Hardware:</label>
            <input
              type="text"
              id="extraHardware"
              value={extraHardware}
              onChange={(e) => setExtraHardware(e.target.value)}
              placeholder="Enter extra hardware details"
            />
          </div>

          {/* Lab Engineer Dropdown */}
          <div>
            <label htmlFor="labEngineer">Assign to Lab Engineer:</label>
            <select
              id="labEngineer"
              value={labEngineer}
              onChange={(e) => setLabEngineer(e.target.value)}
            >
              <option value="">Select Engineer</option>
              {labEngineers.map((engineer) => (
                <option key={engineer.id} value={engineer.username}>
                  {engineer.username}
                </option>
              ))}
            </select>
          </div>
          {/* Lab Reassign Dropdown */}
          <div className="reassign-checkbox-group">
            <input
              type="checkbox"
              id="labReassign"
              checked={reassign}
              onChange={(e) => setReassign(e.target.checked)}
            />
            <label htmlFor="labReassign">
              Mark as <span style={{ color: "#3a8de4" }}>Reassigned</span>{" "}
            </label>
            {/* <span
              className="info-tooltip"
              title="Check this to mark as not done and start work again (even if engineer is the same)."
            >
              &#9432;
            </span> */}
          </div>

          {/* Form Buttons */}
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

export default LabLogModal;

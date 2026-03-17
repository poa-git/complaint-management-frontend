import React, { useState, useEffect } from "react";
import axios from "axios";
import "./HardwarePartsModal.css";

const HardwarePartsModal = ({
  logId,
  hardwareParts,
  refreshParts,
  onClose,
  API_BASE_URL,
  isOpen,
  bankName,
  branchCode,
  branchName,
  mode, // "lab", "incoming", or "outgoing"
}) => {
  const [newPart, setNewPart] = useState("");
  const [newAssignedEngineer, setNewAssignedEngineer] = useState("");
  const [adding, setAdding] = useState(false);
  const [labEngineers, setLabEngineers] = useState([]);
  const [actioningPartId, setActioningPartId] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(
    (localStorage.getItem("username") || "User").trim().toLowerCase()
  );

  const isQamar = currentUsername === "qamar";
  const isSaqib = currentUsername === "saqib.luqman";
  const isIbad = currentUsername === "ibad"


  useEffect(() => {
    const handler = () => {
      setCurrentUsername(
        (localStorage.getItem("username") || "User").trim().toLowerCase()
      );
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    if (isOpen) {
      axios
        .get(`${API_BASE_URL}/data/lab-engineers`, { withCredentials: true })
        .then((res) => setLabEngineers(res.data))
        .catch(() => setLabEngineers([]));
    }
  }, [isOpen, API_BASE_URL]);

  const handleAccept = async (part) => {
    setActioningPartId(part.id);
    await axios.put(
      `${API_BASE_URL}/hardware-logs/${logId}/parts/${part.id}`,
      {
        availableWithEngineer: true,
        acceptedAt: new Date().toISOString(),
        hardwareName: part.hardwareName,
        assignedEngineer: part.assignedEngineer,
      },
      { withCredentials: true }
    );
    await refreshParts();
    setActioningPartId(null);
  };

  
  const handleAdd = async () => {
    if (!newPart.trim()) return;
    setAdding(true);
    await axios.post(
      `${API_BASE_URL}/hardware-logs/${logId}/parts`,
      {
        hardwareName: newPart,
        repaired: false,
        availableWithEngineer: false,
        assignedEngineer: newAssignedEngineer || null,
        notRepairable: false,
      },
      { withCredentials: true }
    );
    setNewPart("");
    setNewAssignedEngineer("");
    await refreshParts();
    setAdding(false);
  };

  const handleDelete = async (part) => {
    if (!window.confirm("Delete this hardware part?")) return;
    setActioningPartId(part.id);
    await axios.delete(
      `${API_BASE_URL}/hardware-logs/${logId}/parts/${part.id}`,
      { withCredentials: true }
    );
    await refreshParts();
    setActioningPartId(null);
  };

  const formatDateTime = (dt) => {
    if (!dt) return null;
    try {
      const d = new Date(dt);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    } catch {
      return dt;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modern">
        <h2 className="modal-title">Hardware Parts</h2>
        <div
          style={{
            marginBottom: 14,
            color: "#234",
            background: "#f2f6fa",
            padding: "9px 14px",
            borderRadius: 7,
            fontSize: 15,
            fontWeight: 500,
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <span>
            <b>Bank:</b> {bankName || "-"} &nbsp;|&nbsp; <b>Branch Code:</b>{" "}
            {branchCode || "-"} &nbsp;|&nbsp; <b>Branch Name:</b>{" "}
            {branchName || "-"}
          </span>
        </div>
        <ul className="hardware-parts-list">
          {hardwareParts === undefined ? (
            <li>Loading...</li>
          ) : hardwareParts.length === 0 ? (
            <li>No parts.</li>
          ) : mode === "outgoing" ? (
            hardwareParts.map((part, idx) => (
              <li key={part.id} className="part-row-card">
                <span className="part-name">
                  {part.hardwareName && part.hardwareName.trim()
                    ? part.hardwareName
                    : `part ${idx + 1}`}
                </span>
                {part.assignedEngineer && (
                  <span
                    className="assigned-engineer"
                    style={{ marginLeft: 10, fontWeight: 500 }}
                  >
                    Assigned to: <b>{part.assignedEngineer}</b>
                  </span>
                )}
              </li>
            ))
          ) : (
            hardwareParts.map((part, idx) => {
              const isMine =
                (part.assignedEngineer || "").trim().toLowerCase() ===
                currentUsername;

              let status = "Not Repaired";
              let statusClass = "no";
              if (part.repaired) {
                status = "Repaired";
                statusClass = "yes";
              } else if (part.notRepairable) {
                status = "Not Repairable";
                statusClass = "not-repairable";
              } else if (!part.availableWithEngineer) {
                status = "Pending";
                statusClass = "pending";
              }

              // ---- LAB MODE ----
              if (mode === "lab") {
                const isPendingIncoming =
                  !part.availableWithEngineer && !part.assignedEngineer;
                const isAssigned = !!part.assignedEngineer;
                const isMine =
                  (part.assignedEngineer || "").trim().toLowerCase() ===
                  currentUsername;

                return (
                  <li key={part.id} className="part-row-card">
                    <span className="part-name">
                      {part.hardwareName && part.hardwareName.trim()
                        ? part.hardwareName
                        : `part ${idx + 1}`}
                    </span>
                    {/* Assigned engineer display */}
                    {isAssigned && (
                      <span
                        className="assigned-engineer"
                        style={{ marginLeft: 10, fontWeight: 500 }}
                      >
                        Assigned to: <b>{part.assignedEngineer}</b>
                      </span>
                    )}

                    {/* Qamar: Accept new incoming parts, only when not assigned */}
                    {isPendingIncoming && isQamar && (
                      <button
                        className="accept-btn"
                        onClick={() => handleAccept(part)}
                        disabled={actioningPartId === part.id}
                      >
                        Accept (Received)
                      </button>
                    )}

                
                    <span className={`repaired-status ${statusClass}`}>
                      {status}
                    </span>
                    <div className="part-times">
                      {part.repairedAt && (
                        <span title="Repaired At">
                          <b>Repaired:</b> {formatDateTime(part.repairedAt)}
                        </span>
                      )}
                      {part.notRepairableAt && (
                        <span title="Marked Not Repairable At">
                          <b>Not Repairable:</b>{" "}
                          {formatDateTime(part.notRepairableAt)}
                        </span>
                      )}
                    </div>
                  </li>
                );
              }

              // ---- INCOMING MODE ----
              return (
                <li
                  key={part.id}
                  className={`part-row-card ${isMine ? "mine" : ""}`}
                >
                  <span className="part-name">
                    {part.hardwareName && part.hardwareName.trim()
                      ? part.hardwareName
                      : `part ${idx + 1}`}
                  </span>
                  {!part.availableWithEngineer &&
                    isMine &&
                    !part.repaired &&
                    !part.notRepairable && (
                      <button
                        className="accept-btn"
                        onClick={() => handleAccept(part)}
                        disabled={actioningPartId === part.id}
                      >
                        Accept
                      </button>
                    )}
                  {/* {isQamar && (
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(part)}
                      disabled={actioningPartId === part.id}
                      style={{ marginLeft: 8, color: "crimson" }}
                    >
                      Delete
                    </button>
                  )} */}
                  <span className={`repaired-status ${statusClass}`}>
                    {status}
                  </span>
                  <div className="part-times">
                    {part.repairedAt && (
                      <span title="Repaired At">
                        <b>Repaired:</b> {formatDateTime(part.repairedAt)}
                      </span>
                    )}
                    {part.notRepairableAt && (
                      <span title="Marked Not Repairable At">
                        <b>Not Repairable:</b>{" "}
                        {formatDateTime(part.notRepairableAt)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
        {/* Only show Add in INCOMING mode */}
        {mode === "incoming" && (isSaqib || isIbad) && (
          <div className="add-part-row part-row-card add-part-row-upgrade">
            <input
              value={newPart}
              onChange={(e) => setNewPart(e.target.value)}
              placeholder="New hardware name"
              className="add-part-input"
              disabled={adding}
            />
            <select
              value={newAssignedEngineer}
              onChange={(e) => setNewAssignedEngineer(e.target.value)}
              className="engineer-select"
              disabled={adding || !isQamar}
            >
              <option value="">Assign Engineer (optional)</option>
              {labEngineers.map((eng) =>
                typeof eng === "string" ? (
                  <option key={eng} value={eng}>
                    {eng}
                  </option>
                ) : (
                  <option key={eng.id} value={eng.username}>
                    {eng.username}
                  </option>
                )
              )}
            </select>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="add-part-btn"
            >
              Add
            </button>
          </div>
        )}
        <button className="close-modal-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default HardwarePartsModal;

import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import "./ReportList.css";

/**
 * Tag format used to keep the part association without backend changes:
 *   [#part:<id>|<name>] <original content>
 */
const PART_TAG_REGEX = /^\[#part:(?<id>[^|]+)\|(?<name>[^\]]+)\]\s*/i;

function parsePartTag(content = "") {
  if (!content) return { partId: null, partName: null, stripped: "" };
  const m = content.match(PART_TAG_REGEX);
  if (!m) return { partId: null, partName: null, stripped: content };
  const { id, name } = m.groups || {};
  return {
    partId: String(id || ""),
    partName: name || null,
    stripped: content.replace(PART_TAG_REGEX, ""),
  };
}

/**
 * Existing props:
 * - complaintId (required)
 * - allowAdd (bool)
 * - onReportAdded (fn)
 *
 * New optional props (for embedded parts management):
 * - partsLogId: number|string (the log id used by parts APIs)
 * - hardwareParts: array of parts
 * - refreshParts: () => void (to refetch parts)
 * - apiBaseUrl: string (defaults to env)
 * - mode: "lab" | "incoming" | "outgoing"  (default "lab")
 * - bankName, branchCode, branchName: optional labels (for context header)
 *
 * New prop for this feature:
 * - complaintCity: string  (when "Karachi", only qamar can add parts)
 */
const ReportList = ({
  complaintId,
  allowAdd,
  onReportAdded,

  // NEW (all optional for parts embed)
  partsLogId,
  hardwareParts = [],
  refreshParts,
  apiBaseUrl,
  mode = "lab",
  bankName,
  branchCode,
  branchName,

  // NEW: determines whether qamar is allowed to add parts (Karachi only)
  complaintCity,
}) => {
  const BASE_URL = apiBaseUrl || process.env.REACT_APP_API_BASE_URL || "";

  // --------- Reports state ----------
  const [reports, setReports] = useState([]);
  const [newReport, setNewReport] = useState("");
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // tie report to part
  const [selectedPartId, setSelectedPartId] = useState("");

  // --------- Parts mgmt state ----------
  const canManageParts = !!partsLogId;
  const [labEngineers, setLabEngineers] = useState([]);
  const [actioningPartId, setActioningPartId] = useState(null);

  // NEW: local Add Part UI state (Karachi + Qamar only)
  const [addingPart, setAddingPart] = useState(false);
  const [newPartName, setNewPartName] = useState("");
  const [newPartEngineer, setNewPartEngineer] = useState("");

  const [currentUsername, setCurrentUsername] = useState(
    (localStorage.getItem("username") || "User").trim().toLowerCase()
  );
  const isQamar = currentUsername === "qamar";
  

  // Karachi gate
  const isKarachi = String(complaintCity || "").trim().toLowerCase() === "karachi";
  // ✅ Only qamar may add parts, but only when complaint city is Karachi
  const canAddParts = !!partsLogId && isQamar && isKarachi;

  useEffect(() => {
    const handler = () => {
      setCurrentUsername(
        (localStorage.getItem("username") || "User").trim().toLowerCase()
      );
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // fetch reports
  useEffect(() => {
    if (complaintId && BASE_URL) {
      fetchReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintId, BASE_URL]);

  const fetchReports = async () => {
    try {
      setIsLoadingReports(true);
      const response = await axios.get(
        `${BASE_URL}/hardware-logs/${complaintId}/reports`,
        { withCredentials: true }
      );
      const list = Array.isArray(response.data) ? response.data : [];
      list.sort(
        (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      ); // oldest -> newest
      setReports(list);
    } catch (error) {
      console.error("Error fetching reports:", error);
      setReports([]);
    } finally {
      setIsLoadingReports(false);
    }
  };

  // fetch engineers for parts mgmt (also needed for Add Part row)
  useEffect(() => {
    if ((canManageParts || canAddParts) && BASE_URL) {
      axios
        .get(`${BASE_URL}/data/lab-engineers`, { withCredentials: true })
        .then((res) => setLabEngineers(res.data || []))
        .catch(() => setLabEngineers([]));
    }
  }, [canManageParts, canAddParts, BASE_URL]);

  // convenience
  const partsForSelection = Array.isArray(hardwareParts) ? hardwareParts : [];
  const canChoosePart = canManageParts && partsForSelection.length > 0;

  const selectedPart = useMemo(
    () =>
      partsForSelection.find((p) => String(p.id) === String(selectedPartId)),
    [partsForSelection, selectedPartId]
  );

  // ---------- Parts mgmt handlers (same endpoints as HardwarePartsModal) ----------
  const handleAccept = async (part) => {
    if (!canManageParts) return;
    try {
      setActioningPartId(part.id);
      await axios.put(
        `${BASE_URL}/hardware-logs/${partsLogId}/parts/${part.id}`,
        {
          availableWithEngineer: true,
          acceptedAt: new Date().toISOString(),
          hardwareName: part.hardwareName,
          assignedEngineer: part.assignedEngineer,
        },
        { withCredentials: true }
      );
      await refreshParts?.();
    } catch (e) {
      console.error(e);
      alert("Failed to accept part.");
    } finally {
      setActioningPartId(null);
    }
  };

  const handleAssignEngineer = async (part, engineerUsername) => {
    if (!canManageParts) return;

    // 🔐 Only qamar may assign / reassign / clear
    if (!isQamar) {
      alert("Only qamar can change engineer assignment.");
      return;
    }

    try {
      setActioningPartId(part.id);
      await axios.put(
        `${BASE_URL}/hardware-logs/${partsLogId}/parts/${part.id}`,
        {
          assignedEngineer: engineerUsername || null, // empty string clears assignment
          hardwareName: part.hardwareName,
        },
        { withCredentials: true }
      );
      await refreshParts?.();
    } catch (e) {
      console.error(e);
      alert("Failed to assign engineer.");
    } finally {
      setActioningPartId(null);
    }
  };

  const isCurrentEngineerFor = (part) =>
    (part?.assignedEngineer || "").trim().toLowerCase() === currentUsername;

  const handleMarkRepaired = async (part) => {
    if (!canManageParts) return;

    // Only the assigned engineer, after acceptance, can mark repaired
    if (!part?.availableWithEngineer || !isCurrentEngineerFor(part)) {
      alert("Only the assigned engineer who has accepted the hardware can mark it repaired.");
      return;
    }

    if (!window.confirm("Mark this hardware as REPAIRED?")) return;

    try {
      setActioningPartId(part.id);
      await axios.patch(
        `${BASE_URL}/hardware-logs/parts/${part.id}/repaired`,
        {},
        { withCredentials: true }
      );
      await refreshParts?.();
    } catch (e) {
      console.error(e);
      alert("Failed to mark repaired.");
    } finally {
      setActioningPartId(null);
    }
  };

  const handleMarkNotRepairable = async (part) => {
    if (!canManageParts) return;

    // Only the assigned engineer, after acceptance, can mark not repairable
    if (!part?.availableWithEngineer || !isCurrentEngineerFor(part)) {
      alert("Only the assigned engineer who has accepted the hardware can mark it not repairable.");
      return;
    }

    if (!window.confirm("Mark this hardware as NOT REPAIRABLE?")) return;

    try {
      setActioningPartId(part.id);
      await axios.patch(
        `${BASE_URL}/hardware-logs/parts/${part.id}/not-repairable`,
        {},
        { withCredentials: true }
      );
      await refreshParts?.();
    } catch (e) {
      console.error(e);
      alert("Failed to mark not repairable.");
    } finally {
      setActioningPartId(null);
    }
  };

  // ---------- Add part (Karachi + Qamar only) ----------
  const handleAddPart = async () => {
    if (!canAddParts) return;
    if (!newPartName.trim()) {
      alert("Enter a hardware name.");
      return;
    }
    try {
      setAddingPart(true);
      await axios.post(
        `${BASE_URL}/hardware-logs/${partsLogId}/parts`,
        {
          hardwareName: newPartName.trim(),
          repaired: false,
          availableWithEngineer: false,
          assignedEngineer: newPartEngineer || null,
          notRepairable: false,
        },
        { withCredentials: true }
      );
      setNewPartName("");
      setNewPartEngineer("");
      await refreshParts?.();
    } catch (e) {
      console.error(e);
      alert("Failed to add part.");
    } finally {
      setAddingPart(false);
    }
  };

  // ---------- Report submit (requires part when available) ----------
  const handleAddReport = async () => {
    if (!newReport.trim()) return;

    if (canChoosePart && !selectedPartId) {
      alert("Please select the hardware part for this report.");
      return;
    }

    const prefix = canChoosePart
      ? `[#part:${selectedPartId}|${selectedPart?.hardwareName || "Part"}] `
      : "";

    try {
      setSubmitting(true);
      const payload = { content: `${prefix}${newReport.trim()}` };
      const response = await axios.post(
        `${BASE_URL}/hardware-logs/${complaintId}/reports`,
        payload,
        { withCredentials: true }
      );

      setReports((prev) => [...prev, response.data]);
      setNewReport("");
      if (canChoosePart) setSelectedPartId("");
      onReportAdded?.(complaintId);
    } catch (error) {
      console.error("Error adding report:", error);
      alert("Failed to add report.");
    } finally {
      setSubmitting(false);
    }
  };

  // -------- group reports by part for strong visual linkage --------
  const grouped = useMemo(() => {
    const map = new Map(); // partId -> { headerLabel, items[] }
    const UNASSIGNED = "__UNASSIGNED__";

    // initialize groups for known parts so order follows parts list
    partsForSelection.forEach((p) => {
      map.set(String(p.id), {
        headerLabel: p.hardwareName || `Part #${p.id}`,
        items: [],
      });
    });

    // place reports in groups
    reports.forEach((r) => {
      const { partId, partName, stripped } = parsePartTag(r.content || "");
      const clean = { ...r, content: stripped };
      if (partId && map.has(String(partId))) {
        map.get(String(partId)).items.push(clean);
      } else if (partId) {
        // unknown tag -> still show
        if (!map.has(String(partId))) {
          map.set(String(partId), {
            headerLabel: partName ? `${partName} (#${partId})` : `Part #${partId}`,
            items: [],
          });
        }
        map.get(String(partId)).items.push(clean);
      } else {
        if (!map.has(UNASSIGNED)) {
          map.set(UNASSIGNED, { headerLabel: "Unassigned", items: [] });
        }
        map.get(UNASSIGNED).items.push(clean);
      }
    });

    // return entries preserving the order: known parts, then unknown-tag parts, then unassigned
    const entries = [];
    partsForSelection.forEach((p) => {
      const key = String(p.id);
      if (map.has(key)) entries.push([key, map.get(key)]);
    });
    for (const [k, v] of map.entries()) {
      if (!partsForSelection.some((p) => String(p.id) === k) && k !== UNASSIGNED) {
        entries.push([k, v]);
      }
    }
    if (map.has(UNASSIGNED)) entries.push([UNASSIGNED, map.get(UNASSIGNED)]);
    return entries;
  }, [reports, partsForSelection]);

  // ---------- UI helpers ----------
  const statusChip = (part) => {
    let label = "Pending";
    let cls = "pending";

    if (part?.repaired) {
      label = "Repaired";
      cls = "yes";
    } else if (part?.notRepairable) {
      label = "Not Repairable";
      cls = "not-repairable";
    } else if (!part?.availableWithEngineer) {
      label = "Pending";
      cls = "pending";
    } else {
      label = "In Progress";
      cls = "progress";
    }

    return <span className={`status-chip ${cls}`}>{label}</span>;
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
    <div className="report-container">
      <h3 className="report-title">Hardware Reports</h3>

      {/* ----- Context line for quick reference ----- */}
      {(canManageParts || canAddParts) && (
        <div className="part-context-line">
          <b>Bank:</b> {bankName || "-"} &nbsp;|&nbsp; <b>Branch Code:</b> {branchCode || "-"} &nbsp;|&nbsp;{" "}
          <b>Branch Name:</b> {branchName || "-"}
        </div>
      )}

      {/* ===== Add Part (visible only to qamar when complaint city is Karachi) ===== */}
      {canAddParts && (
        <div className="part-card add-part-row">
          <div className="part-header">
            <div className="part-title">
              <span className="part-bullet" />
              <span className="part-name">Add New Hardware Part</span>
              <span className="status-chip progress">Karachi</span>
            </div>
          </div>
          <div className="add-part-grid">
            <input
              className="input"
              placeholder="Hardware name"
              value={newPartName}
              onChange={(e) => setNewPartName(e.target.value)}
              disabled={addingPart}
            />
            <select
              className="engineer-select"
              value={newPartEngineer}
              onChange={(e) => setNewPartEngineer(e.target.value)}
              disabled={addingPart}
            >
              <option value="">Assign Engineer (optional)</option>
              {labEngineers.map((eng) =>
                typeof eng === "string" ? (
                  <option key={eng} value={eng}>{eng}</option>
                ) : (
                  <option key={eng.id ?? eng.username} value={eng.username}>
                    {eng.username}
                  </option>
                )
              )}
            </select>
            <button
              className="btn"
              onClick={handleAddPart}
              disabled={addingPart || !newPartName.trim()}
            >
              {addingPart ? "Adding…" : "Add Part"}
            </button>
          </div>
        </div>
      )}

      {/* ===== Embedded Parts Management + Grouped Reports by Part ===== */}
      {grouped.length === 0 && !isLoadingReports && (
        <div className="report-empty">No reports found.</div>
      )}

      {grouped.map(([key, group]) => {
        const isUnassigned = key === "__UNASSIGNED__";
        const part = partsForSelection.find((p) => String(p.id) === key);

        return (
          <div key={key} className="part-card">
            {/* Header: part name + status + assignee + inline mgmt */}
            <div className="part-header">
              <div className="part-title">
                <span className="part-bullet" />
                <span className="part-name">{group.headerLabel}</span>
                {!isUnassigned && part && statusChip(part)}
                {!isUnassigned && part?.assignedEngineer && (
                  <span className="assignee">
                    Assigned: <b>{part.assignedEngineer}</b>
                  </span>
                )}
              </div>

              {/* Inline management (mirrors your modal), only for real parts */}
              {!isUnassigned && canManageParts && part && (
                <div className="part-actions">
                  {/* Accept states */}
                  {!part.assignedEngineer && !part.availableWithEngineer && isQamar && (
                    <button
                      className="btn tiny"
                      onClick={() => handleAccept(part)}
                      disabled={actioningPartId === part.id}
                    >
                      Accept (Received)
                    </button>
                  )}
                  {part.assignedEngineer &&
                    !part.availableWithEngineer &&
                    (part.assignedEngineer || "").trim().toLowerCase() === currentUsername && (
                      <button
                        className="btn tiny"
                        onClick={() => handleAccept(part)}
                        disabled={actioningPartId === part.id}
                      >
                        Accept (Engineer)
                      </button>
                    )}

                  {/* Assign / Reassign engineer (admin only) */}
                  {!part.repaired && !part.notRepairable && (
                    <div className="assign-inline">
                      <select
                        className="engineer-select tiny"
                        value={part.assignedEngineer || ""}
                        onChange={(e) => handleAssignEngineer(part, e.target.value)}
                        disabled={actioningPartId === part.id}
                        title={part.assignedEngineer ? "Reassign engineer" : "Assign engineer"}
                      >
                        <option value="">
                          {part.assignedEngineer ? "— Unassign —" : "Assign Engineer"}
                        </option>
                        {labEngineers.map((eng) =>
                          typeof eng === "string" ? (
                            <option key={eng} value={eng}>{eng}</option>
                          ) : (
                            <option key={eng.id ?? eng.username} value={eng.username}>{eng.username}</option>
                          )
                        )}
                      </select>

                      {part.assignedEngineer && (
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => handleAssignEngineer(part, "")}
                          disabled={actioningPartId === part.id}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {/* Engineer-side completion actions, only after acceptance */}
                  {part.availableWithEngineer &&
                    !part.repaired &&
                    !part.notRepairable &&
                    isCurrentEngineerFor(part) && (
                      <div className="complete-inline">
                        <button
                          className="btn tiny"
                          onClick={() => handleMarkRepaired(part)}
                          disabled={actioningPartId === part.id}
                          title="Mark as repaired"
                        >
                          Mark Repaired
                        </button>
                        <button
                          className="btn tiny"
                          onClick={() => handleMarkNotRepairable(part)}
                          disabled={actioningPartId === part.id}
                          title="Mark as not repairable"
                        >
                          Not Repairable
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Timeline of reports under this part */}
            <ul className="report-timeline">
              {group.items.length === 0 ? (
                <li className="timeline-empty">No reports for this part.</li>
              ) : (
                group.items.map((report) => (
                  <li key={report.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-card">
                      <div className="timeline-meta">
                        <span>
                          {report.createdAt
                            ? new Date(report.createdAt).toLocaleString()
                            : ""}
                        </span>
                        {report.createdBy && (
                          <span className="by">@ {report.createdBy}</span>
                        )}
                      </div>
                      <div className="timeline-content">
                        {report.content || ""}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>

            {/* part dates row */}
            {!isUnassigned && part && (part.repairedAt || part.notRepairableAt) && (
              <div className="part-dates">
                {part.repairedAt && (
                  <span title="Repaired At">
                    <b>Repaired:</b> {formatDateTime(part.repairedAt)}
                  </span>
                )}
                {part.notRepairableAt && (
                  <span title="Marked Not Repairable At">
                    <b>Not Repairable:</b> {formatDateTime(part.notRepairableAt)}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ===== Compose new report ===== */}
      {allowAdd && (
        <div className="report-form">
          <label htmlFor="newReport" className="report-label">
            Add New Report
          </label>

          {/* Require selecting a part when parts are available */}
          {canChoosePart && (
            <>
              <select
                className="report-part-select"
                value={selectedPartId}
                onChange={(e) => setSelectedPartId(e.target.value)}
                style={{ marginBottom: 8 }}
              >
                <option value="">Select Hardware Part</option>
                {partsForSelection.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.hardwareName || `Part #${p.id}`}
                    {p.assignedEngineer ? ` — ${p.assignedEngineer}` : ""}
                  </option>
                ))}
              </select>

              {selectedPartId && (
                <div className="selected-part-pill">
                  <span className="pill-dot" />
                  <span className="pill-text">
                    {selectedPart?.hardwareName || `Part #${selectedPartId}`}
                    {selectedPart?.assignedEngineer
                      ? ` — ${selectedPart.assignedEngineer}`
                      : ""}
                  </span>
                </div>
              )}
            </>
          )}

          <textarea
            id="newReport"
            value={newReport}
            onChange={(e) => setNewReport(e.target.value)}
            rows="3"
            className="report-textarea"
            placeholder={
              canChoosePart
                ? "Write your report for the selected hardware part…"
                : "Write your report here…"
            }
          />
          <button
            onClick={handleAddReport}
            className="report-button"
            disabled={
              submitting || !newReport.trim() || (canChoosePart && !selectedPartId)
            }
          >
            {submitting ? "Submitting…" : "Submit Report"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReportList;

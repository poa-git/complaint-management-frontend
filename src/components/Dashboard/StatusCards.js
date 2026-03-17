import React from "react";

const STATUS_KEYS = [
  { key: "open", label: "Open" },
  // { key: "inProgress", label: "In Progress" },
  { key: "closed", label: "Closed" },
  { key: "approved", label: "Approved" },
  { key: "waitForApproval", label: "Wait For Approval" },
  { key: "pendingForClosed", label: "Pending For Closed" },
];

const ALL_OPEN_STATUSES = [
  "Open",
  "FOC",
  "Quotation",
  "Network Issue",
  "Visit Schedule",
  "Hardware Picked",
  "Visit On Hold",
  "Dispatched",
  "Delivered",
  "Received Inward",
  "Dispatch Inward",
  "Marked In Pool",
  "On Call",
  "Testing",
  "Renovation",
  "Disapproved",
  "Additional Counter",
  "Verify Approval",
  "BFC Approval",
  "AHO Approval",
  "BFC/AHO",
];

const ALL_STATUSES = [
  ...ALL_OPEN_STATUSES,
  "Closed",
  "Approved",
  "Wait For Approval",
  "Pending For Closed",
];

const StatusCards = ({
  complaints = [],
  onStatusCardClick,
  dashboardCounts,
  dashboardCountsLoading,
  dashboardCountsError,
}) => (
  <>
    <h2>Overall Complaint Records</h2>
    <section className="status-cards">
      {dashboardCountsLoading && <div>Loading dashboard counts…</div>}
      {dashboardCountsError && <div>{dashboardCountsError}</div>}
      {!dashboardCountsLoading &&
        STATUS_KEYS.map(({ key, label }) => (
          <div
            key={label}
            className={`status-card ${label.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => onStatusCardClick(label, false)}
          >
            <h2>
              {dashboardCounts
                ? dashboardCounts[key]?.overall ?? 0
                : label === "Open"
                ? complaints.filter((c) =>
                    ALL_OPEN_STATUSES.includes(c.complaintStatus)
                  ).length
                : complaints.filter((c) => c.complaintStatus === label).length}
            </h2>
            <p>{label}</p>
          </div>
        ))}

      {/* Overall Card */}
      <div
        className="status-card overall"
        onClick={() => onStatusCardClick("Overall", false)}
      >
        <h2>
          {dashboardCounts
            ? dashboardCounts.overall?.overall ?? 0
            : complaints.filter((c) => ALL_STATUSES.includes(c.complaintStatus)).length}
        </h2>
        <p>Overall</p>
      </div>
    </section>
  </>
);

export default StatusCards;

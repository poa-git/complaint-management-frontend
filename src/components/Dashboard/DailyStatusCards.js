import React from "react";

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

const STATUS_KEYS = [
  { key: "open", label: "Open" },
  // { key: "inProgress", label: "In Progress" },
  { key: "closed", label: "Closed" },
  { key: "approved", label: "Approved" },
  { key: "waitForApproval", label: "Wait For Approval" },
  { key: "pendingForClosed", label: "Pending For Closed" },
];

const DailyStatusCards = ({
  complaints = [],
  onStatusCardClick,
  dashboardCounts,
  dashboardCountsLoading,
  dashboardCountsError,
}) => {
  const currentDate = new Date().toISOString().split("T")[0];

  // Fallback: old logic
  const todayClosedCount = complaints.filter(
    (complaint) => complaint.closedDate === currentDate
  ).length;

  const todayRegisteredCount = complaints.filter(
    (complaint) => complaint.date === currentDate
  ).length;

  return (
    <>
      <h2>Daily Complaint Records</h2>
      <section className="status-cards">
        {dashboardCountsLoading && <div>Loading daily counts…</div>}
        {dashboardCountsError && <div>{dashboardCountsError}</div>}
        {!dashboardCountsLoading &&
          STATUS_KEYS.map(({ key, label }) => (
            <div
              key={label}
              className={`status-card ${label
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
              onClick={() => onStatusCardClick(label, true)}
            >
              <h2>
                {dashboardCounts
                  ? dashboardCounts[key]?.today ?? 0
                  : label === "Open"
                  ? complaints.filter(
                      (c) =>
                        ALL_OPEN_STATUSES.includes(c.complaintStatus) &&
                        c.date === currentDate
                    ).length
                  : complaints.filter(
                      (c) =>
                        c.complaintStatus === label && c.date === currentDate
                    ).length}
              </h2>
              <p>{label}</p>
            </div>
          ))}

        {/* Total Closed Today Card */}
        <div
          className="status-card closed-same-day"
          onClick={() => onStatusCardClick("Today Closed", true)}
        >
          <h2>
            {dashboardCounts
              ? dashboardCounts.totalClosed?.today ?? todayClosedCount
              : todayClosedCount}
          </h2>
          <p>Total Closed</p>
        </div>

        {/* Today's Registered Card */}
        <div
          className="status-card today-registered"
          onClick={() => onStatusCardClick("Today Registered", true)}
          style={{ cursor: "pointer" }}
        >
          <h2>
            {dashboardCounts
              ? dashboardCounts.todaysRegistered?.today ?? todayRegisteredCount
              : todayRegisteredCount}
          </h2>

          <p>Today's Registered</p>
        </div>
      </section>
    </>
  );
};

export default DailyStatusCards;

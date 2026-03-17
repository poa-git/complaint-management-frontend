import React, { useState, useEffect } from "react";
import axios from "axios";
import ComplaintReport from "../../ComplaintReport/ComplaintReport";
import "./../ComplaintTable/ComplaintTable.css";

const DailyInProgressComplaintsTable = ({
  complaints,
  handleOpenModal,
  openRemarksModal,
  calculateAgingDays,
  getStatusClass,
  currentDate,
}) => {
  const [remarksCounts, setRemarksCounts] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null); // For viewing history

  const recordsPerPage = 100;
  const maxVisiblePages = 5;
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // Filter complaints where status is "In Progress" and the complaint date equals currentDate
  const dailyInProgressComplaints = complaints.filter(
    (complaint) =>
      complaint.complaintStatus === "In Progress" && complaint.date === currentDate
  );

  // Pagination logic: split the filtered list by recordsPerPage
  const totalPages = Math.ceil(dailyInProgressComplaints.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const currentRecords = dailyInProgressComplaints.slice(
    startIndex,
    startIndex + recordsPerPage
  );

  // Fetch remarks counts for the visible complaints
  useEffect(() => {
    const fetchRemarksCounts = async () => {
      const visibleComplaintIds = currentRecords
        .filter((complaint) => remarksCounts[complaint.id] === undefined)
        .map((complaint) => complaint.id);

      if (visibleComplaintIds.length > 0) {
        try {
          const response = await axios.post(
            `${API_BASE_URL}/complaints/remarks/counts`,
            visibleComplaintIds,
            { withCredentials: true }
          );
          setRemarksCounts((prevCounts) => ({
            ...prevCounts,
            ...response.data,
          }));
        } catch (error) {
          console.error("Error fetching remarks counts:", error);
        }
      }
    };

    fetchRemarksCounts();
  }, [currentRecords, API_BASE_URL, remarksCounts]);

  // Helper to get visible page numbers
  const getVisiblePages = () => {
    const pages = [];
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, currentPage + half);

    if (currentPage <= half) {
      end = Math.min(totalPages, maxVisiblePages);
    }
    if (currentPage > totalPages - half) {
      start = Math.max(1, totalPages - maxVisiblePages + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handleRowClick = (complaintId) => {
    setSelectedRow((prevSelectedRow) =>
      prevSelectedRow === complaintId ? null : complaintId
    );
  };

  const handleViewHistory = (complaintId) => {
    setSelectedComplaintId(complaintId);
  };

  const handleBackToTable = () => {
    setSelectedComplaintId(null);
  };

  return (
    <div>
      {selectedComplaintId ? (
        <div>
          <button onClick={handleBackToTable} className="back-button">
            Back to Table
          </button>
          <ComplaintReport complaintId={selectedComplaintId} />
        </div>
      ) : (
        <>
          <table className="complaint-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Status</th>
                <th>Actions</th>
                <th>Remarks</th>
                <th>Date</th>
                <th>Bank Name</th>
                <th>Branch Code</th>
                <th>Branch Name</th>
                <th>City</th>
                <th>Reference Number</th>
                <th>Complaint Type</th>
                <th>Details</th>
                <th>Visitor Name</th>
                <th>Repeat Complaint</th>
                <th>Aging Days</th>
                <th>Complaint ID</th>
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {currentRecords.length > 0 ? (
                currentRecords.map((complaint, index) => (
                  <tr
                    key={complaint.id}
                    onClick={() => handleRowClick(complaint.id)}
                    className={selectedRow === complaint.id ? "selected-row" : ""}
                  >
                    <td>{index + 1 + (currentPage - 1) * recordsPerPage}</td>
                    <td className={getStatusClass(complaint.complaintStatus)}>
                      {complaint.complaintStatus || "In Progress"}
                    </td>
                    <td>
                      <button
                        className="update-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(complaint);
                        }}
                      >
                        Update
                      </button>
                    </td>
                    <td>
                      <button
                        className={`remark-button ${
                          remarksCounts[complaint.id] === undefined
                            ? "remark-button-loading"
                            : remarksCounts[complaint.id] > 0
                            ? "remark-button-green"
                            : "remark-button-red"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openRemarksModal(complaint);
                        }}
                        disabled={remarksCounts[complaint.id] === undefined}
                      >
                        {remarksCounts[complaint.id] === undefined ? "Loading..." : "Remarks"}
                        <span
                          className={`remarks-count ${
                            remarksCounts[complaint.id] > 0
                              ? "remarks-count-green"
                              : "remarks-count-red"
                          }`}
                        >
                          {remarksCounts[complaint.id] || 0}
                        </span>
                      </button>
                    </td>
                    <td>{complaint.date}</td>
                    <td>{complaint.bankName}</td>
                    <td>{complaint.branchCode}</td>
                    <td>{complaint.branchName}</td>
                    <td>{complaint.city}</td>
                    <td>{complaint.referenceNumber || "N/A"}</td>
                    <td>{complaint.complaintType || "N/A"}</td>
                    <td>{complaint.details || "No details provided"}</td>
                    <td>{complaint.visitorName}</td>
                    <td>{complaint.repeatComplaint ? "Yes" : "No"}</td>
                    <td>{calculateAgingDays(complaint.date)}</td>
                    <td>{complaint.complaintId}</td>
                    <td>
                      <button
                        className="view-history-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewHistory(complaint.complaintId);
                        }}
                      >
                        View History
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="17" style={{ textAlign: "center" }}>
                    No daily in-progress complaints to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {dailyInProgressComplaints.length > 0 && (
            <div className="pagination-container">
              <button
                className="page-button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                &lt;
              </button>
              {getVisiblePages().map((page) => (
                <button
                  key={page}
                  className={`page-button ${currentPage === page ? "active" : ""}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="page-button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                &gt;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DailyInProgressComplaintsTable;

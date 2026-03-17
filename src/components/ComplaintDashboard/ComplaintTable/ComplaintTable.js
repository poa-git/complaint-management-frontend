import React, { useState } from 'react';
import './ComplaintTable.css';

const ComplaintTable = ({
  complaints,
  handleOpenModal,
  openRemarksModal,
  calculateAgingDays,
  getStatusClass,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 100; // Number of records per page
  const maxVisiblePages = 5; // Maximum number of visible page buttons

  // Filter complaints to only include those with status "Open"
  const filteredComplaints = complaints.filter(
    (complaint) => complaint.complaintStatus === 'Open'
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredComplaints.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const currentRecords = filteredComplaints.slice(
    startIndex,
    startIndex + recordsPerPage
  );

  // Get visible page numbers dynamically
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

  const visiblePages = getVisiblePages();

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div>
      <table className="complaint-table">
        <thead>
          <tr>
            <th>Complaint ID</th>
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
          </tr>
        </thead>
        <tbody>
          {currentRecords.length > 0 ? (
            currentRecords.map((complaint) => (
              <tr key={complaint.id}>
                <td>{complaint.complaintId}</td>
                <td className={getStatusClass(complaint.complaintStatus)}>
                  {complaint.complaintStatus || 'Open'}
                </td>
                <td>
                  <button
                    className="update-button"
                    onClick={() => handleOpenModal(complaint)}
                    disabled={complaint.complaintStatus !== 'Open'}
                  >
                    Update
                  </button>
                </td>
                <td>
                  <button
                    className="remark-button"
                    onClick={() => openRemarksModal(complaint)}
                  >
                    Remarks
                  </button>
                </td>
                <td>{complaint.date}</td>
                <td>{complaint.bankName}</td>
                <td>{complaint.branchCode}</td>
                <td>{complaint.branchName}</td>
                <td>{complaint.city}</td>
                <td>{complaint.referenceNumber}</td>
                <td>{complaint.complaintType}</td>
                <td
                  className="truncated-cell"
                  title={complaint.details || 'No details provided'}
                >
                  {complaint.details || 'No details provided'}
                </td>
                <td>{complaint.visitorName}</td>
                <td>{complaint.repeatComplaint ? 'Yes' : 'No'}</td>
                <td>{complaint.agingDays}</td>
               
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="15" style={{ textAlign: 'center' }}>
                No open complaints to display
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {filteredComplaints.length > 0 && (
        <div className="pagination-container">
          <button
            className="page-button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            &lt; {/* Backward Arrow */}
          </button>
          {visiblePages.map((page) => (
            <button
              key={page}
              className={`page-button ${currentPage === page ? 'active' : ''}`}
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
            &gt; {/* Forward Arrow */}
          </button>
        </div>
      )}
    </div>
  );
};

export default ComplaintTable;

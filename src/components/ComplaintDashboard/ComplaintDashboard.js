// ComplaintDashboard.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './complaintDashboard.css';
import FilterSection from './FilterSection/FilterSection';
import ComplaintTable from './ComplaintTable/ComplaintTable';
import ComplaintModal from './ComplaintModal/ComplaintModal';
import RemarksModal from './RemarksModal/RemarksModal';
// import ClosedComplaintsTable from './ComplaintTable/ClosedComplaintsTable';

const ComplaintDashboard = () => {
  const [complaints, setComplaints] = useState([]); // Initialize as empty array
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [changedFields, setChangedFields] = useState({});
  const [remarksUpdate, setRemarksUpdate] = useState('');
  const [latestRemarks, setLatestRemarks] = useState(null);
  const [remarksHistory, setRemarksHistory] = useState([]);
  const [isRemarksModalOpen, setIsRemarksModalOpen] = useState(false);

  const [filterDate, setFilterDate] = useState('');
  const [filterBankName, setFilterBankName] = useState('');
  const [filterVisitorName, setFilterVisitorName] = useState('');
  const [filterCity, setFilterCity] = useState(''); // New state for city filter
  // Base URL from .env file
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  useEffect(() => {
    fetchComplaints();
    fetchStatuses();
  }, []);

  const fetchComplaints = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/complaints/all`,
        { withCredentials: true }
      );
      setComplaints(Array.isArray(response.data) ? response.data : []); // Ensure complaints is an array
      setLoading(false);
    } catch (error) {
      setError('Failed to fetch complaints');
      setComplaints([]); // Ensure complaints is an empty array on error
      setLoading(false);
    }
  };

  const fetchStatuses = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/data/statuses`,
        { withCredentials: true }
      );
      setStatuses(response.data || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  const handleOpenModal = (complaint) => {
    setSelectedComplaint(complaint);
    setChangedFields({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedComplaint(null);
  };

  const handleUpdateComplaintLog = async (e) => {
    e.preventDefault();
    try {
        const updateData = { ...changedFields }; // Prepare updated fields for API request

        console.log("Submitting Update:", updateData);

        // Send update request to backend
        await axios.put(`${API_BASE_URL}/complaints/${selectedComplaint.id}`, updateData, { withCredentials: true });

        // Update local state with the changed fields
        setComplaints((prevComplaints) =>
            prevComplaints.map((complaint) =>
                complaint.id === selectedComplaint.id
                    ? {
                        ...complaint,
                        ...changedFields,
                    }
                    : complaint
            )
        );

        // Close the modal after successful update
        handleCloseModal();
    } catch (error) {
        console.error('Error updating complaints log:', error);
    }
};




  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelectedComplaint((prev) => ({
      ...prev,
      [name]: value,
    }));
    setChangedFields((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const calculateAgingDays = (date) => {
    const complaintDate = new Date(date);
    const currentDate = new Date();
    return Math.floor((currentDate - complaintDate) / (1000 * 60 * 60 * 24));
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Pending For Closed':
        return 'pending-for-closed';
      case 'Wait For Approval':
        return 'wait-for-approval';
      case 'Approved':
        return 'approved';
      case 'In Progress':
        return 'status-in-progress';
      case 'Closed':
        return 'status-closed';
      case 'FOC':
        return 'status-foc'; // New status class for 'FOC'
      case 'qout':
        return 'status-qout'; // New status class for 'qout'
      case 'Netwrok Issue':
        return 'status-network-issue'; // New status class for 'Netwrok Issue'
      case 'Open':
      default:
        return 'status-open';
    }
  };
  

  const openRemarksModal = (complaint) => {
    setSelectedComplaint(complaint);
    setIsRemarksModalOpen(true);
  };

  const closeRemarksModal = () => {
    setIsRemarksModalOpen(false);
    setLatestRemarks(null);
    setRemarksHistory([]);
    setRemarksUpdate('');
  };

  const handleAddRemarks = async () => {
    if (!remarksUpdate) return;
    try {
      await axios.post(`${API_BASE_URL}/complaints/${selectedComplaint.id}/remarks`, {
        remarks: remarksUpdate,
      });
      setRemarksUpdate('');
      fetchLatestRemarks(selectedComplaint.id);
    } catch (error) {
      console.error('Error adding remarks:', error);
    }
  };

  const fetchLatestRemarks = async (complaintId) => {
    if (latestRemarks) {
      setLatestRemarks(null);
    } else {
      try {
        const response = await axios.get(`${API_BASE_URL}/complaints/${complaintId}/remarks/latest`);
        setLatestRemarks(response.data);
      } catch (error) {
        console.error('Error fetching latest remarks:', error);
      }
    }
  };

  const fetchRemarksHistory = async (complaintId) => {
    if (remarksHistory.length > 0) {
      setRemarksHistory([]);
    } else {
      try {
        const response = await axios.get(`${API_BASE_URL}/complaints/${complaintId}/remarks/history`);
        setRemarksHistory(response.data);
      } catch (error) {
        console.error('Error fetching remarks history:', error);
      }
    }
  };

  // Filter complaints based on user input
  const filteredComplaints = Array.isArray(complaints)
    ? complaints.filter((complaint) => {
        const matchesDate = filterDate ? complaint.date === filterDate : true;
        const matchesBankName = filterBankName ? complaint.bankName === filterBankName : true;
        const matchesVisitorName = filterVisitorName ? complaint.visitorName === filterVisitorName : true;
        const matchesCity = filterCity ? complaint.city === filterCity : true;
        return matchesDate && matchesBankName && matchesVisitorName && matchesCity;
      })
    : [];

  if (loading) return <p>Loading complaints...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="complaint-dashboard">
      <h2>Complaint History</h2>
      <FilterSection
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        filterBankName={filterBankName}
        setFilterBankName={setFilterBankName}
        filterVisitorName={filterVisitorName}
        setFilterVisitorName={setFilterVisitorName}
        filterCity={filterCity}
        setFilterCity={setFilterCity}
        complaints={complaints}
      />
      <ComplaintTable
        complaints={filteredComplaints}
        handleOpenModal={handleOpenModal}
        openRemarksModal={openRemarksModal}
        calculateAgingDays={calculateAgingDays}
        getStatusClass={getStatusClass}
      />
      <ComplaintModal
        isOpen={isModalOpen}
        selectedComplaint={selectedComplaint}
        handleCloseModal={handleCloseModal}
        handleChange={handleChange}
        handleUpdateComplaintLog={handleUpdateComplaintLog}
        statuses={statuses}
      />
      <RemarksModal
        isOpen={isRemarksModalOpen}
        latestRemarks={latestRemarks}
        remarksHistory={remarksHistory}
        fetchLatestRemarks={fetchLatestRemarks}
        fetchRemarksHistory={fetchRemarksHistory}
        handleAddRemarks={handleAddRemarks}
        remarksUpdate={remarksUpdate}
        setRemarksUpdate={setRemarksUpdate}
        closeRemarksModal={closeRemarksModal}
        selectedComplaint={selectedComplaint}
      />
      {/* <ClosedComplaintsTable
        complaints={filteredComplaints}
        handleOpenModal={handleOpenModal}
        openRemarksModal={openRemarksModal}
        calculateAgingDays={calculateAgingDays}
        getStatusClass={getStatusClass}
      /> */}
    </div>
  );
};

export default ComplaintDashboard;

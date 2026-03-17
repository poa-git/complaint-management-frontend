import React, { useMemo, useState, useRef, useEffect } from "react";
import { generateExcelReport } from "../../ExcelReportGenerator/ExcelReportGenerator";
import { generateDaySummaryReport } from "../../ExcelReportGenerator/generateDaySummaryReport";
import "./FilterSection.css";

const FilterSection = ({
  filters,
  onFiltersChange,
  onApplyFilters,    // <-- Called when Apply Filters is clicked
  viewStatus,
  complaints,
  isDailyView,
  currentDate,
  setIsFilterMode,   // <-- Toggle filter mode in parent
}) => {
  const [branchCodeInput, setBranchCodeInput] = useState("");
  const [branchNameInput, setBranchNameInput] = useState("");
  const [showBranchCodeSuggestions, setShowBranchCodeSuggestions] = useState(false);
  const [showBranchNameSuggestions, setShowBranchNameSuggestions] = useState(false);

  const [visitorCities, setVisitorCities] = useState([]);
  const [selectedReport, setSelectedReport] = useState("");
  const [visitorsFromApi, setVisitorsFromApi] = useState([]);

  const branchCodeRef = useRef(null);
  const branchNameRef = useRef(null);

  const reportTypes = [
    { label: "Standard Report", value: "standard" },
    { label: "Ageing Report", value: "ageing" },
    { label: "Untouched Report", value: "untouched" },
    { label: "Day Summary", value: "daySummary" },
  ];

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const cityOrder = [
    "Karachi", "Lahore", "Islamabad", "Peshawar", "Hyderabad", "Quetta", "Sukkur",
    "Sadiqabad", "Bahawalpur", "Multan", "Sahiwal", "Jhang", "Faisalabad", "Sargodha",
    "Sialkot", "Jhelum", "Abbottabad", "Others"
  ];
  const subStatusOrder = [
    "Open", "FOC", "Quotation", "Network Issue", "Visit Schedule", "Hardware Picked",
    "Visit On Hold", "Dispatched", "Delivered", "Received Inward", "Dispatch Inward",
    "Approved", "Marked In Pool", "On Call", "Renovation", "Testing", "Disapproved",
    "Additional Counter", "Verify Approval", "BFC Approval", "AHO Approval", "BFC/AHO",
  ];

  // Click outside suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (branchCodeRef.current && !branchCodeRef.current.contains(event.target)) {
        setShowBranchCodeSuggestions(false);
      }
      if (branchNameRef.current && !branchNameRef.current.contains(event.target)) {
        setShowBranchNameSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch visitor cities from API
  useEffect(() => {
    const fetchVisitorCities = async () => {
      try {
        if (!API_BASE_URL) throw new Error("API_BASE_URL is not defined");
        const url = `${API_BASE_URL}/data/visitors`;
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) throw new Error("Failed to fetch visitor cities.");
        const data = await response.json();
        const cities = data.map((v) => v.city)
          .filter((city, i, self) => city && self.indexOf(city) === i);
        setVisitorCities(cities);
      } catch {
        setVisitorCities([]);
      }
    };
    if (API_BASE_URL) fetchVisitorCities();
  }, [API_BASE_URL]);

  // Fetch all visitors (for engineer dropdown)
  useEffect(() => {
    const fetchVisitorsFromApi = async () => {
      try {
        if (!API_BASE_URL) throw new Error("API_BASE_URL is not defined");
        const url = `${API_BASE_URL}/data/visitors`;
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) throw new Error("Failed to fetch visitors.");
        const data = await response.json();
        setVisitorsFromApi(data);
      } catch {
        setVisitorsFromApi([]);
      }
    };
    if (API_BASE_URL) fetchVisitorsFromApi();
  }, [API_BASE_URL]);

  // Helpers
  const formatCityName = (name) =>
    name
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const bankOptions = useMemo(
    () => [...new Set(complaints.map((c) => c.bankName).filter(Boolean))],
    [complaints]
  );
  const branchCodeOptions = useMemo(
    () => [...new Set(complaints.map((c) => c.branchCode).filter(Boolean))],
    [complaints]
  );
  const branchNameOptions = useMemo(
    () => [...new Set(complaints.map((c) => c.branchName).filter(Boolean))],
    [complaints]
  );
  const subStatusOptions = useMemo(
    () =>
      subStatusOrder.filter((s) =>
        complaints.some((c) => c.complaintStatus === s)
      ),
    [complaints]
  );
  const visitorOptions = useMemo(() => {
    const filteredApi = filters.filterCity
      ? visitorsFromApi.filter((v) => v.city === filters.filterCity)
      : visitorsFromApi;
    const apiVisitorNames = filteredApi.map((v) => v?.name?.trim()).filter(Boolean);
    const filteredComplaints = filters.filterCity
      ? complaints.filter((c) => c.city === filters.filterCity)
      : complaints;
    const complaintVisitorNames = filteredComplaints.map((c) => c.visitorName?.trim()).filter(Boolean);
    return [...new Set([...apiVisitorNames, ...complaintVisitorNames])];
  }, [complaints, filters.filterCity, visitorsFromApi]);

  // Grouped City options for dropdown
  const groupedCityOptions = useMemo(() => {
    const normalizedVisitorCities = visitorCities.map((city) =>
      city.toLowerCase().trim()
    );
    const grouped = { Others: [] };
    const uniqueCities = [
      ...new Set(complaints.map((c) => (c.city || "").trim())),
    ];
    uniqueCities.forEach((city) => {
      const groupKey = normalizedVisitorCities.includes(city.toLowerCase())
        ? formatCityName(city)
        : "Others";
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(formatCityName(city));
    });
    Object.keys(grouped).forEach(
      (key) => (grouped[key] = [...new Set(grouped[key])])
    );
    return Object.entries(grouped).sort(([keyA], [keyB]) => {
      const indexA = cityOrder.indexOf(keyA) !== -1 ? cityOrder.indexOf(keyA) : cityOrder.length;
      const indexB = cityOrder.indexOf(keyB) !== -1 ? cityOrder.indexOf(keyB) : cityOrder.length;
      return indexA - indexB;
    });
  }, [visitorCities, complaints]);

  // Filtering logic ... (same as your original)

  const filterComplaints = () => {
    return complaints.filter((complaint) => {
      // ...your filtering code unchanged...
      const dateField = (() => {
        if (
          complaint.complaintStatus === "Visit Schedule" &&
          complaint.scheduleDate
        ) {
          return complaint.scheduleDate;
        }
        switch (complaint.complaintStatus) {
          case "Closed":
            return complaint.closedDate;
          case "Wait For Approval":
            return complaint.quotationDate;
          case "Approved":
            return complaint.approvedDate;
          default:
            return complaint.date;
        }
      })();

      const matchesDate = !filters.filterDate || dateField === filters.filterDate;

      const matchesDateRange =
        (!filters.filterDateRange?.start ||
          new Date(dateField) >= new Date(filters.filterDateRange.start)) &&
        (!filters.filterDateRange?.end ||
          new Date(dateField) <= new Date(filters.filterDateRange.end));

      const matchesBankName =
        !filters.filterBankName ||
        (complaint.bankName &&
          complaint.bankName.toLowerCase().trim() ===
            filters.filterBankName.toLowerCase().trim());

      const matchesVisitorName =
        !filters.filterVisitorName ||
        complaint.visitorName === filters.filterVisitorName;

      const matchesCity =
        !filters.filterCity ||
        (complaint.city &&
          complaint.city.toLowerCase().trim() ===
            filters.filterCity.toLowerCase().trim());

      const matchesBranchCode =
        !filters.filterBranchCode ||
        (complaint.branchCode &&
          complaint.branchCode
            .toLowerCase()
            .includes(filters.filterBranchCode.toLowerCase()));

      const matchesBranchName =
        !filters.filterBranchName ||
        (complaint.branchName &&
          complaint.branchName
            .toLowerCase()
            .includes(filters.filterBranchName.toLowerCase()));

      const matchesSubStatus =
        !filters.filterSubStatus ||
        complaint.complaintStatus === filters.filterSubStatus ||
        (filters.filterSubStatus === "FOC & Approved" &&
          (complaint.complaintStatus === "FOC" ||
            complaint.complaintStatus === "Approved"));

      const matchesDailyView = !isDailyView || dateField === currentDate;

      const matchesHasReport =
        !filters.filterHasReport ||
        (complaint.hardwareLogs &&
          complaint.hardwareLogs.some(
            (hw) => hw.reports && hw.reports.length > 0
          ));

      const matchesViewStatus =
        !viewStatus ||
        (viewStatus === "Overall"
          ? [
              "Open",
              "In Progress",
              "Closed",
              "Approved",
              "Wait For Approval",
              "Pending For Closed",
              "FOC",
              "Quotation",
              "Network Issue",
              "Visit Schedule",
              "Hardware Picked",
              "Visit On Hold",
              "Dispatched",
              "Delivered",
              "Marked In Pool",
              "On Call",
              "Renovation",
              "Testing",
              "Disapproved",
              "Additional Counter",
              "Verify Approval",
              "BFC Approval",
              "AHO Approval",
              "BFC/AHO",
            ].includes(complaint.complaintStatus)
          : viewStatus === "Open"
          ? subStatusOrder.includes(complaint.complaintStatus)
          : complaint.complaintStatus === viewStatus);

      return (
        matchesDate &&
        matchesDateRange &&
        matchesBankName &&
        matchesVisitorName &&
        matchesCity &&
        matchesBranchCode &&
        matchesBranchName &&
        matchesSubStatus &&
        matchesDailyView &&
        matchesViewStatus &&
        matchesHasReport
      );
    });
  };

  const filteredComplaints = useMemo(filterComplaints, [
    complaints,
    filters,
    viewStatus,
    isDailyView,
    currentDate,
  ]);

  // Report generation and clearFilters... (same as your original)

  const handleGenerateReport = async (selectedReport) => {
    if (!selectedReport) {
      alert("Please select a report type before generating.");
      return;
    }
    if (selectedReport === "daySummary") {
      const [summaryResp, hardwareResp, engineerResp] = await Promise.all([
        fetch(`${API_BASE_URL}/complaints/complaints-summary`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/hardware-logs/hardware-dispatch-detail`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/complaints/city-wise-summary`, { credentials: "include" }),
      ]);
      if (!summaryResp.ok || !hardwareResp.ok || !engineerResp.ok) {
        alert("Failed to fetch one or more report sections!");
        return;
      }
      const summaryData = await summaryResp.json();
      const hardwareData = await hardwareResp.json();
      const engineerData = await engineerResp.json();
      await generateDaySummaryReport(summaryData, hardwareData, engineerData);
      return;
    }
    await generateExcelReport(
      filteredComplaints,
      viewStatus,
      API_BASE_URL,
      visitorCities,
      selectedReport
    );
  };

  const clearFilters = () => {
    onFiltersChange({
      filterDate: "",
      filterDateRange: { start: "", end: "" },
      filterBankName: "",
      filterVisitorName: "",
      filterCity: "",
      filterBranchCode: "",
      filterBranchName: "",
      filterSubStatus: "",
      filterHasReport: false,
    });
    setBranchCodeInput("");
    setBranchNameInput("");
    if (typeof setIsFilterMode === "function") setIsFilterMode(false); // Reset filter mode in parent
  };

  const handleFiltersChange = (newFilters) => {
    onFiltersChange(newFilters);
    if (typeof setIsFilterMode === "function") setIsFilterMode(true);
  };

  return (
    <div className="filter-section">
      {/* Date filter */}
      <div className="filter-group">
        <label className="filter-label">Date:</label>
        <input
          type="date"
          className="filter-input date-filter"
          value={filters.filterDate}
          onChange={(e) =>
            handleFiltersChange({ ...filters, filterDate: e.target.value })
          }
        />
      </div>

      {/* Date range filter */}
      <div className="filter-group">
        <label className="filter-label">Date Range:</label>
        <input
          type="date"
          className="filter-input"
          value={filters.filterDateRange?.start || ""}
          onChange={(e) =>
            handleFiltersChange({
              ...filters,
              filterDateRange: { ...filters.filterDateRange, start: e.target.value },
            })
          }
        />
        <span>to</span>
        <input
          type="date"
          className="filter-input"
          value={filters.filterDateRange?.end || ""}
          onChange={(e) =>
            handleFiltersChange({
              ...filters,
              filterDateRange: { ...filters.filterDateRange, end: e.target.value },
            })
          }
        />
      </div>

      {/* Bank Name filter */}
      <div className="filter-group">
        <label className="filter-label">Bank Name:</label>
        <select
          className="filter-input"
          value={filters.filterBankName}
          onChange={(e) =>
            handleFiltersChange({ ...filters, filterBankName: e.target.value })
          }
        >
          <option value="">All Banks</option>
          {bankOptions.map((bank) => (
            <option key={bank} value={bank}>
              {bank}
            </option>
          ))}
        </select>
      </div>

      {/* Engineer Name filter */}
      <div className="filter-group">
        <label className="filter-label">Engineer Name:</label>
        <select
          className="filter-input"
          value={filters.filterVisitorName}
          onChange={(e) =>
            handleFiltersChange({ ...filters, filterVisitorName: e.target.value })
          }
        >
          <option value="">All Engineers</option>
          {visitorOptions.map((visitor) => (
            <option key={visitor} value={visitor}>
              {visitor}
            </option>
          ))}
        </select>
      </div>

      {/* City filter */}
      <div className="filter-group">
        <label className="filter-label">City:</label>
        <select
          className="filter-input"
          value={filters.filterCity}
          onChange={(e) =>
            handleFiltersChange({ ...filters, filterCity: e.target.value })
          }
        >
          <option value="">All Cities</option>
          {groupedCityOptions.map(([cityGroup, cities]) => (
            <optgroup key={cityGroup} label={cityGroup}>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Branch Code filter with suggestions */}
      <div className="filter-group">
        <label className="filter-label">Branch Code:</label>
        <div ref={branchCodeRef} className="input-with-suggestions">
          <input
            type="text"
            className="filter-input"
            placeholder="Search Branch Code"
            value={branchCodeInput}
            onChange={(e) => {
              setBranchCodeInput(e.target.value);
              setShowBranchCodeSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // <-- THIS LINE IS IMPORTANT!
                const paddedBranchCode = branchCodeInput.padStart(4, "0");
                handleFiltersChange({ ...filters, filterBranchCode: paddedBranchCode });
                setBranchCodeInput(paddedBranchCode);
                setShowBranchCodeSuggestions(false);
              }
            }}
          />
          {showBranchCodeSuggestions && branchCodeInput && (
            <div className="suggestions">
              {branchCodeOptions
                .filter((code) =>
                  code.toLowerCase().includes(branchCodeInput.toLowerCase())
                )
                .map((code) => (
                  <div
                    key={code}
                    className="suggestion-item"
                    onClick={() => {
                      handleFiltersChange({ ...filters, filterBranchCode: code });
                      setBranchCodeInput(code);
                      setShowBranchCodeSuggestions(false);
                    }}
                  >
                    {code}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Branch Name filter with suggestions */}
      <div className="filter-group">
        <label className="filter-label">Branch Name:</label>
        <div ref={branchNameRef} className="input-with-suggestions">
          <input
            type="text"
            className="filter-input"
            placeholder="Search Branch Name"
            value={branchNameInput}
            onChange={(e) => {
              setBranchNameInput(e.target.value);
              setShowBranchNameSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // <-- THIS LINE IS IMPORTANT!
                handleFiltersChange({ ...filters, filterBranchName: branchNameInput });
                setShowBranchNameSuggestions(false);
              }
            }}
          />
          {showBranchNameSuggestions && branchNameInput && (
            <div className="suggestions">
              {branchNameOptions
                .filter((name) =>
                  name.toLowerCase().includes(branchNameInput.toLowerCase())
                )
                .map((name) => (
                  <div
                    key={name}
                    className="suggestion-item"
                    onClick={() => {
                      handleFiltersChange({ ...filters, filterBranchName: name });
                      setBranchNameInput(name);
                      setShowBranchNameSuggestions(false);
                    }}
                  >
                    {name}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Sub-Status filter (only shown if viewStatus === "Open") */}
      {viewStatus === "Open" && (
        <div className="filter-group">
          <label className="filter-label">Sub-Status:</label>
          <select
            className="filter-input"
            value={filters.filterSubStatus}
            onChange={(e) =>
              handleFiltersChange({ ...filters, filterSubStatus: e.target.value })
            }
          >
            <option value="">All Sub-Statuses</option>
            <option value="FOC & Approved">FOC & Approved</option>
            {subStatusOptions.map((subStatus) => (
              <option key={subStatus} value={subStatus}>
                {subStatus}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Has Report filter */}
      <div className="filter-group filter-checkbox-group">
        <label className="filter-label">
          <input
            type="checkbox"
            name="filterHasReport"
            checked={filters.filterHasReport}
            onChange={(e) =>
              handleFiltersChange({ ...filters, filterHasReport: e.target.checked })
            }
            className="filter-checkbox"
          />
          Has Report
        </label>
      </div>

      {/* Found Records */}
      <div className="found-records">
        Found Records: {filteredComplaints.length}
      </div>

      <button className="clear-filters" onClick={clearFilters}>
        Clear Filters
      </button>

      {/* Report Selection Dropdown */}
      <div className="report-dropdown">
        <label className="filter-label">Select Report Type:</label>
        <select
          className="dropdown-select"
          value={selectedReport}
          onChange={(e) => setSelectedReport(e.target.value)}
        >
          <option value="" disabled>
            -- Choose a Report --
          </option>
          {reportTypes.map((report) => (
            <option key={report.value} value={report.value}>
              {report.label}
            </option>
          ))}
        </select>
        <button
          className="generate-report-btn"
          onClick={() => handleGenerateReport(selectedReport)}
        >
          Generate Report
        </button>
        <button
          className="apply-filters-btn"
          onClick={() => onApplyFilters(filters)}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};

export default FilterSection;

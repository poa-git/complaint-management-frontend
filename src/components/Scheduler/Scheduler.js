import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
  Button,
  Modal,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  OutlinedInput,
  Checkbox,
  ListItemText,
  IconButton,
  Tabs,
  Tab,
} from "@mui/material";
import { ArrowBack, ArrowForward, ListAlt, TableChart } from "@mui/icons-material";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./Scheduler.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const cityOrder = [
  "Karachi", "Lahore", "Islamabad", "Peshawar", "Hyderabad", "Quetta",
  "Sukkur", "Sadiqabad", "Bahawalpur", "Multan", "Sahiwal", "Jhang",
  "Faisalabad", "Sargodha", "Sialkot", "Jhelum", "Abbottabad",
];

function getOrderedCityGroups(events, cityOrder) {
  const cityOrderLower = cityOrder.map((c) => c.toLowerCase());
  const groups = {};
  events.forEach((event) => {
    const cityName = event.city || "";
    const normalized = cityName.toLowerCase();
    const foundIndex = cityOrderLower.indexOf(normalized);

    let groupKey;
    if (foundIndex !== -1) {
      groupKey = cityOrder[foundIndex];
    } else {
      groupKey = `Others (${cityName.charAt(0).toUpperCase() + cityName.slice(1)})`;
    }
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(event);
  });
  const ordered = [];
  cityOrder.forEach((city) => {
    if (groups[city]) {
      ordered.push({ city, events: groups[city] });
      delete groups[city];
    }
  });
  Object.entries(groups).forEach(([city, events]) => {
    ordered.push({ city, events });
  });
  return ordered;
}

const Scheduler = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [resources, setResources] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [modalData, setModalData] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);

  // Filters
  const [filterCities, setFilterCities] = useState([]);
  const [filterStations, setFilterStations] = useState([]);
  const [filterEngineers, setFilterEngineers] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [showOnlyScheduled, setShowOnlyScheduled] = useState(false);
  const [filterDate, setFilterDate] = useState("");

  // View: 0 = Table, 1 = Agenda
  const [view, setView] = useState(0);

  const normalizeString = (str) => str?.toLowerCase().trim();

  // Get week dates (Sunday - Saturday)
  const weekDates = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const newDate = new Date(startOfWeek);
      newDate.setDate(startOfWeek.getDate() + i);
      return newDate;
    });
  }, [currentDate]);

  // Fetch resources and schedules (for current week and backdates)
  useEffect(() => {
    const start = new Date(weekDates[0]);
    start.setDate(start.getDate() - 14);
    const end = new Date(weekDates[6]);
    end.setDate(end.getDate() + 14);

    const fetchData = async () => {
      try {
        const [visitorsResponse, schedulesResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/data/visitors`, { withCredentials: true }),
          axios.get(
            `${API_BASE_URL}/schedules/by-range?start=${start.toISOString().slice(0, 10)}&end=${end.toISOString().slice(0, 10)}`,
            { withCredentials: true }
          ),
        ]);
        setResources(visitorsResponse.data || []);
        setSchedules(schedulesResponse.data || []);
      } catch (error) {
        console.error("Error fetching scheduler data:", error);
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, [weekDates]);

  // Unique filters
  const scheduledCities = useMemo(
    () =>
      Array.from(
        new Set(
          schedules.map((event) => normalizeString(event.city))
        )
      ).filter(Boolean),
    [schedules]
  );
  const scheduledEngineers = useMemo(
    () =>
      Array.from(
        new Set(schedules.map((event) => event.engineerName))
      ).filter(Boolean),
    [schedules]
  );
  const stationOptions = useMemo(
    () =>
      Array.from(
        new Set(resources.map((r) => r.city).filter(Boolean))
      ),
    [resources]
  );

  // Filter events (schedules)
  const filteredSchedules = useMemo(() => {
    return schedules.filter((event) => {
      const cityMatch =
        filterCities.length === 0 || filterCities.includes(normalizeString(event.city));
      const engineerMatch =
        filterEngineers.length === 0 || filterEngineers.includes(event.engineerName);
      const eventResource = resources.find((r) => r.name === event.engineerName);
      const stationMatch =
        filterStations.length === 0 ||
        (eventResource && filterStations.includes(eventResource.city));
      const matchesDate = !filterDate || event.scheduledFor === filterDate;
      const matchesText =
        !filterText ||
        event.bank?.toLowerCase().includes(filterText.toLowerCase()) ||
        event.branchName?.toLowerCase().includes(filterText.toLowerCase());
      return cityMatch && engineerMatch && stationMatch && matchesDate && matchesText;
    });
  }, [
    schedules,
    filterCities,
    filterEngineers,
    filterDate,
    filterText,
    filterStations,
    resources,
  ]);

  // Filter resources (engineers)
  const filteredResources = useMemo(() => {
    let list = resources;
    if (filterStations.length > 0) {
      list = list.filter((resource) => filterStations.includes(resource.city));
    }
    if (filterEngineers.length) {
      list = list.filter((resource) => filterEngineers.includes(resource.name));
    }
    if (showOnlyScheduled) {
      const scheduledResourceNames = new Set(filteredSchedules.map((e) => e.engineerName));
      list = list.filter((r) => scheduledResourceNames.has(r.name));
    }
    return list;
  }, [
    resources,
    filteredSchedules,
    showOnlyScheduled,
    filterEngineers,
    filterStations,
  ]);

  // Agenda events (for week)
  const agendaEvents = useMemo(() => {
    const dateSet = new Set(
      weekDates.map((date) => date.toISOString().split("T")[0])
    );
    return filteredSchedules
      .filter((e) => dateSet.has(e.scheduledFor))
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  }, [filteredSchedules, weekDates]);

  const handleCellClick = useCallback(
    (resource, date) => {
      const formattedDate = date.toISOString().split("T")[0];
      const dailyEvents = filteredSchedules.filter(
        (event) => event.engineerName === resource.name && event.scheduledFor === formattedDate
      );
      if (dailyEvents.length > 0) {
        setModalData({
          resource: resource.name,
          date: date.toDateString(),
          events: dailyEvents,
        });
        setModalOpen(true);
      }
    },
    [filteredSchedules]
  );

  const navigateWeek = (direction) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + direction * 7);
      return newDate;
    });
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalData(null);
  };

  const clearFilters = () => {
    setFilterCities([]);
    setFilterStations([]);
    setFilterEngineers([]);
    setFilterText("");
    setFilterDate("");
    setShowOnlyScheduled(false);
  };

  // Export to Excel (only for selected date)
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
  
    // 1. SCHEDULED VISITS SHEET
    const worksheet = workbook.addWorksheet("Scheduled Visits");
    worksheet.columns = [
      { header: "City", key: "city", width: 18 },
      { header: "Engineer Name", key: "engineer", width: 25 },
      { header: "Schedule Date", key: "date", width: 20 },
      { header: "Bank", key: "bank", width: 22 },
      { header: "Branch Name", key: "branch", width: 30 },
      { header: "Branch Code", key: "code", width: 15 },
      { header: "Status", key: "status", width: 18 },
      { header: "Performed By", key: "performedBy", width: 20 },
    ];
  
    // EVENTS ONLY FOR SELECTED DATE
    const events = filteredSchedules.filter(event =>
      filteredResources.map(r => r.name).includes(event.engineerName) &&
      filterDate && event.scheduledFor === filterDate
    );
  
    // 🟢 DEBUG LOG
    console.log("Events sample (first 5):", events.slice(0, 5).map(e => ({
      engineer: e.engineerName,
      city: e.city,
      status: e.status
    })));
  
    // Group by city for display
    const cityOrderLower = cityOrder.map(c => c.toLowerCase());
    const cityGroups = {};
    events.forEach(event => {
      const cityName = event.city || "";
      const normalized = cityName.toLowerCase();
      let groupKey;
      const foundIndex = cityOrderLower.indexOf(normalized);
      if (foundIndex !== -1) {
        groupKey = cityOrder[foundIndex];
      } else {
        groupKey = `Others (${cityName.charAt(0).toUpperCase() + cityName.slice(1)})`;
      }
      if (!cityGroups[groupKey]) cityGroups[groupKey] = [];
      cityGroups[groupKey].push(event);
    });
  
    // Write events to Excel, grouped and styled
    let rowNum = 1;
    worksheet.getRow(rowNum).values = worksheet.columns.map(col => col.header);
    worksheet.getRow(rowNum).font = { bold: true, color: { argb: "FFFFFF" } };
    worksheet.getRow(rowNum).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "4CAF50" },
    };
    rowNum++;
  
    cityOrder.forEach(city => {
      if (cityGroups[city]) {
        worksheet.getRow(rowNum).values = [city];
        worksheet.getRow(rowNum).font = { bold: true };
        worksheet.getRow(rowNum).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD966" },
        };
        rowNum++;
        cityGroups[city].forEach(event => {
          worksheet.getRow(rowNum).values = [
            event.city,
            event.engineerName,
            event.scheduledFor,
            event.bank,
            event.branchName,
            event.branchCode,
            event.status,
            event.performedBy,
          ];
          rowNum++;
        });
        rowNum++; // Blank line after city group
      }
    });
  
    // "Others" cities/groups at the end
    Object.entries(cityGroups).forEach(([city, groupEvents]) => {
      if (!cityOrder.includes(city)) {
        worksheet.getRow(rowNum).values = [city];
        worksheet.getRow(rowNum).font = { bold: true };
        worksheet.getRow(rowNum).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD966" },
        };
        rowNum++;
        groupEvents.forEach(event => {
          worksheet.getRow(rowNum).values = [
            event.city,
            event.engineerName,
            event.scheduledFor,
            event.bank,
            event.branchName,
            event.branchCode,
            event.status,
            event.performedBy,
          ];
          rowNum++;
        });
        rowNum++;
      }
    });
  
    // ✅ STATUS NORMALIZATION
    const normalizeStatus = status =>
      status ? status.toString().trim().toLowerCase() : "";
  
    const successLabels = ["successful", "success", "successfull", "done", "completed"];
    const expiredLabels = ["expired", "closed", "timeout"];
  
    // 2. REPORT SHEET
    const reportSheet = workbook.addWorksheet("Report");
  
    // Section 1: Success Rate Per Day
    reportSheet.addRow(["Success Rate Per Day"]);
    reportSheet.getRow(reportSheet.lastRow.number).font = { bold: true };
    reportSheet.addRow(["Date", "Total Schedules", "Successful", "Expired", "Success Rate (%)"]);
  
    let total = events.length;
    let successful = events.filter(e =>
      successLabels.some(lbl => normalizeStatus(e.status).includes(lbl))
    ).length;
    let expired = events.filter(e =>
      expiredLabels.some(lbl => normalizeStatus(e.status).includes(lbl))
    ).length;
    let successRate = total ? ((successful / total) * 100).toFixed(1) : "0";
  
    if (filterDate) {
      reportSheet.addRow([
        filterDate,
        total,
        successful,
        expired,
        successRate
      ]);
    }
    reportSheet.addRow([]);
  
    // Section 2: Visits by City
    reportSheet.addRow(["Visits by City"]);
    reportSheet.getRow(reportSheet.lastRow.number).font = { bold: true };
    reportSheet.addRow(["City", "Total", "Successful", "Expired", "Success Rate (%)"]);
  
    let othersTotal = 0, othersSuccessful = 0, othersExpired = 0;
  
    cityOrder.forEach(city => {
      const cityEvents = (cityGroups[city] || []);
      const total = cityEvents.length;
      const successful = cityEvents.filter(e =>
        successLabels.some(lbl => normalizeStatus(e.status).includes(lbl))
      ).length;
      const expired = cityEvents.filter(e =>
        expiredLabels.some(lbl => normalizeStatus(e.status).includes(lbl))
      ).length;
      const successRate = total ? ((successful / total) * 100).toFixed(1) : "0";
  
      reportSheet.addRow([city, total, successful, expired, successRate]);
    });
  
    // Aggregate "Others"
    Object.entries(cityGroups).forEach(([city, groupEvents]) => {
      if (!cityOrder.includes(city)) {
        const total = groupEvents.length;
        const successful = groupEvents.filter(e =>
          successLabels.some(lbl => normalizeStatus(e.status).includes(lbl))
        ).length;
        const expired = groupEvents.filter(e =>
          expiredLabels.some(lbl => normalizeStatus(e.status).includes(lbl))
        ).length;
  
        othersTotal += total;
        othersSuccessful += successful;
        othersExpired += expired;
      }
    });
  
    if (othersTotal > 0) {
      const successRate = ((othersSuccessful / othersTotal) * 100).toFixed(1);
      reportSheet.addRow(["Others", othersTotal, othersSuccessful, othersExpired, successRate]);
    }
  
    reportSheet.addRow([]);
  
    // Section 3: Success Rate by Engineer
    reportSheet.addRow(["Success Rate by Engineer"]);
    reportSheet.getRow(reportSheet.lastRow.number).font = { bold: true };
    reportSheet.addRow(["Engineer", "Total", "Successful", "Expired", "Success Rate (%)"]);
  
    const engineerStats = {};
    events.forEach(ev => {
      const engineer = ev.engineerName;
      if (!engineerStats[engineer]) engineerStats[engineer] = { total: 0, successful: 0, expired: 0 };
      engineerStats[engineer].total += 1;
      if (successLabels.some(lbl => normalizeStatus(ev.status).includes(lbl))) engineerStats[engineer].successful += 1;
      if (expiredLabels.some(lbl => normalizeStatus(ev.status).includes(lbl))) engineerStats[engineer].expired += 1;
    });
  
    Object.entries(engineerStats).sort((a, b) => a[0].localeCompare(b[0])).forEach(([engineer, stats]) => {
      const successRate = stats.total ? ((stats.successful / stats.total) * 100).toFixed(1) : "0";
      reportSheet.addRow([
        engineer,
        stats.total,
        stats.successful,
        stats.expired,
        successRate
      ]);
    });
  
    reportSheet.columns = [
      { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 20 }
    ];
  
    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "Scheduled_Visits.xlsx");
  };
  
  
  

  return (
    <div className="scheduler-container">
      {/* FILTERS */}
      <Box display="flex" flexWrap="wrap" alignItems="center" mb={2} gap={2}>
        {/* Station Filter */}
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="station-filter-label">Station</InputLabel>
          <Select
            labelId="station-filter-label"
            multiple
            value={filterStations}
            onChange={(e) => setFilterStations(e.target.value)}
            input={<OutlinedInput label="Station" />}
            renderValue={(selected) =>
              selected
                .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
                .join(", ")
            }
          >
            {stationOptions.map((station) => (
              <MenuItem key={station} value={station}>
                <Checkbox checked={filterStations.indexOf(station) > -1} />
                <ListItemText
                  primary={station.charAt(0).toUpperCase() + station.slice(1)}
                />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* City Filter */}
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="city-filter-label">City (Branch)</InputLabel>
          <Select
            labelId="city-filter-label"
            multiple
            value={filterCities}
            onChange={(e) => setFilterCities(e.target.value)}
            input={<OutlinedInput label="City (Branch)" />}
            renderValue={(selected) =>
              selected
                .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
                .join(", ")
            }
          >
            {scheduledCities.map((city) => (
              <MenuItem key={city} value={city}>
                <Checkbox checked={filterCities.indexOf(city) > -1} />
                <ListItemText
                  primary={city.charAt(0).toUpperCase() + city.slice(1)}
                />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* Engineer Filter */}
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="engineer-filter-label">Engineers</InputLabel>
          <Select
            labelId="engineer-filter-label"
            multiple
            value={filterEngineers}
            onChange={(e) => setFilterEngineers(e.target.value)}
            input={<OutlinedInput label="Engineers" />}
            renderValue={(selected) => selected.join(", ")}
          >
            {scheduledEngineers.map((engineer) => (
              <MenuItem key={engineer} value={engineer}>
                <Checkbox checked={filterEngineers.indexOf(engineer) > -1} />
                <ListItemText primary={engineer} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* Bank/Branch Text Filter */}
        <TextField
          label="Bank/Branch"
          variant="outlined"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          sx={{ minWidth: 180 }}
        />
        {/* Date Picker */}
        <TextField
          label="Date"
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 140 }}
        />
        {/* Show Only Scheduled Toggle */}
        <FormControl>
          <Button
            variant={showOnlyScheduled ? "contained" : "outlined"}
            onClick={() => setShowOnlyScheduled((s) => !s)}
            sx={{ whiteSpace: "nowrap" }}
          >
            {showOnlyScheduled ? "Showing Only Scheduled" : "All Resources"}
          </Button>
        </FormControl>
        {/* Export/Clear */}
        <Button
          variant="contained"
          onClick={exportToExcel}
          sx={{ bgcolor: "#4CAF50" }}
          disabled={!filterDate}
        >
          Export to Excel
        </Button>
        <Button variant="outlined" color="success" onClick={clearFilters}>
          Clear
        </Button>
      </Box>
      {/* VIEW TOGGLE */}
      <Box display="flex" alignItems="center" mb={2} gap={1}>
        <Tabs
          value={view}
          onChange={(_, v) => setView(v)}
          sx={{ minHeight: 40 }}
        >
          <Tab icon={<TableChart />} label="Table View" />
          <Tab icon={<ListAlt />} label="Agenda View" />
        </Tabs>
        <Box flex={1} />
        <IconButton onClick={() => navigateWeek(-1)}>
          <ArrowBack />
        </IconButton>
        <Typography variant="subtitle1">
          {weekDates[0].toDateString()} - {weekDates[6].toDateString()}
        </Typography>
        <IconButton onClick={() => navigateWeek(1)}>
          <ArrowForward />
        </IconButton>
      </Box>
      {/* MAIN DISPLAY */}
      {view === 0 ? (
        // TABLE VIEW
        <div className="scheduler-table-wrapper">
          <table className="scheduler-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Station</th>
                {weekDates.map((date, index) => (
                  <th key={index}>
                    {date.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredResources.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{ textAlign: "center", color: "#999" }}
                  >
                    No resources match the current filters.
                  </td>
                </tr>
              ) : (
                filteredResources.map((resource) => (
                  <tr key={resource.name}>
                    <td>{resource.name}</td>
                    <td>
                      {resource.city
                        ? resource.city.charAt(0).toUpperCase() +
                          resource.city.slice(1)
                        : ""}
                    </td>
                    {weekDates.map((date) => {
                      const formattedDate = date.toISOString().split("T")[0];
                      const dailyEvents = filteredSchedules.filter(
                        (event) =>
                          event.engineerName === resource.name &&
                          event.scheduledFor === formattedDate
                      );
                      const visitCount = dailyEvents.length;
                      const successfulCount = dailyEvents.filter(
                        (ev) => ev.status === "Successful"
                      ).length;
                      const expiredCount = dailyEvents.filter(
                        (ev) => ev.status === "Expired"
                      ).length;
                      const isAllSuccessful =
                        visitCount > 0 && successfulCount === visitCount;

                      return (
                        <td
                          key={date.toDateString()}
                          className={`scheduler-cell ${visitCount > 0 ? "has-event" : ""}${
                            isAllSuccessful ? " all-successful" : expiredCount === visitCount ? " all-expired" : ""
                          }`}
                          onClick={() => handleCellClick(resource, date)}
                          style={{
                            cursor: visitCount > 0 ? "pointer" : undefined,
                          }}
                          title={
                            visitCount > 0
                              ? `${successfulCount} successful, ${expiredCount} expired out of ${visitCount} schedules`
                              : undefined
                          }
                        >
                          {visitCount > 0 ? (
                            <>
                              {successfulCount}
                              <span style={{ fontSize: "0.85em", color: "#888" }}>
                                /{visitCount}
                              </span>
                            </>
                          ) : (
                            ""
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        // AGENDA VIEW
        <Box mt={2}>
          {agendaEvents.length === 0 ? (
            <Typography>No scheduled visits in this week.</Typography>
          ) : (
            agendaEvents.map((event, idx) => (
              <Box
                key={idx}
                mb={2}
                p={2}
                border="1px solid #e0e0e0"
                borderRadius={2}
                bgcolor="#fafafa"
              >
                <Typography variant="subtitle2" color="primary">
                  {new Date(event.scheduledFor).toLocaleDateString()} — {event.engineerName}
                </Typography>
                <Typography>
                  <strong>Station:</strong>{" "}
                  {resources.find((r) => r.name === event.engineerName)?.city || "-"}
                </Typography>
                <Typography>
                  <strong>City (Branch):</strong> {event.city}
                </Typography>
                <Typography>
                  <strong>Bank:</strong> {event.bank}
                </Typography>
                <Typography>
                  <strong>Branch Name:</strong> {event.branchName}
                </Typography>
                <Typography>
                  <strong>Branch Code:</strong> {event.branchCode}
                </Typography>
                <Typography>
                  <strong>Status:</strong> {event.status}
                </Typography>
                <Typography>
                  <strong>Performed By:</strong> {event.performedBy}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      )}
      {/* MODAL */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <Box className="modal-box">
          <div className="modal-header">
            <Typography id="modal-title" variant="h6" component="h2">
              Details for {modalData?.resource} on {modalData?.date}
            </Typography>
            <button className="modal-close-button" onClick={handleCloseModal}>
              Close
            </button>
          </div>
          <div className="modal-content" id="modal-description">
            {modalData?.events.map((event, index) => (
              <div className="modal-event" key={index}>
                <p>
                  <strong>Station:</strong>{" "}
                  {resources.find((r) => r.name === event.engineerName)?.city || "-"}
                </p>
                <p>
                  <strong>City (Branch):</strong> {event.city || "Unknown"}
                </p>
                <p>
                  <strong>Bank:</strong> {event.bank}
                </p>
                <p>
                  <strong>Branch Name:</strong> {event.branchName || "Unknown"}
                </p>
                <p>
                  <strong>Branch Code:</strong> {event.branchCode || "Unknown"}
                </p>
                <p>
                  <strong>Status:</strong> {event.status || "Unknown"}
                </p>
                <p>
                  <strong>Performed By:</strong> {event.performedBy || "Unknown"}
                </p>
              </div>
            ))}
          </div>
        </Box>
      </Modal>
    </div>
  );
};

export default Scheduler;

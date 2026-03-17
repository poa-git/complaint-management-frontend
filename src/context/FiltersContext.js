// src/context/FiltersContext.js
import React, { createContext, useContext, useState, useEffect } from "react";

const FiltersContext = createContext();

const defaultFilters = {
  status: "",
  bankName: "",
  branchCode: "",
  branchName: "",
  engineerName: "",
  city: "",
  complaintStatus: "",
  subStatus: "",
  date: "",
  dateFrom: "",
  dateTo: "",
  priority: "",
  inPool: "",
  hasReport: false,
  reportType: "",
};

export const FiltersProvider = ({ children }) => {
  const [filters, setFilters] = useState(defaultFilters);

  // Optional: persist in localStorage so filters survive page refresh
  useEffect(() => {
    const saved = localStorage.getItem("filters");
    if (saved) {
      setFilters(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("filters", JSON.stringify(filters));
  }, [filters]);

  return (
    <FiltersContext.Provider value={{ filters, setFilters, defaultFilters }}>
      {children}
    </FiltersContext.Provider>
  );
};

export const useFilters = () => useContext(FiltersContext);

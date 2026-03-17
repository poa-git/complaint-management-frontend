import React, { useEffect, useState } from "react";
import axios from "axios";
import TodaysComplaints from "./TodaysComplaints/TodaysComplaints";
import TodayBankWiseComplaints from "./TodayBankWiseComplaints/TodayBankWiseComplaints";
import TodayCityWiseComplaints from "./TodayCityWiseComplaints/TodayCityWiseComplaints";
import "./Metrics.css";

const TodaysMetrics = () => {
  // State variables for complaints data
  const [todaysComplaints, setTodaysComplaints] = useState({
    todayOpenComplaints: 0,
    todayClosedComplaints: 0,
  });
  const [cityWiseTodaysComplaints, setCityWiseTodaysComplaints] = useState({});
  const [bankWiseTodaysComplaints, setBankWiseTodaysComplaints] = useState({});

  // Fetch all metrics on component mount
  useEffect(() => {
    fetchAllMetrics();
  }, []);

  const fetchAllMetrics = async () => {
    try {
      await Promise.all([
        fetchTodaysComplaints(),
        fetchCityWiseTodaysComplaints(),
        fetchBankWiseTodaysComplaints(),
      ]);
    } catch (error) {
      console.error("Error fetching metrics data:", error);
    }
  };

  const fetchTodaysComplaints = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/complaints/todays-complaints`,
        { withCredentials: true }
      );
      setTodaysComplaints(response.data || {});
    } catch (error) {
      console.error("Error fetching today's complaints metrics:", error);
    }
  };

  const fetchCityWiseTodaysComplaints = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/complaints/city-wise-todays-metrics`,
        { withCredentials: true }
      );

      const normalizedData = Object.fromEntries(
        Object.entries(response.data || {}).map(([city, metrics]) => [
          city.charAt(0).toUpperCase() + city.slice(1).toLowerCase(),
          metrics,
        ])
      );

      setCityWiseTodaysComplaints(normalizedData);
    } catch (error) {
      console.error("Error fetching city-wise today's complaints metrics:", error);
    }
  };

  const fetchBankWiseTodaysComplaints = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/complaints/bank-wise-todays-metrics`,
        { withCredentials: true }
      );

      const normalizedData = Object.fromEntries(
        Object.entries(response.data || {}).map(([bank, metrics]) => [
          bank.charAt(0).toUpperCase() + bank.slice(1).toLowerCase(),
          metrics,
        ])
      );

      setBankWiseTodaysComplaints(normalizedData);
    } catch (error) {
      console.error("Error fetching bank-wise today's complaints metrics:", error);
    }
  };

  return (
    <div className="metrics-container">
      <h1 className="metrics-title">Metrics Overview</h1>

      {/* Section: Today's Complaints */}
      <section className="metrics-section">
        <h2 className="metrics-subtitle">Today's Complaints</h2>
          <TodaysComplaints
            todayOpenComplaints={todaysComplaints.todayOpenComplaints}
            todayClosedComplaints={todaysComplaints.todayClosedComplaints}
          />
      </section>

      {/* Section: City-Wise Complaints */}
      <section className="metrics-section">
        <h2 className="metrics-subtitle">City-Wise Complaints</h2>
        <TodayCityWiseComplaints cityWiseData={cityWiseTodaysComplaints} />
      </section>

      {/* Section: Bank-Wise Complaints */}
      <section className="metrics-section">
        <h2 className="metrics-subtitle">Bank-Wise Complaints</h2>
        <TodayBankWiseComplaints bankWiseData={bankWiseTodaysComplaints} />
      </section>
    </div>
  );
};

export default TodaysMetrics;

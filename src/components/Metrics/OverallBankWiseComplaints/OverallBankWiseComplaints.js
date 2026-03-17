import React, { useRef, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import * as d3 from "d3";
import "./bankWiseComplaints.css";

const OverallBankWiseComplaints = ({ bankWiseData }) => {
  const chartRef = useRef();

  const getMetric = (metrics, keyPath, defaultValue = 0) => {
    return keyPath
      .split(".")
      .reduce(
        (obj, key) => (obj && obj[key] !== undefined ? obj[key] : defaultValue),
        metrics
      );
  };

  const processedData = useMemo(() => {
    const data = Object.entries(bankWiseData || {})
      .filter(([bank]) => bank.trim() !== "")
      .map(([bank, metrics]) => ({
        bank: bank.trim(),
        open: getMetric(metrics, "allOpenComplaints", 0),
        hardwarePicked: getMetric(metrics, "allHardwarePickedComplaints", 0),
        approved: getMetric(metrics, "allApprovedComplaints", 0),
        waitForApproval: getMetric(metrics, "allWaitForApprovalComplaints", 0),
      }))
      .map((d) => ({
        ...d,
        total: d.open + d.hardwarePicked + d.approved + d.waitForApproval,
      }))
      .sort((a, b) => b.total - a.total);

    return data;
  }, [bankWiseData]);

  useEffect(() => {
    const data = processedData;
    if (!data || data.length === 0) {
      console.warn("No data available for OverallBankWiseComplaints.");
      return;
    }

    const container = d3.select(chartRef.current);
    container.selectAll("*").remove();

    const bankHeight = 50;
    const margin = { top: 80, right: 180, bottom: 50, left: 200 };
    const containerWidth = Math.max(container.node().clientWidth || 1200, 1200);
    const containerHeight = Math.max(600, data.length * bankHeight + margin.top + margin.bottom);
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container
      .append("svg")
      .attr("width", "100%")
      .attr("height", containerHeight)
      .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
      .attr("preserveAspectRatio", "xMinYMin meet")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xMax = d3.max(data, (d) => d.total) || 0;

    const x = d3.scaleLinear().domain([0, xMax]).range([50, width]);
    const y = d3.scaleBand().domain(data.map((d) => d.bank)).range([0, height]).padding(0.3);

    function getBarWidth(value) {
      return x(value);
    }

    const colors = {
      open: "#3b82f6",
      hardwarePicked: "#469B00",
      approved: "#D63384",
      waitForApproval: "#856404",
    };

    const statuses = [
      { key: "open", color: colors.open },
      { key: "hardwarePicked", color: colors.hardwarePicked },
      { key: "approved", color: colors.approved },
      { key: "waitForApproval", color: colors.waitForApproval },
    ];

    svg.append("g")
      .attr("class", "grid")
      .call(d3.axisBottom(x).tickSize(-height).tickFormat(""))
      .attr("transform", `translate(0,${height})`)
      .selectAll("line")
      .style("stroke", "#eaeaea")
      .style("stroke-dasharray", "4,2");

    const yAxis = svg.append("g").attr("class", "y-axis").call(d3.axisLeft(y));
    yAxis.select(".domain").remove();
    yAxis.selectAll("text")
      .style("font-size", "15px")
      .style("font-weight", "bold")
      .style("fill", "#333");

    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.85)")
      .style("color", "#fff")
      .style("padding", "8px 12px")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("transition", "opacity 0.2s ease-in-out");

    const barGroups = svg.selectAll(".bar-group").data(data).enter().append("g")
      .attr("class", "bar-group")
      .attr("transform", (d) => `translate(0, ${y(d.bank)})`);

    barGroups.each(function (d) {
      let xOffset = 0;
      statuses.forEach((status) => {
        const value = d[status.key];
        const barWidth = getBarWidth(value);

        d3.select(this)
          .append("rect")
          .attr("x", xOffset)
          .attr("y", 0)
          .attr("width", 0)
          .attr("height", y.bandwidth())
          .attr("fill", status.color)
          .attr("rx", 4)
          .transition()
          .duration(800)
          .attr("width", barWidth);

        const text = d3.select(this)
          .append("text")
          .attr("class", "bar-label")
          .attr("x", xOffset + barWidth / 2)
          .attr("y", y.bandwidth() / 2)
          .attr("dy", ".35em")
          .attr("text-anchor", barWidth > 40 ? "middle" : "start")
          .attr("fill", barWidth > 40 ? "#fff" : "#333")
          .text(value);

        if (text.node().getBBox().width > barWidth - 10) {
          text.attr("x", xOffset + barWidth + 5).attr("text-anchor", "start").attr("fill", "#333");
        }

        xOffset += barWidth;
      });
    });

    const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(0, -40)`);
    legend.selectAll(".legend-item")
      .data(statuses)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(${i * 220}, 0)`)
      .each(function (d) {
        d3.select(this).append("rect").attr("width", 16).attr("height", 16).attr("fill", d.color);
        d3.select(this).append("text").attr("x", 30).attr("y", 15).style("font-size", "18px")
          .style("alignment-baseline", "middle").text(d.key.replace(/([A-Z])/g, ' $1').trim());
      });

    return () => tooltip.remove();
  }, [processedData]);

  return (
    <div className="bank-wise-container">
      <h3 className="text-xl font-semibold mb-4">Overall Bank-Wise Complaints</h3>
      <div ref={chartRef} className="bank-chart overflow-x-auto whitespace-nowrap"
        role="img" aria-label="Stacked bar chart of complaints for each bank"
        style={{ minHeight: `${Math.max(600, processedData.length * 50 + 130)}px` }} />
    </div>
  );
};

OverallBankWiseComplaints.propTypes = {
  bankWiseData: PropTypes.object.isRequired,
};

export default OverallBankWiseComplaints;

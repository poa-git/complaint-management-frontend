import React, { useRef, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import * as d3 from "d3";
import "./cityWiseComplaints.css";

const TodayCityWiseComplaints = ({ cityWiseData }) => {
  const chartRef = useRef();
  const tooltipRef = useRef();

  // Process data with useMemo for performance
  const processedData = useMemo(() => {
    return Object.entries(cityWiseData || {}).map(([city, metrics]) => ({
      city: city.trim(),
      open: metrics.todayOpenComplaints || 0,
      closed: metrics.todayClosedComplaints || 0,
    }));
  }, [cityWiseData]);

  useEffect(() => {
    const data = processedData;

    // If there's no data, log a warning and exit
    if (!data || data.length === 0) {
      console.warn("No data available for TodayCityWiseComplaints.");
      return;
    }

    // Select the chart container
    const container = d3.select(chartRef.current);
    // Clear existing SVG content to avoid duplication
    container.selectAll("*").remove();

    // Dimensions and margins
    const margin = { top: 70, right: 20, bottom: 50, left: 200 };
    const cityHeight = 40; // Height per city row

    // Dynamically set the container height to accommodate the data
    const containerWidth = container.node().clientWidth || 900;
    const containerHeight = Math.max(
      500,
      data.length * cityHeight + margin.top + margin.bottom
    );

    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    // Create SVG with a responsive viewBox
    const svg = container
      .append("svg")
      .attr("width", "100%")
      .attr("height", containerHeight)
      .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // x-scale: range based on max of (open + closed)
    const xMax = d3.max(data, (d) => d.open + d.closed) || 0;
    const x = d3.scaleLinear().domain([0, xMax]).nice().range([0, width]);

    // y-scale: band scale for city names
    const y = d3
      .scaleBand()
      .domain(data.map((d) => d.city))
      .range([0, height])
      .padding(0.1);

    // Add gridlines along the x-axis
    svg
      .append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisBottom(x)
          .tickSize(-height)
          .tickFormat("") // Only the grid lines, no tick labels
      )
      .attr("transform", `translate(0,${height})`)
      .selectAll("line")
      .style("stroke", "#eaeaea")
      .style("stroke-dasharray", "4,2");

    // x-axis
    svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5))
      .call((g) => g.selectAll(".domain").remove());

    // y-axis with improved labels
    svg
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "#555")
      .call((text) =>
        text.each(function () {
          // Truncate long city names, show full in a tooltip
          const self = d3.select(this);
          const label = self.text();
          if (label.length > 20) {
            self.text(label.substring(0, 20) + "...");
            self.append("title").text(label);
          }
        })
      );

    // Define gradients (open/closed)
    const defs = svg.append("defs");

    // Gradient for open
    const gradientOpen = defs
      .append("linearGradient")
      .attr("id", "gradientOpenCity")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");
    gradientOpen
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#3b82f6");
    gradientOpen
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#60a5fa");

    // Gradient for closed
    const gradientClosed = defs
      .append("linearGradient")
      .attr("id", "gradientClosedCity")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");
    gradientClosed
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#10b981");
    gradientClosed
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#34d399");

    // Re-use or create tooltip
    let tooltip = d3.select(".tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "#fff")
        .style("padding", "8px 12px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", "1000");
      tooltipRef.current = tooltip;
    }

    // Prepare statuses for stacked bars
    const statuses = [
      { key: "open", gradient: "url(#gradientOpenCity)" },
      { key: "closed", gradient: "url(#gradientClosedCity)" },
    ];

    // Create bar groups for each city
    const barGroups = svg
      .selectAll(".bar-group")
      .data(data)
      .enter()
      .append("g")
      .attr("class", "bar-group")
      .attr("transform", (d) => `translate(0, ${y(d.city)})`);

    // Draw the stacked bars (open + closed)
    barGroups.each(function (d) {
      let xOffset = 0;
      statuses.forEach((status) => {
        const value = d[status.key] || 0;
        const barWidth = x(value);

        // Actual bar with gradient fill
        d3.select(this)
          .append("rect")
          .attr("x", xOffset)
          .attr("y", 0)
          .attr("width", 0) // Animate from 0 to final width
          .attr("height", y.bandwidth())
          .attr("fill", status.gradient)
          .attr("rx", 5) // Rounded corners
          .attr("ry", 5)
          .transition()
          .duration(800)
          .attr("width", barWidth);

        // Transparent overlay for tooltip and mouse events
        d3.select(this)
          .append("rect")
          .attr("x", xOffset)
          .attr("y", 0)
          .attr("width", barWidth)
          .attr("height", y.bandwidth())
          .attr("fill", "transparent")
          .style("cursor", "pointer")
          .on("mouseover", () => {
            tooltip
              .style("opacity", 1)
              .html(
                `<strong>${status.key.toUpperCase()}:</strong> ${value}`
              );
          })
          .on("mousemove", (event) => {
            tooltip
              .style("left", `${event.pageX + 10}px`)
              .style("top", `${event.pageY - 28}px`);
          })
          .on("mouseout", () => {
            tooltip.style("opacity", 0);
          });

        // Label inside or outside the bar
        const label = d3
          .select(this)
          .append("text")
          .attr("class", "bar-label")
          .attr("x", xOffset + barWidth / 2)
          .attr("y", y.bandwidth() / 2)
          .attr("dy", ".35em")
          .attr("text-anchor", "middle")
          .text(value)
          .style("pointer-events", "none");

        // If the text is wider than the bar, move it outside
        label.each(function () {
          const textWidth = this.getBBox().width;
          const availableWidth = barWidth - 20; // 10px padding each side
          if (textWidth > availableWidth) {
            d3.select(this)
              .attr("x", xOffset + barWidth + 10)
              .attr("text-anchor", "start")
              .style("fill", "#333");
          }
        });

        xOffset += barWidth;
      });
    });

    // Legend
    const legendData = [
      { color: "url(#gradientOpenCity)", label: "Open Complaints" },
      { color: "url(#gradientClosedCity)", label: "Closed Complaints" },
    ];

    const legend = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(0, -40)`);

    legend
      .selectAll(".legend-item")
      .data(legendData)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(${i * 200}, 0)`)
      .each(function (d) {
        const item = d3.select(this);
        item
          .append("rect")
          .attr("width", 20)
          .attr("height", 20)
          .attr("fill", d.color);

        item
          .append("text")
          .attr("x", 30)
          .attr("y", 15)
          .style("font-size", "14px")
          .style("alignment-baseline", "middle")
          .text(d.label);
      });

    // Cleanup: remove tooltip on unmount
    return () => {
      tooltip.remove();
    };
  }, [processedData]);

  return (
    <div className="city-wise-container">
      {/* Optional title if desired */}
      {/* <h3 className="section-title">Today’s City-Wise Complaints</h3> */}

      <div
        ref={chartRef}
        className="city-chart"
        style={{
          overflowX: "auto",
          whiteSpace: "nowrap"
        }}
        role="img"
        aria-label="Bar chart of today's open and closed complaints by city"
      ></div>
    </div>
  );
};

TodayCityWiseComplaints.propTypes = {
  cityWiseData: PropTypes.object.isRequired,
};

export default TodayCityWiseComplaints;

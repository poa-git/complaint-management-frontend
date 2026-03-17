import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import "./TodaysComplaints.css"

const TodaysComplaints = ({ todayOpenComplaints, todayClosedComplaints }) => {
  const chartRef = useRef();

  useEffect(() => {
    const data = [
      { name: "Open", value: todayOpenComplaints || 0, color: "url(#gradientOpenCity)" },
      { name: "Closed", value: todayClosedComplaints || 0, color: "url(#gradientClosedCity)" },
    ];

    // Clear any existing chart
    d3.select(chartRef.current).selectAll("*").remove();

    // Set dimensions
    const width = 300;
    const height = 300;
    const radius = Math.min(width, height) / 2;

    // Create SVG container
    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Define gradients
    const defs = svg.append("defs");

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

    // Create pie generator
    const pie = d3.pie().value((d) => d.value).sort(null);

    // Create arc generator
    const arc = d3.arc().innerRadius(80).outerRadius(radius);

    // Initialize tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

    // Bind data and create arcs
    const arcs = svg
      .selectAll("path")
      .data(pie(data))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => d.data.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("class", "pie-slice")
      .on("mouseover", function (event, d) {
        d3.select(this).transition().duration(200).attr("opacity", 0.7);
        tooltip
          .transition()
          .duration(200)
          .style("opacity", 0.9);
        tooltip
          .html(`<strong>${d.data.name}</strong>: ${d.data.value}`)
          .style("left", event.pageX + 15 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", event.pageX + 15 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", function () {
        d3.select(this).transition().duration(200).attr("opacity", 1);
        tooltip.transition().duration(500).style("opacity", 0);
      })
      .transition()
      .duration(1000)
      .attrTween("d", function (d) {
        const i = d3.interpolate(
          { startAngle: 0, endAngle: 0 },
          d
        );
        return function (t) {
          return arc(i(t));
        };
      });

    // Add labels
    svg
      .selectAll("text")
      .data(pie(data))
      .enter()
      .append("text")
      .text((d) => `${d.data.name}: ${d.data.value}`)
      .attr("transform", (d) => `translate(${arc.centroid(d)})`)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .style("pointer-events", "none");

    // Add title
    svg
      .append("text")
      .attr("x", 0)
      .attr("y", -radius - 20)
      .attr("text-anchor", "middle")
      .text("Today's Complaints Metrics")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("fill", "#333");

    // Cleanup function to remove tooltip on component unmount
    return () => {
      tooltip.remove();
    };
  }, [todayOpenComplaints, todayClosedComplaints]);

  return (
    <div className="todays-complaints-container">
      {/* <h3 className="section-title">Today's Complaints Metrics</h3> */}
      <div
        ref={chartRef}
        className="chart-container"
        role="img"
        aria-label="Pie chart showing today's open and closed complaints"
      ></div>
    </div>
  );
};

export default TodaysComplaints;

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import "./OverallComplaints.css"

const OverallComplaints = ({
  totalOpenComplaints,
  totalClosedComplaints,
  totalWaitForApprovalComplaints,
  totalApprovedComplaints,
}) => {
  const chartRef = useRef();

  useEffect(() => {
    const data = [
      { name: "Open", value: totalOpenComplaints || 0, color: "url(#gradientOpenCity)" },
      { name: "Closed", value: totalClosedComplaints || 0, color: "url(#gradientClosedCity)" },
      { name: "Wait For Approval", value: totalWaitForApprovalComplaints || 0, color: "url(#gradientWaitApproval)" },
      { name: "Approved", value: totalApprovedComplaints || 0, color: "#a30956" }, // Updated color for Approved
    ];

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const percentages = data.map((d) => ({
      ...d,
      percentage: ((d.value / total) * 100).toFixed(1), // Calculate percentage
    }));

    // Clear any existing chart
    d3.select(chartRef.current).selectAll("*").remove();

    // Set dimensions
    const width = 400;
    const height = 400;
    const radius = Math.min(width, height) / 2;

    // Create SVG container
    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width + 200) // Add extra width for the legend
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Define gradients
    const defs = svg.append("defs");

    const createGradient = (id, startColor, endColor) => {
      const gradient = defs.append("linearGradient").attr("id", id).attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");
      gradient.append("stop").attr("offset", "0%").attr("stop-color", startColor);
      gradient.append("stop").attr("offset", "100%").attr("stop-color", endColor);
    };

    createGradient("gradientOpenCity", "#3b82f6", "#60a5fa");
    createGradient("gradientClosedCity", "#10b981", "#34d399");
    createGradient("gradientWaitApproval", "#f59e0b", "#fbbf24");

    // Create pie generator
    const pie = d3.pie().value((d) => d.value).sort(null);

    // Create arc generator
    const arc = d3.arc().innerRadius(100).outerRadius(radius);

    const arcHover = d3.arc().innerRadius(90).outerRadius(radius + 10);

    // Initialize tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("background-color", "rgba(0, 0, 0, 0.75)")
      .style("color", "white")
      .style("padding", "5px 10px")
      .style("border-radius", "5px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    // Bind data and create arcs
    svg
      .selectAll("path")
      .data(pie(percentages))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => d.data.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .on("mouseover", function (event, d) {
        d3.select(this).transition().duration(200).attr("d", arcHover);
        tooltip
          .transition()
          .duration(200)
          .style("opacity", 0.9);
        tooltip
          .html(
            `<strong>${d.data.name}</strong>: ${d.data.value} (${d.data.percentage}%)`
          )
          .style("left", event.pageX + 15 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", event.pageX + 15 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", function () {
        d3.select(this).transition().duration(200).attr("d", arc);
        tooltip.transition().duration(500).style("opacity", 0);
      })
      .transition()
      .duration(1000)
      .attrTween("d", function (d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function (t) {
          return arc(i(t));
        };
      });

    // Add legend on the left
    const legend = d3
      .select(chartRef.current)
      .select("svg")
      .append("g")
      .attr("transform", `translate(${width + 20}, 20)`);

    legend
      .selectAll("rect")
      .data(percentages)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d, i) => i * 25)
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", (d) => d.color);

    legend
      .selectAll("text")
      .data(percentages)
      .enter()
      .append("text")
      .attr("x", 25)
      .attr("y", (d, i) => i * 25 + 13)
      .text((d) => `${d.name}: ${d.value} (${d.percentage}%)`)
      .style("font-size", "14px")
      .style("fill", "#333");

    // Cleanup on unmount
    return () => {
      tooltip.remove();
    };
  }, [totalOpenComplaints, totalClosedComplaints, totalWaitForApprovalComplaints, totalApprovedComplaints]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        margin: "20px auto",
      }}
    >
      <div
        ref={chartRef}
        style={{
          width: "600px",
          height: "400px",
          position: "relative",
        }}
        role="img"
        aria-label="Pie chart showing today's complaints metrics with legend"
      ></div>
    </div>
  );
};

export default OverallComplaints;

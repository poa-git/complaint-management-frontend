import React from "react";
import "./Loader.css";

const Loader = ({ progress }) => {
  return (
    <div className="loader-overlay">
      <div className="spinner"></div>
      {progress !== undefined && (
        <div className="progress-text">{progress}%</div>
      )}
    </div>
  );
};

export default Loader;

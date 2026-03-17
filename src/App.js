import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login/Login'; // The Login component
import Dashboard from './components/Dashboard/Dashboard'; // The Dashboard component

// PrivateRoute Component for Authentication
function PrivateRoute({ children }) {
  const role = localStorage.getItem('role'); // Check if user is logged in
  return role ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Router basename="/">
      <Routes>
        {/* Redirect "/" to "/login" */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Dashboard Route */}
        <Route
          path="/dashboard/*"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* Fallback Route for 404 */}
        <Route path="*" element={<div>404 - Page Not Found</div>} />
      </Routes>
    </Router>
  );  
}

export default App;

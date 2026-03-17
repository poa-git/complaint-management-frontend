import React, { useState } from "react";
import "./login.css";
import { useNavigate } from "react-router-dom";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Same endpoints you mentioned, but used after successful form login
  const ADMIN_INFO_URL = `${process.env.REACT_APP_API_BASE_URL}/admin/info`;
  const USER_INFO_URL = `${process.env.REACT_APP_API_BASE_URL}/user/info`;

  // Your Spring Security must be configured for form-based login:
  //    .formLogin().loginProcessingUrl("/perform_login")
  const LOGIN_URL = `${process.env.REACT_APP_API_BASE_URL}/perform_login`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1) Submit credentials to Spring Security's form login endpoint
      const loginResponse = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ username, password }),
        credentials: "include",
      });

      if (!loginResponse.ok) {
        throw new Error("Login failed. Check your credentials.");
      }

      // 2) Attempt to fetch ADMIN info
      let response = await fetch(ADMIN_INFO_URL, {
        method: "GET",
        headers: {
          "Platform-Type": "WEB",
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.platformType !== "WEB") {
          throw new Error("Access denied: Incorrect platform.");
        }
        localStorage.setItem("role", "ADMIN");
        localStorage.setItem("username", data.username);
        localStorage.setItem("userId", data.id);
           // <<-- Add this line!
        // alert(data.message);
        navigate("/dashboard");
        return;
      }

      // 3) If not ADMIN, attempt to fetch USER info
      response = await fetch(USER_INFO_URL, {
        method: "GET",
        headers: {
          "Platform-Type": "WEB",
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        console.log("LOGIN DATA:", data);
        if (data.platformType !== "WEB") {
          throw new Error("Access denied: Incorrect platform.");
        }
        localStorage.setItem("role", "USER");
        localStorage.setItem("username", data.username);
        localStorage.setItem("userId", data.id);
        localStorage.setItem("userType", data.userType);
        // alert(data.message);
        if (data.username === "abdullah") {
          localStorage.setItem("userId", "1000"); // force override if needed
          navigate("/dashboard?tab=isb-rwp-complaints");
        } else if (data.userType === "LAB_USER" && data.username !== "qamar") {
          navigate("/dashboard?tab=lab-assigned");
        } else {
          navigate("/dashboard");
        }
        
      } else {
        throw new Error("You do not have ADMIN or USER access.");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h1>Login</h1>
        <p>Enter your username and password.</p>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <div className="password-container">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button type="submit" className="login-button">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;

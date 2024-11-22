import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary"; // Ensure the correct path to ErrorBoundary
import Nav from "./nav";
import Home from "./home";
import Dashboard from "./dashboard";
import ProductData from "./productdata";
import Footer from "./footer";
import Login from "./login";
import Signup from "./signup";
import ResetPassword from "./resetpassword";
import ProtectedRoute from "./protectedroute";
import { AuthProvider } from "./AuthProvider";
import VerifyEmail from "./verifyemail"; // Import the component
import Calculators from "./resources";

const App = () => {
  return (
    <Router>
      <AuthProvider>
        {" "}
        {/* Ensure AuthProvider correctly wraps the entire application content */}
        <div className="App">
          <Nav />
          <Routes>
            <Route
              path="/"
              element={
                <ErrorBoundary>
                  <Home />
                </ErrorBoundary>
              }
            />
            <Route
              path="/ResetPassword"
              element={
                <ErrorBoundary>
                  <ResetPassword />
                </ErrorBoundary>
              }
            />
            <Route
              path="/login"
              element={
                <ErrorBoundary>
                  <Login />
                </ErrorBoundary>
              }
            />
            <Route
              path="/signup"
              element={
                <ErrorBoundary>
                  <Signup />
                </ErrorBoundary>
              }
            />
            <Route
              path="/verifyemail"
              element={
                <ErrorBoundary>
                  <Signup />
                </ErrorBoundary>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Dashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ErrorBoundary>
                  <ProductData />
                </ErrorBoundary>
              }
            />
            <Route
              path="/resources"
              element={
                <ErrorBoundary>
                  <Calculators />
                </ErrorBoundary>
              }
            />
          </Routes>

          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
};

export default App;

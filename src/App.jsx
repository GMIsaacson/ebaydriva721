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
import VerifyEmail from "./verifyemail";
import Calculators from "./resources";
import AccountPage from "./accountspage";

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          {/* Navigation Bar */}
          <Nav />

          {/* Application Routes */}
          <Routes>
            {/* Public Routes */}
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
                  <VerifyEmail />
                </ErrorBoundary>
              }
            />

            {/* Protected Routes */}
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
                <ProtectedRoute>
                  <ErrorBoundary>
                    <ProductData />
                  </ErrorBoundary>
                </ProtectedRoute>
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
            <Route
              path="/accounts/*"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <AccountPage />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
          </Routes>

          {/* Footer */}
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;


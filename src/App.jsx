import React from "react";
import { BrowserRouter as Router, Outlet, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";
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
import AppShell from "./AppShell";

const PublicLayout = () => (
  <div className="App">
    <Nav />
    <Outlet />
    <Footer />
  </div>
);

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
            <Route path="/ResetPassword" element={<ErrorBoundary><ResetPassword /></ErrorBoundary>} />
            <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
            <Route path="/signup" element={<ErrorBoundary><Signup /></ErrorBoundary>} />
            <Route path="/verifyemail" element={<ErrorBoundary><VerifyEmail /></ErrorBoundary>} />
            <Route path="/resources" element={<ErrorBoundary><Calculators /></ErrorBoundary>} />
          </Route>

          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="/products" element={<ErrorBoundary><ProductData /></ErrorBoundary>} />
            <Route path="/accounts/*" element={<ErrorBoundary><AccountPage /></ErrorBoundary>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;

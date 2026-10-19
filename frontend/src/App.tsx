import { useState } from "react";
import { Route, Routes } from "react-router-dom";

import { AuthModal } from "./auth/AuthModal";
import RouteGuard from "./auth/RouteGuard";
import { FACILITY_ROLES, PUBLIC_ROLES, SUPPLIER_ROLES } from "./auth/roles";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppShell } from "./components/layout/AppShell";
import { usePageMeta } from "./hooks/usePageMeta";
import { clearStoredAuth, getStoredAuth } from "./lib/auth";
import type { AuthResponse } from "./lib/auth";
import { About } from "./pages/About";
import { Dashboard } from "./pages/Dashboard";
import { DentistProfile } from "./pages/DentistProfile";
import { Emergency } from "./pages/Emergency";
import { FacilityDashboard } from "./pages/FacilityDashboard";
import { FindDentist } from "./pages/FindDentist";
import Home from "./pages/Home";
import { International } from "./pages/International";
import { JobsBoard } from "./pages/JobsBoard";
import { Magazine } from "./pages/Magazine";
import NotFound from "./pages/NotFound";
import OralCareShopPage from "./pages/OralCareShopPage";
import { SignInPage } from "./pages/SignInPage";
import { StaffAccessPage } from "./pages/StaffAccessPage";
import { SupplierDashboard } from "./pages/SupplierDashboard";
import Suppliers from "./pages/Suppliers";
import { Training } from "./pages/Training";

const App = () => {
  usePageMeta();

  const [authOpen, setAuthOpen] = useState(false);
  const [auth, setAuth] = useState<AuthResponse | null>(() => getStoredAuth());

  const user = auth?.user ?? null;

  const handleLoginSuccess = (authResponse: AuthResponse) => {
    setAuth(authResponse);
    setAuthOpen(false);
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuth(null);
  };

  return (
    <ErrorBoundary>
      <AppShell onSignIn={() => setAuthOpen(true)} user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dentists" element={<FindDentist />} />
          <Route path="/find-dentist" element={<FindDentist />} />
          <Route path="/dentists/:listingType/:id" element={<DentistProfile user={user} />} />
          <Route path="/dentist/:id" element={<DentistProfile user={user} />} />
          <Route path="/dentists/:id" element={<DentistProfile user={user} />} />
          <Route path="/international" element={<International />} />
          <Route path="/emergency" element={<Emergency />} />
          <Route path="/about" element={<About />} />
          <Route path="/jobs" element={<JobsBoard />} />
          <Route path="/training" element={<Training />} />
          <Route path="/magazine" element={<Magazine />} />
          <Route path="/shop" element={<OralCareShopPage />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/suppliers/:slug" element={<Suppliers />} />
          <Route path="/sign-in" element={<SignInPage onSuccess={handleLoginSuccess} />} />
          <Route
            path="/staff/access"
            element={<StaffAccessPage onSuccess={handleLoginSuccess} />}
          />
          <Route
            path="/dashboard"
            element={
              <RouteGuard user={user} allowedRoles={PUBLIC_ROLES} unauthorizedPath="/">
                <Dashboard user={user} />
              </RouteGuard>
            }
          />
          <Route
            path="/dashboard/facility"
            element={
              <RouteGuard user={user} allowedRoles={FACILITY_ROLES} unauthorizedPath="/">
                <FacilityDashboard user={user} />
              </RouteGuard>
            }
          />
          <Route
            path="/dashboard/supplier"
            element={
              <RouteGuard user={user} allowedRoles={SUPPLIER_ROLES} unauthorizedPath="/">
                <SupplierDashboard />
              </RouteGuard>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>

      {authOpen && (
        <AuthModal onClose={() => setAuthOpen(false)} onLoginSuccess={handleLoginSuccess} />
      )}
    </ErrorBoundary>
  );
};

export default App;

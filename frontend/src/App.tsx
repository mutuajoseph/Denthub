import { Suspense, lazy, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";

import { AuthModal } from "./auth/AuthModal";
import RouteGuard from "./auth/RouteGuard";
import {
  ADMIN_ROLES,
  FACILITY_ROLES,
  OPERATIONS_ROLES,
  PUBLIC_ROLES,
  SPECIALIST_ROLES,
  SUPPLIER_ROLES,
  TRAINING_PROVIDER_ROLES,
} from "./auth/roles";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppShell } from "./components/layout/AppShell";
import LoadingSpinner from "./components/ui/LoadingSpinner";
import { usePageMeta } from "./hooks/usePageMeta";
import { getStoredUser, logoutSession, restoreSession, subscribeToAuthChanges } from "./lib/auth";
import type { AuthResponse, AuthUser } from "./lib/auth";

/*
 * Route screens are code-split (issue #66) so the entry chunk ships only the
 * shell — React, the router, the layout and this route table. Each screen is a
 * separate chunk fetched on first navigation to it. Named exports become a
 * default via the `.then()` shim; Home/NotFound/OralCareShopPage/Suppliers are
 * already default exports.
 */
const About = lazy(() => import("./pages/About").then((module) => ({ default: module.About })));
const AdminDashboard = lazy(() =>
  import("./pages/AdminDashboard").then((module) => ({ default: module.AdminDashboard })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const DentistProfile = lazy(() =>
  import("./pages/DentistProfile").then((module) => ({ default: module.DentistProfile })),
);
const Emergency = lazy(() =>
  import("./pages/Emergency").then((module) => ({ default: module.Emergency })),
);
const FacilityDashboard = lazy(() =>
  import("./pages/FacilityDashboard").then((module) => ({ default: module.FacilityDashboard })),
);
const SpecialistDashboard = lazy(() =>
  import("./pages/SpecialistDashboard").then((module) => ({ default: module.SpecialistDashboard })),
);
const FindDentist = lazy(() =>
  import("./pages/FindDentist").then((module) => ({ default: module.FindDentist })),
);
const Home = lazy(() => import("./pages/Home"));
const International = lazy(() =>
  import("./pages/International").then((module) => ({ default: module.International })),
);
const JobsBoard = lazy(() =>
  import("./pages/JobsBoard").then((module) => ({ default: module.JobsBoard })),
);
const Magazine = lazy(() =>
  import("./pages/Magazine").then((module) => ({ default: module.Magazine })),
);
const Messages = lazy(() =>
  import("./pages/Messages").then((module) => ({ default: module.Messages })),
);
const NotFound = lazy(() => import("./pages/NotFound"));
const OperationsDashboard = lazy(() =>
  import("./pages/OperationsDashboard").then((module) => ({
    default: module.OperationsDashboard,
  })),
);
const OralCareShopPage = lazy(() => import("./pages/OralCareShopPage"));
const Settings = lazy(() =>
  import("./pages/Settings").then((module) => ({ default: module.Settings })),
);
const SignInPage = lazy(() =>
  import("./pages/SignInPage").then((module) => ({ default: module.SignInPage })),
);
const ResetPassword = lazy(() =>
  import("./pages/ResetPassword").then((module) => ({ default: module.ResetPassword })),
);
const VerifyEmail = lazy(() =>
  import("./pages/VerifyEmail").then((module) => ({ default: module.VerifyEmail })),
);
const StaffAccessPage = lazy(() =>
  import("./pages/StaffAccessPage").then((module) => ({ default: module.StaffAccessPage })),
);
const SupplierDashboard = lazy(() =>
  import("./pages/SupplierDashboard").then((module) => ({ default: module.SupplierDashboard })),
);
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Training = lazy(() =>
  import("./pages/Training").then((module) => ({ default: module.Training })),
);
const TrainingDashboard = lazy(() =>
  import("./pages/TrainingDashboard").then((module) => ({ default: module.TrainingDashboard })),
);

/** Fallback for a route chunk in flight; keeps layout height so the shell doesn't jump. */
const routeFallback = (
  <div className="flex min-h-[60vh] items-center justify-center py-16" aria-busy="true">
    <LoadingSpinner size="lg" />
  </div>
);

const App = () => {
  usePageMeta();

  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());

  // A reload starts with no in-memory access token. The httpOnly refresh
  // cookie recovers the session; a stale one fails quietly and signs out.
  useEffect(() => {
    let active = true;

    void restoreSession().then((restored) => {
      if (active && restored) {
        setUser(restored.user);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // A failed refresh clears the stored session outside React. Mirror that in
  // state so the shell and RouteGuard drop access at once, not on next reload.
  useEffect(() => subscribeToAuthChanges(setUser), []);

  const handleLoginSuccess = (authResponse: AuthResponse) => {
    // The auth client already persisted this response (token in memory, profile
    // and surface in storage), so the App only mirrors the user in state.
    setUser(authResponse.user);
    setAuthOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    void logoutSession();
  };

  return (
    <ErrorBoundary>
      <AppShell onSignIn={() => setAuthOpen(true)} user={user} onLogout={handleLogout}>
        <Suspense fallback={routeFallback}>
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
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
              path="/dashboard/specialist"
              element={
                <RouteGuard user={user} allowedRoles={SPECIALIST_ROLES} unauthorizedPath="/">
                  <SpecialistDashboard user={user} />
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
            <Route
              path="/dashboard/training"
              element={
                <RouteGuard user={user} allowedRoles={TRAINING_PROVIDER_ROLES} unauthorizedPath="/">
                  <TrainingDashboard />
                </RouteGuard>
              }
            />
            <Route
              path="/admin"
              element={
                <RouteGuard user={user} allowedRoles={ADMIN_ROLES} unauthorizedPath="/">
                  <AdminDashboard user={user} />
                </RouteGuard>
              }
            />
            <Route
              path="/operations"
              element={
                <RouteGuard user={user} allowedRoles={OPERATIONS_ROLES} unauthorizedPath="/">
                  <OperationsDashboard user={user} />
                </RouteGuard>
              }
            />
            <Route
              path="/messages"
              element={
                <RouteGuard user={user} allowedRoles={PUBLIC_ROLES} unauthorizedPath="/">
                  <Messages user={user} />
                </RouteGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <RouteGuard user={user} allowedRoles={PUBLIC_ROLES} unauthorizedPath="/">
                  <Settings user={user} onAccountDeleted={handleLogout} />
                </RouteGuard>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppShell>

      {authOpen && (
        <AuthModal onClose={() => setAuthOpen(false)} onLoginSuccess={handleLoginSuccess} />
      )}
    </ErrorBoundary>
  );
};

export default App;

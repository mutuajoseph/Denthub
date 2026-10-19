import { Suspense, lazy, useState } from "react";
import { Route, Routes } from "react-router-dom";

import { AuthModal } from "./auth/AuthModal";
import RouteGuard from "./auth/RouteGuard";
import {
  FACILITY_ROLES,
  PUBLIC_ROLES,
  SUPPLIER_ROLES,
  TRAINING_PROVIDER_ROLES,
} from "./auth/roles";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppShell } from "./components/layout/AppShell";
import LoadingSpinner from "./components/ui/LoadingSpinner";
import { usePageMeta } from "./hooks/usePageMeta";
import { clearStoredAuth, getStoredAuth } from "./lib/auth";
import type { AuthResponse } from "./lib/auth";

/*
 * Route screens are code-split (issue #66) so the entry chunk ships only the
 * shell — React, the router, the layout and this route table. Each screen is a
 * separate chunk fetched on first navigation to it. Named exports become a
 * default via the `.then()` shim; Home/NotFound/OralCareShopPage/Suppliers are
 * already default exports.
 */
const About = lazy(() => import("./pages/About").then((module) => ({ default: module.About })));
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
const OralCareShopPage = lazy(() => import("./pages/OralCareShopPage"));
const SignInPage = lazy(() =>
  import("./pages/SignInPage").then((module) => ({ default: module.SignInPage })),
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
            <Route
              path="/dashboard/training"
              element={
                <RouteGuard user={user} allowedRoles={TRAINING_PROVIDER_ROLES} unauthorizedPath="/">
                  <TrainingDashboard />
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

import { useState } from "react";
import { Route, Routes } from "react-router-dom";

import { AuthModal } from "./auth/AuthModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppShell } from "./components/layout/AppShell";
import { usePageMeta } from "./hooks/usePageMeta";
import { clearStoredAuth, getStoredAuth } from "./lib/auth";
import type { AuthResponse } from "./lib/auth";
import { DentistProfile } from "./pages/DentistProfile";
import { Emergency } from "./pages/Emergency";
import { FindDentist } from "./pages/FindDentist";
import Home from "./pages/Home";
import { International } from "./pages/International";
import NotFound from "./pages/NotFound";

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
          <Route path="/dentist/:id" element={<DentistProfile />} />
          <Route path="/dentists/:id" element={<DentistProfile />} />
          <Route path="/international" element={<International />} />
          <Route path="/emergency" element={<Emergency />} />
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

import { useState } from "react";
import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import { AuthModal } from "./auth/AuthModal";

import {
  getStoredAuth,
  clearStoredAuth,
} from "./lib/auth";

import type { AuthResponse } from "./lib/auth";

const App = () => {
  const [authOpen, setAuthOpen] = useState(false);

  /*
   * ============================================================
   * RESTORE AUTHENTICATION ON PAGE REFRESH
   * ============================================================
   *
   * getStoredAuth() reads the authentication session from:
   *
   * localStorage["denthub_auth"]
   *
   * Because this runs when the state is initialized,
   * the user remains logged in after refreshing the page.
   */
  const [auth, setAuth] = useState<AuthResponse | null>(() => {
    return getStoredAuth();
  });

  /*
   * Get the currently logged-in user.
   */
  const user = auth?.user ?? null;

  /*
   * ============================================================
   * LOGIN SUCCESS
   * ============================================================
   */
  const handleLoginSuccess = (
    authResponse: AuthResponse
  ) => {
    /*
     * AuthModal/login() already saves the response to
     * localStorage.
     *
     * We also update React state so the Navbar changes
     * immediately without refreshing.
     */
    setAuth(authResponse);

    /*
     * Close the login modal.
     */
    setAuthOpen(false);
  };

  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */
  const handleLogout = () => {
    /*
     * IMPORTANT:
     *
     * auth.ts stores the session using:
     *
     * "denthub_auth"
     *
     * Therefore we must remove it using clearStoredAuth().
     */
    clearStoredAuth();

    /*
     * Clear React authentication state.
     */
    setAuth(null);
  };

  return (
    <>
      {/* ======================================================
          NAVBAR
      ======================================================= */}
      <Navbar
        onSignIn={() => setAuthOpen(true)}
        user={user}
        onLogout={handleLogout}
      />

      {/* ======================================================
          ROUTES
      ======================================================= */}
      <Routes>
        <Route
          path="/"
          element={
            <div className="p-8">
              {user ? (
                <>
                  <h1 className="text-2xl font-bold text-[#11213a]">
                    Welcome, {user.full_name}
                  </h1>

                  <p className="mt-2 text-slate-500">
                    Role: {user.role}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {user.email}
                  </p>
                </>
              ) : (
                <h1 className="text-2xl font-bold text-[#11213a]">
                  Home Page
                </h1>
              )}
            </div>
          }
        />
      </Routes>

      {/* ======================================================
          AUTH MODAL
      ======================================================= */}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </>
  );
};

export default App;

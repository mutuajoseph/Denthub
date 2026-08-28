import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import { AuthModal } from "./auth/AuthModal";

const App = () => {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <Navbar onSignIn={() => setAuthOpen(true)} />

      <Routes>
        <Route path="/" element={<h1>Home Page</h1>} />
      </Routes>

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
        />
      )}
    </>
  );
};

export default App;

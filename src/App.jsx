import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import CharacterSheet from "./pages/CharacterSheet";
import DMPage from "./pages/DMPage";
import PlayerPage from "./pages/PlayerPage";
import SelectGame from "./pages/SelectGame";
import CreateCharacter from "./pages/CreateCharacter";
import HostGame from "./pages/HostGame";
import SelectRuleset from "./pages/SelectRuleset";
import GameDashboard from "./pages/GameDashboard";
import CreateRuleset from "./pages/CreateRuleset";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function withAuth(element) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-100 p-4 font-sans">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/" element={withAuth(<Home />)} />
            <Route path="/dm" element={withAuth(<DMPage />)} />
            <Route path="/player" element={withAuth(<PlayerPage />)} />
            <Route path="/sheet/:gameId" element={withAuth(<CharacterSheet />)} />
            <Route path="/select-game" element={withAuth(<SelectGame />)} />
            <Route
              path="/create-character/:gameId"
              element={withAuth(<CreateCharacter />)}
            />
            <Route path="/host-game" element={withAuth(<HostGame />)} />
            <Route
              path="/select-ruleset/:gameId"
              element={withAuth(<SelectRuleset />)}
            />
            <Route
              path="/dm/game-dashboard/:gameId"
              element={withAuth(<GameDashboard />)}
            />
            <Route path="/create-ruleset" element={withAuth(<CreateRuleset />)} />
            <Route
              path="/create-ruleset/:rulesetId"
              element={withAuth(<CreateRuleset />)}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

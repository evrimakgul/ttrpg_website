import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import CharacterSheet from "./pages/CharacterSheet";
import DMPage from "./pages/DMPage";
import PlayerPage from "./pages/PlayerPage";
import SelectGame from "./pages/SelectGame";
import CreateCharacter from "./pages/CreateCharacter";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100 p-4 font-sans">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dm" element={<DMPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/sheet" element={<CharacterSheet />} />
          <Route path="/select-game" element={<SelectGame />} />
          <Route path="/create-character" element={<CreateCharacter />} />
          </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

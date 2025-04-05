import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import CharacterSheet from "./pages/CharacterSheet";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100 p-4 font-sans">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sheet" element={<CharacterSheet />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

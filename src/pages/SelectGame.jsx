import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function SelectGame() {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState("");

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      <div className="flex justify-start gap-2 mb-6">
        <button
          onClick={() => navigate("/")}
          className="px-4 py-1 bg-gray-200 rounded"
        >
          🏠 Home
        </button>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-1 bg-gray-200 rounded"
        >
          ⬅ Back
        </button>
      </div>

      <h2 className="text-lg font-bold mb-4 text-center">Select a Game</h2>

      <select
        className="w-full border p-2 rounded mb-4"
        value={selectedGame}
        onChange={(e) => setSelectedGame(e.target.value)}
      >
        <option value="">Select a game</option>
        <optgroup label="Active Games">
          <option value="Ghosts of Arcanum">Ghosts of Arcanum</option>
          <option value="Temple of Dawn">Temple of Dawn</option>
        </optgroup>
        <optgroup label="Passive Games">
          <option value="Forgotten Pact">Forgotten Pact</option>
        </optgroup>
      </select>

      <button
        onClick={() => {
          if (!selectedGame) {
            alert("Please select a game before continuing.");
            return;
          }
          navigate("/create-character");
        }}
        className="w-full bg-blue-100 py-2 rounded"
      >
        ✅ Join Game & Create Character
      </button>
    </div>
  );
}

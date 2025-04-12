import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function HostGame() {
  const navigate = useNavigate();
  const [gameName, setGameName] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    if (!gameName.trim()) {
      alert("Please enter a game name.");
      return;
    }
  
    const newGame = {
      id: Date.now().toString(),
      name: gameName.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
  
    const existing = JSON.parse(localStorage.getItem("games") || "[]");
    const updated = [...existing, newGame];
    localStorage.setItem("games", JSON.stringify(updated));
  
    navigate("/select-ruleset", { state: { gameId: newGame.id } });
  };
  

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Navigation */}
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

      {/* Header */}
      <h2 className="text-lg font-bold text-center mb-6">Host a New Game</h2>

      {/* Game Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Game Name</label>
        <input
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full border p-2 rounded"
        />
      </div>

      <button
        onClick={handleSubmit}
        className="w-full bg-purple-100 py-2 rounded"
      >
        ✅ Host Game
      </button>
    </div>
  );
}

// src/components/RulesetBuilder.jsx (REPLACED CONTENT!)
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

export default function RulesetBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const gameId = location.state?.gameId; // Get gameId from previous page

  const [rulesetName, setRulesetName] = useState("");

  const handleCreate = () => {
    const trimmedName = rulesetName.trim();
    if (!trimmedName) {
      alert("Please enter a ruleset name.");
      return;
    }

    // 1. Create a minimal ruleset object
    const newRuleset = {
      id: Date.now().toString(), // Simple unique ID
      name: trimmedName,
      // Add empty arrays if your GameDashboard expects them
      groups: [],
      counters: [],
    };

    // 2. Save the new ruleset to localStorage
    const existingRulesets = JSON.parse(localStorage.getItem("rulesets") || "[]");
    localStorage.setItem("rulesets", JSON.stringify([...existingRulesets, newRuleset]));

    // 3. Link ruleset name to the game in localStorage
    if (gameId) {
      const games = JSON.parse(localStorage.getItem("games") || "[]");
      const updatedGames = games.map((game) =>
        game.id === gameId ? { ...game, ruleset: newRuleset.name } : game
      );
      localStorage.setItem("games", JSON.stringify(updatedGames));
    }

    // 4. Go to the game dashboard
    navigate("/dm/game-dashboard", { state: { gameId: gameId } });
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Navigation */}
      <div className="flex justify-start gap-2 mb-6">
        <button onClick={() => navigate("/")} className="px-4 py-1 bg-gray-200 rounded">🏠 Home</button>
        <button onClick={() => navigate(-1)} className="px-4 py-1 bg-gray-200 rounded">⬅ Back</button>
      </div>

      {/* Title */}
      <h2 className="text-lg font-bold text-center mb-6">Create New Ruleset</h2>

      {/* Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Ruleset Name</label>
        <input
          value={rulesetName}
          onChange={(e) => setRulesetName(e.target.value)}
          className="w-full border p-2 rounded"
          placeholder="Enter ruleset name"
        />
      </div>

      {/* Button */}
      <button onClick={handleCreate} className="w-full bg-purple-100 py-2 rounded">
        ✅ Create Ruleset
      </button>
    </div>
  );
}
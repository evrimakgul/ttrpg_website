import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

export default function RulesetBuilder() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const gameId    = location.state?.gameId;          // optional – builder can be used stand‑alone

  const [rulesetName, setRulesetName] = useState("");

  const handleCreate = () => {
    const name = rulesetName.trim();
    if (!name) { alert("Please enter a ruleset name."); return; }

    /* 1. create new ruleset ------------------------------------------- */
    const newRuleset = { id: Date.now().toString(), name, groups: [], counters: [] };

    /* 2. persist to storage ------------------------------------------- */
    const allRulesets = JSON.parse(localStorage.getItem("rulesets") || "[]");
    localStorage.setItem("rulesets", JSON.stringify([...allRulesets, newRuleset]));

    /* 3. link to game (if coming from a game) ------------------------- */
    if (gameId) {
      const allGames = JSON.parse(localStorage.getItem("games") || "[]");
      const updated  = allGames.map(g => g.id === gameId ? { ...g, rulesetId: newRuleset.id } : g);
      localStorage.setItem("games", JSON.stringify(updated));
    }

    /* 4. go back to dashboard ---------------------------------------- */
    navigate("/dm/game-dashboard", { state: { gameId, rulesetId: newRuleset.id } });
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Nav */}
      <div className="flex justify-start gap-2 mb-6">
        <button onClick={() => navigate("/")}  className="px-4 py-1 bg-gray-200 rounded">🏠 Home</button>
        <button onClick={() => navigate(-1)}   className="px-4 py-1 bg-gray-200 rounded">⬅ Back</button>
      </div>

      <h2 className="text-lg font-bold text-center mb-6">Create New Ruleset</h2>

      <label className="block text-sm font-medium mb-1">Ruleset Name</label>
      <input
        value={rulesetName}
        onChange={(e) => setRulesetName(e.target.value)}
        className="w-full border p-2 rounded mb-4"
        placeholder="Enter ruleset name"
      />

      <button onClick={handleCreate} className="w-full bg-purple-100 py-2 rounded">
        ✅ Create Ruleset
      </button>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useLocation } from "react-router-dom";

export default function SelectRuleset() {
  const navigate = useNavigate();
  const [showList, setShowList] = useState(false);
  const location = useLocation();
  const gameId = location.state?.gameId;

  const handleExistingSelection = (rulesetName) => {
    const storedGames = JSON.parse(localStorage.getItem("games") || "[]");
    const updatedGames = storedGames.map((game) =>
      game.id === gameId ? { ...game, ruleset: rulesetName } : game
    );
    localStorage.setItem("games", JSON.stringify(updatedGames));
  
    navigate("/dm/game-dashboard", { state: { gameId } });
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Top Nav */}
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

      {/* Heading */}
      <h2 className="text-lg font-bold text-center mb-6">Select Ruleset</h2>

      {/* Option 1: Existing Ruleset */}
      <div className="mb-6">
        <button
          onClick={() => setShowList(!showList)}
          className="w-full bg-blue-100 py-2 rounded"
        >
          📂 Select Existing Ruleset
        </button>

        {showList && (
          <div className="mt-4 space-y-2">
            {["Default Ruleset", "DnD 5e", "Vampire V20"].map((r) => (
              <button
                key={r}
                onClick={() => handleExistingSelection(r)}
                className="w-full text-left px-3 py-2 border rounded hover:bg-blue-50"
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Option 2: Create New Ruleset */}
      <div>
        <button
          onClick={() => navigate("/create-ruleset")}
          className="w-full bg-purple-100 py-2 rounded"
        >
          ✏️ Set Up a New Ruleset
        </button>
      </div>
    </div>
  );
}

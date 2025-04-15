// Import navigation and state utilities from React Router and React
import { useNavigate } from "react-router-dom"; // allows page redirection
import { useState } from "react";               // lets us manage internal state (like toggles)
import { useLocation } from "react-router-dom"; // allows reading navigation-passed data

// This component allows the DM to choose or create a ruleset for a hosted game
export default function SelectRuleset() {
  const navigate = useNavigate();               // used for redirecting to other routes
  const [showList, setShowList] = useState(false); // toggle: show/hide existing ruleset list
  const location = useLocation();               // retrieve passed route data
  const gameId = location.state?.gameId;        // get the ID of the game being configured

  // When a DM selects a ruleset from the existing list
  const handleExistingSelection = (rulesetName) => {
    // Load all games from localStorage
    const storedGames = JSON.parse(localStorage.getItem("games") || "[]");

    // Update the matching game's ruleset field
    const updatedGames = storedGames.map((game) =>
      game.id === gameId ? { ...game, ruleset: rulesetName } : game
    );

    // Save updated games list back to localStorage
    localStorage.setItem("games", JSON.stringify(updatedGames));

    // Navigate to game dashboard with gameId carried forward
    navigate("/dm/game-dashboard", { state: { gameId } });
  };

  // Return layout for ruleset selection interface
  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">

      {/* Navigation Buttons */}
      <div className="flex justify-start gap-2 mb-6">
        <button
          onClick={() => navigate("/")} // return to home
          className="px-4 py-1 bg-gray-200 rounded"
        >
          🏠 Home
        </button>
        <button
          onClick={() => navigate(-1)} // go back to previous page
          className="px-4 py-1 bg-gray-200 rounded"
        >
          ⬅ Back
        </button>
      </div>

      {/* Page Title */}
      <h2 className="text-lg font-bold text-center mb-6">Select Ruleset</h2>

      {/* Option 1: Select Existing Ruleset */}
      <div className="mb-6">
        <button
          onClick={() => setShowList(!showList)} // toggle visibility of list
          className="w-full bg-blue-100 py-2 rounded"
        >
          📂 Select Existing Ruleset
        </button>

        {/* Dropdown list of available rulesets (hardcoded for now) */}
        {showList && (
          <div className="mt-4 space-y-2">
             {/* Loop through all rulesets stored in localStorage */}
            {JSON.parse(localStorage.getItem("rulesets") || "[]").map((r) => (
              
              // Wrapper div for each ruleset row: name on left, delete on right
              <div key={r.id} className="flex justify-between items-center border rounded px-3 py-2">
                
                {/* Button to select this ruleset and apply it to the game */}
                <button
                  onClick={() => handleExistingSelection(r.name)} // trigger selection handler
                  className="text-left text-sm hover:underline"
                >
                  {r.name} {/* show the name of the ruleset */}
                </button>

                {/* Temporary delete button for this ruleset */}
                <button
                  onClick={() => {
                    // Get current list of rulesets from localStorage
                    const existing = JSON.parse(localStorage.getItem("rulesets") || "[]");

                    // Remove the one with matching ID
                    const updated = existing.filter((x) => x.id !== r.id);

                    // Save the new list back to localStorage
                    localStorage.setItem("rulesets", JSON.stringify(updated));

                    // Refresh the page to update the visible list
                    window.location.reload(); // ⚠️ temporary workaround
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Option 2: Create a new custom ruleset */}
      <div>
        <button
          onClick={() => navigate("/build-ruleset", { state: { gameId: gameId } })} // go to ruleset builder page
          className="w-full bg-purple-100 py-2 rounded"
        >
          ✏️ Create a New Ruleset
        </button>
      </div>
    </div>
  );
}

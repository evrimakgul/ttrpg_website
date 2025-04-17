// Import navigation and state utilities from React Router and React core
import { useNavigate } from "react-router-dom";   // lets us programmatically change pages
import { useLocation } from "react-router-dom";   // lets us access data passed during navigation
import { useState } from "react";                 // React hook for local component state

// Main React component for displaying the DM's Game Dashboard
export default function GameDashboard() {
  const navigate = useNavigate();             // used to navigate programmatically
  const location = useLocation();             // used to access passed state

  // 1. Retrieve navigation state (gameId and possibly rulesetId)
  const gameId = location.state?.gameId;
  const rulesetId = location.state?.rulesetId;

  // 2. Load all rulesets and games from localStorage
  const allRulesets = JSON.parse(localStorage.getItem("rulesets") || "[]");
  const storedGames = JSON.parse(localStorage.getItem("games") || "[]");

  // 3. Match current game and ruleset based on passed IDs
  const [game, setGame] = useState(() =>
    storedGames.find((g) => g.id === gameId) || {}
  );
  const [ruleset, setRuleset] = useState(() =>
    allRulesets.find((r) => r.id === rulesetId) || null
  );

  // 4. Update game field when user types in name or notes
  const updateGameField = (field, value) => {
    setGame({ ...game, [field]: value });
  };

  // 5. Update ruleset name from input field
  const updateRulesetName = (value) => {
    if (!ruleset) return;
    setRuleset({ ...ruleset, name: value });
  };

  // 6. Save both game and ruleset updates to localStorage
  const handleSave = () => {
    const updatedGames = storedGames.map((g) =>
      g.id === gameId ? game : g
    );
    localStorage.setItem("games", JSON.stringify(updatedGames));

    if (ruleset) {
      const updatedRulesets = allRulesets.map((r) =>
        r.id === ruleset.id ? ruleset : r
      );
      localStorage.setItem("rulesets", JSON.stringify(updatedRulesets));
    }

    alert("Changes saved.");
  };

  // ======= Render JSX Layout =======
  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">

      {/* Header Navigation & Save */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
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
        <button
          onClick={handleSave}
          className="px-4 py-1 bg-green-100 rounded text-sm"
        >
          💾 Save
        </button>
      </div>

      {/* Page Title */}
      <h2 className="text-xl font-bold text-center mb-6">Game Dashboard</h2>

      {/* Grid: Game Info, Players, Bonuses, Encounters */}
      <div className="grid grid-cols-2 gap-6">

        {/* Game Info Block */}
        <Section title="Game Info">
          <div className="space-y-2">
            {/* Editable Game Name */}
            <input
              className="w-full p-2 border rounded"
              placeholder="Game Name"
              value={game.name || ""}
              onChange={(e) => updateGameField("name", e.target.value)}
            />

            {/* Editable Notes */}
            <textarea
              className="w-full p-2 border rounded"
              rows={4}
              placeholder="Notes"
              value={game.notes || ""}
              onChange={(e) => updateGameField("notes", e.target.value)}
            />

            {/* Editable Ruleset Name */}
            <div className="text-sm text-gray-600">
              <strong>Ruleset:</strong>{" "}
              <input
                value={ruleset?.name || ""}
                onChange={(e) => updateRulesetName(e.target.value)}
                className="border px-2 py-1 rounded w-1/2 ml-2"
              />
            </div>
          </div>
        </Section>

        {/* Players Placeholder */}
        <Section title="Players">
          <ul className="list-disc list-inside">
            <li>Player 1 (Character A)</li>
            <li>Player 2 (Character B)</li>
          </ul>
        </Section>

        {/* Bonuses Placeholder */}
        <Section title="Bonuses">
          <p className="text-gray-500">Add custom bonuses or buffs here.</p>
        </Section>

        {/* Encounters Placeholder */}
        <Section title="Encounters / Events">
          <p className="text-gray-500">
            Create or track in-game events and battles.
          </p>
        </Section>
      </div>

      {/* Show full ruleset info if available */}
      {ruleset && (
        <Section title="Ruleset Overview">
          {/* Group Boxes */}
          <div className="space-y-3">
            {ruleset.groups.map((grp) => (
              <div key={grp.id} className="border p-2 rounded">
                <h4 className="font-semibold text-sm mb-2">{grp.label}</h4>
                <ul className="list-disc list-inside text-sm">
                  {grp.fields.map((fld, i) => (
                    <li key={i}>{fld}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Counters */}
          <div className="mt-4">
            <h4 className="font-semibold text-sm mb-2">Counters</h4>
            <ul className="list-disc list-inside text-sm">
              {ruleset.counters.map((ctr) => (
                <li key={ctr.id}>
                  {ctr.label}: {ctr.baseValue}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </div>
  );
}

// Reusable Section Block
function Section({ title, children }) {
  return (
    <div className="border p-4 rounded">
      <h3 className="text-md font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

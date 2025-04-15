// Import navigation and state utilities from React Router and React core
import { useNavigate } from "react-router-dom";   // lets us programmatically change pages
import { useLocation } from "react-router-dom";   // lets us access data passed during navigation
import { useState } from "react";                 // React hook for local component state

// This is the main React component for displaying the DM's Game Dashboard
export default function GameDashboard() {
  const navigate = useNavigate();    // used for redirecting to other pages
  const location = useLocation();    // used to access route data

  // Retrieve the gameId and rulesetId passed from previous navigation
  const gameId = location.state?.gameId;
  const { rulesetId } = location.state || {};

  // Load all rulesets stored in localStorage (JSON string → object)
  const allRulesets = JSON.parse(localStorage.getItem("rulesets") || "[]");

  // Pick the specific ruleset that matches the rulesetId
  const [ruleset, setRuleset] = useState(
    () => allRulesets.find((r) => r.id === rulesetId) || null
  );

  // Load all games stored in localStorage
  const storedGames = JSON.parse(localStorage.getItem("games") || "[]");

  // Pick the specific game that matches the gameId
  const [game, setGame] = useState(() =>
    storedGames.find((g) => g.id === gameId) || {}
  );

  // When user updates game name or notes, update both UI and localStorage
  const updateGameField = (field, value) => {
    const updated = { ...game, [field]: value }; // copy game with updated field
    setGame(updated); // update local state

    // Replace the old game entry with the updated one in the array
    const updatedGames = storedGames.map((g) =>
      g.id === gameId ? updated : g
    );

    // Save updated array to localStorage
    localStorage.setItem("games", JSON.stringify(updatedGames));
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">

      {/* Navigation buttons at top */}
      <div className="flex justify-start gap-2 mb-6">
        <button
          onClick={() => navigate("/")} // go to home page
          className="px-4 py-1 bg-gray-200 rounded"
        >
          🏠 Home
        </button>
        <button
          onClick={() => navigate(-1)} // go back one page in browser history
          className="px-4 py-1 bg-gray-200 rounded"
        >
          ⬅ Back
        </button>
      </div>

      {/* Page title */}
      <h2 className="text-xl font-bold text-center mb-6">Game Dashboard</h2>

      {/* Main dashboard sections (2 columns) */}
      <div className="grid grid-cols-2 gap-6">

        {/* Section 1: Game Info - name, notes, ruleset */}
        <Section title="Game Info">
          <div className="space-y-2">
            {/* Editable game name field */}
            <input
              className="w-full p-2 border rounded"
              placeholder="Game Name"
              value={game.name || ""}
              onChange={(e) => updateGameField("name", e.target.value)}
            />

            {/* Editable notes textarea */}
            <textarea
              className="w-full p-2 border rounded"
              rows={4}
              placeholder="Notes"
              value={game.notes || ""}
              onChange={(e) => updateGameField("notes", e.target.value)}
            />

            {/* Display current ruleset (read-only) */}
            <p className="text-sm text-gray-600">
              <strong>Ruleset:</strong>{" "}
              {game.ruleset || "—"} {/* fallback if no ruleset */}
            </p>
          </div>
        </Section>

        {/* Section 2: Player list (static for now) */}
        <Section title="Players">
          <ul className="list-disc list-inside">
            <li>Player 1 (Character A)</li>
            <li>Player 2 (Character B)</li>
          </ul>
        </Section>

        {/* Section 3: Bonuses (placeholder for future feature) */}
        <Section title="Bonuses">
          <p className="text-gray-500">Add custom bonuses or buffs here.</p>
        </Section>

        {/* Section 4: Encounters (placeholder for future feature) */}
        <Section title="Encounters / Events">
          <p className="text-gray-500">
            Create or track in-game events and battles.
          </p>
        </Section>
      </div>

      {/* Optional: If a ruleset was found, display a summary of its groups and counters */}
      {ruleset && (
        <Section title="Ruleset Overview">
          {/* Ruleset name */}
          <p className="text-sm text-gray-600 mb-2">
            <strong>{ruleset.name}</strong>
          </p>

          {/* Group boxes and their fields */}
          <div className="space-y-3">
            {ruleset.groups.map((grp) => (
              <div key={grp.id} className="border p-2 rounded">
                <h4 className="font-semibold text-sm mb-2">{grp.label}</h4>
                <ul className="list-disc list-inside text-sm">
                  {grp.fields.map((fld, i) => (
                    <li key={i}>{fld}</li> // list each field name
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Ruleset counters (HP, XP, etc.) */}
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

// Reusable layout component for titled sections (Game Info, Players, etc.)
function Section({ title, children }) {
  return (
    <div className="border p-4 rounded">
      <h3 className="text-md font-semibold mb-2">{title}</h3>
      {children} {/* section content */}
    </div>
  );
}

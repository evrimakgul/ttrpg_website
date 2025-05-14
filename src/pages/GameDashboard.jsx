import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useState } from "react";

export default function GameDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const gameId = location.state?.gameId;

  const storedGames = JSON.parse(localStorage.getItem("games") || "[]");
  const [game, setGame] = useState(() =>
    storedGames.find((g) => g.id === gameId) || {}
  );

  const updateGameField = (field, value) => {
    const updated = { ...game, [field]: value };
    setGame(updated);

    const updatedGames = storedGames.map((g) =>
      g.id === gameId ? updated : g
    );
    localStorage.setItem("games", JSON.stringify(updatedGames));
  };

  const handleDeleteGame = () => {
    if (window.confirm("Are you sure you want to delete this game? This action cannot be undone.")) {
      const updatedGames = storedGames.filter((g) => g.id !== gameId);
      localStorage.setItem("games", JSON.stringify(updatedGames));
      navigate("/dm");
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Top Nav and Delete Button */}
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
          onClick={handleDeleteGame}
          className="px-4 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          🗑️ Delete Your Game
        </button>
      </div>

      <h2 className="text-xl font-bold text-center mb-6">Game Dashboard</h2>

      {/* Placeholder sections */}
      <div className="grid grid-cols-2 gap-6">
        <Section title="Game Info">
          <div className="space-y-2">
          <input
            className="w-full p-2 border rounded"
            placeholder="Game Name"
            value={game.name}
            onChange={(e) => updateGameField("name", e.target.value)}
          />

            <textarea
              className="w-full p-2 border rounded"
              rows={4}
              placeholder="Notes"
              value={game.notes}
              onChange={(e) => updateGameField("notes", e.target.value)}
            />

            <p className="text-sm text-gray-600">
              <strong>Ruleset:</strong> {game.ruleset || "—"}
            </p>

          </div>
        </Section>

        <Section title="Players">
          <ul className="list-disc list-inside">
            <li>Player 1 (Character A)</li>
            <li>Player 2 (Character B)</li>
          </ul>
        </Section>

        <Section title="Bonuses">
          <p className="text-gray-500">Add custom bonuses or buffs here.</p>
        </Section>

        <Section title="Encounters / Events">
          <p className="text-gray-500">Create or track in-game events and battles.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="border p-4 rounded">
      <h3 className="text-md font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

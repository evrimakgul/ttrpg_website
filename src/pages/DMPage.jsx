import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function DMPage() {
  const navigate = useNavigate();
  const [activeGames, setActiveGames] = useState([]);
  const [passiveGames, setPassiveGames] = useState([]);

  useEffect(() => {
    const games = JSON.parse(localStorage.getItem("games") || "[]");
    // You can add logic to distinguish active/passive games if needed
    setActiveGames(games);
    setPassiveGames([]); // Placeholder for future logic
  }, []);

  return (
    <div className="max-w-4xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Top Navigation */}
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
      <h2 className="text-xl font-bold text-center mb-6">DM Dashboard</h2>

      {/* Host Game & Create Ruleset Buttons */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => navigate("/host-game")}
          className="bg-purple-100 px-6 py-2 rounded text-sm"
        >
          ➕ Host a New Game
        </button>
        <button
          onClick={() => navigate("/create-ruleset")}
          className="bg-green-100 px-6 py-2 rounded text-sm"
        >
          📜 Create a New Ruleset
        </button>
      </div>

      {/* Game Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Passive Games */}
        <div>
          <h3 className="text-md font-semibold mb-2">Passive / Old Games</h3>
          <div className="flex flex-col gap-2">
            {passiveGames.length === 0 && (
              <div className="text-gray-400 italic">No passive games.</div>
            )}
            {/* Add passive games here in the future */}
          </div>
        </div>

        {/* Active Games */}
        <div>
          <h3 className="text-md font-semibold mb-2">Active Games</h3>
          <div className="flex flex-col gap-2">
            {activeGames.length === 0 && (
              <div className="text-gray-400 italic">No active games.</div>
            )}
            {activeGames.map((game) => (
              <button
                key={game.id}
                onClick={() => navigate("/dm/game-dashboard", { state: { gameId: game.id } })}
                className="p-3 rounded border hover:shadow text-left"
              >
                {game.name}{" "}
                <span className="text-xs text-gray-500">
                  ({game.ruleset || "No ruleset"})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

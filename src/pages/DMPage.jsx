import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function DMPage() {
  const navigate = useNavigate();
  const [activeGames, setActiveGames] = useState([]);
  const [passiveGames, setPassiveGames] = useState([]);
  const [rulesets, setRulesets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [gamesData, rulesetsData] = await Promise.all([
          apiFetch("/api/games?role=dm"),
          apiFetch("/api/rulesets"),
        ]);

        const games = gamesData.games || [];
        setActiveGames(games.filter((game) => game.status !== "archived"));
        setPassiveGames(games.filter((game) => game.status === "archived"));
        setRulesets(rulesetsData.rulesets || []);
      } catch (err) {
        setError(err.message || "Could not load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  return (
    <div className="mx-auto mt-10 max-w-4xl rounded-2xl bg-white p-6 text-sm shadow">
      <div className="mb-6 flex justify-start gap-2">
        <button
          onClick={() => navigate("/")}
          className="rounded bg-gray-200 px-4 py-1"
          type="button"
        >
          Home
        </button>
        <button
          onClick={() => navigate(-1)}
          className="rounded bg-gray-200 px-4 py-1"
          type="button"
        >
          Back
        </button>
      </div>

      <h2 className="mb-6 text-center text-xl font-bold">DM Dashboard</h2>

      <div className="mb-8 flex justify-center gap-4">
        <button
          onClick={() => navigate("/host-game")}
          className="rounded bg-purple-100 px-6 py-2 text-sm"
          type="button"
        >
          Host a New Game
        </button>
        <button
          onClick={() => navigate("/create-ruleset")}
          className="rounded bg-green-100 px-6 py-2 text-sm"
          type="button"
        >
          Create a New Ruleset
        </button>
      </div>

      {loading && <p className="mb-4 text-center text-gray-500">Loading games...</p>}
      {error && <p className="mb-4 text-center text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mb-8">
          <h3 className="mb-2 text-md font-semibold">My Rulesets</h3>
          <div className="flex flex-col gap-2">
            {rulesets.length === 0 && (
              <div className="italic text-gray-400">No custom rulesets yet.</div>
            )}
            {rulesets.map((ruleset) => (
              <button
                key={ruleset.id}
                onClick={() => navigate(`/create-ruleset/${ruleset.id}`)}
                className="rounded border p-3 text-left hover:shadow"
                type="button"
              >
                {ruleset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-md font-semibold">Passive / Old Games</h3>
            <div className="flex flex-col gap-2">
              {passiveGames.length === 0 && (
                <div className="italic text-gray-400">No passive games.</div>
              )}
              {passiveGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => navigate(`/dm/game-dashboard/${game.id}`)}
                  className="rounded border p-3 text-left hover:shadow"
                  type="button"
                >
                  {game.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-md font-semibold">Active Games</h3>
            <div className="flex flex-col gap-2">
              {activeGames.length === 0 && (
                <div className="italic text-gray-400">No active games.</div>
              )}
              {activeGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => navigate(`/dm/game-dashboard/${game.id}`)}
                  className="rounded border p-3 text-left hover:shadow"
                  type="button"
                >
                  {game.name}{" "}
                  <span className="text-xs text-gray-500">
                    ({game.ruleset_name || "No ruleset"})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

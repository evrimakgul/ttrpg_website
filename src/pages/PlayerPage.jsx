import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function PlayerPage() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadGames = async () => {
      try {
        const data = await apiFetch("/api/games?role=player");
        setGames(data.games || []);
      } catch (err) {
        setError(err.message || "Could not load games.");
      } finally {
        setLoading(false);
      }
    };

    loadGames();
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

      <h2 className="mb-6 text-center text-xl font-bold">Player Dashboard</h2>

      <div className="mb-8 flex justify-center">
        <button
          onClick={() => navigate("/select-game")}
          className="rounded bg-blue-100 px-6 py-2 text-sm"
          type="button"
        >
          Join a Game With Invite Code
        </button>
      </div>

      {loading && <p className="text-center text-gray-500">Loading games...</p>}
      {error && <p className="text-center text-red-600">{error}</p>}

      {!loading && !error && (
        <div>
          <h3 className="mb-2 text-md font-semibold">Your Games</h3>
          <div className="flex flex-col gap-2">
            {games.length === 0 && (
              <div className="italic text-gray-400">You have not joined any games yet.</div>
            )}
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => navigate(`/sheet/${game.id}`)}
                className="rounded border p-3 text-left hover:shadow"
                type="button"
              >
                {game.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

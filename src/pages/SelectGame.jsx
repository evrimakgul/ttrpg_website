import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function SelectGame() {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState("");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const loadGames = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/games?role=player");
      setGames(data.games || []);
    } catch (err) {
      setError(err.message || "Could not load your games.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  const joinByCode = async () => {
    if (!inviteCode.trim()) {
      setError("Please enter an invite code.");
      return;
    }

    setError("");
    setInfo("");
    setSubmitting(true);

    try {
      const normalizedCode = inviteCode.trim().toUpperCase();
      const data = await apiFetch("/api/games/join", {
        method: "POST",
        body: { inviteCode: normalizedCode },
      });

      setInfo(`Joined ${data.game.name}.`);
      setInviteCode("");
      await loadGames();
      navigate(`/create-character/${data.game.id}`);
    } catch (err) {
      setError(err.message || "Could not join with invite code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-6 text-sm shadow">
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

      <h2 className="mb-4 text-center text-lg font-bold">Join a Game</h2>

      <div className="mb-4 space-y-2 rounded border p-3">
        <label className="block text-sm font-medium">Invite Code</label>
        <input
          className="w-full rounded border p-2"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Example: ARGO-72FQ"
        />
        <button
          className="w-full rounded bg-blue-100 py-2 disabled:opacity-60"
          onClick={joinByCode}
          disabled={submitting}
          type="button"
        >
          {submitting ? "Joining..." : "Join With Code"}
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {info && <p className="mb-2 text-sm text-green-700">{info}</p>}

      <h3 className="mb-2 font-semibold">Your Joined Games</h3>

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && games.length === 0 && (
        <p className="italic text-gray-400">No joined games yet.</p>
      )}

      <div className="space-y-2">
        {games.map((game) => (
          <button
            key={game.id}
            className="w-full rounded border p-2 text-left hover:bg-gray-50"
            onClick={() => navigate(`/sheet/${game.id}`)}
            type="button"
          >
            {game.name}
          </button>
        ))}
      </div>
    </div>
  );
}

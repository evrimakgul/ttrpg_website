import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function HostGame() {
  const navigate = useNavigate();
  const [gameName, setGameName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!gameName.trim()) {
      setError("Please enter a game name.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const data = await apiFetch("/api/games", {
        method: "POST",
        body: {
          name: gameName.trim(),
          notes: notes.trim(),
        },
      });

      navigate(`/select-ruleset/${data.game.id}`);
    } catch (err) {
      setError(err.message || "Could not create game.");
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

      <h2 className="mb-6 text-center text-lg font-bold">Host a New Game</h2>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">Game Name</label>
        <input
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          className="w-full rounded border p-2"
        />
      </div>

      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded border p-2"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubmit}
        className="w-full rounded bg-purple-100 py-2 disabled:opacity-60"
        disabled={submitting}
        type="button"
      >
        {submitting ? "Creating..." : "Host Game"}
      </button>
    </div>
  );
}

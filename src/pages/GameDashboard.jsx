import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function GameDashboard() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!gameId) {
        setError("Missing game id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [gameData, membersData] = await Promise.all([
          apiFetch(`/api/games/${gameId}`),
          apiFetch(`/api/games/${gameId}/members`),
        ]);

        setGame(gameData.game);
        setMembers(membersData.members || []);
      } catch (err) {
        setError(err.message || "Could not load game dashboard.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [gameId]);

  const updateGameField = (field, value) => {
    setGame((prev) => ({ ...prev, [field]: value }));
  };

  const saveGame = async () => {
    if (!gameId || !game?.name?.trim()) {
      setError("Game name is required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const data = await apiFetch(`/api/games/${gameId}`, {
        method: "PATCH",
        body: {
          name: game.name,
          notes: game.notes || "",
          ruleset_name: game.ruleset_name || "",
        },
      });
      setGame(data.game);
    } catch (err) {
      setError(err.message || "Could not save game.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;
    const ok = window.confirm(
      "Are you sure you want to delete this game? This cannot be undone."
    );

    if (!ok) return;

    try {
      await apiFetch(`/api/games/${gameId}`, { method: "DELETE" });
      navigate("/dm");
    } catch (err) {
      setError(err.message || "Could not delete game.");
    }
  };

  const copyInviteCode = async () => {
    if (!game?.invite_code) return;
    try {
      await navigator.clipboard.writeText(game.invite_code);
    } catch {
      setError("Could not copy invite code.");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-4xl rounded-2xl bg-white p-6 text-center text-sm shadow">
        Loading game dashboard...
      </div>
    );
  }

  if (!game) {
    return (
      <div className="mx-auto mt-10 max-w-4xl rounded-2xl bg-white p-6 text-center text-sm shadow">
        {error || "Game not found."}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-4xl rounded-2xl bg-white p-6 text-sm shadow">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
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

        <button
          onClick={handleDeleteGame}
          className="rounded bg-red-100 px-4 py-1 text-red-700 hover:bg-red-200"
          type="button"
        >
          Delete Game
        </button>
      </div>

      <h2 className="mb-6 text-center text-xl font-bold">Game Dashboard</h2>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title="Game Info">
          <div className="space-y-2">
            <input
              className="w-full rounded border p-2"
              placeholder="Game Name"
              value={game.name || ""}
              onChange={(e) => updateGameField("name", e.target.value)}
            />

            <textarea
              className="w-full rounded border p-2"
              rows={4}
              placeholder="Notes"
              value={game.notes || ""}
              onChange={(e) => updateGameField("notes", e.target.value)}
            />

            <p className="text-sm text-gray-600">
              <strong>Ruleset:</strong> {game.ruleset_name || "None"}
            </p>

            <div className="rounded border border-blue-100 bg-blue-50 p-2">
              <p className="text-xs text-gray-600">Invite code</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <strong>{game.invite_code}</strong>
                <button
                  type="button"
                  className="rounded bg-white px-2 py-1 text-xs"
                  onClick={copyInviteCode}
                >
                  Copy
                </button>
              </div>
            </div>

            <button
              className="w-full rounded bg-blue-100 py-2 disabled:opacity-60"
              onClick={saveGame}
              disabled={saving}
              type="button"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Section>

        <Section title="Players">
          <ul className="space-y-1">
            {members.length === 0 && <li className="text-gray-500">No players yet.</li>}
            {members.map((member) => (
              <li key={member.id}>
                {member.display_name}{" "}
                <span className="text-xs text-gray-500">({member.role})</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Bonuses">
          <p className="text-gray-500">Custom bonuses can be added in next phase.</p>
        </Section>

        <Section title="Encounters / Events">
          <p className="text-gray-500">Encounter management can be added in next phase.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded border p-4">
      <h3 className="mb-2 text-md font-semibold">{title}</h3>
      {children}
    </div>
  );
}

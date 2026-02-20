import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

const EMPTY_XP_SUMMARY = {
  earned_session: 0,
  earned_total: 0,
  xp_used: 0,
  xp_leftover: 0,
};

function formatXpTransaction(tx) {
  if (tx.type === "session_award") {
    return `Session +${Number(tx.amount || 0)} XP`;
  }
  return `${tx.field_label || "Field"} +${Number(tx.step || 0)} (cost ${Number(
    tx.cost || 0
  )} XP)`;
}

export default function GameDashboard() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rulesetVersions, setRulesetVersions] = useState([]);
  const [selectedRulesetVersion, setSelectedRulesetVersion] = useState("");
  const [updatingRulesetVersion, setUpdatingRulesetVersion] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [xpAwardDrafts, setXpAwardDrafts] = useState({});
  const [xpActionKey, setXpActionKey] = useState("");

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
        const [gameData, membersData, charactersData] = await Promise.all([
          apiFetch(`/api/games/${gameId}`),
          apiFetch(`/api/games/${gameId}/members`),
          apiFetch(`/api/games/${gameId}/characters`),
        ]);

        const loadedGame = gameData.game;
        setGame(loadedGame);
        setMembers(membersData.members || []);
        const loadedCharacters = charactersData.characters || [];
        setCharacters(loadedCharacters);
        setXpAwardDrafts((prev) => {
          const next = { ...prev };
          loadedCharacters.forEach((character) => {
            if (next[character.id] === undefined) {
              next[character.id] = "";
            }
          });
          return next;
        });

        if (
          loadedGame.ruleset_type === "custom" &&
          loadedGame.ruleset_id &&
          Number(loadedGame.ruleset_version) > 0
        ) {
          const versionsData = await apiFetch(
            `/api/rulesets/${loadedGame.ruleset_id}/versions`
          );
          const versions = versionsData.versions || [];
          setRulesetVersions(versions);
          setSelectedRulesetVersion(String(loadedGame.ruleset_version));
        } else {
          setRulesetVersions([]);
          setSelectedRulesetVersion("");
        }
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
        },
      });
      setGame(data.game);
    } catch (err) {
      setError(err.message || "Could not save game.");
    } finally {
      setSaving(false);
    }
  };

  const savePinnedRulesetVersion = async () => {
    if (!gameId || !game?.ruleset_id || !selectedRulesetVersion) return;
    if (String(game.ruleset_version || "") === String(selectedRulesetVersion)) return;

    setUpdatingRulesetVersion(true);
    setError("");
    try {
      const data = await apiFetch(`/api/games/${gameId}`, {
        method: "PATCH",
        body: {
          ruleset_type: "custom",
          ruleset_id: game.ruleset_id,
          ruleset_version: Number(selectedRulesetVersion),
        },
      });
      setGame(data.game);
      await refreshCharacters();
    } catch (err) {
      setError(err.message || "Could not update pinned ruleset version.");
    } finally {
      setUpdatingRulesetVersion(false);
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

  const refreshCharacters = async () => {
    if (!gameId) return;
    const data = await apiFetch(`/api/games/${gameId}/characters`);
    setCharacters(data.characters || []);
  };

  const runXpAction = async (actionKey, fn) => {
    setXpActionKey(actionKey);
    setError("");
    try {
      await fn();
      await refreshCharacters();
    } catch (err) {
      setError(err.message || "Could not update XP transaction.");
    } finally {
      setXpActionKey("");
    }
  };

  const createPendingSessionAward = (character) => {
    const amount = Number(xpAwardDrafts[character.id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a positive XP award amount.");
      return;
    }

    runXpAction(`award:${character.id}`, async () => {
      await apiFetch(`/api/games/${gameId}/characters/${character.id}/xp/session-award`, {
        method: "POST",
        body: {
          amount,
        },
      });
      setXpAwardDrafts((prev) => ({ ...prev, [character.id]: "" }));
    });
  };

  const confirmTransaction = (characterId, txId) => {
    runXpAction(`confirm:${txId}`, async () => {
      await apiFetch(
        `/api/games/${gameId}/characters/${characterId}/xp/transactions/${txId}/confirm`,
        {
          method: "POST",
        }
      );
    });
  };

  const unlockTransaction = (characterId, txId) => {
    runXpAction(`unlock:${txId}`, async () => {
      await apiFetch(
        `/api/games/${gameId}/characters/${characterId}/xp/transactions/${txId}/unlock`,
        {
          method: "POST",
        }
      );
    });
  };

  const reassignSessionAward = (character, txId) => {
    const amount = Number(xpAwardDrafts[character.id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a positive XP award amount for reassignment.");
      return;
    }

    runXpAction(`reassign:${txId}`, async () => {
      await apiFetch(
        `/api/games/${gameId}/characters/${character.id}/xp/session-award/${txId}/reassign`,
        {
          method: "POST",
          body: {
            amount,
          },
        }
      );
      setXpAwardDrafts((prev) => ({ ...prev, [character.id]: "" }));
    });
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
              <strong>Ruleset Mode:</strong> {game.ruleset_type || "builtin"}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Ruleset:</strong> {game.ruleset_name || "None"}
            </p>
            {game.ruleset_type === "custom" && (
              <>
                <p className="text-xs text-gray-600">
                  <strong>Ruleset ID:</strong> {game.ruleset_id || "N/A"}
                </p>
                <p className="text-xs text-gray-600">
                  <strong>Pinned Version:</strong>{" "}
                  {game.ruleset_version ? `v${game.ruleset_version}` : "N/A"}
                </p>
                <div className="flex flex-wrap items-center gap-2 rounded border border-green-100 bg-green-50 p-2">
                  <select
                    className="rounded border p-1 text-xs"
                    value={selectedRulesetVersion}
                    onChange={(event) => setSelectedRulesetVersion(event.target.value)}
                  >
                    <option value="">Select version</option>
                    {rulesetVersions.map((version) => (
                      <option key={version.id} value={String(version.version)}>
                        v{version.version}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded bg-white px-2 py-1 text-xs disabled:opacity-60"
                    onClick={savePinnedRulesetVersion}
                    disabled={
                      updatingRulesetVersion ||
                      !selectedRulesetVersion ||
                      String(selectedRulesetVersion) === String(game.ruleset_version || "")
                    }
                  >
                    {updatingRulesetVersion ? "Updating..." : "Update Pinned Version"}
                  </button>
                  <button
                    type="button"
                    className="rounded bg-white px-2 py-1 text-xs"
                    onClick={() => navigate(`/create-ruleset/${game.ruleset_id}`)}
                  >
                    Open Ruleset Editor
                  </button>
                </div>
              </>
            )}

            <button
              className="w-full rounded bg-purple-100 py-2"
              onClick={() => navigate(`/select-ruleset/${gameId}`)}
              type="button"
            >
              Change Ruleset
            </button>

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

        <Section title="XP Governance">
          {game.ruleset_type !== "custom" && (
            <p className="text-gray-500">
              XP governance is available when the game uses a custom ruleset.
            </p>
          )}
          {game.ruleset_type === "custom" && characters.length === 0 && (
            <p className="text-gray-500">No characters found for this game.</p>
          )}
          {game.ruleset_type === "custom" && characters.length > 0 && (
            <div className="space-y-3">
              {characters.map((character) => {
                const summary = {
                  ...EMPTY_XP_SUMMARY,
                  ...(character.sheet_json?.xp_summary || {}),
                };
                const transactions = Array.isArray(character.sheet_json?.xp_transactions)
                  ? character.sheet_json.xp_transactions
                  : [];
                const recentTransactions = transactions.slice().reverse().slice(0, 8);

                return (
                  <div key={character.id} className="rounded border p-2">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong>{character.display_name || character.user_id}</strong>{" "}
                        {character.name ? (
                          <span className="text-xs text-gray-500">({character.name})</span>
                        ) : null}
                      </div>
                      <span className="text-xs text-gray-600">
                        Leftover: {Number(summary.xp_leftover || 0)}
                      </span>
                    </div>

                    <div className="mb-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                      <MiniStat
                        label="Session"
                        value={Number(summary.earned_session || 0)}
                      />
                      <MiniStat
                        label="Total"
                        value={Number(summary.earned_total || 0)}
                      />
                      <MiniStat label="Used" value={Number(summary.xp_used || 0)} />
                      <MiniStat
                        label="Leftover"
                        value={Number(summary.xp_leftover || 0)}
                      />
                    </div>

                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="number"
                        className="w-32 rounded border p-1 text-xs"
                        placeholder="Session XP"
                        value={xpAwardDrafts[character.id] ?? ""}
                        onChange={(event) =>
                          setXpAwardDrafts((prev) => ({
                            ...prev,
                            [character.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="rounded bg-blue-100 px-2 py-1 text-xs disabled:opacity-60"
                        onClick={() => createPendingSessionAward(character)}
                        disabled={xpActionKey === `award:${character.id}`}
                      >
                        {xpActionKey === `award:${character.id}`
                          ? "Adding..."
                          : "Add Pending Award"}
                      </button>
                    </div>

                    {recentTransactions.length === 0 ? (
                      <p className="text-xs text-gray-500">No XP transactions yet.</p>
                    ) : (
                      <div className="space-y-1 text-xs">
                        {recentTransactions.map((tx) => (
                          <div key={tx.id} className="rounded border bg-gray-50 p-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{formatXpTransaction(tx)}</span>
                              <span className={transactionStatusClass(tx.status)}>
                                {tx.status || "confirmed"}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {new Date(tx.at).toLocaleString()}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {tx.status === "pending" && (
                                <button
                                  type="button"
                                  className="rounded bg-green-100 px-2 py-1 text-[11px] disabled:opacity-60"
                                  onClick={() => confirmTransaction(character.id, tx.id)}
                                  disabled={xpActionKey === `confirm:${tx.id}`}
                                >
                                  {xpActionKey === `confirm:${tx.id}`
                                    ? "Confirming..."
                                    : "Confirm"}
                                </button>
                              )}
                              {tx.type === "spend" && tx.status === "confirmed" && (
                                <button
                                  type="button"
                                  className="rounded bg-orange-100 px-2 py-1 text-[11px] disabled:opacity-60"
                                  onClick={() => unlockTransaction(character.id, tx.id)}
                                  disabled={xpActionKey === `unlock:${tx.id}`}
                                >
                                  {xpActionKey === `unlock:${tx.id}`
                                    ? "Unlocking..."
                                    : "Unlock"}
                                </button>
                              )}
                              {tx.type === "session_award" && tx.status === "confirmed" && (
                                <button
                                  type="button"
                                  className="rounded bg-purple-100 px-2 py-1 text-[11px] disabled:opacity-60"
                                  onClick={() => reassignSessionAward(character, tx.id)}
                                  disabled={xpActionKey === `reassign:${tx.id}`}
                                >
                                  {xpActionKey === `reassign:${tx.id}`
                                    ? "Reassigning..."
                                    : "Reassign"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

function MiniStat({ label, value }) {
  return (
    <div className="rounded border bg-white p-1">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function transactionStatusClass(status) {
  if (status === "pending") return "rounded bg-yellow-100 px-2 py-0.5 text-[11px]";
  if (status === "confirmed") return "rounded bg-green-100 px-2 py-0.5 text-[11px]";
  if (status === "unlocked") return "rounded bg-orange-100 px-2 py-0.5 text-[11px]";
  if (status === "reverted") return "rounded bg-red-100 px-2 py-0.5 text-[11px]";
  return "rounded bg-gray-100 px-2 py-0.5 text-[11px]";
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

const BUILT_IN_RULESETS = ["Default Ruleset", "DnD 5e", "Vampire V20"];

export default function SelectRuleset() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [customRulesets, setCustomRulesets] = useState([]);
  const [versionsByRulesetId, setVersionsByRulesetId] = useState({});
  const [selectedVersionByRulesetId, setSelectedVersionByRulesetId] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadRulesets = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch("/api/rulesets");
        const rulesets = data.rulesets || [];
        setCustomRulesets(rulesets);

        const defaults = {};
        rulesets.forEach((ruleset) => {
          if (Number(ruleset.latest_published_version) > 0) {
            defaults[ruleset.id] = String(ruleset.latest_published_version);
          }
        });
        setSelectedVersionByRulesetId(defaults);
      } catch (err) {
        setError(err.message || "Could not load custom rulesets.");
      } finally {
        setLoading(false);
      }
    };

    loadRulesets();
  }, []);

  const publishedCount = useMemo(
    () =>
      customRulesets.filter(
        (ruleset) => Number(ruleset.latest_published_version || 0) > 0
      ).length,
    [customRulesets]
  );

  const chooseBuiltIn = async (rulesetName) => {
    if (!gameId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/api/games/${gameId}`, {
        method: "PATCH",
        body: {
          ruleset_type: "builtin",
          ruleset_name: rulesetName,
        },
      });
      setMessage(`Game linked to built-in ruleset '${rulesetName}'.`);
      navigate(`/dm/game-dashboard/${gameId}`);
    } catch (err) {
      setError(err.message || "Could not update built-in ruleset.");
    } finally {
      setSaving(false);
    }
  };

  const loadVersionsForRuleset = async (rulesetId) => {
    if (versionsByRulesetId[rulesetId]) return;
    try {
      const data = await apiFetch(`/api/rulesets/${rulesetId}/versions`);
      const versions = data.versions || [];
      setVersionsByRulesetId((prev) => ({ ...prev, [rulesetId]: versions }));
      if (versions.length > 0) {
        setSelectedVersionByRulesetId((prev) => ({
          ...prev,
          [rulesetId]: String(versions[0].version),
        }));
      }
    } catch (err) {
      setError(err.message || "Could not load ruleset versions.");
    }
  };

  const chooseCustom = async (rulesetId) => {
    if (!gameId) return;
    const selectedVersion = selectedVersionByRulesetId[rulesetId];
    if (!selectedVersion) {
      setError("Pick a published version first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/api/games/${gameId}`, {
        method: "PATCH",
        body: {
          ruleset_type: "custom",
          ruleset_id: rulesetId,
          ruleset_version: Number(selectedVersion),
        },
      });
      setMessage(`Game linked to custom ruleset v${selectedVersion}.`);
      navigate(`/dm/game-dashboard/${gameId}`);
    } catch (err) {
      setError(err.message || "Could not link custom ruleset.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-3xl rounded-2xl bg-white p-6 text-sm shadow">
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

      <h2 className="mb-6 text-center text-lg font-bold">Select Ruleset</h2>

      <section className="mb-6 rounded border p-4">
        <h3 className="mb-3 font-semibold">Built-In Rulesets</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {BUILT_IN_RULESETS.map((rulesetName) => (
            <button
              key={rulesetName}
              onClick={() => chooseBuiltIn(rulesetName)}
              className="rounded border px-3 py-2 text-left hover:bg-blue-50 disabled:opacity-60"
              disabled={saving}
              type="button"
            >
              {rulesetName}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded border p-4">
        <h3 className="mb-1 font-semibold">Custom Rulesets</h3>
        <p className="mb-3 text-xs text-gray-600">
          {publishedCount} published ruleset(s) available.
        </p>

        {loading && <p className="text-xs text-gray-500">Loading rulesets...</p>}

        {!loading && customRulesets.length === 0 && (
          <p className="text-xs text-gray-500">No custom rulesets yet.</p>
        )}

        <div className="space-y-3">
          {customRulesets.map((ruleset) => {
            const latest = Number(ruleset.latest_published_version || 0);
            const versions = versionsByRulesetId[ruleset.id] || [];
            const selectedVersion = selectedVersionByRulesetId[ruleset.id] || "";

            return (
              <div key={ruleset.id} className="rounded border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{ruleset.name}</div>
                    <div className="text-xs text-gray-500">
                      Latest published version: {latest > 0 ? `v${latest}` : "None"}
                    </div>
                  </div>
                  <button
                    className="rounded bg-gray-100 px-3 py-1 text-xs"
                    type="button"
                    onClick={() => loadVersionsForRuleset(ruleset.id)}
                    disabled={saving}
                  >
                    Load Versions
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded border p-2 text-xs"
                    value={selectedVersion}
                    onChange={(event) =>
                      setSelectedVersionByRulesetId((prev) => ({
                        ...prev,
                        [ruleset.id]: event.target.value,
                      }))
                    }
                    disabled={latest === 0 || saving}
                  >
                    <option value="">Select version</option>
                    {versions.map((version) => (
                      <option key={version.id} value={String(version.version)}>
                        v{version.version}
                      </option>
                    ))}
                    {versions.length === 0 && latest > 0 && (
                      <option value={String(latest)}>v{latest} (latest)</option>
                    )}
                  </select>
                  <button
                    className="rounded bg-green-100 px-3 py-2 text-xs disabled:opacity-60"
                    type="button"
                    disabled={saving || latest === 0 || !selectedVersion}
                    onClick={() => chooseCustom(ruleset.id)}
                  >
                    Link This Version
                  </button>
                  {latest === 0 && (
                    <span className="text-xs text-gray-500">
                      Publish this ruleset before linking.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <button
        onClick={() => navigate(`/create-ruleset?gameId=${gameId || ""}`)}
        className="w-full rounded bg-purple-100 py-2"
        type="button"
      >
        Create or Edit a Ruleset
      </button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

const BUILT_IN_RULESETS = ["Default Ruleset", "DnD 5e", "Vampire V20"];

export default function SelectRuleset() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [showList, setShowList] = useState(false);
  const [customRulesets, setCustomRulesets] = useState([]);
  const [loadingRulesets, setLoadingRulesets] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadRulesets = async () => {
      setLoadingRulesets(true);
      try {
        const data = await apiFetch("/api/rulesets");
        setCustomRulesets(data.rulesets || []);
      } catch (err) {
        setError(err.message || "Could not load custom rulesets.");
      } finally {
        setLoadingRulesets(false);
      }
    };

    loadRulesets();
  }, []);

  const handleExistingSelection = async (rulesetName) => {
    if (!gameId) return;
    setError("");
    setSaving(true);

    try {
      await apiFetch(`/api/games/${gameId}`, {
        method: "PATCH",
        body: { ruleset_name: rulesetName },
      });
      navigate(`/dm/game-dashboard/${gameId}`);
    } catch (err) {
      setError(err.message || "Could not update ruleset.");
    } finally {
      setSaving(false);
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

      <h2 className="mb-6 text-center text-lg font-bold">Select Ruleset</h2>

      <div className="mb-6">
        <button
          onClick={() => setShowList(!showList)}
          className="w-full rounded bg-blue-100 py-2 disabled:opacity-60"
          disabled={saving || loadingRulesets}
          type="button"
        >
          {loadingRulesets ? "Loading Rulesets..." : "Select Existing Ruleset"}
        </button>

        {showList && (
          <div className="mt-4 space-y-2">
            {customRulesets.map((ruleset) => (
              <button
                key={ruleset.id}
                onClick={() => handleExistingSelection(ruleset.name)}
                className="w-full rounded border px-3 py-2 text-left hover:bg-blue-50"
                disabled={saving}
                type="button"
              >
                {ruleset.name}
              </button>
            ))}

            {BUILT_IN_RULESETS.map((rulesetName) => (
              <button
                key={rulesetName}
                onClick={() => handleExistingSelection(rulesetName)}
                className="w-full rounded border px-3 py-2 text-left hover:bg-blue-50"
                disabled={saving}
                type="button"
              >
                {rulesetName}
              </button>
            ))}

            {customRulesets.length === 0 && (
              <p className="text-xs text-gray-500">
                No custom rulesets yet. Create one below.
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate(`/create-ruleset?gameId=${gameId || ""}`)}
        className="w-full rounded bg-purple-100 py-2"
        type="button"
      >
        Set Up a New Ruleset
      </button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

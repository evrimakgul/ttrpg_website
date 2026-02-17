import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

const DEFAULT_ATTRIBUTES = ["Strength", "Dexterity"];
const DEFAULT_SKILLS = ["Stealth", "Insight"];

export default function CreateRuleset() {
  const navigate = useNavigate();
  const { rulesetId } = useParams();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("gameId");

  const [rulesetName, setRulesetName] = useState("");
  const [attributes, setAttributes] = useState(DEFAULT_ATTRIBUTES);
  const [skills, setSkills] = useState(DEFAULT_SKILLS);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(rulesetId));

  useEffect(() => {
    const loadRuleset = async () => {
      if (!rulesetId) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiFetch(`/api/rulesets/${rulesetId}`);
        const current = data.ruleset;

        setRulesetName(current.name || "");
        setAttributes(
          Array.isArray(current.attributes) && current.attributes.length > 0
            ? current.attributes
            : DEFAULT_ATTRIBUTES
        );
        setSkills(
          Array.isArray(current.skills) && current.skills.length > 0
            ? current.skills
            : DEFAULT_SKILLS
        );
      } catch (err) {
        setError(err.message || "Could not load ruleset.");
      } finally {
        setLoading(false);
      }
    };

    loadRuleset();
  }, [rulesetId]);

  const handleAdd = (list, setList) => {
    setList([...list, ""]);
  };

  const handleChange = (index, value, list, setList) => {
    const updated = [...list];
    updated[index] = value;
    setList(updated);
  };

  const normalizeList = (list) =>
    [...new Set(list.map((item) => item.trim()).filter(Boolean))];

  const saveRuleset = async () => {
    const cleanedName = rulesetName.trim();
    const cleanedAttributes = normalizeList(attributes);
    const cleanedSkills = normalizeList(skills);

    if (!cleanedName) {
      setError("Ruleset must have a name.");
      return;
    }

    setError("");
    setMessage("");
    setSaving(true);

    try {
      let savedRuleset = null;

      if (rulesetId) {
        const data = await apiFetch(`/api/rulesets/${rulesetId}`, {
          method: "PATCH",
          body: {
            name: cleanedName,
            attributes: cleanedAttributes,
            skills: cleanedSkills,
          },
        });
        savedRuleset = data.ruleset;
      } else {
        const data = await apiFetch("/api/rulesets", {
          method: "POST",
          body: {
            name: cleanedName,
            attributes: cleanedAttributes,
            skills: cleanedSkills,
          },
        });
        savedRuleset = data.ruleset;
      }

      setRulesetName(savedRuleset.name || cleanedName);
      setAttributes(
        Array.isArray(savedRuleset.attributes) && savedRuleset.attributes.length > 0
          ? savedRuleset.attributes
          : cleanedAttributes
      );
      setSkills(
        Array.isArray(savedRuleset.skills) && savedRuleset.skills.length > 0
          ? savedRuleset.skills
          : cleanedSkills
      );

      if (gameId) {
        await apiFetch(`/api/games/${gameId}`, {
          method: "PATCH",
          body: { ruleset_name: savedRuleset.name },
        });
      }

      if (!rulesetId) {
        const query = gameId ? `?gameId=${gameId}` : "";
        navigate(`/create-ruleset/${savedRuleset.id}${query}`, { replace: true });
      }

      setMessage(
        gameId
          ? "Ruleset saved and linked to this game."
          : "Ruleset saved. You can keep editing it here."
      );
    } catch (err) {
      setError(err.message || "Could not save ruleset.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded-2xl bg-white p-6 text-center text-sm shadow">
        Loading ruleset...
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-2xl bg-white p-6 text-sm shadow">
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

      <h2 className="mb-2 text-center text-lg font-bold">
        {rulesetId ? "Edit Custom Ruleset" : "Create Custom Ruleset"}
      </h2>
      {rulesetId && <p className="mb-6 text-center text-xs text-gray-500">ID: {rulesetId}</p>}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">Ruleset Name</label>
        <input
          value={rulesetName}
          onChange={(e) => setRulesetName(e.target.value)}
          className="w-full rounded border p-2"
        />
      </div>

      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium">Attributes</label>
          <button
            onClick={() => handleAdd(attributes, setAttributes)}
            className="text-xs text-blue-600"
            type="button"
          >
            Add Attribute
          </button>
        </div>
        <div className="space-y-2">
          {attributes.map((attribute, idx) => (
            <input
              key={`${attribute}-${idx}`}
              value={attribute}
              onChange={(e) => handleChange(idx, e.target.value, attributes, setAttributes)}
              className="w-full rounded border p-2"
            />
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium">Skills</label>
          <button
            onClick={() => handleAdd(skills, setSkills)}
            className="text-xs text-blue-600"
            type="button"
          >
            Add Skill
          </button>
        </div>
        <div className="space-y-2">
          {skills.map((skill, idx) => (
            <input
              key={`${skill}-${idx}`}
              value={skill}
              onChange={(e) => handleChange(idx, e.target.value, skills, setSkills)}
              className="w-full rounded border p-2"
            />
          ))}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-3 text-sm text-green-700">{message}</p>}

      <button
        onClick={saveRuleset}
        className="w-full rounded bg-purple-100 py-2 disabled:opacity-60"
        disabled={saving}
        type="button"
      >
        {saving ? "Saving..." : rulesetId ? "Save Ruleset" : "Create Ruleset"}
      </button>

      {gameId && (
        <button
          onClick={() => navigate(`/dm/game-dashboard/${gameId}`)}
          className="mt-3 w-full rounded bg-blue-100 py-2"
          type="button"
        >
          Back to Game Dashboard
        </button>
      )}
    </div>
  );
}

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function CreateRuleset() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("gameId");

  const [rulesetName, setRulesetName] = useState("");
  const [attributes, setAttributes] = useState(["Strength", "Dexterity"]);
  const [skills, setSkills] = useState(["Stealth", "Insight"]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!rulesetName.trim()) {
      setError("Ruleset must have a name.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      if (gameId) {
        await apiFetch(`/api/games/${gameId}`, {
          method: "PATCH",
          body: {
            ruleset_name: rulesetName.trim(),
            notes: `Attributes: ${attributes.join(", ")}\nSkills: ${skills.join(", ")}`,
          },
        });

        navigate(`/dm/game-dashboard/${gameId}`);
      } else {
        navigate("/dm");
      }
    } catch (err) {
      setError(err.message || "Could not save ruleset.");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (list, setList) => {
    setList([...list, ""]);
  };

  const handleChange = (index, value, list, setList) => {
    const updated = [...list];
    updated[index] = value;
    setList(updated);
  };

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

      <h2 className="mb-6 text-center text-lg font-bold">Create Custom Ruleset</h2>

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
          {attributes.map((attr, idx) => (
            <input
              key={idx}
              value={attr}
              onChange={(e) =>
                handleChange(idx, e.target.value, attributes, setAttributes)
              }
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
              key={idx}
              value={skill}
              onChange={(e) => handleChange(idx, e.target.value, skills, setSkills)}
              className="w-full rounded border p-2"
            />
          ))}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubmit}
        className="w-full rounded bg-purple-100 py-2 disabled:opacity-60"
        disabled={saving}
        type="button"
      >
        {saving ? "Saving..." : "Create Ruleset"}
      </button>
    </div>
  );
}

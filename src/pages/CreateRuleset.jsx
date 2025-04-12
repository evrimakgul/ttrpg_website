import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function CreateRuleset() {
  const navigate = useNavigate();

  const [rulesetName, setRulesetName] = useState("");
  const [attributes, setAttributes] = useState(["Strength", "Dexterity"]);
  const [skills, setSkills] = useState(["Stealth", "Insight"]);

  const handleSubmit = () => {
    if (!rulesetName.trim()) {
      alert("Ruleset must have a name.");
      return;
    }
    // Later: save to backend
    navigate("/dm/game-dashboard");
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
    <div className="max-w-2xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Nav */}
      <div className="flex justify-start gap-2 mb-6">
        <button
          onClick={() => navigate("/")}
          className="px-4 py-1 bg-gray-200 rounded"
        >
          🏠 Home
        </button>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-1 bg-gray-200 rounded"
        >
          ⬅ Back
        </button>
      </div>

      {/* Title */}
      <h2 className="text-lg font-bold text-center mb-6">Create Custom Ruleset</h2>

      {/* Ruleset Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Ruleset Name</label>
        <input
          value={rulesetName}
          onChange={(e) => setRulesetName(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      {/* Attributes */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium">Attributes</label>
          <button
            onClick={() => handleAdd(attributes, setAttributes)}
            className="text-blue-600 text-xs"
          >
            ➕ Add Attribute
          </button>
        </div>
        <div className="space-y-2">
          {attributes.map((attr, idx) => (
            <input
              key={idx}
              value={attr}
              onChange={(e) => handleChange(idx, e.target.value, attributes, setAttributes)}
              className="w-full border p-2 rounded"
            />
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium">Skills</label>
          <button
            onClick={() => handleAdd(skills, setSkills)}
            className="text-blue-600 text-xs"
          >
            ➕ Add Skill
          </button>
        </div>
        <div className="space-y-2">
          {skills.map((skill, idx) => (
            <input
              key={idx}
              value={skill}
              onChange={(e) => handleChange(idx, e.target.value, skills, setSkills)}
              className="w-full border p-2 rounded"
            />
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="w-full bg-purple-100 py-2 rounded"
      >
        ✅ Create Ruleset
      </button>
    </div>
  );
}

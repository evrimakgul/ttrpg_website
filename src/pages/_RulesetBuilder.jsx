// Import navigation function (to move between pages)
import { useNavigate } from "react-router-dom";
// Import state hook (lets us track and update user inputs)
import { useState } from "react";

// This is a React component that allows a DM to build a custom ruleset
export default function RulesetBuilder() {
  const navigate = useNavigate(); // used to redirect the user to another page

  // Store the name of the ruleset the DM is creating
  const [rulesetName, setRulesetName] = useState("");

  // Store grouped attributes/skills (e.g., Physical → Strength, Dexterity)
  const [groups, setGroups] = useState([
    {
      id: Date.now().toString(),          // unique ID for this group
      label: "Sample Group",              // group name shown to user
      fields: ["Strength", "Dexterity"],  // list of fields under this group
    },
  ]);

  // Store any counters like HP, XP, etc.
  const [counters, setCounters] = useState([
    { id: "hp-1", label: "Hit Points", baseValue: 10 },
  ]);

  // Called when user clicks "Create Ruleset"
  const handleSubmit = () => {
    if (!rulesetName.trim()) {
      alert("Ruleset must have a name.");
      return; // do nothing if ruleset name is empty
    }

    // Generate a unique ID for the new ruleset
    const rulesetId = Date.now().toString() + Math.random().toString().slice(2);

    // Final object that contains the entire ruleset definition
    const finalRuleset = {
      id: rulesetId,
      name: rulesetName.trim(),
      groups,
      counters,
    };

    // Load existing rulesets from localStorage
    const existingRulesets = JSON.parse(localStorage.getItem("rulesets") || "[]");

    // Add the new ruleset to the list
    existingRulesets.push(finalRuleset);

    // Save updated list back to localStorage
    localStorage.setItem("rulesets", JSON.stringify(existingRulesets));

    // Navigate to the DM dashboard, passing rulesetId along with it
    navigate("/dm/game-dashboard", { state: { rulesetId } });
  };

  // Page layout begins
  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      
      {/* Navigation buttons */}
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

      {/* Page title */}
      <h2 className="text-lg font-bold text-center mb-6">Create Custom Ruleset</h2>

      {/* Input for ruleset name */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Ruleset Name</label>
        <input
          value={rulesetName}
          onChange={(e) => setRulesetName(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      {/* Group Box Builder Section */}
      <div className="mb-6 border-t pt-4 mt-4">
        <h3 className="text-md font-semibold mb-2">Group Boxes</h3>

        {/* Loop through each group and render it */}
        <div className="space-y-4">
          {groups.map((group, gIdx) => (
            <div key={group.id} className="border p-2 rounded">
              
              {/* Group name input */}
              <input
                type="text"
                className="w-full border-b mb-2 p-1 text-sm"
                placeholder="Group Label (e.g. Abilities)"
                value={group.label}
                onChange={(e) => {
                  const updated = [...groups];
                  updated[gIdx] = {
                    ...group,
                    label: e.target.value,
                  };
                  setGroups(updated); // update group label
                }}
              />

              {/* Loop through and render fields for this group */}
              <div className="space-y-1">
                {group.fields.map((fld, fIdx) => (
                  <input
                    key={fIdx}
                    type="text"
                    className="w-full border p-1 text-sm"
                    placeholder="Field Name (e.g. Strength)"
                    value={fld}
                    onChange={(e) => {
                      const updated = [...groups];
                      updated[gIdx].fields[fIdx] = e.target.value;
                      setGroups(updated); // update individual field
                    }}
                  />
                ))}
              </div>

              {/* Add a new field to this group */}
              <button
                onClick={() => {
                  const updated = [...groups];
                  updated[gIdx].fields.push("");
                  setGroups(updated);
                }}
                className="mt-2 text-xs text-blue-600"
              >
                ➕ Add Field
              </button>
            </div>
          ))}
        </div>

        {/* Button to add a new group box */}
        <button
          onClick={() => {
            const newGrp = {
              id: Date.now().toString(),
              label: "New Group",
              fields: [],
            };
            setGroups([...groups, newGrp]);
          }}
          className="mt-3 text-xs text-blue-600"
        >
          ➕ Add Group Box
        </button>
      </div>

      {/* Counter Section */}
      <div className="mb-6 border-t pt-4 mt-4">
        <h3 className="text-md font-semibold mb-2">Point Counters</h3>

        {/* Loop through each counter */}
        <div className="space-y-4">
          {counters.map((ctr, cIdx) => (
            <div key={ctr.id} className="border p-2 rounded flex gap-2 items-center">
              
              {/* Counter name */}
              <input
                type="text"
                className="border p-1 text-sm w-1/2"
                placeholder="Counter Name (e.g. Hit Points)"
                value={ctr.label}
                onChange={(e) => {
                  const updated = [...counters];
                  updated[cIdx] = { ...ctr, label: e.target.value };
                  setCounters(updated);
                }}
              />

              {/* Counter base value */}
              <input
                type="number"
                className="border p-1 text-sm w-20"
                placeholder="Base"
                value={ctr.baseValue}
                onChange={(e) => {
                  const updated = [...counters];
                  updated[cIdx] = {
                    ...ctr,
                    baseValue: parseInt(e.target.value) || 0,
                  };
                  setCounters(updated);
                }}
              />
            </div>
          ))}
        </div>

        {/* Add new counter */}
        <button
          onClick={() => {
            const newC = {
              id: (Date.now() + Math.random()).toString(),
              label: "New Counter",
              baseValue: 0,
            };
            setCounters([...counters, newC]);
          }}
          className="mt-3 text-xs text-blue-600"
        >
          ➕ Add Counter
        </button>
      </div>

      {/* Submit ruleset button */}
      <button
        onClick={handleSubmit}
        className="w-full bg-purple-100 py-2 rounded"
      >
        ✅ Create Ruleset
      </button>
    </div>
  );
}

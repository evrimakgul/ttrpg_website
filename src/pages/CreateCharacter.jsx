import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function CreateCharacter() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    archetype: "",
    background: "",
    age: "",
    race: "",
    gender: "",
    affiliation: "",
    notes: "",
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.name || !form.archetype) {
      alert("Please fill in at least name and archetype.");
      return;
    }

    // Later: send to backend or store in global state
    navigate("/sheet", { state: { character: form } });
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Navigation */}
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

      {/* Header */}
      <h2 className="text-xl font-bold text-center mb-6">Create Character</h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Input label="Character Name" value={form.name} onChange={(v) => handleChange("name", v)} />
        <Input label="Archetype" value={form.archetype} onChange={(v) => handleChange("archetype", v)} />
        <Input label="Background" value={form.background} onChange={(v) => handleChange("background", v)} />
        <Input label="Age" value={form.age} onChange={(v) => handleChange("age", v)} />
        <Input label="Species / Race" value={form.race} onChange={(v) => handleChange("race", v)} />
        <Input label="Gender" value={form.gender} onChange={(v) => handleChange("gender", v)} />
        <Input label="Affiliation" value={form.affiliation} onChange={(v) => handleChange("affiliation", v)} />
        <Input label="Notes" value={form.notes} onChange={(v) => handleChange("notes", v)} />
      </div>

      <button
        onClick={handleSubmit}
        className="w-full bg-blue-100 py-2 rounded"
      >
        ✅ Create Character
      </button>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium">{label}</label>
      <input
        className="border p-2 rounded"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

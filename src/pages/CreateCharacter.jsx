import { useNavigate } from "react-router-dom";

export default function CreateCharacter() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow text-sm">
      {/* Top Navigation */}
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

      {/* Form fields (initial placeholders) */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Input label="Character Name" />
        <Input label="Archetype" />
        <Input label="Background" />
        <Input label="Age" />
        <Input label="Species / Race" />
        <Input label="Gender" />
        <Input label="Affiliation" />
        <Input label="Notes" />
      </div>

      <button
        onClick={() => navigate("/sheet")}
        className="w-full bg-blue-100 py-2 rounded"
      >
        ✅ Create Character
      </button>
    </div>
  );
}

// helper input component
function Input({ label }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium">{label}</label>
      <input className="border p-2 rounded" />
    </div>
  );
}

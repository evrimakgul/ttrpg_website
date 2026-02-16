import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

const DEFAULT_FORM = {
  name: "",
  archetype: "",
  background: "",
  age: "",
  race: "",
  gender: "",
  affiliation: "",
  notes: "",
};

export default function CreateCharacter() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadExistingCharacter = async () => {
      if (!gameId) {
        setError("Missing game id.");
        setLoading(false);
        return;
      }

      try {
        const data = await apiFetch(`/api/games/${gameId}/characters/me`);
        if (data.character) {
          setForm({
            name: data.character.name || "",
            archetype: data.character.archetype || "",
            background: data.character.background || "",
            age: data.character.age || "",
            race: data.character.race || "",
            gender: data.character.gender || "",
            affiliation: data.character.affiliation || "",
            notes: data.character.notes || "",
          });
        }
      } catch (err) {
        setError(err.message || "Could not load character.");
      } finally {
        setLoading(false);
      }
    };

    loadExistingCharacter();
  }, [gameId]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!gameId) {
      setError("Missing game id.");
      return;
    }

    if (!form.name.trim()) {
      setError("Character name is required.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await apiFetch(`/api/games/${gameId}/characters`, {
        method: "POST",
        body: {
          ...form,
          sheet_json: {},
        },
      });

      navigate(`/sheet/${gameId}`);
    } catch (err) {
      setError(err.message || "Could not save character.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded-2xl bg-white p-6 text-center text-sm shadow">
        Loading character form...
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

      <h2 className="mb-6 text-center text-xl font-bold">Create Character</h2>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Character Name"
          value={form.name}
          onChange={(v) => handleChange("name", v)}
        />
        <Input
          label="Archetype"
          value={form.archetype}
          onChange={(v) => handleChange("archetype", v)}
        />
        <Input
          label="Background"
          value={form.background}
          onChange={(v) => handleChange("background", v)}
        />
        <Input label="Age" value={form.age} onChange={(v) => handleChange("age", v)} />
        <Input
          label="Species / Race"
          value={form.race}
          onChange={(v) => handleChange("race", v)}
        />
        <Input
          label="Gender"
          value={form.gender}
          onChange={(v) => handleChange("gender", v)}
        />
        <Input
          label="Affiliation"
          value={form.affiliation}
          onChange={(v) => handleChange("affiliation", v)}
        />
        <Input
          label="Notes"
          value={form.notes}
          onChange={(v) => handleChange("notes", v)}
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubmit}
        className="w-full rounded bg-blue-100 py-2 disabled:opacity-60"
        disabled={saving}
        type="button"
      >
        {saving ? "Saving..." : "Save Character"}
      </button>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium">{label}</label>
      <input
        className="rounded border p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

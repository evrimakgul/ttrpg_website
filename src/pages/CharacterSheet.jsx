import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DiceRoller from "../components/DiceRoller";
import EditableField from "../components/EditableField";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const attributes = {
  Physical: ["Strength", "Dexterity", "Stamina"],
  Mental: ["Intelligence", "Perception", "Wits"],
  Social: ["Appearance", "Charisma", "Composure"],
};

const skills = {
  Physical: [
    "Athletics",
    "Brawl",
    "Craft",
    "Drive",
    "Firearms",
    "Larceny",
    "Melee",
    "Stealth",
    "Survival",
  ],
  Social: [
    "Animal Ken",
    "Etiquette",
    "Insight",
    "Intimidation",
    "Leadership",
    "Performance",
    "Persuasion",
    "Streetwise",
    "Subterfuge",
  ],
  Mental: [
    "Academics",
    "Awareness",
    "Finance",
    "Investigation",
    "Medicine",
    "Occult",
    "Politics",
    "Science",
    "Technology",
  ],
};

function buildDefaultValues() {
  const fields = {};
  [...Object.values(attributes), ...Object.values(skills)]
    .flat()
    .forEach((key) => {
      fields[key] = 1;
    });
  return fields;
}

const EMPTY_CHARACTER = {
  name: "",
  archetype: "",
  background: "",
  age: "",
  race: "",
  gender: "",
  affiliation: "",
  notes: "",
};

export default function CharacterSheet() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const { user } = useAuth();
  const [values, setValues] = useState(buildDefaultValues);
  const [character, setCharacter] = useState(EMPTY_CHARACTER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadCharacter = async () => {
      if (!gameId) {
        setError("Missing game id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const data = await apiFetch(`/api/games/${gameId}/characters/me`);
        const savedCharacter = data.character;

        if (savedCharacter) {
          setCharacter({
            name: savedCharacter.name || "",
            archetype: savedCharacter.archetype || "",
            background: savedCharacter.background || "",
            age: savedCharacter.age || "",
            race: savedCharacter.race || "",
            gender: savedCharacter.gender || "",
            affiliation: savedCharacter.affiliation || "",
            notes: savedCharacter.notes || "",
          });

          if (savedCharacter.sheet_json?.values) {
            setValues((prev) => ({
              ...prev,
              ...savedCharacter.sheet_json.values,
            }));
          }
        }
      } catch (err) {
        setError(err.message || "Could not load character sheet.");
      } finally {
        setLoading(false);
      }
    };

    loadCharacter();
  }, [gameId]);

  const update = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const updateCharacterField = (field, value) => {
    setCharacter((prev) => ({ ...prev, [field]: value }));
  };

  const strength = values.Strength || 0;
  const dexterity = values.Dexterity || 0;
  const stamina = values.Stamina || 0;
  const perception = values.Perception || 0;
  const charisma = values.Charisma || 0;

  const actionPoint = strength + dexterity + stamina;
  const move = Math.round(
    Math.log(Math.max(dexterity, 1)) * Math.log(Math.max(strength, 1)) * 20
  );
  const initiative = dexterity + perception + charisma;

  const saveSheet = async () => {
    if (!gameId) {
      setError("Missing game id.");
      return;
    }

    if (!character.name.trim()) {
      setError("Character name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiFetch(`/api/games/${gameId}/characters`, {
        method: "POST",
        body: {
          ...character,
          sheet_json: { values },
        },
      });

      setMessage("Character sheet saved.");
    } catch (err) {
      setError(err.message || "Could not save character sheet.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-6xl rounded-2xl bg-white p-6 text-center text-sm shadow-md">
        Loading character sheet...
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-6xl rounded-2xl bg-white p-6 text-sm shadow-md">
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

      <h2 className="mb-4 text-center text-xl font-bold">Character Sheet</h2>

      <div className="mb-6 rounded-xl border bg-gray-50 p-4 text-sm">
        <h3 className="mb-3 text-md font-semibold">Character Info</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SimpleInput
            label="Name"
            value={character.name}
            onChange={(value) => updateCharacterField("name", value)}
          />
          <SimpleInput
            label="Archetype"
            value={character.archetype}
            onChange={(value) => updateCharacterField("archetype", value)}
          />
          <SimpleInput
            label="Background"
            value={character.background}
            onChange={(value) => updateCharacterField("background", value)}
          />
          <SimpleInput
            label="Age"
            value={character.age}
            onChange={(value) => updateCharacterField("age", value)}
          />
          <SimpleInput
            label="Race"
            value={character.race}
            onChange={(value) => updateCharacterField("race", value)}
          />
          <SimpleInput
            label="Gender"
            value={character.gender}
            onChange={(value) => updateCharacterField("gender", value)}
          />
          <SimpleInput
            label="Affiliation"
            value={character.affiliation}
            onChange={(value) => updateCharacterField("affiliation", value)}
          />
          <SimpleInput
            label="Notes"
            value={character.notes}
            onChange={(value) => updateCharacterField("notes", value)}
          />
        </div>
      </div>

      <div className="mb-6 rounded-xl border p-4">
        <h3 className="mb-4 text-center text-md font-semibold">Attributes</h3>
        <div className="grid grid-cols-1 gap-x-20 gap-y-2 md:grid-cols-3">
          {Object.entries(attributes).map(([group, list]) => (
            <div key={group}>
              <h4 className="mb-2 text-center italic">{group}</h4>
              {list.map((attr) => (
                <div key={attr} className="mb-1 grid grid-cols-2">
                  <span className="text-left">{attr}</span>
                  <div className="text-right">
                    <EditableField
                      value={values[attr]}
                      onChange={(value) => update(attr, value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-xl border p-4">
        <h3 className="mb-4 text-center text-md font-semibold">Actions</h3>
        <div className="grid grid-cols-1 gap-x-20 gap-y-2 md:grid-cols-2">
          <div>
            <Field label="Action Point" value={actionPoint} />
            <Field label="Combat" value={0} />
            <Field label="Initiative" value={initiative} />
          </div>
          <div>
            <Field label="Move" value={move} />
            <Field label="Social" value={0} />
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border p-4">
        <h3 className="mb-4 text-center text-md font-semibold">Skills</h3>
        <div className="grid grid-cols-1 gap-x-20 gap-y-2 md:grid-cols-3">
          {Object.entries(skills).map(([group, list]) => (
            <div key={group}>
              <h4 className="mb-2 text-center italic">{group}</h4>
              {list.map((skill) => (
                <div key={skill} className="mb-1 grid grid-cols-2">
                  <span className="text-left">{skill}</span>
                  <div className="text-right">
                    <EditableField
                      value={values[skill]}
                      onChange={(value) => update(skill, value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-2 text-sm text-green-700">{message}</p>}

      <button
        onClick={saveSheet}
        className="mb-4 w-full rounded bg-blue-100 py-2 disabled:opacity-60"
        disabled={saving}
        type="button"
      >
        {saving ? "Saving..." : "Save Character Sheet"}
      </button>

      <DiceRoller
        gameId={gameId}
        name={character.name || user?.email || "Player"}
        isDM={false}
      />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="mb-1 grid grid-cols-2">
      <span className="text-left">{label}</span>
      <input
        type="number"
        value={value}
        readOnly
        className="w-16 rounded border border-gray-300 bg-gray-100 p-1 text-right text-sm"
      />
    </div>
  );
}

function SimpleInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border p-2 text-sm"
      />
    </div>
  );
}

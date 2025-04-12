import { useState } from "react";
import DiceRoller from "../components/DiceRoller";
import EditableField from "../components/EditableField";
import { useLocation } from "react-router-dom";

const attributes = {
  Physical: ["Strength", "Dexterity", "Stamina"],
  Mental: ["Intelligence", "Perception", "Wits"],
  Social: ["Appearance", "Charisma", "Composure"],
};

const skills = {
  Physical: ["Athletics", "Brawl", "Craft", "Drive", "Firearms", "Larceny", "Melee", "Stealth", "Survival"],
  Social: ["Animal Ken", "Etiquette", "Insight", "Intimidation", "Leadership", "Performance", "Persuasion", "Streetwise", "Subterfuge"],
  Mental: ["Academics", "Awareness", "Finance", "Investigation", "Medicine", "Occult", "Politics", "Science", "Technology"],
};

export default function CharacterSheet() {
  const [values, setValues] = useState(() => {
    const fields = {};
    [...Object.values(attributes), ...Object.values(skills)].flat().forEach((key) => {
      fields[key] = 1;
    });
    return fields;
  });

  const location = useLocation();
  const character = location.state?.character;
  const update = (field, val) => {
    setValues((prev) => ({ ...prev, [field]: val }));
  };

  const get = (name) => values[name] || 0;

  const actionPoint = get("Strength") + get("Dexterity") + get("Stamina");
  const move = Math.round(Math.log(get("Dexterity")) * Math.log(get("Strength")) * 20);
  const initiative = get("Dexterity") + get("Perception") + get("Charisma");

  return (
    <div className="max-w-6xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow-md text-sm">
      <div className="flex justify-start gap-2 mb-6">
        <button
          onClick={() => window.location.href = "/"}
          className="px-4 py-1 bg-gray-200 rounded"
        >
          🏠 Home
        </button>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-1 bg-gray-200 rounded"
        >
          ⬅ Back
        </button>
      </div>
      <h2 className="text-xl font-bold mb-4 text-center">Character Sheet</h2>
      {character && (
        <div className="border p-4 rounded-xl mb-6 text-sm bg-gray-50">
          <h3 className="text-md font-semibold mb-2">Character Info</h3>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
            <li><strong>Name:</strong> {character.name}</li>
            <li><strong>Archetype:</strong> {character.archetype}</li>
            <li><strong>Background:</strong> {character.background}</li>
            <li><strong>Age:</strong> {character.age}</li>
            <li><strong>Race:</strong> {character.race}</li>
            <li><strong>Gender:</strong> {character.gender}</li>
            <li><strong>Affiliation:</strong> {character.affiliation}</li>
            <li><strong>Notes:</strong> {character.notes}</li>
          </ul>
        </div>
      )}

      {/* HEADER */}
      <div className="border p-4 rounded-xl mb-6">
        <div className="grid grid-cols-3 gap-4">
          <LabeledInput label="Name" />
          <LabeledInput label="Player" />
          <LabeledInput label="Chronicle" />
          <LabeledInput label="Clan" />
          <LabeledInput label="Predator type" />
          <LabeledInput label="Ambition" />
          <LabeledInput label="Sect" />
          <LabeledInput label="Rank/Title" />
          <LabeledInput label="Desire" />
        </div>
      </div>

      {/* ATTRIBUTES */}
      <div className="border p-4 rounded-xl mb-6">
        <h3 className="text-md font-semibold mb-4 text-center">ATTRIBUTES</h3>
        <div className="grid grid-cols-3 gap-x-20 gap-y-2">
          {Object.entries(attributes).map(([group, list]) => (
            <div key={group}>
              <h4 className="text-center italic mb-2">{group}</h4>
              {list.map((attr) => (
                <div key={attr} className="grid grid-cols-2 mb-1">
                  <span className="text-left">{attr}</span>
                  <div className="text-right">
                    <EditableField value={values[attr]} onChange={(v) => update(attr, v)} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="border p-4 rounded-xl mb-6">
        <h3 className="text-md font-semibold mb-4 text-center">ACTIONS</h3>
        <div className="grid grid-cols-2 gap-x-20 gap-y-2">
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

      {/* SKILLS */}
      <div className="border p-4 rounded-xl mb-6">
        <h3 className="text-md font-semibold mb-4 text-center">SKILLS</h3>
        <div className="grid grid-cols-3 gap-x-20 gap-y-2">
          {Object.entries(skills).map(([group, list]) => (
            <div key={group}>
              {list.map((skill) => (
                <div key={skill} className="grid grid-cols-2 mb-1">
                  <span className="text-left">{skill}</span>
                  <div className="text-right">
                    <EditableField value={values[skill]} onChange={(v) => update(skill, v)} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <DiceRoller name="Player1" isDM={false} />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="grid grid-cols-2 mb-1">
      <span className="text-left">{label}</span>
      <input
        type="number"
        value={value}
        readOnly
        className="w-16 text-right p-1 text-sm border border-gray-300 rounded bg-gray-100"
      />
    </div>
  );
}

function LabeledInput({ label }) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium">{label}</label>
      <input type="text" className="p-1 border rounded text-sm" />
    </div>
  );
}

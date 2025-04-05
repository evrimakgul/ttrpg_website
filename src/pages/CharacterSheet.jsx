import { useState } from "react";
import DiceRoller from "../components/DiceRoller";
import EditableField from "../components/EditableField";

const attributes = {
  Physical: ["Strength", "Dexterity", "Stamina"],
  Mental: ["Intelligence", "Perception", "Wits"],
  Social: ["Appearance", "Manipulation", "Charisma"],
};

const actions = {
  Physical: ["Action Point",]
};
const skills = {
  Physical: ["Melee", "Firearms", "Athletics", "Craft", "Stealth", "Survival"],
  Social: ["Animal Ken", "Etiquette", "Insight", "Intimidation", "Leadership", "Performance", "Persuasion", "Streetwise", "Subterfuge"],
  Mental: ["Academics", "Awareness", "Finance", "Investigation", "Medicine", "Occult", "Politics", "Science", "Technology"],
};

export default function CharacterSheet() {
  const [values, setValues] = useState({});

  const update = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-5xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow-md text-sm">
      <h2 className="text-xl font-bold mb-4 text-center">Character Sheet</h2>

      {/* ATTRIBUTES */}
      <div className="border p-4 rounded-xl mb-6">
        <h3 className="text-md font-semibold mb-4 text-center">ATTRIBUTES</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(attributes).map(([group, list]) => (
            <div key={group}>
              <h4 className="text-center italic mb-2">{group}</h4>
              {list.map((attr) => (
                <div key={attr} className="flex justify-between mb-1">
                  <span>{attr}</span>
                  <EditableField value={values[attr] || 0} onChange={(v) => update(attr, v)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="border p-4 rounded-xl mb-6">
        <h3 className="text-md font-semibold mb-4 text-center">ACTIONS</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(actions).map(([group, list]) => (
            <div key={group}>
              {list.map((action) => (
                <div key={action} className="flex justify-between mb-1">
                  <span>{action}</span>
                  <EditableField value={values[action] || 0} onChange={(v) => update(action, v)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* SKILLS */}
      <div className="border p-4 rounded-xl mb-6">
        <h3 className="text-md font-semibold mb-4 text-center">SKILLS</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(skills).map(([group, list]) => (
            <div key={group}>
              {list.map((skill) => (
                <div key={skill} className="flex justify-between mb-1">
                  <span>{skill}</span>
                  <EditableField value={values[skill] || 0} onChange={(v) => update(skill, v)} />
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

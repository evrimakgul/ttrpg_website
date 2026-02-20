import { useMemo, useState } from "react";
import { makeId, normalizeRulesetSchema } from "../lib/rulesEngine";

const SPELL_GROUP_TIERS = ["t1", "t2", "t3", "t4", "t5", "custom"];
const SPELL_EFFECT_OPERATIONS = ["set", "add", "multiply"];
const SPELL_TYPE_OPTIONS = [
  "attack",
  "aura",
  "buff",
  "debuff",
  "healing",
  "summon",
  "utility",
  "custom",
];
const RANGE_UNITS = ["", "m", "km", "ft", "mile", "self", "touch", "custom"];
const DURATION_UNITS = ["", "round", "turn", "minute", "hour", "day", "custom"];
const CASTING_TIME_UNITS = [
  "",
  "action",
  "bonus_action",
  "reaction",
  "round",
  "minute",
  "hour",
  "custom",
];

function createEmptyGroupForm() {
  return {
    name: "",
    tier: "t1",
    tierCustomLabel: "",
    linkedStatFieldId: "",
    opposingGroupIds: [],
    notes: "",
  };
}

function createEmptyLevelForm() {
  return {
    definition: "",
    manaCost: "",
    rangeAmount: "",
    rangeUnit: "",
    rangeText: "",
    durationAmount: "",
    durationUnit: "",
    durationText: "",
    castingTimeAmount: "",
    castingTimeUnit: "",
    castingTimeText: "",
    effects: [],
    notes: "",
  };
}

function createEmptySpellForm() {
  return {
    name: "",
    groupId: "",
    typeOption: "utility",
    typeCustom: "",
    description: "",
    misc: "",
    levels: [createEmptyLevelForm()],
  };
}

function createEmptyEffectForm() {
  return {
    id: "",
    targetFieldId: "",
    operation: "add",
    value: "0",
    note: "",
  };
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSpellToForm(spell) {
  const typeOption = SPELL_TYPE_OPTIONS.includes(spell.type) ? spell.type : "custom";
  const typeCustom = typeOption === "custom" ? spell.type : "";
  return {
    name: spell.name || "",
    groupId: spell.groupId || "",
    typeOption,
    typeCustom,
    description: spell.description || "",
    misc: spell.misc || "",
    levels:
      Array.isArray(spell.levels) && spell.levels.length > 0
        ? spell.levels.map((level) => ({
            definition: level.definition || "",
            manaCost:
              level.manaCost === null || level.manaCost === undefined
                ? ""
                : String(level.manaCost),
            rangeAmount:
              level.range?.amount === null || level.range?.amount === undefined
                ? ""
                : String(level.range.amount),
            rangeUnit: level.range?.unit || "",
            rangeText: level.range?.text || "",
            durationAmount:
              level.duration?.amount === null || level.duration?.amount === undefined
                ? ""
                : String(level.duration.amount),
            durationUnit: level.duration?.unit || "",
            durationText: level.duration?.text || "",
            castingTimeAmount:
              level.castingTime?.amount === null ||
              level.castingTime?.amount === undefined
                ? ""
                : String(level.castingTime.amount),
            castingTimeUnit: level.castingTime?.unit || "",
            castingTimeText: level.castingTime?.text || "",
            effects: Array.isArray(level.effects)
              ? level.effects.map((effect) => ({
                  id: effect.id || "",
                  targetFieldId: effect.targetFieldId || "",
                  operation: effect.operation || "add",
                  value:
                    effect.value === null || effect.value === undefined
                      ? "0"
                      : String(effect.value),
                  note: effect.note || "",
                }))
              : [],
            notes: level.notes || "",
          }))
        : [createEmptyLevelForm()],
  };
}

export default function SpellBuilderModal({
  open,
  onClose,
  schema,
  setSchema,
  fieldBoxes,
  setError,
}) {
  const [activeTab, setActiveTab] = useState("groups");
  const [editingGroupId, setEditingGroupId] = useState("");
  const [groupForm, setGroupForm] = useState(createEmptyGroupForm());
  const [editingSpellId, setEditingSpellId] = useState("");
  const [spellForm, setSpellForm] = useState(createEmptySpellForm());

  const normalizedSchema = useMemo(() => normalizeRulesetSchema(schema), [schema]);
  const spellGroups = normalizedSchema.spellGroups || [];
  const spells = normalizedSchema.spells || [];
  const numberFields = useMemo(
    () => (fieldBoxes || []).filter((box) => box.fieldType === "number"),
    [fieldBoxes]
  );
  const numberFieldIds = useMemo(
    () => new Set(numberFields.map((field) => field.id)),
    [numberFields]
  );

  const commitSchema = (updater) => {
    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      updater(next);
      return next;
    });
  };

  const resetGroupForm = () => {
    setEditingGroupId("");
    setGroupForm(createEmptyGroupForm());
  };

  const resetSpellForm = () => {
    setEditingSpellId("");
    setSpellForm(createEmptySpellForm());
  };

  const submitGroup = () => {
    const name = groupForm.name.trim();
    if (!name) {
      setError("Spell group name is required.");
      return;
    }

    const duplicate = spellGroups.find(
      (group) =>
        group.id !== editingGroupId &&
        String(group.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setError(`Spell group name '${name}' already exists.`);
      return;
    }

    if (groupForm.tier === "custom" && !groupForm.tierCustomLabel.trim()) {
      setError("Custom tier label is required.");
      return;
    }

    if (groupForm.linkedStatFieldId && !numberFieldIds.has(groupForm.linkedStatFieldId)) {
      setError("Linked stat must reference an existing number field.");
      return;
    }

    const targetId = editingGroupId || makeId("spell_group");
    const cleanedOpposing = [...new Set(groupForm.opposingGroupIds.filter(Boolean))];
    if (cleanedOpposing.includes(targetId)) {
      setError("A spell group cannot oppose itself.");
      return;
    }

    const validOpposing = cleanedOpposing.every((opposingId) =>
      spellGroups.some((group) => group.id === opposingId)
    );
    if (!validOpposing) {
      setError("One or more opposing spell groups are invalid.");
      return;
    }

    const nextGroup = {
      id: targetId,
      name,
      tier: groupForm.tier,
      tierCustomLabel:
        groupForm.tier === "custom" ? groupForm.tierCustomLabel.trim() : null,
      linkedStatFieldId: groupForm.linkedStatFieldId || null,
      opposingGroupIds: cleanedOpposing,
      notes: groupForm.notes.trim(),
    };

    commitSchema((next) => {
      if (editingGroupId) {
        next.spellGroups = next.spellGroups.map((group) =>
          group.id === editingGroupId ? nextGroup : group
        );
      } else {
        next.spellGroups.push(nextGroup);
      }
    });

    setError("");
    resetGroupForm();
  };

  const startEditGroup = (group) => {
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name || "",
      tier: group.tier || "t1",
      tierCustomLabel: group.tierCustomLabel || "",
      linkedStatFieldId: group.linkedStatFieldId || "",
      opposingGroupIds: Array.isArray(group.opposingGroupIds)
        ? [...group.opposingGroupIds]
        : [],
      notes: group.notes || "",
    });
    setActiveTab("groups");
  };

  const deleteGroup = (groupId) => {
    const linkedSpell = spells.find((spell) => spell.groupId === groupId);
    if (linkedSpell) {
      setError(
        `Cannot delete this group. Spell '${linkedSpell.name}' is assigned to it.`
      );
      return;
    }

    commitSchema((next) => {
      next.spellGroups = next.spellGroups
        .filter((group) => group.id !== groupId)
        .map((group) => ({
          ...group,
          opposingGroupIds: (group.opposingGroupIds || []).filter((id) => id !== groupId),
        }));
    });

    if (editingGroupId === groupId) {
      resetGroupForm();
    }
    setError("");
  };

  const updateSpellLevel = (levelIndex, updates) => {
    setSpellForm((prev) => {
      const levels = prev.levels.map((level, index) =>
        index === levelIndex ? { ...level, ...updates } : level
      );
      return { ...prev, levels };
    });
  };

  const updateSpellEffect = (levelIndex, effectIndex, updates) => {
    setSpellForm((prev) => {
      const levels = prev.levels.map((level, index) => {
        if (index !== levelIndex) return level;
        const effects = level.effects.map((effect, fxIndex) =>
          fxIndex === effectIndex ? { ...effect, ...updates } : effect
        );
        return { ...level, effects };
      });
      return { ...prev, levels };
    });
  };

  const addSpellLevel = () => {
    setSpellForm((prev) => ({
      ...prev,
      levels: [...prev.levels, createEmptyLevelForm()],
    }));
  };

  const removeSpellLevel = (levelIndex) => {
    setSpellForm((prev) => {
      if (prev.levels.length <= 1) return prev;
      return {
        ...prev,
        levels: prev.levels.filter((_, index) => index !== levelIndex),
      };
    });
  };

  const addSpellEffect = (levelIndex) => {
    setSpellForm((prev) => {
      const levels = prev.levels.map((level, index) =>
        index === levelIndex
          ? { ...level, effects: [...level.effects, createEmptyEffectForm()] }
          : level
      );
      return { ...prev, levels };
    });
  };

  const removeSpellEffect = (levelIndex, effectIndex) => {
    setSpellForm((prev) => {
      const levels = prev.levels.map((level, index) => {
        if (index !== levelIndex) return level;
        return {
          ...level,
          effects: level.effects.filter((_, fxIndex) => fxIndex !== effectIndex),
        };
      });
      return { ...prev, levels };
    });
  };

  const submitSpell = () => {
    const name = spellForm.name.trim();
    if (!name) {
      setError("Spell name is required.");
      return;
    }

    const duplicate = spells.find(
      (spell) =>
        spell.id !== editingSpellId &&
        String(spell.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setError(`Spell name '${name}' already exists.`);
      return;
    }

    if (spellForm.groupId && !spellGroups.some((group) => group.id === spellForm.groupId)) {
      setError("Selected spell group does not exist.");
      return;
    }

    const type =
      spellForm.typeOption === "custom"
        ? spellForm.typeCustom.trim()
        : spellForm.typeOption;
    if (!type) {
      setError("Spell type is required.");
      return;
    }

    if (!Array.isArray(spellForm.levels) || spellForm.levels.length === 0) {
      setError("Spell must include at least one level.");
      return;
    }

    const levels = spellForm.levels.map((level, levelIndex) => {
      const effects = level.effects.map((effect, effectIndex) => {
        if (!effect.targetFieldId) {
          throw new Error(
            `Spell level ${levelIndex + 1}, effect ${effectIndex + 1}: target field is required.`
          );
        }
        if (!numberFieldIds.has(effect.targetFieldId)) {
          throw new Error(
            `Spell level ${levelIndex + 1}, effect ${effectIndex + 1}: target field must be a number field.`
          );
        }
        if (!SPELL_EFFECT_OPERATIONS.includes(effect.operation)) {
          throw new Error(
            `Spell level ${levelIndex + 1}, effect ${effectIndex + 1}: operation is invalid.`
          );
        }

        const numericValue = Number(effect.value);
        if (!Number.isFinite(numericValue)) {
          throw new Error(
            `Spell level ${levelIndex + 1}, effect ${effectIndex + 1}: value must be numeric.`
          );
        }

        return {
          id: effect.id || makeId("spell_effect"),
          targetFieldId: effect.targetFieldId,
          operation: effect.operation,
          value: numericValue,
          note: effect.note.trim(),
        };
      });

      return {
        level: levelIndex + 1,
        definition: level.definition.trim(),
        manaCost: toNumberOrNull(level.manaCost),
        range: {
          amount: toNumberOrNull(level.rangeAmount),
          unit: level.rangeUnit,
          text: level.rangeText.trim(),
        },
        duration: {
          amount: toNumberOrNull(level.durationAmount),
          unit: level.durationUnit,
          text: level.durationText.trim(),
        },
        castingTime: {
          amount: toNumberOrNull(level.castingTimeAmount),
          unit: level.castingTimeUnit,
          text: level.castingTimeText.trim(),
        },
        effects,
        notes: level.notes.trim(),
      };
    });

    const nextSpell = {
      id: editingSpellId || makeId("spell"),
      name,
      groupId: spellForm.groupId || null,
      type,
      description: spellForm.description.trim(),
      misc: spellForm.misc.trim(),
      levels,
    };

    commitSchema((next) => {
      if (editingSpellId) {
        next.spells = next.spells.map((spell) =>
          spell.id === editingSpellId ? nextSpell : spell
        );
      } else {
        next.spells.push(nextSpell);
      }
    });

    setError("");
    resetSpellForm();
  };

  const startEditSpell = (spell) => {
    setEditingSpellId(spell.id);
    setSpellForm(mapSpellToForm(spell));
    setActiveTab("spells");
  };

  const deleteSpell = (spellId) => {
    commitSchema((next) => {
      next.spells = next.spells.filter((spell) => spell.id !== spellId);
    });
    if (editingSpellId === spellId) {
      resetSpellForm();
    }
    setError("");
  };

  const submitSpellWithGuard = () => {
    try {
      submitSpell();
    } catch (error) {
      setError(error.message || "Invalid spell.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl bg-white p-4 text-xs shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Spell Builder</h3>
          <button
            type="button"
            className="rounded bg-gray-200 px-3 py-1"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`rounded px-3 py-1 ${
              activeTab === "groups" ? "bg-blue-100" : "bg-gray-100"
            }`}
            onClick={() => setActiveTab("groups")}
          >
            Create/Edit Spell Group
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 ${
              activeTab === "spells" ? "bg-blue-100" : "bg-gray-100"
            }`}
            onClick={() => setActiveTab("spells")}
          >
            Create/Edit Spell
          </button>
        </div>

        {activeTab === "groups" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="space-y-2 rounded border p-3">
              <h4 className="font-medium">
                {editingGroupId ? "Edit Group" : "Create Group"}
              </h4>
              <input
                className="w-full rounded border p-2"
                placeholder="Group name"
                value={groupForm.name}
                onChange={(event) =>
                  setGroupForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <select
                className="w-full rounded border p-2"
                value={groupForm.tier}
                onChange={(event) =>
                  setGroupForm((prev) => ({ ...prev, tier: event.target.value }))
                }
              >
                {SPELL_GROUP_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier.toUpperCase()}
                  </option>
                ))}
              </select>
              {groupForm.tier === "custom" && (
                <input
                  className="w-full rounded border p-2"
                  placeholder="Custom tier label"
                  value={groupForm.tierCustomLabel}
                  onChange={(event) =>
                    setGroupForm((prev) => ({
                      ...prev,
                      tierCustomLabel: event.target.value,
                    }))
                  }
                />
              )}
              <select
                className="w-full rounded border p-2"
                value={groupForm.linkedStatFieldId}
                onChange={(event) =>
                  setGroupForm((prev) => ({
                    ...prev,
                    linkedStatFieldId: event.target.value,
                  }))
                }
              >
                <option value="">No linked stat</option>
                {numberFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </select>
              <div className="rounded border p-2">
                <p className="mb-1 text-[11px] text-gray-600">Opposing groups</p>
                <div className="max-h-28 overflow-auto">
                  {spellGroups.map((group) => (
                    <label key={group.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={groupForm.opposingGroupIds.includes(group.id)}
                        onChange={(event) =>
                          setGroupForm((prev) => {
                            const current = new Set(prev.opposingGroupIds);
                            if (event.target.checked) current.add(group.id);
                            else current.delete(group.id);
                            return { ...prev, opposingGroupIds: [...current] };
                          })
                        }
                      />
                      {group.name}
                    </label>
                  ))}
                </div>
              </div>
              <textarea
                className="w-full rounded border p-2"
                rows={3}
                placeholder="Notes"
                value={groupForm.notes}
                onChange={(event) =>
                  setGroupForm((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
              <div className="flex gap-2">
                <button type="button" className="rounded bg-blue-100 px-3 py-2" onClick={submitGroup}>
                  {editingGroupId ? "Update Group" : "Add Group"}
                </button>
                <button type="button" className="rounded bg-gray-100 px-3 py-2" onClick={resetGroupForm}>
                  Reset
                </button>
              </div>
            </section>

            <section className="space-y-2 rounded border p-3">
              <h4 className="font-medium">Existing Groups</h4>
              {spellGroups.length === 0 && <p className="text-gray-500">No groups yet.</p>}
              {spellGroups.map((group) => (
                <div key={group.id} className="rounded border p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <strong>{group.name}</strong>
                    <span>{group.tier.toUpperCase()}</span>
                  </div>
                  <div className="mb-2 text-[11px] text-gray-600">
                    Stat:{" "}
                    {group.linkedStatFieldId
                      ? numberFields.find((field) => field.id === group.linkedStatFieldId)?.label ||
                        group.linkedStatFieldId
                      : "none"}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-gray-100 px-2 py-1"
                      onClick={() => startEditGroup(group)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded bg-red-100 px-2 py-1"
                      onClick={() => deleteGroup(group.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="space-y-2 rounded border p-3">
              <h4 className="font-medium">
                {editingSpellId ? "Edit Spell" : "Create Spell"}
              </h4>
              <input
                className="w-full rounded border p-2"
                placeholder="Spell name"
                value={spellForm.name}
                onChange={(event) =>
                  setSpellForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <select
                className="w-full rounded border p-2"
                value={spellForm.groupId}
                onChange={(event) =>
                  setSpellForm((prev) => ({ ...prev, groupId: event.target.value }))
                }
              >
                <option value="">Stand-alone spell</option>
                {spellGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded border p-2"
                value={spellForm.typeOption}
                onChange={(event) =>
                  setSpellForm((prev) => ({ ...prev, typeOption: event.target.value }))
                }
              >
                {SPELL_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {spellForm.typeOption === "custom" && (
                <input
                  className="w-full rounded border p-2"
                  placeholder="Custom type"
                  value={spellForm.typeCustom}
                  onChange={(event) =>
                    setSpellForm((prev) => ({ ...prev, typeCustom: event.target.value }))
                  }
                />
              )}
              <textarea
                className="w-full rounded border p-2"
                rows={2}
                placeholder="Description"
                value={spellForm.description}
                onChange={(event) =>
                  setSpellForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <textarea
                className="w-full rounded border p-2"
                rows={2}
                placeholder="Misc"
                value={spellForm.misc}
                onChange={(event) =>
                  setSpellForm((prev) => ({ ...prev, misc: event.target.value }))
                }
              />

              <div className="rounded border p-2">
                <div className="mb-2 flex items-center justify-between">
                  <strong>Levels</strong>
                  <button type="button" className="rounded bg-green-100 px-2 py-1" onClick={addSpellLevel}>
                    Add Level
                  </button>
                </div>
                <div className="max-h-[45vh] space-y-2 overflow-auto">
                  {spellForm.levels.map((level, levelIndex) => (
                    <div key={`level-${levelIndex}`} className="rounded border p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Level {levelIndex + 1}</span>
                        <button
                          type="button"
                          className="rounded bg-red-100 px-2 py-1"
                          onClick={() => removeSpellLevel(levelIndex)}
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        className="mb-2 w-full rounded border p-2"
                        rows={2}
                        placeholder="Level definition"
                        value={level.definition}
                        onChange={(event) =>
                          updateSpellLevel(levelIndex, { definition: event.target.value })
                        }
                      />
                      <input
                        className="mb-2 w-full rounded border p-2"
                        type="number"
                        placeholder="Mana cost"
                        value={level.manaCost}
                        onChange={(event) =>
                          updateSpellLevel(levelIndex, { manaCost: event.target.value })
                        }
                      />
                      <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                        <input
                          className="rounded border p-2"
                          type="number"
                          placeholder="Range amount"
                          value={level.rangeAmount}
                          onChange={(event) =>
                            updateSpellLevel(levelIndex, { rangeAmount: event.target.value })
                          }
                        />
                        <select
                          className="rounded border p-2"
                          value={level.rangeUnit}
                          onChange={(event) =>
                            updateSpellLevel(levelIndex, { rangeUnit: event.target.value })
                          }
                        >
                          {RANGE_UNITS.map((unit) => (
                            <option key={`range-${unit || "none"}`} value={unit}>
                              {unit || "Range unit"}
                            </option>
                          ))}
                        </select>
                        <input
                          className="rounded border p-2"
                          placeholder="Range text"
                          value={level.rangeText}
                          onChange={(event) =>
                            updateSpellLevel(levelIndex, { rangeText: event.target.value })
                          }
                        />
                      </div>
                      <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                        <input
                          className="rounded border p-2"
                          type="number"
                          placeholder="Duration amount"
                          value={level.durationAmount}
                          onChange={(event) =>
                            updateSpellLevel(levelIndex, { durationAmount: event.target.value })
                          }
                        />
                        <select
                          className="rounded border p-2"
                          value={level.durationUnit}
                          onChange={(event) =>
                            updateSpellLevel(levelIndex, { durationUnit: event.target.value })
                          }
                        >
                          {DURATION_UNITS.map((unit) => (
                            <option key={`duration-${unit || "none"}`} value={unit}>
                              {unit || "Duration unit"}
                            </option>
                          ))}
                        </select>
                        <input
                          className="rounded border p-2"
                          placeholder="Duration text"
                          value={level.durationText}
                          onChange={(event) =>
                            updateSpellLevel(levelIndex, { durationText: event.target.value })
                          }
                        />
                      </div>
                      <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                        <input
                          className="rounded border p-2"
                          type="number"
                          placeholder="Casting amount"
                          value={level.castingTimeAmount}
                          onChange={(event) =>
                            updateSpellLevel(levelIndex, {
                              castingTimeAmount: event.target.value,
                            })
                          }
                        />
                        <select
                          className="rounded border p-2"
                          value={level.castingTimeUnit}
                          onChange={(event) =>
                            updateSpellLevel(levelIndex, {
                              castingTimeUnit: event.target.value,
                            })
                          }
                        >
                          {CASTING_TIME_UNITS.map((unit) => (
                            <option key={`cast-${unit || "none"}`} value={unit}>
                              {unit || "Casting unit"}
                            </option>
                          ))}
                        </select>
                        <input
                          className="rounded border p-2"
                          placeholder="Casting text"
                          value={level.castingTimeText}
                          onChange={(event) =>
                            updateSpellLevel(levelIndex, {
                              castingTimeText: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="rounded border p-2">
                        <div className="mb-2 flex items-center justify-between">
                          <span>Effects</span>
                          <button
                            type="button"
                            className="rounded bg-green-100 px-2 py-1"
                            onClick={() => addSpellEffect(levelIndex)}
                          >
                            Add Effect
                          </button>
                        </div>
                        <div className="space-y-2">
                          {level.effects.map((effect, effectIndex) => (
                            <div
                              key={`effect-${levelIndex}-${effectIndex}`}
                              className="rounded border p-2"
                            >
                              <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                                <select
                                  className="rounded border p-2"
                                  value={effect.targetFieldId}
                                  onChange={(event) =>
                                    updateSpellEffect(levelIndex, effectIndex, {
                                      targetFieldId: event.target.value,
                                    })
                                  }
                                >
                                  <option value="">Target field</option>
                                  {numberFields.map((field) => (
                                    <option key={field.id} value={field.id}>
                                      {field.label}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="rounded border p-2"
                                  value={effect.operation}
                                  onChange={(event) =>
                                    updateSpellEffect(levelIndex, effectIndex, {
                                      operation: event.target.value,
                                    })
                                  }
                                >
                                  {SPELL_EFFECT_OPERATIONS.map((operation) => (
                                    <option key={operation} value={operation}>
                                      {operation}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="rounded border p-2"
                                  type="number"
                                  placeholder="Value"
                                  value={effect.value}
                                  onChange={(event) =>
                                    updateSpellEffect(levelIndex, effectIndex, {
                                      value: event.target.value,
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  className="rounded bg-red-100 px-2 py-1"
                                  onClick={() => removeSpellEffect(levelIndex, effectIndex)}
                                >
                                  Remove
                                </button>
                              </div>
                              <input
                                className="w-full rounded border p-2"
                                placeholder="Effect note"
                                value={effect.note}
                                onChange={(event) =>
                                  updateSpellEffect(levelIndex, effectIndex, {
                                    note: event.target.value,
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <textarea
                        className="mt-2 w-full rounded border p-2"
                        rows={2}
                        placeholder="Level notes"
                        value={level.notes}
                        onChange={(event) =>
                          updateSpellLevel(levelIndex, { notes: event.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" className="rounded bg-blue-100 px-3 py-2" onClick={submitSpellWithGuard}>
                  {editingSpellId ? "Update Spell" : "Add Spell"}
                </button>
                <button type="button" className="rounded bg-gray-100 px-3 py-2" onClick={resetSpellForm}>
                  Reset
                </button>
              </div>
            </section>

            <section className="space-y-2 rounded border p-3">
              <h4 className="font-medium">Existing Spells</h4>
              {spells.length === 0 && <p className="text-gray-500">No spells yet.</p>}
              {spells.map((spell) => (
                <div key={spell.id} className="rounded border p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <strong>{spell.name}</strong>
                    <span>{spell.type}</span>
                  </div>
                  <div className="mb-2 text-[11px] text-gray-600">
                    Group:{" "}
                    {spell.groupId
                      ? spellGroups.find((group) => group.id === spell.groupId)?.name ||
                        spell.groupId
                      : "stand-alone"}{" "}
                    | Levels: {Array.isArray(spell.levels) ? spell.levels.length : 0}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-gray-100 px-2 py-1"
                      onClick={() => startEditSpell(spell)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded bg-red-100 px-2 py-1"
                      onClick={() => deleteSpell(spell.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

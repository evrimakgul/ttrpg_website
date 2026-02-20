import { useMemo, useState } from "react";
import { makeId, normalizeRulesetSchema } from "../lib/rulesEngine";

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
const SPELL_TARGET_MODES = ["single", "and", "or"];
const EFFECT_TARGET_SECTION_MAP = {
  "Stats/Attributes": "Stats",
  "Skills/Abilities": "Skills",
  "Combat Summary": "Combat Summary",
};

function formatCastingTimeUnitLabel(unit) {
  if (!unit) return "Casting unit";
  if (unit === "action") return "standard action";
  return unit;
}

function createEmptyTierForm() {
  return {
    name: "",
  };
}

function createEmptyGroupForm() {
  return {
    name: "",
    tierId: "",
    linkedStatFieldId: "",
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

function cloneLevelForm(level) {
  if (!level || typeof level !== "object") {
    return createEmptyLevelForm();
  }
  return {
    definition: level.definition || "",
    manaCost: level.manaCost ?? "",
    rangeAmount: level.rangeAmount ?? "",
    rangeUnit: level.rangeUnit || "",
    rangeText: level.rangeText || "",
    durationAmount: level.durationAmount ?? "",
    durationUnit: level.durationUnit || "",
    durationText: level.durationText || "",
    castingTimeAmount: level.castingTimeAmount ?? "",
    castingTimeUnit: level.castingTimeUnit || "",
    castingTimeText: level.castingTimeText || "",
    effects: Array.isArray(level.effects)
      ? level.effects.map((effect) => ({
          id: "",
          targetMode: effect?.targetMode || "single",
          targetFieldIds: Array.isArray(effect?.targetFieldIds)
            ? [...effect.targetFieldIds]
            : [],
          targetSection: effect?.targetSection || "",
          targetGroup: effect?.targetGroup || "",
          operation: effect?.operation || "add",
          value: effect?.value ?? "0",
          note: effect?.note || "",
        }))
      : [],
    notes: level.notes || "",
  };
}

function createEmptySpellForm() {
  return {
    name: "",
    groupId: "",
    tierId: "",
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
    targetMode: "single",
    targetFieldIds: [],
    targetSection: "",
    targetGroup: "",
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
    tierId: spell.tierId || "",
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
                  targetMode: ["single", "and", "or"].includes(effect.targetMode)
                    ? effect.targetMode
                    : Array.isArray(effect.targetFieldIds) && effect.targetFieldIds.length > 1
                      ? "and"
                      : "single",
                  targetFieldIds:
                    Array.isArray(effect.targetFieldIds) && effect.targetFieldIds.length > 0
                      ? [...new Set(effect.targetFieldIds.filter(Boolean))]
                      : effect.targetFieldId
                        ? [effect.targetFieldId]
                        : [],
                  targetSection: "",
                  targetGroup: "",
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
  const [activeTab, setActiveTab] = useState("tiers");
  const [editingTierId, setEditingTierId] = useState("");
  const [tierForm, setTierForm] = useState(createEmptyTierForm());
  const [editingGroupId, setEditingGroupId] = useState("");
  const [groupForm, setGroupForm] = useState(createEmptyGroupForm());
  const [editingSpellId, setEditingSpellId] = useState("");
  const [spellForm, setSpellForm] = useState(createEmptySpellForm());
  const [collapsed, setCollapsed] = useState({
    tiers: false,
    powers: false,
    spells: false,
  });

  const normalizedSchema = useMemo(() => normalizeRulesetSchema(schema), [schema]);
  const powerConfig = normalizedSchema.powerConfig || {
    useTiers: true,
    usePowers: true,
  };
  const powerTiers = normalizedSchema.powerTiers || [];
  const spellGroups = normalizedSchema.spellGroups || [];
  const spells = normalizedSchema.spells || [];
  const boxById = useMemo(
    () => new Map((normalizedSchema.boxes || []).map((box) => [box.id, box])),
    [normalizedSchema.boxes]
  );
  const numberFields = useMemo(
    () =>
      (fieldBoxes || []).filter(
        (box) => box.fieldType === "number" && box.hidden !== true
      ),
    [fieldBoxes]
  );
  const numberFieldIds = useMemo(
    () => new Set(numberFields.map((field) => field.id)),
    [numberFields]
  );
  const linkedStatFields = useMemo(() => {
    return numberFields.filter((field) => {
      const pathLabels = [];
      let pointer = field;
      while (pointer?.parentId) {
        const parent = boxById.get(pointer.parentId);
        if (!parent) break;
        pathLabels.unshift(parent.label || parent.id);
        pointer = parent;
      }
      return pathLabels[0] === "Stats/Attributes";
    });
  }, [numberFields, boxById]);
  const linkedStatFieldIds = useMemo(
    () => new Set(linkedStatFields.map((field) => field.id)),
    [linkedStatFields]
  );
  const effectTargetFields = useMemo(() => {
    const allowedSections = new Set(Object.keys(EFFECT_TARGET_SECTION_MAP));
    return (fieldBoxes || []).filter((field) => {
      if (field.hidden === true) return false;
      if (field.fieldType !== "number" && field.fieldType !== "computed") return false;

      const pathLabels = [];
      let pointer = field;
      while (pointer?.parentId) {
        const parent = boxById.get(pointer.parentId);
        if (!parent) break;
        pathLabels.unshift(parent.label || parent.id);
        pointer = parent;
      }

      const topSection = pathLabels[0] || "";
      return allowedSections.has(topSection);
    });
  }, [fieldBoxes, boxById]);
  const effectTargetFieldIds = useMemo(
    () => new Set(effectTargetFields.map((field) => field.id)),
    [effectTargetFields]
  );
  const targetTree = useMemo(() => {
    const tree = new Map();
    const byId = boxById;
    effectTargetFields.forEach((field) => {
      const pathLabels = [];
      let pointer = field;
      while (pointer?.parentId) {
        const parent = byId.get(pointer.parentId);
        if (!parent) break;
        pathLabels.unshift(parent.label || parent.id);
        pointer = parent;
      }
      const rawSection = pathLabels[0] || "Uncategorized";
      const section = EFFECT_TARGET_SECTION_MAP[rawSection] || rawSection;
      const group = pathLabels.slice(1).join(" / ") || "(root)";
      if (!tree.has(section)) {
        tree.set(section, new Map());
      }
      const groups = tree.get(section);
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group).push(field);
    });

    return [...tree.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([section, groups]) => ({
        section,
        groups: [...groups.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([group, fields]) => ({
            group,
            fields: [...fields].sort((left, right) => left.label.localeCompare(right.label)),
          })),
      }));
  }, [boxById, effectTargetFields]);
  const targetLocationById = useMemo(() => {
    const map = new Map();
    targetTree.forEach((sectionEntry) => {
      sectionEntry.groups.forEach((groupEntry) => {
        groupEntry.fields.forEach((field) => {
          map.set(field.id, { section: sectionEntry.section, group: groupEntry.group });
        });
      });
    });
    return map;
  }, [targetTree]);

  const commitSchema = (updater) => {
    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      updater(next);
      return next;
    });
  };

  const togglePowerConfig = (key, checked) => {
    commitSchema((next) => {
      next.powerConfig = {
        ...(next.powerConfig || { useTiers: true, usePowers: true }),
        [key]: checked,
      };

      if (!next.powerConfig.useTiers) {
        next.spellGroups = next.spellGroups.map((power) => ({
          ...power,
          tierId: null,
        }));
        next.spells = next.spells.map((spell) => ({
          ...spell,
          tierId: null,
        }));
      }
      if (!next.powerConfig.usePowers) {
        next.spells = next.spells.map((spell) => ({
          ...spell,
          groupId: null,
        }));
      }
    });
    setError("");
  };

  const resetTierForm = () => {
    setEditingTierId("");
    setTierForm(createEmptyTierForm());
  };

  const resetGroupForm = () => {
    setEditingGroupId("");
    setGroupForm(createEmptyGroupForm());
  };

  const resetSpellForm = () => {
    setEditingSpellId("");
    setSpellForm(createEmptySpellForm());
  };

  const toggleCollapsed = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const submitTier = () => {
    const name = tierForm.name.trim();
    if (!name) {
      setError("Tier name is required.");
      return;
    }

    const duplicate = powerTiers.find(
      (tier) =>
        tier.id !== editingTierId &&
        String(tier.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setError(`Tier name '${name}' already exists.`);
      return;
    }

    const nextTier = {
      id: editingTierId || makeId("power_tier"),
      name,
      order: editingTierId
        ? powerTiers.find((tier) => tier.id === editingTierId)?.order || 0
        : powerTiers.length,
    };

    commitSchema((next) => {
      if (editingTierId) {
        next.powerTiers = next.powerTiers.map((tier) =>
          tier.id === editingTierId ? nextTier : tier
        );
      } else {
        next.powerTiers.push(nextTier);
      }
    });

    setError("");
    resetTierForm();
  };

  const startEditTier = (tier) => {
    setEditingTierId(tier.id);
    setTierForm({
      name: tier.name || "",
    });
    setActiveTab("tiers");
  };

  const deleteTier = (tierId) => {
    const powerLinked = spellGroups.find((group) => group.tierId === tierId);
    if (powerLinked) {
      setError(`Cannot delete this tier. Power '${powerLinked.name}' is assigned to it.`);
      return;
    }

    const spellLinked = spells.find((spell) => spell.tierId === tierId);
    if (spellLinked) {
      setError(`Cannot delete this tier. Spell '${spellLinked.name}' is assigned to it.`);
      return;
    }

    commitSchema((next) => {
      next.powerTiers = next.powerTiers.filter((tier) => tier.id !== tierId);
    });

    if (editingTierId === tierId) {
      resetTierForm();
    }
    setError("");
  };

  const submitGroup = () => {
    const name = groupForm.name.trim();
    if (!name) {
      setError("Power name is required.");
      return;
    }

    const duplicate = spellGroups.find(
      (group) =>
        group.id !== editingGroupId &&
        String(group.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setError(`Power name '${name}' already exists.`);
      return;
    }

    if (powerConfig.useTiers && powerTiers.length > 0 && !groupForm.tierId) {
      setError("Select a tier for this power.");
      return;
    }

    if (groupForm.tierId && !powerTiers.some((tier) => tier.id === groupForm.tierId)) {
      setError("Selected tier does not exist.");
      return;
    }

    if (groupForm.linkedStatFieldId && !linkedStatFieldIds.has(groupForm.linkedStatFieldId)) {
      setError("Linked field must be a valid stat field.");
      return;
    }

    const targetId = editingGroupId || makeId("spell_group");

    const nextGroup = {
      id: targetId,
      name,
      tier: "t1",
      tierCustomLabel: null,
      tierId: powerConfig.useTiers ? groupForm.tierId || null : null,
      linkedStatFieldId: groupForm.linkedStatFieldId || null,
      opposingGroupIds: [],
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
      tierId: group.tierId || "",
      linkedStatFieldId: group.linkedStatFieldId || "",
      notes: group.notes || "",
    });
    setActiveTab("powers");
  };

  const deleteGroup = (groupId) => {
    const linkedSpell = spells.find((spell) => spell.groupId === groupId);
    if (linkedSpell) {
      setError(
        `Cannot delete this power. Spell '${linkedSpell.name}' is assigned to it.`
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
    setSpellForm((prev) => {
      const sourceLevel =
        Array.isArray(prev.levels) && prev.levels.length > 0
          ? prev.levels[prev.levels.length - 1]
          : null;
      return {
        ...prev,
        levels: [...prev.levels, cloneLevelForm(sourceLevel)],
      };
    });
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

  const resolveEffectTargetContext = (effect) => {
    const selectedTargets = Array.isArray(effect.targetFieldIds)
      ? [...new Set(effect.targetFieldIds.filter((id) => effectTargetFieldIds.has(id)))]
      : [];
    const firstLocation = selectedTargets[0]
      ? targetLocationById.get(selectedTargets[0])
      : null;
    const section =
      effect.targetSection || firstLocation?.section || targetTree[0]?.section || "";
    const sectionEntry = targetTree.find((entry) => entry.section === section) || null;
    const group =
      effect.targetGroup || firstLocation?.group || sectionEntry?.groups[0]?.group || "";
    const groupEntry =
      sectionEntry?.groups.find((entry) => entry.group === group) || null;
    const allowedIds = new Set((groupEntry?.fields || []).map((field) => field.id));
    return {
      section,
      group,
      sectionEntry,
      groupEntry,
      selectedTargets,
      allowedIds,
    };
  };

  const setEffectSection = (levelIndex, effectIndex, section) => {
    const sectionEntry = targetTree.find((entry) => entry.section === section);
    const fallbackGroup = sectionEntry?.groups[0]?.group || "";
    updateSpellEffect(levelIndex, effectIndex, {
      targetSection: section,
      targetGroup: fallbackGroup,
      targetFieldIds: [],
    });
  };

  const setEffectGroup = (levelIndex, effectIndex, group) => {
    updateSpellEffect(levelIndex, effectIndex, {
      targetGroup: group,
      targetFieldIds: [],
    });
  };

  const setEffectSingleTarget = (levelIndex, effectIndex, targetId) => {
    updateSpellEffect(levelIndex, effectIndex, {
      targetFieldIds: targetId ? [targetId] : [],
    });
  };

  const toggleEffectMultiTarget = (levelIndex, effectIndex, targetId, checked) => {
    setSpellForm((prev) => {
      const levels = prev.levels.map((level, levelIdx) => {
        if (levelIdx !== levelIndex) return level;
        const effects = level.effects.map((effect, fxIdx) => {
          if (fxIdx !== effectIndex) return effect;
          const current = Array.isArray(effect.targetFieldIds)
            ? [...new Set(effect.targetFieldIds)]
            : [];
          const nextTargets = checked
            ? [...new Set([...current, targetId])]
            : current.filter((id) => id !== targetId);
          return {
            ...effect,
            targetFieldIds: nextTargets,
          };
        });
        return { ...level, effects };
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

    let parentPowerId = null;
    let parentTierId = null;

    if (powerConfig.usePowers) {
      if (!spellForm.groupId) {
        setError("Select a power for this spell.");
        return;
      }
      if (!spellGroups.some((group) => group.id === spellForm.groupId)) {
        setError("Selected power does not exist.");
        return;
      }
      parentPowerId = spellForm.groupId;
      if (powerConfig.useTiers) {
        parentTierId =
          spellGroups.find((group) => group.id === spellForm.groupId)?.tierId || null;
      }
    } else if (powerConfig.useTiers) {
      if (powerTiers.length > 0 && !spellForm.tierId) {
        setError("Select a tier for this spell.");
        return;
      }
      if (spellForm.tierId && !powerTiers.some((tier) => tier.id === spellForm.tierId)) {
        setError("Selected tier does not exist.");
        return;
      }
      parentTierId = spellForm.tierId || null;
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
        const targetMode = SPELL_TARGET_MODES.includes(effect.targetMode)
          ? effect.targetMode
          : "single";
        const targets = Array.isArray(effect.targetFieldIds)
          ? [...new Set(effect.targetFieldIds.filter(Boolean))]
          : [];
        if (targets.length === 0) {
          throw new Error(
            `Spell level ${levelIndex + 1}, effect ${effectIndex + 1}: at least one target is required.`
          );
        }
        if (targetMode === "single" && targets.length !== 1) {
          throw new Error(
            `Spell level ${levelIndex + 1}, effect ${effectIndex + 1}: single target mode requires exactly one target.`
          );
        }
        if ((targetMode === "and" || targetMode === "or") && targets.length < 2) {
          throw new Error(
            `Spell level ${levelIndex + 1}, effect ${effectIndex + 1}: '${targetMode}' mode requires at least two targets.`
          );
        }
        targets.forEach((targetId) => {
          if (!effectTargetFieldIds.has(targetId)) {
            throw new Error(
              `Spell level ${levelIndex + 1}, effect ${effectIndex + 1}: target '${targetId}' must be a valid effect target field.`
            );
          }
        });
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
          targetFieldId: targets[0] || "",
          targetFieldIds: targets,
          targetMode,
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
      groupId: parentPowerId,
      tierId: parentTierId,
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
          <h3 className="font-semibold">Power Builder</h3>
          <button
            type="button"
            className="rounded bg-gray-200 px-3 py-1"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4 rounded border bg-gray-50 p-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={powerConfig.useTiers !== false}
              onChange={(event) => togglePowerConfig("useTiers", event.target.checked)}
            />
            Use tiers
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={powerConfig.usePowers !== false}
              onChange={(event) => togglePowerConfig("usePowers", event.target.checked)}
            />
            Use powers
          </label>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`rounded px-3 py-1 ${
              activeTab === "tiers" ? "bg-blue-100" : "bg-gray-100"
            }`}
            onClick={() => setActiveTab("tiers")}
          >
            Add Tiers
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 ${
              activeTab === "powers" ? "bg-blue-100" : "bg-gray-100"
            }`}
            onClick={() => setActiveTab("powers")}
          >
            Add Powers
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 ${
              activeTab === "spells" ? "bg-blue-100" : "bg-gray-100"
            }`}
            onClick={() => setActiveTab("spells")}
          >
            Add Spells
          </button>
        </div>

        {activeTab === "tiers" ? (
          <div className="rounded border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-medium">Tiers</h4>
              <button type="button" className="rounded bg-gray-100 px-2 py-1" onClick={() => toggleCollapsed("tiers")}>
                {collapsed.tiers ? "Expand" : "Collapse"}
              </button>
            </div>
            {!collapsed.tiers && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="space-y-2 rounded border p-3">
                  <h4 className="font-medium">{editingTierId ? "Edit Tier" : "Create Tier"}</h4>
                  <input
                    className="w-full rounded border p-2"
                    placeholder="Tier name"
                    value={tierForm.name}
                    onChange={(event) =>
                      setTierForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                  <div className="flex gap-2">
                    <button type="button" className="rounded bg-blue-100 px-3 py-2" onClick={submitTier}>
                      {editingTierId ? "Update Tier" : "Add Tier"}
                    </button>
                    <button type="button" className="rounded bg-gray-100 px-3 py-2" onClick={resetTierForm}>
                      Reset
                    </button>
                  </div>
                </section>
                <section className="space-y-2 rounded border p-3">
                  <h4 className="font-medium">Existing Tiers</h4>
                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {powerTiers.length === 0 && <p className="text-gray-500">No tiers yet.</p>}
                    {[...powerTiers]
                      .sort((left, right) => left.order - right.order)
                      .map((tier) => (
                        <div key={tier.id} className="rounded border p-2">
                          <div className="mb-1 flex items-center justify-between">
                            <strong>{tier.name}</strong>
                            <span className="text-[11px] text-gray-600">order {tier.order}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="rounded bg-gray-100 px-2 py-1"
                              onClick={() => startEditTier(tier)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="rounded bg-red-100 px-2 py-1"
                              onClick={() => deleteTier(tier.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        ) : activeTab === "powers" ? (
          <div className="rounded border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-medium">Powers</h4>
              <button type="button" className="rounded bg-gray-100 px-2 py-1" onClick={() => toggleCollapsed("powers")}>
                {collapsed.powers ? "Expand" : "Collapse"}
              </button>
            </div>
            {!collapsed.powers && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="space-y-2 rounded border p-3">
                  <h4 className="font-medium">
                    {editingGroupId ? "Edit Power" : "Create Power"}
                  </h4>
                  <input
                    className="w-full rounded border p-2"
                    placeholder="Power name"
                    value={groupForm.name}
                    onChange={(event) =>
                      setGroupForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                  {powerConfig.useTiers && (
                    <select
                      className="w-full rounded border p-2"
                      value={groupForm.tierId}
                      onChange={(event) =>
                        setGroupForm((prev) => ({ ...prev, tierId: event.target.value }))
                      }
                    >
                      <option value="">No tier</option>
                      {[...powerTiers]
                        .sort((left, right) => left.order - right.order)
                        .map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.name}
                          </option>
                      ))}
                    </select>
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
                    <option value="">No linked field</option>
                    {linkedStatFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))}
                  </select>
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
                      {editingGroupId ? "Update Power" : "Add Power"}
                    </button>
                    <button type="button" className="rounded bg-gray-100 px-3 py-2" onClick={resetGroupForm}>
                      Reset
                    </button>
                  </div>
                </section>

                <section className="space-y-2 rounded border p-3">
                  <h4 className="font-medium">Existing Powers</h4>
                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {spellGroups.length === 0 && <p className="text-gray-500">No powers yet.</p>}
                    {spellGroups.map((group) => (
                      <div key={group.id} className="rounded border p-2">
                        <div className="mb-1 flex items-center justify-between">
                          <strong>{group.name}</strong>
                          <span className="text-[11px] text-gray-600">
                            Tier: {powerTiers.find((tier) => tier.id === group.tierId)?.name || "none"}
                          </span>
                        </div>
                        <div className="mb-1 text-[11px] text-gray-600">
                          Linked Field:{" "}
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
                  </div>
                </section>
              </div>
            )}
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
              {powerConfig.usePowers ? (
                <select
                  className="w-full rounded border p-2"
                  value={spellForm.groupId}
                  onChange={(event) =>
                    setSpellForm((prev) => ({ ...prev, groupId: event.target.value }))
                  }
                >
                  <option value="">Select power</option>
                  {spellGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              ) : powerConfig.useTiers ? (
                <select
                  className="w-full rounded border p-2"
                  value={spellForm.tierId}
                  onChange={(event) =>
                    setSpellForm((prev) => ({ ...prev, tierId: event.target.value }))
                  }
                >
                  <option value="">Select tier</option>
                  {[...powerTiers]
                    .sort((left, right) => left.order - right.order)
                    .map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                      </option>
                    ))}
                </select>
              ) : (
                <p className="rounded border bg-gray-50 p-2 text-[11px] text-gray-600">
                  Spells are stand-alone in this mode.
                </p>
              )}
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
                          placeholder="Casting time"
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
                              {formatCastingTimeUnitLabel(unit)}
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
                          {level.effects.map((effect, effectIndex) => {
                            const targetContext = resolveEffectTargetContext(effect);
                            return (
                              <div
                                key={`effect-${levelIndex}-${effectIndex}`}
                                className="rounded border p-2"
                              >
                                <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-6">
                                  <select
                                    className="rounded border p-2"
                                    value={effect.targetMode || "single"}
                                    onChange={(event) =>
                                      updateSpellEffect(levelIndex, effectIndex, {
                                        targetMode: event.target.value,
                                        targetFieldIds: [],
                                      })
                                    }
                                  >
                                    {SPELL_TARGET_MODES.map((mode) => (
                                      <option key={mode} value={mode}>
                                        Target mode: {mode}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    className="rounded border p-2"
                                    value={targetContext.section}
                                    onChange={(event) =>
                                      setEffectSection(levelIndex, effectIndex, event.target.value)
                                    }
                                  >
                                    {targetTree.length === 0 && <option value="">No sections</option>}
                                    {targetTree.map((sectionEntry) => (
                                      <option key={sectionEntry.section} value={sectionEntry.section}>
                                        Section: {sectionEntry.section}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    className="rounded border p-2"
                                    value={targetContext.group}
                                    onChange={(event) =>
                                      setEffectGroup(levelIndex, effectIndex, event.target.value)
                                    }
                                  >
                                    {(targetContext.sectionEntry?.groups || []).map((groupEntry) => (
                                      <option key={groupEntry.group} value={groupEntry.group}>
                                        Group: {groupEntry.group}
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
                                {effect.targetMode === "single" ? (
                                  <select
                                    className="mb-2 w-full rounded border p-2"
                                    value={targetContext.selectedTargets[0] || ""}
                                    onChange={(event) =>
                                      setEffectSingleTarget(levelIndex, effectIndex, event.target.value)
                                    }
                                  >
                                    <option value="">Select target field</option>
                                    {(targetContext.groupEntry?.fields || []).map((field) => (
                                      <option key={field.id} value={field.id}>
                                        {field.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="mb-2 rounded border bg-gray-50 p-2">
                                    <div className="mb-1 text-[11px] text-gray-600">
                                      Select multiple targets ({String(effect.targetMode || "and").toUpperCase()}).
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                                      {(targetContext.groupEntry?.fields || []).map((field) => {
                                        const checked = targetContext.selectedTargets.includes(field.id);
                                        return (
                                          <label key={field.id} className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={(event) =>
                                                toggleEffectMultiTarget(
                                                  levelIndex,
                                                  effectIndex,
                                                  field.id,
                                                  event.target.checked
                                                )
                                              }
                                            />
                                            {field.label}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
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
                            );
                          })}
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
                    {powerConfig.usePowers ? (
                      <span>
                        Power:{" "}
                        {spell.groupId
                          ? spellGroups.find((group) => group.id === spell.groupId)?.name ||
                            spell.groupId
                          : "none"}
                      </span>
                    ) : powerConfig.useTiers ? (
                      <span>
                        Tier:{" "}
                        {spell.tierId
                          ? powerTiers.find((tier) => tier.id === spell.tierId)?.name ||
                            spell.tierId
                          : "none"}
                      </span>
                    ) : (
                      <span>Parent: none</span>
                    )}{" "}
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

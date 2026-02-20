export const STARTER_CATEGORY_NAMES = [
  "Stats",
  "Attributes",
  "Skills",
  "Combat",
  "Weapons",
  "Magic",
  "Items",
  "Feats",
  "Classes",
  "Specialties",
  "Races",
  "Custom",
];

const ALLOWED_BOX_TYPES = new Set(["group", "field", "repeatable_group"]);
const ALLOWED_FIELD_TYPES = new Set([
  "number",
  "text",
  "boolean",
  "single_select",
  "multi_select",
  "computed",
]);
const ALLOWED_RELATION_TYPES = new Set(["requires", "excludes", "modifies", "grants"]);
const ALLOWED_EFFECT_TYPES = new Set(["set", "add", "multiply", "enable", "disable"]);
const ALLOWED_SPELL_GROUP_TIERS = new Set(["t1", "t2", "t3", "t4", "t5", "custom"]);
const ALLOWED_SPELL_EFFECT_OPS = new Set(["set", "add", "multiply"]);
const ALLOWED_SPELL_EFFECT_TARGET_MODES = new Set(["single", "and", "or"]);
const ALLOWED_EDITABLE_BY = new Set(["player", "dm"]);
const ALLOWED_XP_CATEGORIES = new Set(["stats", "skills", "powers"]);
const ALLOWED_LAYOUT_WIDTHS = new Set(["small", "medium", "large", "full"]);
const ALLOWED_LAYOUT_HEIGHTS = new Set(["compact", "regular", "tall"]);
const ALLOWED_EXPRESSION_OPS = new Set([
  "literal",
  "field",
  "and",
  "or",
  "not",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "add",
  "sub",
  "mul",
  "div",
  "min",
  "max",
  "round",
  "floor",
  "ceil",
  "clamp",
]);

export const EMPTY_RULESET_SCHEMA = Object.freeze({
  schemaVersion: 1,
  categories: [],
  boxes: [],
  relations: [],
  rules: [],
  xpProgression: {
    stats: [{ level: 1, cumulative: 0 }],
    skills: [{ level: 1, cumulative: 0 }],
    powers: [{ level: 1, cumulative: 0 }],
  },
  powerConfig: {
    useTiers: true,
    usePowers: true,
  },
  powerTiers: [],
  spellGroups: [],
  spells: [],
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function safeTrim(value) {
  return String(value || "").trim();
}

function defaultLayout() {
  return {
    width: "full",
    height: "regular",
  };
}

function normalizeLayout(input) {
  const raw = isPlainObject(input) ? input : {};
  const defaults = defaultLayout();
  return {
    width: ALLOWED_LAYOUT_WIDTHS.has(raw.width) ? raw.width : defaults.width,
    height: ALLOWED_LAYOUT_HEIGHTS.has(raw.height) ? raw.height : defaults.height,
  };
}

function defaultXpProgression() {
  return {
    stats: [{ level: 1, cumulative: 0 }],
    skills: [{ level: 1, cumulative: 0 }],
    powers: [{ level: 1, cumulative: 0 }],
  };
}

function normalizeXpProgressionTable(input) {
  const normalized = asArray(input)
    .map((entry) => ({
      level: Number(entry?.level),
      cumulative: Number(entry?.cumulative),
    }))
    .filter((entry) => Number.isInteger(entry.level) && entry.level > 0 && Number.isFinite(entry.cumulative))
    .sort((left, right) => left.level - right.level)
    .filter((entry, index, source) => index === 0 || source[index - 1].level !== entry.level)
    .map((entry) => ({
      level: entry.level,
      cumulative: entry.cumulative < 0 ? 0 : entry.cumulative,
    }));

  if (normalized.length === 0 || normalized[0].level !== 1) {
    return [{ level: 1, cumulative: 0 }, ...normalized.filter((entry) => entry.level !== 1)];
  }
  return normalized;
}

function normalizeXpProgression(input) {
  const raw = isPlainObject(input) ? input : {};
  return {
    stats: normalizeXpProgressionTable(raw.stats),
    skills: normalizeXpProgressionTable(raw.skills),
    powers: normalizeXpProgressionTable(raw.powers),
  };
}

export function makeId(prefix = "id") {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function buildStarterTemplate(seedCategories = []) {
  const chosen = new Set(
    asArray(seedCategories).map((entry) => safeTrim(entry)).filter(Boolean)
  );

  return {
    schemaVersion: 1,
    categories: STARTER_CATEGORY_NAMES.map((name, index) => ({
      id: `category_${index + 1}`,
      name,
      enabled: chosen.size === 0 ? true : chosen.has(name),
    })),
    boxes: [],
    relations: [],
    rules: [],
    xpProgression: defaultXpProgression(),
    powerConfig: {
      useTiers: true,
      usePowers: true,
    },
    powerTiers: [],
    spellGroups: [],
    spells: [],
  };
}

function normalizeSpellTimeSpec(input) {
  const raw = isPlainObject(input) ? input : {};
  const amount = Number(raw.amount);
  return {
    amount: Number.isFinite(amount) ? amount : null,
    unit: safeTrim(raw.unit) || "",
    text: safeTrim(raw.text) || "",
  };
}

function normalizeSpellEffect(effect, effectIndex) {
  const value = Number(effect?.value);
  const rawTargets = asArray(effect?.targetFieldIds)
    .map((id) => safeTrim(id))
    .filter(Boolean);
  const legacyTarget = safeTrim(effect?.targetFieldId);
  if (legacyTarget && !rawTargets.includes(legacyTarget)) {
    rawTargets.unshift(legacyTarget);
  }
  const targetFieldIds = [...new Set(rawTargets)];
  const fallbackMode = targetFieldIds.length > 1 ? "and" : "single";
  const rawTargetMode = safeTrim(effect?.targetMode).toLowerCase();
  const targetMode = ALLOWED_SPELL_EFFECT_TARGET_MODES.has(rawTargetMode)
    ? rawTargetMode
    : fallbackMode;
  return {
    id: safeTrim(effect?.id) || `spell_effect_${effectIndex + 1}`,
    targetFieldId: targetFieldIds[0] || "",
    targetFieldIds,
    targetMode,
    operation: ALLOWED_SPELL_EFFECT_OPS.has(effect?.operation)
      ? effect.operation
      : "add",
    value: Number.isFinite(value) ? value : 0,
    note: safeTrim(effect?.note) || "",
  };
}

function normalizeSpellLevel(level, levelIndex) {
  const parsedLevel = Number(level?.level);
  return {
    level:
      Number.isInteger(parsedLevel) && parsedLevel > 0 ? parsedLevel : levelIndex + 1,
    definition: safeTrim(level?.definition) || "",
    manaCost: Number.isFinite(Number(level?.manaCost)) ? Number(level.manaCost) : null,
    range: normalizeSpellTimeSpec(level?.range),
    duration: normalizeSpellTimeSpec(level?.duration),
    castingTime: normalizeSpellTimeSpec(level?.castingTime),
    effects: asArray(level?.effects).map((effect, index) =>
      normalizeSpellEffect(effect, index)
    ),
    notes: safeTrim(level?.notes) || "",
  };
}

function normalizePowerConfig(input) {
  const raw = isPlainObject(input) ? input : {};
  return {
    useTiers: raw.useTiers !== false,
    usePowers: raw.usePowers !== false,
  };
}

function normalizePowerTier(tier, tierIndex) {
  return {
    id: safeTrim(tier?.id) || `power_tier_${tierIndex + 1}`,
    name: safeTrim(tier?.name) || `Tier ${tierIndex + 1}`,
    order: Number.isFinite(Number(tier?.order)) ? Number(tier.order) : tierIndex,
  };
}

function normalizeSpellGroup(group, groupIndex) {
  let tier = ALLOWED_SPELL_GROUP_TIERS.has(group?.tier) ? group.tier : "t1";
  const tierCustomLabel = safeTrim(group?.tierCustomLabel) || null;
  if (tier === "custom" && !tierCustomLabel) {
    tier = "t1";
  }
  return {
    id: safeTrim(group?.id) || `spell_group_${groupIndex + 1}`,
    name: safeTrim(group?.name) || `Spell Group ${groupIndex + 1}`,
    tier,
    tierCustomLabel: tier === "custom" ? tierCustomLabel : null,
    tierId: safeTrim(group?.tierId) || null,
    linkedStatFieldId: safeTrim(group?.linkedStatFieldId) || null,
    opposingGroupIds: [...new Set(asArray(group?.opposingGroupIds).map((id) => safeTrim(id)).filter(Boolean))],
    notes: safeTrim(group?.notes) || "",
  };
}

function normalizeSpell(spell, spellIndex) {
  return {
    id: safeTrim(spell?.id) || `spell_${spellIndex + 1}`,
    name: safeTrim(spell?.name) || `Spell ${spellIndex + 1}`,
    groupId: safeTrim(spell?.groupId) || null,
    tierId: safeTrim(spell?.tierId) || null,
    type: safeTrim(spell?.type) || "utility",
    description: safeTrim(spell?.description) || "",
    misc: safeTrim(spell?.misc) || "",
    levels: asArray(spell?.levels).map((level, index) => normalizeSpellLevel(level, index)),
  };
}

function normalizeExpression(node) {
  if (!isPlainObject(node)) {
    return { op: "literal", value: null };
  }

  const op = safeTrim(node.op).toLowerCase();
  if (!ALLOWED_EXPRESSION_OPS.has(op)) {
    return { op: "literal", value: null };
  }

  if (op === "literal") return { op: "literal", value: node.value ?? null };
  if (op === "field") return { op: "field", fieldId: safeTrim(node.fieldId) };
  if (op === "not") return { op: "not", arg: normalizeExpression(node.arg) };
  if (op === "round" || op === "floor" || op === "ceil") {
    return { op, arg: normalizeExpression(node.arg) };
  }
  if (op === "clamp") {
    return {
      op: "clamp",
      value: normalizeExpression(node.value),
      min: normalizeExpression(node.min),
      max: normalizeExpression(node.max),
    };
  }
  if (
    op === "and" ||
    op === "or" ||
    op === "add" ||
    op === "sub" ||
    op === "mul" ||
    op === "div" ||
    op === "min" ||
    op === "max"
  ) {
    const args = asArray(node.args);
    return {
      op,
      args:
        args.length > 0
          ? args.map((child) => normalizeExpression(child))
          : [normalizeExpression(node.left), normalizeExpression(node.right)],
    };
  }
  return {
    op,
    left: normalizeExpression(node.left),
    right: normalizeExpression(node.right),
  };
}

export function normalizeRulesetSchema(input) {
  if (!isPlainObject(input)) {
    return {
      schemaVersion: 1,
      categories: [],
      boxes: [],
      relations: [],
      rules: [],
      xpProgression: defaultXpProgression(),
      powerConfig: {
        useTiers: true,
        usePowers: true,
      },
      powerTiers: [],
      spellGroups: [],
      spells: [],
    };
  }

  return {
    schemaVersion: 1,
    categories: asArray(input.categories).map((category, index) => ({
      id: safeTrim(category?.id) || `category_${index + 1}`,
      name: safeTrim(category?.name) || `Category ${index + 1}`,
      enabled: category?.enabled !== false,
    })),
    boxes: asArray(input.boxes).map((box, index) => {
      const type = ALLOWED_BOX_TYPES.has(box?.type) ? box.type : "field";
      const normalized = {
        id: safeTrim(box?.id) || `box_${index + 1}`,
        type,
        label: safeTrim(box?.label) || `Box ${index + 1}`,
        parentId: safeTrim(box?.parentId) || null,
        categoryId: safeTrim(box?.categoryId) || null,
        order: Number.isFinite(Number(box?.order)) ? Number(box.order) : index,
        layout: normalizeLayout(box?.layout),
      };

      if (type === "field") {
        normalized.fieldType = ALLOWED_FIELD_TYPES.has(box?.fieldType)
          ? box.fieldType
          : "number";
        normalized.key = safeTrim(box?.key) || normalized.id;
        normalized.editableBy = ALLOWED_EDITABLE_BY.has(box?.editableBy)
          ? box.editableBy
          : "player";
        normalized.defaultValue = box?.defaultValue ?? null;
        normalized.options = asArray(box?.options)
          .map((option) => safeTrim(option))
          .filter(Boolean);
        normalized.formula = normalizeExpression(box?.formula);
        normalized.hidden = box?.hidden === true;
        normalized.isXpPool = box?.isXpPool === true;
        normalized.xpUpgradable = box?.xpUpgradable === true;
        const xpCost = Number(box?.xpCost);
        const xpStep = Number(box?.xpStep);
        const xpMax = Number(box?.xpMax);
        normalized.xpCost = Number.isFinite(xpCost) && xpCost >= 0 ? xpCost : 0;
        normalized.xpStep = Number.isFinite(xpStep) && xpStep > 0 ? xpStep : 1;
        normalized.xpMax = Number.isFinite(xpMax) && xpMax >= 0 ? xpMax : null;
        normalized.xpCategory = ALLOWED_XP_CATEGORIES.has(box?.xpCategory)
          ? box.xpCategory
          : null;
        normalized.bonusFieldId = safeTrim(box?.bonusFieldId) || null;
      } else if (type === "repeatable_group") {
        const repeatLimit = Number(box?.repeatLimit);
        normalized.repeatLimit =
          Number.isInteger(repeatLimit) && repeatLimit > 0 ? repeatLimit : null;
      }

      return normalized;
    }),
    relations: asArray(input.relations).map((relation, index) => ({
      id: safeTrim(relation?.id) || `relation_${index + 1}`,
      type: ALLOWED_RELATION_TYPES.has(relation?.type) ? relation.type : "requires",
      sourceBoxId: safeTrim(relation?.sourceBoxId),
      targetBoxId: safeTrim(relation?.targetBoxId),
      modifier: Number.isFinite(Number(relation?.modifier))
        ? Number(relation.modifier)
        : 0,
      valueExpr: normalizeExpression(relation?.valueExpr),
    })),
    rules: asArray(input.rules).map((rule, index) => ({
      id: safeTrim(rule?.id) || `rule_${index + 1}`,
      name: safeTrim(rule?.name) || `Rule ${index + 1}`,
      condition: normalizeExpression(rule?.condition),
      effects: asArray(rule?.effects).map((effect, effectIndex) => ({
        id: safeTrim(effect?.id) || `effect_${index + 1}_${effectIndex + 1}`,
        type: ALLOWED_EFFECT_TYPES.has(effect?.type) ? effect.type : "set",
        targetBoxId: safeTrim(effect?.targetBoxId),
        value: normalizeExpression(effect?.value),
      })),
    })),
    xpProgression: normalizeXpProgression(input.xpProgression),
    powerConfig: normalizePowerConfig(input.powerConfig),
    powerTiers: asArray(input.powerTiers).map((tier, index) =>
      normalizePowerTier(tier, index)
    ),
    spellGroups: asArray(input.spellGroups).map((group, index) =>
      normalizeSpellGroup(group, index)
    ),
    spells: asArray(input.spells).map((spell, index) => normalizeSpell(spell, index)),
  };
}

function validateExpression(node, path, allBoxIds, errors) {
  if (!isPlainObject(node)) {
    errors.push(`${path}: expression must be an object.`);
    return;
  }

  const op = safeTrim(node.op).toLowerCase();
  if (!ALLOWED_EXPRESSION_OPS.has(op)) {
    errors.push(`${path}: invalid operator '${op || "(empty)"}'.`);
    return;
  }

  if (op === "literal") return;
  if (op === "field") {
    const fieldId = safeTrim(node.fieldId);
    if (!fieldId) {
      errors.push(`${path}: field expression must include fieldId.`);
      return;
    }
    if (!allBoxIds.has(fieldId)) {
      errors.push(`${path}: fieldId '${fieldId}' does not exist.`);
    }
    return;
  }

  if (op === "not" || op === "round" || op === "floor" || op === "ceil") {
    validateExpression(node.arg, `${path}.${op}.arg`, allBoxIds, errors);
    return;
  }

  if (op === "clamp") {
    validateExpression(node.value, `${path}.clamp.value`, allBoxIds, errors);
    validateExpression(node.min, `${path}.clamp.min`, allBoxIds, errors);
    validateExpression(node.max, `${path}.clamp.max`, allBoxIds, errors);
    return;
  }

  if (
    op === "and" ||
    op === "or" ||
    op === "add" ||
    op === "sub" ||
    op === "mul" ||
    op === "div" ||
    op === "min" ||
    op === "max"
  ) {
    const args = asArray(node.args);
    if (args.length === 0) {
      errors.push(`${path}: operator '${op}' requires args.`);
      return;
    }
    args.forEach((child, index) => {
      validateExpression(child, `${path}.${op}.args[${index}]`, allBoxIds, errors);
    });
    return;
  }

  validateExpression(node.left, `${path}.${op}.left`, allBoxIds, errors);
  validateExpression(node.right, `${path}.${op}.right`, allBoxIds, errors);
}

export function validateRulesetSchema(inputSchema) {
  const schema = normalizeRulesetSchema(inputSchema);
  const errors = [];
  let xpPoolFieldCount = 0;

  const allBoxIds = new Set();
  const seenBoxIds = new Set();
  schema.boxes.forEach((box) => {
    if (box.id) allBoxIds.add(box.id);
  });
  const fieldById = new Map(
    schema.boxes
      .filter((box) => box.type === "field")
      .map((box) => [box.id, box])
  );

  schema.boxes.forEach((box, index) => {
    if (!box.id) {
      errors.push(`boxes[${index}]: id is required.`);
      return;
    }
    if (seenBoxIds.has(box.id)) {
      errors.push(`boxes[${index}]: duplicate id '${box.id}'.`);
      return;
    }
    seenBoxIds.add(box.id);

    if (!ALLOWED_BOX_TYPES.has(box.type)) {
      errors.push(`boxes[${index}]: invalid type '${box.type}'.`);
    }
    if (box.parentId && !allBoxIds.has(box.parentId)) {
      errors.push(`boxes[${index}]: parentId '${box.parentId}' does not exist.`);
    }
    if (box.type === "field") {
      if (!ALLOWED_LAYOUT_WIDTHS.has(box.layout?.width)) {
        errors.push(`boxes[${index}]: invalid layout.width '${box.layout?.width}'.`);
      }
      if (!ALLOWED_LAYOUT_HEIGHTS.has(box.layout?.height)) {
        errors.push(`boxes[${index}]: invalid layout.height '${box.layout?.height}'.`);
      }
      if (!ALLOWED_FIELD_TYPES.has(box.fieldType)) {
        errors.push(`boxes[${index}]: invalid fieldType '${box.fieldType}'.`);
      }
      if (!ALLOWED_EDITABLE_BY.has(box.editableBy)) {
        errors.push(`boxes[${index}]: invalid editableBy '${box.editableBy}'.`);
      }
      const isNumberField = box.fieldType === "number";
      const canBeXpPool = box.fieldType === "number" || box.fieldType === "computed";

      if (box.isXpPool) {
        xpPoolFieldCount += 1;
        if (!canBeXpPool) {
          errors.push(`boxes[${index}]: isXpPool requires fieldType 'number' or 'computed'.`);
        }
      }

      if (box.xpUpgradable && !isNumberField) {
        errors.push(`boxes[${index}]: xpUpgradable requires fieldType 'number'.`);
      }

      if (box.xpCategory && !ALLOWED_XP_CATEGORIES.has(box.xpCategory)) {
        errors.push(`boxes[${index}]: invalid xpCategory '${box.xpCategory}'.`);
      }

      if (box.isXpPool && box.xpUpgradable) {
        errors.push(`boxes[${index}]: field cannot be both isXpPool and xpUpgradable.`);
      }

      if (box.xpUpgradable) {
        if (!Number.isFinite(box.xpCost) || box.xpCost < 0) {
          errors.push(`boxes[${index}]: xpCost must be >= 0.`);
        }
        if (!Number.isFinite(box.xpStep) || box.xpStep <= 0) {
          errors.push(`boxes[${index}]: xpStep must be > 0.`);
        }
        if (box.xpMax !== null && (!Number.isFinite(box.xpMax) || box.xpMax < 0)) {
          errors.push(`boxes[${index}]: xpMax must be null or >= 0.`);
        }
      }

      if (box.bonusFieldId) {
        if (box.bonusFieldId === box.id) {
          errors.push(`boxes[${index}]: bonusFieldId cannot reference itself.`);
        } else if (!allBoxIds.has(box.bonusFieldId)) {
          errors.push(`boxes[${index}]: bonusFieldId '${box.bonusFieldId}' does not exist.`);
        } else {
          const bonusBox = schema.boxes.find((candidate) => candidate.id === box.bonusFieldId);
          if (
            !bonusBox ||
            bonusBox.type !== "field" ||
            bonusBox.fieldType !== "number"
          ) {
            errors.push(
              `boxes[${index}]: bonusFieldId '${box.bonusFieldId}' must reference a number field.`
            );
          }
        }
      }

      if (box.fieldType === "computed") {
        validateExpression(box.formula, `boxes[${index}].formula`, allBoxIds, errors);
      }
    }
  });

  if (xpPoolFieldCount > 1) {
    errors.push("Only one field can be marked as isXpPool.");
  }

  const xpProgressionEntries = [
    ["stats", schema.xpProgression?.stats],
    ["skills", schema.xpProgression?.skills],
    ["powers", schema.xpProgression?.powers],
  ];
  xpProgressionEntries.forEach(([categoryName, table]) => {
    if (!Array.isArray(table) || table.length === 0) {
      errors.push(`xpProgression.${categoryName}: must include at least level 1.`);
      return;
    }

    let previousLevel = 0;
    let previousCumulative = 0;
    table.forEach((entry, entryIndex) => {
      if (!Number.isInteger(entry.level) || entry.level <= 0) {
        errors.push(`xpProgression.${categoryName}[${entryIndex}]: level must be a positive integer.`);
      }
      if (!Number.isFinite(entry.cumulative) || entry.cumulative < 0) {
        errors.push(`xpProgression.${categoryName}[${entryIndex}]: cumulative must be >= 0.`);
      }
      if (entryIndex === 0 && entry.level !== 1) {
        errors.push(`xpProgression.${categoryName}[0]: first level must be 1.`);
      }
      if (entry.level <= previousLevel) {
        errors.push(`xpProgression.${categoryName}[${entryIndex}]: levels must be strictly increasing.`);
      }
      if (entry.cumulative < previousCumulative) {
        errors.push(`xpProgression.${categoryName}[${entryIndex}]: cumulative must be non-decreasing.`);
      }
      previousLevel = entry.level;
      previousCumulative = entry.cumulative;
    });
  });

  schema.relations.forEach((relation, index) => {
    if (!ALLOWED_RELATION_TYPES.has(relation.type)) {
      errors.push(`relations[${index}]: invalid type '${relation.type}'.`);
    }
    if (!allBoxIds.has(relation.sourceBoxId)) {
      errors.push(
        `relations[${index}]: sourceBoxId '${relation.sourceBoxId}' does not exist.`
      );
    }
    if (!allBoxIds.has(relation.targetBoxId)) {
      errors.push(
        `relations[${index}]: targetBoxId '${relation.targetBoxId}' does not exist.`
      );
    }
  });

  schema.rules.forEach((rule, index) => {
    validateExpression(rule.condition, `rules[${index}].condition`, allBoxIds, errors);
    if (!Array.isArray(rule.effects) || rule.effects.length === 0) {
      errors.push(`rules[${index}]: effects must include at least one effect.`);
      return;
    }
    rule.effects.forEach((effect, effectIndex) => {
      if (!ALLOWED_EFFECT_TYPES.has(effect.type)) {
        errors.push(
          `rules[${index}].effects[${effectIndex}]: invalid type '${effect.type}'.`
        );
      }
      if (!allBoxIds.has(effect.targetBoxId)) {
        errors.push(
          `rules[${index}].effects[${effectIndex}]: targetBoxId '${effect.targetBoxId}' does not exist.`
        );
      }
      if (effect.type === "set" || effect.type === "add" || effect.type === "multiply") {
        validateExpression(
          effect.value,
          `rules[${index}].effects[${effectIndex}].value`,
          allBoxIds,
          errors
        );
      }
    });
  });

  const allSpellGroupIds = new Set();
  schema.spellGroups.forEach((group) => {
    if (group.id) allSpellGroupIds.add(group.id);
  });
  const allPowerTierIds = new Set();
  const seenPowerTierIds = new Set();
  const seenPowerTierNames = new Set();
  schema.powerTiers.forEach((tier, index) => {
    if (!tier.id) {
      errors.push(`powerTiers[${index}]: id is required.`);
    } else if (seenPowerTierIds.has(tier.id)) {
      errors.push(`powerTiers[${index}]: duplicate id '${tier.id}'.`);
    } else {
      seenPowerTierIds.add(tier.id);
      allPowerTierIds.add(tier.id);
    }

    if (!tier.name) {
      errors.push(`powerTiers[${index}]: name is required.`);
    } else {
      const key = tier.name.toLowerCase();
      if (seenPowerTierNames.has(key)) {
        errors.push(`powerTiers[${index}]: duplicate name '${tier.name}'.`);
      } else {
        seenPowerTierNames.add(key);
      }
    }
  });

  const seenSpellGroupIds = new Set();
  const seenSpellGroupNames = new Set();
  schema.spellGroups.forEach((group, index) => {
    if (!group.id) {
      errors.push(`spellGroups[${index}]: id is required.`);
    } else if (seenSpellGroupIds.has(group.id)) {
      errors.push(`spellGroups[${index}]: duplicate id '${group.id}'.`);
    } else {
      seenSpellGroupIds.add(group.id);
    }

    if (!group.name) {
      errors.push(`spellGroups[${index}]: name is required.`);
    } else {
      const key = group.name.toLowerCase();
      if (seenSpellGroupNames.has(key)) {
        errors.push(`spellGroups[${index}]: duplicate name '${group.name}'.`);
      } else {
        seenSpellGroupNames.add(key);
      }
    }

    if (!ALLOWED_SPELL_GROUP_TIERS.has(group.tier)) {
      errors.push(`spellGroups[${index}]: invalid tier '${group.tier}'.`);
    }

    if (group.tierId && !allPowerTierIds.has(group.tierId)) {
      errors.push(`spellGroups[${index}]: tierId '${group.tierId}' does not exist.`);
    }

    if (group.tier === "custom" && !group.tierCustomLabel && !group.tierId) {
      errors.push(`spellGroups[${index}]: tierCustomLabel is required for custom tier.`);
    }

    if (group.linkedStatFieldId) {
      const linked = fieldById.get(group.linkedStatFieldId);
      if (!linked || linked.fieldType !== "number") {
        errors.push(
          `spellGroups[${index}]: linkedStatFieldId '${group.linkedStatFieldId}' must reference a number field.`
        );
      }
    }

    group.opposingGroupIds.forEach((opposingId, opposingIndex) => {
      if (opposingId === group.id) {
        errors.push(
          `spellGroups[${index}].opposingGroupIds[${opposingIndex}]: cannot reference itself.`
        );
        return;
      }
      if (!allSpellGroupIds.has(opposingId)) {
        errors.push(
          `spellGroups[${index}].opposingGroupIds[${opposingIndex}]: '${opposingId}' does not exist.`
        );
      }
    });
  });

  const seenSpellIds = new Set();
  const seenSpellNames = new Set();
  schema.spells.forEach((spell, index) => {
    if (!spell.id) {
      errors.push(`spells[${index}]: id is required.`);
    } else if (seenSpellIds.has(spell.id)) {
      errors.push(`spells[${index}]: duplicate id '${spell.id}'.`);
    } else {
      seenSpellIds.add(spell.id);
    }

    if (!spell.name) {
      errors.push(`spells[${index}]: name is required.`);
    } else {
      const key = spell.name.toLowerCase();
      if (seenSpellNames.has(key)) {
        errors.push(`spells[${index}]: duplicate name '${spell.name}'.`);
      } else {
        seenSpellNames.add(key);
      }
    }

    if (spell.groupId && !allSpellGroupIds.has(spell.groupId)) {
      errors.push(`spells[${index}]: groupId '${spell.groupId}' does not exist.`);
    }

    if (spell.tierId && !allPowerTierIds.has(spell.tierId)) {
      errors.push(`spells[${index}]: tierId '${spell.tierId}' does not exist.`);
    }

    if (!Array.isArray(spell.levels) || spell.levels.length === 0) {
      errors.push(`spells[${index}]: levels must include at least one level.`);
      return;
    }

    const sortedLevels = [...spell.levels].sort((left, right) => left.level - right.level);
    sortedLevels.forEach((level, sortedIndex) => {
      const expected = sortedIndex + 1;
      if (!Number.isInteger(level.level) || level.level <= 0) {
        errors.push(`spells[${index}].levels[${sortedIndex}]: level must be a positive integer.`);
      } else if (level.level !== expected) {
        errors.push(
          `spells[${index}].levels[${sortedIndex}]: levels must be contiguous from 1.`
        );
      }

      level.effects.forEach((effect, effectIndex) => {
        const targets =
          Array.isArray(effect.targetFieldIds) && effect.targetFieldIds.length > 0
            ? effect.targetFieldIds
            : effect.targetFieldId
              ? [effect.targetFieldId]
              : [];
        const targetMode = ALLOWED_SPELL_EFFECT_TARGET_MODES.has(effect.targetMode)
          ? effect.targetMode
          : "single";

        if (targets.length === 0) {
          errors.push(
            `spells[${index}].levels[${sortedIndex}].effects[${effectIndex}]: at least one target field is required.`
          );
        }
        if (targetMode === "single" && targets.length !== 1) {
          errors.push(
            `spells[${index}].levels[${sortedIndex}].effects[${effectIndex}]: single mode requires exactly one target.`
          );
        }
        if ((targetMode === "and" || targetMode === "or") && targets.length < 2) {
          errors.push(
            `spells[${index}].levels[${sortedIndex}].effects[${effectIndex}]: mode '${targetMode}' requires at least two targets.`
          );
        }

        targets.forEach((targetId, targetIndex) => {
          const target = fieldById.get(targetId);
          if (
            !target ||
            (target.fieldType !== "number" && target.fieldType !== "computed")
          ) {
            errors.push(
              `spells[${index}].levels[${sortedIndex}].effects[${effectIndex}].targetFieldIds[${targetIndex}]: '${targetId}' must reference a number or computed field.`
            );
          }
        });

        if (!ALLOWED_SPELL_EFFECT_OPS.has(effect.operation)) {
          errors.push(
            `spells[${index}].levels[${sortedIndex}].effects[${effectIndex}]: invalid operation '${effect.operation}'.`
          );
        }
        if (!Number.isFinite(effect.value)) {
          errors.push(
            `spells[${index}].levels[${sortedIndex}].effects[${effectIndex}]: value must be a finite number.`
          );
        }
      });
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    normalizedSchema: schema,
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    return lowered === "true" || lowered === "1" || lowered === "yes";
  }
  return Boolean(value);
}

function isTruthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return toBoolean(value);
}

function evalExpressionArgs(node, context, depth) {
  const args = asArray(node?.args);
  if (args.length > 0) {
    return args.map((child) => evaluateExpression(child, context, depth + 1));
  }

  return [
    evaluateExpression(node?.left, context, depth + 1),
    evaluateExpression(node?.right, context, depth + 1),
  ];
}

export function evaluateExpression(node, context, depth = 0) {
  if (depth > 40 || !isPlainObject(node)) return null;

  const op = safeTrim(node.op).toLowerCase();
  if (!ALLOWED_EXPRESSION_OPS.has(op)) return null;

  if (op === "literal") return node.value ?? null;
  if (op === "field") return context.values[safeTrim(node.fieldId)];
  if (op === "not") return !isTruthy(evaluateExpression(node.arg, context, depth + 1));
  if (op === "and") return evalExpressionArgs(node, context, depth).every((value) => isTruthy(value));
  if (op === "or") return evalExpressionArgs(node, context, depth).some((value) => isTruthy(value));
  if (op === "eq") {
    return (
      evaluateExpression(node.left, context, depth + 1) ===
      evaluateExpression(node.right, context, depth + 1)
    );
  }
  if (op === "neq") {
    return (
      evaluateExpression(node.left, context, depth + 1) !==
      evaluateExpression(node.right, context, depth + 1)
    );
  }
  if (op === "gt") {
    return (
      toNumber(evaluateExpression(node.left, context, depth + 1)) >
      toNumber(evaluateExpression(node.right, context, depth + 1))
    );
  }
  if (op === "gte") {
    return (
      toNumber(evaluateExpression(node.left, context, depth + 1)) >=
      toNumber(evaluateExpression(node.right, context, depth + 1))
    );
  }
  if (op === "lt") {
    return (
      toNumber(evaluateExpression(node.left, context, depth + 1)) <
      toNumber(evaluateExpression(node.right, context, depth + 1))
    );
  }
  if (op === "lte") {
    return (
      toNumber(evaluateExpression(node.left, context, depth + 1)) <=
      toNumber(evaluateExpression(node.right, context, depth + 1))
    );
  }
  if (op === "in") {
    const left = evaluateExpression(node.left, context, depth + 1);
    const right = evaluateExpression(node.right, context, depth + 1);
    if (Array.isArray(right)) return right.includes(left);
    if (typeof right === "string") {
      return right.split(",").map((token) => token.trim()).includes(String(left));
    }
    return false;
  }
  if (op === "add") {
    return evalExpressionArgs(node, context, depth).reduce(
      (sum, value) => sum + toNumber(value),
      0
    );
  }
  if (op === "sub") {
    const values = evalExpressionArgs(node, context, depth).map((value) => toNumber(value));
    if (values.length === 0) return 0;
    return values.slice(1).reduce((acc, value) => acc - value, values[0]);
  }
  if (op === "mul") {
    const values = evalExpressionArgs(node, context, depth).map((value) => toNumber(value));
    if (values.length === 0) return 0;
    return values.reduce((acc, value) => acc * value, 1);
  }
  if (op === "div") {
    const values = evalExpressionArgs(node, context, depth).map((value) => toNumber(value));
    if (values.length === 0) return 0;
    return values.slice(1).reduce((acc, value) => (value === 0 ? acc : acc / value), values[0]);
  }
  if (op === "min") {
    const values = evalExpressionArgs(node, context, depth).map((value) => toNumber(value));
    return values.length === 0 ? 0 : Math.min(...values);
  }
  if (op === "max") {
    const values = evalExpressionArgs(node, context, depth).map((value) => toNumber(value));
    return values.length === 0 ? 0 : Math.max(...values);
  }
  if (op === "round") return Math.round(toNumber(evaluateExpression(node.arg, context, depth + 1)));
  if (op === "floor") return Math.floor(toNumber(evaluateExpression(node.arg, context, depth + 1)));
  if (op === "ceil") return Math.ceil(toNumber(evaluateExpression(node.arg, context, depth + 1)));
  if (op === "clamp") {
    const value = toNumber(evaluateExpression(node.value, context, depth + 1));
    const min = toNumber(evaluateExpression(node.min, context, depth + 1));
    const max = toNumber(evaluateExpression(node.max, context, depth + 1));
    return Math.min(Math.max(value, min), max);
  }

  return null;
}

function buildFieldIndex(schema) {
  const fieldById = new Map();
  schema.boxes.forEach((box) => {
    if (box.type === "field") {
      fieldById.set(box.id, box);
    }
  });
  return fieldById;
}

function defaultFieldValue(field) {
  if (field.defaultValue !== null && field.defaultValue !== undefined) {
    return coerceFieldValue(field, field.defaultValue).value;
  }
  if (field.fieldType === "number" || field.fieldType === "computed") return 0;
  if (field.fieldType === "text" || field.fieldType === "single_select") return "";
  if (field.fieldType === "boolean") return false;
  if (field.fieldType === "multi_select") return [];
  return null;
}

function coerceFieldValue(field, value) {
  if (field.fieldType === "number" || field.fieldType === "computed") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return { valid: false, value: 0 };
    return { valid: true, value: parsed };
  }
  if (field.fieldType === "text") return { valid: true, value: String(value ?? "") };
  if (field.fieldType === "boolean") return { valid: true, value: toBoolean(value) };
  if (field.fieldType === "single_select") {
    const text = String(value ?? "");
    if (field.options.length === 0 || text === "" || field.options.includes(text)) {
      return { valid: true, value: text };
    }
    return { valid: false, value: "" };
  }
  if (field.fieldType === "multi_select") {
    const values = asArray(value).map((item) => String(item));
    if (field.options.length === 0) return { valid: true, value: values };
    if (values.some((item) => !field.options.includes(item))) {
      return { valid: false, value: [] };
    }
    return { valid: true, value: [...new Set(values)] };
  }
  return { valid: true, value: value ?? null };
}

export function buildInitialValues(schemaInput) {
  const schema = normalizeRulesetSchema(schemaInput);
  const fieldById = buildFieldIndex(schema);
  const initialValues = {};
  fieldById.forEach((field, fieldId) => {
    initialValues[fieldId] = defaultFieldValue(field);
  });
  return initialValues;
}

export function evaluateRulesetRuntime(schemaInput, inputValues = {}, actorRole = "player") {
  const schema = normalizeRulesetSchema(schemaInput);
  const fieldById = buildFieldIndex(schema);
  const values = {};
  const rawValues = {};
  const computedValues = {};
  const derivedTotals = {};
  const enabled = {};
  let xpPoolFieldId = null;

  schema.boxes.forEach((box) => {
    enabled[box.id] = true;
  });

  fieldById.forEach((field, fieldId) => {
    values[fieldId] = defaultFieldValue(field);
    if (
      !xpPoolFieldId &&
      (field.fieldType === "number" || field.fieldType === "computed") &&
      field.isXpPool
    ) {
      xpPoolFieldId = fieldId;
    }
  });

  Object.entries(isPlainObject(inputValues) ? inputValues : {}).forEach(([fieldId, value]) => {
    const field = fieldById.get(fieldId);
    if (!field) return;
    if (field.fieldType === "computed") return;
    if (field.editableBy === "dm" && actorRole !== "dm") return;

    const coerced = coerceFieldValue(field, value);
    if (!coerced.valid) return;
    values[fieldId] = coerced.value;
    rawValues[fieldId] = coerced.value;
  });

  const context = { values, enabled };

  fieldById.forEach((field, fieldId) => {
    if (field.fieldType !== "computed") return;
    values[fieldId] = coerceFieldValue(field, evaluateExpression(field.formula, context)).value;
    computedValues[fieldId] = values[fieldId];
  });

  schema.relations.forEach((relation) => {
    const sourceOn = isTruthy(values[relation.sourceBoxId]);
    if (relation.type === "requires") {
      enabled[relation.targetBoxId] = enabled[relation.targetBoxId] && sourceOn;
      return;
    }
    if (relation.type === "excludes" && sourceOn) {
      enabled[relation.targetBoxId] = false;
      return;
    }
    if (relation.type === "grants" && sourceOn) {
      enabled[relation.targetBoxId] = true;
      return;
    }
    if (relation.type === "modifies" && sourceOn) {
      const target = fieldById.get(relation.targetBoxId);
      if (!target) return;
      if (target.fieldType !== "number" && target.fieldType !== "computed") return;
      const dynamicValue = evaluateExpression(relation.valueExpr, context);
      const modifier = dynamicValue ?? relation.modifier ?? 0;
      values[relation.targetBoxId] = toNumber(values[relation.targetBoxId]) + toNumber(modifier);
    }
  });

  schema.rules.forEach((rule) => {
    if (!isTruthy(evaluateExpression(rule.condition, context))) return;

    rule.effects.forEach((effect) => {
      const target = fieldById.get(effect.targetBoxId);
      if (effect.type === "enable") {
        enabled[effect.targetBoxId] = true;
        return;
      }
      if (effect.type === "disable") {
        enabled[effect.targetBoxId] = false;
        return;
      }
      if (!target) return;

      const evaluated = evaluateExpression(effect.value, context);
      if (effect.type === "set") {
        values[effect.targetBoxId] = coerceFieldValue(target, evaluated).value;
      } else if (effect.type === "add") {
        values[effect.targetBoxId] =
          toNumber(values[effect.targetBoxId]) + toNumber(evaluated);
      } else if (effect.type === "multiply") {
        values[effect.targetBoxId] =
          toNumber(values[effect.targetBoxId]) * toNumber(evaluated);
      }
    });
  });

  fieldById.forEach((field, fieldId) => {
    if (field.fieldType !== "computed") return;
    values[fieldId] = coerceFieldValue(field, evaluateExpression(field.formula, context)).value;
    computedValues[fieldId] = values[fieldId];
  });

  fieldById.forEach((field, fieldId) => {
    if (field.fieldType !== "number") return;
    if (!field.bonusFieldId || !fieldById.has(field.bonusFieldId)) return;
    derivedTotals[fieldId] =
      toNumber(values[fieldId]) + toNumber(values[field.bonusFieldId]);
  });

  return {
    schema,
    values,
    rawValues,
    computedValues,
    derivedTotals,
    xpPoolFieldId,
    enabled,
  };
}

export function buildBoxTree(schemaInput) {
  const schema = normalizeRulesetSchema(schemaInput);
  const byParent = new Map();
  schema.boxes.forEach((box) => {
    const parentKey = box.parentId || "__root__";
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey).push(box);
  });

  byParent.forEach((items) => {
    items.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  });

  function walk(parentKey = "__root__", depth = 0) {
    return (byParent.get(parentKey) || []).map((box) => ({
      ...box,
      depth,
      children: walk(box.id, depth + 1),
    }));
  }

  return walk("__root__", 0);
}

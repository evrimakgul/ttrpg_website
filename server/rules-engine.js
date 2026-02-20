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

const EMPTY_RULESET_SCHEMA = Object.freeze({
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

function cloneEmptySchema() {
  return {
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
  };
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function safeTrim(value) {
  return String(value || "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function normalizeExpression(node) {
  if (!isPlainObject(node)) {
    return { op: "literal", value: null };
  }

  const op = safeTrim(node.op).toLowerCase();
  if (!ALLOWED_EXPRESSION_OPS.has(op)) {
    return { op: "literal", value: null };
  }

  if (op === "literal") {
    return { op: "literal", value: node.value ?? null };
  }

  if (op === "field") {
    return { op: "field", fieldId: safeTrim(node.fieldId) };
  }

  if (op === "not") {
    return {
      op: "not",
      arg: normalizeExpression(node.arg),
    };
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
    const rawArgs = asArray(node.args);
    if (rawArgs.length > 0) {
      return {
        op,
        args: rawArgs.map((child) => normalizeExpression(child)),
      };
    }

    return {
      op,
      args: [normalizeExpression(node.left), normalizeExpression(node.right)],
    };
  }

  if (
    op === "eq" ||
    op === "neq" ||
    op === "gt" ||
    op === "gte" ||
    op === "lt" ||
    op === "lte" ||
    op === "in"
  ) {
    return {
      op,
      left: normalizeExpression(node.left),
      right: normalizeExpression(node.right),
    };
  }

  if (op === "round" || op === "floor" || op === "ceil") {
    return {
      op,
      arg: normalizeExpression(node.arg),
    };
  }

  return { op: "literal", value: null };
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

function normalizeRulesetSchema(input) {
  if (!isPlainObject(input)) {
    return cloneEmptySchema();
  }

  const schema = cloneEmptySchema();
  schema.schemaVersion = 1;

  schema.categories = asArray(input.categories).map((category, index) => ({
    id: safeTrim(category?.id) || `category_${index + 1}`,
    name: safeTrim(category?.name) || `Category ${index + 1}`,
    enabled: category?.enabled !== false,
  }));

  schema.boxes = asArray(input.boxes).map((box, index) => {
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
      const limit = Number(box?.repeatLimit);
      normalized.repeatLimit = Number.isInteger(limit) && limit > 0 ? limit : null;
    }

    return normalized;
  });

  schema.relations = asArray(input.relations).map((relation, index) => ({
    id: safeTrim(relation?.id) || `relation_${index + 1}`,
    type: ALLOWED_RELATION_TYPES.has(relation?.type) ? relation.type : "requires",
    sourceBoxId: safeTrim(relation?.sourceBoxId),
    targetBoxId: safeTrim(relation?.targetBoxId),
    modifier: Number.isFinite(Number(relation?.modifier))
      ? Number(relation.modifier)
      : 0,
    valueExpr: normalizeExpression(relation?.valueExpr),
  }));

  schema.rules = asArray(input.rules).map((rule, index) => ({
    id: safeTrim(rule?.id) || `rule_${index + 1}`,
    name: safeTrim(rule?.name) || `Rule ${index + 1}`,
    condition: normalizeExpression(rule?.condition),
    effects: asArray(rule?.effects).map((effect, effectIndex) => ({
      id: safeTrim(effect?.id) || `effect_${index + 1}_${effectIndex + 1}`,
      type: ALLOWED_EFFECT_TYPES.has(effect?.type) ? effect.type : "set",
      targetBoxId: safeTrim(effect?.targetBoxId),
      value: normalizeExpression(effect?.value),
    })),
  }));

  schema.xpProgression = normalizeXpProgression(input.xpProgression);
  schema.powerConfig = normalizePowerConfig(input.powerConfig);
  schema.powerTiers = asArray(input.powerTiers).map((tier, index) =>
    normalizePowerTier(tier, index)
  );

  schema.spellGroups = asArray(input.spellGroups).map((group, index) =>
    normalizeSpellGroup(group, index)
  );

  schema.spells = asArray(input.spells).map((spell, index) =>
    normalizeSpell(spell, index)
  );

  return schema;
}

function validateExpression(node, path, boxIdSet, errors) {
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
    } else if (!boxIdSet.has(fieldId)) {
      errors.push(`${path}: fieldId '${fieldId}' does not exist.`);
    }
    return;
  }

  if (op === "not" || op === "round" || op === "floor" || op === "ceil") {
    validateExpression(node.arg, `${path}.${op}.arg`, boxIdSet, errors);
    return;
  }

  if (op === "clamp") {
    validateExpression(node.value, `${path}.clamp.value`, boxIdSet, errors);
    validateExpression(node.min, `${path}.clamp.min`, boxIdSet, errors);
    validateExpression(node.max, `${path}.clamp.max`, boxIdSet, errors);
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
      validateExpression(child, `${path}.${op}.args[${index}]`, boxIdSet, errors);
    });
    return;
  }

  validateExpression(node.left, `${path}.${op}.left`, boxIdSet, errors);
  validateExpression(node.right, `${path}.${op}.right`, boxIdSet, errors);
}

function validateRulesetSchema(inputSchema) {
  const schema = normalizeRulesetSchema(inputSchema);
  const errors = [];
  let xpPoolFieldCount = 0;

  if (schema.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1.");
  }

  const allBoxIds = new Set();
  schema.boxes.forEach((box) => {
    if (box.id) {
      allBoxIds.add(box.id);
    }
  });
  const fieldById = new Map(
    schema.boxes
      .filter((box) => box.type === "field")
      .map((box) => [box.id, box])
  );

  const seenBoxIds = new Set();
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
    } else if (box.parentId) {
      const parent = schema.boxes.find((candidate) => candidate.id === box.parentId);
      if (parent && parent.type === "field") {
        errors.push(`boxes[${index}]: parentId '${box.parentId}' cannot target a field.`);
      }
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
        validateExpression(
          box.formula,
          `boxes[${index}].formula`,
          allBoxIds,
          errors
        );
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
    validateExpression(
      relation.valueExpr,
      `relations[${index}].valueExpr`,
      allBoxIds,
      errors
    );
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

function getExpressionArgs(node, context, depth) {
  const args = asArray(node?.args);
  if (args.length > 0) {
    return args.map((child) => evaluateExpression(child, context, depth + 1));
  }

  return [
    evaluateExpression(node?.left, context, depth + 1),
    evaluateExpression(node?.right, context, depth + 1),
  ];
}

function evaluateExpression(node, context, depth = 0) {
  if (depth > 40 || !isPlainObject(node)) {
    return null;
  }

  const op = safeTrim(node.op).toLowerCase();
  if (!ALLOWED_EXPRESSION_OPS.has(op)) {
    return null;
  }

  if (op === "literal") return node.value ?? null;
  if (op === "field") return context.values[safeTrim(node.fieldId)];
  if (op === "not") return !isTruthy(evaluateExpression(node.arg, context, depth + 1));

  if (op === "and") {
    return getExpressionArgs(node, context, depth).every((value) => isTruthy(value));
  }
  if (op === "or") {
    return getExpressionArgs(node, context, depth).some((value) => isTruthy(value));
  }

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
    const leftValue = evaluateExpression(node.left, context, depth + 1);
    const rightValue = evaluateExpression(node.right, context, depth + 1);
    if (Array.isArray(rightValue)) {
      return rightValue.includes(leftValue);
    }
    if (typeof rightValue === "string") {
      return rightValue.split(",").map((token) => token.trim()).includes(String(leftValue));
    }
    return false;
  }

  if (op === "add") {
    return getExpressionArgs(node, context, depth).reduce(
      (sum, value) => sum + toNumber(value),
      0
    );
  }

  if (op === "sub") {
    const values = getExpressionArgs(node, context, depth).map((value) => toNumber(value));
    if (values.length === 0) return 0;
    return values.slice(1).reduce((acc, value) => acc - value, values[0]);
  }

  if (op === "mul") {
    const values = getExpressionArgs(node, context, depth).map((value) => toNumber(value));
    if (values.length === 0) return 0;
    return values.reduce((acc, value) => acc * value, 1);
  }

  if (op === "div") {
    const values = getExpressionArgs(node, context, depth).map((value) => toNumber(value));
    if (values.length === 0) return 0;
    return values.slice(1).reduce((acc, value) => {
      if (value === 0) return acc;
      return acc / value;
    }, values[0]);
  }

  if (op === "min") {
    const values = getExpressionArgs(node, context, depth).map((value) => toNumber(value));
    return values.length === 0 ? 0 : Math.min(...values);
  }

  if (op === "max") {
    const values = getExpressionArgs(node, context, depth).map((value) => toNumber(value));
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
    if (!Number.isFinite(parsed)) {
      return { valid: false, value: 0 };
    }
    return { valid: true, value: parsed };
  }

  if (field.fieldType === "text") {
    return { valid: true, value: String(value ?? "") };
  }

  if (field.fieldType === "boolean") {
    return { valid: true, value: toBoolean(value) };
  }

  if (field.fieldType === "single_select") {
    const text = String(value ?? "");
    if (field.options.length === 0 || text === "" || field.options.includes(text)) {
      return { valid: true, value: text };
    }
    return { valid: false, value: "" };
  }

  if (field.fieldType === "multi_select") {
    const items = asArray(value).map((item) => String(item));
    if (field.options.length === 0) {
      return { valid: true, value: items };
    }
    const invalid = items.some((item) => !field.options.includes(item));
    if (invalid) {
      return { valid: false, value: [] };
    }
    return { valid: true, value: [...new Set(items)] };
  }

  return { valid: true, value: value ?? null };
}

function evaluateRulesetRuntime(inputSchema, inputValues = {}, actorRole = "player") {
  const schema = normalizeRulesetSchema(inputSchema);
  const fieldById = buildFieldIndex(schema);
  const values = {};
  const rawValues = {};
  const computedValues = {};
  const derivedTotals = {};
  const enabled = {};
  const errors = [];
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
    if (!coerced.valid) {
      errors.push(`Invalid value for field '${fieldId}'.`);
      return;
    }
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
    const sourceValue = values[relation.sourceBoxId];
    const sourceIsOn = isTruthy(sourceValue);

    if (relation.type === "requires") {
      enabled[relation.targetBoxId] = enabled[relation.targetBoxId] && sourceIsOn;
      return;
    }

    if (relation.type === "excludes" && sourceIsOn) {
      enabled[relation.targetBoxId] = false;
      return;
    }

    if (relation.type === "grants" && sourceIsOn) {
      enabled[relation.targetBoxId] = true;
      return;
    }

    if (relation.type === "modifies" && sourceIsOn) {
      const targetField = fieldById.get(relation.targetBoxId);
      if (!targetField) return;
      if (targetField.fieldType !== "number" && targetField.fieldType !== "computed") return;

      const dynamicModifier = evaluateExpression(relation.valueExpr, context);
      const fallbackModifier =
        Number.isFinite(relation.modifier) && relation.modifier !== 0
          ? relation.modifier
          : 0;

      const modifier =
        dynamicModifier !== null && dynamicModifier !== undefined
          ? toNumber(dynamicModifier)
          : fallbackModifier;

      values[relation.targetBoxId] = toNumber(values[relation.targetBoxId]) + modifier;
    }
  });

  schema.rules.forEach((rule) => {
    if (!isTruthy(evaluateExpression(rule.condition, context))) {
      return;
    }

    rule.effects.forEach((effect) => {
      const targetField = fieldById.get(effect.targetBoxId);

      if (effect.type === "enable") {
        enabled[effect.targetBoxId] = true;
        return;
      }

      if (effect.type === "disable") {
        enabled[effect.targetBoxId] = false;
        return;
      }

      if (!targetField) return;
      const value = evaluateExpression(effect.value, context);

      if (effect.type === "set") {
        values[effect.targetBoxId] = coerceFieldValue(targetField, value).value;
        return;
      }

      if (effect.type === "add") {
        values[effect.targetBoxId] =
          toNumber(values[effect.targetBoxId]) + toNumber(value);
        return;
      }

      if (effect.type === "multiply") {
        values[effect.targetBoxId] =
          toNumber(values[effect.targetBoxId]) * toNumber(value);
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
    errors,
  };
}

module.exports = {
  EMPTY_RULESET_SCHEMA,
  normalizeRulesetSchema,
  validateRulesetSchema,
  evaluateExpression,
  evaluateRulesetRuntime,
};

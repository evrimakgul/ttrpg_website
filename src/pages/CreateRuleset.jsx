import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  buildStarterTemplate,
  makeId,
  normalizeRulesetSchema,
  validateRulesetSchema,
} from "../lib/rulesEngine";
import SpellBuilderModal from "../components/SpellBuilderModal";

const SECTION_OPTIONS = [
  { id: "all", label: "(all)" },
  { id: "bio", label: "Bio" },
  { id: "combat_summary", label: "Combat Summary" },
  { id: "stats_attributes", label: "Stats/Attributes" },
  { id: "skills_abilities", label: "Skills/Abilities" },
  { id: "powers", label: "Powers" },
  { id: "equipment", label: "Equipment" },
  { id: "inventory", label: "Inventory" },
  { id: "merits_flaws", label: "Merits/Flaws" },
  { id: "connections", label: "Connections" },
  { id: "custom", label: "Custom" },
];

const ROOT_IDS = {
  bio: "managed_section_bio",
  combatSummary: "managed_section_combat_summary",
  stats: "managed_section_stats_attributes",
  skills: "managed_section_skills_abilities",
  powers: "managed_section_powers",
  equipment: "managed_section_equipment",
  inventory: "managed_section_inventory",
  meritsFlaws: "managed_section_merits_flaws",
  connections: "managed_section_connections",
  custom: "managed_section_custom",
};

const SECTION_ROOT_ID_BY_ID = {
  bio: ROOT_IDS.bio,
  combat_summary: ROOT_IDS.combatSummary,
  stats_attributes: ROOT_IDS.stats,
  skills_abilities: ROOT_IDS.skills,
  powers: ROOT_IDS.powers,
  equipment: ROOT_IDS.equipment,
  inventory: ROOT_IDS.inventory,
  merits_flaws: ROOT_IDS.meritsFlaws,
  connections: ROOT_IDS.connections,
  custom: ROOT_IDS.custom,
};

const SUBGROUP_IDS = {
  combatDefensive: "managed_section_combat_defensive",
  combatOffensive: "managed_section_combat_offensive",
  statsPhysical: "managed_section_stats_physical",
  statsMental: "managed_section_stats_mental",
  statsSocial: "managed_section_stats_social",
  merits: "managed_section_merits_group",
  flaws: "managed_section_flaws_group",
};

const XP_FIELD_IDS = {
  earned: "managed_bio_xp_earned",
  used: "managed_bio_xp_used",
  leftover: "managed_bio_xp_leftover",
};

const PROTECTED_BIO_FIELD_IDS = new Set([
  XP_FIELD_IDS.earned,
  XP_FIELD_IDS.used,
  XP_FIELD_IDS.leftover,
]);

const XP_PROGRESSION_CATEGORIES = [
  { id: "stats", label: "Stats" },
  { id: "skills", label: "Skills" },
  { id: "powers", label: "Powers" },
];

const DEFAULT_XP_PROGRESSION = Object.freeze({
  stats: [{ level: 1, cumulative: 0 }],
  skills: [{ level: 1, cumulative: 0 }],
  powers: [{ level: 1, cumulative: 0 }],
});

const LAYOUT_WIDTH_OPTIONS = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
  { id: "full", label: "Full" },
];

const LAYOUT_HEIGHT_OPTIONS = [
  { id: "compact", label: "Compact" },
  { id: "regular", label: "Regular" },
  { id: "tall", label: "Tall" },
];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeXpTableLocal(input) {
  const normalized = (Array.isArray(input) ? input : [])
    .map((entry) => ({
      level: Number(entry?.level),
      cumulative: Number(entry?.cumulative),
    }))
    .filter((entry) => Number.isInteger(entry.level) && entry.level > 0 && Number.isFinite(entry.cumulative))
    .sort((left, right) => left.level - right.level)
    .filter((entry, index, source) => index === 0 || source[index - 1].level !== entry.level)
    .map((entry) => ({ level: entry.level, cumulative: entry.cumulative < 0 ? 0 : entry.cumulative }));
  if (normalized.length === 0 || normalized[0].level !== 1) {
    return [{ level: 1, cumulative: 0 }, ...normalized.filter((entry) => entry.level !== 1)];
  }
  return normalized;
}

function defaultXpProgressionState(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    stats: normalizeXpTableLocal(raw.stats || DEFAULT_XP_PROGRESSION.stats),
    skills: normalizeXpTableLocal(raw.skills || DEFAULT_XP_PROGRESSION.skills),
    powers: normalizeXpTableLocal(raw.powers || DEFAULT_XP_PROGRESSION.powers),
  };
}

function getBoxLayout(box) {
  return {
    width: box?.layout?.width || "full",
    height: box?.layout?.height || "regular",
  };
}

function widthClass(width) {
  if (width === "small") return "md:col-span-3";
  if (width === "medium") return "md:col-span-6";
  if (width === "large") return "md:col-span-8";
  return "md:col-span-12";
}

function minHeightClass(height) {
  if (height === "compact") return "min-h-[52px]";
  if (height === "tall") return "min-h-[112px]";
  return "min-h-[76px]";
}

function sectionWrapperClass(layout) {
  return `${widthClass(layout?.width)} ${minHeightClass(layout?.height)}`;
}

function fieldWrapperClass(layout) {
  return `${widthClass(layout?.width)}`;
}

function captureLayoutSnapshot(schemaInput) {
  const schema = normalizeRulesetSchema(schemaInput);
  return schema.boxes.map((box) => ({
    id: box.id,
    order: Number.isFinite(Number(box.order)) ? Number(box.order) : 0,
    layout: {
      width: box.layout?.width || "full",
      height: box.layout?.height || "regular",
    },
  }));
}

function layoutSnapshotsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const leftMap = new Map(left.map((entry) => [entry.id, entry]));
  for (const entry of right) {
    const existing = leftMap.get(entry.id);
    if (!existing) return false;
    if (Number(existing.order) !== Number(entry.order)) return false;
    if (existing.layout?.width !== entry.layout?.width) return false;
    if (existing.layout?.height !== entry.layout?.height) return false;
  }
  return true;
}

function applyLayoutSnapshot(schemaInput, snapshot) {
  const schema = normalizeRulesetSchema(schemaInput);
  const byId = new Map((snapshot || []).map((entry) => [entry.id, entry]));
  schema.boxes = schema.boxes.map((box) => {
    const hit = byId.get(box.id);
    if (!hit) return box;
    return {
      ...box,
      order: Number.isFinite(Number(hit.order)) ? Number(hit.order) : box.order,
      layout: {
        width: hit.layout?.width || "full",
        height: hit.layout?.height || "regular",
      },
    };
  });
  return schema;
}

function reindexSiblings(boxes, siblingIds) {
  const orderById = new Map(siblingIds.map((id, index) => [id, index]));
  return boxes.map((box) =>
    orderById.has(box.id)
      ? {
          ...box,
          order: orderById.get(box.id),
        }
      : box
  );
}

function makeGroupBox(id, label, parentId, categoryId, order) {
  return {
    id,
    type: "group",
    label,
    parentId: parentId || null,
    categoryId: categoryId || null,
    order,
    layout: {
      width: "full",
      height: "regular",
    },
  };
}

function makeFieldBox({
  id,
  label,
  key,
  parentId,
  categoryId,
  order,
  fieldType = "text",
  defaultValue = "",
  editableBy = "player",
  options = [],
  formula,
  hidden = false,
  isXpPool = false,
  xpUpgradable = false,
  xpCost = 0,
  xpStep = 1,
  xpMax = null,
  xpCategory = null,
  bonusFieldId = null,
  layout,
}) {
  const resolvedLayout = getBoxLayout({ layout });
  return {
    id,
    type: "field",
    label,
    parentId: parentId || null,
    categoryId: categoryId || null,
    order,
    fieldType,
    key,
    editableBy,
    defaultValue,
    options,
    hidden,
    formula:
      formula ||
      (fieldType === "computed"
        ? { op: "literal", value: 0 }
        : { op: "literal", value: defaultValue }),
    isXpPool,
    xpUpgradable,
    xpCost,
    xpStep,
    xpMax,
    xpCategory,
    bonusFieldId,
    layout: resolvedLayout,
  };
}

function ensureCategory(schema, name) {
  const found = schema.categories.find(
    (category) => String(category.name || "").trim().toLowerCase() === name.toLowerCase()
  );
  if (found) {
    found.enabled = true;
    return found;
  }
  const category = {
    id: makeId("category"),
    name,
    enabled: true,
  };
  schema.categories.push(category);
  return category;
}

function ensureGroup(schema, id, label, parentId, categoryId) {
  const found = schema.boxes.find((box) => box.id === id);
  if (found) return found;
  const group = makeGroupBox(id, label, parentId, categoryId, schema.boxes.length);
  schema.boxes.push(group);
  return group;
}

function ensureField(schema, spec) {
  if (schema.boxes.some((box) => box.id === spec.id)) return;
  schema.boxes.push(
    makeFieldBox({
      ...spec,
      order: schema.boxes.length,
    })
  );
}

function collectFieldIdsFromExpression(expression, fieldIds = new Set()) {
  if (!expression || typeof expression !== "object") return fieldIds;

  if (expression.op === "field" && expression.fieldId) {
    fieldIds.add(expression.fieldId);
  }
  if (Array.isArray(expression.args)) {
    expression.args.forEach((child) => collectFieldIdsFromExpression(child, fieldIds));
  }
  collectFieldIdsFromExpression(expression.left, fieldIds);
  collectFieldIdsFromExpression(expression.right, fieldIds);
  collectFieldIdsFromExpression(expression.arg, fieldIds);
  collectFieldIdsFromExpression(expression.value, fieldIds);
  collectFieldIdsFromExpression(expression.min, fieldIds);
  collectFieldIdsFromExpression(expression.max, fieldIds);

  return fieldIds;
}

function ruleTouchesIds(rule, ids) {
  const touchedIds = new Set();
  collectFieldIdsFromExpression(rule.condition, touchedIds);
  (rule.effects || []).forEach((effect) => {
    if (effect.targetBoxId) {
      touchedIds.add(effect.targetBoxId);
    }
    collectFieldIdsFromExpression(effect.value, touchedIds);
  });
  for (const touchedId of touchedIds) {
    if (ids.has(touchedId)) return true;
  }
  return false;
}

function initializeSchema(inputSchema) {
  const next = normalizeRulesetSchema(inputSchema);
  const categoryBySection = {};
  const managedAlreadyExists = next.boxes.some((box) =>
    String(box.id || "").startsWith("managed_section_")
  );
  next.xpProgression = defaultXpProgressionState(next.xpProgression);

  SECTION_OPTIONS.filter((option) => option.id !== "all").forEach((option) => {
    const category = ensureCategory(next, option.label);
    categoryBySection[option.id] = category.id;
  });

  ensureGroup(next, ROOT_IDS.bio, "Bio", null, categoryBySection.bio);
  ensureGroup(next, ROOT_IDS.combatSummary, "Combat Summary", null, categoryBySection.combat_summary);
  ensureGroup(next, ROOT_IDS.stats, "Stats/Attributes", null, categoryBySection.stats_attributes);
  ensureGroup(next, ROOT_IDS.skills, "Skills/Abilities", null, categoryBySection.skills_abilities);
  ensureGroup(next, ROOT_IDS.powers, "Powers", null, categoryBySection.powers);
  ensureGroup(next, ROOT_IDS.equipment, "Equipment", null, categoryBySection.equipment);
  ensureGroup(next, ROOT_IDS.inventory, "Inventory", null, categoryBySection.inventory);
  ensureGroup(next, ROOT_IDS.meritsFlaws, "Merits/Flaws", null, categoryBySection.merits_flaws);
  ensureGroup(next, ROOT_IDS.connections, "Connections", null, categoryBySection.connections);
  ensureGroup(next, ROOT_IDS.custom, "Custom", null, categoryBySection.custom);

  ensureGroup(next, SUBGROUP_IDS.combatDefensive, "Defensive", ROOT_IDS.combatSummary, categoryBySection.combat_summary);
  ensureGroup(next, SUBGROUP_IDS.combatOffensive, "Offensive", ROOT_IDS.combatSummary, categoryBySection.combat_summary);
  ensureGroup(next, SUBGROUP_IDS.statsPhysical, "Physical", ROOT_IDS.stats, categoryBySection.stats_attributes);
  ensureGroup(next, SUBGROUP_IDS.statsMental, "Mental", ROOT_IDS.stats, categoryBySection.stats_attributes);
  ensureGroup(next, SUBGROUP_IDS.statsSocial, "Social", ROOT_IDS.stats, categoryBySection.stats_attributes);
  ensureGroup(next, SUBGROUP_IDS.merits, "Merits", ROOT_IDS.meritsFlaws, categoryBySection.merits_flaws);
  ensureGroup(next, SUBGROUP_IDS.flaws, "Flaws", ROOT_IDS.meritsFlaws, categoryBySection.merits_flaws);

  if (!managedAlreadyExists) {
    const bioFields = [
      { id: "managed_bio_name", label: "Name", key: "name", fieldType: "text", defaultValue: "" },
      { id: "managed_bio_player", label: "Player", key: "player", fieldType: "text", defaultValue: "" },
      { id: "managed_bio_age", label: "Age", key: "age", fieldType: "number", defaultValue: 0 },
      { id: "managed_bio_demeanor", label: "Demeanor", key: "demeanor", fieldType: "text", defaultValue: "" },
      { id: "managed_bio_inspiration", label: "Inspiration", key: "inspiration", fieldType: "text", defaultValue: "" },
      { id: "managed_bio_neg_karma", label: "Neg. Karma", key: "neg_karma", fieldType: "number", defaultValue: 0 },
      { id: "managed_bio_pos_karma", label: "Pos. Karma", key: "pos_karma", fieldType: "number", defaultValue: 0 },
      { id: "managed_bio_money", label: "Money", key: "money", fieldType: "number", defaultValue: 0 },
      { id: XP_FIELD_IDS.earned, label: "XP Earned", key: "xp_earned", fieldType: "number", defaultValue: 0, editableBy: "dm" },
      { id: XP_FIELD_IDS.used, label: "XP Used", key: "xp_used", fieldType: "number", defaultValue: 0, editableBy: "dm" },
      {
        id: XP_FIELD_IDS.leftover,
        label: "XP Left Over",
        key: "xp_leftover",
        fieldType: "computed",
        defaultValue: 0,
        editableBy: "dm",
        isXpPool: true,
        formula: {
          op: "sub",
          args: [
            { op: "field", fieldId: XP_FIELD_IDS.earned },
            { op: "field", fieldId: XP_FIELD_IDS.used },
          ],
        },
      },
      { id: "managed_bio_game_session", label: "Game Session", key: "game_session", fieldType: "text", defaultValue: "" },
    ];

    bioFields.forEach((field) =>
      ensureField(next, {
        ...field,
        parentId: ROOT_IDS.bio,
        categoryId: categoryBySection.bio,
      })
    );

    const combatDefensiveFields = [
      ["managed_combat_mana", "Mana", "mana", "computed"],
      ["managed_combat_hp", "HP", "hp", "computed"],
      ["managed_combat_mana_regen", "Mana Regen / per hour", "mana_regen_per_hour", "computed"],
      ["managed_combat_hp_regen", "HP Regen", "hp_regen", "computed"],
      ["managed_combat_ac", "AC (Dex)", "ac_dex", "computed"],
      ["managed_combat_dr", "DR", "dr", "computed"],
      ["managed_combat_resistances", "Resistance(s)", "resistances", "text"],
      ["managed_combat_soak", "Soak", "soak", "computed"],
    ];
    combatDefensiveFields.forEach(([id, label, key, fieldType]) =>
      ensureField(next, {
        id,
        label,
        key,
        fieldType,
        editableBy: "dm",
        defaultValue: fieldType === "computed" ? 0 : "",
        formula: fieldType === "computed" ? { op: "literal", value: 0 } : undefined,
        parentId: SUBGROUP_IDS.combatDefensive,
        categoryId: categoryBySection.combat_summary,
      })
    );

    const combatOffensiveFields = [
      ["managed_combat_initiative", "Initiative (Dex + Wits) d10", "initiative_dex_wits_d10", "computed"],
      ["managed_combat_melee_attack", "Melee Attack", "melee_attack", "computed"],
      ["managed_combat_melee_damage", "Melee Damage", "melee_damage", "computed"],
      ["managed_combat_range_attack", "Range Attack", "range_attack", "computed"],
      ["managed_combat_range_damage", "Range Damage", "range_damage", "computed"],
      ["managed_combat_spell_damage", "Spell Damage", "spell_damage", "computed"],
    ];
    combatOffensiveFields.forEach(([id, label, key, fieldType]) =>
      ensureField(next, {
        id,
        label,
        key,
        fieldType,
        editableBy: "dm",
        defaultValue: 0,
        formula: { op: "literal", value: 0 },
        parentId: SUBGROUP_IDS.combatOffensive,
        categoryId: categoryBySection.combat_summary,
      })
    );

    const stats = [
      ["managed_stats_str", "STR", "str", SUBGROUP_IDS.statsPhysical],
      ["managed_stats_dex", "DEX", "dex", SUBGROUP_IDS.statsPhysical],
      ["managed_stats_stam", "STAM", "stam", SUBGROUP_IDS.statsPhysical],
      ["managed_stats_int", "INT", "int", SUBGROUP_IDS.statsMental],
      ["managed_stats_per", "PER", "per", SUBGROUP_IDS.statsMental],
      ["managed_stats_wits", "WITS", "wits", SUBGROUP_IDS.statsMental],
      ["managed_stats_cha", "CHA", "cha", SUBGROUP_IDS.statsSocial],
      ["managed_stats_man", "MAN", "man", SUBGROUP_IDS.statsSocial],
      ["managed_stats_app", "APP", "app", SUBGROUP_IDS.statsSocial],
    ];
    stats.forEach(([id, label, key, parentId]) =>
      ensureField(next, {
        id,
        label,
        key,
        fieldType: "number",
        defaultValue: 1,
        xpUpgradable: true,
        xpStep: 1,
        xpCost: 1,
        xpCategory: "stats",
        parentId,
        categoryId: categoryBySection.stats_attributes,
      })
    );
    stats.forEach(([id, label, key, parentId]) =>
      ensureField(next, {
        id: `${id}_bonus`,
        label: `${label} Bonus`,
        key: `${key}_bonus`,
        fieldType: "number",
        defaultValue: 0,
        hidden: true,
        editableBy: "dm",
        parentId,
        categoryId: categoryBySection.stats_attributes,
      })
    );

    const skills = [
      "Melee",
      "Ranged",
      "Athletics",
      "Stealth",
      "Alertness",
      "Intimidation",
      "Social",
      "Medicine",
      "Technology",
      "Academics",
      "Mechanics",
      "Occultism",
    ];
    skills.forEach((label) =>
      ensureField(next, {
        id: `managed_skill_${slugify(label)}`,
        label,
        key: `skill_${slugify(label)}`,
        fieldType: "number",
        defaultValue: 1,
        xpUpgradable: true,
        xpStep: 1,
        xpCost: 1,
        xpCategory: "skills",
        parentId: ROOT_IDS.skills,
        categoryId: categoryBySection.skills_abilities,
      })
    );
    skills.forEach((label) =>
      ensureField(next, {
        id: `managed_skill_${slugify(label)}_bonus`,
        label: `${label} Bonus`,
        key: `skill_${slugify(label)}_bonus`,
        fieldType: "number",
        defaultValue: 0,
        hidden: true,
        editableBy: "dm",
        parentId: ROOT_IDS.skills,
        categoryId: categoryBySection.skills_abilities,
      })
    );
  }

  next.boxes = next.boxes.map((box) => {
    if (box.type !== "field") return box;

    if (box.id === XP_FIELD_IDS.leftover) {
      return {
        ...box,
        fieldType: "computed",
        isXpPool: true,
        formula: {
          op: "sub",
          args: [
            { op: "field", fieldId: XP_FIELD_IDS.earned },
            { op: "field", fieldId: XP_FIELD_IDS.used },
          ],
        },
      };
    }

    const isCombatField =
      box.parentId === SUBGROUP_IDS.combatDefensive || box.parentId === SUBGROUP_IDS.combatOffensive;
    if (isCombatField) {
      const isResistance = box.id === "managed_combat_resistances";
      if (isResistance) {
        return {
          ...box,
          fieldType: "text",
          editableBy: "dm",
          formula: { op: "literal", value: String(box.defaultValue ?? "") },
        };
      }
      if (box.fieldType !== "number" && box.fieldType !== "computed") {
        return {
          ...box,
          editableBy: "dm",
        };
      }
      const currentDefault = Number(box.defaultValue);
      return {
        ...box,
        fieldType: "computed",
        editableBy: "dm",
        defaultValue: Number.isFinite(currentDefault) ? currentDefault : 0,
        formula:
          box.formula && box.fieldType === "computed"
            ? box.formula
            : { op: "literal", value: Number.isFinite(currentDefault) ? currentDefault : 0 },
      };
    }

    return box;
  });

  const ensureManagedBonusPair = (field, xpCategory) => {
    if (!field || field.type !== "field" || field.fieldType !== "number") return;
    if (field.hidden) return;
    const bonusId = field.bonusFieldId || `${field.id}_bonus`;
    if (!next.boxes.some((box) => box.id === bonusId)) {
      next.boxes.push(
        makeFieldBox({
          id: bonusId,
          label: `${field.label} Bonus`,
          key: `${slugify(field.key || field.label || field.id)}_bonus`,
          parentId: field.parentId,
          categoryId: field.categoryId,
          order: next.boxes.length,
          fieldType: "number",
          defaultValue: 0,
          editableBy: "dm",
          hidden: true,
        })
      );
    }
    next.boxes = next.boxes.map((box) => {
      if (box.id !== field.id) return box;
      return {
        ...box,
        bonusFieldId: bonusId,
        xpUpgradable: true,
        xpStep: Number.isFinite(Number(box.xpStep)) && Number(box.xpStep) > 0 ? Number(box.xpStep) : 1,
        xpCost: Number.isFinite(Number(box.xpCost)) && Number(box.xpCost) >= 0 ? Number(box.xpCost) : 1,
        xpCategory,
      };
    });
  };

  next.boxes
    .filter((box) => box.type === "field" && box.parentId && box.parentId.startsWith("managed_section_stats_"))
    .forEach((field) => ensureManagedBonusPair(field, "stats"));
  next.boxes
    .filter((box) => box.type === "field" && box.parentId === ROOT_IDS.skills)
    .forEach((field) => ensureManagedBonusPair(field, "skills"));

  if (next.boxes.some((box) => box.id === XP_FIELD_IDS.leftover)) {
    next.boxes = next.boxes.map((box) =>
      box.id === XP_FIELD_IDS.leftover
        ? { ...box, isXpPool: true, fieldType: "computed", editableBy: "dm" }
        : box
    );
  }

  next.powerConfig = {
    useTiers: next.powerConfig?.useTiers !== false,
    usePowers: next.powerConfig?.usePowers !== false,
  };
  next.powerTiers = Array.isArray(next.powerTiers) ? next.powerTiers : [];

  return next;
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function SortableItem({ id, disabled, className, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(className, isDragging ? "opacity-60" : "")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function LayoutSelect({ value, options, onChange }) {
  return (
    <select
      className="rounded border bg-white px-2 py-1 text-[11px]"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SectionCard({
  title,
  isEditing,
  onToggleEdit,
  children,
  layoutMode,
  layout,
  onWidthChange,
  onHeightChange,
  onMoveUp,
  onMoveDown,
  disableMove,
}) {
  return (
    <section className={cx("rounded border p-4", minHeightClass(layout?.height))}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {layoutMode && (
            <>
              <LayoutSelect
                value={layout?.width || "full"}
                options={LAYOUT_WIDTH_OPTIONS}
                onChange={onWidthChange}
              />
              <LayoutSelect
                value={layout?.height || "regular"}
                options={LAYOUT_HEIGHT_OPTIONS}
                onChange={onHeightChange}
              />
              <button
                className="rounded bg-gray-100 px-2 py-1 text-[11px] disabled:opacity-50"
                type="button"
                onClick={onMoveUp}
                disabled={disableMove}
              >
                Up
              </button>
              <button
                className="rounded bg-gray-100 px-2 py-1 text-[11px] disabled:opacity-50"
                type="button"
                onClick={onMoveDown}
                disabled={disableMove}
              >
                Down
              </button>
            </>
          )}
          <button className="rounded bg-gray-100 px-3 py-1 text-xs" type="button" onClick={onToggleEdit}>
            {isEditing ? "Close Edit" : "Edit"}
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldRow({ box, isEditing, onRename, onDelete, note, layoutMode, onLayoutChange, onMoveUp, onMoveDown, disableMove }) {
  return (
    <div className={cx("rounded border p-2 text-xs", minHeightClass(box.layout?.height))}>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <input
            className="flex-1 rounded border p-1"
            value={box.label}
            onChange={(event) => onRename(box.id, event.target.value)}
          />
        ) : (
          <span className="flex-1">{box.label}</span>
        )}
        <span className="rounded bg-gray-100 px-2 py-1">{box.fieldType}</span>
        {isEditing && (
          <button className="rounded bg-red-100 px-2 py-1" type="button" onClick={() => onDelete(box.id)}>
            Delete
          </button>
        )}
      </div>
      {layoutMode && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <LayoutSelect
            value={box.layout?.width || "full"}
            options={LAYOUT_WIDTH_OPTIONS}
            onChange={(nextWidth) => onLayoutChange(box.id, { width: nextWidth })}
          />
          <LayoutSelect
            value={box.layout?.height || "regular"}
            options={LAYOUT_HEIGHT_OPTIONS}
            onChange={(nextHeight) => onLayoutChange(box.id, { height: nextHeight })}
          />
          <button
            className="rounded bg-gray-100 px-2 py-1 text-[11px] disabled:opacity-50"
            type="button"
            onClick={() => onMoveUp(box.id)}
            disabled={disableMove}
          >
            Up
          </button>
          <button
            className="rounded bg-gray-100 px-2 py-1 text-[11px] disabled:opacity-50"
            type="button"
            onClick={() => onMoveDown(box.id)}
            disabled={disableMove}
          >
            Down
          </button>
        </div>
      )}
      {note && <p className="mt-1 text-[11px] text-gray-500">{note}</p>}
    </div>
  );
}

export default function CreateRuleset() {
  const navigate = useNavigate();
  const { rulesetId } = useParams();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("gameId");

  const [rulesetName, setRulesetName] = useState("");
  const [schema, setSchema] = useState(() => initializeSchema(buildStarterTemplate()));
  const [activeSection, setActiveSection] = useState("all");
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [loading, setLoading] = useState(Boolean(rulesetId));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [spellBuilderOpen, setSpellBuilderOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState(false);
  const [layoutPast, setLayoutPast] = useState([]);
  const [layoutFuture, setLayoutFuture] = useState([]);
  const [editingSections, setEditingSections] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  useEffect(() => {
    const load = async () => {
      if (!rulesetId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await apiFetch(`/api/rulesets/${rulesetId}`);
        const current = data.ruleset || {};
        const loadedVersions = data.versions || [];

        setRulesetName(current.name || "");
        setSchema(initializeSchema(current.draft_schema || buildStarterTemplate()));
        setLayoutPast([]);
        setLayoutFuture([]);
        setVersions(loadedVersions);
        if (loadedVersions.length > 0) {
          setSelectedVersion(String(loadedVersions[0].version));
        }
      } catch (err) {
        setError(err.message || "Could not load ruleset.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [rulesetId]);

  const refreshVersions = async (id) => {
    try {
      const data = await apiFetch(`/api/rulesets/${id}/versions`);
      const nextVersions = data.versions || [];
      setVersions(nextVersions);
      if (nextVersions.length > 0) {
        setSelectedVersion(String(nextVersions[0].version));
      }
    } catch (err) {
      setError(err.message || "Could not load versions.");
    }
  };

  const persistDraft = async () => {
    const cleanedName = rulesetName.trim();
    if (!cleanedName) {
      setError("Ruleset must have a name.");
      return null;
    }

    const validation = validateRulesetSchema(schema);
    if (!validation.valid) {
      setError(validation.errors[0] || "Invalid schema.");
      return null;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (rulesetId) {
        const data = await apiFetch(`/api/rulesets/${rulesetId}`, {
          method: "PATCH",
          body: {
            name: cleanedName,
            draft_schema: validation.normalizedSchema,
          },
        });
        setSchema(initializeSchema(data.ruleset.draft_schema));
        setLayoutPast([]);
        setLayoutFuture([]);
        setRulesetName(data.ruleset.name || cleanedName);
        setMessage("Draft saved.");
        return data.ruleset;
      }

      const data = await apiFetch("/api/rulesets", {
        method: "POST",
        body: {
          name: cleanedName,
          draft_schema: validation.normalizedSchema,
        },
      });

      const query = gameId ? `?gameId=${gameId}` : "";
      navigate(`/create-ruleset/${data.ruleset.id}${query}`, { replace: true });
      setMessage("Ruleset created and draft saved.");
      return data.ruleset;
    } catch (err) {
      setError(err.message || "Could not save ruleset.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const publishVersion = async () => {
    if (!rulesetId) {
      setError("Save this ruleset first.");
      return;
    }

    const saved = await persistDraft();
    if (!saved) return;

    setPublishing(true);
    setError("");
    setMessage("");

    try {
      const data = await apiFetch(`/api/rulesets/${rulesetId}/publish`, {
        method: "POST",
      });
      await refreshVersions(rulesetId);
      setSelectedVersion(String(data.published_version));
      setMessage(`Published version v${data.published_version}.`);
    } catch (err) {
      setError(err.message || "Could not publish ruleset.");
    } finally {
      setPublishing(false);
    }
  };

  const linkToGame = async () => {
    if (!gameId) return;
    if (!rulesetId || !selectedVersion) {
      setError("Save, publish, and select a version first.");
      return;
    }

    setLinking(true);
    setError("");
    setMessage("");

    try {
      await apiFetch(`/api/games/${gameId}`, {
        method: "PATCH",
        body: {
          ruleset_type: "custom",
          ruleset_id: rulesetId,
          ruleset_version: Number(selectedVersion),
        },
      });
      setMessage(`Game linked to custom ruleset v${selectedVersion}.`);
    } catch (err) {
      setError(err.message || "Could not link ruleset to game.");
    } finally {
      setLinking(false);
    }
  };

  const allBoxes = schema.boxes || [];
  const fieldBoxes = useMemo(
    () => allBoxes.filter((box) => box.type === "field"),
    [allBoxes]
  );

  const boxById = useMemo(
    () => new Map(allBoxes.map((box) => [box.id, box])),
    [allBoxes]
  );

  const childrenByParent = useMemo(() => {
    const byParent = new Map();
    allBoxes.forEach((box) => {
      const parentKey = box.parentId || "__root__";
      if (!byParent.has(parentKey)) byParent.set(parentKey, []);
      byParent.get(parentKey).push(box);
    });
    byParent.forEach((list) => {
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    return byParent;
  }, [allBoxes]);

  const getChildren = (parentId) => {
    return (childrenByParent.get(parentId || "__root__") || []).slice();
  };

  const commitSchema = (updater) => {
    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      updater(next);
      return next;
    });
  };

  const commitLayoutSchema = (updater) => {
    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      const before = captureLayoutSnapshot(next);
      updater(next);
      const after = captureLayoutSnapshot(next);
      if (layoutSnapshotsEqual(before, after)) {
        return prev;
      }
      setLayoutPast((past) => [...past, before].slice(-100));
      setLayoutFuture([]);
      return next;
    });
  };

  const restoreLayoutSnapshotState = (snapshot) => {
    setSchema((prev) => applyLayoutSnapshot(prev, snapshot));
  };

  const undoLayout = () => {
    if (layoutPast.length === 0) return;
    const current = captureLayoutSnapshot(schema);
    const previous = layoutPast[layoutPast.length - 1];
    setLayoutPast((past) => past.slice(0, -1));
    setLayoutFuture((future) => [current, ...future]);
    restoreLayoutSnapshotState(previous);
  };

  const redoLayout = () => {
    if (layoutFuture.length === 0) return;
    const current = captureLayoutSnapshot(schema);
    const nextSnapshot = layoutFuture[0];
    setLayoutFuture((future) => future.slice(1));
    setLayoutPast((past) => [...past, current].slice(-100));
    restoreLayoutSnapshotState(nextSnapshot);
  };

  const resetLayout = () => {
    const rootOrderIds = SECTION_OPTIONS.filter((option) => option.id !== "all")
      .map((option) => SECTION_ROOT_ID_BY_ID[option.id])
      .filter(Boolean);

    commitLayoutSchema((next) => {
      next.boxes = next.boxes.map((box) => ({
        ...box,
        layout: {
          width: "full",
          height: "regular",
        },
      }));
      next.boxes = reindexSiblings(next.boxes, rootOrderIds);
    });
  };

  const updateBoxLayout = (boxId, patch) => {
    commitLayoutSchema((next) => {
      next.boxes = next.boxes.map((box) => {
        if (box.id !== boxId) return box;
        const current = getBoxLayout(box);
        return {
          ...box,
          layout: {
            ...current,
            ...patch,
          },
        };
      });
    });
  };

  const moveSiblingByDelta = (parentId, boxId, delta) => {
    if (!delta) return;
    commitLayoutSchema((next) => {
      const siblingList = next.boxes
        .filter((box) => (box.parentId || null) === (parentId || null))
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const currentIndex = siblingList.findIndex((box) => box.id === boxId);
      if (currentIndex < 0) return;
      const targetIndex = currentIndex + delta;
      if (targetIndex < 0 || targetIndex >= siblingList.length) return;
      const nextOrder = arrayMove(
        siblingList.map((box) => box.id),
        currentIndex,
        targetIndex
      );
      next.boxes = reindexSiblings(next.boxes, nextOrder);
    });
  };

  const reorderWithinParent = (parentId, activeId, overId) => {
    if (!activeId || !overId || activeId === overId) return;
    commitLayoutSchema((next) => {
      const siblings = next.boxes
        .filter((box) => (box.parentId || null) === (parentId || null))
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const oldIndex = siblings.findIndex((box) => box.id === activeId);
      const newIndex = siblings.findIndex((box) => box.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const nextOrder = arrayMove(
        siblings.map((box) => box.id),
        oldIndex,
        newIndex
      );
      next.boxes = reindexSiblings(next.boxes, nextOrder);
    });
  };

  const toggleEditSection = (sectionId) => {
    setEditingSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const renameField = (fieldId, label) => {
    commitSchema((next) => {
      next.boxes = next.boxes.map((box) =>
        box.id === fieldId ? { ...box, label } : box
      );
    });
  };

  const removeBox = (boxId) => {
    if (PROTECTED_BIO_FIELD_IDS.has(boxId)) {
      setError("XP Earned, XP Used, and XP Left Over are required for merits/flaws XP math.");
      return;
    }

    commitSchema((next) => {
      const ids = new Set([boxId]);
      let changed = true;
      while (changed) {
        changed = false;
        next.boxes.forEach((box) => {
          if (box.parentId && ids.has(box.parentId) && !ids.has(box.id)) {
            ids.add(box.id);
            changed = true;
          }
          if (box.type === "field" && ids.has(box.id) && box.bonusFieldId && !ids.has(box.bonusFieldId)) {
            ids.add(box.bonusFieldId);
            changed = true;
          }
          if (box.type === "field" && box.bonusFieldId && ids.has(box.bonusFieldId) && !ids.has(box.id)) {
            ids.add(box.id);
            changed = true;
          }
        });
      }

      const statLinkedPower = next.spellGroups.find(
        (power) => power.linkedStatFieldId && ids.has(power.linkedStatFieldId)
      );
      if (statLinkedPower) {
        setError(`Cannot delete this field. It is linked to power '${statLinkedPower.name}'.`);
        return;
      }

      const effectLinkedSpell = next.spells.find((spell) =>
        spell.levels.some((level) =>
          level.effects.some((effect) => {
            const targets =
              Array.isArray(effect.targetFieldIds) && effect.targetFieldIds.length > 0
                ? effect.targetFieldIds
                : effect.targetFieldId
                  ? [effect.targetFieldId]
                  : [];
            return targets.some((targetId) => ids.has(targetId));
          })
        )
      );
      if (effectLinkedSpell) {
        setError(`Cannot delete this field. It is used by spell '${effectLinkedSpell.name}'.`);
        return;
      }

      next.boxes = next.boxes.filter((box) => !ids.has(box.id));
      next.relations = next.relations.filter(
        (relation) => !ids.has(relation.sourceBoxId) && !ids.has(relation.targetBoxId)
      );
      next.rules = next.rules.filter((rule) => !ruleTouchesIds(rule, ids));
    });
  };

  const getCategoryIdByLabel = (label) => {
    return (
      schema.categories.find((category) => category.name === label)?.id || null
    );
  };

  const addManagedField = ({
    sectionId,
    parentId,
    label,
    fieldType = "text",
    defaultValue,
    editableBy = "player",
    keyPrefix = "field",
    hidden = false,
    withBonus = false,
    xpUpgradable = false,
    xpCost = 1,
    xpStep = 1,
    xpMax = null,
    xpCategory = null,
  }) => {
    const cleanLabel = String(label || "").trim();
    if (!cleanLabel) return;

    commitSchema((next) => {
      const categoryLabel = SECTION_OPTIONS.find((option) => option.id === sectionId)?.label || "Custom";
      const categoryId =
        next.categories.find((category) => category.name === categoryLabel)?.id || null;
      const baseId = makeId(`managed_${sectionId}_field`);
      const baseKey = `${keyPrefix}_${slugify(cleanLabel)}_${Date.now().toString(36)}`;
      const resolvedDefaultValue =
        defaultValue !== undefined
          ? defaultValue
          : fieldType === "number" || fieldType === "computed"
            ? 0
            : fieldType === "boolean"
              ? false
              : "";
      const bonusFieldId =
        withBonus && fieldType === "number"
          ? `${baseId}_bonus`
          : null;

      next.boxes.push(
        makeFieldBox({
          id: baseId,
          label: cleanLabel,
          key: baseKey,
          parentId,
          categoryId,
          order: next.boxes.length,
          fieldType,
          defaultValue: resolvedDefaultValue,
          editableBy,
          hidden,
          formula: fieldType === "computed" ? { op: "literal", value: Number(resolvedDefaultValue) || 0 } : undefined,
          xpUpgradable: fieldType === "number" ? xpUpgradable : false,
          xpCost: fieldType === "number" ? xpCost : 0,
          xpStep: fieldType === "number" ? xpStep : 1,
          xpMax: fieldType === "number" ? xpMax : null,
          xpCategory: fieldType === "number" ? xpCategory : null,
          bonusFieldId,
        })
      );

      if (bonusFieldId) {
        next.boxes.push(
          makeFieldBox({
            id: bonusFieldId,
            label: `${cleanLabel} Bonus`,
            key: `${baseKey}_bonus`,
            parentId,
            categoryId,
            order: next.boxes.length,
            fieldType: "number",
            defaultValue: 0,
            editableBy: "dm",
            hidden: true,
          })
        );
      }
    });
    setError("");
  };

  const addMeritOrFlaw = (type) => {
    const name = window.prompt(`Enter ${type} name:`);
    if (!name || !name.trim()) return;

    const xpText = window.prompt(
      type === "merit" ? "XP cost:" : "XP gain:",
      "1"
    );
    const xpValue = Number(xpText);
    if (!Number.isFinite(xpValue) || xpValue <= 0) {
      setError("XP value must be a positive number.");
      return;
    }

    const targetFieldId = type === "merit" ? XP_FIELD_IDS.used : XP_FIELD_IDS.earned;
    const parentId = type === "merit" ? SUBGROUP_IDS.merits : SUBGROUP_IDS.flaws;

    commitSchema((next) => {
      const targetExists = next.boxes.some((box) => box.id === targetFieldId);
      if (!targetExists) {
        setError("Required XP fields are missing in Bio.");
        return;
      }

      const currentMeritFlawFields = next.boxes.filter(
        (box) => box.type === "field" && (box.parentId === SUBGROUP_IDS.merits || box.parentId === SUBGROUP_IDS.flaws)
      );
      const locked = currentMeritFlawFields.length > 0 && currentMeritFlawFields.every((box) => box.editableBy === "dm");

      const field = makeFieldBox({
        id: makeId(`managed_${type}`),
        label: name.trim(),
        key: `managed_${type}_${slugify(name)}_${Date.now().toString(36)}`,
        parentId,
        categoryId: next.categories.find((category) => category.name === "Merits/Flaws")?.id || null,
        order: next.boxes.length,
        fieldType: "boolean",
        defaultValue: false,
        editableBy: locked ? "dm" : "player",
      });

      next.boxes.push(field);
      next.rules.push({
        id: makeId(`managed_${type}_rule`),
        name: `${type === "merit" ? "Merit" : "Flaw"}: ${name.trim()}`,
        condition: {
          op: "eq",
          left: { op: "field", fieldId: field.id },
          right: { op: "literal", value: true },
        },
        effects: [
          {
            id: makeId("effect"),
            type: "add",
            targetBoxId: targetFieldId,
            value: { op: "literal", value: xpValue },
          },
        ],
      });
    });

    setError("");
  };

  const setMeritFlawLock = () => {
    const meritFlawFields = allBoxes.filter(
      (box) => box.type === "field" && (box.parentId === SUBGROUP_IDS.merits || box.parentId === SUBGROUP_IDS.flaws)
    );
    if (meritFlawFields.length === 0) {
      setError("No merit/flaw fields found.");
      return;
    }

    const currentlyLocked = meritFlawFields.every((box) => box.editableBy === "dm");
    commitSchema((next) => {
      next.boxes = next.boxes.map((box) => {
        if (box.type !== "field") return box;
        if (box.parentId !== SUBGROUP_IDS.merits && box.parentId !== SUBGROUP_IDS.flaws) {
          return box;
        }
        return {
          ...box,
          editableBy: currentlyLocked ? "player" : "dm",
        };
      });
    });
  };

  const bioFields = getChildren(ROOT_IDS.bio).filter((box) => box.type === "field" && !box.hidden);
  const combatDefensiveFields = getChildren(SUBGROUP_IDS.combatDefensive).filter(
    (box) => box.type === "field" && !box.hidden
  );
  const combatOffensiveFields = getChildren(SUBGROUP_IDS.combatOffensive).filter(
    (box) => box.type === "field" && !box.hidden
  );
  const statsPhysicalFields = getChildren(SUBGROUP_IDS.statsPhysical).filter((box) => box.type === "field" && !box.hidden);
  const statsMentalFields = getChildren(SUBGROUP_IDS.statsMental).filter((box) => box.type === "field" && !box.hidden);
  const statsSocialFields = getChildren(SUBGROUP_IDS.statsSocial).filter((box) => box.type === "field" && !box.hidden);
  const skillFields = getChildren(ROOT_IDS.skills).filter((box) => box.type === "field" && !box.hidden);
  const equipmentFields = getChildren(ROOT_IDS.equipment).filter((box) => box.type === "field" && !box.hidden);
  const inventoryFields = getChildren(ROOT_IDS.inventory).filter((box) => box.type === "field" && !box.hidden);
  const meritFields = getChildren(SUBGROUP_IDS.merits).filter((box) => box.type === "field" && !box.hidden);
  const flawFields = getChildren(SUBGROUP_IDS.flaws).filter((box) => box.type === "field" && !box.hidden);
  const connectionFields = getChildren(ROOT_IDS.connections).filter((box) => box.type === "field" && !box.hidden);
  const customFields = getChildren(ROOT_IDS.custom).filter((box) => box.type === "field" && !box.hidden);

  const renderFieldList = (parentId, fields, isEditing, noteResolver, editableResolver) => {
    const list = Array.isArray(fields) ? fields : [];
    const content = (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
        {list.map((box) => {
          const note = typeof noteResolver === "function" ? noteResolver(box) : "";
          const rowIsEditing =
            typeof editableResolver === "function" ? editableResolver(box) : isEditing;
          const wrapperClass = fieldWrapperClass(getBoxLayout(box));
          const disableMove = list.length <= 1;
          const row = (
            <FieldRow
              box={box}
              isEditing={rowIsEditing}
              onRename={renameField}
              onDelete={removeBox}
              note={note}
              layoutMode={layoutMode}
              onLayoutChange={updateBoxLayout}
              onMoveUp={() => moveSiblingByDelta(parentId, box.id, -1)}
              onMoveDown={() => moveSiblingByDelta(parentId, box.id, 1)}
              disableMove={disableMove}
            />
          );

          if (!layoutMode) {
            return (
              <div key={box.id} className={wrapperClass}>
                {row}
              </div>
            );
          }

          return (
            <SortableItem
              key={box.id}
              id={box.id}
              disabled={!layoutMode || list.length <= 1}
              className={wrapperClass}
            >
              {row}
            </SortableItem>
          );
        })}
      </div>
    );

    if (!layoutMode) return content;

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          if (!event?.active?.id || !event?.over?.id) return;
          reorderWithinParent(parentId, String(event.active.id), String(event.over.id));
        }}
      >
        <SortableContext items={list.map((box) => box.id)} strategy={rectSortingStrategy}>
          {content}
        </SortableContext>
      </DndContext>
    );
  };

  const meritFlawLocked =
    [...meritFields, ...flawFields].length > 0 &&
    [...meritFields, ...flawFields].every((box) => box.editableBy === "dm");

  const powerConfig = schema.powerConfig || { useTiers: true, usePowers: true };
  const powerTiers = schema.powerTiers || [];
  const powers = schema.spellGroups || [];
  const spells = schema.spells || [];

  const getManagedRuleValue = (fieldId, targetBoxId) => {
    const found = (schema.rules || []).find((rule) => {
      if (!rule || !rule.condition || !Array.isArray(rule.effects)) return false;
      if (rule.condition.op !== "eq") return false;
      if (rule.condition.left?.op !== "field" || rule.condition.left?.fieldId !== fieldId) return false;
      return rule.effects.some((effect) => effect.targetBoxId === targetBoxId && effect.type === "add");
    });
    if (!found) return null;
    const effect = found.effects.find((entry) => entry.targetBoxId === targetBoxId && entry.type === "add");
    if (!effect) return null;
    if (effect.value?.op !== "literal") return null;
    return effect.value.value;
  };

  const xpProgression = defaultXpProgressionState(schema.xpProgression);
  const updateXpProgressionCell = (categoryId, rowIndex, key, nextValue) => {
    commitSchema((next) => {
      const current = defaultXpProgressionState(next.xpProgression);
      const table = [...current[categoryId]];
      const parsed = Number(nextValue);
      table[rowIndex] = {
        ...table[rowIndex],
        [key]: Number.isFinite(parsed) ? parsed : 0,
      };
      next.xpProgression = {
        ...current,
        [categoryId]: normalizeXpTableLocal(table),
      };
    });
  };
  const addXpProgressionRow = (categoryId) => {
    commitSchema((next) => {
      const current = defaultXpProgressionState(next.xpProgression);
      const table = [...current[categoryId]];
      const last = table[table.length - 1] || { level: 1, cumulative: 0 };
      table.push({
        level: Number(last.level) + 1,
        cumulative: Number(last.cumulative),
      });
      next.xpProgression = {
        ...current,
        [categoryId]: normalizeXpTableLocal(table),
      };
    });
  };
  const removeXpProgressionRow = (categoryId, rowIndex) => {
    commitSchema((next) => {
      const current = defaultXpProgressionState(next.xpProgression);
      const table = [...current[categoryId]];
      if (table.length <= 1) return;
      table.splice(rowIndex, 1);
      next.xpProgression = {
        ...current,
        [categoryId]: normalizeXpTableLocal(table),
      };
    });
  };

  const orderedSectionIds = useMemo(() => {
    const defaultOrder = SECTION_OPTIONS.filter((option) => option.id !== "all").map((option) => option.id);
    const rootEntries = defaultOrder
      .map((sectionId) => {
        const rootId = SECTION_ROOT_ID_BY_ID[sectionId];
        const rootBox = rootId ? boxById.get(rootId) : null;
        return {
          sectionId,
          order: Number.isFinite(Number(rootBox?.order)) ? Number(rootBox.order) : Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((left, right) => left.order - right.order);
    const known = rootEntries.map((entry) => entry.sectionId);
    return [...known, ...defaultOrder.filter((sectionId) => !known.includes(sectionId))];
  }, [boxById]);

  const visibleSections =
    activeSection === "all"
      ? orderedSectionIds
          .map((sectionId) => SECTION_OPTIONS.find((option) => option.id === sectionId))
          .filter(Boolean)
      : SECTION_OPTIONS.filter((option) => option.id === activeSection);

  const renderPowersTree = () => {
    const sortedTiers = [...powerTiers].sort((left, right) => left.order - right.order);

    if (powerConfig.useTiers && powerConfig.usePowers) {
      return (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-2">
          {sortedTiers.length === 0 && <p className="text-xs text-gray-500">No tiers yet.</p>}
          {sortedTiers.map((tier) => {
            const tierPowers = powers.filter((power) => power.tierId === tier.id);
            return (
              <details key={tier.id} open className="rounded border p-2">
                <summary className="cursor-pointer font-medium">{tier.name}</summary>
                <div className="mt-2 space-y-2">
                  {tierPowers.length === 0 && <p className="text-[11px] text-gray-500">No powers.</p>}
                  {tierPowers.map((power) => (
                    <div key={power.id} className="rounded border p-2">
                      <strong>{power.name}</strong>
                      <div className="mt-1 text-[11px] text-gray-600">
                        {(spells || []).filter((spell) => spell.groupId === power.id).map((spell) => spell.name).join(", ") || "No spells"}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      );
    }

    if (!powerConfig.useTiers && powerConfig.usePowers) {
      return (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-2">
          {powers.length === 0 && <p className="text-xs text-gray-500">No powers yet.</p>}
          {powers.map((power) => (
            <details key={power.id} open className="rounded border p-2">
              <summary className="cursor-pointer font-medium">{power.name}</summary>
              <p className="mt-1 text-[11px] text-gray-600">
                {spells.filter((spell) => spell.groupId === power.id).map((spell) => spell.name).join(", ") || "No spells"}
              </p>
            </details>
          ))}
        </div>
      );
    }

    if (powerConfig.useTiers && !powerConfig.usePowers) {
      return (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-2">
          {sortedTiers.length === 0 && <p className="text-xs text-gray-500">No tiers yet.</p>}
          {sortedTiers.map((tier) => (
            <details key={tier.id} open className="rounded border p-2">
              <summary className="cursor-pointer font-medium">{tier.name}</summary>
              <p className="mt-1 text-[11px] text-gray-600">
                {spells.filter((spell) => spell.tierId === tier.id).map((spell) => spell.name).join(", ") || "No spells"}
              </p>
            </details>
          ))}
        </div>
      );
    }

    return (
      <div className="max-h-72 space-y-2 overflow-y-auto pr-2">
        {spells.length === 0 && <p className="text-xs text-gray-500">No spells yet.</p>}
        {spells.map((spell) => (
          <div key={spell.id} className="rounded border p-2">
            {spell.name}
          </div>
        ))}
      </div>
    );
  };

  const sortableSectionIds = visibleSections
    .map((section) => SECTION_ROOT_ID_BY_ID[section.id])
    .filter(Boolean);
  const canSortSections =
    layoutMode &&
    activeSection === "all" &&
    sortableSectionIds.length > 1;
  const sectionContainerClass =
    activeSection === "all"
      ? "grid grid-cols-1 gap-6 md:grid-cols-12"
      : "space-y-6";

  const renderSectionShell = (section, isEditing, title, children) => {
    const rootId = SECTION_ROOT_ID_BY_ID[section.id];
    const rootBox = rootId ? boxById.get(rootId) : null;
    const layout = getBoxLayout(rootBox);
    const wrapperClass = activeSection === "all" ? sectionWrapperClass(layout) : "";
    const disableSectionMove =
      !layoutMode || activeSection !== "all" || sortableSectionIds.length <= 1;

    const sectionNode = (
      <SectionCard
        title={title}
        isEditing={isEditing}
        onToggleEdit={() => toggleEditSection(section.id)}
        layoutMode={layoutMode}
        layout={layout}
        onWidthChange={(value) => {
          if (!rootId) return;
          updateBoxLayout(rootId, { width: value });
        }}
        onHeightChange={(value) => {
          if (!rootId) return;
          updateBoxLayout(rootId, { height: value });
        }}
        onMoveUp={() => {
          if (!rootId) return;
          moveSiblingByDelta(null, rootId, -1);
        }}
        onMoveDown={() => {
          if (!rootId) return;
          moveSiblingByDelta(null, rootId, 1);
        }}
        disableMove={disableSectionMove}
      >
        {children}
      </SectionCard>
    );

    if (canSortSections && rootId) {
      return (
        <SortableItem key={section.id} id={rootId} className={wrapperClass}>
          {sectionNode}
        </SortableItem>
      );
    }

    return (
      <div key={section.id} className={wrapperClass}>
        {sectionNode}
      </div>
    );
  };

  const renderedSections = visibleSections.map((section) => {
    const isEditing = Boolean(editingSections[section.id]);

    if (section.id === "bio") {
      return renderSectionShell(section, isEditing, "Bio", (
        <>
          {isEditing && (
            <button
              className="mb-3 rounded bg-green-100 px-3 py-1 text-xs"
              type="button"
              onClick={() => {
                const label = window.prompt("Bio field label:");
                if (!label) return;
                const type = window.prompt("Field type (text/number)", "text");
                addManagedField({
                  sectionId: "bio",
                  parentId: ROOT_IDS.bio,
                  label,
                  fieldType: type === "number" ? "number" : "text",
                });
              }}
            >
              Add Field
            </button>
          )}
          {renderFieldList(
            ROOT_IDS.bio,
            bioFields,
            isEditing,
            (box) =>
              PROTECTED_BIO_FIELD_IDS.has(box.id)
                ? "Required for XP workflow."
                : "",
            (box) => isEditing && !PROTECTED_BIO_FIELD_IDS.has(box.id)
          )}
        </>
      ));
    }

    if (section.id === "combat_summary") {
      return renderSectionShell(section, isEditing, "Combat Summary", (
        <>
          {isEditing && (
            <button
              className="mb-3 rounded bg-green-100 px-3 py-1 text-xs"
              type="button"
              onClick={() => {
                const mode = window.prompt(
                  "Add field to: defensive or offensive",
                  "defensive"
                );
                if (!mode) return;
                const label = window.prompt("Field label:");
                if (!label) return;
                const typeInput = window.prompt(
                  "Field type (number/text)",
                  "number"
                );
                const requestedType = String(typeInput || "number")
                  .trim()
                  .toLowerCase();
                const parentId =
                  mode.toLowerCase() === "offensive"
                    ? SUBGROUP_IDS.combatOffensive
                    : SUBGROUP_IDS.combatDefensive;
                addManagedField({
                  sectionId: "combat_summary",
                  parentId,
                  label,
                  fieldType: requestedType === "text" ? "text" : "computed",
                  editableBy: "dm",
                  defaultValue: requestedType === "text" ? "" : 0,
                });
              }}
            >
              Add Field
            </button>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-medium">Defensive</h4>
              {renderFieldList(
                SUBGROUP_IDS.combatDefensive,
                combatDefensiveFields,
                isEditing,
                (box) =>
                  box.id === "managed_combat_resistances"
                    ? "Read-only to players."
                    : "Calculated field (read-only to players)."
              )}
            </div>
            <div>
              <h4 className="mb-2 font-medium">Offensive</h4>
              {renderFieldList(
                SUBGROUP_IDS.combatOffensive,
                combatOffensiveFields,
                isEditing,
                () => "Calculated field (read-only to players)."
              )}
            </div>
          </div>
        </>
      ));
    }

    if (section.id === "stats_attributes") {
      const addStat = () => {
        const group = window.prompt(
          "Add stat to: physical, mental, or social",
          "physical"
        );
        if (!group) return;
        const label = window.prompt("Stat label:");
        if (!label) return;
        const lower = group.toLowerCase();
        const parentId =
          lower === "mental"
            ? SUBGROUP_IDS.statsMental
            : lower === "social"
              ? SUBGROUP_IDS.statsSocial
              : SUBGROUP_IDS.statsPhysical;
        addManagedField({
          sectionId: "stats_attributes",
          parentId,
          label,
          fieldType: "number",
          defaultValue: 1,
          withBonus: true,
          xpUpgradable: true,
          xpCost: 1,
          xpStep: 1,
          xpCategory: "stats",
        });
      };

      return renderSectionShell(section, isEditing, "Stats/Attributes", (
        <>
          {isEditing && (
            <button
              className="mb-3 rounded bg-green-100 px-3 py-1 text-xs"
              type="button"
              onClick={addStat}
            >
              Add Stat
            </button>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <h4 className="mb-2 font-medium">Physical</h4>
              {renderFieldList(
                SUBGROUP_IDS.statsPhysical,
                statsPhysicalFields,
                isEditing,
                () => "Current = Base + Bonus"
              )}
            </div>
            <div>
              <h4 className="mb-2 font-medium">Mental</h4>
              {renderFieldList(
                SUBGROUP_IDS.statsMental,
                statsMentalFields,
                isEditing,
                () => "Current = Base + Bonus"
              )}
            </div>
            <div>
              <h4 className="mb-2 font-medium">Social</h4>
              {renderFieldList(
                SUBGROUP_IDS.statsSocial,
                statsSocialFields,
                isEditing,
                () => "Current = Base + Bonus"
              )}
            </div>
          </div>
        </>
      ));
    }

    if (section.id === "skills_abilities") {
      return renderSectionShell(section, isEditing, "Skills/Abilities", (
        <>
          {isEditing && (
            <button
              className="mb-3 rounded bg-green-100 px-3 py-1 text-xs"
              type="button"
              onClick={() => {
                const label = window.prompt("Skill label:");
                if (!label) return;
                addManagedField({
                  sectionId: "skills_abilities",
                  parentId: ROOT_IDS.skills,
                  label,
                  fieldType: "number",
                  defaultValue: 1,
                  withBonus: true,
                  xpUpgradable: true,
                  xpCost: 1,
                  xpStep: 1,
                  xpCategory: "skills",
                });
              }}
            >
              Add Skill
            </button>
          )}
          {renderFieldList(
            ROOT_IDS.skills,
            skillFields,
            isEditing,
            () => "Current = Base + Bonus"
          )}
        </>
      ));
    }

    if (section.id === "powers") {
      return renderSectionShell(section, isEditing, "Powers", (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <button
              className="rounded bg-indigo-100 px-3 py-1"
              type="button"
              onClick={() => setSpellBuilderOpen(true)}
            >
              Power Builder
            </button>
            <span className="text-gray-600">
              Tiers: {powerTiers.length} | Powers: {powers.length} | Spells:{" "}
              {spells.length}
            </span>
          </div>
          {renderPowersTree()}
        </>
      ));
    }

    if (section.id === "equipment") {
      const removeSlot = () => {
        const slots = equipmentFields.filter((box) =>
          String(box.key || "").includes("equipment_slot")
        );
        if (slots.length === 0) {
          setError("No item slots to remove.");
          return;
        }
        const chosen = window.prompt(
          `Remove which slot? ${slots.map((slot) => slot.label).join(", ")}`
        );
        if (!chosen) return;
        const match = slots.find(
          (slot) => slot.label.toLowerCase() === chosen.trim().toLowerCase()
        );
        if (!match) {
          setError("Slot not found.");
          return;
        }
        removeBox(match.id);
      };

      return renderSectionShell(section, isEditing, "Equipment", (
        <>
          {isEditing && (
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <button
                className="rounded bg-green-100 px-3 py-1"
                type="button"
                onClick={() => {
                  const label = window.prompt("Text style item label:");
                  if (!label) return;
                  addManagedField({
                    sectionId: "equipment",
                    parentId: ROOT_IDS.equipment,
                    label,
                    fieldType: "text",
                    keyPrefix: "equipment_text",
                  });
                }}
              >
                Add text style item
              </button>
              <button
                className="rounded bg-green-100 px-3 py-1"
                type="button"
                onClick={() => {
                  const label = window.prompt("Item slot label:", "Item Slot");
                  if (!label) return;
                  addManagedField({
                    sectionId: "equipment",
                    parentId: ROOT_IDS.equipment,
                    label,
                    fieldType: "single_select",
                    keyPrefix: "equipment_slot",
                  });
                }}
              >
                Add item slot
              </button>
              <button
                className="rounded bg-red-100 px-3 py-1"
                type="button"
                onClick={removeSlot}
              >
                Remove item slot
              </button>
            </div>
          )}
          {renderFieldList(
            ROOT_IDS.equipment,
            equipmentFields,
            isEditing,
            (box) =>
              box.fieldType === "single_select"
                ? "Item slot (future slot restrictions/buffs)."
                : "Text style item."
          )}
        </>
      ));
    }

    if (section.id === "inventory") {
      return renderSectionShell(section, isEditing, "Inventory", (
        <>
          {isEditing && (
            <div className="mb-3 flex gap-2 text-xs">
              <button
                className="rounded bg-green-100 px-3 py-1"
                type="button"
                onClick={() => {
                  const label = window.prompt("Inventory item label:", "Item");
                  if (!label) return;
                  addManagedField({
                    sectionId: "inventory",
                    parentId: ROOT_IDS.inventory,
                    label,
                    fieldType: "text",
                    keyPrefix: "inventory_item",
                  });
                }}
              >
                Add item
              </button>
              <button
                className="rounded bg-red-100 px-3 py-1"
                type="button"
                onClick={() => {
                  const chosen = window.prompt(
                    `Remove which item? ${inventoryFields
                      .map((field) => field.label)
                      .join(", ")}`
                  );
                  if (!chosen) return;
                  const found = inventoryFields.find(
                    (field) =>
                      field.label.toLowerCase() === chosen.trim().toLowerCase()
                  );
                  if (!found) {
                    setError("Item not found.");
                    return;
                  }
                  removeBox(found.id);
                }}
              >
                Remove item
              </button>
            </div>
          )}
          {renderFieldList(ROOT_IDS.inventory, inventoryFields, isEditing)}
        </>
      ));
    }

    if (section.id === "merits_flaws") {
      return renderSectionShell(section, isEditing, "Merits/Flaws", (
        <>
          {isEditing && (
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <button
                className="rounded bg-green-100 px-3 py-1"
                type="button"
                onClick={() => addMeritOrFlaw("merit")}
              >
                Add merit
              </button>
              <button
                className="rounded bg-green-100 px-3 py-1"
                type="button"
                onClick={() => addMeritOrFlaw("flaw")}
              >
                Add flaw
              </button>
              <button
                className="rounded bg-blue-100 px-3 py-1"
                type="button"
                onClick={setMeritFlawLock}
              >
                {meritFlawLocked ? "Unlock section" : "Lock section"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-medium">Merits</h4>
              {renderFieldList(
                SUBGROUP_IDS.merits,
                meritFields,
                isEditing,
                (box) =>
                  `XP cost: ${getManagedRuleValue(box.id, XP_FIELD_IDS.used) ?? 0}`
              )}
            </div>
            <div>
              <h4 className="mb-2 font-medium">Flaws</h4>
              {renderFieldList(
                SUBGROUP_IDS.flaws,
                flawFields,
                isEditing,
                (box) =>
                  `XP gain: ${getManagedRuleValue(box.id, XP_FIELD_IDS.earned) ?? 0}`
              )}
            </div>
          </div>
        </>
      ));
    }

    if (section.id === "connections") {
      return renderSectionShell(section, isEditing, "Connections", (
        <>
          {isEditing && (
            <button
              className="mb-3 rounded bg-green-100 px-3 py-1 text-xs"
              type="button"
              onClick={() => {
                const label = window.prompt("Connection field label:");
                if (!label) return;
                addManagedField({
                  sectionId: "connections",
                  parentId: ROOT_IDS.connections,
                  label,
                  fieldType: "text",
                });
              }}
            >
              Add Connection
            </button>
          )}
          {renderFieldList(ROOT_IDS.connections, connectionFields, isEditing)}
        </>
      ));
    }

    return renderSectionShell(section, isEditing, "Custom", (
      <>
        {isEditing && (
          <button
            className="mb-3 rounded bg-green-100 px-3 py-1 text-xs"
            type="button"
            onClick={() => {
              const label = window.prompt("Custom field label:");
              if (!label) return;
              const type = window.prompt(
                "Field type (text/number/boolean)",
                "text"
              );
              const fieldType =
                type === "number" || type === "boolean" ? type : "text";
              addManagedField({
                sectionId: "custom",
                parentId: ROOT_IDS.custom,
                label,
                fieldType,
              });
            }}
          >
            Add Field
          </button>
        )}
        {renderFieldList(ROOT_IDS.custom, customFields, isEditing)}
      </>
    ));
  });

  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-6xl rounded-2xl bg-white p-6 text-center text-sm shadow">
        Loading ruleset...
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-6xl rounded-2xl bg-white p-6 text-sm shadow">
      <div className="mb-6 flex justify-start gap-2">
        <button onClick={() => navigate("/")} className="rounded bg-gray-200 px-4 py-1" type="button">
          Home
        </button>
        <button onClick={() => navigate(-1)} className="rounded bg-gray-200 px-4 py-1" type="button">
          Back
        </button>
      </div>

      <h2 className="mb-2 text-center text-lg font-bold">
        {rulesetId ? "Edit Custom Ruleset" : "Create Custom Ruleset"}
      </h2>
      {rulesetId && <p className="mb-6 text-center text-xs text-gray-500">ID: {rulesetId}</p>}

      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium">Ruleset Name</label>
        <input
          value={rulesetName}
          onChange={(event) => setRulesetName(event.target.value)}
          className="w-full rounded border p-2"
        />
      </div>

      <div className="mb-6 rounded border bg-gray-50 p-3 text-xs">
        <label className="mb-1 block font-medium">Categories</label>
        <select
          className="w-full rounded border p-2"
          value={activeSection}
          onChange={(event) => setActiveSection(event.target.value)}
        >
          {SECTION_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 rounded border bg-blue-50 p-3 text-xs">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            className={cx(
              "rounded px-3 py-1",
              layoutMode ? "bg-blue-200" : "bg-blue-100"
            )}
            type="button"
            onClick={() => setLayoutMode((prev) => !prev)}
          >
            {layoutMode ? "Exit Layout Mode" : "Layout Mode"}
          </button>
          <button
            className="rounded bg-gray-100 px-3 py-1 disabled:opacity-50"
            type="button"
            onClick={undoLayout}
            disabled={layoutPast.length === 0}
          >
            Undo
          </button>
          <button
            className="rounded bg-gray-100 px-3 py-1 disabled:opacity-50"
            type="button"
            onClick={redoLayout}
            disabled={layoutFuture.length === 0}
          >
            Redo
          </button>
          <button className="rounded bg-red-100 px-3 py-1" type="button" onClick={resetLayout}>
            Reset Layout
          </button>
        </div>
        <p className="text-[11px] text-gray-600">
          Drag to reorder. Use size selectors to set width and height.
        </p>
      </div>

      {canSortSections ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            if (!event?.active?.id || !event?.over?.id) return;
            reorderWithinParent(
              null,
              String(event.active.id),
              String(event.over.id)
            );
          }}
        >
          <SortableContext
            items={sortableSectionIds}
            strategy={rectSortingStrategy}
          >
            <div className={sectionContainerClass}>{renderedSections}</div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className={sectionContainerClass}>{renderedSections}</div>
      )}

      <section className="mt-6 rounded border bg-gray-50 p-4 text-xs">
        <h3 className="mb-2 font-semibold">XP Level Tables</h3>
        <p className="mb-2 text-[11px] text-gray-600">
          Cumulative XP required per level. Purchase cost uses: cumulative(target) - cumulative(current).
        </p>
        <div className="space-y-3">
          {XP_PROGRESSION_CATEGORIES.map((category) => {
            const table = xpProgression[category.id] || [];
            return (
              <div key={category.id} className="rounded border bg-white p-2">
                <div className="mb-2 flex items-center justify-between">
                  <strong>{category.label}</strong>
                  <button
                    className="rounded bg-green-100 px-2 py-1"
                    type="button"
                    onClick={() => addXpProgressionRow(category.id)}
                  >
                    Add Row
                  </button>
                </div>
                <div className="space-y-1">
                  {table.map((row, rowIndex) => {
                    const previous = rowIndex > 0 ? table[rowIndex - 1] : null;
                    const stepCost = previous
                      ? Number(row.cumulative) - Number(previous.cumulative)
                      : 0;
                    return (
                      <div key={`${category.id}-${row.level}-${rowIndex}`} className="grid grid-cols-4 gap-2">
                        <input
                          className="rounded border p-1"
                          type="number"
                          value={row.level}
                          min={1}
                          onChange={(event) =>
                            updateXpProgressionCell(category.id, rowIndex, "level", event.target.value)
                          }
                        />
                        <input
                          className="rounded border p-1"
                          type="number"
                          value={row.cumulative}
                          min={0}
                          onChange={(event) =>
                            updateXpProgressionCell(category.id, rowIndex, "cumulative", event.target.value)
                          }
                        />
                        <span className="rounded border bg-gray-50 p-1 text-[11px]">
                          {rowIndex === 0 ? "Base" : `Step: ${stepCost}`}
                        </span>
                        <button
                          className="rounded bg-red-100 px-2 py-1 disabled:opacity-50"
                          type="button"
                          disabled={table.length <= 1}
                          onClick={() => removeXpProgressionRow(category.id, rowIndex)}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded border p-4 text-xs">
        <h3 className="mb-2 font-semibold">Publish + Link</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button className="rounded bg-blue-100 px-4 py-2 disabled:opacity-60" onClick={persistDraft} disabled={saving} type="button">
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button className="rounded bg-green-100 px-4 py-2 disabled:opacity-60" onClick={publishVersion} disabled={publishing || !rulesetId} type="button">
            {publishing ? "Publishing..." : "Publish Version"}
          </button>
          {versions.length > 0 && (
            <select className="rounded border p-2" value={selectedVersion} onChange={(event) => setSelectedVersion(event.target.value)}>
              {versions.map((version) => <option key={version.id} value={String(version.version)}>v{version.version}</option>)}
            </select>
          )}
          {gameId && (
            <button className="rounded bg-purple-100 px-4 py-2 disabled:opacity-60" onClick={linkToGame} disabled={linking || !rulesetId || !selectedVersion} type="button">
              {linking ? "Linking..." : "Link To Game"}
            </button>
          )}
        </div>
      </section>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}

      {gameId && (
        <button onClick={() => navigate(`/dm/game-dashboard/${gameId}`)} className="mt-3 w-full rounded bg-blue-100 py-2" type="button">
          Back to Game Dashboard
        </button>
      )}

      <SpellBuilderModal
        open={spellBuilderOpen}
        onClose={() => setSpellBuilderOpen(false)}
        schema={schema}
        setSchema={setSchema}
        fieldBoxes={fieldBoxes}
        setError={setError}
      />
    </div>
  );
}

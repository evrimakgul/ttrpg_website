import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  STARTER_CATEGORY_NAMES,
  buildStarterTemplate,
  makeId,
  normalizeRulesetSchema,
  validateRulesetSchema,
} from "../lib/rulesEngine";
import SpellBuilderModal from "../components/SpellBuilderModal";

const BOX_TYPES = ["group", "field", "repeatable_group"];
const FIELD_TYPES = [
  "number",
  "text",
  "boolean",
  "single_select",
  "multi_select",
  "computed",
];
const RELATION_TYPES = ["requires", "excludes", "modifies", "grants"];
const RULE_OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte", "in"];
const EFFECT_TYPES = ["set", "add", "multiply", "enable", "disable"];
const FORMULA_OPERATORS = ["add", "sub", "mul", "div", "min", "max"];

function parseLiteral(raw) {
  const value = String(raw ?? "").trim();
  if (value === "") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return asNumber;
  return value;
}

function toValueExpression(mode, literal, fieldId) {
  if (mode === "field") {
    return { op: "field", fieldId: String(fieldId || "").trim() };
  }
  return { op: "literal", value: parseLiteral(literal) };
}

function boxLabel(boxes, id) {
  return boxes.find((box) => box.id === id)?.label || id || "Unknown";
}

function collectFieldIdsFromExpression(expression, fieldIds = new Set()) {
  if (!expression || typeof expression !== "object") {
    return fieldIds;
  }

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

export default function CreateRuleset() {
  const navigate = useNavigate();
  const { rulesetId } = useParams();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("gameId");

  const [rulesetName, setRulesetName] = useState("");
  const [schema, setSchema] = useState(buildStarterTemplate());
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [boxForm, setBoxForm] = useState({
    type: "field",
    label: "",
    parentId: "",
    categoryId: "",
    fieldType: "number",
    editableBy: "player",
    defaultValue: "",
    optionsText: "",
    repeatLimit: "",
    formulaLeftFieldId: "",
    formulaOperator: "add",
    formulaRightMode: "literal",
    formulaRightLiteral: "0",
    formulaRightFieldId: "",
    isXpPool: false,
    xpUpgradable: false,
    xpCost: "1",
    xpStep: "1",
    xpMax: "",
    bonusFieldId: "",
  });
  const [relationForm, setRelationForm] = useState({
    type: "requires",
    sourceBoxId: "",
    targetBoxId: "",
    modifier: "1",
  });
  const [ruleForm, setRuleForm] = useState({
    name: "",
    leftFieldId: "",
    operator: "eq",
    rightMode: "literal",
    rightLiteral: "",
    rightFieldId: "",
    effectType: "set",
    targetBoxId: "",
    effectValueMode: "literal",
    effectValueLiteral: "0",
    effectValueFieldId: "",
  });
  const [loading, setLoading] = useState(Boolean(rulesetId));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [spellBuilderOpen, setSpellBuilderOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const allBoxes = schema.boxes || [];
  const boxById = useMemo(
    () => new Map(allBoxes.map((box) => [box.id, box])),
    [allBoxes]
  );

  const effectiveCategoryByBoxId = useMemo(() => {
    const memo = new Map();

    const resolveCategory = (boxId, trail = new Set()) => {
      if (!boxId) return "";
      if (memo.has(boxId)) return memo.get(boxId);
      if (trail.has(boxId)) return "";

      trail.add(boxId);
      const box = boxById.get(boxId);
      if (!box) return "";

      const resolved = box.categoryId || resolveCategory(box.parentId, trail) || "";
      memo.set(boxId, resolved);
      return resolved;
    };

    allBoxes.forEach((box) => {
      resolveCategory(box.id);
    });

    return memo;
  }, [allBoxes, boxById]);

  const filteredBoxes = useMemo(() => {
    if (!activeCategoryId) return allBoxes;
    return allBoxes.filter(
      (box) => effectiveCategoryByBoxId.get(box.id) === activeCategoryId
    );
  }, [activeCategoryId, allBoxes, effectiveCategoryByBoxId]);

  const filteredBoxIdSet = useMemo(
    () => new Set(filteredBoxes.map((box) => box.id)),
    [filteredBoxes]
  );

  const fieldBoxes = useMemo(
    () => allBoxes.filter((box) => box.type === "field"),
    [allBoxes]
  );
  const groupBoxes = useMemo(
    () => allBoxes.filter((box) => box.type !== "field"),
    [allBoxes]
  );
  const filteredFieldBoxes = useMemo(
    () => filteredBoxes.filter((box) => box.type === "field"),
    [filteredBoxes]
  );
  const filteredGroupBoxes = useMemo(
    () => filteredBoxes.filter((box) => box.type !== "field"),
    [filteredBoxes]
  );

  const flatBoxes = useMemo(() => {
    const byParent = new Map();
    allBoxes.forEach((box) => {
      const key = box.parentId || "__root__";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(box);
    });

    byParent.forEach((list) => {
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    const result = [];
    const walk = (parentId, depth) => {
      (byParent.get(parentId) || []).forEach((box) => {
        result.push({ ...box, depth });
        walk(box.id, depth + 1);
      });
    };

    walk("__root__", 0);
    return result;
  }, [allBoxes]);

  const filteredFlatBoxes = useMemo(() => {
    if (!activeCategoryId) return flatBoxes;
    return flatBoxes.filter((box) => filteredBoxIdSet.has(box.id));
  }, [activeCategoryId, flatBoxes, filteredBoxIdSet]);

  const filteredRelations = useMemo(() => {
    if (!activeCategoryId) return schema.relations;
    return schema.relations.filter((relation) => {
      const sourceInCategory = filteredBoxIdSet.has(relation.sourceBoxId);
      const targetInCategory = filteredBoxIdSet.has(relation.targetBoxId);
      return sourceInCategory || targetInCategory;
    });
  }, [activeCategoryId, filteredBoxIdSet, schema.relations]);

  const filteredRules = useMemo(() => {
    if (!activeCategoryId) return schema.rules;

    return schema.rules.filter((rule) => {
      const touchedBoxIds = new Set();
      collectFieldIdsFromExpression(rule.condition, touchedBoxIds);
      rule.effects.forEach((effect) => {
        if (effect.targetBoxId) {
          touchedBoxIds.add(effect.targetBoxId);
        }
        collectFieldIdsFromExpression(effect.value, touchedBoxIds);
      });

      for (const touchedId of touchedBoxIds) {
        if (filteredBoxIdSet.has(touchedId)) {
          return true;
        }
      }
      return false;
    });
  }, [activeCategoryId, filteredBoxIdSet, schema.rules]);

  const spellGroups = schema.spellGroups || [];
  const spells = schema.spells || [];

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
        setSchema(normalizeRulesetSchema(current.draft_schema || buildStarterTemplate()));
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

  useEffect(() => {
    if (!activeCategoryId) return;
    const stillExists = schema.categories.some(
      (category) => category.id === activeCategoryId
    );
    if (!stillExists) {
      setActiveCategoryId("");
    }
  }, [activeCategoryId, schema.categories]);

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
        setSchema(normalizeRulesetSchema(data.ruleset.draft_schema));
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

  const toggleCategory = (name) => {
    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      const index = next.categories.findIndex((category) => category.name === name);
      if (index >= 0) {
        next.categories[index] = {
          ...next.categories[index],
          enabled: !next.categories[index].enabled,
        };
      } else {
        next.categories.push({ id: makeId("category"), name, enabled: true });
      }
      return next;
    });
  };

  const addCustomCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;

    let createdCategoryId = "";
    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      const existing = next.categories.find((category) => category.name === name);
      if (existing) {
        createdCategoryId = existing.id;
      } else {
        const id = makeId("category");
        createdCategoryId = id;
        next.categories.push({ id, name, enabled: true });
      }
      return next;
    });

    if (createdCategoryId) {
      setActiveCategoryId(createdCategoryId);
    }
    setNewCategoryName("");
  };

  const addBox = () => {
    const label = boxForm.label.trim();
    if (!label) {
      setError("Box label is required.");
      return;
    }

    const box = {
      id: makeId("box"),
      type: boxForm.type,
      label,
      parentId: boxForm.parentId || null,
      categoryId: boxForm.categoryId || null,
      order: allBoxes.length,
    };

    if (boxForm.type === "field") {
      box.fieldType = boxForm.fieldType;
      box.editableBy = boxForm.editableBy;
      box.key =
        label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || box.id;
      box.defaultValue = parseLiteral(boxForm.defaultValue);
      box.options = boxForm.optionsText
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      box.formula =
        boxForm.fieldType === "computed"
          ? boxForm.formulaLeftFieldId
            ? {
                op: boxForm.formulaOperator,
                args: [
                  { op: "field", fieldId: boxForm.formulaLeftFieldId },
                  toValueExpression(
                    boxForm.formulaRightMode,
                    boxForm.formulaRightLiteral,
                    boxForm.formulaRightFieldId
                  ),
                ],
              }
            : { op: "literal", value: 0 }
          : { op: "literal", value: 0 };
      box.isXpPool = boxForm.fieldType === "number" && boxForm.isXpPool;
      box.xpUpgradable = boxForm.fieldType === "number" && boxForm.xpUpgradable;
      const parsedCost = Number(boxForm.xpCost);
      const parsedStep = Number(boxForm.xpStep);
      const parsedMax = Number(boxForm.xpMax);
      box.xpCost =
        box.xpUpgradable && Number.isFinite(parsedCost) && parsedCost >= 0
          ? parsedCost
          : 0;
      box.xpStep =
        box.xpUpgradable && Number.isFinite(parsedStep) && parsedStep > 0
          ? parsedStep
          : 1;
      box.xpMax =
        box.xpUpgradable && Number.isFinite(parsedMax) && parsedMax >= 0
          ? parsedMax
          : null;
      box.bonusFieldId =
        boxForm.fieldType === "number" && boxForm.bonusFieldId
          ? boxForm.bonusFieldId
          : null;
    }

    if (boxForm.type === "repeatable_group") {
      const parsed = Number(boxForm.repeatLimit);
      box.repeatLimit = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }

    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      next.boxes.push(box);
      return next;
    });

    setBoxForm((prev) => ({
      ...prev,
      label: "",
      defaultValue: "",
      optionsText: "",
      formulaLeftFieldId: "",
      formulaRightLiteral: "0",
      formulaRightFieldId: "",
      isXpPool: false,
      xpUpgradable: false,
      xpCost: "1",
      xpStep: "1",
      xpMax: "",
      bonusFieldId: "",
    }));
    setError("");
  };

  const updateBox = (boxId, updates) => {
    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      next.boxes = next.boxes.map((box) => (box.id === boxId ? { ...box, ...updates } : box));
      return next;
    });
  };

  const removeBox = (boxId) => {
    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      const ids = new Set([boxId]);
      let changed = true;
      while (changed) {
        changed = false;
        next.boxes.forEach((box) => {
          if (box.parentId && ids.has(box.parentId) && !ids.has(box.id)) {
            ids.add(box.id);
            changed = true;
          }
        });
      }

      const statLinkedGroup = next.spellGroups.find(
        (group) => group.linkedStatFieldId && ids.has(group.linkedStatFieldId)
      );
      if (statLinkedGroup) {
        setError(
          `Cannot delete this field. It is linked to spell group '${statLinkedGroup.name}'.`
        );
        return next;
      }

      const effectLinkedSpell = next.spells.find((spell) =>
        spell.levels.some((level) =>
          level.effects.some(
            (effect) => effect.targetFieldId && ids.has(effect.targetFieldId)
          )
        )
      );
      if (effectLinkedSpell) {
        setError(
          `Cannot delete this field. It is used by spell '${effectLinkedSpell.name}'.`
        );
        return next;
      }

      next.boxes = next.boxes.filter((box) => !ids.has(box.id));
      next.relations = next.relations.filter(
        (relation) => !ids.has(relation.sourceBoxId) && !ids.has(relation.targetBoxId)
      );
      next.rules = next.rules
        .map((rule) => ({
          ...rule,
          effects: rule.effects.filter((effect) => !ids.has(effect.targetBoxId)),
        }))
        .filter((rule) => rule.effects.length > 0);
      return next;
    });
  };

  const addRelation = () => {
    if (!relationForm.sourceBoxId || !relationForm.targetBoxId) {
      setError("Relation needs source and target.");
      return;
    }

    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      next.relations.push({
        id: makeId("relation"),
        type: relationForm.type,
        sourceBoxId: relationForm.sourceBoxId,
        targetBoxId: relationForm.targetBoxId,
        modifier: Number(relationForm.modifier) || 0,
        valueExpr: {
          op: "literal",
          value: Number(relationForm.modifier) || 0,
        },
      });
      return next;
    });

    setRelationForm({ type: "requires", sourceBoxId: "", targetBoxId: "", modifier: "1" });
    setError("");
  };

  const removeRelation = (relationId) => {
    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      next.relations = next.relations.filter((relation) => relation.id !== relationId);
      return next;
    });
  };

  const addRule = () => {
    const name = ruleForm.name.trim();
    if (!name) {
      setError("Rule name is required.");
      return;
    }
    if (!ruleForm.leftFieldId || !ruleForm.targetBoxId) {
      setError("Rule needs condition field and target box.");
      return;
    }

    const condition = {
      op: ruleForm.operator,
      left: { op: "field", fieldId: ruleForm.leftFieldId },
      right:
        ruleForm.rightMode === "field"
          ? { op: "field", fieldId: ruleForm.rightFieldId }
          : {
              op: "literal",
              value:
                ruleForm.operator === "in"
                  ? String(ruleForm.rightLiteral || "")
                      .split(",")
                      .map((token) => token.trim())
                      .filter(Boolean)
                  : parseLiteral(ruleForm.rightLiteral),
            },
    };

    const effect = {
      id: makeId("effect"),
      type: ruleForm.effectType,
      targetBoxId: ruleForm.targetBoxId,
      value: toValueExpression(
        ruleForm.effectValueMode,
        ruleForm.effectValueLiteral,
        ruleForm.effectValueFieldId
      ),
    };

    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      next.rules.push({
        id: makeId("rule"),
        name,
        condition,
        effects: [effect],
      });
      return next;
    });

    setRuleForm((prev) => ({ ...prev, name: "", leftFieldId: "", targetBoxId: "" }));
    setError("");
  };

  const removeRule = (ruleId) => {
    setSchema((prev) => {
      const next = normalizeRulesetSchema(prev);
      next.rules = next.rules.filter((rule) => rule.id !== ruleId);
      return next;
    });
  };

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

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded border bg-gray-50 p-3 text-xs">
        <button
          className="rounded bg-indigo-100 px-4 py-2"
          type="button"
          onClick={() => setSpellBuilderOpen(true)}
        >
          Spell Builder
        </button>
        <span className="text-gray-600">
          Spell groups: {spellGroups.length} | Spells: {spells.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">A) Categories / Templates</h3>
          <div className="mb-3 rounded border bg-gray-50 p-2 text-xs">
            <label className="mb-1 block font-medium">Focused Category View</label>
            <select
              className="w-full rounded border p-1 text-xs"
              value={activeCategoryId}
              onChange={(event) => setActiveCategoryId(event.target.value)}
            >
              <option value="">All categories</option>
              {schema.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 text-xs">
            {STARTER_CATEGORY_NAMES.map((name) => {
              const category = schema.categories.find((entry) => entry.name === name);
              return (
                <label key={name} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(category?.enabled)}
                    onChange={() => toggleCategory(name)}
                  />
                  {name}
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded border p-2 text-xs"
              placeholder="Custom category"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
            />
            <button className="rounded bg-green-100 px-3 text-xs" onClick={addCustomCategory} type="button">
              Add
            </button>
          </div>
        </section>

        <section className="rounded border p-4 lg:col-span-2">
          <h3 className="mb-3 font-semibold">
            B) Boxes {activeCategoryId ? "(focused)" : "(all)"}
          </h3>
          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            <select
              className="rounded border p-2 text-xs"
              value={boxForm.type}
              onChange={(event) => setBoxForm((prev) => ({ ...prev, type: event.target.value }))}
            >
              {BOX_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              className="rounded border p-2 text-xs"
              placeholder="Label"
              value={boxForm.label}
              onChange={(event) => setBoxForm((prev) => ({ ...prev, label: event.target.value }))}
            />
            <select
              className="rounded border p-2 text-xs"
              value={boxForm.parentId}
              onChange={(event) => setBoxForm((prev) => ({ ...prev, parentId: event.target.value }))}
            >
              <option value="">No parent</option>
              {(activeCategoryId ? filteredGroupBoxes : groupBoxes).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
            <select
              className="rounded border p-2 text-xs"
              value={boxForm.categoryId}
              onChange={(event) => setBoxForm((prev) => ({ ...prev, categoryId: event.target.value }))}
            >
              <option value="">No category</option>
              {schema.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {boxForm.type === "field" && (
              <>
                <select
                  className="rounded border p-2 text-xs"
                  value={boxForm.fieldType}
                  onChange={(event) => setBoxForm((prev) => ({ ...prev, fieldType: event.target.value }))}
                >
                  {FIELD_TYPES.map((fieldType) => (
                    <option key={fieldType} value={fieldType}>
                      {fieldType}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border p-2 text-xs"
                  value={boxForm.editableBy}
                  onChange={(event) => setBoxForm((prev) => ({ ...prev, editableBy: event.target.value }))}
                >
                  <option value="player">Editable by player</option>
                  <option value="dm">Editable by DM only</option>
                </select>
                <input
                  className="rounded border p-2 text-xs"
                  placeholder="Default value"
                  value={boxForm.defaultValue}
                  onChange={(event) => setBoxForm((prev) => ({ ...prev, defaultValue: event.target.value }))}
                />
                {(boxForm.fieldType === "single_select" || boxForm.fieldType === "multi_select") && (
                  <input
                    className="rounded border p-2 text-xs"
                    placeholder="Options (comma separated)"
                    value={boxForm.optionsText}
                    onChange={(event) => setBoxForm((prev) => ({ ...prev, optionsText: event.target.value }))}
                  />
                )}
                {boxForm.fieldType === "computed" && (
                  <>
                    <select
                      className="rounded border p-2 text-xs"
                      value={boxForm.formulaLeftFieldId}
                      onChange={(event) =>
                        setBoxForm((prev) => ({ ...prev, formulaLeftFieldId: event.target.value }))
                      }
                    >
                      <option value="">Formula left field</option>
                      {(activeCategoryId ? filteredFieldBoxes : fieldBoxes).map((box) => (
                        <option key={box.id} value={box.id}>
                          {box.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded border p-2 text-xs"
                      value={boxForm.formulaOperator}
                      onChange={(event) =>
                        setBoxForm((prev) => ({ ...prev, formulaOperator: event.target.value }))
                      }
                    >
                      {FORMULA_OPERATORS.map((operator) => (
                        <option key={operator} value={operator}>
                          {operator}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded border p-2 text-xs"
                      value={boxForm.formulaRightMode}
                      onChange={(event) =>
                        setBoxForm((prev) => ({ ...prev, formulaRightMode: event.target.value }))
                      }
                    >
                      <option value="literal">Right literal</option>
                      <option value="field">Right field</option>
                    </select>
                    {boxForm.formulaRightMode === "field" ? (
                      <select
                        className="rounded border p-2 text-xs"
                        value={boxForm.formulaRightFieldId}
                        onChange={(event) =>
                          setBoxForm((prev) => ({ ...prev, formulaRightFieldId: event.target.value }))
                        }
                      >
                        <option value="">Formula right field</option>
                        {(activeCategoryId ? filteredFieldBoxes : fieldBoxes).map((box) => (
                          <option key={box.id} value={box.id}>
                            {box.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="rounded border p-2 text-xs"
                        placeholder="Formula right value"
                        value={boxForm.formulaRightLiteral}
                        onChange={(event) =>
                          setBoxForm((prev) => ({ ...prev, formulaRightLiteral: event.target.value }))
                        }
                      />
                    )}
                  </>
                )}
                {boxForm.fieldType === "number" && (
                  <>
                    <label className="flex items-center gap-2 rounded border p-2 text-xs">
                      <input
                        type="checkbox"
                        checked={boxForm.isXpPool}
                        onChange={(event) =>
                          setBoxForm((prev) => ({
                            ...prev,
                            isXpPool: event.target.checked,
                            xpUpgradable: event.target.checked ? false : prev.xpUpgradable,
                          }))
                        }
                      />
                      XP pool field (earned/spendable XP)
                    </label>
                    <label className="flex items-center gap-2 rounded border p-2 text-xs">
                      <input
                        type="checkbox"
                        checked={boxForm.xpUpgradable}
                        onChange={(event) =>
                          setBoxForm((prev) => ({
                            ...prev,
                            xpUpgradable: event.target.checked,
                            isXpPool: event.target.checked ? false : prev.isXpPool,
                          }))
                        }
                      />
                      XP-upgradable field
                    </label>
                    {boxForm.xpUpgradable && (
                      <>
                        <input
                          className="rounded border p-2 text-xs"
                          placeholder="XP cost per purchase"
                          value={boxForm.xpCost}
                          onChange={(event) =>
                            setBoxForm((prev) => ({ ...prev, xpCost: event.target.value }))
                          }
                        />
                        <input
                          className="rounded border p-2 text-xs"
                          placeholder="Increase step (e.g. 1)"
                          value={boxForm.xpStep}
                          onChange={(event) =>
                            setBoxForm((prev) => ({ ...prev, xpStep: event.target.value }))
                          }
                        />
                        <input
                          className="rounded border p-2 text-xs"
                          placeholder="Max value (optional)"
                          value={boxForm.xpMax}
                          onChange={(event) =>
                            setBoxForm((prev) => ({ ...prev, xpMax: event.target.value }))
                          }
                        />
                      </>
                    )}
                    {(boxForm.isXpPool || boxForm.xpUpgradable) && (
                      <p className="rounded border border-blue-100 bg-blue-50 p-2 text-[11px] text-gray-600">
                        XP-governed fields use the DM confirmation flow on character sheets.
                        Players can request spends, but direct raw editing is blocked.
                      </p>
                    )}
                    <select
                      className="rounded border p-2 text-xs"
                      value={boxForm.bonusFieldId}
                      onChange={(event) =>
                        setBoxForm((prev) => ({ ...prev, bonusFieldId: event.target.value }))
                      }
                    >
                      <option value="">No bonus field link</option>
                      {(activeCategoryId ? filteredFieldBoxes : fieldBoxes)
                        .filter((box) => box.fieldType === "number")
                        .map((box) => (
                          <option key={box.id} value={box.id}>
                            Bonus from: {box.label}
                          </option>
                        ))}
                    </select>
                  </>
                )}
              </>
            )}
            {boxForm.type === "repeatable_group" && (
              <input
                className="rounded border p-2 text-xs"
                placeholder="Repeat limit"
                value={boxForm.repeatLimit}
                onChange={(event) => setBoxForm((prev) => ({ ...prev, repeatLimit: event.target.value }))}
              />
            )}
          </div>
          <button onClick={addBox} className="mb-4 rounded bg-blue-100 px-4 py-2 text-xs" type="button">
            Add Box
          </button>

          <div className="space-y-2">
            {filteredFlatBoxes.length === 0 && (
              <p className="text-xs text-gray-500">No boxes in this category view.</p>
            )}
            {filteredFlatBoxes.map((box) => (
              <div
                key={box.id}
                className="rounded border p-2 text-xs"
                style={{ marginLeft: box.depth * 16 }}
              >
                <div className="mb-1 flex items-center gap-2">
                  <input
                    className="flex-1 rounded border p-1"
                    value={box.label}
                    onChange={(event) => updateBox(box.id, { label: event.target.value })}
                  />
                  <span className="rounded bg-gray-100 px-2 py-1">{box.type}</span>
                  <button className="rounded bg-red-100 px-2 py-1" onClick={() => removeBox(box.id)} type="button">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border p-4 lg:col-span-2">
          <h3 className="mb-3 font-semibold">
            C) Relations {activeCategoryId ? "(focused)" : "(all)"}
          </h3>
          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4">
            <select className="rounded border p-2 text-xs" value={relationForm.type} onChange={(event) => setRelationForm((prev) => ({ ...prev, type: event.target.value }))}>
              {RELATION_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select className="rounded border p-2 text-xs" value={relationForm.sourceBoxId} onChange={(event) => setRelationForm((prev) => ({ ...prev, sourceBoxId: event.target.value }))}>
              <option value="">Source</option>
              {(activeCategoryId ? filteredBoxes : allBoxes).map((box) => <option key={box.id} value={box.id}>{box.label}</option>)}
            </select>
            <select className="rounded border p-2 text-xs" value={relationForm.targetBoxId} onChange={(event) => setRelationForm((prev) => ({ ...prev, targetBoxId: event.target.value }))}>
              <option value="">Target</option>
              {(activeCategoryId ? filteredBoxes : allBoxes).map((box) => <option key={box.id} value={box.id}>{box.label}</option>)}
            </select>
            <input className="rounded border p-2 text-xs" value={relationForm.modifier} onChange={(event) => setRelationForm((prev) => ({ ...prev, modifier: event.target.value }))} placeholder="Modifier" />
          </div>
          <button onClick={addRelation} className="mb-3 rounded bg-blue-100 px-4 py-2 text-xs" type="button">Add Relation</button>
          <div className="space-y-2 text-xs">
            {filteredRelations.length === 0 && (
              <p className="text-gray-500">No relations in this category view.</p>
            )}
            {filteredRelations.map((relation) => (
              <div key={relation.id} className="flex items-center justify-between rounded border p-2">
                <span>{relation.type}: {boxLabel(allBoxes, relation.sourceBoxId)} -&gt; {boxLabel(allBoxes, relation.targetBoxId)}</span>
                <button className="rounded bg-red-100 px-2 py-1" type="button" onClick={() => removeRelation(relation.id)}>Remove</button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border p-4 lg:col-span-1">
          <h3 className="mb-3 font-semibold">
            Rule Builder {activeCategoryId ? "(focused)" : "(all)"}
          </h3>
          <div className="space-y-2 text-xs">
            <input className="w-full rounded border p-2" placeholder="Rule name" value={ruleForm.name} onChange={(event) => setRuleForm((prev) => ({ ...prev, name: event.target.value }))} />
            <select className="w-full rounded border p-2" value={ruleForm.leftFieldId} onChange={(event) => setRuleForm((prev) => ({ ...prev, leftFieldId: event.target.value }))}>
              <option value="">Condition field</option>
              {(activeCategoryId ? filteredFieldBoxes : fieldBoxes).map((box) => <option key={box.id} value={box.id}>{box.label}</option>)}
            </select>
            <select className="w-full rounded border p-2" value={ruleForm.operator} onChange={(event) => setRuleForm((prev) => ({ ...prev, operator: event.target.value }))}>
              {RULE_OPERATORS.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
            </select>
            <select className="w-full rounded border p-2" value={ruleForm.rightMode} onChange={(event) => setRuleForm((prev) => ({ ...prev, rightMode: event.target.value }))}>
              <option value="literal">Right literal</option>
              <option value="field">Right field</option>
            </select>
            {ruleForm.rightMode === "field" ? (
              <select className="w-full rounded border p-2" value={ruleForm.rightFieldId} onChange={(event) => setRuleForm((prev) => ({ ...prev, rightFieldId: event.target.value }))}>
                <option value="">Right field</option>
                {(activeCategoryId ? filteredFieldBoxes : fieldBoxes).map((box) => <option key={box.id} value={box.id}>{box.label}</option>)}
              </select>
            ) : (
              <input className="w-full rounded border p-2" placeholder={ruleForm.operator === "in" ? "a,b,c" : "Right literal"} value={ruleForm.rightLiteral} onChange={(event) => setRuleForm((prev) => ({ ...prev, rightLiteral: event.target.value }))} />
            )}
            <select className="w-full rounded border p-2" value={ruleForm.effectType} onChange={(event) => setRuleForm((prev) => ({ ...prev, effectType: event.target.value }))}>
              {EFFECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select className="w-full rounded border p-2" value={ruleForm.targetBoxId} onChange={(event) => setRuleForm((prev) => ({ ...prev, targetBoxId: event.target.value }))}>
              <option value="">Effect target</option>
              {(activeCategoryId ? filteredBoxes : allBoxes).map((box) => <option key={box.id} value={box.id}>{box.label}</option>)}
            </select>
            {(ruleForm.effectType === "set" || ruleForm.effectType === "add" || ruleForm.effectType === "multiply") && (
              <>
                <select className="w-full rounded border p-2" value={ruleForm.effectValueMode} onChange={(event) => setRuleForm((prev) => ({ ...prev, effectValueMode: event.target.value }))}>
                  <option value="literal">Effect literal</option>
                  <option value="field">Effect field</option>
                </select>
                {ruleForm.effectValueMode === "field" ? (
                  <select className="w-full rounded border p-2" value={ruleForm.effectValueFieldId} onChange={(event) => setRuleForm((prev) => ({ ...prev, effectValueFieldId: event.target.value }))}>
                    <option value="">Effect value field</option>
                    {(activeCategoryId ? filteredFieldBoxes : fieldBoxes).map((box) => <option key={box.id} value={box.id}>{box.label}</option>)}
                  </select>
                ) : (
                  <input className="w-full rounded border p-2" placeholder="Effect literal" value={ruleForm.effectValueLiteral} onChange={(event) => setRuleForm((prev) => ({ ...prev, effectValueLiteral: event.target.value }))} />
                )}
              </>
            )}
            <button className="w-full rounded bg-blue-100 py-2" onClick={addRule} type="button">Add Rule</button>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded border p-4">
        <h3 className="mb-2 font-semibold">Rules + Graph Preview</h3>
        <div className="mb-2 space-y-2 text-xs">
          {filteredRules.length === 0 && (
            <p className="text-gray-500">No rules in this category view.</p>
          )}
          {filteredRules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded border p-2">
              <span>{rule.name}</span>
              <button className="rounded bg-red-100 px-2 py-1" onClick={() => removeRule(rule.id)} type="button">Remove</button>
            </div>
          ))}
        </div>
        <pre className="max-h-64 overflow-auto rounded bg-gray-50 p-2 text-[11px]">
          {JSON.stringify(schema, null, 2)}
        </pre>
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

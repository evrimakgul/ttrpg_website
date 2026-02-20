import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DiceRoller from "../components/DiceRoller";
import EditableField from "../components/EditableField";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  buildBoxTree,
  buildInitialValues,
  evaluateRulesetRuntime,
  normalizeRulesetSchema,
} from "../lib/rulesEngine";

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

const EMPTY_XP_SUMMARY = {
  earned_session: 0,
  earned_total: 0,
  xp_used: 0,
  xp_leftover: 0,
};

function getNodeLayout(node) {
  return {
    width: node?.layout?.width || "full",
    height: node?.layout?.height || "regular",
  };
}

function widthClass(width) {
  if (width === "small") return "md:col-span-3";
  if (width === "medium") return "md:col-span-6";
  if (width === "large") return "md:col-span-8";
  return "md:col-span-12";
}

function heightClass(height) {
  if (height === "compact") return "min-h-[52px]";
  if (height === "tall") return "min-h-[112px]";
  return "min-h-[76px]";
}

export default function CharacterSheet() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const { user } = useAuth();
  const [values, setValues] = useState(buildDefaultValues);
  const [customInputValues, setCustomInputValues] = useState({});
  const [runtime, setRuntime] = useState(null);
  const [memberRole, setMemberRole] = useState("player");
  const [character, setCharacter] = useState(EMPTY_CHARACTER);
  const [xpTransactions, setXpTransactions] = useState([]);
  const [xpSummary, setXpSummary] = useState(EMPTY_XP_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const customMode = runtime?.mode === "custom" && runtime?.schema;

  const normalizedRuntimeSchema = useMemo(
    () => (customMode ? normalizeRulesetSchema(runtime.schema) : null),
    [customMode, runtime]
  );

  const customTree = useMemo(
    () => (normalizedRuntimeSchema ? buildBoxTree(normalizedRuntimeSchema) : []),
    [normalizedRuntimeSchema]
  );

  const customRuntimeState = useMemo(() => {
    if (!normalizedRuntimeSchema) return null;
    return evaluateRulesetRuntime(
      normalizedRuntimeSchema,
      customInputValues,
      memberRole || "player"
    );
  }, [customInputValues, memberRole, normalizedRuntimeSchema]);

  const xpPoolField = useMemo(() => {
    if (!normalizedRuntimeSchema) return null;
    return (
      normalizedRuntimeSchema.boxes.find(
        (box) =>
          box.type === "field" &&
          (box.fieldType === "number" || box.fieldType === "computed") &&
          box.isXpPool
      ) || null
    );
  }, [normalizedRuntimeSchema]);

  const applyLoadedCharacter = (savedCharacter, runtimePayload) => {
    if (!savedCharacter) {
      setCharacter(EMPTY_CHARACTER);
      if (runtimePayload?.mode === "custom" && runtimePayload?.schema) {
        setCustomInputValues(buildInitialValues(runtimePayload.schema));
      }
      setXpTransactions([]);
      setXpSummary(EMPTY_XP_SUMMARY);
      return;
    }

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

    const savedValues =
      typeof savedCharacter.sheet_json?.values === "object" &&
      savedCharacter.sheet_json.values
        ? savedCharacter.sheet_json.values
        : {};

    if (runtimePayload?.mode === "custom" && runtimePayload?.schema) {
      const baseValues = buildInitialValues(runtimePayload.schema);
      setCustomInputValues({
        ...baseValues,
        ...savedValues,
      });
      setXpTransactions(
        Array.isArray(savedCharacter.sheet_json?.xp_transactions)
          ? savedCharacter.sheet_json.xp_transactions
          : []
      );
      setXpSummary({
        ...EMPTY_XP_SUMMARY,
        ...(savedCharacter.sheet_json?.xp_summary || {}),
      });
      return;
    }

    setValues((prev) => ({
      ...prev,
      ...savedValues,
    }));
    setXpTransactions([]);
    setXpSummary(EMPTY_XP_SUMMARY);
  };

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
        const [characterData, runtimeData] = await Promise.all([
          apiFetch(`/api/games/${gameId}/characters/me`),
          apiFetch(`/api/games/${gameId}/ruleset-runtime`),
        ]);

        const savedCharacter = characterData.character;
        setRuntime(runtimeData.runtime || null);
        setMemberRole(runtimeData.member_role || "player");
        applyLoadedCharacter(savedCharacter, runtimeData.runtime || null);
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

  const updateCustomInput = (fieldId, value) => {
    setCustomInputValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const buyXpUpgrade = async (field) => {
    if (!gameId) {
      setError("Missing game id.");
      return;
    }

    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/api/games/${gameId}/characters/me/xp/spend`, {
        method: "POST",
        body: {
          field_id: field.id,
        },
      });

      applyLoadedCharacter(data.character || null, runtime);
      if (data?.xp_summary) {
        setXpSummary({
          ...EMPTY_XP_SUMMARY,
          ...data.xp_summary,
        });
      }
      setMessage(
        data?.transaction
          ? `${field.label} purchase request created (${data.transaction.status}).`
          : "XP spend request created."
      );
    } catch (err) {
      setError(err.message || "Could not submit XP spend request.");
    }
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
      const payloadSheet = customMode ? { values: customInputValues } : { values };

      const data = await apiFetch(`/api/games/${gameId}/characters`, {
        method: "POST",
        body: {
          ...character,
          sheet_json: payloadSheet,
        },
      });

      if (data?.character) {
        applyLoadedCharacter(data.character, runtime);
      }
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

      {customMode && customRuntimeState ? (
        <div className="mb-6 rounded-xl border p-4">
          <h3 className="mb-4 text-center text-md font-semibold">
            Custom Ruleset Sheet
          </h3>
          <div className="mb-3 rounded border border-blue-100 bg-blue-50 p-3 text-xs">
            <h4 className="mb-2 font-semibold">XP Summary</h4>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <SummaryStat
                label="XP Earned in Session"
                value={Number(xpSummary.earned_session || 0)}
              />
              <SummaryStat
                label="XP Earned Total"
                value={Number(xpSummary.earned_total || 0)}
              />
              <SummaryStat label="XP Used" value={Number(xpSummary.xp_used || 0)} />
              <SummaryStat
                label="XP Leftover"
                value={Number(xpSummary.xp_leftover || 0)}
              />
            </div>
            {xpPoolField ? (
              <p className="mt-2 text-[11px] text-gray-600">
                XP Pool Field: <strong>{xpPoolField.label}</strong>
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-gray-500">
                No XP pool field configured in this ruleset.
              </p>
            )}
          </div>
          {customTree.length === 0 && (
            <p className="text-xs text-gray-500">
              This ruleset has no boxes yet. Add boxes in ruleset editor.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            {customTree
              .filter((node) => !(node.type === "field" && node.hidden))
              .map((node) => (
              <div key={node.id} className={widthClass(getNodeLayout(node).width)}>
                <CustomNode
                  node={node}
                  runtimeState={customRuntimeState}
                  memberRole={memberRole}
                  onChange={updateCustomInput}
                  onBuyXp={buyXpUpgrade}
                  xpPoolFieldId={xpPoolField?.id || null}
                  xpAvailableValue={
                    xpPoolField?.fieldType === "computed"
                      ? Number(xpSummary.xp_leftover || 0)
                      : xpPoolField
                        ? Number(customRuntimeState.values[xpPoolField.id] || 0)
                        : 0
                  }
                />
              </div>
              ))}
          </div>
          {xpTransactions.length > 0 && (
            <div className="mt-4 rounded border bg-gray-50 p-2 text-xs">
              <h4 className="mb-2 font-semibold">XP Transactions</h4>
              <div className="max-h-36 overflow-auto space-y-1">
                {xpTransactions
                  .slice()
                  .reverse()
                  .slice(0, 25)
                  .map((row) => (
                    <div key={row.id} className="rounded border bg-white p-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span>{new Date(row.at).toLocaleString()}</span>
                        <span className={xpStatusBadgeClass(row.status)}>
                          {row.status || "confirmed"}
                        </span>
                      </div>
                      {row.type === "session_award" ? (
                        <div>
                          Session award: +{Number(row.amount || 0)} XP
                          {row.session_tag ? ` (${row.session_tag})` : ""}
                        </div>
                      ) : (
                        <div>
                          {row.field_label || "Field"} +{Number(row.step || 0)} | cost{" "}
                          {Number(row.cost || 0)} XP ({Number(row.xp_before || 0)} -&gt;{" "}
                          {Number(row.xp_after || 0)})
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
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
        </>
      )}

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

function CustomNode({
  node,
  runtimeState,
  memberRole,
  onChange,
  onBuyXp,
  xpPoolFieldId,
  xpAvailableValue,
}) {
  const enabled = runtimeState.enabled[node.id] !== false;
  const layout = getNodeLayout(node);

  if (node.type === "field" && node.hidden) {
    return null;
  }

  if (node.type !== "field") {
    return (
      <div className={`rounded border p-3 ${heightClass(layout.height)}`}>
        <h4 className="mb-2 font-semibold">
          {node.label}
          {node.type === "repeatable_group" && " (repeatable)"}
        </h4>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
          {(node.children || [])
            .filter((child) => !(child.type === "field" && child.hidden))
            .map((child) => (
            <div key={child.id} className={widthClass(getNodeLayout(child).width)}>
              <CustomNode
                node={child}
                runtimeState={runtimeState}
                memberRole={memberRole}
                onChange={onChange}
                onBuyXp={onBuyXp}
                xpPoolFieldId={xpPoolFieldId}
                xpAvailableValue={xpAvailableValue}
              />
            </div>
            ))}
        </div>
      </div>
    );
  }

  const value = runtimeState.values[node.id];
  const isComputed = node.fieldType === "computed";
  const dmOnly = node.editableBy === "dm";
  const xpGoverned =
    node.fieldType === "number" && (node.xpUpgradable || node.isXpPool);
  const canDirectEdit =
    enabled &&
    !isComputed &&
    (memberRole === "dm" || !dmOnly) &&
    !(memberRole !== "dm" && xpGoverned);
  const xpAvailable = xpPoolFieldId
    ? Number(xpAvailableValue ?? runtimeState.values[xpPoolFieldId] ?? 0)
    : 0;
  const xpCost = Number(node.xpCost || 0);
  const xpStep = Number(node.xpStep || 1);
  const hasXpBuy = node.fieldType === "number" && node.xpUpgradable;
  const maxReached =
    node.xpMax !== null &&
    Number.isFinite(Number(node.xpMax)) &&
    Number(value || 0) >= Number(node.xpMax);

  const bonusValue =
    node.fieldType === "number" && node.bonusFieldId
      ? Number(runtimeState.values[node.bonusFieldId] || 0)
      : 0;
  const hasBonus = node.fieldType === "number" && node.bonusFieldId;
  const totalValue = Number(value || 0) + bonusValue;

  return (
    <div
      className={`rounded border p-2 ${heightClass(layout.height)} ${enabled ? "" : "opacity-50"}`}
      title={!enabled ? "Disabled by relations/rules." : ""}
    >
      <label className="mb-1 block text-xs font-medium">{node.label}</label>
      {node.fieldType === "number" && (
        <>
          <input
            type="number"
            className="w-full rounded border p-2 text-xs"
            value={Number(value ?? 0)}
            readOnly={!canDirectEdit}
            onChange={(event) => onChange(node.id, Number(event.target.value || 0))}
          />
          {hasBonus && (
            <p className="mt-1 text-[11px] text-gray-600">
              Base: {Number(value || 0)} | Bonus: {bonusValue >= 0 ? "+" : ""}
              {bonusValue} | Current: {totalValue}
            </p>
          )}
          {hasXpBuy && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded bg-blue-100 px-2 py-1 text-[11px] disabled:opacity-60"
                disabled={
                  memberRole !== "player" ||
                  !enabled ||
                  !xpPoolFieldId ||
                  xpAvailable < xpCost ||
                  maxReached ||
                  xpStep <= 0
                }
                onClick={() => onBuyXp(node)}
              >
                Buy +{xpStep} ({xpCost} XP)
              </button>
              {node.xpMax !== null && (
                <span className="text-[11px] text-gray-500">Max: {node.xpMax}</span>
              )}
            </div>
          )}
        </>
      )}
      {node.fieldType === "text" && (
        <input
          type="text"
          className="w-full rounded border p-2 text-xs"
          value={String(value ?? "")}
          readOnly={!canDirectEdit}
          onChange={(event) => onChange(node.id, event.target.value)}
        />
      )}
      {node.fieldType === "boolean" && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={!canDirectEdit}
            onChange={(event) => onChange(node.id, event.target.checked)}
          />
          Enabled
        </label>
      )}
      {node.fieldType === "single_select" && (
        <select
          className="w-full rounded border p-2 text-xs"
          value={String(value ?? "")}
          disabled={!canDirectEdit}
          onChange={(event) => onChange(node.id, event.target.value)}
        >
          <option value="">Select</option>
          {(node.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
      {node.fieldType === "multi_select" && (
        <div className="space-y-1 text-xs">
          {(node.options || []).map((option) => {
            const current = Array.isArray(value) ? value : [];
            const selected = current.includes(option);
            return (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={!canDirectEdit}
                  onChange={(event) => {
                    if (!canDirectEdit) return;
                    if (event.target.checked) {
                      onChange(node.id, [...current, option]);
                    } else {
                      onChange(
                        node.id,
                        current.filter((entry) => entry !== option)
                      );
                    }
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      )}
      {node.fieldType === "computed" && (
        <input
          type="text"
          className="w-full rounded border border-gray-300 bg-gray-100 p-2 text-xs"
          value={String(value ?? "")}
          readOnly
        />
      )}
      {!enabled && <p className="mt-1 text-[11px] text-gray-500">Disabled by rules.</p>}
      {dmOnly && memberRole !== "dm" && (
        <p className="mt-1 text-[11px] text-gray-500">DM-only field.</p>
      )}
      {xpGoverned && memberRole !== "dm" && (
        <p className="mt-1 text-[11px] text-gray-500">
          Governed by XP workflow; direct edits are blocked.
        </p>
      )}
      {hasXpBuy && !xpPoolFieldId && (
        <p className="mt-1 text-[11px] text-gray-500">
          No XP pool field configured in ruleset.
        </p>
      )}
    </div>
  );
}

function xpStatusBadgeClass(status) {
  if (status === "pending") return "rounded bg-yellow-100 px-2 py-0.5 text-[11px]";
  if (status === "confirmed") return "rounded bg-green-100 px-2 py-0.5 text-[11px]";
  if (status === "unlocked") return "rounded bg-orange-100 px-2 py-0.5 text-[11px]";
  if (status === "reverted") return "rounded bg-red-100 px-2 py-0.5 text-[11px]";
  return "rounded bg-gray-100 px-2 py-0.5 text-[11px]";
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded border bg-white p-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
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

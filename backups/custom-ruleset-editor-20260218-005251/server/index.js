require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const crypto = require("crypto");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");
const {
  EMPTY_RULESET_SCHEMA,
  normalizeRulesetSchema,
  validateRulesetSchema,
  evaluateRulesetRuntime,
} = require("./rules-engine");

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ error: message });
}

async function getUserFromToken(token) {
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function getTokenProjectRef(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload.ref || null;
  } catch {
    return null;
  }
}

function toDisplayName(user) {
  return (
    user.user_metadata?.display_name ||
    user.user_metadata?.name ||
    user.email ||
    "Player"
  );
}

async function ensureProfile(user) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: toDisplayName(user),
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

function randomInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";

  for (let i = 0; i < 8; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    token += alphabet[index];
  }

  return `${token.slice(0, 4)}-${token.slice(4)}`;
}

async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const inviteCode = randomInviteCode();
    const { data, error } = await supabase
      .from("games")
      .select("id")
      .eq("invite_code", inviteCode)
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return inviteCode;
    }
  }

  return `GAME-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function getMembership(gameId, userId) {
  const { data, error } = await supabase
    .from("game_members")
    .select("id, game_id, user_id, role")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function normalizeStringList(values, fallback = []) {
  if (!Array.isArray(values)) return fallback;

  const normalized = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return [...new Set(normalized)];
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

async function getGameById(gameId) {
  const { data: game, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (error) throw error;
  return game;
}

function staticRuntimePayload(game) {
  return {
    mode: "builtin",
    ruleset_type: "builtin",
    ruleset_name: game?.ruleset_name || null,
    ruleset_id: null,
    ruleset_version: null,
    schema: EMPTY_RULESET_SCHEMA,
  };
}

async function resolveGameRulesetRuntime(game) {
  if (
    !game ||
    game.ruleset_type !== "custom" ||
    !game.ruleset_id ||
    !Number.isInteger(Number(game.ruleset_version)) ||
    Number(game.ruleset_version) <= 0
  ) {
    return staticRuntimePayload(game);
  }

  const targetVersion = Number(game.ruleset_version);
  const { data: versionRow, error: versionError } = await supabase
    .from("ruleset_versions")
    .select("ruleset_id, version, schema_json")
    .eq("ruleset_id", game.ruleset_id)
    .eq("version", targetVersion)
    .maybeSingle();

  if (versionError) throw versionError;

  if (!versionRow) {
    return staticRuntimePayload(game);
  }

  return {
    mode: "custom",
    ruleset_type: "custom",
    ruleset_name: game.ruleset_name || null,
    ruleset_id: versionRow.ruleset_id,
    ruleset_version: versionRow.version,
    schema: normalizeRulesetSchema(versionRow.schema_json),
  };
}

async function ensureOwnedRulesetVersion(userId, rulesetId, rulesetVersion) {
  if (!isUuid(rulesetId)) {
    return { error: "ruleset_id must be a valid UUID." };
  }

  const parsedVersion = Number(rulesetVersion);
  if (!Number.isInteger(parsedVersion) || parsedVersion <= 0) {
    return { error: "ruleset_version must be a positive integer." };
  }

  const { data: ruleset, error: rulesetError } = await supabase
    .from("rulesets")
    .select("id, name")
    .eq("id", rulesetId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (rulesetError) throw rulesetError;
  if (!ruleset) return { error: "Custom ruleset not found." };

  const { data: versionRow, error: versionError } = await supabase
    .from("ruleset_versions")
    .select("ruleset_id, version")
    .eq("ruleset_id", ruleset.id)
    .eq("version", parsedVersion)
    .maybeSingle();

  if (versionError) throw versionError;
  if (!versionRow) return { error: "Published ruleset version not found." };

  return {
    rulesetId: ruleset.id,
    rulesetName: ruleset.name,
    rulesetVersion: parsedVersion,
  };
}

const STARTER_CATEGORY_NAMES = [
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

function buildStarterTemplate(seedCategories) {
  const chosen = new Set(
    Array.isArray(seedCategories)
      ? seedCategories.map((entry) => String(entry || "").trim()).filter(Boolean)
      : []
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
    spellGroups: [],
    spells: [],
  };
}

const XP_TRANSACTION_TYPES = new Set(["session_award", "spend"]);
const XP_TRANSACTION_STATUSES = new Set([
  "pending",
  "confirmed",
  "unlocked",
  "reverted",
]);

function isPlainRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function valuesEqual(left, right) {
  if (typeof left === "number" || typeof right === "number") {
    return toFiniteNumber(left, 0) === toFiniteNumber(right, 0);
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    const leftArray = Array.isArray(left) ? left : [];
    const rightArray = Array.isArray(right) ? right : [];
    return JSON.stringify(leftArray) === JSON.stringify(rightArray);
  }
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function normalizeXpTransaction(entry) {
  const raw = isPlainRecord(entry) ? entry : {};

  let type = String(raw.type || "").trim();
  if (!XP_TRANSACTION_TYPES.has(type)) {
    type = raw.field_id ? "spend" : "session_award";
  }
  if (!XP_TRANSACTION_TYPES.has(type)) {
    type = "spend";
  }

  let status = String(raw.status || "").trim();
  if (!XP_TRANSACTION_STATUSES.has(status)) {
    status = "confirmed";
  }

  const amount = toFiniteNumber(raw.amount ?? raw.cost, 0);
  const cost = toFiniteNumber(raw.cost, 0);
  const step = toFiniteNumber(raw.step, 0);

  return {
    id: String(raw.id || crypto.randomUUID()),
    type,
    status,
    at: String(raw.at || new Date().toISOString()),
    field_id: String(raw.field_id || ""),
    field_label: String(raw.field_label || ""),
    amount: amount >= 0 ? amount : 0,
    cost: cost >= 0 ? cost : 0,
    step,
    before: toFiniteNumber(raw.before, 0),
    after: toFiniteNumber(raw.after, 0),
    xp_before: toFiniteNumber(raw.xp_before, 0),
    xp_after: toFiniteNumber(raw.xp_after, 0),
    session_tag: raw.session_tag ? String(raw.session_tag) : null,
    created_by_user_id: raw.created_by_user_id ? String(raw.created_by_user_id) : null,
    confirmed_by_user_id: raw.confirmed_by_user_id ? String(raw.confirmed_by_user_id) : null,
    confirmed_at: raw.confirmed_at ? String(raw.confirmed_at) : null,
    unlocked_by_user_id: raw.unlocked_by_user_id ? String(raw.unlocked_by_user_id) : null,
    unlocked_at: raw.unlocked_at ? String(raw.unlocked_at) : null,
    reverted_by_user_id: raw.reverted_by_user_id ? String(raw.reverted_by_user_id) : null,
    reverted_at: raw.reverted_at ? String(raw.reverted_at) : null,
  };
}

function normalizeXpTransactions(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(-1000).map((entry) => normalizeXpTransaction(entry));
}

function computeXpSummary(transactions) {
  const safeTransactions = normalizeXpTransactions(transactions);
  let earnedTotal = 0;
  let usedConfirmed = 0;
  let usedPending = 0;
  let latestSessionAward = null;

  safeTransactions.forEach((transaction) => {
    if (transaction.type === "session_award") {
      if (transaction.status === "pending" || transaction.status === "confirmed") {
        if (
          !latestSessionAward ||
          new Date(transaction.at).getTime() >= new Date(latestSessionAward.at).getTime()
        ) {
          latestSessionAward = transaction;
        }
      }
      if (transaction.status === "confirmed") {
        earnedTotal += toFiniteNumber(transaction.amount, 0);
      }
      return;
    }

    if (transaction.type === "spend") {
      if (transaction.status === "confirmed") {
        usedConfirmed += toFiniteNumber(transaction.cost, 0);
      } else if (transaction.status === "pending") {
        usedPending += toFiniteNumber(transaction.cost, 0);
      }
    }
  });

  const used = usedConfirmed + usedPending;

  return {
    earned_session: latestSessionAward ? toFiniteNumber(latestSessionAward.amount, 0) : 0,
    earned_total: earnedTotal,
    xp_used: used,
    xp_used_confirmed: usedConfirmed,
    xp_used_pending: usedPending,
    xp_leftover: earnedTotal - used,
    pending_count: safeTransactions.filter((transaction) => transaction.status === "pending")
      .length,
  };
}

function getCustomSchemaMeta(schemaInput) {
  const schema = normalizeRulesetSchema(schemaInput);
  const fields = schema.boxes.filter((box) => box.type === "field");
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const xpUpgradableFieldIds = new Set();
  const xpGovernedFieldIds = new Set();
  let xpPoolField = null;

  fields.forEach((field) => {
    if (field.fieldType === "number" && field.xpUpgradable) {
      xpUpgradableFieldIds.add(field.id);
      xpGovernedFieldIds.add(field.id);
    }
    if (!xpPoolField && field.fieldType === "number" && field.isXpPool) {
      xpPoolField = field;
      xpGovernedFieldIds.add(field.id);
    }
  });

  return {
    schema,
    fields,
    fieldById,
    xpPoolField,
    xpUpgradableFieldIds,
    xpGovernedFieldIds,
  };
}

function getCharacterSheetObject(character) {
  if (!isPlainRecord(character?.sheet_json)) {
    return {};
  }
  return character.sheet_json;
}

function getCharacterValues(character) {
  const sheet = getCharacterSheetObject(character);
  if (!isPlainRecord(sheet.values)) {
    return {};
  }
  return { ...sheet.values };
}

function getCharacterTransactions(character) {
  const sheet = getCharacterSheetObject(character);
  return normalizeXpTransactions(sheet.xp_transactions);
}

function buildCustomSheetJson(runtime, valuesInput, transactionsInput) {
  const meta = getCustomSchemaMeta(runtime.schema);
  const baseValues = isPlainRecord(valuesInput) ? { ...valuesInput } : {};
  const transactions = normalizeXpTransactions(transactionsInput);
  const xpSummary = computeXpSummary(transactions);

  if (meta.xpPoolField) {
    baseValues[meta.xpPoolField.id] = xpSummary.xp_leftover;
  }

  const validation = evaluateRulesetRuntime(meta.schema, baseValues, "dm");
  const mergedValues = {
    ...baseValues,
    ...validation.rawValues,
  };

  if (meta.xpPoolField) {
    mergedValues[meta.xpPoolField.id] = xpSummary.xp_leftover;
  }

  const evaluated = evaluateRulesetRuntime(meta.schema, mergedValues, "dm");

  return {
    sheet_json: {
      values: mergedValues,
      computed: evaluated.computedValues,
      derived_totals: evaluated.derivedTotals,
      enabled: evaluated.enabled,
      xp_pool_field_id: meta.xpPoolField ? meta.xpPoolField.id : evaluated.xpPoolFieldId,
      xp_transactions: transactions,
      xp_summary: xpSummary,
      ruleset: {
        mode: runtime.mode,
        ruleset_id: runtime.ruleset_id,
        ruleset_version: runtime.ruleset_version,
      },
    },
    meta,
    evaluated,
    xpSummary,
    transactions,
  };
}

async function getCharacterByGameAndUser(gameId, userId) {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getCharacterByGameAndId(gameId, characterId) {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("game_id", gameId)
    .eq("id", characterId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function updateCharacterSheet(character, sheetJson) {
  const { data, error } = await supabase
    .from("characters")
    .update({
      sheet_json: sheetJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", character.id)
    .eq("game_id", character.game_id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

function withComputedCustomSheet(runtime, character) {
  if (!character) return null;
  const values = getCharacterValues(character);
  const transactions = getCharacterTransactions(character);
  const built = buildCustomSheetJson(runtime, values, transactions);
  return {
    ...character,
    sheet_json: built.sheet_json,
  };
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return sendError(res, 401, "Missing bearer token.");
    }

    const tokenProjectRef = getTokenProjectRef(token);
    if (tokenProjectRef && tokenProjectRef !== SUPABASE_PROJECT_REF) {
      return sendError(
        res,
        401,
        "Token belongs to a different project. Please sign out and sign in again."
      );
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return sendError(res, 401, "Invalid or expired token.");
    }

    await ensureProfile(user);
    req.user = user;
    return next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return sendError(res, 500, "Authentication failed.");
  }
}

function roomName(gameId) {
  return `game:${gameId}`;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", requireAuth);

app.post("/api/games", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const notes = String(req.body?.notes || "").trim();

    if (!name) {
      return sendError(res, 400, "Game name is required.");
    }

    const gameId = crypto.randomUUID();
    const inviteCode = await generateUniqueInviteCode();
    const now = new Date().toISOString();

    const gamePayload = {
      id: gameId,
      owner_user_id: req.user.id,
      name,
      notes,
      ruleset_type: "builtin",
      ruleset_name: null,
      ruleset_id: null,
      ruleset_version: null,
      invite_code: inviteCode,
      status: "active",
      created_at: now,
      updated_at: now,
    };

    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert(gamePayload)
      .select("*")
      .single();

    if (gameError) throw gameError;

    const { error: memberError } = await supabase.from("game_members").insert({
      id: crypto.randomUUID(),
      game_id: gameId,
      user_id: req.user.id,
      role: "dm",
      created_at: now,
    });

    if (memberError) {
      await supabase.from("games").delete().eq("id", gameId);
      throw memberError;
    }

    return res.status(201).json({ game });
  } catch (error) {
    console.error("Create game error:", error.message);
    return sendError(res, 500, "Could not create game.");
  }
});

app.get("/api/games", async (req, res) => {
  try {
    const role = req.query.role;
    if (role && role !== "dm" && role !== "player") {
      return sendError(res, 400, "Role must be 'dm' or 'player'.");
    }

    let membersQuery = supabase
      .from("game_members")
      .select("game_id, role")
      .eq("user_id", req.user.id);

    if (role) {
      membersQuery = membersQuery.eq("role", role);
    }

    const { data: memberships, error: membershipError } = await membersQuery;
    if (membershipError) throw membershipError;

    if (!memberships || memberships.length === 0) {
      return res.json({ games: [] });
    }

    const gameIds = memberships.map((membership) => membership.game_id);
    const rolesByGameId = new Map(
      memberships.map((membership) => [membership.game_id, membership.role])
    );

    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("*")
      .in("id", gameIds)
      .order("created_at", { ascending: false });

    if (gamesError) throw gamesError;

    const merged = (games || []).map((game) => ({
      ...game,
      member_role: rolesByGameId.get(game.id),
    }));

    return res.json({ games: merged });
  } catch (error) {
    console.error("List games error:", error.message);
    return sendError(res, 500, "Could not list games.");
  }
});

app.get("/api/games/:id", async (req, res) => {
  try {
    const gameId = req.params.id;
    const membership = await getMembership(gameId, req.user.id);

    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }

    const { data: game, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .maybeSingle();

    if (error) throw error;
    if (!game) return sendError(res, 404, "Game not found.");

    return res.json({ game, member_role: membership.role });
  } catch (error) {
    console.error("Get game error:", error.message);
    return sendError(res, 500, "Could not load game.");
  }
});

app.patch("/api/games/:id", async (req, res) => {
  try {
    const gameId = req.params.id;
    const membership = await getMembership(gameId, req.user.id);

    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }
    if (membership.role !== "dm") {
      return sendError(res, 403, "Only the DM can update this game.");
    }

    const updates = {};
    if (typeof req.body?.name === "string") {
      updates.name = req.body.name.trim();
    }
    if (typeof req.body?.notes === "string") {
      updates.notes = req.body.notes.trim();
    }

    const hasRulesetType = typeof req.body?.ruleset_type === "string";
    const hasLegacyRulesetName = typeof req.body?.ruleset_name === "string";

    if (hasRulesetType) {
      const rulesetType = req.body.ruleset_type.trim().toLowerCase();
      if (rulesetType !== "builtin" && rulesetType !== "custom") {
        return sendError(res, 400, "ruleset_type must be 'builtin' or 'custom'.");
      }

      if (rulesetType === "builtin") {
        updates.ruleset_type = "builtin";
        updates.ruleset_name =
          typeof req.body?.ruleset_name === "string"
            ? req.body.ruleset_name.trim()
            : "";
        updates.ruleset_id = null;
        updates.ruleset_version = null;
      } else {
        const ownership = await ensureOwnedRulesetVersion(
          req.user.id,
          req.body?.ruleset_id,
          req.body?.ruleset_version
        );

        if (ownership.error) {
          return sendError(res, 400, ownership.error);
        }

        updates.ruleset_type = "custom";
        updates.ruleset_name = ownership.rulesetName;
        updates.ruleset_id = ownership.rulesetId;
        updates.ruleset_version = ownership.rulesetVersion;
      }
    } else if (hasLegacyRulesetName) {
      updates.ruleset_type = "builtin";
      updates.ruleset_name = req.body.ruleset_name.trim();
      updates.ruleset_id = null;
      updates.ruleset_version = null;
    }

    if (
      Object.keys(updates).length === 0 ||
      (updates.name !== undefined && !updates.name)
    ) {
      return sendError(res, 400, "Provide valid fields to update.");
    }

    updates.updated_at = new Date().toISOString();

    const { data: game, error } = await supabase
      .from("games")
      .update(updates)
      .eq("id", gameId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!game) return sendError(res, 404, "Game not found.");

    return res.json({ game });
  } catch (error) {
    console.error("Patch game error:", error.message);
    return sendError(res, 500, "Could not update game.");
  }
});

app.delete("/api/games/:id", async (req, res) => {
  try {
    const gameId = req.params.id;
    const membership = await getMembership(gameId, req.user.id);

    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }
    if (membership.role !== "dm") {
      return sendError(res, 403, "Only the DM can delete this game.");
    }

    const { error: deleteCharactersError } = await supabase
      .from("characters")
      .delete()
      .eq("game_id", gameId);
    if (deleteCharactersError) throw deleteCharactersError;

    const { error: deleteMembersError } = await supabase
      .from("game_members")
      .delete()
      .eq("game_id", gameId);
    if (deleteMembersError) throw deleteMembersError;

    const { error: deleteGameError } = await supabase
      .from("games")
      .delete()
      .eq("id", gameId);
    if (deleteGameError) throw deleteGameError;

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete game error:", error.message);
    return sendError(res, 500, "Could not delete game.");
  }
});

app.post("/api/games/join", async (req, res) => {
  try {
    const inviteCode = String(req.body?.inviteCode || "")
      .trim()
      .toUpperCase();

    if (!inviteCode) {
      return sendError(res, 400, "Invite code is required.");
    }

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (gameError) throw gameError;
    if (!game) return sendError(res, 404, "Invite code not found.");

    const existingMembership = await getMembership(game.id, req.user.id);
    if (existingMembership) {
      return res.json({
        game,
        membership: existingMembership,
        alreadyMember: true,
      });
    }

    const memberPayload = {
      id: crypto.randomUUID(),
      game_id: game.id,
      user_id: req.user.id,
      role: "player",
      created_at: new Date().toISOString(),
    };

    const { data: membership, error: memberError } = await supabase
      .from("game_members")
      .insert(memberPayload)
      .select("*")
      .single();

    if (memberError) throw memberError;

    return res.status(201).json({ game, membership, alreadyMember: false });
  } catch (error) {
    console.error("Join game error:", error.message);
    return sendError(res, 500, "Could not join game.");
  }
});

app.get("/api/games/:id/members", async (req, res) => {
  try {
    const gameId = req.params.id;
    const membership = await getMembership(gameId, req.user.id);
    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }

    const { data: members, error: membersError } = await supabase
      .from("game_members")
      .select("id, game_id, user_id, role, created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true });

    if (membersError) throw membersError;
    if (!members || members.length === 0) return res.json({ members: [] });

    const userIds = members.map((entry) => entry.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    if (profilesError) throw profilesError;

    const profileById = new Map((profiles || []).map((p) => [p.id, p]));
    const enrichedMembers = members.map((entry) => ({
      ...entry,
      display_name: profileById.get(entry.user_id)?.display_name || "Player",
    }));

    return res.json({ members: enrichedMembers });
  } catch (error) {
    console.error("Members error:", error.message);
    return sendError(res, 500, "Could not load members.");
  }
});

app.get("/api/games/:id/ruleset-runtime", async (req, res) => {
  try {
    const gameId = req.params.id;
    const membership = await getMembership(gameId, req.user.id);
    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }

    const game = await getGameById(gameId);
    if (!game) {
      return sendError(res, 404, "Game not found.");
    }

    const runtime = await resolveGameRulesetRuntime(game);
    return res.json({
      runtime,
      member_role: membership.role,
    });
  } catch (error) {
    console.error("Ruleset runtime error:", error.message);
    return sendError(res, 500, "Could not load ruleset runtime.");
  }
});

app.get("/api/games/:id/characters", async (req, res) => {
  try {
    const gameId = req.params.id;
    const membership = await getMembership(gameId, req.user.id);
    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }
    if (membership.role !== "dm") {
      return sendError(res, 403, "Only the DM can view all characters.");
    }

    const game = await getGameById(gameId);
    if (!game) {
      return sendError(res, 404, "Game not found.");
    }

    const { data: characters, error } = await supabase
      .from("characters")
      .select("*")
      .eq("game_id", gameId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const userIds = (characters || []).map((character) => character.user_id);
    let profileById = new Map();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      if (profilesError) throw profilesError;
      profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    }

    let runtime = null;
    if (game.ruleset_type === "custom") {
      runtime = await resolveGameRulesetRuntime(game);
      if (runtime.mode !== "custom") {
        runtime = null;
      }
    }

    const enriched = (characters || []).map((character) => {
      const withSheet = runtime ? withComputedCustomSheet(runtime, character) : character;
      return {
        ...withSheet,
        display_name: profileById.get(character.user_id)?.display_name || "Player",
      };
    });

    return res.json({ characters: enriched });
  } catch (error) {
    console.error("List characters error:", error.message);
    return sendError(res, 500, "Could not load game characters.");
  }
});

app.post("/api/games/:id/characters/:characterId/xp/session-award", async (req, res) => {
  try {
    const gameId = req.params.id;
    const characterId = req.params.characterId;
    const membership = await getMembership(gameId, req.user.id);
    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }
    if (membership.role !== "dm") {
      return sendError(res, 403, "Only the DM can assign session XP.");
    }

    const game = await getGameById(gameId);
    if (!game) {
      return sendError(res, 404, "Game not found.");
    }

    const runtime = await resolveGameRulesetRuntime(game);
    if (runtime.mode !== "custom") {
      return sendError(res, 400, "XP workflow is only available for custom rulesets.");
    }

    const meta = getCustomSchemaMeta(runtime.schema);
    if (!meta.xpPoolField) {
      return sendError(res, 400, "This ruleset has no XP pool field.");
    }

    const character = await getCharacterByGameAndId(gameId, characterId);
    if (!character) {
      return sendError(res, 404, "Character not found.");
    }

    const amount = toFiniteNumber(req.body?.amount, NaN);
    if (!Number.isFinite(amount) || amount <= 0) {
      return sendError(res, 400, "amount must be a positive number.");
    }

    const values = getCharacterValues(character);
    const transactions = getCharacterTransactions(character);
    const transaction = normalizeXpTransaction({
      id: crypto.randomUUID(),
      type: "session_award",
      status: "pending",
      at: new Date().toISOString(),
      amount,
      session_tag: req.body?.session_tag ? String(req.body.session_tag) : null,
      created_by_user_id: req.user.id,
    });

    const nextTransactions = [...transactions, transaction];
    const built = buildCustomSheetJson(runtime, values, nextTransactions);
    const updated = await updateCharacterSheet(character, built.sheet_json);

    return res.status(201).json({
      character: withComputedCustomSheet(runtime, updated),
      transaction,
      xp_summary: built.xpSummary,
    });
  } catch (error) {
    console.error("Create session award error:", error.message);
    return sendError(res, 500, "Could not create session award.");
  }
});

app.post("/api/games/:id/characters/:characterId/xp/transactions/:txId/confirm", async (req, res) => {
  try {
    const gameId = req.params.id;
    const characterId = req.params.characterId;
    const txId = req.params.txId;
    const membership = await getMembership(gameId, req.user.id);
    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }
    if (membership.role !== "dm") {
      return sendError(res, 403, "Only the DM can confirm XP transactions.");
    }

    const game = await getGameById(gameId);
    if (!game) {
      return sendError(res, 404, "Game not found.");
    }

    const runtime = await resolveGameRulesetRuntime(game);
    if (runtime.mode !== "custom") {
      return sendError(res, 400, "XP workflow is only available for custom rulesets.");
    }

    const character = await getCharacterByGameAndId(gameId, characterId);
    if (!character) {
      return sendError(res, 404, "Character not found.");
    }

    const values = getCharacterValues(character);
    const transactions = getCharacterTransactions(character);
    const transactionIndex = transactions.findIndex((entry) => entry.id === txId);
    if (transactionIndex < 0) {
      return sendError(res, 404, "Transaction not found.");
    }

    const existing = transactions[transactionIndex];
    if (existing.status !== "pending") {
      return sendError(res, 400, "Only pending transactions can be confirmed.");
    }

    const confirmedAt = new Date().toISOString();
    let nextTransaction = {
      ...existing,
      status: "confirmed",
      confirmed_by_user_id: req.user.id,
      confirmed_at: confirmedAt,
    };

    const nextTransactions = [...transactions];
    if (existing.type === "session_award") {
      const beforeSummary = computeXpSummary(transactions);
      nextTransactions[transactionIndex] = nextTransaction;
      const afterSummary = computeXpSummary(nextTransactions);
      nextTransaction = {
        ...nextTransaction,
        before: beforeSummary.xp_leftover,
        after: afterSummary.xp_leftover,
        xp_before: beforeSummary.xp_leftover,
        xp_after: afterSummary.xp_leftover,
      };
    } else if (existing.type === "spend" && existing.field_id) {
      const currentValue = toFiniteNumber(values[existing.field_id], 0);
      const targetValue = toFiniteNumber(existing.after, currentValue);
      if (targetValue > currentValue) {
        values[existing.field_id] = targetValue;
      }
    }
    nextTransactions[transactionIndex] = nextTransaction;

    const built = buildCustomSheetJson(runtime, values, nextTransactions);
    const updated = await updateCharacterSheet(character, built.sheet_json);

    return res.json({
      character: withComputedCustomSheet(runtime, updated),
      transaction: nextTransaction,
      xp_summary: built.xpSummary,
    });
  } catch (error) {
    console.error("Confirm transaction error:", error.message);
    return sendError(res, 500, "Could not confirm transaction.");
  }
});

app.post("/api/games/:id/characters/:characterId/xp/transactions/:txId/unlock", async (req, res) => {
  try {
    const gameId = req.params.id;
    const characterId = req.params.characterId;
    const txId = req.params.txId;
    const membership = await getMembership(gameId, req.user.id);
    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }
    if (membership.role !== "dm") {
      return sendError(res, 403, "Only the DM can unlock transactions.");
    }

    const game = await getGameById(gameId);
    if (!game) {
      return sendError(res, 404, "Game not found.");
    }

    const runtime = await resolveGameRulesetRuntime(game);
    if (runtime.mode !== "custom") {
      return sendError(res, 400, "XP workflow is only available for custom rulesets.");
    }

    const character = await getCharacterByGameAndId(gameId, characterId);
    if (!character) {
      return sendError(res, 404, "Character not found.");
    }

    const values = getCharacterValues(character);
    const transactions = getCharacterTransactions(character);
    const transactionIndex = transactions.findIndex((entry) => entry.id === txId);
    if (transactionIndex < 0) {
      return sendError(res, 404, "Transaction not found.");
    }

    const existing = transactions[transactionIndex];
    if (existing.type !== "spend" || existing.status !== "confirmed") {
      return sendError(res, 400, "Only confirmed spend transactions can be unlocked.");
    }

    if (existing.field_id) {
      values[existing.field_id] =
        toFiniteNumber(values[existing.field_id], 0) - toFiniteNumber(existing.step, 0);
    }

    const unlockedTransaction = {
      ...existing,
      status: "unlocked",
      unlocked_by_user_id: req.user.id,
      unlocked_at: new Date().toISOString(),
    };

    const nextTransactions = [...transactions];
    nextTransactions[transactionIndex] = unlockedTransaction;
    const built = buildCustomSheetJson(runtime, values, nextTransactions);
    const updated = await updateCharacterSheet(character, built.sheet_json);

    return res.json({
      character: withComputedCustomSheet(runtime, updated),
      transaction: unlockedTransaction,
      xp_summary: built.xpSummary,
    });
  } catch (error) {
    console.error("Unlock transaction error:", error.message);
    return sendError(res, 500, "Could not unlock transaction.");
  }
});

app.post("/api/games/:id/characters/:characterId/xp/session-award/:txId/reassign", async (req, res) => {
  try {
    const gameId = req.params.id;
    const characterId = req.params.characterId;
    const txId = req.params.txId;
    const membership = await getMembership(gameId, req.user.id);
    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }
    if (membership.role !== "dm") {
      return sendError(res, 403, "Only the DM can reassign session awards.");
    }

    const game = await getGameById(gameId);
    if (!game) {
      return sendError(res, 404, "Game not found.");
    }

    const runtime = await resolveGameRulesetRuntime(game);
    if (runtime.mode !== "custom") {
      return sendError(res, 400, "XP workflow is only available for custom rulesets.");
    }

    const character = await getCharacterByGameAndId(gameId, characterId);
    if (!character) {
      return sendError(res, 404, "Character not found.");
    }

    const amount = toFiniteNumber(req.body?.amount, NaN);
    if (!Number.isFinite(amount) || amount <= 0) {
      return sendError(res, 400, "amount must be a positive number.");
    }

    const values = getCharacterValues(character);
    const transactions = getCharacterTransactions(character);
    const transactionIndex = transactions.findIndex((entry) => entry.id === txId);
    if (transactionIndex < 0) {
      return sendError(res, 404, "Session award transaction not found.");
    }

    const existing = transactions[transactionIndex];
    if (existing.type !== "session_award" || existing.status !== "confirmed") {
      return sendError(
        res,
        400,
        "Only confirmed session-award transactions can be reassigned."
      );
    }

    const reverted = {
      ...existing,
      status: "reverted",
      reverted_by_user_id: req.user.id,
      reverted_at: new Date().toISOString(),
    };

    const replacement = normalizeXpTransaction({
      id: crypto.randomUUID(),
      type: "session_award",
      status: "pending",
      at: new Date().toISOString(),
      amount,
      session_tag: req.body?.session_tag
        ? String(req.body.session_tag)
        : existing.session_tag || null,
      created_by_user_id: req.user.id,
    });

    const nextTransactions = [...transactions];
    nextTransactions[transactionIndex] = reverted;
    nextTransactions.push(replacement);

    const built = buildCustomSheetJson(runtime, values, nextTransactions);
    const updated = await updateCharacterSheet(character, built.sheet_json);

    return res.status(201).json({
      character: withComputedCustomSheet(runtime, updated),
      reverted_transaction: reverted,
      replacement_transaction: replacement,
      xp_summary: built.xpSummary,
    });
  } catch (error) {
    console.error("Reassign session award error:", error.message);
    return sendError(res, 500, "Could not reassign session award.");
  }
});

app.post("/api/games/:id/characters/me/xp/spend", async (req, res) => {
  try {
    const gameId = req.params.id;
    const membership = await getMembership(gameId, req.user.id);
    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }
    if (membership.role !== "player") {
      return sendError(res, 403, "Only players can submit XP spend requests.");
    }

    const game = await getGameById(gameId);
    if (!game) {
      return sendError(res, 404, "Game not found.");
    }

    const runtime = await resolveGameRulesetRuntime(game);
    if (runtime.mode !== "custom") {
      return sendError(res, 400, "XP workflow is only available for custom rulesets.");
    }

    const meta = getCustomSchemaMeta(runtime.schema);
    if (!meta.xpPoolField) {
      return sendError(res, 400, "This ruleset has no XP pool field.");
    }

    const character = await getCharacterByGameAndUser(gameId, req.user.id);
    if (!character) {
      return sendError(res, 404, "Character not found.");
    }

    const fieldId = String(req.body?.field_id || req.body?.fieldId || "").trim();
    if (!fieldId) {
      return sendError(res, 400, "field_id is required.");
    }

    const field = meta.fieldById.get(fieldId);
    if (!field || field.fieldType !== "number" || !field.xpUpgradable) {
      return sendError(res, 400, "field_id must target an xp-upgradable number field.");
    }

    const cost = toFiniteNumber(field.xpCost, 0);
    const step = toFiniteNumber(field.xpStep, 1);
    if (step <= 0 || cost < 0) {
      return sendError(res, 400, "XP setup is invalid for this field.");
    }

    const values = getCharacterValues(character);
    const transactions = getCharacterTransactions(character);
    const summaryBefore = computeXpSummary(transactions);

    if (summaryBefore.xp_leftover < cost) {
      return sendError(res, 400, "Not enough XP.");
    }

    const beforeValue = toFiniteNumber(values[field.id], 0);
    const afterValue = beforeValue + step;
    if (field.xpMax !== null && Number.isFinite(Number(field.xpMax)) && afterValue > Number(field.xpMax)) {
      return sendError(res, 400, `${field.label} is already at max.`);
    }

    const transaction = normalizeXpTransaction({
      id: crypto.randomUUID(),
      type: "spend",
      status: "pending",
      at: new Date().toISOString(),
      field_id: field.id,
      field_label: field.label,
      cost,
      step,
      before: beforeValue,
      after: afterValue,
      xp_before: summaryBefore.xp_leftover,
      xp_after: summaryBefore.xp_leftover - cost,
      created_by_user_id: req.user.id,
    });

    values[field.id] = afterValue;
    const nextTransactions = [...transactions, transaction];
    const built = buildCustomSheetJson(runtime, values, nextTransactions);
    const updated = await updateCharacterSheet(character, built.sheet_json);

    return res.status(201).json({
      character: withComputedCustomSheet(runtime, updated),
      transaction,
      xp_summary: built.xpSummary,
    });
  } catch (error) {
    console.error("Create spend transaction error:", error.message);
    return sendError(res, 500, "Could not create spend transaction.");
  }
});

app.post("/api/games/:id/characters", async (req, res) => {
  try {
    const gameId = req.params.id;
    const membership = await getMembership(gameId, req.user.id);
    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }

    const name = String(req.body?.name || "").trim();
    if (!name) {
      return sendError(res, 400, "Character name is required.");
    }

    const game = await getGameById(gameId);
    if (!game) {
      return sendError(res, 404, "Game not found.");
    }

    const existingCharacter = await getCharacterByGameAndUser(gameId, req.user.id);

    const incomingSheet =
      typeof req.body?.sheet_json === "object" && req.body.sheet_json
        ? req.body.sheet_json
        : {};

    let finalSheetJson = incomingSheet;
    if (game.ruleset_type === "custom") {
      const runtime = await resolveGameRulesetRuntime(game);
      if (runtime.mode !== "custom") {
        return sendError(
          res,
          400,
          "This game points to an unavailable custom ruleset version."
        );
      }

      const inputValues =
        isPlainRecord(incomingSheet?.values)
          ? incomingSheet.values
          : {};

      const existingValues = existingCharacter ? getCharacterValues(existingCharacter) : {};
      const baselineValues = existingCharacter
        ? existingValues
        : evaluateRulesetRuntime(runtime.schema, {}, "dm").values;

      const meta = getCustomSchemaMeta(runtime.schema);
      if (membership.role !== "dm") {
        const blockedFieldIds = new Set();
        runtime.schema.boxes.forEach((box) => {
          if (box.type !== "field") return;
          if (!Object.prototype.hasOwnProperty.call(inputValues, box.id)) return;

          const protectedField =
            box.fieldType === "computed" ||
            box.editableBy === "dm" ||
            meta.xpGovernedFieldIds.has(box.id);

          if (
            protectedField &&
            !valuesEqual(inputValues[box.id], baselineValues[box.id])
          ) {
            blockedFieldIds.add(box.label || box.id);
          }
        });

        if (blockedFieldIds.size > 0) {
          return sendError(
            res,
            403,
            `These fields are system- or DM-governed and cannot be edited directly: ${[
              ...blockedFieldIds,
            ].join(", ")}.`
          );
        }
      }

      const mergedValues = {
        ...baselineValues,
        ...inputValues,
      };

      const actorValidation = evaluateRulesetRuntime(
        runtime.schema,
        mergedValues,
        membership.role
      );

      if (actorValidation.errors.length > 0) {
        return sendError(
          res,
          400,
          `Ruleset validation failed: ${actorValidation.errors.join(" | ")}`
        );
      }

      const preservedTransactions = existingCharacter
        ? getCharacterTransactions(existingCharacter)
        : [];
      const built = buildCustomSheetJson(runtime, mergedValues, preservedTransactions);
      finalSheetJson = built.sheet_json;
    }

    const characterPayload = {
      id: crypto.randomUUID(),
      game_id: gameId,
      user_id: req.user.id,
      name,
      archetype: String(req.body?.archetype || "").trim(),
      background: String(req.body?.background || "").trim(),
      age: String(req.body?.age || "").trim(),
      race: String(req.body?.race || "").trim(),
      gender: String(req.body?.gender || "").trim(),
      affiliation: String(req.body?.affiliation || "").trim(),
      notes: String(req.body?.notes || "").trim(),
      sheet_json: finalSheetJson,
      updated_at: new Date().toISOString(),
    };

    if (existingCharacter) {
      characterPayload.id = existingCharacter.id;
      characterPayload.created_at = existingCharacter.created_at;
    } else {
      characterPayload.created_at = new Date().toISOString();
    }

    const { data: character, error: upsertError } = await supabase
      .from("characters")
      .upsert(characterPayload, { onConflict: "game_id,user_id" })
      .select("*")
      .single();

    if (upsertError) throw upsertError;

    return res.json({ character });
  } catch (error) {
    console.error("Upsert character error:", error.message);
    return sendError(res, 500, "Could not save character.");
  }
});

app.get("/api/games/:id/characters/me", async (req, res) => {
  try {
    const gameId = req.params.id;
    const membership = await getMembership(gameId, req.user.id);
    if (!membership) {
      return sendError(res, 403, "You are not a member of this game.");
    }

    const game = await getGameById(gameId);
    if (!game) {
      return sendError(res, 404, "Game not found.");
    }

    const character = await getCharacterByGameAndUser(gameId, req.user.id);
    if (!character || game.ruleset_type !== "custom") {
      return res.json({ character: character || null });
    }

    const runtime = await resolveGameRulesetRuntime(game);
    if (runtime.mode !== "custom") {
      return res.json({ character });
    }

    return res.json({ character: withComputedCustomSheet(runtime, character) });
  } catch (error) {
    console.error("Get character error:", error.message);
    return sendError(res, 500, "Could not load character.");
  }
});

app.get("/api/rulesets", async (req, res) => {
  try {
    const { data: rulesets, error } = await supabase
      .from("rulesets")
      .select("id, owner_user_id, name, latest_published_version, created_at, updated_at")
      .eq("owner_user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({ rulesets: rulesets || [] });
  } catch (error) {
    console.error("List rulesets error:", error.message);
    return sendError(res, 500, "Could not list rulesets.");
  }
});

app.post("/api/rulesets", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return sendError(res, 400, "Ruleset name is required.");
    }

    const requestedSchema =
      req.body?.draft_schema && typeof req.body.draft_schema === "object"
        ? req.body.draft_schema
        : buildStarterTemplate(req.body?.template_categories);

    const schemaValidation = validateRulesetSchema(requestedSchema);
    if (!schemaValidation.valid) {
      return sendError(
        res,
        400,
        `Invalid draft_schema: ${schemaValidation.errors.join(" | ")}`
      );
    }

    const rulesetPayload = {
      id: crypto.randomUUID(),
      owner_user_id: req.user.id,
      name,
      draft_schema: schemaValidation.normalizedSchema,
      latest_published_version: 0,
      attributes: normalizeStringList(req.body?.attributes, [
        "Strength",
        "Dexterity",
      ]),
      skills: normalizeStringList(req.body?.skills, ["Stealth", "Insight"]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: ruleset, error } = await supabase
      .from("rulesets")
      .insert(rulesetPayload)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return sendError(res, 409, "You already have a ruleset with this name.");
      }
      throw error;
    }

    return res.status(201).json({ ruleset });
  } catch (error) {
    console.error("Create ruleset error:", error.message);
    return sendError(res, 500, "Could not create ruleset.");
  }
});

app.get("/api/rulesets/:id", async (req, res) => {
  try {
    const rulesetId = req.params.id;
    const { data: ruleset, error } = await supabase
      .from("rulesets")
      .select("*")
      .eq("id", rulesetId)
      .eq("owner_user_id", req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!ruleset) return sendError(res, 404, "Ruleset not found.");

    const { data: versions, error: versionsError } = await supabase
      .from("ruleset_versions")
      .select("id, version, created_at")
      .eq("ruleset_id", ruleset.id)
      .order("version", { ascending: false });

    if (versionsError) throw versionsError;

    return res.json({
      ruleset: {
        ...ruleset,
        draft_schema: normalizeRulesetSchema(ruleset.draft_schema),
      },
      versions: versions || [],
    });
  } catch (error) {
    console.error("Get ruleset error:", error.message);
    return sendError(res, 500, "Could not load ruleset.");
  }
});

app.patch("/api/rulesets/:id", async (req, res) => {
  try {
    const rulesetId = req.params.id;
    const updates = {};

    if (typeof req.body?.name === "string") {
      const value = req.body.name.trim();
      if (!value) {
        return sendError(res, 400, "Ruleset name cannot be empty.");
      }
      updates.name = value;
    }

    if (req.body?.draft_schema && typeof req.body.draft_schema === "object") {
      const schemaValidation = validateRulesetSchema(req.body.draft_schema);
      if (!schemaValidation.valid) {
        return sendError(
          res,
          400,
          `Invalid draft_schema: ${schemaValidation.errors.join(" | ")}`
        );
      }
      updates.draft_schema = schemaValidation.normalizedSchema;
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 400, "No valid ruleset fields provided.");
    }

    updates.updated_at = new Date().toISOString();

    const { data: ruleset, error } = await supabase
      .from("rulesets")
      .update(updates)
      .eq("id", rulesetId)
      .eq("owner_user_id", req.user.id)
      .select("*")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return sendError(res, 409, "You already have a ruleset with this name.");
      }
      throw error;
    }
    if (!ruleset) return sendError(res, 404, "Ruleset not found.");

    return res.json({ ruleset });
  } catch (error) {
    console.error("Update ruleset error:", error.message);
    return sendError(res, 500, "Could not update ruleset.");
  }
});

app.get("/api/rulesets/:id/versions", async (req, res) => {
  try {
    const rulesetId = req.params.id;

    const { data: ruleset, error: rulesetError } = await supabase
      .from("rulesets")
      .select("id")
      .eq("id", rulesetId)
      .eq("owner_user_id", req.user.id)
      .maybeSingle();

    if (rulesetError) throw rulesetError;
    if (!ruleset) return sendError(res, 404, "Ruleset not found.");

    const { data: versions, error } = await supabase
      .from("ruleset_versions")
      .select("id, ruleset_id, version, created_at, created_by_user_id")
      .eq("ruleset_id", ruleset.id)
      .order("version", { ascending: false });

    if (error) throw error;
    return res.json({ versions: versions || [] });
  } catch (error) {
    console.error("List ruleset versions error:", error.message);
    return sendError(res, 500, "Could not list ruleset versions.");
  }
});

app.post("/api/rulesets/:id/publish", async (req, res) => {
  try {
    const rulesetId = req.params.id;

    const { data: ruleset, error: rulesetError } = await supabase
      .from("rulesets")
      .select("*")
      .eq("id", rulesetId)
      .eq("owner_user_id", req.user.id)
      .maybeSingle();

    if (rulesetError) throw rulesetError;
    if (!ruleset) return sendError(res, 404, "Ruleset not found.");

    const schemaValidation = validateRulesetSchema(ruleset.draft_schema);
    if (!schemaValidation.valid) {
      return sendError(
        res,
        400,
        `Cannot publish invalid draft_schema: ${schemaValidation.errors.join(" | ")}`
      );
    }

    const nextVersion = Number(ruleset.latest_published_version || 0) + 1;
    const publishedAt = new Date().toISOString();

    const { data: versionRow, error: insertVersionError } = await supabase
      .from("ruleset_versions")
      .insert({
        id: crypto.randomUUID(),
        ruleset_id: ruleset.id,
        version: nextVersion,
        schema_json: schemaValidation.normalizedSchema,
        created_by_user_id: req.user.id,
        created_at: publishedAt,
      })
      .select("*")
      .single();

    if (insertVersionError) {
      if (insertVersionError.code === "23505") {
        return sendError(
          res,
          409,
          "Could not publish due to version conflict. Please try again."
        );
      }
      throw insertVersionError;
    }

    const { data: updatedRuleset, error: updateError } = await supabase
      .from("rulesets")
      .update({
        latest_published_version: nextVersion,
        updated_at: publishedAt,
      })
      .eq("id", ruleset.id)
      .eq("owner_user_id", req.user.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return res.status(201).json({
      ruleset: updatedRuleset,
      published_version: nextVersion,
      version: versionRow,
    });
  } catch (error) {
    console.error("Publish ruleset error:", error.message);
    return sendError(res, 500, "Could not publish ruleset.");
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const tokenProjectRef = getTokenProjectRef(token);
    if (tokenProjectRef && tokenProjectRef !== SUPABASE_PROJECT_REF) {
      return next(new Error("Token belongs to a different project."));
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return next(new Error("Unauthorized socket."));
    }

    await ensureProfile(user);
    socket.user = user;
    return next();
  } catch (error) {
    console.error("Socket auth error:", error.message);
    return next(new Error("Socket auth failed."));
  }
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id} user=${socket.user.id}`);

  socket.on("join_game_room", async (payload) => {
    try {
      const gameId = payload?.gameId;
      if (!gameId) {
        socket.emit("socket_error", { message: "gameId is required." });
        return;
      }

      const membership = await getMembership(gameId, socket.user.id);
      if (!membership) {
        socket.emit("socket_error", { message: "Not a member of this game." });
        return;
      }

      socket.join(roomName(gameId));
      socket.emit("joined_game_room", { gameId });
    } catch (error) {
      console.error("Join room error:", error.message);
      socket.emit("socket_error", { message: "Could not join room." });
    }
  });

  socket.on("roll_dice", async (data) => {
    try {
      const gameId = data?.gameId;
      if (!gameId) {
        socket.emit("socket_error", { message: "gameId is required." });
        return;
      }

      const membership = await getMembership(gameId, socket.user.id);
      if (!membership) {
        socket.emit("socket_error", { message: "Not a member of this game." });
        return;
      }

      const sides = Number(data?.sides);
      const roll = Number(data?.roll);

      if (!Number.isInteger(sides) || sides <= 1) {
        socket.emit("socket_error", { message: "Invalid dice sides." });
        return;
      }
      if (!Number.isInteger(roll) || roll < 1 || roll > sides) {
        socket.emit("socket_error", { message: "Invalid roll value." });
        return;
      }

      const payload = {
        id: crypto.randomUUID(),
        gameId,
        from: String(data?.from || "Player"),
        sides,
        roll,
        secret: Boolean(data?.secret),
        createdAt: new Date().toISOString(),
        byUserId: socket.user.id,
      };

      io.to(roomName(gameId)).emit("dice_result", payload);
    } catch (error) {
      console.error("Dice roll error:", error.message);
      socket.emit("socket_error", { message: "Dice roll failed." });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

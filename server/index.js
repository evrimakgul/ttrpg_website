require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const crypto = require("crypto");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

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
      ruleset_name: null,
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
    if (typeof req.body?.ruleset_name === "string") {
      updates.ruleset_name = req.body.ruleset_name.trim();
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
      sheet_json:
        typeof req.body?.sheet_json === "object" && req.body.sheet_json
          ? req.body.sheet_json
          : {},
      updated_at: new Date().toISOString(),
    };

    const { data: existingCharacter, error: existingError } = await supabase
      .from("characters")
      .select("id, created_at")
      .eq("game_id", gameId)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (existingError) throw existingError;

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

    const { data: character, error } = await supabase
      .from("characters")
      .select("*")
      .eq("game_id", gameId)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) throw error;

    return res.json({ character: character || null });
  } catch (error) {
    console.error("Get character error:", error.message);
    return sendError(res, 500, "Could not load character.");
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

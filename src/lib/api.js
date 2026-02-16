import { supabase } from "./supabase";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
).replace(/\/+$/, "");

function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You are not signed in.");
  }

  return session.access_token;
}

async function parseResponse(response) {
  const raw = await response.text();
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { message: raw };
    }
  }

  return payload;
}

async function doRequest(path, { method, body, headers, token }) {
  const finalHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildApiUrl(path), {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await parseResponse(response);
  return { response, payload };
}

export async function apiFetch(path, options = {}) {
  const { method = "GET", body, headers = {}, auth = true } = options;

  let token = null;
  if (auth) {
    token = await getAccessToken();
  }

  let { response, payload } = await doRequest(path, {
    method,
    body,
    headers,
    token,
  });

  if (auth && response.status === 401) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      ({ response, payload } = await doRequest(path, {
        method,
        body,
        headers,
        token: data.session.access_token,
      }));
    }
  }

  if (!response.ok) {
    const message =
      payload?.error || payload?.message || `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

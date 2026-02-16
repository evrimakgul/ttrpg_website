import { io } from "socket.io-client";
import { supabase } from "./lib/supabase";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
  auth: {
    token: null,
  },
});

export async function connectSocket() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  socket.auth = {
    token: session?.access_token || null,
  };

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export default socket;

/** Socket.IO client (§14/§35) — one singleton connection, opened app-wide once
 * a session exists (AppDataContext) and reused as-is by chat threads for
 * message delivery on top of it. */
import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (!url) return null; // backend not configured in this environment yet
  socket = io(url, { withCredentials: true, autoConnect: false });
  return socket;
}

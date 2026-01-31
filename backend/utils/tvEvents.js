// utils/tvEvents.js
const clients = new Set();

/** send SSE event */
function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Register an SSE client
 * @param {import("express").Response} res
 */
export function addClient(res) {
  clients.add(res);

  // keep-alive ping (proxies kill idle connections)
  const ping = setInterval(() => {
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch {}
  }, 25000);

  res.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

/**
 * Broadcast to all connected TV screens
 */
export function broadcast(event, data) {
  for (const res of clients) {
    try {
      sendSse(res, event, data);
    } catch {
      clients.delete(res);
    }
  }
}

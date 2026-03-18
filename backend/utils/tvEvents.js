// utils/tvEvents.js

// Map of res -> company_id so broadcasts are scoped per company
const clients = new Map();

/** send SSE event */
function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Register an SSE client scoped to a company
 * @param {import("express").Response} res
 * @param {number} company_id
 */
function addClient(res, company_id) {
  clients.set(res, company_id);

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
 * Broadcast to all TV screens belonging to a specific company only
 * @param {string} event
 * @param {object} data  — must include company_id
 */
function broadcast(event, data) {
  const { company_id } = data;
  for (const [res, clientCompanyId] of clients) {
    if (clientCompanyId !== company_id) continue;
    try {
      sendSse(res, event, data);
    } catch {
      clients.delete(res);
    }
  }
}

module.exports = { addClient, broadcast };
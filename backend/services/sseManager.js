// Server-Sent Events connection manager
// Maps matchId (string) -> Set of Express response objects

const clients = new Map();

function subscribe(matchId, res) {
  const key = String(matchId);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(res);
}

function unsubscribe(matchId, res) {
  const key = String(matchId);
  const set = clients.get(key);
  if (!set) return;
  set.delete(res);
  if (!set.size) clients.delete(key);
}

function broadcast(matchId, data) {
  const key = String(matchId);
  const set = clients.get(key);
  if (!set || !set.size) return;
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(msg); } catch (_) { set.delete(res); }
  }
}

function clientCount(matchId) {
  const set = clients.get(String(matchId));
  return set ? set.size : 0;
}

module.exports = { subscribe, unsubscribe, broadcast, clientCount };

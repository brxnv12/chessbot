import { WebSocketServer } from "ws";
import { Chess } from "chess.js";
import { getUser, addXp } from "./db.js";

const REWARD = { win: 20, draw: 8, lose: 3 };   // o'yin oxirida XP
const BASE_RANGE = 100, WIDEN_PER_SEC = 20;      // XP farqi: kutgan sari oraliq kengayadi

export function attachOnline(server, userFrom) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  let queue = [];
  const games = new Map();                       // ws -> game
  const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
  const other = (c) => (c === "w" ? "b" : "w");

  function finish(g, winner, reason) {
    if (g.over) return; g.over = true;
    for (const c of ["w", "b"]) {
      const p = g[c], res = !winner ? "draw" : winner === c ? "win" : "lose";
      addXp(p.user.id, REWARD[res]);
      send(p.ws, { type: "end", result: res, reason, gained: REWARD[res], xp: getUser(p.user.id).xp });
      games.delete(p.ws);
    }
  }

  function start(a, b) {
    const [w, bl] = Math.random() < 0.5 ? [a, b] : [b, a];
    const g = { w, b: bl, chess: new Chess(), over: false };
    games.set(w.ws, g); games.set(bl.ws, g);
    for (const c of ["w", "b"]) {
      const me = g[c], opp = g[other(c)];
      send(me.ws, { type: "start", color: c, opp: { name: opp.user.name, xp: opp.user.xp }, fen: g.chess.fen() });
    }
  }

  // Har soniyada XP bo'yicha eng yaqin juftlarni topamiz
  setInterval(() => {
    const now = Date.now();
    for (let found = true; found;) {
      found = false;
      for (const a of queue) {
        const range = BASE_RANGE + ((now - a.since) / 1000) * WIDEN_PER_SEC;
        const best = queue.filter((x) => x !== a)
          .sort((x, y) => Math.abs(x.user.xp - a.user.xp) - Math.abs(y.user.xp - a.user.xp))[0];
        if (best && Math.abs(best.user.xp - a.user.xp) <= range) {
          queue = queue.filter((x) => x !== a && x !== best);
          start(a, best); found = true; break;
        }
      }
    }
  }, 1000);

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      const g = games.get(ws);
      if (m.type === "queue") {
        const u = userFrom(m.initData);
        if (!u) return send(ws, { type: "error", text: "auth" });
        if (g) return;
        queue = queue.filter((q) => q.ws !== ws);
        queue.push({ ws, since: Date.now(), user: { id: u.id, name: u.first_name || u.username || "Player", xp: getUser(u.id).xp } });
        send(ws, { type: "waiting" });
      } else if (m.type === "cancel") {
        queue = queue.filter((q) => q.ws !== ws);
      } else if (g && !g.over && m.type === "move") {
        const c = g.w.ws === ws ? "w" : "b";
        if (g.chess.turn() !== c) return send(ws, { type: "sync", fen: g.chess.fen() });
        try { g.chess.move({ from: m.from, to: m.to, promotion: "q" }); }
        catch { return send(ws, { type: "sync", fen: g.chess.fen() }); }
        for (const p of [g.w, g.b]) send(p.ws, { type: "move", fen: g.chess.fen() });
        if (g.chess.isCheckmate()) finish(g, c, "mat");
        else if (g.chess.isDraw()) finish(g, null, "durang");
      } else if (g && !g.over && m.type === "resign") {
        finish(g, other(g.w.ws === ws ? "w" : "b"), "taslim");
      }
    });
    ws.on("close", () => {
      queue = queue.filter((q) => q.ws !== ws);
      const g = games.get(ws);
      if (g) finish(g, other(g.w.ws === ws ? "w" : "b"), "raqib chiqib ketdi");
    });
  });
}

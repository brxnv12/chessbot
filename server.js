import "dotenv/config";
import express from "express";
import crypto from "crypto";
import { Bot, InlineKeyboard } from "grammy";
import path from "path";
import { fileURLToPath } from "url";
import { attachOnline } from "./online.js";
import { upsertUser, getUser, solvedIds, top, award } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XP_BY_LEVEL = { 1: 10, 2: 25, 3: 50 };
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/engine", express.static(path.join(__dirname, "node_modules/stockfish/bin")));
app.use("/vendor", express.static(path.join(__dirname, "node_modules/chess.js/dist/esm")));

// Telegram initData imzosini tekshiramiz, shunda foydalanuvchini soxtalashtirib bo'lmaydi
function verifyInitData(initData) {
  const p = new URLSearchParams(initData);
  const hash = p.get("hash"); p.delete("hash");
  const check = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN || "").digest();
  const calc = crypto.createHmac("sha256", secret).update(check).digest("hex");
  if (!hash || calc !== hash) return null;
  return JSON.parse(p.get("user"));
}

// initData dan foydalanuvchini olamiz (DEV_MODE=1 da "dev:<id>:<ism>" ham qabul qilinadi)
function userFrom(data) {
  let u = null;
  if (data && data.startsWith("dev:") && process.env.DEV_MODE === "1") {
    const [, id, name] = data.split(":"); u = { id: Number(id), first_name: name };
  } else if (data) u = verifyInitData(data);
  if (u) upsertUser(u.id, u.first_name || u.username || "Player");
  return u;
}

function auth(req, res, next) {
  const u = userFrom(req.get("x-init-data"));
  if (!u) return res.status(401).json({ error: "auth" });
  req.user = u; next();
}

app.get("/api/me", auth, (req, res) => res.json({ ...getUser(req.user.id), solved: solvedIds(req.user.id) }));
app.get("/api/leaderboard", auth, (req, res) => res.json(top()));
app.post("/api/solve", auth, (req, res) => {
  const m = /^(?:m|c)(\d)-/.exec(req.body.puzzleId || "");
  const xp = m && XP_BY_LEVEL[m[1]];
  if (!xp) return res.status(400).json({ error: "puzzle" });
  const gained = award(req.user.id, req.body.puzzleId, xp) ? xp : 0;
  res.json({ gained, xp: getUser(req.user.id).xp });
});

const server = app.listen(process.env.PORT || 3000, () => console.log("Server ishga tushdi"));
attachOnline(server, userFrom);

if (process.env.BOT_TOKEN && !process.env.BOT_TOKEN.startsWith("BotFather")) {
  const bot = new Bot(process.env.BOT_TOKEN);
  bot.command("start", (ctx) =>
    ctx.reply("Shaxmat mashqlariga xush kelibsiz!", {
      reply_markup: new InlineKeyboard().webApp("Mashq boshlash", process.env.WEBAPP_URL),
    })
  );
  bot.start();
}

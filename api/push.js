import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (req.headers["x-token"] !== process.env.PUSH_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const b = req.body || {};
  await redis.set("aire:last", {
    co2: b.co2, voc: b.voc, temp: b.temp,
    hum: b.hum, nivel: b.nivel, ts: Date.now(),
  });
  res.status(200).json({ ok: true });
}

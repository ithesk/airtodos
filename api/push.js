import { Redis } from "@upstash/redis";

// IMPORTANTE: usar credenciales explícitas, NO Redis.fromEnv().
// Vercel/Upstash inyecta las variables con prefijo KV_ (KV_REST_API_URL,
// KV_REST_API_TOKEN). Redis.fromEnv() busca UPSTASH_REDIS_REST_* y NO las
// encuentra, por eso falla.
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  // Solo el ESP32 (que conoce PUSH_TOKEN) puede escribir.
  // Si PUSH_TOKEN no está configurado, se rechaza todo: sin esta guarda,
  // header ausente (undefined) === env ausente (undefined) y cualquiera podría escribir.
  if (!process.env.PUSH_TOKEN || req.headers["x-token"] !== process.env.PUSH_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const b = req.body || {};
  await redis.set("aire:last", {
    co2: b.co2,
    voc: b.voc,
    temp: b.temp,
    hum: b.hum,
    nivel: b.nivel,
    ts: Date.now(),
  });

  res.status(200).json({ ok: true });
}

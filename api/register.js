import { randomBytes } from "node:crypto";
import { redis, claveToken, claveMeta, limpiarNombre } from "./_sensor.js";

// Alta pública de un sensor nuevo: devuelve su id y su token de escritura.
// Es abierto a propósito (cualquiera puede armar su ESP32 y tener dashboard
// sin pedir permiso), pero se limita por IP para que no puedan inflar Redis.
const MAX_POR_DIA = 10;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconocida";
  const usadas = await redis.incr(`reg:${ip}`);
  if (usadas === 1) await redis.expire(`reg:${ip}`, 86400);
  if (usadas > MAX_POR_DIA) {
    return res.status(429).json({ error: "demasiados sensores hoy" });
  }

  // El id es público (viaja en la URL de la etiqueta) y es lo único que
  // protege las lecturas, así que se genera largo y aleatorio.
  const id = randomBytes(6).toString("hex"); // 12 caracteres [a-f0-9]
  const token = randomBytes(24).toString("hex");
  const nombre = limpiarNombre(req.body?.nombre);

  const p = redis.pipeline();
  p.set(claveToken(token), id);
  p.set(claveMeta(id), { nombre });
  await p.exec();

  res.status(200).json({
    id,
    token,
    nombre,
    url: `https://airtodos-phi.vercel.app/?s=${id}`,
  });
}

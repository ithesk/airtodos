import {
  redis,
  claveUltimo,
  claveHist,
  claveToken,
  ID_POR_DEFECTO,
} from "./_sensor.js";

// El token identifica al sensor: no se acepta un id en el cuerpo, porque
// entonces cualquiera con un token válido podría escribir sobre otro sensor.
async function sensorDelToken(token) {
  if (!token) return null;
  // Sensor original: su firmware trae el PUSH_TOKEN de siempre.
  if (process.env.PUSH_TOKEN && token === process.env.PUSH_TOKEN) {
    return ID_POR_DEFECTO;
  }
  return await redis.get(claveToken(token));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const id = await sensorDelToken(req.headers["x-token"]);
  if (!id) return res.status(401).json({ error: "unauthorized" });

  const b = req.body || {};
  const lectura = {
    co2: b.co2,
    voc: b.voc,
    temp: b.temp,
    hum: b.hum,
    nivel: b.nivel,
    ts: Date.now(),
  };

  // ":last" = dato actual; ":hist" = ventana de 24 h (2880 lecturas a una
  // cada 30 s), más nuevo primero. Pipeline = un solo round-trip a Upstash.
  const p = redis.pipeline();
  p.set(claveUltimo(id), lectura);
  p.lpush(claveHist(id), lectura);
  p.ltrim(claveHist(id), 0, 2879);
  await p.exec();

  res.status(200).json({ ok: true, sensor: id });
}

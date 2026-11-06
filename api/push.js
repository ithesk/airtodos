import { sql, conBaseDeDatos, ID_POR_DEFECTO, VENTANA_MS } from "./_sensor.js";

// El token identifica al sensor: no se acepta un id en el cuerpo, porque
// entonces cualquiera con un token válido podría escribir sobre otro sensor.
async function sensorDelToken(token) {
  if (!token) return null;
  // Sensor original: su firmware trae el PUSH_TOKEN de siempre.
  if (process.env.PUSH_TOKEN && token === process.env.PUSH_TOKEN) {
    return ID_POR_DEFECTO;
  }
  const filas = await sql`SELECT id FROM sensores WHERE token = ${token}`;
  return filas[0]?.id ?? null;
}

// El panel espera números. Sin esto, un firmware con un bug (o un push a mano)
// podría guardar "NaN" o una cadena, y el App Clip fallaría al decodificar el
// JSON entero — no solo ese campo.
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const id = await sensorDelToken(req.headers["x-token"]);
  if (!id) return res.status(401).json({ error: "unauthorized" });

  const b = req.body || {};
  const lectura = {
    co2: num(b.co2),
    voc: num(b.voc),
    temp: num(b.temp),
    hum: num(b.hum),
    pres: num(b.pres), // presión barométrica en hPa (BME280); null si el sensor no la trae
    nivel: num(b.nivel),
    ts: Date.now(),
  };

  // Se guarda la lectura y se poda lo que quedó fuera de la ventana de 24 h
  // (equivale al LPUSH + LTRIM de antes). La lectura más reciente es la "actual".
  // sql.transaction = una sola ida y vuelta a Neon.
  await sql.transaction([
    sql`INSERT INTO lecturas (sensor, ts, datos)
        VALUES (${id}, ${lectura.ts}, ${JSON.stringify(lectura)}::jsonb)`,
    sql`DELETE FROM lecturas
        WHERE sensor = ${id} AND ts < ${lectura.ts - VENTANA_MS}`,
  ]);

  res.status(200).json({ ok: true, sensor: id });
}

export default conBaseDeDatos(handler);

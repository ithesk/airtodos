import {
  sql,
  conBaseDeDatos,
  sensorDeQuery,
  NOMBRE_POR_DEFECTO,
} from "./_sensor.js";
import { construirGuia } from "./_guia.js";

// Con pushes de 30 s, la lectura n.º 359 hacia atrás es la de hace ~3 h.
// Pero el intervalo lo decide cada firmware, así que no se asume: se mide el
// tiempo real transcurrido y se normaliza. La ventana de 3 h es la estándar
// en meteorología (una caída de 3 hPa en 3 h anuncia mal tiempo).
const INDICE_ATRAS = 359;
const HORAS_MIN = 1; // menos de 1 h no dice nada: es ruido del sensor
const HORAS_MAX = 12; // más de 12 h ya no es una "tendencia" actual

function tendenciaPresion(actual, antes) {
  if (actual?.pres == null || antes?.pres == null) return null;
  if (actual.ts == null || antes.ts == null) return null;

  const horas = (actual.ts - antes.ts) / 3_600_000;
  if (horas < HORAS_MIN || horas > HORAS_MAX) return null;

  // Se devuelve la variación normalizada a 3 h, sea cual sea el intervalo
  // real de ese firmware.
  return ((actual.pres - antes.pres) / horas) * 3;
}

async function handler(req, res) {
  const id = sensorDeQuery(req);

  // Todo en una sola ida y vuelta: lectura actual, nombre y el dato de
  // hace ~3 h para la tendencia de la presión.
  const [ultima, meta, previa] = await sql.transaction([
    sql`SELECT datos FROM lecturas WHERE sensor = ${id}
        ORDER BY ts DESC LIMIT 1`,
    sql`SELECT nombre FROM sensores WHERE id = ${id}`,
    sql`SELECT datos FROM lecturas WHERE sensor = ${id}
        ORDER BY ts DESC OFFSET ${INDICE_ATRAS} LIMIT 1`,
  ]);
  const lectura = ultima[0]?.datos ?? null;
  const anterior = previa[0]?.datos ?? null;

  const deltaPres = tendenciaPresion(lectura, anterior);

  // 10 s de caché en el CDN de Vercel: el sensor reporta cada 30 s, así que
  // nadie nota la diferencia, y decenas de espectadores mirando el mismo
  // panel dejan de golpear la base una vez cada 5 s cada uno.
  res.setHeader("cache-control", "s-maxage=10, stale-while-revalidate=20");
  res.status(200).json({
    ...(lectura || {}),
    presd: deltaPres, // variación de presión en 3 h (hPa)
    nombre: meta[0]?.nombre || NOMBRE_POR_DEFECTO,
    guia: construirGuia(lectura, deltaPres),
  });
}

export default conBaseDeDatos(handler);

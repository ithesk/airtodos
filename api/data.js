import {
  redis,
  claveUltimo,
  claveMeta,
  claveHist,
  sensorDeQuery,
  NOMBRE_POR_DEFECTO,
} from "./_sensor.js";
import { construirGuia } from "./_guia.js";

// Con pushes de 30 s, el índice 359 de la lista es la lectura de hace ~3 h.
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

export default async function handler(req, res) {
  const id = sensorDeQuery(req);

  // Todo en un solo round-trip: lectura, nombre y el dato de hace 3 h para
  // la tendencia de la presión.
  const [lectura, meta, anterior] = await redis
    .pipeline()
    .get(claveUltimo(id))
    .get(claveMeta(id))
    .lindex(claveHist(id), INDICE_ATRAS)
    .exec();

  const deltaPres = tendenciaPresion(lectura, anterior);

  // 10 s de caché en el CDN de Vercel: el sensor reporta cada 30 s, así que
  // nadie nota la diferencia, y decenas de espectadores mirando el mismo
  // panel dejan de golpear Redis una vez cada 5 s cada uno.
  res.setHeader("cache-control", "s-maxage=10, stale-while-revalidate=20");
  res.status(200).json({
    ...(lectura || {}),
    presd: deltaPres, // variación de presión en 3 h (hPa)
    nombre: meta?.nombre || NOMBRE_POR_DEFECTO,
    guia: construirGuia(lectura, deltaPres),
  });
}

import {
  redis,
  claveUltimo,
  claveMeta,
  claveHist,
  sensorDeQuery,
  NOMBRE_POR_DEFECTO,
} from "./_sensor.js";
import { construirGuia } from "./_guia.js";

// La lista guarda una lectura cada 30 s, más nueva primero: el índice 359
// es la de hace ~3 h. Es la ventana estándar para leer una tendencia
// barométrica (una caída de 3 hPa en 3 h anuncia mal tiempo).
const INDICE_3H = 359;

export default async function handler(req, res) {
  const id = sensorDeQuery(req);

  // Todo en un solo round-trip: lectura, nombre y el dato de hace 3 h para
  // la tendencia de la presión.
  const [lectura, meta, hace3h] = await redis
    .pipeline()
    .get(claveUltimo(id))
    .get(claveMeta(id))
    .lindex(claveHist(id), INDICE_3H)
    .exec();

  const deltaPres =
    lectura?.pres != null && hace3h?.pres != null
      ? lectura.pres - hace3h.pres
      : null;

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

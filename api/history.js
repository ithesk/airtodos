import { sql, conBaseDeDatos, sensorDeQuery, VENTANA_MS } from "./_sensor.js";

// La base guarda ~2880 puntos (24 h); para la gráfica basta ~1 punto
// cada 5 min. Se submuestrea para que la respuesta pese ~15 KB y no ~230 KB.
const MAX_PUNTOS = 288;

async function handler(req, res) {
  const id = sensorDeQuery(req);
  const desde = Date.now() - VENTANA_MS;
  const filas = await sql`SELECT datos FROM lecturas
                          WHERE sensor = ${id} AND ts >= ${desde}
                          ORDER BY ts ASC`; // viejo→nuevo, como espera una gráfica
  const puntos = filas.map((f) => f.datos);

  const paso = Math.max(1, Math.ceil(puntos.length / MAX_PUNTOS));
  const serie = puntos.filter((_, i) => i % paso === 0);

  // El punto más reciente siempre va incluido, caiga o no en el muestreo.
  const ultimo = puntos[puntos.length - 1];
  if (ultimo && serie[serie.length - 1] !== ultimo) serie.push(ultimo);

  res.setHeader("cache-control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(serie);
}

export default conBaseDeDatos(handler);

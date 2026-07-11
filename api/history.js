import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// La lista guarda hasta 2880 puntos (24 h); para la gráfica basta ~1 punto
// cada 5 min. Se submuestrea para que la respuesta pese ~15 KB y no ~230 KB.
const MAX_POINTS = 288;

export default async function handler(req, res) {
  const raw = await redis.lrange("aire:hist", 0, -1); // más nuevo primero
  const points = raw.reverse(); // más viejo primero, como espera una gráfica

  const step = Math.max(1, Math.ceil(points.length / MAX_POINTS));
  const serie = points.filter((_, i) => i % step === 0);

  // El punto más reciente siempre va incluido, caiga o no en el muestreo.
  const last = points[points.length - 1];
  if (last && serie[serie.length - 1] !== last) serie.push(last);

  res.setHeader("cache-control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(serie);
}

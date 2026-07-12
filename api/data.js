import {
  redis,
  claveUltimo,
  claveMeta,
  sensorDeQuery,
  NOMBRE_POR_DEFECTO,
} from "./_sensor.js";

export default async function handler(req, res) {
  const id = sensorDeQuery(req);

  // Lectura y nombre en un solo round-trip: el panel necesita ambos para
  // poder decir de qué sensor (cocina, sala…) son los datos que muestra.
  const [lectura, meta] = await redis
    .pipeline()
    .get(claveUltimo(id))
    .get(claveMeta(id))
    .exec();

  res.setHeader("cache-control", "no-store");
  res.status(200).json({
    ...(lectura || {}),
    nombre: meta?.nombre || NOMBRE_POR_DEFECTO,
  });
}

import { redis, claveUltimo, sensorDeQuery } from "./_sensor.js";

export default async function handler(req, res) {
  const data = await redis.get(claveUltimo(sensorDeQuery(req)));
  res.setHeader("cache-control", "no-store");
  res.status(200).json(data || {});
}

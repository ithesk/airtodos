import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

export default async function handler(req, res) {
  const data = await redis.get("aire:last");
  res.setHeader("cache-control", "no-store");
  res.status(200).json(data || {});
}

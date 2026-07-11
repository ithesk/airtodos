import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const data = await redis.get("aire:last");
  res.setHeader("cache-control", "no-store");
  res.status(200).json(data || {});
}

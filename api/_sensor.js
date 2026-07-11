import { Redis } from "@upstash/redis";

// IMPORTANTE: credenciales explícitas, NO Redis.fromEnv().
// Vercel/Upstash inyecta las variables con prefijo KV_.
export const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Sensor del proyecto original: su etiqueta NFC no lleva ?s= y su firmware
// sigue usando la variable PUSH_TOKEN. Se le asigna este id para que todo
// lo viejo siga funcionando sin regrabar etiquetas ni reflashear el ESP32.
export const ID_POR_DEFECTO = "casa";

// El id sale de la URL (?s=...) y lo escribe cualquiera, así que se acota a
// [a-z0-9] y 24 caracteres: evita que una petición hostil arme claves raras
// en Redis o haga crecer el keyspace sin control.
export function idValido(s) {
  return typeof s === "string" && /^[a-z0-9]{1,24}$/.test(s);
}

export function sensorDeQuery(req) {
  const s = (req.query?.s || "").toString().toLowerCase();
  return idValido(s) ? s : ID_POR_DEFECTO;
}

export const claveUltimo = (id) => `aire:${id}:last`;
export const claveHist = (id) => `aire:${id}:hist`;
export const claveToken = (token) => `aire:tok:${token}`;

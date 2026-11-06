import { neon } from "@neondatabase/serverless";

// Neon (Postgres) conectado desde Vercel → Storage. La integración inyecta
// DATABASE_URL; POSTGRES_URL queda de respaldo por si se conectó con otro nombre.
// Antes esto era Upstash Redis: se migró porque cualquier fallo de Upstash
// tumbaba todas las funciones (FUNCTION_INVOCATION_FAILED).
const URL_BD = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const sql = neon(URL_BD);

// Sensor del proyecto original: su etiqueta NFC no lleva ?s= y su firmware
// sigue usando la variable PUSH_TOKEN. Se le asigna este id para que todo
// lo viejo siga funcionando sin regrabar etiquetas ni reflashear el ESP32.
export const ID_POR_DEFECTO = "casa";
export const NOMBRE_POR_DEFECTO = "Calidad del Aire";

// Ventana de historial: 24 h. Con un push cada 30 s son ~2880 lecturas,
// lo mismo que guardaba la lista de Redis.
export const VENTANA_MS = 24 * 3_600_000;

// ── Esquema ───────────────────────────────────────────────────────────
// Se crea solo la primera vez que una función arranca en frío, así no hace
// falta ningún paso manual al conectar la base. CREATE ... IF NOT EXISTS es
// idempotente; la promesa se guarda para no repetirlo en cada petición.
let esquemaListo = null;

export function prepararEsquema() {
  if (!esquemaListo) {
    esquemaListo = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS sensores (
        id      text PRIMARY KEY,
        token   text UNIQUE,
        nombre  text NOT NULL,
        creado  timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS lecturas (
        id      bigserial PRIMARY KEY,
        sensor  text   NOT NULL,
        ts      bigint NOT NULL,          -- milisegundos, como Date.now()
        datos   jsonb  NOT NULL           -- la lectura completa (co2, voc, …, ts)
      )`;
      await sql`CREATE INDEX IF NOT EXISTS lecturas_sensor_ts
                ON lecturas (sensor, ts DESC)`;
      await sql`CREATE TABLE IF NOT EXISTS registros (
        ip  text        NOT NULL,
        ts  timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS registros_ip_ts ON registros (ip, ts)`;
    })().catch((e) => {
      // Si falla (base aún no conectada, credenciales malas…), se permite
      // reintentar en la siguiente petición en vez de quedar envenenado.
      esquemaListo = null;
      throw e;
    });
  }
  return esquemaListo;
}

// Envuelve un handler: prepara el esquema y, si la base falla, responde 503
// con un JSON claro en lugar de que Vercel devuelva FUNCTION_INVOCATION_FAILED.
// El ESP32 solo mira el código HTTP, así que reintentará en el siguiente ciclo.
export function conBaseDeDatos(handler) {
  return async (req, res) => {
    try {
      if (!URL_BD) throw new Error("falta DATABASE_URL (¿Neon conectado al proyecto?)");
      await prepararEsquema();
      return await handler(req, res);
    } catch (e) {
      console.error("[bd]", e);
      if (!res.headersSent) {
        res.status(503).json({ error: "base de datos no disponible" });
      }
    }
  };
}

// El id sale de la URL (?s=...) y lo escribe cualquiera, así que se acota a
// [a-z0-9] y 24 caracteres: evita ids raros y que se pueda inflar la base.
export function idValido(s) {
  return typeof s === "string" && /^[a-z0-9]{1,24}$/.test(s);
}

export function sensorDeQuery(req) {
  const s = (req.query?.s || "").toString().toLowerCase();
  return idValido(s) ? s : ID_POR_DEFECTO;
}

// El nombre lo elige quien registra el sensor y el panel lo pinta como texto.
// Lista blanca en vez de lista negra: letras de cualquier idioma (con acentos),
// dígitos, espacio y puntuación simple. Así no entran caracteres de control ni
// signos de etiqueta HTML. Ejemplos válidos: "Cocina", "Sala 2", "Cuarto de papá".
const PERMITIDOS = /[^\p{L}\p{N} .,'-]/gu;

export function limpiarNombre(n) {
  const limpio = (n ?? "").toString().replace(PERMITIDOS, "").trim();
  return limpio.slice(0, 28) || NOMBRE_POR_DEFECTO;
}

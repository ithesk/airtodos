import { randomBytes } from "node:crypto";
import { sql, conBaseDeDatos, limpiarNombre } from "./_sensor.js";

// Alta pública de un sensor nuevo: devuelve su id y su token de escritura.
// Es abierto a propósito (cualquiera puede armar su ESP32 y tener dashboard
// sin pedir permiso), pero se limita por IP para que no puedan inflar la base.
const MAX_POR_DIA = 10;

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconocida";

  // Ventana deslizante de 24 h por IP (antes: INCR + EXPIRE en Redis).
  // De paso se borran los registros viejos para que la tabla no crezca.
  const [, , cuenta] = await sql.transaction([
    sql`DELETE FROM registros WHERE ts < now() - interval '24 hours'`,
    sql`INSERT INTO registros (ip) VALUES (${ip})`,
    sql`SELECT count(*)::int AS n FROM registros WHERE ip = ${ip}`,
  ]);
  if (cuenta[0].n > MAX_POR_DIA) {
    return res.status(429).json({ error: "demasiados sensores hoy" });
  }

  // El id es público (viaja en la URL de la etiqueta) y es lo único que
  // protege las lecturas, así que se genera largo y aleatorio.
  const id = randomBytes(6).toString("hex"); // 12 caracteres [a-f0-9]
  const token = randomBytes(24).toString("hex");
  const nombre = limpiarNombre(req.body?.nombre);

  await sql`INSERT INTO sensores (id, token, nombre) VALUES (${id}, ${token}, ${nombre})`;

  res.status(200).json({
    id,
    token,
    nombre,
    url: `https://airtodos-phi.vercel.app/?s=${id}`,
  });
}

export default conBaseDeDatos(handler);

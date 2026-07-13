// Traduce las lecturas a lenguaje humano: qué significa cada número y qué hacer.
//
// Vive en el backend a propósito. Si el texto viviera dentro del App Clip,
// cambiar una frase exigiría un build nuevo y otra revisión de Apple. Aquí se
// mejora la redacción cuando queramos y todos los clientes la ven al instante.

// --- Qué significa cada métrica, en una frase ---

function textoCO2(v) {
  if (v == null) return null;
  if (v < 600) return "Aire fresco, como el de afuera";
  if (v < 800) return "Bien ventilado";
  if (v < 1000) return "Empieza a cargarse — conviene abrir una ventana";
  if (v < 1400) return "Aire viciado: da sueño y cuesta concentrarse";
  return "Muy cargado — ventila ahora";
}

// El índice VOC de Sensirion es relativo: 100 es el promedio del ambiente.
function textoVOC(v) {
  if (v == null) return null;
  if (v < 80) return "Sin químicos ni olores en el aire";
  if (v < 150) return "Normal para un espacio habitado";
  if (v < 250) return "Se detectan olores o químicos (limpieza, cocina, pintura)";
  if (v < 400) return "Muchos compuestos en el aire — ventila";
  return "Fuerte presencia de químicos — ventila ya";
}

function textoTemp(v) {
  if (v == null) return null;
  if (v < 16) return "Frío";
  if (v < 20) return "Fresco";
  if (v < 25) return "Temperatura agradable";
  if (v < 28) return "Cálido, pero llevadero";
  if (v < 31) return "Calor — incómodo para dormir";
  return "Demasiado calor";
}

function textoHum(v) {
  if (v == null) return null;
  if (v < 25) return "Muy seco: reseca garganta, ojos y piel";
  if (v < 30) return "Algo seco";
  if (v <= 65) return "Humedad cómoda";
  if (v <= 75) return "Húmedo: favorece ácaros";
  return "Muy húmedo — riesgo de moho";
}

// La presión sola no le dice nada a nadie: 1011 hPa no es "bueno" ni "malo".
// Lo que sí significa algo es hacia dónde va. Por eso la tarjeta habla de la
// tendencia de las últimas 3 h, no del número.
function textoPres(v, delta) {
  if (v == null) return null;
  if (delta == null) return "Midiendo la tendencia…";
  if (delta <= -3) return "Bajando rápido: puede llegar lluvia o tormenta";
  if (delta <= -1) return "Bajando: el tiempo puede cambiar";
  if (delta >= 3) return "Subiendo rápido: el tiempo se despeja";
  if (delta >= 1) return "Subiendo: tiempo estabilizándose";
  return "Estable — sin cambios de clima a la vista";
}

// --- El consejo principal: UNA acción, la más importante ---
// En orden de urgencia. Lo que el visitante necesita saber si solo lee una línea.
function consejo({ co2, voc, temp, hum }) {
  if (co2 != null && co2 >= 1400)
    return "Abre puertas y ventanas ahora: el aire está muy cargado.";
  if (voc != null && voc >= 400)
    return "Ventila ya: hay una fuerte concentración de químicos en el aire.";
  if (co2 != null && co2 >= 1000)
    return "Abre una ventana: el aire está viciado y eso da sueño.";
  if (voc != null && voc >= 250)
    return "Ventila: se están acumulando olores o químicos.";
  if (hum != null && hum > 75)
    return "Demasiada humedad: ventila o usa un deshumidificador, o aparecerá moho.";
  if (co2 != null && co2 >= 800)
    return "Conviene abrir una ventana pronto: el aire empieza a cargarse.";
  if (hum != null && hum < 25)
    return "El aire está muy seco: puede resecar garganta y ojos.";
  if (temp != null && temp >= 31)
    return "Hace demasiado calor en este espacio.";
  if (temp != null && temp < 16)
    return "Hace frío en este espacio.";
  return "El aire está limpio y bien ventilado.";
}

export function construirGuia(l, deltaPres) {
  if (!l || l.co2 == null) return null;
  return {
    consejo: consejo(l),
    co2: textoCO2(l.co2),
    voc: textoVOC(l.voc),
    temp: textoTemp(l.temp),
    hum: textoHum(l.hum),
    pres: textoPres(l.pres, deltaPres),
  };
}

// Fecha YYYY-MM-DD en hora local.
// toISOString() usa UTC: en Colombia (UTC-5), después de las 7 p. m. devuelve el día siguiente.
export const fechaLocalISO = (d: Date = new Date()) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];

// Formatea una fecha como yyyy-MM-dd usando hora local del navegador (sin conversión UTC).
// Usar SIEMPRE esto para pasar fechas a la API en lugar de .toISOString().
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Convierte un timestamp UTC a hora en formato HH:mm en zona Guatemala (UTC-6 fijo).
export function toGuatemalaTime(utcDate: string | Date): string {
  const d = new Date(utcDate);
  const offset = -6 * 60;
  const local = new Date(d.getTime() + offset * 60 * 1000);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

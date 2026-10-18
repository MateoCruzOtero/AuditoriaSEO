/**
 * Convierte lo que escribe el usuario ("https://www.Ejemplo.com/contacto")
 * en un dominio limpio ("ejemplo.com"). Devuelve null si no es válido.
 */
export function normalizeDomain(input: string): string | null {
  let hostname: string;
  try {
    hostname = new URL(input.includes("://") ? input : `https://${input}`).hostname;
  } catch {
    return null;
  }
  const domain = hostname.replace(/^www\./, "").toLowerCase();
  const looksLikeDomain =
    /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain);
  // Bloqueamos IPs: solo analizamos sitios públicos por su nombre.
  const isIp = /^[\d.]+$/.test(domain);
  return looksLikeDomain && !isIp ? domain : null;
}

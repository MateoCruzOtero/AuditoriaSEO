// Países disponibles. Los códigos son los "location_code" de DataForSEO.
export const COUNTRIES = [
  { code: 2858, label: "Uruguay", language: "es" },
  { code: 2032, label: "Argentina", language: "es" },
  { code: 2152, label: "Chile", language: "es" },
  { code: 2170, label: "Colombia", language: "es" },
  { code: 2484, label: "México", language: "es" },
  { code: 2604, label: "Perú", language: "es" },
  { code: 2724, label: "España", language: "es" },
  { code: 2840, label: "Estados Unidos", language: "en" },
] as const;

export const DEFAULT_COUNTRY = 2858;

export function findCountry(code: number) {
  return COUNTRIES.find((c) => c.code === code) ?? null;
}

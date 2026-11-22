import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, fromAcceptLanguage, isLocale } from "@/i18n/config";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

type Tree = { [k: string]: string | Tree };
// Español encima del inglés: si a una frase le falta su traducción, se ve en inglés (nunca una llave rara)
function merge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = typeof v === "object" && typeof b === "object" ? merge(b, v) : v;
  }
  return out;
}
const ES = merge(en as Tree, es as Tree);

// Cada petición: 1) la cookie bp_lang, 2) el idioma del navegador, 3) inglés.
// No consulta la base aquí (sería un viaje extra en cada pantalla); el idioma guardado en el perfil
// se copia a la cookie con <LanguageSync /> la primera vez que la persona entra en un aparato nuevo.
export default getRequestConfig(async () => {
  const saved = cookies().get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : fromAcceptLanguage(headers().get("accept-language"));
  return {
    locale,
    messages: locale === "es" ? ES : en,
    timeZone: "America/Chicago",
  };
});

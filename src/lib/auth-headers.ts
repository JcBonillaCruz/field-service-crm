// Encabezados internos que el middleware le pasa al servidor (nunca vienen del navegador: el middleware los borra)
export const USER_HEADER = "x-bp-user";
export const KEY_HEADER = "x-bp-key";
export const internalKey = () => process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

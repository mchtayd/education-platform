//src\lib\fullUrl.ts
import api from "./api";

/**
 * Backend'in döndürdüğü "/uploads/..." gibi relative path'leri
 * API origin'ine bağlayıp çalışır hale getirir.
 */
export function fullApiUrl(p?: string | null) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;

  const base = (api.defaults.baseURL || "").replace(/\/$/, "");
  // baseURL bazı projelerde ".../api" olabiliyor -> origin'e çekiyoruz
  const origin = base.replace(/\/api$/i, "");

  const path = p.startsWith("/") ? p : `/${p}`;
  return origin ? `${origin}${path}` : path;
}

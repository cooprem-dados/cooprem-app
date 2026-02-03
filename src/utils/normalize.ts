export const normalizePA = (pa: string) =>
  (pa ?? "").trim().replace(/^0+(?=\d)/, "");

export const normalizeDoc = (doc: string) =>
  (doc ?? "").replace(/\D/g, "").trim(); // só dígitos, mantém zeros

export const normalizeText = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const normalizeAlphaNum = (s: string) =>
  normalizeText(s).replace(/[^a-z0-9]/g, "");

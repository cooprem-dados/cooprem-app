import { collection, getDocs, limit, orderBy, query, where, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import type { Cooperado } from "../types";
import { db } from "../firebase/firebaseConfig";
import { normalizePA, normalizeAlphaNum, normalizeText } from "../utils/normalize";

/**
 * Busca cooperados por nome_normalizado.
 * - Usuário normal: filtra por PA
 * - Admin/Dev: se PA="*" (ou vazio), busca global
 */
export async function searchCooperados(pa: string, term: string): Promise<Cooperado[]> {
  const t = normalizeText(term);
  if (!t) return [];

  const paKey = normalizePA(pa);
  const isGlobal = paKey === "*" || paKey === "";
  const minLen = isGlobal ? 3 : 2;
  if (t.length < minLen) return [];

  const end = t + "\uf8ff";

  const q = isGlobal
    ? query(
        collection(db, "cooperados"),
        orderBy("nome_normalizado"),
        where("nome_normalizado", ">=", t),
        where("nome_normalizado", "<=", end),
        limit(20)
      )
    : query(
        collection(db, "cooperados"),
        where("PA", "==", paKey),
        orderBy("nome_normalizado"),
        where("nome_normalizado", ">=", t),
        where("nome_normalizado", "<=", end),
        limit(20)
      );

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;

    return {
      id: d.id,
      ...data,
      // padroniza para o front
      name: data.name ?? data.nome ?? "",
      document: data.document ?? data.documento ?? "",
    } as Cooperado;
  });
}

export function mapCooperadoFromFirestore(id: string, data: any): Cooperado {
  return {
    id,
    name: data?.nome ?? data?.name ?? "",
    document: data?.documento ?? data?.document ?? "",
    isPortfolio: data?.isPortfolio ?? true,
    managerName: data?.nome_gerente ?? data?.managerName ?? "",
    agency: data?.PA ?? data?.agency ?? "",
  };
}

export function mapCooperadoToFirestore(c: Omit<Cooperado, "id">) {
  return {
    nome: c.name ?? "",
    documento: c.document ?? "",
    isPortfolio: c.isPortfolio ?? true,
    nome_gerente: c.managerName ?? "",
    PA: c.agency ?? "",
    nome_normalizado: normalizeAlphaNum(c.name ?? ""),
    nome_gerente_normalizado: normalizeAlphaNum(c.managerName ?? ""),
    tipo_documento:
      (c.document ?? "").replace(/\D/g, "").length === 11
        ? "cpf"
        : (c.document ?? "").replace(/\D/g, "").length === 14
        ? "cnpj"
        : "desconhecido",
  };
}

export async function addCooperado(c: Omit<Cooperado, "id">) {
  const payload = mapCooperadoToFirestore(c);
  const r = await addDoc(collection(db, "cooperados"), payload);
  return mapCooperadoFromFirestore(r.id, payload);
}

export async function updateCooperado(id: string, c: Omit<Cooperado, "id">) {
  const payload = mapCooperadoToFirestore(c);
  await updateDoc(doc(db, "cooperados", id), payload);
  return mapCooperadoFromFirestore(id, payload);
}

export async function deleteCooperado(id: string) {
  await deleteDoc(doc(db, "cooperados", id));
}

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";



export type SipagStatus = "ESTOQUE" | "ALOCADA";
export type InactiveReason = "MANUTENCAO" | "DESCARTE" | "OUTRO";
export type OperationalStatus = "EM_ESTOQUE" | "COM_COOPERADO" | "DEVOLUCAO" | "DEFEITO";
export type SipagAction = "ENTREGA" | "DEVOLUCAO" | "TROCA";


export type SipagMachine = {
  serial: string;

  // 🔹 Logística (Admin / Dev)
  currentPA: string;          // "99" = estoque
  status: SipagStatus;        // baseado no PA
  lastMove?: {
    fromPA: string;
    toPA: string;
    byUid: string;
    byName: string;
    at: any;
  };

  // 🔹 Operacional (Gerente)
  operationalStatus: OperationalStatus;
  cooperadoCNPJ: string | null;
  operationalUpdatedAt?: any;
  operationalUpdatedBy?: {
    uid: string;
    name: string;
  };

  // 🔹 Extras
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
};

function normalizeSerial(s: string) {
  return (s ?? "").trim().toUpperCase();
}

// remove tudo que não for dígito
export function normalizeCNPJ(cnpj: string) {
  return (cnpj ?? "").replace(/\D/g, "");
}

export async function addSipagMachine(
  serialRaw: string,
  by: { uid: string; name: string },
  opts?: { notes?: string }
) {
  const serial = serialRaw.trim().toUpperCase();
  if (!serial) throw new Error("Serial inválido.");

  const ref = doc(db, "sipagMachines", serial);
  const snap = await getDoc(ref);
  if (snap.exists()) throw new Error("Já existe uma SIPAG com este serial.");

  await setDoc(ref, {
    serial,
    currentPA: "99",
    status: "ESTOQUE",
    notes: opts?.notes ?? "",
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMove: {
      fromPA: "",
      toPA: "99",
      byUid: by.uid,
      byName: by.name,
      at: serverTimestamp(),
    },
    // se você quiser já iniciar operacional:
    operationalStatus: "EM_ESTOQUE",
    cooperadoCNPJ: null,
    operationalUpdatedAt: serverTimestamp(),
    operationalUpdatedBy: { uid: by.uid, name: by.name },
  });
}

export async function listSipagMachines(params?: { pa?: string }) {
  const base = collection(db, "sipagMachines");
  const q = params?.pa
    ? query(base, where("currentPA", "==", String(params.pa)), orderBy("updatedAt", "desc"))
    : query(base, orderBy("updatedAt", "desc"));

  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.data() as SipagMachine);
}

export async function countSipagEstoqueByPA(pa: string) {
  const q = query(
    collection(db, "sipagMachines"),
    where("currentPA", "==", String(pa)),
    where("isActive", "==", true),
    where("cooperadoCNPJ", "==", null)
  );

  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function countSipagAtivasComCNPJByPA(pa: string) {
  const q = query(
    collection(db, "sipagMachines"),
    where("currentPA", "==", String(pa)),
    where("isActive", "==", true),
    where("operationalStatus", "==", "COM_COOPERADO")
  );

  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function hasActiveSipagForCNPJ(cnpj: string) {
  const digits = normalizeCNPJ(cnpj);
  if (!digits) return false;

  const q = query(
    collection(db, "sipagMachines"),
    where("isActive", "==", true),
    where("operationalStatus", "==", "COM_COOPERADO"),
    where("cooperadoCNPJ", "==", digits),
    limit(1)
  );

  const snap = await getDocs(q);
  return !snap.empty;
}


export async function transferSipagMachine(args: {
  serialRaw: string;
  toPA: string;
  by: { uid: string; name: string };
  reason?: string;
}) {
  const serial = args.serialRaw.trim().toUpperCase();
  const toPA = args.toPA.trim();
  if (!serial) throw new Error("Serial inválido.");
  if (!toPA) throw new Error("PA destino inválido.");

  const machineRef = doc(db, "sipagMachines", serial);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(machineRef);
    if (!snap.exists()) throw new Error("SIPAG não encontrada.");

    const machine = snap.data() as SipagMachine;
    const fromPA = machine.currentPA;

    if (fromPA === toPA) throw new Error("A SIPAG já está neste PA.");

    const nextStatus: SipagStatus = toPA === "99" ? "ESTOQUE" : "ALOCADA";

    tx.update(machineRef, {
      currentPA: toPA,
      status: nextStatus,
      updatedAt: serverTimestamp(),
      lastMove: {
        fromPA,
        toPA,
        byUid: args.by.uid,
        byName: args.by.name,
        at: serverTimestamp(),
      },
    });

    // histórico de logística (opcional)
    const movementsCol = collection(db, "sipagMachines", serial, "movements");
    tx.set(doc(movementsCol), {
      fromPA,
      toPA,
      by: { uid: args.by.uid, name: args.by.name },
      at: serverTimestamp(),
      reason: args.reason ?? "",
    });
  });
}

async function setOperationalStatusTx(args: {
  serial: string;
  toStatus: OperationalStatus;
  action: SipagAction;
  cnpj: string | null;
  by: { uid: string; name: string };
  note?: string;
  expectedFrom?: OperationalStatus; // opcional: validar estado atual
}) {
  const serial = normalizeSerial(args.serial);
  if (!serial) throw new Error("Serial inválido.");

  await runTransaction(db, async (tx) => {
    const machineRef = doc(db, "sipagMachines", serial);
    const snap = await tx.get(machineRef);
    if (!snap.exists()) throw new Error(`SIPAG ${serial} não encontrada. (cadastre primeiro no estoque)`);

    const data = snap.data() as SipagMachine;
    const from = (data.operationalStatus ?? "EM_ESTOQUE") as OperationalStatus;

    if (args.expectedFrom && from !== args.expectedFrom) {
      throw new Error(`SIPAG ${serial}: status atual é ${from}, esperado ${args.expectedFrom}.`);
    }

    // regra: COM_COOPERADO exige CNPJ
    if (args.toStatus === "COM_COOPERADO") {
      const cnpjDigits = normalizeCNPJ(args.cnpj ?? "");
      if (!cnpjDigits) throw new Error("CNPJ é obrigatório quando status = COM_COOPERADO.");
      tx.update(machineRef, {
        operationalStatus: "COM_COOPERADO",
        cooperadoCNPJ: cnpjDigits,
        operationalUpdatedAt: serverTimestamp(),
        operationalUpdatedBy: { uid: args.by.uid, name: args.by.name },
        updatedAt: serverTimestamp(),
      });
    } else {
      // fora do cooperado: limpa cnpj
      tx.update(machineRef, {
        operationalStatus: args.toStatus,
        cooperadoCNPJ: null,
        operationalUpdatedAt: serverTimestamp(),
        operationalUpdatedBy: { uid: args.by.uid, name: args.by.name },
        updatedAt: serverTimestamp(),
      });
    }

    // status history
    const eventsCol = collection(db, "sipagMachines", serial, "statusEvents");
    tx.set(doc(eventsCol), {
      type: args.action,
      from,
      to: args.toStatus,
      cooperadoCNPJ: args.toStatus === "COM_COOPERADO" ? normalizeCNPJ(args.cnpj ?? "") : null,
      by: { uid: args.by.uid, name: args.by.name },
      at: serverTimestamp(),
      note: args.note ?? null,
    });
  });
}

/**
 * Entrega: estoque -> cooperado
 */
export async function sipagEntrega(args: {
  serialEntrega: string;
  cooperadoCNPJ: string;
  by: { uid: string; name: string };
  note?: string;
}) {
  await setOperationalStatusTx({
    serial: args.serialEntrega,
    toStatus: "COM_COOPERADO",
    action: "ENTREGA",
    cnpj: args.cooperadoCNPJ,
    by: args.by,
    expectedFrom: "EM_ESTOQUE",
    note: args.note,
  });
}

/**
 * Devolução: cooperado -> estoque
 */
export async function sipagDevolucao(args: {
  serialDevolucao: string;
  by: { uid: string; name: string };
  note?: string;
}) {
  await setOperationalStatusTx({
    serial: args.serialDevolucao,
    toStatus: "EM_ESTOQUE",
    action: "DEVOLUCAO",
    cnpj: null,
    by: args.by,
    expectedFrom: "COM_COOPERADO",
    note: args.note,
  });
}

/**
 * Troca:
 * - uma volta do cooperado -> estoque
 * - outra sai do estoque -> cooperado
 */
export async function sipagTroca(args: {
  serialSaiDoCooperado: string;
  serialVaiProCooperado: string;
  cooperadoCNPJ: string;
  by: { uid: string; name: string };
  note?: string;
}) {
  // 1) devolve a que estava com o cooperado
  await setOperationalStatusTx({
    serial: args.serialSaiDoCooperado,
    toStatus: "EM_ESTOQUE",
    action: "TROCA",
    cnpj: null,
    by: args.by,
    expectedFrom: "COM_COOPERADO",
    note: args.note,
  });

  // 2) entrega outra do estoque para o cooperado
  await setOperationalStatusTx({
    serial: args.serialVaiProCooperado,
    toStatus: "COM_COOPERADO",
    action: "TROCA",
    cnpj: args.cooperadoCNPJ,
    by: args.by,
    expectedFrom: "EM_ESTOQUE",
    note: args.note,
  });
}

export async function deactivateSipagMachine(args: {
  serialRaw: string;
  reason: InactiveReason;
  by: { uid: string; name: string };
  note?: string;
}) {
  const serial = args.serialRaw.trim().toUpperCase();
  if (!serial) throw new Error("Serial inválido.");

  const ref = doc(db, "sipagMachines", serial);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("SIPAG não encontrada.");

    const data = snap.data() as any;
    if (data.isActive === false) throw new Error("Esta SIPAG já está inativa.");

    tx.update(ref, {
      isActive: false,
      inactiveReason: args.reason,
      inactiveAt: serverTimestamp(),
      inactiveBy: { uid: args.by.uid, name: args.by.name },

      // opcional: mantém um log operacional
      operationalStatus: "DEFEITO", // ou mantenha como está, você decide
      cooperadoCNPJ: null,

      updatedAt: serverTimestamp(),
    });

    // opcional: histórico de evento (igual statusEvents)
    // se você já tem statusEvents, pode registrar um event “INATIVAR”
  });
}

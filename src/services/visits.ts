import { Timestamp, collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import type { User, Visit } from "../types";
import { db } from "../firebase/firebaseConfig";
import { toDate } from "../utils/firestore";

export async function createVisitWithSerial(
  currentUser: User,
  v: Omit<Visit, "id" | "manager">
): Promise<Visit> {
  const visitData = {
    ...v,
    date: Timestamp.fromDate(toDate((v as any).date)),
    manager: {
      id: currentUser.id,
      name: currentUser.name,
      agency: currentUser.agency,
    },
  };

  const counterRef = doc(db, "counters", "visits");
  const visitsCol = collection(db, "visits");

  let newVisit: Visit | null = null;

  await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const last = counterSnap.exists() ? counterSnap.data().value || 0 : 0;
    const next = last + 1;

    const serial = `V${String(next).padStart(3, "0")}`;

    tx.set(counterRef, { value: next }, { merge: true });

    const visitRef = doc(visitsCol);
    tx.set(visitRef, {
      ...visitData,
      serial,
      createdAt: serverTimestamp(),
    });

    newVisit = {
      ...(visitData as any),
      id: visitRef.id,
      serial,
      date: toDate((v as any).date),
    } as Visit;
  });

  if (!newVisit) {
    throw new Error("Falha ao criar visita.");
  }

  return newVisit;
}

import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import type { SuggestedVisit, User, Visit } from "../types";
import { db } from "../firebase/firebaseConfig";
import { toDate } from "../utils/firestore";

export async function fetchInitialData(user: User) {
  const isDev = user.role === "Desenvolvedor" || user.role === "Admin";

  const visitsQ = isDev
    ? query(collection(db, "visits"), orderBy("date", "desc"), limit(200))
    : query(
        collection(db, "visits"),
        where("manager.id", "==", user.id),
        orderBy("date", "desc"),
        limit(50)
      );

  const suggQ = isDev
    ? query(collection(db, "suggestedVisits"), orderBy("suggestedAt", "desc"), limit(50))
    : query(
        collection(db, "suggestedVisits"),
        where("manager.id", "==", user.id),
        orderBy("suggestedAt", "desc"),
        limit(50)
      );

  const usersQ = isDev ? query(collection(db, "users"), orderBy("name"), limit(50)) : null;

  const [visRes, sugRes, usersRes] = await Promise.allSettled([
    getDocs(visitsQ),
    getDocs(suggQ),
    isDev && usersQ ? getDocs(usersQ) : Promise.resolve(null),
  ]);

  const visits: Visit[] =
    visRes.status === "fulfilled"
      ? visRes.value.docs.map((d) => {
          const data = d.data() as any;
          return { ...data, id: d.id, date: toDate(data.date) } as Visit;
        })
      : [];

  const suggestedVisits: SuggestedVisit[] =
    sugRes.status === "fulfilled"
      ? sugRes.value.docs.map((d) => {
          const data = d.data() as any;
          return { ...data, id: d.id, suggestedAt: toDate(data.suggestedAt) } as SuggestedVisit;
        })
      : [];

  const users: User[] =
    isDev && usersRes.status === "fulfilled" && usersRes.value
      ? (usersRes.value.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as User) as User[])
      : [];

  return { visits, suggestedVisits, users };
}

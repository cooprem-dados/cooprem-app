import { useCallback, useEffect, useState } from "react";
import type { Cooperado, SuggestedVisit, User, Visit } from "./types";
import { limit, orderBy } from "firebase/firestore";
import React from "react";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import DeveloperDashboard from "./components/DeveloperDashboard";
import PasswordFormModal from "./components/PasswordFormModal";
import Logo from "./components/Logo";

import { auth, db, firebaseConfig } from "./firebase/firebaseConfig";

import { initializeApp, deleteApp } from "firebase/app";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

function toDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [suggestedVisits, setSuggestedVisits] = useState<SuggestedVisit[]>([]);

  //Função de callback para search de cooperados
  const normalizePA = (pa: string) => (pa ?? "").trim().replace(/^0+(?=\d)/, "");




  //função buscar os cooperados com filtro
  const searchCooperados = useCallback(
    async (pa: string, term: string): Promise<Cooperado[]> => {
      const t = term
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

      if (!t || t.length < 2) return [];

      const end = t + "\uf8ff";
      const paKey = normalizePA(pa);

      // 🔥 DEV/ADMIN: se pa for "*" (ou vazio), pesquisa na base toda
      const isGlobal = paKey === "*" || paKey === "";
      const minLen = isGlobal ? 3 : 2;
      if (!t || t.length < minLen) return [];

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

          // ✅ padroniza para o front (evita "Sem nome")
          name: data.name ?? data.nome ?? "",
          document: data.document ?? data.documento ?? "",
        } as Cooperado;
      });
    },
    []
  );

  // Mapeia campos do Firestore (PT-BR) <-> modelo do app (EN)
  const mapCooperadoFromFirestore = (id: string, data: any): Cooperado => ({
    id,
    name: data?.nome ?? data?.name ?? "",
    document: data?.documento ?? data?.document ?? "",
    isPortfolio: data?.isPortfolio ?? true,
    managerName: data?.nome_gerente ?? data?.managerName ?? "",
    agency: data?.PA ?? data?.agency ?? "",
  });

  const mapCooperadoToFirestore = (c: Omit<Cooperado, "id">) => ({
    nome: c.name ?? "",
    documento: c.document ?? "",
    isPortfolio: c.isPortfolio ?? true,
    nome_gerente: c.managerName ?? "",
    PA: c.agency ?? "",
    // opcional: campos normalizados (se você quiser manter padronização)
    nome_normalizado: (c.name ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, ""),
    nome_gerente_normalizado: (c.managerName ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, ""),
    tipo_documento:
      (c.document ?? "").replace(/\D/g, "").length === 11
        ? "cpf"
        : (c.document ?? "").replace(/\D/g, "").length === 14
          ? "cnpj"
          : "desconhecido",
  });

  // Mantém o prop do DeveloperDashboard, mas sem IA por enquanto
  const hasAIKey = false;

  const fetchData = useCallback(async (user: User) => {
    setLoading(true);
    try {
      const isDev = user.role === "Desenvolvedor" || user.role === "Admin";

      const visitsQ = isDev
        ? query(collection(db, "visits"), orderBy("date", "desc"), limit(50))
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

      const usersQ = isDev
        ? query(collection(db, "users"), orderBy("name"), limit(50))
        : null;

      const [visRes, sugRes, coopRes, usersRes] = await Promise.allSettled([
        getDocs(visitsQ),
        getDocs(suggQ),
        Promise.resolve(null), // <-- NÃO buscar cooperados no boot
        isDev && usersQ ? getDocs(usersQ) : Promise.resolve(null),
      ]);

      if (visRes.status === "fulfilled") {
        const snap = visRes.value;
        setVisits(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return { ...data, id: d.id, date: toDate(data.date) } as Visit;
          })
        );
      } else {
        console.error("Erro visitsQ:", visRes.reason);
        setVisits([]);
      }

      if (sugRes.status === "fulfilled") {
        const snap = sugRes.value;
        setSuggestedVisits(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return { ...data, id: d.id, suggestedAt: toDate(data.suggestedAt) } as SuggestedVisit;
          })
        );
      } else {
        console.error("Erro suggQ:", sugRes.reason);
        setSuggestedVisits([]);
      }

      if (isDev && usersRes.status === "fulfilled" && usersRes.value) {
        const snap = usersRes.value;
        setUsers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as User));
      } else {
        setUsers([]);
      }

      // cooperados agora só via busca remota (searchCooperados)
      setCooperados([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await signOut(auth);
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const userData = { ...(snap.data() as any), id: u.uid } as User;
      setCurrentUser(userData);
      await fetchData(userData);
    });

    return () => unsub();
  }, [fetchData]);

  const handleLogin = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      return true;
    } catch {
      return false;
    }
  };
  //codigo antigo
  /*const handleAddVisit = async (v: Omit<Visit, "id" | "manager">) => { if (!currentUser) return; const visitData = { ...v, date: Timestamp.fromDate(toDate((v as any).date)), manager: { id: currentUser.id, name: currentUser.name, agency: currentUser.agency, }, };
   const ref = await addDoc(collection(db, "visits"), visitData);

    setVisits((prev) => [
      {
        ...(visitData as any),
        id: ref.id,
        date: toDate((v as any).date),
      } as Visit,
      ...prev,
    ]);

    // Se sua UI estiver usando suggestedVisits como “pendências”, você pode remover manualmente depois
  };*/
  //codigo novo
  const handleAddVisit = async (v: Omit<Visit, "id" | "manager">) => {
    if (!currentUser) return;

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
      // 1️⃣ lê contador
      const counterSnap = await tx.get(counterRef);
      const last = counterSnap.exists() ? counterSnap.data().value || 0 : 0;
      const next = last + 1;

      const serial = `V${String(next).padStart(3, "0")}`; // V001, V002...

      // 2️⃣ atualiza contador
      tx.set(counterRef, { value: next }, { merge: true });

      // 3️⃣ cria visita
      const visitRef = doc(visitsCol);
      tx.set(visitRef, {
        ...visitData,
        serial,
        createdAt: serverTimestamp(),
      });

      // 4️⃣ prepara objeto para UI
      newVisit = {
        ...(visitData as any),
        id: visitRef.id,
        serial,
        date: toDate((v as any).date),
      } as Visit;
    });

    // 5️⃣ atualiza UI
    if (newVisit) {
      setVisits((prev) => [newVisit as Visit, ...prev]);
    }
  };


  const handleGenerateAISuggestions = async () => {
    alert("IA desativada por enquanto.");
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#005058] text-white">
        <Logo
          style={{
            height: "60px",
            marginBottom: "20px",
            filter: "brightness(1.5)",
          }}
        />
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="font-bold">Sicoob Cooprem - Sincronizando...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  const isDev = currentUser.role === "Desenvolvedor" || currentUser.role === "Admin";

  return (
    <div className="min-h-screen bg-gray-100 selection:bg-[#005058] selection:text-white">
      {isDev ? (
        <DeveloperDashboard
          users={users}
          cooperados={cooperados}
          visits={visits}
          suggestedVisits={suggestedVisits}
          searchCooperados={searchCooperados}
          onLogout={() => signOut(auth)}
          hasAIKey={hasAIKey}
          onAddUser={async (u) => {
            const secApp = initializeApp(firebaseConfig, `Sec_${Date.now()}`);
            const secAuth = getAuth(secApp);

            try {
              const cred = await createUserWithEmailAndPassword(
                secAuth,
                u.email,
                u.password || "123456"
              );

              await setDoc(doc(db, "users", cred.user.uid), {
                ...u,
                createdAt: serverTimestamp(),
              });

              setUsers((p) => [...p, { ...u, password: undefined, id: cred.user.uid }]);
            } catch (err: any) {
              if (err?.code === "auth/email-already-in-use") {
                alert("Já existe um usuário cadastrado com este e-mail.");
                return;
              }
              alert("Erro ao criar usuário.");
              console.error(err);
            } finally {
              await deleteApp(secApp);
            }
          }}
          onDeleteUser={async (id) => {
            if (!confirm("Remover este usuário?")) return;
            await deleteDoc(doc(db, "users", id));
            setUsers((p) => p.filter((u) => u.id !== id));
          }}
          onAddCooperado={async (c) => {
            const payload = mapCooperadoToFirestore(c);
            const r = await addDoc(collection(db, "cooperados"), payload);
            setCooperados((p) => [...p, mapCooperadoFromFirestore(r.id, payload)]);
          }}
          onGenerateAISuggestions={handleGenerateAISuggestions}
          onOpenChangePassword={setPasswordModalUser}
          onAddSuggestion={async (s) => {
            const payload = {
              ...s,
              suggestedAt: Timestamp.fromDate(toDate(s.suggestedAt || new Date())),
            };
            const r = await addDoc(collection(db, "suggestedVisits"), payload);
            setSuggestedVisits((p) => [
              ...p,
              { ...payload, id: r.id, suggestedAt: toDate(payload.suggestedAt) },
            ]);
          }}
          onRemoveSuggestion={async (id) => {
            await deleteDoc(doc(db, "suggestedVisits", id));
            setSuggestedVisits((p) => p.filter((x) => x.id !== id));
          }}
          onUpdateUser={async (id, d) => {
            await updateDoc(doc(db, "users", id), d);
            setUsers((p) => p.map((u) => (u.id === id ? { ...u, ...d } : u)));
          }}
          onUpdateCooperado={async (id, c) => {
            const payload = mapCooperadoToFirestore(c);
            await updateDoc(doc(db, "cooperados", id), payload);
            setCooperados((p) => p.map((x) => (x.id === id ? mapCooperadoFromFirestore(id, payload) : x)));
          }}
          onDeleteCooperado={async (id) => {
            if (!confirm("Excluir cooperado?")) return;
            await deleteDoc(doc(db, "cooperados", id));
            setCooperados((p) => p.filter((x) => x.id !== id));
          }}
        />
      ) : (
        <Dashboard
          user={currentUser}
          visits={visits}
          searchCooperados={searchCooperados}
          cooperados={cooperados}
          suggestedVisits={suggestedVisits}
          onLogout={() => signOut(auth)}
          addVisit={handleAddVisit}
        />
      )}

      {passwordModalUser && (
        <PasswordFormModal
          user={passwordModalUser}
          onSave={async (_userId: string, _newPass: string) => {
            // Não armazene senha no Firestore (segurança/LGPD). Em vez disso, envie e-mail de redefinição.
            const targetEmail = passwordModalUser?.email;
            if (!targetEmail) {
              alert("E-mail do usuário não encontrado para redefinir a senha.");
              return;
            }
            try {
              await sendPasswordResetEmail(auth, targetEmail);
              alert("E-mail de redefinição de senha enviado.");
            } catch (err) {
              console.error(err);
              alert("Não foi possível enviar o e-mail de redefinição de senha.");
              return;
            } finally {
              setPasswordModalUser(null);
            }
          }}
          onClose={() => setPasswordModalUser(null)}
        />
      )}
    </div>
  );
};

export default App;

import { useCallback, useEffect, useState } from "react";
import type { Cooperado, SuggestedVisit, User, Visit } from "./types";

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

  // Mantém o prop do DeveloperDashboard, mas sem IA por enquanto
  const hasAIKey = false;

  const fetchData = useCallback(async (user: User) => {
    setLoading(true);
    try {
      const isDev = user.role === "Desenvolvedor" || user.role === "Admin";

      const usersSnap = await getDocs(collection(db, "users"));
      const cooperadosSnap = await getDocs(collection(db, "cooperados"));

      const visitsQ = isDev
        ? query(collection(db, "visits"))
        : query(collection(db, "visits"), where("manager.id", "==", user.id));

      const suggQ = isDev
        ? query(collection(db, "suggestedVisits"))
        : query(
            collection(db, "suggestedVisits"),
            where("manager.id", "==", user.id)
          );

      const [visitsSnap, suggSnap] = await Promise.all([
        getDocs(visitsQ),
        getDocs(suggQ),
      ]);

      setUsers(
        usersSnap.docs.map((d) => ({ ...(d.data() as any), id: d.id } as User))
      );

      setCooperados(
        cooperadosSnap.docs.map(
          (d) => ({ ...(d.data() as any), id: d.id } as Cooperado
        ))
      );

      setVisits(
        visitsSnap.docs
          .map((d) => {
            const data = d.data() as any;
            return {
              ...data,
              id: d.id,
              date: toDate(data.date),
            } as Visit;
          })
          .sort((a, b) => b.date.getTime() - a.date.getTime())
      );

      setSuggestedVisits(
        suggSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...data,
            id: d.id,
            suggestedAt: toDate(data.suggestedAt),
          } as SuggestedVisit;
        })
      );
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
          onLogout={() => signOut(auth)}
          hasAIKey={hasAIKey}
          onAddUser={async (u) => {
            // cria usuário no Auth sem derrubar sessão atual
            const secApp = initializeApp(firebaseConfig, `Sec_${Date.now()}`);
            const secAuth = getAuth(secApp);

            const cred = await createUserWithEmailAndPassword(
              secAuth,
              u.email,
              u.password || "123456"
            );

            await setDoc(doc(db, "users", cred.user.uid), {
              ...u,
              password: u.password || "123456",
            });

            setUsers((p) => [...p, { ...u, id: cred.user.uid }]);

            await deleteApp(secApp);
          }}
          onDeleteUser={async (id) => {
            if (!confirm("Remover este usuário?")) return;
            await deleteDoc(doc(db, "users", id));
            setUsers((p) => p.filter((u) => u.id !== id));
          }}
          onAddCooperado={async (c) => {
            const r = await addDoc(collection(db, "cooperados"), c);
            setCooperados((p) => [...p, { ...c, id: r.id }]);
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
            await updateDoc(doc(db, "cooperados", id), c);
            setCooperados((p) =>
              p.map((x) => (x.id === id ? { ...x, ...c } : x))
            );
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
          cooperados={cooperados}
          suggestedVisits={suggestedVisits}
          onLogout={() => signOut(auth)}
          addVisit={handleAddVisit}
        />
      )}

      {passwordModalUser && (
  <PasswordFormModal
    user={passwordModalUser}
    onSave={async (userId: string, newPass: string) => {
      // atualiza só a senha (como o modal promete)
      await updateDoc(doc(db, "users", userId), { password: newPass });

      // atualiza também no state (para refletir na UI)
      setUsers((p) =>
        p.map((x) => (x.id === userId ? { ...x, password: newPass } : x))
      );

      // se o usuário aberto no modal é o mesmo, atualiza ele também
      setPasswordModalUser((prev) =>
        prev && prev.id === userId ? { ...prev, password: newPass } : prev
      );

      setPasswordModalUser(null);
    }}
    onClose={() => setPasswordModalUser(null)}
  />
  )}
    </div>
  );
};

export default App;

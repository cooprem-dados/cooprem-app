import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cooperado, SuggestedVisit, User, Visit } from "./types";

import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import DeveloperDashboard from "./components/DeveloperDashboard";
import PasswordFormModal from "./components/PasswordFormModal";
import Logo from "./components/Logo";

import { auth, db } from "./firebase/firebaseConfig";

import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { Timestamp, addDoc, collection, deleteDoc, doc } from "firebase/firestore";

import { useAuthUser } from "./hooks/useAuthUser";
import { fetchInitialData } from "./services/data";
import { createVisitWithSerial } from "./services/visits";
import { createUser, disableUser, enableUser, updateUser } from "./services/users";
import {
  addCooperado,
  deleteCooperado,
  searchCooperados as searchCooperadosService,
  updateCooperado,
} from "./services/cooperados";
import { toDate } from "./utils/firestore";

const App = () => {
  const { currentUser, loadingAuth } = useAuthUser();
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [suggestedVisits, setSuggestedVisits] = useState<SuggestedVisit[]>([]);

  type ViewMode = "admin" | "manager";

  const isDevAdmin =
    currentUser?.role === "Admin" || currentUser?.role === "Desenvolvedor";

  const [viewMode, setViewMode] = useState<ViewMode>("admin");

  const [impersonateUserId, setImpersonateUserId] = useState<string>("");

  // Busca cooperados via service (Firestore). Mantém a mesma assinatura usada pelos dashboards.
  const searchCooperados = useCallback(
    async (pa: string, term: string): Promise<Cooperado[]> => {
      return searchCooperadosService(pa, term);
    },
    []
  );

  // remover as sugestões
  const handleRemoveSuggestion = async (id: string) => {
    await deleteDoc(doc(db, "suggestedVisits", id));
    setSuggestedVisits((p) => p.filter((x) => x.id !== id));
  };

  const onResetUserPassword = async (email: string) => {
    if (!confirm(`Enviar e-mail de redefinição de senha para ${email}?`)) return;

    try {
      await sendPasswordResetEmail(auth, email);
      alert("E-mail de redefinição enviado.");
    } catch (err: any) {
      console.error(err);
      alert("Não foi possível enviar o e-mail de redefinição.");
    }
  };


  // Mantém o prop do DeveloperDashboard, mas sem IA por enquanto
  const hasAIKey = false;

  const fetchData = useCallback(async (user: User) => {
    setLoading(true);
    try {
      const { visits, suggestedVisits, users } = await fetchInitialData(user);
      setVisits(visits);
      setSuggestedVisits(suggestedVisits);
      setUsers(users);
      // cooperados agora só via busca remota (searchCooperados)
      setCooperados([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // quando o auth termina e não há usuário, libera a tela de login
    if (!loadingAuth && !currentUser) {
      setLoading(false);
    }
  }, [loadingAuth, currentUser]);

  useEffect(() => {
    if (!loadingAuth && currentUser) {
      fetchData(currentUser);
    }
  }, [loadingAuth, currentUser, fetchData]);

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

    const newVisit = await createVisitWithSerial(currentUser, v);
    setVisits((prev) => [newVisit, ...prev]);
  };

  const isDev =
    !!currentUser &&
    (currentUser.role === "Desenvolvedor" || currentUser.role === "Admin");

  // usuário efetivo a ser usado no Dashboard quando estiver em modo gerente
  const impersonatedUser = useMemo(() => {
    if (!isDev || viewMode !== "manager") return null;
    return users.find((u) => u.id === impersonateUserId) || null;
  }, [isDev, viewMode, impersonateUserId, users]);

  // aqui ainda pode ser null (enquanto currentUser for null)
  const managerViewUser = impersonatedUser ?? currentUser;

  const managerVisits =
  isDev && viewMode === "manager"
    ? visits.filter((v) => (v?.manager?.id || "") === (managerViewUser?.id || ""))
    : visits;

const managerSuggestedVisits =
  isDev && viewMode === "manager"
    ? suggestedVisits.filter((s) => (s?.manager?.id || "") === (managerViewUser?.id || ""))
    : suggestedVisits;


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

  return (
    <div className="min-h-screen bg-gray-100 selection:bg-[#005058] selection:text-white">
      {isDev && (
        <div className="p-3 flex items-center justify-end gap-3">
          <button
            onClick={() => setViewMode((m) => (m === "admin" ? "manager" : "admin"))}
            className="px-3 py-2 rounded-lg text-sm font-bold bg-gray-800 text-gray-200 hover:bg-gray-700"
          >
            {viewMode === "admin" ? "Ver como gerente" : "Ver como admin"}
          </button>

          {viewMode === "manager" && (
            <select
              value={impersonateUserId}
              onChange={(e) => setImpersonateUserId(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200"
              title="Escolher usuário para simular"
            >
              <option value="">(Eu mesmo)</option>
              {users
                .filter((u) => (u.role || "").toLowerCase().includes("gerente") || (u.role || "").toLowerCase().includes("assistente"))
                .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.role ? `(${u.role})` : ""}
                  </option>
                ))}
            </select>
          )}
        </div>
      )}
      {isDev ? (
        viewMode === "admin" ? (
          <DeveloperDashboard
            users={users}
            cooperados={cooperados}
            visits={visits}
            suggestedVisits={suggestedVisits}
            onResetUserPassword={onResetUserPassword}
            searchCooperados={searchCooperados}
            onLogout={() => signOut(auth)}
            hasAIKey={hasAIKey}
            onAddUser={async (u) => {
              try {
                const created = await createUser(u as any);
                setUsers((p) => [...p, created]);
              } catch (err: any) {
                if (err?.code === "auth/email-already-in-use") {
                  alert("Já existe um usuário cadastrado com este e-mail.");
                  return;
                }
                alert("Erro ao criar usuário.");
                console.error(err);
              }
            }}
            onDeleteUser={async (id) => {
              if (!confirm("Desativar este usuário? Ele não conseguirá acessar o sistema.")) return;

              await disableUser(id);

              setUsers((p) => p.map((u) => (u.id === id ? { ...u, disabled: true } : u)));
            }}
            onEnableUser={async (id) => {
              if (!confirm("Reativar este usuário?")) return;

              await enableUser(id);

              setUsers((p) => p.map((u) => (u.id === id ? { ...u, disabled: false } : u)));
            }}
            onAddCooperado={async (c) => {
              const created = await addCooperado(c);
              setCooperados((p) => [...p, created]);
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
              await updateUser(id, d);
              setUsers((p) => p.map((u) => (u.id === id ? { ...u, ...d } : u)));
            }}
            onUpdateCooperado={async (id, c) => {
              const updated = await updateCooperado(id, c);
              setCooperados((p) => p.map((x) => (x.id === id ? updated : x)));
            }}
            onDeleteCooperado={async (id) => {
              if (!confirm("Excluir cooperado?")) return;
              await deleteCooperado(id);
              setCooperados((p) => p.filter((x) => x.id !== id));
            }}
          />
        ) : (
          <Dashboard
            user={(managerViewUser)!}
            visits={managerVisits}
            searchCooperados={searchCooperados}
            cooperados={cooperados}
            suggestedVisits={managerSuggestedVisits}
            onLogout={() => signOut(auth)}
            addVisit={handleAddVisit}
            onRemoveSuggestion={handleRemoveSuggestion}
          />
        )
      ) : (
        <Dashboard
          user={currentUser}
          visits={visits}
          searchCooperados={searchCooperados}
          cooperados={cooperados}
          suggestedVisits={suggestedVisits}
          onLogout={() => signOut(auth)}
          addVisit={handleAddVisit}
          onRemoveSuggestion={handleRemoveSuggestion}
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

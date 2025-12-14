import React, { useState, useCallback, useEffect } from 'react';
import { User, Visit, Cooperado, SuggestedVisit } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import DeveloperDashboard from './components/DeveloperDashboard';
import PasswordFormModal from './components/PasswordFormModal';
import { auth, db, firebaseConfig } from './firebaseConfig';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc, setDoc } from 'firebase/firestore';
import { initializeApp, deleteApp, getApps, getApp } from 'firebase/app';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [suggestedVisits, setSuggestedVisits] = useState<SuggestedVisit[]>([]);
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);

  const fetchData = useCallback(async (user: User) => {
    setLoading(true);
    try {
      if (user.role === 'Desenvolvedor') {
        const [uSnap, cSnap, vSnap, svSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'cooperados')),
          getDocs(collection(db, 'visits')),
          getDocs(collection(db, 'suggestedVisits'))
        ]);
        setUsers(uSnap.docs.map(d => ({ ...d.data(), id: d.id } as User)));
        setCooperados(cSnap.docs.map(d => ({ ...d.data(), id: d.id } as Cooperado)));
        setVisits(vSnap.docs.map(d => { const dt = d.data(); return { ...dt, id: d.id, date: (dt.date as any).toDate() } as Visit; }));
        setSuggestedVisits(svSnap.docs.map(d => { const dt = d.data(); return { ...dt, id: d.id, suggestedAt: (dt.suggestedAt as any).toDate() } as SuggestedVisit; }));
      } else {
        const [cSnap, vSnap, svSnap, uSnap] = await Promise.all([
          getDocs(query(collection(db, 'cooperados'))),
          getDocs(query(collection(db, 'visits'), where('manager.id', '==', user.id))),
          getDocs(query(collection(db, 'suggestedVisits'), where('manager.id', '==', user.id))),
          getDocs(collection(db, 'users'))
        ]);
        setUsers(uSnap.docs.map(d => ({ ...d.data(), id: d.id } as User)));
        setCooperados(cSnap.docs.map(d => ({ ...d.data(), id: d.id } as Cooperado)));
        setVisits(vSnap.docs.map(d => { const dt = d.data(); return { ...dt, id: d.id, date: (dt.date as any).toDate() } as Visit; }));
        setSuggestedVisits(svSnap.docs.map(d => { const dt = d.data(); return { ...dt, id: d.id, suggestedAt: (dt.suggestedAt as any).toDate() } as SuggestedVisit; }));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          const userData = { ...snap.data(), id: u.uid } as User;
          setCurrentUser(userData);
          await fetchData(userData);
        } else { await signOut(auth); }
      } else { setCurrentUser(null); setLoading(false); }
    });
  }, [fetchData]);

  const handleLogin = async (e: string, p: string) => { try { await signInWithEmailAndPassword(auth, e, p); return true; } catch { return false; } };
  const handleLogout = () => signOut(auth);

  const addVisit = async (v: Omit<Visit, 'id' | 'manager'>) => {
    if (!currentUser) return;
    const visitData = { ...v, manager: { id: currentUser.id, name: currentUser.name, agency: currentUser.agency } };
    const ref = await addDoc(collection(db, 'visits'), visitData);
    setVisits(p => [...p, { ...visitData, id: ref.id }]);
    
    // Remove sugestão se existir
    const coopDoc = 'document' in v.cooperado ? v.cooperado.document : '';
    const sugg = suggestedVisits.find(sv => sv.cooperado.document === coopDoc && sv.manager.id === currentUser.id);
    if(sugg) await deleteDoc(doc(db, 'suggestedVisits', sugg.id));
  };

  const addUser = async (u: User) => {
    let secApp;
    try {
      secApp = getApps().length > 1 ? getApps()[1] : initializeApp(firebaseConfig, "Secondary");
      const secAuth = getAuth(secApp);
      const cred = await createUserWithEmailAndPassword(secAuth, u.email, u.password);
      await setDoc(doc(db, 'users', cred.user.uid), { ...u, password: u.password });
      setUsers(p => [...p, { ...u, id: cred.user.uid }]);
      await signOut(secAuth);
      await deleteApp(secApp);
    } catch (e: any) { alert("Erro ao criar usuário: " + e.message); if(secApp) deleteApp(secApp); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#005058] text-white">Carregando...</div>;
  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  return (
    <>
      {currentUser.role === 'Desenvolvedor' ? (
        <DeveloperDashboard 
          users={users} cooperados={cooperados} visits={visits} suggestedVisits={suggestedVisits}
          onLogout={handleLogout}
          onAddSuggestion={async (s) => { const r = await addDoc(collection(db, 'suggestedVisits'), { ...s, suggestedAt: new Date() }); setSuggestedVisits(p => [...p, { ...s, id: r.id, suggestedAt: new Date() }]); }}
          onRemoveSuggestion={async (id) => { await deleteDoc(doc(db, 'suggestedVisits', id)); setSuggestedVisits(p => p.filter(x => x.id !== id)); }}
          onAddUser={addUser}
          onUpdateUser={async (id, d) => { await updateDoc(doc(db, 'users', id), d); setUsers(p => p.map(u => u.id === id ? { ...u, ...d } : u)); }}
          onDeleteUser={async (id) => { await deleteDoc(doc(db, 'users', id)); setUsers(p => p.filter(u => u.id !== id)); }}
          onAddCooperado={async (c) => { const r = await addDoc(collection(db, 'cooperados'), c); setCooperados(p => [...p, { ...c, id: r.id }]); }}
          onUpdateCooperado={async (id, c) => { await updateDoc(doc(db, 'cooperados', id), c); setCooperados(p => p.map(x => x.id === id ? { ...x, ...c } : x)); }}
          onDeleteCooperado={async (id) => { await deleteDoc(doc(db, 'cooperados', id)); setCooperados(p => p.filter(x => x.id !== id)); }}
          onOpenChangePassword={setPasswordModalUser}
        />
      ) : (
        <Dashboard user={currentUser} visits={visits} cooperados={cooperados} suggestedVisits={suggestedVisits} onLogout={handleLogout} addVisit={addVisit} />
      )}
      {passwordModalUser && <PasswordFormModal user={passwordModalUser} onSave={() => { alert("Use o console do Firebase."); setPasswordModalUser(null); }} onClose={() => setPasswordModalUser(null)} />}
    </>
  );
};

export default App;
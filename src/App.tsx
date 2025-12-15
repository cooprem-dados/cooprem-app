import React, { useState, useCallback, useEffect } from 'react';
import { User, Visit, Cooperado, SuggestedVisit } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import DeveloperDashboard from './components/DeveloperDashboard';
import PasswordFormModal from './components/PasswordFormModal';
import { auth, db, firebaseConfig } from './firebaseConfig';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

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
          db.collection('users').get(),
          db.collection('cooperados').get(),
          db.collection('visits').get(),
          db.collection('suggestedVisits').get()
        ]);
        setUsers(uSnap.docs.map(d => ({ ...d.data(), id: d.id } as User)));
        setCooperados(cSnap.docs.map(d => ({ ...d.data(), id: d.id } as Cooperado)));
        setVisits(vSnap.docs.map(d => { const dt = d.data(); return { ...dt, id: d.id, date: (dt.date as any).toDate() } as Visit; }));
        setSuggestedVisits(svSnap.docs.map(d => { const dt = d.data(); return { ...dt, id: d.id, suggestedAt: (dt.suggestedAt as any).toDate() } as SuggestedVisit; }));
      } else {
        const [cSnap, vSnap, svSnap, uSnap] = await Promise.all([
          db.collection('cooperados').get(),
          db.collection('visits').where('manager.id', '==', user.id).get(),
          db.collection('suggestedVisits').where('manager.id', '==', user.id).get(),
          db.collection('users').get()
        ]);
        setUsers(uSnap.docs.map(d => ({ ...d.data(), id: d.id } as User)));
        setCooperados(cSnap.docs.map(d => ({ ...d.data(), id: d.id } as Cooperado)));
        setVisits(vSnap.docs.map(d => { const dt = d.data(); return { ...dt, id: d.id, date: (dt.date as any).toDate() } as Visit; }));
        setSuggestedVisits(svSnap.docs.map(d => { const dt = d.data(); return { ...dt, id: d.id, suggestedAt: (dt.suggestedAt as any).toDate() } as SuggestedVisit; }));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (u) {
        const snap = await db.collection('users').doc(u.uid).get();
        if (snap.exists) {
          const userData = { ...snap.data(), id: u.uid } as User;
          setCurrentUser(userData);
          await fetchData(userData);
        } else { await auth.signOut(); }
      } else { setCurrentUser(null); setLoading(false); }
    });
  }, [fetchData]);

  const handleLogin = async (e: string, p: string) => { try { await auth.signInWithEmailAndPassword(e, p); return true; } catch { return false; } };
  const handleLogout = () => auth.signOut();

  const addVisit = async (v: Omit<Visit, 'id' | 'manager'>) => {
    if (!currentUser) return;
    const visitData = { ...v, manager: { id: currentUser.id, name: currentUser.name, agency: currentUser.agency } };
    const ref = await db.collection('visits').add(visitData);
    setVisits(p => [...p, { ...visitData, id: ref.id }]);
    
    // Remove sugestão se existir
    const coopDoc = 'document' in v.cooperado ? v.cooperado.document : '';
    const sugg = suggestedVisits.find(sv => sv.cooperado.document === coopDoc && sv.manager.id === currentUser.id);
    if(sugg) await db.collection('suggestedVisits').doc(sugg.id).delete();
  };

  const addUser = async (u: User) => {
    let secApp;
    try {
      // Create a secondary app to create user without logging out current user
      const appName = "Secondary";
      const existingApp = firebase.apps.find(a => a.name === appName);
      secApp = existingApp || firebase.initializeApp(firebaseConfig, appName);
      const secAuth = secApp.auth();
      const cred = await secAuth.createUserWithEmailAndPassword(u.email, u.password);
      if (cred.user) {
        await db.collection('users').doc(cred.user.uid).set({ ...u, password: u.password });
        setUsers(p => [...p, { ...u, id: cred.user!.uid }]);
      }
      await secAuth.signOut();
      await secApp.delete();
    } catch (e: any) { alert("Erro ao criar usuário: " + e.message); if(secApp) secApp.delete(); }
  };

  // Uso style inline para garantir visibilidade mesmo se o Tailwind falhar
  if (loading) return (
    <div 
      className="h-screen flex items-center justify-center bg-[#005058] text-white"
      style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#005058', color: 'white' }}
    >
      Carregando...
    </div>
  );

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  return (
    <>
      {currentUser.role === 'Desenvolvedor' ? (
        <DeveloperDashboard 
          users={users} cooperados={cooperados} visits={visits} suggestedVisits={suggestedVisits}
          onLogout={handleLogout}
          onAddSuggestion={async (s) => { const r = await db.collection('suggestedVisits').add({ ...s, suggestedAt: new Date() }); setSuggestedVisits(p => [...p, { ...s, id: r.id, suggestedAt: new Date() }]); }}
          onRemoveSuggestion={async (id) => { await db.collection('suggestedVisits').doc(id).delete(); setSuggestedVisits(p => p.filter(x => x.id !== id)); }}
          onAddUser={addUser}
          onUpdateUser={async (id, d) => { await db.collection('users').doc(id).update(d); setUsers(p => p.map(u => u.id === id ? { ...u, ...d } : u)); }}
          onDeleteUser={async (id) => { await db.collection('users').doc(id).delete(); setUsers(p => p.filter(u => u.id !== id)); }}
          onAddCooperado={async (c) => { const r = await db.collection('cooperados').add(c); setCooperados(p => [...p, { ...c, id: r.id }]); }}
          onUpdateCooperado={async (id, c) => { await db.collection('cooperados').doc(id).update(c); setCooperados(p => p.map(x => x.id === id ? { ...x, ...c } : x)); }}
          onDeleteCooperado={async (id) => { await db.collection('cooperados').doc(id).delete(); setCooperados(p => p.filter(x => x.id !== id)); }}
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
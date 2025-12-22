
import React, { useState, useCallback, useEffect } from 'react';
import { User, Visit, Cooperado, SuggestedVisit } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import DeveloperDashboard from './components/DeveloperDashboard';
import PasswordFormModal from './components/PasswordFormModal';
import Logo from './components/Logo';
import { auth, db, firebaseConfig } from './firebaseConfig';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { GoogleGenAI, Type } from "@google/genai";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [suggestedVisits, setSuggestedVisits] = useState<SuggestedVisit[]>([]);
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);

  const hasAIKey = !!process.env.API_KEY;

  const fetchData = useCallback(async (user: User) => {
    setLoading(true);
    try {
      const isDev = user.role === 'Desenvolvedor' || user.role === 'Admin';
      const [uSnap, cSnap, vSnap, svSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('cooperados').get(),
        isDev ? db.collection('visits').get() : db.collection('visits').where('manager.id', '==', user.id).get(),
        isDev ? db.collection('suggestedVisits').get() : db.collection('suggestedVisits').where('manager.id', '==', user.id).get()
      ]);

      setUsers(uSnap.docs.map(d => ({ ...d.data(), id: d.id } as User)));
      setCooperados(cSnap.docs.map(d => ({ ...d.data(), id: d.id } as Cooperado)));
      
      setVisits(vSnap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          date: data.date?.toDate ? data.date.toDate() : new Date(data.date)
        } as Visit;
      }));

      setSuggestedVisits(svSnap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          suggestedAt: data.suggestedAt?.toDate ? data.suggestedAt.toDate() : new Date(data.suggestedAt)
        } as SuggestedVisit;
      }));
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        const snap = await db.collection('users').doc(u.uid).get();
        if (snap.exists) {
          const userData = { ...snap.data(), id: u.uid } as User;
          setCurrentUser(userData);
          await fetchData(userData);
        } else {
          await auth.signOut();
        }
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [fetchData]);

  const handleLogin = async (email: string, pass: string) => {
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      return true;
    } catch {
      return false;
    }
  };

  const handleAddVisit = async (v: Omit<Visit, 'id' | 'manager'>) => {
    if (!currentUser) return;
    const visitData = { 
      ...v, 
      manager: { id: currentUser.id, name: currentUser.name, agency: currentUser.agency },
      date: firebase.firestore.Timestamp.fromDate(v.date)
    };
    const ref = await db.collection('visits').add(visitData);
    setVisits(prev => [...prev, { ...v, id: ref.id, manager: visitData.manager }]);

    const coopDoc = (v.cooperado as Cooperado).document;
    const sugg = suggestedVisits.find(sv => sv.cooperado.document === coopDoc && sv.manager.id === currentUser.id);
    if (sugg) {
      await db.collection('suggestedVisits').doc(sugg.id).delete();
      setSuggestedVisits(prev => prev.filter(s => s.id !== sugg.id));
    }
  };

  const handleGenerateAISuggestions = async () => {
    if (!hasAIKey) {
      alert("IA não configurada: A chave de API (API_KEY) não foi encontrada nas variáveis de ambiente.");
      return;
    }
    if (!currentUser) return;

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Analise estes cooperados e sugira 3 visitas estratégicas: ${JSON.stringify(cooperados.slice(0, 15).map(c => ({n: c.name, d: c.document})))}. Retorne APENAS o JSON no formato: [{"document": "...", "reason": "..."}]`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { document: { type: Type.STRING }, reason: { type: Type.STRING } },
              required: ["document", "reason"]
            }
          }
        }
      });

      const suggestions = JSON.parse(response.text || '[]');
      for (const item of suggestions) {
        const coop = cooperados.find(c => c.document === item.document);
        if (coop) {
          const suggData = {
            cooperado: coop,
            manager: { id: currentUser.id, name: currentUser.name, agency: currentUser.agency },
            suggestedAt: firebase.firestore.Timestamp.now(),
            suggestedBy: 'IA Gemini',
            reason: item.reason
          };
          const ref = await db.collection('suggestedVisits').add(suggData);
          setSuggestedVisits(prev => [...prev, { 
            ...suggData, 
            id: ref.id, 
            suggestedAt: suggData.suggestedAt.toDate() 
          } as SuggestedVisit]);
        }
      }
      alert("Sugestões geradas com sucesso!");
    } catch (e) {
      console.error("Erro IA:", e);
      alert("Falha ao gerar sugestões. Verifique sua chave API.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#005058] text-white">
      <Logo style={{ height: '60px', marginBottom: '20px', filter: 'brightness(1.5)' }} />
      <p className="font-bold animate-pulse">Sicoob Cooprem - Sincronizando...</p>
    </div>
  );

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  const isDev = currentUser.role === 'Desenvolvedor' || currentUser.role === 'Admin';

  return (
    <div className="min-h-screen bg-gray-100">
      {isDev ? (
        <DeveloperDashboard 
          users={users} 
          cooperados={cooperados} 
          visits={visits} 
          suggestedVisits={suggestedVisits}
          onLogout={() => auth.signOut()}
          hasAIKey={hasAIKey}
          onAddUser={async (u) => {
            const secApp = firebase.initializeApp(firebaseConfig, `Sec_${Date.now()}`);
            const cred = await secApp.auth().createUserWithEmailAndPassword(u.email, u.password || '123456');
            await db.collection('users').doc(cred.user!.uid).set({ ...u, password: u.password || '123456' });
            setUsers(p => [...p, { ...u, id: cred.user!.uid }]);
            await secApp.delete();
          }}
          onDeleteUser={async (id) => { if(confirm("Remover acesso?")) { await db.collection('users').doc(id).delete(); setUsers(p => p.filter(u => u.id !== id)); } }}
          onAddCooperado={async (c) => { const r = await db.collection('cooperados').add(c); setCooperados(p => [...p, { ...c, id: r.id }]); }}
          onGenerateAISuggestions={handleGenerateAISuggestions}
          onOpenChangePassword={setPasswordModalUser}
          onAddSuggestion={async (s) => { const r = await db.collection('suggestedVisits').add(s); setSuggestedVisits(p => [...p, { ...s, id: r.id }]); }}
          onRemoveSuggestion={async (id) => { await db.collection('suggestedVisits').doc(id).delete(); setSuggestedVisits(p => p.filter(x => x.id !== id)); }}
          onUpdateUser={async (id, d) => { await db.collection('users').doc(id).update(d); setUsers(p => p.map(u => u.id === id ? { ...u, ...d } : u)); }}
          onUpdateCooperado={async (id, c) => { await db.collection('cooperados').doc(id).update(c); setCooperados(p => p.map(x => x.id === id ? { ...x, ...c } : x)); }}
          onDeleteCooperado={async (id) => { if(confirm("Excluir cooperado?")) { await db.collection('cooperados').doc(id).delete(); setCooperados(p => p.filter(x => x.id !== id)); } }}
        />
      ) : (
        <Dashboard 
          user={currentUser} 
          visits={visits} 
          cooperados={cooperados} 
          suggestedVisits={suggestedVisits} 
          onLogout={() => auth.signOut()} 
          addVisit={handleAddVisit} 
        />
      )}
      {passwordModalUser && <PasswordFormModal user={passwordModalUser} onSave={() => setPasswordModalUser(null)} onClose={() => setPasswordModalUser(null)} />}
    </div>
  );
};

export default App;

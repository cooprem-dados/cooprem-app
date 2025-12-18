
import React, { useState } from 'react';
import { User, Cooperado, Visit, SuggestedVisit } from '../types';
import Logo from './Logo';
import VisitsMap from './VisitsMap';
import UserFormModal from './UserFormModal';
import CooperadoFormModal from './CooperadoFormModal';

interface DeveloperDashboardProps {
  users: User[];
  cooperados: Cooperado[];
  visits: Visit[];
  suggestedVisits: SuggestedVisit[];
  onLogout: () => void;
  onAddUser: (u: User) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onAddCooperado: (c: any) => Promise<void>;
  onGenerateAISuggestions: () => Promise<void>;
  onOpenChangePassword: (u: User) => void;
  onAddSuggestion: (s: any) => Promise<void>;
  onRemoveSuggestion: (id: string) => Promise<void>;
  onUpdateUser: (id: string, d: any) => Promise<void>;
  onUpdateCooperado: (id: string, c: any) => Promise<void>;
  onDeleteCooperado: (id: string) => Promise<void>;
}

const DeveloperDashboard: React.FC<DeveloperDashboardProps> = (props) => {
  const [tab, setTab] = useState<'map' | 'users' | 'cooperados'>('map');
  const [modalUser, setModalUser] = useState<User | null>(null);
  const [isUserModal, setIsUserModal] = useState(false);
  const [modalCoop, setModalCoop] = useState<Cooperado | null>(null);
  const [isCoopModal, setIsCoopModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#111827] text-white font-sans">
      <header className="bg-[#1f2937] border-b border-gray-700 h-16 flex items-center px-6 justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Logo style={{ filter: 'brightness(1.5)', height: '32px' }} />
          <h1 className="font-bold text-lg hidden sm:block">Console Sicoob Dev</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={props.onGenerateAISuggestions} className="bg-purple-600 hover:bg-purple-700 text-xs px-4 py-2 rounded-lg font-bold transition-all shadow-lg shadow-purple-900/20">🪄 Analisar com IA</button>
          <button onClick={props.onLogout} className="bg-red-600 hover:bg-red-700 text-xs px-4 py-2 rounded-lg font-bold">Sair</button>
        </div>
      </header>

      <nav className="flex bg-[#1f2937] border-b border-gray-700 sticky top-16 z-40">
        <button onClick={() => setTab('map')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'map' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>🗺️ Mapa Global</button>
        <button onClick={() => setTab('users')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'users' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>👥 Gestão de Acessos</button>
        <button onClick={() => setTab('cooperados')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'cooperados' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>🏢 Base de Dados</button>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        {tab === 'map' && (
          <div className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden shadow-2xl h-[70vh]">
            <VisitsMap visits={props.visits} />
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-[#1f2937] rounded-2xl border border-gray-700 p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Gerentes e Admins</h2>
              <button onClick={() => { setModalUser(null); setIsUserModal(true); }} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-xl font-bold text-sm">+ Novo Usuário</button>
            </div>
            <table className="w-full text-left">
              <thead className="text-gray-400 text-xs uppercase tracking-widest border-b border-gray-700">
                <tr><th className="py-4">Nome</th><th className="py-4">Email</th><th className="py-4">Agência</th><th className="py-4 text-right">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {props.users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="py-4 font-bold">{u.name}</td>
                    <td className="py-4 text-gray-400 text-sm">{u.email}</td>
                    <td className="py-4 text-sm">{u.agency}</td>
                    <td className="py-4 text-right space-x-4">
                      <button onClick={() => { setModalUser(u); setIsUserModal(true); }} className="text-blue-400 hover:text-blue-300 font-bold text-xs">EDITAR</button>
                      <button onClick={() => props.onDeleteUser(u.id)} className="text-red-500 hover:text-red-400 font-bold text-xs">EXCLUIR</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'cooperados' && (
          <div className="bg-[#1f2937] rounded-2xl border border-gray-700 p-8">
             <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Base Cooperados</h2>
              <button onClick={() => { setModalCoop(null); setIsCoopModal(true); }} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-xl font-bold text-sm">+ Novo Cooperado</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {props.cooperados.map(c => (
                <div key={c.id} className="p-5 bg-gray-800 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all cursor-pointer group" onClick={() => { setModalCoop(c); setIsCoopModal(true); }}>
                  <p className="font-bold text-lg group-hover:text-blue-400 transition-colors">{c.name}</p>
                  <p className="text-xs font-mono text-gray-500 mt-1 uppercase">{c.document}</p>
                  <p className="text-xs text-gray-400 mt-4 border-t border-gray-700 pt-3">Resp: <span className="text-gray-200">{c.managerName || 'Livre'}</span></p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {isUserModal && <UserFormModal user={modalUser} onSave={(u) => { modalUser ? props.onUpdateUser(modalUser.id, u) : props.onAddUser(u); setIsUserModal(false); }} onClose={() => setIsUserModal(false)} />}
      {isCoopModal && <CooperadoFormModal cooperado={modalCoop} managers={props.users} onSave={(c) => { modalCoop ? props.onUpdateCooperado(modalCoop.id, c) : props.onAddCooperado(c); setIsCoopModal(false); }} onClose={() => setIsCoopModal(false)} />}
    </div>
  );
};

export default DeveloperDashboard;

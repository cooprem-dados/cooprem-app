
import React, { useState, useMemo } from 'react';
import { User, Visit, Cooperado, SuggestedVisit } from '../types';
import Logo from './Logo';
import VisitForm from './VisitForm';
import VisitListItem from './VisitListItem';

interface DashboardProps {
  user: User;
  visits: Visit[];
  cooperados: Cooperado[];
  suggestedVisits: SuggestedVisit[];
  onLogout: () => void;
  addVisit: (v: Omit<Visit, 'id' | 'manager'>) => Promise<void>;

  // NOVO:
  searchCooperados: (pa: string, term: string) => Promise<Cooperado[]>;
}

const Dashboard: React.FC<DashboardProps> = ({ user, visits, cooperados, suggestedVisits, searchCooperados, onLogout, addVisit }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCoop, setSelectedCoop] = useState<Cooperado | null>(null);
  const roleKey = (user.role || "").toLowerCase().trim();
  const isDev = roleKey === "desenvolvedor" || roleKey === "admin";

  const sortedVisits = useMemo(() => {
    return [...visits].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [visits]);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-[#005058] text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Logo style={{ filter: 'brightness(2)' }} />
            <div>
              <p className="font-bold text-sm leading-tight">{user.name}</p>
              <p className="text-xs opacity-80">{user.agency}</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-xs bg-red-600 px-3 py-1 rounded hover:bg-red-700 font-bold">Sair</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Minhas Visitas</h2>
          <button
            onClick={() => { setSelectedCoop(null); setIsFormOpen(true); }}
            className="bg-[#005058] text-white px-6 py-2 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
          >
            + Nova Visita
          </button>
        </div>

        {suggestedVisits.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg mb-8 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💡</span>
              <h3 className="font-bold text-yellow-800">Sugestões de Visitas</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suggestedVisits.map(s => (
                <div key={s.id} className="bg-white p-4 rounded-lg shadow-sm border border-yellow-100 flex justify-between items-center">
                  <div className="flex-1 mr-4">
                    <p className="font-bold text-gray-800">{((s.cooperado as any)?.name ?? (s.cooperado as any)?.nome ?? '—')}</p>
                    <p className="text-[11px] text-gray-500">{((s.cooperado as any)?.document ?? (s.cooperado as any)?.documento ?? '')}</p>
                    <p className="text-xs text-gray-600 line-clamp-1">{s.reason}</p>
                  </div>
                  <button
                    onClick={() => {
                      const coop: any = s.cooperado;

                      // Se for cooperado da base, tem id
                      if (coop && typeof coop === 'object' && 'id' in coop) {
                        setSelectedCoop(coop as Cooperado);
                      } else {
                        setSelectedCoop(null); // manual -> abre sem cooperado da base
                        // opcional: se você tiver um estado pra prospecção, pode ligar aqui
                        // setOpenProspeccao(true);
                      }

                      setIsFormOpen(true);
                    }}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold"
                  >
                    Atender
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
          {sortedVisits.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Nenhuma visita registrada recentemente.</div>
          ) : (
            <div className="divide-y">
              {sortedVisits.map(v => (
                <VisitListItem key={v.id} visit={v} />
              ))}
            </div>
          )}
        </div>
      </main>

      {isFormOpen && (
        <VisitForm
          cooperados={cooperados}          // pode manter ou colocar []
          currentPA={isDev ? "*" : user.agency}         // ✅ aqui
          searchCooperados={searchCooperados}
          onClose={() => setIsFormOpen(false)}
          addVisit={async (v) => { await addVisit(v); setIsFormOpen(false); }}
          prefilledCooperado={selectedCoop}
        />
      )}
    </div>
  );
};

export default Dashboard;

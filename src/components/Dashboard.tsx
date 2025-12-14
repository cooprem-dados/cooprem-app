import React, { useState, useMemo } from 'react';
import { User, Visit, Cooperado, SuggestedVisit } from '../types';
import VisitListItem from './VisitListItem';
import VisitForm from './VisitForm';
import Logo from './Logo';

interface DashboardProps {
  user: User;
  visits: Visit[];
  cooperados: Cooperado[];
  suggestedVisits: SuggestedVisit[];
  onLogout: () => void;
  addVisit: (visit: Omit<Visit, 'id' | 'manager'>) => Promise<void>;
}

const Dashboard: React.FC<DashboardProps> = ({ user, visits, cooperados, suggestedVisits, onLogout, addVisit }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [prefilledCooperado, setPrefilledCooperado] = useState<Cooperado | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const todayISO = useMemo(() => {
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
    return localDate.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);

  const userVisits = useMemo(() => {
    return visits
      .filter(visit => visit.manager.id === user.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [visits, user.id]);

  const userSuggestedVisits = useMemo(() => {
    return suggestedVisits
      .filter(sv => sv.manager.id === user.id)
      .sort((a, b) => new Date(b.suggestedAt).getTime() - new Date(a.suggestedAt).getTime());
  }, [suggestedVisits, user.id]);

  const filteredVisits = useMemo(() => {
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const dateFiltered = userVisits.filter(visit => {
        const visitDate = new Date(visit.date);
        return visitDate >= start && visitDate <= end;
    });

    if (!searchTerm) {
      return dateFiltered;
    }
    return dateFiltered.filter(visit =>
      visit.cooperado.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.summary.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [userVisits, searchTerm, startDate, endDate]);
  
  const handleAddVisit = async (visit: Omit<Visit, 'id' | 'manager'>) => {
    await addVisit(visit);
    setIsFormOpen(false);
    setPrefilledCooperado(null);
  };

  const openFormWithSuggestion = (cooperado: Cooperado) => {
    setPrefilledCooperado(cooperado);
    setIsFormOpen(true);
  };
  
  const openNewVisitForm = () => {
    setPrefilledCooperado(null);
    setIsFormOpen(true);
  };
  
  const closeForm = () => {
      setIsFormOpen(false);
      setPrefilledCooperado(null);
  }

  const formatDate = (d: Date) => new Intl.DateTimeFormat('pt-BR').format(new Date(d));

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#005058] shadow-md text-white">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <Logo className="h-10 w-auto mr-4" />
            <div>
              <h1 className="text-xl font-semibold">Registro de Visitas</h1>
              <p className="text-sm opacity-90">{user.name} - {user.agency}</p>
            </div>
          </div>
          <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 font-bold py-2 px-4 rounded-md transition duration-200">Sair</button>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Minhas Visitas</h2>
            <button onClick={openNewVisitForm} className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-200 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Registrar Nova Visita
            </button>
          </div>

          {userSuggestedVisits.length > 0 && (
            <div className="mb-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
              <h3 className="text-xl font-bold text-yellow-800 mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Visitas Sugeridas
              </h3>
              <div className="space-y-3">
                {userSuggestedVisits.map(suggestion => (
                  <div key={suggestion.id} className="bg-white p-3 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{suggestion.cooperado.name}</p>
                      <p className="text-xs text-gray-500">Sugerida em: {formatDate(suggestion.suggestedAt)} por {suggestion.suggestedBy}</p>
                      <p className="text-sm text-gray-700 mt-2 italic border-l-2 border-yellow-500 pl-2">{suggestion.reason}</p>
                    </div>
                    <button onClick={() => openFormWithSuggestion(suggestion.cooperado)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-md text-sm transition duration-200 w-full sm:w-auto">Registrar Visita</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
            <h3 className="font-bold text-gray-700 mb-2">Filtrar Visitas por Data</h3>
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div>
                <label htmlFor="start-date" className="text-sm font-medium text-gray-600 mr-2">De:</label>
                <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="shadow-sm border rounded py-1 px-2 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"/>
              </div>
              <div>
                <label htmlFor="end-date" className="text-sm font-medium text-gray-600 mr-2">Até:</label>
                <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className="shadow-sm border rounded py-1 px-2 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"/>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <input type="text" placeholder="Buscar por cooperado ou resumo nos resultados filtrados..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"/>
          </div>
          
          {filteredVisits.length > 0 ? (
            <ul className="divide-y divide-gray-200">{filteredVisits.map(visit => (<VisitListItem key={visit.id} visit={visit} />))}</ul>
          ) : (
            <div className="text-center py-10"><p className="text-gray-500">Nenhuma visita encontrada.</p></div>
          )}
        </div>
      </main>

      {isFormOpen && (<VisitForm cooperados={cooperados} addVisit={handleAddVisit} onClose={closeForm} prefilledCooperado={prefilledCooperado}/>)}

      <footer className="text-center text-gray-500 text-xs py-4">&copy;{new Date().getFullYear()} Sicoob Cooprem. Todos os direitos reservados.</footer>
    </div>
  );
};

export default Dashboard;
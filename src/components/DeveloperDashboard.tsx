import React, { useState, useMemo } from 'react';
import { User, Cooperado, Visit, ProductDetail, SuggestedVisit } from '../types';
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
  onAddSuggestion: (suggestion: Omit<SuggestedVisit, 'id' | 'suggestedAt'>) => Promise<void>;
  onRemoveSuggestion: (suggestionId: string) => Promise<void>;
  onAddUser: (userData: User) => void;
  onUpdateUser: (userId: string, userData: Partial<Omit<User, 'id'>>) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onAddCooperado: (cooperadoData: Omit<Cooperado, 'id'>) => Promise<void>;
  onUpdateCooperado: (cooperadoId: string, cooperadoData: Partial<Omit<Cooperado, 'id'>>) => Promise<void>;
  onDeleteCooperado: (cooperadoId: string) => Promise<void>;
  onOpenChangePassword: (user: User) => void;
}

const getDaysAgo = (date: Date): number => {
  const today = new Date();
  const visitDate = new Date(date);
  today.setHours(0, 0, 0, 0);
  visitDate.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - visitDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const DeveloperDashboard: React.FC<DeveloperDashboardProps> = ({ 
    users, cooperados, visits, suggestedVisits, onLogout, 
    onAddSuggestion, onRemoveSuggestion, onAddUser, onUpdateUser, onDeleteUser, 
    onAddCooperado, onUpdateCooperado, onDeleteCooperado, onOpenChangePassword 
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [selectedManagerId, setSelectedManagerId] = useState<string>('all');
  const [selectedAgency, setSelectedAgency] = useState<string>('all');
  const [mapStartDate, setMapStartDate] = useState('');
  const [mapEndDate, setMapEndDate] = useState('');
  
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  const [suggestionCooperadoId, setSuggestionCooperadoId] = useState('');
  const [suggestionReason, setSuggestionReason] = useState('');
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isCooperadoModalOpen, setIsCooperadoModalOpen] = useState(false);
  const [editingCooperado, setEditingCooperado] = useState<Cooperado | null>(null);
  
  const handleOpenAddUserModal = () => { setEditingUser(null); setIsUserModalOpen(true); };
  const handleOpenEditUserModal = (user: User) => { setEditingUser(user); setIsUserModalOpen(true); };
  const handleCloseUserModal = () => { setIsUserModalOpen(false); setEditingUser(null); };
  const handleUserSave = async (userData: User) => {
    if (editingUser) await onUpdateUser(editingUser.id, userData);
    else onAddUser(userData);
    handleCloseUserModal();
  };
  const handleDeleteUser = async (userId: string) => {
    if (window.confirm("Atenção: Esta ação removerá o perfil do banco de dados, mas NÃO o login do Firebase. Continuar?")) await onDeleteUser(userId);
  };

  const handleOpenAddCooperadoModal = () => { setEditingCooperado(null); setIsCooperadoModalOpen(true); };
  const handleOpenEditCooperadoModal = (cooperado: Cooperado) => { setEditingCooperado(cooperado); setIsCooperadoModalOpen(true); };
  const handleCloseCooperadoModal = () => { setIsCooperadoModalOpen(false); setEditingCooperado(null); };
  const handleCooperadoSave = async (cooperadoData: Omit<Cooperado, 'id'>) => {
    if (editingCooperado) await onUpdateCooperado(editingCooperado.id, cooperadoData);
    else await onAddCooperado(cooperadoData);
    handleCloseCooperadoModal();
  };
  const handleDeleteCooperado = async (cooperadoId: string) => {
    if (window.confirm("Deseja excluir este cooperado permanentemente?")) await onDeleteCooperado(cooperadoId);
  };

  const agencies: string[] = [...new Set<string>(users.filter(u => u.role !== 'Desenvolvedor').map(u => u.agency))];
  const managers: User[] = useMemo(() => users.filter(u => u.role !== 'Desenvolvedor'), [users]);

  const filteredVisitsForMap: Visit[] = useMemo(() => visits.filter(visit => {
    if (!visit.location) return false;
    
    const daysAgoValue = getDaysAgo(visit.date);
    const dateFilterPassed = activeFilter === 'all' ||
      (activeFilter === 'green' && daysAgoValue < 70) ||
      (activeFilter === 'yellow' && daysAgoValue >= 70 && daysAgoValue <= 90) ||
      (activeFilter === 'red' && daysAgoValue > 90);
    const managerFilterPassed = selectedManagerId === 'all' || visit.manager.id === selectedManagerId;
    const agencyFilterPassed = selectedAgency === 'all' || visit.manager.agency === selectedAgency;
    
    let rangeFilterPassed = true;
    if (mapStartDate || mapEndDate) {
        const visitDate = new Date(visit.date);
        if (mapStartDate) {
            const start = new Date(mapStartDate);
            start.setUTCHours(0, 0, 0, 0);
            if (visitDate < start) rangeFilterPassed = false;
        }
        if (mapEndDate) {
            const end = new Date(mapEndDate);
            end.setUTCHours(23, 59, 59, 999);
            if (visitDate > end) rangeFilterPassed = false;
        }
    }

    return dateFilterPassed && managerFilterPassed && agencyFilterPassed && rangeFilterPassed;
  }), [visits, activeFilter, selectedManagerId, selectedAgency, mapStartDate, mapEndDate]);

  const reportFilteredVisits: Visit[] = useMemo(() => {
    if (!reportStartDate || !reportEndDate) return [];
    const start = new Date(reportStartDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(reportEndDate);
    end.setUTCHours(23, 59, 59, 999);
    
    return visits.filter(visit => {
        const visitDate = new Date(visit.date);
        return visitDate >= start && visitDate <= end;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [visits, reportStartDate, reportEndDate]);

  const portfolioCooperados = useMemo(() => cooperados.filter(c => c.isPortfolio).sort((a, b) => a.name.localeCompare(b.name)), [cooperados]);

  const determinedManager = useMemo(() => {
    if (!suggestionCooperadoId) return null;
    const cooperado = cooperados.find(c => c.id === suggestionCooperadoId);
    if (!cooperado || !cooperado.managerName || cooperado.managerName === 'NÃO INFORMADO') return null;
    const manager = users.find(u => u.name.toUpperCase() === cooperado.managerName?.toUpperCase());
    return manager || null;
  }, [suggestionCooperadoId, cooperados, users]);

  const getLocalISOString = (date: Date) => {
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return localDate.toISOString().split('T')[0];
  };

  const setMapDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setMapEndDate(getLocalISOString(end));
    setMapStartDate(getLocalISOString(start));
  };

  const getButtonClass = (filterName: typeof activeFilter) => {
    const baseClasses = "px-3 py-1 rounded-md transition duration-150 flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-blue-400";
    return activeFilter === filterName ? `${baseClasses} bg-blue-600 text-white font-semibold shadow-md` : `${baseClasses} bg-gray-600 hover:bg-gray-500 text-gray-200`;
  };

  const handleAddSuggestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionCooperadoId || !determinedManager || !suggestionReason.trim()) {
      alert("Por favor, selecione um cooperado e preencha o motivo.");
      return;
    }
    const cooperado = cooperados.find(c => c.id === suggestionCooperadoId);
    if (!cooperado) return;
    setIsSubmittingSuggestion(true);
    try {
        await onAddSuggestion({
            manager: { id: determinedManager.id, name: determinedManager.name, agency: determinedManager.agency },
            cooperado,
            suggestedBy: "Desenvolvedor",
            reason: suggestionReason.trim(),
        });
        setSuggestionCooperadoId('');
        setSuggestionReason('');
    } catch(err) { alert("Falha ao adicionar sugestão."); } 
    finally { setIsSubmittingSuggestion(false); }
  };
  
  const formatDate = (d: Date) => new Intl.DateTimeFormat('pt-BR').format(new Date(d));
  const formatProducts = (products: ProductDetail[]) => products.map(p => `${p.product}${p.subProduct ? `: ${p.subProduct}` : ''}${p.observation ? ` (${p.observation})` : ''}`).join('; ');
  const formatSingleProductDetail = (p: ProductDetail): string => `${p.product}${p.subProduct ? `: ${p.subProduct}` : ''}${p.observation ? ` (${p.observation})` : ''}`;

  const handleExportXLSX = async () => {
    try {
      setIsExporting(true);
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Relatório de Visitas');

      worksheet.columns = [
        { header: 'Data', key: 'date', width: 12 },
        { header: 'Gerente', key: 'manager', width: 25 },
        { header: 'Agência', key: 'agency', width: 15 },
        { header: 'Cooperado', key: 'cooperado', width: 30 },
        { header: 'Documento', key: 'document', width: 18 },
        { header: 'Resumo', key: 'summary', width: 45 },
        { header: 'Produto Ofertado', key: 'product', width: 30 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005058' } };

      reportFilteredVisits.forEach(visit => {
        const baseData = {
          date: formatDate(visit.date),
          manager: visit.manager.name,
          agency: visit.manager.agency,
          cooperado: visit.cooperado.name,
          document: visit.cooperado.document,
          summary: visit.summary,
        };
        if (visit.products && visit.products.length > 0) {
          visit.products.forEach(p => { worksheet.addRow({ ...baseData, product: formatSingleProductDetail(p) }); });
        } else { worksheet.addRow({ ...baseData, product: 'N/A' }); }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'relatorio_visitas.xlsx');
    } catch (error) { console.error(error); alert('Erro ao exportar Excel.'); } 
    finally { setIsExporting(false); }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'landscape' });
      const body = reportFilteredVisits.flatMap(v => {
        const productsList: (ProductDetail | null)[] = v.products && v.products.length > 0 ? v.products : [null];
        return productsList.map(p => [
            formatDate(v.date), 
            v.manager.name, 
            v.manager.agency, 
            v.cooperado.name, 
            v.cooperado.document, 
            v.summary, 
            p ? formatSingleProductDetail(p) : 'N/A',
        ]);
      });

      autoTable(doc, {
        head: [["Data", "Gerente", "Agência", "Cooperado", "Documento", "Resumo", "Produto"]],
        body: body, 
        styles: { fontSize: 8 }, 
        headStyles: { fillColor: [0, 80, 88] },
        theme: 'grid'
      });
      doc.save("relatorio_visitas.pdf");
    } catch (error) { console.error(error); alert('Erro ao exportar PDF.'); } 
    finally { setIsExporting(false); }
  };

  const groupedSuggestions = useMemo(() => suggestedVisits.reduce((acc, suggestion) => {
    const managerName = suggestion.manager.name;
    if (!acc[managerName]) acc[managerName] = [];
    acc[managerName].push(suggestion);
    return acc;
  }, {} as Record<string, SuggestedVisit[]>), [suggestedVisits]);

  return (
    <div className="min-h-screen bg-gray-800 text-white">
      <header className="bg-gray-900 shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center"><Logo className="h-10 w-auto mr-4" /><h1 className="text-xl font-semibold">Painel do desenvolvedor</h1></div>
          <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 font-bold py-2 px-4 rounded-md transition duration-200">Sair</button>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-6">
        <div className="mb-8 bg-gray-700 rounded-lg shadow-lg p-4">
            <h3 className="text-xl font-semibold mb-4 text-yellow-400">Sugerir Visitas</h3>
            <form onSubmit={handleAddSuggestionSubmit} className="space-y-4 bg-gray-800 p-4 rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Cooperado da Carteira</label>
                        <select value={suggestionCooperadoId} onChange={e => setSuggestionCooperadoId(e.target.value)} className="bg-gray-600 text-white rounded-md p-2 w-full h-10" required>
                            <option value="">Selecione um cooperado...</option>
                            {portfolioCooperados.map(cooperado => (<option key={cooperado.id} value={cooperado.id}>{cooperado.name}</option>))}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Gerente Responsável</label>
                        <div className="bg-gray-900 text-white rounded-md p-2 w-full h-10 flex items-center">
                            <span className="text-gray-300 truncate">{determinedManager ? determinedManager.name : 'Aguardando cooperado...'}</span>
                        </div>
                    </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Motivo da Sugestão</label>
                  <textarea rows={2} value={suggestionReason} onChange={e => setSuggestionReason(e.target.value)} className="bg-gray-600 text-white rounded-md p-2 w-full" placeholder="Ex: Oportunidade para..." required />
                </div>
                <div className="flex justify-end">
                    <button type="submit" disabled={isSubmittingSuggestion || !determinedManager} className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-4 rounded transition h-10 disabled:opacity-50">{isSubmittingSuggestion ? 'Enviando...' : 'Sugerir Visita'}</button>
                </div>
            </form>
            <div className="mt-6">
                <h4 className="text-lg font-semibold text-gray-300 mb-2">Sugestões Ativas</h4>
                {Object.keys(groupedSuggestions).length > 0 ? ( <div className="space-y-4">{Object.entries(groupedSuggestions).map(([managerName, suggestions]: [string, SuggestedVisit[]]) => (<div key={managerName}><h5 className="font-bold text-gray-400">{managerName}</h5><ul className="list-disc list-inside mt-1 space-y-2">{suggestions.map(s => (<li key={s.id} className="text-sm text-gray-200 flex justify-between items-start"><div><span>{s.cooperado.name} (Sugerido em: {formatDate(s.suggestedAt)})</span><p className="text-xs text-gray-400 italic pl-5">{s.reason}</p></div><button onClick={() => onRemoveSuggestion(s.id)} className="text-red-400 hover:text-red-300 text-xs font-bold flex-shrink-0 ml-4">REMOVER</button></li>))}</ul></div>))}</div>) : (<p className="text-gray-400 text-sm">Nenhuma sugestão ativa.</p>)}
            </div>
        </div>
        
        <div className="mb-8 bg-gray-700 rounded-lg shadow-lg p-4">
          <h3 className="text-xl font-semibold mb-3 text-blue-400">Mapa de Visitas</h3>
           <div className="flex items-center space-x-2 text-xs mb-4 flex-wrap gap-y-2">
              <span className="font-bold mr-2 text-sm">Filtros de Idade:</span>
              <button onClick={() => setActiveFilter('all')} className={getButtonClass('all')}>Todos</button>
              <button onClick={() => setActiveFilter('green')} className={getButtonClass('green')}>{'< 70d'}</button>
              <button onClick={() => setActiveFilter('yellow')} className={getButtonClass('yellow')}>{'70-90d'}</button>
              <button onClick={() => setActiveFilter('red')} className={getButtonClass('red')}>{'> 90d'}</button>
           </div>
           <div className="flex items-center space-x-4 text-sm flex-wrap gap-4 mb-4">
              <div><label className="font-bold mr-2">Gerente:</label><select value={selectedManagerId} onChange={(e) => setSelectedManagerId(e.target.value)} className="bg-gray-600 text-white rounded-md p-2"><option value="all">Todos</option>{managers.map(user => (<option key={user.id} value={user.id}>{user.name}</option>))}</select></div>
              <div><label className="font-bold mr-2">Agência:</label><select value={selectedAgency} onChange={(e) => setSelectedAgency(e.target.value)} className="bg-gray-600 text-white rounded-md p-2"><option value="all">Todas</option>{agencies.map(agency => (<option key={agency} value={agency}>{agency}</option>))}</select></div>
           </div>
           <div className="border-t border-gray-600 pt-4 mt-4">
              <div className="flex items-center space-x-2 text-sm"><span className="font-bold">Período:</span><div className="flex items-center gap-2 flex-wrap"><button onClick={() => setMapDateRange(0)} className="bg-gray-600 text-gray-200 px-3 py-1 rounded-md text-xs">Hoje</button><button onClick={() => setMapDateRange(6)} className="bg-gray-600 text-gray-200 px-3 py-1 rounded-md text-xs">7 dias</button><button onClick={() => setMapDateRange(29)} className="bg-gray-600 text-gray-200 px-3 py-1 rounded-md text-xs">30 dias</button></div></div>
              <div className="flex items-center space-x-4 text-sm flex-wrap gap-4 mt-2">
                <div><label className="font-medium mr-2 text-gray-300">De:</label><input type="date" value={mapStartDate} onChange={e => setMapStartDate(e.target.value)} className="bg-gray-600 text-white rounded-md p-2"/></div>
                <div><label className="font-medium mr-2 text-gray-300">Até:</label><input type="date" value={mapEndDate} onChange={e => setMapEndDate(e.target.value)} min={mapStartDate} className="bg-gray-600 text-white rounded-md p-2"/></div>
                <button onClick={() => { setMapStartDate(''); setMapEndDate(''); }} className="bg-gray-500 hover:bg-gray-400 text-white font-bold py-2 px-3 rounded text-xs">Limpar</button>
              </div>
          </div>
          <VisitsMap visits={filteredVisitsForMap} />
        </div>

        <div className="my-8 bg-gray-700 rounded-lg shadow-lg p-4">
          <h3 className="text-xl font-semibold mb-4 text-blue-400">Relatório de Visitas</h3>
          <div className="flex flex-col md:flex-row gap-4 items-center mb-4 p-4 bg-gray-800 rounded-md">
            <div><label className="text-sm font-medium text-gray-300 mr-2">De:</label><input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="bg-gray-600 text-white rounded-md p-2"/></div>
            <div><label className="text-sm font-medium text-gray-300 mr-2">Até:</label><input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} min={reportStartDate} className="bg-gray-600 text-white rounded-md p-2"/></div>
            <div className="flex gap-2">
              <button onClick={handleExportXLSX} disabled={!reportFilteredVisits.length || isExporting} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50">XLSX</button>
              <button onClick={handleExportPDF} disabled={!reportFilteredVisits.length || isExporting} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50">PDF</button>
            </div>
          </div>
          <div className="overflow-x-auto mt-4">{reportFilteredVisits.length > 0 ? (<table className="w-full text-sm text-left text-gray-300"><thead className="text-xs text-gray-400 uppercase bg-gray-800"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Gerente</th><th className="px-4 py-3">Agência</th><th className="px-4 py-3">Cooperado</th><th className="px-4 py-3">Resumo</th><th className="px-4 py-3">Produtos</th></tr></thead><tbody>{reportFilteredVisits.map(visit => (<tr key={visit.id} className="bg-gray-700 border-b border-gray-600"><td className="px-4 py-2 whitespace-nowrap">{formatDate(visit.date)}</td><td className="px-4 py-2">{visit.manager.name}</td><td className="px-4 py-2">{visit.manager.agency}</td><td className="px-4 py-2">{visit.cooperado.name}</td><td className="px-4 py-2 min-w-[200px]">{visit.summary}</td><td className="px-4 py-2 min-w-[200px]">{formatProducts(visit.products)}</td></tr>))}</tbody></table>) : (<p className="text-center text-gray-400 py-4">Selecione um intervalo.</p>)}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-semibold text-green-400">Usuários</h3><button onClick={handleOpenAddUserModal} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded text-sm">Adicionar</button></div>
            <div className="bg-gray-700 rounded-lg shadow-lg overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-gray-800"><tr><th className="px-6 py-3">Nome</th><th className="px-6 py-3">Email</th><th className="px-6 py-3">Ações</th></tr></thead>
                <tbody>{users.filter(u => u.role !== 'Desenvolvedor').map(user => (<tr key={user.id} className="bg-gray-700 border-b border-gray-600"><td className="px-6 py-4">{user.name}</td><td className="px-6 py-4">{user.email}</td><td className="px-6 py-4 text-center space-x-2"><button onClick={() => handleOpenEditUserModal(user)} className="text-blue-400">Editar</button><button onClick={() => onOpenChangePassword(user)} className="text-yellow-400">Senha</button><button onClick={() => handleDeleteUser(user.id)} className="text-red-400">Excluir</button></td></tr>))}</tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-semibold text-purple-400">Cooperados</h3><button onClick={handleOpenAddCooperadoModal} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded text-sm">Adicionar</button></div>
            <div className="bg-gray-700 rounded-lg shadow-lg overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-gray-800"><tr><th className="px-6 py-3">Nome</th><th className="px-6 py-3">Gerente</th><th className="px-6 py-3">Ações</th></tr></thead>
                <tbody>{cooperados.map(coop => (<tr key={coop.id} className="bg-gray-700 border-b border-gray-600"><td className="px-6 py-4">{coop.name}</td><td className="px-6 py-4">{coop.managerName || 'N/A'}</td><td className="px-6 py-4 text-center space-x-2"><button onClick={() => handleOpenEditCooperadoModal(coop)} className="text-blue-400">Editar</button><button onClick={() => handleDeleteCooperado(coop.id)} className="text-red-400">Excluir</button></td></tr>))}</tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      
      {isUserModalOpen && (<UserFormModal user={editingUser} onSave={handleUserSave} onClose={handleCloseUserModal} />)}
      {isCooperadoModalOpen && (<CooperadoFormModal cooperado={editingCooperado} managers={managers} onSave={handleCooperadoSave} onClose={handleCloseCooperadoModal}/>)}
    </div>
  );
};

export default DeveloperDashboard;
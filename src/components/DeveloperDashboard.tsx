
import React, { useMemo, useState } from 'react';
import { User, Cooperado, Visit, SuggestedVisit } from '../types';
import Logo from './Logo';
import VisitsMap from './VisitsMap';
import UserFormModal from './UserFormModal';
import CooperadoFormModal from './CooperadoFormModal';
import { Product } from '../types';

interface DeveloperDashboardProps {
  users: User[];
  cooperados: Cooperado[];
  visits: Visit[];
  suggestedVisits: SuggestedVisit[];
  hasAIKey: boolean;
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
  const [tab, setTab] = useState<'map' | 'users' | 'cooperados' | 'reports'>('map');
  const [modalUser, setModalUser] = useState<User | null>(null);
  const [isUserModal, setIsUserModal] = useState(false);
  const [modalCoop, setModalCoop] = useState<Cooperado | null>(null);
  const [coopSearch, setCoopSearch] = useState<string>('');

  // Normaliza cooperado vindo do Firestore (PT-BR) para o shape usado no app (EN),
  // evitando campos vazios na aba Base de Dados quando o documento tem chaves:
  // nome, documento, nome_gerente, PA.
  const normalizeCooperado = (raw: any): Cooperado => {
    const name = raw?.name ?? raw?.nome ?? '';
    const document = raw?.document ?? raw?.documento ?? raw?.cpf ?? raw?.cnpj ?? '';
    const managerName = raw?.managerName ?? raw?.nome_gerente ?? raw?.gerente ?? undefined;
    const agency = raw?.agency ?? raw?.PA ?? raw?.pa ?? undefined;
    const isPortfolio = (typeof raw?.isPortfolio === 'boolean') ? raw.isPortfolio : false;

    return {
      ...(raw as any),
      id: raw?.id ?? document ?? '',
      name,
      document,
      managerName,
      agency,
      isPortfolio,
    } as Cooperado;
  };


  // Filtro de busca (nome ou CPF/CNPJ) + limite de visualização
  const filteredCooperados = useMemo(() => {
    const term = coopSearch.trim().toLowerCase();
    const list = props.cooperados.map(normalizeCooperado);
    if (!term) return list;
    return list.filter((c) => {
      const name = (c.name ?? '').toLowerCase();
      const doc = (c.document ?? '').toLowerCase();
      return name.includes(term) || doc.includes(term);
    });
  }, [props.cooperados, coopSearch]);

  const visibleCooperados = useMemo(() => {
    return filteredCooperados.slice(0, 30);
  }, [filteredCooperados]);

  const [isCoopModal, setIsCoopModal] = useState(false);

  // Relatório de visitas (filtros)
  const [reportPA, setReportPA] = useState<string>('');
  const [reportGerente, setReportGerente] = useState<string>('');
  const [reportProduto, setReportProduto] = useState<string>('');
  const [reportBusca, setReportBusca] = useState<string>('');
  const [reportStart, setReportStart] = useState<string>(''); // yyyy-mm-dd
  const [reportEnd, setReportEnd] = useState<string>(''); // yyyy-mm-dd

  function normalizeText(text: string) {
    return (text || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const paOptions = useMemo(() => {
    const fromUsers = props.users.map(u => (u.agency || '').trim()).filter(Boolean);
    const fromCoops = props.cooperados.map(c => ((c as any).agency || '').toString().trim()).filter(Boolean);
    const fromVisits = props.visits.map(v => (v.manager?.agency || '').toString().trim()).filter(Boolean);
    return Array.from(new Set([...fromUsers, ...fromCoops, ...fromVisits])).sort((a, b) => a.localeCompare(b));
  }, [props.users, props.cooperados, props.visits]);

  const gerenteOptions = useMemo(() => {
    const names = props.users.map(u => u.name?.trim()).filter(Boolean);
    const fromVisits = props.visits.map(v => v.manager?.name?.trim()).filter(Boolean);
    return Array.from(new Set([...names, ...fromVisits])).sort((a, b) => a.localeCompare(b));
  }, [props.users, props.visits]);

  const produtoOptions = ['Consórcio', 'Seguro', 'Investimentos', 'Crédito', 'Previdência', 'Compliance', 'Cobrança', 'SIPAG'] as const;

  const filteredVisits = useMemo(() => {
    const s = reportStart ? new Date(`${reportStart}T00:00:00`) : null;
    const e = reportEnd ? new Date(`${reportEnd}T23:59:59`) : null;
    const q = normalizeText(reportBusca);
    const qDigits = reportBusca.replace(/\D/g, '');

    return props.visits.filter(v => {
      // Datas
      if (s && v.date < s) return false;
      if (e && v.date > e) return false;

      // PA (usa agência do gerente; se existir agência do cooperado, também aceita)
      if (reportPA) {
        const paVisit = (v.manager?.agency || '').toString().trim();
        const paCoop = ((v.cooperado as any)?.agency || '').toString().trim();
        if (paVisit !== reportPA && paCoop !== reportPA) return false;
      }

      // Gerente
      if (reportGerente) {
        const g = (v.manager?.name || '').toString().trim();
        if (g !== reportGerente) return false;
      }

      // Produto (visita pode ter vários produtos: products: ProductDetail[])
      if (reportProduto) {
        const prods = (v as any).products;
        const match =
          Array.isArray(prods) &&
          prods.some((p: any) => (p?.product ?? '').toString().trim() === reportProduto);

        if (!match) return false;
      }
// Busca (nome ou documento)
      if (q || qDigits) {
        const coopName = normalizeText((v.cooperado as any)?.name || (v.cooperado as any)?.nome || '');
        const coopDoc = ((v.cooperado as any)?.document || (v.cooperado as any)?.documento || '').toString();
        const coopDocDigits = coopDoc.replace(/\D/g, '');
        const summary = normalizeText(v.summary || '');

        const matchText = q ? (coopName.includes(q) || summary.includes(q)) : false;
        const matchDoc = qDigits ? (coopDocDigits.includes(qDigits)) : false;
        if (!matchText && !matchDoc) return false;
      }

      return true;
    });
  }, [props.visits, reportPA, reportGerente, reportProduto, reportBusca, reportStart, reportEnd]);

  // Limite de visualização (apenas na tabela): mostrar as 50 visitas mais recentes do resultado filtrado
  const visibleVisits = useMemo(() => {
    const toTime = (v: Visit) => {
      const d = v.date instanceof Date ? v.date : new Date(v.date as any);
      return d.getTime();
    };
    return [...filteredVisits].sort((a, b) => toTime(b) - toTime(a)).slice(0, 50);
  }, [filteredVisits]);

  const reportStats = useMemo(() => {
    const total = filteredVisits.length;
    const uniqueCoops = new Set(
      filteredVisits.map(v => {
        const doc = ((v.cooperado as any)?.document || '').toString().replace(/\D/g, '');
        const name = ((v.cooperado as any)?.name || '').toString().trim();
        return doc || name;
      }).filter(Boolean)
    ).size;

    const byManager = new Map<string, number>();
    const byPA = new Map<string, number>();
    filteredVisits.forEach(v => {
      const m = (v.manager?.name || '—').toString();
      byManager.set(m, (byManager.get(m) || 0) + 1);
      const pa = (v.manager?.agency || ((v.cooperado as any)?.agency) || '—').toString();
      byPA.set(pa, (byPA.get(pa) || 0) + 1);
    });

    const topManager = Array.from(byManager.entries()).sort((a, b) => b[1] - a[1])[0];
    const topPA = Array.from(byPA.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      uniqueCoops,
      topManager: topManager ? { name: topManager[0], count: topManager[1] } : null,
      topPA: topPA ? { name: topPA[0], count: topPA[1] } : null,
    };
  }, [filteredVisits]);

  const allProducts = Object.values(Product);

 function downloadCSV() {
  
  const header = [
    'serial_visita',
    'data',
    'hora',
    'pa',
    'nome_gerente',
    'nome',
    'cpf_cnpj',
    'resumo',
    ...allProducts.map(p => `produto_${p}`)
  ].join(';');

  const lines = filteredVisits.map(v => {
    const pa = (v.manager?.agency || ((v.cooperado as any)?.agency) || '').toString().trim();
    const gerente = (v.manager?.name || '').toString().trim();
    const nome = (((v.cooperado as any)?.name) || ((v.cooperado as any)?.nome) || '').toString().trim();
    const doc = (((v.cooperado as any)?.document) || ((v.cooperado as any)?.documento) || '').toString().trim();
    const resumo = (v.summary || '').toString().replace(/\s+/g, ' ').trim();
    const serial = (v as any).serial || '';

    const d = v.date instanceof Date ? v.date : new Date(v.date as any);
    const data = d.toLocaleDateString('pt-BR');
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Marca SIM por produto (por base product). SubProduct é ignorado aqui, como você pediu.
    const produtosDaVisita = new Set((v.products || []).map(p => p.product));
    const produtoCols = allProducts.map(p => (produtosDaVisita.has(p) ? 'SIM' : ''));

    const safe = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;

    return [
      safe(serial),
      data,
      hora,
      safe(pa),
      safe(gerente),
      safe(nome),
      safe(doc),
      safe(resumo),
      ...produtoCols.map(x => safe(x)) // garante CSV seguro
    ].join(';');
  });

  const csv = [header, ...lines].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio_visitas_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


  function printReport() {
    const title = 'Relatório de Visitas - Sicoob Cooprem';
    const stamp = new Date().toLocaleString('pt-BR');
    const filters = [
      reportPA ? `PA: ${reportPA}` : null,
      reportGerente ? `Gerente: ${reportGerente}` : null,
      reportBusca ? `Busca: ${reportBusca}` : null,
      reportStart ? `De: ${reportStart}` : null,
      reportEnd ? `Até: ${reportEnd}` : null,
    ].filter(Boolean).join(' · ');

    const rows = filteredVisits
      .map(v => {
        const d = v.date instanceof Date ? v.date : new Date(v.date as any);
        const data = d.toLocaleDateString('pt-BR');
        const pa = (v.manager?.agency || ((v.cooperado as any)?.agency) || '').toString().trim();
        const gerente = (v.manager?.name || '').toString().trim();
        const nome = ((v.cooperado as any)?.name || '').toString().trim();
        const doc = ((v.cooperado as any)?.document || '').toString().trim();
        const resumo = (v.summary || '').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const produtosArr = (v as any).products;
        const produtos = Array.isArray(produtosArr)
          ? Array.from(new Set(produtosArr.map((p: any) => (p?.product ?? '').toString().trim()).filter(Boolean))).join(', ')
          : '';
        return `
          <tr>
            <td>${data}</td>
            <td>${pa}</td>
            <td>${gerente}</td>
            <td>${nome}</td>
            <td>${doc}</td>
            <td>${produtos}</td>
            <td>${resumo}</td>
          </tr>
        `;
      })
      .join('');

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 18px; margin: 0 0 6px 0; }
            .meta { color: #555; font-size: 12px; margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; vertical-align: top; }
            th { background: #f5f5f5; text-align: left; }
            .stats { margin: 10px 0 14px 0; font-size: 12px; color: #333; }
            @media print {
              body { padding: 0; }
              .meta { margin-bottom: 8px; }
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">Gerado em ${stamp}${filters ? ` · ${filters}` : ''}</div>
          <div class="stats">
            Total de visitas: <b>${reportStats.total}</b> · Cooperados únicos: <b>${reportStats.uniqueCoops}</b>
            ${reportStats.topPA ? ` · PA com mais visitas: <b>${reportStats.topPA.name}</b> (${reportStats.topPA.count})` : ''}
            ${reportStats.topManager ? ` · Gerente com mais visitas: <b>${reportStats.topManager.name}</b> (${reportStats.topManager.count})` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>PA</th>
                <th>Nome Gerente</th>
                <th>Nome</th>
                <th>CPF/CNPJ</th>
                <th>Produtos</th>
                <th>Resumo</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      alert('O navegador bloqueou a janela de impressão. Permita pop-ups para gerar o PDF.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  return (
    <div className="min-h-screen bg-[#111827] text-white font-sans">
      <header className="bg-[#1f2937] border-b border-gray-700 h-16 flex items-center px-6 justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Logo style={{ filter: 'brightness(1.5)', height: '32px' }} />
          <h1 className="font-bold text-lg hidden sm:block">Console Sicoob Dev</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={props.onGenerateAISuggestions} 
            title={props.hasAIKey ? "Gerar sugestões com IA" : "IA não configurada"}
            className={`${props.hasAIKey ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 cursor-not-allowed opacity-50'} text-xs px-4 py-2 rounded-lg font-bold transition-all shadow-lg`}
          >
            {props.hasAIKey ? '🪄 Analisar com IA' : '🚫 IA Indisponível'}
          </button>
          <button onClick={props.onLogout} className="bg-red-600 hover:bg-red-700 text-xs px-4 py-2 rounded-lg font-bold">Sair</button>
        </div>
      </header>

      <nav className="flex bg-[#1f2937] border-b border-gray-700 sticky top-16 z-40">
        <button onClick={() => setTab('map')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'map' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>🗺️ Mapa Global</button>
        <button onClick={() => setTab('reports')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'reports' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>📄 Relatórios</button>
        <button onClick={() => setTab('users')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'users' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>👥 Gestão de Acessos</button>
        <button onClick={() => setTab('cooperados')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'cooperados' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>🏢 Base de Dados</button>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        {tab === 'map' && (
          <div className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden shadow-2xl h-[70vh]">
            <VisitsMap visits={props.visits} />
          </div>
        )}

        {tab === 'reports' && (
          <div className="bg-[#1f2937] rounded-2xl border border-gray-700 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold">Relatório de Visitas</h2>
                <p className="text-sm text-gray-400 mt-1">Filtre por PA, gerente, cooperado/CPF-CNPJ e período. Depois, gere CSV ou imprima para salvar em PDF.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setReportPA('');
                    setReportGerente('');
                    setReportBusca('');
                    setReportStart('');
                    setReportEnd('');
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-xs px-4 py-2 rounded-lg font-bold"
                >
                  Limpar filtros
                </button>
                <button
                  onClick={downloadCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-xs px-4 py-2 rounded-lg font-bold"
                  title="Gera um CSV (compatível com Excel) com o resultado filtrado"
                  disabled={filteredVisits.length === 0}
                >
                  ⬇️ Baixar CSV
                </button>
                <button
                  onClick={printReport}
                  className="bg-blue-600 hover:bg-blue-700 text-xs px-4 py-2 rounded-lg font-bold"
                  title="Abre uma versão para impressão (salvar em PDF)"
                  disabled={filteredVisits.length === 0}
                >
                  🖨️ Imprimir / PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-400 font-bold">PA</label>
                <select value={reportPA} onChange={(e) => setReportPA(e.target.value)} className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  {paOptions.map(pa => (<option key={pa} value={pa}>{pa}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold">Nome do gerente</label>
                <select value={reportGerente} onChange={(e) => setReportGerente(e.target.value)} className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  {gerenteOptions.map(g => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>
              <div>
              <div>
                <label className="text-xs text-gray-400 font-bold">Produto</label>
                <select value={reportProduto} onChange={(e) => setReportProduto(e.target.value)} className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  {produtoOptions.map(p => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
                <label className="text-xs text-gray-400 font-bold">Cooperado / CPF-CNPJ / resumo</label>
                <input value={reportBusca} onChange={(e) => setReportBusca(e.target.value)} placeholder="Digite nome, CPF/CNPJ ou palavra do resumo" className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold">Data inicial</label>
                <input type="date" value={reportStart} onChange={(e) => setReportStart(e.target.value)} className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold">Data final</label>
                <input type="date" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 font-bold">Visitas</p>
                <p className="text-2xl font-extrabold mt-2">{reportStats.total}</p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 font-bold">Cooperados únicos</p>
                <p className="text-2xl font-extrabold mt-2">{reportStats.uniqueCoops}</p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 font-bold">PA com mais visitas</p>
                <p className="text-sm font-bold mt-2 text-gray-200">{reportStats.topPA ? `${reportStats.topPA.name} (${reportStats.topPA.count})` : '—'}</p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 font-bold">Gerente com mais visitas</p>
                <p className="text-sm font-bold mt-2 text-gray-200">{reportStats.topManager ? `${reportStats.topManager.name} (${reportStats.topManager.count})` : '—'}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-gray-400 text-xs uppercase tracking-widest border-b border-gray-700">
                  <tr>
                    <th className="py-4">Data</th>
                    <th className="py-4">PA</th>
                    <th className="py-4">Nome gerente</th>
                    <th className="py-4">Cooperado</th>
                    <th className="py-4">CPF/CNPJ</th>
                    <th className="py-4">Produtos</th>
                    <th className="py-4">Resumo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {visibleVisits.map(v => {
                    const d = v.date instanceof Date ? v.date : new Date(v.date as any);
                    const pa = (v.manager?.agency || ((v.cooperado as any)?.agency) || '').toString().trim();
                    const gerente = (v.manager?.name || '').toString().trim();
                    const nome = ((v.cooperado as any)?.name || '').toString().trim();
                    const doc = ((v.cooperado as any)?.document || '').toString().trim();
                    return (
                      <tr key={v.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="py-4 font-mono text-xs text-gray-300">{d.toLocaleDateString('pt-BR')}</td>
                        <td className="py-4 text-sm">{pa || '—'}</td>
                        <td className="py-4 text-sm font-bold">{gerente || '—'}</td>
                        <td className="py-4 text-sm">{nome || '—'}</td>
                        <td className="py-4 text-xs font-mono text-gray-400">{doc || '—'}</td>
                        <td className="py-4 text-sm text-gray-300">{(() => {
                          const prods = (v as any).products;
                          if (!Array.isArray(prods) || prods.length === 0) return '—';
                          const names = prods
                            .map((p: any) => (p?.product ?? '').toString().trim())
                            .filter(Boolean);
                          const uniq = Array.from(new Set(names));
                          return uniq.join(', ') || '—';
                        })()}</td>
                        <td className="py-4 text-sm text-gray-300">{v.summary || '—'}</td>
                      </tr>
                    );
                  })}
                  {filteredVisits.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-400">Nenhuma visita encontrada com os filtros atuais.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredVisits.length > 50 && (
                <div className="mt-3 text-xs text-gray-400">
                  Exibindo apenas as <b>50</b> visitas mais recentes na tela. O download CSV/Impressão considera <b>todas</b> as visitas filtradas.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-[#1f2937] rounded-2xl border border-gray-700 p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
              <button onClick={() => { setModalUser(null); setIsUserModal(true); }} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-xl font-bold text-sm">+ Novo Usuário</button>
            </div>
            <div className="overflow-x-auto">
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
          </div>
        )}

        {tab === 'cooperados' && (
              <div className="bg-[#1f2937] rounded-2xl border border-gray-700 p-8">
              <div className="flex flex-col gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold">Cooperados</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Pesquise por nome ou CPF/CNPJ
                </p>
              </div>

              <input
                value={coopSearch}
                onChange={(e) => setCoopSearch(e.target.value)}
                placeholder="Buscar por nome ou CPF/CNPJ"
                className="w-full md:max-w-md bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleCooperados.map(coop => (
                <div key={coop.id} className="p-5 bg-gray-800 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all cursor-pointer group" onClick={() => { setModalCoop(coop); setIsCoopModal(true); }}>
                  <p className="font-bold text-lg group-hover:text-blue-400 transition-colors">{coop.name}</p>
                  <p className="text-xs font-mono text-gray-500 mt-1 uppercase">{coop.document}</p>
                  <p className="text-xs text-gray-400 mt-4 border-t border-gray-700 pt-3">Gerente: <span className="text-gray-200">{coop.managerName || 'Não atribuído'}</span></p>
                </div>
              ))}
            </div>

              {(filteredCooperados.length > 30) && (
                <div className="mt-3 text-xs text-gray-400">
                  Exibindo apenas os primeiros <b>30</b> cooperados na tela. Refine a busca para encontrar outros registros.
                </div>
              )}

          </div>
        )}
      </main>

      {isUserModal && <UserFormModal user={modalUser} onSave={(u) => { modalUser ? props.onUpdateUser(modalUser.id, u) : props.onAddUser(u); setIsUserModal(false); }} onClose={() => setIsUserModal(false)} />}
      {isCoopModal && <CooperadoFormModal cooperado={modalCoop ? normalizeCooperado(modalCoop) : null} managers={props.users} onSave={(c) => { modalCoop ? props.onUpdateCooperado(modalCoop.id, c) : props.onAddCooperado(c); setIsCoopModal(false); }} onClose={() => setIsCoopModal(false)} />}
    </div>
  );
};

export default DeveloperDashboard;
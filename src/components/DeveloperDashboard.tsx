
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  onUpdateUser: (id: string, d: any) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onEnableUser: (id: string) => Promise<void>; // <-- aqui
  onResetUserPassword: (email: string) => Promise<void>;

  onAddCooperado: (c: any) => Promise<void>;
  onUpdateCooperado: (id: string, c: any) => Promise<void>;
  onDeleteCooperado: (id: string) => Promise<void>;

  onGenerateAISuggestions: () => Promise<void>;
  onOpenChangePassword: (u: User) => void;

  onAddSuggestion: (s: any) => Promise<void>;
  onRemoveSuggestion: (id: string) => Promise<void>;

  searchCooperados: (pa: string, term: string) => Promise<Cooperado[]>;
}


const normalizeDoc = (v: any) => String(v ?? '').replace(/\D/g, '');

const DeveloperDashboard: React.FC<DeveloperDashboardProps> = (props) => {
  const [tab, setTab] = useState<'map' | 'users' | 'cooperados' | 'reports' | 'suggestions'>('map');
  const [modalUser, setModalUser] = useState<User | null>(null);
  const [isUserModal, setIsUserModal] = useState(false);
  const [modalCoop, setModalCoop] = useState<Cooperado | null>(null);
  const [coopSearch, setCoopSearch] = useState<string>('');
  const [sugManagerId, setSugManagerId] = useState('');
  const [coopSugResults, setCoopSugResults] = useState<Cooperado[]>([]);
  const [loadingCoopSug, setLoadingCoopSug] = useState(false);

  // modelos de search para procurar tudo
  const [coopResults, setCoopResults] = useState<Cooperado[]>([]);
  const [loadingCoops, setLoadingCoops] = useState(false);

  // ===== Paginação de usuários (aba Users) =====
  const USERS_PER_PAGE = 10;
  const [usersPage, setUsersPage] = useState(1);

  useEffect(() => {
    // sempre que entrar na aba ou a lista mudar, volta para a primeira página
    if (tab === 'users') setUsersPage(1);
  }, [tab, props.users]);

  const usersTotalPages = useMemo(() => {
    const total = (props.users || []).length;
    return Math.max(1, Math.ceil(total / USERS_PER_PAGE));
  }, [props.users]);

  const visibleUsers = useMemo(() => {
    const start = (usersPage - 1) * USERS_PER_PAGE;
    return (props.users || []).slice(start, start + USERS_PER_PAGE);
  }, [props.users, usersPage]);



  // ===== Sugestões: Autocomplete Gerente =====
  const [mgrSearch, setMgrSearch] = useState('');
  const [mgrShow, setMgrShow] = useState(false);
  const mgrBoxRef = useRef<HTMLDivElement | null>(null);
  const [selectedManager, setSelectedManager] = useState<any>(null);

  // ===== Sugestões: Autocomplete Cooperado =====
  const [coopSugSearch, setCoopSugSearch] = useState('');
  const [coopSugShow, setCoopSugShow] = useState(false);
  const coopSugBoxRef = useRef<HTMLDivElement | null>(null);
  const [selectedCoop, setSelectedCoop] = useState<any>(null);

  // Flag base/manual + manual fields + motivo
  const [sugInBase, setSugInBase] = useState(true);
  const [sugManual, setSugManual] = useState({ name: '', document: '' });
  const [sugReason, setSugReason] = useState('');
  const [sugSubmitting, setSugSubmitting] = useState(false);

  // só usuários com perfil gerente
  const gerenteOptions = useMemo(() => {
    const q = normalizeTextStrict(mgrSearch.trim());

    return (props.users || [])
      // só usuários com perfil gerente
      .filter(u => (u.role || '').toLowerCase().includes('gerente'))
      // busca SOMENTE por nome
      .filter(u => !q || normalizeTextStrict(u.name).includes(q))
      // limite para performance
      .slice(0, 20);
  }, [mgrSearch, props.users]);


  // Clausula do ESC para DropDown
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (mgrBoxRef.current && !mgrBoxRef.current.contains(e.target as Node)) setMgrShow(false);
      if (coopSugBoxRef.current && !coopSugBoxRef.current.contains(e.target as Node)) setCoopSugShow(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  // debounce global *


  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMgrShow(false);
        setCoopSugShow(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const cooperadosOptions = useMemo(() => {
    return (coopSugResults || []).slice(0, 20);
  }, [coopSugResults]);

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

  useEffect(() => {
    const term = coopSearch.trim();

    if (term.length < 2) {
      setCoopResults([]);
      return;
    }

    const t = setTimeout(async () => {
      setLoadingCoops(true);
      try {
        const res = await props.searchCooperados("*", term); // ✅ global
        setCoopResults(res);
      } finally {
        setLoadingCoops(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [coopSearch, props.searchCooperados]);

  const visibleCooperados = useMemo(() => {
    return (coopResults || []).slice(0, 20);
  }, [coopResults]);


  useEffect(() => {
    if (!sugInBase) return;

    const term = coopSugSearch.trim();
    if (term.length < 2) {
      setCoopSugResults([]);
      return;
    }

    const t = setTimeout(async () => {
      setLoadingCoopSug(true);
      try {
        const res = await props.searchCooperados("*", term); // ✅ GLOBAL
        setCoopSugResults(res);
      } finally {
        setLoadingCoopSug(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [coopSugSearch, sugInBase, props.searchCooperados]);



  const [isCoopModal, setIsCoopModal] = useState(false);

  // Relatório de visitas (filtros)
  const [reportPA, setReportPA] = useState<string>('');
  const [reportGerente, setReportGerente] = useState<string>('');
  const [reportProduto, setReportProduto] = useState<string>('');
  const [reportBusca, setReportBusca] = useState<string>('');
  const [reportStart, setReportStart] = useState<string>(''); // yyyy-mm-dd
  const [reportEnd, setReportEnd] = useState<string>(''); // yyyy-mm-dd

  function normalizeTextStrict(text: string) {
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

  const produtoOptions = ['Consórcio', 'Seguro', 'Investimentos', 'Crédito', 'Previdência', 'Compliance', 'Cobrança', 'SIPAG'] as const;

  const filteredVisits = useMemo(() => {
    const s = reportStart ? new Date(`${reportStart}T00:00:00`) : null;
    const e = reportEnd ? new Date(`${reportEnd}T23:59:59`) : null;
    const q = normalizeTextStrict(reportBusca);
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
        const coopName = normalizeTextStrict((v.cooperado as any)?.name || (v.cooperado as any)?.nome || '');
        const coopDoc = ((v.cooperado as any)?.document || (v.cooperado as any)?.documento || '').toString();
        const coopDocDigits = coopDoc.replace(/\D/g, '');
        const summary = normalizeTextStrict(v.summary || '');

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
    const slug = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '')
        .toLowerCase();

    const header = [
      'serial_visita',
      'data',
      'hora',
      'pa',
      'nome_gerente',
      'nome',
      'cpf_cnpj',
      'resumo',
      'prospeccao',
      ...allProducts.map(p => `produto_${slug(p)}`)
    ].join(';');

    const safe = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;

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

      // 🔹 FLAG PROSPECÇÃO
      const isProspeccao = (v.cooperado as any)?.id === 'prospeccao';
      const prospeccaoFlag = isProspeccao ? 'SIM' : '';

      // 🔹 PRODUTOS
      const produtosDaVisita = new Set((v.products || []).map(p => p.product));
      const produtoCols = allProducts.map(p =>
        produtosDaVisita.has(p) ? 'SIM' : ''
      );

      return [
        safe(serial),
        data,
        hora,
        safe(pa),
        safe(gerente),
        safe(nome),
        safe(doc),
        safe(resumo),
        safe(prospeccaoFlag),
        ...produtoCols.map(x => safe(x))
      ].join(';');
    });

    const csv = [header, ...lines].join('\r\n');
    const csvWithBOM = '\uFEFF' + csv;

    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
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
        <button onClick={() => setTab('suggestions')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'suggestions' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>💡 Sugestões </button>
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
                <div className="relative" ref={mgrBoxRef}>
                  <label className="text-xs text-gray-400 font-bold">Gerente</label>

                  <input
                    value={mgrSearch}
                    onChange={(e) => {
                      setMgrSearch(e.target.value);
                      setMgrShow(true);
                      setSelectedManager(null);
                    }}
                    onFocus={() => setMgrShow(true)}
                    placeholder="Digite o nome do gerente..."
                    className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none"
                  />

                  {mgrShow && (
                    <div className="absolute z-50 mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-lg max-h-64 overflow-auto">
                      {gerenteOptions.length === 0 ? (
                        <div className="p-3 text-sm text-gray-400">Nenhum gerente encontrado.</div>
                      ) : (
                        gerenteOptions.map((g: any) => (
                          <button
                            key={g.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSelectedManager(g);
                              setMgrSearch(g.name);
                              setMgrShow(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800"
                          >
                            <b>{g.name}</b>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-gray-500">
                    {selectedManager ? 'Gerente selecionado.' : 'Digite para buscar e selecione na lista.'}
                  </p>
                </div>
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
                  {visibleUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="py-4 font-bold">
                        {u.name}
                        {u.disabled === true ? (
                          <span className="ml-2 text-xs text-yellow-400 font-bold">(DESATIVADO)</span>
                        ) : null}
                      </td>

                      <td className="py-4 text-gray-400 text-sm">{u.email}</td>
                      <td className="py-4 text-sm">{u.agency}</td>

                      <td className="py-4 text-right space-x-4">
                        <button
                          onClick={() => {
                            setModalUser(u);
                            setIsUserModal(true);
                          }}
                          className="text-blue-400 hover:text-blue-300 font-bold text-xs"
                        >
                          EDITAR
                        </button>

                        <button
                          onClick={() => props.onResetUserPassword(u.email)}
                          className="text-yellow-400 hover:text-yellow-300 font-bold text-xs"
                        >
                          RESET SENHA
                        </button>

                        {u.disabled === true ? (
                          <button
                            onClick={() => props.onEnableUser(u.id)}
                            className="text-green-400 hover:text-green-300 font-bold text-xs"
                          >
                            REATIVAR
                          </button>
                        ) : (
                          <button
                            onClick={() => props.onDeleteUser(u.id)}
                            className="text-red-500 hover:text-red-400 font-bold text-xs"
                          >
                            DESATIVAR
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-400">
                Página <b>{usersPage}</b> de <b>{usersTotalPages}</b> · Total: <b>{props.users.length}</b>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                  disabled={usersPage <= 1}
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs px-4 py-2 rounded-lg font-bold"
                >
                  ◀ Anterior
                </button>
                <button
                  onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))}
                  disabled={usersPage >= usersTotalPages}
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs px-4 py-2 rounded-lg font-bold"
                >
                  Próxima ▶
                </button>
              </div>
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

            {!loadingCoops && coopSearch.trim().length >= 2 && coopResults.length === 20 && (
              <div className="mt-3 text-xs text-gray-400">
                Exibindo apenas os primeiros <b>20</b> resultados. Refine a busca para encontrar outros registros.
              </div>
            )}

          </div>
        )}

        {tab === 'suggestions' && (
          <div className="bg-[#1f2937] rounded-2xl border border-gray-700 p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Sugestões de Visita</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Crie uma sugestão para um gerente (gerente e cooperado via autocomplete). Cooperado pode estar na base ou ser manual.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* FORM */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4">Nova sugestão</h3>

                {/* ===== Gerente (Autocomplete) ===== */}
                <div className="relative" ref={mgrBoxRef}>
                  <label className="text-xs text-gray-400 font-bold">Gerente</label>

                  <input
                    value={mgrSearch}
                    onChange={(e) => {
                      setMgrSearch(e.target.value);
                      setMgrShow(true);
                      setSelectedManager(null);
                    }}
                    onFocus={() => setMgrShow(true)}
                    className="mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite nome ou PA..."
                  />

                  {mgrShow && (
                    <div className="absolute z-50 mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-lg max-h-64 overflow-auto">
                      {gerenteOptions.length === 0 ? (
                        <div className="p-3 text-sm text-gray-400">Nenhum gerente encontrado.</div>
                      ) : (
                        gerenteOptions.map((g: any) => (
                          <button
                            key={g.id}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-gray-800"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSelectedManager(g);
                              setSugManagerId(g.id); // mantém seu state atual, se você estiver usando
                              setMgrSearch(`${g.name} — PA ${g.agency}`);
                              setMgrShow(false);
                            }}
                          >
                            <span className="text-sm text-gray-100">
                              <b>{g.name}</b> <span className="text-gray-400">— PA {g.agency}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-gray-500">
                    {selectedManager ? 'Gerente selecionado.' : 'Digite para buscar e selecione na lista.'}
                  </p>
                </div>

                {/* ===== Flag: Cooperado está na base ===== */}
                <div className="mt-4 flex items-center gap-3">
                  <input
                    id="inbase"
                    type="checkbox"
                    checked={sugInBase}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setSugInBase(v);

                      // limpa campos ao alternar
                      setSelectedCoop(null);
                      setCoopSugSearch('');
                      setCoopSugShow(false);
                      setSugManual({ name: '', document: '' });
                    }}
                  />
                  <label htmlFor="inbase" className="text-sm font-bold text-gray-200">
                    Cooperado está na base
                  </label>
                </div>

                {/* ===== Cooperado (Autocomplete se base, manual se não) ===== */}
                {sugInBase ? (
                  <div className="relative mt-4" ref={coopSugBoxRef}>
                    <label className="text-xs text-gray-400 font-bold">Cooperado</label>

                    <input
                      value={coopSugSearch}
                      onChange={(e) => {
                        setCoopSugSearch(e.target.value);
                        setCoopSugShow(true);
                        setSelectedCoop(null);
                      }}
                      onFocus={() => setCoopSugShow(true)}
                      className="mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Digite nome ou CPF/CNPJ..."
                    />

                    {coopSugShow && (
                      <div className="absolute z-50 mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-lg max-h-64 overflow-auto">
                        {loadingCoopSug ? (
                          <div className="p-3 text-sm text-gray-400">Buscando cooperados...</div>
                        ) : cooperadosOptions.length === 0 ? (
                          <div className="p-3 text-sm text-gray-400">Nenhum cooperado encontrado.</div>
                        ) : (
                          cooperadosOptions.map((c: any) => {
                            const displayName = c.name ?? c.nome ?? "Sem nome";
                            const displayDoc = c.document ?? c.documento ?? "";

                            return (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-left px-4 py-3 hover:bg-gray-800"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSelectedCoop(c);
                                  setCoopSugSearch(`${displayName}${displayDoc ? ` / ${displayDoc}` : ""}`);
                                  setCoopSugShow(false);
                                }}
                              >
                                <span className="text-sm text-gray-100">
                                  <b>{displayName}</b>
                                  <span className="text-gray-400">
                                    {displayDoc ? ` / ${displayDoc}` : ""}
                                  </span>
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}

                    <p className="mt-2 text-xs text-gray-500">
                      {selectedCoop ? 'Cooperado selecionado.' : 'Digite para buscar e selecione na lista.'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 font-bold">Nome (manual)</label>
                      <input
                        value={sugManual.name}
                        onChange={(e) => setSugManual(p => ({ ...p, name: e.target.value }))}
                        className="mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Digite o nome..."
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 font-bold">CPF/CNPJ (manual)</label>
                      <input
                        value={sugManual.document}
                        onChange={(e) => setSugManual(p => ({ ...p, document: e.target.value }))}
                        className="mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Digite o CPF/CNPJ..."
                      />
                    </div>

                    <p className="text-xs text-gray-500">
                      Este cooperado não será cadastrado na base, apenas na sugestão.
                    </p>
                  </div>
                )}

                {/* ===== Motivo ===== */}
                <div className="mt-4">
                  <label className="text-xs text-gray-400 font-bold">Motivo da sugestão</label>
                  <textarea
                    value={sugReason}
                    onChange={(e) => setSugReason(e.target.value)}
                    rows={3}
                    className="mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex.: Cooperado sem movimentação há 60 dias, oportunidade RDC/LCA..."
                  />
                </div>

                {/* ===== Salvar ===== */}
                <button
                  disabled={sugSubmitting}
                  onClick={async () => {
                    if (!selectedManager) return alert('Selecione um gerente.');
                    if (!sugReason.trim()) return alert('Informe o motivo da sugestão.');

                    if (sugInBase && !selectedCoop) return alert('Selecione um cooperado da base.');
                    if (!sugInBase && !sugManual.name.trim()) return alert('Informe o nome do cooperado.');

                    const cooperadoFinal = sugInBase
                      ? selectedCoop
                      : { name: sugManual.name.trim(), document: sugManual.document.trim() };

                    setSugSubmitting(true);
                    try {
                      await props.onAddSuggestion({
                        cooperado: cooperadoFinal,
                        cooperadoInBase: sugInBase,
                        manager: { id: selectedManager.id, name: selectedManager.name, agency: selectedManager.agency },
                        suggestedAt: new Date(),
                        suggestedBy: 'Manual',
                        reason: sugReason.trim(),
                      });

                      // reset
                      setSelectedManager(null);
                      setSugManagerId('');
                      setMgrSearch('');
                      setMgrShow(false);

                      setSugInBase(true);
                      setSelectedCoop(null);
                      setCoopSugSearch('');
                      setCoopSugShow(false);
                      setSugManual({ name: '', document: '' });

                      setSugReason('');
                      alert('Sugestão criada com sucesso!');
                    } catch (e: any) {
                      console.error(e);
                      alert(e?.message || 'Erro ao criar sugestão.');
                    } finally {
                      setSugSubmitting(false);
                    }
                  }}
                  className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700 text-xs px-4 py-3 rounded-lg font-bold disabled:opacity-50 transition-colors"
                >
                  {sugSubmitting ? 'Salvando...' : 'Salvar sugestão'}
                </button>
              </div>

              {/* LISTA */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4">Sugestões cadastradas</h3>

                {props.suggestedVisits.length === 0 ? (
                  <div className="text-sm text-gray-400">Nenhuma sugestão cadastrada.</div>
                ) : (
                  <div className="space-y-3">
                    {props.suggestedVisits
                      .slice()
                      .sort((a: any, b: any) => {
                        const da = a.suggestedAt instanceof Date ? a.suggestedAt : new Date(a.suggestedAt as any);
                        const db = b.suggestedAt instanceof Date ? b.suggestedAt : new Date(b.suggestedAt as any);
                        return db.getTime() - da.getTime();
                      })
                      .slice(0, 20)
                      .map((s: any) => {
                        const coop: any = s.cooperado || {};
                        const cooperadoNome = (coop.name ?? coop.nome).toString().trim();
                        const cooperadoDoc = (coop.document ?? coop.documento ?? '').toString().trim();

                        return (
                          <div
                            key={s.id}
                            className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-gray-100 truncate">
                                {cooperadoNome}
                                {s.cooperadoInBase === false ? ' (manual)' : ''}
                              </div>

                              {cooperadoDoc && (
                                <div className="text-[11px] text-gray-400 truncate">
                                  {cooperadoDoc}
                                </div>
                              )}

                              <div className="text-[11px] text-gray-400 truncate">
                                Gerente: {s.manager?.name || '—'} — PA {s.manager?.agency || '—'}
                              </div>

                              <div className="text-xs text-gray-300 mt-2 line-clamp-2">
                                {s.reason}
                              </div>
                            </div>

                            <button
                              onClick={() => props.onRemoveSuggestion(s.id)}
                              className="bg-red-600 hover:bg-red-700 text-xs px-3 py-2 rounded-lg font-bold h-fit transition-colors"
                            >
                              Remover
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {isUserModal && <UserFormModal user={modalUser} onSave={(u) => { modalUser ? props.onUpdateUser(modalUser.id, u) : props.onAddUser(u); setIsUserModal(false); }} onClose={() => setIsUserModal(false)} />}
      {isCoopModal && <CooperadoFormModal cooperado={modalCoop ? normalizeCooperado(modalCoop) : null} managers={props.users} onSave={(c) => { modalCoop ? props.onUpdateCooperado(modalCoop.id, c) : props.onAddCooperado(c); setIsCoopModal(false); }} onClose={() => setIsCoopModal(false)} />}
    </div>
  );
};

export default DeveloperDashboard;
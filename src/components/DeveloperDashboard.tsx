
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import { User, Cooperado, Visit, SuggestedVisit } from '../types';
import Logo from './Logo';
import VisitsMap from './VisitsMap';
import UserFormModal from './UserFormModal';
import CooperadoFormModal from './CooperadoFormModal';
import { Product } from '../types';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import {
  toInputDate,
  startOfCurrentMonth,
  endOfToday,
  isRangeWithinMaxMonths
} from "../utils/dates";

import {
  addSipagMachine,
  listSipagMachines,
  transferSipagMachine,
  SipagMachine,
  deactivateSipagMachine,
  countSipagEstoqueByPA,
  countSipagAtivasComCNPJByPA,
} from "../services/sipag";

import { useFeedback } from "./ui/FeedbackProvider";

import * as XLSX from "xlsx";

import { db } from "../firebase/firebaseConfig";

interface DeveloperDashboardProps {
  currentUser: User;
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
  const roleLower = (props.currentUser?.role || "").toLowerCase();
  const isSipagAdmin = roleLower === "sipag_admin";

  const [tab, setTab] = useState<'map' | 'users' | 'cooperados' | 'reports' | 'suggestions' | 'SIPAG'>(
    isSipagAdmin ? "SIPAG" : "map"
  );
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

  //estados do filtro do mpa
  type DaysBucket = "" | "<70" | "70-90" | "90-180" | "180-360" | ">360";

  //confirm
  const { toast, confirm: confirmAction } = useFeedback();

  //sipag
  const [sipagList, setSipagList] = useState<SipagMachine[]>([]);
  const [sipagFilterPA, setSipagFilterPA] = useState<string>("99");

  const [newSipagSerial, setNewSipagSerial] = useState("");
  const [newSipagNotes, setNewSipagNotes] = useState("");
  const sipagSerialInputRef = useRef<HTMLInputElement | null>(null);
  const [sipagScannerOpen, setSipagScannerOpen] = useState(false);
  const [sipagScannerError, setSipagScannerError] = useState<string>("");
  const [sipagReaderOpen, setSipagReaderOpen] = useState(false);
  const [sipagReaderBuffer, setSipagReaderBuffer] = useState("");
  const [sipagReaderError, setSipagReaderError] = useState<string>("");
  const sipagReaderInputRef = useRef<HTMLInputElement | null>(null);
  const [sipagAutoAdding, setSipagAutoAdding] = useState(false);
  const sipagScannerRef = useRef<Html5Qrcode | null>(null);
  const sipagLastScanRef = useRef<{ text: string; at: number } | null>(null);

  const [transferSerial, setTransferSerial] = useState("");
  const [transferToPA, setTransferToPA] = useState("99");
  const [transferReason, setTransferReason] = useState("");

  const [inactiveSerial, setInactiveSerial] = useState("");
  const [inactiveReason, setInactiveReason] = useState<"MANUTENCAO" | "DESCARTE" | "OUTRO">("MANUTENCAO");
  const [inactiveNote, setInactiveNote] = useState("");

  const sipagAtivas = useMemo(() => sipagList.filter((m: any) => m.isActive !== false), [sipagList]);
  const sipagInativas = useMemo(() => sipagList.filter((m: any) => m.isActive === false), [sipagList]);

  const [sipagCounts, setSipagCounts] = useState<Record<string, { estoque: number; comCooperado: number }>>({});
  const [sipagCountsLoading, setSipagCountsLoading] = useState(false);


  const [mapManagerId, setMapManagerId] = useState<string>(""); // sem filtro
  const [mapWalletManager, setMapWalletManager] = useState<string>("");
  // PA: "" = todos, ou "0".."5"
  const [mapPA, setMapPA] = useState<string>("");
  const [mapDays, setMapDays] = useState<DaysBucket>("<70"); // default econômico
  const [mapVisits, setMapVisits] = useState<Visit[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

  useEffect(() => {
    // sempre que entrar na aba ou a lista mudar, volta para a primeira página
    if (tab === 'users') setUsersPage(1);
  }, [tab, props.users]);

  useEffect(() => {
    if (tab !== "map") return;

    let cancelled = false;

    (async () => {
      setMapLoading(true);
      try {
        const { mode, start, end } = getBucketRange(mapDays);

        // ajuste o limit conforme seu uso
        const MAP_LIMIT = 1000;

        let q;

        if (mode === "range") {
          q = query(
            collection(db, "visits"),
            where("date", ">=", Timestamp.fromDate(start!)),
            where("date", "<", Timestamp.fromDate(end!)),
            orderBy("date", "desc"),
            limit(MAP_LIMIT)
          );
        } else {
          // >360
          q = query(
            collection(db, "visits"),
            where("date", "<", Timestamp.fromDate(end!)),
            orderBy("date", "desc"),
            limit(MAP_LIMIT)
          );
        }

        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => {
          const data = d.data() as any;
          return { ...data, id: d.id, date: toDate(data.date) } as Visit;
        });

        if (!cancelled) setMapVisits(rows);
      } catch (err) {
        console.error("Erro fetch mapa:", err);
        if (!cancelled) setMapVisits([]);
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, mapDays]);

  useEffect(() => {
    if (tab !== "map") setMapVisible(false);
  }, [tab]);

  useEffect(() => {
    if (sipagReaderOpen) {
      setSipagReaderError("");
      setTimeout(() => sipagReaderInputRef.current?.focus(), 0);
    } else {
      setSipagReaderBuffer("");
    }
  }, [sipagReaderOpen]);

  const handleSipagRegister = async (serialRaw: string, opts?: { setInput?: boolean }) => {
    const serial = (serialRaw || "").trim().toUpperCase();
    if (!serial || sipagAutoAdding) return;

    const now = Date.now();
    const last = sipagLastScanRef.current;
    if (last && last.text === serial && now - last.at < 1500) {
      toast.warning("Serial repetido.");
      return;
    }
    sipagLastScanRef.current = { text: serial, at: now };

    setSipagAutoAdding(true);
    try {
      await addSipagMachine(
        serial,
        { uid: props.currentUser.id, name: props.currentUser.name },
        { notes: newSipagNotes }
      );
      if (opts?.setInput !== false) {
        setNewSipagSerial(serial);
      }
      toast.success(`SIPAG ${serial} adicionada ao estoque (PA 99).`);
      refreshSipag();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao adicionar SIPAG.");
    } finally {
      setSipagAutoAdding(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const stopScanner = async () => {
      if (sipagScannerRef.current) {
        try {
          await sipagScannerRef.current.stop();
        } catch {
          // ignore
        }
        try {
          await sipagScannerRef.current.clear();
        } catch {
          // ignore
        }
        sipagScannerRef.current = null;
      }
    };

    const startScanner = async () => {
      setSipagScannerError("");
      const id = "sipag-scanner";
      if (!sipagScannerRef.current) {
        sipagScannerRef.current = new Html5Qrcode(id);
      }

      try {
        await sipagScannerRef.current.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            const now = Date.now();
            const last = sipagLastScanRef.current;
            if (last && last.text === decodedText && now - last.at < 1500) return;
            sipagLastScanRef.current = { text: decodedText, at: now };

            const next = (decodedText || "").trim().toUpperCase();
            if (next) {
              handleSipagRegister(next);
            }
          },
          () => {
            // ignore scan errors
          }
        );
      } catch (e: any) {
        if (!cancelled) {
          setSipagScannerError(e?.message || "Erro ao acessar a câmera.");
        }
      }
    };

    if (sipagScannerOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [sipagScannerOpen, toast]);

  const usersTotalPages = useMemo(() => {
    const total = (props.users || []).length;
    return Math.max(1, Math.ceil(total / USERS_PER_PAGE));
  }, [props.users]);

  const visibleUsers = useMemo(() => {
    const start = (usersPage - 1) * USERS_PER_PAGE;
    return (props.users || []).slice(start, start + USERS_PER_PAGE);
  }, [props.users, usersPage]);

  useEffect(() => {
    if (isSipagAdmin && tab !== "SIPAG") setTab("SIPAG");
  }, [isSipagAdmin, tab]);



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

  async function refreshSipag() {
    try {
      const data = await listSipagMachines({ pa: sipagFilterPA });
      setSipagList(data);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao carregar SIPAG.");
    }
  }

  async function refreshSipagCounts() {
    setSipagCountsLoading(true);
    try {
      const pairs = await Promise.all(
        sipagPAOptions.map(async (pa) => {
          const [estoque, ativas] = await Promise.all([
            countSipagEstoqueByPA(pa),
            countSipagAtivasComCNPJByPA(pa),
          ]);
          return [pa, { estoque, comCooperado: ativas }] as const;
        })
      );

      const next: Record<string, { estoque: number; comCooperado: number }> = {};
      for (const [pa, data] of pairs) {
        next[pa] = data;
      }

      setSipagCounts(next);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar contadores.");
    } finally {
      setSipagCountsLoading(false);
    }
  }
  useEffect(() => {
    if (tab !== "SIPAG") return;
    refreshSipagCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function exportSipagToExcel(filename: string, machines: SipagMachine[]) {
    const rows = machines.map((m: any) => ({
      Serial: m.serial ?? "",
      "PA Atual": m.currentPA ?? "",
      "Status Logístico": m.status ?? "",
      "Status Operacional": m.operationalStatus ?? "",
      CNPJ: m.cooperadoCNPJ ?? "",
      Ativa: m.isActive === false ? "NÃO" : "SIM",
      "Motivo Inativa": m.inactiveReason ?? "",
      "Atualizado em": m.updatedAt?.toDate ? m.updatedAt.toDate().toLocaleString() : "",
      "Última Mov.": m.lastMove
        ? `${m.lastMove.fromPA || "—"} -> ${m.lastMove.toPA || "—"} (${m.lastMove.byName || ""})`
        : "—",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SIPAG");
    XLSX.writeFile(wb, filename);
  }

  function isSipagEstoque(m: any) {
    return m?.isActive !== false && (m?.cooperadoCNPJ == null || m?.cooperadoCNPJ === "");
  }

  function isSipagAtivaComCNPJ(m: any) {
    return m?.isActive !== false && m?.operationalStatus === "COM_COOPERADO";
  }

  function mapSipagRows(machines: SipagMachine[]) {
    return machines.map((m: any) => ({
      Serial: m.serial ?? "",
      "PA Atual": m.currentPA ?? "",
      "Status Logístico": m.status ?? "",
      "Status Operacional": m.operationalStatus ?? "",
      CNPJ: m.cooperadoCNPJ ?? "",
      Ativa: m.isActive === false ? "NÃO" : "SIM",
      "Motivo Inativa": m.inactiveReason ?? "",
      "Atualizado em": m.updatedAt?.toDate ? m.updatedAt.toDate().toLocaleString() : "",
      "Última Mov.": m.lastMove
        ? `${m.lastMove.fromPA || "—"} -> ${m.lastMove.toPA || "—"} (${m.lastMove.byName || ""})`
        : "—",
    }));
  }

  function exportSipagToExcelTwoSheets(filename: string, ativas: SipagMachine[], inativas: SipagMachine[]) {
    const wb = XLSX.utils.book_new();

    const wsAtivas = XLSX.utils.json_to_sheet(mapSipagRows(ativas));
    XLSX.utils.book_append_sheet(wb, wsAtivas, "Ativas");

    const wsInativas = XLSX.utils.json_to_sheet(mapSipagRows(inativas));
    XLSX.utils.book_append_sheet(wb, wsInativas, "Inativas");

    XLSX.writeFile(wb, filename);
  }



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
  const [reportStart, setReportStart] = useState<string>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return toInputDate(start);
  });

  const [reportEnd, setReportEnd] = useState<string>(() => {
    return toInputDate(new Date()); // hoje
  });
  const [reportError, setReportError] = useState<string>("");

  // ✅ filtros aplicados (só mudam quando clicar no botão)
  const [appliedPA, setAppliedPA] = useState<string>('');
  const [appliedGerente, setAppliedGerente] = useState<string>('');
  const [appliedProduto, setAppliedProduto] = useState<string>('');
  const [appliedBusca, setAppliedBusca] = useState<string>('');
  const [appliedStart, setAppliedStart] = useState<string>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return toInputDate(start);
  });

  const [appliedEnd, setAppliedEnd] = useState<string>(() => {
    return toInputDate(new Date());
  });

  //função de busca
  const defaultStartStr = toInputDate(startOfCurrentMonth());
  const defaultEndStr = toInputDate(new Date()); // hoje (só data)

  function normalizeTextStrict(text: string) {
    return (text || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function daysAgo(d: Date): number {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.floor((startOfToday - startOfThatDay) / (1000 * 60 * 60 * 24));
  }

  function daysAgoDate(days: number) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }


  function getBucketRange(bucket: DaysBucket) {
    const now = new Date();
    if (bucket === "<70") return { mode: "range" as const, start: daysAgoDate(70), end: now };
    if (bucket === "70-90") return { mode: "range" as const, start: daysAgoDate(90), end: daysAgoDate(70) };
    if (bucket === "90-180") return { mode: "range" as const, start: daysAgoDate(180), end: daysAgoDate(90) };
    if (bucket === "180-360") return { mode: "range" as const, start: daysAgoDate(360), end: daysAgoDate(180) };
    return { mode: "older" as const, start: null, end: daysAgoDate(360) }; // >360
  }

  function inBucket(days: number, bucket: DaysBucket) {
    if (!bucket) return true;
    if (bucket === "<70") return days < 70;
    if (bucket === "70-90") return days >= 70 && days <= 90;
    return days > 90;
  }

  function toDate(value: any): Date {
    if (value instanceof Date) return value;
    if (value && typeof value === "object" && typeof value.seconds === "number") {
      return new Date(value.seconds * 1000);
    }
    return new Date(value);
  }

  const paOptions = useMemo(() => {
    if (isSipagAdmin) return ["0", "1", "2", "4", "5", "99"];
    const fromUsers = props.users.map(u => (u.agency || '').trim()).filter(Boolean);
    const fromCoops = props.cooperados.map(c => ((c as any).agency || '').toString().trim()).filter(Boolean);
    const fromVisits = props.visits.map(v => (v.manager?.agency || '').toString().trim()).filter(Boolean);
    return Array.from(new Set([...fromUsers, ...fromCoops, ...fromVisits])).sort((a, b) => a.localeCompare(b));
  }, [props.users, props.cooperados, props.visits]);

  const sipagPAOptions = ["0", "1", "2", "4", "5", "99"] as const;

  const produtoOptions = Object.values(Product);

  const filteredVisits = useMemo(() => {
    Object.values(Product);
    const s = appliedStart ? new Date(`${appliedStart}T00:00:00`) : null;
    const e = appliedEnd ? new Date(`${appliedEnd}T23:59:59`) : null;
    const q = normalizeTextStrict(appliedBusca);
    const qDigits = appliedBusca.replace(/\D/g, '');

    return props.visits.filter(v => {
      if (s && v.date < s) return false;
      if (e && v.date > e) return false;

      if (appliedPA) {
        const paVisit = (v.manager?.agency || '').toString().trim();
        const paCoop = ((v.cooperado as any)?.agency || '').toString().trim();
        if (paVisit !== appliedPA && paCoop !== appliedPA) return false;
      }

      if (appliedGerente) {
        const g = (v.manager?.name || '').toString().trim();
        if (g !== appliedGerente) return false;
      }

      if (appliedProduto) {
        const prods = (v as any).products;
        const match =
          Array.isArray(prods) &&
          prods.some((p: any) => (p?.product ?? '').toString().trim() === appliedProduto);
        if (!match) return false;
      }

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
  }, [props.visits, appliedPA, appliedGerente, appliedProduto, appliedBusca, appliedStart, appliedEnd]);

  //graficos visitas por gerente
  const visitsByManager = useMemo(() => {
    type Row = { id: string; name: string; agency: string; count: number };

    const map = new Map<string, Row>();

    for (const v of filteredVisits) {
      const id = (v.manager?.id || "").toString().trim();
      if (!id) continue; // ignora visitas sem gerente válido

      const name = (v.manager?.name || "—").toString().trim() || "—";
      const agency = (v.manager?.agency || "").toString().trim();

      const prev = map.get(id);
      if (!prev) {
        map.set(id, { id, name, agency, count: 1 });
      } else {
        // garante que nome/agency ficam atualizados se vierem diferentes
        map.set(id, {
          ...prev,
          name: name || prev.name,
          agency: agency || prev.agency,
          count: prev.count + 1,
        });
      }
    }

    const rows = Array.from(map.values()).sort((a, b) => b.count - a.count);
    const max = rows[0]?.count || 0;

    return { rows, max };
  }, [filteredVisits]);

  const visitsByPA = useMemo(() => {
    const map = new Map<string, number>();

    for (const v of filteredVisits) {
      const pa =
        (v.manager?.agency || (v.cooperado as any)?.agency || "—").toString().trim() || "—";
      map.set(pa, (map.get(pa) || 0) + 1);
    }

    const rows = Array.from(map.entries())
      .map(([pa, count]) => ({ pa, count }))
      .sort((a, b) => b.count - a.count);

    const max = rows[0]?.count || 0;
    return { rows, max };
  }, [filteredVisits]);

  // B) Produtos mais ofertados (barras verticais)
  const productsStats = useMemo(() => {
    const map = new Map<string, number>();

    for (const v of filteredVisits) {
      const prods = (v as any).products;
      if (!Array.isArray(prods)) continue;

      for (const p of prods) {
        const name = (p?.product || "").toString().trim();
        if (!name) continue;
        map.set(name, (map.get(name) || 0) + 1);
      }
    }

    const rows = Array.from(map.entries())
      .map(([product, count]) => ({ product, count }))
      .sort((a, b) => b.count - a.count);

    const max = rows[0]?.count || 0;
    return { rows, max };
  }, [filteredVisits]);




  //last visit
  const lastVisits = useMemo(() => {
    const m = new Map<string, any>();

    for (const v of mapVisits as any[]) {
      const doc = (v?.cooperado?.document ?? "").replace(/\D/g, "").trim();
      const d = toDate((v as any)?.date);
      if (!doc || !d) continue;

      const prev = m.get(doc);
      const prevDate = prev ? toDate((prev as any)?.date) : null;

      if (!prev || (prevDate && d > prevDate)) {
        m.set(doc, v);
      }
    }

    return Array.from(m.values());
  }, [mapVisits]);

  const filteredMapVisits = useMemo(() => {
    const walletQ = normalizeTextStrict(mapWalletManager);

    return lastVisits.filter((v: any) => {
      // ✅ NÃO MOSTRAR atendimento na agência
      if (v?.inAgency === true) return false;

      // 1) usuário (registrador)
      if (mapManagerId && (v?.manager?.id || "") !== mapManagerId) return false;

      // 2) carteira (gerente dono)
      if (walletQ) {
        const walletName = v?.cooperado?.managerName ?? v?.cooperado?.nome_gerente ?? "";
        if (normalizeTextStrict(String(walletName || "")) !== walletQ) return false;
      }

      // 3) PA (vou considerar PA = manager.agency)
      if (mapPA) {
        const pa = String(v?.manager?.agency ?? "").trim();
        if (pa !== mapPA) return false;
      }

      // 4) período (bucket)
      const dt = toDate(v?.date);
      const days = daysAgo(dt);
      if (!inBucket(days, mapDays)) return false;

      return true;
    });
  }, [lastVisits, mapManagerId, mapWalletManager, mapPA, mapDays]);


  //opções de visita

  const walletManagers = useMemo(() => {
    const set = new Set<string>();

    for (const v of lastVisits as any[]) {
      const nm =
        v?.cooperado?.managerName ??
        v?.cooperado?.nome_gerente ??
        "";
      const s = String(nm || "").trim();
      if (s) set.add(s);
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [lastVisits]);

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

  const reportKpis = useMemo(() => {
    const totalVisits = filteredVisits.length;

    // total de gerentes cadastrados (ajuste se você quiser considerar disabled)
    const totalManagers = (props.users || []).filter(u =>
      (u.role || "").toLowerCase().includes("gerente")
    ).length;

    // gerentes ativos no período (por id)
    const activeManagerIds = new Set(
      filteredVisits
        .map(v => (v.manager?.id || "").toString().trim())
        .filter(Boolean)
    );
    const activeManagers = activeManagerIds.size;

    // total de produtos ofertados (soma simples: 2 produtos na visita conta 2)
    const totalProductsOffered = filteredVisits.reduce((acc, v) => {
      const prods = (v as any).products;
      if (!Array.isArray(prods)) return acc;

      // conta apenas itens com product preenchido
      return acc + prods.filter((p: any) => (p?.product || "").toString().trim()).length;
    }, 0);

    // média produtos por visita
    const avgProductsPerVisit = totalVisits > 0 ? (totalProductsOffered / totalVisits) : 0;

    // média visitas por gerente ativo (visitas / gerentes que registraram)
    const avgVisitsPerActiveManager = activeManagers > 0 ? (totalVisits / activeManagers) : 0;

    return {
      totalVisits,
      totalManagers,
      activeManagers,
      totalProductsOffered,
      avgProductsPerVisit,
      avgVisitsPerActiveManager,
    };
  }, [filteredVisits, props.users]);

  function validateReportDateRange(startStr: string, endStr: string): string {
    if (!startStr) return "Informe a data inicial.";
    if (!endStr) return "Informe a data final.";

    const start = new Date(`${startStr}T00:00:00.000`);
    const end = new Date(`${endStr}T23:59:59.999`);

    if (end < start) return "A data final não pode ser menor que a data inicial.";
    if (!isRangeWithinMaxMonths(start, end, 3)) return "O intervalo máximo permitido é de 3 meses.";

    return "";
  }

  useEffect(() => {
    setReportError(validateReportDateRange(reportStart, reportEnd));
  }, [reportStart, reportEnd]);


  const canApplyReportFilters = reportError === "";

  function downloadCSV() {
    const slug = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '')
        .toLowerCase();

    // Exporta em Excel (XLSX)
    const headerXlsx = [
      'serial_visita',
      'data',
      'hora',
      'pa',
      'nome_gerente',
      'nome',
      'cpf_cnpj',
      'resumo',
      'prospeccao',
      'na_agencia',
      ...allProducts.map(p => `produto_${slug(p)}`)
    ];

    const rowsXlsx = filteredVisits.map(v => {
      const pa = (v.manager?.agency || ((v.cooperado as any)?.agency) || '').toString().trim();
      const gerente = (v.manager?.name || '').toString().trim();
      const nome = (((v.cooperado as any)?.name) || ((v.cooperado as any)?.nome) || '').toString().trim();
      const doc = (((v.cooperado as any)?.document) || ((v.cooperado as any)?.documento) || '').toString().trim();
      const resumo = (v.summary || '').toString().replace(/\s+/g, ' ').trim();
      const serial = (v as any).serial || '';

      const d = v.date instanceof Date ? v.date : new Date(v.date as any);
      const data = d.toLocaleDateString('pt-BR');
      const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const isProspeccao = (v.cooperado as any)?.id === 'prospeccao';
      const prospeccaoFlag = isProspeccao ? 'SIM' : '';
      const naAgenciaFlag = (v as any).inAgency === true ? 'SIM' : '';

      const produtosDaVisita = new Set((v.products || []).map(p => p.product));
      const produtoCols = allProducts.map(p => (produtosDaVisita.has(p) ? 'SIM' : ''));

      return [
        serial,
        data,
        hora,
        pa,
        gerente,
        nome,
        doc,
        resumo,
        prospeccaoFlag,
        naAgenciaFlag,
        ...produtoCols
      ];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headerXlsx, ...rowsXlsx]);
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `relatorio_visitas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }



  function printReport() {
    const title = 'Relatório de Visitas - Sicoob Cooprem';
    const stamp = new Date().toLocaleString('pt-BR');
    const filters = [
      appliedPA ? `PA: ${appliedPA}` : null,
      appliedGerente ? `Gerente: ${appliedGerente}` : null,
      appliedBusca ? `Busca: ${appliedBusca}` : null,
      appliedStart ? `De: ${appliedStart}` : null,
      appliedEnd ? `Até: ${appliedEnd}` : null,
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
        {!isSipagAdmin && (
          <>
            <button onClick={() => setTab('map')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'map' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>🗺️ Mapa Global</button>
            <button onClick={() => setTab('reports')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'reports' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>📄 Relatórios</button>
            <button onClick={() => setTab('users')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'users' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>👥 Gestão de Acessos</button>
            <button onClick={() => setTab('cooperados')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'cooperados' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>🏢 Base de Dados</button>
            <button onClick={() => setTab('suggestions')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'suggestions' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`}>💡 Sugestões </button>
          </>
        )}
        <button onClick={() => setTab("SIPAG")} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${tab === "SIPAG" ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-white'}`} > 💳 SIPAG </button>
      </nav>

      {tab === 'reports' && (
        <div className="bg-[#1f2937] rounded-2xl border border-gray-700 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold">Relatório de Visitas</h2>
              <p className="text-sm text-gray-400 mt-1">
                Filtre por PA, gerente, cooperado/CPF-CNPJ e período. Depois, gere CSV ou imprima para salvar em PDF.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* ✅ novo: aplica filtros */}
              <button
                type="button"
                disabled={!canApplyReportFilters}
                onClick={() => {
                  // reforço: se inválido, não aplica
                  if (!canApplyReportFilters) return;

                  setAppliedPA(reportPA);
                  setAppliedGerente(reportGerente);
                  setAppliedProduto(reportProduto);
                  setAppliedBusca(reportBusca);
                  setAppliedStart(reportStart);
                  setAppliedEnd(reportEnd);
                }}
                className={`text-xs px-4 py-2 rounded-lg font-bold transition-all
                  ${canApplyReportFilters
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-gray-600 opacity-60 cursor-not-allowed"
                  }`}
                title={
                  canApplyReportFilters
                    ? "Aplica os filtros para recalcular a tabela/estatísticas"
                    : reportError || "Preencha as datas para aplicar"
                }
              >
                ✅ Aplicar filtros
              </button>



              <button
                onClick={() => {
                  const ds = toInputDate(startOfCurrentMonth());
                  const de = toInputDate(new Date());

                  // draft
                  setReportPA('');
                  setReportGerente('');
                  setReportProduto('');
                  setReportBusca('');
                  setReportStart(ds);
                  setReportEnd(de);
                  setReportError("");

                  // applied
                  setAppliedPA('');
                  setAppliedGerente('');
                  setAppliedProduto('');
                  setAppliedBusca('');
                  setAppliedStart(ds);
                  setAppliedEnd(de);

                  // autocomplete gerente
                  setMgrSearch('');
                  setSelectedManager(null);
                  setMgrShow(false);
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
                ⬇️ Baixar Excel
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
              <select
                value={reportPA}
                onChange={(e) => setReportPA(e.target.value)}
                className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {paOptions.map((pa) => (
                  <option key={pa} value={pa}>
                    {pa}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-bold">Nome do gerente</label>
              <div className="relative" ref={mgrBoxRef}>
                <input
                  value={mgrSearch}
                  onChange={(e) => {
                    setMgrSearch(e.target.value);
                    setMgrShow(true);
                    setSelectedManager(null);
                    setReportGerente(''); // ✅ digitando não fixa gerente
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
                            setReportGerente(g.name); // ✅ agora o filtro de gerente funciona
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
                <select
                  value={reportProduto}
                  onChange={(e) => setReportProduto(e.target.value)}
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {produtoOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <label className="text-xs text-gray-400 font-bold">Cooperado / CPF-CNPJ / resumo</label>
              <input
                value={reportBusca}
                onChange={(e) => setReportBusca(e.target.value)}
                placeholder="Digite nome, CPF/CNPJ ou palavra do resumo"
                className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-bold">Data inicial</label>
              <input type="date" value={reportStart} onChange={(e) => setReportStart(e.target.value)}
                className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-bold">Data final</label>
              <input type="date" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)}
                className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 🔎 dica do que está aplicado */}
          <div className="mb-4 text-xs text-gray-400">
            <b>Filtros aplicados:</b>{" "}
            {[
              appliedPA ? `PA: ${appliedPA}` : null,
              appliedGerente ? `Gerente: ${appliedGerente}` : null,
              appliedProduto ? `Produto: ${appliedProduto}` : null,
              appliedBusca ? `Busca: ${appliedBusca}` : null,
              appliedStart ? `De: ${appliedStart}` : null,
              appliedEnd ? `Até: ${appliedEnd}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-400 font-bold">Total de visitas</p>
              <p className="text-2xl font-extrabold mt-2">{reportKpis.totalVisits}</p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-400 font-bold">Gerentes ativos</p>
              <p className="text-2xl font-extrabold mt-2">
                {String(reportKpis.activeManagers).padStart(2, "0")}{" "}
                <span className="text-sm text-gray-300 font-bold">
                  de {String(reportKpis.totalManagers).padStart(2, "0")}
                </span>
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-400 font-bold">Produtos ofertados</p>
              <p className="text-2xl font-extrabold mt-2">{reportKpis.totalProductsOffered}</p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-400 font-bold">Média produtos/visita</p>
              <p className="text-2xl font-extrabold mt-2">{reportKpis.avgProductsPerVisit.toFixed(2)}</p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-400 font-bold">Média visitas/gerente</p>
              <p className="text-2xl font-extrabold mt-2">{reportKpis.avgVisitsPerActiveManager.toFixed(2)}</p>
            </div>
          </div>
          {/*começa o grafico aqui */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card 1: Visitas por gerente (o seu atual) */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">Visitas por gerente</h3>
                <span className="text-xs text-gray-400">
                  {visitsByManager.rows.length} gerentes
                </span>
              </div>

              {visitsByManager.rows.length === 0 ? (
                <div className="text-sm text-gray-400">Sem dados para o período selecionado.</div>
              ) : (
                <div className="space-y-2">
                  {visitsByManager.rows.slice(0, 18).map((r) => {
                    const pct = visitsByManager.max ? (r.count / visitsByManager.max) * 100 : 0;

                    return (
                      <div key={r.id} className="flex items-center gap-3">
                        <div className="w-40 text-xs text-gray-200 truncate" title={r.name}>
                          <b>{r.name}</b>
                        </div>

                        <div className="flex-1 h-3 bg-gray-900 border border-gray-700 rounded overflow-hidden">
                          <div className="h-full bg-lime-500" style={{ width: `${pct}%` }} />
                        </div>

                        <div className="w-10 text-right text-xs font-bold text-gray-100">
                          {r.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Card 2: Visitas por PA (A) */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">Visitas por PA</h3>
                <span className="text-xs text-gray-400">
                  {visitsByPA.rows.length} PAs
                </span>
              </div>

              {visitsByPA.rows.length === 0 ? (
                <div className="text-sm text-gray-400">Sem dados para o período selecionado.</div>
              ) : (
                <div className="space-y-2">
                  {visitsByPA.rows.slice(0, 12).map((r) => {
                    const pct = visitsByPA.max ? (r.count / visitsByPA.max) * 100 : 0;

                    return (
                      <div key={r.pa} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-gray-200 truncate" title={r.pa}>
                          <b>{r.pa}</b>
                        </div>

                        <div className="flex-1 h-3 bg-gray-900 border border-gray-700 rounded overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>

                        <div className="w-10 text-right text-xs font-bold text-gray-100">
                          {r.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Card 3: Produtos mais ofertados (B) */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">Produtos mais ofertados</h3>
                <span className="text-xs text-gray-400">
                  Top {Math.min(10, productsStats.rows.length)}
                </span>
              </div>

              {productsStats.rows.length === 0 ? (
                <div className="text-sm text-gray-400">Sem produtos no período selecionado.</div>
              ) : (
                <div className="h-44 flex items-end gap-2">
                  {productsStats.rows.slice(0, 10).map((r) => {
                    const rawPct = productsStats.max ? (r.count / productsStats.max) * 100 : 0;

                    // Se existir contagem, garante uma barrinha mínima visível
                    const pct = r.count > 0 ? Math.max(3, rawPct) : 0;

                    return (
                      <div key={r.product} className="flex-1 min-w-0 flex flex-col items-center">
                        {/* Barra (altura fixa) */}
                        <div
                          className="w-full h-28 bg-gray-900 border border-gray-700 rounded relative overflow-hidden"
                          title={`${r.product}: ${r.count}`}
                        >
                          <div
                            className="absolute bottom-0 left-0 w-full bg-yellow-400"
                            style={{ height: `${pct}%` }}
                          />
                        </div>

                        {/* Label */}
                        <div className="mt-2 text-[10px] text-gray-200 truncate w-full text-center" title={r.product}>
                          {r.product}
                        </div>

                        {/* Valor */}
                        <div className="text-[11px] font-bold text-gray-100">{r.count}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Outros graficos aqui */}


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
                {visibleVisits.map((v) => {
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
                      <td className="py-4 text-sm text-gray-300">
                        {(() => {
                          const prods = (v as any).products;
                          if (!Array.isArray(prods) || prods.length === 0) return '—';
                          const names = prods
                            .map((p: any) => (p?.product ?? '').toString().trim())
                            .filter(Boolean);
                          const uniq = Array.from(new Set(names));
                          return uniq.join(', ') || '—';
                        })()}
                      </td>
                      <td className="py-4 text-sm text-gray-300">{v.summary || '—'}</td>
                    </tr>
                  );
                })}

                {filteredVisits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400">
                      Nenhuma visita encontrada com os filtros atuais.
                    </td>
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
      <main className="p-6 max-w-7xl mx-auto">
        {tab === 'map' && (
          <div className="bg-[#1f2937] rounded-2xl border border-gray-700 overflow-hidden shadow-2xl h-[70vh] flex flex-col">

            {/* FILTROS (header) */}
            <div className="p-4 flex gap-3 items-center border-b border-gray-700">
              <select
                value={mapManagerId}
                onChange={(e) => setMapManagerId(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
              >
                <option value="">Todos os gerentes</option>
                {props.users
                  .filter((u) => (u.role || "").toLowerCase().includes("gerente"))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>

              {/* ✅ novo: filtro por carteira (nome do gerente da carteira) */}
              <select
                value={mapWalletManager}
                onChange={(e) => setMapWalletManager(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
              >
                <option value="">Todas as carteiras</option>
                {walletManagers.map((nm) => (
                  <option key={nm} value={nm}>
                    {nm}
                  </option>
                ))}
              </select>

              <select
                value={mapPA}
                onChange={(e) => setMapPA(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
              >
                <option value="">Todos os PAs</option>
                <option value="0">PA 0</option>
                <option value="1">PA 1</option>
                <option value="2">PA 2</option>
                <option value="3">PA 3</option>
                <option value="4">PA 4</option>
                <option value="5">PA 5</option>
              </select>

              <select
                value={mapDays}
                onChange={(e) => setMapDays(e.target.value as any)}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
              >
                <option value="<70">&lt; 70 dias</option>
                <option value="70-90">70–90 dias</option>
                <option value="90-180">90–180 dias</option>
                <option value="180-360">180–360 dias</option>
                <option value=">360">&gt; 360 dias</option>
              </select>

              <button
                onClick={() => {
                  setMapManagerId("");
                  setMapWalletManager("");
                  setMapDays("<70");
                  setMapPA("");
                }}
                className="ml-auto text-xs font-bold text-gray-300 hover:text-white"
              >
                LIMPAR
              </button>
            </div>

            {/* MAPA (corpo) */}
            <div className="flex-1">
              {!mapVisible ? (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-8 max-w-md text-center">
                    <div className="text-sm text-gray-400 uppercase tracking-widest">
                      Mapa Oculto
                    </div>
                    <div className="text-lg font-semibold text-white mt-2">
                      Carregue o mapa sob demanda
                    </div>
                    <div className="text-sm text-gray-400 mt-2">
                      Clique no botão abaixo para exibir as visitas no mapa.
                    </div>
                    <button
                      type="button"
                      onClick={() => setMapVisible(true)}
                      className="mt-4 px-5 py-2 rounded-xl bg-gray-800 text-gray-100 hover:bg-gray-700 border border-gray-700 text-sm font-semibold"
                    >
                      Abrir mapa
                    </button>
                  </div>
                </div>
              ) : (
                <VisitsMap visits={filteredMapVisits} />
              )}
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

        {tab === "SIPAG" && (
          <div className="space-y-6">

            {/* Filtro por PA */}
            <div className="flex items-end gap-3 flex-wrap border border-gray-800 rounded-2xl p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
              <div>
                <label className="text-xs text-gray-400">PA (99 = Estoque)</label>
                <select
                  value={sipagFilterPA}
                  onChange={(e) => setSipagFilterPA(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200"
                >
                  {paOptions.map((pa) => (
                    <option key={pa} value={pa}>
                      {pa === "99" ? "PA 99 (Estoque)" : `PA ${pa}`}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={refreshSipag}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white border border-gray-700 hover:bg-black"
              >
                Atualizar
              </button>
            </div>

            {/* Entrada no estoque */}
            <div className="border border-gray-800 rounded-2xl p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
              <h3 className="font-semibold text-gray-100">Entrada no Estoque (PA 99)</h3>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Serial</label>
                  <input
                    ref={sipagSerialInputRef}
                    value={newSipagSerial}
                    onChange={(e) => setNewSipagSerial(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200"
                    placeholder="Ex: ABC123..."
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSipagScannerOpen(true)}
                      className="px-3 py-2 rounded-xl bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs border border-gray-700"
                    >
                      Ler com câmera
                    </button>
                    <button
                      type="button"
                      onClick={() => setSipagReaderOpen(true)}
                      className="px-3 py-2 rounded-xl bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs border border-gray-700"
                    >
                      Ler com leitor
                    </button>
                    <span className="text-[11px] text-gray-500">
                      Leitor USB/Bluetooth: escaneie direto no campo.
                    </span>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-400">Observação (opcional)</label>
                  <input
                    value={newSipagNotes}
                    onChange={(e) => setNewSipagNotes(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200"
                    placeholder="Ex: lote, fornecedor, etc."
                  />
                </div>
              </div>

              <div className="mt-3">
                <button
                  onClick={async () => {
                    try {
                      await handleSipagRegister(newSipagSerial);
                      setNewSipagNotes("");
                    } catch (e: any) {
                      console.error(e);
                      toast.error(e?.message || "Erro ao adicionar SIPAG.");
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-white text-black hover:bg-gray-200"
                >
                  Adicionar
                </button>
              </div>
            </div>

            {/* Transferência */}
            <div className="border border-gray-800 rounded-2xl p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
              <h3 className="font-semibold text-gray-100">Transferir SIPAG</h3>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Serial</label>
                  <input
                    value={transferSerial}
                    onChange={(e) => setTransferSerial(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200"
                    placeholder="Serial da máquina"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400">Para PA (99 = estoque)</label>
                  <select
                    value={transferToPA}
                    onChange={(e) => setTransferToPA(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200"
                  >
                    {paOptions.map((pa) => (
                      <option key={pa} value={pa}>
                        {pa === "99" ? "99 (Estoque)" : `PA ${pa}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400">Motivo (opcional)</label>
                  <input
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200"
                    placeholder="Ex: instalação / devolução / troca"
                  />
                </div>
              </div>

              <div className="mt-3">
                <button
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: "Confirmar transferência",
                      message: `Transferir ${transferSerial.trim().toUpperCase()} para o PA ${transferToPA}?`,
                      confirmText: "Transferir",
                      cancelText: "Cancelar",
                    });
                    if (!ok) return;

                    try {
                      await transferSipagMachine({
                        serialRaw: transferSerial,
                        toPA: transferToPA,
                        reason: transferReason,
                        by: { uid: props.currentUser.id, name: props.currentUser.name },
                      });

                      toast.success("Transferência registrada.");
                      setTransferReason("");
                      refreshSipag();
                    } catch (e: any) {
                      console.error(e);
                      toast.error(e?.message || "Erro ao transferir SIPAG.");
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white border border-gray-700 hover:bg-black"
                >
                  Transferir
                </button>
              </div>
            </div>

            {/*Inativar SIPAG*/}
            <div className="border border-gray-800 rounded-2xl p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
              <h3 className="font-semibold text-gray-100">Inativar SIPAG (Manutenção/Remoção)</h3>
              <p className="text-sm text-gray-400 mt-1">
                Isso não apaga a máquina. Ela fica marcada como inativa e sai do fluxo normal.
              </p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Serial</label>
                  <input
                    value={inactiveSerial}
                    onChange={(e) => setInactiveSerial(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200"
                    placeholder="Serial da máquina"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400">Motivo</label>
                  <select
                    value={inactiveReason}
                    onChange={(e) => setInactiveReason(e.target.value as any)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200"
                  >
                    <option value="MANUTENCAO">Manutenção</option>
                    <option value="DESCARTE">Descarte</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400">Observação (opcional)</label>
                  <input
                    value={inactiveNote}
                    onChange={(e) => setInactiveNote(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200"
                    placeholder="Ex: defeito, chamado, motivo..."
                  />
                </div>
              </div>

              <div className="mt-3">
                <button
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: "Confirmar inativação",
                      message: `Inativar a SIPAG ${inactiveSerial.trim().toUpperCase()}?`,
                      confirmText: "Inativar",
                      cancelText: "Cancelar",
                    });
                    if (!ok) return;

                    try {
                      await deactivateSipagMachine({
                        serialRaw: inactiveSerial,
                        reason: inactiveReason,
                        note: inactiveNote,
                        by: { uid: props.currentUser.id, name: props.currentUser.name },
                      });
                      toast.success("SIPAG inativada.");
                      setInactiveSerial("");
                      setInactiveNote("");
                      refreshSipag();
                    } catch (e: any) {
                      console.error(e);
                      toast.error(e?.message || "Erro ao inativar SIPAG.");
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
                >
                  Inativar
                </button>
              </div>
            </div>

            {/*Botão de Refresh SIAPG*/}
            <div className="border border-gray-800 rounded-2xl p-4 mb-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-gray-200 font-semibold">Resumo por PA</div>

                <button
                  type="button"
                  onClick={refreshSipagCounts}
                  className="px-3 py-2 rounded-xl bg-gray-800 text-gray-200 hover:bg-gray-700 text-sm"
                >
                  Atualizar
                </button>
              </div>

              {sipagCountsLoading ? (
                <div className="mt-3 text-sm text-gray-500">Carregando contadores...</div>
              ) : (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {sipagPAOptions.map((pa) => (
                    <div key={pa} className="border border-gray-800 rounded-2xl p-4 bg-black/20">
                      <div className="text-gray-200 font-semibold">
                        {pa === "99" ? "PA 99 (Estoque)" : `PA ${pa}`}
                      </div>

                      <div className="mt-2 text-sm text-gray-400">
                        Estoque:{" "}
                        <span className="text-gray-200 font-semibold">
                          {sipagCounts[pa]?.estoque ?? 0}
                        </span>
                      </div>

                      <div className="text-sm text-gray-400">
                        Ativas (com CNPJ):{" "}
                        <span className="text-gray-200 font-semibold">
                          {sipagCounts[pa]?.comCooperado ?? 0}
                        </span>
                      </div>

                      <div className="mt-3 flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const machines = await listSipagMachines({ pa });
                              const estoque = machines.filter(isSipagEstoque);
                              exportSipagToExcel(`sipag_estoque_PA${pa}.xlsx`, estoque);
                              toast.success(`Excel de estoque do PA ${pa} gerado.`);
                            } catch (e: any) {
                              console.error(e);
                              toast.error(e?.message || `Erro ao baixar estoque do PA ${pa}.`);
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs border border-gray-700"
                        >
                          Baixar Excel (Estoque)
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const machines = await listSipagMachines({ pa });
                              const ativas = machines.filter(isSipagAtivaComCNPJ);
                              exportSipagToExcel(`sipag_ativas_PA${pa}.xlsx`, ativas);
                              toast.success(`Excel de ativas do PA ${pa} gerado.`);
                            } catch (e: any) {
                              console.error(e);
                              toast.error(e?.message || `Erro ao baixar ativas do PA ${pa}.`);
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs border border-gray-700"
                        >
                          Baixar Excel (Ativas)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lista */}
            <div className="border border-gray-800 rounded-2xl p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-gray-400">
                    Exportação SIPAG
                  </div>
                  <div className="text-lg font-semibold text-white">
                    Planilha Completa (Ativas + Inativas)
                  </div>
                  <div className="text-sm text-gray-400 mt-1 max-w-xl">
                    Gera um arquivo com duas abas: Ativas e Inativas. Inclui todos os PAs.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const allMachines = await listSipagMachines(); // ✅ todos os PAs

                      const ativas = allMachines.filter((m: any) => m.isActive !== false);
                      const inativas = allMachines.filter((m: any) => m.isActive === false);

                      exportSipagToExcelTwoSheets("sipag_todos_PAs.xlsx", ativas, inativas);
                      toast.success("Excel gerado.");
                    } catch (e: any) {
                      console.error(e);
                      toast.error(e?.message || "Erro ao baixar todos os PAs.");
                    }
                  }}
                  className="px-5 py-3 rounded-2xl bg-gray-800 text-gray-100 hover:bg-gray-700 border border-gray-700 text-sm font-semibold"
                >
                  Baixar Excel (Todos os PAs)
                </button>
              </div>
            </div>
            {/* */}
          </div>
        )}


      </main>

      {isUserModal && <UserFormModal user={modalUser} onSave={(u) => { modalUser ? props.onUpdateUser(modalUser.id, u) : props.onAddUser(u); setIsUserModal(false); }} onClose={() => setIsUserModal(false)} />}
      {isCoopModal && <CooperadoFormModal cooperado={modalCoop ? normalizeCooperado(modalCoop) : null} managers={props.users} onSave={(c) => { modalCoop ? props.onUpdateCooperado(modalCoop.id, c) : props.onAddCooperado(c); setIsCoopModal(false); }} onClose={() => setIsCoopModal(false)} />}

      {sipagScannerOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-gray-400">Leitor de código</div>
                <div className="text-lg font-semibold text-white">SIPAG - Serial</div>
              </div>
              <button
                type="button"
                onClick={() => setSipagScannerOpen(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mt-4">
              <div id="sipag-scanner" className="w-full rounded-xl overflow-hidden bg-black/40 border border-gray-800 min-h-[240px]" />
              {sipagScannerError && (
                <div className="mt-3 text-sm text-red-400">
                  {sipagScannerError}
                </div>
              )}
              <div className="mt-3 text-xs text-gray-400">
                A leitura é contínua. O serial será preenchido no campo automaticamente.
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSipagScannerOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700 text-sm"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {sipagReaderOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-gray-400">Leitor de código</div>
                <div className="text-lg font-semibold text-white">SIPAG - Serial (Leitor)</div>
              </div>
              <button
                type="button"
                onClick={() => setSipagReaderOpen(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs text-gray-400">Aponte o leitor para o código</label>
              <input
                ref={sipagReaderInputRef}
                value={sipagReaderBuffer}
                onChange={(e) => setSipagReaderBuffer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSipagRegister(sipagReaderBuffer, { setInput: false });
                          setSipagReaderBuffer("");
                        }
                      }}
                className="mt-2 w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200"
                placeholder="Aguardando leitura..."
              />
              {sipagReaderError && (
                <div className="mt-3 text-sm text-red-400">
                  {sipagReaderError}
                </div>
              )}
              <div className="mt-3 text-xs text-gray-400">
                A leitura é contínua. A cada leitura com Enter, o serial é registrado no PA 99.
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSipagReaderOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700 text-sm"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperDashboard;

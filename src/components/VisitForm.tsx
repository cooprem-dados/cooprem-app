import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Cooperado, Visit, Product } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import { useFeedback } from "./ui/FeedbackProvider";
import { User } from '../types';
import { sipagEntrega, sipagDevolucao, sipagTroca, normalizeCNPJ, hasActiveSipagForCNPJ } from '../services/sipag';

interface VisitFormProps {
  user: User;
  /**
   * Fallback/local list (ex.: dev/admin screens). For user common, prefer remote search via searchCooperados.
   */
  cooperados: Cooperado[];

  /**
   * Remote search (recommended): called with PA + search term, must return at most 20 cooperados.
   * If not provided, the component falls back to filtering `cooperados` locally.
   */
  searchCooperados?: (pa: string, term: string) => Promise<Cooperado[]>;

  /**
   * Current user's PA (used for remote search). If not provided, remote search won't run.
   */
  currentPA?: string;

  addVisit: (v: Omit<Visit, 'id' | 'manager'>) => Promise<void>;
  onClose: () => void;

  suggestionId?: string | null;
  onRemoveSuggestion?: (id: string) => Promise<void>;
  prefilledCooperado: Cooperado | null;
}

type AnyCooperado = any;

const VisitForm: React.FC<VisitFormProps> = ({
  user,
  cooperados,
  searchCooperados,
  currentPA,
  addVisit,
  onClose,
  suggestionId,
  onRemoveSuggestion,
  prefilledCooperado,
}) => {
  const [coopId, setCoopId] = useState(prefilledCooperado?.id || '');
  const [summary, setSummary] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const { location, loading: geoLoading, getLocation } = useGeolocation();
  const [submitting, setSubmitting] = useState(false);
  const [isProspeccao, setIsProspeccao] = useState(false);
  const [manualCoop, setManualCoop] = useState({ name: "", document: "" });
  const [inAgency, setInAgency] = useState(false);

  //erro usuarios conserta
  const [selectedCooperado, setSelectedCooperado] = useState<Cooperado | null>(prefilledCooperado ?? null);

  // Autocomplete states
  const [coopSearch, setCoopSearch] = useState('');
  const [showCoopOptions, setShowCoopOptions] = useState(false);
  const coopBoxRef = useRef<HTMLDivElement | null>(null);

  // Remote search states
  const [cooperadosResults, setCooperadosResults] = useState<Cooperado[]>([]);
  const [loadingCooperados, setLoadingCooperados] = useState(false);
  const lastReqIdRef = useRef(0);

  const { toast } = useFeedback();

  useEffect(() => { getLocation(); }, [getLocation]);

  //Dashboard SIPAG
  type SipagActionUI = '' | 'ENTREGA' | 'TROCA' | 'DEVOLUCAO';

  const [sipagAction, setSipagAction] = useState<SipagActionUI>('');
  const [sipagCnpj, setSipagCnpj] = useState('');
  const [sipagSerialEntrega, setSipagSerialEntrega] = useState('');
  const [sipagSerialDevolucao, setSipagSerialDevolucao] = useState('');
  const [sipagSerialTrocaSai, setSipagSerialTrocaSai] = useState('');
  const [sipagSerialTrocaEntra, setSipagSerialTrocaEntra] = useState('');
  const [sipagJustificativa, setSipagJustificativa] = useState('');
  const [checkingCoopSipag, setCheckingCoopSipag] = useState(false);
  const [coopHasSipag, setCoopHasSipag] = useState(false);

  // Helpers for search
  const normalizeText = (v: any) =>
    String(v ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const normalizeDoc = (v: any) => String(v ?? '').replace(/\D/g, '').trim();

  // Local normalized list (fallback only)
  const cooperadosNormalized = useMemo(() => {
    return (cooperados || []).map((c: AnyCooperado) => {
      const displayName = c.name ?? c.nome ?? '';
      const displayDoc = c.document ?? c.documento ?? '';
      return {
        ...c,
        displayName,
        displayDoc,
        nameKey: normalizeText(displayName),
        docKey: normalizeDoc(displayDoc),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperados]);

  // Remote search handler (PA + limit 20)
  const runRemoteSearch = useCallback(async (term: string) => {
    if (!searchCooperados) return;
    const pa = currentPA || '';
    const raw = term.trim();
    const minChars = pa === '*' ? 3 : 2;
    if (!pa || raw.length < minChars) {
      setCooperadosResults([]);
      return;
    }

    const reqId = ++lastReqIdRef.current;
    try {
      setLoadingCooperados(true);
      const res = await searchCooperados(pa, raw);
      // Avoid race conditions (only keep latest response)
      if (reqId === lastReqIdRef.current) {
        setCooperadosResults(Array.isArray(res) ? res.slice(0, 20) : []);
      }
    } finally {
      if (reqId === lastReqIdRef.current) setLoadingCooperados(false);
    }
  }, [searchCooperados, currentPA]);

  // Debounce remote search while typing
  useEffect(() => {
    if (!searchCooperados || prefilledCooperado) return;
    const pa = currentPA || '';
    const minChars = pa === '*' ? 3 : 2;
    const raw = coopSearch.trim();
    if (!raw || raw.length < minChars) {
      setCooperadosResults([]);
      return;
    }

    const t = setTimeout(() => {
      runRemoteSearch(raw);
    }, 350);

    return () => clearTimeout(t);
  }, [coopSearch, runRemoteSearch, searchCooperados, prefilledCooperado, currentPA]);

  useEffect(() => {
    const hasSipagMaquina = selectedProducts.includes(Product.SIPAG_MAQUINA);
    if (!hasSipagMaquina) {
      setSipagAction("");
      setSipagCnpj("");
      setSipagSerialEntrega("");
      setSipagSerialDevolucao("");
      setSipagSerialTrocaSai("");
      setSipagSerialTrocaEntra("");
      setSipagJustificativa("");
      setCheckingCoopSipag(false);
      setCoopHasSipag(false);
    }
  }, [selectedProducts]);

  // Options shown in dropdown:
  // - If remote search is enabled: show remote results only (already limited to 20)
  // - Else: local filter + slice(0, 20)
  const filteredOptions = useMemo(() => {
    // Remote mode
    if (searchCooperados) {
      const list = (cooperadosResults || []).map((c: AnyCooperado) => {
        const displayName = c.name ?? c.nome ?? '';
        const displayDoc = c.document ?? c.documento ?? '';
        return { ...c, displayName, displayDoc };
      });
      return list.slice(0, 20);
    }

    // Local mode (fallback)
    const raw = coopSearch.trim();
    const qName = normalizeText(raw);
    const qDoc = normalizeDoc(raw);

    if (!qName && !qDoc) return cooperadosNormalized.slice(0, 20);

    return cooperadosNormalized
      .filter((c: AnyCooperado) => {
        const byName = qName ? String(c.nameKey || '').includes(qName) : false;
        const byDoc = qDoc ? String(c.docKey || '').includes(qDoc) : false;
        return byName || byDoc;
      })
      .slice(0, 20);
  }, [coopSearch, cooperadosNormalized, searchCooperados, cooperadosResults]);

  //sipag useeffect
  useEffect(() => {
    const doc = selectedCooperado?.document ?? '';
    const digits = normalizeCNPJ(doc);
    if (digits) setSipagCnpj(digits);
  }, [selectedCooperado]);

  useEffect(() => {
    if (sipagAction !== "DEVOLUCAO" && sipagAction !== "TROCA") {
      setSipagJustificativa("");
    }
  }, [sipagAction]);

  useEffect(() => {
    const needsCheck = selectedProducts.includes(Product.SIPAG_MAQUINA);
    if (!needsCheck) return;

    const digits = normalizeCNPJ(
      sipagCnpj ||
      selectedCooperado?.document ||
      manualCoop.document ||
      ""
    );

    if (digits.length !== 14) {
      setCoopHasSipag(false);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setCheckingCoopSipag(true);
        const ok = await hasActiveSipagForCNPJ(digits);
        if (!cancelled) setCoopHasSipag(ok);
      } catch {
        if (!cancelled) setCoopHasSipag(false);
      } finally {
        if (!cancelled) setCheckingCoopSipag(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [selectedProducts, sipagCnpj, selectedCooperado, manualCoop.document]);

  // If prefilled cooperado, lock input and show value as "nome / documento"
  /*
  useEffect(() => {
    if (prefilledCooperado) {
      setIsProspeccao(false);
      setManualCoop({ name: "", document: "" });
      const pc: AnyCooperado = prefilledCooperado as any;
      const displayName = pc.name ?? pc.nome ?? '';
      const displayDoc = pc.document ?? pc.documento ?? '';
      setCoopId(pc.id ?? '');
      setCoopSearch(`${displayName || 'Sem nome'}${displayDoc ? ` / ${displayDoc}` : ''}`);
      setShowCoopOptions(false);
    }
  }, [prefilledCooperado]);*/

  useEffect(() => {
    if (!prefilledCooperado) return;

    const raw: any = prefilledCooperado;

    // normaliza campos vindos da sugestão
    const name = (raw.name ?? raw.nome ?? 'Sem nome').trim();
    const doc = (raw.document ?? raw.documento ?? '').trim();

    // Detecta sugestão manual/prospecção:
    // - id "prospeccao"/"manual" OU
    // - não tem id confiável
    const isManual = raw.id === 'prospeccao' || raw.id === 'manual' || !raw.id;

    if (isManual) {
      // ✅ ativa modo manual e preenche campos
      setIsProspeccao(true);
      setManualCoop({ name, document: doc });
      setCoopId('prospeccao');
      setCoopSearch(`${name}${doc ? ` / ${doc}` : ''}`);
      setShowCoopOptions(false);
      return;
    }

    // ✅ Cooperado normal (com id)
    setIsProspeccao(false);
    setManualCoop({ name: '', document: '' }); // opcional: limpa manual
    setCoopId(raw.id);

    setCoopSearch(`${name}${doc ? ` / ${doc}` : ''}`);
    setShowCoopOptions(false);
  }, [prefilledCooperado]);

  // Close dropdown on outside click
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!coopBoxRef.current) return;
      if (!coopBoxRef.current.contains(e.target as Node)) setShowCoopOptions(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  // Close dropdown on ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCoopOptions(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasBaseCoop = !isProspeccao && (!!prefilledCooperado?.id || !!selectedCooperado?.id);
    const hasManualCoop = isProspeccao && manualCoop.name.trim().length > 0;

    if ((!hasBaseCoop && !hasManualCoop) || !summary || selectedProducts.length === 0) {
      return toast.warning("Preencha todos os campos.");
    }

    // Resolve cooperado (sem depender de cooperadosResults no submit)
    let cooperado: Cooperado;

    if (isProspeccao) {
      cooperado = {
        id: "prospeccao",
        name: manualCoop.name.trim(),
        document: manualCoop.document.trim(),
        isPortfolio: false,
        managerName: "",
      };
    } else if (prefilledCooperado?.id) {
      const raw: any = prefilledCooperado;
      const base: Cooperado = {
        id: raw.id,
        name: raw.name ?? raw.nome ?? "Sem nome",
        document: raw.document ?? raw.documento ?? "",
        isPortfolio: Boolean(raw.isPortfolio ?? false),
        managerName: raw.managerName ?? raw.nome_gerente,
      };

      // ✅ não enviar agency undefined (Firestore não aceita)
      cooperado =
        raw.agency != null && String(raw.agency).trim() !== ""
          ? { ...base, agency: String(raw.agency) }
          : base;
    } else {
      if (!selectedCooperado?.id) {
        toast.warning("Selecione um cooperado da lista.");
        return;
      }

      // opcional: garante consistência com o coopId
      if (coopId && selectedCooperado.id !== coopId) {
        toast.error("O cooperado selecionado não confere. Selecione novamente.");
        return;
      }

      cooperado = selectedCooperado;
    }

    setSubmitting(true);
    try {
      // 🔹 SIPAG: executar ação antes de salvar a visit
      if (selectedProducts.includes(Product.SIPAG_MAQUINA)) {
        if (!sipagAction) {
          toast.warning("Selecione a ação SIPAG: Entrega, Troca ou Devolução.");
          return;
        }

        if ((sipagAction === "DEVOLUCAO" || sipagAction === "TROCA") && !coopHasSipag) {
          toast.warning("Cooperado sem máquina SIPAG vinculada. Não é possível devolver ou trocar.");
          return;
        }

        if ((sipagAction === "DEVOLUCAO" || sipagAction === "TROCA") && !sipagJustificativa.trim()) {
          toast.warning("Informe a justificativa para devolução ou troca.");
          return;
        }

        const by = { uid: user.id, name: user.name };

        if (sipagAction === "ENTREGA") {
          const cnpj = normalizeCNPJ(
            sipagCnpj || cooperado.document || ""
          );

          await sipagEntrega({
            serialEntrega: sipagSerialEntrega,
            cooperadoCNPJ: cnpj,
            by,
            note: "Ação SIPAG via visita",
          });
        }

        if (sipagAction === "DEVOLUCAO") {
          await sipagDevolucao({
            serialDevolucao: sipagSerialDevolucao,
            by,
            note: sipagJustificativa.trim(),
          });
        }

        if (sipagAction === "TROCA") {
          const cnpj = normalizeCNPJ(
            sipagCnpj || cooperado.document || ""
          );

          await sipagTroca({
            serialSaiDoCooperado: sipagSerialTrocaSai,
            serialVaiProCooperado: sipagSerialTrocaEntra,
            cooperadoCNPJ: cnpj,
            by,
            note: sipagJustificativa.trim(),
          });
        }
      }

      await addVisit({
        cooperado,
        date: new Date(),
        location,
        summary,
        products: selectedProducts.map((p) => ({ product: p })),
        inAgency,
      });

      if (suggestionId && onRemoveSuggestion) {
        await onRemoveSuggestion(suggestionId);
      }

      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar a visita. Verifique permissões/rede.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleProduct = (p: Product) => {
    if (!canSelectProducts) return;
    setSelectedProducts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };
  const hasBaseCoopSelected = !isProspeccao && (!!prefilledCooperado?.id || !!selectedCooperado?.id);
  const hasManualCoopSelected = isProspeccao && manualCoop.name.trim().length > 0;
  const canSelectProducts = hasBaseCoopSelected || hasManualCoopSelected;
  const pa = (currentPA ?? '').trim();
  const minChars = pa === '*' ? 3 : 2;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Registrar Visita</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Botão de Prospecção */}
          <button
            type="button"
            disabled={!!prefilledCooperado}
            onClick={() => {
              setIsProspeccao((prev) => {
                const next = !prev;

                if (next) {
                  setCoopId('');
                  setCoopSearch('');
                  setShowCoopOptions(false);
                  setCooperadosResults([]);
                } else {
                  setManualCoop({ name: "", document: "" });
                }

                return next;
              });
            }}
            className={`w-full px-4 py-2 rounded-lg border font-semibold ${isProspeccao ? "bg-gray-100" : "bg-white"
              } disabled:opacity-50`}
          >
            Visita de prospecção
          </button>

          {/* Cooperado (normal) ou manual (prospecção) */}
          {isProspeccao ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Nome do cooperado (prospecção)
                </label>
                <input
                  value={manualCoop.name}
                  onChange={(e) => setManualCoop((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Digite o nome..."
                  className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#005058]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  CPF/CNPJ (opcional)
                </label>
                <input
                  value={manualCoop.document}
                  onChange={(e) => setManualCoop((p) => ({ ...p, document: e.target.value }))}
                  placeholder="Digite o CPF/CNPJ..."
                  className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#005058]"
                />
              </div>

              <p className="mt-2 text-xs text-gray-500">
                Prospecção: o cooperado será registrado apenas nesta visita (não entra na base).
              </p>
            </div>
          ) : (
            <div className="relative" ref={coopBoxRef}>
              <label className="block text-sm font-bold text-gray-700 mb-2">Cooperado</label>

              <input
                value={coopSearch}
                onChange={(e) => {
                  const v = e.target.value;
                  setCoopSearch(v);
                  setShowCoopOptions(true);

                  if (!prefilledCooperado) {
                    setCoopId('');
                    setSelectedCooperado(null); // ✅ importante
                  }
                }}
                onFocus={() => setShowCoopOptions(true)}
                placeholder="Digite nome ou CPF/CNPJ..."
                disabled={!!prefilledCooperado}
                className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#005058]"
              />

              {!prefilledCooperado && showCoopOptions && (
                <div className="absolute z-50 mt-2 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-auto">
                  {loadingCooperados && searchCooperados ? (
                    <div className="p-3 text-sm text-gray-500">Buscando cooperados...</div>
                  ) : filteredOptions.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">
                      {searchCooperados && coopSearch.trim().length >= minChars && !pa
                        ? 'PA não informado para busca.'
                        : 'Nenhum cooperado encontrado.'}
                    </div>
                  ) : (
                    filteredOptions.map((c: AnyCooperado) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-gray-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const picked: Cooperado = {
                            id: c.id,
                            name: c.displayName ?? c.name ?? c.nome ?? "Sem nome",
                            document: c.displayDoc ?? c.document ?? c.documento ?? "",
                            isPortfolio: Boolean(
                              c.isPortfolio ?? c.portfolio ?? c.is_portfolio ?? c.inPortfolio ?? false
                            ),
                            managerName: c.managerName ?? c.nome_gerente,
                            agency: c.agency ?? c.PA ?? c.pa,
                          };

                          setSelectedCooperado(picked);
                          setCoopId(picked.id);
                          setCoopSearch(`${picked.name}${picked.document ? ` / ${picked.document}` : ""}`);
                          setShowCoopOptions(false);
                        }}
                      >
                        <span className="text-sm text-gray-800">
                          <b>{c.displayName || 'Sem nome'}</b>
                          {c.displayDoc ? ` / ${c.displayDoc}` : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {!prefilledCooperado && (
                <p className="mt-2 text-xs text-gray-500">
                  {coopId ? 'Cooperado selecionado.' : (searchCooperados ? 'Digite para buscar (máx. 20 resultados).' : 'Digite para buscar e selecione na lista.')}
                </p>
              )}
            </div>
          )}

          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 font-semibold">
              <input
                type="checkbox"
                checked={inAgency}
                onChange={(e) => setInAgency(e.target.checked)}
                className="w-4 h-4"
              />
              Atendimento na agência
            </label>

            <p className="text-xs text-gray-500 mt-1">
              Se marcado, esta visita não aparecerá no mapa.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Resumo da Visita</label>
            <textarea
              rows={3}
              className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#005058]"
              placeholder="O que foi discutido?"
              value={summary}
              onChange={e => setSummary(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Produtos Discutidos</label>
            {!canSelectProducts && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                Selecione um cooperado antes de escolher os produtos. Em prospecção, informe o nome do cooperado.
              </p>
            )}
            <div className={`flex flex-wrap gap-2 ${!canSelectProducts ? "opacity-50 pointer-events-none" : ""}`}>
              {Object.values(Product).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProduct(p)}
                  disabled={!canSelectProducts}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedProducts.includes(p) ? 'bg-[#005058] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} ${!canSelectProducts ? 'cursor-not-allowed' : ''}`}
                >
                  {p}
                </button>
              ))}
              {selectedProducts.includes(Product.SIPAG_MAQUINA) && (
                <div className="mt-4 p-3 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm font-bold text-gray-800">SIPAG</div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button"
                      onClick={() => setSipagAction('ENTREGA')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold ${sipagAction === 'ENTREGA' ? 'bg-[#005058] text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                      Entrega
                    </button>

                    <button type="button"
                      onClick={() => setSipagAction('TROCA')}
                      disabled={!coopHasSipag || checkingCoopSipag}
                      title={!coopHasSipag ? "Cooperado sem SIPAG vinculada" : (checkingCoopSipag ? "Verificando vínculo" : "")}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${sipagAction === 'TROCA' ? 'bg-[#005058] text-white' : 'bg-white border border-gray-200 text-gray-700'} ${(!coopHasSipag || checkingCoopSipag) ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200' : 'hover:bg-gray-50'}`}>
                      Troca
                    </button>

                    <button type="button"
                      onClick={() => setSipagAction('DEVOLUCAO')}
                      disabled={!coopHasSipag || checkingCoopSipag}
                      title={!coopHasSipag ? "Cooperado sem SIPAG vinculada" : (checkingCoopSipag ? "Verificando vínculo" : "")}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${sipagAction === 'DEVOLUCAO' ? 'bg-[#005058] text-white' : 'bg-white border border-gray-200 text-gray-700'} ${(!coopHasSipag || checkingCoopSipag) ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200' : 'hover:bg-gray-50'}`}>
                      Devolução
                    </button>
                  </div>

                  {(sipagAction === 'DEVOLUCAO' || sipagAction === 'TROCA') && (
                    <div className="mt-3">
                      {checkingCoopSipag ? (
                        <p className="text-xs text-gray-500">Verificando vínculo da SIPAG...</p>
                      ) : !coopHasSipag ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Cooperado sem máquina SIPAG vinculada. Troca/Devolução bloqueadas.
                        </p>
                      ) : null}

                      <label className="block text-xs font-semibold text-gray-600 mt-2">Justificativa</label>
                      <textarea
                        rows={2}
                        value={sipagJustificativa}
                        onChange={(e) => setSipagJustificativa(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200"
                        placeholder="Descreva o motivo da devolução/troca"
                      />
                    </div>
                  )}

                  {/* CNPJ (obrigatório quando entrega/troca) */}
                  {(sipagAction === 'ENTREGA' || sipagAction === 'TROCA') && (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-gray-600">CNPJ do cooperado</label>
                      <input
                        value={sipagCnpj}
                        onChange={(e) => setSipagCnpj(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200"
                        placeholder="Somente números"
                      />
                    </div>
                  )}

                  {/* ENTREGA */}
                  {sipagAction === 'ENTREGA' && (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-gray-600">Serial (sai do estoque → cooperado)</label>
                      <input
                        value={sipagSerialEntrega}
                        onChange={(e) => setSipagSerialEntrega(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200"
                        placeholder="Serial da máquina"
                      />
                    </div>
                  )}

                  {/* DEVOLUÇÃO */}
                  {sipagAction === 'DEVOLUCAO' && (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-gray-600">Serial (sai do cooperado → estoque)</label>
                      <input
                        value={sipagSerialDevolucao}
                        onChange={(e) => setSipagSerialDevolucao(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200"
                        placeholder="Serial da máquina"
                      />
                    </div>
                  )}

                  {/* TROCA */}
                  {sipagAction === 'TROCA' && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600">Serial que sai do cooperado → estoque</label>
                        <input
                          value={sipagSerialTrocaSai}
                          onChange={(e) => setSipagSerialTrocaSai(e.target.value)}
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200"
                          placeholder="Serial devolvida"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600">Serial que sai do estoque → cooperado</label>
                        <input
                          value={sipagSerialTrocaEntra}
                          onChange={(e) => setSipagSerialTrocaEntra(e.target.value)}
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200"
                          placeholder="Serial entregue"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">📍 Localização</span>
            <span className="text-[10px] text-gray-400">
              {geoLoading ? 'Obtendo...' : (location ? 'Capturada com sucesso' : 'Não capturada')}
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#16a34a] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Salvando...' : 'Confirmar Registro'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VisitForm;

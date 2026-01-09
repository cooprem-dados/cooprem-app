import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Cooperado, Visit, Product } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';

interface VisitFormProps {
  cooperados: Cooperado[];
  addVisit: (v: Omit<Visit, 'id' | 'manager'>) => Promise<void>;
  onClose: () => void;
  prefilledCooperado: Cooperado | null;
}

type AnyCooperado = any;

const VisitForm: React.FC<VisitFormProps> = ({ cooperados, addVisit, onClose, prefilledCooperado }) => {
  const [coopId, setCoopId] = useState(prefilledCooperado?.id || '');
  const [summary, setSummary] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const { location, loading: geoLoading, getLocation } = useGeolocation();
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete states
  const [coopSearch, setCoopSearch] = useState('');
  const [showCoopOptions, setShowCoopOptions] = useState(false);
  const coopBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { getLocation(); }, [getLocation]);

  // Helpers for search
  const normalizeText = (v: any) =>
    String(v ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normalizeDoc = (v: any) => String(v ?? '').replace(/\D/g, '');

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

  const filteredOptions = useMemo(() => {
    const raw = coopSearch.trim();
    const qName = normalizeText(raw);
    const qDoc = normalizeDoc(raw);

    // If empty, show initial slice
    if (!qName && !qDoc) return cooperadosNormalized.slice(0, 30);

    return cooperadosNormalized
      .filter((c: AnyCooperado) => {
        const byName = qName ? String(c.nameKey || '').includes(qName) : false;
        const byDoc = qDoc ? String(c.docKey || '').includes(qDoc) : false;
        return byName || byDoc;
      })
      .slice(0, 30);
  }, [coopSearch, cooperadosNormalized]);

  // If prefilled cooperado, lock input and show value as "nome / documento"
  useEffect(() => {
    if (prefilledCooperado) {
      const pc: AnyCooperado = prefilledCooperado as any;
      const displayName = pc.name ?? pc.nome ?? '';
      const displayDoc = pc.document ?? pc.documento ?? '';
      setCoopId(pc.id ?? '');
      setCoopSearch(`${displayName || 'Sem nome'}${displayDoc ? ` / ${displayDoc}` : ''}`);
      setShowCoopOptions(false);
    }
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
  if (!coopId || !summary || selectedProducts.length === 0) {
    return alert("Preencha todos os campos");
  }

  // Normalize cooperado fields (Firestore uses nome/documento/nome_gerente)
  const raw: AnyCooperado = (cooperados as AnyCooperado[]).find(c => c.id === coopId);

  const cooperado: Cooperado = raw
    ? ({
        ...raw,
        name: raw.name ?? raw.nome ?? 'Sem nome',
        document: raw.document ?? raw.documento ?? '',
        managerName: raw.managerName ?? raw.nome_gerente ?? '',
      } as Cooperado)
    : ({ id: coopId, name: 'Outro', document: '' } as Cooperado);

  setSubmitting(true);
  try {
    await addVisit({
      cooperado,
      date: new Date(),
      location: location,
      summary,
      products: selectedProducts.map(p => ({ product: p })),
    });

    // opcional: fechar o modal ao salvar
    onClose();
  } catch (err: any) {
    console.error(err);
    alert(err?.message || "Erro ao salvar a visita. Verifique permissões/rede.");
  } finally {
    setSubmitting(false);
  }
};


  const toggleProduct = (p: Product) => {
    setSelectedProducts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Registrar Visita</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative" ref={coopBoxRef}>
            <label className="block text-sm font-bold text-gray-700 mb-2">Cooperado</label>

            <input
              value={coopSearch}
              onChange={(e) => {
                setCoopSearch(e.target.value);
                setShowCoopOptions(true);
                if (!prefilledCooperado) setCoopId('');
              }}
              onFocus={() => setShowCoopOptions(true)}
              placeholder="Digite nome ou CPF/CNPJ..."
              disabled={!!prefilledCooperado}
              className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#005058]"
            />

            {!prefilledCooperado && showCoopOptions && (
              <div className="absolute z-50 mt-2 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-auto">
                {filteredOptions.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">Nenhum cooperado encontrado.</div>
                ) : (
                  filteredOptions.map((c: AnyCooperado) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-gray-50"
                      onMouseDown={(e) => e.preventDefault()} // avoid blur before click
                      onClick={() => {
                        setCoopId(c.id);
                        setCoopSearch(`${c.displayName || 'Sem nome'}${c.displayDoc ? ` / ${c.displayDoc}` : ''}`);
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
                {coopId ? 'Cooperado selecionado.' : 'Digite para buscar e selecione na lista.'}
              </p>
            )}
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
            <div className="flex flex-wrap gap-2">
              {Object.values(Product).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProduct(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedProducts.includes(p) ? 'bg-[#005058] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {p}
                </button>
              ))}
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

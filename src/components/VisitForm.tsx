import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Cooperado, Product, Visit, ProductDetail } from '../types';
import { PRODUCTS } from '../constants';
import { useGeolocation } from '../hooks/useGeolocation';

interface VisitFormProps {
  cooperados: Cooperado[];
  addVisit: (visit: Omit<Visit, 'id' | 'manager'>) => Promise<void>;
  onClose: () => void;
  prefilledCooperado?: Cooperado | null;
}

const VisitForm: React.FC<VisitFormProps> = ({ cooperados, addVisit, onClose, prefilledCooperado }) => {
  const [selectedCooperadoId, setSelectedCooperadoId] = useState<string>(prefilledCooperado?.id || '');
  const [isNewCooperado, setIsNewCooperado] = useState(false);
  const [newCooperadoName, setNewCooperadoName] = useState('');
  const [newCooperadoDoc, setNewCooperadoDoc] = useState('');
  const [date] = useState<string>(() => {
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
    return localDate.toISOString().split('T')[0];
  });
  const [summary, setSummary] = useState('');
  const [activeProducts, setActiveProducts] = useState<Product[]>([]);
  const [investmentOptions, setInvestmentOptions] = useState({ novoRecurso: { selected: false, observation: '' }, duvidasGerais: { selected: false, observation: '' } });
  const { location, getLocation, resetLocation, loading: geoLoading, error: geoError } = useGeolocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [cooperadoSearchTerm, setCooperadoSearchTerm] = useState(prefilledCooperado?.name || '');
  const [isCooperadoListOpen, setIsCooperadoListOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getLocation(); return () => resetLocation(); }, [getLocation, resetLocation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsCooperadoListOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProductToggle = (product: Product) => {
    setActiveProducts(prev => {
      const newActive = prev.includes(product) ? prev.filter(p => p !== product) : [...prev, product];
      if (product === Product.Investimentos && !newActive.includes(Product.Investimentos)) {
        setInvestmentOptions({ novoRecurso: { selected: false, observation: '' }, duvidasGerais: { selected: false, observation: '' } });
      }
      return newActive;
    });
  };

  const handleInvestmentChange = (option: 'novoRecurso' | 'duvidasGerais', type: 'selected' | 'observation', value: string | boolean) => {
    setInvestmentOptions(prev => ({ ...prev, [option]: { ...prev[option], [type]: value } }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewCooperado && !selectedCooperadoId) { alert('Selecione um cooperado.'); return; }
    
    const cooperadoData = isNewCooperado ? { name: newCooperadoName, document: newCooperadoDoc } : cooperados.find(c => c.id === selectedCooperadoId);
    
    const finalProducts: ProductDetail[] = activeProducts.filter(p => p !== Product.Investimentos).map(p => ({ product: p }));
    if (investmentOptions.novoRecurso.selected) finalProducts.push({ product: Product.Investimentos, subProduct: 'Novo recurso', observation: investmentOptions.novoRecurso.observation.trim() || undefined });
    if (investmentOptions.duvidasGerais.selected) finalProducts.push({ product: Product.Investimentos, subProduct: 'Dúvidas gerais', observation: investmentOptions.duvidasGerais.observation.trim() || undefined });

    if (!cooperadoData || !summary) { alert('Preencha os campos.'); return; }
    if (finalProducts.length === 0) { alert('Selecione um produto.'); return; }

    setIsSubmitting(true);
    try {
      await addVisit({ cooperado: cooperadoData, date: new Date(`${date}T00:00:00`), location, summary, products: finalProducts });
    } catch (error) { console.error(error); alert("Erro ao salvar."); setIsSubmitting(false); }
  };

  const filteredPortfolioCooperados = useMemo(() => {
    const term = cooperadoSearchTerm.toLowerCase().trim();
    if (!term) return [];
    return cooperados.filter(c => c.isPortfolio && (c.name.toLowerCase().includes(term) || c.document.includes(term)));
  }, [cooperadoSearchTerm, cooperados]);

  const handleCooperadoSelect = (cooperado: Cooperado) => {
    setSelectedCooperadoId(cooperado.id);
    setCooperadoSearchTerm(cooperado.name);
    setIsCooperadoListOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-full overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex justify-between items-start mb-4"><h2 className="text-2xl font-bold text-gray-800">Nova Visita</h2><button type="button" onClick={onClose} className="text-gray-400">X</button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-gray-700 text-sm font-bold mb-2">Cooperado</label>
              <div className="flex items-center space-x-4"><input type="checkbox" checked={isNewCooperado} onChange={(e) => { setIsNewCooperado(e.target.checked); setSelectedCooperadoId(''); setCooperadoSearchTerm(''); }} /><label className="text-sm">Cooperado fora da carteira</label></div>
              {isNewCooperado ? (
                <div className="mt-4 grid grid-cols-2 gap-4"><input type="text" placeholder="Nome" value={newCooperadoName} onChange={e => setNewCooperadoName(e.target.value)} className="border rounded p-2" /><input type="text" placeholder="CPF/CNPJ" value={newCooperadoDoc} onChange={e => setNewCooperadoDoc(e.target.value)} className="border rounded p-2" /></div>
              ) : (
                <div className="relative mt-2" ref={searchContainerRef}>
                  <input type="text" placeholder="Buscar..." value={cooperadoSearchTerm} onChange={(e) => { setCooperadoSearchTerm(e.target.value); setSelectedCooperadoId(''); setIsCooperadoListOpen(true); }} className="border rounded w-full p-2" disabled={!!prefilledCooperado} />
                  {isCooperadoListOpen && !prefilledCooperado && filteredPortfolioCooperados.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border mt-1 max-h-60 overflow-y-auto shadow-lg"><ul>{filteredPortfolioCooperados.map(c => (<li key={c.id} onClick={() => handleCooperadoSelect(c)} className="p-2 hover:bg-gray-100 cursor-pointer">{c.name} ({c.document})</li>))}</ul></div>
                  )}
                </div>
              )}
            </div>
            <div><label className="block text-gray-700 text-sm font-bold mb-2">Data</label><input type="date" value={date} readOnly className="border rounded w-full p-2 bg-gray-200" /></div>
            <div><label className="block text-gray-700 text-sm font-bold mb-2">Localização</label><div className="p-2 border rounded bg-gray-50 text-xs">{location ? `Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}` : (geoLoading ? "Obtendo..." : "Sem localização")}</div></div>
            <div className="col-span-2"><label className="block text-gray-700 text-sm font-bold mb-2">Resumo</label><textarea value={summary} onChange={e => setSummary(e.target.value)} rows={4} className="border rounded w-full p-2" /></div>
            <div className="col-span-2"><label className="block text-gray-700 text-sm font-bold mb-2">Produtos</label><div className="flex flex-wrap gap-2">{PRODUCTS.map(p => (<button type="button" key={p} onClick={() => handleProductToggle(p)} className={`px-3 py-1 rounded-full text-sm font-semibold ${activeProducts.includes(p) ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{p}</button>))}</div></div>
          </div>
          <div className="mt-8 flex justify-end gap-4"><button type="button" onClick={onClose} className="bg-gray-300 rounded px-4 py-2">Cancelar</button><button type="submit" disabled={isSubmitting} className="bg-green-600 text-white rounded px-4 py-2 font-bold">{isSubmitting ? 'Salvando...' : 'Salvar'}</button></div>
        </form>
      </div>
    </div>
  );
};
export default VisitForm;
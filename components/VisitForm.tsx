
import React, { useState, useEffect } from 'react';
import { Cooperado, Visit, Product } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';

interface VisitFormProps {
  cooperados: Cooperado[];
  addVisit: (v: Omit<Visit, 'id' | 'manager'>) => Promise<void>;
  onClose: () => void;
  prefilledCooperado: Cooperado | null;
}

const VisitForm: React.FC<VisitFormProps> = ({ cooperados, addVisit, onClose, prefilledCooperado }) => {
  const [coopId, setCoopId] = useState(prefilledCooperado?.id || '');
  const [summary, setSummary] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const { location, loading: geoLoading, getLocation } = useGeolocation();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { getLocation(); }, [getLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coopId || !summary || selectedProducts.length === 0) return alert("Preencha todos os campos");
    
    const cooperado = cooperados.find(c => c.id === coopId) || { name: 'Outro', document: '' };
    
    setSubmitting(true);
    await addVisit({
      cooperado: cooperado as Cooperado,
      date: new Date(),
      location: location,
      summary,
      products: selectedProducts.map(p => ({ product: p }))
    });
    setSubmitting(false);
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
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Cooperado</label>
            <select 
              className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#005058]"
              value={coopId}
              onChange={e => setCoopId(e.target.value)}
              disabled={!!prefilledCooperado}
            >
              <option value="">Selecione um cooperado...</option>
              {cooperados.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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

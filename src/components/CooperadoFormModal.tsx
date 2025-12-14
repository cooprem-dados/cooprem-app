import React, { useState, useEffect } from 'react';
import { Cooperado, User } from '../types';

interface CooperadoFormModalProps {
  cooperado: Cooperado | null;
  managers: User[];
  onSave: (cooperadoData: Omit<Cooperado, 'id'>) => void;
  onClose: () => void;
}

const CooperadoFormModal: React.FC<CooperadoFormModalProps> = ({ cooperado, managers, onSave, onClose }) => {
  const [formData, setFormData] = useState({ 
    name: '', 
    document: '', 
    isPortfolio: true, 
    managerName: '', 
    agency: '' 
  });

  useEffect(() => {
    if (cooperado) {
      setFormData({ 
        name: cooperado.name, 
        document: cooperado.document, 
        isPortfolio: cooperado.isPortfolio, 
        managerName: cooperado.managerName || '', 
        agency: cooperado.agency || '' 
      });
    } else {
      setFormData({ 
        name: '', 
        document: '', 
        isPortfolio: true, 
        managerName: '', 
        agency: '' 
      });
    }
  }, [cooperado]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'managerName') {
        const selectedMgr = managers.find(m => m.name === value);
        setFormData(prev => ({ 
          ...prev, 
          managerName: value, 
          agency: selectedMgr ? selectedMgr.agency : '' 
        }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({ ...prev, isPortfolio: e.target.checked }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // CORREÇÃO: Enviamos apenas os dados do formulário, sem o ID, pois o tipo Omit<Cooperado, 'id'> exige isso.
    onSave({ ...formData });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-700 rounded-lg shadow-xl w-full max-w-lg">
        <form onSubmit={handleSubmit} className="p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-200">{cooperado ? 'Editar Cooperado' : 'Novo Cooperado'}</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">X</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-bold mb-2">Nome</label>
              <input 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                required 
                className="bg-gray-600 rounded w-full py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500" 
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-bold mb-2">CPF/CNPJ</label>
              <input 
                type="text" 
                name="document" 
                value={formData.document} 
                onChange={handleChange} 
                required 
                className="bg-gray-600 rounded w-full py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500" 
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-bold mb-2">Gerente</label>
              <select 
                name="managerName" 
                value={formData.managerName} 
                onChange={handleChange} 
                className="bg-gray-600 rounded w-full py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Selecione</option>
                {managers.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="isPortfolio" 
                checked={formData.isPortfolio} 
                onChange={handleCheckboxChange} 
                className="h-4 w-4 bg-gray-600 border-gray-500 rounded focus:ring-green-500" 
              />
              <label htmlFor="isPortfolio" className="ml-2 block text-gray-300 text-sm">Faz parte da carteira</label>
            </div>
          </div>
          <div className="mt-8 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition duration-200">Cancelar</button>
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-200">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CooperadoFormModal;
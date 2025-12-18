
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
    managerName: '' 
  });

  useEffect(() => {
    if (cooperado) {
      setFormData({ 
        name: cooperado.name, 
        document: cooperado.document, 
        isPortfolio: cooperado.isPortfolio, 
        managerName: cooperado.managerName || '' 
      });
    } else {
      setFormData({ 
        name: '', 
        document: '', 
        isPortfolio: true, 
        managerName: '' 
      });
    }
  }, [cooperado]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({ ...prev, isPortfolio: e.target.checked }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData });
  };

  const inputStyle = { backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '0.25rem', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block', color: '#d1d5db', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ backgroundColor: '#374151', borderRadius: '0.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '32rem' }}>
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e5e7eb', margin: 0 }}>{cooperado ? 'Editar Cooperado' : 'Novo Cooperado'}</h2>
            <button type="button" onClick={onClose} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>X</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Nome / Razão Social</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CPF / CNPJ</label>
              <input type="text" name="document" value={formData.document} onChange={handleChange} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Gerente Responsável</label>
              <select name="managerName" value={formData.managerName} onChange={handleChange} style={inputStyle}>
                <option value="">Selecione um gerente...</option>
                {managers.map(m => (
                  <option key={m.id} value={m.name}>{m.name} ({m.agency})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem' }}>
              <input 
                type="checkbox" 
                id="isPortfolio" 
                checked={formData.isPortfolio} 
                onChange={handleCheckboxChange} 
                style={{ height: '1.2rem', width: '1.2rem', cursor: 'pointer' }} 
              />
              <label htmlFor="isPortfolio" style={{ marginLeft: '0.75rem', display: 'block', color: '#d1d5db', fontSize: '0.9rem', cursor: 'pointer' }}>
                Cooperado de Carteira (Monitorado)
              </label>
            </div>
          </div>
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" onClick={onClose} style={{ backgroundColor: '#6b7280', color: 'white', fontWeight: 'bold', padding: '0.6rem 1.2rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', fontWeight: 'bold', padding: '0.6rem 1.2rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}>Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CooperadoFormModal;

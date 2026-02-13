
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface UserFormModalProps {
  user: User | null;
  onSave: (userData: User) => void;
  onClose: () => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ user, onSave, onClose }) => {
  // Fix: Role must match the enum in root types.ts ('Gerente' | 'Desenvolvedor')
  const [formData, setFormData] = useState<Omit<User, 'id'>>({
    name: '',
    email: '',
    password: '',
    role: 'Gerente',
    agency: ''
  });

  const paOptions = ["0", "1", "2", "4", "5", "99"];

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        agency: user.agency
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(user ? { ...formData, id: user.id } : { ...formData, id: '' } as User);
  };

  const inputStyle = { backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '0.25rem', padding: '0.5rem 0.75rem', width: '100%', boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block', color: '#d1d5db', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ backgroundColor: '#374151', borderRadius: '0.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '32rem' }}>
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e5e7eb', margin: 0 }}>{user ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            <button type="button" onClick={onClose} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>X</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div><label style={labelStyle}>Nome</label><input type="text" name="name" value={formData.name} onChange={handleChange} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} required style={inputStyle} /></div>
            {!user && (<div><label style={labelStyle}>Senha Provisória</label><input type="password" name="password" value={formData.password} onChange={handleChange} required style={inputStyle} /></div>)}
            <div>
              <label style={labelStyle}>Nível de Acesso</label>
              <select name="role" value={formData.role} onChange={handleChange as any} style={inputStyle}>
                <option value="Gerente">Gerente</option>
                <option value="Desenvolvedor">Desenvolvedor</option>
                <option value="sipag_admin">SIPAG Admin</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Agência (PA)</label>
              <select
                name="agency"
                value={formData.agency}
                onChange={handleChange}
                required
                style={inputStyle}
              >
                <option value="">Selecione o PA</option>
                {paOptions.map((pa) => (
                  <option key={pa} value={pa}>
                    {pa}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" onClick={onClose} style={{ backgroundColor: '#6b7280', color: 'white', fontWeight: 'bold', padding: '0.5rem 1rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', fontWeight: 'bold', padding: '0.5rem 1rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}>Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;

import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface UserFormModalProps {
  user: User | null; 
  onSave: (userData: User) => void;
  onClose: () => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<User, 'id'>>({ name: '', email: '', password: '', role: 'Gerente de Relacionamento', agency: '' });

  useEffect(() => {
    if (user) setFormData({ name: user.name, email: user.email, password: user.password, role: user.role, agency: user.agency });
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(user ? { ...formData, id: user.id } : { ...formData, id: '' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-700 rounded-lg shadow-xl w-full max-w-lg">
        <form onSubmit={handleSubmit} className="p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-200">{user ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            <button type="button" onClick={onClose} className="text-gray-400">X</button>
          </div>
          <div className="space-y-4">
            <div><label className="block text-gray-300 text-sm font-bold mb-2">Nome</label><input type="text" name="name" value={formData.name} onChange={handleChange} required className="bg-gray-600 rounded w-full py-2 px-3 text-white" /></div>
            <div><label className="block text-gray-300 text-sm font-bold mb-2">Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} required className="bg-gray-600 rounded w-full py-2 px-3 text-white" /></div>
            {!user && (<div><label className="block text-gray-300 text-sm font-bold mb-2">Senha Provisória</label><input type="password" name="password" value={formData.password} onChange={handleChange} required className="bg-gray-600 rounded w-full py-2 px-3 text-white" /></div>)}
             <div><label className="block text-gray-300 text-sm font-bold mb-2">Função</label><input type="text" name="role" value={formData.role} onChange={handleChange} required className="bg-gray-600 rounded w-full py-2 px-3 text-white" /></div>
            <div><label className="block text-gray-300 text-sm font-bold mb-2">Agência (PA)</label><input type="text" name="agency" value={formData.agency} onChange={handleChange} required className="bg-gray-600 rounded w-full py-2 px-3 text-white" /></div>
          </div>
          <div className="mt-8 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-gray-500 text-white font-bold py-2 px-4 rounded">Cancelar</button>
            <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default UserFormModal;
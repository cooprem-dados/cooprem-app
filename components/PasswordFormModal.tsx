
import React, { useState } from 'react';
import { User } from '../types';

interface PasswordFormModalProps {
  user: User;
  onSave: (userId: string, newPass: string) => void;
  onClose: () => void;
}

const PasswordFormModal: React.FC<PasswordFormModalProps> = ({ user, onSave, onClose }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Senhas não coincidem.'); return; }
    if (password.length < 6) { setError('Mínimo 6 caracteres.'); return; }
    onSave(user.id, password);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1f2937] rounded-xl shadow-2xl w-full max-w-sm p-6 text-white">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold">Alterar Senha: {user.name}</h2>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Nova Senha</label>
            <input 
              type="password" 
              className="w-full bg-gray-700 p-2 rounded outline-none focus:ring-1 focus:ring-yellow-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Confirmar Senha</label>
            <input 
              type="password" 
              className="w-full bg-gray-700 p-2 rounded outline-none focus:ring-1 focus:ring-yellow-500"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-600 py-2 rounded font-bold text-sm">Cancelar</button>
            <button type="submit" className="flex-1 bg-yellow-600 py-2 rounded font-bold text-sm text-gray-900">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordFormModal;

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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-700 rounded-lg shadow-xl w-full max-w-sm">
        <form onSubmit={handleSubmit} className="p-6 text-white">
          <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">Alterar Senha de {user.name}</h2><button type="button" onClick={onClose} className="text-gray-400">X</button></div>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="space-y-4">
            <div><label className="block text-gray-300 text-sm font-bold mb-2">Nova Senha</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-gray-600 rounded w-full py-2 px-3 text-white" /></div>
            <div><label className="block text-gray-300 text-sm font-bold mb-2">Confirmar</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="bg-gray-600 rounded w-full py-2 px-3 text-white" /></div>
          </div>
          <div className="mt-6 flex justify-end gap-4"><button type="button" onClick={onClose} className="bg-gray-500 rounded px-4 py-2">Cancelar</button><button type="submit" className="bg-yellow-500 text-gray-900 rounded px-4 py-2 font-bold">Salvar</button></div>
        </form>
      </div>
    </div>
  );
};
export default PasswordFormModal;
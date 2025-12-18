
import React, { useState } from 'react';
import Logo from './Logo';

interface LoginScreenProps {
  onLogin: (email: string, pass: string) => Promise<boolean>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const success = await onLogin(email, password);
    if (!success) setError(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#005058] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">Registro de Visitas</h1>
        <p className="text-gray-500 text-center mb-8">Sicoob Cooprem</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-200">
            Email ou senha incorretos.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email Corporativo</label>
            <input 
              type="email" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#005058] outline-none"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
            <input 
              type="password" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#005058] outline-none"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#005058] text-white p-3 rounded-lg font-bold hover:bg-[#003d44] transition-colors"
          >
            {loading ? 'Entrando...' : 'Acessar Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;

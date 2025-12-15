import React, { useState } from 'react';
import Logo from './Logo';
import { auth, db } from '../firebaseConfig';

interface LoginScreenProps {
  onLogin: (email: string, pass: string) => Promise<boolean>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const success = await onLogin(email, password);
    if (!success) {
      setError('Credenciais inválidas ou erro de conexão. Tente novamente.');
      setIsLoading(false);
    }
  };

  const handleCreateAdmin = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm("Deseja configurar o usuário administrador padrão (genildo.filho@sicoob.com.br)?")) return;

    setIsLoading(true);
    try {
        const userCredential = await auth.createUserWithEmailAndPassword("genildo.filho@sicoob.com.br", "123456");
        const uid = userCredential.user?.uid;

        if (uid) {
            await db.collection('users').doc(uid).set({
                name: "Genildo Filho",
                email: "genildo.filho@sicoob.com.br",
                role: "Desenvolvedor",
                agency: "Sede",
                password: "123456" 
            });
            alert("Usuário Admin criado com sucesso! Tente fazer login agora.");
            setEmail("genildo.filho@sicoob.com.br");
            setPassword("123456");
        } else {
            throw new Error("Falha ao obter UID do usuário criado.");
        }
    } catch (err: any) {
        console.error(err);
        if (err.code === 'auth/email-already-in-use') {
            alert("Este usuário já existe. Tente fazer login ou verifique o console do Firebase.");
        } else {
            alert("Erro ao criar admin: " + err.message);
        }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#005058] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <Logo className="mx-auto w-20 h-auto mb-6" />
          <h1 className="text-3xl font-extrabold text-gray-800">Registro de Visitas</h1>
          <p className="text-lg text-gray-500 mt-1">Sicoob Cooprem</p>
        </div>
        
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert"><span className="block sm:inline">{error}</span></div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-200"
              placeholder="seu.email@sicoob.com.br"
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-200"
              placeholder="******************"
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between mt-6">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex justify-center items-center h-10"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : ( 'Entrar' )}
            </button>
          </div>
        </form>
      </div>
       <footer className="text-center text-gray-300 text-xs mt-8">
          <p className="mb-1">Versão 1.0 - Produção Firebase</p>
          <p className="mb-2">&copy;{new Date().getFullYear()} Sicoob Cooprem. Todos os direitos reservados.</p>
          
          <button 
            onClick={handleCreateAdmin}
            className="text-green-300 hover:text-green-100 underline mt-4 opacity-80 hover:opacity-100 transition-opacity"
          >
            Primeiro Acesso? Criar Admin
          </button>
      </footer>
    </div>
  );
};

export default LoginScreen;
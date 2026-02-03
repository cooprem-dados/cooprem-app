
export enum Product {
  RDC = 'RDC',
  LCA = 'LCA',
  Conta_capital = 'Conta Capital',
  Cheque_especial = 'Cheque Especial',
  Poupanca = 'Poupança',
  Seguro = 'Seguro',
  Cartao = 'Cartão de Crédito',
  Recuperacao_credito = 'Recuperação de Crédito',
  Pacote = 'Pacote de Tarifas',
  Consorcio = 'Consórcio',
  Credito = 'Empréstimo',
  Financiamento = 'Financiamento',
  Previdencia = 'Previdência',
  Compliance = 'Compliance',
  Cobranca = 'Cobrança Bancária ',
  SIPAG = 'SIPAG',
  Outros = 'Outros',

}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  agency: string;
  disabled?: boolean;      // <-- novo
  disabledAt?: any;        // opcional (Timestamp)
  disabledBy?: string;     // opcional
}

export interface Cooperado {
  id: string;
  name: string;
  document: string;
  isPortfolio: boolean;
  managerName?: string;
  agency?: string;
}

export interface Geolocation {
  latitude: number;
  longitude: number;
}

export interface ProductDetail {
  product: Product;
  subProduct?: string;
  observation?: string;
}

export interface Visit {
  id: string;
  serial?: string;
  cooperado: Cooperado | { name: string; document: string };
  date: Date;
  location: Geolocation | null;
  summary: string;
  products: ProductDetail[];
  manager: { id: string; name: string; agency: string };
}

export interface SuggestedVisit {
  id: string;

  // agora aceita cooperado da base ou manual
  cooperado: Cooperado | { name: string; document: string };

  // flag pedida: está na base?
  cooperadoInBase?: boolean;

  manager: { id: string; name: string; agency: string };
  suggestedAt: Date;
  suggestedBy: string;
  reason: string; // motivo da sugestão
}
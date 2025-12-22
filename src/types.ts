
export enum Product {
  Consorcio = 'Consórcio',
  Seguro = 'Seguro',
  Investimentos = 'Investimentos',
  Credito = 'Crédito',
  Previdencia = 'Previdência',
  Compliance = 'Compliance',
  Cobranca = 'Cobrança',
  SIPAG = 'SIPAG',
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  agency: string;
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
  cooperado: Cooperado | { name: string; document: string };
  date: Date;
  location: Geolocation | null;
  summary: string;
  products: ProductDetail[];
  manager: { id: string; name: string; agency: string };
}

export interface SuggestedVisit {
  id: string;
  cooperado: Cooperado;
  manager: { id: string; name: string; agency: string };
  suggestedAt: Date;
  suggestedBy: string; 
  reason: string;
}

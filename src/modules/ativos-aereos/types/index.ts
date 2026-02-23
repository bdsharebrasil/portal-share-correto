// Tipos relacionados ao módulo ativos-aereos
// Adicione suas interfaces aqui

export interface Aircraft {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  yearOfManufacture: number;
}

export interface Aerodrome {
  id: string;
  code: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
}
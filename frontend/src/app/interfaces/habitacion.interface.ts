export interface Habitacion {
  num: number | string;
  caracteristicas: string;
  precio: number;
  codigo_hotel: number; 
  disponible: boolean;
  fecha_creacion: string;
  cant_huespedes: number;
}
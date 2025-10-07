export interface Reserva {
  id_reserva: number;
  fecha_reserva: string;        
  fecha_caducidad: string;      
  num_habitacion: string;      
  codigo_hotel: number;         
  fecha_creacion: string;      
  id_usuario: number;           
  id_pago: number;           
  estado: boolean;
  id_paquete?: number | null;  
}
export interface Usuario {
  ci: number;
  nombre: string;
  correo: string;
  rol: string;
  pais: string;
  pasaporte: string;
  estado: boolean;
  fecha_creacion?: string;
}
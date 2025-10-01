export interface LugarTuristico {
    id_lugar: number;
    nombre: string;
    ubicacion: string;
    departamento: string;
    tipo: string;
    fecha_creacion: string; 
    horario?: string;       
    descripcion?: string; 
    url_image_lugar_turistico?: string; 
  }
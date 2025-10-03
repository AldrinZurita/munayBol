export interface Hotel {
  id_hotel: number;
  nombre: string;
  ubicacion: string;
  departamento: string;
  calificacion: number;
  estado: boolean;
  fecha_creacion: string;
  url: string;
  url_imagen_hotel: string;
}

export interface Lugar {
  id_lugar: number;
  nombre: string;
  ubicacion: string;
  departamento: string;
  tipo: string;
  fecha_creacion: string;
  horario: string;
  descripcion: string;
  url_image_lugar_turistico: string;
}

export interface Paquete {
  id_paquete: number;
  nombre: string;
  tipo: string;
  precio: number;
  estado: boolean;
  fecha_creacion: string;
  id_hotel: number;
  id_lugar: number;
  hotel: Hotel;
  lugar: Lugar;
}

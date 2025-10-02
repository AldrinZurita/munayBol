import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HabitacionService, DisponibilidadHabitacionResponse, IntervaloReservado } from '../../services/habitacion.service';
import { Habitacion } from '../../interfaces/habitacion.interface';


interface Review {
	autor: string;
	texto: string;
	calificacion: number;
	fecha: string;
}

@Component({
	selector: 'app-habitacion-detalle',
	imports: [CommonModule, RouterModule, FormsModule],
	templateUrl: './habitacion-detalle.html',
	styleUrls: ['./habitacion-detalle.scss'],
	standalone: true,
})
export class HabitacionDetalle implements OnInit {
	habitacion: Habitacion | null = null;
	reviews: Review[] = [];

	// Nuevos campos para seleccionar rango de fechas
	fechaReserva: string = '';
	fechaCaducidad: string = '';
	minFecha: string = '';
	minFechaSalida: string = '';
	disponibilidad: DisponibilidadHabitacionResponse | null = null;
	intervalos: IntervaloReservado[] = [];
	fechaOcupada: boolean = false;
	mensajeDisponibilidad: string = '';
	showToast: boolean = false;
	showModal: boolean = false;
	proxDisponible: string = '';

	constructor(
		private readonly route: ActivatedRoute,
		private readonly habitacionService: HabitacionService,
		private readonly router: Router
	) {}

	ngOnInit() {
		const num = this.route.snapshot.paramMap.get('num');
		// Inicializar fechas (hoy y mañana)
		const hoy = new Date();
		const manana = new Date(hoy.getTime() + 24 * 60 * 60 * 1000);
		this.fechaReserva = hoy.toISOString().slice(0, 10);
		this.fechaCaducidad = manana.toISOString().slice(0, 10);
		this.minFecha = this.fechaReserva;
		this.minFechaSalida = this.fechaCaducidad;
		if (num) {
			this.habitacionService.getHabitaciones().subscribe({
				next: habitaciones => {
					this.habitacion = habitaciones.find(h => h.num === num) || null;
					this.generarReviewsFake();
					if (this.habitacion) {
						this.cargarDisponibilidad(this.habitacion.num);
					}
				}
			});
		} else {
			this.generarReviewsFake();
		}
	}

	onChangeFechaReserva() {
		if (this.fechaCaducidad <= this.fechaReserva) {
			const nuevaSalida = new Date(this.fechaReserva);
			nuevaSalida.setDate(nuevaSalida.getDate() + 1);
			this.fechaCaducidad = nuevaSalida.toISOString().slice(0, 10);
		}
		this.minFechaSalida = this.addDias(this.fechaReserva, 1);
		this.evaluarSolapamiento();
	}

	onChangeFechaCaducidad() {
		if (this.fechaCaducidad <= this.fechaReserva) {
			this.fechaCaducidad = this.addDias(this.fechaReserva, 1);
		}
		this.evaluarSolapamiento();
	}

	private cargarDisponibilidad(num: string) {
		this.habitacionService.getDisponibilidadHabitacion(num).subscribe({
			next: resp => {
				this.disponibilidad = resp;
				this.intervalos = resp.intervalos_reservados.map(i => ({...i}));
				// Ya no reajustamos automáticamente; se decide al click.
				this.evaluarSolapamiento();
			}
		});
	}

	private estaDentro(fecha: string, intervalo: IntervaloReservado): boolean {
		return fecha >= intervalo.inicio && fecha <= intervalo.fin;
	}

	private rangoSolapa(inicio: string, fin: string, intervalo: IntervaloReservado): boolean {
		return inicio <= intervalo.fin && fin >= intervalo.inicio;
	}

	private evaluarSolapamiento() {
		this.fechaOcupada = this.intervalos.some(it => this.rangoSolapa(this.fechaReserva, this.fechaCaducidad, it));
	}

	onIntentarReservar() {
		this.mensajeDisponibilidad = '';
		this.showToast = false;
		this.showModal = false;
		this.evaluarSolapamiento();
		if (this.fechaOcupada) {
			this.proxDisponible = this.disponibilidad?.next_available_from || '';
			this.mensajeDisponibilidad = `La habitación está ocupada en esas fechas`;
			this.showToast = true; // Mostrar toast rápido
			this.showModal = true; // Y modal con acción
			return;
		}
		// Navegación manual asegurando parámetros consistentes
		this.router.navigate(['/reservas'], {
			queryParams: {
				num: this.habitacion?.num,
				precio: this.habitacion?.precio,
				hotel: this.habitacion?.codigo_hotel,
				capacidad: this.habitacion?.cant_huespedes,
				fecha_reserva: this.fechaReserva,
				fecha_caducidad: this.fechaCaducidad
			}
		});
	}

	formatear(fecha: string): string {
		if (!fecha) return '';
		const [y,m,d] = fecha.split('-');
		return `${d}/${m}/${y}`;
	}

	usarProximaFecha() {
		if (!this.proxDisponible) return;
		this.fechaReserva = this.proxDisponible;
		// set checkout +1 día
		this.fechaCaducidad = this.addDias(this.proxDisponible, 1);
		this.minFecha = this.fechaReserva;
		this.minFechaSalida = this.fechaCaducidad;
		this.showModal = false;
		this.showToast = false;
		this.mensajeDisponibilidad = '';
	}

	cerrarToast() { this.showToast = false; }
	cerrarModal() { this.showModal = false; }

	private addDias(fecha: string, dias: number): string {
		const d = new Date(fecha);
		d.setDate(d.getDate() + dias);
		return d.toISOString().slice(0, 10);
	}

	reservar() {
		// Navega a la página de reservas con las fechas seleccionadas
		if (!this.habitacion) {
			alert('No se encontró la habitación');
			return;
		}
		// Usamos routerLink en la plantilla, este método queda por si se quisiera programático
		alert('Serás redirigido a la creación de la reserva con tus fechas seleccionadas.');
	}

	getPrecioHabitacion(): number {
		return this.habitacion ? this.habitacion.precio : 0;
	}

	getCapacidadHabitacion(): number {
		return this.habitacion ? this.habitacion.cant_huespedes : 2;
	}

	private generarReviewsFake() {
		this.reviews = [
			{ autor: 'Ana', texto: 'Muy acogedor y limpio. Volveria sin duda.', calificacion: 4.5, fecha: '2025-09-10' },
			{ autor: 'Luis', texto: 'Excelente ubicacion y atencion. Desayuno completo.', calificacion: 4.2, fecha: '2025-09-12' },
			{ autor: 'Maria', texto: 'Hotel con encanto. Ideal para descansar y recorrer.', calificacion: 4.8, fecha: '2025-09-15' },
		];
	}
}
// ...existing code...

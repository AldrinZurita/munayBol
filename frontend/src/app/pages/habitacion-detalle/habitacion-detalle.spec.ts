import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HabitacionDetalle } from './habitacion-detalle';

describe('HabitacionDetalle', () => {
	let component: HabitacionDetalle;
	let fixture: ComponentFixture<HabitacionDetalle>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [HabitacionDetalle]
		}).compileComponents();

		fixture = TestBed.createComponent(HabitacionDetalle);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
// ...existing code...

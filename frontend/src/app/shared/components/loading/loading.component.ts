import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
type LoaderSize = 'small' | 'medium' | 'large';
type LoaderVariant = 'spinner' | 'reserve';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss']
})
export class LoadingComponent {
  @Input() message: string = 'Cargando...';
  @Input() size: LoaderSize = 'medium';
  @Input() fullScreen: boolean = false;
  @Input() variant: LoaderVariant = 'spinner';
  @Input() progress: number | null = null;
  @Input() label?: string;
  @Input() planeIcon: string = 'flight_takeoff';
}

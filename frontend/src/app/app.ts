import { Component } from '@angular/core';
import { SharedModule } from './shared/shared-module';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SharedModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'frontend-turismo-hoteleria';
}

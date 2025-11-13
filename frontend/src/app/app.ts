import { Component } from '@angular/core';
import { SharedModule } from './shared/shared-module';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/navbar/navbar';
import { RouterModule } from '@angular/router';
import { IconsModule} from './icons';
import  { GlobalLoaderComponent} from './shared/components/global-loader/global-loader';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NavbarComponent, SharedModule, RouterOutlet, RouterModule, IconsModule, GlobalLoaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'frontend-turismo-hoteleria';
}

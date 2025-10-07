import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss'
})
export class Inicio {
[x: string]: string|string[];
departamentoSeleccionado: any|string;
}

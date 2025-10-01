import { Component } from '@angular/core';
import { AsistenteIaService } from '../../services/asistente-ia.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-asistente-ia',
  templateUrl: './asistente-ia.html',
  styleUrls: ['./asistente-ia.scss'],
  imports: [CommonModule, FormsModule],
})
export class AsistenteIa {
  prompt: string = '';
  respuestas: { from: 'user' | 'ia', text: string }[] = [];

  constructor(private iaService: AsistenteIaService) {}

  enviar() {
    const promptActual = this.prompt.trim();
    if (!promptActual) return;
    this.respuestas.push({ from: 'user', text: promptActual });
    this.prompt = '';
    this.iaService.enviarPrompt(promptActual).subscribe({
      next: (data) => {
        this.respuestas.push({ from: 'ia', text: data.result });
      },
      error: () => {
        this.respuestas.push({ from: 'ia', text: 'Hubo un error al consultar la IA.' });
      }
    });
  }

  enviarQuick(msg: string) {
    this.prompt = msg;
    this.enviar();
  }
}
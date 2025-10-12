import { Component } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AsistenteIaService } from '../../services/asistente-ia.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

@Component({
  selector: 'app-asistente-ia',
  templateUrl: './asistente-ia.html',
  styleUrls: ['./asistente-ia.scss'],
  imports: [CommonModule, FormsModule],
})
export class AsistenteIa {
  prompt: string = '';
  respuestas: { from: 'user' | 'ia', text: string }[] = [];

  constructor(private readonly iaService: AsistenteIaService, private readonly sanitizer: DomSanitizer) {}

  renderMarkdown(text: string): SafeHtml {
    if (!text) return '' as unknown as SafeHtml;
    try {
      // Parse Markdown to HTML (inline for chat)
      const html = marked.parseInline(text);
      // If marked returns a Promise (shouldn't in sync mode), fallback to plain text
      if (typeof html !== 'string') return text;
      // Sanitize HTML to prevent XSS
      const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
      // Trust sanitized HTML for Angular binding
      return this.sanitizer.bypassSecurityTrustHtml(clean);
    } catch {
      return text;
    }
  }

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

  nuevoChat() {
    this.iaService.resetChat();
    this.respuestas = [];
  }
}
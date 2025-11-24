import { Component, ElementRef, ViewChild, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AsistenteIaService } from '../../services/asistente-ia.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatMessage, ChatSession } from '../../interfaces/chat.interface';
import { AuthService } from '../../services/auth.service';
import { LoadingService } from '../../shared/services/loading';

type Actor = 'user' | 'ia';
interface Respuesta {
  from: Actor;
  text: string;
  t: number; // timestamp
}

interface SessionGroup {
  label: string;
  items: ChatSession[];
}

// NUEVO TIPO: Define las claves permitidas explícitamente
type ChatGroupKey = 'today' | 'yesterday' | 'last-7' | 'last-30' | 'older';

type ChatGroups = {
  [K in ChatGroupKey]: ChatSession[];
};

@Component({
  selector: 'app-asistente-ia',
  standalone: true,
  templateUrl: './asistente-ia.html',
  styleUrls: ['./asistente-ia.scss'],
  imports: [CommonModule, FormsModule],
})
export class AsistenteIa implements OnInit, OnDestroy {
  @ViewChild('chatScroll', { static: false }) chatEl?: ElementRef<HTMLDivElement>;
  prompt = '';
  respuestas: Respuesta[] = [];
  typing = false;
  sending = false;
  showScrollToBottom = false;
  sidebarOpen = true;
  streamEffect = true;
  streamSpeedMs = 6;
  private streamTimer: any = null;
  private streamChunkSize = 12;
  private animatedBolts = new Set<number>();
  sessions: ChatSession[] = [];
  search = '';
  showArchived = false;
  renamingId: string | null = null;
  archivingId: string | null = null;
  deletingId: string | null = null;

  currentSessionId: string | null = null;
  currentSession?: ChatSession;

  // Variables para la paginación/scroll
  page = 1;
  limit = 30;
  totalMessages = 0;
  loadingMessages = false;
  hasMore = false;
  private isInitialLoad = true;
  private previousScrollHeight = 0;

  constructor(
    private readonly iaService: AsistenteIaService,
    private readonly sanitizer: DomSanitizer,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    public readonly auth: AuthService,
    private readonly loadingService: LoadingService
  ) {
    marked.setOptions({ breaks: true, gfm: true });
  }

  ngOnInit(): void {
    const token = this.auth.getToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.auth.getUser()) {
      this.auth.getMe().toPromise().catch(() => this.router.navigate(['/login']));
    }

    this.route.paramMap.subscribe(async (params) => {
      const sid = params.get('sessionId');
      if (sid && sid !== this.currentSessionId) {
        this.currentSessionId = sid;
        this.iaService.setCurrentSession(sid);
        await this.loadSessions();
        await this.openSession(sid, true);
      } else if (!sid) {
        await this.loadSessions();
        if (this.sessions.length > 0) {
          // Si no hay sesión en la URL, navega a la más reciente
          const latest = [...this.sessions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
          if (latest) this.router.navigate(['/asistente-ia', latest.id]);
          else this.createAndOpenSession();
        } else {
          this.createAndOpenSession();
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.streamTimer) { clearInterval(this.streamTimer); this.streamTimer = null; }
    this.loadingService.hide();
  }

  async loadSessions(): Promise<void> {
    this.loadingService.show('Cargando historial...');
    try {
      const list = await this.iaService.listSessions({
        q: this.search.trim() || undefined,
        archived: this.showArchived,
      }).toPromise();
      this.sessions = (list || []).map((s) => ({ ...s }));
    } catch {
      this.sessions = [];
    } finally {
      this.loadingService.hide();
    }
  }

  groupedSessions(): SessionGroup[] {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const isToday = (date: Date) => date.toDateString() === today.toDateString();
    const isYesterday = (date: Date) => date.toDateString() === yesterday.toDateString();

    // Utilizamos el nuevo tipo para definir explícitamente las claves
    const groups: ChatGroups = {
      today: [],
      yesterday: [],
      'last-7': [],
      'last-30': [],
      older: [],
    };

    const sortedSessions = [...this.sessions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    for (const s of sortedSessions) {
      const date = new Date(s.updated_at);
      const diffDays = Math.ceil(Math.abs(today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (isToday(date)) {
        groups.today.push(s); // TS ahora permite groups.today
      } else if (isYesterday(date)) {
        groups.yesterday.push(s); // TS ahora permite groups.yesterday
      } else if (diffDays <= 7) {
        groups['last-7'].push(s);
      } else if (diffDays <= 30) {
        groups['last-30'].push(s);
      } else {
        groups.older.push(s); // TS ahora permite groups.older
      }
    }

    const result: SessionGroup[] = [];
    if (groups.today.length > 0) result.push({ label: 'Hoy', items: groups.today }); // TS ahora permite groups.today
    if (groups.yesterday.length > 0) result.push({ label: 'Ayer', items: groups.yesterday }); // TS ahora permite groups.yesterday
    if (groups['last-7'].length > 0) result.push({ label: 'Últimos 7 días', items: groups['last-7'] });
    if (groups['last-30'].length > 0) result.push({ label: 'Últimos 30 días', items: groups['last-30'] });
    if (groups.older.length > 0) result.push({ label: 'Anteriores', items: groups.older }); // TS ahora permite groups.older

    return result;
  }

  async createAndOpenSession(): Promise<void> {
    try {
      const s = await this.iaService.createSession().toPromise();
      if (s) {
        this.sessions = [s, ...this.sessions];
        this.router.navigate(['/asistente-ia', s.id]);
      }
    } catch {
      if (!this.auth.getToken()) this.router.navigate(['/login']);
    }
  }

  async goToSession(s: ChatSession): Promise<void> {
    if (s.id === this.currentSessionId) return;
    this.router.navigate(['/asistente-ia', s.id]);
  }

  async openSession(id: string, reset = false): Promise<void> {
    if (reset) {
      this.respuestas = [];
      this.page = 1;
      this.totalMessages = 0;
      this.hasMore = false;
      this.isInitialLoad = true;
      this.previousScrollHeight = 0;
    }
    this.currentSessionId = id;
    this.iaService.setCurrentSession(id);
    try {
      this.currentSession = await this.iaService.getSession(id).toPromise() || undefined;
      // Si la sesión existe, carga los mensajes
      await this.loadMessages(true);
    } catch {
      // Si la sesión no existe o fue borrada, crea una nueva y navega
      await this.createAndOpenSession();
      return;
    }
  }

  async loadMore(): Promise<void> {
    if (!this.currentSessionId || this.loadingMessages || !this.hasMore) return;
    this.page += 1;
    this.previousScrollHeight = this.chatEl?.nativeElement.scrollHeight || 0;
    await this.loadMessages(false);
  }

  private async loadMessages(resetList: boolean): Promise<void> {
    if (!this.currentSessionId) return;
    this.loadingMessages = true;
    try {
      const pageResp = await this.iaService.listMessages(this.currentSessionId, { page: this.page, limit: this.limit }).toPromise();
      if (!pageResp) return;
      this.totalMessages = pageResp.total || 0;
      // Recibimos los mensajes del más nuevo al más antiguo, por lo que los invertimos
      const items = (pageResp.items || []).map((m: ChatMessage) => this.mapToRespuesta(m)).reverse();

      // La lista de 'respuestas' debe estar en orden cronológico (antiguo a nuevo)
      if (resetList) this.respuestas = items;
      else this.respuestas = [...items, ...this.respuestas];

      this.hasMore = (this.page * this.limit) < this.totalMessages;

      if (resetList) {
        this.scrollToBottomSoon();
        this.isInitialLoad = false;
      } else {
        this.restoreScrollPosition(); // Restaurar posición después de cargar más
      }

    } finally {
      this.loadingMessages = false;
    }
  }

  private mapToRespuesta(m: ChatMessage): Respuesta {
    return {
      from: m.role === 'assistant' ? 'ia' : 'user',
      text: m.content,
      t: new Date(m.ts || Date.now()).getTime(),
    };
  }

  // --- Lógica de Scroll ---
  onChatScroll(event: Event): void {
    const el = this.chatEl?.nativeElement;
    if (!el) return;

    // Altura actual - Scroll actual = Distancia al final
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    // Si la distancia al final es mayor a un umbral (ej. 100px), mostrar el FAB
    this.showScrollToBottom = distanceToBottom > 100;
  }

  scrollToBottom(): void {
    this.chatEl?.nativeElement.scrollTo({
      top: this.chatEl.nativeElement.scrollHeight,
      behavior: 'smooth',
    });
  }

  scrollToBottomSoon(): void {
    setTimeout(() => {
      // Solo hacer scroll a menos que estemos cargando el historial y no sea la carga inicial.
      if (!this.loadingMessages && !this.isInitialLoad) {
        this.scrollToBottom();
      } else if (this.isInitialLoad) {
        this.scrollToBottom(); // Forzar el scroll al inicio de la sesión.
      }
    }, 50);
  }

  restoreScrollPosition(): void {
    setTimeout(() => {
      const el = this.chatEl?.nativeElement;
      if (el && this.previousScrollHeight > 0) {
        // Ajusta el scroll para mantener la misma posición visible
        const newScrollTop = el.scrollHeight - this.previousScrollHeight;
        el.scrollTop = newScrollTop;
      }
      this.previousScrollHeight = 0; // Reset
    }, 0);
  }

  // --- Lógica de Mensajes y Estado ---
  private push(from: Actor, text: string): void {
    const t = Date.now();
    this.respuestas.push({ from, text, t });
    if (from === 'user') {
      this.animatedBolts.add(t);
      setTimeout(() => this.animatedBolts.delete(t), 4000);
    }
    this.scrollToBottomSoon();
  }

  isNewDay(i: number): boolean {
    if (i === 0) return true;
    const currentDay = new Date(this.respuestas[i].t).toDateString();
    const prevDay = new Date(this.respuestas[i - 1].t).toDateString();
    return currentDay !== prevDay;
  }

  isGroupStart(i: number): boolean {
    if (i === 0) return true;
    const current = this.respuestas[i];
    const prev = this.respuestas[i - 1];
    return current.from !== prev.from || (current.t - prev.t > 1000 * 60 * 5); // 5 minutos de separación
  }

  trackByMsg(index: number, msg: Respuesta): number {
    return msg.t; // Usar el timestamp como trackBy para rendimiento
  }

  // --- Streaming y Envío de Mensajes ---
  private async streamAssistantTextIntoPlaceholder(full: string, placeholderT?: number): Promise<void> {
    if (this.streamTimer) { clearInterval(this.streamTimer); this.streamTimer = null; }

    let idx = -1;
    if (placeholderT) idx = this.respuestas.findIndex(r => r.t === placeholderT);

    if (idx < 0) {
      const t = Date.now();
      this.respuestas.push({ from: 'ia', text: '', t });
      idx = this.respuestas.findIndex(r => r.t === t);
    }

    this.scrollToBottomSoon();

    let pos = 0;
    const chunk = Math.max(1, this.streamChunkSize);
    this.streamTimer = setInterval(() => {
      if (pos >= full.length) {
        clearInterval(this.streamTimer);
        this.streamTimer = null;
        if (idx >= 0 && this.respuestas[idx]) {
          this.respuestas[idx] = { ...this.respuestas[idx], text: full };
        } else {
          this.respuestas.push({ from: 'ia', text: full, t: Date.now() });
        }
        this.scrollToBottomSoon();
        return;
      }
      const next = full.slice(pos, pos + chunk);
      pos += chunk;
      if (idx >= 0 && this.respuestas[idx]) {
        this.respuestas[idx] = { ...this.respuestas[idx], text: (this.respuestas[idx].text || '') + next };
      }
      this.scrollToBottomSoon();
    }, Math.max(4, this.streamSpeedMs));
  }

  async enviar(): Promise<void> {
    const msg = this.prompt.trim();
    if (!msg || this.sending) return;

    if (!this.currentSessionId) {
      await this.createAndOpenSession();
    }
    if (!this.currentSessionId) return;

    // Antes de enviar, haz scroll al final para que el usuario vea su mensaje
    this.scrollToBottom();

    this.push('user', msg);
    this.prompt = '';
    const placeholderT = Date.now();
    this.respuestas.push({ from: 'ia', text: '', t: placeholderT });
    this.scrollToBottomSoon();

    this.sending = true;
    this.typing = true;

    try {
      const resp = await this.iaService.appendMessage(this.currentSessionId, msg).toPromise();
      const out = (resp?.assistant?.content ?? '').toString().trim();

      if (this.streamEffect && out.length > 30) {
        await this.streamAssistantTextIntoPlaceholder(out, placeholderT);
      } else {
        const idx = this.respuestas.findIndex(r => r.t === placeholderT);
        if (idx >= 0) {
          this.respuestas[idx] = { ...this.respuestas[idx], text: out || 'No tengo información para eso aún. ¿Puedes reformular tu pregunta?' };
        } else {
          this.push('ia', out || 'No tengo información para eso aún. ¿Puedes reformular tu pregunta?');
        }
      }

      const s = await this.iaService.getSession(this.currentSessionId).toPromise();
      if (s) {
        this.currentSession = s;
        this.sessions = this.sessions.map(x => x.id === s.id ? s : x);
      }
    } catch {
      const idx = this.respuestas.findIndex(r => r.t === placeholderT);
      if (idx >= 0) {
        this.respuestas[idx] = { ...this.respuestas[idx], text: 'Hubo un error al consultar la IA. Intenta nuevamente en unos segundos.' };
      } else {
        this.push('ia', 'Hubo un error al consultar la IA. Intenta nuevamente en unos segundos.');
      }
    } finally {
      this.sending = false;
      setTimeout(() => (this.typing = false), 200);
      this.scrollToBottomSoon(); // Asegurar scroll al final después de la respuesta
    }
  }

  // --- Metadatos y Utilidades ---
  enviarQuick(msg: string): void {
    if (this.sending) return;
    this.prompt = msg;
    this.enviar();
  }

  async nuevoChat(): Promise<void> {
    if (this.sending) return;
    await this.createAndOpenSession();
  }

  copiar(text: string): void {
    try {
      navigator.clipboard.writeText(text || '');
    } catch {}
  }

  getUserInitials(): string {
    const user = this.auth.getUser();
    if (!user || !user.nombre) return '?';
    const parts = user.nombre.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  exportarChat(): void {
    if (this.respuestas.length === 0) return;
    const lines: string[] = [];
    lines.push(`# Conversación MunayBol (${new Date().toLocaleString()})`, '');
    for (const r of this.respuestas) {
      const who = r.from === 'ia' ? 'IA' : 'Usuario';
      const ts = new Date(r.t).toLocaleString();
      lines.push(`## ${who} • ${ts}`, '', r.text, '');
    }
    const md = lines.join('\n');
    try {
      navigator.clipboard.writeText(md);
      this.push('ia', 'Copié la conversación al portapapeles en formato **Markdown**. ¡Asegúrate de tener un título para el archivo!');
    }
    catch {
      this.push('ia', 'No pude copiar la conversación automáticamente. Intenta manualmente.');
    }
  }

  private improveMarkdownHeuristics(text: string): string {
    if (!text) return text;
    let s = text;
    const starBullets = (s.match(/\*\s/g) || []).length;
    const breaks = (s.match(/\n/g) || []).length;
    if (starBullets > 1 && breaks < starBullets) {
      s = s.replace(/(\S)\s(\*\s)/g, '$1\n$2');
    }
    return s;
  }

  renderMarkdown(text: string): SafeHtml {
    const rawHtml = marked.parse(this.improveMarkdownHeuristics(text || '')) as string;
    const safeHtml = DOMPurify.sanitize(rawHtml);
    return this.sanitizer.bypassSecurityTrustHtml(safeHtml);
  }

  // --- Funciones de Sesión ---
  async renameSession(s: ChatSession): Promise<void> {
    const nuevo = prompt('Nuevo título de la conversación', s.title || '');
    if (nuevo === null || nuevo.trim() === '') return;
    this.renamingId = s.id;
    try {
      const upd = await this.iaService.patchSession(s.id, { title: nuevo.trim() }).toPromise();
      if (upd) {
        this.sessions = this.sessions.map(x => x.id === s.id ? upd : x);
        if (this.currentSessionId === s.id) this.currentSession = upd;
      }
    } finally {
      this.renamingId = null;
    }
  }

  async toggleArchive(s: ChatSession): Promise<void> {
    this.archivingId = s.id;
    try {
      const upd = await this.iaService.patchSession(s.id, { archived: !s.archived }).toPromise();
      if (upd) {
        this.sessions = this.sessions.map(x => x.id === s.id ? upd : x);
        if (this.currentSessionId === s.id) this.currentSession = upd;
        // Si el filtro está activo y la desarchivas/archivas, recarga las sesiones
        if (this.showArchived !== upd.archived) {
          await this.loadSessions();
        }
      }
    } finally {
      this.archivingId = null;
    }
  }

  async deleteSession(s: ChatSession): Promise<void> {
    if (!confirm('¿Eliminar esta conversación? Esta acción no se puede deshacer.')) return;
    this.deletingId = s.id;
    try {
      await this.iaService.deleteSession(s.id).toPromise();
      this.sessions = this.sessions.filter(x => x.id !== s.id);
      if (this.currentSessionId === s.id) {
        // Navegar a la sesión más reciente o crear una nueva
        const latest = [...this.sessions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
        if (latest) {
          this.router.navigate(['/asistente-ia', latest.id]);
        } else {
          await this.createAndOpenSession();
        }
      }
    } finally {
      this.deletingId = null;
    }
  }

  async applyFilters(): Promise<void> {
    await this.loadSessions();
  }
}

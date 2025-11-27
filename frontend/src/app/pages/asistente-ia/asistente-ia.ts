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
  t: number;
}
interface SessionGroup {
  label: string;
  items: ChatSession[];
}
type ChatGroupKey = 'today' | 'yesterday' | 'last-7' | 'last-30' | 'older';
type ChatGroups = { [K in ChatGroupKey]: ChatSession[] };

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

  sessions: ChatSession[] = [];
  search = '';
  showArchived = false;
  renamingId: string | null = null;
  archivingId: string | null = null;
  deletingId: string | null = null;

  currentSessionId: string | null = null;
  currentSession?: ChatSession;

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
      const list = await this.iaService.listSessions({ q: this.search.trim() || undefined, archived: this.showArchived }).toPromise();
      this.sessions = (list || []).map((s) => ({ ...s }));
    } catch {
      this.sessions = [];
    } finally {
      this.loadingService.hide();
    }
  }

  groupedSessions(): SessionGroup[] {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const isToday = (d: Date) => d.toDateString() === today.toDateString();
    const isYesterday = (d: Date) => d.toDateString() === yesterday.toDateString();

    const groups: ChatGroups = { today: [], yesterday: [], 'last-7': [], 'last-30': [], older: [] };
    const sorted = [...this.sessions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    for (const s of sorted) {
      const d = new Date(s.updated_at);
      const diff = Math.ceil(Math.abs(today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (isToday(d)) groups.today.push(s);
      else if (isYesterday(d)) groups.yesterday.push(s);
      else if (diff <= 7) groups['last-7'].push(s);
      else if (diff <= 30) groups['last-30'].push(s);
      else groups.older.push(s);
    }

    const result: SessionGroup[] = [];
    if (groups.today.length) result.push({ label: 'Hoy', items: groups.today });
    if (groups.yesterday.length) result.push({ label: 'Ayer', items: groups.yesterday });
    if (groups['last-7'].length) result.push({ label: 'Últimos 7 días', items: groups['last-7'] });
    if (groups['last-30'].length) result.push({ label: 'Últimos 30 días', items: groups['last-30'] });
    if (groups.older.length) result.push({ label: 'Anteriores', items: groups.older });
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
      await this.loadMessages(true);
    } catch {
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
      const items = (pageResp.items || []).map((m: ChatMessage) => this.mapToRespuesta(m)).reverse();
      if (resetList) this.respuestas = items;
      else this.respuestas = [...items, ...this.respuestas];
      this.hasMore = (this.page * this.limit) < this.totalMessages;
      if (resetList) { this.scrollToBottomSoon(); this.isInitialLoad = false; }
      else { this.restoreScrollPosition(); }
    } finally {
      this.loadingMessages = false;
    }
  }

  private mapToRespuesta(m: ChatMessage): Respuesta {
    return { from: m.role === 'assistant' ? 'ia' : 'user', text: m.content, t: new Date(m.ts || Date.now()).getTime() };
  }

  // Métodos requeridos por el template
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
    } catch {
      this.push('ia', 'No pude copiar la conversación automáticamente. Intenta manualmente.');
    }
  }

  async nuevoChat(): Promise<void> {
    if (this.sending) return;
    await this.createAndOpenSession();
  }

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
        if (this.showArchived !== upd.archived) await this.loadSessions();
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
        const latest = [...this.sessions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
        if (latest) this.router.navigate(['/asistente-ia', latest.id]);
        else await this.createAndOpenSession();
      }
    } finally {
      this.deletingId = null;
    }
  }

  onChatScroll(event?: Event): void {
    const el = this.chatEl?.nativeElement;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.showScrollToBottom = distanceToBottom > 100;
  }
  scrollToBottom(): void {
    this.chatEl?.nativeElement.scrollTo({ top: this.chatEl.nativeElement.scrollHeight, behavior: 'smooth' });
  }
  scrollToBottomSoon(): void {
    setTimeout(() => {
      if (!this.loadingMessages && !this.isInitialLoad) this.scrollToBottom();
      else if (this.isInitialLoad) this.scrollToBottom();
    }, 50);
  }
  restoreScrollPosition(): void {
    setTimeout(() => {
      const el = this.chatEl?.nativeElement;
      if (el && this.previousScrollHeight > 0) {
        const newScrollTop = el.scrollHeight - this.previousScrollHeight;
        el.scrollTop = newScrollTop;
      }
      this.previousScrollHeight = 0;
    }, 0);
  }

  private isLikelyHtml(text: string): boolean {
    if (!text) return false;
    return /<\s*(h[1-6]|p|ul|ol|li|hr|table|thead|tbody|tr|td|th|strong|em|b|i|code|span|a)\b/i.test(text);
  }
  private improveMarkdownHeuristics(text: string): string {
    if (!text || this.isLikelyHtml(text)) return text;
    let s = text;
    const starBullets = (s.match(/\*\s/g) || []).length;
    const breaks = (s.match(/\n/g) || []).length;
    if (starBullets > 1 && breaks < starBullets) {
      s = s.replace(/(\S)\s(\*\s)/g, '$1\n$2');
    }
    return s;
  }
  renderMarkdown(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    if (this.isLikelyHtml(text)) {
      const safeHtml = DOMPurify.sanitize(text);
      return this.sanitizer.bypassSecurityTrustHtml(safeHtml);
    }
    const rawHtml = marked.parse(this.improveMarkdownHeuristics(text)) as string;
    const safeHtml = DOMPurify.sanitize(rawHtml);
    return this.sanitizer.bypassSecurityTrustHtml(safeHtml);
  }

  private async streamAssistantTextIntoPlaceholder(full: string, placeholderT?: number): Promise<void> {
    if (this.streamTimer) { clearInterval(this.streamTimer); this.streamTimer = null; }
    if (this.isLikelyHtml(full)) {
      const idxHtml = this.respuestas.findIndex(r => r.t === placeholderT);
      const t = Date.now();
      if (idxHtml >= 0) this.respuestas[idxHtml] = { from: 'ia', text: full, t };
      else this.respuestas.push({ from: 'ia', text: full, t });
      this.scrollToBottomSoon();
      return;
    }
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

      if (this.isLikelyHtml(out) || out.length <= 30) {
        const idx = this.respuestas.findIndex(r => r.t === placeholderT);
        if (idx >= 0) this.respuestas[idx] = { ...this.respuestas[idx], text: out || 'No tengo información para eso aún. ¿Puedes reformular tu pregunta?' };
        else this.push('ia', out || 'No tengo información para eso aún. ¿Puedes reformular tu pregunta?');
      } else if (this.streamEffect) {
        await this.streamAssistantTextIntoPlaceholder(out, placeholderT);
      } else {
        const idx = this.respuestas.findIndex(r => r.t === placeholderT);
        if (idx >= 0) this.respuestas[idx] = { ...this.respuestas[idx], text: out || 'No tengo información para eso aún. ¿Puedes reformular tu pregunta?' };
        else this.push('ia', out || 'No tengo información para eso aún. ¿Puedes reformular tu pregunta?');
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
      this.scrollToBottomSoon();
    }
  }

  private push(from: Actor, text: string): void {
    const t = Date.now();
    this.respuestas.push({ from, text, t });
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
    return current.from !== prev.from || (current.t - prev.t > 1000 * 60 * 5);
  }
  trackByMsg(index: number, msg: Respuesta): number { return msg.t; }

  enviarQuick(msg: string): void {
    if (this.sending) return;
    this.prompt = msg;
    this.enviar();
  }
  copiar(text: string): void {
    try { navigator.clipboard.writeText(text || ''); } catch {}
  }
  getUserInitials(): string {
    const user = this.auth.getUser();
    if (!user || !user.nombre) return '?';
    const parts = user.nombre.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async applyFilters(): Promise<void> {
    await this.loadSessions();
  }
}

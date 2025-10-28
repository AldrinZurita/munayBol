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

type Actor = 'user' | 'ia';
interface Respuesta {
  from: Actor;
  text: string;
  t: number; // timestamp (ms)
}

@Component({
  selector: 'app-asistente-ia',
  standalone: true,
  templateUrl: './asistente-ia.html',
  styleUrls: ['./asistente-ia.scss'],
  imports: [CommonModule, FormsModule],
})
export class AsistenteIa implements OnInit, OnDestroy {
  @ViewChild('chatScroll', { static: false }) chatEl?: ElementRef<HTMLDivElement>;

  // Chat state
  prompt = '';
  respuestas: Respuesta[] = [];
  typing = false;
  sending = false;

  // UI helpers
  showScrollToBottom = false;
  sidebarOpen = true;

  // Perceived speed (streaming)
  streamEffect = true;
  streamSpeedMs = 6;         // lower = faster updates
  private streamTimer: any = null;
  private streamChunkSize = 12; // chars per tick

  // Track lightning draw animation for newly added user messages
  private animatedBolts = new Set<number>();

  // Sessions & pagination
  sessions: ChatSession[] = [];
  search = '';
  showArchived = false;
  loadingSessions = false;
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

  constructor(
    private readonly iaService: AsistenteIaService,
    private readonly sanitizer: DomSanitizer,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    public readonly auth: AuthService // public for template
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
  }

  // -------- Sessions & messages --------
  async loadSessions(): Promise<void> {
    this.loadingSessions = true;
    try {
      const list = await this.iaService.listSessions({
        q: this.search.trim() || undefined,
        archived: this.showArchived,
      }).toPromise();
      this.sessions = (list || []).map((s) => ({ ...s }));
    } catch {
      this.sessions = [];
    } finally {
      this.loadingSessions = false;
    }
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

  async openSession(id: string, reset = false): Promise<void> {
    if (reset) {
      this.respuestas = [];
      this.page = 1;
      this.totalMessages = 0;
      this.hasMore = false;
    }
    this.currentSessionId = id;
    this.iaService.setCurrentSession(id);
    try {
      this.currentSession = await this.iaService.getSession(id).toPromise() || undefined;
    } catch {
      this.currentSession = undefined;
    }
    await this.loadMessages(true);
  }

  async loadMore(): Promise<void> {
    if (!this.currentSessionId || this.loadingMessages || !this.hasMore) return;
    this.page += 1;
    await this.loadMessages(false);
  }

  private async loadMessages(resetList: boolean): Promise<void> {
    if (!this.currentSessionId) return;
    this.loadingMessages = true;
    try {
      const pageResp = await this.iaService.listMessages(this.currentSessionId, { page: this.page, limit: this.limit }).toPromise();
      if (!pageResp) return;
      this.totalMessages = pageResp.total || 0;
      const items = (pageResp.items || []).map((m: ChatMessage) => this.mapToRespuesta(m));
      if (resetList) this.respuestas = items;
      else this.respuestas = [...items, ...this.respuestas];
      this.hasMore = (this.page * this.limit) < this.totalMessages;
      if (resetList) this.scrollToBottomSoon();
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

  async renameSession(s: ChatSession): Promise<void> {
    const nuevo = prompt('Nuevo título de la conversación', s.title || '');
    if (nuevo === null) return;
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
        this.currentSessionId = null;
        this.currentSession = undefined;
        if (this.sessions.length > 0) {
          this.router.navigate(['/asistente-ia', this.sessions[0].id]);
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

  // -------- Messaging & perceived speed --------
  private push(from: Actor, text: string): void {
    const t = Date.now();
    this.respuestas.push({ from, text, t });
    if (from === 'user') {
      // Trigger draw animation for lightning on new user messages
      this.animatedBolts.add(t);
      setTimeout(() => this.animatedBolts.delete(t), 4000);
    }
    this.scrollToBottomSoon();
  }

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

    // Show user message immediately (will animate lightning)
    this.push('user', msg);
    this.prompt = '';

    // Assistant placeholder (for speed perception)
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
    }
  }

  // Template helpers
  isLastUser(i: number): boolean {
    for (let k = this.respuestas.length - 1; k >= 0; k--) {
      if (this.respuestas[k]?.from === 'user') return i === k;
    }
    return false;
  }

  boltShouldDraw(t: number): boolean {
    return this.animatedBolts.has(t);
  }

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
    try { navigator.clipboard.writeText(text || ''); } catch {}
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
    try { navigator.clipboard.writeText(md); this.push('ia', 'Copié la conversación al portapapeles en formato Markdown.'); }
    catch { this.push('ia', 'No pude copiar la conversación automáticamente. Intenta manualmente.'); }
  }

  // Heuristic Markdown normalization to avoid flattened bullets
  private improveMarkdownHeuristics(text: string): string {
    if (!text) return text;
    let s = text;

    // If there are multiple "* " bullets but few line breaks, insert newlines before bullets
    const starBullets = (s.match(/\*\s/g) || []).length;
    const hasFewBreaks = (s.match(/\n/g) || []).length < 2;
    if (starBullets >= 2 && hasFewBreaks) {
      s = s.replace(/\s\*\s/g, '\n* ');
    }

    // Bold headings to H3 for spacing
    s = s.replace(/(^|\n)\s*\*\*(.+?)\*\*\s*/g, '$1### $2\n');

    // Ensure break before next list/heading
    s = s.replace(/([.!?])\s+(\*|\-|\#)/g, '$1\n$2');

    return s;
  }

  renderMarkdown(text: string): SafeHtml {
    if (!text) return '' as unknown as SafeHtml;
    try {
      const normalized = this.improveMarkdownHeuristics(text);
      const html = marked.parse(normalized);
      const safe = DOMPurify.sanitize(typeof html === 'string' ? html : String(html), { USE_PROFILES: { html: true } });
      return this.sanitizer.bypassSecurityTrustHtml(safe);
    } catch {
      return this.sanitizer.bypassSecurityTrustHtml(String(text));
    }
  }

  trackByMsg = (_: number, r: Respuesta) => r.t;

  isGroupStart(i: number): boolean {
    if (i === 0) return true;
    return this.respuestas[i].from !== this.respuestas[i - 1].from;
  }

  isNewDay(i: number): boolean {
    if (i === 0) return true;
    const d1 = new Date(this.respuestas[i].t);
    const d0 = new Date(this.respuestas[i - 1].t);
    return d1.getFullYear() !== d0.getFullYear() || d1.getMonth() !== d0.getMonth() || d1.getDate() !== d0.getDate();
  }

  onChatScroll(_: Event): void {
    const el = this.chatEl?.nativeElement;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
    this.showScrollToBottom = !nearBottom;
  }

  scrollToBottom(): void {
    const el = this.chatEl?.nativeElement;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    this.showScrollToBottom = false;
  }

  private scrollToBottomSoon(): void {
    setTimeout(() => this.scrollToBottom(), 0);
  }

  groupLabelFor(dateIso?: string | null): string {
    if (!dateIso) return 'Anteriores';
    const d = new Date(dateIso);
    const today = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor((today.setHours(0,0,0,0) - new Date(d.setHours(0,0,0,0)).getTime()) / oneDay);
    if (diffDays <= 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays <= 7) return 'Esta semana';
    const thisMonth = new Date().getMonth();
    if (d.getMonth() === thisMonth) return 'Este mes';
    return 'Más antiguas';
  }

  groupedSessions(): { label: string; items: ChatSession[] }[] {
    const groups = new Map<string, ChatSession[]>();
    for (const s of this.sessions) {
      const label = this.groupLabelFor(s.updated_at || s.created_at);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(s);
    }
    const order = ['Hoy', 'Ayer', 'Esta semana', 'Este mes', 'Más antiguas', 'Anteriores'];
    return order
      .filter(g => groups.has(g))
      .map(g => ({
        label: g,
        items: groups.get(g)!.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      }));
  }

  async goToSession(s: ChatSession): Promise<void> {
    if (this.currentSessionId === s.id) return;
    this.router.navigate(['/asistente-ia', s.id]);
  }
}

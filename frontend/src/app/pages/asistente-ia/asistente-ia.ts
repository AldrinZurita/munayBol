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
interface Respuesta { from: Actor; text: string; t: number; }
interface SessionWithPreview extends ChatSession {
  preview_query?: string;
}

interface SessionGroup<TItem = SessionWithPreview> {
  label: string;
  items: TItem[];
}

interface StructuredSection {
  id: string;
  title: string;
  type: 'list' | 'hoteles' | 'gastronomia' | 'texto' | 'unknown';
  items?: any[];
  plato_tradicional?: string;
  extras?: any[];
  paragraphs?: string[];
  list?: string[];
}

interface ChatGroups<TItem = SessionWithPreview> {
  today: TItem[];
  yesterday: TItem[];
  last7: TItem[];
  last30: TItem[];
  older: TItem[];
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

  prompt = '';
  respuestas: Respuesta[] = [];
  typing = false;
  sending = false;
  showScrollToBottom = false;
  sidebarOpen = true;
  compactMode = false;

  sessions: SessionWithPreview[] = [];
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

  collapsedSections = new Set<string>();

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
    this.loadingService.hide();
  }

  async loadSessions(): Promise<void> {
    this.loadingService.show('Cargando historial...');
    try {
      const list = await this.iaService.listSessions({
        q: this.search.trim() || undefined,
        archived: this.showArchived
      }).toPromise();

      const raw = (list || []).map(s => ({ ...s })) as ChatSession[];
      const enriched: SessionWithPreview[] = [];
      for (const s of raw) {
        let preview = '';
        try {
          const msgs = await this.iaService.listMessages(s.id, { page: 1, limit: 10 }).toPromise();
          const items = (msgs?.items || []).slice().reverse();
          for (let i = items.length - 1; i >= 0; i--) {
            const m = items[i];
            if (m.role === 'user' && m.content) { preview = m.content; break; }
          }
        } catch { /* ignore preview errors */ }
        enriched.push({ ...(s as SessionWithPreview), preview_query: preview });
      }
      this.sessions = enriched;
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

    const groups: ChatGroups = { today: [], yesterday: [], last7: [], last30: [], older: [] };
    const sorted = [...this.sessions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    for (const s of sorted) {
      const d = new Date(s.updated_at);
      const diff = Math.ceil(Math.abs(today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (isToday(d)) groups.today.push(s);
      else if (isYesterday(d)) groups.yesterday.push(s);
      else if (diff <= 7) groups.last7.push(s);
      else if (diff <= 30) groups.last30.push(s);
      else groups.older.push(s);
    }

    const result: SessionGroup[] = [];
    if (groups.today.length)     result.push({ label: 'Hoy', items: groups.today });
    if (groups.yesterday.length) result.push({ label: 'Ayer', items: groups.yesterday });
    if (groups.last7.length)     result.push({ label: 'Últimos 7 días', items: groups.last7 });
    if (groups.last30.length)    result.push({ label: 'Últimos 30 días', items: groups.last30 });
    if (groups.older.length)     result.push({ label: 'Anteriores', items: groups.older });
    return result;
  }

  async createAndOpenSession(): Promise<void> {
    try {
      const s = await this.iaService.createSession().toPromise();
      if (s) {
        this.sessions = [{ ...(s as SessionWithPreview), preview_query: '' }, ...this.sessions];
        this.router.navigate(['/asistente-ia', s.id]);
      }
    } catch {
      if (!this.auth.getToken()) this.router.navigate(['/login']);
    }
  }

  async goToSession(s: SessionWithPreview): Promise<void> {
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
      const items = (pageResp.items || []).map((m: ChatMessage) => this.mapToRespuesta(m));
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

  lastUserQuery(): string | null {
    for (let i = this.respuestas.length - 1; i >= 0; i--) {
      const r = this.respuestas[i];
      if (r.from === 'user' && r.text) return r.text;
    }
    const s = this.sessions.find(ss => ss.id === this.currentSessionId);
    return s?.preview_query || null;
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
      this.push('ia', 'La conversación se copió al portapapeles en formato Markdown.');
    } catch {
      this.push('ia', 'No pude copiar automáticamente. Intenta manualmente.');
    }
  }

  async nuevoChat(): Promise<void> {
    if (this.sending) return;
    await this.createAndOpenSession();
  }

  async renameSession(s: SessionWithPreview): Promise<void> {
    const nuevo = prompt('Nuevo título de la conversación', s.title || '');
    if (nuevo === null || nuevo.trim() === '') return;
    this.renamingId = s.id;
    try {
      const upd = await this.iaService.patchSession(s.id, { title: nuevo.trim() }).toPromise();
      if (upd) {
        this.sessions = this.sessions.map(x => x.id === s.id ? { ...(upd as SessionWithPreview), preview_query: x.preview_query } : x);
        if (this.currentSessionId === s.id) this.currentSession = upd;
      }
    } finally {
      this.renamingId = null;
    }
  }

  async toggleArchive(s: SessionWithPreview): Promise<void> {
    this.archivingId = s.id;
    try {
      const upd = await this.iaService.patchSession(s.id, { archived: !s.archived }).toPromise();
      if (upd) {
        const updated = upd as SessionWithPreview;
        updated.preview_query = s.preview_query;
        this.sessions = this.sessions.map(x => x.id === s.id ? updated : x);
        if (this.currentSessionId === s.id) this.currentSession = upd;
        if (this.showArchived !== (upd as any).archived) await this.loadSessions();
      }
    } finally {
      this.archivingId = null;
    }
  }

  async deleteSession(s: SessionWithPreview): Promise<void> {
    if (!confirm('¿Eliminar esta conversación? Esta acción es irreversible.')) return;
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
    this.showScrollToBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) > 120;
  }
  scrollToBottom(): void {
    this.chatEl?.nativeElement.scrollTo({ top: this.chatEl.nativeElement.scrollHeight, behavior: 'smooth' });
  }
  scrollToBottomSoon(): void {
    setTimeout(() => this.scrollToBottom(), 50);
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
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  toggleLayoutMode(): void { this.compactMode = !this.compactMode; }

  renderMarkdown(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    const safeHtml = DOMPurify.sanitize(marked.parse(text) as string);
    return this.sanitizer.bypassSecurityTrustHtml(safeHtml);
  }

  expandAll(): void { this.collapsedSections.clear(); }
  collapseAll(): void {
    const secs = this.structuredSections(this.latestIaResponseRaw());
    secs.forEach(s => this.collapsedSections.add(s.id));
  }
  toggleCompact(): void { this.compactMode = !this.compactMode; }
  toggleSection(id: string): void {
    if (this.collapsedSections.has(id)) this.collapsedSections.delete(id);
    else this.collapsedSections.add(id);
  }
  objectEntries(obj: any): { key: string; value: any }[] {
    if (!obj) return [];
    return Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
  }
  private latestIaResponseRaw(): string {
    for (let i = this.respuestas.length - 1; i >= 0; i--) {
      if (this.respuestas[i].from === 'ia') return this.respuestas[i].text;
    }
    return '';
  }

  structuredSections(htmlOrRaw: string): StructuredSection[] {
    if (!htmlOrRaw) return [];
    const scriptMatch = htmlOrRaw.match(/<script id=['"]munaybol-structured['"] type=['"]application\/json['"]>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return [];
    let data: any;
    try { data = JSON.parse(scriptMatch[1]); } catch { return []; }

    const sections: StructuredSection[] = [];
    const onlySpecific = !!data.only_specific;

    if (data.hotel_consulta) {
      const h = data.hotel_consulta;
      sections.push({
        id: 'hotel_detalle',
        title: 'Hotel Consultado',
        type: 'texto',
        paragraphs: [
          `Nombre: ${h.nombre}`,
          h.departamento ? `Departamento: ${h.departamento}` : '',
          `Ubicación: ${h.ubicacion}`,
          h.calificacion !== undefined ? `Calificación: ${h.calificacion}/5` : '',
          `Rango precios: ${h.rango_precios_bs}`,
          h.descripcion
        ].filter(Boolean)
      });
    }

    if (data.lugar_consulta) {
      const p = data.lugar_consulta;
      const costos = p.costos ? Object.keys(p.costos).map((k: string) => `${k}: ${p.costos[k]}`) : [];
      sections.push({
        id: 'lugar_detalle',
        title: 'Lugar Turístico Consultado',
        type: 'texto',
        paragraphs: [
          `Nombre: ${p.nombre}`,
          p.departamento ? `Departamento: ${p.departamento}` : '',
          `Descripción: ${p.descripcion}`,
          `Horario: ${p.horario}`,
          costos.length ? `Costos: ${costos.join(', ')}` : ''
        ].filter(Boolean)
      });
    }

    if (!onlySpecific) {
      if (data.lugares_turisticos && Array.isArray(data.lugares_turisticos)) {
        sections.push({ id: 'lugares', title: 'Lugares Turísticos', type: 'list', items: data.lugares_turisticos });
      }
      if (data.hoteles && Array.isArray(data.hoteles)) {
        sections.push({ id: 'hoteles', title: 'Hoteles Recomendados', type: 'hoteles', items: data.hoteles });
      }
      if (data.gastronomia) {
        sections.push({
          id: 'gastronomia',
          title: 'Gastronomía Típica',
          type: 'gastronomia',
          plato_tradicional: data.gastronomia.plato_tradicional,
          extras: data.gastronomia.extras || []
        });
      }
      if (data.historia_cultura_festividades) {
        const fest = data.historia_cultura_festividades.festividades || [];
        sections.push({
          id: 'historia',
          title: 'Historia y Festividades',
          type: 'texto',
          paragraphs: [
            `Aniversario: ${data.historia_cultura_festividades.aniversario}`,
            data.resumen ? `Resumen: ${data.resumen}` : ''
          ].filter(Boolean),
          list: fest
        });
      }
      if (data.informacion_practica) {
        const pr = data.informacion_practica;
        const paras: string[] = [];
        if (pr.clima) paras.push(`Clima: ${pr.clima}`);
        if (pr.mejor_epoca_visita) paras.push(`Mejor época: ${pr.mejor_epoca_visita}`);
        sections.push({ id: 'info', title: 'Información Práctica', type: 'texto', paragraphs: paras });
      }
      if (data.costos_promedio) {
        const c = data.costos_promedio;
        const paras = Object.keys(c).map((k: string) => `${this.humanizeKey(k)}: Bs. ${c[k]}`);
        sections.push({ id: 'costos', title: 'Costos Promedio', type: 'texto', paragraphs: paras });
      }
      if (data.transporte) {
        const t = data.transporte;
        const paras: string[] = [];
        if (t.acceso) paras.push(`Acceso: ${t.acceso}`);
        if (t.movilidad_urbana) paras.push(`Movilidad: ${t.movilidad_urbana}`);
        sections.push({ id: 'transporte', title: 'Transporte', type: 'texto', paragraphs: paras });
      }
      if (data.seguridad) {
        sections.push({ id: 'seguridad', title: 'Consejos de Seguridad', type: 'texto', paragraphs: [data.seguridad] });
      }
      if (data.dato_curioso) {
        sections.push({ id: 'curioso', title: 'Dato Curioso', type: 'texto', paragraphs: [data.dato_curioso] });
      }
      if (data.itinerario) {
        const it = data.itinerario;
        const paras: string[] = [it.titulo];
        for (const d of it.dias || []) {
          paras.push(`Día ${d.dia}: Mañana -> ${d.maniana}; Tarde -> ${d.tarde}`);
        }
        if (it.notas) paras.push(`Notas: ${it.notas}`);
        sections.push({ id: 'itinerario', title: 'Itinerario Sugerido', type: 'texto', paragraphs: paras });
      }
    }

    return sections;
  }

  private humanizeKey(k: string): string {
    return k.replace(/_/g,' ').replace(/bs$/i,'').trim().replace(/\b\w/g, c => c.toUpperCase());
  }

  async enviar(): Promise<void> {
    const msg = this.prompt.trim();
    if (!msg || this.sending) return;

    if (!this.currentSessionId) {
      await this.createAndOpenSession();
    }
    if (!this.currentSessionId) return;

    // Actualizar preview en sidebar en tiempo real
    const active = this.sessions.find(x => x.id === this.currentSessionId);
    if (active) {
      active.preview_query = msg;
      this.sessions = this.sessions.map(x => x.id === active.id ? active : x);
    }

    this.scrollToBottom();
    this.push('user', msg);
    this.prompt = '';
    const placeholderT = this.push('ia', '');

    this.sending = true;
    this.typing = true;

    try {
      const resp = await this.iaService.appendMessage(this.currentSessionId, msg).toPromise();
      const out = (resp?.assistant?.content ?? '').toString().trim() || 'No hay respuesta disponible.';
      const idx = this.respuestas.findIndex(r => r.t === placeholderT);
      if (idx >= 0) {
        this.respuestas[idx] = { from: 'ia', text: out, t: this.respuestas[idx].t };
      }
      const s = await this.iaService.getSession(this.currentSessionId).toPromise();
      if (s) {
        this.currentSession = s;
        this.sessions = this.sessions.map(x => x.id === s.id ? ({ ...(x as SessionWithPreview) }) : x);
      }
    } catch {
      const idx = this.respuestas.findIndex(r => r.t === placeholderT);
      if (idx >= 0) {
        this.respuestas[idx] = { from: 'ia', text: 'Error al obtener respuesta. Intenta de nuevo.', t: this.respuestas[idx].t };
      }
    } finally {
      this.sending = false;
      setTimeout(() => (this.typing = false), 250);
      this.scrollToBottomSoon();
    }
  }

  private push(from: Actor, text: string): number {
    let t = Date.now();
    if (this.respuestas.length > 0) {
      const last = this.respuestas[this.respuestas.length - 1].t;
      if (t <= last) t = last + 1;
    }
    this.respuestas.push({ from, text, t });
    this.scrollToBottomSoon();
    return t;
  }

  applyFilters(): void { this.loadSessions(); }
}

declare global { interface String { capitalize?(): string; } }
if (!String.prototype.capitalize) {
  // eslint-disable-next-line no-extend-native
  String.prototype.capitalize = function () { return this.charAt(0).toUpperCase() + this.slice(1); };
}

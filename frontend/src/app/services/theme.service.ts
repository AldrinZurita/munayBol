import { Injectable, Inject, PLATFORM_ID, RendererFactory2, Renderer2 } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private renderer: Renderer2;
  private currentTheme: 'light' | 'dark' = 'light';
  private themeSubject: BehaviorSubject<'light' | 'dark'>;

  public theme$: Observable<'light' | 'dark'>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private rendererFactory: RendererFactory2
  ) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
    this.themeSubject = new BehaviorSubject<'light' | 'dark'>('light');
    this.theme$ = this.themeSubject.asObservable();
    
    this.initializeTheme();
  }

  private initializeTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
      this.setTheme(initialTheme);
    }
  }

  private setTheme(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
    this.themeSubject.next(theme);
    
    if (isPlatformBrowser(this.platformId)) {
      if (theme === 'dark') {
        this.renderer.addClass(document.body, 'dark-theme');
      } else {
        this.renderer.removeClass(document.body, 'dark-theme');
      }
      localStorage.setItem('theme', theme);
    }
  }

  public toggleTheme(): void {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }
}
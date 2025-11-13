import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LoaderState {
  visible: boolean;
  label: string;
  progress: number;
}

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loaderState = new BehaviorSubject<LoaderState>({
    visible: false,
    label: 'Cargando...',
    progress: 0
  });

  public state$: Observable<LoaderState> = this.loaderState.asObservable();
  private progressTimer: any;
  constructor() { }
  show(label: string = 'Cargando...') {
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.loaderState.next({ visible: true, label, progress: 0 });
    this.progressTimer = setInterval(() => {
      const currentState = this.loaderState.value;
      const inc = Math.random() * 6 + 2; // 2% - 8%
      const targetCap = 90; // No llegar a 100% hasta que se llame a hide()
      const newProgress = Math.min(targetCap, currentState.progress + inc);

      this.loaderState.next({ ...currentState, progress: newProgress });
    }, 250);
  }

  hide() {
    if (!this.loaderState.value.visible) return;
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.progressTimer = undefined;
    this.loaderState.next({ ...this.loaderState.value, progress: 100 });

    setTimeout(() => {
      this.loaderState.next({ visible: false, label: '', progress: 0 });
    }, 300);
  }

  setProgress(progress: number) {
    this.loaderState.next({ ...this.loaderState.value, progress });
  }
}

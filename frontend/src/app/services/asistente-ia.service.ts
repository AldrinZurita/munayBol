import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AsistenteIaService {
  private chatId: string | null = null;
  constructor(private http: HttpClient) {}

  enviarPrompt(prompt: string): Observable<{ result: string; chat_id?: string }> {
    const body: any = { prompt };
    if (this.chatId) body.chat_id = this.chatId;
    return this.http.post<{ result: string; chat_id?: string }>('/api/llm/generate/', body)
      .pipe(
        tap(res => {
          if (res?.chat_id) {
            this.chatId = res.chat_id;
          }
        })
      );
  }

  resetChat() {
    this.chatId = null;
  }
}
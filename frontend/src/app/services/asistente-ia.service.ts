import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AsistenteIaService {
  constructor(private http: HttpClient) {}

  enviarPrompt(prompt: string): Observable<{ result: string }> {
    return this.http.post<{ result: string }>('/api/llm/generate/', { prompt });
  }
}
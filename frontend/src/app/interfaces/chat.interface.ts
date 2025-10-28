export type ChatRole = 'user' | 'assistant';

export interface ChatSession {
  id: string;
  title: string;
  archived: boolean;
  messages_count: number;
  last_message_at: string | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  ts: string; // ISO
}

export interface MessagesPage {
  session: string;
  page: number;
  limit: number;
  total: number;
  items: ChatMessage[];
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  link?: string;
}

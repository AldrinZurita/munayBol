import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Review {
  id?: number;
  usuario: {
    id: number;
    nombre: string;
    avatar_url?: string;
  };
  calificacion: number;
  comentario: string;
  fecha: Date;
}

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss']
})
export class ReviewsComponent {
  @Input() reviews: Review[] = [];
  @Input() canAddReview: boolean = false;
  @Input() currentUserId: number | null = null;
  @Output() reviewSubmitted = new EventEmitter<{calificacion: number, comentario: string}>();

  showAddReview = false;
  newReview = {
    calificacion: 5,
    comentario: ''
  };

  get averageRating(): number {
    if (this.reviews.length === 0) return 0;
    const sum = this.reviews.reduce((acc, r) => acc + r.calificacion, 0);
    return sum / this.reviews.length;
  }

  get roundedAverageRating(): number {
    return Math.round(this.averageRating);
  }

  get ratingDistribution(): {[key: number]: number} {
    const dist: {[key: number]: number} = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0};
    this.reviews.forEach(r => {
      dist[r.calificacion] = (dist[r.calificacion] || 0) + 1;
    });
    return dist;
  }

  getRatingPercentage(rating: number): number {
    if (this.reviews.length === 0) return 0;
    return (this.ratingDistribution[rating] / this.reviews.length) * 100;
  }

  getStarsArray(rating: number): boolean[] {
    return Array.from({length: 5}, (_, i) => i < rating);
  }

  setRating(rating: number) {
    this.newReview.calificacion = rating;
  }

  submitReview() {
    if (!this.newReview.comentario.trim()) {
      alert('Por favor escribe un comentario');
      return;
    }
    
    this.reviewSubmitted.emit({
      calificacion: this.newReview.calificacion,
      comentario: this.newReview.comentario.trim()
    });
    
    this.newReview = {
      calificacion: 5,
      comentario: ''
    };
    this.showAddReview = false;
  }

  cancelReview() {
    this.newReview = {
      calificacion: 5,
      comentario: ''
    };
    this.showAddReview = false;
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
    return `Hace ${Math.floor(diffDays / 365)} años`;
  }
}

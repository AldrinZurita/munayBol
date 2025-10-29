import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from './navbar/navbar';
import { FooterComponent } from './footer/footer';
import { LoadingComponent } from './components/loading/loading.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { ReviewsComponent } from './components/reviews/reviews.component';

@NgModule({
  imports: [
    CommonModule, 
    RouterModule, 
    NavbarComponent, 
    FooterComponent,
    LoadingComponent,
    CalendarComponent,
    ReviewsComponent
  ],
  exports: [
    NavbarComponent, 
    FooterComponent,
    LoadingComponent,
    CalendarComponent,
    ReviewsComponent
  ]
})
export class SharedModule { }

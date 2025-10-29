import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CalendarDay {
  date: Date;
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isAvailable: boolean;
  isOccupied: boolean;
  isInRange: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  @Input() availableDates: Date[] = []; // Green dates
  @Input() occupiedDates: Date[] = [];  // Red dates
  @Input() allowRangeSelection: boolean = true;
  @Input() minDate: Date = new Date();
  @Output() dateSelected = new EventEmitter<Date>();
  @Output() rangeSelected = new EventEmitter<{start: Date, end: Date}>();

  currentMonth: Date = new Date();
  calendarDays: CalendarDay[] = [];
  selectedStartDate: Date | null = null;
  selectedEndDate: Date | null = null;
  
  weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  ngOnInit() {
    this.generateCalendar();
  }

  generateCalendar() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const isCurrentMonth = date.getMonth() === month;
      const isAvailable = this.isDateAvailable(date);
      const isOccupied = this.isDateOccupied(date);
      const isSelected = this.isDateSelected(date);
      const isInRange = this.isDateInRange(date);
      
      days.push({
        date,
        day: date.getDate(),
        month: date.getMonth(),
        year: date.getFullYear(),
        isCurrentMonth,
        isToday: date.getTime() === today.getTime(),
        isSelected,
        isAvailable,
        isOccupied,
        isInRange
      });
    }
    
    this.calendarDays = days;
  }

  isDateAvailable(date: Date): boolean {
    return this.availableDates.some(d => {
      const availDate = new Date(d);
      availDate.setHours(0, 0, 0, 0);
      return availDate.getTime() === date.getTime();
    });
  }

  isDateOccupied(date: Date): boolean {
    return this.occupiedDates.some(d => {
      const occDate = new Date(d);
      occDate.setHours(0, 0, 0, 0);
      return occDate.getTime() === date.getTime();
    });
  }

  isDateSelected(date: Date): boolean {
    if (!this.selectedStartDate) return false;
    const startTime = this.selectedStartDate.getTime();
    const dateTime = date.getTime();
    
    if (!this.selectedEndDate) {
      return startTime === dateTime;
    }
    
    const endTime = this.selectedEndDate.getTime();
    return dateTime === startTime || dateTime === endTime;
  }

  isDateInRange(date: Date): boolean {
    if (!this.selectedStartDate || !this.selectedEndDate) return false;
    
    const dateTime = date.getTime();
    const startTime = this.selectedStartDate.getTime();
    const endTime = this.selectedEndDate.getTime();
    
    return dateTime > startTime && dateTime < endTime;
  }

  selectDate(day: CalendarDay) {
    if (!day.isCurrentMonth || day.isOccupied || day.date < this.minDate) return;
    
    if (!this.allowRangeSelection) {
      this.selectedStartDate = day.date;
      this.selectedEndDate = null;
      this.dateSelected.emit(day.date);
      this.generateCalendar();
      return;
    }
    
    // Range selection logic
    if (!this.selectedStartDate || (this.selectedStartDate && this.selectedEndDate)) {
      this.selectedStartDate = day.date;
      this.selectedEndDate = null;
    } else {
      if (day.date < this.selectedStartDate) {
        this.selectedEndDate = this.selectedStartDate;
        this.selectedStartDate = day.date;
      } else {
        this.selectedEndDate = day.date;
      }
      
      if (this.selectedStartDate && this.selectedEndDate) {
        this.rangeSelected.emit({
          start: this.selectedStartDate,
          end: this.selectedEndDate
        });
      }
    }
    
    this.generateCalendar();
  }

  previousMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
    this.generateCalendar();
  }

  clearSelection() {
    this.selectedStartDate = null;
    this.selectedEndDate = null;
    this.generateCalendar();
  }

  get currentMonthName(): string {
    return this.months[this.currentMonth.getMonth()];
  }

  get currentYear(): number {
    return this.currentMonth.getFullYear();
  }
}

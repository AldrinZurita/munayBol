import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from './navbar/navbar';
import { FooterComponent } from './footer/footer';

@NgModule({
  imports: [CommonModule, RouterModule, NavbarComponent, FooterComponent],
  exports: [NavbarComponent, FooterComponent]
})
export class SharedModule { }

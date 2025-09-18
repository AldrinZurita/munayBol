import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from './navbar/navbar';
import { Footer } from './footer/footer';

@NgModule({
  imports: [CommonModule, RouterModule, NavbarComponent, Footer],
  exports: [NavbarComponent, Footer]
})
export class SharedModule { }

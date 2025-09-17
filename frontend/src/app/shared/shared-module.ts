import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Navbar } from './navbar/navbar';
import { Footer } from './footer/footer';

@NgModule({
  imports: [CommonModule, RouterModule, Navbar, Footer],
  exports: [Navbar, Footer]
})
export class SharedModule { }

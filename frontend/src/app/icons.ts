import { NgModule } from '@angular/core';
import { NgxBootstrapIconsModule } from 'ngx-bootstrap-icons';
import {
  plusCircle,
  pencil,
  trash,
  eye,
  funnel,
  xCircle,
  chevronDown,
  search,
  plusSquareFill,
  geoAlt,
  building,
  star,
  starFill,
  starHalf,
} from 'ngx-bootstrap-icons';

const icons = {
  plusCircle,
  pencil,
  trash,
  eye,
  funnel,
  xCircle,
  chevronDown,
  search,
  plusSquareFill,
  geoAlt,
  building,
  star,
  starFill,
  starHalf,
};

@NgModule({
  imports: [NgxBootstrapIconsModule.pick(icons)],
  exports: [NgxBootstrapIconsModule],
})
export class IconsModule {}

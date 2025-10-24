import { NgModule } from '@angular/core';
import {
  NgxBootstrapIconsModule,
  plusCircle,
  pencil,
  trash,
  eye,
  funnel,
  xCircle,
  chevronDown,
  search,
  plusSquareFill
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
  plusSquareFill
};

@NgModule({
  imports: [NgxBootstrapIconsModule.pick(icons)],
  exports: [NgxBootstrapIconsModule]
})
export class IconsModule {}

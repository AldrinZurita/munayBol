import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { LoadingService, LoaderState } from '../../services/loading';

@Component({
  selector: 'app-global-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-loader.html',
  styleUrls: ['./global-loader.scss']
})
export class GlobalLoaderComponent {
  public loaderState$: Observable<LoaderState>;

  constructor(private loadingService: LoadingService) {
    this.loaderState$ = this.loadingService.state$;
  }
}

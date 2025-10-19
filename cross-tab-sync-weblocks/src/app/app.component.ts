import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DataSyncService } from './data-sync.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'cross-tab-sync-weblocks';
  private dataSyncService = inject(DataSyncService);
  data$!: Observable<string[]>;

  ngOnInit() {
    this.data$ = this.dataSyncService.data$;
  }

  onSync(): void {
    // Just call the service. The service handles all the logic.
    this.dataSyncService.syncData();
  }
}

// src/app/app.component.ts
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { BroadcastEventKey, BroadcastService } from './services/broadcast.service';
import { AuthService } from './services/auth.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private subscription: Subscription = new Subscription();
  private broadcastService = inject(BroadcastService, { optional: true });
  private authService = inject(AuthService);

  ngOnInit(): void {
    if (!this.broadcastService) return;

    // ✅ Listen for logout
    this.subscription.add(
      this.broadcastService.on<string>(BroadcastEventKey.Logout)
        .subscribe((reason) => this.authService.handleExternalLogout(reason))
    );

    // ✅ Listen for login
    this.subscription.add(
      this.broadcastService.on<string>(BroadcastEventKey.Login)
        .subscribe((token) => this.authService.handleExternalLogin(token))
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
// src/app/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BroadcastService, BroadcastEventKey } from './broadcast.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private broadcastService = inject(BroadcastService, { optional: true });

  private readonly TOKEN_KEY = 'auth_token';

  // 🔹 Simulated login (stores token + broadcast)
  login(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    if (this.broadcastService) {
      this.broadcastService.publish(BroadcastEventKey.Login, token);
    }
    this.router.navigateByUrl('/');
  }

  // 🔹 Local logout (no broadcast)
  private localLogout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.router.navigateByUrl('/login');
  }

  // 🔹 User-initiated logout (broadcast to all tabs)
  logout(reason: string = 'User logged out'): void {
    this.localLogout();
    if (this.broadcastService) {
      this.broadcastService.publish(BroadcastEventKey.Logout, reason);
    }
  }

  // 🔹 Handle logout broadcast from another tab
  handleExternalLogout(reason: string): void {
    console.log('Received logout from another tab:', reason);
    this.localLogout();
  }

  // 🔹 Handle login broadcast from another tab
  handleExternalLogin(token: string): void {
    console.log('Received login from another tab');
    localStorage.setItem(this.TOKEN_KEY, token);
    this.router.navigateByUrl('/');
  }

  // 🔹 Auth state
  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }
}

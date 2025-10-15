// src/app/broadcast.service.ts
import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export enum BroadcastEventKey {
  UserJoined = 'user:joined',
  UserLeft = 'user:left',
  ChatMessage = 'chat:message',
  FileUploaded = 'file:uploaded',
  ThemeChanged = 'app:themeChanged',
  Logout = 'user:logout',
  Login = 'user:login',
  Custom = 'app:custom'
}

export interface BroadcastMessage<T = any> {
  key: BroadcastEventKey;
  data?: T;
}

@Injectable({
  providedIn: 'root'
})
export class BroadcastService implements OnDestroy {
  private readonly messages$ = new Subject<BroadcastMessage>();
  private channel?: BroadcastChannel;
  private platformId: Object = inject(PLATFORM_ID);
  private isBroadcastChannelAvailable = false;
  private isBrowser = false;

  private readonly CHANNEL_NAME = 'my-app-channel';
  private readonly LOCAL_STORAGE_KEY = 'broadcast-fallback';

  constructor() {
    // ✅ Ensures that SSR builds won’t crash, since no window or localStorage calls happen during server rendering.
    /**
     * isPlatformBrowser: A function from Angular's common package that checks if the current platform is a browser.
     * In server-side rendering (SSR), Node.js runs your Angular code — but there’s no window, document, or browser APIs.
     * So when your service tries to access window directly, you get ERROR: "ReferenceError: window is not defined"
     */
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Only initialize in browser context
    if (this.isBrowser) {
      this.initializeChannel();
    }
  }

  private initializeChannel(): void {
    // ✅ Try BroadcastChannel
    if ('BroadcastChannel' in window) {
      try {
        /**
         * BroadcastChannel API: A modern browser API that allows simple communication between browsing contexts (like tabs, windows, or iframes) of the same origin.
         * It provides a way to send messages between different tabs or windows without needing a server or complex setup.
         * When you create a BroadcastChannel with a specific name, any other tab or window that creates a BroadcastChannel with the same name can listen for messages sent to that channel.
         */
        this.channel = new BroadcastChannel(this.CHANNEL_NAME);
        this.isBroadcastChannelAvailable = true;

        this.channel.onmessage = (event) => this.messages$.next(event.data);
      } catch (error) {
        console.warn('BroadcastChannel not available:', error);
      }
    }

    // ✅ Fallback to localStorage if BroadcastChannel not available
    if (!this.isBroadcastChannelAvailable) {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === this.LOCAL_STORAGE_KEY && event.newValue) {
          try {
            const message = JSON.parse(event.newValue) as BroadcastMessage;
            this.messages$.next(message);
          } catch (e) {
            console.error('Failed to parse storage message:', e);
          }
        }
      });
    }
  }

  /**
   * ✅ Publish a message (BroadcastChannel or localStorage fallback)
   * @param key 
   * @param data 
   * @returns 
   * <T> is a TypeScript generic type parameter. It allows the publish method to accept and broadcast data of any type, making the method flexible and type-safe.
   * For example: 
   * If you call publish<ChatMessage>(BroadcastEventKey.ChatMessage, chatData), then T is ChatMessage.
   * If you call publish<string>(BroadcastEventKey.ThemeChanged, 'dark'), then T is string.
   */
  publish<T>(key: BroadcastEventKey, data?: T): void {
    if (!this.isBrowser) return; // SSR guard

    const message: BroadcastMessage<T> = { key, data };

    if (this.isBroadcastChannelAvailable && this.channel) {
      this.channel.postMessage(message);
    } else {
      try {
        localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(message));
        localStorage.removeItem(this.LOCAL_STORAGE_KEY);
      } catch (e) {
        console.error('Broadcast fallback failed:', e);
      }
    }
  }

  // ✅ Listen for messages with specific key
  on<T>(key: BroadcastEventKey): Observable<T> {
    return this.messages$.asObservable().pipe(
      filter((message) => message.key === key),
      map((message) => message.data as T)
    );
  }

  // ✅ Clean up resources
  ngOnDestroy(): void {
    if (this.channel) this.channel.close();
    this.messages$.complete();
  }
}

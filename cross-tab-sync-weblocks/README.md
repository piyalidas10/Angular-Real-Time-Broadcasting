# Angular : Cross-Tab Sync with BroadcastChannel API & Web Locks API

When we have multiple TABs open, I want to know how only one browser tab performs the sync (like Google Drive does) , while others just wait and update after broadcast.

Here's how you can achieve this in Angular using the Web Locks API for leader election and the BroadcastChannel API for communication.

This solution ensures that even if 10 tabs click "Sync" at the same time, only one tab will acquire a "lock," perform the asynchronous data fetch (the "sync"), and then broadcast the new data to all other waiting tabs.

### Why need this Lock ?
You need a lock to prevent a race condition and resource waste.
Imagine you have 10 browser tabs open, and they all detect it's time to sync data (e.g., a timer fires, or the user comes back online).

***The Problem (Without a Lock)**

If you don't use a lock, this happens:
Tab 1: "Time to sync!" - - - - -> Makes an API call to your server.
Tab 2: "Time to sync!" - - - - -> Makes the exact same API call.
Tab 3: "Time to sync!" - - - - -> Makes the exact same API call.
…
Tab 10: "Time to sync!" - - - - -> Makes the exact same API call.

This is a "thundering herd" problem. 🌩️
Wasted Server Resources: Your server just received 10 identical, redundant requests, when it only needed to handle one. This scales very poorly.
Wasted Client Resources: Each tab is spending network, CPU, and battery to perform the same task.
Potential Data Corruption: If the "sync" isn't just getting data but also changing it (like a POST or PUT), you now have 10 tabs all trying to modify the same resource at the same time, which can lead to unpredictable results and data corruption.


***The Solution (With a Lock)**

The navigator.locks API acts like a "talking stick." Only the tab holding the stick is allowed to "talk" to the server.
All 10 tabs try to grab the lock: navigator.locks.request('my-sync-lock', ...)
The browser's lock manager instantly gives the lock to only one tab (e.g., Tab 7).
Tab 7 (The Leader): "I got the lock!" - - - - -> It proceeds to make the API call.
Other 9 Tabs: "The lock is taken." - - - - -> They do nothing. They just sit and wait quietly.
Tab 7 Finishes: It gets the new data from the server.
Tab 7 Broadcasts: It uses the BroadcastChannel to shout, "Hey everyone, here's the new data!"
All 10 Tabs Update: All tabs (including the leader) receive the broadcast and update their UI with the new data.

In short: The lock ensures that only one tab does the expensive work, preventing waste and ensuring data consistency.

### Realtime Use Cases for both features toghether
Simple Collaboration: In a lightweight collaborative tool (like a shared notepad), any change made in one tab can be broadcast to all other tabs, which then update their own view of the document.
Dashboard Updates: A user has a dashboard open on two monitors (two browser windows). When new data arrives (via the "leader" tab's WebSocket), it's broadcast, and both dashboards update in perfect sync.

### Example

***The Data Sync Service**
This service is the core of the logic. It uses navigator.locks to ensure only one instance of the app (i.e., one tab) can run the sync logic at a time.
This example assumes you're using modern, standalone Angular.

data-sync.service.ts
```
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// Define the shape of our broadcast message
interface SyncMessage {
  type: 'SYNC_COMPLETE';
  payload: string[]; // The new data
}

@Injectable({
  providedIn: 'root',
})
export class DataSyncService implements OnDestroy {
  // Use a BehaviorSubject to hold the app's state
  private dataSubject = new BehaviorSubject<string[]>(['Initial Data']);
  public data$: Observable<string[]> = this.dataSubject.asObservable();

  // Names for our lock and channel
  private readonly LOCK_NAME = 'my-app-sync-lock';
  private readonly CHANNEL_NAME = 'my-app-sync-channel';

  // The BroadcastChannel for cross-tab communication
  private channel: BroadcastChannel;

  constructor() {
    // 1. Initialize the BroadcastChannel
    this.channel = new BroadcastChannel(this.CHANNEL_NAME);

    // 2. Set up the listener for messages from other tabs
    this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      console.log('Received message from another tab:', event.data);
      if (event.data.type === 'SYNC_COMPLETE') {
        // 3. Update this tab's state with the new data from the leader
        this.dataSubject.next(event.data.payload);
      }
    };
  }

  /**
   * The public method components will call to initiate a sync.
   */
  public async syncData(): Promise<void> {
    console.log('Attempting to acquire sync lock...');

    // 4. Use navigator.locks.request to attempt to become the "leader"
    // The callback function will *only* execute if the lock is successfully acquired.
    // If another tab already has the lock, this function will simply wait until
    // the lock is released, and then *not* run the callback (because we use { ifAvailable: true }).
    //
    // UPDATE: A simpler and more robust way is to just let it wait.
    // The request() method queues requests. If a tab requests a lock
    // that's already held, it just waits until it's released.
    // The problem is we want the *other* tabs to just... wait.
    //
    // Let's use the { ifAvailable: true } option. If the lock is
    // NOT available, it will return `null` and we (this tab)
    // will just do nothing, knowing another tab is already syncing.

    const lock = await navigator.locks.request(
      this.LOCK_NAME,
      { ifAvailable: true }, // Don't wait; if lock is taken, return null
      (lock) => {
        // If lock is null, it means another tab is already syncing.
        if (lock) {
          console.log('✅ Lock acquired! This tab is the leader.');
          // 5. We are the leader. Perform the actual sync.
          // The lock is held until this async function completes.
          return this.performActualSync();
        } else {
          // 6. Lock was not acquired. Do nothing.
          console.log('🔒 Lock not acquired. Another tab is syncing. Waiting...');
          return Promise.resolve(); // Do nothing
        }
      }
    );

    if (lock === null) {
      // This logic path is for the { ifAvailable: true } option.
      // If we didn't get the lock, we just log it and wait for the broadcast.
      console.log('🔒 Lock held by another tab. This tab will wait.');
    }
  }

  /**
   * This is the "real" sync logic (e.g., an HTTP call to your backend).
   * It's private and only called by the "leader" tab.
   */
  private async performActualSync(): Promise<void> {
    console.log('Leader: Performing simulated API call (2 seconds)...');
    
    // Simulate a network request
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the new data
    const newData = [
      ...this.dataSubject.getValue(),
      `New Data from Leader @ ${new Date().toLocaleTimeString()}`,
    ];

    console.log('Leader: Sync complete. Broadcasting to other tabs...');

    // 7. Broadcast the new data to all other tabs
    this.channel.postMessage({
      type: 'SYNC_COMPLETE',
      payload: newData,
    });

    // 8. IMPORTANT: Update this tab's (the leader's) own state.
    // The BroadcastChannel does *not* send the message to itself.
    this.dataSubject.next(newData);
  }

  ngOnDestroy(): void {
    // 9. Clean up the channel when the service is destroyed
    this.channel.close();
  }
}
```

***The Component**
Now, here's a simple component that uses the service.

app.component.ts
```
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataSyncService } from './data-sync.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h1>Cross-Tab Sync Demo</h1>
    <p>Open this app in two tabs. Click 'Sync Data' in both at the same time.
       Check the console to see only one tab becomes the "leader".</p>

    <button (click)="onSync()">Sync Data</button>

    <h2>Current Data:</h2>
    <ul>
      <li *ngFor="let item of data$ | async">{{ item }}</li>
    </ul>
  `,
})
export class AppComponent {
  data$: Observable<string[]>;

  constructor(private dataSyncService: DataSyncService) {
    this.data$ = this.dataSyncService.data$;
  }

  onSync(): void {
    // Just call the service. The service handles all the logic.
    this.dataSyncService.syncData();
  }
}
```

### How to Test This
Run your Angular application.
Open http://localhost:4200 in Tab A.
Open http://localhost:4200 in Tab B.
Open the developer console (F12) in both tabs.
Click the "Sync Data" button in Tab A, and then immediately click the "Sync Data" button in Tab B.

What you will see:
Tab A Console:
    - Attempting to acquire sync lock...
    - ✅ Lock acquired! This tab is the leader.
    - Leader: Performing simulated API call (2 seconds)...
    - Leader: Sync complete. Broadcasting to other tabs...

Tab B Console:
    - Attempting to acquire sync lock...
    - 🔒 Lock held by another tab. This tab will wait.
    - (After 2 seconds) Received message from another tab: {type: 'SYNC_COMPLETE', ...}

Both tabs' UIs will update with the new data simultaneously, but only Tab A did the actual "work."
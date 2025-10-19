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
    // We use { ifAvailable: true }. If the lock is NOT available,
    // it will return `null` and this tab will just do nothing,
    // knowing another tab is already syncing.

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
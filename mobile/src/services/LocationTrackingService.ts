import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import { apiClient } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TrackingStatus =
  | 'NOT_REQUIRED'
  | 'ELIGIBLE'
  | 'USER_CONSENTED'
  | 'PERMISSION_GRANTED'
  | 'TRACKING_ACTIVE'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'STOPPED';

const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';
const TRACKING_STATUS_STORAGE_KEY = '@tracking_status';
const ACTIVE_JOB_ID_KEY = 'active_tracking_job_id';
const LOCATION_CONSENT_KEY = '@location_consent_granted';
const LOCATION_CONSENT_TIMESTAMP_KEY = '@location_consent_timestamp';

let currentTrackingStatus: TrackingStatus = 'NOT_REQUIRED';
const statusListeners = new Set<(status: TrackingStatus) => void>();

// Define the background location task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error(`[LocationTask] Error:`, error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    
    if (location) {
      try {
        const jobId = await AsyncStorage.getItem(ACTIVE_JOB_ID_KEY);
        if (!jobId) {
          console.log('[LocationTask] No active tracking job found.');
          return;
        }

        const payload = {
          job_id: jobId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 0,
          speed: location.coords.speed || 0,
          heading: location.coords.heading || 0,
          timestamp: new Date(location.timestamp).toISOString(),
        };

        const res = await apiClient.post('/tracking/location', payload);
        
        if (res.data && res.data.stop) {
          console.log(`[LocationTask] Backend commanded stop for job ${jobId}. Terminating tracking.`);
          await LocationTrackingService.stopTracking('ARRIVED');
          return;
        }
        
        console.log(`[LocationTask] Sent location for job ${jobId}`);
      } catch (err: any) {
        console.error('[LocationTask] Failed to send location', err);
        if (err.response?.data?.stop || err.response?.status === 403) {
          console.log('[LocationTask] Backend rejected tracking (stop/forbidden). Terminating background updates.');
          await LocationTrackingService.stopTracking('STOPPED');
        }
      }
    }
  }
});

let foregroundTimer: ReturnType<typeof setInterval> | null = null;

async function sendLocationUpdate(jobId: string, location: Location.LocationObject) {
  try {
    const payload = {
      job_id: jobId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || 0,
      speed: location.coords.speed || 0,
      heading: location.coords.heading || 0,
      timestamp: new Date(location.timestamp).toISOString(),
    };

    const res = await apiClient.post('/tracking/location', payload);
    
    if (res.data && res.data.stop) {
      console.log(`[LocationService] Backend commanded stop for job ${jobId}. Terminating tracking.`);
      await LocationTrackingService.stopTracking('ARRIVED');
      return false;
    }
    console.log(`[LocationService] Sent location for job ${jobId}: ${payload.latitude}, ${payload.longitude}`);
    return true;
  } catch (err: any) {
    console.error('[LocationService] Failed to send location', err);
    if (err.response?.data?.stop || err.response?.status === 403) {
      console.log('[LocationService] Backend rejected tracking (stop/forbidden). Terminating updates.');
      await LocationTrackingService.stopTracking('STOPPED');
      return false;
    }
  }
  return false;
}

export const LocationTrackingService = {
  getTrackingStatus(): TrackingStatus {
    return currentTrackingStatus;
  },

  async loadInitialStatus(): Promise<TrackingStatus> {
    try {
      const saved = await AsyncStorage.getItem(TRACKING_STATUS_STORAGE_KEY);
      if (saved) {
        currentTrackingStatus = saved as TrackingStatus;
      }
    } catch (e) {
      console.warn('[LocationTrackingService] Error loading initial tracking status:', e);
    }
    return currentTrackingStatus;
  },

  async setTrackingStatus(status: TrackingStatus, jobId?: string): Promise<void> {
    currentTrackingStatus = status;
    try {
      await AsyncStorage.setItem(TRACKING_STATUS_STORAGE_KEY, status);
      statusListeners.forEach((listener) => {
        try {
          listener(status);
        } catch (err) {
          console.warn('[LocationTrackingService] Listener execution error:', err);
        }
      });

      // Best-effort push status update to backend
      apiClient.post('/tracking/status', {
        job_id: jobId,
        status: status,
      }).catch((err) => {
        console.log('[LocationTrackingService] Backend status notify notice:', err?.message);
      });
    } catch (e) {
      console.warn('[LocationTrackingService] Error persisting tracking status:', e);
    }
  },

  subscribeTrackingStatus(listener: (status: TrackingStatus) => void): () => void {
    statusListeners.add(listener);
    listener(currentTrackingStatus);
    return () => {
      statusListeners.delete(listener);
    };
  },

  async hasLocationConsent(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(LOCATION_CONSENT_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  },

  async saveLocationConsent(): Promise<void> {
    try {
      await AsyncStorage.setItem(LOCATION_CONSENT_KEY, 'true');
      await AsyncStorage.setItem(LOCATION_CONSENT_TIMESTAMP_KEY, new Date().toISOString());
    } catch (e) {
      console.warn('[LocationTrackingService] Error saving location consent:', e);
    }
  },

  async checkPermissions(): Promise<{ foreground: boolean; background: boolean }> {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      return {
        foreground: fg.status === 'granted',
        background: bg.status === 'granted',
      };
    } catch (e) {
      console.warn('[LocationTrackingService] Error checking permissions:', e);
      return { foreground: false, background: false };
    }
  },

  async requestForegroundPermission(): Promise<boolean> {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status === 'granted') {
        return true;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      console.error('[LocationTrackingService] Error requesting foreground permission:', e);
      return false;
    }
  },

  async requestBackgroundPermission(): Promise<boolean> {
    try {
      const bg = await Location.getBackgroundPermissionsAsync();
      if (bg.status === 'granted') {
        return true;
      }
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      console.warn('[LocationTrackingService] Error requesting background permission:', e);
      return false;
    }
  },

  // Legacy compatibility method
  async requestPermissions(showDisclosure?: () => Promise<boolean>, forceDisclosure: boolean = false) {
    const fgGranted = await this.requestForegroundPermission();
    if (!fgGranted) return false;

    try {
      const { background } = await this.checkPermissions();
      if (!background) {
        let userAgreed = false;
        if (showDisclosure) {
          userAgreed = await showDisclosure();
        } else {
          userAgreed = true;
        }

        if (userAgreed) {
          await this.requestBackgroundPermission();
        }
      }
    } catch (bgErr) {
      console.warn('[LocationTrackingService] Background request error:', bgErr);
    }

    return true;
  },

  isTrackingActive(): boolean {
    return currentTrackingStatus === 'TRACKING_ACTIVE' || foregroundTimer !== null;
  },

  async startTracking(jobId: string): Promise<boolean> {
    try {
      const activeJobId = await AsyncStorage.getItem(ACTIVE_JOB_ID_KEY);
      if (activeJobId === jobId && foregroundTimer) {
        console.log(`[LocationTrackingService] Already actively tracking job ${jobId}`);
        return true;
      }
    } catch (e) {
      console.warn('[LocationTrackingService] State check error:', e);
    }

    const { foreground } = await this.checkPermissions();
    if (!foreground) {
      console.warn('[LocationTrackingService] Foreground permissions not granted.');
      return false;
    }

    // Save job_id for background task and foreground loop to use
    await AsyncStorage.setItem(ACTIVE_JOB_ID_KEY, jobId);
    await this.setTrackingStatus('TRACKING_ACTIVE', jobId);

    // Notify backend that session is starting
    try {
      await apiClient.post('/tracking/session/start', { job_id: jobId });
    } catch (err) {
      console.error('[LocationTrackingService] Failed to notify backend of start', err);
    }

    // 1. Immediately send current position so the backend & map update instantly!
    try {
      const immediateLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (immediateLocation) {
        await sendLocationUpdate(jobId, immediateLocation);
      }
    } catch (locErr) {
      console.warn('[LocationTrackingService] Immediate location error:', locErr);
    }

    // 2. Start active in-app foreground interval (guarantees updates every 10s while app is open)
    if (foregroundTimer) {
      clearInterval(foregroundTimer);
    }
    foregroundTimer = setInterval(async () => {
      try {
        const currentJobId = await AsyncStorage.getItem(ACTIVE_JOB_ID_KEY);
        if (!currentJobId) {
          if (foregroundTimer) clearInterval(foregroundTimer);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (loc) {
          await sendLocationUpdate(currentJobId, loc);
        }
      } catch (err: any) {
        console.warn('[LocationTrackingService] Foreground interval tick error:', err?.message);
      }
    }, 10000);

    // 3. Start background location updates task
    try {
      let hasStarted = false;
      try {
        hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      } catch (_) {}

      if (hasStarted) {
        try {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        } catch (_) {}
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000, // Update every 10 seconds
        distanceInterval: 0, // Updates even if stationary
        deferredUpdatesInterval: 10000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Live Job Tracking Active',
          notificationBody: 'Sharing your real-time ETA starting 15 minutes before your shift.',
          notificationColor: '#0B5B31',
        },
      });
      console.log(`[LocationTrackingService] Background task started for job ${jobId}`);
    } catch (bgTaskErr) {
      console.warn('[LocationTrackingService] Background location task could not start (will rely on foreground loop):', bgTaskErr);
    }

    return true;
  },

  async stopTracking(reason: TrackingStatus = 'STOPPED') {
    const jobId = await AsyncStorage.getItem(ACTIVE_JOB_ID_KEY);
    
    // Clear storage first to stop any pending loop
    await AsyncStorage.removeItem(ACTIVE_JOB_ID_KEY);

    // Clear active foreground interval
    if (foregroundTimer) {
      clearInterval(foregroundTimer);
      foregroundTimer = null;
    }

    // Stop the background task
    try {
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRegistered) {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          console.log('[LocationTrackingService] Background tracking stopped.');
        }
      }
    } catch (e) {
      console.warn('[LocationTrackingService] Error stopping location updates:', e);
    }

    await this.setTrackingStatus(reason, jobId || undefined);

    // Notify backend that session is stopping
    if (jobId) {
      try {
        await apiClient.post('/tracking/session/stop', { job_id: jobId });
      } catch (err) {
        console.error('[LocationTrackingService] Failed to notify backend of stop', err);
      }
    }
  }
};

// Initialize initial status from storage
LocationTrackingService.loadInitialStatus().catch((e) => {
  console.warn('[LocationTrackingService] Init error:', e);
});

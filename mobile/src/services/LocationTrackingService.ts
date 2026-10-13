import * as Location from 'expo-location';
import { Alert } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import { apiClient } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

// Define the task
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
        // Retrieve the current active job_id from storage
        const jobId = await AsyncStorage.getItem('active_tracking_job_id');
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
          await AsyncStorage.removeItem('active_tracking_job_id');
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          return;
        }
        
        console.log(`[LocationTask] Sent location for job ${jobId}`);
      } catch (err: any) {
        console.error('[LocationTask] Failed to send location', err);
        // If backend returned stop command or worker is unauthorized/completed
        if (err.response?.data?.stop || err.response?.status === 403) {
          console.log('[LocationTask] Backend rejected tracking (stop/forbidden). Terminating background updates.');
          await AsyncStorage.removeItem('active_tracking_job_id');
          try {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          } catch (_) {}
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
      await LocationTrackingService.stopTracking();
      return false;
    }
    console.log(`[LocationService] Sent location for job ${jobId}: ${payload.latitude}, ${payload.longitude}`);
    return true;
  } catch (err: any) {
    console.error('[LocationService] Failed to send location', err);
    if (err.response?.data?.stop || err.response?.status === 403) {
      console.log('[LocationService] Backend rejected tracking (stop/forbidden). Terminating updates.');
      await LocationTrackingService.stopTracking();
      return false;
    }
  }
  return false;
}

export const LocationTrackingService = {
  async requestPermissions(showDisclosure?: () => Promise<boolean>, forceDisclosure: boolean = false) {
    console.log('[LocationTrackingService] Checking current permissions...');
    const fg = await Location.getForegroundPermissionsAsync();
    console.log('[LocationTrackingService] Foreground status:', fg.status);

    let hasForeground = fg.status === 'granted';

    // Step 1: Request Foreground Permission if not yet granted
    if (!hasForeground) {
      console.log('[LocationTrackingService] Requesting Foreground Permission...');
      const { status: reqFgStatus } = await Location.requestForegroundPermissionsAsync();
      hasForeground = reqFgStatus === 'granted';
      if (!hasForeground) {
        console.log('[LocationTrackingService] Foreground permission denied.');
        return false;
      }
    }

    // Step 2: Try to request background permission as best-effort for background updates
    try {
      const currentBg = await Location.getBackgroundPermissionsAsync();
      if (currentBg.status !== 'granted') {
        let userAgreed = false;
        if (showDisclosure) {
          userAgreed = await showDisclosure();
        } else {
          userAgreed = await new Promise((resolve) => {
            Alert.alert(
              "Location Tracking Requirement",
              "SahYogi collects location data to enable real-time ETA tracking for store managers during active shifts.",
              [
                { text: "Skip", onPress: () => resolve(false), style: "cancel" },
                { text: "Allow", onPress: () => resolve(true) }
              ],
              { cancelable: true }
            );
          });
        }

        if (userAgreed) {
          console.log('[LocationTrackingService] Requesting Background Permission...');
          await Location.requestBackgroundPermissionsAsync();
        }
      }
    } catch (bgErr) {
      console.warn('[LocationTrackingService] Background permission request error/skipped:', bgErr);
    }

    // As long as foreground location is granted, we can proceed with tracking
    return true;
  },

  async startTracking(jobId: string, showDisclosure?: () => Promise<boolean>) {
    // Check if already tracking this exact job
    try {
      const activeJobId = await AsyncStorage.getItem('active_tracking_job_id');
      if (activeJobId === jobId && foregroundTimer) {
        console.log(`[LocationTrackingService] Already actively tracking job ${jobId}`);
        return true;
      }
    } catch (e) {
      console.warn('[LocationTrackingService] State check error:', e);
    }

    // Only prompt disclosure if permissions are not yet granted
    const hasPermissions = await this.requestPermissions(showDisclosure, false);
    if (!hasPermissions) {
      console.warn('[LocationTrackingService] Foreground permissions not granted.');
      return false;
    }

    // Save job_id for background task and foreground loop to use
    await AsyncStorage.setItem('active_tracking_job_id', jobId);

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
        const currentJobId = await AsyncStorage.getItem('active_tracking_job_id');
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
          notificationBody: 'Sharing your real-time ETA with the store manager.',
          notificationColor: '#0B5B31',
        },
      });
      console.log(`[LocationTrackingService] Background task started for job ${jobId}`);
    } catch (bgTaskErr) {
      console.warn('[LocationTrackingService] Background location task could not start (will rely on foreground loop):', bgTaskErr);
    }

    Alert.alert(
      "Live Location Sharing Active",
      "Your location is being shared with the store manager.",
      [{ text: "OK" }]
    );
    return true;
  },

  async stopTracking() {
    const jobId = await AsyncStorage.getItem('active_tracking_job_id');
    
    // Clear storage first to stop any pending loop
    await AsyncStorage.removeItem('active_tracking_job_id');

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

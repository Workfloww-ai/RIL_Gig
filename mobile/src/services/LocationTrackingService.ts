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

export const LocationTrackingService = {
  async requestPermissions(showDisclosure?: () => Promise<boolean>, forceDisclosure: boolean = false) {
    console.log('[LocationTrackingService] Checking current permissions...');
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    console.log('[LocationTrackingService] Foreground:', fg.status, 'Background:', bg.status);

    // If both already granted and not forced, we are good to go!
    if (fg.status === 'granted' && bg.status === 'granted' && !forceDisclosure) {
      return true;
    }

    // Step 1: Request Foreground Permission if not yet granted
    if (fg.status !== 'granted') {
      console.log('[LocationTrackingService] Requesting Foreground Permission...');
      const { status: reqFgStatus } = await Location.requestForegroundPermissionsAsync();
      if (reqFgStatus !== 'granted') {
        console.log('[LocationTrackingService] Foreground permission denied.');
        return false;
      }
    }

    // Check background again
    const currentBg = await Location.getBackgroundPermissionsAsync();
    if (currentBg.status === 'granted' && !forceDisclosure) {
      return true;
    }

    // Step 2: Show Prominent Disclosure before requesting background permission
    console.log('[LocationTrackingService] Showing Prominent Disclosure Alert...');
    let userAgreed = false;
    if (showDisclosure) {
      userAgreed = await showDisclosure();
    } else {
      userAgreed = await new Promise((resolve) => {
        Alert.alert(
          "Background Location Requirement",
          "SahYogi collects location data to enable real-time ETA tracking for store managers even when the app is closed or not in use.",
          [
            { text: "Deny", onPress: () => resolve(false), style: "cancel" },
            { text: "Accept", onPress: () => resolve(true) }
          ],
          { cancelable: false }
        );
      });
    }

    if (!userAgreed) {
      console.log('[LocationTrackingService] User denied prominent disclosure.');
      return false;
    }

    // Step 3: Request Background Permission
    console.log('[LocationTrackingService] Requesting Background Permission...');
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    return backgroundStatus === 'granted';
  },

  async startTracking(jobId: string, showDisclosure?: () => Promise<boolean>) {
    // Check if already tracking this exact job
    try {
      const activeJobId = await AsyncStorage.getItem('active_tracking_job_id');
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isRegistered && hasStarted && activeJobId === jobId) {
        console.log(`[LocationTrackingService] Already tracking job ${jobId}`);
        return true;
      }
    } catch (e) {
      console.warn('[LocationTrackingService] State check error:', e);
    }

    // Only prompt disclosure if permissions are not yet granted
    const hasPermissions = await this.requestPermissions(showDisclosure, false);
    if (!hasPermissions) {
      console.warn('[LocationTrackingService] Permissions not granted.');
      return false;
    }

    // Save job_id for the background task to use
    await AsyncStorage.setItem('active_tracking_job_id', jobId);

    // Notify backend that session is starting
    try {
      await apiClient.post('/tracking/session/start', { job_id: jobId });
    } catch (err) {
      console.error('[LocationTrackingService] Failed to notify backend of start', err);
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!hasStarted) {
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
      console.log(`[LocationTrackingService] Tracking started for job ${jobId}`);
    }
    return true;
  },

  async stopTracking() {
    const jobId = await AsyncStorage.getItem('active_tracking_job_id');
    
    // Always clear storage first to stop any pending background loop
    await AsyncStorage.removeItem('active_tracking_job_id');

    // Stop the background task
    try {
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRegistered) {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          console.log('[LocationTrackingService] Tracking stopped.');
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

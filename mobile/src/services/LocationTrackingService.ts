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
      } catch (err) {
        console.error('[LocationTask] Failed to send location', err);
      }
    }
  }
});

export const LocationTrackingService = {
  async requestPermissions(showDisclosure?: () => Promise<boolean>) {
    console.log('[LocationTrackingService] Checking current permissions...');
    const { status: currentBackgroundStatus } = await Location.getBackgroundPermissionsAsync();
    console.log('[LocationTrackingService] Current Background Status:', currentBackgroundStatus);
    
    // Show prominent disclosure ONLY if background permission is not already granted
    if (currentBackgroundStatus !== 'granted') {
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
    }

    // Now request Foreground, then Background
    console.log('[LocationTrackingService] Requesting Foreground Permission...');
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus === 'granted') {
      if (currentBackgroundStatus === 'granted') {
        return true;
      }
      console.log('[LocationTrackingService] Requesting Background Permission...');
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      return backgroundStatus === 'granted';
    }
    
    console.log('[LocationTrackingService] Foreground permission denied.');
    return false;
  },

  async startTracking(jobId: string) {
    const hasPermissions = await this.requestPermissions();
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
        distanceInterval: 0, // Set to 0 for testing so it updates even if you are sitting at a desk!
        deferredUpdatesInterval: 10000,
        foregroundService: {
          notificationTitle: 'Tracking Active',
          notificationBody: 'Your location is being tracked for the current job.',
          notificationColor: '#0000FF',
        },
      });
      console.log(`[LocationTrackingService] Tracking started for job ${jobId}`);
    }
    return true;
  },

  async stopTracking() {
    const jobId = await AsyncStorage.getItem('active_tracking_job_id');
    
    // Stop the background task
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isTaskRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('[LocationTrackingService] Tracking stopped.');
    }

    // Notify backend that session is stopping
    if (jobId) {
      try {
        await apiClient.post('/tracking/session/stop', { job_id: jobId });
      } catch (err) {
        console.error('[LocationTrackingService] Failed to notify backend of stop', err);
      }
      await AsyncStorage.removeItem('active_tracking_job_id');
    }
  }
};

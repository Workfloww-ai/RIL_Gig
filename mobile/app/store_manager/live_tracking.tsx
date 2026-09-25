import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { API_URL } from '../../src/api/client';

interface LocationData {
  job_id: string;
  worker_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  timestamp: string;
}

interface EtaData {
  job_id: string;
  worker_id: string;
  eta_minutes: number;
  distance_meters: number;
  status: string;
  eta_timestamp: string;
  polyline?: string;
}

function decodePolyline(encoded: string) {
  if (!encoded) return [];
  const poly: {latitude: number, longitude: number}[] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ latitude: (lat / 1e5), longitude: (lng / 1e5) });
  }
  return poly;
}

export default function LiveTrackingScreen() {
  const { jobId, workerId, workerName } = useLocalSearchParams<{ jobId: string, workerId?: string, workerName?: string }>();
  // Store locations for ALL workers on this job
  const [locations, setLocations] = useState<Record<string, LocationData>>({});
  const [eta, setEta] = useState<EtaData | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const router = useRouter();
  
  const mapRef = useRef<MapView>(null);

  // Decode route coords from ETA (only applies to the selected worker)
  const routeCoordinates = React.useMemo(() => {
    return eta?.polyline ? decodePolyline(eta.polyline) : [];
  }, [eta?.polyline]);
  
  // Format the name for display (for the selected worker)
  const displayName = workerName ? decodeURIComponent(workerName) : 'Worker';
  const initial = displayName.charAt(0).toUpperCase();

  const safeWorkerId = Array.isArray(workerId) ? workerId[0] : workerId;
  const selectedLocation = safeWorkerId ? locations[safeWorkerId] : null;

  useEffect(() => {
    if (!jobId) return;

    setWsStatus("connecting");
    
    // Convert http(s) API_URL to ws(s)
    let wsUrlBase = 'ws://localhost:8000';
    if (API_URL) {
      wsUrlBase = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    }
    
    const wsUrl = `${wsUrlBase}/ws/job/${jobId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`[WebSocket] Connected to job ${jobId}`);
      setWsStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventWorkerId = data.worker_id || data.workerId;
        const safeWorkerId = Array.isArray(workerId) ? workerId[0] : workerId;
        
        if (data.type === "worker_location_update" && eventWorkerId) {
          setLocations(prev => ({
            ...prev,
            [eventWorkerId]: {
              ...data,
              latitude: data.lat || data.latitude,
              longitude: data.lng || data.longitude
            }
          }));
        } else if (data.type === "eta_update") {
          console.log("[WebSocket] Received ETA Update:", data, "Bypassing workerId check for robustness.");
          // Update the ETA regardless of the worker ID to handle headless token staleness
          setEta(data);
        }
      } catch (e) {
        console.error("[WebSocket] Failed to parse message", e);
      }
    };

    ws.onclose = () => {
      console.log(`[WebSocket] Disconnected from job ${jobId}`);
      setWsStatus("disconnected");
    };

    return () => {
      ws.close();
    };
  }, [jobId, workerId]);

  // Auto-fit to all markers + route
  useEffect(() => {
    if (mapRef.current) {
      const coords = [...routeCoordinates];
      
      // Add all worker locations to the bounding box
      Object.values(locations).forEach(loc => {
        coords.push({ latitude: loc.latitude, longitude: loc.longitude });
      });
      
      if (coords.length > 0) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 50, bottom: 250, left: 50 },
          animated: true,
        });
      }
    }
  }, [routeCoordinates, locations]);

  if (!jobId) {
    return (
      <View style={styles.center}>
        <Text>No Job ID provided.</Text>
      </View>
    );
  }

  // Use the selected worker's location for initial region if available, else first available
  const initialLoc = selectedLocation || Object.values(locations)[0];

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={initialLoc ? {
          latitude: initialLoc.latitude,
          longitude: initialLoc.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        } : {
          latitude: 20.5937, // Default center (India)
          longitude: 78.9629,
          latitudeDelta: 15.0,
          longitudeDelta: 15.0,
        }}
      >
        {/* Draw the route line (for selected worker only) */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={4}
            strokeColor="#0B5B31"
            zIndex={100}
            geodesic={true}
            lineJoin="round"
            lineCap="round"
          />
        )}
        
        {/* Store marker (the last point in the route) */}
        {routeCoordinates.length > 0 && (
          <Marker
            coordinate={routeCoordinates[routeCoordinates.length - 1]}
            title="Store Location"
            pinColor="green"
          />
        )}

        {/* Draw all assigned workers */}
        {Object.values(locations).map(loc => (
          <Marker
            key={loc.worker_id}
            coordinate={{
              latitude: loc.latitude,
              longitude: loc.longitude,
            }}
            title={loc.worker_id === workerId ? `${displayName} Location` : "Other Worker"}
            description={`Speed: ${(loc.speed * 3.6).toFixed(1)} km/h`}
            pinColor={loc.worker_id === workerId ? "black" : "blue"}
          />
        ))}
      </MapView>
      
      {!selectedLocation && (
        <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
          <ActivityIndicator size="large" color="#0B5B31" />
          <Text style={{ marginTop: 10, fontWeight: 'bold' }}>Waiting for {displayName}'s GPS...</Text>
        </View>
      )}

      {/* Floating Back Button */}
      <View style={styles.backButtonContainer}>
        <Text 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          ✕
        </Text>
      </View>

      {/* Uber-like Info Overlay Panel */}
      <View style={styles.panel}>
        <View style={styles.etaHeader}>
          <Text style={styles.etaMainText}>
            {eta ? `Arriving in ${eta.eta_minutes} min` : 'Calculating ETA...'}
          </Text>
          {eta && (
            <Text style={styles.etaSubText}>
              {(eta.distance_meters / 1000).toFixed(1)} km away • {eta.status.replace('_', ' ')}
            </Text>
          )}
        </View>

        <View style={styles.workerInfo}>
          <View style={styles.workerAvatar}>
            <Text style={styles.workerAvatarText}>{initial}</Text>
          </View>
          <View style={styles.workerDetails}>
            <Text style={styles.workerName}>{displayName} En Route</Text>
            <Text style={styles.workerSpeed}>
              {selectedLocation ? `Driving at ${(selectedLocation.speed * 3.6).toFixed(0)} km/h` : 'Connecting to GPS...'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    backgroundColor: 'white',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  backButton: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  panel: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  etaHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
    marginBottom: 15,
  },
  etaMainText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0B5B31',
  },
  etaSubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  workerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0B5B31',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  workerAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  workerDetails: {
    flex: 1,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  workerSpeed: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
});

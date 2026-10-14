import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_URL, apiClient } from '../../src/api/client';

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
  const [storeData, setStoreData] = useState<{ store_name?: string; latitude?: number; longitude?: number } | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [trackingEnded, setTrackingEnded] = useState<boolean>(false);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
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

    // 1. Initial HTTP fetch for latest location & ETA & store info
    apiClient.get(`/tracking/job/${jobId}`)
      .then(res => {
        if (res.data) {
          if (res.data.location_data) {
            const loc = res.data.location_data;
            const wId = loc.worker_id || safeWorkerId;
            if (wId) {
              setLocations(prev => ({
                ...prev,
                [wId]: {
                  job_id: jobId,
                  worker_id: wId,
                  latitude: loc.lat || loc.latitude,
                  longitude: loc.lng || loc.longitude,
                  accuracy: loc.accuracy || 0,
                  speed: loc.speed || 0,
                  heading: loc.heading || 0,
                  timestamp: loc.timestamp || new Date().toISOString()
                }
              }));
            }
          }
          if (res.data.eta_data) {
            setEta(res.data.eta_data);
          }
          if (res.data.store_data) {
            setStoreData(res.data.store_data);
          }
        }
      })
      .catch(err => {
        console.log("[LiveTracking] Initial state fetch error:", err?.message);
      });

    setWsStatus("connecting");
    
    // Convert http(s) API_URL to ws(s)
    let wsUrlBase = 'ws://localhost:8000';
    if (API_URL) {
      wsUrlBase = API_URL.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '');
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
        const currentTargetId = Array.isArray(workerId) ? workerId[0] : workerId;
        
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
          setEta(data);
        } else if (data.type === "tracking_stopped") {
          console.log("[WebSocket] Tracking stopped for job/worker:", data);
          if (eventWorkerId) {
            setLocations(prev => {
              const updated = { ...prev };
              delete updated[eventWorkerId];
              return updated;
            });
          }
          if (!eventWorkerId || eventWorkerId === currentTargetId) {
            setTrackingEnded(true);
          }
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
  }, [jobId, safeWorkerId]);

  // Auto-fit to all markers + route once the native map is ready
  useEffect(() => {
    if (mapRef.current && isMapReady) {
      const coords = [...routeCoordinates];
      
      if (storeData?.latitude && storeData?.longitude) {
        coords.push({ latitude: storeData.latitude, longitude: storeData.longitude });
      }

      // Add all worker locations to the bounding box
      Object.values(locations).forEach(loc => {
        coords.push({ latitude: loc.latitude, longitude: loc.longitude });
      });
      
      if (coords.length >= 2) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 120, right: 60, bottom: 280, left: 60 },
          animated: true,
        });
      } else if (coords.length === 1) {
        mapRef.current.animateToRegion({
          latitude: coords[0].latitude,
          longitude: coords[0].longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 500);
      }
    }
  }, [routeCoordinates, locations, isMapReady, storeData]);

  if (!jobId) {
    return (
      <View style={styles.center}>
        <Text>No Job ID provided.</Text>
      </View>
    );
  }

  const initialRegion = {
    latitude: selectedLocation?.latitude || storeData?.latitude || 28.4428,
    longitude: selectedLocation?.longitude || storeData?.longitude || 77.0106,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        onMapReady={() => setIsMapReady(true)}
        showsCompass={true}
        showsScale={true}
      >

        {/* Draw the route line (for selected worker only) */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={5}
            strokeColor="#0B5B31"
            zIndex={100}
            geodesic={true}
            lineJoin="round"
            lineCap="round"
          />
        )}
        
        {/* Store marker (either from storeData or the last point in the route) */}
        {(storeData?.latitude && storeData?.longitude) ? (
          <Marker
            coordinate={{ latitude: storeData.latitude, longitude: storeData.longitude }}
            title={storeData.store_name || "Store Location"}
            pinColor="green"
            zIndex={200}
          />
        ) : routeCoordinates.length > 0 ? (
          <Marker
            coordinate={routeCoordinates[routeCoordinates.length - 1]}
            title="Store Location"
            pinColor="green"
            zIndex={200}
          />
        ) : null}

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
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={loc.heading || 0}
            zIndex={1000}
          >
            {loc.worker_id === workerId ? (
              <View style={{
                backgroundColor: 'white',
                padding: 4,
                borderRadius: 25,
                borderWidth: 2,
                borderColor: '#0B5B31',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
                elevation: 5,
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40
              }}>
                <Text style={{ fontSize: 22 }}>🏍️</Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: 'blue',
                width: 15,
                height: 15,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: 'white'
              }} />
            )}
          </Marker>
        ))}
      </MapView>
      
      {!selectedLocation && routeCoordinates.length === 0 && (
        <View style={styles.floatingConnectingBanner}>
          <ActivityIndicator size="small" color="#0B5B31" style={{ marginRight: 8 }} />
          <Text style={styles.floatingConnectingText}>Connecting to {displayName}'s live GPS...</Text>
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
        {trackingEnded ? (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 8 }}>
              <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 13 }}>✓ Shift Started / Arrived</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 }}>
              OTP Verified — Tracking Concluded
            </Text>
            <Text style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 14 }}>
              {displayName} has started their shift. Live location tracking has automatically stopped.
            </Text>
            <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#0B5B31', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Return to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.etaHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.etaMainText}>
                  {eta ? `Arriving in ${eta.eta_minutes} min` : 'Calculating ETA...'}
                </Text>
                {eta && (
                  <Text style={styles.etaSubText}>
                    {(eta.distance_meters / 1000).toFixed(1)} km away • {eta.status.replace('_', ' ')}
                  </Text>
                )}
              </View>
              
              {selectedLocation && (
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <View style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#BBF7D0' }}>
                    <Text style={{ color: '#166534', fontWeight: '800', fontSize: 16 }}>
                      {Math.round(selectedLocation.speed * 3.6)} <Text style={{ fontSize: 10, fontWeight: '600' }}>km/h</Text>
                    </Text>
                  </View>
                  <Text style={{ color: '#9CA3AF', fontSize: 9, marginTop: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Live Speed
                  </Text>
                </View>
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
          </>
        )}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  floatingConnectingBanner: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 999,
  },
  floatingConnectingText: {
    color: '#0B5B31',
    fontWeight: '700',
    fontSize: 13,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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

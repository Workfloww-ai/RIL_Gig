import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';
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
}

export default function LiveTrackingScreen() {
  const { jobId, workerId } = useLocalSearchParams<{ jobId: string, workerId?: string }>();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [eta, setEta] = useState<EtaData | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  
  const mapRef = useRef<MapView>(null);

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
        
        if (data.type === "worker_location_update") {
          if (workerId && eventWorkerId && eventWorkerId !== workerId) return;
          
          setLocation({
            ...data,
            latitude: data.lat || data.latitude,
            longitude: data.lng || data.longitude
          });
        } else if (data.type === "eta_update") {
          if (workerId && eventWorkerId && eventWorkerId !== workerId) return;
          
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
  }, [jobId]);

  if (!jobId) {
    return (
      <View style={styles.center}>
        <Text>No Job ID provided.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        style={styles.map}
        region={location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : {
          latitude: 20.5937, // Default center (India)
          longitude: 78.9629,
          latitudeDelta: 15.0,
          longitudeDelta: 15.0,
        }}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Worker Location"
            description={`Speed: ${(location.speed * 3.6).toFixed(1)} km/h`}
          />
        )}
      </MapView>
      
      {!location && (
        <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
          <ActivityIndicator size="large" color="#0B5B31" />
          <Text style={{ marginTop: 10, fontWeight: 'bold' }}>Waiting for worker GPS...</Text>
        </View>
      )}

      {/* Info Overlay Panel */}
      <View style={styles.panel}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: wsStatus === 'connected' ? 'green' : 'red' }]} />
          <Text style={styles.statusText}>Gateway: {wsStatus}</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.label}>ETA STATUS</Text>
            <Text style={[styles.value, { color: eta?.status === 'DELAYED' ? 'red' : 'green' }]}>
              {eta ? eta.status : 'WAITING'}
            </Text>
            {eta && (
              <Text style={styles.subtext}>
                {eta.eta_minutes} mins ({(eta.distance_meters / 1000).toFixed(1)} km)
              </Text>
            )}
          </View>

          <View style={styles.infoCol}>
            <Text style={styles.label}>CURRENT SPEED</Text>
            <Text style={styles.value}>
              {location ? `${(location.speed * 3.6).toFixed(1)} km/h` : '--'}
            </Text>
            {location && (
              <Text style={styles.subtext}>
                Updated: {new Date(location.timestamp).toLocaleTimeString()}
              </Text>
            )}
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
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#999',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
  },
  subtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

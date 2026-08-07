import axios from 'axios';

// Update this to your machine's local IP (e.g., 192.168.1.5) if testing on a physical device.
// 10.0.2.2 works for Android Emulator. localhost works for iOS Simulator.
export const API_URL = 'http://10.5.53.211:8000/api';  

export const apiClient = axios.create({
  baseURL: API_URL,

});

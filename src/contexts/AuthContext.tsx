import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  ref,
  set,
  get,
  onValue,
  off,
  push,
  remove,
  update,
  query,
  orderByChild,
  equalTo,
} from 'firebase/database';
import { auth, database, secondaryAuth } from '@/lib/firebase';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'guardian';
  phone?: string;
  linkedDevices?: string[];
}

export interface Device {
  id: string;
  assignedTo: string;
  userName: string;
  userPhone: string;
  mentorPhone: string;
  gps: { lat: number; lng: number };
  battery: number;
  fallStatus: boolean;
  vibrationStatus: boolean;
  movementStatus: boolean;
  lastUpdated: number;
  imageURL?: string;
  // IoT data source mapping
  dataSource?: string; // Maps to SmartStickData/{dataSource}
  // Raw IoT sensor data
  distance1_cm?: number;
  distance2_cm?: number;
  pitch?: number;
  upTime?: number; // Device uptime in seconds
  lastUpTime?: number; // Previous up_time value to detect changes
  lastUpTimeTimestamp?: number; // When up_time last changed
  fallHistory?: { timestamp: number; lat: number; lng: number }[];
  distanceTravelled?: number; // Total distance travelled in km
}

// IoT sensor data from SmartStickData
interface SmartStickIoTData {
  distance1_cm?: number;
  distance2_cm?: number;
  fallDetected?: boolean;
  latitude?: number;
  longitude?: number;
  pitch?: number;
  uptime_seconds?: number;
  current_time?: string;
  distance_traveled_m?: number;
}

interface AuthContextType {
  user: User | null;
  authError: string | null;
  clearAuthError: () => void;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  users: User[];
  devices: Device[];
  availableIoTSources: string[]; // List of SmartStickData node names
  addGuardian: (guardian: Omit<User, 'id' | 'role'> & { password: string }) => Promise<void>;
  linkDeviceToGuardian: (deviceId: string, guardianId: string) => Promise<void>;
  unlinkDeviceFromGuardian: (deviceId: string, guardianId: string) => Promise<void>;
  removeGuardian: (guardianId: string) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  addDevice: (deviceId: string, dataSource?: string) => Promise<void>;
  updateDeviceInfo: (deviceId: string, data: Partial<Device>) => Promise<void>;
  addFallHistory: (deviceId: string, gps: { lat: number, lng: number }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to convert Firebase user to app User
const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
  try {
    const userRef = ref(database, `users/${firebaseUser.uid}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      // Convert linkedDevices object to array
      const linkedDevicesObj = data.linkedDevices || {};
      const linkedDevicesArray = typeof linkedDevicesObj === 'object' && linkedDevicesObj !== null
        ? Object.values(linkedDevicesObj).filter((v): v is string => typeof v === 'string')
        : [];

      return {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: data.name || '',
        role: data.role || 'guardian',
        phone: data.phone,
        linkedDevices: linkedDevicesArray,
      };
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
  return null;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [iotData, setIotData] = useState<Record<string, SmartStickIoTData>>({});
  // Track up_time changes per IoT source to detect online/offline
  const [upTimeTracker, setUpTimeTracker] = useState<Record<string, { lastValue: number; lastChangeTime: number }>>({});
  // Track GPS changes to detect if moving
  const [gpsTracker, setGpsTracker] = useState<Record<string, { lat: number; lng: number; lastChangeTime: number }>>({});

  // Reference trick so onValue listener doesn't need to depend on 'devices' state
  const devicesRef = React.useRef<Device[]>([]);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  const clearAuthError = () => setAuthError(null);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser);
        if (userData) {
          setUser(userData);
        } else {
          // User exists in Auth but no database record - keep signed in, show error, let them use /setup
          setUser(null);
          setAuthError('User profile missing. Go to /setup to create your admin record.');
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      const userData = await fetchUserData(firebaseUser);
      setUser(userData);
      setAuthError(null);
    }
  };

  // Listen to users data
  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const usersData: User[] = [];
        snapshot.forEach((child) => {
          const data = child.val();
          // Convert linkedDevices object to array
          const linkedDevicesObj = data.linkedDevices || {};
          const linkedDevicesArray = typeof linkedDevicesObj === 'object' && linkedDevicesObj !== null
            ? Object.values(linkedDevicesObj).filter((v): v is string => typeof v === 'string')
            : [];

          usersData.push({
            id: child.key!,
            email: data.email || '',
            name: data.name || '',
            role: data.role || 'guardian',
            phone: data.phone,
            linkedDevices: linkedDevicesArray,
          });
        });
        setUsers(usersData);
      } else {
        setUsers([]);
      }
    });

    return () => off(usersRef, 'value', unsubscribe);
  }, []);

  // Listen to devices data
  useEffect(() => {
    const devicesRef = ref(database, 'devices');
    const unsubscribe = onValue(devicesRef, (snapshot) => {
      if (snapshot.exists()) {
        const devicesData: Device[] = [];
        snapshot.forEach((child) => {
          const data = child.val();
          devicesData.push({
            id: child.key!,
            assignedTo: data.assignedTo || '',
            userName: data.userName || '',
            userPhone: data.userPhone || '',
            mentorPhone: data.mentorPhone || '',
            gps: data.gps || { lat: 19.3444, lng: 83.5684 },
            battery: data.battery ?? 75,
            fallStatus: data.fallStatus || false,
            vibrationStatus: data.vibrationStatus || false,
            movementStatus: data.movementStatus || false,
            lastUpdated: data.lastUpdated || Date.now(),
            imageURL: data.imageURL,
            dataSource: data.dataSource || '',
            distanceTravelled: data.distanceTravelled || 0,
            fallHistory: data.fallHistory ? Object.values(data.fallHistory).sort((a: any, b: any) => b.timestamp - a.timestamp) as { timestamp: number; lat: number; lng: number }[] : [],
          });
        });
        setDevices(devicesData);
      } else {
        setDevices([]);
      }
    });

    return () => off(devicesRef, 'value', unsubscribe);
  }, []);

  // Listen to SmartStickData (IoT sensor data)
  useEffect(() => {
    const iotRef = ref(database, 'SmartStickData');
    const unsubscribe = onValue(iotRef, (snapshot) => {
      if (snapshot.exists()) {
        const data: Record<string, SmartStickIoTData> = {};
        snapshot.forEach((child) => {
          data[child.key!] = child.val();
        });
        setIotData(data);

        // Track up_time changes
        setUpTimeTracker(prev => {
          const updated = { ...prev };
          Object.entries(data).forEach(([source, iot]) => {
            const currentUpTime = iot.uptime_seconds ?? 0;
            const existing = prev[source];
            if (!existing) {
              let initialTime = 0;
              if (iot.current_time) {
                const deviceTime = new Date(iot.current_time.replace(' ', 'T')).getTime();
                if (!isNaN(deviceTime) && Math.abs(Date.now() - deviceTime) < 60000) {
                  initialTime = Date.now();
                }
              }
              updated[source] = { lastValue: currentUpTime, lastChangeTime: initialTime };
            } else if (currentUpTime !== existing.lastValue) {
              updated[source] = { lastValue: currentUpTime, lastChangeTime: Date.now() };
            }
          });
          return updated;
        });

        // Track GPS changes
        setGpsTracker(prev => {
          const updated = { ...prev };
          Object.entries(data).forEach(([source, iot]) => {
            const currentLat = Number(iot.latitude) || 0;
            const currentLng = Number(iot.longitude) || 0;
            const existing = prev[source];
            if (!existing) {
              updated[source] = { lat: currentLat, lng: currentLng, lastChangeTime: prev[source] ? prev[source].lastChangeTime : 0 };
            } else if (currentLat !== existing.lat || currentLng !== existing.lng) {
              updated[source] = { lat: currentLat, lng: currentLng, lastChangeTime: Date.now() };
            }
          });
          return updated;
        });
      } else {
        setIotData({});
      }
    });

    return () => off(iotRef, 'value', unsubscribe);
  }, []);

  // Removed backend overwriting logic to keep online status clean and simple natively in the UI

  // Merge IoT data with devices
  const mergedDevices: Device[] = devices.map(device => {
    const iotSource = device.dataSource;
    if (iotSource && iotData[iotSource]) {
      const iot = iotData[iotSource];
      const tracker = upTimeTracker[iotSource];
      const lastChangeTime = tracker?.lastChangeTime || 0;
      // Device is online if up_time changed within the last 30 seconds
      const isOnline = lastChangeTime > 0 && (Date.now() - lastChangeTime < 30000);

      const movementTracker = gpsTracker[iotSource];
      const lastGpsChangeTime = movementTracker && movementTracker.lastChangeTime > 0 ? movementTracker.lastChangeTime : 0;
      // Device is moving if GPS coordinates updated their value within the last 30 seconds
      const isMoving = lastGpsChangeTime > 0 && (Date.now() - lastGpsChangeTime < 30000);

      const lat = iot.latitude ? Number(iot.latitude) : device.gps.lat;
      const lng = iot.longitude ? Number(iot.longitude) : device.gps.lng;

      if (!isOnline) {
        let fallbackTime = device.lastUpdated;
        if (iot.current_time) {
          const deviceTime = new Date(iot.current_time.replace(' ', 'T')).getTime();
          if (!isNaN(deviceTime)) fallbackTime = deviceTime;
        }

        return {
          ...device,
          gps: {
            lat: lat !== 0 ? lat : device.gps.lat,
            lng: lng !== 0 ? lng : device.gps.lng,
          },
          fallStatus: false,
          vibrationStatus: false,
          movementStatus: false,
          distance1_cm: 0,
          distance2_cm: 0,
          pitch: 0,
          upTime: iot.uptime_seconds,
          distanceTravelled: iot.distance_traveled_m !== undefined ? iot.distance_traveled_m : device.distanceTravelled,
          lastUpdated: fallbackTime,
        };
      }

      return {
        ...device,
        gps: {
          lat: lat !== 0 ? lat : device.gps.lat,
          lng: lng !== 0 ? lng : device.gps.lng,
        },
        fallStatus: iot.fallDetected ?? device.fallStatus,
        vibrationStatus: (iot.distance1_cm !== undefined && iot.distance1_cm < 100) ||
          (iot.distance2_cm !== undefined && iot.distance2_cm < 100) ||
          device.vibrationStatus,
        movementStatus: isMoving,
        distance1_cm: iot.distance1_cm,
        distance2_cm: iot.distance2_cm,
        pitch: iot.pitch,
        upTime: iot.uptime_seconds,
        distanceTravelled: iot.distance_traveled_m !== undefined ? iot.distance_traveled_m : device.distanceTravelled,
        lastUpdated: Date.now(),
      };
    }
    return device;
  });

  // Get available IoT sources (SmartStickData nodes not yet assigned to any device)
  const usedSources = devices.map(d => d.dataSource).filter(Boolean);
  const availableIoTSources = Object.keys(iotData).filter(source => !usedSources.includes(source));

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setAuthError(null);
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      const code = error?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setAuthError('No account found with this email. Create the user in Firebase Console > Authentication first.');
      } else if (code === 'auth/wrong-password') {
        setAuthError('Incorrect password.');
      } else if (code === 'auth/invalid-email') {
        setAuthError('Invalid email address.');
      } else if (code === 'auth/too-many-requests') {
        setAuthError('Too many failed attempts. Try again later.');
      } else {
        setAuthError(error?.message || 'Login failed. Check your email and password.');
      }
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const addGuardian = async (data: Omit<User, 'id' | 'role'> & { password: string }): Promise<void> => {
    try {
      // Check if email already exists
      const emailQuery = query(ref(database, 'users'), orderByChild('email'), equalTo(data.email.toLowerCase()));
      const snapshot = await get(emailQuery);
      if (snapshot.exists()) {
        throw new Error('Email already exists');
      }

      // Create Firebase Auth user using secondary auth (doesn't affect main auth state)
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
      const uid = userCredential.user.uid;

      // Create user record in database (still authenticated as admin on main auth)
      await set(ref(database, `users/${uid}`), {
        email: data.email.toLowerCase(),
        name: data.name,
        role: 'guardian',
        phone: data.phone || '',
        linkedDevices: [],
      });

      // Sign out from secondary auth
      await signOut(secondaryAuth);
    } catch (error: any) {
      console.error('Error adding guardian:', error);
      // Make sure to sign out from secondary auth on error too
      try { await signOut(secondaryAuth); } catch { }
      throw error;
    }
  };

  const linkDeviceToGuardian = async (deviceId: string, guardianId: string): Promise<void> => {
    try {
      // Get current device assignment
      const deviceRef = ref(database, `devices/${deviceId}`);
      const deviceSnapshot = await get(deviceRef);
      const currentAssignedTo = deviceSnapshot.exists() ? deviceSnapshot.val().assignedTo : '';

      // Remove device from previous guardian's linkedDevices
      if (currentAssignedTo && currentAssignedTo !== guardianId) {
        const prevGuardianRef = ref(database, `users/${currentAssignedTo}/linkedDevices`);
        const prevSnapshot = await get(prevGuardianRef);
        if (prevSnapshot.exists()) {
          const linkedDevices = prevSnapshot.val() || {};
          const updated = Object.keys(linkedDevices).reduce((acc, key) => {
            if (linkedDevices[key] !== deviceId) {
              acc[key] = linkedDevices[key];
            }
            return acc;
          }, {} as Record<string, string>);
          await set(prevGuardianRef, updated);
        }
      }

      // Add device to new guardian's linkedDevices
      const guardianRef = ref(database, `users/${guardianId}/linkedDevices`);
      const guardianSnapshot = await get(guardianRef);
      const linkedDevices = guardianSnapshot.exists() ? guardianSnapshot.val() || {} : {};

      // Check if already linked
      const isLinked = Object.values(linkedDevices).includes(deviceId);
      if (!isLinked) {
        const newKey = push(guardianRef).key;
        await set(ref(database, `users/${guardianId}/linkedDevices/${newKey}`), deviceId);
      }

      // Update device assignment
      await update(ref(database, `devices/${deviceId}`), {
        assignedTo: guardianId,
      });
    } catch (error) {
      console.error('Error linking device:', error);
      throw error;
    }
  };

  const unlinkDeviceFromGuardian = async (deviceId: string, guardianId: string): Promise<void> => {
    try {
      // Remove from guardian's linkedDevices
      const guardianRef = ref(database, `users/${guardianId}/linkedDevices`);
      const snapshot = await get(guardianRef);
      if (snapshot.exists()) {
        const linkedDevices = snapshot.val() || {};
        const updates: Record<string, null> = {};
        Object.keys(linkedDevices).forEach((key) => {
          if (linkedDevices[key] === deviceId) {
            updates[key] = null;
          }
        });
        await update(ref(database, `users/${guardianId}/linkedDevices`), updates);
      }

      // Clear device assignment
      await update(ref(database, `devices/${deviceId}`), {
        assignedTo: '',
      });
    } catch (error) {
      console.error('Error unlinking device:', error);
      throw error;
    }
  };

  const removeGuardian = async (guardianId: string): Promise<void> => {
    try {
      // Get guardian's linked devices
      const guardianRef = ref(database, `users/${guardianId}`);
      const snapshot = await get(guardianRef);
      if (snapshot.exists()) {
        const linkedDevices = snapshot.val().linkedDevices || {};

        // Unassign all devices
        const deviceUpdates: Record<string, any> = {};
        Object.values(linkedDevices).forEach((deviceId) => {
          deviceUpdates[`devices/${deviceId}/assignedTo`] = '';
        });
        if (Object.keys(deviceUpdates).length > 0) {
          await update(ref(database), deviceUpdates);
        }
      }

      // Remove user record
      await remove(ref(database, `users/${guardianId}`));

      // Note: Firebase Auth user deletion requires Admin SDK or user action
      // For now, we only remove the database record
    } catch (error) {
      console.error('Error removing guardian:', error);
      throw error;
    }
  };

  const removeDevice = async (deviceId: string): Promise<void> => {
    try {
      // Find and remove from all guardians' linkedDevices
      const usersRef = ref(database, 'users');
      const usersSnapshot = await get(usersRef);

      const updates: Record<string, any> = {};
      if (usersSnapshot.exists()) {
        usersSnapshot.forEach((userSnapshot) => {
          const linkedDevices = userSnapshot.val().linkedDevices || {};
          Object.keys(linkedDevices).forEach((key) => {
            if (linkedDevices[key] === deviceId) {
              updates[`users/${userSnapshot.key}/linkedDevices/${key}`] = null;
            }
          });
        });
      }

      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }

      // Remove device
      await remove(ref(database, `devices/${deviceId}`));
    } catch (error) {
      console.error('Error removing device:', error);
      throw error;
    }
  };

  const addDevice = async (deviceId: string, dataSource?: string): Promise<void> => {
    try {
      const deviceRef = ref(database, `devices/${deviceId}`);
      const snapshot = await get(deviceRef);
      if (snapshot.exists()) {
        throw new Error('Device already exists');
      }

      await set(deviceRef, {
        assignedTo: '',
        userName: '',
        userPhone: '',
        mentorPhone: '',
        gps: { lat: 19.3444, lng: 83.5684 },
        battery: 75,
        fallStatus: false,
        vibrationStatus: false,
        movementStatus: false,
        lastUpdated: Date.now(),
        dataSource: dataSource || '',
      });
    } catch (error) {
      console.error('Error adding device:', error);
      throw error;
    }
  };

  const updateDeviceInfo = async (deviceId: string, data: Partial<Device>): Promise<void> => {
    try {
      const updates: Record<string, any> = {};
      Object.keys(data).forEach((key) => {
        updates[`devices/${deviceId}/${key}`] = (data as any)[key];
      });
      await update(ref(database), updates);
    } catch (error) {
      console.error('Error updating device:', error);
      throw error;
    }
  };

  const addFallHistory = async (deviceId: string, gps: { lat: number, lng: number }): Promise<void> => {
    try {
      const historyRef = ref(database, `devices/${deviceId}/fallHistory`);
      const newKey = push(historyRef).key;
      if (newKey) {
        await set(ref(database, `devices/${deviceId}/fallHistory/${newKey}`), {
          timestamp: Date.now(),
          lat: gps.lat,
          lng: gps.lng
        });
      }
    } catch (error) {
      console.error('Error adding fall history:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      authError,
      clearAuthError,
      refreshUser,
      login,
      logout,
      isLoading,
      users,
      devices: mergedDevices,
      availableIoTSources,
      addGuardian,
      linkDeviceToGuardian,
      unlinkDeviceFromGuardian,
      removeGuardian,
      removeDevice,
      addDevice,
      updateDeviceInfo,
      addFallHistory,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

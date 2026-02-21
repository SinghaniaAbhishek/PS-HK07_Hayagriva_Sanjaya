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
import { auth, database } from '@/lib/firebase';

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
  addGuardian: (guardian: Omit<User, 'id' | 'role'> & { password: string }) => Promise<void>;
  linkDeviceToGuardian: (deviceId: string, guardianId: string) => Promise<void>;
  unlinkDeviceFromGuardian: (deviceId: string, guardianId: string) => Promise<void>;
  removeGuardian: (guardianId: string) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  addDevice: (deviceId: string) => Promise<void>;
  updateDeviceInfo: (deviceId: string, data: Partial<Device>) => Promise<void>;
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
            gps: data.gps || { lat: 28.6139, lng: 77.2090 },
            battery: data.battery ?? 100,
            fallStatus: data.fallStatus || false,
            vibrationStatus: data.vibrationStatus || false,
            movementStatus: data.movementStatus || false,
            lastUpdated: data.lastUpdated || Date.now(),
            imageURL: data.imageURL,
          });
        });
        setDevices(devicesData);
      } else {
        setDevices([]);
      }
    });

    return () => off(devicesRef, 'value', unsubscribe);
  }, []);

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

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const uid = userCredential.user.uid;

      // Create user record in database
      await set(ref(database, `users/${uid}`), {
        email: data.email.toLowerCase(),
        name: data.name,
        role: 'guardian',
        phone: data.phone || '',
        linkedDevices: [],
      });
    } catch (error: any) {
      console.error('Error adding guardian:', error);
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

  const addDevice = async (deviceId: string): Promise<void> => {
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
        gps: { lat: 28.6139, lng: 77.2090 },
        battery: 100,
        fallStatus: false,
        vibrationStatus: false,
        movementStatus: false,
        lastUpdated: Date.now(),
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
      devices,
      addGuardian,
      linkDeviceToGuardian,
      unlinkDeviceFromGuardian,
      removeGuardian,
      removeDevice,
      addDevice,
      updateDeviceInfo,
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

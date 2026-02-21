import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  users: User[];
  devices: Device[];
  addGuardian: (guardian: Omit<User, 'id' | 'role'> & { password: string }) => void;
  linkDeviceToGuardian: (deviceId: string, guardianId: string) => void;
  unlinkDeviceFromGuardian: (deviceId: string, guardianId: string) => void;
  removeGuardian: (guardianId: string) => void;
  removeDevice: (deviceId: string) => void;
  addDevice: (deviceId: string) => void;
  updateDeviceInfo: (deviceId: string, data: Partial<Device>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock data
const INITIAL_USERS: (User & { password: string })[] = [
  { id: 'admin-1', email: 'admin@sanjaya.com', password: 'admin123', name: 'System Admin', role: 'admin' },
  { id: 'guardian-1', email: 'guardian@sanjaya.com', password: 'guardian123', name: 'Rahul Sharma', role: 'guardian', phone: '+91 9876543210', linkedDevices: ['STICK-001', 'STICK-002'] },
];

const INITIAL_DEVICES: Device[] = [
  {
    id: 'STICK-001', assignedTo: 'guardian-1', userName: 'Ananya Sharma', userPhone: '+91 9123456789',
    mentorPhone: '+91 9876543210', gps: { lat: 28.6139, lng: 77.2090 }, battery: 78,
    fallStatus: false, vibrationStatus: false, movementStatus: true, lastUpdated: Date.now(),
  },
  {
    id: 'STICK-002', assignedTo: 'guardian-1', userName: 'Vikram Patel', userPhone: '+91 9234567890',
    mentorPhone: '+91 9876543210', gps: { lat: 28.6200, lng: 77.2150 }, battery: 45,
    fallStatus: false, vibrationStatus: false, movementStatus: false, lastUpdated: Date.now(),
  },
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<(User & { password: string })[]>(INITIAL_USERS);
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);

  useEffect(() => {
    const saved = localStorage.getItem('sanjaya_user');
    if (saved) setUser(JSON.parse(saved));
    setIsLoading(false);
  }, []);

  // Simulate real-time GPS movement
  useEffect(() => {
    const interval = setInterval(() => {
      setDevices(prev => prev.map(d => ({
        ...d,
        gps: {
          lat: d.gps.lat + (Math.random() - 0.5) * 0.0005,
          lng: d.gps.lng + (Math.random() - 0.5) * 0.0005,
        },
        battery: Math.max(0, d.battery - (Math.random() > 0.95 ? 1 : 0)),
        movementStatus: Math.random() > 0.3,
        lastUpdated: Date.now(),
      })));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const found = users.find(u => u.email === email && u.password === password);
    if (found) {
      const { password: _, ...userData } = found;
      setUser(userData);
      localStorage.setItem('sanjaya_user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sanjaya_user');
  };

  const addGuardian = (data: Omit<User, 'id' | 'role'> & { password: string }) => {
    const exists = users.some(u => u.email.toLowerCase() === data.email.toLowerCase());
    if (exists) return;
    const newUser = { ...data, id: `guardian-${Date.now()}`, role: 'guardian' as const, linkedDevices: [] };
    setUsers(prev => [...prev, newUser]);
  };

  const linkDeviceToGuardian = (deviceId: string, guardianId: string) => {
    // Unlink from previous guardian first
    setUsers(prev => prev.map(u => {
      const linked = u.linkedDevices || [];
      if (u.id === guardianId) {
        return linked.includes(deviceId) ? u : { ...u, linkedDevices: [...linked, deviceId] };
      }
      return { ...u, linkedDevices: linked.filter(id => id !== deviceId) };
    }));
    setDevices(prev => prev.map(d =>
      d.id === deviceId ? { ...d, assignedTo: guardianId } : d
    ));
  };

  const unlinkDeviceFromGuardian = (deviceId: string, guardianId: string) => {
    setUsers(prev => prev.map(u =>
      u.id === guardianId ? { ...u, linkedDevices: (u.linkedDevices || []).filter(id => id !== deviceId) } : u
    ));
    setDevices(prev => prev.map(d =>
      d.id === deviceId ? { ...d, assignedTo: '' } : d
    ));
  };

  const removeGuardian = (guardianId: string) => {
    setUsers(prev => prev.filter(u => u.id !== guardianId));
    setDevices(prev => prev.map(d =>
      d.assignedTo === guardianId ? { ...d, assignedTo: '' } : d
    ));
  };

  const removeDevice = (deviceId: string) => {
    setUsers(prev => prev.map(u => ({
      ...u,
      linkedDevices: (u.linkedDevices || []).filter(id => id !== deviceId),
    })));
    setDevices(prev => prev.filter(d => d.id !== deviceId));
  };

  const addDevice = (deviceId: string) => {
    const exists = devices.some(d => d.id === deviceId);
    if (exists) return;
    const newDevice: Device = {
      id: deviceId, assignedTo: '', userName: '', userPhone: '', mentorPhone: '',
      gps: { lat: 28.6139, lng: 77.2090 }, battery: 100,
      fallStatus: false, vibrationStatus: false, movementStatus: false, lastUpdated: Date.now(),
    };
    setDevices(prev => [...prev, newDevice]);
  };

  const updateDeviceInfo = (deviceId: string, data: Partial<Device>) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, ...data } : d));
  };

  return (
    <AuthContext.Provider value={{
      user, login, logout, isLoading,
      users: users.map(({ password, ...u }) => u),
      devices, addGuardian, linkDeviceToGuardian, unlinkDeviceFromGuardian, removeGuardian, removeDevice, addDevice, updateDeviceInfo,
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

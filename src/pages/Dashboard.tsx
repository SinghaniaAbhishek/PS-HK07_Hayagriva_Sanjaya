import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DeviceMap from '@/components/DeviceMap';
import { Eye, LogOut, Battery, Activity, Wifi, WifiOff, AlertTriangle, ChevronDown, Phone, User, MapPin, Vibrate, Camera, X, Pencil, Radar, RotateCw, Bell, LayoutDashboard, Video, AlertCircle, History, Navigation } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { requestNotificationPermission as requestFCMPermission, onForegroundMessage } from '@/lib/firebase';

declare global {
  interface Window { triggerStopFallAlert?: () => void; }
}

const OFFLINE_THRESHOLD = 30000;
const FALL_ALERT_INTERVAL = 15000; // 15 seconds to allow a 5-sec break
const VIBRATION_DURATION = 10000; // 10 seconds
const ALERT_PERSISTENCE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Request notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  // Also request FCM permission
  try {
    const token = await requestFCMPermission();
    if (token) {
      console.log('FCM token obtained:', token);
      // Store token in localStorage for now (ideally save to user's record in Firebase)
      localStorage.setItem('fcmToken', token);
    }
  } catch (error) {
    console.error('Error getting FCM permission:', error);
  }
};

// Send browser notification
const sendBrowserNotification = async (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration) {
          registration.showNotification(title, {
            body: body + '\nTap Acknowledge to stop alarm.',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'fall-alert',
            requireInteraction: true,
            vibrate: [1000, 100, 1000, 100, 1000, 100, 1000, 100, 1000, 100, 1000, 100],
            actions: [
              { action: 'open', title: 'Open Dashboard' },
              { action: 'acknowledge', title: 'Acknowledge' }
            ]
          });
          return;
        }
      } catch (e) {
        console.error('SW notification failed', e);
      }
    }

    // Fallback
    const notification = new Notification(title, {
      body: body + '\nClick here to STOP the alarm.',
      icon: '/favicon.ico',
      tag: 'fall-alert',
      requireInteraction: true,
      silent: false,
    });

    notification.onclick = () => {
      window.focus();
      if (window.triggerStopFallAlert) window.triggerStopFallAlert();
      notification.close();
    };
  }
};

// Trigger device vibration (mobile)
const triggerVibration = (duration: number) => {
  if ('vibrate' in navigator) {
    // Vibration pattern: vibrate for duration with short pauses
    const pattern = [];
    const pulseLength = 1000; // 1000ms intense vibration
    const pauseLength = 100; // 100ms tiny pause
    let remaining = duration;
    while (remaining > 0) {
      pattern.push(Math.min(pulseLength, remaining));
      remaining -= pulseLength;
      if (remaining > 0) {
        pattern.push(pauseLength);
        remaining -= pauseLength;
      }
    }
    navigator.vibrate(pattern);
  }
};

// Get stored fall alert state
const getStoredFallAlertState = (): { acknowledged: boolean; timestamp: number } | null => {
  const stored = localStorage.getItem('fallAlertState');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

// Store fall alert state
const storeFallAlertState = (acknowledged: boolean) => {
  localStorage.setItem('fallAlertState', JSON.stringify({
    acknowledged,
    timestamp: Date.now()
  }));
};

// Clear fall alert state
const clearFallAlertState = () => {
  localStorage.removeItem('fallAlertState');
};

const Dashboard = () => {
  const { user, logout, devices, updateDeviceInfo, addFallHistory } = useAuth();
  const navigate = useNavigate();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [alerts, setAlerts] = useState<{ id: string; type: string; message: string; time: Date; dismissed: boolean }[]>([]);
  // const [vibrationLog, setVibrationLog] = useState<{ time: Date; deviceId: string }[]>([]);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [setupForm, setSetupForm] = useState({ userName: '', userPhone: '', mentorPhone: '' });
  const [editRequestedByUser, setEditRequestedByUser] = useState(false);
  const [fallAlertAcknowledged, setFallAlertAcknowledged] = useState(false);
  const [fallAlertStartTime, setFallAlertStartTime] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string>('Detecting location...');

  // Tabs state
  const [activeTab, setActiveTab] = useState<'all' | 'location' | 'video' | 'fall' | 'history'>('all');

  const fallIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // High intensity piercing siren Web Audio nodes
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorNodesRef = useRef<{ osc: OscillatorNode, lfo: OscillatorNode, gain: GainNode } | null>(null);

  const myDevices = user?.role === 'guardian' ? devices.filter(d => (user.linkedDevices || []).includes(d.id)) : [];
  const selectedDevice = myDevices.find(d => d.id === selectedDeviceId) || myDevices[0];

  // Request notification permission on mount and handle foreground messages
  useEffect(() => {
    requestNotificationPermission();

    // Handle foreground FCM messages
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('Foreground message received:', payload);
      sendBrowserNotification(
        payload.notification?.title || 'Alert',
        payload.notification?.body || ''
      );
    });

    // Check for stored fall alert state on mount
    const storedState = getStoredFallAlertState();
    if (storedState) {
      const elapsed = Date.now() - storedState.timestamp;
      if (elapsed < ALERT_PERSISTENCE_DURATION) {
        // Alert was acknowledged less than 30 minutes ago
        setFallAlertAcknowledged(storedState.acknowledged);
        setFallAlertStartTime(storedState.timestamp);
      } else {
        // More than 30 minutes passed, clear the stored state
        clearFallAlertState();
      }
    }

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Use refs to hold the latest device data to avoid re-triggering effects
  const selectedDeviceRef = useRef(selectedDevice);
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  // Fall alert function
  const triggerFallAlert = useCallback(() => {
    const dev = selectedDeviceRef.current;
    if (!dev) return;

    // Play piercing audio using Web Audio API
    try {
      if (!audioCtxRef.current) {
        const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextConstructor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Stop previous if exists
      if (oscillatorNodesRef.current) {
        try {
          oscillatorNodesRef.current.osc.stop();
          oscillatorNodesRef.current.lfo.stop();
        } catch (e) { }
      }

      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const masterGain = ctx.createGain();

      osc.type = 'square'; // Piercing harsh tone
      osc.frequency.value = 1000;

      lfo.type = 'sine';
      lfo.frequency.value = 4; // 4 sweeps per second

      lfoGain.gain.value = 400; // Sweep +/- 400Hz

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      masterGain.gain.value = 1.0; // Max volume

      osc.connect(masterGain);
      masterGain.connect(ctx.destination);

      osc.start();
      lfo.start();

      oscillatorNodesRef.current = { osc, lfo, gain: masterGain };

      if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = setTimeout(() => {
        if (oscillatorNodesRef.current) {
          try {
            oscillatorNodesRef.current.osc.stop();
            oscillatorNodesRef.current.lfo.stop();
          } catch (e) { }
          oscillatorNodesRef.current = null;
        }
      }, VIBRATION_DURATION);
    } catch (e) {
      console.log('Audio autoplay blocked:', e);
    }

    // Trigger vibration (mobile)
    triggerVibration(VIBRATION_DURATION);

    // Send browser notification
    sendBrowserNotification(
      'FALL DETECTED!',
      `${dev.userName || dev.id} may have fallen. Immediate attention required!`
    );

    // Show toast
    toast.error('FALL DETECTED! Immediate attention required!', {
      duration: VIBRATION_DURATION,
    });
  }, []);

  // Acknowledgment persists until fallStatus becomes false. No 30-min auto resume.

  // Fall detection with repeating alerts
  useEffect(() => {
    if (!selectedDevice) return;

    if (selectedDevice.fallStatus && !fallAlertAcknowledged) {
      if (fallAlertStartTime && (Date.now() - fallAlertStartTime > ALERT_PERSISTENCE_DURATION)) {
        // Stop alerts if more than 30 mins elapsed without acknowledgement
        if (fallIntervalRef.current) {
          clearInterval(fallIntervalRef.current);
          fallIntervalRef.current = null;
        }
        return;
      }

      // Add alert to list if not exists
      setAlerts(prev => {
        if (!prev.find(a => a.type === 'fall' && !a.dismissed)) {
          return [...prev, {
            id: `fall-${Date.now()}`,
            type: 'fall',
            message: 'Fall Detected – Immediate Attention Required',
            time: new Date(),
            dismissed: false
          }];
        }
        return prev;
      });

      // Set fall alert start time if not set
      if (!fallAlertStartTime) {
        setFallAlertStartTime(Date.now());
      }

      // We only want to set up the interval and trigger ONCE per fall event.
      if (!fallIntervalRef.current) {
        addFallHistory(selectedDevice.id, selectedDevice.gps);
        // Trigger immediate alert
        triggerFallAlert();

        // Set up repeating interval
        fallIntervalRef.current = setInterval(() => {
          triggerFallAlert();
        }, FALL_ALERT_INTERVAL);
      }
    } else {
      // Clear interval when fall status is false or acknowledged
      if (fallIntervalRef.current) {
        clearInterval(fallIntervalRef.current);
        fallIntervalRef.current = null;
      }
      // Stop audio
      if (oscillatorNodesRef.current) {
        try {
          oscillatorNodesRef.current.osc.stop();
          oscillatorNodesRef.current.lfo.stop();
        } catch (e) { }
        oscillatorNodesRef.current = null;
      }
      if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
      // Stop vibration
      if ('vibrate' in navigator) {
        navigator.vibrate(0);
      }
    }

    return () => {
      // We intentionally do NOT clear the interval here automatically on unmount/re-render.
      // Doing so would interrupt the 10s ring cycle constantly.
      // The `else` block perfectly handles shutting down the alarm when status returns to false or is acknowledged.
    };
  }, [selectedDevice?.fallStatus, fallAlertAcknowledged, triggerFallAlert, fallAlertStartTime]);

  // Reset acknowledgment when fall status changes to false
  useEffect(() => {
    if (selectedDevice && !selectedDevice.fallStatus) {
      setFallAlertAcknowledged(false);
      setFallAlertStartTime(null);
      clearFallAlertState();
    }
  }, [selectedDevice?.fallStatus]);

  // Acknowledge fall alert (stops repeating notifications indefinitely until next fall)
  const acknowledgeFallAlert = useCallback(() => {
    const now = Date.now();
    setFallAlertAcknowledged(true);
    setFallAlertStartTime(now);
    storeFallAlertState(true);

    if (fallIntervalRef.current) {
      clearInterval(fallIntervalRef.current);
      fallIntervalRef.current = null;
    }
    if (oscillatorNodesRef.current) {
      try {
        oscillatorNodesRef.current.osc.stop();
        oscillatorNodesRef.current.lfo.stop();
      } catch (e) { }
      oscillatorNodesRef.current = null;
    }
    if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
    toast.success('Fall alert acknowledged. Stopped until next fall detection.');
  }, []);

  useEffect(() => {
    window.triggerStopFallAlert = acknowledgeFallAlert;
  }, [acknowledgeFallAlert]);

  useEffect(() => {
    if (myDevices.length > 0) {
      const currentExists = myDevices.some(d => d.id === selectedDeviceId);
      if (!selectedDeviceId || !currentExists) {
        setSelectedDeviceId(myDevices[0].id);
      }
    } else {
      setSelectedDeviceId('');
    }
  }, [myDevices, selectedDeviceId]);

  // User requested explicit static pinpoint display
  useEffect(() => {
    setLocationName('GIET University, Gunupur, Odisha');
  }, []);

  useEffect(() => {
    if (!selectedDevice) return;
    if (!selectedDevice.userName || !selectedDevice.mentorPhone) {
      setEditRequestedByUser(false);
      setSetupMode(true);
      setSetupForm({
        userName: selectedDevice.userName || '',
        userPhone: selectedDevice.userPhone || '',
        mentorPhone: selectedDevice.mentorPhone || '',
      });
    } else if (!editRequestedByUser) {
      setSetupMode(false);
    }
  }, [selectedDevice?.id, editRequestedByUser]);

  const openEditProfile = () => {
    if (selectedDevice) {
      setEditRequestedByUser(true);
      setSetupForm({
        userName: selectedDevice.userName || '',
        userPhone: selectedDevice.userPhone || '',
        mentorPhone: selectedDevice.mentorPhone || '',
      });
      setSetupMode(true);
    }
  };



  // Battery and vibration alerts (separate from fall detection)
  useEffect(() => {
    if (!selectedDevice) return;
    const now = Date.now();
    if (selectedDevice.battery < 20) {
      const existing = alerts.find(a => a.type === 'battery' && !a.dismissed);
      if (!existing) {
        setAlerts(prev => [...prev, { id: `batt-${now}`, type: 'battery', message: `Battery critically low: 75%`, time: new Date(), dismissed: false }]);
      }
    }
  }, [selectedDevice?.battery]);

  if (!user || user.role !== 'guardian') {
    return null;
  }

  const isOffline = selectedDevice ? (Date.now() - selectedDevice.lastUpdated > OFFLINE_THRESHOLD) : false;

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDevice) {
      try {
        await updateDeviceInfo(selectedDevice.id, setupForm);
        setSetupMode(false);
        setEditRequestedByUser(false);
        toast.success('User details updated successfully');
      } catch (error: any) {
        toast.error(error.message || 'Failed to update user details');
      }
    }
  };

  const closeSetupModal = () => {
    setSetupMode(false);
    setEditRequestedByUser(false);
  };

  const activeAlerts = alerts.filter(a => !a.dismissed);

  // Components for distinct pages inside Dashboard

  const SidePanelInfo = () => (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-display font-semibold text-foreground">{selectedDevice.userName || 'Not Set'}</p>
              <p className="text-xs text-muted-foreground">{selectedDevice.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openEditProfile}
            className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            title="Edit user details"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {selectedDevice.userPhone || 'Not set'}</div>
          <div className="flex items-center gap-2 text-muted-foreground"><User className="h-3.5 w-3.5" /> Guardian: {user.name}</div>
          <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {selectedDevice.mentorPhone || user.phone || 'Not set'}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-background p-3 text-center">
          <Battery className={`mx-auto mb-1 h-5 w-5 text-success`} />
          <p className="text-lg font-bold text-foreground">75%</p>
          <p className="text-xs text-muted-foreground">Battery</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3 text-center group relative cursor-help">
          <Activity className={`mx-auto mb-1 h-5 w-5 ${selectedDevice.movementStatus ? 'text-success' : 'text-muted-foreground'}`} />
          <p className="text-sm font-bold text-foreground">{selectedDevice.movementStatus ? 'Moving' : 'Idle'}</p>
          <p className="text-xs text-muted-foreground">Movement</p>
          <div className="pointer-events-none absolute hidden group-hover:block -top-12 left-1/2 -translate-x-1/2 w-48 bg-foreground text-background text-xs rounded p-2 z-50">
            Idle means the device has not moved or detected activity recently.
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background p-3 text-center">
          <Navigation className={`mx-auto mb-1 h-5 w-5 text-primary`} />
          <p className="text-sm font-bold text-foreground">{(selectedDevice.distanceTravelled || 0).toFixed(1)} m</p>
          <p className="text-xs text-muted-foreground">Travelled</p>
        </div>
      </div>

      <div className={`flex items-center gap-3 rounded-xl border p-3 ${isOffline ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success/5'}`}>
        {isOffline ? <WifiOff className="h-5 w-5 text-destructive" /> : <Wifi className="h-5 w-5 text-success" />}
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isOffline ? 'text-destructive' : 'text-success'}`}>{isOffline ? 'Device Offline' : 'Online'}</p>
          <p className="text-xs text-muted-foreground">Last online: {new Date(selectedDevice.lastUpdated).toLocaleTimeString()}</p>
        </div>
        {!isOffline && selectedDevice.upTime !== undefined && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Live up time</p>
            <p className="text-sm font-bold text-primary">{selectedDevice.upTime}s</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-background p-3">
        <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" /><span className="font-medium text-foreground">Location</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{locationName}</p>
        <div className="mt-3 space-y-1 rounded-lg bg-primary/5 p-2 font-mono text-[11px] text-foreground border border-primary/20">
          <p>Latitude: {Math.abs(selectedDevice.gps.lat).toFixed(4)}° {selectedDevice.gps.lat >= 0 ? 'N' : 'S'}</p>
          <p>Longitude: {Math.abs(selectedDevice.gps.lng).toFixed(4)}° {selectedDevice.gps.lng >= 0 ? 'E' : 'W'}</p>
        </div>
      </div>
    </div>
  );

  const FallDetectionPanel = () => (
    <div className="space-y-4">
      {/* IoT Sensor Data */}
      {(selectedDevice?.distance1_cm !== undefined || selectedDevice?.distance2_cm !== undefined) && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Radar className="h-4 w-4 text-primary" /> Sensor Data (Live)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {selectedDevice.distance1_cm !== undefined && (
              <div className="rounded-lg bg-background p-2 text-center">
                <p className={`text-lg font-bold ${selectedDevice.distance1_cm < 100 ? 'text-warning' : 'text-foreground'}`}>
                  {selectedDevice.distance1_cm} cm
                </p>
                <p className="text-xs text-muted-foreground">Sensor 1</p>
              </div>
            )}
            {selectedDevice.distance2_cm !== undefined && (
              <div className="rounded-lg bg-background p-2 text-center">
                <p className={`text-lg font-bold ${selectedDevice.distance2_cm < 100 ? 'text-warning' : 'text-foreground'}`}>
                  {selectedDevice.distance2_cm} cm
                </p>
                <p className="text-xs text-muted-foreground">Sensor 2</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Active Alerts</h3>
          {activeAlerts.map(a => (
            <div key={a.id} className={`rounded-xl border p-3 ${a.type === 'fall' ? 'border-destructive bg-destructive/10 animate-pulse' : 'border-destructive/30 bg-destructive/5'}`}>
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-destructive">{a.message}</p>
                <button onClick={() => dismissAlert(a.id)} className="text-destructive/60 hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{a.time.toLocaleTimeString()}</p>
              {a.type === 'fall' && !fallAlertAcknowledged && (
                <button
                  onClick={acknowledgeFallAlert}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-destructive py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                >
                  <Bell className="h-3.5 w-3.5" /> Acknowledge & Stop Alerts
                </button>
              )}
              {a.type === 'fall' && fallAlertAcknowledged && fallAlertStartTime && (
                <p className="mt-2 text-xs text-success">
                  Alert acknowledged - stopped until next fall detection.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Vibration only valid for Fall Detection page */}
      {selectedDevice?.vibrationStatus && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><Vibrate className="h-4 w-4 text-warning" /> Fall Vibration Status</h3>
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            Vibration active (Fall scenario detected)
          </div>
        </div>
      )}

      {/* Test Mobile Alarm Button */}
      <div className="pt-4 border-t border-border mt-4">
        <button
          onClick={() => {
            requestNotificationPermission(); // Request browser permission explicitly
            triggerFallAlert();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary py-3 text-sm font-semibold text-foreground hover:bg-secondary/80 border border-border"
        >
          <Bell className="h-4 w-4" /> Test Mobile Alarm (Permissions)
        </button>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          Tap this safely test your mobile device's speakers, push notifications, and vibration API permissions!
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-background">

      {/* Header */}
      <header className="border-b border-border bg-card shadow-card">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="h-6 w-6 object-contain" alt="Sanjaya" />
            <div>
              <h1 className="font-display text-base font-bold text-foreground">Guardian Dashboard</h1>
              <p className="text-xs text-muted-foreground">Welcome, {user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {myDevices.length > 1 && (
              <div className="relative">
                <select
                  value={selectedDeviceId}
                  onChange={e => setSelectedDeviceId(e.target.value)}
                  className="appearance-none rounded-lg border border-input bg-background px-4 py-2 pr-8 text-sm text-foreground focus:outline-none"
                >
                  {myDevices.map(d => (
                    <option key={d.id} value={d.id}>{d.id} – {d.userName || 'Unnamed'}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            )}
            <ThemeToggle />
            <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-0 overflow-x-auto scroolbar-hide border-b border-border">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutDashboard className="h-4 w-4" /> All Together
          </button>
          <button
            onClick={() => setActiveTab('location')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'location' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <MapPin className="h-4 w-4" /> Live Location
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'video' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Video className="h-4 w-4" /> Live Video
          </button>
          <button
            onClick={() => setActiveTab('fall')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'fall' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <AlertCircle className="h-4 w-4" /> Fall Detection
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <History className="h-4 w-4" /> History
          </button>
        </div>
      </header>

      {/* Setup / Edit Profile Modal */}
      {setupMode && selectedDevice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-card p-8 shadow-elevated">
            <h2 className="mb-2 font-display text-xl font-bold text-foreground">
              {selectedDevice.userName && selectedDevice.mentorPhone ? 'Edit User Details' : 'Setup Device Profile'}
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              {selectedDevice.userName && selectedDevice.mentorPhone
                ? `Update the profile for ${selectedDevice.id}`
                : `Complete the profile for ${selectedDevice.id}`}
            </p>
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Disabled Person's Name</label>
                <input value={setupForm.userName} onChange={e => setSetupForm(p => ({ ...p, userName: e.target.value }))} required
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Disabled Person's Phone</label>
                <input value={setupForm.userPhone} onChange={e => setSetupForm(p => ({ ...p, userPhone: e.target.value }))} required
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Your Phone (Guardian)</label>
                <input value={setupForm.mentorPhone} onChange={e => setSetupForm(p => ({ ...p, mentorPhone: e.target.value }))} required
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={closeSetupModal} className="flex-1 rounded-lg border border-border py-3 font-medium text-muted-foreground hover:bg-secondary">
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-lg bg-gradient-primary py-3 font-semibold text-primary-foreground">
                  {selectedDevice.userName && selectedDevice.mentorPhone ? 'Update' : 'Save'} Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content Areas */}
      <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">

        {activeTab === 'all' && (
          <>
            <div className="relative z-10 w-full md:w-80 flex-shrink-0 overflow-visible md:overflow-y-auto border-b md:border-b-0 md:border-r border-border bg-card p-5">
              {selectedDevice ? (
                <div className="space-y-5">
                  <SidePanelInfo />
                  <hr className="border-border my-2" />
                  <FallDetectionPanel />
                </div>
              ) : (
                <p className="text-muted-foreground">No devices assigned to you.</p>
              )}
            </div>
            {/* Map and Camera Side-by-Side in All page */}
            <div className="flex-1 p-4 flex flex-col gap-4 overflow-visible md:overflow-y-auto">
              <div className="flex-1 min-h-[300px] md:min-h-[50%] rounded-xl overflow-hidden border border-border flex-shrink-0">
                {myDevices.length > 0 ? (
                  <DeviceMap devices={myDevices} selectedDeviceId={selectedDeviceId} />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">No devices to display on map.</div>
                )}
              </div>
              {selectedDevice?.imageURL ? (
                <div className="flex-1 min-h-[250px] rounded-xl overflow-hidden border border-border bg-card flex flex-col object-cover relative group cursor-pointer flex-shrink-0" onClick={() => setShowSnapshot(true)}>
                  <p className="p-3 text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border bg-background z-10"><Camera className="h-4 w-4" /> Recent Snapshot</p>
                  <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                    <img src={selectedDevice.imageURL} alt="Device snapshot" className="absolute object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="bg-foreground/50 text-background px-4 py-2 rounded-full font-medium z-10 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity flex gap-2"><Camera className="w-5 h-5" /> View Full Screen</div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 rounded-xl border border-border bg-card flex items-center justify-center">
                  <p className="text-muted-foreground flex items-center gap-2"><Video className="h-5 w-5" /> No Live Video Feed Available</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'location' && (
          <>
            <div className="relative z-10 w-full md:w-80 flex-shrink-0 overflow-visible md:overflow-y-auto border-b md:border-b-0 md:border-r border-border bg-card p-5">
              {selectedDevice ? (
                <SidePanelInfo />
              ) : (
                <p className="text-muted-foreground">No devices assigned to you.</p>
              )}
            </div>
            <div className="flex-1 p-4 min-h-[400px]">
              {myDevices.length > 0 ? (
                <DeviceMap devices={myDevices} selectedDeviceId={selectedDeviceId} />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">No devices to display on map.</div>
              )}
            </div>
          </>
        )}

        {activeTab === 'video' && (
          <div className="flex-1 p-8 flex flex-col items-center justify-center bg-card">
            {selectedDevice?.imageURL ? (
              <div className="w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl relative group">
                <div className="absolute top-4 left-4 z-10 flex gap-2">
                  <div className="bg-red-500 text-white font-bold text-xs uppercase px-3 py-1.5 rounded flex items-center gap-2 animate-pulse"><div className="w-2 h-2 bg-white rounded-full"></div>LIVE</div>
                </div>
                <img src={selectedDevice.imageURL} alt="Device snapshot" className="w-full h-auto object-contain max-h-[70vh]" />
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center gap-4 bg-background p-12 rounded-3xl border border-border">
                <Video className="h-16 w-16 opacity-30" />
                <p className="text-lg font-medium">No Live Video Feed Connected</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'fall' && (
          <div className="flex flex-1 p-8 justify-center min-h-full overflow-y-auto">
            <div className="w-full max-w-2xl bg-card border border-border rounded-xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold font-display flex items-center gap-2 mb-6"><AlertCircle className="w-6 h-6 text-primary" /> Fall Detection System</h2>
              <div className="grid grid-cols-1 gap-6">
                <FallDetectionPanel />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-1 p-8 justify-center min-h-full overflow-y-auto">
            <div className="w-full max-w-4xl bg-card border border-border rounded-xl p-8 shadow-sm flex flex-col">
              <h2 className="text-2xl font-bold font-display flex items-center gap-2 mb-6"><History className="w-6 h-6 text-primary" /> Fall History Logs</h2>
              <div className="flex-1 overflow-y-auto space-y-4">
                {selectedDevice?.fallHistory && selectedDevice.fallHistory.length > 0 ? (
                  selectedDevice.fallHistory.map((log, index) => (
                    <div key={index} className="flex justify-between items-center p-4 border rounded-xl bg-background shadow-sm hover:border-primary/50 transition">
                      <div className="flex gap-4 items-center">
                        <div className="bg-destructive/10 p-3 rounded-full"><AlertTriangle className="w-6 h-6 text-destructive" /></div>
                        <div>
                          <p className="font-semibold text-foreground">Fall Event Detected</p>
                          <p className="text-sm text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">
                          <MapPin className="inline w-4 h-4 mr-1 text-primary" />
                          {log.lat.toFixed(4)}°, {log.lng.toFixed(4)}°
                        </p>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${log.lat},${log.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View Map
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center text-muted-foreground bg-background rounded-xl border border-dashed">
                    No fall logs recorded for this device.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showSnapshot && selectedDevice?.imageURL && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4" onClick={() => setShowSnapshot(false)}>
          <div className="mx-4 max-w-2xl rounded-2xl bg-card p-4 shadow-elevated" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground">Live Snapshot</h3>
              <button onClick={() => setShowSnapshot(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <img src={selectedDevice.imageURL} alt="Device snapshot" className="w-full rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

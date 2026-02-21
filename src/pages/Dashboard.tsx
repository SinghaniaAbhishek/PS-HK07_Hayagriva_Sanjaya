import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DeviceMap from '@/components/DeviceMap';
import { Eye, LogOut, Battery, Activity, Wifi, WifiOff, AlertTriangle, ChevronDown, Phone, User, MapPin, Vibrate, Camera, X, Pencil } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';

const OFFLINE_THRESHOLD = 30000;

const Dashboard = () => {
  const { user, logout, devices, updateDeviceInfo } = useAuth();
  const navigate = useNavigate();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [alerts, setAlerts] = useState<{ id: string; type: string; message: string; time: Date; dismissed: boolean }[]>([]);
  const [vibrationLog, setVibrationLog] = useState<{ time: Date; deviceId: string }[]>([]);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [setupForm, setSetupForm] = useState({ userName: '', userPhone: '', mentorPhone: '' });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const myDevices = user?.role === 'guardian' ? devices.filter(d => (user.linkedDevices || []).includes(d.id)) : [];
  const selectedDevice = myDevices.find(d => d.id === selectedDeviceId) || myDevices[0];

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

  useEffect(() => {
    if (selectedDevice && (!selectedDevice.userName || !selectedDevice.mentorPhone)) {
      setSetupMode(true);
      setSetupForm({
        userName: selectedDevice.userName || '',
        userPhone: selectedDevice.userPhone || '',
        mentorPhone: selectedDevice.mentorPhone || '',
      });
    } else {
      setSetupMode(false);
    }
  }, [selectedDevice?.id]);

  const openEditProfile = () => {
    if (selectedDevice) {
      setSetupForm({
        userName: selectedDevice.userName || '',
        userPhone: selectedDevice.userPhone || '',
        mentorPhone: selectedDevice.mentorPhone || '',
      });
      setSetupMode(true);
    }
  };

  useEffect(() => {
    if (!selectedDevice) return;
    const now = Date.now();
    if (selectedDevice.fallStatus) {
      const existing = alerts.find(a => a.type === 'fall' && !a.dismissed);
      if (!existing) {
        setAlerts(prev => [...prev, { id: `fall-${now}`, type: 'fall', message: 'Fall Detected – Immediate Attention Required', time: new Date(), dismissed: false }]);
        try { audioRef.current?.play(); } catch {}
      }
    }
    if (selectedDevice.battery < 20) {
      const existing = alerts.find(a => a.type === 'battery' && !a.dismissed);
      if (!existing) {
        setAlerts(prev => [...prev, { id: `batt-${now}`, type: 'battery', message: `Battery critically low: ${selectedDevice.battery}%`, time: new Date(), dismissed: false }]);
      }
    }
    if (selectedDevice.vibrationStatus) {
      setVibrationLog(prev => [{ time: new Date(), deviceId: selectedDevice.id }, ...prev].slice(0, 5));
    }
  }, [selectedDevice?.fallStatus, selectedDevice?.battery, selectedDevice?.vibrationStatus]);

  if (!user || user.role !== 'guardian') {
    return null;
  }

  const isOffline = selectedDevice ? (Date.now() - selectedDevice.lastUpdated > OFFLINE_THRESHOLD) : false;

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  };

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDevice) {
      updateDeviceInfo(selectedDevice.id, setupForm);
      setSetupMode(false);
      toast.success('User details updated successfully');
    }
  };

  const activeAlerts = alerts.filter(a => !a.dismissed);

  return (
    <div className="flex h-screen flex-col bg-background">
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkpqTjHhpYmR1h5mmoJeLfXNxdX+Ll5yZlIh7cW5yfIiUm5qUiXtwbXJ9iZWcm5WJfHFucnyIlJualYl8cW5yfIiUm5qViXxwbnJ8iJSbmpWJfHBucnyIlJualYl8cG5yfIiUm5qViXxwbg==" />

      {/* Header */}
      <header className="border-b border-border bg-card shadow-card">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Eye className="h-6 w-6 text-primary" />
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
      </header>

      {/* Setup / Edit Profile Modal */}
      {setupMode && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm">
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
                <button type="button" onClick={() => setSetupMode(false)} className="flex-1 rounded-lg border border-border py-3 font-medium text-muted-foreground hover:bg-secondary">
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

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-80 flex-shrink-0 overflow-y-auto border-r border-border bg-card p-5">
          {selectedDevice ? (
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
                    onClick={openEditProfile}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-background p-3 text-center">
                  <Battery className={`mx-auto mb-1 h-5 w-5 ${selectedDevice.battery < 20 ? 'text-destructive' : 'text-success'}`} />
                  <p className="text-lg font-bold text-foreground">{selectedDevice.battery}%</p>
                  <p className="text-xs text-muted-foreground">Battery</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3 text-center">
                  <Activity className={`mx-auto mb-1 h-5 w-5 ${selectedDevice.movementStatus ? 'text-success' : 'text-muted-foreground'}`} />
                  <p className="text-sm font-bold text-foreground">{selectedDevice.movementStatus ? 'Moving' : 'Idle'}</p>
                  <p className="text-xs text-muted-foreground">Movement</p>
                </div>
              </div>

              <div className={`flex items-center gap-3 rounded-xl border p-3 ${isOffline ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success/5'}`}>
                {isOffline ? <WifiOff className="h-5 w-5 text-destructive" /> : <Wifi className="h-5 w-5 text-success" />}
                <div>
                  <p className={`text-sm font-semibold ${isOffline ? 'text-destructive' : 'text-success'}`}>{isOffline ? 'Device Offline' : 'Online'}</p>
                  <p className="text-xs text-muted-foreground">Last: {new Date(selectedDevice.lastUpdated).toLocaleTimeString()}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" /><span className="font-medium text-foreground">Location</span></div>
                <p className="mt-1 text-xs text-muted-foreground">{selectedDevice.gps.lat.toFixed(5)}, {selectedDevice.gps.lng.toFixed(5)}</p>
              </div>

              {activeAlerts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Active Alerts</h3>
                  {activeAlerts.map(a => (
                    <div key={a.id} className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-destructive">{a.message}</p>
                        <button onClick={() => dismissAlert(a.id)} className="text-destructive/60 hover:text-destructive"><X className="h-4 w-4" /></button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{a.time.toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
              )}

              {vibrationLog.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><Vibrate className="h-4 w-4 text-warning" /> Vibration Events</h3>
                  <div className="space-y-1">
                    {vibrationLog.map((v, i) => (
                      <div key={i} className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                        Obstacle detected – {v.time.toLocaleTimeString()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDevice.imageURL && (
                <button onClick={() => setShowSnapshot(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-medium text-primary hover:bg-secondary">
                  <Camera className="h-4 w-4" /> View Live Snapshot
                </button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No devices assigned to you.</p>
          )}
        </div>

        {/* Right Panel - Map */}
        <div className="flex-1 p-4">
          {myDevices.length > 0 ? (
            <DeviceMap devices={myDevices} selectedDeviceId={selectedDeviceId} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">No devices to display on map.</div>
          )}
        </div>
      </div>

      {showSnapshot && selectedDevice?.imageURL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm" onClick={() => setShowSnapshot(false)}>
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

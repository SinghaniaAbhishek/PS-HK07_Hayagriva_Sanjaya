import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, LogOut, UserPlus, Link2, Unlink, Plus, Users, HardDrive, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type TabId = 'guardians' | 'devices' | 'add-guardian' | 'add-device' | 'link';

const Admin = () => {
  const { user, logout, users, devices, availableIoTSources, addGuardian, linkDeviceToGuardian, unlinkDeviceFromGuardian, removeGuardian, removeDevice, addDevice } = useAuth();
  const [confirmRemove, setConfirmRemove] = useState<{ type: 'guardian' | 'device'; id: string; name: string } | null>(null);
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('guardians');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [deviceId, setDeviceId] = useState('');
  const [dataSource, setDataSource] = useState('');
  const [linkForm, setLinkForm] = useState({ deviceId: '', guardianId: '' });

  const guardians = users.filter(u => u.role === 'guardian');

  if (!user || user.role !== 'admin') {
    return null;
  }

  const handleAddGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    const exists = users.some(u => u.email.toLowerCase() === form.email.toLowerCase());
    if (exists) {
      toast.error('A guardian with this email already exists');
      return;
    }
    try {
      await addGuardian({ ...form, linkedDevices: [] });
      setForm({ name: '', email: '', password: '', phone: '' });
      setTab('guardians');
      toast.success('Guardian created successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create guardian');
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (devices.some(d => d.id === deviceId)) {
      toast.error('A device with this ID already exists');
      return;
    }
    try {
      await addDevice(deviceId, dataSource);
      setDeviceId('');
      setDataSource('');
      setTab('devices');
      toast.success('Device registered successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to register device');
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await linkDeviceToGuardian(linkForm.deviceId, linkForm.guardianId);
      const guardian = guardians.find(g => g.id === linkForm.guardianId);
      toast.success(`Device ${linkForm.deviceId} linked to ${guardian?.name || 'guardian'}`);
      setLinkForm({ deviceId: '', guardianId: '' });
      setTab('guardians');
    } catch (error: any) {
      toast.error(error.message || 'Failed to link device');
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    try {
      if (confirmRemove.type === 'guardian') {
        await removeGuardian(confirmRemove.id);
        toast.success(`Guardian ${confirmRemove.name} removed`);
      } else {
        await removeDevice(confirmRemove.id);
        toast.success(`Device ${confirmRemove.id} removed`);
      }
      setConfirmRemove(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove');
    }
  };

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: 'guardians', label: 'Guardians', icon: Users },
    { id: 'devices', label: 'Devices', icon: HardDrive },
    { id: 'add-guardian', label: 'Add Guardian', icon: UserPlus },
    { id: 'add-device', label: 'Add Device', icon: Plus },
    { id: 'link', label: 'Link Device', icon: Link2 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="h-7 w-7 object-contain" alt="Sanjaya" />
            <div>
              <h1 className="font-display text-lg font-bold text-foreground">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Manage guardians & devices</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-secondary">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="mb-8 flex flex-wrap gap-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${tab === t.id ? 'bg-gradient-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-secondary'}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'guardians' && (
          <div className="grid gap-4">
            <h2 className="font-display text-2xl font-bold text-foreground">All Guardians</h2>
            {guardians.length === 0 ? (
              <p className="text-muted-foreground">No guardians yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {guardians.map(g => (
                  <div key={g.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-foreground">{g.name}</h3>
                        <p className="text-sm text-muted-foreground">{g.email}</p>
                        {g.phone && <p className="text-sm text-muted-foreground">{g.phone}</p>}
                      </div>
                      <button
                        onClick={() => setConfirmRemove({ type: 'guardian', id: g.id, name: g.name })}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        title="Remove guardian"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(g.linkedDevices || []).map(d => (
                        <span key={d} className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {d}
                          <button
                            onClick={async () => {
                              try {
                                await unlinkDeviceFromGuardian(d, g.id);
                                toast.success(`Unlinked ${d}`);
                              } catch (error: any) {
                                toast.error(error.message || 'Failed to unlink device');
                              }
                            }}
                            className="rounded p-0.5 hover:bg-primary/20"
                            title="Unlink device"
                          >
                            <Unlink className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {(!g.linkedDevices || g.linkedDevices.length === 0) && <span className="text-xs text-muted-foreground">No devices linked</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'devices' && (
          <div className="grid gap-4">
            <h2 className="font-display text-2xl font-bold text-foreground">All Devices</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {devices.map(d => (
                <div key={d.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{d.id}</h3>
                      <p className="text-sm text-muted-foreground">Assigned to: {users.find(u => u.id === d.assignedTo)?.name || 'Unassigned'}</p>
                      <p className="text-sm text-muted-foreground">Battery: {d.battery}%</p>
                      <p className="text-sm text-muted-foreground">User: {d.userName || 'Not set'}</p>
                      {d.dataSource && (
                        <p className="text-sm text-primary">IoT Source: {d.dataSource}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setConfirmRemove({ type: 'device', id: d.id, name: d.id })}
                      className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      title="Remove device"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'add-guardian' && (
          <div className="mx-auto max-w-lg">
            <h2 className="mb-6 font-display text-2xl font-bold text-foreground">Add New Guardian</h2>
            <form onSubmit={handleAddGuardian} className="space-y-4">
              {(['name', 'email', 'phone', 'password'] as const).map(field => (
                <div key={field}>
                  <label className="mb-1.5 block text-sm font-medium capitalize text-foreground">{field}</label>
                  <input
                    type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                    value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} required
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              ))}
              <button type="submit" className="w-full rounded-lg bg-gradient-primary py-3 font-semibold text-primary-foreground">Create Guardian</button>
            </form>
          </div>
        )}

        {tab === 'add-device' && (
          <div className="mx-auto max-w-lg">
            <h2 className="mb-6 font-display text-2xl font-bold text-foreground">Register New Device</h2>
            <form onSubmit={handleAddDevice} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Device ID</label>
                <input value={deviceId} onChange={e => setDeviceId(e.target.value)} required placeholder="e.g. sanjaya-1"
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">IoT Data Source</label>
                {availableIoTSources.length > 0 ? (
                  <select
                    value={dataSource}
                    onChange={e => setDataSource(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="">Select IoT device...</option>
                    {availableIoTSources.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                    No available IoT devices found in SmartStickData. Make sure your IoT device is sending data to Firebase.
                  </div>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">Select the IoT device from SmartStickData in Firebase</p>
              </div>
              <button
                type="submit"
                disabled={availableIoTSources.length === 0}
                className="w-full rounded-lg bg-gradient-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
              >
                Register Device
              </button>
            </form>
          </div>
        )}

        {tab === 'link' && (
          <div className="mx-auto max-w-lg">
            <h2 className="mb-6 font-display text-2xl font-bold text-foreground">Link Device to Guardian</h2>
            <form onSubmit={handleLink} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Device</label>
                <select value={linkForm.deviceId} onChange={e => setLinkForm(p => ({ ...p, deviceId: e.target.value }))} required
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground focus:border-primary focus:outline-none">
                  <option value="">Select device...</option>
                  {devices.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Guardian</label>
                <select value={linkForm.guardianId} onChange={e => setLinkForm(p => ({ ...p, guardianId: e.target.value }))} required
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground focus:border-primary focus:outline-none">
                  <option value="">Select guardian...</option>
                  {guardians.map(g => <option key={g.id} value={g.id}>{g.name} ({g.email})</option>)}
                </select>
              </div>
              <button type="submit" className="w-full rounded-lg bg-gradient-primary py-3 font-semibold text-primary-foreground">Link Device</button>
            </form>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmRemove?.type === 'guardian' ? 'Remove Guardian?' : 'Remove Device?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove?.type === 'guardian'
                ? `This will remove ${confirmRemove.name} and unlink all their devices. This action cannot be undone.`
                : `This will permanently remove device ${confirmRemove?.id} and unlink it from its guardian. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Device } from '@/contexts/AuthContext';

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

interface DeviceMapProps {
  devices: Device[];
  selectedDeviceId?: string;
}

const DeviceMap = ({ devices, selectedDeviceId }: DeviceMapProps) => {
  const active = devices.find(d => d.id === selectedDeviceId) || devices[0];
  const center: [number, number] = active ? [active.gps.lat, active.gps.lng] : [19.0483, 83.8322];

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
    >
      <TileLayer
        attribution='&copy; Google Maps'
        url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
      />
      <MapUpdater center={center} />
      {devices.map(d => (
        <Marker key={d.id} position={[d.gps.lat, d.gps.lng]}>
          <Tooltip direction="top" offset={[0, -35]} opacity={1} permanent className="font-semibold bg-background text-foreground text-xs shadow-md border-border whitespace-nowrap">
            {d.userName || d.id}
          </Tooltip>
          <Popup>
            <div className="text-sm">
              <strong>{d.userName || d.id}</strong><br />
              Lat: {d.gps.lat.toFixed(5)}, Lng: {d.gps.lng.toFixed(5)}<br />
              Battery: {d.battery}%<br />
              Updated: {new Date(d.lastUpdated).toLocaleTimeString()}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default DeviceMap;

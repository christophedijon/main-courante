import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

declare global {
  interface BluetoothDevice {
    watchAdvertisements(options?: { signal?: AbortSignal }): Promise<void>;
    unwatchAdvertisements(): void;
    addEventListener(type: 'advertisementreceived', listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: 'advertisementreceived', listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  }
  interface BluetoothAdvertisingEvent extends Event {
    device: BluetoothDevice;
    rssi: number | null;
    manufacturerData: Map<number, DataView>;
    serviceData: Map<string, DataView>;
    uuids: string[];
  }
}

type Beacon = {
  id: string;
  nom: string;
  zone_id: string | null;
  zone_nom?: string;
  minor: number;
  major: number;
  uuid_beacon: string;
  rssi_seuil: number;
  is_entree: boolean;
  actif: boolean;
};

export type RecentDetection = {
  beaconNom: string;
  zoneNom: string;
  timestamp: Date;
};

function parseIBeacon(
  dataView: DataView
): { uuid: string; major: number; minor: number } | null {
  if (dataView.byteLength < 23) return null;
  const subType = dataView.getUint8(0);
  const subLen = dataView.getUint8(1);
  if (subType !== 0x02 || subLen !== 0x15) return null;

  const uuidBytes: string[] = [];
  for (let i = 2; i < 18; i++) {
    uuidBytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
  }
  const uuid = [
    uuidBytes.slice(0, 4).join(''),
    uuidBytes.slice(4, 6).join(''),
    uuidBytes.slice(6, 8).join(''),
    uuidBytes.slice(8, 10).join(''),
    uuidBytes.slice(10, 16).join(''),
  ]
    .join('-')
    .toUpperCase();

  const major = (dataView.getUint8(18) << 8) | dataView.getUint8(19);
  const minor = (dataView.getUint8(20) << 8) | dataView.getUint8(21);

  return { uuid, major, minor };
}

const APPLE_COMPANY_ID = 0x004c;
const DETECTION_COOLDOWN_MS = 60_000;
const MAX_RECENT_DETECTIONS = 5;

export function useBeaconScanner() {
  const { session } = useAuth();

  const [isActive, setIsActive] = useState(false);
  const [beaconsLoaded, setBeaconsLoaded] = useState(false);
  const [recentDetections, setRecentDetections] = useState<RecentDetection[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  const watchedDevicesRef = useRef<BluetoothDevice[]>([]);
  const beaconMapRef = useRef<Map<number, Beacon>>(new Map());
  const beaconsByNameRef = useRef<Map<string, Beacon>>(new Map());
  const lastDetectedRef = useRef<Map<string, Date>>(new Map());
  const agentIdRef = useRef<string | null>(null);

  // Load beacons + agent id on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    async function bootstrap() {
      try {
        const { data: beaconRows, error: beaconErr } = await supabase
          .from('beacons')
          .select('*, zones(nom)')
          .eq('actif', true);

        if (beaconErr) {
          console.error('[useBeaconScanner] Failed to load beacons:', beaconErr);
        } else if (beaconRows) {
          const byMinor = new Map<number, Beacon>();
          const byName = new Map<string, Beacon>();
          for (const row of beaconRows) {
            const beacon: Beacon = {
              id: row.id,
              nom: row.nom,
              zone_id: row.zone_id ?? null,
              zone_nom: Array.isArray(row.zones)
                ? (row.zones[0]?.nom ?? undefined)
                : (row.zones?.nom ?? undefined),
              minor: row.minor,
              major: row.major,
              uuid_beacon: row.uuid_beacon,
              rssi_seuil: row.rssi_seuil,
              is_entree: row.is_entree,
              actif: row.actif,
            };
            byMinor.set(beacon.minor, beacon);
            byName.set(beacon.nom.toLowerCase(), beacon);
          }
          beaconMapRef.current = byMinor;
          beaconsByNameRef.current = byName;
          setBeaconsLoaded(true);
        }

        const { data: mu, error: muErr } = await supabase
          .from('managed_users')
          .select('id')
          .eq('auth_user_id', session!.user.id)
          .maybeSingle();

        if (muErr) {
          console.error('[useBeaconScanner] Failed to load managed_users row:', muErr);
        } else if (mu) {
          agentIdRef.current = mu.id;
        }
      } catch (err) {
        console.error('[useBeaconScanner] bootstrap error:', err);
      }
    }

    bootstrap();
  }, [session?.user?.id]);

  // Record a passage for a given beacon
  const recordPassage = useCallback(async (beacon: Beacon, rssi: number | null) => {
    const agentId = agentIdRef.current;
    if (!agentId) return;

    const now = new Date();
    const lastSeen = lastDetectedRef.current.get(beacon.id);
    if (lastSeen && now.getTime() - lastSeen.getTime() < DETECTION_COOLDOWN_MS) return;

    const timestamp = now.toISOString();

    try {
      const { error: passageErr } = await supabase.from('rondes_passages').insert({
        agent_id: agentId,
        beacon_id: beacon.id,
        rssi: rssi ?? null,
        timestamp,
      });

      if (passageErr) {
        console.error('[useBeaconScanner] Failed to insert passage:', passageErr);
        return;
      }

      if (beacon.is_entree) {
        const dateNuit = now.toISOString().slice(0, 10);
        const { data: existing } = await supabase
          .from('rondes_rapports')
          .select('id')
          .eq('agent_id', agentId)
          .eq('date_nuit', dateNuit)
          .maybeSingle();

        if (!existing) {
          await supabase.from('rondes_rapports').upsert(
            { agent_id: agentId, date_nuit: dateNuit, heure_prise_poste: timestamp },
            { onConflict: 'agent_id,date_nuit' }
          );
        }
      }

      lastDetectedRef.current.set(beacon.id, now);
      setRecentDetections((prev) =>
        [{ beaconNom: beacon.nom, zoneNom: beacon.zone_nom ?? '', timestamp: now }, ...prev].slice(0, MAX_RECENT_DETECTIONS)
      );
    } catch (err) {
      console.error('[useBeaconScanner] recordPassage error:', err);
    }
  }, []);

  // Advertisement handler for watchAdvertisements events
  const handleAdvertisement = useCallback(
    (event: BluetoothAdvertisingEvent) => {
      const manufacturerData = event.manufacturerData?.get(APPLE_COMPANY_ID);
      if (!manufacturerData) return;
      const parsed = parseIBeacon(manufacturerData);
      if (!parsed) return;
      const beacon = beaconMapRef.current.get(parsed.minor);
      if (!beacon) return;
      if (event.rssi == null || event.rssi < beacon.rssi_seuil) return;
      recordPassage(beacon, event.rssi);
    },
    [recordPassage]
  );

  // startRonde — triggered by user tap, opens Chrome device picker
  const startRonde = useCallback(async () => {
    if (!navigator?.bluetooth) {
      setScanError('Bluetooth non disponible sur cet appareil.');
      return;
    }

    setScanError(null);

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [],
      });

      // Try to match the selected device name to a known beacon
      const beaconByName = beaconsByNameRef.current.get(device.name?.toLowerCase() ?? '');

      // Record a passage immediately on device selection
      if (beaconByName) {
        await recordPassage(beaconByName, null);
      }

      // Also watch for advertisement events (bonus — may not fire in all browsers)
      try {
        await device.watchAdvertisements();
        device.addEventListener('advertisementreceived', handleAdvertisement as EventListener);
        watchedDevicesRef.current.push(device);
      } catch {
        // watchAdvertisements may not be available; passage already recorded above
      }

      setIsActive(true);
    } catch (err: any) {
      if (err?.name === 'NotFoundError') return; // user cancelled picker — not an error
      console.error('[useBeaconScanner] startRonde error:', err);
      setScanError(err.message ?? 'Erreur Bluetooth');
    }
  }, [handleAdvertisement, recordPassage]);

  const stopRonde = useCallback(() => {
    for (const device of watchedDevicesRef.current) {
      try {
        device.unwatchAdvertisements();
        device.removeEventListener('advertisementreceived', handleAdvertisement as EventListener);
      } catch {
        // ignore
      }
    }
    watchedDevicesRef.current = [];
    setIsActive(false);
  }, [handleAdvertisement]);

  useEffect(() => {
    return () => {
      stopRonde();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isActive, startRonde, stopRonde, recentDetections, beaconsLoaded, scanError };
}

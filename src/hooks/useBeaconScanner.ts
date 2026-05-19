import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// Web Bluetooth Scanning API type declarations (not in standard lib)
declare global {
  interface Bluetooth {
    requestLEScan(options?: RequestLEScanOptions): Promise<BluetoothLEScan>;
    addEventListener(type: 'advertisementreceived', listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: 'advertisementreceived', listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  }
  interface BluetoothLEScan {
    stop(): void;
    active: boolean;
  }
  interface RequestLEScanOptions {
    filters?: BluetoothLEScanFilter[];
    keepRepeatedDevices?: boolean;
    acceptAllAdvertisements?: boolean;
  }
  interface BluetoothLEScanFilter {
    services?: string[];
    name?: string;
    namePrefix?: string;
  }
  interface BluetoothAdvertisingEvent extends Event {
    device: BluetoothDevice;
    rssi: number | null;
    manufacturerData: Map<number, DataView>;
    serviceData: Map<string, DataView>;
    uuids: string[];
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

type RecentDetection = {
  beaconNom: string;
  zoneNom: string;
  timestamp: Date;
};

// ---------------------------------------------------------------------------
// iBeacon manufacturer data parsing helpers
// ---------------------------------------------------------------------------

/**
 * Convert a UUID string like '426C7565-4368-6172-6D42-6561636F6E73'
 * into the 16-byte Uint8Array representation.
 */
function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Parse Apple iBeacon manufacturer-specific data.
 *
 * The raw manufacturer data DataView received from the Web Bluetooth Scanning
 * API already has the 2-byte company code stripped by the browser, so the
 * payload we receive is the 23-byte iBeacon sub-type body:
 *   [0x02, 0x15, <16 UUID bytes>, <2 major bytes>, <2 minor bytes>, <tx_power>]
 *
 * Returns { uuid, major, minor } or null if the frame does not look like an
 * iBeacon advertisement.
 */
function parseIBeacon(
  dataView: DataView
): { uuid: string; major: number; minor: number } | null {
  // Minimum length: 23 bytes (sub-type 0x02, length 0x15 == 21, 16 uuid, 2 major, 2 minor, 1 tx)
  if (dataView.byteLength < 23) return null;

  const subType = dataView.getUint8(0);
  const subLen = dataView.getUint8(1);
  if (subType !== 0x02 || subLen !== 0x15) return null;

  // UUID bytes 2..17
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

// Apple company identifier (little-endian 0x004C)
const APPLE_COMPANY_ID = 0x004c;

// Cooldown between duplicate detections for the same beacon (milliseconds)
const DETECTION_COOLDOWN_MS = 60_000;

// Maximum number of recent detections to keep in state
const MAX_RECENT_DETECTIONS = 5;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBeaconScanner() {
  const { session } = useAuth();

  const [isScanning, setIsScanning] = useState(false);
  const [beaconsLoaded, setBeaconsLoaded] = useState(false);
  const [recentDetections, setRecentDetections] = useState<RecentDetection[]>([]);

  // Refs that survive re-renders without triggering them
  const scanRef = useRef<BluetoothLEScan | null>(null);
  const beaconMapRef = useRef<Map<number, Beacon>>(new Map());
  const lastDetectedRef = useRef<Map<string, Date>>(new Map());
  const agentIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load beacons + agent id on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!session?.user?.id) return;

    async function bootstrap() {
      try {
        // 1. Fetch active beacons with zone name
        const { data: beaconRows, error: beaconErr } = await supabase
          .from('beacons')
          .select('*, zones(nom)')
          .eq('actif', true);

        if (beaconErr) {
          console.error('[useBeaconScanner] Failed to load beacons:', beaconErr);
        } else if (beaconRows) {
          const map = new Map<number, Beacon>();
          for (const row of beaconRows) {
            const beacon: Beacon = {
              id: row.id,
              nom: row.nom,
              zone_id: row.zone_id ?? null,
              // Supabase join returns zones as an object or array
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
            map.set(beacon.minor, beacon);
          }
          beaconMapRef.current = map;
          setBeaconsLoaded(true);
        }

        // 2. Get agent's managed_users.id
        const { data: mu, error: muErr } = await supabase
          .from('managed_users')
          .select('id')
          .eq('auth_user_id', session!.user.id)
          .maybeSingle();

        if (muErr) {
          console.error('[useBeaconScanner] Failed to load agent managed_users row:', muErr);
        } else if (mu) {
          agentIdRef.current = mu.id;
        }
      } catch (err) {
        console.error('[useBeaconScanner] bootstrap error:', err);
      }
    }

    bootstrap();
  }, [session?.user?.id]);

  // ---------------------------------------------------------------------------
  // Advertisement handler
  // ---------------------------------------------------------------------------

  const handleAdvertisement = useCallback(
    async (event: BluetoothAdvertisingEvent) => {
      const agentId = agentIdRef.current;
      if (!agentId) return;

      // iBeacon manufacturer data is under the Apple company ID
      const manufacturerData = event.manufacturerData?.get(APPLE_COMPANY_ID);
      if (!manufacturerData) return;

      const parsed = parseIBeacon(manufacturerData);
      if (!parsed) return;

      const beacon = beaconMapRef.current.get(parsed.minor);
      if (!beacon) return;

      // RSSI threshold check (e.g. rssi_seuil = -72 means we need rssi >= -72)
      if (event.rssi == null || event.rssi < beacon.rssi_seuil) return;

      // Cooldown check
      const now = new Date();
      const lastSeen = lastDetectedRef.current.get(beacon.id);
      if (lastSeen && now.getTime() - lastSeen.getTime() < DETECTION_COOLDOWN_MS) return;

      const timestamp = now.toISOString();

      try {
        // a. Insert passage
        const { error: passageErr } = await supabase.from('rondes_passages').insert({
          agent_id: agentId,
          beacon_id: beacon.id,
          rssi: event.rssi,
          timestamp,
        });

        if (passageErr) {
          console.error('[useBeaconScanner] Failed to insert rondes_passages:', passageErr);
          return;
        }

        // b. If entrance beacon, ensure today's rapport exists
        if (beacon.is_entree) {
          const dateNuit = now.toISOString().slice(0, 10); // YYYY-MM-DD

          const { data: existing, error: checkErr } = await supabase
            .from('rondes_rapports')
            .select('id')
            .eq('agent_id', agentId)
            .eq('date_nuit', dateNuit)
            .maybeSingle();

          if (checkErr) {
            console.error('[useBeaconScanner] Failed to check rondes_rapports:', checkErr);
          } else if (!existing) {
            const { error: upsertErr } = await supabase.from('rondes_rapports').upsert(
              {
                agent_id: agentId,
                date_nuit: dateNuit,
                heure_prise_poste: timestamp,
              },
              { onConflict: 'agent_id,date_nuit' }
            );

            if (upsertErr) {
              console.error('[useBeaconScanner] Failed to upsert rondes_rapports:', upsertErr);
            }
          }
        }

        // c. Update last-detected map
        lastDetectedRef.current.set(beacon.id, now);

        // d. Add to recent detections (newest first, cap at 5)
        const detection: RecentDetection = {
          beaconNom: beacon.nom,
          zoneNom: beacon.zone_nom ?? '',
          timestamp: now,
        };
        setRecentDetections((prev) =>
          [detection, ...prev].slice(0, MAX_RECENT_DETECTIONS)
        );
      } catch (err) {
        console.error('[useBeaconScanner] handleAdvertisement error:', err);
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // startScan
  // ---------------------------------------------------------------------------

  const startScan = useCallback(async () => {
    if (isScanning) return;

    if (!navigator.bluetooth || typeof navigator.bluetooth.requestLEScan !== 'function') {
      console.warn('[useBeaconScanner] Web Bluetooth Scanning API is not supported in this browser.');
      return;
    }

    try {
      // Collect all unique service UUIDs to filter on.
      // iBeacon proximity UUIDs are advertised as 16-byte (128-bit) service UUIDs.
      // We build filters from the beacon map that has already been loaded.
      const filters: BluetoothLEScanFilter[] = [];
      const seenUuids = new Set<string>();

      for (const beacon of beaconMapRef.current.values()) {
        const uuid = beacon.uuid_beacon.toLowerCase();
        if (!seenUuids.has(uuid)) {
          seenUuids.add(uuid);
          filters.push({ services: [uuid] });
        }
      }

      // Fall back to scanning everything if no beacons are loaded yet
      const scanOptions: RequestLEScanOptions =
        filters.length > 0
          ? { filters, keepRepeatedDevices: true }
          : { acceptAllAdvertisements: true, keepRepeatedDevices: true };

      const scan = await navigator.bluetooth.requestLEScan(scanOptions);
      scanRef.current = scan;

      navigator.bluetooth.addEventListener(
        'advertisementreceived',
        handleAdvertisement as EventListener
      );

      setIsScanning(true);
    } catch (err) {
      console.error('[useBeaconScanner] startScan error:', err);
    }
  }, [isScanning, handleAdvertisement]);

  // ---------------------------------------------------------------------------
  // stopScan
  // ---------------------------------------------------------------------------

  const stopScan = useCallback(() => {
    if (scanRef.current) {
      try {
        scanRef.current.stop();
      } catch (err) {
        console.error('[useBeaconScanner] stopScan error:', err);
      }
      scanRef.current = null;
    }

    navigator.bluetooth?.removeEventListener?.(
      'advertisementreceived',
      handleAdvertisement as EventListener
    );

    setIsScanning(false);
  }, [handleAdvertisement]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isScanning, startScan, stopScan, recentDetections, beaconsLoaded };
}

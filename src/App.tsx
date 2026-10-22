/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { SalesRep, Client, Visit, VisitOutcome, Coordinates } from './types';
import { INITIAL_SALES_REPS, INITIAL_CLIENTS, INITIAL_VISITS } from './data/initialData';
import { MapView } from './components/MapView';
import { LiveTrackerControls } from './components/LiveTrackerControls';
import { RepDashboardView } from './components/RepDashboardView';
import { SupervisorDashboardView } from './components/SupervisorDashboardView';
import { EmployeesView } from './components/EmployeesView';
import { ClientsCrmView } from './components/ClientsCrmView';
import { EditClientModal } from './components/EditClientModal';
import { VisitCheckInModal } from './components/VisitCheckInModal';
import { NewVisitModal } from './components/NewVisitModal';
import { NewEmployeeModal } from './components/NewEmployeeModal';
import { VisitsHistoryModal } from './components/VisitsHistoryModal';
import { ClientDetailDrawer } from './components/ClientDetailDrawer';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { calculateDistanceMeters, calculateBearing } from './utils/geoUtils';
import { sound } from './utils/audioFeedback';
import {
  supabase,
  checkSupabaseConnection,
  mapRowToRep,
  mapRepToRow,
  mapRowToClient,
  mapClientToRow,
  mapRowToVisit,
  mapVisitToRow,
  SupabaseSyncState,
} from './lib/supabase';

type ActiveTab = 'map' | 'rep_view' | 'supervisor' | 'employees' | 'clients';

export default function App() {
  // Persistence with localStorage fallback
  const [salesReps, setSalesReps] = useState<SalesRep[]>(() => {
    const saved = localStorage.getItem('geoventas_reps');
    return saved ? JSON.parse(saved) : INITIAL_SALES_REPS;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('geoventas_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  const [visits, setVisits] = useState<Visit[]>(() => {
    const saved = localStorage.getItem('geoventas_visits');
    return saved ? JSON.parse(saved) : INITIAL_VISITS;
  });

  // Supabase Connection & Sync State
  const [supabaseState, setSupabaseState] = useState<SupabaseSyncState>({
    isConnected: false,
    isChecking: true,
    lastSyncTime: null,
    hasTables: false,
    error: null,
  });
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Navigation & Selection states
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [selectedRepId, setSelectedRepId] = useState<string>(INITIAL_SALES_REPS[0].id);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isClientDrawerOpen, setIsClientDrawerOpen] = useState<boolean>(false);
  const [showAllRepsOnMap, setShowAllRepsOnMap] = useState<boolean>(false);

  // Modals & Map Point Picker
  const [activeModalVisit, setActiveModalVisit] = useState<Visit | null>(null);
  const [isNewVisitOpen, setIsNewVisitOpen] = useState<boolean>(false);
  const [isNewEmployeeModalOpen, setIsNewEmployeeModalOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [pickedMapCoords, setPickedMapCoords] = useState<Coordinates | null>(null);

  // CRM Client Editing Modal state
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState<boolean>(false);

  // Real-time Geolocation states
  const [isRealGpsActive, setIsRealGpsActive] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Simulation states
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const simulationIntervalRef = useRef<number | null>(null);
  const simStepRef = useRef<number>(0);

  // Save to localStorage as local cache
  useEffect(() => {
    localStorage.setItem('geoventas_reps', JSON.stringify(salesReps));
  }, [salesReps]);

  useEffect(() => {
    localStorage.setItem('geoventas_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('geoventas_visits', JSON.stringify(visits));
  }, [visits]);

  // SUPABASE INITIALIZATION & SYNC
  const fetchSupabaseData = async () => {
    try {
      const conn = await checkSupabaseConnection();
      if (!conn.isConnected) {
        setSupabaseState((prev) => ({
          ...prev,
          isConnected: false,
          isChecking: false,
          error: conn.error,
        }));
        return;
      }

      setSupabaseState((prev) => ({
        ...prev,
        isConnected: true,
        isChecking: false,
        error: null,
      }));

      // Try fetching vendedores
      const { data: repsData, error: repsError } = await supabase.from('vendedores').select('*');
      const { data: clientsData } = await supabase.from('clientes').select('*');
      const { data: visitsData } = await supabase.from('visitas').select('*');

      let hasTables = false;
      if (!repsError) {
        hasTables = true;
        if (repsData && repsData.length > 0) {
          const mappedReps = repsData.map(mapRowToRep);
          setSalesReps(mappedReps);
        }
      }

      if (clientsData && clientsData.length > 0) {
        const mappedClients = clientsData.map(mapRowToClient);
        setClients(mappedClients);
      }

      if (visitsData && visitsData.length > 0) {
        const mappedVisits = visitsData.map(mapRowToVisit);
        setVisits(mappedVisits);
      }

      // If tables exist in Supabase but have 0 records, automatically populate them with initial data
      if (hasTables && (!repsData || repsData.length === 0)) {
        await handleSeedSupabase();
      }

      setSupabaseState((prev) => ({
        ...prev,
        hasTables,
        lastSyncTime: new Date().toLocaleTimeString(),
      }));
    } catch (err: any) {
      console.warn('Supabase fetch error:', err);
      setSupabaseState((prev) => ({
        ...prev,
        isConnected: false,
        isChecking: false,
        error: err.message,
      }));
    }
  };

  useEffect(() => {
    fetchSupabaseData();

    // Setup Supabase Realtime channel for live multi-device syncing
    const channel = supabase
      .channel('geoventas-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendedores' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedRep = mapRowToRep(payload.new);
            setSalesReps((prev) =>
              prev.map((r) => (r.id === updatedRep.id ? updatedRep : r))
            );
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const newRep = mapRowToRep(payload.new);
            setSalesReps((prev) => {
              if (prev.some((r) => r.id === newRep.id)) return prev;
              return [...prev, newRep];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedClient = mapRowToClient(payload.new);
            setClients((prev) =>
              prev.map((c) => (c.id === updatedClient.id ? updatedClient : c))
            );
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const newClient = mapRowToClient(payload.new);
            setClients((prev) => {
              if (prev.some((c) => c.id === newClient.id)) return prev;
              return [newClient, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitas' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedVisit = mapRowToVisit(payload.new);
            setVisits((prev) =>
              prev.map((v) => (v.id === updatedVisit.id ? updatedVisit : v))
            );
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const newVisit = mapRowToVisit(payload.new);
            setVisits((prev) => {
              if (prev.some((v) => v.id === newVisit.id)) return prev;
              return [newVisit, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Upload local initial data to Supabase
  const handleSeedSupabase = async () => {
    for (const rep of salesReps) {
      await supabase.from('vendedores').upsert(mapRepToRow(rep));
    }
    for (const client of clients) {
      await supabase.from('clientes').upsert(mapClientToRow(client));
    }
    for (const visit of visits) {
      await supabase.from('visitas').upsert(mapVisitToRow(visit));
    }
    await fetchSupabaseData();
  };

  const activeRep = salesReps.find((r) => r.id === selectedRepId) || salesReps[0];
  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  // REAL GPS HANDLER
  const startRealGps = () => {
    if (!navigator.geolocation) {
      setGpsError('La geolocalización no es compatible con este navegador.');
      return;
    }

    setGpsError(null);
    setIsRealGpsActive(true);
    setIsSimulating(false);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const accuracy = pos.coords.accuracy;
        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        setGpsAccuracy(accuracy);

        updateRepCoordinates(selectedRepId, newCoords, speed);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGpsError(
          err.code === 1
            ? 'Permiso de ubicación denegado por el usuario.'
            : 'No se pudo obtener la señal GPS del dispositivo.'
        );
        setIsRealGpsActive(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );
  };

  const stopRealGps = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsRealGpsActive(false);
    setGpsAccuracy(null);
  };

  const toggleRealGps = () => {
    if (isRealGpsActive) {
      stopRealGps();
    } else {
      startRealGps();
    }
  };

  // CLEANUP ON UNMOUNT
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (simulationIntervalRef.current !== null) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  // UPDATE SALES REP COORDINATES & TELEMETRY
  const updateRepCoordinates = (repId: string, newCoords: Coordinates, speedKmH: number = 24) => {
    setSalesReps((prev) =>
      prev.map((r) => {
        if (r.id !== repId) return r;

        const distanceMeters = calculateDistanceMeters(r.currentCoords, newCoords);
        const distanceKm = distanceMeters / 1000;
        const heading = calculateBearing(r.currentCoords, newCoords);

        const newPoint = {
          lat: newCoords.lat,
          lng: newCoords.lng,
          timestamp: new Date().toLocaleTimeString(),
          speedKmH,
        };

        const updatedHistory = [...r.routeHistory, newPoint].slice(-40);

        const updatedRep: SalesRep = {
          ...r,
          currentCoords: newCoords,
          speedKmH,
          heading,
          lastPing: new Date().toISOString(),
          totalDistanceKmToday: Number((r.totalDistanceKmToday + distanceKm).toFixed(2)),
          routeHistory: updatedHistory,
          status: speedKmH > 5 ? 'on_route' : r.status,
        };

        // Asynchronously sync location update to Supabase
        if (supabaseState.isConnected) {
          supabase.from('vendedores').upsert(mapRepToRow(updatedRep)).then(() => {});
        }

        return updatedRep;
      })
    );
  };

  // SIMULATION HANDLER
  const simulationRouteWaypoints: Coordinates[] = [
    { lat: 40.4530, lng: -3.6883 },
    { lat: 40.4490, lng: -3.6895 },
    { lat: 40.4440, lng: -3.6910 },
    { lat: 40.4385, lng: -3.6870 },
    { lat: 40.4330, lng: -3.6865 },
    { lat: 40.4305, lng: -3.6860 },
    { lat: 40.4280, lng: -3.6840 },
    { lat: 40.4250, lng: -3.6810 },
    { lat: 40.4220, lng: -3.6890 },
    { lat: 40.4200, lng: -3.7045 },
    { lat: 40.4240, lng: -3.6780 },
    { lat: 40.4380, lng: -3.6740 },
  ];

  const stepSimulation = () => {
    simStepRef.current = (simStepRef.current + 1) % simulationRouteWaypoints.length;
    const targetPoint = simulationRouteWaypoints[simStepRef.current];
    const jittered = {
      lat: targetPoint.lat + (Math.random() - 0.5) * 0.0003,
      lng: targetPoint.lng + (Math.random() - 0.5) * 0.0003,
    };
    const randomSpeed = Math.floor(28 + Math.random() * 20);
    updateRepCoordinates(selectedRepId, jittered, randomSpeed);
  };

  const startSimulationInterval = (speedMult: number) => {
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    const ms = Math.max(800, Math.round(3500 / speedMult));
    simulationIntervalRef.current = window.setInterval(() => {
      stepSimulation();
    }, ms);
  };

  const toggleSimulation = () => {
    if (isSimulating) {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
      setIsSimulating(false);
    } else {
      stopRealGps();
      setIsSimulating(true);
      startSimulationInterval(simulationSpeed);
    }
  };

  const handleChangeSimulationSpeed = (spd: number) => {
    setSimulationSpeed(spd);
    if (isSimulating) {
      startSimulationInterval(spd);
    }
  };

  // CHECK-IN HANDLER
  const handleConfirmCheckIn = (
    visitId: string,
    coords: Coordinates,
    distanceMeters: number,
    isWithinGeofence: boolean,
    reason?: string
  ) => {
    const nowIso = new Date().toISOString();
    let updatedVisit: Visit | null = null;

    setVisits((prev) =>
      prev.map((v) => {
        if (v.id !== visitId) return v;
        updatedVisit = {
          ...v,
          status: 'in_progress',
          checkInTime: nowIso,
          checkInCoords: coords,
          checkInDistanceMeters: distanceMeters,
          isWithinGeofence,
          geofenceOverrideReason: reason,
        };
        return updatedVisit;
      })
    );

    setSalesReps((prev) =>
      prev.map((r) => (r.id === selectedRepId ? { ...r, status: 'in_meeting' } : r))
    );

    // Sync visit check-in to Supabase
    if (updatedVisit && supabaseState.isConnected) {
      supabase.from('visitas').upsert(mapVisitToRow(updatedVisit)).then(() => {});
    }

    setActiveModalVisit(null);
  };

  // CHECK-OUT HANDLER
  const handleConfirmCheckOut = (
    visitId: string,
    data: {
      outcome: VisitOutcome;
      saleAmount?: number;
      notes: string;
      rating: number;
      signatureBase64?: string;
      photoUrl?: string;
    }
  ) => {
    const nowIso = new Date().toISOString();
    let updatedVisit: Visit | null = null;

    setVisits((prev) =>
      prev.map((v) => {
        if (v.id !== visitId) return v;

        let duration = 30;
        if (v.checkInTime) {
          const diffMs = new Date(nowIso).getTime() - new Date(v.checkInTime).getTime();
          duration = Math.max(5, Math.round(diffMs / (1000 * 60)));
        }

        updatedVisit = {
          ...v,
          status: 'completed',
          checkOutTime: nowIso,
          checkOutCoords: activeRep.currentCoords,
          durationMinutes: duration,
          outcome: data.outcome,
          saleAmount: data.saleAmount,
          notes: data.notes,
          clientFeedbackRating: data.rating,
          signatureBase64: data.signatureBase64,
          photoUrl: data.photoUrl,
        };
        return updatedVisit;
      })
    );

    setSalesReps((prev) =>
      prev.map((r) => (r.id === selectedRepId ? { ...r, status: 'available' } : r))
    );

    // Sync visit check-out to Supabase
    if (updatedVisit && supabaseState.isConnected) {
      supabase.from('visitas').upsert(mapVisitToRow(updatedVisit)).then(() => {});
    }

    setActiveModalVisit(null);
  };

  // CREATE NEW VISIT
  const handleCreateVisit = (newVisitData: Omit<Visit, 'id'>) => {
    const newId = `vis-${Date.now()}`;
    const newVisit: Visit = {
      ...newVisitData,
      id: newId,
    };
    setVisits((prev) => [newVisit, ...prev]);

    // Sync to Supabase
    if (supabaseState.isConnected) {
      supabase.from('visitas').upsert(mapVisitToRow(newVisit)).then(() => {});
    }
  };

  // CREATE NEW CLIENT AND VISIT
  const handleCreateClientAndVisit = (
    clientData: Omit<Client, 'id'>,
    visitData: Omit<Visit, 'id' | 'clientId'>
  ) => {
    const newClientId = `client-${Date.now()}`;
    const newClient: Client = {
      ...clientData,
      id: newClientId,
    };
    const newVisit: Visit = {
      ...visitData,
      id: `vis-${Date.now()}`,
      clientId: newClientId,
    };

    setClients((prev) => [newClient, ...prev]);
    setVisits((prev) => [newVisit, ...prev]);
    setSelectedClientId(newClientId);

    // Sync to Supabase
    if (supabaseState.isConnected) {
      supabase.from('clientes').upsert(mapClientToRow(newClient)).then(() => {
        supabase.from('visitas').upsert(mapVisitToRow(newVisit)).then(() => {});
      });
    }
  };

  // SAVE CLIENT (CREATE OR EDIT)
  const handleSaveClient = (clientData: Client) => {
    setClients((prev) => {
      const exists = prev.some((c) => c.id === clientData.id);
      if (exists) {
        return prev.map((c) => (c.id === clientData.id ? clientData : c));
      }
      return [clientData, ...prev];
    });

    // Sync to Supabase
    if (supabaseState.isConnected) {
      supabase.from('clientes').upsert(mapClientToRow(clientData)).then(() => {});
    }

    setIsEditClientModalOpen(false);
    setClientToEdit(null);
  };

  // DELETE CLIENT
  const handleDeleteClient = (clientId: string) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));

    if (selectedClientId === clientId) {
      setSelectedClientId(null);
      setIsClientDrawerOpen(false);
    }

    // Sync to Supabase
    if (supabaseState.isConnected) {
      supabase.from('clientes').delete().eq('id', clientId).then(() => {});
    }
  };

  // ADD NEW SALES REP (VENDEDOR)
  const handleAddEmployee = (
    employeeData: Omit<SalesRep, 'id' | 'totalDistanceKmToday' | 'routeHistory' | 'lastPing' | 'speedKmH'>
  ) => {
    const newId = `rep-${Date.now()}`;
    const newRep: SalesRep = {
      ...employeeData,
      id: newId,
      totalDistanceKmToday: 0,
      speedKmH: 0,
      heading: 0,
      lastPing: new Date().toISOString(),
      routeHistory: [
        {
          lat: employeeData.currentCoords.lat,
          lng: employeeData.currentCoords.lng,
          timestamp: new Date().toLocaleTimeString(),
          speedKmH: 0,
        },
      ],
    };

    setSalesReps((prev) => [...prev, newRep]);
    setSelectedRepId(newId);

    // Sync to Supabase
    if (supabaseState.isConnected) {
      supabase.from('vendedores').upsert(mapRepToRow(newRep)).then(() => {});
    }
  };

  // DELETE SALES REP
  const handleDeleteEmployee = (repId: string) => {
    setSalesReps((prev) => {
      const updated = prev.filter((r) => r.id !== repId);
      if (selectedRepId === repId && updated.length > 0) {
        setSelectedRepId(updated[0].id);
      }
      return updated;
    });

    if (supabaseState.isConnected) {
      supabase.from('vendedores').delete().eq('id', repId).then(() => {});
    }
  };

  // RESET TO DEMO DATA
  const handleResetData = () => {
    if (window.confirm('¿Restablecer datos originales del recorrido y clientes?')) {
      sound.playClick();
      localStorage.removeItem('geoventas_reps');
      localStorage.removeItem('geoventas_clients');
      localStorage.removeItem('geoventas_visits');
      setSalesReps(INITIAL_SALES_REPS);
      setClients(INITIAL_CLIENTS);
      setVisits(INITIAL_VISITS);
      setSelectedRepId(INITIAL_SALES_REPS[0].id);
      setSelectedClientId(null);
    }
  };

  // Selecting a client opens details
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setIsClientDrawerOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* TOP BAR CONTRACT:
          Zone 1: Brand Wordmark (one line)
          Zone 2: 4-5 Nav links (single line)
          Zone 3: 1 Primary action */}
      <header className="flex items-center justify-between gap-6 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            GeoVentas
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-semibold text-slate-600">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('map');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'map' ? 'text-blue-600 font-bold' : 'hover:text-slate-900'
            }`}
          >
            Mapa en Vivo
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('rep_view');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'rep_view' ? 'text-blue-600 font-bold' : 'hover:text-slate-900'
            }`}
          >
            Ruta Vendedor
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('supervisor');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'supervisor' ? 'text-blue-600 font-bold' : 'hover:text-slate-900'
            }`}
          >
            Supervisión
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('employees');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'employees' ? 'text-blue-600 font-bold' : 'hover:text-slate-900'
            }`}
          >
            Vendedores
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('clients');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'clients' ? 'text-blue-600 font-bold' : 'hover:text-slate-900'
            }`}
          >
            Clientes CRM
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setIsHistoryOpen(true);
            }}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Auditoría GPS
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              sound.playClick();
              setPickedMapCoords(null);
              setIsNewVisitOpen(true);
            }}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>+ Nueva Visita</span>
          </button>
        </div>
      </header>

      {/* SUB-HEADER / CONTEXT TOOLBAR & SUPABASE STATUS */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('map');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-semibold ${activeTab === 'map' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
          >
            Mapa
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('rep_view');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-semibold ${activeTab === 'rep_view' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
          >
            Ruta
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('supervisor');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-semibold ${activeTab === 'supervisor' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
          >
            Flota
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('employees');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-semibold ${activeTab === 'employees' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
          >
            Vendedores
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('clients');
            }}
            className={`px-2.5 py-1.5 rounded-lg font-semibold ${activeTab === 'clients' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
          >
            CRM
          </button>
        </div>

        {/* Rep Selector & Map Modes */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Vendedor Activo:</span>
            <select
              value={selectedRepId}
              onChange={(e) => {
                sound.playClick();
                setSelectedRepId(e.target.value);
              }}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.territory}
                </option>
              ))}
            </select>
          </div>

          <label className="hidden sm:flex items-center gap-1.5 cursor-pointer text-slate-600 select-none">
            <input
              type="checkbox"
              checked={showAllRepsOnMap}
              onChange={(e) => {
                sound.playClick();
                setShowAllRepsOnMap(e.target.checked);
              }}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Mostrar toda la flota en mapa</span>
          </label>
        </div>

        {/* Supabase status indicator & actions */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Quick CRM Client action if on clients tab */}
          {activeTab === 'clients' ? (
            <button
              onClick={() => {
                sound.playClick();
                setClientToEdit(null);
                setIsEditClientModalOpen(true);
              }}
              className="text-blue-600 hover:text-blue-800 font-bold transition-colors flex items-center gap-1"
            >
              <span>+ Nuevo Cliente CRM</span>
            </button>
          ) : (
            <button
              onClick={() => {
                sound.playClick();
                setIsNewEmployeeModalOpen(true);
              }}
              className="text-blue-600 hover:text-blue-800 font-bold transition-colors flex items-center gap-1"
            >
              <span>+ Alta Vendedor</span>
            </button>
          )}

          <span className="text-slate-300">|</span>

          {/* Supabase connection badge */}
          <button
            onClick={() => {
              sound.playClick();
              setIsSupabaseModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700 font-medium"
            title="Ver estado de conexión con Supabase"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                supabaseState.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{supabaseState.isConnected ? 'Supabase Conectado' : 'Supabase (Configurar)'}</span>
          </button>

          <span className="text-slate-300">|</span>
          <button
            onClick={handleResetData}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Restablece los datos de demostración"
          >
            Restablecer demo
          </button>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* VIEW 1: MAPA EN VIVO */}
        {activeTab === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-4">
              <MapView
                salesReps={salesReps}
                clients={clients}
                visits={visits}
                selectedRepId={selectedRepId}
                selectedClientId={selectedClientId}
                onSelectClient={handleSelectClient}
                onSelectRep={(rId) => setSelectedRepId(rId)}
                onInitiateCheckIn={(visit) => setActiveModalVisit(visit)}
                onMapClickCoordinate={(coords) => {
                  setPickedMapCoords(coords);
                  setIsNewVisitOpen(true);
                }}
                showAllReps={showAllRepsOnMap}
              />

              <LiveTrackerControls
                activeRep={activeRep}
                clients={clients}
                visits={visits}
                onUpdateRepCoords={(coords, speed) => updateRepCoordinates(selectedRepId, coords, speed)}
                isRealGpsActive={isRealGpsActive}
                onToggleRealGps={toggleRealGps}
                onStepSimulation={stepSimulation}
                isSimulating={isSimulating}
                onToggleSimulation={toggleSimulation}
                simulationSpeed={simulationSpeed}
                onChangeSimulationSpeed={handleChangeSimulationSpeed}
                gpsAccuracy={gpsAccuracy}
                gpsError={gpsError}
                onInitiateCheckIn={(visit) => setActiveModalVisit(visit)}
              />
            </div>

            <div className="lg:col-span-5">
              <RepDashboardView
                rep={activeRep}
                clients={clients}
                visits={visits}
                onOpenCheckInModal={(visit) => setActiveModalVisit(visit)}
                onSelectClient={handleSelectClient}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: RUTA VENDEDOR */}
        {activeTab === 'rep_view' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <LiveTrackerControls
              activeRep={activeRep}
              clients={clients}
              visits={visits}
              onUpdateRepCoords={(coords, speed) => updateRepCoordinates(selectedRepId, coords, speed)}
              isRealGpsActive={isRealGpsActive}
              onToggleRealGps={toggleRealGps}
              onStepSimulation={stepSimulation}
              isSimulating={isSimulating}
              onToggleSimulation={toggleSimulation}
              simulationSpeed={simulationSpeed}
              onChangeSimulationSpeed={handleChangeSimulationSpeed}
              gpsAccuracy={gpsAccuracy}
              gpsError={gpsError}
              onInitiateCheckIn={(visit) => setActiveModalVisit(visit)}
            />

            <RepDashboardView
              rep={activeRep}
              clients={clients}
              visits={visits}
              onOpenCheckInModal={(visit) => setActiveModalVisit(visit)}
              onSelectClient={handleSelectClient}
            />
          </div>
        )}

        {/* VIEW 3: SUPERVISIÓN */}
        {activeTab === 'supervisor' && (
          <div className="space-y-6">
            <SupervisorDashboardView
              salesReps={salesReps}
              clients={clients}
              visits={visits}
              selectedRepId={selectedRepId}
              onSelectRep={(repId) => {
                setSelectedRepId(repId);
                setActiveTab('map');
              }}
              onSelectClient={handleSelectClient}
              onOpenCheckInModal={(visit) => setActiveModalVisit(visit)}
            />

            <div className="h-[460px]">
              <MapView
                salesReps={salesReps}
                clients={clients}
                visits={visits}
                selectedRepId={selectedRepId}
                selectedClientId={selectedClientId}
                onSelectClient={handleSelectClient}
                onSelectRep={(rId) => setSelectedRepId(rId)}
                onInitiateCheckIn={(visit) => setActiveModalVisit(visit)}
                showAllReps={true}
              />
            </div>
          </div>
        )}

        {/* VIEW 4: VENDEDORES */}
        {activeTab === 'employees' && (
          <EmployeesView
            salesReps={salesReps}
            visits={visits}
            onOpenNewEmployeeModal={() => setIsNewEmployeeModalOpen(true)}
            onSelectRepAndGoToMap={(repId) => {
              setSelectedRepId(repId);
              setActiveTab('map');
            }}
            onSelectRepAndGoToRoute={(repId) => {
              setSelectedRepId(repId);
              setActiveTab('rep_view');
            }}
            onDeleteEmployee={handleDeleteEmployee}
            onScheduleVisitForRep={(repId) => {
              setSelectedRepId(repId);
              setIsNewVisitOpen(true);
            }}
          />
        )}

        {/* VIEW 5: CLIENTES CRM EDITABLE */}
        {activeTab === 'clients' && (
          <ClientsCrmView
            clients={clients}
            visits={visits}
            salesReps={salesReps}
            onOpenNewClientModal={() => {
              setClientToEdit(null);
              setIsEditClientModalOpen(true);
            }}
            onEditClient={(client) => {
              setClientToEdit(client);
              setIsEditClientModalOpen(true);
            }}
            onSelectClientAndGoToMap={(clientId) => {
              setSelectedClientId(clientId);
              setActiveTab('map');
            }}
            onScheduleVisitForClient={(clientId) => {
              setSelectedClientId(clientId);
              setIsNewVisitOpen(true);
            }}
            onDeleteClient={handleDeleteClient}
            onViewClientDrawer={handleSelectClient}
          />
        )}
      </main>

      {/* MODALS & DRAWERS */}
      {/* 1. Client Detail Slide-Over Drawer */}
      {isClientDrawerOpen && selectedClient && (
        <ClientDetailDrawer
          client={selectedClient}
          visits={visits}
          salesReps={salesReps}
          activeRep={activeRep}
          onClose={() => setIsClientDrawerOpen(false)}
          onScheduleVisitForClient={(clientId) => {
            setIsClientDrawerOpen(false);
            setIsNewVisitOpen(true);
          }}
          onInitiateCheckIn={(visit) => {
            setIsClientDrawerOpen(false);
            setActiveModalVisit(visit);
          }}
          onEditClient={(client) => {
            setClientToEdit(client);
            setIsEditClientModalOpen(true);
          }}
        />
      )}

      {/* 2. Check-in & Check-out Modal */}
      {activeModalVisit && (() => {
        const client = clients.find((c) => c.id === activeModalVisit.clientId);
        if (!client) return null;
        return (
          <VisitCheckInModal
            visit={activeModalVisit}
            client={client}
            rep={activeRep}
            onClose={() => setActiveModalVisit(null)}
            onCheckIn={handleConfirmCheckIn}
            onCheckOut={handleConfirmCheckOut}
          />
        );
      })()}

      {/* 3. New Visit Modal */}
      {isNewVisitOpen && (
        <NewVisitModal
          salesReps={salesReps}
          clients={clients}
          initialClientId={selectedClientId || undefined}
          initialCoords={pickedMapCoords}
          onClose={() => {
            setIsNewVisitOpen(false);
            setPickedMapCoords(null);
          }}
          onCreateVisit={handleCreateVisit}
          onCreateClientAndVisit={handleCreateClientAndVisit}
        />
      )}

      {/* 4. New Sales Rep (Vendedor) Modal */}
      {isNewEmployeeModalOpen && (
        <NewEmployeeModal
          onClose={() => setIsNewEmployeeModalOpen(false)}
          onAddEmployee={handleAddEmployee}
          userCoords={isRealGpsActive && activeRep ? activeRep.currentCoords : null}
        />
      )}

      {/* 5. Edit or Create Client CRM Modal */}
      {isEditClientModalOpen && (
        <EditClientModal
          client={clientToEdit}
          initialCoords={pickedMapCoords}
          onClose={() => {
            setIsEditClientModalOpen(false);
            setClientToEdit(null);
          }}
          onSaveClient={handleSaveClient}
        />
      )}

      {/* 6. History & Audit Modal */}
      {isHistoryOpen && (
        <VisitsHistoryModal
          visits={visits}
          clients={clients}
          salesReps={salesReps}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* 7. Supabase Sync Modal */}
      {isSupabaseModalOpen && (
        <SupabaseSyncModal
          syncState={supabaseState}
          onClose={() => setIsSupabaseModalOpen(false)}
          onSyncNow={fetchSupabaseData}
          onSeedSupabase={handleSeedSupabase}
          vendedoresCount={salesReps.length}
          clientesCount={clients.length}
          visitasCount={visits.length}
        />
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto">
        <p>© 2026 GeoVentas · Conectado con Supabase PostgreSQL</p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              sound.playClick();
              setIsSupabaseModalOpen(true);
            }}
            className="hover:text-slate-800 transition-colors font-semibold flex items-center gap-1.5"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                supabaseState.isConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span>Estado Supabase</span>
          </button>
          <span>·</span>
          <button
            onClick={() => {
              sound.playClick();
              setIsHistoryOpen(true);
            }}
            className="hover:text-slate-800 transition-colors font-semibold"
          >
            Descargar Reporte CSV
          </button>
        </div>
      </footer>
    </div>
  );
}

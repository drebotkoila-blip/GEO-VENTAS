/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { SalesRep, Client, Visit, VisitOutcome, Coordinates, Article, Sale } from './types';
import { INITIAL_SALES_REPS, INITIAL_CLIENTS, INITIAL_VISITS } from './data/initialData';
import { INITIAL_ARTICLES } from './data/initialArticles';
import { INITIAL_SALES } from './data/initialSales';
import { ClientsCrmView } from './components/ClientsCrmView';
import { ArticlesView } from './components/ArticlesView';
import { SalesView } from './components/SalesView';
import { EditClientModal } from './components/EditClientModal';
import { EditEmployeeModal } from './components/EditEmployeeModal';
import { EditVisitModal } from './components/EditVisitModal';
import { EditArticleModal } from './components/EditArticleModal';
import { VisitCheckInModal } from './components/VisitCheckInModal';
import { NewVisitModal } from './components/NewVisitModal';
import { NewSaleModal } from './components/NewSaleModal';
import { ImportSalesModal } from './components/ImportSalesModal';
import { NewEmployeeModal } from './components/NewEmployeeModal';
import { VisitsHistoryModal } from './components/VisitsHistoryModal';
import { ClientDetailDrawer } from './components/ClientDetailDrawer';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { MonthlyVisitsCalendar } from './components/MonthlyVisitsCalendar';
import { ZoneSalesView } from './components/ZoneSalesView';
import { VisitsHistoryView } from './components/VisitsHistoryView';
import { ComercialesView } from './components/ComercialesView';
import { DayVisitsModal } from './components/DayVisitsModal';
import { ClientSalesHistoryModal } from './components/ClientSalesHistoryModal';
import { calculateDistanceMeters, calculateBearing, safeCoords, isValidCoordinate } from './utils/geoUtils';
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
  mapRowToArticle,
  mapArticleToRow,
  uploadArticlesToSupabase,
  mapRowToSale,
  mapSaleToRow,
  uploadSalesToSupabase,
  fetchAllSalesFromSupabase,
  SupabaseSyncState,
} from './lib/supabase';

type ActiveTab = 'calendar' | 'zone_sales' | 'sales' | 'articles' | 'clients' | 'employees' | 'history';

export default function App() {
  // Persistence with localStorage fallback and automatic corrupt-data healing
  const [salesReps, setSalesReps] = useState<SalesRep[]>(() => {
    const saved = localStorage.getItem('geoventas_reps');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: any) => ({
            ...r,
            currentCoords: safeCoords(r.currentCoords, { lat: 40.4530, lng: -3.6883 }),
            routeHistory: Array.isArray(r.routeHistory)
              ? r.routeHistory.filter((p: any) => p && isValidCoordinate(p))
              : [],
          }));
        }
      } catch (err) {
        console.warn('Error reading geoventas_reps from storage:', err);
      }
    }
    return INITIAL_SALES_REPS;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('geoventas_clients');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: any) => ({
            ...c,
            coords: safeCoords(c.coords, { lat: 40.4200, lng: -3.7000 }),
            geofenceRadiusMeters: Number.isFinite(Number(c.geofenceRadiusMeters)) ? Number(c.geofenceRadiusMeters) : 120,
          }));
        }
      } catch (err) {
        console.warn('Error reading geoventas_clients from storage:', err);
      }
    }
    return INITIAL_CLIENTS;
  });

  const [visits, setVisits] = useState<Visit[]>(() => {
    const saved = localStorage.getItem('geoventas_visits');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((v: any) => ({
            ...v,
            checkInCoords: v.checkInCoords ? safeCoords(v.checkInCoords) : undefined,
            checkOutCoords: v.checkOutCoords ? safeCoords(v.checkOutCoords) : undefined,
          }));
        }
      } catch (err) {
        console.warn('Error reading geoventas_visits from storage:', err);
      }
    }
    return INITIAL_VISITS;
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [selectedRepId, setSelectedRepId] = useState<string>(INITIAL_SALES_REPS[0].id);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isClientDrawerOpen, setIsClientDrawerOpen] = useState<boolean>(false);
  const [showAllRepsOnMap, setShowAllRepsOnMap] = useState<boolean>(false);

  // Modals & Map Point Picker
  const [activeModalVisit, setActiveModalVisit] = useState<Visit | null>(null);
  const [isNewVisitOpen, setIsNewVisitOpen] = useState<boolean>(false);
  const [newVisitInitialDate, setNewVisitInitialDate] = useState<string | undefined>(undefined);
  const [isNewEmployeeModalOpen, setIsNewEmployeeModalOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyRepFilter, setHistoryRepFilter] = useState<string | null>(null);
  const [pickedMapCoords, setPickedMapCoords] = useState<Coordinates | null>(null);

  // Calendar Day Visits Modal state
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarDayVisits, setCalendarDayVisits] = useState<Visit[]>([]);
  const [isDayVisitsModalOpen, setIsDayVisitsModalOpen] = useState<boolean>(false);

  // Client Sales History Modal state (al hacer doble clic en visita en el calendario)
  const [selectedClientForSalesModal, setSelectedClientForSalesModal] = useState<Client | null>(null);
  const [selectedVisitForSalesModal, setSelectedVisitForSalesModal] = useState<Visit | null>(null);
  const [isClientSalesModalOpen, setIsClientSalesModalOpen] = useState<boolean>(false);

  // CRM Client Editing Modal state
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState<boolean>(false);

  // Sales Rep (Vendedor) Editing Modal state
  const [employeeToEdit, setEmployeeToEdit] = useState<SalesRep | null>(null);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState<boolean>(false);

  // Visit Editing Modal state
  const [visitToEdit, setVisitToEdit] = useState<Visit | null>(null);
  const [isEditVisitModalOpen, setIsEditVisitModalOpen] = useState<boolean>(false);

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

  const [articles, setArticles] = useState<Article[]>(() => {
    const saved = localStorage.getItem('geoventas_articles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {
        console.warn('Error reading geoventas_articles:', err);
      }
    }
    return INITIAL_ARTICLES;
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('geoventas_sales');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Re-map with parseSpanishNumber in case old 0-amount rows were cached
          return parsed.map((s: any, idx: number) => mapRowToSale(s, idx));
        }
      } catch (err) {
        console.warn('Error reading geoventas_sales:', err);
      }
    }
    return INITIAL_SALES;
  });

  const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState<boolean>(false);
  const [isImportSalesModalOpen, setIsImportSalesModalOpen] = useState<boolean>(false);

  // Article Editing Modal state
  const [articleToEdit, setArticleToEdit] = useState<Article | null>(null);
  const [isEditArticleModalOpen, setIsEditArticleModalOpen] = useState<boolean>(false);

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

  useEffect(() => {
    localStorage.setItem('geoventas_articles', JSON.stringify(articles));
  }, [articles]);

  useEffect(() => {
    localStorage.setItem('geoventas_sales', JSON.stringify(sales));
  }, [sales]);

  // SUPABASE INITIALIZATION & SYNC
  const fetchSupabaseData = async () => {
    setSupabaseState((prev) => ({
      ...prev,
      isChecking: true,
      error: null,
    }));

    try {
      const conn = await checkSupabaseConnection(2);
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

      // Try fetching vendedores, clientes, visitas, articulos, ventas
      const { data: repsData, error: repsError } = await supabase.from('vendedores').select('*');
      const { data: clientsData } = await supabase.from('clientes').select('*');
      const { data: visitsData } = await supabase.from('visitas').select('*');
      const { data: articulosData } = await supabase.from('articulos').select('*');

      // Fetch all sales with pagination and robust number parsing
      const { data: salesData } = await fetchAllSalesFromSupabase();
      if (salesData && salesData.length > 0) {
        setSales(salesData);
      }

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

      if (articulosData && articulosData.length > 0) {
        const mappedArticulos = articulosData.map(mapRowToArticle);
        setArticles(mappedArticulos);
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'articulos' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedArt = mapRowToArticle(payload.new);
            setArticles((prev) =>
              prev.map((a) => (a.referencia === updatedArt.referencia ? updatedArt : a))
            );
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const newArt = mapRowToArticle(payload.new);
            setArticles((prev) => {
              if (prev.some((a) => a.referencia === newArt.referencia)) return prev;
              return [newArt, ...prev];
            });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setArticles((prev) => prev.filter((a) => a.referencia !== payload.old.referencia));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'VENTAS' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newSale = mapRowToSale(payload.new);
            setSales((prev) => {
              if (prev.some((s) => s.id === newSale.id)) return prev;
              return [newSale, ...prev];
            });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setSales((prev) => prev.filter((s) => s.id !== String(payload.old.id)));
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
    await uploadArticlesToSupabase(articles);
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
    const validCoords = safeCoords(newCoords, { lat: 40.4530, lng: -3.6883 });
    const safeSpeed = Number.isFinite(speedKmH) ? speedKmH : 0;

    setSalesReps((prev) =>
      prev.map((r) => {
        if (r.id !== repId) return r;

        const currentValid = safeCoords(r.currentCoords, { lat: 40.4530, lng: -3.6883 });
        const distanceMeters = calculateDistanceMeters(currentValid, validCoords);
        const distanceKm = distanceMeters / 1000;
        const heading = calculateBearing(currentValid, validCoords);

        const newPoint = {
          lat: validCoords.lat,
          lng: validCoords.lng,
          timestamp: new Date().toLocaleTimeString(),
          speedKmH: safeSpeed,
        };

        const updatedHistory = [...(Array.isArray(r.routeHistory) ? r.routeHistory : []), newPoint]
          .filter((p) => isValidCoordinate(p))
          .slice(-40);

        const updatedRep: SalesRep = {
          ...r,
          currentCoords: validCoords,
          speedKmH: safeSpeed,
          heading: Number.isFinite(heading) ? heading : 0,
          lastPing: new Date().toISOString(),
          totalDistanceKmToday: Number(((r.totalDistanceKmToday || 0) + (Number.isFinite(distanceKm) ? distanceKm : 0)).toFixed(2)),
          routeHistory: updatedHistory,
          status: safeSpeed > 5 ? 'on_route' : r.status,
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

    setNewVisitInitialDate(undefined);
  };

  // CALENDAR VISITS HANDLERS
  const handleOpenDayVisits = (dateString: string, dayVisits: Visit[]) => {
    setSelectedCalendarDate(dateString);
    setCalendarDayVisits(dayVisits);
    setIsDayVisitsModalOpen(true);
  };

  const handleNewVisitForDate = (dateString: string) => {
    setNewVisitInitialDate(dateString);
    setIsNewVisitOpen(true);
  };

  // Open client sales history & articles breakdown (al hacer doble clic en visita en el calendario)
  const handleOpenClientSalesModal = (client: Client, visit?: Visit) => {
    setSelectedClientForSalesModal(client);
    setSelectedVisitForSalesModal(visit || null);
    setIsClientSalesModalOpen(true);
  };

  // MOVE VISIT TO ANOTHER DATE (DRAG & DROP)
  const handleMoveVisit = (visitId: string, newDateString: string) => {
    let updatedVisit: Visit | null = null;
    setVisits((prev) =>
      prev.map((v) => {
        if (v.id !== visitId) return v;
        updatedVisit = { ...v, scheduledDate: newDateString };
        return updatedVisit;
      })
    );

    // Sync to Supabase if connected
    if (updatedVisit && supabaseState.isConnected) {
      supabase.from('visitas').upsert(mapVisitToRow(updatedVisit)).then(() => {});
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

  // DELETE MULTIPLE CLIENTS
  const handleDeleteMultipleClients = (clientIds: string[]) => {
    setClients((prev) => prev.filter((c) => !clientIds.includes(c.id)));

    if (selectedClientId && clientIds.includes(selectedClientId)) {
      setSelectedClientId(null);
      setIsClientDrawerOpen(false);
    }

    // Sync to Supabase
    if (supabaseState.isConnected) {
      supabase.from('clientes').delete().in('id', clientIds).then(() => {});
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

  // SAVE / EDIT SALES REP (VENDEDOR)
  const handleSaveEmployee = (repData: SalesRep) => {
    setSalesReps((prev) => {
      const exists = prev.some((r) => r.id === repData.id);
      if (exists) {
        return prev.map((r) => (r.id === repData.id ? repData : r));
      }
      return [...prev, repData];
    });

    // Sync to Supabase
    if (supabaseState.isConnected) {
      supabase.from('vendedores').upsert(mapRepToRow(repData)).then(() => {});
    }

    setIsEditEmployeeModalOpen(false);
    setEmployeeToEdit(null);
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

  // DELETE MULTIPLE SALES REPS
  const handleDeleteMultipleEmployees = (repIds: string[]) => {
    setSalesReps((prev) => {
      const updated = prev.filter((r) => !repIds.includes(r.id));
      if (selectedRepId && repIds.includes(selectedRepId) && updated.length > 0) {
        setSelectedRepId(updated[0].id);
      }
      return updated;
    });

    if (supabaseState.isConnected) {
      supabase.from('vendedores').delete().in('id', repIds).then(() => {});
    }
  };

  // SAVE / EDIT VISIT
  const handleSaveVisit = (visitData: Visit) => {
    setVisits((prev) => {
      const exists = prev.some((v) => v.id === visitData.id);
      if (exists) {
        return prev.map((v) => (v.id === visitData.id ? visitData : v));
      }
      return [visitData, ...prev];
    });

    if (supabaseState.isConnected) {
      supabase.from('visitas').upsert(mapVisitToRow(visitData)).then(() => {});
    }

    setIsEditVisitModalOpen(false);
    setVisitToEdit(null);
  };

  // DELETE SINGLE VISIT
  const handleDeleteVisit = (visitId: string) => {
    setVisits((prev) => prev.filter((v) => v.id !== visitId));

    if (supabaseState.isConnected) {
      supabase.from('visitas').delete().eq('id', visitId).then(() => {});
    }
  };

  // DELETE MULTIPLE VISITS
  const handleDeleteMultipleVisits = (visitIds: string[]) => {
    setVisits((prev) => prev.filter((v) => !visitIds.includes(v.id)));

    if (supabaseState.isConnected) {
      supabase.from('visitas').delete().in('id', visitIds).then(() => {});
    }
  };

  // SAVE / EDIT ARTICLE
  const handleSaveArticle = (articleData: Article) => {
    setArticles((prev) => {
      const exists = prev.some((a) => a.referencia === articleData.referencia);
      if (exists) {
        return prev.map((a) => (a.referencia === articleData.referencia ? articleData : a));
      }
      return [articleData, ...prev];
    });

    if (supabaseState.isConnected) {
      supabase.from('articulos').upsert(mapArticleToRow(articleData)).then(() => {});
    }

    setIsEditArticleModalOpen(false);
    setArticleToEdit(null);
  };

  // DELETE SINGLE ARTICLE
  const handleDeleteArticle = (ref: number) => {
    setArticles((prev) => prev.filter((a) => a.referencia !== ref));

    if (supabaseState.isConnected) {
      supabase.from('articulos').delete().eq('referencia', ref).then(() => {});
    }
  };

  // DELETE MULTIPLE ARTICLES
  const handleDeleteMultipleArticles = (refs: number[]) => {
    setArticles((prev) => prev.filter((a) => !refs.includes(a.referencia)));

    if (supabaseState.isConnected) {
      supabase.from('articulos').delete().in('referencia', refs).then(() => {});
    }
  };

  // SYNC ARTICLES WITH SUPABASE
  const handleSyncArticlesWithSupabase = async () => {
    if (!supabaseState.isConnected) return;
    const { data, error } = await supabase.from('articulos').select('*');
    if (!error && data && data.length > 0) {
      setArticles(data.map(mapRowToArticle));
    } else {
      await uploadArticlesToSupabase(articles);
    }
  };

  // CREATE / SAVE SALE
  const handleCreateSale = async (saleData: Omit<Sale, 'id'>) => {
    const newId = `sale-${Date.now()}`;
    const newSale: Sale = {
      ...saleData,
      id: newId,
    };
    setSales((prev) => [newSale, ...prev]);

    // Push to Supabase table VENTAS
    if (supabaseState.isConnected) {
      try {
        const row = mapSaleToRow(newSale);
        const { error } = await supabase.from('VENTAS').insert([row]);
        if (error) {
          await supabase.from('ventas').insert([row]);
        }
      } catch (err) {
        console.warn('Error saving sale to Supabase:', err);
      }
    }
  };

  // DELETE SINGLE SALE
  const handleDeleteSale = async (saleIdOrIndex: string | number) => {
    setSales((prev) => prev.filter((s, idx) => (s.id ? s.id !== saleIdOrIndex : idx !== saleIdOrIndex)));

    if (supabaseState.isConnected && typeof saleIdOrIndex === 'string') {
      try {
        await supabase.from('VENTAS').delete().eq('id', saleIdOrIndex);
      } catch (e) {
        // Table might use different primary key
      }
    }
  };

  // DELETE MULTIPLE SALES
  const handleDeleteMultipleSales = async (identifiers: (string | number)[]) => {
    setSales((prev) =>
      prev.filter((s, idx) => {
        const key = s.id || idx;
        return !identifiers.includes(key);
      })
    );

    if (supabaseState.isConnected) {
      const stringIds = identifiers.filter((id): id is string => typeof id === 'string');
      if (stringIds.length > 0) {
        try {
          await supabase.from('VENTAS').delete().in('id', stringIds);
        } catch (e) {
          // Ignore
        }
      }
    }
  };

  // SYNC SALES WITH SUPABASE
  const handleSyncSalesWithSupabase = async () => {
    if (!supabaseState.isConnected) return;
    const { data, error } = await fetchAllSalesFromSupabase();
    if (!error && data && data.length > 0) {
      setSales(data);
    }
  };

  // SEED SALES TO SUPABASE
  const handleSeedSalesToSupabase = async () => {
    if (!supabaseState.isConnected) return;
    await uploadSalesToSupabase(sales);
  };

  // RESET TO DEMO DATA
  const handleResetData = () => {
    if (window.confirm('¿Restablecer datos originales del recorrido y clientes?')) {
      sound.playClick();
      localStorage.removeItem('geoventas_reps');
      localStorage.removeItem('geoventas_clients');
      localStorage.removeItem('geoventas_visits');
      localStorage.removeItem('geoventas_sales');
      setSalesReps(INITIAL_SALES_REPS);
      setClients(INITIAL_CLIENTS);
      setVisits(INITIAL_VISITS);
      setSales(INITIAL_SALES);
      setSelectedRepId(INITIAL_SALES_REPS[0].id);
      setSelectedClientId(null);
    }
  };

  // Selecting a client opens details
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setIsClientDrawerOpen(true);
  };

  const NAV_ITEMS: { id: ActiveTab; label: string; short: string }[] = [
    { id: 'calendar', label: 'Calendario', short: 'Calendario' },
    { id: 'zone_sales', label: 'Ventas por Zona', short: 'Ventas Zona' },
    { id: 'sales', label: 'Ventas', short: 'Ventas' },
    { id: 'articles', label: 'Artículos & Stock', short: 'Artículos' },
    { id: 'clients', label: 'Clientes CRM', short: 'Clientes' },
    { id: 'employees', label: 'Comerciales', short: 'Equipo' },
    { id: 'history', label: 'Histórico Visitas', short: 'Histórico' },
  ];

  const goTo = (tab: ActiveTab) => {
    sound.playClick();
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

  const activeRepIsSupervisor = /supervis|jefe|director|manager/i.test(activeRep?.roleTitle || '');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[60px] flex items-center gap-6">
            {/* Brand */}
            <button
              onClick={() => goTo('calendar')}
              className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-600 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center">GV</span>
              <span>GeoVentas</span>
            </button>

            {/* Nav */}
            <nav className="hidden lg:flex items-center gap-5 text-sm font-medium overflow-x-auto scrollbar-none">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setHistoryRepFilter(null);
                    goTo(item.id);
                  }}
                  className={`whitespace-nowrap shrink-0 pb-1 border-b-2 transition-colors cursor-pointer ${
                    activeTab === item.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2.5 shrink-0">
              <label className="relative hidden sm:flex items-center gap-2 pl-2.5 pr-2 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                    {activeRepIsSupervisor ? 'Supervisor' : 'Comercial'}
                  </span>
                  <span className="text-xs font-semibold text-slate-900 max-w-[150px] truncate">{activeRep?.name}</span>
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-500"><polyline points="6 9 12 15 18 9"/></svg>
                <select
                  value={selectedRepId}
                  onChange={(e) => {
                    sound.playClick();
                    setSelectedRepId(e.target.value);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Usuario activo"
                >
                  {salesReps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.territory}
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={() => {
                  sound.playClick();
                  setIsSupabaseModalOpen(true);
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700"
                title="Estado de conexión con Supabase"
              >
                <span className={`w-2 h-2 rounded-full ${supabaseState.isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                Supabase
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setPickedMapCoords(null);
                  setIsNewVisitOpen(true);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Nueva Visita
              </button>
            </div>
          </div>

          {/* Mobile / tablet nav */}
          <nav className="lg:hidden flex items-center gap-4 text-sm font-medium overflow-x-auto scrollbar-none pb-2 -mt-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                    setHistoryRepFilter(null);
                    goTo(item.id);
                  }}
                className={`whitespace-nowrap shrink-0 pb-1 border-b-2 ${
                  activeTab === item.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600'
                }`}
              >
                {item.short}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {activeTab === 'calendar' && (
          <MonthlyVisitsCalendar
            visits={visits}
            clients={clients}
            salesReps={salesReps}
            sales={sales}
            articles={articles}
            onOpenDayVisits={handleOpenDayVisits}
            onNewVisitForDate={handleNewVisitForDate}
            onMoveVisit={handleMoveVisit}
            onEditVisit={(visit) => {
              setVisitToEdit(visit);
              setIsEditVisitModalOpen(true);
            }}
            onOpenCheckInModal={(visit) => setActiveModalVisit(visit)}
            onSelectClientAndGoToMap={(clientId) => {
              setSelectedClientId(clientId);
              setActiveTab('zone_sales');
            }}
            onOpenClientSales={handleOpenClientSalesModal}
          />
        )}

        {activeTab === 'zone_sales' && activeRep && (
          <ZoneSalesView
            clients={clients}
            sales={sales}
            visits={visits}
            activeRep={activeRep}
            onOpenClientSales={handleOpenClientSalesModal}
            onViewClient={handleSelectClient}
            onOpenCheckIn={(visit) => setActiveModalVisit(visit)}
            onLocateMe={() => {
              if (!isRealGpsActive) toggleRealGps();
            }}
          />
        )}

        {activeTab === 'employees' && (
          <ComercialesView
            salesReps={salesReps}
            visits={visits}
            sales={sales}
            onOpenNewEmployeeModal={() => setIsNewEmployeeModalOpen(true)}
            onEditEmployee={(rep) => {
              setEmployeeToEdit(rep);
              setIsEditEmployeeModalOpen(true);
            }}
            onViewVisits={(repId) => {
              setHistoryRepFilter(repId);
              goTo('history');
            }}
            onDeleteEmployee={handleDeleteEmployee}
            onDeleteMultipleEmployees={handleDeleteMultipleEmployees}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />
        )}

        {activeTab === 'history' && (
          <VisitsHistoryView
            key={historyRepFilter || 'all'}
            initialRepId={historyRepFilter || undefined}
            visits={visits}
            clients={clients}
            salesReps={salesReps}
            onNewVisit={() => {
              setPickedMapCoords(null);
              setIsNewVisitOpen(true);
            }}
            onEditVisit={(visit) => {
              setVisitToEdit(visit);
              setIsEditVisitModalOpen(true);
            }}
            onDeleteVisit={handleDeleteVisit}
            onDeleteMultipleVisits={handleDeleteMultipleVisits}
            onOpenDetail={(visit, client) => {
              if (client) handleOpenClientSalesModal(client, visit);
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
              setActiveTab('zone_sales');
            }}
            onScheduleVisitForClient={(clientId) => {
              setSelectedClientId(clientId);
              setIsNewVisitOpen(true);
            }}
            onDeleteClient={handleDeleteClient}
            onDeleteMultipleClients={handleDeleteMultipleClients}
            onViewClientDrawer={handleSelectClient}
          />
        )}

        {/* VIEW 6: CATÁLOGO DE ARTÍCULOS */}
        {activeTab === 'articles' && (
          <ArticlesView
            articles={articles}
            onOpenNewArticleModal={() => {
              setArticleToEdit(null);
              setIsEditArticleModalOpen(true);
            }}
            onEditArticle={(art) => {
              setArticleToEdit(art);
              setIsEditArticleModalOpen(true);
            }}
            onDeleteArticle={handleDeleteArticle}
            onDeleteMultipleArticles={handleDeleteMultipleArticles}
            onSyncWithSupabase={handleSyncArticlesWithSupabase}
            isSupabaseConnected={supabaseState.isConnected}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />
        )}

        {/* VIEW 7: GESTIÓN Y PANEL DE VENTAS */}
        {activeTab === 'sales' && (
          <SalesView
            sales={sales}
            articles={articles}
            clients={clients}
            salesReps={salesReps}
            onOpenNewSaleModal={() => setIsNewSaleModalOpen(true)}
            onOpenImportExcelModal={() => setIsImportSalesModalOpen(true)}
            onDeleteSale={handleDeleteSale}
            onDeleteMultipleSales={handleDeleteMultipleSales}
            onSyncWithSupabase={handleSyncSalesWithSupabase}
            onSeedSalesToSupabase={handleSeedSalesToSupabase}
            isSupabaseConnected={supabaseState.isConnected}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
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
          initialDate={newVisitInitialDate}
          onClose={() => {
            setIsNewVisitOpen(false);
            setPickedMapCoords(null);
            setNewVisitInitialDate(undefined);
          }}
          onCreateVisit={handleCreateVisit}
          onCreateClientAndVisit={handleCreateClientAndVisit}
        />
      )}

      {/* 3b. New Sale Modal */}
      {isNewSaleModalOpen && (
        <NewSaleModal
          isOpen={isNewSaleModalOpen}
          onClose={() => setIsNewSaleModalOpen(false)}
          onSaveSale={handleCreateSale}
          clients={clients}
          articles={articles}
          salesReps={salesReps}
          initialClientId={selectedClientId || undefined}
        />
      )}

      {/* 3c. Import Sales from Excel Modal */}
      {isImportSalesModalOpen && (
        <ImportSalesModal
          isOpen={isImportSalesModalOpen}
          onClose={() => setIsImportSalesModalOpen(false)}
          onSalesImported={(newSales) => {
            setSales((prev) => [...newSales, ...prev]);
          }}
          articles={articles}
          isSupabaseConnected={supabaseState.isConnected}
        />
      )}

      {/* Day Visits Modal ("otra ventana" al hacer doble clic en el día del calendario) */}
      {isDayVisitsModalOpen && selectedCalendarDate && (
        <DayVisitsModal
          dateString={selectedCalendarDate}
          visits={visits.filter((v) => v.scheduledDate === selectedCalendarDate)}
          clients={clients}
          salesReps={salesReps}
          sales={sales}
          articles={articles}
          onClose={() => {
            setIsDayVisitsModalOpen(false);
            setSelectedCalendarDate(null);
          }}
          onNewVisitForDate={(dateStr) => {
            setIsDayVisitsModalOpen(false);
            handleNewVisitForDate(dateStr);
          }}
          onEditVisit={(visit) => {
            setVisitToEdit(visit);
            setIsEditVisitModalOpen(true);
          }}
          onDeleteVisit={handleDeleteVisit}
          onMoveVisit={handleMoveVisit}
          onOpenCheckInModal={(visit) => setActiveModalVisit(visit)}
          onSelectClientAndGoToMap={(clientId) => {
            setSelectedClientId(clientId);
            setActiveTab('zone_sales');
          }}
          onOpenClientSales={handleOpenClientSalesModal}
        />
      )}

      {/* Modal Historial de Compras y Artículos del Cliente (al hacer doble clic en una visita en el calendario) */}
      <ClientSalesHistoryModal
        isOpen={isClientSalesModalOpen}
        onClose={() => {
          setIsClientSalesModalOpen(false);
          setSelectedClientForSalesModal(null);
          setSelectedVisitForSalesModal(null);
        }}
        client={selectedClientForSalesModal}
        visit={selectedVisitForSalesModal}
        sales={sales}
        articles={articles}
        onOpenNewSaleForClient={(clientId) => {
          setIsClientSalesModalOpen(false);
          setActiveTab('sales');
          setIsNewSaleModalOpen(true);
        }}
        onGoToCrmClient={(clientId) => {
          setIsClientSalesModalOpen(false);
          setSelectedClientId(clientId);
          setActiveTab('clients');
        }}
      />

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

      {/* 6. Edit or Create Article Modal */}
      {isEditArticleModalOpen && (
        <EditArticleModal
          article={articleToEdit}
          existingReferences={articles.map((a) => a.referencia)}
          onClose={() => {
            setIsEditArticleModalOpen(false);
            setArticleToEdit(null);
          }}
          onSave={handleSaveArticle}
        />
      )}

      {/* 7. History & Audit Modal */}
      {isHistoryOpen && (
        <VisitsHistoryModal
          visits={visits}
          clients={clients}
          salesReps={salesReps}
          onClose={() => setIsHistoryOpen(false)}
          onEditVisit={(visit) => {
            setVisitToEdit(visit);
            setIsEditVisitModalOpen(true);
          }}
          onDeleteVisit={handleDeleteVisit}
          onDeleteMultipleVisits={handleDeleteMultipleVisits}
        />
      )}

      {/* 8. Edit Sales Rep (Vendedor) Modal */}
      {isEditEmployeeModalOpen && employeeToEdit && (
        <EditEmployeeModal
          rep={employeeToEdit}
          onClose={() => {
            setIsEditEmployeeModalOpen(false);
            setEmployeeToEdit(null);
          }}
          onSaveEmployee={handleSaveEmployee}
        />
      )}

      {/* 9. Edit Visit Modal */}
      {isEditVisitModalOpen && visitToEdit && (
        <EditVisitModal
          visit={visitToEdit}
          clients={clients}
          salesReps={salesReps}
          onClose={() => {
            setIsEditVisitModalOpen(false);
            setVisitToEdit(null);
          }}
          onSaveVisit={handleSaveVisit}
        />
      )}

      {/* 10. Supabase Sync Modal */}
      {isSupabaseModalOpen && (
        <SupabaseSyncModal
          syncState={supabaseState}
          onClose={() => setIsSupabaseModalOpen(false)}
          onSyncNow={fetchSupabaseData}
          onSeedSupabase={handleSeedSupabase}
          vendedoresCount={salesReps.length}
          clientesCount={clients.length}
          visitasCount={visits.length}
          articulosCount={articles.length}
          ventasCount={sales.length}
        />
      )}

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="font-semibold text-slate-700">GeoVentas</span>
            <span className="text-slate-300">·</span>
            <span>Gestión de Visitas & Geolocalización de Comerciales</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1 text-emerald-600">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              Geocercas activas
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                sound.playClick();
                setIsSupabaseModalOpen(true);
              }}
              className="flex items-center gap-1.5 hover:text-slate-800"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/></svg>
              Supabase:{' '}
              <span className={supabaseState.isConnected ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                {supabaseState.isConnected ? 'En línea' : 'Sin configurar'}
              </span>
            </button>
            <span className="text-slate-300">·</span>
            <button onClick={handleResetData} className="hover:text-slate-800">
              Reiniciar datos demo
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

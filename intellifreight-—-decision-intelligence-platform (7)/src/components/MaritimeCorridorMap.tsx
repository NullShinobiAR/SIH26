import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Port, AlternativePortOption, Vessel } from '../types';
import {
  Compass,
  Ship,
  Anchor,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Maximize2,
  Navigation,
  Info,
} from 'lucide-react';

export interface MaritimeCorridorMapProps {
  originPort: Port;
  destinationPort: Port;
  alternativePorts: AlternativePortOption[];
  recommendedVessel: Vessel;
  selectedPortId: string;
  onSelectPort: (portId: string) => void;
}

// Navigable open-water maritime waypoint corridors from Hay Point, Australia to Bay of Bengal, India.
// Important accuracy mandate: These are explicitly modelled deep-sea shipping corridors (via Coral Sea,
// Timor Sea, Lombok Strait deep-water passage, and Equatorial Indian Ocean into Bay of Bengal),
// NOT fabricated real-time AIS tracks.
const SHARED_MARITIME_CORRIDOR_WAYPOINTS: [number, number][] = [
  [-21.2833, 149.3],   // Hay Point, Queensland, Australia
  [-18.5, 148.0],      // Coral Sea shipping fairway
  [-11.5, 143.5],      // Outer Great Barrier passage / Torres Strait approach
  [-10.2, 136.0],      // Arafura Sea deep corridor
  [-10.5, 125.0],      // Timor Sea
  [-8.8, 116.0],       // Lombok Strait (Capesize / Panamax deep-water passage)
  [-6.0, 105.0],       // South of Sunda / Java Trench transit
  [0.0, 96.0],         // Equatorial Indian Ocean fairway
  [6.0, 93.5],         // Great Nicobar / Six Degree Channel entrance
  [14.0, 86.5],        // Central Bay of Bengal fairway hub
];

// Branching waypoints from the Central Bay of Bengal hub to specific East Coast Indian bulk terminals
const PORT_APPROACH_WAYPOINTS: Record<string, [number, number][]> = {
  'in-dhm': [
    [14.0, 86.5],
    [18.5, 87.0],
    [20.0, 87.2],
    [20.8167, 86.9667], // Dhamra Port
  ],
  'in-prt': [
    [14.0, 86.5],
    [18.0, 86.8],
    [19.5, 86.9],
    [20.2644, 86.6698], // Paradip Port
  ],
  'in-gpl': [
    [14.0, 86.5],
    [17.5, 85.8],
    [18.8, 85.2],
    [19.3083, 84.975],  // Gopalpur Port
  ],
  'in-vtg': [
    [14.0, 86.5],
    [16.5, 84.2],
    [17.3, 83.5],
    [17.6868, 83.2185], // Visakhapatnam Port
  ],
  'in-ggv': [
    [14.0, 86.5],
    [16.4, 84.1],
    [17.2, 83.4],
    [17.6167, 83.2333], // Gangavaram Port
  ],
  'in-hld': [
    [14.0, 86.5],
    [19.5, 87.8],
    [21.3, 88.1],       // Sandheads Fairway
    [21.65, 88.0833],   // Sagar Anchorage
    [22.0257, 88.0583], // Haldia Dock Complex
  ],
  'in-sgr': [
    [14.0, 86.5],
    [19.5, 87.8],
    [21.3, 88.1],
    [21.65, 88.0833],   // Sagar Anchorage
  ],
};

function getFullCorridorForPort(portId: string, portLat: number, portLng: number): [number, number][] {
  const approach = PORT_APPROACH_WAYPOINTS[portId];
  if (approach) {
    // Merge shared backbone (excluding last hub point to avoid duplicate) + approach
    return [...SHARED_MARITIME_CORRIDOR_WAYPOINTS.slice(0, -1), ...approach];
  }
  // Fallback direct navigable link from hub to port coordinates
  return [...SHARED_MARITIME_CORRIDOR_WAYPOINTS, [portLat, portLng]];
}

export const MaritimeCorridorMap: React.FC<MaritimeCorridorMapProps> = ({
  originPort,
  destinationPort,
  alternativePorts,
  recommendedVessel,
  selectedPortId,
  onSelectPort,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapViewMode, setMapViewMode] = useState<'corridor' | 'india' | 'origin'>('corridor');

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [-2.0, 115.0],
      zoom: 4,
      minZoom: 2,
      maxZoom: 18,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors | Hydrography: WGS-84 Modelled Corridor',
    }).addTo(map);

    const initialBounds = L.latLngBounds([
      [originPort.latitude - 2, originPort.longitude + 3],
      [23.5, 80.0],
    ]);
    map.fitBounds(initialBounds, { padding: [30, 30], maxZoom: 5 });

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [originPort.latitude, originPort.longitude]);

  // Update map layers when ports, vessels, or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Origin Marker (Hay Point)
    const originIcon = L.divIcon({
      className: 'bg-transparent border-0',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer group" style="width: 38px; height: 38px;">
          <div class="absolute -inset-1 rounded-full bg-emerald-500/30 animate-pulse"></div>
          <div class="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs">
            ⚓
          </div>
          <div class="absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-slate-900/90 text-[10px] text-emerald-300 font-semibold border border-emerald-700/60 shadow pointer-events-none">
            ${originPort.name.split(' ')[0]} (Origin)
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const originMarker = L.marker([originPort.latitude, originPort.longitude], {
      icon: originIcon,
      zIndexOffset: 900,
    }).addTo(layerGroup);

    originMarker.bindPopup(`
      <div class="p-2 text-slate-800 text-xs min-w-[220px]">
        <div class="font-bold text-sm text-emerald-800 flex items-center gap-1">
          <span>⚓ Origin Loading Terminal</span>
        </div>
        <div class="font-semibold text-slate-900 mt-1">${originPort.name}</div>
        <div class="text-[11px] text-slate-500">${originPort.country} • Lat: ${originPort.latitude.toFixed(4)}°, Lng: ${originPort.longitude.toFixed(4)}°</div>
        <div class="mt-2 space-y-1 text-[11px] border-t border-slate-200 pt-1.5">
          <div><span class="font-semibold">Max Berth Draft:</span> ${originPort.maxDraft}m</div>
          <div><span class="font-semibold">Max LOA:</span> ${originPort.maxLoa}m</div>
          <div><span class="font-semibold">Loading Rate:</span> ${originPort.cargoHandlingRateTpd.toLocaleString()} t/day</div>
          <div class="text-slate-600 italic mt-1">${originPort.operationalNotes}</div>
        </div>
      </div>
    `);

    // 2. Draw Maritime Corridors for each Alternative Port
    alternativePorts.forEach((alt) => {
      const port = alt.port;
      if (!port || typeof port.latitude !== 'number' || typeof port.longitude !== 'number') return;

      const isSelected = alt.portId === selectedPortId;
      const isTarget = alt.portId === destinationPort.id;
      const isDraftViolated = recommendedVessel.draft > alt.draftLimit;

      const corridorCoordinates = getFullCorridorForPort(alt.portId, port.latitude, port.longitude);

      // Line style: highlight selected route with bright solid stroke, unselected with subtle dashed stroke
      let lineColor = '#64748b'; // slate-500
      let lineWeight = 2.5;
      let lineOpacity = 0.55;
      let dashArray: string | undefined = '6, 6';

      if (isSelected) {
        lineColor = isTarget ? '#06b6d4' : '#10b981'; // cyan for primary, emerald for alt
        lineWeight = 4.5;
        lineOpacity = 0.95;
        dashArray = undefined;
      } else if (isTarget) {
        lineColor = '#38bdf8'; // sky-400
        lineWeight = 3.5;
        lineOpacity = 0.75;
        dashArray = '8, 4';
      } else if (isDraftViolated) {
        lineColor = '#f43f5e'; // rose-500
        lineOpacity = 0.4;
      }

      const polyline = L.polyline(corridorCoordinates, {
        color: lineColor,
        weight: lineWeight,
        opacity: lineOpacity,
        dashArray,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layerGroup);

      if (isSelected) {
        polyline.bringToFront();
      }

      polyline.on('click', () => {
        onSelectPort(alt.portId);
      });

      // Corridor popup
      const deltaText =
        alt.deltaVsSelectedPortUsd === 0
          ? 'Benchmark Target'
          : alt.deltaVsSelectedPortUsd < 0
          ? `-$${Math.abs(alt.deltaVsSelectedPortUsd).toFixed(2)}/t vs target`
          : `+$${alt.deltaVsSelectedPortUsd.toFixed(2)}/t vs target`;

      polyline.bindPopup(`
        <div class="p-2 text-slate-800 text-xs min-w-[240px]">
          <div class="flex items-center justify-between border-b border-slate-200 pb-1">
            <span class="font-bold text-xs text-slate-900">${originPort.name.split(' ')[0]} → ${port.name}</span>
            <span class="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold">
              ${isSelected ? 'ACTIVE SELECTION' : isTarget ? 'RECOMMENDED' : 'ALTERNATIVE'}
            </span>
          </div>
          <div class="mt-2 space-y-1 text-[11px]">
            <div><span class="font-semibold text-slate-700">Modelled Nautical Corridor:</span> Indicative deep-sea transit</div>
            <div><span class="font-semibold text-slate-700">Distance:</span> ${alt.seaDistanceNm.toLocaleString()} NM</div>
            <div><span class="font-semibold text-slate-700">Sea Time:</span> ~${alt.seaDays} days (@ ${recommendedVessel.speedKnots} kts)</div>
            <div><span class="font-semibold text-slate-700">Total Landed Cost:</span> $${alt.totalLandedCostPerTonneUsd.toFixed(2)} / t (${deltaText})</div>
            <div><span class="font-semibold text-slate-700">Physical Feasibility:</span> ${
              alt.isFeasible
                ? '<span class="text-emerald-700 font-bold">Feasible</span>'
                : `<span class="text-red-600 font-bold">Restricted (Draft ${alt.draftLimit}m < Vessel ${recommendedVessel.draft}m)</span>`
            }</div>
          </div>
          <div class="mt-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
            * Modelled Maritime Corridor via Timor Sea & Lombok Strait. Not a live AIS track.
          </div>
        </div>
      `);
    });

    // 3. Port Destination Markers
    alternativePorts.forEach((alt) => {
      const port = alt.port;
      if (!port || typeof port.latitude !== 'number' || typeof port.longitude !== 'number') return;

      const isSelected = alt.portId === selectedPortId;
      const isTarget = alt.portId === destinationPort.id;
      const isDraftViolated = recommendedVessel.draft > alt.draftLimit;

      let markerBg = 'bg-slate-700';
      let markerBorder = 'border-slate-300';
      let iconSymbol = '⚓';
      let labelBadge = '';

      if (isTarget) {
        markerBg = 'bg-cyan-600';
        markerBorder = 'border-white';
        iconSymbol = '🎯';
        labelBadge = '<span class="ml-1 text-[8px] px-1 py-0.2 rounded bg-cyan-500 text-white font-bold">TARGET</span>';
      } else if (isDraftViolated) {
        markerBg = 'bg-rose-600';
        markerBorder = 'border-rose-200';
        iconSymbol = '⚠️';
        labelBadge = '<span class="ml-1 text-[8px] px-1 py-0.2 rounded bg-rose-500 text-white font-bold">RESTRICTED</span>';
      } else if (isSelected) {
        markerBg = 'bg-emerald-600';
        markerBorder = 'border-emerald-200';
        iconSymbol = '⚓';
      } else {
        markerBg = 'bg-indigo-600';
        markerBorder = 'border-indigo-200';
        iconSymbol = '⚓';
      }

      const portIcon = L.divIcon({
        className: 'bg-transparent border-0',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" style="width: ${isSelected ? 42 : 34}px; height: ${isSelected ? 42 : 34}px;">
            ${isSelected ? '<div class="absolute -inset-1.5 rounded-full bg-amber-400/40 animate-ping"></div>' : ''}
            ${isTarget && !isSelected ? '<div class="absolute -inset-1 rounded-full bg-cyan-400/30 animate-pulse"></div>' : ''}
            <div class="${isSelected ? 'w-9 h-9' : 'w-7 h-7'} rounded-full ${markerBg} border-2 ${isSelected ? 'border-amber-300 ring-2 ring-amber-400/50' : markerBorder} shadow-xl flex items-center justify-center text-white font-bold text-xs transition-transform hover:scale-110">
              ${iconSymbol}
            </div>
            <div class="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded ${
              isSelected
                ? 'bg-amber-950 text-amber-200 border border-amber-500 font-bold'
                : isTarget
                ? 'bg-cyan-950 text-cyan-200 border border-cyan-700 font-semibold'
                : isDraftViolated
                ? 'bg-rose-950 text-rose-200 border border-rose-700'
                : 'bg-slate-900/90 text-slate-200 border border-slate-700'
            } text-[10px] shadow-md pointer-events-none z-10">
              ${port.name} ${labelBadge}
            </div>
          </div>
        `,
        iconSize: [isSelected ? 42 : 34, isSelected ? 42 : 34],
        iconAnchor: [isSelected ? 21 : 17, isSelected ? 21 : 17],
      });

      const portMarker = L.marker([port.latitude, port.longitude], {
        icon: portIcon,
        zIndexOffset: isSelected ? 1000 : isTarget ? 800 : 500,
      }).addTo(layerGroup);

      portMarker.on('click', () => {
        onSelectPort(alt.portId);
      });

      const deltaText =
        alt.deltaVsSelectedPortUsd === 0
          ? 'Baseline (Target)'
          : alt.deltaVsSelectedPortUsd < 0
          ? `-$${Math.abs(alt.deltaVsSelectedPortUsd).toFixed(2)}/t vs target (Cheaper)`
          : `+$${alt.deltaVsSelectedPortUsd.toFixed(2)}/t vs target (More expensive)`;

      portMarker.bindPopup(`
        <div class="p-2.5 text-slate-800 text-xs min-w-[260px] max-w-[300px]">
          <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <div>
              <span class="font-extrabold text-sm text-slate-900">${port.name}</span>
              <div class="text-[10px] text-slate-500">${alt.portId.toUpperCase()} • ${port.country}</div>
            </div>
            <span class="text-[9px] px-1.5 py-0.5 rounded font-bold ${
              isTarget
                ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                : isDraftViolated
                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }">
              ${isTarget ? 'TARGET PORT' : isDraftViolated ? 'DRAFT RESTRICTED' : 'FEASIBLE OPTION'}
            </span>
          </div>

          <div class="mt-2.5 space-y-1.5 text-[11px]">
            <div class="flex justify-between">
              <span class="text-slate-600">Modelled Route:</span>
              <span class="font-mono font-semibold text-slate-900">${originPort.name.split(' ')[0]} → ${port.name.split(' ')[0]}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Sea Distance & Time:</span>
              <span class="font-mono font-semibold text-slate-900">${alt.seaDistanceNm.toLocaleString()} NM • ${alt.seaDays}d</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Permissible Draft:</span>
              <span class="font-mono ${isDraftViolated ? 'text-rose-600 font-bold' : 'text-slate-900 font-semibold'}">
                ${alt.draftLimit}m (Vessel: ${recommendedVessel.draft}m)
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Expected Waiting Queue:</span>
              <span class="font-mono text-slate-900">${alt.expectedWaitingDays} days (${port.waitingVesselsCount} vessels)</span>
            </div>
            <div class="flex justify-between border-t border-slate-200 pt-1">
              <span class="text-slate-600">Total Landed Cost:</span>
              <span class="font-mono font-bold text-slate-900">$${alt.totalLandedCostPerTonneUsd.toFixed(2)}/t</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Cost Delta:</span>
              <span class="font-mono font-semibold ${alt.deltaVsSelectedPortUsd <= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                ${deltaText}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Inland Rail to Mills:</span>
              <span class="font-mono text-slate-900">$${alt.inlandRailFreightUsd.toFixed(2)}/t</span>
            </div>
          </div>

          <div class="mt-2.5 p-1.5 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-700 leading-snug">
            <span class="font-semibold text-slate-800">Verdict:</span> ${alt.recommendationReason}
          </div>

          <div class="mt-2 text-[10px] text-slate-400 italic">
            * Hydrographic Coordinates: WGS-84 • Modelled maritime corridor
          </div>
        </div>
      `);
    });
  }, [originPort, destinationPort, alternativePorts, recommendedVessel, selectedPortId, onSelectPort]);

  // Viewport Presets
  const handleViewPreset = (preset: 'corridor' | 'india' | 'origin') => {
    setMapViewMode(preset);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (preset === 'corridor') {
      // Fit full international corridor: Australia to India
      const bounds = L.latLngBounds([
        [originPort.latitude - 3, originPort.longitude + 3],
        [23.0, 80.0],
      ]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
    } else if (preset === 'india') {
      // Zoom into Indian East Coast cluster (Dhamra, Paradip, Vizag, Haldia)
      map.flyTo([19.8, 85.8], 6.5, { duration: 1.2 });
    } else if (preset === 'origin') {
      // Focus Hay Point origin
      map.flyTo([originPort.latitude, originPort.longitude], 7, { duration: 1.2 });
    }
  };

  const selectedAlt = alternativePorts.find((p) => p.portId === selectedPortId) || alternativePorts[0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Top Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/40">
            <Compass className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Geographic Maritime Corridor & Port Arbitrage Map</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 font-mono">
                LEAFLET + OSM
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Interactive nautical basemap showing the origin terminal ({originPort.name}) and all supported Indian East Coast alternative ports.
            </p>
          </div>
        </div>

        {/* Viewport Preset Buttons */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 text-[11px] mr-1 hidden sm:inline">Camera Preset:</span>
          <button
            onClick={() => handleViewPreset('corridor')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
              mapViewMode === 'corridor'
                ? 'bg-cyan-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Full Corridor
          </button>
          <button
            onClick={() => handleViewPreset('india')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
              mapViewMode === 'india'
                ? 'bg-cyan-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            India East Coast
          </button>
          <button
            onClick={() => handleViewPreset('origin')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
              mapViewMode === 'origin'
                ? 'bg-cyan-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Hay Point (Origin)
          </button>
        </div>
      </div>

      {/* Real Interactive Map Canvas */}
      <div className="relative w-full h-[460px] sm:h-[500px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Provenance & Legend Card */}
        <div className="absolute bottom-3 left-3 z-[400] max-w-[340px] bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 shadow-2xl space-y-2 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Map Provenance & Legend</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300 font-mono">
              WGS-84
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
              <span>Origin (Hay Point)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 border border-white" />
              <span>Target (Dhamra)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white" />
              <span>Feasible Alternative</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white" />
              <span>Draft Restricted</span>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-1.5 space-y-1 text-[10px] text-slate-400 leading-tight">
            <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
              <span className="w-4 h-0.5 bg-cyan-400 inline-block" />
              <span>Modelled Maritime Corridor</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Corridor traces deep-draft open ocean waypoints via Timor Sea & Lombok Strait. Does NOT claim to be real-time live AIS trajectory.
            </p>
          </div>
        </div>

        {/* Floating Active Selection Badge (top right) */}
        {selectedAlt && (
          <div className="absolute top-3 right-3 z-[400] bg-slate-950/90 backdrop-blur-md border border-cyan-800/60 rounded-xl p-3 text-xs shadow-2xl max-w-[280px] pointer-events-auto">
            <div className="text-[10px] font-bold uppercase text-cyan-400 tracking-wider flex items-center justify-between">
              <span>Active Route View</span>
              <span className="font-mono text-slate-400">{selectedAlt.portId.toUpperCase()}</span>
            </div>
            <div className="font-bold text-white text-sm mt-0.5">{selectedAlt.portName}</div>
            <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] font-mono">
              <div className="text-slate-400">Distance: <span className="text-white font-semibold">{selectedAlt.seaDistanceNm.toLocaleString()} NM</span></div>
              <div className="text-slate-400">Sea Days: <span className="text-white font-semibold">{selectedAlt.seaDays}d</span></div>
              <div className="text-slate-400">Landed Cost: <span className="text-cyan-300 font-bold">${selectedAlt.totalLandedCostPerTonneUsd.toFixed(2)}/t</span></div>
              <div className="text-slate-400">Queue: <span className="text-amber-300">{selectedAlt.expectedWaitingDays}d</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Port Detailed Comparison Strip */}
      {selectedAlt && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300">
                Selected for Arbitrage Analysis
              </span>
              {selectedAlt.portId === destinationPort.id ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold">
                  PRIMARY TARGET
                </span>
              ) : selectedAlt.isFeasible ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">
                  FEASIBLE BACKUP
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 border border-rose-700 text-rose-300 font-bold">
                  DRAFT RESTRICTED
                </span>
              )}
            </div>
            <h4 className="text-base font-extrabold text-white mt-1">
              {selectedAlt.portName} ({selectedAlt.port?.country})
            </h4>
            <p className="text-slate-300 text-xs">
              {selectedAlt.recommendationReason}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-right">
              <div className="text-[10px] text-slate-400">Total Landed Cost</div>
              <div className="text-sm font-bold font-mono text-white">
                ${selectedAlt.totalLandedCostPerTonneUsd.toFixed(2)} / t
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-right">
              <div className="text-[10px] text-slate-400">Delta vs Target</div>
              <div className={`text-sm font-bold font-mono ${
                selectedAlt.deltaVsSelectedPortUsd === 0
                  ? 'text-slate-400'
                  : selectedAlt.deltaVsSelectedPortUsd < 0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}>
                {selectedAlt.deltaVsSelectedPortUsd === 0
                  ? 'Baseline'
                  : selectedAlt.deltaVsSelectedPortUsd < 0
                  ? `-$${Math.abs(selectedAlt.deltaVsSelectedPortUsd).toFixed(2)}/t`
                  : `+$${selectedAlt.deltaVsSelectedPortUsd.toFixed(2)}/t`}
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-right">
              <div className="text-[10px] text-slate-400">Inland Rail to Mills</div>
              <div className="text-sm font-bold font-mono text-indigo-300">
                ${selectedAlt.inlandRailFreightUsd.toFixed(2)} / t
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { AlertTriangle, LoaderCircle } from "lucide-react";

type MapSurfaceProps = { theme: "dark" | "light" };

export function MapSurface({ theme }: MapSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("ready");

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const configuredStyle = theme === "dark" ? import.meta.env.VITE_MAP_STYLE_DARK : import.meta.env.VITE_MAP_STYLE_LIGHT;
    const rasterStyle: StyleSpecification = {
      version: 8,
      sources: {
        openstreetmap: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [{ id: "openstreetmap", type: "raster", source: "openstreetmap" }],
    };
    const style = configuredStyle || rasterStyle;
    const timeout = window.setTimeout(() => { if (!cancelled) setState("error"); }, 12_000);

    void import("maplibre-gl").then(({ Map, NavigationControl }) => {
      if (cancelled || !containerRef.current) return;
      const map = new Map({
        container: containerRef.current,
        style,
        center: [-24, 2],
        zoom: 1.55,
        minZoom: 1,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: true }), "bottom-right");
      map.once("style.load", () => { window.clearTimeout(timeout); if (!cancelled) setState("ready"); });
      mapRef.current = map;
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; window.clearTimeout(timeout); mapRef.current?.remove(); mapRef.current = null; };
  }, [theme]);

  return (
    <div className="map-canvas" aria-label="Mapa mundial das importações">
      <div ref={containerRef} className="maplibre-host" />
      {state === "loading" && <div className="map-loading"><LoaderCircle className="spinning" size={15} /> Carregando mapa seguro</div>}
      {state === "error" && <div className="map-empty-state"><AlertTriangle size={18} /><strong>Mapa indisponível</strong><span>Verifique a rede ou configure outro provedor de tiles.</span></div>}
      {state === "ready" && <div className="map-empty-state blueprint-empty"><strong>Nenhuma posição comprovada</strong><span>Os navios aparecerão somente após o rastreamento validar coordenadas e evidências.</span></div>}
    </div>
  );
}

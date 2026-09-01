import { useEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

export type MapLayerStyle = 'positron' | 'bright' | 'dark' | 'liberty'

export interface MapFilters {
  stage?: string | 'ALL'
  channel?: string | 'ALL'
  search?: string
}
interface MapSurfaceProps {
  mapStyle?: MapLayerStyle
  showGrid?: boolean
  showLegends?: boolean
  filters?: MapFilters
  onRefresh?: () => void
  lastRefreshedAt?: Date | null
  syncStatusMessage?: string | null
}

function getMapStyleUrl(layer: MapLayerStyle): string {
  switch (layer) {
    case 'dark':
      return 'https://tiles.openfreemap.org/styles/dark'
    case 'bright':
      return 'https://tiles.openfreemap.org/styles/bright'
    case 'liberty':
      return 'https://tiles.openfreemap.org/styles/liberty'
    case 'positron':
    default:
      return 'https://tiles.openfreemap.org/styles/positron'
  }
}

export function MapSurface({
  mapStyle = 'positron',
  showGrid = true,
  filters,
  lastRefreshedAt,
  syncStatusMessage,
}: MapSurfaceProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<import('maplibre-gl').Map | null>(null)
  const [mapUnavailable, setMapUnavailable] = useState(false)

  useEffect(() => {
    if (!mapContainer.current) return
    let disposed = false

    import('maplibre-gl')
      .then((maplibregl) => {
        if (disposed || !mapContainer.current) return
        const map = new maplibregl.Map({
          container: mapContainer.current,
          style: getMapStyleUrl(mapStyle),
          center: [-22, 9],
          zoom: 1.4,
          attributionControl: false,
          interactive: true,
        })
        mapInstance.current = map
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
        map.on('error', () => setMapUnavailable(true))
      })
      .catch(() => setMapUnavailable(true))

    return () => {
      disposed = true
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [mapStyle])

  const hasActiveFilters = Boolean(
    (filters?.stage && filters.stage !== 'ALL') ||
    (filters?.channel && filters.channel !== 'ALL') ||
    (filters?.search && filters.search.trim().length > 0),
  )

  return (
    <div
      className={`map-surface ${showGrid ? 'has-grid' : 'no-grid'}`}
      aria-label="Mapa operacional sem posições validadas"
    >
      <div ref={mapContainer} className="maplibre-host" />
      {mapUnavailable && <div className="map-fallback" aria-hidden="true" />}
      <div className="map-empty" role="status">
        <strong>Nenhuma posição comprovada</strong>
        <span>
          {hasActiveFilters
            ? 'Filtros aplicados. Os navios aparecerão somente após o rastreamento validar coordenadas e evidências.'
            : 'Os navios aparecerão somente após o rastreamento validar coordenadas e evidências.'}
        </span>
        {lastRefreshedAt && (
          <small className="last-sync-tag" aria-live="polite">
            Última verificação: {lastRefreshedAt.toLocaleTimeString('pt-BR')}
          </small>
        )}
        {syncStatusMessage && (
          <small className="sync-status-notice" aria-live="polite">
            {syncStatusMessage}
          </small>
        )}
      </div>
    </div>
  )
}

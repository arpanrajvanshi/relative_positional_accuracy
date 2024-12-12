import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Define custom icons
const redIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  iconSize: [32, 32],
});

const yellowIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
  iconSize: [32, 32],
});

// Component to fit bounds of markers on the map
const FitBounds = ({ positions }) => {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds);
    }
  }, [positions, map]);

  return null;
};

const MapComponent = ({ dataToSave, excludeOutliers }) => {
  // Collect all unique positions for markers, track if they are involved in outliers
  const positionsMap = {};

  dataToSave.forEach(d => {
    // Initialize positions if they don't exist
    if (!positionsMap[d.point_i]) {
      positionsMap[d.point_i] = { lat: d.lat_i, lon: d.lon_i, isOutlier: false };
    }
    if (!positionsMap[d.point_j]) {
      positionsMap[d.point_j] = { lat: d.lat_j, lon: d.lon_j, isOutlier: false };
    }
    // Mark points as outliers if involved in outlier distances
    if (d.isOutlier) {
      positionsMap[d.point_i].isOutlier = true;
      positionsMap[d.point_j].isOutlier = true;
    }
  });

  const positionsToDisplay = Object.entries(positionsMap).map(([pointId, pos]) => ({
    pointId,
    ...pos,
  }));

  const positions = positionsToDisplay.map(p => [p.lat, p.lon]);

  // Mean position for centering the map
  let meanPosition = [0, 0];
  if (positions.length > 0) {
    meanPosition = [
      positions.reduce((sum, pos) => sum + pos[0], 0) / positions.length,
      positions.reduce((sum, pos) => sum + pos[1], 0) / positions.length,
    ];
  }

  return (
    <div className="map-wrapper">
      <MapContainer
        center={meanPosition}
        zoom={13}
        style={{ height: '500px', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <FitBounds positions={positions} />

        {/* Markers for points */}
        {positionsToDisplay.map((pos) => (
          <Marker
            key={pos.pointId}
            position={[pos.lat, pos.lon]}
            icon={excludeOutliers && pos.isOutlier ? yellowIcon : redIcon}
          >
            <Tooltip>
              Point {pos.pointId}
              <br />
              Latitude: {pos.lat}
              <br />
              Longitude: {pos.lon}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="legend">
        <h3>Legend</h3>
        <div className="legend-item">
          <img src="https://maps.google.com/mapfiles/ms/icons/red-dot.png" alt="Red Dot" />
          <span>Normal Points</span>
        </div>
        <div className="legend-item">
          <img src="https://maps.google.com/mapfiles/ms/icons/yellow-dot.png" alt="Yellow Dot" />
          <span>Outlier Points</span>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import SearchBar from './SearchBar'; // Adjust the path based on your project structure

// Fix default marker icons
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const Maps = () => {
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef(null); // Reference to the map instance

  // API base URL from .env file
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // Fetch recent locations or search by visitor name
  const fetchLiveLocations = useCallback(
    async (search = '') => {
      setIsLoading(true);
      try {
        const endpoint = search
          ? `${API_BASE_URL}/locations/search`
          : `${API_BASE_URL}/locations/recent`;
        const params = search ? { name: search } : {};
        const response = await axios.get(endpoint, { params, withCredentials: true });

        setLocations(response.data || []);
        setError(null);

        // If searchQuery is provided, focus on the first matching location
        if (search && response.data.length > 0) {
          const { latitude, longitude } = response.data[0];
          mapRef.current?.flyTo([latitude, longitude], 15); // Fly to the user's location
        }
      } catch (err) {
        setError(`Error: ${err.response?.data || 'Unable to fetch locations'}`);
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE_URL]
  );

  const handleSearch = () => {
    fetchLiveLocations(searchQuery);
  };

  useEffect(() => {
    // Initial fetch
    fetchLiveLocations();

    // Set interval to fetch live locations every 10 seconds
    const interval = setInterval(() => {
      fetchLiveLocations();
    }, 10000); // 10 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [fetchLiveLocations]);

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {isLoading && <div className="loading">Loading...</div>}
      <SearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
      />
      <MapContainer
  center={[30.3753, 69.3451]} // Center on Pakistan
  zoom={6}
  style={{ height: '100%', width: '100%' }}
  whenCreated={(mapInstance) => {
    mapRef.current = mapInstance; // Save the map instance to ref
  }}
>
  <TileLayer
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution="&copy; OpenStreetMap contributors"
  />
  {locations.map((loc, index) => {
    // Extract visitor information with fallbacks
    const visitorName = loc.visitor?.name || `Visitor ${loc.visitor?.visitorId || 'Unknown'}`;
    const timestamp = loc.timestamp ? new Date(loc.timestamp).toLocaleString() : 'Unknown';

    // Debugging: log each location data
    console.log('Location Data:', loc);

    return (
      <Marker
        key={index}
        position={[loc.latitude, loc.longitude]}
        icon={new L.Icon.Default()}
      >
        <Popup>
          <strong>{visitorName}</strong>
          <br />
          <br />
          Last updated: {timestamp}
        </Popup>
      </Marker>
    );
  })}
</MapContainer>

    </div>
  );
};

export default Maps;

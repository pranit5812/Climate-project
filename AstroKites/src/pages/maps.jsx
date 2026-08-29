import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./maps.css";
import { postCheckDate } from "../api/axios";


// ✅ Fix marker icon in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const EnglishCountryMap = () => {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [checkResult, setCheckResult] = useState(null);
  const markerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [numDays, setNumDays] = useState(30);
  

  const reverseGeocode = async (lat, lng) => {
    try {
      setLoadingLocation(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`
      );
      const data = await response.json();
      
      const address = data.address || {};
      const name = address.city || address.town || address.village || 
                   address.county || address.state || address.country || 
                   data.display_name || "Unknown Location";
      
      return name;
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return "Unknown Location";
    } finally {
      setLoadingLocation(false);
    }
  };

  const MapClickHandler = () => {
    useMapEvents({
      click: async (e) => {
        const lat = e.latlng.lat.toFixed(5);
        const lng = e.latlng.lng.toFixed(5);
        
        const locationName = await reverseGeocode(lat, lng);
        
        setSelectedFeature({
          name: locationName,
          lat,
          lng,
        });
        setCheckResult(null);
      },
    });
    return null;
  };

  // Helper components for SVG charts
  const TemperatureChart = ({ predictions }) => {
    if (!predictions || predictions.length === 0) return null;
    const height = 130;
    const width = 560;
    const padding = 30;
    
    const temps = predictions.map(p => p.temperature_mean).filter(v => v !== null && !isNaN(v));
    if (temps.length === 0) return null;
    const minTemp = Math.floor(Math.min(...temps)) - 2;
    const maxTemp = Math.ceil(Math.max(...temps)) + 2;

    const points = predictions.map((p, idx) => {
      const x = padding + (idx / (predictions.length - 1 || 1)) * (width - 2 * padding);
      const val = p.temperature_mean !== null ? p.temperature_mean : minTemp;
      const y = height - padding - ((val - minTemp) / (maxTemp - minTemp || 1)) * (height - 2 * padding);
      return { x, y, temp: p.temperature_mean, date: p.date };
    });

    const pathD = points.reduce((acc, pt, i) => i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, "");

    return (
      <div style={{ marginTop: '14px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
          📈 Temperature Trend (°C)
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
          <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
          {points.map((pt, i) => (
            (i % Math.ceil(predictions.length / 6) === 0 || i === points.length - 1) && (
              <g key={i}>
                <circle cx={pt.x} cy={pt.y} r="3.5" fill="#f59e0b" />
                <text x={pt.x} y={pt.y - 7} fontSize="10" textAnchor="middle" fill="#78350f" fontWeight="600">
                  {pt.temp !== null ? `${pt.temp.toFixed(1)}°` : ''}
                </text>
                <text x={pt.x} y={height - 5} fontSize="9" textAnchor="middle" fill="#64748b">
                  {pt.date ? pt.date.slice(5) : ''}
                </text>
              </g>
            )
          ))}
        </svg>
      </div>
    );
  };

  const RainfallChart = ({ predictions }) => {
    if (!predictions || predictions.length === 0) return null;
    const height = 130;
    const width = 560;
    const padding = 30;
    
    const rains = predictions.map(p => p.rainfall_mean || 0);
    const maxRain = Math.max(Math.ceil(Math.max(...rains, 5)), 10);
    const barWidth = Math.max(3, (width - 2 * padding) / predictions.length - 2);

    return (
      <div style={{ marginTop: '14px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
          🌧️ Daily Rainfall (mm) & Rain Chance (%)
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
          {predictions.map((p, idx) => {
            const x = padding + (idx / (predictions.length - 1 || 1)) * (width - 2 * padding);
            const barH = ((p.rainfall_mean || 0) / maxRain) * (height - 2 * padding);
            const y = height - padding - barH;
            const probY = height - padding - ((p.rain_probability || 0) / 100) * (height - 2 * padding);
            return (
              <g key={idx}>
                <rect x={x - barWidth / 2} y={y} width={barWidth} height={barH} fill="#3b82f6" opacity="0.8" rx="1" />
                <circle cx={x} cy={probY} r="2.5" fill="#ef4444" />
                {(idx % Math.ceil(predictions.length / 6) === 0 || idx === predictions.length - 1) && (
                  <text x={x} y={height - 5} fontSize="9" textAnchor="middle" fill="#64748b">
                    {p.date ? p.date.slice(5) : ''}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const WindChart = ({ predictions }) => {
    if (!predictions || predictions.length === 0) return null;
    const height = 130;
    const width = 560;
    const padding = 30;

    const winds = predictions.map(p => p.wind_mean || 0);
    const maxWind = Math.max(Math.ceil(Math.max(...winds, 5)), 10);

    const points = predictions.map((p, idx) => {
      const x = padding + (idx / (predictions.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((p.wind_mean || 0) / maxWind) * (height - 2 * padding);
      return { x, y, wind: p.wind_mean, date: p.date };
    });

    const pathD = points.reduce((acc, pt, i) => i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, "");

    return (
      <div style={{ marginTop: '14px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
          💨 Wind Speed Trend (m/s)
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
          <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" />
          {points.map((pt, i) => (
            (i % Math.ceil(predictions.length / 6) === 0 || i === points.length - 1) && (
              <g key={i}>
                <circle cx={pt.x} cy={pt.y} r="3" fill="#10b981" />
                <text x={pt.x} y={pt.y - 6} fontSize="10" textAnchor="middle" fill="#065f46" fontWeight="600">
                  {pt.wind !== null ? `${pt.wind.toFixed(1)}` : ''}
                </text>
                <text x={pt.x} y={height - 5} fontSize="9" textAnchor="middle" fill="#64748b">
                  {pt.date ? pt.date.slice(5) : ''}
                </text>
              </g>
            )
          ))}
        </svg>
      </div>
    );
  };

  // ✅ Submit data
  const handleSubmit = async () => {
    if (!selectedFeature || !startDate || !numDays) {
      alert("Please fill all fields");
      return;
    }

    const selectedDate = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      alert("Start date cannot be in the past");
      return;
    }

    const days = parseInt(numDays);
    if (days < 1 || days > 90) {
      alert("Days must be between 1 and 90");
      return;
    }

    const formData = {
      location: {
        name: selectedFeature.name,
        latitude: parseFloat(selectedFeature.lat),
        longitude: parseFloat(selectedFeature.lng),
      },
      startDate,
      numDays: days,
    };

    console.log("Form Data:", formData);

    try {
      setLoading(true);
      const resp = await postCheckDate({
        lat: formData.location.latitude,
        lon: formData.location.longitude,
        date: startDate,
        ndays: days,
        window: 7,
      });
      if (resp.ok) {
        setCheckResult(resp.data || null);
        try {
          if (markerRef.current && markerRef.current.openPopup) {
            markerRef.current.openPopup();
          }
        } catch (_) {}
      } else {
        const msg = typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error);
        alert(`❌ Backend error (${resp.status}): ${msg}`);
      }
    } catch (e) {
      alert(`❌ Request failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (prob) => {
    if (prob === undefined || prob === null) return <span className="badge-risk" style={{ background: '#94a3b8' }}>N/A</span>;
    if (prob >= 60) return <span className="badge-risk badge-risk-high">{prob}% (High)</span>;
    if (prob >= 30) return <span className="badge-risk badge-risk-med">{prob}% (Med)</span>;
    return <span className="badge-risk badge-risk-low">{prob}% (Low)</span>;
  };

  const formatDateLabel = (isoDateStr) => {
    if (!isoDateStr) return '';
    const d = new Date(isoDateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="maps-container">
      <div className="map-wrapper">
        <MapContainer
          style={{ height: "100%", width: "100%" }}
          zoom={selectedFeature ? 8 : 3}
          center={selectedFeature ? [selectedFeature.lat, selectedFeature.lng] : [20, 0]}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TileLayer
            attribution='Tiles &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            opacity={0.6}
          />

          <MapClickHandler />

          {selectedFeature && (
            <Marker ref={markerRef} position={[selectedFeature.lat, selectedFeature.lng]}>
              <Popup maxWidth={680}>
                <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: '700', 
                    color: '#667eea',
                    marginBottom: '8px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid rgba(102, 126, 234, 0.2)'
                  }}>
                    📍 {selectedFeature.name}
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px', 
                    marginBottom: '12px',
                    fontSize: '12px',
                    color: '#475569',
                    background: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: '8px'
                  }}>
                    <div><strong>Coordinates:</strong> {parseFloat(selectedFeature.lat).toFixed(4)}°, {parseFloat(selectedFeature.lng).toFixed(4)}°</div>
                    <div><strong>Period:</strong> {checkResult?.start_date || startDate} → {checkResult?.end_date || 'N/A'} ({checkResult?.days || numDays} Days)</div>
                  </div>

                  {loading && (
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '16px',
                      textAlign: 'center',
                      background: 'rgba(102, 126, 234, 0.1)',
                      borderRadius: '10px',
                      color: '#667eea',
                      fontWeight: '600'
                    }}>
                      ⏳ Calculating {numDays}-Day Weather Outlook...
                    </div>
                  )}

                  {!loading && checkResult && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ 
                        fontWeight: '700', 
                        fontSize: '16px',
                        marginBottom: '12px',
                        color: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>🌦️ {checkResult?.days || numDays}-Day Weather Outlook</span>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                          Confidence: {Math.round((checkResult.summary_metrics?.overall_confidence || 0.85) * 100)}%
                        </span>
                      </div>

                      {/* Summary Cards */}
                      {checkResult.summary_metrics && (
                        <div className="outlook-summary-grid">
                          <div className="outlook-card">
                            <div className="outlook-card-title">🌡️ Temperature</div>
                            <div className="outlook-card-value">
                              {checkResult.summary_metrics.temp_avg !== null ? `${checkResult.summary_metrics.temp_avg}°C` : 'N/A'}
                            </div>
                            <div className="outlook-card-sub">
                              Range: {checkResult.summary_metrics.temp_min}° - {checkResult.summary_metrics.temp_max}°C
                            </div>
                          </div>

                          <div className="outlook-card">
                            <div className="outlook-card-title">💧 Rainfall</div>
                            <div className="outlook-card-value">
                              {checkResult.summary_metrics.rain_avg_daily !== null ? `${checkResult.summary_metrics.rain_avg_daily} mm/d` : 'N/A'}
                            </div>
                            <div className="outlook-card-sub">
                              Total: {checkResult.summary_metrics.rain_total_expected} mm ({checkResult.summary_metrics.rain_days_count} rainy days)
                            </div>
                          </div>

                          <div className="outlook-card">
                            <div className="outlook-card-title">💨 Wind Speed</div>
                            <div className="outlook-card-value">
                              {checkResult.summary_metrics.wind_avg !== null ? `${checkResult.summary_metrics.wind_avg} m/s` : 'N/A'}
                            </div>
                            <div className="outlook-card-sub">
                              Max Speed: {checkResult.summary_metrics.wind_max} m/s
                            </div>
                          </div>

                          <div className="outlook-card">
                            <div className="outlook-card-title">🎯 Outlook Score</div>
                            <div className="outlook-card-value" style={{ color: '#10b981' }}>
                              {Math.round((checkResult.summary_metrics?.overall_confidence || 0.85) * 100)}%
                            </div>
                            <div className="outlook-card-sub">
                              Climatology Model
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interactive Charts */}
                      {checkResult.daily_predictions && (
                        <div>
                          <TemperatureChart predictions={checkResult.daily_predictions} />
                          <RainfallChart predictions={checkResult.daily_predictions} />
                          <WindChart predictions={checkResult.daily_predictions} />

                          {/* Scrollable Table */}
                          <div style={{ marginTop: '16px', fontWeight: '700', fontSize: '14px', color: '#1e293b', marginBottom: '6px' }}>
                            📅 Daily Predictions ({checkResult.daily_predictions.length} Days)
                          </div>
                          
                          <div className="outlook-table-wrapper">
                            <table className="outlook-table">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Temp (Mean)</th>
                                  <th>Rain (mm)</th>
                                  <th>Rain Chance</th>
                                  <th>Wind (m/s)</th>
                                  <th>Wind Chance</th>
                                  <th>Confidence</th>
                                </tr>
                              </thead>
                              <tbody>
                                {checkResult.daily_predictions.map((day, idx) => (
                                  <tr key={idx}>
                                    <td style={{ fontWeight: '600' }}>{formatDateLabel(day.date)}</td>
                                    <td>
                                      {day.temperature_mean !== null ? `${day.temperature_mean.toFixed(1)}°C` : 'N/A'}
                                      <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '4px' }}>
                                        ({day.temperature_min}° - {day.temperature_max}°)
                                      </span>
                                    </td>
                                    <td>{day.rainfall_mean !== null ? `${day.rainfall_mean.toFixed(2)}` : 'N/A'}</td>
                                    <td>{getRiskBadge(day.rain_probability)}</td>
                                    <td>
                                      {day.wind_mean !== null ? `${day.wind_mean.toFixed(2)}` : 'N/A'}
                                      <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '4px' }}>
                                        ({(day.wind_mean * 3.6).toFixed(1)} km/h)
                                      </span>
                                    </td>
                                    <td>{getRiskBadge(day.windy_probability)}</td>
                                    <td style={{ fontWeight: '600', color: '#059669' }}>
                                      {Math.round(day.confidence * 100)}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        <div className="map-overlay">

          <div className="form-overlay">
            <h3 className="form-title">🌍 Weather Prediction</h3>
            <p className="form-subtitle">Click anywhere on the map to select a location</p>
            <div className="form-group">
              <label>📅 Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="form-group">
              <label>📊 Number of Days</label>
              <input
                type="number"
                value={numDays}
                onChange={(e) => setNumDays(e.target.value)}
                min="1"
                max="30"
                placeholder="Enter days (1-30)"
              />
            </div>
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={!selectedFeature || !startDate || !numDays || loading}
            >
              {loading ? '⏳ Loading Prediction...' : '🚀 Get Weather Forecast'}
            </button>
          </div>

          {selectedFeature && (
            <div className="info-card">
              <div className="info-header">
                <h4>📍 Selected Location</h4>
                {loadingLocation && <span className="loading-badge">Loading...</span>}
              </div>
              
              {checkResult && checkResult.details && (
                <div className="summary-line">
                  {(() => {
                    const d = checkResult.details;
                    const temp = Number(d['Temp_mean_degC']);
                    const rain = Number(d['Prob_rain_>=5.0mm']) || 0;
                    const hot = Number(d['Prob_hot_>35.0C']) || 0;
                    const cold = Number(d['Prob_cold_<5.0C']) || 0;
                    const getRisk = (p) => {
                      if (p >= 0.6) return 'High';
                      if (p >= 0.3) return 'Medium';
                      return 'Low';
                    };
                    const tempStr = (!isNaN(temp) && temp !== null) ? temp.toFixed(1) + '°C' : 'N/A';
                    const condition = hot >= 0.3 ? 'Hot' : cold >= 0.3 ? 'Cold' : 'Moderate';
                    return `${tempStr} | Rain: ${getRisk(rain)} | ${condition}`;
                  })()}
                </div>
              )}
              
              <div className="info-content">
                <div className="info-row">
                  <span className="info-label">Location:</span>
                  <span className="info-value">{selectedFeature.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Latitude:</span>
                  <span className="info-value">{parseFloat(selectedFeature.lat).toFixed(5)}°</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Longitude:</span>
                  <span className="info-value">{parseFloat(selectedFeature.lng).toFixed(5)}°</span>
                </div>
                {startDate && (
                  <div className="info-row">
                    <span className="info-label">Start Date:</span>
                    <span className="info-value">{startDate}</span>
                  </div>
                )}
                {numDays && (
                  <div className="info-row">
                    <span className="info-label">Duration:</span>
                    <span className="info-value">{numDays} days</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnglishCountryMap;

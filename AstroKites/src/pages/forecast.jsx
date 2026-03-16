import React, { useEffect, useMemo, useState } from "react";
import "./forecast.css";
import { postPowerData, postStateSevenDayForecast, postSendSms } from "../api/axios";

// --- CONFIG ---
const PARAMETERS = ["T2M", "PRECTOT", "WS2M"]; // Temperature (°C), Precipitation (mm/day), Wind speed (m/s)
// Countries and states with lat/lon data
const COUNTRIES_DATA = [
  {
    name: "India",
    states: [
      { name: "Andhra Pradesh", cities: [{ name: "Visakhapatnam", lat: 17.6868, lon: 83.2185 }] },
      { name: "Arunachal Pradesh", cities: [{ name: "Itanagar", lat: 27.0844, lon: 93.6053 }] },
      { name: "Assam", cities: [{ name: "Guwahati", lat: 26.1445, lon: 91.7362 }] },
      { name: "Bihar", cities: [{ name: "Patna", lat: 25.5941, lon: 85.1376 }] },
      { name: "Chhattisgarh", cities: [{ name: "Raipur", lat: 21.2514, lon: 81.6296 }] },
      { name: "Delhi", cities: [{ name: "New Delhi", lat: 28.6139, lon: 77.2090 }] },
      { name: "Goa", cities: [{ name: "Panaji", lat: 15.4909, lon: 73.8278 }] },
      { name: "Gujarat", cities: [{ name: "Ahmedabad", lat: 23.0225, lon: 72.5714 }] },
      { name: "Haryana", cities: [{ name: "Chandigarh", lat: 30.7333, lon: 76.7794 }] },
      { name: "Himachal Pradesh", cities: [{ name: "Shimla", lat: 31.1048, lon: 77.1734 }] },
      { name: "Jharkhand", cities: [{ name: "Ranchi", lat: 23.3441, lon: 85.3096 }] },
      { name: "Karnataka", cities: [{ name: "Bangalore", lat: 12.9716, lon: 77.5946 }] },
      { name: "Kerala", cities: [{ name: "Thiruvananthapuram", lat: 8.5241, lon: 76.9366 }] },
      { name: "Madhya Pradesh", cities: [{ name: "Bhopal", lat: 23.2599, lon: 77.4126 }] },
      { name: "Maharashtra", cities: [{ name: "Mumbai", lat: 19.0760, lon: 72.8777 }] },
      { name: "Manipur", cities: [{ name: "Imphal", lat: 24.8170, lon: 93.9368 }] },
      { name: "Meghalaya", cities: [{ name: "Shillong", lat: 25.5788, lon: 91.8933 }] },
      { name: "Mizoram", cities: [{ name: "Aizawl", lat: 23.7271, lon: 92.7176 }] },
      { name: "Nagaland", cities: [{ name: "Kohima", lat: 25.6747, lon: 94.1086 }] },
      { name: "Odisha", cities: [{ name: "Bhubaneswar", lat: 20.2961, lon: 85.8245 }] },
      { name: "Punjab", cities: [{ name: "Amritsar", lat: 31.6340, lon: 74.8723 }] },
      { name: "Rajasthan", cities: [{ name: "Jaipur", lat: 26.9124, lon: 75.7873 }] },
      { name: "Sikkim", cities: [{ name: "Gangtok", lat: 27.3389, lon: 88.6065 }] },
      { name: "Tamil Nadu", cities: [{ name: "Chennai", lat: 13.0827, lon: 80.2707 }] },
      { name: "Telangana", cities: [{ name: "Hyderabad", lat: 17.3850, lon: 78.4867 }] },
      { name: "Tripura", cities: [{ name: "Agartala", lat: 23.8315, lon: 91.2868 }] },
      { name: "Uttar Pradesh", cities: [{ name: "Lucknow", lat: 26.8467, lon: 80.9462 }] },
      { name: "Uttarakhand", cities: [{ name: "Dehradun", lat: 30.3165, lon: 78.0322 }] },
      { name: "West Bengal", cities: [{ name: "Kolkata", lat: 22.5726, lon: 88.3639 }] }
    ]
  }
];


const formatDate = (d) => d.toISOString().split("T")[0]; 

// Process the new data format from the API
// Helper function to get month name
  const getMonthName = (month, year = null, abbreviated = false) => {
    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const monthName = abbreviated ? shortMonthNames[month - 1] : monthNames[month - 1];
    return year !== null ? `${monthName} ${year.toString().slice(-2)}` : monthName;
  };

  const processApiData = (apiData) => {
  if (!apiData || !apiData.data) {
    console.log("No data available from API");
    return { 
      daily: [], 
      monthly: [],
      hasData: false,
      errorMessage: "No data available for the selected parameters and date range."
    };
  }
  
  const { data, available } = apiData;
  const result = { 
    daily: [], 
    monthly: [],
    hasData: false,
    errorMessage: null
  };
  
  // Check if we have any temperature data (main parameter)
  if (data.T2M && data.T2M.dates && data.T2M.dates.length > 0) {
    result.hasData = true;
    const dates = data.T2M.dates;
    
    // Create daily data objects
    result.daily = dates.map((date, index) => {
      const dailyObj = { date };
      
      // Add values for each parameter if available
      available.forEach(param => {
        if (data[param] && data[param].values && data[param].values[index] !== undefined) {
          // Convert wind speed from m/s to km/h if it's WS2M
          if (param === 'WS2M') {
            dailyObj.wind = data[param].values[index] * 3.6;
          } else if (param === 'T2M') {
            dailyObj.temp = data[param].values[index];
          } else if (param === 'PRECTOT') {
            dailyObj.precip = data[param].values[index];
          }
        } else {
          // Set explicit null values for missing data
          if (param === 'WS2M') {
            dailyObj.wind = null;
          } else if (param === 'T2M') {
            dailyObj.temp = null;
          } else if (param === 'PRECTOT') {
            dailyObj.precip = null;
          }
        }
      });
      
      return dailyObj;
    });
    
    // Calculate monthly aggregates
    const monthlyData = {};
    result.daily.forEach(day => {
      const date = new Date(day.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          monthName: monthName,
          year: date.getFullYear(),
          tempSum: 0, tempCount: 0,
          precipSum: 0, precipCount: 0,
          windSum: 0, windCount: 0
        };
      }
      
      if (day.temp !== undefined && day.temp !== null) {
        monthlyData[monthKey].tempSum += day.temp;
        monthlyData[monthKey].tempCount++;
      }
      
      if (day.precip !== undefined && day.precip !== null) {
        monthlyData[monthKey].precipSum += day.precip;
        monthlyData[monthKey].precipCount++;
      }
      
      if (day.wind !== undefined && day.wind !== null) {
        monthlyData[monthKey].windSum += day.wind;
        monthlyData[monthKey].windCount++;
      }
    });
    
    // Calculate means and create monthly array
    result.monthly = Object.values(monthlyData).map(m => ({
      month: m.month,
      monthName: getMonthName(parseInt(m.month.split('-')[1]), m.year, true), // Use abbreviated month with year
      year: m.year,
      meanTemp: m.tempCount ? m.tempSum / m.tempCount : null,
      meanPrecip: m.precipCount ? m.precipSum / m.precipCount : null,
      meanWind: m.windCount ? m.windSum / m.windCount : null,
      daysWithData: Math.max(m.tempCount, m.precipCount, m.windCount)
    })).sort((a, b) => {
      // Sort by year first, then by month
      if (a.year !== b.year) {
        return a.year - b.year;
      }
      return a.month.localeCompare(b.month);
    });
  } else {
    result.errorMessage = "No temperature data available for the selected date range.";
  }
  
  return result;
};

// Simple SVG line chart component (dependency-free)
const LineChart = ({ data = [], height = 140, stroke = "#2978b5", label, compact = false, labels = [], unit = "", showYearLabels = false }) => {
  // data: array of numbers
  // For compact mode, we use a fixed width and skip rendering some points for large datasets
  const isLargeDataset = data.length > 100;
  const width = compact ? 300 : Math.max(300, data.length * 60);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data</div>;
  }
  
  const validData = data.filter(d => d !== null && d !== undefined && !isNaN(d));
  
  if (validData.length === 0) {
    return <div className="chart-empty">No valid data</div>;
  }
  
  const max = Math.max(...validData);
  const min = Math.min(...validData);
  const range = Math.max(1, max - min);
  
  // For large datasets, we'll create a simplified representation
  let pointsToRender = data;
  let pointIndices = Array.from({ length: data.length }, (_, i) => i);
  
  if (compact && isLargeDataset) {
    // For compact view with large datasets, sample points to reduce visual clutter
    // Keep important points like min, max, first, last, and sample the rest
    const maxIndex = data.indexOf(max);
    const minIndex = data.indexOf(min);
    const importantIndices = new Set([0, data.length - 1, maxIndex, minIndex]);
    
    // Sample remaining points based on data size
    const sampleRate = Math.max(1, Math.floor(data.length / 50));
    const sampledIndices = [];
    
    for (let i = 0; i < data.length; i += sampleRate) {
      if (!importantIndices.has(i)) {
        sampledIndices.push(i);
      }
    }
    
    // Combine important and sampled indices
    pointIndices = [...importantIndices, ...sampledIndices].sort((a, b) => a - b);
    pointsToRender = pointIndices.map(i => data[i]);
  }
  
  // Generate points for the polyline
  const points = pointIndices
    .map((dataIndex) => {
      const value = data[dataIndex];
      if (value === null || value === undefined || isNaN(value)) return null;
      
      const i = compact && isLargeDataset ? pointIndices.indexOf(dataIndex) : dataIndex;
      const totalPoints = compact && isLargeDataset ? pointIndices.length - 1 : data.length - 1;
      const x = (i / (totalPoints || 1)) * (width - 24) + 12;
      const y = height - 30 - ((value - min) / range) * (height - 42);
      return `${x},${y}`;
    })
    .filter(point => point !== null)
    .join(" ");
  
  // Handle mouse events for tooltip
  const handleMouseEnter = (dataIndex, x, y, value) => {
    setHoveredPoint({
      dataIndex,
      x,
      y,
      value,
      label: labels[dataIndex] || `Point ${dataIndex + 1}`
    });
  };
  
  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Calculate positions for axis labels
  const getAxisLabelPositions = () => {
    if (!labels || labels.length === 0) return [];
    
    const totalPoints = compact && isLargeDataset ? pointIndices.length - 1 : data.length - 1;
    const positions = [];
    
    if (showYearLabels && labels.length > 12) {
      // For year/month data spanning multiple years, show strategic labels
      const yearChanges = [];
      let currentYear = null;
      
      labels.forEach((label, index) => {
        const year = label.includes(' ') ? label.split(' ')[1] : null;
        if (year && year !== currentYear) {
          yearChanges.push({ index, label, year });
          currentYear = year;
        }
      });
      
      // Show first, year changes, and last
      const strategicIndices = [0, ...yearChanges.map(yc => yc.index), labels.length - 1];
      const uniqueIndices = [...new Set(strategicIndices)].sort((a, b) => a - b);
      
      uniqueIndices.forEach(idx => {
        if (idx < labels.length) {
          const i = compact && isLargeDataset ? pointIndices.indexOf(idx) : idx;
          const x = (i / (totalPoints || 1)) * (width - 24) + 12;
          positions.push({ x, label: labels[idx], index: idx });
        }
      });
    } else {
      // Default behavior: show first, middle, and last
      const indices = [0, Math.floor((labels.length - 1) / 2), labels.length - 1];
      indices.forEach(idx => {
        if (idx < labels.length) {
          const i = compact && isLargeDataset ? pointIndices.indexOf(idx) : idx;
          const x = (i / (totalPoints || 1)) * (width - 24) + 12;
          positions.push({ x, label: labels[idx], index: idx });
        }
      });
    }
    
    return positions;
  };

  const axisLabelPositions = getAxisLabelPositions();
  
  return (
    <div className="line-chart-container" style={{ position: 'relative' }}>
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" opacity="0.3"/>
        
        {/* Main chart line */}
        <polyline points={points} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        
        {/* Axes with thicker lines */}
        <line x1={12} y1={height - 30} x2={width - 12} y2={height - 30} stroke="#333" strokeWidth="2" />
        <line x1={12} y1={12} x2={12} y2={height - 30} stroke="#333" strokeWidth="2" />
        
        {/* Y-axis values and grid lines */}
        {(() => {
          const numYTicks = 5;
          const yTicks = [];
          for (let i = 0; i <= numYTicks; i++) {
            const value = min + (range * i / numYTicks);
            const y = height - 30 - ((value - min) / range) * (height - 42);
            yTicks.push({ value, y });
          }
          return yTicks.map((tick, index) => (
            <g key={index}>
              {/* Horizontal grid line */}
              <line 
                x1={12} 
                y1={tick.y} 
                x2={width - 12} 
                y2={tick.y} 
                stroke="#e0e0e0" 
                strokeWidth="1" 
                strokeDasharray="3,3"
                opacity="0.5"
              />
              {/* Y-axis tick mark */}
              <line 
                x1={8} 
                y1={tick.y} 
                x2={12} 
                y2={tick.y} 
                stroke="#333" 
                strokeWidth="2"
              />
              {/* Y-axis label */}
              <text 
                x={8} 
                y={tick.y + 4} 
                fill="#333" 
                fontSize="11" 
                fontWeight="600"
                textAnchor="end"
              >
                {tick.value.toFixed(1)}
              </text>
            </g>
          ));
        })()}
        
        {/* Y-axis unit label */}
        <text 
          x={8} 
          y={10} 
          fill="#333" 
          fontSize="12" 
          fontWeight="700"
          textAnchor="middle"
        >
          {unit}
        </text>
        
        {/* X-axis tick marks and labels */}
        {axisLabelPositions.map((pos, index) => (
          <g key={index}>
            {/* Vertical grid line */}
            <line 
              x1={pos.x} 
              y1={12} 
              x2={pos.x} 
              y2={height - 30} 
              stroke="#e0e0e0" 
              strokeWidth="1" 
              strokeDasharray="3,3"
              opacity="0.3"
            />
            {/* X-axis tick mark */}
            <line 
              x1={pos.x} 
              y1={height - 30} 
              x2={pos.x} 
              y2={height - 26} 
              stroke="#333" 
              strokeWidth="2"
            />
            {/* X-axis label */}
            <text 
              x={pos.x} 
              y={height - 14} 
              fill="#333" 
              fontSize="10" 
              textAnchor="middle"
              fontWeight="600"
            >
              {pos.label}
            </text>
          </g>
        ))}
        
        {/* Data points */}
        {(!compact || !isLargeDataset) && pointIndices.map((dataIndex) => {
          const value = data[dataIndex];
          if (value === null || value === undefined || isNaN(value)) return null;
          
          const i = compact && isLargeDataset ? pointIndices.indexOf(dataIndex) : dataIndex;
          const totalPoints = compact && isLargeDataset ? pointIndices.length - 1 : data.length - 1;
          const x = (i / (totalPoints || 1)) * (width - 24) + 12;
          const y = height - 30 - ((value - min) / range) * (height - 42);
          return (
            <g key={dataIndex} 
               onMouseEnter={() => handleMouseEnter(dataIndex, x, y, data[dataIndex])}
               onMouseLeave={handleMouseLeave}
            >
              <circle 
                cx={x} 
                cy={y} 
                r={compact ? 2 : 4} 
                fill="#fff" 
                stroke={stroke} 
                strokeWidth="2"
              />
              {/* Invisible larger circle for better hover detection */}
              <circle 
                cx={x} 
                cy={y} 
                r={compact ? 10 : 15} 
                fill="transparent" 
                stroke="transparent" 
              />
            </g>
          );
        })}
      </svg>
      
      {/* Tooltip */}
      {hoveredPoint && (
        <div 
          className="chart-tooltip" 
          style={{ 
            position: 'absolute', 
            left: `calc(${(hoveredPoint.x / width) * 100}% - 50px)`, 
            top: `${hoveredPoint.y - 40}px`,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 10,
            width: '100px',
            textAlign: 'center'
          }}
        >
          <div>{hoveredPoint.label}</div>
          <div><strong>{hoveredPoint.value !== null ? hoveredPoint.value.toFixed(1) : 'N/A'}{unit}</strong></div>
        </div>
      )}
    </div>
  );
};

// Weather insights component
const WeatherInsights = ({ forecast }) => {
  if (!forecast || forecast.length === 0) return null;
  
  // Calculate insights
  const temps = forecast.map(d => d.temp).filter(t => t !== undefined && t !== null);
  const precips = forecast.map(d => d.precip).filter(p => p !== undefined && p !== null);
  const winds = forecast.map(d => d.wind).filter(w => w !== undefined && w !== null);
  
  const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : 'N/A';
  const maxTemp = temps.length ? Math.max(...temps).toFixed(1) : 'N/A';
  const minTemp = temps.length ? Math.min(...temps).toFixed(1) : 'N/A';
  
  const totalPrecip = precips.reduce((a, b) => a + b, 0).toFixed(1);
  const maxPrecip = precips.length ? Math.max(...precips).toFixed(1) : '0';
  const rainyDays = precips.filter(p => p > 0.5).length;
  
  const avgWind = winds.length ? (winds.reduce((a, b) => a + b, 0) / winds.length).toFixed(1) : 'N/A';
  const maxWind = winds.length ? Math.max(...winds).toFixed(1) : 'N/A';
  
  // Determine weather patterns
  let weatherPattern = "Stable";
  let tempTrend = "Steady";
  
  if (temps.length > 3) {
    const firstHalf = temps.slice(0, Math.floor(temps.length / 2));
    const secondHalf = temps.slice(Math.floor(temps.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (secondAvg - firstAvg > 1.5) {
      tempTrend = "Warming";
    } else if (firstAvg - secondAvg > 1.5) {
      tempTrend = "Cooling";
    }
    
    if (rainyDays > forecast.length / 3) {
      weatherPattern = "Rainy";
    } else if (maxTemp > 30) {
      weatherPattern = "Hot";
    } else if (minTemp < 10) {
      weatherPattern = "Cold";
    } else if (avgWind > 20) {
      weatherPattern = "Windy";
    }
  }
  
  return (
    <div className="weather-insights">
      <h3>Weather Insights</h3>
      <div className="insights-grid">
        <div className="insight-card">
          <h4>Temperature</h4>
          <div className="insight-value">{avgTemp}°C</div>
          <div className="insight-detail">Range: {minTemp}°C to {maxTemp}°C</div>
          <div className="insight-trend">Trend: {tempTrend}</div>
        </div>
        
        <div className="insight-card">
          <h4>Precipitation</h4>
          <div className="insight-value">{totalPrecip} mm</div>
          <div className="insight-detail">Max: {maxPrecip} mm</div>
          <div className="insight-detail">Rainy days: {rainyDays}</div>
        </div>
        
        <div className="insight-card">
          <h4>Wind</h4>
          <div className="insight-value">{avgWind} km/h</div>
          <div className="insight-detail">Max: {maxWind} km/h</div>
        </div>
        
        <div className="insight-card pattern-card">
          <h4>Weather Pattern</h4>
          <div className="pattern-value">{weatherPattern}</div>
          <div className="pattern-advice">
            {weatherPattern === "Rainy" && "Don't forget your umbrella!"}
            {weatherPattern === "Hot" && "Stay hydrated and use sunscreen."}
            {weatherPattern === "Cold" && "Bundle up and stay warm."}
            {weatherPattern === "Windy" && "Secure loose objects outdoors."}
            {weatherPattern === "Stable" && "Enjoy the pleasant weather!"}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main component ---
const ForecastSimplified = () => {
  // State for location selection
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES_DATA[0]);
  const [selectedState, setSelectedState] = useState(selectedCountry.states[0]);
  const [selectedCity, setSelectedCity] = useState(selectedState.cities[0]);
  const [allStatesSummary, setAllStatesSummary] = useState(null);
  const [analyzingAllStates, setAnalyzingAllStates] = useState(false);
  
  // State for date range
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return formatDate(date);
  });
  
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1); // Default to 1 year before end date
    return formatDate(date);
  });
  
  // Update start date when end date changes to maintain 1 year difference
  useEffect(() => {
    const end = new Date(endDate);
    const start = new Date(end);
    
    // Carefully set date to be exactly one year behind
    // This preserves the month and day while changing only the year
    const currentMonth = end.getMonth();
    const currentDay = end.getDate();
    start.setFullYear(end.getFullYear() - 1);
    
    // Handle leap year edge case (Feb 29)
    if (currentMonth === 1 && currentDay === 29 && !isLeapYear(start.getFullYear())) {
      start.setDate(28); // Set to Feb 28 in non-leap years
    }
    
    setStartDate(formatDate(start));
  }, [endDate]);
  
  // Helper function to check if a year is a leap year
  const isLeapYear = (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  };
  
  // Validate date range before fetching data
  const validateDateRange = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (end < start) {
      setError("End date cannot be before start date");
      return false;
    }
    
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 360) {
      setError("Date range cannot exceed 1 year");
      return false;
    }
    
    return true;
  };
  
  const [forecastData, setForecastData] = useState({ daily: [], monthly: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [governmentEmail, setGovernmentEmail] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [alertSmsPhone, setAlertSmsPhone] = useState("");
  const [sendingSingleSms, setSendingSingleSms] = useState(false);
  const [next7Summary, setNext7Summary] = useState(null);
  const [sendingSms, setSendingSms] = useState(false);

  // Function to fetch data
  const fetchData = async () => {
    setLoading(true);
    setError("");
    
    // Validate date range before proceeding
    if (!validateDateRange()) {
      setLoading(false);
      return;
    }
    
    try {
      const { lat, lon } = selectedCity;
      
      // Call the API function
      const response = await postPowerData({
        "lat": selectedCity.lat, 
        "lon": selectedCity.lon, 
        "start": startDate.replace(/-/g, ""),           
        "end": endDate.replace(/-/g, ""),             
        "parameters": ["T2M","PRECTOT","WS2M"], 
        "token": import.meta.env.VITE_TOKEN,          
        "timeout": 60
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.error || 'Unknown error'}`);
      }
      
      // Process the data
      const processedData = processApiData(response.data);
      setForecastData(processedData);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch weather data. Please try again later.");
      // Set sample data as fallback
      setForecastData({
        daily: getSample7(),
        monthly: getSample6Months()
      });
    } finally {
      setLoading(false);
    }
  };

  // Analyze all Indian states in COUNTRIES_DATA using the same date range
  const analyzeAllStates = async () => {
    setAnalyzingAllStates(true);
    setError("");
    setAllStatesSummary(null);
    try {
      const india = COUNTRIES_DATA[0];
      const start = startDate.replace(/-/g, "");
      const end = endDate.replace(/-/g, "");

      const results = await Promise.all(
        india.states.map(async (st) => {
          const city = st.cities[0];
          try {
            const res = await postPowerData({
              lat: city.lat,
              lon: city.lon,
              start,
              end,
              parameters: PARAMETERS,
              token: import.meta.env.VITE_TOKEN,
              timeout: 60,
            });
            if (!res.ok || !res.data) {
              return { state: st.name, city: city.name, error: true };
            }
            const processed = processApiData(res.data);
            const tempsArr = processed.daily
              .map((d) => d.temp)
              .filter((v) => v !== null && v !== undefined && !isNaN(v));
            const precArr = processed.daily
              .map((d) => d.precip)
              .filter((v) => v !== null && v !== undefined && !isNaN(v));

            const maxTemp =
              tempsArr.length > 0 ? Math.max(...tempsArr) : null;
            const maxDailyPrecip =
              precArr.length > 0 ? Math.max(...precArr) : null;
            const totalPrecip =
              precArr.length > 0
                ? precArr.reduce((sum, v) => sum + v, 0)
                : 0;

            return {
              state: st.name,
              city: city.name,
              maxTemp,
              maxDailyPrecip,
              totalPrecip,
              error: false,
            };
          } catch {
            return { state: st.name, city: city.name, error: true };
          }
        })
      );

      const valid = results.filter((r) => !r.error);
      if (valid.length === 0) {
        setError("Failed to analyze any state. Please try again.");
        setAllStatesSummary(null);
        return;
      }

      const hottest = valid.reduce((best, cur) => {
        const bestVal =
          best.maxTemp !== null && best.maxTemp !== undefined
            ? best.maxTemp
            : -Infinity;
        const curVal =
          cur.maxTemp !== null && cur.maxTemp !== undefined
            ? cur.maxTemp
            : -Infinity;
        return curVal > bestVal ? cur : best;
      }, valid[0]);

      const rainiest = valid.reduce((best, cur) => {
        const bestVal =
          best.maxDailyPrecip !== null && best.maxDailyPrecip !== undefined
            ? best.maxDailyPrecip
            : -Infinity;
        const curVal =
          cur.maxDailyPrecip !== null && cur.maxDailyPrecip !== undefined
            ? cur.maxDailyPrecip
            : -Infinity;
        return curVal > bestVal ? cur : best;
      }, valid[0]);

      setAllStatesSummary({ states: valid, hottest, rainiest });

      const lines = [];
      lines.push("Alert: High impact weather expected in India.");
      if (
        rainiest &&
        rainiest.state &&
        rainiest.maxDailyPrecip !== null &&
        rainiest.maxDailyPrecip !== undefined
      ) {
        lines.push(
          `- Highest daily rainfall: ${rainiest.state} (around ${rainiest.maxDailyPrecip.toFixed(
            1
          )} mm, representative city: ${rainiest.city}).`
        );
      }
      if (
        hottest &&
        hottest.state &&
        hottest.maxTemp !== null &&
        hottest.maxTemp !== undefined
      ) {
        lines.push(
          `- Highest temperature: ${hottest.state} (around ${hottest.maxTemp.toFixed(
            1
          )} °C, representative city: ${hottest.city}).`
        );
      }
      lines.push("");
      lines.push(
        `Period analyzed (historical NASA POWER data): ${startDate} to ${endDate}.`
      );
      lines.push(
        "Kindly review preparedness and mitigation measures for the above state(s)."
      );

      setAlertMessage(lines.join("\n"));

      const smsParts = [];
      smsParts.push("WEATHER ALERT (India):");
      if (
        rainiest &&
        rainiest.state &&
        rainiest.maxDailyPrecip !== null &&
        rainiest.maxDailyPrecip !== undefined
      ) {
        smsParts.push(
          `Heavy rain in ${rainiest.state} ~${rainiest.maxDailyPrecip.toFixed(
            0
          )}mm`
        );
      }
      if (
        hottest &&
        hottest.state &&
        hottest.maxTemp !== null &&
        hottest.maxTemp !== undefined
      ) {
        smsParts.push(
          `High temp in ${hottest.state} ~${hottest.maxTemp.toFixed(0)}C`
        );
      }
      smsParts.push(`${startDate} to ${endDate}. Please take action.`);
      setSmsMessage(smsParts.join(" | "));
    } finally {
      setAnalyzingAllStates(false);
    }
  };

  // Real-time 7-day forecast for all states + optional SMS using backend
  const runNext7DaysSmsAlerts = async () => {
    setSendingSms(true);
    setError("");
    setNext7Summary(null);
    try {
      const india = COUNTRIES_DATA[0];
      const statesPayload = india.states.map((st) => ({
        name: st.name,
        lat: st.cities[0].lat,
        lon: st.cities[0].lon,
      }));
      const response = await postStateSevenDayForecast({
        states: statesPayload,
        phone: smsPhone || null,
        send_sms: !!smsPhone,
        hot_threshold_c: 35.0,
        heavy_rain_threshold_mm: 20.0,
        openweather_api_key: import.meta.env.VITE_OPENWEATHER_KEY || null,
      });
      if (!response.ok) {
        throw new Error(response.error || "Failed to fetch 7-day state forecast");
      }
      setNext7Summary(response.data);
      // Build a compact SMS template for manual use as well (all alert states)
      if (response.data && response.data.states) {
        const alertStates = response.data.states.filter(
          (s) => s.hot_alert || s.heavy_rain_alert
        );
        if (alertStates.length > 0) {
          const parts = ["7-DAY ALERT (India):"];
          alertStates.forEach((s) => {
            const flags = [];
            if (s.heavy_rain_alert) {
              flags.push(`heavy rain up to ~${(s.max_daily_precip_mm || 0).toFixed(0)}mm`);
            }
            if (s.hot_alert) {
              flags.push(`heat up to ~${(s.max_temp_c || 0).toFixed(0)}C`);
            }
            parts.push(`${s.state}: ${flags.join(" & ")}`);
          });
          setSmsMessage(parts.join(" | "));
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to compute next 7 days forecast for all states.");
    } finally {
      setSendingSms(false);
    }
  };

  // Historical Weather Explorer Component
  const HistoricalWeatherExplorer = () => {
    
    // Process API data for historical explorer
  const getHistoricalData = useMemo(() => {
    // Default data for at least 6 months
    const defaultData = {
      tempData: "Data Not Available", // Fallback data
      extremeEvents: "Data Not Available", // Fallback data
      monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'],
      extremeLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
    };
    
    if (!forecastData || !forecastData.daily || forecastData.daily.length === 0) {
      return defaultData;
    }
    
    // Ensure we have at least 6 months of data
    const minMonths = 6;
      
      // Group data by month and year
      const monthlyData = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
      
      // Initialize monthly data structure
      months.forEach((month, index) => {
        monthlyData[index] = {
          temperatures: [],
          extremeEvents: 0,
          month: month,
          year: new Date().getFullYear() // Default to current year
        };
      });
      
      // Process forecast data
      forecastData.daily.forEach(day => {
        const date = new Date(day.date);
        const month = date.getMonth();
        const year = date.getFullYear();
        
        // Add temperature data
        if (day.temp !== undefined && day.temp !== null) {
          monthlyData[month].temperatures.push(day.temp);
          monthlyData[month].year = year; // Update year from actual data
        }
        
        // Count extreme events (rain > 10mm, temp > 30°C, wind > 20km/h)
        if ((day.precip && day.precip > 10) || 
            (day.temp && day.temp > 30) || 
            (day.wind && day.wind > 20)) {
          monthlyData[month].extremeEvents += 1;
        }
      });
      
      // Calculate monthly averages and prepare data for charts
      const tempData = [];
      const extremeEvents = [];
      const monthLabels = [];
      const extremeLabels = [];
      
      months.forEach((month, index) => {
        const monthData = monthlyData[index];
        
        // Calculate average temperature for the month
        const temps = monthData.temperatures;
        const avgTemp = temps.length > 0 
          ? temps.reduce((sum, temp) => sum + temp, 0) / temps.length 
          : null;
        
        // Format month label with year (e.g., "Jun 24")
        const monthYearLabel = `${month} ${monthData.year.toString().slice(-2)}`;
        
        // Add data for all months, even if no data (for consistent display)
        tempData.push(avgTemp !== null ? avgTemp : 0);
        extremeEvents.push(monthData.extremeEvents);
        monthLabels.push(monthYearLabel);
        extremeLabels.push(monthYearLabel);
      });
      
      return {
        tempData,
        extremeEvents,
        monthLabels,
        extremeLabels
      };
    }, [forecastData]);
    
    // Calculate data statistics from API data
    const dataStatistics = useMemo(() => {
      if (!forecastData || !forecastData.daily || forecastData.daily.length === 0) {
        return [
          { label: 'Avg Temperature', value: '23.4°C', year: 'This year' },
          { label: 'Total Rainfall', value: '847mm', year: 'This year' },
          { label: 'Extreme Events', value: '24', year: 'This year' },
          { label: 'Record High', value: '45°C', year: 'Jul 2023' }
        ];
      }
      
      // Calculate average temperature
      const temperatures = forecastData.daily.map(day => day.temp.day);
      const avgTemp = temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
      
      // Calculate total rainfall
      const totalRainfall = forecastData.daily.reduce((sum, day) => sum + (day.rain || 0), 0);
      
      // Count extreme events
      const extremeEventsCount = forecastData.daily.filter(day => 
        (day.rain && day.rain > 10) || 
        (day.temp && day.temp.max > 30) || 
        (day.wind_speed && day.wind_speed > 5.5)
      ).length;
      
      // Find record high temperature
      const maxTemp = Math.max(...forecastData.daily.map(day => day.temp.max));
      const maxTempDay = forecastData.daily.find(day => day.temp.max === maxTemp);
      const maxTempDate = new Date(maxTempDay.dt * 1000);
      const maxTempMonth = maxTempDate.toLocaleString('default', { month: 'short' });
      
      return [
        { label: 'Avg Temperature', value: `${avgTemp.toFixed(1)}°C`, year: 'This year' },
        { label: 'Total Rainfall', value: `${totalRainfall.toFixed(0)}mm`, year: 'This year' },
        { label: 'Extreme Events', value: extremeEventsCount.toString(), year: 'This year' },
        { label: 'Record High', value: `${maxTemp.toFixed(1)}°C`, year: `${maxTempMonth} ${maxTempDate.getFullYear()}` }
      ];
    }, [forecastData]);
    
    // Find recent extreme events from API data
    const recentExtremeEvents = useMemo(() => {
      if (!forecastData || !forecastData.daily || forecastData.daily.length === 0) {
        return [
          { type: 'Extreme Heat', location: location || 'Current Location', date: '2023-06-15', value: '42°C' },
          { type: 'Heavy Rainfall', location: location || 'Current Location', date: '2023-05-22', value: '152mm' },
          { type: 'Strong Winds', location: location || 'Current Location', date: '2023-04-10', value: '75km/h' }
        ];
      }
      
      // Find extreme events
      const extremeEvents = forecastData.daily
        .filter(day => 
          (day.rain && day.rain > 10) || 
          (day.temp && day.temp.max > 30) || 
          (day.wind_speed && day.wind_speed > 5.5)
        )
        .map(day => {
          const date = new Date(day.dt * 1000);
          const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          
          if (day.rain && day.rain > 10) {
            return {
              type: 'Heavy Rainfall',
              location: location || 'Current Location',
              date: formattedDate,
              value: `${day.rain.toFixed(0)}mm`
            };
          } else if (day.temp && day.temp.max > 30) {
            return {
              type: 'Extreme Heat',
              location: location || 'Current Location',
              date: formattedDate,
              value: `${day.temp.max.toFixed(1)}°C`
            };
          } else {
            return {
              type: 'Strong Winds',
              location: location || 'Current Location',
              date: formattedDate,
              value: `${(day.wind_speed * 3.6).toFixed(0)}km/h` // Convert m/s to km/h
            };
          }
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3); // Get the 3 most recent events
      
      return extremeEvents.length > 0 ? extremeEvents : [
        { type: 'Extreme Heat', location: location || 'Current Location', date: '2023-06-15', value: '42°C' },
        { type: 'Heavy Rainfall', location: location || 'Current Location', date: '2023-05-22', value: '152mm' },
        { type: 'Strong Winds', location: location || 'Current Location', date: '2023-04-10', value: '75km/h' }
      ];
    }, [forecastData, location]);
    
    // Available years for selection
  }



  // Handle country change
  const handleCountryChange = (e) => {
    const country = COUNTRIES_DATA.find(c => c.name === e.target.value);
    setSelectedCountry(country);
    setSelectedState(country.states[0]);
    setSelectedCity(country.states[0].cities[0]);
  };

  // Handle state change
  const handleStateChange = (e) => {
    const state = selectedCountry.states.find(s => s.name === e.target.value);
    setSelectedState(state);
    setSelectedCity(state.cities[0]);
  };

  // Computed arrays for charts
  const temps = useMemo(() => forecastData.daily.map(d => d.temp ?? 0), [forecastData.daily]);
  const precips = useMemo(() => forecastData.daily.map(d => d.precip ?? 0), [forecastData.daily]);
  const winds = useMemo(() => forecastData.daily.map(d => d.wind ?? 0), [forecastData.daily]);
  
  // Process API data for historical explorer based on actual range (startDate..endDate)
  const getHistoricalData = useMemo(() => {
    if (!forecastData || !forecastData.daily || forecastData.daily.length === 0) {
      return {
        tempData: [],
        precipData: [],
        windData: [],
        extremeEvents: [],
        monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'],
        extremeLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
      };
    }

    // Prefer precomputed monthly means from processApiData for accurate ordering across years
    const monthlyArray = Array.isArray(forecastData.monthly) ? forecastData.monthly : [];

    // Build month key order from monthlyArray; fallback to deriving from daily data
    let orderedMonths = [];
    if (monthlyArray.length > 0) {
      orderedMonths = monthlyArray.map(m => m.month); // 'YYYY-MM'
    } else {
      const monthsSet = new Set();
      forecastData.daily.forEach(day => {
        const d = new Date(day.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        monthsSet.add(key);
      });
      orderedMonths = Array.from(monthsSet).sort();
    }

    // Prepare maps for temp/precip/wind means and extreme events per month
    const tempMeanByMonth = new Map();
    const precipMeanByMonth = new Map();
    const windMeanByMonth = new Map();
    if (monthlyArray.length > 0) {
      monthlyArray.forEach(m => {
        tempMeanByMonth.set(m.month, m.meanTemp ?? null);
        precipMeanByMonth.set(m.month, m.meanPrecip ?? null);
        windMeanByMonth.set(m.month, m.meanWind ?? null);
      });
    } else {
      // compute averages per month from daily
      const agg = new Map(); // key -> { tSum, tN, pSum, pN, wSum, wN }
      forecastData.daily.forEach(day => {
        const d = new Date(day.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (!agg.has(key)) agg.set(key, { tSum: 0, tN: 0, pSum: 0, pN: 0, wSum: 0, wN: 0 });
        const a = agg.get(key);
        if (day.temp !== undefined && day.temp !== null) { a.tSum += day.temp; a.tN += 1; }
        if (day.precip !== undefined && day.precip !== null) { a.pSum += day.precip; a.pN += 1; }
        if (day.wind !== undefined && day.wind !== null) { a.wSum += day.wind; a.wN += 1; }
        agg.set(key, a);
      });
      agg.forEach((a, key) => {
        tempMeanByMonth.set(key, a.tN ? a.tSum / a.tN : null);
        precipMeanByMonth.set(key, a.pN ? a.pSum / a.pN : null);
        windMeanByMonth.set(key, a.wN ? a.wSum / a.wN : null);
      });
    }

    // Compute extreme events per month from daily
    const extremeByMonth = new Map();
    forecastData.daily.forEach(day => {
      const d = new Date(day.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      let countInc = 0;
      if (day.precip !== undefined && day.precip > 10) countInc += 1;
      if (day.temp !== undefined && (day.temp > 30 || day.temp < 5)) countInc += 1;
      if (day.wind !== undefined && day.wind > 20) countInc += 1;
      extremeByMonth.set(key, (extremeByMonth.get(key) || 0) + countInc);
    });

    // Build arrays in chronological order with readable labels (e.g., 'Sep 24')
    const monthLabels = orderedMonths.map(key => {
      const [y, m] = key.split('-').map(Number);
      return getMonthName(m, y, true);
    });
    const tempData = orderedMonths.map(key => tempMeanByMonth.has(key) && tempMeanByMonth.get(key) !== null ? tempMeanByMonth.get(key) : 0);
    const precipData = orderedMonths.map(key => precipMeanByMonth.has(key) && precipMeanByMonth.get(key) !== null ? precipMeanByMonth.get(key) : 0);
    const windData = orderedMonths.map(key => windMeanByMonth.has(key) && windMeanByMonth.get(key) !== null ? windMeanByMonth.get(key) : 0);
    const extremeEvents = orderedMonths.map(key => extremeByMonth.get(key) || 0);
    const extremeLabels = monthLabels.slice();

    return { tempData, precipData, windData, extremeEvents, monthLabels, extremeLabels };
  }, [forecastData]);
  
  // Calculate statistics from API data
  const dataStatistics = useMemo(() => {
    if (!forecastData || !forecastData.daily || forecastData.daily.length === 0) {
      return {
        avgTemp: "23.4°C",
        totalRainfall: "847mm",
        avgWind: "N/A",
        totalExtreme: 0
      };
    }
    
    const temps = forecastData.daily.map(d => d.temp).filter(t => t !== undefined && t !== null);
    const precips = forecastData.daily.map(d => d.precip).filter(p => p !== undefined && p !== null);
    const windsArr = forecastData.daily.map(d => d.wind).filter(w => w !== undefined && w !== null);
    
    const avgTemp = temps.length ? 
      (temps.reduce((sum, temp) => sum + temp, 0) / temps.length).toFixed(1) + "°C" : 
      "N/A";
    
    const totalRainfall = precips.length ? 
      precips.reduce((sum, precip) => sum + precip, 0).toFixed(0) + "mm" : 
      "0mm";
    
    const avgWind = windsArr.length ? 
      (windsArr.reduce((s, v) => s + v, 0) / windsArr.length).toFixed(1) + " km/h" :
      "N/A";

    // Total extreme events across the range (using same thresholds as explorer)
    const totalExtreme = forecastData.daily.reduce((cnt, d) => {
      let inc = 0;
      if (d.precip !== undefined && d.precip > 10) inc += 1;
      if (d.temp !== undefined && (d.temp > 30 || d.temp < 5)) inc += 1;
      if (d.wind !== undefined && d.wind > 20) inc += 1;
      return cnt + inc;
    }, 0);
    
    return { avgTemp, totalRainfall, avgWind, totalExtreme };
  }, [forecastData]);
  
  // Find extreme events from API data (include wind, do not limit, sort desc)
  const recentExtremeEvents = useMemo(() => {
    if (!forecastData || !forecastData.daily || forecastData.daily.length === 0) {
      return [
        { type: "Extreme Heat", location: "Phoenix, AZ", date: "2024-03-16", value: "42°C" }
      ];
    }
    
    const extremeEvents = [];
    
    // Find days with extreme temperatures or precipitation
    forecastData.daily.forEach(day => {
      if (day.temp !== undefined && day.temp > 35) {
        extremeEvents.push({
          type: "Extreme Heat",
          location: `${selectedCity.name}, ${selectedState.name}`,
          date: day.date,
          value: `${day.temp.toFixed(1)}°C`
        });
      } else if (day.temp !== undefined && day.temp < 0) {
        extremeEvents.push({
          type: "Extreme Cold",
          location: `${selectedCity.name}, ${selectedState.name}`,
          date: day.date,
          value: `${day.temp.toFixed(1)}°C`
        });
      }
      
      if (day.precip !== undefined && day.precip > 25) {
        extremeEvents.push({
          type: "Heavy Rain",
          location: `${selectedCity.name}, ${selectedState.name}`,
          date: day.date,
          value: `${day.precip.toFixed(1)}mm`
        });
      }

      if (day.wind !== undefined && day.wind > 20) {
        extremeEvents.push({
          type: "Strong Winds",
          location: `${selectedCity.name}, ${selectedState.name}`,
          date: day.date,
          value: `${day.wind.toFixed(1)} km/h`
        });
      }
    });
    
    // Sort by date (most recent first)
    return extremeEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [forecastData, selectedCity, selectedState]);

  return (
    <div className="fs-container">
      <header className="fs-header">
        <h2>Weather Forecast</h2>
        <p className="muted">Detailed weather forecast with insights — Temperature, Precipitation, Wind</p>
      </header>

      <section className="fs-controls">
        <div className="location-selectors">
          <h3 className="section-title">Select Location</h3>
          <div className="selector-group">
            <label>Country</label>
            <select value={selectedCountry.name} onChange={handleCountryChange}>
              {COUNTRIES_DATA.map(country => (
                <option key={country.name} value={country.name}>{country.name}</option>
              ))}
            </select>
          </div>
          
          <div className="selector-group">
            <label>State/Region</label>
            <select value={selectedState.name} onChange={handleStateChange}>
              {selectedCountry.states.map(state => (
                <option key={state.name} value={state.name}>{state.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="date-selectors">
          <div className="selector-group">
            <label>Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              max={formatDate(new Date())}
            />
          </div>
          
          <div className="selector-group">
            <label>End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              max={formatDate(new Date())}
            />
          </div>
          
          <div className="selector-group">
            <button 
              className="fetch-button" 
              onClick={fetchData}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Get Forecast Data'}
            </button>
          </div>
          <div className="selector-group">
            <button
              className="fetch-button secondary"
              onClick={analyzeAllStates}
              disabled={loading || analyzingAllStates}
            >
              {analyzingAllStates ? "Analyzing all states..." : "Analyze All States (India)"}
            </button>
          </div>
         
          <div className="selector-group">
            <button
              className="fetch-button secondary"
              onClick={runNext7DaysSmsAlerts}
              disabled={sendingSms}
            >
              {sendingSms ? "Sending 7-day SMS alerts..." : "Next 7 Days SMS Alerts (All States)"}
            </button>
          </div>
        </div>
        
        <div className="fs-loading">{loading && <span>Loading data...</span>}</div>
        {error && <div className="fs-error">{error}</div>}
      </section>
      
      {/* Historical Weather Explorer Section */}
      <section className="historical-explorer">
        <div className="explorer-header">
          <h3>Historical Weather Explorer</h3>
          <p>Explore decades of NASA Earth observation data</p>
          
          {/* Controls removed */}
        </div>
        
        {/* Check if data is available */}
        {!forecastData.hasData && forecastData.daily.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            borderRadius: '16px',
            border: '2px dashed #cbd5e0',
            margin: '20px 0'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '20px'
            }}>📊</div>
            <h3 style={{
              fontSize: '1.8rem',
              color: '#2d3748',
              marginBottom: '12px',
              fontWeight: '700'
            }}>
              Data Not Available
            </h3>
            <p style={{
              fontSize: '1.1rem',
              color: '#718096',
              maxWidth: '600px',
              margin: '0 auto 24px',
              lineHeight: '1.6'
            }}>
              No weather data available for the selected location and date range.
              <br />
              Please select a location and date range, then click "Get Forecast Data" to load weather information.
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'rgba(66, 153, 225, 0.1)',
              borderRadius: '8px',
              color: '#4299e1',
              fontSize: '0.95rem',
              fontWeight: '600'
            }}>
              💡 Tip: Select a date range and location above to view historical weather data
            </div>
          </div>
        ) : (
        <>
        <div className="explorer-charts">
          <div className="chart-container">
            <h4>Temperature & Precipitation Trends</h4>
            <div className="temp-chart">
              <LineChart 
                data={getHistoricalData.tempData} 
                stroke="#ff6b6b" 
                height={180}
                labels={getHistoricalData.monthLabels}
                unit="°C"
              />
              <LineChart 
                data={getHistoricalData.precipData} 
                stroke="#48c1a9" 
                height={180}
                labels={getHistoricalData.monthLabels}
                unit=" mm"
              />
              <div className="chart-labels">
                {getHistoricalData.monthLabels.map(month => (
                  <span key={month}>{month}</span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="chart-container">
            <h4>Extreme Weather Events</h4>
            <div className="events-chart">
              {/* Line Chart for Extreme Events */}
              <LineChart 
                data={getHistoricalData.extremeEvents} 
                stroke="#8a2be2" 
                height={180}
                labels={getHistoricalData.extremeLabels}
                unit=" events"
              />
              <div className="chart-labels">
                {getHistoricalData.extremeLabels.map(month => (
                  <span key={month}>{month}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="chart-container">
            <h4>Wind Speed Trends</h4>
            <div className="wind-chart">
              <LineChart 
                data={getHistoricalData.windData} 
                stroke="#4d9df6" 
                height={180}
                labels={getHistoricalData.monthLabels}
                unit=" km/h"
              />
              <div className="chart-labels">
                {getHistoricalData.monthLabels.map(month => (
                  <span key={month}>{month}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="explorer-details">
          <div className="recent-events">
            <h4>Recent Extreme Events</h4>
            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
              {recentExtremeEvents.map((event, index) => (
                <div key={index} className="event-card">
                  <div className="event-type">{event.type}</div>
                  <div className="event-location">{event.location}</div>
                  <div className="event-date">{event.date}</div>
                  <div className="event-value">{event.value}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="data-statistics">
            <h4>Data Statistics</h4>
            <div className="stat-cards">
              <div className="stat-card">
                <div className="stat-value">{dataStatistics.avgTemp}</div>
                <div className="stat-label">Avg Temperature</div>
                <div className="stat-period">This year</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{dataStatistics.totalRainfall}</div>
                <div className="stat-label">Total Rainfall</div>
                <div className="stat-period">This year</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{dataStatistics.avgWind}</div>
                <div className="stat-label">Avg Wind</div>
                <div className="stat-period">This year</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{dataStatistics.totalExtreme}</div>
                <div className="stat-label">Total Extreme Events</div>
                <div className="stat-period">This year</div>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </section>

      {/* Weather Insights Section */}
      <WeatherInsights forecast={forecastData.daily} />

      {/* Next 7 days real-time forecast + SMS alerts */}
      {next7Summary && (
        <section className="state-alerts">
          <h3>Next 7 Days Alerts (Real-time forecast)</h3>
          <p className="muted">
            Based on 7-day forecast (OpenWeather if configured, otherwise NASA POWER climatology). Thresholds: heat ≥ 35°C, heavy rain ≥ 20 mm/day.
          </p>
          <div className="state-extremes">
            <div className="extreme-card">
              <h4>Heaviest Forecast Rainfall</h4>
              {next7Summary.rainiest ? (
                <>
                  <div className="extreme-main">{next7Summary.rainiest.state}</div>
                  <div className="extreme-detail">
                    Max daily rainfall in next 7 days ~{" "}
                    {next7Summary.rainiest.max_daily_precip_mm !== null &&
                    next7Summary.rainiest.max_daily_precip_mm !== undefined
                      ? next7Summary.rainiest.max_daily_precip_mm.toFixed(1)
                      : "—"}{" "}
                    mm
                  </div>
                </>
              ) : (
                <div className="extreme-detail">No strong rainfall signals detected.</div>
              )}
            </div>
            <div className="extreme-card">
              <h4>Strongest Forecast Heat</h4>
              {next7Summary.hottest ? (
                <>
                  <div className="extreme-main">{next7Summary.hottest.state}</div>
                  <div className="extreme-detail">
                    Max temperature in next 7 days ~{" "}
                    {next7Summary.hottest.max_temp_c !== null &&
                    next7Summary.hottest.max_temp_c !== undefined
                      ? next7Summary.hottest.max_temp_c.toFixed(1)
                      : "—"}{" "}
                    °C
                  </div>
                </>
              ) : (
                <div className="extreme-detail">No strong heat signals detected.</div>
              )}
            </div>
          </div>
          {next7Summary.states && (
            <div className="state-table-wrapper">
              <table className="state-table">
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Max Temp (°C, 7 days)</th>
                    <th>Max Daily Rain (mm, 7 days)</th>
                    <th>Total Rain (mm, 7 days)</th>
                    <th>Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {next7Summary.states.map((s) => (
                    <tr key={s.state}>
                      <td>{s.state}</td>
                      <td>
                        {s.max_temp_c !== null && s.max_temp_c !== undefined
                          ? s.max_temp_c.toFixed(1)
                          : "—"}
                      </td>
                      <td>
                        {s.max_daily_precip_mm !== null &&
                        s.max_daily_precip_mm !== undefined
                          ? s.max_daily_precip_mm.toFixed(1)
                          : "—"}
                      </td>
                      <td>
                        {s.total_precip_mm !== null &&
                        s.total_precip_mm !== undefined
                          ? s.total_precip_mm.toFixed(1)
                          : "—"}
                      </td>
                      <td>
                        {s.hot_alert || s.heavy_rain_alert
                          ? [
                              s.heavy_rain_alert ? "Heavy rain" : null,
                              s.hot_alert ? "Heat" : null,
                            ]
                              .filter(Boolean)
                              .join(" & ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* State-wise extremes and alert message */}
      {allStatesSummary && (
        <section className="state-alerts">
          <h3>State-wise Extreme Weather (India)</h3>
          <p className="muted">
            Based on NASA POWER daily data for the period {startDate} to {endDate}.
          </p>

          <div className="state-extremes">
            <div className="extreme-card">
              <h4>Highest Rainfall</h4>
              {allStatesSummary.rainiest &&
              allStatesSummary.rainiest.maxDailyPrecip !== null &&
              allStatesSummary.rainiest.maxDailyPrecip !== undefined ? (
                <>
                  <div className="extreme-main">
                    {allStatesSummary.rainiest.state}
                  </div>
                  <div className="extreme-detail">
                    Max daily rainfall ~
                    {" "}
                    {allStatesSummary.rainiest.maxDailyPrecip.toFixed(1)}
                    {" "}
                    mm
                    {" "}
                    ({allStatesSummary.rainiest.city})
                  </div>
                </>
              ) : (
                <div className="extreme-detail">
                  Insufficient rainfall data across states.
                </div>
              )}
            </div>

            <div className="extreme-card">
              <h4>Highest Temperature</h4>
              {allStatesSummary.hottest &&
              allStatesSummary.hottest.maxTemp !== null &&
              allStatesSummary.hottest.maxTemp !== undefined ? (
                <>
                  <div className="extreme-main">
                    {allStatesSummary.hottest.state}
                  </div>
                  <div className="extreme-detail">
                    Max temperature ~
                    {" "}
                    {allStatesSummary.hottest.maxTemp.toFixed(1)}
                    {" "}
                    °C
                    {" "}
                    ({allStatesSummary.hottest.city})
                  </div>
                </>
              ) : (
                <div className="extreme-detail">
                  Insufficient temperature data across states.
                </div>
              )}
            </div>
          </div>

          {allStatesSummary.states && allStatesSummary.states.length > 0 && (
            <div className="state-table-wrapper">
              <table className="state-table">
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Representative City</th>
                    <th>Max Temp (°C)</th>
                    <th>Max Daily Rain (mm)</th>
                    <th>Total Rain (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {allStatesSummary.states.map((st) => (
                    <tr key={st.state}>
                      <td>{st.state}</td>
                      <td>{st.city}</td>
                      <td>
                        {st.maxTemp !== null &&
                        st.maxTemp !== undefined &&
                        !Number.isNaN(st.maxTemp)
                          ? st.maxTemp.toFixed(1)
                          : "—"}
                      </td>
                      <td>
                        {st.maxDailyPrecip !== null &&
                        st.maxDailyPrecip !== undefined &&
                        !Number.isNaN(st.maxDailyPrecip)
                          ? st.maxDailyPrecip.toFixed(1)
                          : "—"}
                      </td>
                      <td>
                        {st.totalPrecip !== null &&
                        st.totalPrecip !== undefined &&
                        !Number.isNaN(st.totalPrecip)
                          ? st.totalPrecip.toFixed(1)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="alert-box">
            <h4>Alert Message to State Government</h4>
            <textarea
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              rows={6}
              placeholder="High rainfall / high temperature alert message that will be shared with the state government."
            />
            <div className="alert-actions">
              <button
                onClick={() => {
                  if (!alertMessage) return;
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(alertMessage).catch(() => {});
                  }
                }}
                disabled={!alertMessage}
              >
                Copy Message
              </button>
              <button
                onClick={() => {
                  if (!smsMessage) return;
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(smsMessage).catch(() => {});
                  }
                }}
                disabled={!smsMessage}
              >
                Copy SMS Text
              </button>
              <div className="email-send">
                <input
                  type="tel"
                  placeholder="SMS number (state govt)"
                  value={alertSmsPhone}
                  onChange={(e) => setAlertSmsPhone(e.target.value)}
                />
                <button
                  onClick={async () => {
                    if (!alertSmsPhone || !smsMessage) return;
                    setSendingSingleSms(true);
                    try {
                      const res = await postSendSms({
                        phone: alertSmsPhone,
                        body: smsMessage,
                      });
                      if (!res.ok) {
                        console.error(res.error);
                      }
                    } finally {
                      setSendingSingleSms(false);
                    }
                  }}
                  disabled={!alertSmsPhone || !smsMessage || sendingSingleSms}
                >
                  {sendingSingleSms ? "Sending SMS..." : "Send SMS"}
                </button>
              </div>
              <div className="email-send">
                <input
                  type="email"
                  placeholder="State government email (optional)"
                  value={governmentEmail}
                  onChange={(e) => setGovernmentEmail(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (!alertMessage || !governmentEmail) return;
                    const subject = "Weather Alert: High Rainfall / High Temperature";
                    const body = encodeURIComponent(alertMessage);
                    const mailto = `mailto:${encodeURIComponent(
                      governmentEmail
                    )}?subject=${encodeURIComponent(subject)}&body=${body}`;
                    window.location.href = mailto;
                  }}
                  disabled={!alertMessage || !governmentEmail}
                >
                  Send Email
                </button>
              </div>
            </div>
            <p className="muted small">
              The alert and SMS text are generated from real NASA POWER data; review and send them through your official communication channels (email, SMS gateway, etc.).
            </p>
          </div>
        </section>
      )}

      {/* Display error message if no data */}
      {forecastData.errorMessage && (
        <div className="no-data-message">
          <p>{forecastData.errorMessage}</p>
          <p>Please try a different date range or location.</p>
        </div>
      )}
      {/* Daily Forecast Charts */}
      <section className="charts-row">
        <div className="chart-block">
          <h4>Temperature Forecast</h4>
          {temps.length > 0 ? (
            <>
              <LineChart 
                data={temps} 
                stroke="#ff6b6b" 
                labels={forecastData.daily.map(d => {
                  const dt = new Date(d.date);
                  return dt.toLocaleString('default', { month: 'short', day: '2-digit' });
                })}
                unit="°C"
              />
              <div className="small-stats">
                <span>Max: {Math.max(...(temps.filter(t => t !== null).length ? temps.filter(t => t !== null) : [0]))}°C</span>
                <span>Min: {Math.min(...(temps.filter(t => t !== null).length ? temps.filter(t => t !== null) : [0]))}°C</span>
                <span>Avg: {(temps.filter(t => t !== null).reduce((s,v)=>s+v,0)/Math.max(1,temps.filter(t => t !== null).length)).toFixed(1)}°C</span>
              </div>
            </>
          ) : (
            <div className="no-data">No temperature data available</div>
          )}
        </div>

        <div className="chart-block">
          <h4>Precipitation Forecast</h4>
          {precips.length > 0 ? (
            <>
              <LineChart 
                data={precips} 
                stroke="#48c1a9" 
                labels={forecastData.daily.map(d => {
                  const dt = new Date(d.date);
                  return dt.toLocaleString('default', { month: 'short', day: '2-digit' });
                })}
                unit=" mm"
              />
              <div className="small-stats">
                <span>Total: {precips.filter(p => p !== null).reduce((s,v)=>s+v,0).toFixed(2)} mm</span>
                <span>Avg: {(precips.filter(p => p !== null).reduce((s,v)=>s+v,0)/Math.max(1,precips.filter(p => p !== null).length)).toFixed(2)} mm/day</span>
                <span>Rainy Days: {precips.filter(p => p > 0.5).length}</span>
              </div>
            </>
          ) : (
            <div className="no-data">No precipitation data available</div>
          )}
        </div>

        <div className="chart-block">
          <h4>Wind Forecast</h4>
          {winds.length > 0 ? (
            <>
              <LineChart 
                data={winds} 
                stroke="#4d9df6" 
                labels={forecastData.daily.map(d => {
                  const dt = new Date(d.date);
                  return dt.toLocaleString('default', { month: 'short', day: '2-digit' });
                })}
                unit=" km/h"
              />
              <div className="small-stats">
                <span>Max: {Math.max(...(winds.filter(w => w !== null).length ? winds.filter(w => w !== null) : [0])).toFixed(1)} km/h</span>
                <span>Avg: {(winds.filter(w => w !== null).reduce((s,v)=>s+v,0)/Math.max(1,winds.filter(w => w !== null).length)).toFixed(1)} km/h</span>
                <span>Windy Days: {winds.filter(w => w > 20).length}</span>
              </div>
            </>
          ) : (
            <div className="no-data">No wind data available</div>
          )}
        </div>
      </section>

    </div>
  );
};

// --- Fallback sample data functions ---
function getSample7() {
  // 7 days of sample
  const arr = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    arr.push({
      date: formatDate(d),
      temp: Math.round(20 + Math.sin(i/7 * Math.PI) * 6),
      precip: Number((Math.random() * 3).toFixed(2)),
      wind: Number((8 + Math.random()*6).toFixed(1)),
      // Add weather condition based on temperature and precipitation
      condition: getWeatherCondition(Math.round(20 + Math.sin(i/7 * Math.PI) * 6), Number((Math.random() * 3).toFixed(2)))
    });
  }
  return arr;
}

// Helper function to determine weather condition
function getWeatherCondition(temp, precip) {
  if (precip > 2) return "Heavy Rain";
  if (precip > 0.5) return "Light Rain";
  if (temp > 28) return "Sunny";
  if (temp < 15) return "Cool";
  return "Clear";
}

function getSample6Months() {
  const arr = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const mKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    arr.push({
      month: mKey,
      meanTemp: Math.round(15 + Math.random()*10),
      meanPrecip: Number((Math.random()*80).toFixed(1)),
      meanWind: Number((6 + Math.random()*6).toFixed(1)),
      // Add dominant condition for the month
      dominantCondition: ["Mostly Clear", "Rainy", "Windy", "Hot", "Mild", "Variable"][Math.floor(Math.random() * 6)]
    });
  }
  return arr;
}

export default ForecastSimplified;
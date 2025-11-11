# 🪁 AstroKites - Weather Forecasting & Historical Data Platform

![AstroKites Logo](./AstroKites/public/astrokites-logo.svg)

**AstroKites** is a comprehensive weather forecasting platform that provides precise, probability-based weather predictions using NASA POWER data. The platform combines historical weather analysis with interactive visualizations and real-time forecasting capabilities.

---

## 🌟 Features

### 📊 Historical Weather Explorer
- **Multi-year Analysis**: View and analyze decades of NASA Earth observation data
- **Interactive Charts**: Temperature, precipitation, wind speed, and extreme weather events
- **Zoom & Scroll**: Enhanced chart navigation with adjustable zoom levels
- **Data Statistics**: Comprehensive yearly averages and totals

### 🎯 Forecast System
- **Probability-Based Predictions**: Advanced forecasting with confidence scores
- **Daily & Monthly Forecasts**: Short-term and long-term weather predictions
- **Extreme Event Detection**: Automatic identification of extreme weather conditions
- **Custom Date Ranges**: Flexible date selection for historical analysis

### 🗺️ Interactive Maps
- **Global Coverage**: Weather data visualization across the world
- **Leaflet Integration**: Interactive, user-friendly map interface
- **Location Search**: Quick location lookup and coordinate selection
- **Real-time Data**: Live weather information display

### 💡 Smart Features
- **Responsive Design**: Seamless experience across desktop, tablet, and mobile
- **Data Export**: Download weather data in CSV format
- **API Integration**: FastAPI backend for efficient data processing
- **Modern UI**: Beautiful gradient designs with smooth animations

---

## 🛠️ Tech Stack

### Frontend (AstroKites)
- **React 19.1** - Modern UI library
- **Vite** - Fast build tool
- **React Router DOM** - Navigation
- **Leaflet** - Interactive maps
- **React Simple Maps** - Geographic data visualization
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client
- **Three.js** - 3D visualizations

### Backend
- **FastAPI** - High-performance Python web framework
- **NumPy** - Numerical computations
- **Pydantic** - Data validation
- **NASA POWER API** - Weather data source

### GUI Application
- **Tkinter** - Desktop GUI framework
- **Matplotlib** - Data visualization
- **Pillow** - Image processing
- **NumPy** - Scientific computing

---

## 📦 Installation

### Prerequisites
- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**

### Frontend Setup (AstroKites)

```bash
# Navigate to the project directory
cd AstroKites

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build
```

The application will be available at `http://localhost:5173`

### Backend Setup

```bash
# Navigate to the backend directory
cd ..

# Install Python dependencies
pip install fastapi uvicorn pydantic numpy

# Run the FastAPI server
uvicorn Backend:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### GUI Application Setup

```bash
# Install required packages
pip install pillow numpy matplotlib

# Run the GUI application
python visualized_gui.py
```

---

## 🌐 Data Sources & APIs

### NASA POWER API
AstroKites uses the **NASA Prediction Of Worldwide Energy Resources (POWER)** API to access historical weather data.

- **API Documentation**: [NASA POWER API Docs](https://power.larc.nasa.gov/docs/services/api/)
- **Data Portal**: [NASA POWER Data Access Viewer](https://power.larc.nasa.gov/data-access-viewer/)
- **Coverage**: Global weather data from 1981 to present
- **Parameters**: Temperature, Precipitation, Wind Speed, Solar Radiation, Humidity, and more

### Dataset Links

#### 🔗 Primary Data Sources
1. **NASA POWER API**
   - Endpoint: `https://power.larc.nasa.gov/api/temporal/`
   - Format: JSON/CSV
   - Resolution: Daily, Monthly, Climatology

2. **OpenStreetMap Nominatim** (Geocoding)
   - API: `https://nominatim.openstreetmap.org/`
   - Purpose: Location search and coordinate lookup

#### 📊 Available Parameters
- `T2M` - Temperature at 2 Meters (°C)
- `PRECTOTCORR` - Precipitation Corrected (mm/day)
- `WS2M` - Wind Speed at 2 Meters (m/s)
- `RH2M` - Relative Humidity at 2 Meters (%)
- `ALLSKY_SFC_SW_DWN` - All Sky Surface Shortwave Downward Irradiance (kW-hr/m²/day)
- `PS` - Surface Pressure (kPa)

---

## 🗺️ Maps & Visualization

### Interactive Map Features

1. **Leaflet Maps** (`react-leaflet`)
   - Base Layer: OpenStreetMap
   - Tile Server: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
   - Interactive markers and popups
   - Custom styling with CSS overlays

2. **Geographic Projections** (`react-simple-maps`)
   - TopoJSON support
   - D3-geo integration
   - Custom color scales for data visualization

3. **3D Globe Visualization** (`three.js`)
   - Interactive 3D Earth model
   - Real-time rotation and zoom
   - WebGL-based rendering

### Map Data Sources
- **Natural Earth Data**: [Natural Earth](https://www.naturalearthdata.com/)
- **TopoJSON Files**: Geographic boundary data
- **Custom Weather Layers**: Generated from NASA POWER data

---

## 📁 Project Structure

```
Web/
├── AstroKites/                    # React Frontend Application
│   ├── public/
│   │   ├── astrokites-logo.svg   # Custom logo
│   │   └── vite.svg
│   ├── src/
│   │   ├── api/                  # API integration
│   │   ├── assets/               # Static assets
│   │   ├── component/            # Reusable components
│   │   │   ├── navbar.jsx        # Navigation bar
│   │   │   └── navbar.css
│   │   ├── pages/                # Page components
│   │   │   ├── homePage.jsx      # Landing page
│   │   │   ├── forecast.jsx      # Weather forecast page
│   │   │   ├── forecast.css
│   │   │   ├── maps.jsx          # Interactive maps
│   │   │   └── maps.css
│   │   ├── App.jsx               # Main app component
│   │   ├── main.jsx              # Entry point
│   │   └── App.css
│   ├── .env                      # Environment variables
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── Backend.py                     # FastAPI Backend Server
├── visualized_gui.py              # Desktop GUI Application
└── README.md                      # This file
```

---

## 🚀 Usage

### Web Application (AstroKites)

1. **Home Page**
   - Overview of features
   - Quick navigation to forecast and maps

2. **Forecast Page**
   - Select location (search or click on map)
   - Choose date range (historical or future)
   - Click "Get Forecast Data"
   - View interactive charts and statistics
   - Export data as CSV

3. **Maps Page**
   - Interactive global map
   - Click on any location for weather data
   - Layer controls for different parameters
   - Real-time data overlay

### API Endpoints

```bash
# Get historical weather data
GET http://localhost:8000/api/weather
Parameters:
  - latitude: float
  - longitude: float
  - start_date: YYYY-MM-DD
  - end_date: YYYY-MM-DD
  - parameters: T2M,PRECTOTCORR,WS2M

# Get forecast data
POST http://localhost:8000/api/forecast
Body:
  {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "days": 7
  }
```

### Desktop GUI Application

1. Launch `visualized_gui.py`
2. Enter coordinates or search for location
3. Select date range
4. Choose weather parameters
5. Click "Fetch Data" to retrieve information
6. View plots and export to CSV

---

## 🎨 Features Showcase

### Dynamic Charts
- **Line Charts**: Temperature, precipitation, and wind speed trends
- **Zoom Controls**: Interactive zoom from 50% to 300%
- **Horizontal Scrolling**: Navigate large datasets easily
- **Hover Tooltips**: Detailed information on data points

### Responsive Design
- Mobile-first approach
- Adaptive layouts for all screen sizes
- Touch-friendly controls
- Optimized performance

### Animations
- Smooth page transitions
- Animated logo with pulsing effects
- Chart loading animations
- Interactive hover states

---

## 🔒 Environment Variables

Create a `.env` file in the AstroKites directory:

```env
VITE_TOKEN=your_nasa_token_here
```

---

## 📊 Data Format

### Historical Data Response
```json
{
  "location": {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "timezone": "Asia/Kolkata"
  },
  "data": [
    {
      "date": "2024-01-01",
      "temperature": 15.2,
      "precipitation": 0.0,
      "wind_speed": 3.5,
      "humidity": 65
    }
  ],
  "statistics": {
    "avgTemp": 23.4,
    "totalRainfall": 847,
    "avgWind": 12.4,
    "extremeEvents": 5
  }
}
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Write meaningful commit messages
- Add comments for complex logic
- Test thoroughly before submitting
- Update documentation as needed

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: Charts not displaying
- **Solution**: Check if data is loaded correctly, verify date range

**Issue**: API connection errors
- **Solution**: Ensure backend server is running on port 8000

**Issue**: Map not loading
- **Solution**: Check internet connection and map tile server availability

**Issue**: Environment variables not working
- **Solution**: Restart development server after adding `.env` file

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details

---

## 🙏 Acknowledgments

- **NASA POWER Project** - For providing free, high-quality weather data
- **OpenStreetMap Contributors** - For geocoding services
- **React Community** - For excellent libraries and tools
- **Vite Team** - For the blazing-fast build tool

---

## 📧 Contact

For questions, suggestions, or issues:
- **Email**: harshsuthar608@gmail.com.com

---

## 🔮 Future Enhancements

- [ ] Real-time weather alerts
- [ ] Machine learning-based predictions
- [ ] Social media sharing
- [ ] Weather comparison tools
- [ ] Mobile app (React Native)
- [ ] Multilingual support
- [ ] Dark mode theme
- [ ] Weather widgets for embedding

---

<div align="center">
  <strong>Made with ❤️ by the AstroKites Team</strong>
  <br>
  <sub>Bringing weather data to life through beautiful visualizations</sub>
</div>

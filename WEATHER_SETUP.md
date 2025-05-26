# 🌍 Real-World Weather Data Setup

ROCKETv1 now supports real-world atmospheric data for incredibly accurate rocket simulations. This guide will help you set up the weather data integration.

## 🚀 Quick Start

1. **Enable Location Access**: Click the "Enable real weather" button in the app
2. **Allow Browser Location**: Grant location permission when prompted
3. **Automatic Data Fetching**: The system will automatically fetch current atmospheric conditions
4. **Enhanced Simulations**: All simulations will now use real atmospheric data

## 📡 Data Sources

### Primary Sources (Automatic)
- **Open-Meteo**: Free, reliable weather API with GFS data
- **USGS Elevation**: Accurate elevation data for the US
- **Open-Elevation**: Global elevation data

### Enhanced Sources (API Keys Required)
- **OpenWeatherMap**: Professional weather data with atmospheric profiles
- **WeatherAPI**: Commercial backup with historical data
- **NOAA GFS**: Direct access to Global Forecast System data
- **TimeZoneDB**: Accurate timezone information

## 🔑 API Key Setup

### 1. OpenWeatherMap (Recommended)
```bash
# Free tier: 1,000 calls/day
# Sign up at: https://openweathermap.org/api
NEXT_PUBLIC_OPENWEATHER_API_KEY=your-api-key-here
```

### 2. WeatherAPI (Backup)
```bash
# Free tier: 1 million calls/month
# Sign up at: https://www.weatherapi.com/
WEATHERAPI_KEY=your-api-key-here
```

### 3. TimeZoneDB (Optional)
```bash
# Free tier: 1 request/second
# Sign up at: https://timezonedb.com/api
NEXT_PUBLIC_TIMEZONE_API_KEY=your-api-key-here
```

### 4. NOAA (Advanced)
```bash
# Free, no rate limits
# Register at: https://www.ncdc.noaa.gov/cdo-web/webservices/v2
NEXT_PUBLIC_NOAA_API_KEY=your-api-key-here
```

## 🌤️ Weather Data Types

### Surface Conditions
- **Temperature**: Air temperature in °C
- **Pressure**: Atmospheric pressure in hPa
- **Humidity**: Relative humidity percentage
- **Wind Speed**: Wind speed in m/s
- **Wind Direction**: Wind direction in degrees
- **Visibility**: Visibility distance in km
- **Cloud Cover**: Cloud coverage percentage

### Atmospheric Profile
- **Multi-level Data**: Temperature, pressure, wind at different altitudes
- **Pressure Levels**: 1000, 925, 850, 700, 500, 300, 250, 200, 150, 100 hPa
- **Wind Components**: U (east) and V (north) wind components
- **Geopotential Height**: Altitude of pressure levels

### Location Data
- **Coordinates**: Precise latitude and longitude
- **Elevation**: Height above sea level in meters
- **City/Country**: Human-readable location names
- **Timezone**: Local timezone for accurate forecasting

## 🎯 Simulation Accuracy

### With Real Weather Data
- **Wind Effects**: Accurate wind drift calculations
- **Atmospheric Density**: Real density profiles affect drag
- **Temperature Effects**: Temperature impacts air density and motor performance
- **Pressure Variations**: Altitude-dependent pressure affects flight dynamics

### Launch Condition Assessment
- **Good Conditions**: Low wind, high visibility, stable atmosphere
- **Fair Conditions**: Moderate wind, some clouds, acceptable for experienced users
- **Poor Conditions**: High wind, low visibility, not recommended for launch

## 🔧 Technical Implementation

### Data Flow
```
User Location → Weather APIs → Atmospheric Profile → RocketPy Simulation
```

### Caching Strategy
- **Location Cache**: 5 minutes (user doesn't move often)
- **Weather Cache**: 30 minutes (weather changes slowly)
- **Elevation Cache**: Permanent (elevation doesn't change)

### Fallback System
1. **Primary**: Open-Meteo GFS data
2. **Secondary**: OpenWeatherMap data
3. **Tertiary**: WeatherAPI data
4. **Fallback**: Standard atmosphere with location adjustments

## 🌍 Global Coverage

### Supported Regions
- **Worldwide**: Basic weather data available globally
- **Enhanced US**: High-resolution HRRR data for US locations
- **Europe**: High-quality ECMWF data integration
- **Elevation**: Global coverage with regional accuracy improvements

### Data Resolution
- **Spatial**: 0.25° (approximately 25km) for GFS data
- **Temporal**: Hourly forecasts up to 7 days
- **Vertical**: 10+ pressure levels from surface to 100 hPa (~16km)

## 🚀 Usage Examples

### Basic Usage
```typescript
// Request location permission
const location = await requestLocationPermission();

// Get current weather
const weather = await getCurrentWeather(location);

// Weather data is automatically used in simulations
```

### Advanced Usage
```typescript
// Get weather for specific date
const futureWeather = await getWeatherForDate(
  new Date('2024-06-15'), 
  location
);

// Access atmospheric profile
const profile = weather.atmospheric;
console.log('Wind at 5km:', profile.windU[10], 'm/s');
```

## 🔍 Troubleshooting

### Location Permission Denied
- **Chrome**: Settings → Privacy → Location → Allow
- **Firefox**: Address bar → Location icon → Allow
- **Safari**: Settings → Websites → Location → Allow

### Weather Data Not Loading
1. Check internet connection
2. Verify API keys are correct
3. Check browser console for errors
4. Try refreshing the page

### Inaccurate Data
- Ensure location permission is granted
- Check if you're using a VPN (may affect location)
- Verify the location shown is correct
- Try refreshing weather data

## 📊 Data Quality Indicators

### High Quality (Green)
- Real-time GFS or HRRR data
- Recent observations (< 1 hour old)
- High-resolution atmospheric profile
- Accurate location and elevation

### Medium Quality (Yellow)
- Standard weather API data
- Estimated atmospheric profile
- Approximate elevation data
- Location accuracy within 1km

### Low Quality (Red)
- Standard atmosphere model
- No real weather data
- Sea level elevation assumed
- Generic atmospheric conditions

## 🎓 Educational Benefits

### Real-World Learning
- **Meteorology**: Understanding atmospheric conditions
- **Physics**: How weather affects rocket flight
- **Engineering**: Designing for real conditions
- **Safety**: Assessing launch conditions

### Curriculum Integration
- **STEM Classes**: Real data for physics calculations
- **Geography**: Understanding global weather patterns
- **Mathematics**: Statistical analysis of weather variations
- **Computer Science**: API integration and data processing

## 🔮 Future Enhancements

### Planned Features
- **Historical Weather**: Access to past weather data
- **Weather Forecasts**: Multi-day forecast integration
- **Severe Weather Alerts**: Automatic launch condition warnings
- **Custom Locations**: Manual location entry for remote sites
- **Weather Radar**: Real-time precipitation data
- **Upper Atmosphere**: Stratospheric wind data

### Advanced Models
- **Turbulence Modeling**: Realistic atmospheric turbulence
- **Thermal Effects**: Temperature gradient impacts
- **Seasonal Variations**: Long-term atmospheric patterns
- **Climate Data**: Historical climate averages

## 📞 Support

### Getting Help
- **Documentation**: Check this guide first
- **GitHub Issues**: Report bugs or request features
- **Community**: Join discussions about weather integration
- **API Support**: Contact weather API providers for API issues

### Contributing
- **Weather Sources**: Suggest new data sources
- **Accuracy Improvements**: Help improve data processing
- **Regional Data**: Contribute local weather knowledge
- **Testing**: Help test in different geographic regions

---

**Ready to launch with real weather data? Enable location access and experience the most accurate rocket simulations possible!** 🚀🌍 
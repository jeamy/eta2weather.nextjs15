# ETA to Ecowitt Weather Station Connector


A Next.js 15 application for connecting ETA and Ecowitt Weather Station to provide real-time temperature information for both indoor and outdoor temperatures, ETA system data, and control the ETA heating system.

Connects the temperature sensors of an Ecowitt weather station with an ETA heating system and takes over the temperature control of the heating system. Thus replaces an ETA room thermostat.

This project was developed using Windsurf, an advanced AI-powered development environment. The entire codebase was programmed through pair programming with Claude 3.5 Sonnet, making it a showcase of modern AI-assisted development.

> Optimized with GPT‑5, August 2025

Visit Windsurf at https://codeium.com/windsurf

## Features

- **Real-time System Monitoring**
  - Live ETA heating system data display
  - Weather station temperature readings
  - Background synchronization of data
  
- **Advanced Configuration**
  - Comprehensive system parameter management
  - Name-to-ID mapping functionality
  - Configurable update intervals
  - Temperature Control Features:
    - **Minimum Temperature Protection (`t_min`)**
      - Prevents room temperature from falling below specified threshold
      - Default value: 16°C
      - Configurable through settings interface
      - Automatically triggers heating when temperature drops below threshold
    - **ETA Strategy Control**
      - Enable/disable automatic temperature control via `f_eta` setting
      - Dynamic temperature adjustment based on:
        - Target temperature (`t_soll`)
        - Temperature delta (`t_delta`)
        - Slider position (`t_slider`)
      - Temperature override duration (`t_override`)
      - Configurable temperature difference threshold (`temp_diff`)
    - **Update Intervals**
      - System update timer (`t_update_timer`, default: 300000ms)
      - Minimum API interval protection
      - Automatic data synchronization
  
- **User Interface**
  - Modern, responsive design with Tailwind CSS
  - Tab-based navigation system
  - Editable Heating Time Windows (Zeitfenster)
    - 0–24h Timeline mit Tick-Linien alle 2h, markierten Hauptticks (0/6/12/18/24)
    - Draggable Segmente mit 15-Minuten-Snapping
    - Überlappungen verhindert durch Clamping an Nachbarfenstern
    - Tooltip-Bubble mit exakter Zeitspanne (Hover, Fokus, Tap‑Toggle)
    - Touch-Unterstützung (Pointer Events) inkl. `touch-action: none`
    - Sichtbare Griffe an Segment-Enden für besseres Zielen
    - Visuelle Kollision: roter Ring + kurzes Shake beim Limit
    - Gesteuerte Eingaben (controlled inputs) synchron zur Timeline
    - API-Integration über `API.ETA_UPDATE`
  - Interactive header with menu navigation
  - Detailed logging interface
  
- **Data Management**
  - Redux-based state management
  - Efficient background data synchronization
  - Type-safe data handling with TypeScript

- **Interactive Charts**
  - Real-time visualization of temperature and humidity data
  - Responsive Chart.js integration with zoom functionality
  - Custom styling with Geist Mono font
  - Multiple chart views:
    - Main chart (temperature, pressure, humidity)
    - Channel temperature chart
    - Channel humidity chart
  - Interactive features:
    - Zoom reset functionality
    - Custom tooltips with formatted timestamps
    - Zero line indicators for temperature charts
  
- **Performance Optimization**
  - Client-side only chart rendering to prevent SSR issues
  - Memory leak prevention through:
    - Proper cleanup of chart instances
    - Dynamic imports for heavy components
    - Efficient data structure management
  - TypeScript for enhanced type safety
  
- **Logging System**
  - Organized log files by type and date
  - Interactive log viewer interface
  - Filterable log categories
  - Accessible via dedicated `/logs` route
  
- **API Integration**
  - ETA heating system API integration
  - Weather station (WifiAf83) data retrieval
  - Real-time data updates

## Pages and Features

### Main Dashboard (/)
The main dashboard provides a comprehensive overview of your heating and weather system:
- Current indoor and outdoor temperatures
- System status indicators
- Quick access to essential controls
- Tab-based navigation between different views:
  - Temperature Control: Manage heating settings and view current status
  - Weather Data: Display current weather station readings
  - System Status: Monitor overall system health

### Weather Graphs (/weather)
Detailed weather visualization and analysis:
- Interactive temperature and humidity graphs
- Multiple time range options (24h, 7d, 30d)
- Pressure trends and analysis
- Channel-specific data views
- Zoom and pan capabilities
- Custom tooltips with detailed information
- Auto-scaling axes
- Mobile-responsive layout

### Raw ETA Data (/raw-eta)
Direct access to the ETA heating system's raw data:
- Complete hierarchical view of all system parameters
- Search functionality for both URIs and parameter names
- Expandable/collapsible sections for better organization
- Real-time data updates with 1-minute cache
- XML data parsing with structured display
- Quick access to both raw and parsed values
- Mobile-optimized interface with menu below data on smaller screens

### System Logs (/logs)
Comprehensive logging system for monitoring and debugging:
- Categorized log entries (System, ETA, Weather)
- Time-stamped entries with severity levels
- Filterable log views
- Real-time log updates
- Log file navigation and selection
- Downloadable log files
- Color-coded severity levels
- Search functionality within logs

## Technical Details

- **Framework**: Next.js 15.0.3
- **UI Components**: React 18.2.0
- **State Management**: Redux with @reduxjs/toolkit 2.3.0
- **Styling**: Tailwind CSS
- **Server**: Custom Node.js server with background services
- **Development**: 
  - TypeScript for type safety
  - ESLint for code quality
  - Cross-env for environment management

## Project Structure

```
eta2weather.nextjs15/
├── src/
│   ├── app/                    # Next.js app pages and API routes
│   │   ├── api/               # API endpoints
│   │   │   ├── background/    # Background service endpoints
│   │   │   ├── config/       # Configuration endpoints
│   │   │   ├── eta/         # ETA system endpoints
│   │   │   ├── logs/        # Logging endpoints
│   │   │   ├── weather/     # Weather data endpoints
│   │   │   └── wifiaf83/    # WiFi sensor endpoints
│   │   ├── fonts/           # Custom fonts (Geist, GeistMono)
│   │   ├── logs/            # Logs page component
│   │   ├── raw-eta/         # Raw ETA data page
│   │   ├── weather/         # Weather graphs page
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout component
│   │   └── page.tsx         # Main dashboard page
│   ├── components/          # React components
│   │   ├── BackgroundSync   # Background data synchronization
│   │   ├── ConfigData       # Configuration management
│   │   ├── EtaData         # ETA system interface
│   │   ├── Header          # App navigation header
│   │   ├── MenuPopup       # Navigation menu
│   │   ├── Names2IdData    # Name mapping interface
│   │   └── WifiAf83Data    # Weather station interface
│   ├── config/             # Configuration files
│   │   ├── f_eta.json      # ETA system config
│   │   ├── f_etacfg.json   # General config
│   │   ├── f_etamenu.json  # ETA menu structure
│   │   ├── f_names2id.json # Name to ID mappings
│   │   └── f_wifiaf89.json # WiFi sensor config
│   ├── hooks/              # Custom React hooks
│   │   └── useEtaData      # ETA data management hook
│   ├── lib/                # Core libraries
│   │   └── backgroundService # Background processing service
│   ├── reader/             # Data processing & API
│   │   └── functions/      # Core functionality
│   │       ├── EtaApi      # ETA system API client
│   │       ├── SetEta      # ETA control functions
│   │       ├── WifiAf83Api # Weather station API
│   │       └── types-constants/ # Type definitions
│   └── redux/              # State management
│       ├── configSlice     # Configuration state
│       ├── dataSlice      # Data management
│       ├── etaSlice       # ETA system state
│       └── wifiAf83Slice  # Weather data state
├── public/                # Static files
│   └── screen/           # Screenshot images
├── linux/                # Linux service files
├── windows/              # Windows service files
└── macos/                # macOS service files
```

## Screenshots and Features

### Main Dashboard (M1-M3)
![Main Dashboard Overview](public/screen/m1.png)
*Main dashboard showing current temperature, humidity, and system status*

![Temperature Control](public/screen/m2.png)
*Temperature control interface with tabs and current settings*

![System Status](public/screen/m3.png)
*Detailed system status indicators and controls*

### Weather Graphs (W1-W2)
![Weather Overview](public/screen/w1.png)
*Comprehensive weather data visualization showing temperature, humidity, and pressure trends*

![Channel Data](public/screen/w2.png)
*Individual channel temperature and humidity data with interactive zoom*

The weather graphs provide:
- Real-time temperature, humidity, and pressure visualization
- Interactive zooming and panning
- Multiple time range options
- Custom tooltips with detailed information
- Zero-line indicators for temperature reference
- Automatic scale adjustment
- Channel-specific data views
- Mobile-responsive design

### Raw Data Interface (R1)
![Raw Data View](public/screen/r1.png)
*Structured view of raw ETA system data*

The raw data interface features:
- Hierarchical display of all ETA system parameters
- Search functionality for both URIs and parameter names
- Expandable/collapsible sections for better organization
- Real-time data updates with 1-minute cache
- Clear visualization of value types and units
- Mobile-friendly responsive design
- XML data parsing and structured display
- Quick access to both raw and parsed values

### Log Data (L1-L2)
![Log Overview](public/screen/l1.png)
*Log data overview with filtering options*

![Detailed Logs](public/screen/l2.png)
*Detailed log entries with timestamp and category information*

## Setup and Installation

1. Clone the repository
2. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```
   Update the server address in `.env`:
   ```bash
   DEFAULT_CONFIG_FILE='./config/f_etacfg.json'
   DEFAULT_SERVER='192.x.x.x:8080'  # Replace with your server address
   ```
3. Configure Ecowitt API (if using weather station):
   ```bash
   cp eco.example.tsx eco.ts
   ```
   Update with your Ecowitt credentials:
   ```typescript
   config: {
     applicationKey: "XXX", // From Ecowitt API Settings
     apiKey: "XXX",        // Generated API Key
     mac: "XXX",           // Device MAC Address
     server: "api.ecowitt.net"
   }
   ```
   See `eco.example.ts` for detailed instructions on obtaining API credentials.

4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```

## API Documentation

### ETA System Endpoints

#### Read Operations
- `GET /api/eta/read`: Retrieves current ETA system data
- `GET /api/eta/raw`: Fetches raw ETA system data with XML values
- `GET /api/eta/menu`: Gets the ETA menu structure
- `GET /api/eta/readMenuData`: Retrieves specific menu item data
- `POST /api/eta/readBatchMenuData`: Batch retrieves menu data for multiple URIs
  ```typescript
  // Request body
  {
    "uris": string[]  // Array of URIs to fetch
  }
  ```

#### Update Operations
- `POST /api/eta/update`: Updates ETA system values
  ```typescript
  // Request body
  {
    "id": string,     // Parameter ID
    "value": string,  // New value
    "begin"?: string, // Optional start time (default: "0")
    "end"?: string    // Optional end time (default: "0")
  }
  ```

### Weather Data Endpoints

#### Read Operations
- `GET /api/weather`: Retrieves weather data with optional date range
  - Query params: `range` (e.g., "24h", "7d", "30d")
- `GET /api/wifiaf83/read`: Gets current WiFi sensor data
- `GET /api/wifiaf83/all`: Retrieves all available WiFi sensor data

### Configuration Endpoints

#### Read Operations
- `GET /api/config/read`: Retrieves current configuration
- `GET /api/names2id/read`: Gets name-to-ID mappings

#### Update Operations
- `POST /api/config/update`: Updates configuration values
  ```typescript
  // Request body
  {
    "key": string,   // Configuration key
    "value": string  // New value
  }
  ```
- `POST /api/channelnames`: Updates channel names
  ```typescript
  // Request body
  {
    [channelId: string]: string  // Map of channel IDs to names
  }
  ```

### System Status Endpoints

- `GET /api/background/status`: Retrieves background service status
- `GET /api/logs`: Fetches system logs
- `GET /api/logs/[...path]`: Retrieves specific log files
  - Path params: Supports nested paths for specific log files

### Response Format

All API endpoints follow a consistent response format:

#### Success Response
```typescript
{
  "success": true,
  "data": {
    // Response data specific to the endpoint
  }
}
```

#### Error Response
```typescript
{
  "success": false,
  "error": string  // Error message
}
```

### Rate Limiting and Caching

- Raw data endpoints implement 1-minute caching
- Weather data is cached based on update intervals
- Background sync prevents excessive API calls
- Batch operations available for multiple data points

### Error Handling

All endpoints implement proper error handling with appropriate HTTP status codes:
- 200: Successful operation
- 400: Bad request (invalid parameters)
- 404: Resource not found
- 500: Internal server error

## Recent Updates

### Editable Heating Time Windows (August 2025)

- 0–24h Timeline pro Wochentag mit klaren Tick-Linien (alle 2h) und beschrifteten Hauptticks
- Drag & Resize der Zeitfenster mit 15‑Minuten‑Raster, bidirektional synchron mit Zeit‑Eingabefeldern
- Anti‑Overlap: Clamping verhindert Überschneidungen zwischen Zeitfenstern desselben Tages
- Verbesserte Tooltips: stilisierte Bubble oberhalb des Segments; auf Touch per Tap explizit toggelbar
- Mobile optimiert: Pointer Events, Scroll‑Unterdrückung während des Drags
- Sichtbare End‑Griffe zur besseren Entdeckbarkeit
- Visuelles Feedback bei Kollision (roter Ring + kurzes Shake)
- Beibehaltener API‑Flow über `API.ETA_UPDATE` mit 15‑Minuten‑Indizes (0–96)

### Enhanced Temperature Control System

- **Intelligent Mode Switching**
  - Automatic switching between comfort mode (`KT`) and auto mode (`AA`) based on temperature thresholds
  - Smart override prevention during manual control
  - Smooth transition between heating modes

- **Temperature Monitoring Improvements**
  - Real-time indoor temperature tracking with 0.1°C precision
  - Configurable minimum temperature threshold
  - Automatic temperature difference calculation and logging
  - State persistence across system restarts

- **System Protection Features**
  - Button state validation before mode changes
  - Graceful error handling for API communication
  - Automatic recovery from connection issues
  - Memory usage optimization with periodic cleanup

- **Performance Optimizations**
  - Batch processing for ETA system data updates
  - Configurable update intervals with minimum API call protection
  - Efficient data storage with automatic outdated data cleanup
  - Reduced server load through smart polling

## Docker Usage

### Prerequisites

1. Configure the environment file:
   ```bash
   cp .env.example .env
   ```
   Update the `.env` file with your settings:
   ```env
   DEFAULT_CONFIG_FILE='./config/f_etacfg.json'
   DEFAULT_SERVER='192.x.x.x:8080'  # Your ETA server address
   ```

2. Configure Ecowitt settings:
   ```bash
   cp eco.example.tsx eco.tsx
   ```
   Update `eco.tsx` with your Ecowitt credentials:
   ```typescript
   config: {
     applicationKey: "XXX", // From Ecowitt API Settings
     apiKey: "XXX",        // Your generated API Key
     mac: "XXX",           // Your device MAC Address
     server: "api.ecowitt.net"
   }
   ```

### Running with Docker

You can run this application using Docker in two ways:

#### Using Docker Directly

1. Build the Docker image:
   ```bash
   docker build -t eta2weather .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 eta2weather
   ```

#### Using Docker Compose

1. Build and start the container:
   ```bash
   docker-compose up -d
   ```

2. Stop the container:
   ```bash
   docker-compose down
   ```

The application will be available at `http://localhost:3000`.

Note: The Docker build process will include your configured `.env` and `eco.tsx` files in the image. Make sure these files are properly configured before building the image.

## Automatic Startup with systemd

A systemd service file is provided in the `linux` directory to automatically start the application on system boot.

### Important: File Path Configuration

Before installing the service, ensure you update the file paths in the startup scripts to match your system:

1. Edit `linux/eta2weather.service`:
   ```ini
   [Service]
   # Update these paths to match your installation
   WorkingDirectory=/path/to/your/eta2weather.nextjs15
   ExecStart=/usr/bin/npm start
   ```

2. Edit `install.sh` and `uninstall.sh`:
   ```bash
   # Update the SOURCE_DIR to match your installation path
   SOURCE_DIR="/path/to/your/eta2weather.nextjs15"
   ```

### Installation Steps

1. Make the scripts executable:
```bash
chmod +x install.sh uninstall.sh
```

2. Update file paths in the service file and scripts as described above.

3. Install the service:
```bash
./install.sh
```

The service will now start automatically on system boot.

### Service Management

- Check service status:
```bash
systemctl status eta2weather
```

- Start the service:
```bash
systemctl start eta2weather
```

- Stop the service:
```bash
systemctl stop eta2weather
```

- Restart the service:
```bash
systemctl restart eta2weather
```

- View service logs:
```bash
journalctl -u eta2weather
```

- Uninstall the service:
```bash
./uninstall.sh
```

## Automatic Startup on Windows

A PowerShell script is provided in the `windows` directory to set up the application as a Windows service using NSSM (Non-Sucking Service Manager).

### Prerequisites

1. Install NSSM:
   - Download NSSM from https://nssm.cc/download
   - Extract the appropriate version (32/64 bit) to `C:\nssm`
   - Add `C:\nssm` to your system's PATH environment variable

2. Ensure Docker Desktop is installed and set to start with Windows

### Installation

1. Open PowerShell as Administrator

2. Navigate to the project's windows directory:
```powershell
cd path\to\project\windows
```

3. Run the installation script:
```powershell
.\install-service.ps1
```

4. Start the service:
```powershell
Start-Service DockerComposeETA
```

### Managing the Service

- Check service status:
```powershell
Get-Service DockerComposeETA
```

- Stop the service:
```powershell
Stop-Service DockerComposeETA
```

- Uninstall the service:
```powershell
.\uninstall-service.ps1
```

The service is configured to start automatically with Windows and will manage the Docker Compose application lifecycle.

## Automatic Startup on macOS

The application can be configured to start automatically on macOS using a Launch Agent. Installation scripts are provided in the `osx` directory.

### Prerequisites

1. Ensure Docker Desktop for Mac is installed and configured to start at login
2. Make sure docker-compose is installed and available at `/usr/local/bin/docker-compose`

### Installation

1. Open Terminal and navigate to the project's osx directory:
```bash
cd path/to/project/osx
```

2. Make the scripts executable:
```bash
chmod +x install.sh uninstall.sh
```

3. Run the installation script:
```bash
./install.sh
```

The service will start automatically and will be configured to launch on login.

### Managing the Service

- Check if the service is running:
```bash
launchctl list | grep com.etaweather.docker-compose
```

- Stop the service:
```bash
launchctl unload ~/Library/LaunchAgents/com.etaweather.docker-compose.plist
```

- Start the service:
```bash
launchctl load ~/Library/LaunchAgents/com.etaweather.docker-compose.plist
```

- View logs:
```bash
tail -f ~/Library/Logs/etaweather-docker-compose.log
tail -f ~/Library/Logs/etaweather-docker-compose.err
```

- Uninstall the service:
```bash
./uninstall.sh

## License

MIT License

Copyright (c) 2024 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
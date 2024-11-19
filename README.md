# ETA to Ecowitt Weather StationConnector

A Next.js 15 application for visualizing ETA and Ecowitt Weather Data in a clean, structured format.

## Features

- **Configuration Display**: View and manage ETA system configuration
- **ETA Data Visualization**: Display ETA data with custom sorting and formatting
- **Ecowitt Weather Information**: Show indoor and outdoor temperature readings
- **Real-time Updates**: Automatic data refresh capabilities
- **Responsive Layout**: Clean, grid-based design for optimal viewing

## Technology Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **State Management**: Redux
- **Styling**: Tailwind CSS
- **API**: RESTful endpoints for data retrieval

## Project Structure

```
eta2weather.nextjs15/
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   │   ├── ConfigData.tsx
│   │   ├── EtaData.tsx
│   │   └── WifiAf83Data.tsx
│   ├── config/          # Configuration files
│   │   ├── f_eta.json
│   │   └── f_etacfg.json
│   ├── pages/          # API routes
│   │   └── api/
│   ├── reader/         # Data processing
│   │   └── functions/
│   └── redux/          # State management
```

## Data Display

### Configuration Data
- System parameters display
- Clean tabular format
- Right-aligned values

### ETA Data
- Custom sorting (SP, AT, KZ, VT, HK priority)
- Filtered empty entries
- Formatted display: `short : long: value unit`

### Ecowitt Weather Data
- Indoor/Outdoor temperature readings
- German date format
- Difference tracking

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
   cp eco.example.tsx eco.tsx
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
   See `eco.example.tsx` for detailed instructions on obtaining API credentials.

4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```

## API Documentation

### Ecowitt API
The weather station data is retrieved using the Ecowitt API v3. For detailed information about the API endpoints and parameters, refer to the [official Ecowitt API documentation](https://doc.ecowitt.net/web/#/apiv3en?page_id=17).

### ETA API
The heating system data is managed through the ETA RESTful API. For comprehensive documentation about the available endpoints and their usage, see the [ETA RESTful API documentation](https://www.meineta.at/javax.faces.resource/downloads/ETA-RESTful-v1.2.pdf.xhtml?ln=default&v=0).

## Development

### API Endpoints

#### Read Endpoints
- `/api/config/read`: Retrieves the current configuration data.
- `/api/eta/read`: Retrieves the ETA system data.
- `/api/wifiaf83/read`: Retrieves the weather and temperature data.
- `/api/names2id/read`: Retrieves the names to ID mapping data.

#### Update Endpoints
- `/api/config/update`: Updates configuration values
  ```typescript
  // POST request
  {
    "key": string,   // One of the ConfigKeys values
    "value": string  // New value for the config key
  }
  ```

  Available config keys:
  - `t_soll`: Target temperature (default: "22")
  - `t_delta`: Temperature delta (default: "0")
  - `t_slider`: Slider position (default: "0.0")
  - `f_eta`: ETA configuration file (default: "f_eta.json")
  - `s_eta`: ETA server address (default: "192.168.8.100:8080")
  - `f_wifiaf83`: WiFi sensor config file (default: "f_wifiaf89.json")
  - `f_names2id`: Names to ID mapping file (default: "f_names2id.json")
  - `t_update_timer`: Update interval in ms (default: "300000")
  - `diff`: Temperature difference (default: "0")

  Response:
  ```typescript
  // Success (200 OK)
  {
    ...updatedConfig // Full updated configuration object
  }

  // Error (400 Bad Request)
  {
    "error": "Invalid config key" | "Value must be a string"
  }

  // Error (500 Internal Server Error)
  {
    "error": "Internal Server Error",
    "message": string,
    "type": string
  }
  ```

### Component Structure

- **ConfigData**: System configuration display
- **EtaData**: ETA system data visualization
- **WifiAf83Data**: Weather information display

### Styling

- Consistent table widths (400px)
- Fixed column sizes (250px + 150px)
- Responsive grid layout
- Monospace fonts for values
- Right-aligned numeric data

## License

[Add License Information]

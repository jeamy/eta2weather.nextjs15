# ETA Weather Data Visualization

A Next.js 15 application for visualizing ETA and weather data in a clean, structured format.

## Features

- **Configuration Display**: View and manage ETA system configuration
- **ETA Data Visualization**: Display ETA data with custom sorting and formatting
- **Weather Information**: Show indoor and outdoor temperature readings
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

### Weather Data
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

## Development

### API Endpoints

#### Read Endpoints
- `/api/config/read`: Retrieves the current configuration data.
- `/api/eta/read`: Retrieves the ETA system data.
- `/api/wifiaf83/read`: Retrieves the weather and temperature data.
- `/api/names2id/read`: Retrieves the names to ID mapping data.

#### Update Endpoints
- `/api/config/update`: Updates the configuration values.
  ```typescript
  // POST request body
  {
    "key": "t_soll" | "t_delta" | "t_update_timer" | "s_eta" | "f_eta" | "f_wifiaf83" | "f_names2id",
    "value": string
  }
  ```
  Validates:
  - Temperature values (10-25°C for t_soll, -5-5°C for t_delta)
  - Update timer (0-10 minutes, stored in milliseconds)
  - Server address (IPv4 with optional port)

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

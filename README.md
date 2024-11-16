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
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Development

### API Endpoints

- `/api/config`: Configuration data
- `/api/eta`: ETA system data
- `/api/wifi`: Weather and temperature data

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

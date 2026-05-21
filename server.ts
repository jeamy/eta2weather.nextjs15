import { createServer } from 'node:http';
import next from 'next';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

let server: Server | null = null;

async function startServer() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  try {
    await app.prepare();
    
    // Import and initialize background service
    const { BackgroundService } = await import('./src/lib/backgroundService.js');
    console.log('Initializing background service');
    const backgroundService = BackgroundService.getInstance();
    await backgroundService.start();
    console.log('Background service initialized successfully');

    server = createServer(async (req, res) => {
      try {
        const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || `${hostname}:${port}`}`);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    }).listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

// Add cleanup function for graceful shutdown
async function cleanup() {
  console.log('Shutting down server...');
  if (server) {
    await new Promise((resolve) => server!.close(resolve));
    server = null;
  }
  
  const { BackgroundService } = await import('./src/lib/backgroundService.js');
  const backgroundService = BackgroundService.getInstance();
  await backgroundService.stop();
  console.log('Server shutdown complete');
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

startServer();

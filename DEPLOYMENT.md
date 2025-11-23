# 🚀 Deployment Guide - eta2weather

## Quick Start (Recommended)

### 1. Build & Deploy with Docker Compose

```bash
# Build Next.js and create Docker image
bash build-prebuilt.sh

# Start the application
docker-compose -f docker-compose.prebuilt.yml up -d
```

### 2. Check Status

```bash
# View logs
docker-compose -f docker-compose.prebuilt.yml logs -f

# Check health
curl http://localhost:3000/api/health
```

---

## Deployment Options

### Option 1: Docker Compose (Recommended) 🌟

**Advantages:**
- ✅ Easy management (start/stop/restart)
- ✅ Automatic restart on failure
- ✅ Health checks included
- ✅ Volume management
- ✅ Easy updates

**Commands:**
```bash
# Start
docker-compose -f docker-compose.prebuilt.yml up -d

# Stop
docker-compose -f docker-compose.prebuilt.yml down

# Restart
docker-compose -f docker-compose.prebuilt.yml restart

# View logs
docker-compose -f docker-compose.prebuilt.yml logs -f

# Update (after rebuild)
docker-compose -f docker-compose.prebuilt.yml up -d --force-recreate
```

---

### Option 2: Docker Run (Simple)

**Use when:**
- Quick testing
- No need for automatic restart
- Minimal setup

**Command:**
```bash
docker run -d \
  --name eta2weather \
  -p 3000:3000 \
  -v $(pwd)/db:/db \
  -v $(pwd)/public/log:/app/public/log \
  -v $(pwd)/src/config:/app/src/config \
  --restart unless-stopped \
  eta2weather
```

**Management:**
```bash
# Stop
docker stop eta2weather

# Start
docker start eta2weather

# Remove
docker rm -f eta2weather

# Logs
docker logs -f eta2weather
```

---

## Build Options

### Pre-Built Approach (Current)

**When to use:**
- ✅ Limited Docker build memory
- ✅ Faster Docker builds
- ✅ More control over build process

**Steps:**
```bash
# 1. Build locally
npm install --legacy-peer-deps
npm run build

# 2. Create Docker image
bash build-prebuilt.sh

# 3. Deploy
docker-compose -f docker-compose.prebuilt.yml up -d
```

---

### Standard Docker Build

**When to use:**
- Sufficient Docker build memory (8GB+)
- CI/CD pipelines
- Automated builds

**Files:**
- `Dockerfile` - Standard build (6GB memory)
- `Dockerfile.8gb` - High memory build (8GB)

**Command:**
```bash
# Standard (6GB)
docker build -t eta2weather .

# High memory (8GB)
docker build -f Dockerfile.8gb -t eta2weather .
```

---

## Configuration

### Environment Variables

Set in `docker-compose.prebuilt.yml` or pass to `docker run`:

```yaml
environment:
  - NODE_ENV=production
  - DATABASE_PATH=/db/eta2weather.db
  - PORT=3000
```

### Volumes

| Host Path | Container Path | Purpose |
|-----------|---------------|---------|
| `./db` | `/db` | SQLite database |
| `./public/log` | `/app/public/log` | Application logs |
| `./src/config` | `/app/src/config` | Configuration files |

---

## Troubleshooting

### Build Issues

**Problem:** `npm run build` fails with OOM
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=8192"
npm run build
```

**Problem:** Docker build fails
```bash
# Use pre-built approach instead
bash build-prebuilt.sh
```

### Runtime Issues

**Problem:** Container won't start
```bash
# Check logs
docker-compose -f docker-compose.prebuilt.yml logs

# Check health
docker inspect eta2weather | grep Health
```

**Problem:** Permission errors
```bash
# Fix volume permissions
sudo chown -R $USER:$USER ./db ./public/log ./src/config
```

---

## Updates

### Update Application

```bash
# 1. Pull latest code
git pull

# 2. Rebuild
bash build-prebuilt.sh

# 3. Recreate container
docker-compose -f docker-compose.prebuilt.yml up -d --force-recreate
```

### Update Dependencies

```bash
# 1. Update packages
npm update

# 2. Rebuild
npm run build
bash build-prebuilt.sh

# 3. Deploy
docker-compose -f docker-compose.prebuilt.yml up -d --force-recreate
```

---

## Health Check

The application includes a health check endpoint:

```bash
# Check via curl
curl http://localhost:3000/api/health

# Check Docker health status
docker inspect eta2weather | grep -A 10 Health
```

---

## Production Checklist

- [ ] Environment variables configured
- [ ] Volumes properly mounted
- [ ] Health check passing
- [ ] Logs accessible
- [ ] Automatic restart enabled
- [ ] Firewall configured (if needed)
- [ ] Reverse proxy configured (if needed)
- [ ] SSL/TLS configured (if needed)

---

## Support

For issues or questions:
1. Check logs: `docker-compose -f docker-compose.prebuilt.yml logs`
2. Check health: `curl http://localhost:3000/api/health`
3. Review this guide
4. Check GitHub issues

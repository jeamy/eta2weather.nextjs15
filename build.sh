### Option 1: Standard Dockerfile (6GB Memory) ✅
# ENV NODE_OPTIONS="--max-old-space-size=6144"
# docker build -t eta2weather .

### 8b
#docker build -f Dockerfile.8gb -t eta2weather .

### default  local
# docker build -t eta2weather .
npm install
npm run build
docker build -f Dockerfile.prebuilt -t eta2weather .

# Kubernetes Deployment Guide

This guide helps you deploy the chatbot to a Kubernetes cluster.

## Error: "Sorry, I encountered an error processing your request"

This error typically occurs when the frontend can't reach the APIs. Here's how to fix it:

### 1. Check Browser Console

Open the browser console (F12) and look for error messages:
- `Failed to connect to Ollama` - Ollama API is unreachable
- `Stock API error` - Stock API is unreachable
- `CORS error` - Cross-origin request blocked

### 2. Environment Variables

The chatbot uses these environment variables (configured at build time):

```bash
VITE_OLLAMA_URL=http://llm.apexkube.xyz/api
VITE_STOCK_API_URL=http://stockapi.apexkube.xyz/api
VITE_OLLAMA_MODEL=llama3.2:1b
```

For Kubernetes, you need to set these to the correct service URLs.

### 3. Kubernetes Service URLs

If your APIs are in the same cluster, use Kubernetes service names:

```bash
# Ollama service
VITE_OLLAMA_URL=http://ollama-service.monitoring.svc.cluster.local:11434/api

# Stock API service
VITE_STOCK_API_URL=http://mcp-stock-server.monitoring.svc.cluster.local:8000/api
```

### 4. Building with Environment Variables

#### Option A: Build-time Environment Variables

Create a `.env.production` file:
```bash
VITE_OLLAMA_URL=http://llm.apexkube.xyz/api
VITE_STOCK_API_URL=http://stockapi.apexkube.xyz/api
VITE_OLLAMA_MODEL=llama3.2:1b
```

Then build:
```bash
npm run build
```

#### Option B: Use Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chatbot-config
data:
  VITE_OLLAMA_URL: "http://ollama-service.monitoring.svc.cluster.local:11434/api"
  VITE_STOCK_API_URL: "http://mcp-stock-server.monitoring.svc.cluster.local:8000/api"
```

Then reference in your Dockerfile:
```dockerfile
# Build stage
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build args from ConfigMap
ARG VITE_OLLAMA_URL
ARG VITE_STOCK_API_URL

ENV VITE_OLLAMA_URL=$VITE_OLLAMA_URL
ENV VITE_STOCK_API_URL=$VITE_STOCK_API_URL

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 5. Example Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chatbot
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: chatbot
  template:
    metadata:
      labels:
        app: chatbot
    spec:
      containers:
      - name: chatbot
        image: your-registry/chatbot:latest
        ports:
        - containerPort: 80
        env:
        - name: VITE_OLLAMA_URL
          value: "http://ollama-service.monitoring.svc.cluster.local:11434/api"
        - name: VITE_STOCK_API_URL
          value: "http://mcp-stock-server.monitoring.svc.cluster.local:8000/api"
---
apiVersion: v1
kind: Service
metadata:
  name: chatbot-service
  namespace: monitoring
spec:
  selector:
    app: chatbot
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

### 6. CORS Configuration

If you're getting CORS errors, you need to configure NGINX to proxy requests:

Create `nginx.conf`:
```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy Ollama API
    location /api/ollama/ {
        proxy_pass http://ollama-service.monitoring.svc.cluster.local:11434/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Proxy Stock API
    location /api/stock/ {
        proxy_pass http://mcp-stock-server.monitoring.svc.cluster.local:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then use `/api/ollama` and `/api/stock` in your environment variables:
```bash
VITE_OLLAMA_URL=/api/ollama
VITE_STOCK_API_URL=/api/stock
```

### 7. Testing the Deployment

After deployment, test the APIs:

```bash
# Test Ollama API
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://ollama-service.monitoring.svc.cluster.local:11434/api/tags

# Test Stock API
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://mcp-stock-server.monitoring.svc.cluster.local:8000/api/health/
```

### 8. Debugging

Check the browser console logs for:
- `🔧 Ollama Config: { url: '...', model: '...' }`
- `🔧 Stock API Config: { url: '...' }`
- `📡 Calling Ollama: ...`
- `📡 Calling Stock API: ...`

These logs show which URLs the app is using and help debug connectivity issues.

### 9. Common Issues

**Issue**: "Failed to connect to Ollama"
- **Solution**: Check if the Ollama service is running and accessible
- **Test**: `kubectl get svc -n monitoring | grep ollama`

**Issue**: "Stock API error: 404"
- **Solution**: Verify the Stock API service is deployed and healthy
- **Test**: `kubectl get pods -n monitoring | grep stock`

**Issue**: CORS errors
- **Solution**: Use NGINX proxy or configure CORS headers on the API services

**Issue**: APIs work locally but not in Kubernetes
- **Solution**: Use correct service DNS names instead of external URLs

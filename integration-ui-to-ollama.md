# Integration: UI to Ollama Service

This document explains how the React chatbot UI communicates with the Ollama LLM service running in Kubernetes.

## Request Flow: Browser → Ollama

### 1. **User types in browser** (http://wooodez.apexkube.xyz)
```
User Browser
  ↓ Types message: "Hello"
  ↓ React app calls: fetch('/api/ollama/generate', {...})
```

**Source**: [src/services/ollamaApi.js:1,5](src/services/ollamaApi.js#L1)

### 2. **Browser makes HTTP request**
```
POST http://wooodez.apexkube.xyz/api/ollama/generate
Headers:
  - Content-Type: application/json
Body:
  {
    "model": "llama3.2:1b",
    "prompt": "Hello",
    "stream": false
  }
```

### 3. **Request hits Nginx Ingress Controller**
```
Nginx Ingress Controller (on cluster)
  ↓ Matches host: wooodez.apexkube.xyz
  ↓ Routes to Service: chatbot (port 8080)
```

### 4. **Service routes to Chatbot Pod**
```
Service: chatbot (monitoring namespace)
  ↓ ClusterIP: forwards to pod
  ↓ Container port: 8080
```

### 5. **Nginx inside Chatbot Pod processes request**
```
Nginx (inside chatbot-6bbf678c68-tgjtn pod)
  ↓ Receives: POST /api/ollama/generate
  ↓ Matches location: /api/ollama/ (nginx.conf:8)
  ↓ Proxy pass to: http://k8s-ollama-app.monitoring.svc.cluster.local:11434/api/
  ↓ Rewrites URL: /api/ollama/generate → /api/generate
```

**Source**: [nginx.conf:8-17](nginx.conf#L8-L17)

### 6. **Proxy reaches Ollama Service**
```
Service: k8s-ollama-app (monitoring namespace)
  ↓ ClusterIP: 10.100.30.45:11434
  ↓ Routes to Ollama Pod: k8s-ollama-app-d789644b-g7s29
```

### 7. **Ollama processes the request**
```
Ollama Pod
  ↓ Receives: POST /api/generate
  ↓ Processes with model: llama3.2:1b
  ↓ Generates response
```

### 8. **Response travels back**
```
Ollama → Nginx (chatbot pod) → Ingress Controller → Browser
Response:
  {
    "model": "llama3.2:1b",
    "response": "Hello! How can I help you?",
    "done": true,
    ...
  }
```

## Visual Diagram

```
┌─────────────────┐
│  Browser        │
│  (User)         │
└────────┬────────┘
         │ POST /api/ollama/generate
         ↓
┌─────────────────────────────────┐
│ Nginx Ingress Controller        │
│ (wooodez.apexkube.xyz)          │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Service: chatbot                │
│ Port: 8080                      │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Pod: chatbot-6bbf678c68-tgjtn   │
│ ┌─────────────────────────────┐ │
│ │ Nginx Container             │ │
│ │ (nginx.conf)                │ │
│ │                             │ │
│ │ location /api/ollama/       │ │
│ │   proxy_pass →              │ │
│ └─────────────┬───────────────┘ │
└───────────────┼─────────────────┘
                │
                │ Cluster network
                ↓
┌─────────────────────────────────┐
│ Service: k8s-ollama-app         │
│ Port: 11434                     │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Pod: k8s-ollama-app-...         │
│ ┌─────────────────────────────┐ │
│ │ Ollama Container            │ │
│ │ Listening on :11434         │ │
│ │ Endpoint: /api/generate     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## Key Components

### Frontend Configuration
**File**: `src/services/ollamaApi.js`

```javascript
const OLLAMA_BASE_URL = '/api/ollama';
const MODEL = 'llama3.2:1b';

export async function sendMessage(prompt) {
  const response = await fetch(`${OLLAMA_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}
```

### Nginx Proxy Configuration
**File**: `nginx.conf`

```nginx
server {
    listen 8080;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Proxy Ollama API requests to avoid CORS
    location /api/ollama/ {
        proxy_pass http://k8s-ollama-app.monitoring.svc.cluster.local:11434/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Why This Architecture?

### 1. **No CORS Issues**
The browser only communicates with `wooodez.apexkube.xyz`, not a different domain. All requests stay within the same origin.

### 2. **Security**
- Ollama service is not exposed publicly
- Only accessible within the Kubernetes cluster
- Nginx acts as a controlled proxy/gateway

### 3. **Simplicity**
- No separate backend API service needed
- Nginx handles routing and proxying
- Single deployment for both UI and API proxy

### 4. **URL Rewriting**
Nginx automatically rewrites:
- Browser sends: `/api/ollama/generate`
- Nginx forwards: `/api/generate` to Ollama
- This is done by the trailing slash in `proxy_pass`

## Network Details

### Kubernetes Services

**Chatbot Service**:
```yaml
Service: chatbot
Namespace: monitoring
Type: ClusterIP
Port: 8080
Selector: app.kubernetes.io/name=chatbot
```

**Ollama Service**:
```yaml
Service: k8s-ollama-app
Namespace: monitoring
Type: ClusterIP
Port: 11434
ClusterIP: 10.100.30.45
DNS: k8s-ollama-app.monitoring.svc.cluster.local
```

### Ingress Configuration

```yaml
Host: wooodez.apexkube.xyz
Path: /
Service: chatbot:8080
IngressClass: nginx
```

## Testing the Integration

### 1. Test from Browser
```
1. Open http://wooodez.apexkube.xyz
2. Type a message
3. Check Network tab (F12) for:
   - Request URL: http://wooodez.apexkube.xyz/api/ollama/generate
   - Status: 200 OK
   - Response: JSON with "response" field
```

### 2. Test from Command Line
```bash
curl -X POST 'http://wooodez.apexkube.xyz/api/ollama/generate' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llama3.2:1b",
    "prompt": "Hello",
    "stream": false
  }'
```

### 3. Test from Inside Cluster
```bash
# From chatbot pod
kubectl exec -n monitoring chatbot-xxx -- \
  wget -q -O- --post-data='{"model": "llama3.2:1b", "prompt": "test", "stream": false}' \
  --header='Content-Type: application/json' \
  http://k8s-ollama-app.monitoring.svc.cluster.local:11434/api/generate
```

## Troubleshooting

### Issue: Connection Refused
**Cause**: Ollama service not running
**Fix**: Check Ollama pod status
```bash
kubectl get pods -n monitoring -l app.kubernetes.io/name=ollama
```

### Issue: 502 Bad Gateway
**Cause**: Service can't reach Ollama pod
**Fix**: Check DNS resolution and service endpoints
```bash
kubectl exec -n monitoring chatbot-xxx -- \
  nslookup k8s-ollama-app.monitoring.svc.cluster.local
```

### Issue: CORS Errors
**Cause**: Browser blocking cross-origin requests
**Fix**: Should not happen with this setup since requests are same-origin

### Issue: Timeout
**Cause**: Ollama taking too long to respond
**Fix**: Increase proxy_read_timeout in nginx.conf (currently 300s)

## Configuration Changes

If you need to change the Ollama service URL:

1. **Update nginx.conf**:
   ```nginx
   proxy_pass http://NEW_SERVICE_URL:PORT/api/;
   ```

2. **Rebuild Docker image**:
   ```bash
   docker build -t chatbot:latest .
   docker push your-registry/chatbot:latest
   ```

3. **Redeploy**:
   ArgoCD will automatically sync, or manually:
   ```bash
   kubectl rollout restart deployment chatbot -n monitoring
   ```

## Security Considerations

1. **No public Ollama exposure**: Ollama is only accessible within the cluster
2. **No credentials in frontend**: All sensitive config is in nginx/backend
3. **Rate limiting**: Can be added to nginx ingress annotations
4. **TLS**: Can be enabled on ingress for HTTPS

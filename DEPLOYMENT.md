# Deployment Guide

This document describes how to deploy the Woodez Smart Bot chatbot application.

## Deployment Methods

### 1. Docker

Build and run locally with Docker:

```bash
# Build the image
docker build -t chatbot:latest .

# Run the container
docker run -p 8080:80 chatbot:latest
```

Access at: http://localhost:8080

**Note:** If Ollama runs on your host machine, use:
```bash
docker run -p 8080:80 --add-host=host.docker.internal:host-gateway chatbot:latest
```

### 2. Kubernetes with Helm

#### Prerequisites
- Kubernetes cluster (1.19+)
- Helm 3.0+
- kubectl configured
- Nginx Ingress Controller
- cert-manager (optional, for TLS)

#### Install

```bash
# Install in default namespace
helm install chatbot ./helm/chatbot

# Install in specific namespace
helm install chatbot ./helm/chatbot -n chatbot --create-namespace

# Install with custom values
helm install chatbot ./helm/chatbot -f ./helm/chatbot/values-prod.yaml
```

#### Upgrade

```bash
helm upgrade chatbot ./helm/chatbot
```

#### Uninstall

```bash
helm uninstall chatbot
```

### 3. ArgoCD GitOps

#### Prerequisites
- ArgoCD installed in cluster
- Git repository for this application

#### Setup

1. Update `argocd/application.yaml` with your Git repository URL:
   ```yaml
   source:
     repoURL: https://github.com/YOUR_ORG/chatbot.git
   ```

2. Apply the ArgoCD application:
   ```bash
   kubectl apply -f argocd/application.yaml
   ```

3. ArgoCD will automatically:
   - Create the `chatbot` namespace
   - Deploy the Helm chart
   - Monitor Git for changes
   - Auto-sync on updates
   - Self-heal if resources are modified

#### ArgoCD Features Enabled
- **Automated sync**: Changes in Git trigger automatic deployment
- **Self-healing**: Resources modified outside Git are corrected
- **Pruning**: Deleted resources in Git are removed from cluster
- **Retry logic**: Failed syncs retry with exponential backoff

## Environment-Specific Configurations

### Development
- 1 replica
- Lower resource limits
- `chatbot-dev.example.com`
- Uses `values-dev.yaml`

```bash
helm install chatbot ./helm/chatbot -f ./helm/chatbot/values-dev.yaml -n dev --create-namespace
```

### Production
- 3 replicas
- Higher resource limits
- Autoscaling enabled (3-20 pods)
- `chatbot.example.com`
- Uses `values-prod.yaml`

```bash
helm install chatbot ./helm/chatbot -f ./helm/chatbot/values-prod.yaml -n production --create-namespace
```

## Configuration

### Update Ollama Backend URL

Edit the values file or override during installation:

```bash
helm install chatbot ./helm/chatbot \
  --set ollama.url=http://your-ollama-service:11434
```

### Update Ingress Hostname

```bash
helm install chatbot ./helm/chatbot \
  --set ingress.hosts[0].host=chatbot.yourdomain.com \
  --set ingress.tls[0].hosts[0]=chatbot.yourdomain.com
```

### Update Image Tag

```bash
helm install chatbot ./helm/chatbot \
  --set image.tag=v1.2.3
```

## Monitoring

Check deployment status:

```bash
# Helm status
helm status chatbot

# Pod status
kubectl get pods -l app.kubernetes.io/name=chatbot

# Service status
kubectl get svc -l app.kubernetes.io/name=chatbot

# Ingress status
kubectl get ingress -l app.kubernetes.io/name=chatbot

# View logs
kubectl logs -l app.kubernetes.io/name=chatbot -f
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod -l app.kubernetes.io/name=chatbot
kubectl logs -l app.kubernetes.io/name=chatbot
```

### Ingress not working
```bash
kubectl describe ingress chatbot
kubectl get endpoints chatbot
```

### Can't connect to Ollama
- Verify Ollama service is running
- Check `ollama.url` in values
- Verify network policies allow communication
- Test from within a pod:
  ```bash
  kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
    curl http://ollama-service.default.svc.cluster.local:11434/api/generate
  ```

## Security Considerations

The Helm chart includes:
- Non-root container execution (UID 101)
- Read-only root filesystem
- All capabilities dropped
- Resource limits to prevent resource exhaustion
- Pod anti-affinity for high availability
- Security context constraints

## CI/CD Integration

### Build and Push Image

```bash
# Build
docker build -t your-registry/chatbot:${VERSION} .

# Push
docker push your-registry/chatbot:${VERSION}

# Update Helm
helm upgrade chatbot ./helm/chatbot --set image.tag=${VERSION}
```

### ArgoCD Automation

With ArgoCD, simply commit changes to Git:

1. Update image tag in `argocd/application.yaml` or values files
2. Commit and push to Git
3. ArgoCD automatically deploys the update

## Additional Resources

- [Helm Chart README](helm/chatbot/README.md)
- [Dockerfile](Dockerfile)
- [ArgoCD Application](argocd/application.yaml)

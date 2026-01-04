# Chatbot Helm Chart

Helm chart for deploying the Woodez Smart Bot chatbot application to Kubernetes.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- Nginx Ingress Controller
- cert-manager (for TLS certificates)
- Ollama service running in the cluster

## Installation checking

### Install with default values

```bash
helm install chatbot ./helm/chatbot
```

### Install with custom values

```bash
helm install chatbot ./helm/chatbot -f ./helm/chatbot/values-dev.yaml
```

### Install in a specific namespace

```bash
helm install chatbot ./helm/chatbot -n chatbot --create-namespace
```

## Configuration

Key configuration values:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `2` |
| `image.repository` | Container image repository | `chatbot` |
| `image.tag` | Container image tag | `latest` |
| `service.port` | Service port | `80` |
| `ingress.enabled` | Enable ingress | `true` |
| `ingress.hosts[0].host` | Hostname | `chatbot.example.com` |
| `resources.limits.cpu` | CPU limit | `100m` |
| `resources.limits.memory` | Memory limit | `128Mi` |
| `ollama.url` | Ollama service URL | `http://ollama-service.default.svc.cluster.local:11434` |

## Environment-Specific Deployments

### Development

```bash
helm install chatbot ./helm/chatbot -f ./helm/chatbot/values-dev.yaml -n dev --create-namespace
```

### Production

```bash
helm install chatbot ./helm/chatbot -f ./helm/chatbot/values-prod.yaml -n production --create-namespace
```

## Upgrading

```bash
helm upgrade chatbot ./helm/chatbot
```

## Uninstalling

```bash
helm uninstall chatbot
```

## ArgoCD Deployment

Apply the ArgoCD application manifest:

```bash
kubectl apply -f argocd/application.yaml
```

This will configure ArgoCD to automatically sync the application from the Git repository.

## Security Features

- Non-root container execution
- Read-only root filesystem
- Dropped all capabilities
- Pod anti-affinity for high availability
- Resource limits and requests configured

## Notes

- The chatbot requires an Ollama service to be running in the cluster
- Update the `ollama.url` value to point to your Ollama service
- Update ingress hostnames in values files to match your domain
- Ensure cert-manager is configured with a valid cluster issuer for TLS

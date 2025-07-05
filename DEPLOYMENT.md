# Deployment Guide

This guide explains how to deploy the SiliconFlow API Load Balancer to GitHub Container Registry (GHCR) and run it in production.

## 🚀 GitHub Container Registry (GHCR) Deployment

### Prerequisites

1. **GitHub Repository**: Push your code to a GitHub repository
2. **GitHub Actions**: Enable GitHub Actions in your repository
3. **Container Registry**: Enable GitHub Container Registry for your repository

### Automatic Deployment

The repository includes GitHub Actions workflow that automatically builds and pushes Docker images to GHCR when you:

- Push to `main` or `master` branch
- Create a release tag (e.g., `v1.0.0`)
- Create a pull request

### Manual Setup

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Add load balancer"
   git push origin main
   ```

2. **GitHub Actions will automatically**:
   - Build the Docker image
   - Push to `ghcr.io/yourusername/siliconflow-lb`
   - Tag with branch name and commit SHA

3. **Access your image**:
   ```bash
   docker pull ghcr.io/yourusername/siliconflow-lb:main
   ```

## 🐳 Docker Deployment

### Option 1: Using Docker Compose (Recommended)

1. **Create environment file**:
   ```bash
   cp .env.docker .env
   # Edit .env with your actual values
   ```

2. **Create keys file**:
   ```bash
   cp keys.txt.example keys.txt
   # Add your actual API keys
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

### Option 2: Using Docker directly

1. **Pull the image**:
   ```bash
   docker pull ghcr.io/yourusername/siliconflow-lb:main
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name siliconflow-lb \
     -p 3000:3000 \
     -e LB_API_KEY=your_secure_api_key \
     -e LB_ADMIN_KEY=your_secure_admin_key \
     -v ./keys.txt:/usr/src/app/keys.txt:ro \
     ghcr.io/yourusername/siliconflow-lb:main
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LB_API_KEY` | Load balancer API key | Yes |
| `LB_ADMIN_KEY` | Load balancer admin key | Yes |
| `SILICONFLOW_BASE_URL` | SiliconFlow API base URL | No |
| `PORT` | Port to listen on | No |

### API Keys File

Create a `keys.txt` file with your SiliconFlow API keys:
```
sk-your-api-key-1
sk-your-api-key-2
sk-your-api-key-3
# Add more keys as needed
```

## 🔒 Security Considerations

### Production Security

1. **Use strong API keys**:
   ```bash
   # Generate secure keys
   openssl rand -base64 32  # For LB_API_KEY
   openssl rand -base64 32  # For LB_ADMIN_KEY
   ```

2. **Use HTTPS in production**:
   - Configure SSL certificates
   - Use reverse proxy (nginx included)
   - Set up proper firewall rules

3. **Monitor access logs**:
   ```bash
   docker-compose logs -f siliconflow-lb
   ```

### Network Security

1. **Use Docker networks**:
   ```yaml
   networks:
     siliconflow-net:
       driver: bridge
   ```

2. **Restrict access**:
   - Use nginx rate limiting
   - Configure firewall rules
   - Use VPN for admin access

## 📊 Monitoring

### Health Checks

The container includes built-in health checks:
```bash
# Check container health
docker ps

# Manual health check
curl http://localhost:3000/info
```

### Logging

View logs in real-time:
```bash
# Docker Compose
docker-compose logs -f

# Docker
docker logs -f siliconflow-lb
```

## 🔄 Updates

### Update from GHCR

1. **Pull latest image**:
   ```bash
   docker-compose pull
   ```

2. **Restart services**:
   ```bash
   docker-compose up -d
   ```

### Rollback

1. **Use specific version**:
   ```bash
   docker pull ghcr.io/yourusername/siliconflow-lb:v1.0.0
   ```

2. **Update docker-compose.yml**:
   ```yaml
   image: ghcr.io/yourusername/siliconflow-lb:v1.0.0
   ```

## 🌐 Production Deployment

### With Nginx Proxy

1. **Enable nginx profile**:
   ```bash
   docker-compose --profile nginx up -d
   ```

2. **Configure SSL**:
   - Add SSL certificates to `./ssl/` directory
   - Update `nginx.conf` with your domain

### With Cloud Providers

**AWS ECS**:
```bash
# Push to AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag siliconflow-lb:latest <account>.dkr.ecr.us-east-1.amazonaws.com/siliconflow-lb:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/siliconflow-lb:latest
```

**Google Cloud Run**:
```bash
# Deploy to Cloud Run
gcloud run deploy siliconflow-lb \
  --image ghcr.io/yourusername/siliconflow-lb:main \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 📝 Troubleshooting

### Common Issues

1. **Container won't start**:
   - Check environment variables
   - Verify keys.txt file exists
   - Check logs: `docker logs siliconflow-lb`

2. **Authentication errors**:
   - Verify LB_API_KEY and LB_ADMIN_KEY are set
   - Check API key format in requests

3. **Can't reach SiliconFlow API**:
   - Check network connectivity
   - Verify SILICONFLOW_BASE_URL
   - Check firewall rules

### Debug Mode

Run with debug logging:
```bash
docker run -it --rm \
  -e LB_API_KEY=your_key \
  -e LB_ADMIN_KEY=your_admin_key \
  -v ./keys.txt:/usr/src/app/keys.txt:ro \
  ghcr.io/yourusername/siliconflow-lb:main
```

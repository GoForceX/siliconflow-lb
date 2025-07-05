# SiliconFlow API Load Balancer

[![Build and Deploy](https://github.com/yourusername/siliconflow-lb/actions/workflows/docker-build.yml/badge.svg)](https://github.com/yourusername/siliconflow-lb/actions/workflows/docker-build.yml)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2Fyourusername%2Fsiliconflow--lb-blue)](https://ghcr.io/yourusername/siliconflow-lb)

A high-performance API load balancer for SiliconFlow APIs built with Bun and ElysiaJS. This load balancer distributes requests across multiple API keys using round-robin load balancing with automatic rate limit handling.

## Features

- **Round-robin load balancing** across multiple API keys
- **Automatic rate limit handling** - temporarily disables keys when rate limited
- **Streaming response support** - handles Server-Sent Events (SSE) and chunked responses
- **Automatic retry on rate limits** - switches to different key when one is rate limited
- **Balance monitoring** - check total balance across all API keys
- **Dynamic key reloading** - reload API keys without restarting the server
- **File-based key management** - supports 100+ keys from a simple text file
- **API key authentication** - secure access with user and admin API keys
- **Request logging** - monitor all access attempts with IP tracking
- **Real-time statistics** and health monitoring
- **Request forwarding** to SiliconFlow API endpoints
- **Environment-based configuration**

## Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Configure API keys:**
   
   **Option 1: Using keys.txt file (Recommended for multiple keys)**
   
   Create a `keys.txt` file in the project root and add your API keys (one per line):
   ```
   sk-your-api-key-1
   sk-your-api-key-2
   sk-your-api-key-3
   sk-your-api-key-4
   # Add as many keys as you need...
   ```
   
   **Option 2: Using environment variables (Legacy method)**
   
   Edit the `.env` file and add your SiliconFlow API keys:
   ```env
   SILICONFLOW_API_KEY_1=your_actual_api_key_1
   SILICONFLOW_API_KEY_2=your_actual_api_key_2
   SILICONFLOW_API_KEY_3=your_actual_api_key_3
   SILICONFLOW_API_KEY_4=your_actual_api_key_4
   ```
   
3. **Configure security keys:**
   Edit the `.env` file and set your load balancer API keys:
   ```env
   LB_API_KEY=your_secure_api_key_here
   LB_ADMIN_KEY=your_secure_admin_key_here
   ```

4. **Run the load balancer:**
   ```bash
   bun run dev
   ```

## Usage

### Basic API Requests

**All requests require authentication with your load balancer API key:**

```bash
# Chat completions (non-streaming)
curl -X POST http://localhost:3000/chat/completions \
  -H "Authorization: Bearer your_lb_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-ai/DeepSeek-V3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Chat completions (streaming)
curl -X POST http://localhost:3000/chat/completions \
  -H "Authorization: Bearer your_lb_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-ai/DeepSeek-V3",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'

# Models list
curl -H "Authorization: Bearer your_lb_api_key" http://localhost:3000/models
```

### Monitoring Endpoints

**All monitoring endpoints require authentication:**

- **Info**: `GET /info` - Public endpoint with basic information (no auth required)
- **Stats**: `GET /stats` - View load balancer statistics (requires API key)
- **Health**: `GET /health` - Health check endpoint (requires API key)
- **Balance**: `GET /balance` - Check total balance across all API keys (requires API key)
- **Reload Keys**: `POST /reload-keys` - Reload API keys from file (requires admin key)
- **Home**: `GET /` - Basic info and stats (requires API key)

### Security

The load balancer uses two-tier authentication:

1. **LB_API_KEY** - Regular API key for normal operations (stats, balance, proxying)
2. **LB_ADMIN_KEY** - Admin API key for administrative operations (reload keys)

```bash
# Regular operations (use LB_API_KEY)
curl -H "Authorization: Bearer your_lb_api_key" http://localhost:3000/stats

# Admin operations (use LB_ADMIN_KEY)
curl -X POST -H "Authorization: Bearer your_lb_admin_key" http://localhost:3000/reload-keys
```

**Security Features:**
- All endpoints except `/info` require authentication
- Admin operations require separate admin key
- Request logging with IP tracking
- Failed authentication attempts are logged
- No sensitive data in logs

### Balance Checking

Check the total balance across all your API keys:

```bash
# Get total balance (uses 5-minute cache)
curl -H "Authorization: Bearer your_lb_api_key" http://localhost:3000/balance

# Force refresh balance from all keys
curl -H "Authorization: Bearer your_lb_api_key" http://localhost:3000/balance?refresh=true
```

Response format:
```json
{
  "success": true,
  "timestamp": "2025-07-05T10:30:00.000Z",
  "totalBalance": 150.75,
  "keyBalances": [
    {
      "index": 1,
      "balance": 50.25,
      "lastChecked": "2025-07-05T10:30:00.000Z",
      "isActive": true
    },
    {
      "index": 2,
      "balance": 100.50,
      "lastChecked": "2025-07-05T10:30:00.000Z",
      "isActive": true
    }
  ]
}
```

## Key Management

### File-based Key Management

The load balancer supports reading API keys from a `keys.txt` file, which is ideal for managing large numbers of keys (100+):

**Format:**
```
# SiliconFlow API Keys
# Lines starting with # are comments
# Empty lines are ignored

sk-your-api-key-1
sk-your-api-key-2
sk-your-api-key-3
# Add more keys as needed...
```

**Benefits:**
- Support for unlimited number of keys
- Easy to manage and update
- Comments and empty lines supported
- Automatic fallback to environment variables

### Dynamic Key Reloading

Reload API keys without restarting the server:

```bash
# Reload keys from keys.txt (requires admin key)
curl -X POST -H "Authorization: Bearer your_lb_admin_key" http://localhost:3000/reload-keys
```

Response:
```json
{
  "timestamp": "2025-07-05T10:30:00.000Z",
  "success": true,
  "message": "Successfully reloaded API keys. Previous: 4, New: 8",
  "keyCount": 8
}
```

## API Key Management

The load balancer automatically:
- Rotates through available API keys using round-robin
- Tracks usage statistics for each key
- Temporarily disables keys when rate limited (reactivates after 1 minute)
- Provides detailed statistics about key usage

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SILICONFLOW_BASE_URL` | SiliconFlow API base URL | `https://api.siliconflow.cn/v1` |
| `PORT` | Load balancer port | `3000` |
| `LB_API_KEY` | Load balancer API key | Required |
| `LB_ADMIN_KEY` | Load balancer admin key | Required |

## Statistics

Access real-time statistics at `http://localhost:3000/stats`:

```json
{
  "totalKeys": 4,
  "activeKeys": 3,
  "keyStats": [
    {
      "index": 1,
      "requestCount": 15,
      "lastUsed": "2025-07-05T10:30:00.000Z",
      "isActive": true
    }
  ]
}
```

## Streaming Support

The load balancer fully supports streaming responses (Server-Sent Events) commonly used for:
- Chat completions with `"stream": true`
- Real-time text generation
- Any chunked transfer encoding responses

### Streaming Features:
- **Transparent streaming** - preserves all streaming headers and response body
- **Proper connection handling** - maintains keep-alive connections
- **Automatic detection** - identifies streaming responses by content-type and headers
- **Load balancing** - even streaming requests are load balanced across keys

### Example Streaming Request:
```javascript
// Using fetch with streaming
const response = await fetch('http://localhost:3000/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'deepseek-ai/DeepSeek-V3',
    messages: [{ role: 'user', content: 'Write a story' }],
    stream: true
  })
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  console.log(chunk); // Process streaming data
}
```

## Rate Limiting

When a key hits rate limits (HTTP 429), the load balancer:
1. Temporarily marks the key as inactive
2. Routes subsequent requests to other available keys
3. Reactivates the key after 1 minute
4. Logs the rate limit event

## Development

```bash
# Run in development mode with hot reload
bun run dev

# Build for production
bun run build

# Run in production
bun run start
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build Docker image
docker build -t siliconflow-lb .

# Run with Docker Compose
docker-compose up -d

# Pull from GitHub Container Registry
docker pull ghcr.io/yourusername/siliconflow-lb:main
```

### GitHub Container Registry (GHCR)

The project includes GitHub Actions for automatic deployment:

1. Push to GitHub repository
2. GitHub Actions builds and pushes to GHCR
3. Pull and deploy: `docker pull ghcr.io/yourusername/siliconflow-lb:main`

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `LB_API_KEY` | Load balancer API key | Yes | - |
| `LB_ADMIN_KEY` | Load balancer admin key | Yes | - |
| `SILICONFLOW_BASE_URL` | SiliconFlow API base URL | No | `https://api.siliconflow.cn/v1` |
| `PORT` | Load balancer port | No | `3000` |

### API Keys Configuration

```
sk-your-api-key-1
sk-your-api-key-2
# Add more keys...
```

## License

MIT
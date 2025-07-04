# Deployment Guide

This directory contains all files necessary for deploying the ebook automation pipeline.

## Quick Start

### Development Environment

```bash
# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Access services:
# - App: http://localhost:3000
# - Redis Commander: http://localhost:8081
# - PgAdmin: http://localhost:8082
```

### Production Deployment

```bash
# Configure environment
cp .env.example .env
# Edit .env with production values

# Deploy to production
./deploy.sh production deploy

# Update existing deployment
./deploy.sh production update

# Check status
./deploy.sh production status
```

## Directory Structure

```
deploy/
├── docker-compose.prod.yml    # Production compose file
├── docker-compose.dev.yml     # Development compose file
├── Dockerfile                 # Production image
├── Dockerfile.dev            # Development image
├── nginx/                    # Nginx configuration
│   ├── nginx.conf           # Main config
│   └── conf.d/              # Server configs
├── .env.example             # Environment template
├── init-db.sql              # Database schema
├── deploy.sh                # Deployment script
└── health-check.sh          # Health monitoring
```

## Environment Variables

### Required API Keys

- `ANTHROPIC_API_KEY` - Claude API access
- `OPENAI_API_KEY` - OpenAI API access
- `PERPLEXITY_API_KEY` - Perplexity API access
- `IDEOGRAM_API_KEY` - Ideogram API access
- `DEEPSEEK_API_KEY` - DeepSeek API access

### Database Configuration

- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password

### Optional Services

- `S3_BACKUP_ENABLED` - Enable S3 backups
- `S3_BACKUP_BUCKET` - S3 bucket name
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key

## Services

### Core Services

1. **App** - Main application server
   - Port: 3000
   - Handles API requests and pipeline orchestration

2. **Workers** - Job processing workers
   - Scalable worker pool
   - Processes research, writing, formatting, and QA jobs

3. **Redis** - Job queue and caching
   - Port: 6379
   - Stores job data and session state

4. **PostgreSQL** - Persistent storage
   - Port: 5432
   - Stores pipeline metadata, books, and metrics

### Monitoring Services

1. **Prometheus** - Metrics collection
   - Port: 9091
   - Collects application and system metrics

2. **Grafana** - Metrics visualization
   - Port: 3001
   - Dashboards for monitoring pipeline performance

3. **Nginx** - Reverse proxy and load balancer
   - Ports: 80, 443
   - Routes traffic and provides SSL termination

## Deployment Commands

### Initial Deployment

```bash
# Full deployment from scratch
./deploy.sh production deploy
```

This will:
1. Pull latest code
2. Build Docker images
3. Set up SSL certificates
4. Create backup
5. Run database migrations
6. Start all services
7. Verify health

### Update Deployment

```bash
# Zero-downtime update
./deploy.sh production update
```

This will:
1. Pull latest code
2. Build new images
3. Create backup
4. Rolling update of services
5. Verify health

### Rollback

```bash
# Rollback to previous version
./deploy.sh production rollback
```

### Monitoring

```bash
# Check service status
./deploy.sh production status

# Monitor logs
./deploy.sh production monitor

# Run health checks
./health-check.sh
```

## SSL Configuration

### Self-Signed (Development)

Automatically generated during deployment.

### Production SSL

1. Place certificates in `nginx/ssl/`:
   - `cert.pem` - Certificate file
   - `key.pem` - Private key

2. Update nginx configuration if needed

### Let's Encrypt

For automated SSL with Let's Encrypt, add to compose file:

```yaml
certbot:
  image: certbot/certbot
  volumes:
    - ./nginx/ssl:/etc/letsencrypt
```

## Scaling

### Manual Scaling

```bash
# Scale workers
docker-compose up -d --scale workers=4

# Scale specific service
docker-compose up -d --scale app=2
```

### Auto-Scaling

Enable in environment:
```bash
AUTO_SCALING_ENABLED=true
```

## Backup and Recovery

### Manual Backup

```bash
# Create backup
docker-compose exec app node scripts/backup-manager.js create

# List backups
docker-compose exec app node scripts/backup-manager.js list

# Restore backup
docker-compose exec app node scripts/backup-manager.js restore <backup-id>
```

### Automated Backups

Configured in `BackupManager` with schedule:
- Daily: 2 AM
- Weekly: Sunday 3 AM
- Monthly: 1st of month 4 AM

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker-compose logs <service-name>
   
   # Check resources
   docker system df
   ```

2. **Database connection issues**
   ```bash
   # Test connection
   docker exec ebook-postgres pg_isready -U ebook_user
   
   # Check credentials
   docker-compose exec postgres psql -U ebook_user -d ebook_pipeline
   ```

3. **High memory usage**
   ```bash
   # Check container stats
   docker stats
   
   # Clean up
   docker system prune -a
   ```

### Debug Mode

```bash
# Start with debug logging
DEBUG=* docker-compose up

# Access Node.js debugger
# Connect to port 9229
```

## Security Considerations

1. **Environment Variables**
   - Never commit `.env` files
   - Use secrets management in production
   - Rotate API keys regularly

2. **Network Security**
   - Use firewall rules
   - Restrict database access
   - Enable SSL/TLS

3. **Container Security**
   - Run as non-root user
   - Use read-only volumes where possible
   - Keep images updated

## Performance Tuning

### Redis Optimization

```yaml
redis:
  command: >
    redis-server
    --maxmemory 2gb
    --maxmemory-policy allkeys-lru
    --save 900 1
    --save 300 10
```

### PostgreSQL Tuning

```yaml
postgres:
  command: >
    postgres
    -c shared_buffers=256MB
    -c effective_cache_size=1GB
    -c maintenance_work_mem=64MB
```

### Worker Configuration

Adjust in `.env`:
```bash
MAX_WORKERS=16
WORKER_CONCURRENCY=4
WORKER_REPLICAS=3
```

## Monitoring Dashboards

Access Grafana at http://localhost:3001

Default dashboards:
- Pipeline Performance
- Worker Activity
- API Usage
- System Resources

## CI/CD Integration

GitHub Actions workflow included:
- Automated testing
- Docker image building
- Deployment to production
- Health verification

See `.github/workflows/deploy.yml`
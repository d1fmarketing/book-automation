#!/bin/bash

# Deployment Script for Ebook Pipeline
# 
# Usage: ./deploy.sh [environment] [action]
# Examples:
#   ./deploy.sh production deploy
#   ./deploy.sh staging update
#   ./deploy.sh production rollback

set -e

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-production}"
ACTION="${2:-deploy}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check environment file
    if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
        log_error "Environment file not found. Copy .env.example to .env and configure it."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

load_environment() {
    log_info "Loading environment: $ENVIRONMENT"
    
    # Load base environment
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
    
    # Load environment-specific overrides if exists
    if [[ -f "$SCRIPT_DIR/.env.$ENVIRONMENT" ]]; then
        set -a
        source "$SCRIPT_DIR/.env.$ENVIRONMENT"
        set +a
    fi
    
    # Set compose file based on environment
    if [[ "$ENVIRONMENT" == "production" ]]; then
        export COMPOSE_FILE="docker-compose.prod.yml"
    else
        export COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
    fi
    
    log_success "Environment loaded"
}

pull_latest_code() {
    log_info "Pulling latest code..."
    
    cd "$PROJECT_ROOT"
    git pull origin main
    
    log_success "Code updated"
}

build_images() {
    log_info "Building Docker images..."
    
    cd "$SCRIPT_DIR"
    docker-compose build --pull
    
    log_success "Images built"
}

run_database_migrations() {
    log_info "Running database migrations..."
    
    cd "$SCRIPT_DIR"
    
    # Wait for database to be ready
    docker-compose up -d postgres
    sleep 10
    
    # Run migrations (init-db.sql is run automatically)
    docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1"
    
    log_success "Database migrations completed"
}

deploy_application() {
    log_info "Deploying application..."
    
    cd "$SCRIPT_DIR"
    
    # Start all services
    docker-compose up -d
    
    # Wait for health checks
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Check health
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log_success "Application deployed successfully"
    else
        log_error "Health check failed"
        docker-compose logs --tail=50
        exit 1
    fi
}

update_application() {
    log_info "Updating application with zero downtime..."
    
    cd "$SCRIPT_DIR"
    
    # Scale up new workers
    log_info "Starting new workers..."
    docker-compose up -d --scale workers=4 --no-recreate workers
    sleep 20
    
    # Update app with rolling restart
    log_info "Updating application..."
    docker-compose up -d --no-deps app
    sleep 20
    
    # Scale workers back to normal
    docker-compose up -d --scale workers=2 workers
    
    log_success "Application updated"
}

rollback_application() {
    log_info "Rolling back application..."
    
    cd "$SCRIPT_DIR"
    
    # Get previous image tag
    PREVIOUS_TAG=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep ebook-app | head -2 | tail -1 | cut -d: -f2)
    
    if [[ -z "$PREVIOUS_TAG" ]]; then
        log_error "No previous version found for rollback"
        exit 1
    fi
    
    log_info "Rolling back to version: $PREVIOUS_TAG"
    
    # Update docker-compose to use previous tag
    export IMAGE_TAG="$PREVIOUS_TAG"
    docker-compose up -d
    
    log_success "Rollback completed"
}

backup_before_deploy() {
    log_info "Creating backup before deployment..."
    
    cd "$SCRIPT_DIR"
    
    # Trigger backup
    docker-compose exec -T app node scripts/backup-manager.js create deployment
    
    log_success "Backup created"
}

setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    cd "$SCRIPT_DIR"
    
    # Create SSL directory
    mkdir -p nginx/ssl
    
    # Check if certificates exist
    if [[ ! -f "nginx/ssl/cert.pem" ]]; then
        log_warning "SSL certificates not found. Generating self-signed certificates..."
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        log_warning "Self-signed certificates generated. For production, use proper certificates."
    fi
    
    log_success "SSL setup completed"
}

monitor_deployment() {
    log_info "Monitoring deployment..."
    
    # Show logs
    docker-compose logs -f --tail=100 &
    LOG_PID=$!
    
    # Wait for user interrupt
    log_info "Press Ctrl+C to stop monitoring"
    trap "kill $LOG_PID 2>/dev/null" EXIT
    wait
}

show_status() {
    log_info "Deployment Status"
    echo "===================="
    
    cd "$SCRIPT_DIR"
    
    # Show running containers
    docker-compose ps
    
    # Check health endpoints
    echo -e "\nHealth Checks:"
    curl -s http://localhost/health | jq . || echo "API: Not responding"
    
    # Show resource usage
    echo -e "\nResource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    
    # Show recent logs
    echo -e "\nRecent Logs:"
    docker-compose logs --tail=20 app
}

# Main execution
main() {
    log_info "Starting deployment process..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Action: $ACTION"
    
    check_prerequisites
    load_environment
    
    case "$ACTION" in
        deploy)
            pull_latest_code
            build_images
            setup_ssl
            backup_before_deploy || true
            run_database_migrations
            deploy_application
            show_status
            ;;
        update)
            pull_latest_code
            build_images
            backup_before_deploy || true
            update_application
            show_status
            ;;
        rollback)
            backup_before_deploy || true
            rollback_application
            show_status
            ;;
        status)
            show_status
            ;;
        monitor)
            monitor_deployment
            ;;
        backup)
            backup_before_deploy
            ;;
        *)
            log_error "Unknown action: $ACTION"
            echo "Usage: $0 [environment] [action]"
            echo "Actions: deploy, update, rollback, status, monitor, backup"
            exit 1
            ;;
    esac
    
    log_success "Deployment process completed"
}

# Run main function
main
#!/bin/bash

# Health Check Script
# 
# Monitors the health of all services and sends alerts if issues detected

set -e

# Configuration
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://localhost/health}"
METRICS_ENDPOINT="${METRICS_ENDPOINT:-http://localhost:9090/metrics}"
CHECK_INTERVAL="${CHECK_INTERVAL:-60}"
ALERT_WEBHOOK="${ALERT_WEBHOOK}"
LOG_FILE="${LOG_FILE:-/var/log/health-check.log}"

# Health thresholds
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
QUEUE_THRESHOLD=1000
ERROR_RATE_THRESHOLD=5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# State tracking
LAST_ALERT_TIME=0
ALERT_COOLDOWN=300 # 5 minutes

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_alert() {
    local severity=$1
    local message=$2
    local details=$3
    
    current_time=$(date +%s)
    time_since_last_alert=$((current_time - LAST_ALERT_TIME))
    
    # Check cooldown
    if [[ $time_since_last_alert -lt $ALERT_COOLDOWN && "$severity" != "critical" ]]; then
        return
    fi
    
    log "🚨 Alert [$severity]: $message"
    
    if [[ -n "$ALERT_WEBHOOK" ]]; then
        curl -s -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"severity\": \"$severity\",
                \"message\": \"$message\",
                \"details\": \"$details\",
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }" || log "Failed to send webhook"
    fi
    
    LAST_ALERT_TIME=$current_time
}

check_api_health() {
    log "Checking API health..."
    
    response=$(curl -s -w "\n%{http_code}" "$HEALTH_ENDPOINT" || echo "000")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [[ "$http_code" != "200" ]]; then
        send_alert "critical" "API health check failed" "HTTP status: $http_code"
        return 1
    fi
    
    # Parse health response
    status=$(echo "$body" | jq -r '.status' 2>/dev/null || echo "unknown")
    if [[ "$status" != "healthy" ]]; then
        send_alert "warning" "API reported unhealthy status" "$body"
        return 1
    fi
    
    log "✅ API health: OK"
    return 0
}

check_docker_services() {
    log "Checking Docker services..."
    
    # Get container statuses
    unhealthy=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
    if [[ $unhealthy -gt 0 ]]; then
        containers=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | tr '\n' ', ')
        send_alert "critical" "Unhealthy containers detected" "Containers: $containers"
        return 1
    }
    
    # Check if essential services are running
    essential_services=("ebook-app" "ebook-redis" "ebook-postgres" "ebook-workers")
    for service in "${essential_services[@]}"; do
        if ! docker ps --format "{{.Names}}" | grep -q "^$service$"; then
            send_alert "critical" "Essential service not running: $service" ""
            return 1
        fi
    done
    
    log "✅ Docker services: OK"
    return 0
}

check_resource_usage() {
    log "Checking resource usage..."
    
    # Get container stats
    stats=$(docker stats --no-stream --format "{{json .}}" | jq -s '.')
    
    high_cpu_containers=()
    high_memory_containers=()
    
    for container in $(echo "$stats" | jq -r '.[] | @base64'); do
        _jq() {
            echo "$container" | base64 --decode | jq -r "$1"
        }
        
        name=$(_jq '.Name')
        cpu=$(_jq '.CPUPerc' | sed 's/%//')
        memory=$(_jq '.MemPerc' | sed 's/%//')
        
        # Check CPU
        if (( $(echo "$cpu > $CPU_THRESHOLD" | bc -l) )); then
            high_cpu_containers+=("$name: ${cpu}%")
        fi
        
        # Check Memory
        if (( $(echo "$memory > $MEMORY_THRESHOLD" | bc -l) )); then
            high_memory_containers+=("$name: ${memory}%")
        fi
    done
    
    if [[ ${#high_cpu_containers[@]} -gt 0 ]]; then
        send_alert "warning" "High CPU usage detected" "${high_cpu_containers[*]}"
    fi
    
    if [[ ${#high_memory_containers[@]} -gt 0 ]]; then
        send_alert "warning" "High memory usage detected" "${high_memory_containers[*]}"
    fi
    
    log "✅ Resource usage: OK"
    return 0
}

check_queue_metrics() {
    log "Checking queue metrics..."
    
    # Get queue stats from API
    queue_stats=$(curl -s "$HEALTH_ENDPOINT/../api/queue/stats" || echo "{}")
    
    total_waiting=0
    total_failed=0
    
    for queue in $(echo "$queue_stats" | jq -r 'keys[]'); do
        waiting=$(echo "$queue_stats" | jq -r ".[\"$queue\"].waiting // 0")
        failed=$(echo "$queue_stats" | jq -r ".[\"$queue\"].failed // 0")
        
        total_waiting=$((total_waiting + waiting))
        total_failed=$((total_failed + failed))
        
        if [[ $waiting -gt $QUEUE_THRESHOLD ]]; then
            send_alert "warning" "High queue backlog" "Queue: $queue, Waiting: $waiting"
        fi
    done
    
    if [[ $total_failed -gt 10 ]]; then
        send_alert "warning" "High number of failed jobs" "Total failed: $total_failed"
    fi
    
    log "✅ Queue metrics: OK (Waiting: $total_waiting, Failed: $total_failed)"
    return 0
}

check_disk_space() {
    log "Checking disk space..."
    
    # Check main disk
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 85 ]]; then
        send_alert "critical" "Low disk space" "Usage: ${disk_usage}%"
        return 1
    fi
    
    # Check Docker volumes
    volumes=$(docker system df --format "{{json .}}" | jq -r '.Volumes.Reclaimable')
    if [[ -n "$volumes" ]] && [[ "$volumes" != "0B" ]]; then
        log "ℹ️  Docker volumes can be cleaned: $volumes reclaimable"
    fi
    
    log "✅ Disk space: OK (${disk_usage}% used)"
    return 0
}

check_database_connection() {
    log "Checking database connection..."
    
    # Test database connection
    if ! docker exec ebook-postgres pg_isready -U ebook_user >/dev/null 2>&1; then
        send_alert "critical" "Database connection failed" ""
        return 1
    fi
    
    # Check replication lag if applicable
    # Add replication check here if using replication
    
    log "✅ Database connection: OK"
    return 0
}

perform_health_check() {
    log "=== Starting health check ==="
    
    local failed=0
    
    check_api_health || ((failed++))
    check_docker_services || ((failed++))
    check_resource_usage || ((failed++))
    check_queue_metrics || ((failed++))
    check_disk_space || ((failed++))
    check_database_connection || ((failed++))
    
    if [[ $failed -eq 0 ]]; then
        log "✅ All health checks passed"
    else
        log "⚠️  $failed health checks failed"
    fi
    
    log "=== Health check completed ==="
    echo ""
}

# Main loop
main() {
    log "Starting health monitoring (interval: ${CHECK_INTERVAL}s)"
    
    while true; do
        perform_health_check
        sleep "$CHECK_INTERVAL"
    done
}

# Handle signals
trap 'log "Stopping health monitoring..."; exit 0' SIGTERM SIGINT

# Run as daemon if requested
if [[ "$1" == "--daemon" ]]; then
    main &
    echo $! > /var/run/health-check.pid
    log "Health check daemon started (PID: $!)"
else
    main
fi
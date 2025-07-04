#!/bin/bash

# Start Monitoring Stack
# Starts Prometheus, Grafana, and other monitoring services

set -e

echo "🚀 Starting Ebook Pipeline Monitoring Stack"
echo "========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start the monitoring stack
echo "📊 Starting monitoring services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "\n🔍 Checking service health:"

# Redis
if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
    echo "✅ Redis is healthy"
else
    echo "❌ Redis is not responding"
fi

# Prometheus
if curl -s http://localhost:9090/-/healthy > /dev/null; then
    echo "✅ Prometheus is healthy"
else
    echo "❌ Prometheus is not responding"
fi

# Grafana
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Grafana is healthy"
else
    echo "❌ Grafana is not responding"
fi

echo "\n📈 Monitoring Stack Status:"
echo "============================"
echo "📊 Grafana: http://localhost:3000"
echo "   Username: admin"
echo "   Password: ebook123"
echo "\n🔥 Prometheus: http://localhost:9090"
echo "\n📡 Bull Board: http://localhost:3100"
echo "\n🔴 Redis Commander: http://localhost:8081 (if enabled)"

echo "\n💡 Available Dashboards:"
echo "- Pipeline Performance"
echo "- Cost Analytics" 
echo "- System Health"
echo "- Book Generation"

echo "\n🎯 Quick Commands:"
echo "- View logs: docker-compose logs -f"
echo "- Stop stack: docker-compose down"
echo "- View metrics: curl http://localhost:9464/metrics"

echo "\n✅ Monitoring stack is ready!"

# Start the application metrics collector
echo "\n🚀 Starting application metrics collector..."
if command -v node > /dev/null; then
    echo "Starting metrics collector on port 9464..."
    node -e "const { getMetricsCollector } = require('./src/monitoring/MetricsCollector'); const m = getMetricsCollector(); m.start().then(() => console.log('✅ Metrics collector started')).catch(e => console.error('❌ Failed to start metrics collector:', e.message));" &
    METRICS_PID=$!
    echo "Metrics collector PID: $METRICS_PID"
    echo "To stop: kill $METRICS_PID"
else
    echo "⚠️  Node.js not found. Please start the metrics collector manually."
fi

echo "\n🎉 All systems operational!"
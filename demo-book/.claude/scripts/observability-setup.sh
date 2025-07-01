#!/bin/bash

# Observability Setup for Claude Elite
# Configures DataDog and OpenTelemetry hooks

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔭 Setting up Observability Stack..."

# Check for required environment variables
check_env_vars() {
    local required_vars=("DATADOG_API_KEY" "DATADOG_APP_KEY" "OTEL_EXPORTER_OTLP_ENDPOINT")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Missing environment variables:${NC}"
        printf '%s\n' "${missing_vars[@]}"
        echo ""
        echo "Add these to your .env file or export them:"
        echo "export DATADOG_API_KEY='your-example-key-here'"
        echo "export DATADOG_APP_KEY='your-example-app-key'"
        echo "export OTEL_EXPORTER_OTLP_ENDPOINT='http://localhost:4317'"
        return 1
    fi
    
    return 0
}

# Create observability configuration
create_config() {
    mkdir -p .claude/observability
    
    # DataDog configuration
    cat > .claude/observability/datadog.json << EOF
{
  "service": "claude-elite-pipeline",
  "env": "${DD_ENV:-development}",
  "version": "$(node -p "require('./package.json').version")",
  "tags": {
    "team": "elite",
    "project": "book-automation"
  },
  "logs": {
    "injection": true,
    "level": "info"
  },
  "apm": {
    "enabled": true,
    "service_mapping": {
      "build": "ebook-builder",
      "lint": "code-quality",
      "test": "test-runner"
    }
  },
  "metrics": {
    "build_duration": {
      "type": "histogram",
      "tags": ["format:pdf", "format:epub"]
    },
    "lint_errors": {
      "type": "count",
      "tags": ["severity:error", "severity:warning"]
    },
    "word_count": {
      "type": "gauge",
      "tags": ["chapter"]
    }
  }
}
EOF

    # OpenTelemetry configuration
    cat > .claude/observability/otel-config.yaml << EOF
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: localhost:4317
      http:
        endpoint: localhost:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

  attributes:
    actions:
      - key: service.name
        value: claude-elite
        action: upsert
      - key: deployment.environment
        value: ${OTEL_ENV:-development}
        action: upsert

exporters:
  datadog:
    api:
      key: ${DATADOG_API_KEY}
      site: ${DD_SITE:-datadoghq.com}
    
  logging:
    loglevel: info

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, attributes]
      exporters: [datadog, logging]
    
    metrics:
      receivers: [otlp]
      processors: [batch, attributes]
      exporters: [datadog]
    
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [datadog]
EOF

    echo -e "${GREEN}✓ Configuration files created${NC}"
}

# Create instrumentation wrapper
create_instrumentation() {
    cat > .claude/scripts/instrument.js << 'EOF'
// OpenTelemetry instrumentation for Node.js

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

// Initialize the SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'claude-elite-pipeline',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version,
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/traces',
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/metrics',
    }),
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable fs instrumentation to reduce noise
      },
    }),
  ],
});

// Initialize the SDK
sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Telemetry terminated'))
    .catch((error) => console.log('Error terminating telemetry', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
EOF

    # Create DataDog APM wrapper
    cat > .claude/scripts/dd-trace.js << 'EOF'
// DataDog APM instrumentation

const tracer = require('dd-trace').init({
  service: 'claude-elite-pipeline',
  env: process.env.DD_ENV || 'development',
  version: process.env.npm_package_version,
  analytics: true,
  logInjection: true,
  profiling: true,
  runtimeMetrics: true,
  plugins: {
    // Disable certain plugins to reduce noise
    fs: false,
    dns: false,
  },
});

// Custom spans for our pipeline
tracer.use('build', {
  service: 'ebook-builder',
  analytics: true,
});

tracer.use('lint', {
  service: 'code-quality',
  analytics: true,
});

module.exports = tracer;
EOF

    echo -e "${GREEN}✓ Instrumentation scripts created${NC}"
}

# Create build hooks
create_hooks() {
    # Pre-build hook
    cat > .claude/hooks/pre-build.sh << 'EOF'
#!/bin/bash
# Pre-build observability hook

# Send build start event to DataDog
if [ -n "$DATADOG_API_KEY" ]; then
    curl -s -X POST "https://api.datadoghq.com/api/v1/events" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: $DATADOG_API_KEY" \
        -d "{
            \"title\": \"Build Started\",
            \"text\": \"eBook build started for $(git rev-parse --short HEAD)\",
            \"tags\": [\"env:${DD_ENV:-dev}\", \"type:build_start\"],
            \"alert_type\": \"info\"
        }" > /dev/null
fi

# Start OTEL span
export OTEL_BUILD_SPAN_ID=$(uuidgen)
export OTEL_BUILD_START=$(date +%s)
EOF

    # Post-build hook
    cat > .claude/hooks/post-build.sh << 'EOF'
#!/bin/bash
# Post-build observability hook

BUILD_DURATION=$(($(date +%s) - ${OTEL_BUILD_START:-0}))
BUILD_STATUS=${1:-success}

# Send metrics to DataDog
if [ -n "$DATADOG_API_KEY" ]; then
    # Build duration metric
    curl -s -X POST "https://api.datadoghq.com/api/v1/series" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: $DATADOG_API_KEY" \
        -d "{
            \"series\": [{
                \"metric\": \"claude.elite.build.duration\",
                \"points\": [[$(date +%s), $BUILD_DURATION]],
                \"type\": \"gauge\",
                \"tags\": [\"status:$BUILD_STATUS\", \"env:${DD_ENV:-dev}\"]
            }]
        }" > /dev/null
    
    # Build complete event
    curl -s -X POST "https://api.datadoghq.com/api/v1/events" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: $DATADOG_API_KEY" \
        -d "{
            \"title\": \"Build Completed\",
            \"text\": \"eBook build completed in ${BUILD_DURATION}s with status: $BUILD_STATUS\",
            \"tags\": [\"env:${DD_ENV:-dev}\", \"type:build_complete\", \"status:$BUILD_STATUS\"],
            \"alert_type\": \"$([ "$BUILD_STATUS" = "success" ] && echo "success" || echo "error")\"
        }" > /dev/null
fi
EOF

    chmod +x .claude/hooks/*.sh
    echo -e "${GREEN}✓ Build hooks created${NC}"
}

# Create package.json additions
create_npm_scripts() {
    cat > .claude/observability/package-additions.json << EOF
{
  "scripts": {
    "build:instrumented": "node --require ./claude/scripts/instrument.js scripts/build-pipeline.js",
    "build:dd": "node --require ./claude/scripts/dd-trace.js scripts/build-pipeline.js",
    "metrics:send": "node .claude/scripts/send-metrics.js"
  },
  "devDependencies": {
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-node": "^0.45.0",
    "@opentelemetry/auto-instrumentations-node": "^0.40.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.45.0",
    "@opentelemetry/exporter-metrics-otlp-http": "^0.45.0",
    "dd-trace": "^4.20.0"
  }
}
EOF

    echo -e "${YELLOW}📝 Add these to your package.json:${NC}"
    echo "   - Scripts from .claude/observability/package-additions.json"
    echo "   - Dependencies listed in the same file"
}

# Main execution
main() {
    echo "🔭 Claude Elite Observability Setup"
    echo "=================================="
    
    # Check environment
    if ! check_env_vars; then
        echo -e "${RED}❌ Setup incomplete - missing environment variables${NC}"
        exit 1
    fi
    
    # Create all components
    create_config
    create_instrumentation
    create_hooks
    create_npm_scripts
    
    echo ""
    echo -e "${GREEN}✅ Observability setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Install dependencies: npm install"
    echo "2. Update package.json with additions"
    echo "3. Test instrumented build: npm run build:instrumented"
    echo "4. View metrics in DataDog dashboard"
    echo ""
    echo "Optional: Install OpenTelemetry Collector:"
    echo "  docker run -p 4317:4317 -p 4318:4318 -v \$(pwd)/.claude/observability/otel-config.yaml:/etc/otel-config.yaml otel/opentelemetry-collector --config=/etc/otel-config.yaml"
}

# Run only if executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
EOF
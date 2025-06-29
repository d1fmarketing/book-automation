#!/bin/bash
# Load environment variables from .env file

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ -f .env ]; then
    # Export all variables from .env
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✓ Environment variables loaded from .env${NC}"
    
    # Check if IDEOGRAM_API_KEY is set
    if [ ! -z "$IDEOGRAM_API_KEY" ]; then
        echo -e "${GREEN}✓ IDEOGRAM_API_KEY is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  IDEOGRAM_API_KEY not found in .env${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo "Create it from .env.example:"
    echo "  cp .env.example .env"
fi
# Book Automation Pipeline v1.0
# Multi-stage build for optimized image size

FROM node:20-bookworm-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libgtk-3-0 \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth \
    xvfb \
    git \
    make \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Stage 1: Node dependencies
FROM base AS node-deps
COPY package*.json ./
RUN npm ci --production

# Stage 2: Python dependencies
FROM base AS python-deps
COPY requirements.txt ./
RUN python3 -m venv /venv && \
    /venv/bin/pip install --upgrade pip && \
    /venv/bin/pip install -r requirements.txt

# Stage 3: Final image
FROM base

# Copy dependencies from previous stages
COPY --from=node-deps /app/node_modules ./node_modules
COPY --from=python-deps /venv /venv

# Copy application code
COPY . .

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PYTHONPATH=/app/src:$PYTHONPATH
ENV PATH="/venv/bin:$PATH"
ENV NODE_ENV=production

# Chromium sandbox fix
RUN echo 'kernel.unprivileged_userns_clone=1' > /etc/sysctl.d/userns.conf

# Create build directories
RUN mkdir -p build/dist build/temp chapters assets/images

# Set up MCP browser tools environment (if needed)
ENV MCP_SERVER_PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('OK')" || exit 1

# Default command runs the full pipeline
CMD ["npm", "run", "build:pipeline"]

# Alternative commands:
# docker run book-automation npm run build:pdf     # Just PDF
# docker run book-automation npm run build:epub    # Just EPUB
# docker run book-automation npm run qa            # Just QA
# docker run book-automation make omnicreator      # OmniCreator pipeline
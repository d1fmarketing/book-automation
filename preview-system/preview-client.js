/**
 * Preview Client
 * Handles WebSocket connection and UI updates
 */

class PreviewClient {
    constructor() {
        this.ws = null;
        this.currentPage = 0;
        this.totalPages = 0;
        this.pages = new Map();
        this.zoom = 100;
        this.token = new URLSearchParams(window.location.search).get('token') || 'preview-token-12345';
        
        this.initializeElements();
        this.bindEvents();
        this.connect();
    }
    
    initializeElements() {
        // Status elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        
        // Progress elements
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressPages = document.getElementById('progressPages');
        this.progressPercent = document.getElementById('progressPercent');
        this.currentChapter = document.getElementById('currentChapter');
        
        // Pages list
        this.pagesList = document.getElementById('pagesList');
        
        // Preview elements
        this.previewContent = document.getElementById('previewContent');
        
        // Controls
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.zoomInBtn = document.getElementById('zoomInBtn');
        this.zoomOutBtn = document.getElementById('zoomOutBtn');
        this.zoomLevel = document.getElementById('zoomLevel');
        this.fitBtn = document.getElementById('fitBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        
        // Log
        this.logSection = document.getElementById('logSection');
    }
    
    bindEvents() {
        this.prevBtn.addEventListener('click', () => this.navigatePage(-1));
        this.nextBtn.addEventListener('click', () => this.navigatePage(1));
        this.zoomInBtn.addEventListener('click', () => this.adjustZoom(10));
        this.zoomOutBtn.addEventListener('click', () => this.adjustZoom(-10));
        this.fitBtn.addEventListener('click', () => this.fitToWindow());
        this.downloadBtn.addEventListener('click', () => this.downloadPDF());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.navigatePage(-1);
            if (e.key === 'ArrowRight') this.navigatePage(1);
            if (e.key === '=' || e.key === '+') this.adjustZoom(10);
            if (e.key === '-') this.adjustZoom(-10);
        });
    }
    
    connect() {
        const wsUrl = `ws://${window.location.host}/ws/preview?token=${this.token}`;
        this.log('Connecting to preview server...');
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.log('Connected to preview server', 'success');
            this.updateStatus('idle', 'Connected');
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };
        
        this.ws.onerror = (error) => {
            this.log('WebSocket error', 'error');
            console.error('WebSocket error:', error);
        };
        
        this.ws.onclose = () => {
            this.log('Disconnected from preview server', 'error');
            this.updateStatus('error', 'Disconnected');
            
            // Reconnect after 3 seconds
            setTimeout(() => {
                this.log('Attempting to reconnect...');
                this.connect();
            }, 3000);
        };
        
        // Periodic ping
        setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'status':
                this.updateBuildStatus(message.data);
                break;
                
            case 'build_start':
                this.handleBuildStart(message.data);
                break;
                
            case 'progress':
                this.updateProgress(message.data);
                break;
                
            case 'page_ready':
                this.addPage(message.data);
                break;
                
            case 'build_complete':
                this.handleBuildComplete(message.data);
                break;
                
            case 'preview_url':
                this.showPreview(message.page, message.url);
                break;
                
            case 'pdf_url':
                this.setPdfUrl(message.url);
                break;
                
            case 'hot_reload_complete':
                this.handleHotReload(message.data);
                break;
                
            case 'hot_reload_error':
                this.handleHotReloadError(message.data);
                break;
        }
    }
    
    updateStatus(status, text) {
        this.statusIndicator.className = `status-indicator ${status}`;
        this.statusText.textContent = text;
    }
    
    updateBuildStatus(build) {
        if (build.status === 'building') {
            this.updateStatus('building', 'Building PDF...');
            this.progressSection.style.display = 'block';
            this.totalPages = build.totalPages;
            this.updateProgress({
                currentPage: build.currentPage,
                totalPages: build.totalPages,
                percentage: 0
            });
        } else if (build.status === 'complete') {
            this.updateStatus('complete', 'Build complete');
        }
    }
    
    handleBuildStart(data) {
        this.log('Build started', 'success');
        this.updateStatus('building', 'Building PDF...');
        this.progressSection.style.display = 'block';
        this.pages.clear();
        this.pagesList.innerHTML = '';
        this.currentPage = 0;
        this.totalPages = data.totalPages || 0;
        this.updateProgress({
            currentPage: 0,
            totalPages: this.totalPages,
            percentage: 0
        });
    }
    
    updateProgress(data) {
        const { currentPage, totalPages, currentChapter, percentage } = data;
        
        this.progressFill.style.width = `${percentage}%`;
        this.progressPages.textContent = `${currentPage} / ${totalPages} pages`;
        this.progressPercent.textContent = `${percentage}%`;
        
        if (currentChapter) {
            this.currentChapter.textContent = `Processing: ${currentChapter}`;
        }
    }
    
    addPage(data) {
        const { page, url } = data;
        
        this.pages.set(page, url);
        
        // Create page item
        const pageItem = document.createElement('div');
        pageItem.className = 'page-item';
        pageItem.dataset.page = page;
        
        pageItem.innerHTML = `
            <div class="page-thumbnail">
                <img src="${url}" alt="Page ${page}" loading="lazy">
            </div>
            <div class="page-info">
                <div class="page-number">Page ${page}</div>
                <div class="page-chapter">Chapter ${Math.ceil(page / 20)}</div>
            </div>
        `;
        
        pageItem.addEventListener('click', () => this.showPage(page));
        
        this.pagesList.appendChild(pageItem);
        
        // Show first page automatically
        if (page === 1 && this.currentPage === 0) {
            this.showPage(1);
        }
        
        this.log(`Page ${page} ready`);
    }
    
    showPage(pageNum) {
        this.currentPage = pageNum;
        const url = this.pages.get(pageNum);
        
        if (url) {
            this.showPreview(pageNum, url);
            
            // Update active state
            document.querySelectorAll('.page-item').forEach(item => {
                item.classList.toggle('active', parseInt(item.dataset.page) === pageNum);
            });
            
            // Update navigation
            this.prevBtn.disabled = pageNum <= 1;
            this.nextBtn.disabled = pageNum >= this.totalPages || !this.pages.has(pageNum + 1);
            
            // Scroll into view
            const activeItem = document.querySelector('.page-item.active');
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
    
    showPreview(pageNum, url) {
        this.previewContent.innerHTML = `
            <img class="preview-image" 
                 src="${url}" 
                 alt="Page ${pageNum}"
                 style="zoom: ${this.zoom}%"
                 draggable="false">
        `;
    }
    
    navigatePage(direction) {
        const newPage = this.currentPage + direction;
        if (newPage >= 1 && newPage <= this.totalPages && this.pages.has(newPage)) {
            this.showPage(newPage);
        }
    }
    
    adjustZoom(delta) {
        this.zoom = Math.max(25, Math.min(200, this.zoom + delta));
        this.zoomLevel.textContent = `${this.zoom}%`;
        
        const img = this.previewContent.querySelector('.preview-image');
        if (img) {
            img.style.zoom = `${this.zoom}%`;
        }
    }
    
    fitToWindow() {
        this.zoom = 100;
        this.zoomLevel.textContent = '100%';
        
        const img = this.previewContent.querySelector('.preview-image');
        if (img) {
            img.style.zoom = '100%';
            
            // Calculate actual fit
            const containerRect = this.previewContent.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();
            
            const scaleX = (containerRect.width - 40) / imgRect.width;
            const scaleY = (containerRect.height - 40) / imgRect.height;
            const scale = Math.min(scaleX, scaleY, 1) * 100;
            
            this.zoom = Math.round(scale);
            this.zoomLevel.textContent = `${this.zoom}%`;
            img.style.zoom = `${this.zoom}%`;
        }
    }
    
    handleBuildComplete(data) {
        this.log(`Build complete in ${(data.duration / 1000).toFixed(1)}s`, 'success');
        this.updateStatus('complete', 'Build complete');
        this.downloadBtn.disabled = false;
        
        // Request PDF URL
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'get_pdf' }));
        }
    }
    
    setPdfUrl(url) {
        this.pdfUrl = url;
    }
    
    downloadPDF() {
        if (this.pdfUrl) {
            const a = document.createElement('a');
            a.href = this.pdfUrl;
            a.download = 'preview.pdf';
            a.click();
        }
    }
    
    handleHotReload(data) {
        this.log(`🔥 Hot-reload: ${data.trigger} changed, rebuilding...`, 'success');
        this.updateStatus('building', 'Hot-reloading...');
        
        // Show notification
        const notification = document.createElement('div');
        notification.className = 'hot-reload-notification';
        notification.innerHTML = `
            <div class="notification-content">
                🔥 Changes detected in ${data.trigger}
                <br>Rebuilding PDF...
            </div>
        `;
        document.body.appendChild(notification);
        
        // Remove notification after animation
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    handleHotReloadError(data) {
        this.log(`❌ Hot-reload failed: ${data.error}`, 'error');
        this.updateStatus('error', 'Hot-reload failed');
    }
    
    log(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        this.logSection.appendChild(entry);
        this.logSection.scrollTop = this.logSection.scrollHeight;
        
        // Keep only last 100 entries
        while (this.logSection.children.length > 100) {
            this.logSection.removeChild(this.logSection.firstChild);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.previewClient = new PreviewClient();
});
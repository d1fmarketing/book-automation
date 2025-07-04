// Analytics Module for Ebook Reader
class EbookAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.events = [];
        this.readingTime = 0;
        this.lastActiveTime = Date.now();
        this.idleThreshold = 30000; // 30 seconds
        this.idleTimer = null;
        
        // Initialize analytics
        this.init();
    }
    
    init() {
        // Check if analytics is enabled
        this.enabled = localStorage.getItem('analytics-enabled') !== 'false';
        
        if (!this.enabled) return;
        
        // Load existing session data
        this.loadSession();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start tracking
        this.startTracking();
        
        console.log('📊 Analytics initialized');
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    loadSession() {
        const savedSession = localStorage.getItem('reading-session');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            // Resume session if less than 1 hour old
            if (Date.now() - session.lastActive < 3600000) {
                this.sessionId = session.id;
                this.readingTime = session.totalTime || 0;
                this.events = session.events || [];
            }
        }
    }
    
    saveSession() {
        if (!this.enabled) return;
        
        const session = {
            id: this.sessionId,
            lastActive: Date.now(),
            totalTime: this.readingTime,
            events: this.events.slice(-100) // Keep last 100 events
        };
        localStorage.setItem('reading-session', JSON.stringify(session));
    }
    
    setupEventListeners() {
        // Page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseTracking();
            } else {
                this.resumeTracking();
            }
        });
        
        // User activity
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => this.updateActivity(), { passive: true });
        });
        
        // Window events
        window.addEventListener('beforeunload', () => this.endSession());
        window.addEventListener('resize', () => this.trackEvent('window-resize', {
            width: window.innerWidth,
            height: window.innerHeight
        }));
    }
    
    startTracking() {
        // Update reading time every second
        this.trackingInterval = setInterval(() => {
            if (!document.hidden && Date.now() - this.lastActiveTime < this.idleThreshold) {
                this.readingTime += 1;
                this.updateReadingStats();
            }
        }, 1000);
        
        // Save session every 30 seconds
        this.saveInterval = setInterval(() => {
            this.saveSession();
        }, 30000);
    }
    
    pauseTracking() {
        this.trackEvent('session-pause');
    }
    
    resumeTracking() {
        this.trackEvent('session-resume');
        this.lastActiveTime = Date.now();
    }
    
    updateActivity() {
        this.lastActiveTime = Date.now();
        
        // Clear and reset idle timer
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            this.trackEvent('user-idle');
        }, this.idleThreshold);
    }
    
    endSession() {
        this.trackEvent('session-end', {
            duration: this.readingTime,
            totalEvents: this.events.length
        });
        this.saveSession();
        
        if (this.trackingInterval) clearInterval(this.trackingInterval);
        if (this.saveInterval) clearInterval(this.saveInterval);
    }
    
    // Track custom events
    trackEvent(eventName, data = {}) {
        if (!this.enabled) return;
        
        const event = {
            type: eventName,
            timestamp: Date.now(),
            sessionTime: this.readingTime,
            data: data
        };
        
        this.events.push(event);
        
        // Send to server if online
        if (navigator.onLine) {
            this.sendToServer(event);
        } else {
            this.queueForSync(event);
        }
    }
    
    // Track page views
    trackPageView(chapter, title) {
        this.trackEvent('page-view', {
            chapter: chapter,
            title: title,
            url: window.location.href
        });
    }
    
    // Track reading progress
    trackProgress(chapter, percent) {
        this.trackEvent('reading-progress', {
            chapter: chapter,
            percent: percent
        });
    }
    
    // Track scroll depth
    trackScrollDepth(depth) {
        // Only track significant milestones
        const milestones = [25, 50, 75, 90, 100];
        const milestone = milestones.find(m => depth >= m && !this.scrollMilestones?.includes(m));
        
        if (milestone) {
            this.scrollMilestones = (this.scrollMilestones || []).concat(milestone);
            this.trackEvent('scroll-depth', {
                depth: milestone,
                chapter: this.currentChapter
            });
        }
    }
    
    // Track link clicks
    trackLinkClick(url, type = 'internal') {
        this.trackEvent('link-click', {
            url: url,
            type: type,
            chapter: this.currentChapter
        });
    }
    
    // Track affiliate link clicks
    trackAffiliate(url, product) {
        this.trackEvent('affiliate-click', {
            url: url,
            product: product,
            chapter: this.currentChapter
        });
        
        // Store for conversion tracking
        const affiliateClicks = JSON.parse(localStorage.getItem('affiliate-clicks') || '[]');
        affiliateClicks.push({
            url: url,
            product: product,
            timestamp: Date.now()
        });
        localStorage.setItem('affiliate-clicks', JSON.stringify(affiliateClicks.slice(-50)));
    }
    
    // Track highlights
    trackHighlight(text, chapter) {
        this.trackEvent('text-highlight', {
            textLength: text.length,
            chapter: chapter,
            preview: text.substring(0, 50) + '...'
        });
    }
    
    // Track notes
    trackNote(chapter, noteLength) {
        this.trackEvent('note-added', {
            chapter: chapter,
            noteLength: noteLength
        });
    }
    
    // Track bookmarks
    trackBookmark(chapter, action) {
        this.trackEvent('bookmark', {
            chapter: chapter,
            action: action // 'add' or 'remove'
        });
    }
    
    // Track social shares
    trackShare(platform, chapter) {
        this.trackEvent('social-share', {
            platform: platform,
            chapter: chapter
        });
    }
    
    // Track search
    trackSearch(query, results) {
        this.trackEvent('search', {
            query: query,
            resultsCount: results
        });
    }
    
    // Track settings changes
    trackSettings(setting, value) {
        this.trackEvent('settings-change', {
            setting: setting,
            value: value
        });
    }
    
    // Update reading stats display
    updateReadingStats() {
        // Update time display
        const hours = Math.floor(this.readingTime / 3600);
        const minutes = Math.floor((this.readingTime % 3600) / 60);
        document.getElementById('total-time').textContent = `${hours}h ${minutes}m`;
        
        // Update reading speed (words per minute)
        if (this.wordsRead > 0) {
            const wpm = Math.round(this.wordsRead / (this.readingTime / 60));
            if (document.getElementById('reading-speed')) {
                document.getElementById('reading-speed').textContent = `${wpm} wpm`;
            }
        }
    }
    
    // Calculate engagement score
    calculateEngagement() {
        const factors = {
            readingTime: Math.min(this.readingTime / 3600, 1), // Max 1 hour
            scrollDepth: (this.scrollMilestones?.length || 0) / 5,
            interactions: Math.min(this.events.filter(e => 
                ['highlight', 'note', 'bookmark'].some(t => e.type.includes(t))
            ).length / 10, 1),
            completion: this.chaptersCompleted / this.totalChapters
        };
        
        const weights = {
            readingTime: 0.3,
            scrollDepth: 0.2,
            interactions: 0.3,
            completion: 0.2
        };
        
        return Object.entries(factors).reduce((score, [key, value]) => 
            score + (value * weights[key]), 0
        );
    }
    
    // Send analytics to server
    async sendToServer(event) {
        if (!this.enabled || !window.ANALYTICS_ENDPOINT) return;
        
        try {
            await fetch(window.ANALYTICS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    ebookId: window.EBOOK_ID,
                    event: event
                })
            });
        } catch (error) {
            console.error('Analytics send failed:', error);
            this.queueForSync(event);
        }
    }
    
    // Queue events for later sync
    queueForSync(event) {
        const queue = JSON.parse(localStorage.getItem('analytics-queue') || '[]');
        queue.push(event);
        localStorage.setItem('analytics-queue', JSON.stringify(queue.slice(-200)));
    }
    
    // Sync queued events when online
    async syncQueue() {
        if (!navigator.onLine) return;
        
        const queue = JSON.parse(localStorage.getItem('analytics-queue') || '[]');
        if (queue.length === 0) return;
        
        for (const event of queue) {
            await this.sendToServer(event);
        }
        
        localStorage.removeItem('analytics-queue');
    }
    
    // Get analytics summary
    getSummary() {
        return {
            sessionId: this.sessionId,
            readingTime: this.readingTime,
            eventsCount: this.events.length,
            engagement: this.calculateEngagement(),
            lastActive: this.lastActiveTime
        };
    }
    
    // Export analytics data
    exportData() {
        const data = {
            sessions: [{
                id: this.sessionId,
                startTime: this.startTime,
                readingTime: this.readingTime,
                events: this.events
            }],
            bookmarks: JSON.parse(localStorage.getItem('bookmarks') || '[]'),
            highlights: JSON.parse(localStorage.getItem('highlights') || '[]'),
            notes: JSON.parse(localStorage.getItem('notes') || '[]')
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ebook-analytics-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // Privacy controls
    disableAnalytics() {
        this.enabled = false;
        localStorage.setItem('analytics-enabled', 'false');
        this.endSession();
    }
    
    enableAnalytics() {
        this.enabled = true;
        localStorage.setItem('analytics-enabled', 'true');
        this.init();
    }
    
    clearData() {
        localStorage.removeItem('reading-session');
        localStorage.removeItem('analytics-queue');
        localStorage.removeItem('affiliate-clicks');
        this.events = [];
        this.readingTime = 0;
    }
}

// Initialize analytics
const analytics = new EbookAnalytics();

// Export for use in other modules
window.ebookAnalytics = analytics;
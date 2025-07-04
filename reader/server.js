#!/usr/bin/env node

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Analytics storage (in production, use a database)
const analyticsData = {
    sessions: [],
    events: []
};

// Routes

// Serve reader
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get ebook data
app.get('/api/ebook/:id', async (req, res) => {
    try {
        const ebookId = req.params.id;
        
        // In production, fetch from database
        // For now, check if ebook HTML exists
        const ebookPath = path.join(__dirname, '../build/ebooks', ebookId, 'output/ebook.html');
        
        if (await fs.access(ebookPath).then(() => true).catch(() => false)) {
            // Parse HTML to extract chapters
            const html = await fs.readFile(ebookPath, 'utf8');
            
            // Simple extraction (in production, use proper HTML parser)
            const chapters = [];
            const chapterMatches = html.match(/<h1[^>]*>([^<]+)<\/h1>/g) || [];
            
            chapterMatches.forEach((match, index) => {
                const title = match.replace(/<[^>]+>/g, '');
                chapters.push({
                    id: index,
                    title: title,
                    content: 'Chapter content here...' // Extract actual content in production
                });
            });
            
            res.json({
                id: ebookId,
                title: ebookId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                author: 'Money Machine AI',
                chapters: chapters
            });
        } else {
            // Return demo data
            res.json({
                id: ebookId,
                title: 'Demo Ebook',
                author: 'Demo Author',
                chapters: [
                    { id: 0, title: 'Introduction', content: '<h1>Introduction</h1><p>Welcome to the demo ebook.</p>' },
                    { id: 1, title: 'Chapter 1', content: '<h1>Chapter 1</h1><p>This is chapter 1 content.</p>' },
                    { id: 2, title: 'Chapter 2', content: '<h1>Chapter 2</h1><p>This is chapter 2 content.</p>' }
                ]
            });
        }
    } catch (error) {
        console.error('Error loading ebook:', error);
        res.status(500).json({ error: 'Failed to load ebook' });
    }
});

// Analytics endpoint
app.post('/api/analytics', (req, res) => {
    try {
        const { sessionId, ebookId, event } = req.body;
        
        // Store analytics
        analyticsData.events.push({
            sessionId,
            ebookId,
            event,
            serverTime: Date.now()
        });
        
        // In production, save to database
        console.log('Analytics event:', event.type, 'for ebook:', ebookId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to save analytics' });
    }
});

// Get analytics summary
app.get('/api/analytics/:ebookId', (req, res) => {
    const ebookId = req.params.id;
    const ebookEvents = analyticsData.events.filter(e => e.ebookId === ebookId);
    
    const summary = {
        totalSessions: new Set(ebookEvents.map(e => e.sessionId)).size,
        totalEvents: ebookEvents.length,
        pageViews: ebookEvents.filter(e => e.event.type === 'page-view').length,
        avgReadingTime: calculateAvgReadingTime(ebookEvents),
        popularChapters: getPopularChapters(ebookEvents),
        conversionRate: calculateConversionRate(ebookEvents)
    };
    
    res.json(summary);
});

// Helper functions
function calculateAvgReadingTime(events) {
    const sessions = {};
    events.forEach(e => {
        if (!sessions[e.sessionId]) {
            sessions[e.sessionId] = { start: e.serverTime, end: e.serverTime };
        } else {
            sessions[e.sessionId].end = e.serverTime;
        }
    });
    
    const times = Object.values(sessions).map(s => s.end - s.start);
    const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
    return Math.round(avg / 1000 / 60); // Minutes
}

function getPopularChapters(events) {
    const chapterViews = {};
    events
        .filter(e => e.event.type === 'page-view')
        .forEach(e => {
            const chapter = e.event.data.chapter;
            chapterViews[chapter] = (chapterViews[chapter] || 0) + 1;
        });
    
    return Object.entries(chapterViews)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([chapter, views]) => ({ chapter, views }));
}

function calculateConversionRate(events) {
    const sessions = new Set(events.map(e => e.sessionId)).size;
    const affiliateClicks = events.filter(e => e.event.type === 'affiliate-click').length;
    return sessions > 0 ? (affiliateClicks / sessions * 100).toFixed(1) : 0;
}

// List available ebooks
app.get('/api/ebooks', async (req, res) => {
    try {
        const ebooksDir = path.join(__dirname, '../build/ebooks');
        const ebooks = [];
        
        if (await fs.access(ebooksDir).then(() => true).catch(() => false)) {
            const dirs = await fs.readdir(ebooksDir);
            
            for (const dir of dirs) {
                const ebookPath = path.join(ebooksDir, dir, 'output/ebook.html');
                if (await fs.access(ebookPath).then(() => true).catch(() => false)) {
                    ebooks.push({
                        id: dir,
                        title: dir.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        url: `/reader/?id=${dir}`
                    });
                }
            }
        }
        
        res.json(ebooks);
    } catch (error) {
        console.error('Error listing ebooks:', error);
        res.json([]);
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.READER_PORT || 3003;
server.listen(PORT, () => {
    console.log(`📚 Ebook Reader server running on http://localhost:${PORT}`);
    console.log(`📊 Analytics endpoint: http://localhost:${PORT}/api/analytics`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
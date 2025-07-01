#!/usr/bin/env node

/**
 * AI Writing Assistant Real-time Server
 * Bridges Python backend with frontend UI using WebSocket
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const chokidar = require('chokidar');
const GrammarChecker = require('../scripts/grammar/grammar-checker');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuration
const PORT = process.env.PORT || 3002;
const PYTHON_PATH = process.env.PYTHON_PATH || 'python3';
const BACKEND_PATH = path.join(__dirname, '..', 'src', 'ebook_pipeline', 'assistants');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'writing-assistant-ui')));

// State management
const sessions = new Map();

class WritingSession {
    constructor(id, ws) {
        this.id = id;
        this.ws = ws;
        this.currentText = '';
        this.chapterNum = 1;
        this.contentType = 'general';
        this.lastActivity = Date.now();
        
        // Grammar checker instance
        this.grammarChecker = new GrammarChecker({
            language: 'pt-BR',
            apiUrl: process.env.LANGUAGETOOL_API || 'http://localhost:8081/v2'
        });
        
        // Python processes
        this.processes = {
            humanization: null,
            style: null,
            consistency: null,
            autocomplete: null,
            summary: null
        };
        
        // Initialize Python processes
        this.initializePythonProcesses();
    }
    
    async initializePythonProcesses() {
        // We'll spawn Python processes on-demand to save resources
        console.log(`Session ${this.id}: Initialized`);
    }
    
    async callPythonAssistant(assistant, method, args) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(BACKEND_PATH, `${assistant}.py`);
            const pythonArgs = [
                '-c',
                `
import sys
import json
sys.path.insert(0, '${path.dirname(scriptPath)}')

from ${assistant} import *

try:
    engine = ${this.getEngineClass(assistant)}()
    result = engine.${method}(${args.map(arg => JSON.stringify(arg)).join(', ')})
    print(json.dumps({'success': True, 'result': result}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`
            ];
            
            const pythonProcess = spawn(PYTHON_PATH, pythonArgs);
            let output = '';
            let error = '';
            
            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            pythonProcess.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}: ${error}`));
                    return;
                }
                
                try {
                    const result = JSON.parse(output);
                    if (result.success) {
                        resolve(result.result);
                    } else {
                        reject(new Error(result.error || 'Unknown error'));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse Python output: ${output}`));
                }
            });
        });
    }
    
    getEngineClass(assistant) {
        const classMap = {
            'humanization_engine': 'HumanizationEngine',
            'style_suggestion_engine': 'StyleSuggestionEngine',
            'consistency_checker': 'ConsistencyChecker',
            'smart_autocomplete': 'SmartAutoComplete',
            'summary_generator': 'SummaryGenerator'
        };
        return classMap[assistant] || assistant;
    }
    
    async handleMessage(message) {
        try {
            const data = JSON.parse(message);
            this.lastActivity = Date.now();
            
            switch (data.type) {
                case 'text_update':
                    await this.handleTextUpdate(data);
                    break;
                    
                case 'humanize':
                    await this.handleHumanize(data);
                    break;
                    
                case 'check_style':
                    await this.handleStyleCheck(data);
                    break;
                    
                case 'check_consistency':
                    await this.handleConsistencyCheck(data);
                    break;
                    
                case 'autocomplete':
                    await this.handleAutocomplete(data);
                    break;
                    
                case 'generate_summary':
                    await this.handleGenerateSummary(data);
                    break;
                    
                case 'set_context':
                    await this.handleSetContext(data);
                    break;
                    
                case 'check_grammar':
                    await this.handleGrammarCheck(data);
                    break;
                    
                default:
                    this.sendError(`Unknown message type: ${data.type}`);
            }
        } catch (e) {
            this.sendError(`Error processing message: ${e.message}`);
        }
    }
    
    async handleTextUpdate(data) {
        this.currentText = data.text;
        this.cursorPosition = data.cursorPosition || 0;
        
        // Trigger real-time checks
        if (data.realtime) {
            await Promise.all([
                this.checkStyleInBackground(),
                this.checkConsistencyInBackground(),
                this.checkGrammarInBackground(),
                this.getAutocompleteInBackground()
            ]);
        }
    }
    
    async handleHumanize(data) {
        try {
            const result = await this.callPythonAssistant(
                'humanization_engine',
                'humanize_text',
                [data.text, data.contentType || 'general', this.chapterNum]
            );
            
            this.sendMessage({
                type: 'humanization_result',
                text: result,
                requestId: data.requestId
            });
        } catch (error) {
            this.sendError(`Humanization failed: ${error.message}`);
        }
    }
    
    async handleStyleCheck(data) {
        try {
            const result = await this.callPythonAssistant(
                'style_suggestion_engine',
                'analyze_text',
                [data.text, { chapter_type: this.contentType }]
            );
            
            this.sendMessage({
                type: 'style_suggestions',
                suggestions: result,
                requestId: data.requestId
            });
        } catch (error) {
            this.sendError(`Style check failed: ${error.message}`);
        }
    }
    
    async handleConsistencyCheck(data) {
        try {
            const result = await this.callPythonAssistant(
                'consistency_checker',
                'check_consistency',
                [data.text, { current_chapter: this.chapterNum }]
            );
            
            this.sendMessage({
                type: 'consistency_issues',
                issues: result,
                requestId: data.requestId
            });
        } catch (error) {
            this.sendError(`Consistency check failed: ${error.message}`);
        }
    }
    
    async handleAutocomplete(data) {
        try {
            const result = await this.callPythonAssistant(
                'smart_autocomplete',
                'get_completions',
                [data.text, data.cursorPosition, { chapter_type: this.contentType }]
            );
            
            this.sendMessage({
                type: 'autocomplete_suggestions',
                suggestions: result,
                requestId: data.requestId
            });
        } catch (error) {
            this.sendError(`Autocomplete failed: ${error.message}`);
        }
    }
    
    async handleGenerateSummary(data) {
        try {
            const result = await this.callPythonAssistant(
                'summary_generator',
                'generate_summary',
                [data.text, data.summaryType || 'chapter', data.maxLength || 150]
            );
            
            this.sendMessage({
                type: 'summary_result',
                summary: result,
                requestId: data.requestId
            });
        } catch (error) {
            this.sendError(`Summary generation failed: ${error.message}`);
        }
    }
    
    async handleSetContext(data) {
        this.chapterNum = data.chapterNum || this.chapterNum;
        this.contentType = data.contentType || this.contentType;
        
        this.sendMessage({
            type: 'context_updated',
            context: {
                chapterNum: this.chapterNum,
                contentType: this.contentType
            }
        });
    }
    
    async handleGrammarCheck(data) {
        try {
            // Check if grammar server is available
            if (!await this.grammarChecker.checkServer()) {
                this.sendError('Grammar server not available. Start with: npm run grammar:server');
                return;
            }
            
            // Check grammar
            const result = await this.grammarChecker.checkText(data.text, {
                chapter: this.chapterNum,
                contentType: this.contentType
            });
            
            // Format matches for UI
            const formattedMatches = result.matches.map(match => 
                this.grammarChecker.formatMatchForDisplay(match)
            );
            
            this.sendMessage({
                type: 'grammar_results',
                matches: formattedMatches,
                stats: result.stats,
                requestId: data.requestId
            });
            
            // If auto-fix requested
            if (data.autoFix) {
                const [fixedText, fixedCount] = await this.grammarChecker.autoFixSimpleIssues(data.text);
                if (fixedCount > 0) {
                    this.sendMessage({
                        type: 'grammar_fixed',
                        text: fixedText,
                        fixedCount: fixedCount,
                        requestId: data.requestId
                    });
                }
            }
        } catch (error) {
            this.sendError(`Grammar check failed: ${error.message}`);
        }
    }
    
    async checkStyleInBackground() {
        // Debounced style checking
        clearTimeout(this.styleCheckTimeout);
        this.styleCheckTimeout = setTimeout(async () => {
            if (this.currentText.length > 50) {
                await this.handleStyleCheck({ text: this.currentText });
            }
        }, 1000); // 1 second delay
    }
    
    async checkConsistencyInBackground() {
        // Debounced consistency checking
        clearTimeout(this.consistencyCheckTimeout);
        this.consistencyCheckTimeout = setTimeout(async () => {
            if (this.currentText.length > 100) {
                await this.handleConsistencyCheck({ text: this.currentText });
            }
        }, 2000); // 2 second delay
    }
    
    async getAutocompleteInBackground() {
        // Fast autocomplete
        clearTimeout(this.autocompleteTimeout);
        this.autocompleteTimeout = setTimeout(async () => {
            await this.handleAutocomplete({
                text: this.currentText,
                cursorPosition: this.cursorPosition
            });
        }, 300); // 300ms delay
    }
    
    async checkGrammarInBackground() {
        // Debounced grammar checking
        clearTimeout(this.grammarCheckTimeout);
        this.grammarCheckTimeout = setTimeout(async () => {
            if (this.currentText.length > 20) {
                await this.handleGrammarCheck({ 
                    text: this.currentText,
                    autoFix: false 
                });
            }
        }, 1500); // 1.5 second delay
    }
    
    sendMessage(data) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    
    sendError(message) {
        this.sendMessage({
            type: 'error',
            message: message
        });
    }
    
    cleanup() {
        // Clean up timers
        clearTimeout(this.styleCheckTimeout);
        clearTimeout(this.consistencyCheckTimeout);
        clearTimeout(this.autocompleteTimeout);
        
        // Terminate Python processes if any
        Object.values(this.processes).forEach(proc => {
            if (proc) proc.kill();
        });
    }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    const sessionId = generateSessionId();
    const session = new WritingSession(sessionId, ws);
    sessions.set(sessionId, session);
    
    console.log(`New writing session: ${sessionId}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        sessionId: sessionId,
        message: 'AI Writing Assistant connected'
    }));
    
    // Handle messages
    ws.on('message', (message) => {
        session.handleMessage(message);
    });
    
    // Handle disconnect
    ws.on('close', () => {
        console.log(`Session closed: ${sessionId}`);
        session.cleanup();
        sessions.delete(sessionId);
    });
    
    // Handle errors
    ws.on('error', (error) => {
        console.error(`Session ${sessionId} error:`, error);
    });
});

// REST API endpoints
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        sessions: sessions.size,
        uptime: process.uptime()
    });
});

app.post('/api/humanize', async (req, res) => {
    try {
        const { text, contentType = 'general', chapterNum = 1 } = req.body;
        
        // Create temporary session for REST call
        const tempSession = new WritingSession('rest-' + Date.now(), null);
        const result = await tempSession.callPythonAssistant(
            'humanization_engine',
            'humanize_text',
            [text, contentType, chapterNum]
        );
        tempSession.cleanup();
        
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/analyze', async (req, res) => {
    try {
        const { text } = req.body;
        
        const tempSession = new WritingSession('rest-' + Date.now(), null);
        const result = await tempSession.callPythonAssistant(
            'humanization_engine',
            'analyze_text_humanity',
            [text]
        );
        tempSession.cleanup();
        
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/grammar', async (req, res) => {
    try {
        const { text, language = 'pt-BR', autoFix = false } = req.body;
        
        const checker = new GrammarChecker({
            language,
            apiUrl: process.env.LANGUAGETOOL_API || 'http://localhost:8081/v2'
        });
        
        // Check if server is available
        if (!await checker.checkServer()) {
            return res.status(503).json({
                success: false,
                error: 'Grammar server not available. Start with: npm run grammar:server'
            });
        }
        
        // Check grammar
        const result = await checker.checkText(text);
        
        // Format matches for UI
        const formattedMatches = result.matches.map(match => 
            checker.formatMatchForDisplay(match)
        );
        
        const response = {
            success: true,
            matches: formattedMatches,
            stats: result.stats
        };
        
        // Auto-fix if requested
        if (autoFix) {
            const [fixedText, fixedCount] = await checker.autoFixSimpleIssues(text);
            if (fixedCount > 0) {
                response.fixedText = fixedText;
                response.fixedCount = fixedCount;
            }
        }
        
        res.json(response);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve the UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'writing-assistant-ui', 'index.html'));
});

// Helper functions
function generateSessionId() {
    return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Clean up inactive sessions periodically
setInterval(() => {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    for (const [id, session] of sessions) {
        if (now - session.lastActivity > timeout) {
            console.log(`Cleaning up inactive session: ${id}`);
            session.cleanup();
            sessions.delete(id);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// Start server
server.listen(PORT, () => {
    console.log(`AI Writing Assistant Server running on http://localhost:${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    
    // Close WebSocket server
    wss.close(() => {
        console.log('WebSocket server closed');
    });
    
    // Clean up all sessions
    for (const session of sessions.values()) {
        session.cleanup();
    }
    
    // Close HTTP server
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
/**
 * AI Writing Assistant Frontend Application
 */

class WritingAssistant {
    constructor() {
        this.ws = null;
        this.sessionId = null;
        this.editor = null;
        this.isConnected = false;
        this.currentText = '';
        this.debounceTimers = {};
        
        this.init();
    }
    
    init() {
        // Initialize CodeMirror editor
        this.initEditor();
        
        // Connect to WebSocket server
        this.connect();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load saved state if any
        this.loadState();
    }
    
    initEditor() {
        const textarea = document.getElementById('editor');
        this.editor = CodeMirror.fromTextArea(textarea, {
            mode: 'markdown',
            theme: 'dracula',
            lineNumbers: true,
            lineWrapping: true,
            autofocus: true,
            tabSize: 2,
            indentUnit: 2,
            indentWithTabs: false,
            extraKeys: {
                'Tab': (cm) => cm.execCommand('indentMore'),
                'Shift-Tab': (cm) => cm.execCommand('indentLess'),
                'Ctrl-Space': () => this.triggerAutocomplete()
            }
        });
        
        // Real-time text change handler
        this.editor.on('change', (cm, change) => {
            this.handleTextChange(cm.getValue(), cm.getCursor());
        });
        
        // Cursor activity handler
        this.editor.on('cursorActivity', (cm) => {
            this.handleCursorChange(cm.getCursor());
        });
    }
    
    connect() {
        const wsUrl = `ws://localhost:3002`;
        this.updateStatus('Connecting...');
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
            this.updateStatus('Connected to AI Assistant');
        };
        
        this.ws.onmessage = (event) => {
            this.handleMessage(JSON.parse(event.data));
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('Connection error', 'error');
        };
        
        this.ws.onclose = () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.updateStatus('Disconnected. Attempting to reconnect...');
            
            // Attempt to reconnect after 3 seconds
            setTimeout(() => this.connect(), 3000);
        };
    }
    
    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('humanizeBtn').addEventListener('click', () => {
            this.humanizeText();
        });
        
        document.getElementById('checkStyleBtn').addEventListener('click', () => {
            this.checkStyle();
        });
        
        document.getElementById('checkConsistencyBtn').addEventListener('click', () => {
            this.checkConsistency();
        });
        
        document.getElementById('checkGrammarBtn').addEventListener('click', () => {
            this.checkGrammar(false);
        });
        
        document.getElementById('fixGrammarBtn')?.addEventListener('click', () => {
            this.checkGrammar(true);
        });
        
        document.getElementById('generateSummaryBtn').addEventListener('click', () => {
            this.generateSummary();
        });
        
        // Context controls
        document.getElementById('contentType').addEventListener('change', (e) => {
            this.updateContext();
        });
        
        document.getElementById('chapterNum').addEventListener('change', (e) => {
            this.updateContext();
        });
        
        // Panel toggles
        document.querySelectorAll('.panel h3').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });
    }
    
    handleTextChange(text, cursor) {
        this.currentText = text;
        
        // Update word count
        const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
        document.getElementById('wordCount').textContent = wordCount;
        
        // Send real-time update to server
        if (this.isConnected) {
            this.debounce('textUpdate', () => {
                this.sendMessage({
                    type: 'text_update',
                    text: text,
                    cursorPosition: this.editor.indexFromPos(cursor),
                    realtime: true
                });
            }, 500);
        }
        
        // Save state
        this.saveState();
    }
    
    handleCursorChange(cursor) {
        // Trigger autocomplete update
        if (this.isConnected) {
            this.debounce('autocomplete', () => {
                const position = this.editor.indexFromPos(cursor);
                this.sendMessage({
                    type: 'autocomplete',
                    text: this.currentText,
                    cursorPosition: position
                });
            }, 300);
        }
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'connected':
                this.sessionId = data.sessionId;
                this.updateContext();
                break;
                
            case 'humanization_result':
                this.handleHumanizationResult(data);
                break;
                
            case 'style_suggestions':
                this.handleStyleSuggestions(data.suggestions);
                break;
                
            case 'consistency_issues':
                this.handleConsistencyIssues(data.issues);
                break;
                
            case 'autocomplete_suggestions':
                this.handleAutocompleteSuggestions(data.suggestions);
                break;
                
            case 'summary_result':
                this.handleSummaryResult(data.summary);
                break;
                
            case 'grammar_results':
                this.handleGrammarResults(data);
                break;
                
            case 'grammar_fixed':
                this.handleGrammarFixed(data);
                break;
                
            case 'error':
                this.updateStatus(data.message, 'error');
                break;
        }
    }
    
    humanizeText() {
        if (!this.isConnected || !this.currentText.trim()) return;
        
        const selectedText = this.editor.getSelection();
        const textToHumanize = selectedText || this.currentText;
        
        this.updateStatus('Humanizing text...');
        this.sendMessage({
            type: 'humanize',
            text: textToHumanize,
            contentType: document.getElementById('contentType').value,
            requestId: Date.now()
        });
    }
    
    handleHumanizationResult(data) {
        const selectedText = this.editor.getSelection();
        
        if (selectedText) {
            // Replace selection
            this.editor.replaceSelection(data.text);
        } else {
            // Replace entire text
            this.editor.setValue(data.text);
        }
        
        this.updateStatus('Text humanized successfully', 'success');
        
        // Check humanity score
        this.analyzeHumanity(data.text);
    }
    
    checkStyle() {
        if (!this.isConnected || !this.currentText.trim()) return;
        
        this.updateStatus('Checking style...');
        this.sendMessage({
            type: 'check_style',
            text: this.currentText
        });
    }
    
    handleStyleSuggestions(suggestions) {
        const suggestionsEl = document.getElementById('suggestions');
        
        if (!suggestions || suggestions.length === 0) {
            suggestionsEl.innerHTML = '<p class="empty-state">No style issues found</p>';
            this.updateStatus('Style check complete - no issues', 'success');
            return;
        }
        
        suggestionsEl.innerHTML = '';
        suggestions.forEach(suggestion => {
            const item = this.createSuggestionItem(suggestion);
            suggestionsEl.appendChild(item);
        });
        
        this.updateStatus(`Found ${suggestions.length} style suggestions`);
    }
    
    createSuggestionItem(suggestion) {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `
            <div class="suggestion-type">${suggestion.severity}</div>
            <div class="suggestion-text">${suggestion.reason}</div>
            <div class="issue-suggestion">${suggestion.suggestion}</div>
        `;
        
        // Click to jump to position
        if (suggestion.position) {
            div.addEventListener('click', () => {
                const pos = this.editor.posFromIndex(suggestion.position[0]);
                this.editor.setCursor(pos);
                this.editor.focus();
            });
        }
        
        return div;
    }
    
    checkConsistency() {
        if (!this.isConnected || !this.currentText.trim()) return;
        
        this.updateStatus('Checking consistency...');
        this.sendMessage({
            type: 'check_consistency',
            text: this.currentText
        });
    }
    
    handleConsistencyIssues(issues) {
        const issuesEl = document.getElementById('issues');
        
        if (!issues || issues.length === 0) {
            issuesEl.innerHTML = '<p class="empty-state">No consistency issues found</p>';
            this.updateIssueCounts(0, 0, 0);
            this.updateStatus('Consistency check complete - no issues', 'success');
            return;
        }
        
        // Count issues by severity
        const counts = { error: 0, warning: 0, info: 0 };
        issues.forEach(issue => {
            counts[issue.severity] = (counts[issue.severity] || 0) + 1;
        });
        
        this.updateIssueCounts(counts.error, counts.warning, counts.info);
        
        issuesEl.innerHTML = '';
        issues.forEach(issue => {
            const item = this.createIssueItem(issue);
            issuesEl.appendChild(item);
        });
        
        this.updateStatus(`Found ${issues.length} consistency issues`);
    }
    
    createIssueItem(issue) {
        const div = document.createElement('div');
        div.className = `issue-item ${issue.severity}`;
        div.innerHTML = `
            <div class="issue-text">${issue.type}: ${issue.text}</div>
            <div class="issue-suggestion">${issue.reason}</div>
        `;
        
        // Click to jump to position
        if (issue.position) {
            div.addEventListener('click', () => {
                const pos = this.editor.posFromIndex(issue.position[0]);
                this.editor.setCursor(pos);
                this.editor.focus();
            });
        }
        
        return div;
    }
    
    handleAutocompleteSuggestions(suggestions) {
        const autocompleteEl = document.getElementById('autocomplete');
        
        if (!suggestions || suggestions.length === 0) {
            autocompleteEl.innerHTML = '<p class="empty-state">No completions available</p>';
            return;
        }
        
        autocompleteEl.innerHTML = '';
        suggestions.forEach(suggestion => {
            const item = this.createAutocompleteItem(suggestion);
            autocompleteEl.appendChild(item);
        });
    }
    
    createAutocompleteItem(suggestion) {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.innerHTML = `
            <span>${suggestion.text}</span>
            <span class="autocomplete-confidence">${Math.round(suggestion.confidence * 100)}%</span>
        `;
        
        div.addEventListener('click', () => {
            this.insertAutocomplete(suggestion.text);
        });
        
        return div;
    }
    
    insertAutocomplete(text) {
        const cursor = this.editor.getCursor();
        this.editor.replaceRange(text, cursor);
        this.editor.focus();
    }
    
    generateSummary() {
        if (!this.isConnected || !this.currentText.trim()) return;
        
        this.updateStatus('Generating summary...');
        document.getElementById('summaryPanel').classList.remove('collapsed');
        
        this.sendMessage({
            type: 'generate_summary',
            text: this.currentText,
            summaryType: 'chapter',
            maxLength: 150
        });
    }
    
    handleSummaryResult(summary) {
        const summaryEl = document.getElementById('summary');
        
        let html = `<div class="summary-content">`;
        
        if (summary.summary) {
            html += `<p>${summary.summary}</p>`;
        }
        
        if (summary.key_points && summary.key_points.length > 0) {
            html += `
                <div class="summary-section">
                    <h4>Key Points</h4>
                    <ul class="summary-list">
                        ${summary.key_points.map(point => `<li>${point}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (summary.characters_mentioned && summary.characters_mentioned.length > 0) {
            html += `
                <div class="summary-section">
                    <h4>Characters</h4>
                    <p>${summary.characters_mentioned.join(', ')}</p>
                </div>
            `;
        }
        
        html += '</div>';
        summaryEl.innerHTML = html;
        
        this.updateStatus('Summary generated', 'success');
    }
    
    analyzeHumanity(text) {
        // Quick local analysis for humanity score
        const analysis = this.quickHumanityAnalysis(text);
        document.getElementById('humanityScore').textContent = analysis.score;
    }
    
    quickHumanityAnalysis(text) {
        let score = 100;
        
        // Check for AI patterns
        const aiPatterns = [
            /\bFurthermore\b/gi,
            /\bMoreover\b/gi,
            /\bIn conclusion\b/gi,
            /\bIt is important to note\b/gi
        ];
        
        aiPatterns.forEach(pattern => {
            if (pattern.test(text)) score -= 5;
        });
        
        // Check for personal pronouns
        const personalPronouns = /\b(eu|você|nós|a gente)\b/gi;
        const pronounMatches = text.match(personalPronouns);
        if (!pronounMatches || pronounMatches.length < 5) score -= 10;
        
        // Check for questions
        const questions = text.match(/\?/g);
        if (!questions || questions.length === 0) score -= 5;
        
        return { score: Math.max(0, score) };
    }
    
    checkGrammar(autoFix = false) {
        if (!this.isConnected || !this.currentText.trim()) return;
        
        this.updateStatus('Checking grammar...');
        this.sendMessage({
            type: 'check_grammar',
            text: this.currentText,
            autoFix: autoFix
        });
    }
    
    handleGrammarResults(data) {
        const grammarEl = document.getElementById('grammarIssues');
        
        if (!data.matches || data.matches.length === 0) {
            grammarEl.innerHTML = '<p class="empty-state">No grammar issues found</p>';
            this.updateGrammarCounts(0, 0, 0);
            this.updateStatus('Grammar check complete - no issues', 'success');
            return;
        }
        
        // Count issues by type
        const counts = { error: 0, warning: 0, style: 0 };
        data.matches.forEach(match => {
            counts[match.type] = (counts[match.type] || 0) + 1;
        });
        
        this.updateGrammarCounts(counts.error, counts.warning, counts.style);
        
        grammarEl.innerHTML = '';
        data.matches.forEach(match => {
            const item = this.createGrammarItem(match);
            grammarEl.appendChild(item);
        });
        
        this.updateStatus(`Found ${data.matches.length} grammar issues`);
    }
    
    createGrammarItem(match) {
        const div = document.createElement('div');
        div.className = `grammar-item ${match.type}`;
        
        let suggestionsHTML = '';
        if (match.suggestions && match.suggestions.length > 0) {
            suggestionsHTML = `
                <div class="grammar-suggestions">
                    Suggestions: 
                    ${match.suggestions.map(s => 
                        `<span class="suggestion-chip" data-suggestion="${s}">${s}</span>`
                    ).join(' ')}
                </div>
            `;
        }
        
        div.innerHTML = `
            <div class="grammar-message">${match.message}</div>
            <div class="grammar-context">"${match.context.text}"</div>
            ${suggestionsHTML}
            <div class="grammar-category">${match.category}</div>
        `;
        
        // Click on context to jump to position
        const contextEl = div.querySelector('.grammar-context');
        if (contextEl && match.offset !== undefined) {
            contextEl.addEventListener('click', () => {
                const pos = this.editor.posFromIndex(match.offset);
                this.editor.setCursor(pos);
                this.editor.focus();
                
                // Select the error text
                const endPos = this.editor.posFromIndex(match.offset + match.length);
                this.editor.setSelection(pos, endPos);
            });
            contextEl.style.cursor = 'pointer';
        }
        
        // Click on suggestions to apply
        div.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const suggestion = e.target.dataset.suggestion;
                this.applyGrammarSuggestion(match, suggestion);
            });
        });
        
        return div;
    }
    
    applyGrammarSuggestion(match, suggestion) {
        const startPos = this.editor.posFromIndex(match.offset);
        const endPos = this.editor.posFromIndex(match.offset + match.length);
        
        this.editor.replaceRange(suggestion, startPos, endPos);
        this.updateStatus('Applied grammar suggestion', 'success');
        
        // Re-check grammar after applying fix
        setTimeout(() => this.checkGrammar(), 1000);
    }
    
    handleGrammarFixed(data) {
        if (data.fixedCount > 0) {
            // Replace the entire text with fixed version
            this.editor.setValue(data.text);
            this.updateStatus(`Auto-fixed ${data.fixedCount} grammar issues`, 'success');
            
            // Re-check grammar to show remaining issues
            setTimeout(() => this.checkGrammar(), 1000);
        }
    }
    
    updateGrammarCounts(errors, warnings, style) {
        const grammarCount = document.getElementById('grammarErrorCount');
        if (grammarCount) {
            grammarCount.innerHTML = `
                <span class="count error">${errors}</span>
                <span class="count warning">${warnings}</span>
                <span class="count info">${style}</span>
            `;
        }
    }
    
    updateContext() {
        if (!this.isConnected) return;
        
        const contentType = document.getElementById('contentType').value;
        const chapterNum = parseInt(document.getElementById('chapterNum').value) || 1;
        
        this.sendMessage({
            type: 'set_context',
            contentType: contentType,
            chapterNum: chapterNum
        });
    }
    
    triggerAutocomplete() {
        const cursor = this.editor.getCursor();
        const position = this.editor.indexFromPos(cursor);
        
        this.sendMessage({
            type: 'autocomplete',
            text: this.currentText,
            cursorPosition: position
        });
    }
    
    sendMessage(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    
    updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = message;
        statusEl.className = type;
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusEl.textContent = 'Ready';
                statusEl.className = 'info';
            }, 3000);
        }
    }
    
    updateConnectionStatus(connected) {
        const indicator = document.getElementById('connectionStatus');
        indicator.classList.toggle('connected', connected);
    }
    
    updateIssueCounts(errors, warnings, info) {
        document.getElementById('errorCount').textContent = errors;
        document.getElementById('warningCount').textContent = warnings;
        document.getElementById('infoCount').textContent = info;
    }
    
    debounce(key, fn, delay) {
        clearTimeout(this.debounceTimers[key]);
        this.debounceTimers[key] = setTimeout(fn, delay);
    }
    
    saveState() {
        const state = {
            text: this.currentText,
            contentType: document.getElementById('contentType').value,
            chapterNum: document.getElementById('chapterNum').value,
            timestamp: Date.now()
        };
        localStorage.setItem('writingAssistantState', JSON.stringify(state));
    }
    
    loadState() {
        const saved = localStorage.getItem('writingAssistantState');
        if (!saved) return;
        
        try {
            const state = JSON.parse(saved);
            
            // Only restore if less than 24 hours old
            if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
                if (state.text) {
                    this.editor.setValue(state.text);
                }
                if (state.contentType) {
                    document.getElementById('contentType').value = state.contentType;
                }
                if (state.chapterNum) {
                    document.getElementById('chapterNum').value = state.chapterNum;
                }
            }
        } catch (e) {
            console.error('Failed to load saved state:', e);
        }
    }
}

// Initialize the application
const app = new WritingAssistant();
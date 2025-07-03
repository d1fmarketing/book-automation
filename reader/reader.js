// Main Reader Functionality
class EbookReader {
    constructor() {
        this.currentChapter = 0;
        this.chapters = [];
        this.settings = this.loadSettings();
        this.bookmarks = this.loadBookmarks();
        this.notes = this.loadNotes();
        this.readingProgress = this.loadProgress();
        this.init();
    }
    
    async init() {
        // Apply saved settings
        this.applySettings();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize components
        if (window.social) {
            window.social.initStarRating();
        }
        
        console.log('📖 Reader initialized');
    }
    
    async initializeReader(ebookId) {
        try {
            // Show loading state
            this.showLoading();
            
            // Load ebook data
            const ebookData = await this.loadEbookData(ebookId);
            
            // Set up reader
            this.ebookTitle = ebookData.title;
            this.chapters = ebookData.chapters;
            
            // Update UI
            document.querySelector('.book-title').textContent = this.ebookTitle;
            if (window.social) {
                window.social.ebookTitle = this.ebookTitle;
            }
            
            // Build table of contents
            this.buildTableOfContents();
            
            // Load saved progress or first chapter
            const savedChapter = this.readingProgress[ebookId]?.currentChapter || 0;
            this.loadChapter(savedChapter);
            
            // Display saved data
            this.displayBookmarks();
            this.displayNotes();
            if (window.social) {
                window.social.displayHighlights();
                window.social.displayRecommendations();
                window.social.showSocialProof();
            }
            
            // Track page view
            if (window.ebookAnalytics) {
                window.ebookAnalytics.trackPageView(savedChapter, this.chapters[savedChapter]?.title);
            }
            
        } catch (error) {
            console.error('Failed to initialize reader:', error);
            this.showError('Failed to load ebook. Please try again.');
        }
    }
    
    async loadEbookData(ebookId) {
        // In production, this would fetch from server
        // For now, load from local storage or use demo data
        
        const demoData = {
            id: ebookId,
            title: 'AI Prompts for Business Success',
            author: 'Money Machine AI',
            chapters: [
                {
                    id: 0,
                    title: 'Introduction: The AI Revolution',
                    content: `<h1>Introduction: The AI Revolution</h1>
                    <p>Welcome to the future of business automation. In this comprehensive guide, you'll discover how to leverage AI prompts to transform your business operations, boost productivity, and increase revenue.</p>
                    <p>Artificial Intelligence is no longer a futuristic concept—it's here, and it's revolutionizing how we work. From content creation to customer service, AI-powered tools are enabling businesses of all sizes to compete at unprecedented levels.</p>
                    <h2>What You'll Learn</h2>
                    <ul>
                        <li>How to craft effective AI prompts for maximum results</li>
                        <li>Real-world applications across different business functions</li>
                        <li>Advanced techniques for prompt engineering</li>
                        <li>Case studies from successful implementations</li>
                    </ul>
                    <blockquote>
                        <p>"AI won't replace humans, but humans using AI will replace humans not using AI." - Anonymous</p>
                    </blockquote>
                    <p>Let's begin your journey to AI mastery...</p>`
                },
                {
                    id: 1,
                    title: 'Chapter 1: Understanding AI Prompts',
                    content: `<h1>Chapter 1: Understanding AI Prompts</h1>
                    <p>At its core, an AI prompt is simply an instruction or question you give to an AI system. However, the art of prompt engineering—crafting these instructions for optimal results—is what separates average users from AI power users.</p>
                    <h2>The Anatomy of an Effective Prompt</h2>
                    <p>Every effective prompt contains several key elements:</p>
                    <ol>
                        <li><strong>Context:</strong> Background information to frame your request</li>
                        <li><strong>Task:</strong> Clear description of what you want</li>
                        <li><strong>Format:</strong> How you want the output structured</li>
                        <li><strong>Constraints:</strong> Any limitations or requirements</li>
                    </ol>
                    <h3>Example: Basic vs. Advanced Prompts</h3>
                    <p><strong>Basic:</strong> "Write a marketing email"</p>
                    <p><strong>Advanced:</strong> "Act as a senior marketing copywriter for a B2B SaaS company. Write a 150-word email to CTOs announcing our new AI-powered analytics feature. Use a professional but conversational tone, include one statistic about productivity gains, and end with a clear CTA to book a demo."</p>
                    <p>See the difference? The advanced prompt provides context, specifies the audience, sets constraints, and defines the desired outcome.</p>`
                },
                {
                    id: 2,
                    title: 'Chapter 2: AI for Content Creation',
                    content: `<h1>Chapter 2: AI for Content Creation</h1>
                    <p>Content is king in the digital age, but creating high-quality content consistently is challenging. AI can be your secret weapon for scaling content production without sacrificing quality.</p>
                    <h2>Blog Post Generation</h2>
                    <p>Here's a proven template for generating engaging blog posts:</p>
                    <pre><code>Role: You are an expert content writer specializing in [industry].
Task: Write a comprehensive blog post about [topic].
Structure:
- Compelling headline with power words
- Introduction with a hook (statistic, question, or bold statement)
- 3-5 main sections with subheadings
- Practical examples or case studies
- Actionable takeaways
- SEO-optimized conclusion with CTA

Tone: [professional/casual/authoritative]
Length: [word count]
Keywords to include: [list keywords]</code></pre>
                    <h2>Social Media Content</h2>
                    <p>Different platforms require different approaches. Here are optimized prompts for each major platform...</p>`
                }
            ]
        };
        
        return demoData;
    }
    
    buildTableOfContents() {
        const toc = document.getElementById('table-of-contents');
        
        toc.innerHTML = this.chapters.map((chapter, index) => {
            const isCompleted = this.readingProgress[window.EBOOK_ID]?.completedChapters?.includes(index);
            return `
                <a href="#" class="toc-item ${index === this.currentChapter ? 'active' : ''} ${isCompleted ? 'completed' : ''}" 
                   onclick="reader.loadChapter(${index}); return false;">
                    ${chapter.title}
                </a>
            `;
        }).join('');
    }
    
    async loadChapter(chapterIndex) {
        if (chapterIndex < 0 || chapterIndex >= this.chapters.length) return;
        
        // Update current chapter
        this.currentChapter = chapterIndex;
        const chapter = this.chapters[chapterIndex];
        
        // Update content
        const contentArea = document.getElementById('ebook-content');
        contentArea.innerHTML = chapter.content;
        
        // Update UI
        this.updateChapterNavigation();
        this.updateTableOfContents();
        this.updateReadingProgress();
        
        // Scroll to top
        contentArea.scrollTop = 0;
        
        // Apply highlights
        this.restoreHighlights();
        
        // Track analytics
        if (window.ebookAnalytics) {
            window.ebookAnalytics.trackPageView(chapterIndex, chapter.title);
            window.ebookAnalytics.currentChapter = chapter.title;
        }
        
        // Save progress
        this.saveProgress();
    }
    
    updateChapterNavigation() {
        const prevBtn = document.querySelector('.chapter-nav-btn.prev');
        const nextBtn = document.querySelector('.chapter-nav-btn.next');
        
        prevBtn.disabled = this.currentChapter === 0;
        nextBtn.disabled = this.currentChapter === this.chapters.length - 1;
    }
    
    updateTableOfContents() {
        document.querySelectorAll('.toc-item').forEach((item, index) => {
            item.classList.toggle('active', index === this.currentChapter);
        });
    }
    
    updateReadingProgress() {
        const progress = ((this.currentChapter + 1) / this.chapters.length) * 100;
        document.getElementById('reading-progress').style.width = `${progress}%`;
        document.querySelector('.progress-percent').textContent = `${Math.round(progress)}%`;
        
        // Update reading time estimate
        const wordsPerMinute = 200;
        const remainingChapters = this.chapters.slice(this.currentChapter);
        const remainingWords = remainingChapters.reduce((total, ch) => {
            const text = ch.content.replace(/<[^>]*>/g, '');
            return total + text.split(/\s+/).length;
        }, 0);
        const remainingMinutes = Math.ceil(remainingWords / wordsPerMinute);
        
        document.querySelector('.reading-time').textContent = `${remainingMinutes} min left`;
        
        // Update completed chapters
        const completed = this.readingProgress[window.EBOOK_ID]?.completedChapters?.length || 0;
        document.getElementById('chapters-completed').textContent = `${completed}/${this.chapters.length}`;
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.previousChapter();
            if (e.key === 'ArrowRight') this.nextChapter();
            if (e.key === 'Escape') this.closeAllModals();
        });
        
        // Scroll tracking
        let scrollTimeout;
        document.getElementById('ebook-content').addEventListener('scroll', (e) => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.trackScrollDepth(e.target);
            }, 100);
        });
        
        // Settings listeners
        document.getElementById('line-height').addEventListener('input', (e) => {
            this.updateSetting('lineHeight', e.target.value);
        });
        
        document.getElementById('font-family').addEventListener('change', (e) => {
            this.updateSetting('fontFamily', e.target.value);
        });
        
        document.getElementById('reading-width').addEventListener('change', (e) => {
            this.updateSetting('readingWidth', e.target.value);
        });
        
        document.getElementById('analytics-enabled').addEventListener('change', (e) => {
            if (e.target.checked) {
                window.ebookAnalytics?.enableAnalytics();
            } else {
                window.ebookAnalytics?.disableAnalytics();
            }
        });
        
        // Link click tracking
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && e.target.href) {
                const url = e.target.href;
                const isAffiliate = e.target.rel?.includes('sponsored');
                
                if (window.ebookAnalytics) {
                    if (isAffiliate) {
                        window.ebookAnalytics.trackAffiliate(url, e.target.textContent);
                    } else {
                        window.ebookAnalytics.trackLinkClick(url, 'external');
                    }
                }
            }
        });
    }
    
    trackScrollDepth(container) {
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const scrollPercent = (scrollTop / (scrollHeight - clientHeight)) * 100;
        
        if (window.ebookAnalytics) {
            window.ebookAnalytics.trackScrollDepth(scrollPercent);
        }
        
        // Mark chapter as completed if scrolled > 90%
        if (scrollPercent > 90) {
            this.markChapterCompleted(this.currentChapter);
        }
    }
    
    markChapterCompleted(chapterIndex) {
        const progress = this.readingProgress[window.EBOOK_ID] || {};
        if (!progress.completedChapters) {
            progress.completedChapters = [];
        }
        
        if (!progress.completedChapters.includes(chapterIndex)) {
            progress.completedChapters.push(chapterIndex);
            this.readingProgress[window.EBOOK_ID] = progress;
            this.saveProgress();
            
            // Update UI
            this.updateReadingProgress();
            document.querySelectorAll('.toc-item')[chapterIndex].classList.add('completed');
            
            // Check if book completed
            if (progress.completedChapters.length === this.chapters.length) {
                this.showCompletionCertificate();
            }
        }
    }
    
    showCompletionCertificate() {
        const modal = document.getElementById('certificate-modal');
        document.getElementById('certificate-name').textContent = 'Valued Reader';
        document.getElementById('certificate-book').textContent = this.ebookTitle;
        document.getElementById('certificate-date').textContent = new Date().toLocaleDateString();
        modal.classList.add('active');
        
        if (window.social) {
            window.social.showNotification('🎉 Congratulations on completing the ebook!');
        }
    }
    
    // Navigation functions
    previousChapter() {
        if (this.currentChapter > 0) {
            this.loadChapter(this.currentChapter - 1);
        }
    }
    
    nextChapter() {
        if (this.currentChapter < this.chapters.length - 1) {
            this.loadChapter(this.currentChapter + 1);
        }
    }
    
    // Settings management
    loadSettings() {
        const defaults = {
            fontSize: 16,
            lineHeight: 1.6,
            fontFamily: 'Merriweather',
            readingWidth: 'medium',
            nightMode: false
        };
        
        const saved = localStorage.getItem('reader-settings');
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    }
    
    saveSettings() {
        localStorage.setItem('reader-settings', JSON.stringify(this.settings));
    }
    
    applySettings() {
        const root = document.documentElement;
        root.style.setProperty('--font-size', `${this.settings.fontSize}px`);
        root.style.setProperty('--line-height', this.settings.lineHeight);
        root.style.setProperty('--reading-font', this.settings.fontFamily);
        
        const widthMap = {
            narrow: '600px',
            medium: '680px',
            wide: '800px'
        };
        root.style.setProperty('--reading-width', widthMap[this.settings.readingWidth]);
        
        if (this.settings.nightMode) {
            document.body.classList.add('night-mode');
        }
        
        // Update UI controls
        document.getElementById('font-size-value').textContent = `${this.settings.fontSize}px`;
        document.getElementById('line-height').value = this.settings.lineHeight;
        document.getElementById('font-family').value = this.settings.fontFamily;
        document.getElementById('reading-width').value = this.settings.readingWidth;
    }
    
    updateSetting(key, value) {
        this.settings[key] = value;
        this.applySettings();
        this.saveSettings();
        
        if (window.ebookAnalytics) {
            window.ebookAnalytics.trackSettings(key, value);
        }
    }
    
    increaseFontSize() {
        if (this.settings.fontSize < 24) {
            this.updateSetting('fontSize', this.settings.fontSize + 1);
        }
    }
    
    decreaseFontSize() {
        if (this.settings.fontSize > 12) {
            this.updateSetting('fontSize', this.settings.fontSize - 1);
        }
    }
    
    toggleNightMode() {
        this.settings.nightMode = !this.settings.nightMode;
        document.body.classList.toggle('night-mode');
        this.saveSettings();
        
        const btn = document.querySelector('[onclick="toggleNightMode()"] i');
        btn.className = this.settings.nightMode ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    // Bookmarks
    loadBookmarks() {
        return JSON.parse(localStorage.getItem('bookmarks') || '{}');
    }
    
    saveBookmarks() {
        localStorage.setItem('bookmarks', JSON.stringify(this.bookmarks));
    }
    
    toggleBookmark() {
        const key = `${window.EBOOK_ID}_${this.currentChapter}`;
        
        if (this.bookmarks[key]) {
            delete this.bookmarks[key];
            if (window.ebookAnalytics) {
                window.ebookAnalytics.trackBookmark(this.currentChapter, 'remove');
            }
        } else {
            this.bookmarks[key] = {
                chapter: this.currentChapter,
                title: this.chapters[this.currentChapter].title,
                timestamp: Date.now()
            };
            if (window.ebookAnalytics) {
                window.ebookAnalytics.trackBookmark(this.currentChapter, 'add');
            }
        }
        
        this.saveBookmarks();
        this.displayBookmarks();
        this.updateBookmarkButton();
    }
    
    displayBookmarks() {
        const bookmarksList = document.getElementById('bookmarks-list');
        const ebookBookmarks = Object.entries(this.bookmarks)
            .filter(([key]) => key.startsWith(window.EBOOK_ID))
            .map(([, bookmark]) => bookmark);
        
        bookmarksList.innerHTML = ebookBookmarks.map(bookmark => `
            <div class="bookmark-item" onclick="reader.loadChapter(${bookmark.chapter})">
                ${bookmark.title}
            </div>
        `).join('') || '<p style="color: var(--text-secondary); font-size: 0.875rem;">No bookmarks yet</p>';
    }
    
    updateBookmarkButton() {
        const key = `${window.EBOOK_ID}_${this.currentChapter}`;
        const btn = document.querySelector('[onclick="toggleBookmark()"] i');
        
        if (this.bookmarks[key]) {
            btn.classList.remove('far');
            btn.classList.add('fas');
        } else {
            btn.classList.remove('fas');
            btn.classList.add('far');
        }
    }
    
    // Notes
    loadNotes() {
        return JSON.parse(localStorage.getItem('notes') || '[]');
    }
    
    saveNotes() {
        localStorage.setItem('notes', JSON.stringify(this.notes));
    }
    
    saveNote() {
        const noteText = document.getElementById('note-input').value.trim();
        if (!noteText) return;
        
        const note = {
            id: Date.now(),
            text: noteText,
            chapter: this.currentChapter,
            chapterTitle: this.chapters[this.currentChapter].title,
            timestamp: Date.now()
        };
        
        this.notes.unshift(note);
        this.saveNotes();
        this.displayNotes();
        
        document.getElementById('note-input').value = '';
        
        if (window.ebookAnalytics) {
            window.ebookAnalytics.trackNote(this.currentChapter, noteText.length);
        }
        
        if (window.social) {
            window.social.showNotification('Note saved!');
        }
    }
    
    displayNotes() {
        const notesList = document.getElementById('notes-list');
        const chapterNotes = this.notes.filter(note => note.chapter === this.currentChapter);
        
        notesList.innerHTML = chapterNotes.map(note => `
            <div class="note-item">
                <div class="note-date">${new Date(note.timestamp).toLocaleString()}</div>
                <div class="note-text">${note.text}</div>
            </div>
        `).join('') || '<p style="color: var(--text-secondary); font-size: 0.875rem;">No notes for this chapter</p>';
    }
    
    // Progress tracking
    loadProgress() {
        return JSON.parse(localStorage.getItem('reading-progress') || '{}');
    }
    
    saveProgress() {
        const progress = this.readingProgress[window.EBOOK_ID] || {};
        progress.currentChapter = this.currentChapter;
        progress.lastRead = Date.now();
        
        this.readingProgress[window.EBOOK_ID] = progress;
        localStorage.setItem('reading-progress', JSON.stringify(this.readingProgress));
    }
    
    // Highlights
    restoreHighlights() {
        const highlights = JSON.parse(localStorage.getItem('highlights') || '[]');
        const chapterHighlights = highlights.filter(h => h.chapter === this.chapters[this.currentChapter]?.title);
        
        // This would need more sophisticated text matching in production
        // For now, we'll skip automatic restoration
    }
    
    // UI functions
    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('collapsed');
    }
    
    toggleNotesPanel() {
        const panel = document.getElementById('right-panel');
        panel.classList.toggle('active');
        
        if (panel.classList.contains('active')) {
            this.displayNotes();
        }
    }
    
    showSettings() {
        document.getElementById('settings-modal').classList.add('active');
    }
    
    closeSettings() {
        document.getElementById('settings-modal').classList.remove('active');
    }
    
    shareChapter() {
        const modal = document.getElementById('share-modal');
        const preview = document.getElementById('share-preview');
        
        preview.textContent = `Check out "${this.chapters[this.currentChapter].title}" from ${this.ebookTitle}`;
        modal.classList.add('active');
    }
    
    closeShareModal() {
        document.getElementById('share-modal').classList.remove('active');
    }
    
    showReviewForm() {
        document.getElementById('review-modal').classList.add('active');
        if (window.social) {
            window.social.initStarRating();
        }
    }
    
    closeReviewModal() {
        document.getElementById('review-modal').classList.remove('active');
    }
    
    downloadCertificate() {
        // In production, this would generate a PDF
        window.print();
    }
    
    closeCertificate() {
        document.getElementById('certificate-modal').classList.remove('active');
    }
    
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }
    
    handleResize() {
        // Update mobile UI
        if (window.innerWidth < 768) {
            document.getElementById('sidebar').classList.add('collapsed');
        }
    }
    
    showLoading() {
        document.getElementById('ebook-content').innerHTML = `
            <div style="text-align: center; padding: 4rem;">
                <div class="loading"></div>
                <p style="margin-top: 1rem; color: var(--text-secondary);">Loading ebook...</p>
            </div>
        `;
    }
    
    showError(message) {
        document.getElementById('ebook-content').innerHTML = `
            <div style="text-align: center; padding: 4rem;">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 1rem; display: block;"></i>
                <p style="color: var(--text-secondary);">${message}</p>
                <button class="btn-primary" style="margin-top: 1rem;" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

// Initialize reader and expose global functions
const reader = new EbookReader();

// Global functions for onclick handlers
window.reader = reader;
window.initializeReader = (ebookId) => reader.initializeReader(ebookId);
window.toggleSidebar = () => reader.toggleSidebar();
window.toggleBookmark = () => reader.toggleBookmark();
window.shareChapter = () => reader.shareChapter();
window.toggleNightMode = () => reader.toggleNightMode();
window.showSettings = () => reader.showSettings();
window.closeSettings = () => reader.closeSettings();
window.closeShareModal = () => reader.closeShareModal();
window.showReviewForm = () => reader.showReviewForm();
window.closeReviewModal = () => reader.closeReviewModal();
window.submitReview = () => window.social?.submitReview();
window.downloadCertificate = () => reader.downloadCertificate();
window.closeCertificate = () => reader.closeCertificate();
window.previousChapter = () => reader.previousChapter();
window.nextChapter = () => reader.nextChapter();
window.increaseFontSize = () => reader.increaseFontSize();
window.decreaseFontSize = () => reader.decreaseFontSize();
window.toggleNotesPanel = () => reader.toggleNotesPanel();
window.saveNote = () => reader.saveNote();

// Set ebook ID
window.EBOOK_ID = 'default';
window.ANALYTICS_ENDPOINT = '/api/analytics';
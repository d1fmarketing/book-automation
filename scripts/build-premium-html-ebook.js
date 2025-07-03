#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');
const { injectIntoHTML } = require('../agents/chat-embedder-websocket');
const AffiliateResolver = require('../utils/affiliate-resolver');

// Paths
const EBOOK_DIR = path.join(__dirname, '../build/ebooks/chatgpt-ai-prompts-for-business-success');
const CHAPTERS_DIR = path.join(EBOOK_DIR, 'chapters');
const IMAGES_DIR = path.join(__dirname, '../build/html-ebook/images');
const OUTPUT_DIR = path.join(__dirname, '../build/html-ebook');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'index.html');

// Configure marked with custom renderer
const renderer = new marked.Renderer();

// Custom renderer for callouts
renderer.blockquote = function(quote) {
    const calloutTypes = {
        'TIP': { icon: '💡', class: 'tip', title: 'Pro Tip' },
        'WARNING': { icon: '⚠️', class: 'warning', title: 'Warning' },
        'KEY': { icon: '🔑', class: 'key', title: 'Key Point' },
        'SUCCESS': { icon: '✅', class: 'success', title: 'Success' },
        'INFO': { icon: 'ℹ️', class: 'info', title: 'Information' },
        'QUOTE': { icon: '💬', class: 'quote', title: 'Quote' }
    };
    
    // Check if this is a callout
    const calloutMatch = quote.match(/^\[!(\w+)\]\s*(.*?)$/m);
    if (calloutMatch) {
        const type = calloutMatch[1].toUpperCase();
        const calloutInfo = calloutTypes[type] || calloutTypes['INFO'];
        const content = quote.replace(/^\[!\w+\]\s*/m, '');
        
        return `
        <div class="callout callout-${calloutInfo.class}" data-aos="fade-up">
            <div class="callout-header">
                <span class="callout-icon">${calloutInfo.icon}</span>
                <span class="callout-title">${calloutInfo.title}</span>
            </div>
            <div class="callout-content">${marked.parse(content)}</div>
        </div>`;
    }
    
    return `<blockquote>${quote}</blockquote>`;
};

// Custom renderer for code blocks
renderer.code = function(code, language) {
    const id = 'code-' + Math.random().toString(36).substr(2, 9);
    return `
    <div class="code-block" data-language="${language || 'text'}">
        <div class="code-header">
            <span class="code-language">${language || 'text'}</span>
            <button class="copy-code-btn" onclick="copyCode('${id}')">
                <span class="copy-icon">📋</span>
                <span class="copy-text">Copy</span>
            </button>
        </div>
        <pre><code id="${id}" class="language-${language || 'text'}">${escapeHtml(code)}</code></pre>
    </div>`;
};

// Custom renderer for task lists
renderer.listitem = function(text, task, checked) {
    if (task) {
        const id = 'task-' + Math.random().toString(36).substr(2, 9);
        return `<li class="task-item">
            <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} onchange="saveTaskState('${id}', this.checked)">
            <label for="${id}">${text}</label>
        </li>`;
    }
    return `<li>${text}</li>`;
};

// Custom renderer for tables
renderer.table = function(header, body) {
    return `
    <div class="table-wrapper">
        <table class="premium-table">
            <thead>${header}</thead>
            <tbody>${body}</tbody>
        </table>
    </div>`;
};

marked.setOptions({
    renderer: renderer,
    gfm: true,
    breaks: true,
    tables: true,
    sanitize: false,
    smartLists: true,
    smartypants: true
});

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

async function loadChapters() {
    const files = await fs.readdir(CHAPTERS_DIR);
    const chapters = [];
    
    for (const file of files.sort()) {
        if (!file.endsWith('.md')) continue;
        
        const content = await fs.readFile(path.join(CHAPTERS_DIR, file), 'utf-8');
        const lines = content.split('\n');
        
        // Parse frontmatter
        let title = '';
        let description = '';
        let chapterNumber = 0;
        
        if (lines[0] === '---') {
            let i = 1;
            while (i < lines.length && lines[i] !== '---') {
                const line = lines[i];
                if (line.startsWith('chap:')) {
                    chapterNumber = parseInt(line.split(':')[1].trim());
                } else if (line.startsWith('title:')) {
                    title = line.split(':').slice(1).join(':').trim().replace(/['"]/g, '');
                } else if (line.startsWith('description:')) {
                    description = line.split(':').slice(1).join(':').trim().replace(/['"]/g, '');
                }
                i++;
            }
            
            // Get content after frontmatter
            const contentStart = lines.findIndex((line, idx) => idx > 0 && line === '---') + 1;
            const mainContent = lines.slice(contentStart).join('\n');
            
            chapters.push({
                number: chapterNumber,
                title: title,
                description: description,
                content: marked.parse(mainContent),
                id: `chapter-${chapterNumber}`,
                file: file
            });
        }
    }
    
    return chapters.sort((a, b) => a.number - b.number);
}

async function checkForImages() {
    try {
        const files = await fs.readdir(IMAGES_DIR);
        const images = {};
        
        for (const file of files) {
            if (file.endsWith('.png') || file.endsWith('.jpg')) {
                const imagePath = path.join(IMAGES_DIR, file);
                const imageData = await fs.readFile(imagePath);
                const base64 = imageData.toString('base64');
                const ext = path.extname(file).slice(1);
                images[file.replace(/\.[^.]+$/, '')] = `data:image/${ext};base64,${base64}`;
            }
        }
        
        return images;
    } catch (error) {
        console.log('⚠️  No images found, using placeholders');
        return {};
    }
}

async function generatePremiumHTML() {
    console.log('🚀 Building Premium HTML Ebook...\n');
    
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Load chapters
    console.log('📚 Loading chapters...');
    const chapters = await loadChapters();
    console.log(`✅ Loaded ${chapters.length} chapters\n`);
    
    // Check for generated images
    console.log('🖼️  Checking for images...');
    const images = await checkForImages();
    console.log(`✅ Found ${Object.keys(images).length} images\n`);
    
    // Generate table of contents
    const tocHTML = chapters.map(ch => `
        <li class="toc-item" data-chapter="${ch.number}">
            <a href="#${ch.id}" class="toc-link">
                <span class="toc-number">Chapter ${ch.number}</span>
                <span class="toc-title">${ch.title}</span>
                <span class="toc-progress">
                    <span class="progress-bar" style="width: 0%"></span>
                </span>
            </a>
        </li>
    `).join('');
    
    // Generate chapters HTML
    const chaptersHTML = chapters.map(ch => {
        const chapterImage = images[`chapter-${String(ch.number).padStart(2, '0')}`] || '';
        
        return `
        <section class="chapter" id="${ch.id}" data-chapter="${ch.number}">
            ${chapterImage ? `<div class="chapter-hero">
                <img src="${chapterImage}" alt="${ch.title}" class="chapter-image" loading="lazy">
                <div class="chapter-overlay">
                    <h1 class="chapter-title">${ch.title}</h1>
                    ${ch.description ? `<p class="chapter-description">${ch.description}</p>` : ''}
                </div>
            </div>` : ''}
            <div class="chapter-content">
                ${ch.content}
            </div>
            <nav class="chapter-nav">
                ${ch.number > 1 ? `<a href="#chapter-${ch.number - 1}" class="nav-prev">← Previous Chapter</a>` : ''}
                ${ch.number < chapters.length ? `<a href="#chapter-${ch.number + 1}" class="nav-next">Next Chapter →</a>` : ''}
            </nav>
        </section>
    `;
    }).join('');
    
    // Generate the complete HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ChatGPT & AI Prompts for Business Success - Premium Ebook</title>
    <meta name="description" content="Master ChatGPT and AI prompts to transform your business. The complete 2025 guide with proven strategies, real examples, and actionable frameworks.">
    
    <!-- Open Graph / Social Media -->
    <meta property="og:title" content="ChatGPT & AI Prompts for Business Success">
    <meta property="og:description" content="The complete guide to leveraging AI for business growth">
    <meta property="og:image" content="${images['cover'] || ''}">
    <meta property="og:type" content="book">
    
    <!-- Preload critical resources -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    
    <style>
        /* Critical CSS - Base Styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            /* Color Scheme */
            --primary: #0ea5e9;
            --primary-dark: #0284c7;
            --secondary: #06b6d4;
            --accent: #fbbf24;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --info: #8b5cf6;
            
            /* Neutral Colors */
            --bg-primary: #ffffff;
            --bg-secondary: #f8fafc;
            --bg-tertiary: #f1f5f9;
            --text-primary: #0f172a;
            --text-secondary: #475569;
            --text-tertiary: #64748b;
            --border: #e2e8f0;
            
            /* Dark Mode Colors */
            --dark-bg-primary: #0f172a;
            --dark-bg-secondary: #1e293b;
            --dark-bg-tertiary: #334155;
            --dark-text-primary: #f8fafc;
            --dark-text-secondary: #cbd5e1;
            --dark-text-tertiary: #94a3b8;
            --dark-border: #334155;
            
            /* Typography */
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            --font-serif: Georgia, Cambria, "Times New Roman", Times, serif;
            --font-mono: Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            
            /* Spacing */
            --content-width: 750px;
            --sidebar-width: 300px;
            
            /* Transitions */
            --transition-fast: 150ms ease;
            --transition-base: 250ms ease;
            --transition-slow: 350ms ease;
        }
        
        /* Dark Mode Variables */
        [data-theme="dark"] {
            --bg-primary: var(--dark-bg-primary);
            --bg-secondary: var(--dark-bg-secondary);
            --bg-tertiary: var(--dark-bg-tertiary);
            --text-primary: var(--dark-text-primary);
            --text-secondary: var(--dark-text-secondary);
            --text-tertiary: var(--dark-text-tertiary);
            --border: var(--dark-border);
        }
        
        /* Base Styles */
        html {
            scroll-behavior: smooth;
            overflow-x: hidden;
        }
        
        body {
            font-family: var(--font-serif);
            font-size: 18px;
            line-height: 1.7;
            color: var(--text-primary);
            background: var(--bg-primary);
            transition: background-color var(--transition-base), color var(--transition-base);
        }
        
        /* Typography */
        h1, h2, h3, h4, h5, h6 {
            font-family: var(--font-sans);
            font-weight: 700;
            line-height: 1.2;
            margin-top: 2rem;
            margin-bottom: 1rem;
            color: var(--text-primary);
        }
        
        h1 { font-size: 2.5rem; }
        h2 { font-size: 2rem; }
        h3 { font-size: 1.5rem; }
        h4 { font-size: 1.25rem; }
        
        p {
            margin-bottom: 1.5rem;
        }
        
        a {
            color: var(--primary);
            text-decoration: none;
            transition: color var(--transition-fast);
        }
        
        a:hover {
            color: var(--primary-dark);
            text-decoration: underline;
        }
        
        /* Layout */
        .app-container {
            display: flex;
            min-height: 100vh;
            position: relative;
        }
        
        /* Sidebar */
        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: var(--sidebar-width);
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            overflow-y: auto;
            transform: translateX(0);
            transition: transform var(--transition-base);
            z-index: 100;
        }
        
        .sidebar.hidden {
            transform: translateX(-100%);
        }
        
        .sidebar-header {
            padding: 2rem;
            border-bottom: 1px solid var(--border);
        }
        
        .sidebar-title {
            font-size: 1.25rem;
            font-weight: 700;
            margin: 0;
        }
        
        /* Table of Contents */
        .toc {
            padding: 1rem 0;
        }
        
        .toc-list {
            list-style: none;
        }
        
        .toc-item {
            border-left: 3px solid transparent;
            transition: all var(--transition-fast);
        }
        
        .toc-item.active {
            border-left-color: var(--primary);
            background: var(--bg-tertiary);
        }
        
        .toc-link {
            display: block;
            padding: 0.75rem 2rem;
            color: var(--text-secondary);
            text-decoration: none;
            transition: all var(--transition-fast);
        }
        
        .toc-link:hover {
            color: var(--text-primary);
            background: var(--bg-tertiary);
        }
        
        .toc-number {
            display: block;
            font-size: 0.875rem;
            color: var(--text-tertiary);
            margin-bottom: 0.25rem;
        }
        
        .toc-title {
            display: block;
            font-weight: 500;
        }
        
        .toc-progress {
            display: block;
            height: 3px;
            background: var(--border);
            border-radius: 1.5px;
            margin-top: 0.5rem;
            overflow: hidden;
        }
        
        .progress-bar {
            display: block;
            height: 100%;
            background: var(--primary);
            transition: width var(--transition-base);
        }
        
        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: var(--sidebar-width);
            transition: margin-left var(--transition-base);
        }
        
        .sidebar.hidden ~ .main-content {
            margin-left: 0;
        }
        
        /* Progress Bar */
        .reading-progress {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: var(--border);
            z-index: 200;
        }
        
        .reading-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, var(--primary), var(--secondary));
            width: 0%;
            transition: width var(--transition-fast);
        }
        
        /* Chapter Styles */
        .chapter {
            max-width: var(--content-width);
            margin: 0 auto;
            padding: 4rem 2rem;
            min-height: 100vh;
        }
        
        .chapter-hero {
            position: relative;
            margin: -4rem -2rem 3rem;
            height: 400px;
            overflow: hidden;
        }
        
        .chapter-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .chapter-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.8));
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            padding: 3rem;
            color: white;
        }
        
        .chapter-title {
            color: white;
            margin: 0;
            font-size: 3rem;
        }
        
        .chapter-description {
            font-size: 1.25rem;
            margin: 1rem 0 0;
            opacity: 0.9;
        }
        
        /* Callout Styles */
        .callout {
            margin: 2rem 0;
            padding: 1.5rem;
            border-radius: 0.5rem;
            border-left: 4px solid;
            position: relative;
            overflow: hidden;
        }
        
        .callout-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
            font-weight: 600;
        }
        
        .callout-icon {
            font-size: 1.5rem;
        }
        
        .callout-content {
            color: var(--text-secondary);
        }
        
        .callout-content > *:last-child {
            margin-bottom: 0;
        }
        
        /* Callout Variants */
        .callout-tip {
            background: rgba(14, 165, 233, 0.1);
            border-color: var(--primary);
        }
        
        .callout-warning {
            background: rgba(245, 158, 11, 0.1);
            border-color: var(--warning);
        }
        
        .callout-key {
            background: rgba(251, 191, 36, 0.1);
            border-color: var(--accent);
        }
        
        .callout-success {
            background: rgba(16, 185, 129, 0.1);
            border-color: var(--success);
        }
        
        .callout-info {
            background: rgba(139, 92, 246, 0.1);
            border-color: var(--info);
        }
        
        /* Code Blocks */
        .code-block {
            margin: 2rem 0;
            border-radius: 0.5rem;
            overflow: hidden;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
        }
        
        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
        }
        
        .code-language {
            font-size: 0.875rem;
            color: var(--text-tertiary);
            font-weight: 500;
        }
        
        .copy-code-btn {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.25rem 0.75rem;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 0.375rem;
            color: var(--text-secondary);
            font-size: 0.875rem;
            cursor: pointer;
            transition: all var(--transition-fast);
        }
        
        .copy-code-btn:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
        }
        
        .copy-code-btn.copied {
            background: var(--success);
            color: white;
            border-color: var(--success);
        }
        
        pre {
            margin: 0;
            padding: 1rem;
            overflow-x: auto;
        }
        
        code {
            font-family: var(--font-mono);
            font-size: 0.875rem;
            line-height: 1.5;
        }
        
        /* Tables */
        .table-wrapper {
            overflow-x: auto;
            margin: 2rem 0;
        }
        
        .premium-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            overflow: hidden;
        }
        
        .premium-table th,
        .premium-table td {
            padding: 0.75rem 1rem;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }
        
        .premium-table th {
            background: var(--bg-secondary);
            font-weight: 600;
            color: var(--text-primary);
        }
        
        .premium-table tr:hover {
            background: var(--bg-tertiary);
        }
        
        /* Task Lists */
        .task-item {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            list-style: none;
            margin-left: -1.5rem;
        }
        
        .task-item input[type="checkbox"] {
            margin-top: 0.375rem;
            width: 1.125rem;
            height: 1.125rem;
            cursor: pointer;
        }
        
        .task-item label {
            cursor: pointer;
            flex: 1;
        }
        
        /* Chapter Navigation */
        .chapter-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 4rem;
            padding-top: 2rem;
            border-top: 1px solid var(--border);
        }
        
        .nav-prev,
        .nav-next {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            color: var(--text-primary);
            font-weight: 500;
            transition: all var(--transition-fast);
        }
        
        .nav-prev:hover,
        .nav-next:hover {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
            text-decoration: none;
        }
        
        /* Floating Action Buttons */
        .fab-container {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            z-index: 50;
        }
        
        .fab {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: all var(--transition-fast);
        }
        
        .fab:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        }
        
        .fab.secondary {
            background: var(--bg-secondary);
            color: var(--text-primary);
            border: 1px solid var(--border);
        }
        
        /* Search Modal */
        .search-modal {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: flex-start;
            justify-content: center;
            padding-top: 10vh;
            z-index: 300;
        }
        
        .search-modal.active {
            display: flex;
        }
        
        .search-container {
            background: var(--bg-primary);
            border-radius: 0.5rem;
            width: 90%;
            max-width: 600px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .search-input {
            width: 100%;
            padding: 1.25rem;
            font-size: 1.125rem;
            border: none;
            background: transparent;
            color: var(--text-primary);
            outline: none;
        }
        
        .search-results {
            max-height: 400px;
            overflow-y: auto;
            border-top: 1px solid var(--border);
        }
        
        .search-result {
            padding: 1rem 1.25rem;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            transition: background var(--transition-fast);
        }
        
        .search-result:hover {
            background: var(--bg-secondary);
        }
        
        .search-result-title {
            font-weight: 600;
            margin-bottom: 0.25rem;
        }
        
        .search-result-snippet {
            font-size: 0.875rem;
            color: var(--text-secondary);
        }
        
        .search-highlight {
            background: var(--accent);
            color: var(--text-primary);
            padding: 0 0.25rem;
            border-radius: 0.25rem;
        }
        
        /* Settings Panel */
        .settings-panel {
            position: fixed;
            right: 0;
            top: 0;
            bottom: 0;
            width: 320px;
            background: var(--bg-primary);
            border-left: 1px solid var(--border);
            transform: translateX(100%);
            transition: transform var(--transition-base);
            z-index: 150;
            overflow-y: auto;
        }
        
        .settings-panel.active {
            transform: translateX(0);
            box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
        }
        
        .settings-header {
            padding: 1.5rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .settings-content {
            padding: 1.5rem;
        }
        
        .settings-group {
            margin-bottom: 2rem;
        }
        
        .settings-label {
            display: block;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
        }
        
        .theme-options {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.5rem;
        }
        
        .theme-btn {
            padding: 0.75rem;
            border: 2px solid var(--border);
            background: var(--bg-secondary);
            border-radius: 0.375rem;
            cursor: pointer;
            transition: all var(--transition-fast);
            text-align: center;
        }
        
        .theme-btn.active {
            border-color: var(--primary);
            background: var(--primary);
            color: white;
        }
        
        .font-size-control {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .font-size-slider {
            flex: 1;
            height: 4px;
            background: var(--border);
            border-radius: 2px;
            position: relative;
            cursor: pointer;
        }
        
        .font-size-handle {
            position: absolute;
            top: -8px;
            width: 20px;
            height: 20px;
            background: var(--primary);
            border-radius: 50%;
            cursor: grab;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        /* Responsive */
        @media (max-width: 1024px) {
            .sidebar {
                transform: translateX(-100%);
            }
            
            .sidebar.active {
                transform: translateX(0);
            }
            
            .main-content {
                margin-left: 0;
            }
        }
        
        @media (max-width: 768px) {
            :root {
                font-size: 16px;
            }
            
            .chapter {
                padding: 2rem 1rem;
            }
            
            .chapter-hero {
                margin: -2rem -1rem 2rem;
                height: 250px;
            }
            
            .chapter-title {
                font-size: 2rem;
            }
            
            .fab-container {
                bottom: 1rem;
                right: 1rem;
            }
            
            .settings-panel {
                width: 100%;
            }
        }
        
        /* Print Styles */
        @media print {
            .sidebar,
            .reading-progress,
            .fab-container,
            .search-modal,
            .settings-panel {
                display: none !important;
            }
            
            .main-content {
                margin-left: 0 !important;
            }
            
            .chapter {
                page-break-after: always;
            }
            
            .callout {
                break-inside: avoid;
            }
        }
        
        /* Animations */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* Loading States */
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid var(--border);
            border-radius: 50%;
            border-top-color: var(--primary);
            animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Highlight.js Theme */
        .hljs {
            background: transparent;
            color: var(--text-primary);
        }
        
        /* Custom Scrollbar */
        ::-webkit-scrollbar {
            width: 12px;
            height: 12px;
        }
        
        ::-webkit-scrollbar-track {
            background: var(--bg-secondary);
        }
        
        ::-webkit-scrollbar-thumb {
            background: var(--text-tertiary);
            border-radius: 6px;
            border: 3px solid var(--bg-secondary);
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: var(--text-secondary);
        }
    </style>
</head>
<body>
    <!-- Reading Progress -->
    <div class="reading-progress">
        <div class="reading-progress-bar"></div>
    </div>
    
    <!-- App Container -->
    <div class="app-container">
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <h2 class="sidebar-title">ChatGPT & AI Prompts</h2>
                <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">
                    Master AI for Business Success
                </p>
            </div>
            <nav class="toc">
                <ul class="toc-list">
                    ${tocHTML}
                </ul>
            </nav>
        </aside>
        
        <!-- Main Content -->
        <main class="main-content">
            <!-- Cover Page -->
            <section class="chapter" id="cover" style="display: flex; align-items: center; justify-content: center; text-align: center;">
                ${images['cover'] ? `<img src="${images['cover']}" alt="Book Cover" style="max-width: 500px; width: 100%; height: auto; margin-bottom: 2rem; border-radius: 0.5rem; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">` : ''}
                <h1 style="font-size: 3rem; margin-bottom: 1rem;">ChatGPT & AI Prompts for Business Success</h1>
                <p style="font-size: 1.5rem; color: var(--text-secondary); margin-bottom: 2rem;">
                    The Complete 2025 Guide to AI-Powered Productivity
                </p>
                <p style="font-size: 1.25rem; color: var(--text-tertiary);">
                    By Elite Digital Publishing
                </p>
                <a href="#chapter-1" class="nav-next" style="margin-top: 3rem;">
                    Start Reading →
                </a>
            </section>
            
            <!-- Chapters -->
            ${chaptersHTML}
            
            <!-- About Section -->
            <section class="chapter" id="about">
                <h2>About This Book</h2>
                <p>
                    "ChatGPT & AI Prompts for Business Success" is your comprehensive guide to leveraging artificial intelligence for unprecedented business growth. This book contains proven strategies, real-world examples, and actionable frameworks that have helped thousands of entrepreneurs and professionals transform their productivity and income.
                </p>
                <h3>What You'll Learn</h3>
                <ul>
                    <li>Master the art of prompt engineering for maximum AI effectiveness</li>
                    <li>Discover the exact prompts that generate $500+ per day for our students</li>
                    <li>Build automated systems that work while you sleep</li>
                    <li>Scale your business without scaling your workload</li>
                    <li>Avoid common pitfalls that waste time and money</li>
                </ul>
                <h3>About the Author</h3>
                <p>
                    Elite Digital Publishing is a leading authority in AI and technology education, with over a decade of experience helping professionals harness the power of emerging technologies. Our mission is to make cutting-edge knowledge accessible and actionable for everyone.
                </p>
            </section>
        </main>
    </div>
    
    <!-- Floating Action Buttons -->
    <div class="fab-container">
        <button class="fab secondary" onclick="toggleSearch()" title="Search (/)">
            🔍
        </button>
        <button class="fab secondary" onclick="toggleSettings()" title="Settings">
            ⚙️
        </button>
        <button class="fab" onclick="toggleSidebar()" title="Toggle Sidebar">
            📚
        </button>
    </div>
    
    <!-- Search Modal -->
    <div class="search-modal" id="searchModal">
        <div class="search-container">
            <input type="text" class="search-input" id="searchInput" placeholder="Search content..." autocomplete="off">
            <div class="search-results" id="searchResults"></div>
        </div>
    </div>
    
    <!-- Settings Panel -->
    <div class="settings-panel" id="settingsPanel">
        <div class="settings-header">
            <h3>Reading Settings</h3>
            <button onclick="toggleSettings()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
        </div>
        <div class="settings-content">
            <div class="settings-group">
                <label class="settings-label">Theme</label>
                <div class="theme-options">
                    <button class="theme-btn active" onclick="setTheme('light')">☀️ Light</button>
                    <button class="theme-btn" onclick="setTheme('dark')">🌙 Dark</button>
                    <button class="theme-btn" onclick="setTheme('sepia')">📜 Sepia</button>
                </div>
            </div>
            <div class="settings-group">
                <label class="settings-label">Font Size</label>
                <div class="font-size-control">
                    <button onclick="changeFontSize(-1)">A-</button>
                    <span id="fontSizeValue">18px</span>
                    <button onclick="changeFontSize(1)">A+</button>
                </div>
            </div>
            <div class="settings-group">
                <label class="settings-label">Reading Width</label>
                <select onchange="setReadingWidth(this.value)" style="width: 100%; padding: 0.5rem;">
                    <option value="750px">Narrow (750px)</option>
                    <option value="900px">Medium (900px)</option>
                    <option value="1200px">Wide (1200px)</option>
                    <option value="100%">Full Width</option>
                </select>
            </div>
        </div>
    </div>
    
    <script>
        // State Management
        const state = {
            currentChapter: 0,
            theme: localStorage.getItem('ebook-theme') || 'light',
            fontSize: parseInt(localStorage.getItem('ebook-fontSize')) || 18,
            readingWidth: localStorage.getItem('ebook-width') || '750px',
            chapterProgress: JSON.parse(localStorage.getItem('ebook-progress') || '{}'),
            taskStates: JSON.parse(localStorage.getItem('ebook-tasks') || '{}'),
            searchIndex: null
        };
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            initializeTheme();
            initializeFontSize();
            initializeReadingWidth();
            initializeProgress();
            initializeNavigation();
            initializeKeyboardShortcuts();
            initializeSearch();
            loadSavedTaskStates();
            
            // Track reading progress
            window.addEventListener('scroll', updateReadingProgress);
            
            // Save progress periodically
            setInterval(saveProgress, 5000);
            
            // Show continue reading prompt
            checkContinueReading();
        });
        
        // Theme Management
        function initializeTheme() {
            setTheme(state.theme);
        }
        
        function setTheme(theme) {
            state.theme = theme;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('ebook-theme', theme);
            
            // Update theme buttons
            document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(\`.theme-btn:nth-child(\${theme === 'light' ? 1 : theme === 'dark' ? 2 : 3})\`).classList.add('active');
        }
        
        // Font Size Management
        function initializeFontSize() {
            document.body.style.fontSize = state.fontSize + 'px';
            document.getElementById('fontSizeValue').textContent = state.fontSize + 'px';
        }
        
        function changeFontSize(delta) {
            state.fontSize = Math.max(14, Math.min(24, state.fontSize + delta));
            document.body.style.fontSize = state.fontSize + 'px';
            document.getElementById('fontSizeValue').textContent = state.fontSize + 'px';
            localStorage.setItem('ebook-fontSize', state.fontSize);
        }
        
        // Reading Width
        function initializeReadingWidth() {
            setReadingWidth(state.readingWidth);
        }
        
        function setReadingWidth(width) {
            state.readingWidth = width;
            document.documentElement.style.setProperty('--content-width', width);
            localStorage.setItem('ebook-width', width);
        }
        
        // Progress Tracking
        function initializeProgress() {
            const currentHash = window.location.hash;
            if (currentHash && currentHash.startsWith('#chapter-')) {
                const chapterNum = parseInt(currentHash.replace('#chapter-', ''));
                state.currentChapter = chapterNum;
            }
            
            updateActiveChapter();
            updateChapterProgress();
        }
        
        function updateReadingProgress() {
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight - windowHeight;
            const scrolled = window.scrollY;
            const progress = (scrolled / documentHeight) * 100;
            
            // Update global progress bar
            document.querySelector('.reading-progress-bar').style.width = progress + '%';
            
            // Update current chapter
            const chapters = document.querySelectorAll('.chapter');
            chapters.forEach((chapter, index) => {
                const rect = chapter.getBoundingClientRect();
                if (rect.top <= windowHeight / 2 && rect.bottom >= windowHeight / 2) {
                    if (state.currentChapter !== index) {
                        state.currentChapter = index;
                        updateActiveChapter();
                    }
                    
                    // Update chapter-specific progress
                    const chapterTop = chapter.offsetTop;
                    const chapterHeight = chapter.offsetHeight;
                    const chapterProgress = ((scrolled - chapterTop + windowHeight) / chapterHeight) * 100;
                    updateChapterProgress(index, Math.min(100, Math.max(0, chapterProgress)));
                }
            });
        }
        
        function updateActiveChapter() {
            document.querySelectorAll('.toc-item').forEach((item, index) => {
                if (index === state.currentChapter) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }
        
        function updateChapterProgress(chapterIndex = state.currentChapter, progress = 0) {
            const tocItem = document.querySelectorAll('.toc-item')[chapterIndex];
            if (tocItem) {
                const progressBar = tocItem.querySelector('.progress-bar');
                if (progressBar) {
                    progressBar.style.width = progress + '%';
                }
            }
            
            // Save progress
            state.chapterProgress[\`chapter-\${chapterIndex}\`] = progress;
        }
        
        function saveProgress() {
            localStorage.setItem('ebook-progress', JSON.stringify(state.chapterProgress));
            localStorage.setItem('ebook-lastChapter', state.currentChapter);
            localStorage.setItem('ebook-lastScroll', window.scrollY);
            localStorage.setItem('ebook-lastVisit', Date.now());
        }
        
        function checkContinueReading() {
            const lastChapter = localStorage.getItem('ebook-lastChapter');
            const lastScroll = localStorage.getItem('ebook-lastScroll');
            const lastVisit = localStorage.getItem('ebook-lastVisit');
            
            if (lastChapter && lastScroll && lastVisit) {
                const hoursSinceVisit = (Date.now() - parseInt(lastVisit)) / (1000 * 60 * 60);
                if (hoursSinceVisit < 24 && parseInt(lastScroll) > 100) {
                    const continueReading = confirm('Continue where you left off?');
                    if (continueReading) {
                        window.location.hash = \`#chapter-\${lastChapter}\`;
                        setTimeout(() => {
                            window.scrollTo(0, parseInt(lastScroll));
                        }, 100);
                    }
                }
            }
        }
        
        // Navigation
        function initializeNavigation() {
            // Smooth scroll for TOC links
            document.querySelectorAll('.toc-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = document.querySelector(link.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // Close sidebar on mobile
                        if (window.innerWidth <= 1024) {
                            toggleSidebar();
                        }
                    }
                });
            });
        }
        
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            if (window.innerWidth <= 1024) {
                sidebar.classList.toggle('active');
            } else {
                sidebar.classList.toggle('hidden');
            }
        }
        
        // Search Functionality
        function initializeSearch() {
            const searchInput = document.getElementById('searchInput');
            searchInput.addEventListener('input', debounce(performSearch, 300));
            
            // Close search on escape
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    toggleSearch();
                }
            });
            
            // Close search on outside click
            document.getElementById('searchModal').addEventListener('click', (e) => {
                if (e.target.id === 'searchModal') {
                    toggleSearch();
                }
            });
        }
        
        function toggleSearch() {
            const modal = document.getElementById('searchModal');
            const input = document.getElementById('searchInput');
            
            modal.classList.toggle('active');
            if (modal.classList.contains('active')) {
                input.focus();
                input.value = '';
                document.getElementById('searchResults').innerHTML = '';
            }
        }
        
        function performSearch() {
            const query = document.getElementById('searchInput').value.toLowerCase();
            const results = document.getElementById('searchResults');
            
            if (query.length < 2) {
                results.innerHTML = '';
                return;
            }
            
            const chapters = document.querySelectorAll('.chapter');
            const matches = [];
            
            chapters.forEach((chapter, index) => {
                const text = chapter.textContent.toLowerCase();
                const title = chapter.querySelector('h1, h2')?.textContent || \`Chapter \${index}\`;
                
                if (text.includes(query)) {
                    // Find snippet around match
                    const matchIndex = text.indexOf(query);
                    const start = Math.max(0, matchIndex - 50);
                    const end = Math.min(text.length, matchIndex + query.length + 50);
                    const snippet = '...' + text.substring(start, end) + '...';
                    
                    matches.push({
                        chapter: index,
                        title: title,
                        snippet: snippet.replace(new RegExp(query, 'gi'), '<span class="search-highlight">$&</span>')
                    });
                }
            });
            
            if (matches.length === 0) {
                results.innerHTML = '<div class="search-result">No results found</div>';
            } else {
                results.innerHTML = matches.map(match => \`
                    <div class="search-result" onclick="goToSearchResult(\${match.chapter})">
                        <div class="search-result-title">\${match.title}</div>
                        <div class="search-result-snippet">\${match.snippet}</div>
                    </div>
                \`).join('');
            }
        }
        
        function goToSearchResult(chapterIndex) {
            const chapter = document.querySelectorAll('.chapter')[chapterIndex];
            if (chapter) {
                toggleSearch();
                chapter.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        
        // Settings
        function toggleSettings() {
            document.getElementById('settingsPanel').classList.toggle('active');
        }
        
        // Keyboard Shortcuts
        function initializeKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ignore if typing in input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                
                switch(e.key) {
                    case '/':
                        e.preventDefault();
                        toggleSearch();
                        break;
                    case 'j':
                    case 'J':
                        e.preventDefault();
                        scrollBy(0, 100);
                        break;
                    case 'k':
                    case 'K':
                        e.preventDefault();
                        scrollBy(0, -100);
                        break;
                    case 'n':
                    case 'N':
                        e.preventDefault();
                        navigateChapter(1);
                        break;
                    case 'p':
                    case 'P':
                        e.preventDefault();
                        navigateChapter(-1);
                        break;
                    case 'b':
                    case 'B':
                        e.preventDefault();
                        toggleSidebar();
                        break;
                }
            });
        }
        
        function navigateChapter(direction) {
            const newChapter = state.currentChapter + direction;
            const chapters = document.querySelectorAll('.chapter');
            
            if (newChapter >= 0 && newChapter < chapters.length) {
                chapters[newChapter].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        
        // Task State Management
        function saveTaskState(taskId, checked) {
            state.taskStates[taskId] = checked;
            localStorage.setItem('ebook-tasks', JSON.stringify(state.taskStates));
        }
        
        function loadSavedTaskStates() {
            Object.entries(state.taskStates).forEach(([taskId, checked]) => {
                const checkbox = document.getElementById(taskId);
                if (checkbox) {
                    checkbox.checked = checked;
                }
            });
        }
        
        // Copy Code Functionality
        function copyCode(codeId) {
            const codeElement = document.getElementById(codeId);
            const button = event.target.closest('.copy-code-btn');
            
            if (codeElement) {
                navigator.clipboard.writeText(codeElement.textContent).then(() => {
                    button.classList.add('copied');
                    const originalHTML = button.innerHTML;
                    button.innerHTML = '<span class="copy-icon">✅</span><span class="copy-text">Copied!</span>';
                    
                    setTimeout(() => {
                        button.classList.remove('copied');
                        button.innerHTML = originalHTML;
                    }, 2000);
                });
            }
        }
        
        // Utility Functions
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        // Analytics (if needed)
        function trackEvent(category, action, label) {
            if (typeof gtag !== 'undefined') {
                gtag('event', action, {
                    'event_category': category,
                    'event_label': label
                });
            }
        }
    </script>
</body>
</html>`;
    
    // Process affiliate links
    console.log('💰 Processing affiliate links...');
    const affiliateResolver = new AffiliateResolver({
        amazonTag: process.env.AMAZON_AFFILIATE_TAG || 'your-tag-20',
        region: process.env.AMAZON_REGION || 'US'
    });
    
    const htmlWithAffiliates = await affiliateResolver.processHtml(html);
    const cacheStats = affiliateResolver.getCacheStats();
    console.log(`✅ Processed affiliate links (${cacheStats.totalEntries} cached)`);
    
    // Inject AI chat widget (WebSocket version - no API key exposed!)
    const htmlWithChat = injectIntoHTML(htmlWithAffiliates, {
        wsUrl: process.env.CHAT_WS_URL || 'ws://localhost:3001',
        rateLimit: 10,
        ratePeriod: 3600000,
        theme: 'light'
    });
    
    // Write the HTML file
    await fs.writeFile(OUTPUT_FILE, htmlWithChat);
    
    console.log('✅ Premium HTML ebook generated successfully!');
    console.log(`📁 Output: ${OUTPUT_FILE}`);
    console.log(`📏 Size: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
    
    return OUTPUT_FILE;
}

// Run if called directly
if (require.main === module) {
    generatePremiumHTML()
        .then(outputPath => {
            console.log('\n🎉 Build complete!');
            console.log('\nNext steps:');
            console.log('1. Generate images: node scripts/generate-ebook-images.js');
            console.log('2. Open in browser: open ' + outputPath);
            console.log('3. Test all features');
            console.log('4. Deploy or sell!');
        })
        .catch(error => {
            console.error('❌ Build failed:', error);
            process.exit(1);
        });
}

module.exports = { generatePremiumHTML };
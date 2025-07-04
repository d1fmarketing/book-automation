// Component Renderers and Properties

// Component Renderers - Generate HTML for canvas display
window.componentRenderers = {
    cover: (component) => `
        <div class="component-cover" style="text-align: center; padding: 4rem 2rem;">
            <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--primary-color);">
                ${component.content.title}
            </h1>
            <h2 style="font-size: 1.5rem; margin-bottom: 2rem; color: var(--text-secondary);">
                ${component.content.subtitle}
            </h2>
            <p style="font-size: 1.25rem; color: var(--text-secondary);">
                ${component.content.author}
            </p>
        </div>
    `,

    toc: (component) => `
        <div class="component-toc">
            <h2 style="font-size: 1.75rem; margin-bottom: 1.5rem;">
                ${component.content.title}
            </h2>
            <ul style="list-style: none; padding: 0;">
                ${component.content.chapters.map(ch => `
                    <li style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dotted var(--border);">
                        <span>Chapter ${ch.number}: ${ch.title}</span>
                        <span style="color: var(--text-secondary);">${ch.page}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `,

    chapter: (component) => `
        <div class="component-chapter">
            <h2 style="font-size: 2rem; margin-bottom: 1rem;">
                Chapter ${component.content.number}: ${component.content.title}
            </h2>
            <p style="line-height: 1.8;">
                ${component.content.content}
            </p>
        </div>
    `,

    callout: (component) => {
        const colors = {
            info: '#3b82f6',
            warning: '#f59e0b',
            success: '#22c55e',
            danger: '#ef4444'
        };
        
        return `
            <div class="component-callout" style="
                background: ${colors[component.content.type]}15;
                border: 1px solid ${colors[component.content.type]};
                border-radius: 0.5rem;
                padding: 1rem;
                margin: 1rem 0;
            ">
                <h4 style="margin-bottom: 0.5rem; color: ${colors[component.content.type]};">
                    ${component.content.title}
                </h4>
                <p style="margin: 0;">
                    ${component.content.content}
                </p>
            </div>
        `;
    },

    quote: (component) => `
        <blockquote class="component-quote" style="
            font-style: italic;
            border-left: 4px solid var(--primary-color);
            padding-left: 1rem;
            margin: 1rem 0;
        ">
            <p style="margin-bottom: 0.5rem;">
                "${component.content.text}"
            </p>
            <cite style="display: block; text-align: right; color: var(--text-secondary);">
                — ${component.content.author}
            </cite>
        </blockquote>
    `,

    image: (component) => `
        <figure class="component-image" style="margin: 1rem 0; text-align: center;">
            <div style="
                background: var(--surface-dark);
                border: 1px solid var(--border);
                border-radius: 0.375rem;
                padding: 2rem;
                display: inline-block;
            ">
                <i class="fas fa-image" style="font-size: 3rem; color: var(--text-tertiary);"></i>
            </div>
            <figcaption style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                ${component.content.caption}
            </figcaption>
        </figure>
    `,

    list: (component) => {
        const tag = component.content.type === 'bullet' ? 'ul' : 'ol';
        return `
            <${tag} class="component-list" style="margin: 1rem 0; padding-left: 2rem;">
                ${component.content.items.map(item => `
                    <li style="margin-bottom: 0.5rem;">${item}</li>
                `).join('')}
            </${tag}>
        `;
    },

    code: (component) => `
        <div class="component-code" style="
            background: #1a1a1a;
            color: #e0e0e0;
            border-radius: 0.375rem;
            padding: 1rem;
            margin: 1rem 0;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            overflow-x: auto;
        ">
            <div style="margin-bottom: 0.5rem; color: #888; font-size: 0.75rem;">
                ${component.content.language}
            </div>
            <pre style="margin: 0;"><code>${component.content.content}</code></pre>
        </div>
    `,

    divider: (component) => `
        <hr class="component-divider" style="
            border: none;
            border-top: 1px ${component.content.style} var(--border);
            margin: 2rem 0;
        ">
    `,

    footer: (component) => `
        <div class="component-footer" style="
            text-align: center;
            color: var(--text-secondary);
            font-size: 0.875rem;
            margin-top: 2rem;
        ">
            ${component.content.content}
        </div>
    `
};

// Component Properties - Generate property panels
window.componentProperties = {
    cover: (component) => `
        <div class="properties-section">
            <h4>Cover Content</h4>
            <div class="property-group">
                <label>Title</label>
                <input type="text" data-property="content.title" value="${component.content.title}">
            </div>
            <div class="property-group">
                <label>Subtitle</label>
                <input type="text" data-property="content.subtitle" value="${component.content.subtitle}">
            </div>
            <div class="property-group">
                <label>Author</label>
                <input type="text" data-property="content.author" value="${component.content.author}">
            </div>
        </div>
    `,

    toc: (component) => `
        <div class="properties-section">
            <h4>Table of Contents</h4>
            <div class="property-group">
                <label>Title</label>
                <input type="text" data-property="content.title" value="${component.content.title}">
            </div>
            <div class="property-group">
                <label>Chapters</label>
                <button class="btn-secondary" onclick="editTOCChapters()">
                    Edit Chapters
                </button>
            </div>
        </div>
    `,

    chapter: (component) => `
        <div class="properties-section">
            <h4>Chapter Settings</h4>
            <div class="property-group">
                <label>Chapter Number</label>
                <input type="text" data-property="content.number" value="${component.content.number}">
            </div>
            <div class="property-group">
                <label>Title</label>
                <input type="text" data-property="content.title" value="${component.content.title}">
            </div>
            <div class="property-group">
                <label>Content</label>
                <textarea data-property="content.content" rows="6">${component.content.content}</textarea>
            </div>
        </div>
    `,

    callout: (component) => `
        <div class="properties-section">
            <h4>Callout Settings</h4>
            <div class="property-group">
                <label>Type</label>
                <select data-property="content.type">
                    <option value="info" ${component.content.type === 'info' ? 'selected' : ''}>Info</option>
                    <option value="warning" ${component.content.type === 'warning' ? 'selected' : ''}>Warning</option>
                    <option value="success" ${component.content.type === 'success' ? 'selected' : ''}>Success</option>
                    <option value="danger" ${component.content.type === 'danger' ? 'selected' : ''}>Danger</option>
                </select>
            </div>
            <div class="property-group">
                <label>Title</label>
                <input type="text" data-property="content.title" value="${component.content.title}">
            </div>
            <div class="property-group">
                <label>Content</label>
                <textarea data-property="content.content" rows="4">${component.content.content}</textarea>
            </div>
        </div>
    `,

    quote: (component) => `
        <div class="properties-section">
            <h4>Quote Settings</h4>
            <div class="property-group">
                <label>Quote Text</label>
                <textarea data-property="content.text" rows="3">${component.content.text}</textarea>
            </div>
            <div class="property-group">
                <label>Author</label>
                <input type="text" data-property="content.author" value="${component.content.author}">
            </div>
        </div>
    `,

    image: (component) => `
        <div class="properties-section">
            <h4>Image Settings</h4>
            <div class="property-group">
                <label>Source</label>
                <input type="text" data-property="content.src" value="${component.content.src}" placeholder="image.jpg">
            </div>
            <div class="property-group">
                <label>Caption</label>
                <input type="text" data-property="content.caption" value="${component.content.caption}">
            </div>
            <div class="property-group">
                <label>Width</label>
                <input type="text" data-property="content.width" value="${component.content.width}">
            </div>
        </div>
    `,

    list: (component) => `
        <div class="properties-section">
            <h4>List Settings</h4>
            <div class="property-group">
                <label>Type</label>
                <select data-property="content.type">
                    <option value="bullet" ${component.content.type === 'bullet' ? 'selected' : ''}>Bullet</option>
                    <option value="number" ${component.content.type === 'number' ? 'selected' : ''}>Numbered</option>
                </select>
            </div>
            <div class="property-group">
                <label>Items</label>
                <button class="btn-secondary" onclick="editListItems()">
                    Edit Items
                </button>
            </div>
        </div>
    `,

    code: (component) => `
        <div class="properties-section">
            <h4>Code Block Settings</h4>
            <div class="property-group">
                <label>Language</label>
                <select data-property="content.language">
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="json">JSON</option>
                    <option value="markdown">Markdown</option>
                    <option value="bash">Bash</option>
                </select>
            </div>
            <div class="property-group">
                <label>Code</label>
                <textarea data-property="content.content" rows="8" style="font-family: 'JetBrains Mono', monospace; font-size: 0.8125rem;">${component.content.content}</textarea>
            </div>
        </div>
    `,

    divider: (component) => `
        <div class="properties-section">
            <h4>Divider Settings</h4>
            <div class="property-group">
                <label>Style</label>
                <select data-property="content.style">
                    <option value="solid" ${component.content.style === 'solid' ? 'selected' : ''}>Solid</option>
                    <option value="dashed" ${component.content.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                    <option value="dotted" ${component.content.style === 'dotted' ? 'selected' : ''}>Dotted</option>
                </select>
            </div>
        </div>
    `,

    footer: (component) => `
        <div class="properties-section">
            <h4>Footer Settings</h4>
            <div class="property-group">
                <label>Content</label>
                <input type="text" data-property="content.content" value="${component.content.content}" placeholder="Page {page}">
                <small>Use {page} for page number</small>
            </div>
        </div>
    `
};

// Component Generators - Generate code for export
window.componentGenerators = {
    html: {
        cover: (component) => `
    <div class="cover-page">
        <h1 class="book-title">${component.content.title}</h1>
        <h2 class="book-subtitle">${component.content.subtitle}</h2>
        <p class="book-author">${component.content.author}</p>
    </div>\n\n`,

        toc: (component) => `
    <div class="table-of-contents">
        <h2>${component.content.title}</h2>
        <ul class="toc-list">
${component.content.chapters.map(ch => `            <li>
                <span class="chapter-title">Chapter ${ch.number}: ${ch.title}</span>
                <span class="page-number">${ch.page}</span>
            </li>`).join('\n')}
        </ul>
    </div>\n\n`,

        chapter: (component) => `
    <div class="chapter">
        <h2>Chapter ${component.content.number}: ${component.content.title}</h2>
        <p>${component.content.content}</p>
    </div>\n\n`,

        callout: (component) => `
    <div class="callout callout-${component.content.type}">
        <h4>${component.content.title}</h4>
        <p>${component.content.content}</p>
    </div>\n\n`,

        quote: (component) => `
    <blockquote class="quote">
        <p>"${component.content.text}"</p>
        <cite>— ${component.content.author}</cite>
    </blockquote>\n\n`,

        image: (component) => `
    <figure class="image">
        <img src="${component.content.src}" alt="${component.content.caption}" style="width: ${component.content.width};">
        <figcaption>${component.content.caption}</figcaption>
    </figure>\n\n`,

        list: (component) => {
            const tag = component.content.type === 'bullet' ? 'ul' : 'ol';
            return `
    <${tag} class="list">
${component.content.items.map(item => `        <li>${item}</li>`).join('\n')}
    </${tag}>\n\n`;
        },

        code: (component) => `
    <pre class="code-block"><code class="language-${component.content.language}">${component.content.content}</code></pre>\n\n`,

        divider: (component) => `
    <hr class="divider divider-${component.content.style}">\n\n`,

        footer: (component) => `
    <footer class="page-footer">
        ${component.content.content}
    </footer>\n\n`
    },

    css: {
        cover: (component) => `
.cover-page {
    text-align: center;
    padding: 4rem 2rem;
}

.book-title {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: var(--primary-color);
}

.book-subtitle {
    font-size: 1.5rem;
    margin-bottom: 2rem;
    color: var(--text-secondary);
}

.book-author {
    font-size: 1.25rem;
    color: var(--text-secondary);
}\n\n`,

        toc: (component) => `
.table-of-contents h2 {
    font-size: 1.75rem;
    margin-bottom: 1.5rem;
}

.toc-list {
    list-style: none;
    padding: 0;
}

.toc-list li {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px dotted var(--border);
}\n\n`,

        chapter: (component) => `
.chapter {
    margin-top: 2rem;
}

.chapter h2 {
    font-size: 2rem;
    margin-bottom: 1rem;
}\n\n`,

        callout: (component) => `
.callout {
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1rem 0;
}

.callout-info {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid #3b82f6;
}

.callout-warning {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid #f59e0b;
}

.callout-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid #22c55e;
}

.callout-danger {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
}\n\n`,

        quote: (component) => `
.quote {
    font-style: italic;
    border-left: 4px solid var(--primary-color);
    padding-left: 1rem;
    margin: 1rem 0;
}

.quote cite {
    display: block;
    text-align: right;
    color: var(--text-secondary);
    margin-top: 0.5rem;
}\n\n`,

        image: (component) => `
.image {
    margin: 1rem 0;
    text-align: center;
}

.image img {
    max-width: 100%;
    height: auto;
}

.image figcaption {
    margin-top: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
}\n\n`,

        list: (component) => `
.list {
    margin: 1rem 0;
    padding-left: 2rem;
}

.list li {
    margin-bottom: 0.5rem;
}\n\n`,

        code: (component) => `
.code-block {
    background: #1a1a1a;
    color: #e0e0e0;
    border-radius: 0.375rem;
    padding: 1rem;
    margin: 1rem 0;
    overflow-x: auto;
}\n\n`,

        divider: (component) => `
.divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2rem 0;
}

.divider-dashed {
    border-top-style: dashed;
}

.divider-dotted {
    border-top-style: dotted;
}\n\n`,

        footer: (component) => `
.page-footer {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-top: 2rem;
}\n\n`
    },

    markdown: {
        cover: (component) => `# ${component.content.title}\n\n## ${component.content.subtitle}\n\n*By ${component.content.author}*`,

        toc: (component) => `## ${component.content.title}\n\n${component.content.chapters.map(ch => 
            `- Chapter ${ch.number}: ${ch.title} ............ ${ch.page}`
        ).join('\n')}`,

        chapter: (component) => `## Chapter ${component.content.number}: ${component.content.title}\n\n${component.content.content}`,

        callout: (component) => `> **${component.content.title}**\n> \n> ${component.content.content}`,

        quote: (component) => `> "${component.content.text}"\n> \n> — ${component.content.author}`,

        image: (component) => `![${component.content.caption}](${component.content.src})\n*${component.content.caption}*`,

        list: (component) => component.content.items.map((item, i) => 
            component.content.type === 'bullet' ? `- ${item}` : `${i + 1}. ${item}`
        ).join('\n'),

        code: (component) => `\`\`\`${component.content.language}\n${component.content.content}\n\`\`\``,

        divider: (component) => `---`,

        footer: (component) => `*${component.content.content}*`
    }
};

// Additional helper functions
window.editTOCChapters = () => {
    // Implementation for editing TOC chapters
    console.log('Edit TOC chapters');
};

window.editListItems = () => {
    // Implementation for editing list items
    console.log('Edit list items');
};
// Pre-built Template Library

window.prebuiltTemplates = {
    business: {
        name: 'Professional Business',
        type: 'business',
        description: 'Clean, professional template for business ebooks',
        components: [
            {
                id: 'cover-1',
                type: 'cover',
                content: {
                    title: 'The Business Success Formula',
                    subtitle: 'Strategies for Growth and Innovation',
                    author: 'John Doe'
                },
                styles: {
                    textAlign: 'center',
                    padding: '4rem 2rem'
                }
            },
            {
                id: 'toc-1',
                type: 'toc',
                content: {
                    title: 'Table of Contents',
                    chapters: [
                        { number: '1', title: 'Understanding Your Market', page: 1 },
                        { number: '2', title: 'Building Your Strategy', page: 15 },
                        { number: '3', title: 'Execution Excellence', page: 35 },
                        { number: '4', title: 'Measuring Success', page: 55 }
                    ]
                },
                styles: {}
            },
            {
                id: 'chapter-1',
                type: 'chapter',
                content: {
                    number: '1',
                    title: 'Understanding Your Market',
                    content: 'Success in business starts with a deep understanding of your market...'
                },
                styles: {
                    marginTop: '2rem'
                }
            },
            {
                id: 'callout-1',
                type: 'callout',
                content: {
                    type: 'info',
                    title: 'Key Insight',
                    content: '80% of successful businesses spend significant time on market research before launching.'
                },
                styles: {}
            }
        ],
        styles: {
            fontFamily: 'Inter',
            primaryColor: '#2563eb',
            secondaryColor: '#10b981',
            textColor: '#1f2937',
            pageSize: '6x9',
            margins: { top: 1, right: 0.75, bottom: 1, left: 0.75 }
        }
    },

    'self-help': {
        name: 'Inspiring Self-Help',
        type: 'self-help',
        description: 'Warm, engaging template for self-help and personal development',
        components: [
            {
                id: 'cover-1',
                type: 'cover',
                content: {
                    title: 'Transform Your Life',
                    subtitle: 'A Journey to Personal Excellence',
                    author: 'Jane Smith'
                },
                styles: {
                    textAlign: 'center',
                    padding: '4rem 2rem'
                }
            },
            {
                id: 'quote-1',
                type: 'quote',
                content: {
                    text: 'The journey of a thousand miles begins with a single step.',
                    author: 'Lao Tzu'
                },
                styles: {
                    marginTop: '3rem',
                    marginBottom: '3rem'
                }
            },
            {
                id: 'toc-1',
                type: 'toc',
                content: {
                    title: 'Your Journey Ahead',
                    chapters: [
                        { number: '1', title: 'Awakening Your Potential', page: 1 },
                        { number: '2', title: 'Overcoming Obstacles', page: 25 },
                        { number: '3', title: 'Building New Habits', page: 50 },
                        { number: '4', title: 'Living Your Best Life', page: 75 }
                    ]
                },
                styles: {}
            }
        ],
        styles: {
            fontFamily: 'Georgia',
            primaryColor: '#8b5cf6',
            secondaryColor: '#ec4899',
            textColor: '#374151',
            pageSize: '5.5x8.5',
            margins: { top: 1, right: 0.75, bottom: 1, left: 0.75 }
        }
    },

    technical: {
        name: 'Technical Documentation',
        type: 'technical',
        description: 'Code-friendly template for technical books and tutorials',
        components: [
            {
                id: 'cover-1',
                type: 'cover',
                content: {
                    title: 'Mastering JavaScript',
                    subtitle: 'From Fundamentals to Advanced Patterns',
                    author: 'Tech Author'
                },
                styles: {
                    textAlign: 'center',
                    padding: '4rem 2rem'
                }
            },
            {
                id: 'toc-1',
                type: 'toc',
                content: {
                    title: 'Contents',
                    chapters: [
                        { number: '1', title: 'JavaScript Basics', page: 1 },
                        { number: '2', title: 'Functions and Scope', page: 20 },
                        { number: '3', title: 'Objects and Prototypes', page: 45 },
                        { number: '4', title: 'Async Programming', page: 70 }
                    ]
                },
                styles: {}
            },
            {
                id: 'chapter-1',
                type: 'chapter',
                content: {
                    number: '1',
                    title: 'JavaScript Basics',
                    content: 'JavaScript is a versatile programming language...'
                },
                styles: {}
            },
            {
                id: 'code-1',
                type: 'code',
                content: {
                    language: 'javascript',
                    content: '// Example: Variables and Data Types\nlet name = "John";\nconst age = 30;\nvar isActive = true;\n\nconsole.log(`User: ${name}, Age: ${age}`);\n'
                },
                styles: {}
            },
            {
                id: 'callout-1',
                type: 'callout',
                content: {
                    type: 'warning',
                    title: 'Best Practice',
                    content: 'Always use const for values that won\'t be reassigned, and let for values that will change.'
                },
                styles: {}
            }
        ],
        styles: {
            fontFamily: 'Inter',
            primaryColor: '#059669',
            secondaryColor: '#0891b2',
            textColor: '#111827',
            pageSize: '8.5x11',
            margins: { top: 1, right: 1, bottom: 1, left: 1 }
        }
    },

    fiction: {
        name: 'Classic Fiction',
        type: 'fiction',
        description: 'Elegant template for novels and fiction',
        components: [
            {
                id: 'cover-1',
                type: 'cover',
                content: {
                    title: 'The Midnight Garden',
                    subtitle: 'A Novel',
                    author: 'Author Name'
                },
                styles: {
                    textAlign: 'center',
                    padding: '6rem 2rem'
                }
            },
            {
                id: 'divider-1',
                type: 'divider',
                content: {
                    style: 'solid'
                },
                styles: {
                    marginTop: '3rem',
                    marginBottom: '3rem'
                }
            },
            {
                id: 'chapter-1',
                type: 'chapter',
                content: {
                    number: '1',
                    title: 'The Beginning',
                    content: 'The old house stood at the end of Maple Street, its windows dark and uninviting...'
                },
                styles: {
                    marginTop: '4rem'
                }
            }
        ],
        styles: {
            fontFamily: 'Georgia',
            primaryColor: '#991b1b',
            secondaryColor: '#1e40af',
            textColor: '#1f2937',
            pageSize: '5.5x8.5',
            margins: { top: 1.25, right: 1, bottom: 1.25, left: 1 }
        }
    },

    educational: {
        name: 'Educational Textbook',
        type: 'educational',
        description: 'Structured template for educational content',
        components: [
            {
                id: 'cover-1',
                type: 'cover',
                content: {
                    title: 'Introduction to Physics',
                    subtitle: 'Understanding the Natural World',
                    author: 'Dr. Science'
                },
                styles: {
                    textAlign: 'center',
                    padding: '4rem 2rem'
                }
            },
            {
                id: 'toc-1',
                type: 'toc',
                content: {
                    title: 'Table of Contents',
                    chapters: [
                        { number: '1', title: 'Motion and Forces', page: 1 },
                        { number: '2', title: 'Energy and Work', page: 30 },
                        { number: '3', title: 'Waves and Sound', page: 60 },
                        { number: '4', title: 'Electricity and Magnetism', page: 90 }
                    ]
                },
                styles: {}
            },
            {
                id: 'chapter-1',
                type: 'chapter',
                content: {
                    number: '1',
                    title: 'Motion and Forces',
                    content: 'In this chapter, we will explore the fundamental concepts of motion...'
                },
                styles: {}
            },
            {
                id: 'callout-1',
                type: 'callout',
                content: {
                    type: 'info',
                    title: 'Learning Objectives',
                    content: 'By the end of this chapter, you will be able to:\n• Define velocity and acceleration\n• Apply Newton\'s laws of motion\n• Solve basic kinematics problems'
                },
                styles: {}
            },
            {
                id: 'image-1',
                type: 'image',
                content: {
                    src: 'physics-diagram.png',
                    caption: 'Figure 1.1: Free body diagram showing forces',
                    width: '80%'
                },
                styles: {}
            },
            {
                id: 'list-1',
                type: 'list',
                content: {
                    type: 'number',
                    items: [
                        'First, identify all forces acting on the object',
                        'Draw a coordinate system',
                        'Apply Newton\'s second law: F = ma',
                        'Solve for the unknown quantity'
                    ]
                },
                styles: {}
            }
        ],
        styles: {
            fontFamily: 'Arial',
            primaryColor: '#0891b2',
            secondaryColor: '#059669',
            textColor: '#111827',
            pageSize: '8.5x11',
            margins: { top: 1, right: 1, bottom: 1, left: 1 }
        }
    }
};

// Template export functionality
TemplateBuilder.prototype.exportTemplate = function(format, options) {
    switch (format) {
        case 'json':
            this.exportJSON();
            break;
        case 'html':
            this.exportHTML(options);
            break;
        case 'package':
            this.exportPackage(options);
            break;
    }
};

TemplateBuilder.prototype.exportJSON = function() {
    const json = JSON.stringify(this.currentTemplate, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentTemplate.name.toLowerCase().replace(/\s+/g, '-')}-template.json`;
    a.click();
    
    URL.revokeObjectURL(url);
};

TemplateBuilder.prototype.exportHTML = function(options) {
    const html = this.generateHTML();
    const css = this.generateCSS();
    
    const files = {
        'index.html': html,
        'styles.css': css
    };
    
    // If single file requested, combine
    if (!options.separateFiles) {
        const combined = html.replace(
            '<link rel="stylesheet" href="styles.css">',
            `<style>\n${css}\n</style>`
        );
        
        const blob = new Blob([combined], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentTemplate.name.toLowerCase().replace(/\s+/g, '-')}.html`;
        a.click();
        
        URL.revokeObjectURL(url);
    } else {
        // TODO: Implement multi-file download
        console.log('Multi-file export not yet implemented');
    }
};

TemplateBuilder.prototype.exportPackage = function(options) {
    // TODO: Implement ZIP package export
    console.log('Package export not yet implemented');
    this.showNotification('Package export coming soon!', 'info');
};

// Template preview functionality
TemplateBuilder.prototype.generatePreview = function() {
    const format = document.getElementById('preview-format').value;
    const container = document.getElementById('preview-container');
    
    if (format === 'html') {
        const html = this.generateHTML();
        const css = this.generateCSS();
        
        // Create iframe for preview
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '600px';
        iframe.style.border = 'none';
        iframe.style.background = 'white';
        iframe.style.boxShadow = 'var(--shadow-lg)';
        
        container.innerHTML = '';
        container.appendChild(iframe);
        
        // Write content to iframe
        const doc = iframe.contentDocument;
        const content = html.replace(
            '<link rel="stylesheet" href="styles.css">',
            `<style>\n${css}\n</style>`
        );
        
        doc.open();
        doc.write(content);
        doc.close();
    } else {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <i class="fas fa-file-pdf" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                <p>${format.toUpperCase()} preview coming soon!</p>
            </div>
        `;
    }
};

// Load prebuilt template
TemplateBuilder.prototype.loadPrebuiltTemplate = function(type) {
    const template = window.prebuiltTemplates[type];
    if (template) {
        this.currentTemplate = JSON.parse(JSON.stringify(template));
        document.getElementById('template-name').value = template.name;
        document.getElementById('template-type').value = template.type;
        
        // Update global styles UI
        document.getElementById('global-font').value = template.styles.fontFamily;
        document.getElementById('primary-color').value = template.styles.primaryColor;
        document.getElementById('secondary-color').value = template.styles.secondaryColor;
        document.getElementById('text-color').value = template.styles.textColor;
        document.getElementById('page-size').value = template.styles.pageSize;
        
        // Update margins
        Object.keys(template.styles.margins).forEach(side => {
            document.getElementById(`margin-${side}`).value = template.styles.margins[side];
        });
        
        this.updateCanvas();
        this.saveToHistory();
        this.showNotification(`Loaded ${template.name} template`, 'success');
    }
};

// Initialize with a default template
window.addEventListener('DOMContentLoaded', () => {
    // Add prebuilt templates to sidebar
    const savedTemplates = document.getElementById('saved-templates');
    const prebuiltSection = document.createElement('div');
    prebuiltSection.innerHTML = `
        <h4 style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-tertiary); margin: 1rem 0 0.5rem;">Prebuilt Templates</h4>
        ${Object.entries(window.prebuiltTemplates).map(([key, template]) => `
            <div class="template-item" onclick="templateBuilder.loadPrebuiltTemplate('${key}')">
                <div class="template-name">${template.name}</div>
                <div class="template-type" style="font-size: 0.75rem; color: var(--text-tertiary);">${template.description}</div>
            </div>
        `).join('')}
    `;
    savedTemplates.parentElement.appendChild(prebuiltSection);
});
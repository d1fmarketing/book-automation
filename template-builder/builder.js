// Template Builder Main JavaScript
class TemplateBuilder {
    constructor() {
        this.currentTemplate = {
            name: 'My Template',
            type: 'business',
            components: [],
            styles: {
                fontFamily: 'Inter',
                primaryColor: '#2563eb',
                secondaryColor: '#10b981',
                textColor: '#1f2937',
                pageSize: '6x9',
                margins: {
                    top: 1,
                    right: 0.75,
                    bottom: 1,
                    left: 0.75
                }
            }
        };
        
        this.selectedComponent = null;
        this.history = [];
        this.historyIndex = -1;
        this.showGrid = false;
        this.showRulers = false;
        this.showGuides = false;
        this.zoom = 100;
        this.view = 'design';
        
        this.init();
    }

    init() {
        this.setupDragAndDrop();
        this.setupEventListeners();
        this.loadSavedTemplates();
        this.updateCanvas();
        this.saveToHistory();
    }

    setupDragAndDrop() {
        // Component items drag start
        document.querySelectorAll('.component-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('component-type', item.dataset.component);
                item.classList.add('dragging');
            });
            
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
            });
        });

        // Canvas drop zone
        const canvas = document.getElementById('template-canvas');
        const dropZone = document.getElementById('drop-zone');

        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            
            if (dropZone) {
                dropZone.classList.add('drag-over');
            }
        });

        canvas.addEventListener('dragleave', (e) => {
            if (dropZone && !canvas.contains(e.relatedTarget)) {
                dropZone.classList.remove('drag-over');
            }
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            
            const componentType = e.dataTransfer.getData('component-type');
            if (componentType) {
                this.addComponent(componentType);
                
                if (dropZone) {
                    dropZone.classList.remove('drag-over');
                }
            }
        });
    }

    setupEventListeners() {
        // Global styles
        document.getElementById('global-font').addEventListener('change', (e) => {
            this.currentTemplate.styles.fontFamily = e.target.value;
            this.updateCanvas();
        });

        document.getElementById('primary-color').addEventListener('input', (e) => {
            this.currentTemplate.styles.primaryColor = e.target.value;
            document.querySelector('[onchange*="primary-color"]').value = e.target.value;
            this.updateCanvas();
        });

        document.getElementById('secondary-color').addEventListener('input', (e) => {
            this.currentTemplate.styles.secondaryColor = e.target.value;
            document.querySelector('[onchange*="secondary-color"]').value = e.target.value;
            this.updateCanvas();
        });

        document.getElementById('text-color').addEventListener('input', (e) => {
            this.currentTemplate.styles.textColor = e.target.value;
            document.querySelector('[onchange*="text-color"]').value = e.target.value;
            this.updateCanvas();
        });

        document.getElementById('page-size').addEventListener('change', (e) => {
            this.currentTemplate.styles.pageSize = e.target.value;
            this.updateCanvasSize();
        });

        // Margins
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            document.getElementById(`margin-${side}`).addEventListener('input', (e) => {
                this.currentTemplate.styles.margins[side] = parseFloat(e.target.value) || 0;
                this.updateCanvas();
            });
        });

        // Template name
        document.getElementById('template-name').addEventListener('input', (e) => {
            this.currentTemplate.name = e.target.value;
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveTemplate();
                        break;
                    case 'd':
                        e.preventDefault();
                        if (this.selectedComponent) {
                            this.duplicateComponent();
                        }
                        break;
                }
            } else if (e.key === 'Delete' && this.selectedComponent) {
                e.preventDefault();
                this.deleteComponent();
            }
        });

        // Context menu
        document.addEventListener('contextmenu', (e) => {
            const component = e.target.closest('.template-component');
            if (component) {
                e.preventDefault();
                this.showContextMenu(e.pageX, e.pageY, component);
            }
        });

        // Click outside to close context menu
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });
    }

    addComponent(type) {
        const component = {
            id: `component-${Date.now()}`,
            type,
            content: this.getDefaultContent(type),
            styles: this.getDefaultStyles(type)
        };

        this.currentTemplate.components.push(component);
        this.updateCanvas();
        this.saveToHistory();
    }

    getDefaultContent(type) {
        const defaults = {
            cover: {
                title: 'Your Book Title',
                subtitle: 'A compelling subtitle',
                author: 'Author Name'
            },
            toc: {
                title: 'Table of Contents',
                chapters: [
                    { number: '1', title: 'Introduction', page: 1 },
                    { number: '2', title: 'Chapter Two', page: 15 }
                ]
            },
            chapter: {
                number: '1',
                title: 'Chapter Title',
                content: 'Chapter content goes here...'
            },
            callout: {
                type: 'info',
                title: 'Important Note',
                content: 'This is a callout box for highlighting important information.'
            },
            quote: {
                text: 'An inspiring quote goes here.',
                author: 'Quote Author'
            },
            image: {
                src: 'placeholder.jpg',
                caption: 'Image caption',
                width: '100%'
            },
            list: {
                type: 'bullet',
                items: ['First item', 'Second item', 'Third item']
            },
            code: {
                language: 'javascript',
                content: '// Code example\nfunction hello() {\n  console.log("Hello, World!");\n}'
            },
            divider: {
                style: 'solid'
            },
            footer: {
                content: 'Page {page}'
            }
        };

        return defaults[type] || {};
    }

    getDefaultStyles(type) {
        const defaults = {
            cover: {
                textAlign: 'center',
                padding: '4rem 2rem'
            },
            chapter: {
                marginTop: '2rem'
            },
            callout: {
                padding: '1rem',
                borderRadius: '0.5rem',
                marginTop: '1rem',
                marginBottom: '1rem'
            },
            quote: {
                fontStyle: 'italic',
                borderLeft: '4px solid',
                paddingLeft: '1rem',
                marginTop: '1rem',
                marginBottom: '1rem'
            }
        };

        return defaults[type] || {};
    }

    updateCanvas() {
        const canvas = document.getElementById('template-canvas');
        const dropZone = document.getElementById('drop-zone');

        // Remove drop zone if components exist
        if (this.currentTemplate.components.length > 0 && dropZone) {
            dropZone.remove();
        }

        // Clear canvas (except drop zone)
        const existingComponents = canvas.querySelectorAll('.template-component');
        existingComponents.forEach(comp => comp.remove());

        // Apply global styles
        canvas.style.fontFamily = this.currentTemplate.styles.fontFamily;
        canvas.style.color = this.currentTemplate.styles.textColor;

        // Render components
        this.currentTemplate.components.forEach(component => {
            const element = this.renderComponent(component);
            canvas.appendChild(element);
        });

        // Update code view if active
        if (this.view === 'code' || this.view === 'split') {
            this.updateCodeView();
        }
    }

    renderComponent(component) {
        const wrapper = document.createElement('div');
        wrapper.className = 'template-component';
        wrapper.dataset.componentId = component.id;
        
        // Add content based on type
        const content = window.componentRenderers[component.type](component);
        wrapper.innerHTML = content;

        // Apply component styles
        Object.assign(wrapper.style, component.styles);

        // Add interaction handlers
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectComponent(component);
        });

        // Make draggable within canvas
        this.makeComponentDraggable(wrapper);

        return wrapper;
    }

    makeComponentDraggable(element) {
        let isDragging = false;
        let startY = 0;
        let startTop = 0;

        element.addEventListener('mousedown', (e) => {
            if (e.target.closest('.component-actions')) return;
            
            isDragging = true;
            startY = e.clientY;
            startTop = element.offsetTop;
            element.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaY = e.clientY - startY;
            const newTop = startTop + deltaY;
            
            // Reorder components based on position
            this.reorderComponents(element, newTop);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'grab';
                this.saveToHistory();
            }
        });
    }

    reorderComponents(draggedElement, newTop) {
        const components = Array.from(document.querySelectorAll('.template-component'));
        const draggedIndex = components.indexOf(draggedElement);
        
        let newIndex = draggedIndex;
        
        components.forEach((comp, index) => {
            if (comp === draggedElement) return;
            
            const compTop = comp.offsetTop;
            const compHeight = comp.offsetHeight;
            const compMiddle = compTop + compHeight / 2;
            
            if (newTop < compMiddle && index < draggedIndex) {
                newIndex = index;
            } else if (newTop > compMiddle && index > draggedIndex) {
                newIndex = index;
            }
        });
        
        if (newIndex !== draggedIndex) {
            // Update array
            const [removed] = this.currentTemplate.components.splice(draggedIndex, 1);
            this.currentTemplate.components.splice(newIndex, 0, removed);
            this.updateCanvas();
        }
    }

    selectComponent(component) {
        // Remove previous selection
        document.querySelectorAll('.template-component').forEach(el => {
            el.classList.remove('selected');
        });

        // Add selection to clicked component
        const element = document.querySelector(`[data-component-id="${component.id}"]`);
        if (element) {
            element.classList.add('selected');
        }

        this.selectedComponent = component;
        this.showComponentProperties(component);
    }

    showComponentProperties(component) {
        const noSelection = document.getElementById('no-selection');
        const propertiesContent = document.getElementById('properties-content');

        noSelection.classList.add('hidden');
        propertiesContent.classList.remove('hidden');

        // Generate properties UI based on component type
        propertiesContent.innerHTML = window.componentProperties[component.type](component);

        // Setup property change handlers
        this.setupPropertyHandlers(component);
    }

    setupPropertyHandlers(component) {
        const propertiesContent = document.getElementById('properties-content');
        
        // Handle all inputs
        propertiesContent.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('input', (e) => {
                const property = e.target.dataset.property;
                const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                
                // Update component content/styles
                this.updateComponentProperty(component, property, value);
                this.updateCanvas();
                this.saveToHistory();
            });
        });
    }

    updateComponentProperty(component, property, value) {
        // Parse property path (e.g., "content.title" or "styles.padding")
        const parts = property.split('.');
        let target = component;
        
        for (let i = 0; i < parts.length - 1; i++) {
            target = target[parts[i]];
        }
        
        target[parts[parts.length - 1]] = value;
    }

    updateCanvasSize() {
        const canvas = document.getElementById('template-canvas');
        const sizes = {
            '6x9': { width: 432, height: 648 },
            '5.5x8.5': { width: 396, height: 612 },
            '8.5x11': { width: 612, height: 792 },
            'a4': { width: 595, height: 842 },
            'a5': { width: 420, height: 595 }
        };

        const size = sizes[this.currentTemplate.styles.pageSize];
        if (size) {
            canvas.style.width = `${size.width}px`;
            canvas.style.minHeight = `${size.height}px`;
        }
    }

    updateCodeView() {
        const codeContent = document.querySelector('#code-content code');
        const activeTab = document.querySelector('.code-tab.active').dataset.lang;

        let code = '';
        switch (activeTab) {
            case 'html':
                code = this.generateHTML();
                break;
            case 'css':
                code = this.generateCSS();
                break;
            case 'markdown':
                code = this.generateMarkdown();
                break;
        }

        codeContent.textContent = code;
    }

    generateHTML() {
        let html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
        html += '    <meta charset="UTF-8">\n';
        html += '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
        html += `    <title>${this.currentTemplate.name}</title>\n`;
        html += '    <link rel="stylesheet" href="styles.css">\n';
        html += '</head>\n<body>\n';

        this.currentTemplate.components.forEach(component => {
            html += this.componentToHTML(component);
        });

        html += '</body>\n</html>';
        return html;
    }

    componentToHTML(component) {
        // Generate HTML for each component type
        return window.componentGenerators.html[component.type](component);
    }

    generateCSS() {
        let css = `/* ${this.currentTemplate.name} Styles */\n\n`;
        css += ':root {\n';
        css += `    --primary-color: ${this.currentTemplate.styles.primaryColor};\n`;
        css += `    --secondary-color: ${this.currentTemplate.styles.secondaryColor};\n`;
        css += `    --text-color: ${this.currentTemplate.styles.textColor};\n`;
        css += '}\n\n';
        css += 'body {\n';
        css += `    font-family: '${this.currentTemplate.styles.fontFamily}', sans-serif;\n`;
        css += `    color: var(--text-color);\n`;
        css += '}\n\n';

        // Add component-specific styles
        this.currentTemplate.components.forEach(component => {
            css += window.componentGenerators.css[component.type](component);
        });

        return css;
    }

    generateMarkdown() {
        let markdown = '';
        
        this.currentTemplate.components.forEach((component, index) => {
            if (index > 0) markdown += '\n\n';
            markdown += window.componentGenerators.markdown[component.type](component);
        });

        return markdown;
    }

    saveToHistory() {
        // Remove any states after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add current state
        this.history.push(JSON.stringify(this.currentTemplate));
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.currentTemplate = JSON.parse(this.history[this.historyIndex]);
            this.updateCanvas();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.currentTemplate = JSON.parse(this.history[this.historyIndex]);
            this.updateCanvas();
        }
    }

    saveTemplate() {
        // Save to localStorage
        const templates = JSON.parse(localStorage.getItem('ebook-templates') || '[]');
        const existingIndex = templates.findIndex(t => t.name === this.currentTemplate.name);
        
        if (existingIndex >= 0) {
            templates[existingIndex] = this.currentTemplate;
        } else {
            templates.push(this.currentTemplate);
        }
        
        localStorage.setItem('ebook-templates', JSON.stringify(templates));
        
        // Update saved templates list
        this.loadSavedTemplates();
        
        // Show notification
        this.showNotification('Template saved successfully', 'success');
    }

    loadSavedTemplates() {
        const templates = JSON.parse(localStorage.getItem('ebook-templates') || '[]');
        const container = document.getElementById('saved-templates');
        
        container.innerHTML = templates.map(template => `
            <div class="template-item" onclick="templateBuilder.loadTemplate('${template.name}')">
                <div class="template-name">${template.name}</div>
                <div class="template-type">${template.type}</div>
            </div>
        `).join('');
    }

    loadTemplate(name) {
        const templates = JSON.parse(localStorage.getItem('ebook-templates') || '[]');
        const template = templates.find(t => t.name === name);
        
        if (template) {
            this.currentTemplate = template;
            document.getElementById('template-name').value = template.name;
            document.getElementById('template-type').value = template.type;
            this.updateCanvas();
            this.saveToHistory();
        }
    }

    showContextMenu(x, y, component) {
        const menu = document.getElementById('context-menu');
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.add('active');
        
        // Store reference to component
        menu.dataset.componentId = component.dataset.componentId;
    }

    hideContextMenu() {
        document.getElementById('context-menu').classList.remove('active');
    }

    deleteComponent() {
        if (!this.selectedComponent) return;
        
        const index = this.currentTemplate.components.findIndex(
            c => c.id === this.selectedComponent.id
        );
        
        if (index >= 0) {
            this.currentTemplate.components.splice(index, 1);
            this.selectedComponent = null;
            this.updateCanvas();
            this.saveToHistory();
            
            // Hide properties
            document.getElementById('no-selection').classList.remove('hidden');
            document.getElementById('properties-content').classList.add('hidden');
        }
    }

    duplicateComponent() {
        if (!this.selectedComponent) return;
        
        const clone = JSON.parse(JSON.stringify(this.selectedComponent));
        clone.id = `component-${Date.now()}`;
        
        const index = this.currentTemplate.components.findIndex(
            c => c.id === this.selectedComponent.id
        );
        
        this.currentTemplate.components.splice(index + 1, 0, clone);
        this.updateCanvas();
        this.saveToHistory();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Global functions
window.renameTemplate = () => {
    document.getElementById('template-name').focus();
};

window.previewTemplate = () => {
    document.getElementById('preview-modal').classList.add('active');
    templateBuilder.generatePreview();
};

window.exportTemplate = () => {
    document.getElementById('export-modal').classList.add('active');
};

window.saveTemplate = () => {
    templateBuilder.saveTemplate();
};

window.updateTemplateType = () => {
    const type = document.getElementById('template-type').value;
    templateBuilder.currentTemplate.type = type;
};

window.undoAction = () => {
    templateBuilder.undo();
};

window.redoAction = () => {
    templateBuilder.redo();
};

window.toggleGrid = () => {
    const canvas = document.getElementById('template-canvas');
    templateBuilder.showGrid = !templateBuilder.showGrid;
    canvas.classList.toggle('grid', templateBuilder.showGrid);
};

window.toggleRulers = () => {
    templateBuilder.showRulers = !templateBuilder.showRulers;
    // Implementation for rulers
};

window.toggleGuides = () => {
    templateBuilder.showGuides = !templateBuilder.showGuides;
    // Implementation for guides
};

window.updateZoom = () => {
    const zoom = document.getElementById('zoom-level').value;
    const canvas = document.getElementById('template-canvas');
    templateBuilder.zoom = parseInt(zoom);
    canvas.style.transform = `scale(${zoom / 100})`;
};

window.switchView = (view) => {
    templateBuilder.view = view;
    
    // Update toolbar buttons
    document.querySelectorAll('.toolbar-btn[onclick^="switchView"]').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update views
    const designView = document.getElementById('design-view');
    const codeView = document.getElementById('code-view');
    
    if (view === 'design') {
        designView.classList.remove('hidden');
        codeView.classList.add('hidden');
    } else if (view === 'code') {
        designView.classList.add('hidden');
        codeView.classList.remove('hidden');
        templateBuilder.updateCodeView();
    } else if (view === 'split') {
        // Implementation for split view
    }
};

window.closePreview = () => {
    document.getElementById('preview-modal').classList.remove('active');
};

window.closeExport = () => {
    document.getElementById('export-modal').classList.remove('active');
};

window.performExport = () => {
    const format = document.querySelector('input[name="export-format"]:checked').value;
    const includeCss = document.getElementById('include-css').checked;
    const includeFonts = document.getElementById('include-fonts').checked;
    const includeImages = document.getElementById('include-images').checked;
    
    // Perform export based on format
    templateBuilder.exportTemplate(format, { includeCss, includeFonts, includeImages });
    
    closeExport();
};

window.editComponent = () => {
    if (templateBuilder.selectedComponent) {
        document.getElementById('component-modal').classList.add('active');
        // Load component editor
    }
};

window.moveComponent = (direction) => {
    // Implementation for moving components
};

window.deleteComponent = () => {
    templateBuilder.deleteComponent();
};

window.duplicateComponent = () => {
    templateBuilder.duplicateComponent();
};

window.updateColorFromText = (input, colorInputId) => {
    const colorInput = document.getElementById(colorInputId);
    if (/^#[0-9A-F]{6}$/i.test(input.value)) {
        colorInput.value = input.value;
        colorInput.dispatchEvent(new Event('input'));
    }
};

// Add notification styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        box-shadow: var(--shadow-lg);
        transform: translateX(400px);
        transition: transform var(--transition-normal);
        z-index: 2000;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-color: var(--success);
        color: var(--success);
    }
    
    .notification.error {
        border-color: var(--danger);
        color: var(--danger);
    }
`;
document.head.appendChild(style);
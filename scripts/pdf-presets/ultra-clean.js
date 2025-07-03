module.exports = {
    name: 'ultra-clean',
    description: 'Preset definitivo sem conflitos',
    
    processMarkdown: function(markdown) {
        // Remover frontmatter
        markdown = markdown.replace(/^---[\s\S]*?---\n/, '');
        
        // Processar callouts
        const calloutTypes = {
            'TIP': { bg: '#E3F2FD', color: '#1565C0', icon: '💡' },
            'WARNING': { bg: '#FFF3E0', color: '#E65100', icon: '⚠️' },
            'INFO': { bg: '#F3E5F5', color: '#6A1B9A', icon: 'ℹ️' },
            'KEY': { bg: '#FFF8E1', color: '#F57C00', icon: '🔑' },
            'SUCCESS': { bg: '#E8F5E9', color: '#2E7D32', icon: '✅' }
        };
        
        Object.keys(calloutTypes).forEach(type => {
            const config = calloutTypes[type];
            const regex = new RegExp('\\[!' + type + '\\]\\s*(.*)\\n([^\\n]*)', 'gi');
            markdown = markdown.replace(regex, function(match, title, content) {
                return '<div style="background: ' + config.bg + '; color: ' + config.color + '; padding: 1em; margin: 1em 0; border-radius: 8px;">' +
                    '<div style="font-weight: bold; margin-bottom: 0.5em;">' +
                    '<span style="margin-right: 0.5em;">' + config.icon + '</span>' +
                    (title || type) + '</div>' +
                    '<div>' + content + '</div></div>';
            });
        });
        
        // AI-IMAGE
        markdown = markdown.replace(/AI-IMAGE\[(.*?)\]/g, function(match, desc) {
            return '<div style="border: 2px dashed #ddd; padding: 3em; text-align: center; margin: 2em 0;">🎨 ' + desc + '</div>';
        });
        
        return markdown;
    },
    
    options: {
        format: 'Letter',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        displayHeaderFooter: true,
        headerTemplate: '<div style="width: 100%; text-align: center; font-size: 10px;">The Claude Elite Pipeline</div>',
        footerTemplate: '<div style="width: 100%; text-align: center; font-size: 10px;"><span class="pageNumber"></span></div>',
        printBackground: true
    },
    
    css: 'body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.6; color: #333; } ' +
         'h1, h2, h3 { color: #1a1a1a; margin-top: 1em; margin-bottom: 0.5em; } ' +
         'p { margin-bottom: 1em; text-align: justify; } ' +
         'code { background: #f5f5f5; padding: 0.2em 0.4em; font-family: monospace; } ' +
         'table { width: 100%; border-collapse: collapse; margin: 1em 0; } ' +
         'th, td { border: 1px solid #ddd; padding: 0.5em; }'
};

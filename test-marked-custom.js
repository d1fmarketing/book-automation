const marked = require('marked');
const fs = require('fs');

// Processar callouts ANTES do marked
function preprocessCallouts(markdown) {
    const lines = markdown.split('\n');
    let result = [];
    let inCallout = false;
    let calloutType = '';
    let calloutTitle = '';
    let calloutContent = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const calloutStart = line.match(/^>\s*\[!(\w+)\]\s*(.*)/);
        
        if (calloutStart) {
            // Início de um callout
            if (inCallout && calloutContent.length > 0) {
                // Fechar callout anterior
                result.push(`<div class="callout callout-${calloutType}">`);
                result.push(`<div class="callout-header">`);
                result.push(`<span class="callout-icon"></span>`);
                result.push(`<span class="callout-title">${calloutTitle || calloutType.charAt(0).toUpperCase() + calloutType.slice(1)}</span>`);
                result.push(`</div>`);
                result.push(`<div class="callout-content">${calloutContent.join(' ')}</div>`);
                result.push(`</div>`);
                result.push('');
            }
            
            inCallout = true;
            calloutType = calloutStart[1].toLowerCase();
            calloutTitle = calloutStart[2].trim();
            calloutContent = [];
        } else if (inCallout && line.startsWith('>')) {
            // Conteúdo do callout
            calloutContent.push(line.substring(1).trim());
        } else {
            // Fim do callout ou linha normal
            if (inCallout && calloutContent.length > 0) {
                result.push(`<div class="callout callout-${calloutType}">`);
                result.push(`<div class="callout-header">`);
                result.push(`<span class="callout-icon"></span>`);
                result.push(`<span class="callout-title">${calloutTitle || calloutType.charAt(0).toUpperCase() + calloutType.slice(1)}</span>`);
                result.push(`</div>`);
                result.push(`<div class="callout-content">${calloutContent.join(' ')}</div>`);
                result.push(`</div>`);
                result.push('');
                inCallout = false;
            }
            result.push(line);
        }
    }
    
    // Fechar último callout se necessário
    if (inCallout && calloutContent.length > 0) {
        result.push(`<div class="callout callout-${calloutType}">`);
        result.push(`<div class="callout-header">`);
        result.push(`<span class="callout-icon"></span>`);
        result.push(`<span class="callout-title">${calloutTitle || calloutType.charAt(0).toUpperCase() + calloutType.slice(1)}</span>`);
        result.push(`</div>`);
        result.push(`<div class="callout-content">${calloutContent.join(' ')}</div>`);
        result.push(`</div>`);
    }
    
    return result.join('\n');
}

const markdown = fs.readFileSync('test-callouts.md', 'utf8');
console.log('MARKDOWN ORIGINAL:');
console.log(markdown);
console.log('\n---\n');

const processed = preprocessCallouts(markdown);
console.log('MARKDOWN PROCESSADO:');
console.log(processed);
console.log('\n---\n');

const html = marked.parse(processed);
console.log('HTML GERADO:');
console.log(html);
fs.writeFileSync('test-callouts.html', html);
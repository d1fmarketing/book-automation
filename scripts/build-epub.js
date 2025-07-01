#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const yaml = require('js-yaml');
const marked = require('marked');
// ANSI colors (chalk is ESM-only now)
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`
};
// Simple spinner replacement
class SimpleSpinner {
    constructor(text) {
        this.text = text;
        this.interval = null;
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.index = 0;
    }
    
    start() {
        process.stdout.write(`${this.frames[0]} ${this.text}`);
        this.interval = setInterval(() => {
            process.stdout.write(`\r${this.frames[this.index]} ${this.text}`);
            this.index = (this.index + 1) % this.frames.length;
        }, 80);
        return this;
    }
    
    succeed(text) {
        this.stop();
        console.log(`\r✅ ${text || this.text}`);
    }
    
    fail(text) {
        this.stop();
        console.log(`\r❌ ${text || this.text}`);
    }
    
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            process.stdout.write('\r' + ' '.repeat(50) + '\r');
        }
    }
}

const ora = (text) => new SimpleSpinner(text);
const { glob } = require('glob');
const { create } = require('xmlbuilder2');

// Configurar marked
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: true,
    xhtml: true
});

class EPUBBuilder {
    constructor() {
        this.metadata = null;
        this.buildDir = path.join(process.cwd(), 'build', 'temp', 'epub');
        this.outputDir = path.join(process.cwd(), 'build', 'dist');
        this.chapters = [];
        this.images = [];
        this.spinner = ora('Construindo EPUB...').start();
    }
    
    async build() {
        try {
            await this.loadMetadata();
            await this.prepareDirectories();
            await this.processChapters();
            await this.copyAssets();
            await this.createMimetype();
            await this.createContainer();
            await this.createContentOPF();
            await this.createTOC();
            await this.createPackage();
            
            this.spinner.succeed(colors.green('EPUB criado com sucesso!'));
        } catch (error) {
            this.spinner.fail(colors.red('Erro ao criar EPUB'));
            console.error(error);
            process.exit(1);
        }
    }
    
    async loadMetadata() {
        this.spinner.text = 'Carregando metadados...';
        const rawMetadata = yaml.load(
            await fs.readFile('metadata.yaml', 'utf8')
        );
        
        // Normalize metadata structure
        this.metadata = {
            title: rawMetadata.book?.title || rawMetadata.title || 'Untitled',
            author: rawMetadata.book?.author || rawMetadata.author || 'Unknown',
            language: rawMetadata.book?.language || rawMetadata.language || 'en',
            publisher: rawMetadata.book?.publisher || rawMetadata.publisher || '',
            description: rawMetadata.book?.description || rawMetadata.description || '',
            uuid: rawMetadata.book?.isbn || rawMetadata.uuid || 'urn:uuid:' + this.generateUUID(),
            copyright: rawMetadata.copyright || `© ${new Date().getFullYear()} ${rawMetadata.book?.author || rawMetadata.author || ''}`,
            coverImage: rawMetadata.images?.cover || rawMetadata.coverImage || 'assets/images/cover.jpg'
        };
    }
    
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    async prepareDirectories() {
        this.spinner.text = 'Preparando diretórios...';
        await fs.emptyDir(this.buildDir);
        await fs.ensureDir(path.join(this.buildDir, 'META-INF'));
        await fs.ensureDir(path.join(this.buildDir, 'OEBPS'));
        await fs.ensureDir(path.join(this.buildDir, 'OEBPS', 'css'));
        await fs.ensureDir(path.join(this.buildDir, 'OEBPS', 'images'));
        await fs.ensureDir(this.outputDir);
    }
    
    async processChapters() {
        this.spinner.text = 'Processando capítulos...';
        
        const chapterFiles = await glob('chapters/*.md');
        chapterFiles.sort();
        
        for (let i = 0; i < chapterFiles.length; i++) {
            const content = await fs.readFile(chapterFiles[i], 'utf8');
            
            // Extrair frontmatter
            const lines = content.split('\n');
            let frontmatter = {};
            let markdownStart = 0;
            
            if (lines[0] === '---') {
                let endIndex = lines.indexOf('---', 1);
                if (endIndex > 0) {
                    const yamlContent = lines.slice(1, endIndex).join('\n');
                    frontmatter = yaml.load(yamlContent) || {};
                    markdownStart = endIndex + 1;
                }
            }
            
            // Processar markdown
            const markdownContent = lines.slice(markdownStart).join('\n');
            let htmlContent = marked.parse(markdownContent);
            
            // Adicionar número do capítulo
            const chapterNum = i + 1;
            htmlContent = htmlContent.replace(
                /<h1[^>]*>/,
                `<h1>Capítulo ${chapterNum}: `
            );
            
            // Criar arquivo HTML do capítulo
            const chapterHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${this.metadata.language}">
<head>
    <title>${frontmatter.title || `Capítulo ${chapterNum}`}</title>
    <link rel="stylesheet" type="text/css" href="css/styles.css"/>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
</head>
<body>
${htmlContent}
</body>
</html>`;
            
            const filename = `chapter${String(chapterNum).padStart(2, '0')}.xhtml`;
            await fs.writeFile(
                path.join(this.buildDir, 'OEBPS', filename),
                chapterHTML
            );
            
            this.chapters.push({
                id: `chapter${chapterNum}`,
                filename: filename,
                title: frontmatter.title || `Capítulo ${chapterNum}`
            });
        }
    }
    
    async copyAssets() {
        this.spinner.text = 'Copiando assets...';
        
        // CSS
        const cssPath = path.join('assets', 'css', 'epub-styles.css');
        if (await fs.pathExists(cssPath)) {
            await fs.copy(
                cssPath,
                path.join(this.buildDir, 'OEBPS', 'css', 'styles.css')
            );
        } else {
            // CSS padrão
            const defaultCSS = `
body {
    font-family: Georgia, serif;
    font-size: 1em;
    line-height: 1.6;
    margin: 1em;
    text-align: justify;
}

h1 {
    font-size: 1.8em;
    text-align: center;
    margin: 1em 0;
    page-break-before: always;
}

h2 {
    font-size: 1.4em;
    margin: 1.5em 0 0.5em 0;
}

h3 {
    font-size: 1.2em;
    margin: 1.2em 0 0.5em 0;
}

p {
    text-indent: 1.5em;
    margin: 0 0 0.5em 0;
}

p:first-child,
p:first-of-type,
h1 + p,
h2 + p,
h3 + p {
    text-indent: 0;
}

blockquote {
    margin: 1em 2em;
    font-style: italic;
}

code {
    font-family: monospace;
    font-size: 0.9em;
}

pre {
    margin: 1em 0;
    padding: 0.5em;
    background: #f5f5f5;
    overflow-x: auto;
}`;
            
            await fs.writeFile(
                path.join(this.buildDir, 'OEBPS', 'css', 'styles.css'),
                defaultCSS
            );
        }
        
        // Capa
        const coverPath = path.join('assets', 'images', 'cover.jpg');
        if (await fs.pathExists(coverPath)) {
            await fs.copy(
                coverPath,
                path.join(this.buildDir, 'OEBPS', 'images', 'cover.jpg')
            );
            this.images.push({
                id: 'cover-image',
                filename: 'images/cover.jpg',
                mediaType: 'image/jpeg'
            });
        }
    }
    
    async createMimetype() {
        this.spinner.text = 'Criando mimetype...';
        await fs.writeFile(
            path.join(this.buildDir, 'mimetype'),
            'application/epub+zip',
            { encoding: 'ascii' }
        );
    }
    
    async createContainer() {
        this.spinner.text = 'Criando container.xml...';
        
        const container = create({ encoding: 'UTF-8' })
            .ele('container', {
                version: '1.0',
                xmlns: 'urn:oasis:names:tc:opendocument:xmlns:container'
            })
            .ele('rootfiles')
                .ele('rootfile', {
                    'full-path': 'OEBPS/content.opf',
                    'media-type': 'application/oebps-package+xml'
                })
            .end({ prettyPrint: true });
        
        await fs.writeFile(
            path.join(this.buildDir, 'META-INF', 'container.xml'),
            container
        );
    }
    
    async createContentOPF() {
        this.spinner.text = 'Criando content.opf...';
        
        const opf = create({ encoding: 'UTF-8' })
            .ele('package', {
                xmlns: 'http://www.idpf.org/2007/opf',
                'unique-identifier': 'bookid',
                version: '2.0'
            });
        
        // Metadata
        const metadata = opf.ele('metadata', {
            'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
            'xmlns:opf': 'http://www.idpf.org/2007/opf'
        });
        
        metadata.ele('dc:title').txt(this.metadata.title);
        metadata.ele('dc:creator', { 'opf:role': 'aut' }).txt(this.metadata.author);
        metadata.ele('dc:identifier', { id: 'bookid' }).txt(this.metadata.uuid);
        metadata.ele('dc:language').txt(this.metadata.language);
        metadata.ele('dc:publisher').txt(this.metadata.publisher || '');
        metadata.ele('dc:date').txt(new Date().toISOString().split('T')[0]);
        metadata.ele('dc:rights').txt(this.metadata.copyright);
        
        if (this.metadata.description) {
            metadata.ele('dc:description').txt(this.metadata.description);
        }
        
        if (this.images.find(img => img.id === 'cover-image')) {
            metadata.ele('meta', {
                name: 'cover',
                content: 'cover-image'
            });
        }
        
        // Manifest
        const manifest = opf.ele('manifest');
        
        // NCX
        manifest.ele('item', {
            id: 'ncx',
            href: 'toc.ncx',
            'media-type': 'application/x-dtbncx+xml'
        });
        
        // CSS
        manifest.ele('item', {
            id: 'styles',
            href: 'css/styles.css',
            'media-type': 'text/css'
        });
        
        // Imagens
        this.images.forEach(img => {
            manifest.ele('item', {
                id: img.id,
                href: img.filename,
                'media-type': img.mediaType
            });
        });
        
        // Capítulos
        this.chapters.forEach(chapter => {
            manifest.ele('item', {
                id: chapter.id,
                href: chapter.filename,
                'media-type': 'application/xhtml+xml'
            });
        });
        
        // Spine
        const spine = opf.ele('spine', { toc: 'ncx' });
        
        this.chapters.forEach(chapter => {
            spine.ele('itemref', { idref: chapter.id });
        });
        
        // Guide (opcional)
        const guide = opf.ele('guide');
        
        if (this.chapters.length > 0) {
            guide.ele('reference', {
                type: 'text',
                title: 'Início',
                href: this.chapters[0].filename
            });
        }
        
        await fs.writeFile(
            path.join(this.buildDir, 'OEBPS', 'content.opf'),
            opf.end({ prettyPrint: true })
        );
    }
    
    async createTOC() {
        this.spinner.text = 'Criando toc.ncx...';
        
        const ncx = create({ encoding: 'UTF-8' })
            .ele('ncx', {
                xmlns: 'http://www.daisy.org/z3986/2005/ncx/',
                version: '2005-1'
            });
        
        // Head
        const head = ncx.ele('head');
        head.ele('meta', { name: 'dtb:uid', content: this.metadata.uuid });
        head.ele('meta', { name: 'dtb:depth', content: '1' });
        head.ele('meta', { name: 'dtb:totalPageCount', content: '0' });
        head.ele('meta', { name: 'dtb:maxPageNumber', content: '0' });
        
        // DocTitle
        ncx.ele('docTitle').ele('text').txt(this.metadata.title);
        
        // NavMap
        const navMap = ncx.ele('navMap');
        
        this.chapters.forEach((chapter, index) => {
            const navPoint = navMap.ele('navPoint', {
                id: `navPoint-${index + 1}`,
                playOrder: String(index + 1)
            });
            
            navPoint.ele('navLabel').ele('text').txt(chapter.title);
            navPoint.ele('content', { src: chapter.filename });
        });
        
        await fs.writeFile(
            path.join(this.buildDir, 'OEBPS', 'toc.ncx'),
            ncx.end({ prettyPrint: true })
        );
    }
    
    async createPackage() {
        this.spinner.text = 'Criando arquivo EPUB...';
        
        const outputFile = path.join(
            this.outputDir,
            `${(this.metadata.book?.title || this.metadata.title || 'ebook').toLowerCase().replace(/\s+/g, '-')}.epub`
        );
        
        const output = fs.createWriteStream(outputFile);
        const archive = archiver('zip', { store: false });
        
        return new Promise((resolve, reject) => {
            output.on('close', () => {
                console.log(colors.green(`✓ EPUB criado: ${outputFile}`));
                console.log(colors.blue(`  Tamanho: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`));
                resolve();
            });
            
            archive.on('error', reject);
            
            archive.pipe(output);
            
            // Adicionar mimetype primeiro (sem compressão)
            archive.file(path.join(this.buildDir, 'mimetype'), {
                name: 'mimetype',
                store: true
            });
            
            // Adicionar META-INF
            archive.directory(
                path.join(this.buildDir, 'META-INF'),
                'META-INF'
            );
            
            // Adicionar OEBPS
            archive.directory(
                path.join(this.buildDir, 'OEBPS'),
                'OEBPS'
            );
            
            archive.finalize();
        });
    }
}

// Executar
const builder = new EPUBBuilder();
builder.build();
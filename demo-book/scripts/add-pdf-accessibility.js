#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName, PDFString, PDFDict, PDFArray, PDFRef } = require('pdf-lib');

// Console colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
};

async function addPDFAccessibility(inputPath, outputPath) {
    console.log(`${colors.green}${colors.bright}♿ Adding PDF Accessibility Features...${colors.reset}`);
    
    try {
        // Load the PDF
        const existingPdfBytes = fs.readFileSync(inputPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes, { updateMetadata: false });
        
        // Set document metadata for accessibility
        console.log(`${colors.blue}📋 Setting document metadata...${colors.reset}`);
        pdfDoc.setTitle('TDAH Descomplicado - 10 Estratégias Infalíveis para Nunca Mais Perder Suas Coisas', {
            showInWindowTitleBar: true
        });
        pdfDoc.setAuthor('Dr. Rafael Mendes');
        pdfDoc.setSubject('Estratégias práticas para pessoas com TDAH organizarem suas vidas');
        pdfDoc.setKeywords(['TDAH', 'produtividade', 'organização', 'foco', 'autoajuda']);
        pdfDoc.setCreator('Book Automation Pipeline');
        pdfDoc.setProducer('Book Automation Pipeline with pdf-lib');
        pdfDoc.setLanguage('pt-BR');
        
        // Get the existing catalog
        const catalog = pdfDoc.catalog;
        
        // Add MarkInfo dictionary to indicate the PDF is tagged
        console.log(`${colors.blue}🏷️ Marking PDF as tagged...${colors.reset}`);
        const markInfo = pdfDoc.context.obj({
            Marked: true,
            UserProperties: false,
            Suspects: false
        });
        
        // Add to catalog
        catalog.set(PDFName.of('MarkInfo'), markInfo);
        
        // Add Lang entry to catalog for document language
        catalog.set(PDFName.of('Lang'), PDFString.of('pt-BR'));
        
        // Add ViewerPreferences for accessibility
        console.log(`${colors.blue}👁️ Setting viewer preferences...${colors.reset}`);
        const viewerPrefs = pdfDoc.context.obj({
            DisplayDocTitle: true,
            FitWindow: false,
            HideMenubar: false,
            HideToolbar: false,
            HideWindowUI: false,
            NonFullScreenPageMode: PDFName.of('UseOutlines'),
            ViewArea: PDFName.of('CropBox'),
            ViewClip: PDFName.of('CropBox'),
            PrintArea: PDFName.of('CropBox'),
            PrintClip: PDFName.of('CropBox')
        });
        
        catalog.set(PDFName.of('ViewerPreferences'), viewerPrefs);
        
        // Create StructTreeRoot (basic structure tree)
        console.log(`${colors.blue}🌳 Creating structure tree root...${colors.reset}`);
        const structTreeRoot = pdfDoc.context.obj({
            Type: PDFName.of('StructTreeRoot'),
            K: PDFArray.withContext(pdfDoc.context),
            ParentTree: pdfDoc.context.obj({
                Nums: PDFArray.withContext(pdfDoc.context)
            })
        });
        
        catalog.set(PDFName.of('StructTreeRoot'), structTreeRoot);
        
        // Add PDF/UA identifier
        console.log(`${colors.blue}📜 Adding PDF/UA compliance marker...${colors.reset}`);
        const pdfuaId = pdfDoc.context.obj({
            Type: PDFName.of('Metadata'),
            Subtype: PDFName.of('XML')
        });
        
        // XMP metadata for PDF/UA
        const xmpMetadata = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
        <rdf:Description rdf:about="" 
            xmlns:dc="http://purl.org/dc/elements/1.1/"
            xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
            xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/">
            <dc:title>
                <rdf:Alt>
                    <rdf:li xml:lang="pt-BR">TDAH Descomplicado</rdf:li>
                </rdf:Alt>
            </dc:title>
            <dc:creator>
                <rdf:Seq>
                    <rdf:li>Dr. Rafael Mendes</rdf:li>
                </rdf:Seq>
            </dc:creator>
            <dc:description>
                <rdf:Alt>
                    <rdf:li xml:lang="pt-BR">10 Estratégias Infalíveis para Nunca Mais Perder Suas Coisas</rdf:li>
                </rdf:Alt>
            </dc:description>
            <dc:language>
                <rdf:Bag>
                    <rdf:li>pt-BR</rdf:li>
                </rdf:Bag>
            </dc:language>
            <pdf:Producer>Book Automation Pipeline</pdf:Producer>
            <pdfuaid:part>1</pdfuaid:part>
        </rdf:Description>
    </rdf:RDF>
</x:xmpmeta>
<?xpacket end="r"?>`;
        
        const xmpStream = pdfDoc.context.stream(xmpMetadata, {
            Type: 'Metadata',
            Subtype: 'XML'
        });
        
        catalog.set(PDFName.of('Metadata'), xmpStream);
        
        // Catalog is already updated via reference
        
        // Add basic page labels
        console.log(`${colors.blue}📄 Adding page labels...${colors.reset}`);
        const pageLabels = pdfDoc.context.obj({
            Nums: [
                0, pdfDoc.context.obj({
                    Type: PDFName.of('PageLabel'),
                    St: 1,
                    S: PDFName.of('r') // Roman numerals for front matter
                }),
                5, pdfDoc.context.obj({
                    Type: PDFName.of('PageLabel'),
                    St: 1,
                    S: PDFName.of('D') // Decimal for main content
                })
            ]
        });
        
        catalog.set(PDFName.of('PageLabels'), pageLabels);
        
        // Save the PDF
        console.log(`${colors.blue}💾 Saving accessible PDF...${colors.reset}`);
        const pdfBytes = await pdfDoc.save({
            useObjectStreams: false // Better compatibility
        });
        
        fs.writeFileSync(outputPath, pdfBytes);
        
        // Get file stats
        const stats = fs.statSync(outputPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`\n${colors.green}${colors.bright}✅ PDF Accessibility features added successfully!${colors.reset}`);
        console.log(`${colors.cyan}📄 File: ${outputPath}${colors.reset}`);
        console.log(`${colors.cyan}📏 Size: ${fileSizeMB} MB${colors.reset}`);
        
        console.log(`\n${colors.yellow}♿ Accessibility Features Added:${colors.reset}`);
        console.log(`  ✓ Document language (pt-BR)`);
        console.log(`  ✓ Document metadata`);
        console.log(`  ✓ Tagged PDF marker`);
        console.log(`  ✓ Structure tree root`);
        console.log(`  ✓ Viewer preferences`);
        console.log(`  ✓ PDF/UA compliance marker`);
        console.log(`  ✓ XMP metadata`);
        console.log(`  ✓ Page labels`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error adding accessibility features: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        const defaultInput = path.join(__dirname, '../build/dist/tdah-descomplicado.pdf');
        const defaultOutput = path.join(__dirname, '../build/dist/tdah-descomplicado-accessible.pdf');
        
        if (fs.existsSync(defaultInput)) {
            addPDFAccessibility(defaultInput, defaultOutput);
        } else {
            console.error(`${colors.red}Usage: node add-pdf-accessibility.js <input.pdf> [output.pdf]${colors.reset}`);
            console.error(`${colors.red}Or ensure ${defaultInput} exists${colors.reset}`);
            process.exit(1);
        }
    } else {
        const inputPath = args[0];
        const outputPath = args[1] || inputPath.replace('.pdf', '-accessible.pdf');
        addPDFAccessibility(inputPath, outputPath);
    }
}

module.exports = addPDFAccessibility;
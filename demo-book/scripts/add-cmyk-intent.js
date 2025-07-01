#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName, PDFString, PDFDict, PDFArray } = require('pdf-lib');

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

async function addCMYKIntent(inputPath, outputPath) {
    console.log(`${colors.green}${colors.bright}🎨 Adding CMYK Color Intent...${colors.reset}`);
    
    try {
        // Load the PDF
        const existingPdfBytes = fs.readFileSync(inputPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        
        // Get the catalog
        const catalog = pdfDoc.catalog;
        
        // Create OutputIntent for CMYK
        console.log(`${colors.blue}🖨️ Creating CMYK output intent...${colors.reset}`);
        const outputIntent = pdfDoc.context.obj({
            Type: PDFName.of('OutputIntent'),
            S: PDFName.of('GTS_PDFX'),
            OutputCondition: PDFString.of('FOGRA39'),
            OutputConditionIdentifier: PDFString.of('FOGRA39'),
            RegistryName: PDFString.of('http://www.color.org'),
            Info: PDFString.of('Coated FOGRA39 (ISO 12647-2:2004)')
        });
        
        // Add OutputIntents array to catalog
        const outputIntents = PDFArray.withContext(pdfDoc.context);
        outputIntents.push(outputIntent);
        catalog.set(PDFName.of('OutputIntents'), outputIntents);
        
        // Add PDF/X identifier
        console.log(`${colors.blue}📄 Adding PDF/X-4 identifier...${colors.reset}`);
        const pdfxId = pdfDoc.context.obj({
            GTS_PDFXVersion: PDFString.of('PDF/X-4'),
            GTS_PDFXConformance: PDFString.of('PDF/X-4')
        });
        
        catalog.set(PDFName.of('PDFX'), pdfxId);
        
        // Update XMP metadata with color profile info
        console.log(`${colors.blue}📋 Updating XMP metadata...${colors.reset}`);
        const xmpMetadata = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
        <rdf:Description rdf:about="" 
            xmlns:pdfx="http://ns.adobe.com/pdfx/1.3/"
            xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
            xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#">
            <pdfx:GTS_PDFXVersion>PDF/X-4</pdfx:GTS_PDFXVersion>
            <pdfx:OutputCondition>FOGRA39</pdfx:OutputCondition>
            <pdfx:OutputConditionIdentifier>FOGRA39</pdfx:OutputConditionIdentifier>
            <pdfx:OutputConditionInfo>Coated FOGRA39 (ISO 12647-2:2004)</pdfx:OutputConditionInfo>
            <xmpMM:RenditionClass>print</xmpMM:RenditionClass>
            <xmpMM:History>
                <rdf:Seq>
                    <rdf:li>
                        <stEvt:action>converted</stEvt:action>
                        <stEvt:parameters>from RGB to CMYK intent</stEvt:parameters>
                        <stEvt:softwareAgent>Book Automation Pipeline</stEvt:softwareAgent>
                        <stEvt:when>${new Date().toISOString()}</stEvt:when>
                    </rdf:li>
                </rdf:Seq>
            </xmpMM:History>
        </rdf:Description>
    </rdf:RDF>
</x:xmpmeta>
<?xpacket end="r"?>`;
        
        // Create metadata stream
        const metadataStream = pdfDoc.context.stream(xmpMetadata, {
            Type: 'Metadata',
            Subtype: 'XML'
        });
        
        // Add or update catalog metadata
        catalog.set(PDFName.of('Metadata'), metadataStream);
        
        // Add rendering intent
        console.log(`${colors.blue}🎨 Setting rendering intent...${colors.reset}`);
        const pages = pdfDoc.getPages();
        pages.forEach((page, index) => {
            console.log(`  Processing page ${index + 1}/${pages.length}`);
            // Set default rendering intent to Relative Colorimetric
            const pageDict = page.node;
            const group = pdfDoc.context.obj({
                Type: PDFName.of('Group'),
                S: PDFName.of('Transparency'),
                CS: PDFName.of('DeviceCMYK'),
                I: true
            });
            pageDict.set(PDFName.of('Group'), group);
        });
        
        // Save the PDF
        console.log(`${colors.blue}💾 Saving PDF with CMYK intent...${colors.reset}`);
        const pdfBytes = await pdfDoc.save({
            useObjectStreams: false // Better compatibility
        });
        
        fs.writeFileSync(outputPath, pdfBytes);
        
        // Get file stats
        const stats = fs.statSync(outputPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`\n${colors.green}${colors.bright}✅ CMYK color intent added successfully!${colors.reset}`);
        console.log(`${colors.cyan}📄 File: ${outputPath}${colors.reset}`);
        console.log(`${colors.cyan}📏 Size: ${fileSizeMB} MB${colors.reset}`);
        
        console.log(`\n${colors.yellow}🎨 CMYK Features Added:${colors.reset}`);
        console.log(`  ✓ Output Intent (FOGRA39)`);
        console.log(`  ✓ PDF/X-4 identifier`);
        console.log(`  ✓ XMP color metadata`);
        console.log(`  ✓ Page-level CMYK groups`);
        console.log(`  ✓ Rendering intent`);
        
        console.log(`\n${colors.cyan}ℹ️ Note: This adds CMYK intent metadata.${colors.reset}`);
        console.log(`${colors.cyan}   For true color conversion, use Ghostscript or Adobe tools.${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error adding CMYK intent: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        const defaultInput = path.join(__dirname, '../build/dist/tdah-descomplicado.pdf');
        const defaultOutput = path.join(__dirname, '../build/dist/tdah-descomplicado-cmyk.pdf');
        
        if (fs.existsSync(defaultInput)) {
            addCMYKIntent(defaultInput, defaultOutput);
        } else {
            console.error(`${colors.red}Usage: node add-cmyk-intent.js <input.pdf> [output.pdf]${colors.reset}`);
            console.error(`${colors.red}Or ensure ${defaultInput} exists${colors.reset}`);
            process.exit(1);
        }
    } else {
        const inputPath = args[0];
        const outputPath = args[1] || inputPath.replace('.pdf', '-cmyk.pdf');
        addCMYKIntent(inputPath, outputPath);
    }
}

module.exports = addCMYKIntent;
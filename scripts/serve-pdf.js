#!/usr/bin/env node

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

// Serve static files including pdfjs
app.use('/dist', express.static(path.join(__dirname, '../build/dist')));
app.use('/pdfjs', express.static(path.join(__dirname, '../build/dist/pdfjs')));

// Main page - redirect to pdf.js viewer
app.get('/', (req, res) => {
    const pdfPath = path.join(__dirname, '../build/dist/tdah-descomplicado-colorful.pdf');
    if (!fs.existsSync(pdfPath)) {
        return res.status(404).send('PDF not found');
    }
    
    // Redirect to pdf.js viewer
    res.redirect('/pdfjs/web/viewer.html?file=/dist/tdah-descomplicado-colorful.pdf');
});

app.listen(PORT, () => {
    console.log(`PDF server running at http://localhost:${PORT}`);
    console.log(`Open this URL in your browser to view the PDF`);
});
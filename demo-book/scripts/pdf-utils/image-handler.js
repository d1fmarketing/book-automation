/**
 * Image Handler Utility
 * Handles image path resolution, format conversion, and base64 encoding
 */

const fs = require('fs-extra');
const path = require('path');

class ImageHandler {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.imageDir = path.join(projectRoot, 'assets', 'images');
    }

    /**
     * Convert cover image to base64
     */
    async getCoverBase64() {
        const coverPath = path.join(this.imageDir, 'cover.jpg');
        
        if (!await fs.pathExists(coverPath)) {
            return null;
        }

        const coverBuffer = await fs.readFile(coverPath);
        // Detect the type of image
        const isPNG = coverBuffer[0] === 0x89 && coverBuffer[1] === 0x50;
        const mimeType = isPNG ? 'image/png' : 'image/jpeg';
        
        return {
            base64: `data:${mimeType};base64,${coverBuffer.toString('base64')}`,
            size: (coverBuffer.length / 1024 / 1024).toFixed(2) // Size in MB
        };
    }

    /**
     * Process image paths in HTML content
     */
    processImagePaths(html, options = {}) {
        const { checkPngToJpg = true, preserveEmojis = false } = options;

        // Handle special emoji preservation for full-page preset
        if (preserveEmojis) {
            html = html
                .replace(/❄️❄️/g, '<span class="emoji">❄️❄️</span>')
                .replace(/📧/g, '<span class="emoji">📧</span>');
        }

        return html.replace(/<img src="([^"]+)"/g, (match, src) => {
            // Skip already processed paths
            if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('file://')) {
                return match;
            }

            let absolutePath = this.resolveImagePath(src);

            // Check if .png was converted to .jpg
            if (checkPngToJpg && absolutePath.endsWith('.png')) {
                const jpgPath = absolutePath.replace(/\.png$/i, '.jpg');
                if (fs.existsSync(jpgPath)) {
                    absolutePath = jpgPath;
                }
            }

            // Generate alt text from filename
            const altText = this.generateAltText(absolutePath);

            return `<img src="file://${absolutePath}" alt="${altText}"`;
        });
    }

    /**
     * Resolve image path to absolute path
     */
    resolveImagePath(src) {
        if (src.startsWith('/')) {
            // Absolute path from project root
            return path.join(this.projectRoot, src.slice(1));
        } else if (src.startsWith('../')) {
            // Relative path from scripts directory
            return path.join(this.projectRoot, 'scripts', src);
        } else if (src.startsWith('assets/')) {
            // Assets path
            return path.join(this.projectRoot, src);
        } else {
            // Default to images directory
            return path.join(this.imageDir, src);
        }
    }

    /**
     * Generate alt text from filename
     */
    generateAltText(filepath) {
        const fileName = path.basename(filepath, path.extname(filepath));
        return fileName
            .replace(/_/g, ' ')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Check if image exists (with PNG to JPG fallback)
     */
    async imageExists(imagePath) {
        if (await fs.pathExists(imagePath)) {
            return imagePath;
        }

        // Try JPG version if PNG doesn't exist
        if (imagePath.endsWith('.png')) {
            const jpgPath = imagePath.replace(/\.png$/i, '.jpg');
            if (await fs.pathExists(jpgPath)) {
                return jpgPath;
            }
        }

        return null;
    }

    /**
     * Convert all images in HTML to base64 (for embedded PDFs)
     */
    async convertImagesToBase64(html) {
        const imgRegex = /<img src="file:\/\/([^"]+)"/g;
        const matches = [...html.matchAll(imgRegex)];

        for (const match of matches) {
            const filePath = match[1];
            if (await fs.pathExists(filePath)) {
                const imageBuffer = await fs.readFile(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
                const base64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
                html = html.replace(match[0], `<img src="${base64}"`);
            }
        }

        return html;
    }
}

module.exports = ImageHandler;
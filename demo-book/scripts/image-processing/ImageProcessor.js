/**
 * ImageProcessor Agent
 * Handles image optimization, conversion, and manipulation
 */

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { spawnAgent } = require('../helpers/agents');
const cache = require('../helpers/cache');

class ImageProcessor {
  constructor(options = {}) {
    this.options = options;
    this.name = 'ImageProcessor';
    this.supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
  }

  /**
   * Main execution method
   */
  async execute(input) {
    console.log(`🖼️  ${this.name} starting...`);
    
    // Parse input
    const { 
      action = 'optimize',
      source,
      target,
      options = {}
    } = typeof input === 'string' ? { source: input } : input;
    
    switch (action) {
      case 'optimize':
        return await this.optimizeImage(source, target, options);
      
      case 'resize':
        return await this.resizeImage(source, target, options);
      
      case 'convert':
        return await this.convertImage(source, target, options);
      
      case 'batch':
        return await this.batchProcess(source, options);
      
      case 'cover':
        return await this.generateBookCover(options);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Optimize image for web/print
   */
  async optimizeImage(source, target, options = {}) {
    const {
      quality = 85,
      format = null,
      maxWidth = 1600,
      maxHeight = null
    } = options;

    // Check cache
    const cacheKey = `optimize:${source}:${JSON.stringify(options)}`;
    const cached = await cache.get('image-processing', cacheKey);
    if (cached && !options.force) {
      return cached;
    }

    try {
      const image = sharp(source);
      const metadata = await image.metadata();
      
      // Resize if needed
      if (metadata.width > maxWidth) {
        image.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      // Set format and quality
      const outputFormat = format || metadata.format;
      if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
        image.jpeg({ quality, progressive: true });
      } else if (outputFormat === 'png') {
        image.png({ quality, compressionLevel: 9 });
      } else if (outputFormat === 'webp') {
        image.webp({ quality });
      }
      
      // Save optimized image
      const outputPath = target || source.replace(/\.[^.]+$/, `-optimized.${outputFormat}`);
      await image.toFile(outputPath);
      
      // Get file sizes
      const originalSize = (await fs.stat(source)).size;
      const optimizedSize = (await fs.stat(outputPath)).size;
      const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
      
      const result = {
        success: true,
        source,
        output: outputPath,
        originalSize,
        optimizedSize,
        reduction: `${reduction}%`,
        format: outputFormat,
        dimensions: {
          width: metadata.width,
          height: metadata.height
        }
      };
      
      // Cache result
      await cache.set('image-processing', [cacheKey], result, 3600);
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        source
      };
    }
  }

  /**
   * Resize image with specific dimensions
   */
  async resizeImage(source, target, options = {}) {
    const {
      width,
      height,
      fit = 'cover',
      position = 'center'
    } = options;

    if (!width && !height) {
      throw new Error('Width or height must be specified');
    }

    try {
      const outputPath = target || source.replace(/\.[^.]+$/, `-${width}x${height}.$1`);
      
      await sharp(source)
        .resize(width, height, { fit, position })
        .toFile(outputPath);
      
      return {
        success: true,
        source,
        output: outputPath,
        dimensions: { width, height }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        source
      };
    }
  }

  /**
   * Convert image format
   */
  async convertImage(source, target, options = {}) {
    const { format = 'webp', quality = 85 } = options;
    
    try {
      const outputPath = target || source.replace(/\.[^.]+$/, `.${format}`);
      const image = sharp(source);
      
      // Apply format-specific options
      switch (format) {
        case 'jpeg':
        case 'jpg':
          image.jpeg({ quality, progressive: true });
          break;
        case 'png':
          image.png({ quality, compressionLevel: 9 });
          break;
        case 'webp':
          image.webp({ quality });
          break;
        case 'avif':
          image.avif({ quality });
          break;
      }
      
      await image.toFile(outputPath);
      
      return {
        success: true,
        source,
        output: outputPath,
        format
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        source
      };
    }
  }

  /**
   * Batch process multiple images
   */
  async batchProcess(pattern, options = {}) {
    const glob = require('glob');
    const files = glob.sync(pattern);
    
    console.log(`📁 Processing ${files.length} images...`);
    
    const results = await cache.batchProcess(
      files,
      async (file) => {
        return await this.optimizeImage(file, null, options);
      },
      {
        namespace: 'batch-images',
        concurrency: options.concurrency || 5,
        onProgress: (completed, total) => {
          console.log(`Progress: ${completed}/${total}`);
        }
      }
    );
    
    const successful = results.filter(r => r.success).length;
    const totalReduction = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.originalSize - r.optimizedSize), 0);
    
    return {
      success: true,
      processed: files.length,
      successful,
      failed: files.length - successful,
      totalReduction: `${(totalReduction / 1024 / 1024).toFixed(2)} MB`,
      results
    };
  }

  /**
   * Generate book cover from template
   */
  async generateBookCover(options = {}) {
    const {
      title = 'Untitled',
      author = 'Unknown Author',
      width = 1600,
      height = 2400,
      backgroundColor = '#1a1a1a',
      textColor = '#ffffff',
      template = 'default'
    } = options;

    try {
      // Create SVG template
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
          <text x="${width/2}" y="${height/3}" 
                text-anchor="middle" 
                font-family="Arial, sans-serif" 
                font-size="${width/20}" 
                fill="${textColor}" 
                font-weight="bold">
            ${title}
          </text>
          <text x="${width/2}" y="${height/2}" 
                text-anchor="middle" 
                font-family="Arial, sans-serif" 
                font-size="${width/30}" 
                fill="${textColor}">
            ${author}
          </text>
        </svg>
      `;

      const outputPath = path.join('assets/images', 'generated-cover.png');
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
      
      return {
        success: true,
        output: outputPath,
        dimensions: { width, height },
        title,
        author
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ImageProcessor;
#!/usr/bin/env node

/**
 * Image Processor CLI
 * Wrapper for ImageProcessor agent
 */

const ImageProcessor = require('../agents/ImageProcessor');
const path = require('path');

// ANSI colors
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

// Show help
function showHelp() {
  console.log(`
${colors.blue('🖼️  Image Processor')}

Usage: image <command> [options]

Commands:
  optimize <file>      Optimize image for web/print
  resize <file>        Resize image to specific dimensions
  convert <file>       Convert image format
  batch <pattern>      Process multiple images
  cover                Generate book cover

Options:
  --width <n>         Target width
  --height <n>        Target height
  --quality <n>       JPEG quality (1-100)
  --format <fmt>      Output format (jpg, png, webp)
  --output <file>     Output filename
  --force             Force regeneration (skip cache)

Examples:
  image optimize cover.jpg --quality 85
  image resize photo.png --width 800 --height 600
  image convert image.png --format webp
  image batch "assets/images/*.jpg" --quality 80
  image cover --title "My Book" --author "John Doe"
`);
}

// Parse command line arguments
function parseArgs(args) {
  const options = {
    command: args[0],
    file: args[1],
    width: null,
    height: null,
    quality: 85,
    format: null,
    output: null,
    force: false,
    title: null,
    author: null
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--width':
        options.width = parseInt(args[++i]);
        break;
      case '--height':
        options.height = parseInt(args[++i]);
        break;
      case '--quality':
        options.quality = parseInt(args[++i]);
        break;
      case '--format':
        options.format = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--force':
        options.force = true;
        break;
      case '--title':
        options.title = args[++i];
        break;
      case '--author':
        options.author = args[++i];
        break;
    }
  }

  return options;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }
  
  const options = parseArgs(args);
  const processor = new ImageProcessor();
  
  try {
    let result;
    
    switch (options.command) {
      case 'optimize':
        if (!options.file) {
          console.error(colors.red('Error: No file specified'));
          process.exit(1);
        }
        result = await processor.execute({
          action: 'optimize',
          source: options.file,
          target: options.output,
          options: {
            quality: options.quality,
            format: options.format,
            force: options.force
          }
        });
        break;
        
      case 'resize':
        if (!options.file) {
          console.error(colors.red('Error: No file specified'));
          process.exit(1);
        }
        if (!options.width && !options.height) {
          console.error(colors.red('Error: Width or height must be specified'));
          process.exit(1);
        }
        result = await processor.execute({
          action: 'resize',
          source: options.file,
          target: options.output,
          options: {
            width: options.width,
            height: options.height
          }
        });
        break;
        
      case 'convert':
        if (!options.file) {
          console.error(colors.red('Error: No file specified'));
          process.exit(1);
        }
        if (!options.format) {
          console.error(colors.red('Error: Output format must be specified'));
          process.exit(1);
        }
        result = await processor.execute({
          action: 'convert',
          source: options.file,
          target: options.output,
          options: {
            format: options.format,
            quality: options.quality
          }
        });
        break;
        
      case 'batch':
        if (!options.file) {
          console.error(colors.red('Error: No pattern specified'));
          process.exit(1);
        }
        result = await processor.execute({
          action: 'batch',
          source: options.file,
          options: {
            quality: options.quality,
            format: options.format,
            force: options.force
          }
        });
        break;
        
      case 'cover':
        result = await processor.execute({
          action: 'cover',
          options: {
            title: options.title || 'Untitled',
            author: options.author || 'Unknown Author'
          }
        });
        break;
        
      default:
        console.error(colors.red(`Unknown command: ${options.command}`));
        showHelp();
        process.exit(1);
    }
    
    // Display results
    if (result.success) {
      console.log(colors.green('\n✅ Success!'));
      
      if (result.output) {
        console.log(`Output: ${result.output}`);
      }
      
      if (result.reduction) {
        console.log(`Size reduction: ${result.reduction}`);
      }
      
      if (result.processed) {
        console.log(`Processed: ${result.processed} files`);
        console.log(`Successful: ${result.successful}`);
        console.log(`Failed: ${result.failed}`);
        console.log(`Total reduction: ${result.totalReduction}`);
      }
    } else {
      console.error(colors.red(`\n❌ Failed: ${result.error}`));
      process.exit(1);
    }
  } catch (error) {
    console.error(colors.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main();
}
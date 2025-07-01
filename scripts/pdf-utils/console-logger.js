/**
 * Console Logger Utility
 * Provides colored console output for PDF generation
 */

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
};

class ConsoleLogger {
    constructor(verbose = true) {
        this.verbose = verbose;
    }

    success(message) {
        if (this.verbose) {
            console.log(`${colors.green}${colors.bright}✅ ${message}${colors.reset}`);
        }
    }

    info(message) {
        if (this.verbose) {
            console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
        }
    }

    warning(message) {
        if (this.verbose) {
            console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
        }
    }

    error(message) {
        console.error(`${colors.red}${colors.bright}❌ ${message}${colors.reset}`);
    }

    debug(message) {
        if (process.env.DEBUG) {
            console.log(`${colors.cyan}🔍 Debug: ${message}${colors.reset}`);
        }
    }

    startProcess(message) {
        if (this.verbose) {
            console.log(`${colors.green}${colors.bright}🚀 ${message}${colors.reset}`);
        }
    }

    step(message) {
        if (this.verbose) {
            console.log(`${colors.blue}📖 ${message}${colors.reset}`);
        }
    }

    feature(message) {
        if (this.verbose) {
            console.log(`  ✓ ${message}`);
        }
    }

    raw(message) {
        console.log(message);
    }
}

// Create a simple spinner replacement
class SimpleSpinner {
    constructor(text) {
        this.text = text;
        console.log(`⏳ ${text}`);
    }

    start() {
        return this;
    }

    stop() {
        return this;
    }

    succeed(text) {
        console.log(`✅ ${text || this.text}`);
        return this;
    }

    fail(text) {
        console.log(`❌ ${text || this.text}`);
        return this;
    }

    text(newText) {
        this.text = newText;
        console.log(`⏳ ${newText}`);
    }
}

module.exports = {
    ConsoleLogger,
    SimpleSpinner,
    colors
};
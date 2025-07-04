/**
 * GitHub Webhook Handler
 * 
 * Handles GitHub PR events for automated publishing
 */

const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs').promises;

class WebhookHandler {
    constructor(options = {}) {
        this.options = {
            secret: process.env.GITHUB_WEBHOOK_SECRET,
            port: process.env.WEBHOOK_PORT || 3000,
            publishScript: path.join(__dirname, '../../scripts/publish-book.js'),
            ...options
        };
        
        this.app = express();
        this.setupRoutes();
    }

    setupRoutes() {
        // Raw body parser for signature verification
        this.app.use(express.raw({ type: 'application/json' }));
        
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });
        
        // Webhook endpoint
        this.app.post('/webhook/github', async (req, res) => {
            try {
                // Verify signature
                if (!this.verifySignature(req)) {
                    return res.status(401).json({ error: 'Invalid signature' });
                }
                
                // Parse payload
                const payload = JSON.parse(req.body);
                
                // Handle event
                const result = await this.handleEvent(payload);
                
                res.json({ success: true, result });
                
            } catch (error) {
                console.error('Webhook error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Review status endpoint
        this.app.get('/review/:reviewId', async (req, res) => {
            try {
                const status = await this.getReviewStatus(req.params.reviewId);
                res.json(status);
            } catch (error) {
                res.status(404).json({ error: 'Review not found' });
            }
        });
    }

    verifySignature(req) {
        if (!this.options.secret) {
            // No secret configured, skip verification
            return true;
        }
        
        const signature = req.headers['x-hub-signature-256'];
        if (!signature) {
            return false;
        }
        
        const hash = crypto
            .createHmac('sha256', this.options.secret)
            .update(req.body)
            .digest('hex');
        
        const expected = `sha256=${hash}`;
        
        // Constant time comparison
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );
    }

    async handleEvent(payload) {
        const { action, pull_request } = payload;
        
        console.log(`🔄 Webhook received: ${action} on PR #${pull_request?.number}`);
        
        // Handle PR merged
        if (action === 'closed' && pull_request?.merged) {
            return await this.handlePRMerged(pull_request);
        }
        
        // Handle PR approved
        if (action === 'submitted' && payload.review?.state === 'approved') {
            return await this.handlePRApproved(pull_request);
        }
        
        // Handle PR comment
        if (action === 'created' && payload.comment) {
            return await this.handleComment(pull_request, payload.comment);
        }
        
        return { action: 'ignored', reason: 'Not a relevant event' };
    }

    async handlePRMerged(pullRequest) {
        console.log('✅ PR merged, triggering publishing...');
        
        // Extract book information from PR
        const bookInfo = await this.extractBookInfo(pullRequest);
        if (!bookInfo) {
            return { action: 'skipped', reason: 'Not a book review PR' };
        }
        
        // Trigger publishing
        try {
            await this.publishBook(bookInfo);
            
            // Comment on PR
            await this.commentOnPR(
                pullRequest.number,
                '🎉 Book has been successfully published!\n\n' +
                '🔗 View on platforms:\n' +
                '- Amazon KDP: [Coming soon]\n' +
                '- Apple Books: [Coming soon]\n' +
                '- Google Play: [Coming soon]\n\n' +
                '📊 Analytics dashboard: [View](https://your-domain.com/analytics)'
            );
            
            return {
                action: 'published',
                bookId: bookInfo.topicSlug,
                topic: bookInfo.topic
            };
            
        } catch (error) {
            // Comment error on PR
            await this.commentOnPR(
                pullRequest.number,
                '❌ Publishing failed:\n```\n' + error.message + '\n```\n\n' +
                'Please check the logs and try manual publishing.'
            );
            
            throw error;
        }
    }

    async handlePRApproved(pullRequest) {
        console.log('✅ PR approved');
        
        // Check if auto-merge is enabled
        const bookInfo = await this.extractBookInfo(pullRequest);
        if (bookInfo?.autoMerge) {
            // Auto-merge is already enabled by the review creator
            return { action: 'waiting_for_merge' };
        }
        
        return { action: 'approved' };
    }

    async handleComment(pullRequest, comment) {
        const body = comment.body.toLowerCase();
        
        // Handle commands in comments
        if (body.includes('/publish')) {
            return await this.handlePublishCommand(pullRequest);
        }
        
        if (body.includes('/preview')) {
            return await this.handlePreviewCommand(pullRequest);
        }
        
        if (body.includes('/stats')) {
            return await this.handleStatsCommand(pullRequest);
        }
        
        return { action: 'no_command' };
    }

    async extractBookInfo(pullRequest) {
        // Check if this is a book review PR
        const labels = pullRequest.labels.map(l => l.name);
        if (!labels.includes('book-review')) {
            return null;
        }
        
        // Extract from PR body
        try {
            const bodyLines = pullRequest.body.split('\n');
            const topicLine = bodyLines.find(line => line.startsWith('**Topic:**'));
            const topic = topicLine?.match(/\*\*Topic:\*\* (.+)/)?.[1] || 'Unknown';
            
            // Extract book directory from branch name
            const match = pullRequest.head.ref.match(/review\/(.+?)-\d+$/);
            const topicSlug = match?.[1] || 'unknown';
            
            return {
                topic,
                topicSlug,
                prNumber: pullRequest.number,
                branch: pullRequest.head.ref,
                merged: pullRequest.merged,
                autoMerge: pullRequest.auto_merge !== null
            };
            
        } catch (error) {
            console.error('Failed to extract book info:', error);
            return null;
        }
    }

    async publishBook(bookInfo) {
        console.log(`🚀 Publishing book: ${bookInfo.topic}`);
        
        const bookDir = path.join('build/ebooks', bookInfo.topicSlug);
        
        // Run publish script
        const command = `node ${this.options.publishScript} --dir "${bookDir}" --all`;
        const { stdout, stderr } = await execAsync(command, {
            env: {
                ...process.env,
                BOOK_TOPIC: bookInfo.topic,
                BOOK_DIR: bookDir
            }
        });
        
        if (stderr) {
            console.error('Publish stderr:', stderr);
        }
        
        console.log('Publish output:', stdout);
        
        // Record publication
        await this.recordPublication(bookInfo);
    }

    async recordPublication(bookInfo) {
        const publicationRecord = {
            topic: bookInfo.topic,
            topicSlug: bookInfo.topicSlug,
            publishedAt: new Date().toISOString(),
            prNumber: bookInfo.prNumber,
            platforms: ['kdp', 'apple', 'google'],
            status: 'published'
        };
        
        const recordPath = path.join('build/publications', `${bookInfo.topicSlug}.json`);
        await fs.mkdir(path.dirname(recordPath), { recursive: true });
        await fs.writeFile(recordPath, JSON.stringify(publicationRecord, null, 2));
    }

    async commentOnPR(prNumber, comment) {
        try {
            const command = `gh pr comment ${prNumber} --body "${comment.replace(/"/g, '\\"')}"`;
            await execAsync(command);
        } catch (error) {
            console.error('Failed to comment on PR:', error);
        }
    }

    async handlePublishCommand(pullRequest) {
        const bookInfo = await this.extractBookInfo(pullRequest);
        if (!bookInfo) {
            return { action: 'error', message: 'Not a book review PR' };
        }
        
        await this.publishBook(bookInfo);
        return { action: 'published_via_command' };
    }

    async handlePreviewCommand(pullRequest) {
        const bookInfo = await this.extractBookInfo(pullRequest);
        if (!bookInfo) {
            return { action: 'error', message: 'Not a book review PR' };
        }
        
        // Generate preview link
        const previewUrl = `https://your-domain.com/preview/${bookInfo.topicSlug}`;
        
        await this.commentOnPR(
            pullRequest.number,
            `🔍 **Preview Available**\n\n` +
            `View the book preview: [${previewUrl}](${previewUrl})\n\n` +
            `This preview will be available for 24 hours.`
        );
        
        return { action: 'preview_generated', url: previewUrl };
    }

    async handleStatsCommand(pullRequest) {
        const bookInfo = await this.extractBookInfo(pullRequest);
        if (!bookInfo) {
            return { action: 'error', message: 'Not a book review PR' };
        }
        
        // Get book statistics
        const bookDir = path.join('build/ebooks', bookInfo.topicSlug);
        const stats = await this.getBookStats(bookDir);
        
        await this.commentOnPR(
            pullRequest.number,
            `📊 **Book Statistics**\n\n` +
            `- **Chapters:** ${stats.chapters}\n` +
            `- **Total Words:** ${stats.totalWords.toLocaleString()}\n` +
            `- **Images:** ${stats.images}\n` +
            `- **Estimated Pages:** ${Math.round(stats.totalWords / 250)}\n` +
            `- **Reading Time:** ${Math.round(stats.totalWords / 200)} minutes`
        );
        
        return { action: 'stats_posted' };
    }

    async getBookStats(bookDir) {
        // Reuse stats logic from HumanReview
        const { getHumanReview } = require('./HumanReview');
        const review = getHumanReview();
        return await review.getBookStats(bookDir);
    }

    async getReviewStatus(reviewId) {
        // Look for review record
        const reviewPath = path.join('build/reviews', `${reviewId}.json`);
        
        try {
            const content = await fs.readFile(reviewPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error('Review not found');
        }
    }

    start() {
        this.server = this.app.listen(this.options.port, () => {
            console.log(`🌐 Webhook server listening on port ${this.options.port}`);
            console.log(`🔗 Webhook URL: https://your-domain.com/webhook/github`);
            console.log('\n🔌 Ready to receive GitHub webhooks');
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            console.log('🚫 Webhook server stopped');
        }
    }
}

// CLI usage
if (require.main === module) {
    const handler = new WebhookHandler();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🚫 Shutting down...');
        handler.stop();
        process.exit(0);
    });
    
    handler.start();
}

module.exports = WebhookHandler;
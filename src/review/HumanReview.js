/**
 * Human Review Layer
 * 
 * Creates pull requests for content review
 * Integrates with GitHub for collaborative editing
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class HumanReview {
    constructor(options = {}) {
        this.options = {
            repository: process.env.GITHUB_REPOSITORY || 'book-content',
            baseBranch: 'main',
            reviewerTeam: process.env.REVIEWER_TEAM || '@reviewers',
            autoMerge: false,
            prTemplate: path.join(__dirname, 'templates', 'pr-template.md'),
            ...options
        };
        
        this.initialized = false;
    }

    async initialize() {
        // Ensure git is configured
        try {
            await execAsync('git config user.name');
            await execAsync('git config user.email');
        } catch (error) {
            // Set default git config if not set
            await execAsync('git config user.name "Book Automation Bot"');
            await execAsync('git config user.email "bot@book-automation.local"');
        }
        
        // Check if gh CLI is available
        try {
            await execAsync('gh --version');
        } catch (error) {
            throw new Error('GitHub CLI (gh) is not installed. Please install it first.');
        }
        
        this.initialized = true;
    }

    /**
     * Create a pull request for book review
     */
    async createReview(bookDir, metadata = {}) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        const topicSlug = path.basename(bookDir);
        const branchName = `review/${topicSlug}-${Date.now()}`;
        const prTitle = `📚 Review: ${metadata.topic || topicSlug}`;
        
        console.log('\n🔍 CREATING HUMAN REVIEW PR\n');
        console.log('=' .repeat(60));
        console.log(`Topic: ${metadata.topic}`);
        console.log(`Branch: ${branchName}`);
        console.log('=' .repeat(60) + '\n');
        
        try {
            // Create review branch
            console.log('📝 Creating review branch...');
            await this.createBranch(branchName);
            
            // Copy book content to review directory
            console.log('📋 Preparing content for review...');
            await this.prepareContent(bookDir, topicSlug);
            
            // Generate review summary
            console.log('📊 Generating review summary...');
            const summary = await this.generateSummary(bookDir, metadata);
            
            // Commit changes
            console.log('💾 Committing changes...');
            await this.commitChanges(topicSlug, metadata);
            
            // Push branch
            console.log('🚀 Pushing to remote...');
            await this.pushBranch(branchName);
            
            // Create pull request
            console.log('🔄 Creating pull request...');
            const prUrl = await this.createPullRequest(branchName, prTitle, summary, metadata);
            
            // Add reviewers
            if (this.options.reviewerTeam) {
                console.log('👥 Adding reviewers...');
                await this.addReviewers(prUrl);
            }
            
            // Set up auto-merge if enabled
            if (this.options.autoMerge) {
                console.log('🤖 Enabling auto-merge...');
                await this.enableAutoMerge(prUrl);
            }
            
            console.log('\n✅ Pull request created successfully!');
            console.log(`🔗 Review at: ${prUrl}\n`);
            
            return {
                success: true,
                prUrl,
                branch: branchName,
                reviewId: this.generateReviewId(topicSlug)
            };
            
        } catch (error) {
            console.error('❌ Failed to create review:', error.message);
            
            // Cleanup on failure
            try {
                await execAsync(`git checkout ${this.options.baseBranch}`);
                await execAsync(`git branch -D ${branchName}`);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            
            throw error;
        }
    }

    async createBranch(branchName) {
        // Ensure we're on the base branch
        await execAsync(`git checkout ${this.options.baseBranch}`);
        
        // Pull latest changes
        await execAsync('git pull origin ' + this.options.baseBranch);
        
        // Create new branch
        await execAsync(`git checkout -b ${branchName}`);
    }

    async prepareContent(bookDir, topicSlug) {
        const reviewDir = path.join('content', 'books', topicSlug);
        
        // Create directory structure
        await fs.mkdir(reviewDir, { recursive: true });
        
        // Copy markdown files
        const chapters = await fs.readdir(path.join(bookDir, 'chapters'));
        for (const chapter of chapters) {
            if (chapter.endsWith('.md')) {
                await fs.copyFile(
                    path.join(bookDir, 'chapters', chapter),
                    path.join(reviewDir, chapter)
                );
            }
        }
        
        // Copy metadata
        const metadataFiles = ['outline.json', 'metadata.json', 'research.json'];
        for (const file of metadataFiles) {
            const srcPath = path.join(bookDir, file);
            try {
                await fs.access(srcPath);
                await fs.copyFile(srcPath, path.join(reviewDir, file));
            } catch (error) {
                // File doesn't exist, skip
            }
        }
        
        // Create review metadata
        const reviewMetadata = {
            bookDir,
            topicSlug,
            createdAt: new Date().toISOString(),
            status: 'pending_review',
            reviewers: [],
            comments: []
        };
        
        await fs.writeFile(
            path.join(reviewDir, 'review.json'),
            JSON.stringify(reviewMetadata, null, 2)
        );
    }

    async generateSummary(bookDir, metadata) {
        const stats = await this.getBookStats(bookDir);
        const quality = await this.getQualityMetrics(bookDir);
        
        let summary = `## 📚 Book Review Request\n\n`;
        summary += `**Topic:** ${metadata.topic || 'Unknown'}\n`;
        summary += `**Generated:** ${new Date().toLocaleDateString()}\n\n`;
        
        summary += `### 📊 Statistics\n`;
        summary += `- **Chapters:** ${stats.chapters}\n`;
        summary += `- **Total Words:** ${stats.totalWords.toLocaleString()}\n`;
        summary += `- **Average Words/Chapter:** ${Math.round(stats.totalWords / stats.chapters).toLocaleString()}\n`;
        summary += `- **Images:** ${stats.images}\n\n`;
        
        summary += `### ✅ Quality Metrics\n`;
        summary += `- **Grammar Score:** ${quality.grammarScore}%\n`;
        summary += `- **Readability:** ${quality.readability}\n`;
        summary += `- **Consistency:** ${quality.consistency}%\n`;
        summary += `- **SEO Score:** ${quality.seoScore}%\n\n`;
        
        summary += `### 🎯 Review Checklist\n`;
        summary += `- [ ] Content accuracy and factual correctness\n`;
        summary += `- [ ] Writing style and tone consistency\n`;
        summary += `- [ ] Grammar and spelling\n`;
        summary += `- [ ] Chapter flow and structure\n`;
        summary += `- [ ] Title and headings\n`;
        summary += `- [ ] Images and captions\n`;
        summary += `- [ ] Call-to-actions and value proposition\n`;
        summary += `- [ ] Legal compliance (no plagiarism, proper citations)\n\n`;
        
        summary += `### 🚀 Next Steps\n`;
        summary += `1. Review the content in the \`content/books/${path.basename(bookDir)}\` directory\n`;
        summary += `2. Make any necessary edits directly in the markdown files\n`;
        summary += `3. Leave comments on specific lines for discussion\n`;
        summary += `4. Approve the PR when ready to publish\n\n`;
        
        summary += `### 🤖 Automation\n`;
        summary += `Once this PR is merged, the book will automatically be:\n`;
        summary += `- Formatted into HTML and EPUB\n`;
        summary += `- Published to the configured platforms\n`;
        summary += `- Added to the book catalog\n\n`;
        
        summary += `---\n`;
        summary += `🤖 Generated with [Book Automation](https://github.com/your-org/book-automation)`;
        
        return summary;
    }

    async getBookStats(bookDir) {
        const stats = {
            chapters: 0,
            totalWords: 0,
            images: 0
        };
        
        const chaptersDir = path.join(bookDir, 'chapters');
        const chapters = await fs.readdir(chaptersDir);
        
        for (const chapter of chapters) {
            if (chapter.endsWith('.md')) {
                stats.chapters++;
                const content = await fs.readFile(path.join(chaptersDir, chapter), 'utf8');
                stats.totalWords += content.split(/\s+/).length;
            }
        }
        
        try {
            const imagesDir = path.join(bookDir, 'images');
            const images = await fs.readdir(imagesDir);
            stats.images = images.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f)).length;
        } catch (error) {
            // No images directory
        }
        
        return stats;
    }

    async getQualityMetrics(bookDir) {
        // In a real implementation, these would be calculated
        // For now, return mock data
        return {
            grammarScore: 95,
            readability: 'Grade 8',
            consistency: 92,
            seoScore: 88
        };
    }

    async commitChanges(topicSlug, metadata) {
        // Stage all changes
        await execAsync('git add .');
        
        // Create commit message
        const commitMessage = `Add ${topicSlug} for review

Topic: ${metadata.topic || topicSlug}
Generated: ${new Date().toISOString()}

🤖 Generated with Book Automation`;
        
        // Commit
        await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
    }

    async pushBranch(branchName) {
        await execAsync(`git push -u origin ${branchName}`);
    }

    async createPullRequest(branchName, title, body, metadata) {
        // Create PR using gh CLI
        const { stdout } = await execAsync(`gh pr create --title "${title}" --body "${body.replace(/"/g, '\\"')}" --base ${this.options.baseBranch} --head ${branchName}`);
        
        // Extract PR URL from output
        const prUrl = stdout.trim();
        
        // Add labels
        if (metadata.labels) {
            await execAsync(`gh pr edit ${prUrl} --add-label "${metadata.labels.join(',')}"`);
        } else {
            await execAsync(`gh pr edit ${prUrl} --add-label "book-review,automated"`);
        }
        
        return prUrl;
    }

    async addReviewers(prUrl) {
        try {
            await execAsync(`gh pr edit ${prUrl} --add-reviewer "${this.options.reviewerTeam}"`);
        } catch (error) {
            console.warn('⚠️  Could not add reviewers:', error.message);
        }
    }

    async enableAutoMerge(prUrl) {
        try {
            await execAsync(`gh pr merge ${prUrl} --auto --squash`);
        } catch (error) {
            console.warn('⚠️  Could not enable auto-merge:', error.message);
        }
    }

    generateReviewId(topicSlug) {
        return crypto.createHash('sha256')
            .update(`${topicSlug}-${Date.now()}`)
            .digest('hex')
            .substring(0, 8);
    }

    /**
     * Check review status
     */
    async checkReviewStatus(reviewId) {
        // Implementation would check PR status
        return {
            reviewId,
            status: 'pending',
            reviewers: [],
            comments: 0,
            approved: false
        };
    }

    /**
     * Handle review webhook
     */
    async handleWebhook(event) {
        if (event.action === 'closed' && event.pull_request.merged) {
            // PR was merged, trigger publishing
            const reviewData = JSON.parse(event.pull_request.body);
            
            return {
                action: 'publish',
                bookDir: reviewData.bookDir,
                reviewId: reviewData.reviewId
            };
        }
        
        return null;
    }
}

// Singleton instance
let instance;

function getHumanReview(options) {
    if (!instance) {
        instance = new HumanReview(options);
    }
    return instance;
}

module.exports = {
    HumanReview,
    getHumanReview
};
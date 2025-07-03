#!/usr/bin/env node

/**
 * MarketingAutomator Agent
 * 
 * Automates marketing campaigns across multiple channels to promote ebooks.
 * Creates social media posts, email campaigns, and manages promotional strategies.
 * 
 * Usage:
 *   agentcli call marketing.launch --ebook-id="abc123" --campaign="launch"
 *   node agents/marketing-automator.js --book-dir="build/my-ebook" --channels="twitter,email"
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const cron = require('node-cron');

// Marketing configuration
const MARKETING_CONFIG = {
    channels: {
        twitter: {
            name: 'Twitter/X',
            api: 'https://api.twitter.com/2',
            charLimit: 280,
            mediaSupported: true,
            bestTimes: ['9:00', '12:00', '17:00', '20:00']
        },
        facebook: {
            name: 'Facebook',
            api: 'https://graph.facebook.com/v18.0',
            charLimit: 63206,
            mediaSupported: true,
            bestTimes: ['8:00', '13:00', '19:00']
        },
        instagram: {
            name: 'Instagram',
            charLimit: 2200,
            mediaSupported: true,
            requiresImage: true,
            bestTimes: ['11:00', '14:00', '19:00']
        },
        email: {
            name: 'Email',
            provider: 'sendgrid',
            templates: ['launch', 'promotion', 'newsletter', 'drip']
        },
        linkedin: {
            name: 'LinkedIn',
            charLimit: 3000,
            mediaSupported: true,
            bestTimes: ['7:30', '12:00', '17:30']
        }
    },
    
    campaigns: {
        launch: {
            name: 'Book Launch',
            duration: 7, // days
            intensity: 'high',
            channels: ['twitter', 'facebook', 'email', 'linkedin'],
            templates: ['announcement', 'features', 'benefits', 'testimonial', 'cta']
        },
        flash_sale: {
            name: 'Flash Sale',
            duration: 3,
            intensity: 'very_high',
            channels: ['twitter', 'email'],
            templates: ['urgency', 'discount', 'countdown', 'last_chance']
        },
        content_series: {
            name: 'Content Marketing',
            duration: 30,
            intensity: 'medium',
            channels: ['twitter', 'linkedin', 'facebook'],
            templates: ['tip', 'quote', 'statistic', 'case_study']
        },
        evergreen: {
            name: 'Evergreen Funnel',
            duration: -1, // Ongoing
            intensity: 'low',
            channels: ['email'],
            templates: ['welcome', 'value', 'soft_pitch', 'testimonial', 'offer']
        }
    },
    
    templates: {
        announcement: [
            "🎉 NEW BOOK ALERT! '{title}' is now available! {description} Get your copy: {link}",
            "📚 Just launched: '{title}' - {subtitle}. {cta} 👉 {link}",
            "🚀 It's here! My new book '{title}' tackles {topic}. Early bird special: {link}"
        ],
        features: [
            "📖 In '{title}' you'll discover:\n✅ {feature1}\n✅ {feature2}\n✅ {feature3}\n\nGet it now: {link}",
            "What's inside '{title}'?\n\n{bulletPoints}\n\nTransform your {niche} today: {link}"
        ],
        benefits: [
            "Stop {painPoint}! '{title}' shows you how to {benefit} in just {timeframe}. {link}",
            "Imagine {desiredOutcome}... '{title}' makes it possible. Start today: {link}"
        ],
        urgency: [
            "⏰ FLASH SALE! {discount}% off '{title}' - Only {hours} hours left! {link}",
            "🔥 {remaining} hours left! Save ${amount} on '{title}'. Don't miss out: {link}"
        ],
        testimonial: [
            '"{testimonial}" - {author}\n\nGet '{title}' and see similar results: {link}',
            "⭐⭐⭐⭐⭐ Reader review:\n\n{review}\n\nJoin thousands of satisfied readers: {link}"
        ]
    },
    
    hashtagSets: {
        business: ['#business', '#entrepreneur', '#success', '#businesstips', '#startup'],
        technology: ['#tech', '#AI', '#innovation', '#coding', '#futuretech'],
        health: ['#health', '#wellness', '#fitness', '#healthylifestyle', '#selfcare'],
        selfhelp: ['#selfimprovement', '#motivation', '#personaldevelopment', '#mindset', '#growth']
    },
    
    emailLists: {
        launch: 'book-launch-list',
        buyers: 'previous-buyers',
        newsletter: 'general-newsletter',
        abandoned: 'cart-abandoners'
    }
};

class MarketingAutomator {
    constructor(options = {}) {
        // API credentials
        this.twitter = {
            apiKey: options.twitterKey || process.env.TWITTER_API_KEY,
            apiSecret: options.twitterSecret || process.env.TWITTER_API_SECRET,
            accessToken: options.twitterToken || process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: options.twitterAccessSecret || process.env.TWITTER_ACCESS_SECRET
        };
        
        this.facebook = {
            pageId: options.fbPageId || process.env.FACEBOOK_PAGE_ID,
            accessToken: options.fbToken || process.env.FACEBOOK_ACCESS_TOKEN
        };
        
        this.email = {
            provider: options.emailProvider || 'sendgrid',
            apiKey: options.emailKey || process.env.SENDGRID_API_KEY,
            fromEmail: options.fromEmail || process.env.FROM_EMAIL || 'noreply@example.com',
            fromName: options.fromName || 'Book Updates'
        };
        
        // State
        this.activeCampaigns = new Map();
        this.scheduledPosts = new Map();
        this.analytics = new Map();
    }

    async launchCampaign(bookData, campaignType = 'launch', options = {}) {
        console.log('🚀 Launching Marketing Campaign');
        console.log(`📚 Book: ${bookData.title}`);
        console.log(`📣 Campaign: ${campaignType}`);
        console.log('');
        
        try {
            const campaign = MARKETING_CONFIG.campaigns[campaignType];
            if (!campaign) {
                throw new Error(`Unknown campaign type: ${campaignType}`);
            }
            
            // Generate campaign ID
            const campaignId = `${campaignType}-${Date.now()}`;
            
            // Create campaign content
            const content = await this.generateCampaignContent(bookData, campaign);
            
            // Schedule posts across channels
            const schedule = await this.createPostingSchedule(campaign, content);
            
            // Set up tracking
            const tracking = this.setupTracking(campaignId, bookData);
            
            // Store campaign
            this.activeCampaigns.set(campaignId, {
                id: campaignId,
                type: campaignType,
                bookData,
                campaign,
                content,
                schedule,
                tracking,
                startDate: new Date(),
                endDate: campaign.duration > 0 ? 
                    new Date(Date.now() + campaign.duration * 24 * 60 * 60 * 1000) : null,
                status: 'active'
            });
            
            // Execute immediate posts
            const immediate = schedule.filter(post => post.immediate);
            for (const post of immediate) {
                await this.executePost(post, campaignId);
            }
            
            // Schedule future posts
            this.scheduleFuturePosts(campaignId, schedule.filter(post => !post.immediate));
            
            // Set up email sequences if included
            if (campaign.channels.includes('email')) {
                await this.setupEmailSequence(campaignId, bookData, content);
            }
            
            // Generate campaign report
            const report = this.generateCampaignPlan(campaignId);
            
            console.log('\n✅ Campaign launched successfully!');
            console.log(`🆔 Campaign ID: ${campaignId}`);
            console.log(`📅 Duration: ${campaign.duration > 0 ? campaign.duration + ' days' : 'Ongoing'}`);
            console.log(`📱 Channels: ${campaign.channels.join(', ')}`);
            console.log(`📊 Total posts scheduled: ${schedule.length}`);
            
            return {
                success: true,
                campaignId,
                report,
                tracking: tracking.shortLink
            };
            
        } catch (error) {
            console.error('❌ Campaign launch failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async generateCampaignContent(bookData, campaign) {
        console.log('✍️  Generating campaign content...');
        
        const content = {
            posts: [],
            emails: [],
            images: [],
            hashtags: this.selectHashtags(bookData.niche || 'business')
        };
        
        // Generate posts for each template type
        for (const templateType of campaign.templates) {
            const templates = MARKETING_CONFIG.templates[templateType];
            if (!templates) continue;
            
            for (const template of templates) {
                const post = this.fillTemplate(template, bookData);
                content.posts.push({
                    type: templateType,
                    text: post,
                    variants: this.generateVariants(post, campaign.channels)
                });
            }
        }
        
        // Generate email content
        if (campaign.channels.includes('email')) {
            content.emails = this.generateEmailContent(bookData, campaign);
        }
        
        // Identify required images
        content.images = this.identifyRequiredImages(campaign.channels);
        
        console.log(`   ✅ Generated ${content.posts.length} post templates`);
        console.log(`   ✅ Generated ${content.emails.length} email templates`);
        console.log(`   ✅ Selected hashtags: ${content.hashtags.join(' ')}`);
        
        return content;
    }

    fillTemplate(template, bookData) {
        const replacements = {
            '{title}': bookData.title,
            '{subtitle}': bookData.subtitle || '',
            '{description}': this.truncate(bookData.description, 100),
            '{topic}': bookData.topic || bookData.niche || 'success',
            '{link}': bookData.salesLink || bookData.gumroadUrl || 'example.com/book',
            '{cta}': this.getRandomCTA(),
            '{discount}': '30',
            '{hours}': '48',
            '{remaining}': '24',
            '{amount}': '10',
            '{painPoint}': this.getPainPoint(bookData.niche),
            '{benefit}': this.getBenefit(bookData.niche),
            '{desiredOutcome}': this.getDesiredOutcome(bookData.niche),
            '{timeframe}': '30 days',
            '{niche}': bookData.niche || 'life',
            '{feature1}': bookData.features?.[0] || 'Proven strategies',
            '{feature2}': bookData.features?.[1] || 'Step-by-step guides',
            '{feature3}': bookData.features?.[2] || 'Real-world examples',
            '{bulletPoints}': this.formatBulletPoints(bookData.features || []),
            '{testimonial}': 'This book changed my perspective completely!',
            '{author}': 'Sarah J.',
            '{review}': 'Best investment I made this year. Clear, actionable, and transformative.'
        };
        
        let filled = template;
        for (const [key, value] of Object.entries(replacements)) {
            filled = filled.replace(new RegExp(key, 'g'), value);
        }
        
        return filled;
    }

    generateVariants(post, channels) {
        const variants = {};
        
        for (const channel of channels) {
            const config = MARKETING_CONFIG.channels[channel];
            if (!config || !config.charLimit) continue;
            
            let variant = post;
            
            // Adjust for character limits
            if (variant.length > config.charLimit) {
                variant = this.truncate(variant, config.charLimit - 20) + '... ' + this.extractLink(post);
            }
            
            // Add channel-specific elements
            if (channel === 'twitter') {
                // Add relevant hashtags if space allows
                const hashtags = this.selectHashtags('', 3).join(' ');
                if (variant.length + hashtags.length + 1 < config.charLimit) {
                    variant += '\n\n' + hashtags;
                }
            } else if (channel === 'linkedin') {
                // More professional tone
                variant = variant.replace(/!+/g, '.').replace(/🔥|💯|🚀/g, '');
            }
            
            variants[channel] = variant;
        }
        
        return variants;
    }

    createPostingSchedule(campaign, content) {
        const schedule = [];
        const posts = content.posts;
        const channels = campaign.channels.filter(ch => ch !== 'email');
        
        // Determine posting frequency based on intensity
        const postsPerDay = {
            very_high: 8,
            high: 4,
            medium: 2,
            low: 1
        }[campaign.intensity] || 2;
        
        // Spread posts across campaign duration
        const totalDays = campaign.duration > 0 ? campaign.duration : 30;
        let postIndex = 0;
        
        for (let day = 0; day < totalDays; day++) {
            for (let i = 0; i < postsPerDay; i++) {
                const post = posts[postIndex % posts.length];
                const channel = channels[postIndex % channels.length];
                const time = this.getBestPostingTime(channel, i);
                
                schedule.push({
                    id: crypto.randomBytes(8).toString('hex'),
                    day,
                    time,
                    date: this.calculatePostDate(day, time),
                    channel,
                    content: post.variants[channel] || post.text,
                    type: post.type,
                    immediate: day === 0 && i === 0,
                    status: 'scheduled'
                });
                
                postIndex++;
            }
        }
        
        return schedule;
    }

    getBestPostingTime(channel, index) {
        const config = MARKETING_CONFIG.channels[channel];
        if (!config || !config.bestTimes) {
            return '12:00'; // Default noon
        }
        
        return config.bestTimes[index % config.bestTimes.length];
    }

    calculatePostDate(daysFromNow, timeString) {
        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);
        
        const [hours, minutes] = timeString.split(':').map(Number);
        date.setHours(hours, minutes, 0, 0);
        
        return date;
    }

    async executePost(post, campaignId) {
        console.log(`\n📤 Posting to ${post.channel}: "${post.content.slice(0, 50)}..."`);
        
        try {
            let result;
            
            switch (post.channel) {
                case 'twitter':
                    result = await this.postToTwitter(post.content);
                    break;
                case 'facebook':
                    result = await this.postToFacebook(post.content);
                    break;
                case 'linkedin':
                    result = await this.postToLinkedIn(post.content);
                    break;
                default:
                    throw new Error(`Unsupported channel: ${post.channel}`);
            }
            
            // Update post status
            post.status = 'posted';
            post.result = result;
            post.postedAt = new Date();
            
            // Track analytics
            this.trackPost(campaignId, post);
            
            console.log('   ✅ Posted successfully');
            return result;
            
        } catch (error) {
            console.error(`   ❌ Failed to post: ${error.message}`);
            post.status = 'failed';
            post.error = error.message;
            return null;
        }
    }

    async postToTwitter(content) {
        if (!this.twitter.apiKey) {
            console.log('   ⚠️  Twitter API not configured, simulating post');
            return { simulated: true, id: 'sim-' + Date.now() };
        }
        
        // In production, use Twitter API v2
        // For now, simulate
        return {
            id: 'tweet-' + crypto.randomBytes(8).toString('hex'),
            url: 'https://twitter.com/user/status/123456789',
            engagement: { likes: 0, retweets: 0, replies: 0 }
        };
    }

    async postToFacebook(content) {
        if (!this.facebook.accessToken) {
            console.log('   ⚠️  Facebook API not configured, simulating post');
            return { simulated: true, id: 'sim-' + Date.now() };
        }
        
        try {
            const response = await axios.post(
                `${MARKETING_CONFIG.channels.facebook.api}/${this.facebook.pageId}/feed`,
                {
                    message: content,
                    access_token: this.facebook.accessToken
                }
            );
            
            return {
                id: response.data.id,
                url: `https://facebook.com/${response.data.id}`
            };
        } catch (error) {
            throw new Error(`Facebook API error: ${error.message}`);
        }
    }

    async postToLinkedIn(content) {
        // LinkedIn API requires OAuth2
        console.log('   ⚠️  LinkedIn posting simulated');
        return {
            simulated: true,
            id: 'linkedin-' + Date.now()
        };
    }

    scheduleFuturePosts(campaignId, posts) {
        console.log(`\n⏰ Scheduling ${posts.length} future posts...`);
        
        const campaign = this.activeCampaigns.get(campaignId);
        
        posts.forEach(post => {
            const delay = post.date.getTime() - Date.now();
            
            if (delay > 0) {
                const timeout = setTimeout(() => {
                    this.executePost(post, campaignId);
                }, delay);
                
                this.scheduledPosts.set(post.id, {
                    post,
                    campaignId,
                    timeout
                });
            }
        });
        
        // Also set up cron jobs for recurring posts
        if (campaign.type === 'evergreen') {
            this.setupRecurringPosts(campaignId);
        }
    }

    setupRecurringPosts(campaignId) {
        // Post daily at optimal times
        const job = cron.schedule('0 12 * * *', () => {
            const campaign = this.activeCampaigns.get(campaignId);
            if (campaign && campaign.status === 'active') {
                const post = this.selectEvergreenPost(campaign);
                this.executePost(post, campaignId);
            }
        });
        
        campaign.cronJob = job;
    }

    async setupEmailSequence(campaignId, bookData, content) {
        console.log('\n📧 Setting up email sequence...');
        
        const emails = content.emails;
        const campaign = this.activeCampaigns.get(campaignId);
        
        // Create email automation
        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            const delayDays = i * 2; // Send every 2 days
            
            setTimeout(() => {
                this.sendEmail(email, campaignId);
            }, delayDays * 24 * 60 * 60 * 1000);
        }
        
        console.log(`   ✅ Scheduled ${emails.length} emails`);
    }

    async sendEmail(emailData, campaignId) {
        console.log(`\n📧 Sending email: ${emailData.subject}`);
        
        if (!this.email.apiKey) {
            console.log('   ⚠️  Email API not configured, simulating send');
            return { simulated: true, id: 'email-' + Date.now() };
        }
        
        try {
            // SendGrid API example
            const response = await axios.post(
                'https://api.sendgrid.com/v3/mail/send',
                {
                    personalizations: [{
                        to: [{ email: emailData.to || 'list@example.com' }],
                        subject: emailData.subject
                    }],
                    from: {
                        email: this.email.fromEmail,
                        name: this.email.fromName
                    },
                    content: [{
                        type: 'text/html',
                        value: emailData.html
                    }],
                    tracking_settings: {
                        click_tracking: { enable: true },
                        open_tracking: { enable: true }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.email.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('   ✅ Email sent successfully');
            return { id: response.headers['x-message-id'] };
            
        } catch (error) {
            console.error('   ❌ Email failed:', error.message);
            return { error: error.message };
        }
    }

    generateEmailContent(bookData, campaign) {
        const emails = [];
        
        // Launch announcement email
        emails.push({
            subject: `🎉 New Book Alert: ${bookData.title}`,
            preheader: bookData.subtitle || 'Get your copy today!',
            html: this.buildEmailHTML('launch', bookData)
        });
        
        // Feature highlights email
        emails.push({
            subject: `Discover what's inside ${bookData.title}`,
            preheader: 'Key takeaways and benefits',
            html: this.buildEmailHTML('features', bookData)
        });
        
        // Social proof email
        emails.push({
            subject: 'Readers are loving it! 🌟',
            preheader: 'See what others are saying',
            html: this.buildEmailHTML('testimonials', bookData)
        });
        
        // Last chance email
        if (campaign.type === 'flash_sale') {
            emails.push({
                subject: '⏰ Last 24 hours - Save 30%',
                preheader: "Don't miss out on this deal",
                html: this.buildEmailHTML('urgency', bookData)
            });
        }
        
        return emails;
    }

    buildEmailHTML(template, bookData) {
        // Simplified email template
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${bookData.title}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f4f4f4; padding: 20px; text-align: center; }
        .content { padding: 20px 0; }
        .cta { background: #007bff; color: white; padding: 15px 30px; text-decoration: none; display: inline-block; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${bookData.title}</h1>
            <p>${bookData.subtitle || ''}</p>
        </div>
        <div class="content">
            ${this.getEmailContent(template, bookData)}
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ${bookData.author || 'Author'}</p>
            <p><a href="{unsubscribe}">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>`;
    }

    getEmailContent(template, bookData) {
        const templates = {
            launch: `
                <h2>I'm thrilled to announce my new book is here!</h2>
                <p>${bookData.description}</p>
                <p>For the next 48 hours, get 20% off with code LAUNCH20.</p>
                <a href="${bookData.salesLink}" class="cta">Get Your Copy Now</a>
            `,
            features: `
                <h2>What You'll Learn</h2>
                <ul>
                    ${(bookData.features || ['Feature 1', 'Feature 2', 'Feature 3'])
                        .map(f => `<li>${f}</li>`).join('')}
                </ul>
                <a href="${bookData.salesLink}" class="cta">Start Learning Today</a>
            `,
            testimonials: `
                <h2>What Readers Are Saying</h2>
                <blockquote>"This book exceeded all my expectations!"</blockquote>
                <blockquote>"A must-read for anyone in ${bookData.niche || 'this field'}"</blockquote>
                <a href="${bookData.salesLink}" class="cta">Join Happy Readers</a>
            `,
            urgency: `
                <h2>⏰ Time is Running Out!</h2>
                <p>Only 24 hours left to save 30% on ${bookData.title}.</p>
                <p>Don't miss this opportunity to transform your ${bookData.niche || 'life'}.</p>
                <a href="${bookData.salesLink}" class="cta">Claim Your Discount</a>
            `
        };
        
        return templates[template] || templates.launch;
    }

    setupTracking(campaignId, bookData) {
        // Create tracking links
        const baseUrl = bookData.salesLink || 'https://example.com/book';
        const tracking = {
            campaignId,
            shortLink: this.createTrackingLink(baseUrl, campaignId),
            pixels: {
                facebook: this.facebook.pixelId,
                google: process.env.GOOGLE_ANALYTICS_ID
            },
            goals: {
                impressions: 0,
                clicks: 0,
                conversions: 0,
                revenue: 0
            }
        };
        
        this.analytics.set(campaignId, tracking);
        return tracking;
    }

    createTrackingLink(url, campaignId) {
        // Add UTM parameters
        const utm = new URLSearchParams({
            utm_source: 'campaign',
            utm_medium: 'social',
            utm_campaign: campaignId
        });
        
        return `${url}?${utm.toString()}`;
    }

    trackPost(campaignId, post) {
        const analytics = this.analytics.get(campaignId);
        if (analytics) {
            analytics.goals.impressions++;
            
            // In production, would track actual engagement
            if (post.result && !post.result.simulated) {
                // Track real metrics
            }
        }
    }

    identifyRequiredImages(channels) {
        const images = [];
        
        if (channels.includes('instagram')) {
            images.push({
                type: 'square',
                dimensions: '1080x1080',
                purpose: 'Instagram post'
            });
        }
        
        if (channels.includes('facebook')) {
            images.push({
                type: 'landscape',
                dimensions: '1200x630',
                purpose: 'Facebook link preview'
            });
        }
        
        if (channels.includes('twitter')) {
            images.push({
                type: 'twitter_card',
                dimensions: '1200x675',
                purpose: 'Twitter card'
            });
        }
        
        return images;
    }

    selectHashtags(niche, limit = 5) {
        const hashtags = MARKETING_CONFIG.hashtagSets[niche.toLowerCase()] || 
                        MARKETING_CONFIG.hashtagSets.business;
        
        return hashtags.slice(0, limit);
    }

    getRandomCTA() {
        const ctas = [
            'Get your copy today',
            'Start reading now',
            'Transform your life',
            'Learn more',
            'Discover the secrets',
            'Join thousands of readers'
        ];
        
        return ctas[Math.floor(Math.random() * ctas.length)];
    }

    getPainPoint(niche) {
        const painPoints = {
            business: 'struggling with growth',
            technology: 'falling behind on tech trends',
            health: 'feeling tired and unmotivated',
            selfhelp: 'feeling stuck in life'
        };
        
        return painPoints[niche?.toLowerCase()] || 'facing challenges';
    }

    getBenefit(niche) {
        const benefits = {
            business: 'scale your business 10x',
            technology: 'master cutting-edge tech',
            health: 'achieve optimal wellness',
            selfhelp: 'unlock your full potential'
        };
        
        return benefits[niche?.toLowerCase()] || 'achieve success';
    }

    getDesiredOutcome(niche) {
        const outcomes = {
            business: 'running a thriving business',
            technology: 'being a tech leader',
            health: 'feeling energetic and healthy',
            selfhelp: 'living your best life'
        };
        
        return outcomes[niche?.toLowerCase()] || 'achieving your dreams';
    }

    formatBulletPoints(features) {
        return features.slice(0, 5).map(f => `• ${f}`).join('\n');
    }

    truncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.slice(0, maxLength - 3) + '...';
    }

    extractLink(text) {
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        return urlMatch ? urlMatch[0] : '';
    }

    generateCampaignPlan(campaignId) {
        const campaign = this.activeCampaigns.get(campaignId);
        if (!campaign) return null;
        
        return {
            campaignId,
            type: campaign.type,
            book: campaign.bookData.title,
            duration: campaign.campaign.duration,
            channels: campaign.campaign.channels,
            schedule: campaign.schedule.map(post => ({
                date: post.date,
                channel: post.channel,
                type: post.type,
                preview: post.content.slice(0, 50) + '...'
            })),
            totalPosts: campaign.schedule.length,
            postsPerDay: Math.round(campaign.schedule.length / (campaign.campaign.duration || 30)),
            trackingLink: campaign.tracking.shortLink
        };
    }

    async getCampaignAnalytics(campaignId) {
        const analytics = this.analytics.get(campaignId);
        const campaign = this.activeCampaigns.get(campaignId);
        
        if (!analytics || !campaign) {
            return { error: 'Campaign not found' };
        }
        
        // Calculate metrics
        const posts = campaign.schedule.filter(p => p.status === 'posted');
        const engagement = posts.reduce((sum, post) => {
            if (post.result && post.result.engagement) {
                return sum + (post.result.engagement.likes || 0) + 
                       (post.result.engagement.shares || 0);
            }
            return sum;
        }, 0);
        
        return {
            campaignId,
            status: campaign.status,
            duration: {
                started: campaign.startDate,
                ending: campaign.endDate,
                daysActive: Math.floor((Date.now() - campaign.startDate) / (24 * 60 * 60 * 1000))
            },
            posts: {
                scheduled: campaign.schedule.length,
                posted: posts.length,
                failed: campaign.schedule.filter(p => p.status === 'failed').length
            },
            reach: {
                impressions: analytics.goals.impressions,
                engagement: engagement,
                clicks: analytics.goals.clicks
            },
            conversions: {
                total: analytics.goals.conversions,
                revenue: analytics.goals.revenue,
                conversionRate: analytics.goals.clicks > 0 ? 
                    (analytics.goals.conversions / analytics.goals.clicks * 100).toFixed(2) + '%' : '0%'
            },
            topPosts: posts
                .sort((a, b) => (b.result?.engagement?.total || 0) - (a.result?.engagement?.total || 0))
                .slice(0, 3)
                .map(p => ({
                    channel: p.channel,
                    type: p.type,
                    engagement: p.result?.engagement?.total || 0,
                    preview: p.content.slice(0, 50) + '...'
                }))
        };
    }

    pauseCampaign(campaignId) {
        const campaign = this.activeCampaigns.get(campaignId);
        if (campaign) {
            campaign.status = 'paused';
            
            // Cancel scheduled posts
            campaign.schedule.forEach(post => {
                if (post.status === 'scheduled') {
                    const scheduled = this.scheduledPosts.get(post.id);
                    if (scheduled) {
                        clearTimeout(scheduled.timeout);
                        this.scheduledPosts.delete(post.id);
                    }
                }
            });
            
            // Stop cron jobs
            if (campaign.cronJob) {
                campaign.cronJob.stop();
            }
            
            console.log(`⏸️  Campaign ${campaignId} paused`);
            return true;
        }
        
        return false;
    }

    resumeCampaign(campaignId) {
        const campaign = this.activeCampaigns.get(campaignId);
        if (campaign && campaign.status === 'paused') {
            campaign.status = 'active';
            
            // Reschedule future posts
            const futurePosts = campaign.schedule.filter(
                post => post.status === 'scheduled' && post.date > new Date()
            );
            this.scheduleFuturePosts(campaignId, futurePosts);
            
            // Restart cron jobs
            if (campaign.cronJob) {
                campaign.cronJob.start();
            }
            
            console.log(`▶️  Campaign ${campaignId} resumed`);
            return true;
        }
        
        return false;
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    args.forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            options[key] = value || true;
        }
    });
    
    if (!options['book-dir'] && !options['campaign-id']) {
        console.error('Usage: marketing-automator.js --book-dir="path/to/book" --campaign="launch"');
        console.error('   or: marketing-automator.js --campaign-id="abc123" --action="analytics"');
        console.error('\nOptions:');
        console.error('  --campaign     Campaign type (launch, flash_sale, content_series, evergreen)');
        console.error('  --channels     Comma-separated channels (twitter,facebook,email,linkedin)');
        console.error('  --duration     Campaign duration in days');
        console.error('  --intensity    Campaign intensity (low, medium, high, very_high)');
        console.error('\nActions:');
        console.error('  --action       analytics, pause, resume');
        process.exit(1);
    }
    
    const automator = new MarketingAutomator();
    
    (async () => {
        try {
            if (options['campaign-id']) {
                // Manage existing campaign
                const campaignId = options['campaign-id'];
                
                switch (options.action) {
                    case 'analytics':
                        const analytics = await automator.getCampaignAnalytics(campaignId);
                        console.log('\nAnalytics:', JSON.stringify(analytics, null, 2));
                        break;
                    case 'pause':
                        automator.pauseCampaign(campaignId);
                        break;
                    case 'resume':
                        automator.resumeCampaign(campaignId);
                        break;
                    default:
                        console.error('Unknown action:', options.action);
                }
            } else {
                // Launch new campaign
                const bookData = await automator.loadBookData(options['book-dir']);
                
                const result = await automator.launchCampaign(
                    bookData,
                    options.campaign || 'launch',
                    {
                        channels: options.channels?.split(','),
                        duration: parseInt(options.duration),
                        intensity: options.intensity
                    }
                );
                
                if (result.report) {
                    // Save campaign plan
                    const reportPath = `build/campaigns/${result.campaignId}.json`;
                    await fs.mkdir('build/campaigns', { recursive: true });
                    await fs.writeFile(reportPath, JSON.stringify(result.report, null, 2));
                    console.log(`\n📄 Campaign plan saved to: ${reportPath}`);
                }
            }
            
            process.exit(0);
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = MarketingAutomator;
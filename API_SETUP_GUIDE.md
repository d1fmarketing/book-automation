# 🔑 API Setup Guide for Money Machine Pipeline

This guide will walk you through obtaining all the API keys needed for the Money Machine ebook automation pipeline. APIs are categorized by priority: **Critical** (pipeline won't work without them), **Important** (major features disabled), and **Optional** (nice to have).

## Table of Contents

- [Critical APIs](#critical-apis)
  - [Perplexity API](#1-perplexity-api)
  - [Anthropic Claude API](#2-anthropic-claude-api)
  - [OpenAI API](#3-openai-api)
  - [Ideogram API](#4-ideogram-api)
  - [Redis](#5-redis)
- [Important APIs](#important-apis)
  - [Gumroad](#6-gumroad)
  - [SendGrid](#7-sendgrid)
  - [Amazon Affiliate](#8-amazon-affiliate)
  - [Hostinger VPS](#9-hostinger-vps)
- [Social Media APIs](#social-media-apis)
  - [Twitter/X API](#10-twitterx-api-v2)
  - [Facebook Graph API](#11-facebook-graph-api)
  - [LinkedIn API](#12-linkedin-api)
- [Optional Enhancements](#optional-enhancements)

---

## Critical APIs

These APIs are essential for the pipeline to function. Without them, the pipeline will fail.

### 1. Perplexity API
**Used for:** Deep research and fact-based content generation

1. Go to [Perplexity AI Settings](https://www.perplexity.ai/settings/api)
2. Sign in or create an account
3. Navigate to API section
4. Click "Generate API Key"
5. Copy the key starting with `pplx-`
6. Add to `.env`: `PERPLEXITY_API_KEY=pplx-...`

**Cost:** $5 per 1000 requests (with caching, very economical)

### 2. Anthropic Claude API
**Used for:** Content writing, tone polishing, chat widget

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an account or sign in
3. Go to "API Keys" section
4. Click "Create Key"
5. Name it "Money Machine Pipeline"
6. Copy the key starting with `sk-ant-`
7. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`

**Cost:** ~$0.015 per 1K tokens (Opus model)

### 3. OpenAI API
**Used for:** Fact checking and grammar validation

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in with OpenAI account
3. Click "Create new secret key"
4. Name it "Money Machine Fact Checker"
5. Copy the key starting with `sk-`
6. Add to `.env`: `OPENAI_API_KEY=sk-...`

**Cost:** Rate limited to 5 calls per build (~$0.10 per ebook)

### 4. Ideogram API
**Used for:** AI-generated book covers and chapter images

1. Visit [Ideogram AI](https://ideogram.ai)
2. Sign up for an account
3. Go to Settings → API Keys
4. Click "Generate API Key"
5. Copy the key starting with `ideogram_sk_live_`
6. Add to `.env`: `IDEOGRAM_API_KEY=ideogram_sk_live_...`

**Cost:** ~$0.08 per image

### 5. Redis
**Used for:** Topic buffering and caching

**Local Installation (Mac):**
```bash
brew install redis
brew services start redis
```

**Local Installation (Ubuntu/Debian):**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Cloud Option (Redis Cloud):**
1. Sign up at [Redis Cloud](https://redis.com/try-free/)
2. Create a free database
3. Copy connection string
4. Add to `.env`: `REDIS_URL=redis://default:password@host:port`

---

## Important APIs

These enable major features. The pipeline works without them but with limited functionality.

### 6. Gumroad
**Used for:** Auto-publishing ebooks for sale

1. Log in to [Gumroad](https://app.gumroad.com)
2. Go to Settings → Advanced → Applications
3. Click "Create Application"
4. Name: "Money Machine Publisher"
5. Generate Access Token
6. Copy the token
7. Add to `.env`: `GUMROAD_ACCESS_TOKEN=...`

**For Affiliate Program:**
1. Go to Settings → Affiliates
2. Enable affiliate program
3. Copy your affiliate ID
4. Add to `.env`: `GUMROAD_AFFILIATE_ID=...`

### 7. SendGrid
**Used for:** Email automation and notifications

1. Sign up at [SendGrid](https://signup.sendgrid.com/)
2. Verify your email domain
3. Go to Settings → API Keys
4. Click "Create API Key"
5. Choose "Full Access"
6. Copy the key starting with `SG.`
7. Add to `.env`:
   ```
   SENDGRID_API_KEY=SG....
   SENDGRID_FROM_EMAIL=verified@yourdomain.com
   SENDGRID_FROM_NAME=Your Company
   ```

**Free tier:** 100 emails/day

### 8. Amazon Affiliate
**Used for:** Monetizing ebooks with affiliate links

1. Apply at [Amazon Associates](https://affiliate-program.amazon.com/)
2. Wait for approval (can take 1-3 days)
3. Once approved, go to Account Settings
4. Find your Tracking ID (e.g., `yourname-20`)
5. Add to `.env`: `AMAZON_ASSOCIATE_TAG=yourname-20`

**For Product Advertising API (Optional but recommended):**
1. In Associates Central, go to Tools → Product Advertising API
2. Click "Join" to request access
3. Once approved, create credentials
4. Add to `.env`:
   ```
   AMAZON_ACCESS_KEY=...
   AMAZON_SECRET_KEY=...
   AMAZON_PARTNER_TAG=yourname-20
   ```

### 9. Hostinger VPS
**Used for:** Deploying ebooks to production

1. Purchase VPS from [Hostinger](https://www.hostinger.com/vps-hosting)
2. In control panel, generate API token
3. Set up SSH key access
4. Add to `.env`:
   ```
   HOSTINGER_API_TOKEN=...
   HOSTINGER_VPS_HOST=your-vps.hostinger.com
   HOSTINGER_SSH_USER=root
   HOSTINGER_SSH_KEY=~/.ssh/hostinger_rsa
   ```

---

## Social Media APIs

Required for marketing automation features.

### 10. Twitter/X API v2
**Used for:** Auto-posting book launches and updates

1. Apply for developer account at [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new App
3. Generate all tokens in "Keys and tokens" section
4. Add to `.env`:
   ```
   TWITTER_API_KEY=...
   TWITTER_API_SECRET=...
   TWITTER_ACCESS_TOKEN=...
   TWITTER_ACCESS_TOKEN_SECRET=...
   ```

**Note:** Requires $100/month Basic tier for write access

### 11. Facebook Graph API
**Used for:** Posting to Facebook Pages

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new App (Business type)
3. Add Facebook Login product
4. Generate Page Access Token:
   - Tools → Graph API Explorer
   - Select your app
   - Request `pages_manage_posts` permission
   - Get Page Access Token
5. Add to `.env`:
   ```
   FACEBOOK_APP_ID=...
   FACEBOOK_APP_SECRET=...
   FACEBOOK_PAGE_ACCESS_TOKEN=...
   ```

### 12. LinkedIn API
**Used for:** Professional network marketing

1. Visit [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Create an app
3. Request Marketing Developer Platform access
4. Verify your app
5. Generate 3-legged OAuth token
6. Add to `.env`:
   ```
   LINKEDIN_CLIENT_ID=...
   LINKEDIN_CLIENT_SECRET=...
   LINKEDIN_ACCESS_TOKEN=...
   ```

---

## Optional Enhancements

These APIs add nice-to-have features but aren't required.

### BrowserStack
**Used for:** Cross-browser testing

1. Sign up at [BrowserStack](https://www.browserstack.com/)
2. Get credentials from [Account Settings](https://www.browserstack.com/accounts/settings)
3. Add to `.env`:
   ```
   BROWSERSTACK_USERNAME=...
   BROWSERSTACK_ACCESS_KEY=...
   ```

### Cloudflare
**Used for:** CDN and caching

1. Add your domain to [Cloudflare](https://www.cloudflare.com/)
2. Go to My Profile → API Tokens
3. Create token with Zone:Read and Cache Purge permissions
4. Add to `.env`:
   ```
   CLOUDFLARE_API_TOKEN=...
   CLOUDFLARE_ZONE_ID=...
   ```

### Product Hunt
**Used for:** Trending topic discovery

1. Go to [Product Hunt OAuth](https://www.producthunt.com/v2/oauth/applications)
2. Create new application
3. Add to `.env`:
   ```
   PRODUCTHUNT_API_TOKEN=...
   PRODUCTHUNT_API_SECRET=...
   ```

### Stripe
**Used for:** Direct payment processing

1. Sign up at [Stripe](https://dashboard.stripe.com/)
2. Get API keys from Developers section
3. Set up webhook endpoint
4. Add to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## Quick Start Checklist

For a minimal working pipeline, you need:

- [ ] Perplexity API (research)
- [ ] Anthropic API (writing)
- [ ] OpenAI API (fact checking)
- [ ] Ideogram API (covers)
- [ ] Redis (local or cloud)
- [ ] Gumroad (publishing)

Total estimated cost per ebook: ~$2-3

## Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your API keys in `.env`

3. Validate your setup:
   ```bash
   node scripts/check-env.js
   ```

4. Run a test build:
   ```bash
   npm run money:dry-run
   ```

## Security Best Practices

1. **Never commit `.env` file** - it's already in `.gitignore`
2. **Use environment-specific keys** - different keys for dev/staging/production
3. **Set up rate limiting** - already configured for costly APIs
4. **Monitor usage** - set up billing alerts on all platforms
5. **Rotate keys regularly** - especially for production
6. **Use least privilege** - only grant necessary permissions

## Troubleshooting

### "API key not found" errors
- Ensure `.env` file exists (not just `.env.example`)
- Check for typos in key names
- Verify keys are active on provider dashboards

### Rate limit errors
- Check `OPENAI_MAX_CALLS_PER_BUILD` setting
- Implement caching for expensive operations
- Consider upgrading API plans

### Authentication failures
- Regenerate tokens if expired
- Verify OAuth tokens have correct scopes
- Check if APIs require additional verification

## Support

For API-specific issues:
- Check provider documentation links above
- Review error messages in `build/logs/`
- Enable debug mode: `DEBUG=* npm run build`

For pipeline issues:
- See [DEBUGGING-CHECKLIST.md](./DEBUGGING-CHECKLIST.md)
- Run `npm run test:agents`
- Check workflow manifest in `build/logs/workflow-manifest.json`
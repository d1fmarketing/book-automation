# 💰 Money Machine Setup Guide

## 🚀 Quick Start - Get Running in 15 Minutes

### Step 1: Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Redis (for topic caching)
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows (use WSL or Docker)
docker run -d -p 6379:6379 redis:alpine
```

### Step 2: Get API Keys

You need these API keys for the Money Machine to work:

1. **Anthropic Claude** (Required - $20/month)
   - Go to https://console.anthropic.com/
   - Create account → API Keys → Create Key
   - Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`

2. **Perplexity** (Required - $20/month)
   - Go to https://www.perplexity.ai/settings/api
   - Get API key
   - Add to `.env`: `PERPLEXITY_API_KEY=pplx-...`

3. **Ideogram** (Required - $8/month)
   - Go to https://ideogram.ai/
   - Settings → API Keys → Generate
   - Add to `.env`: `IDEOGRAM_API_KEY=ideogram_sk_live_...`

4. **Gumroad** (Required - Free)
   - Go to https://app.gumroad.com/settings/developer
   - Create Access Token
   - Add to `.env`: `GUMROAD_ACCESS_TOKEN=...`

5. **OpenAI** (Optional - for fact checking)
   - Go to https://platform.openai.com/api-keys
   - Create key with $5 credit
   - Add to `.env`: `OPENAI_API_KEY=sk-...`

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your API keys
nano .env  # or use your favorite editor
```

**Minimum required `.env` configuration:**

```env
# Core AI Services
ANTHROPIC_API_KEY=sk-ant-your-key-here
PERPLEXITY_API_KEY=pplx-your-key-here
IDEOGRAM_API_KEY=ideogram_sk_live_your-key-here

# Publishing
GUMROAD_ACCESS_TOKEN=your-gumroad-token

# Affiliate (get free from Amazon)
AMAZON_ASSOCIATE_TAG=yourname-20

# Redis (default is fine)
REDIS_URL=redis://localhost:6379
```

### Step 4: Test Your Setup

```bash
# Check all API keys are working
npm run check-env

# Test individual components
npm run money:test

# If everything passes, you're ready!
```

### Step 5: Generate Your First Ebook!

```bash
# Generate one ebook (dry run - no publishing)
npm run money:dry-run

# Generate and publish one ebook
npm run money:start

# Generate 5 ebooks at once
npm run money:batch
```

## 📊 Expected Results

With proper setup, each run will:
1. Find a trending topic (1-2 min)
2. Research the topic deeply (1 min)
3. Create detailed outline (2 min)
4. Write 10 chapters (~15-20 min)
5. Polish content (5 min)
6. Add affiliate links (1 min)
7. Generate cover image (2 min)
8. Create PDF (2 min)
9. Upload to Gumroad (1 min)

**Total time: ~30-35 minutes per ebook**

## 💵 Revenue Projections

| Ebooks/Day | Price | Daily Revenue | Monthly Revenue |
|------------|-------|---------------|-----------------|
| 1 | $9.99 | $30-50 | $900-1,500 |
| 3 | $9.99 | $90-150 | $2,700-4,500 |
| 5 | $9.99 | $150-250 | $4,500-7,500 |

*Based on 1% conversion rate with 100 daily visitors per ebook*

## 🔧 Advanced Configuration

### Customize Brand Voice

Edit `scripts/automation-pipeline.js`:

```javascript
const config = {
  brandVoice: 'professional', // or 'conversational', 'academic', 'storytelling'
  affiliateStrategy: 'natural', // or 'aggressive', 'conservative'
  pricePoint: 14.99 // Increase price for premium content
};
```

### Scale to Multiple Ebooks

```bash
# Run 5 ebooks every morning at 6 AM
crontab -e

# Add this line:
0 6 * * * cd /path/to/book-automation && npm run money:batch >> /var/log/money-machine.log 2>&1
```

### Enable Production Features

In `.env`:

```env
# Publishing
AUTO_PUBLISH=true
DEPLOY_TO_PRODUCTION=true

# Deployment (optional)
HOSTINGER_API_TOKEN=your-token
HOSTINGER_VPS_HOST=your-vps.com
```

## 🐛 Troubleshooting

### "No topics found"
- Redis might have cached topics
- Clear cache: `redis-cli FLUSHALL`
- Wait 48 hours or use different search terms

### "API rate limit"
- Add delays between API calls
- Upgrade API plans for higher limits
- Use `--dry-run` for testing

### "PDF generation failed"
- Check Chrome/Chromium is installed
- Install: `npm install puppeteer --save`
- May need: `sudo apt-get install chromium-browser`

### "Gumroad upload failed"
- Verify GUMROAD_ACCESS_TOKEN is correct
- Check file size < 250MB
- Ensure PDF is valid

## 🚀 Optimization Tips

### 1. **Choose Profitable Niches**
- Business & Money (highest conversion)
- Health & Fitness (evergreen demand)
- Technology (high price tolerance)
- Self-Help (impulse buyers)

### 2. **Optimize Pricing**
- Start at $9.99 (sweet spot)
- Test $14.99 for specialized topics
- Use $4.99 for volume strategy

### 3. **Maximize Affiliate Revenue**
- Each ebook includes 10-20 affiliate links
- Focus on high-commission products
- Update links monthly for relevance

### 4. **Scale Gradually**
- Start with 1 ebook/day
- Scale to 3 after first week
- Max 5-10 for quality control

## 📈 Monitoring Success

### Daily Checklist
- [ ] Check Gumroad dashboard for sales
- [ ] Monitor affiliate commissions
- [ ] Review pipeline logs for errors
- [ ] Update successful topic keywords

### Weekly Tasks
- [ ] Analyze best-performing ebooks
- [ ] A/B test new prices
- [ ] Update affiliate products
- [ ] Run optimizer on 7-day old books

### Monthly Goals
- [ ] 150+ ebooks published
- [ ] $5,000+ in direct sales
- [ ] $1,500+ in affiliate commissions
- [ ] 10%+ conversion rate improvement

## 🎯 Next Steps

1. **Set up payment processing**
   - Connect Gumroad to Stripe/PayPal
   - Enable international payments
   - Set up tax handling

2. **Create marketing funnel**
   - Build email list from buyers
   - Create upsell products
   - Launch affiliate program

3. **Automate everything**
   - GitHub Actions for daily runs
   - Monitoring dashboards
   - Auto-optimization after 7 days

## 💡 Pro Tips

- **Topic Selection**: Let the algorithm find winners. Don't override.
- **Quality Control**: Read 1 in 10 ebooks fully to ensure quality.
- **Customer Service**: Set up auto-responders for common questions.
- **Scaling Secret**: Reinvest first month's profits into better APIs.

## 📞 Support

- GitHub Issues: Report bugs and get help
- Documentation: See CLAUDE.md for technical details
- Updates: Watch repo for new features

---

**Remember**: This is a real business. Provide real value, and the money will follow!

Start now: `npm run money:start` 🚀💰
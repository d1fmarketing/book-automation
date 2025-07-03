# 💰 EBOOK MONEY MACHINE AI - Complete Documentation

## 🚀 What's New in This Enhanced Version

### Phase 0: Deep Research Integration ✨
- **Perplexity API** integration for fact-based content
- Real-time research before content generation
- Automatic citation and fact inclusion
- Research stored in `context/research.yaml`

### Additional Enhancements
1. **Real Trending Scanner** - Multi-source trend detection
2. **AI Chat Widget** - Interactive Claude-powered assistant
3. **Niche Templates** - Money, Crypto, Adult themes
4. **Daily Automation** - GitHub Actions pipeline
5. **Template Selection** - Auto-detects best template

## 📋 Quick Start

### 1. Setup Environment

```bash
# Install dependencies
npm install

# Configure API keys in .env
IDEOGRAM_API_KEY=your_ideogram_key
PERPLEXITY_API_KEY=your_perplexity_key
ANTHROPIC_API_KEY=your_anthropic_key (for chat)
```

### 2. Run Complete Pipeline

```bash
# Generate one ebook with research
npm run money:start

# Or run directly
node scripts/automation-pipeline.js
```

### 3. Test Individual Components

```bash
# Test trending scanner
node scanners/trending-money-scanner.js

# Test deep research
node -e "require('./agents/deep-research')({topic:'AI business'}).then(console.log)"

# Build HTML with chat
npm run build:premium-ebook
```

## 🔍 Deep Research Flow

```
Topic Selected → Perplexity API → context/research.yaml → Content Generation
                      ↓
                 - Summary (350 chars)
                 - 5 Related URLs
                 - 3 Key Bullets
```

### Research Integration
- Each chapter includes relevant research insights
- Facts are automatically cited in content
- Links provide credibility and SEO value

## 📊 Trending Scanner Sources

| Source | Data Pulled | Weight |
|--------|-------------|---------|
| Google Trends | Rising queries | High |
| Reddit r/Entrepreneur | Hot posts | Medium |
| Hacker News | Tech/startup stories | Medium |
| Product Hunt | New products | Low |

### Scoring Algorithm
```javascript
score = (google_traffic / 1000) + (reddit_engagement / 100) + (hn_score / 10)
```

## 🤖 AI Chat Widget Features

- **Rate Limited**: 10 questions/hour
- **Context Aware**: Knows current chapter
- **Claude Haiku**: Fast, affordable responses
- **Mobile Friendly**: Responsive design
- **Privacy First**: No tracking, localStorage only

### Chat Configuration
```javascript
{
    apiKey: 'your_anthropic_key',
    rateLimit: 10,
    ratePeriod: 3600000, // 1 hour
    theme: 'light'
}
```

## 🎨 Niche Templates

### Money/Business
- Green color scheme
- ROI calculator widget
- Profit tables styling
- Success indicators

### Crypto/Blockchain
- Dark neon aesthetic
- Price ticker simulation
- Code block emphasis
- Trading chart styles

### Adult Content
- Age verification gate
- Dark elegant theme
- Content warnings
- Privacy disclaimers

## 🔄 Daily Automation

### GitHub Actions Workflow
- **Schedule**: Daily at 2:15 UTC
- **Steps**:
  1. Pick trending topic
  2. Deep research with Perplexity
  3. Generate content
  4. Create images
  5. Build HTML
  6. Upload artifacts

### Manual Trigger
```bash
gh workflow run daily-ebook-generation.yml
```

## 📁 Project Structure

```
ebook-money-machine-ai/
├── agents/
│   ├── deep-research.js      # Perplexity integration
│   ├── chat-embedder.js      # AI chat widget
│   └── template-selector.js  # Niche detection
├── scanners/
│   └── trending-money-scanner.js  # Multi-source trends
├── templates/
│   └── niches/
│       ├── money/style.css
│       ├── crypto/style.css
│       └── adult/style.css
├── scripts/
│   ├── automation-pipeline.js  # Main orchestrator
│   ├── generate-content.js     # Content generation
│   └── build-premium-html-ebook.js  # HTML builder
├── context/
│   └── research.yaml          # Research output
└── .github/
    └── workflows/
        └── daily-ebook-generation.yml
```

## 🚀 Production Checklist

- [ ] Get real API keys (Perplexity, Anthropic)
- [ ] Configure GitHub Secrets
- [ ] Test complete pipeline locally
- [ ] Setup Gumroad/payment processor
- [ ] Enable GitHub Actions
- [ ] Monitor first automated run
- [ ] Scale to multiple ebooks/day

## 💡 Tips for Success

1. **Topic Selection**: Let the scanner find proven winners
2. **Research Quality**: Perplexity adds credibility
3. **Chat Value**: Increases perceived value by $20-50
4. **Template Match**: Right theme = higher conversions
5. **Daily Consistency**: Automation = passive income

## 🐛 Troubleshooting

### Research Fails
```bash
# Check API key
echo $PERPLEXITY_API_KEY

# Test manually
curl -X POST https://api.perplexity.ai/v1/answer \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -d '{"q":"test query"}'
```

### Chat Not Working
- Verify Anthropic API key
- Check browser console for errors
- Ensure rate limit not exceeded

### Template Not Applied
- Check topic keywords match
- Verify CSS file exists
- See console for template selection

## 📈 Revenue Projections

| Ebooks/Day | Price | Monthly Revenue |
|------------|-------|-----------------|
| 1 | $47 | $1,410 |
| 3 | $47 | $4,230 |
| 5 | $47 | $7,050 |
| 10 | $47 | $14,100 |

*Assuming 1% conversion rate on 100 daily visitors per ebook*

## 🎯 Next Steps

1. **Get API Keys**: All three services
2. **Run Test**: `npm run money:start`
3. **Review Output**: Check quality
4. **Deploy**: Push to GitHub
5. **Automate**: Enable Actions
6. **Scale**: Increase daily target

---

**Remember**: Quality + Automation = Sustainable Income 🚀💰

*Built with the enhanced EBOOK MONEY MACHINE AI system*
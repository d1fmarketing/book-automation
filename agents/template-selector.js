const fs = require('fs').promises;
const path = require('path');

// Niche detection keywords
const NICHE_KEYWORDS = {
    money: ['money', 'profit', 'income', 'business', 'revenue', 'earn', 'financial', 'investment', 'wealth', 'success'],
    crypto: ['crypto', 'bitcoin', 'blockchain', 'nft', 'ethereum', 'defi', 'trading', 'mining', 'wallet', 'token'],
    adult: ['adult', 'dating', 'romance', 'relationship', 'intimate', 'mature', 'sensual', 'love', 'passion']
};

// Select template based on topic
function selectTemplate(topic) {
    const topicLower = topic.toLowerCase();
    
    // Check each niche
    for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
        const matchCount = keywords.filter(keyword => topicLower.includes(keyword)).length;
        if (matchCount >= 2) {
            return niche;
        }
    }
    
    // Default to money template for business topics
    return 'money';
}

// Load template CSS
async function loadTemplateCSS(niche) {
    const cssPath = path.join(__dirname, '../templates/niches', niche, 'style.css');
    
    try {
        const css = await fs.readFile(cssPath, 'utf-8');
        return css;
    } catch (error) {
        console.warn(`Template CSS not found for ${niche}, using default`);
        return getDefaultCSS();
    }
}

// Get template-specific features
function getTemplateFeatures(niche) {
    const features = {
        money: {
            extraScripts: `
                // ROI Calculator
                function calculateROI() {
                    const investment = parseFloat(document.getElementById('investment').value) || 0;
                    const returns = parseFloat(document.getElementById('returns').value) || 0;
                    const roi = ((returns - investment) / investment * 100).toFixed(2);
                    document.getElementById('roi-result').textContent = roi + '%';
                }
            `,
            extraHTML: `
                <div class="roi-calculator">
                    <h3>ROI Calculator</h3>
                    <input type="number" id="investment" placeholder="Initial Investment ($)">
                    <input type="number" id="returns" placeholder="Total Returns ($)">
                    <button onclick="calculateROI()">Calculate</button>
                    <div id="roi-result">0%</div>
                </div>
            `
        },
        crypto: {
            extraScripts: `
                // Crypto price ticker simulation
                function updateCryptoPrices() {
                    const prices = {
                        BTC: (Math.random() * 10000 + 40000).toFixed(2),
                        ETH: (Math.random() * 500 + 3000).toFixed(2),
                        BNB: (Math.random() * 50 + 400).toFixed(2)
                    };
                    
                    const ticker = document.querySelector('.crypto-price-ticker');
                    if (ticker) {
                        ticker.innerHTML = Object.entries(prices)
                            .map(([coin, price]) => \`\${coin}: $\${price}\`)
                            .join(' | ');
                    }
                }
                
                setInterval(updateCryptoPrices, 5000);
            `,
            extraHTML: `
                <div class="crypto-price-ticker">Loading prices...</div>
            `
        },
        adult: {
            extraScripts: `
                // Age gate functionality
                function verifyAge(confirmed) {
                    if (confirmed) {
                        localStorage.setItem('age_verified', 'true');
                        document.querySelector('.age-gate').style.display = 'none';
                    } else {
                        window.location.href = 'https://google.com';
                    }
                }
                
                // Check age verification on load
                if (!localStorage.getItem('age_verified')) {
                    document.body.innerHTML = \`
                        <div class="age-gate">
                            <div class="age-gate-content">
                                <h2>Age Verification Required</h2>
                                <p>This content is intended for mature audiences only.</p>
                                <p>Are you 18 years or older?</p>
                                <div class="age-gate-buttons">
                                    <button class="age-gate-button confirm" onclick="verifyAge(true)">Yes, I'm 18+</button>
                                    <button class="age-gate-button deny" onclick="verifyAge(false)">No, Exit</button>
                                </div>
                            </div>
                        </div>
                    \` + document.body.innerHTML;
                }
            `,
            extraHTML: `
                <div class="disclaimer">
                    <h4>Disclaimer</h4>
                    <p>This content is for educational and entertainment purposes only. 
                    All content is intended for adults 18+. Reader discretion is advised.</p>
                </div>
            `
        }
    };
    
    return features[niche] || { extraScripts: '', extraHTML: '' };
}

// Default CSS fallback
function getDefaultCSS() {
    return `
        :root {
            --primary-color: #3b82f6;
            --secondary-color: #2563eb;
            --accent-color: #1d4ed8;
            --text-color: #1f2937;
            --bg-color: #ffffff;
        }
    `;
}

module.exports = {
    selectTemplate,
    loadTemplateCSS,
    getTemplateFeatures,
    NICHE_KEYWORDS
};
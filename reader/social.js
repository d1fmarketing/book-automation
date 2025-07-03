// Social Features Module for Ebook Reader
class SocialFeatures {
    constructor() {
        this.shareUrl = window.location.href;
        this.ebookTitle = '';
        this.selectedText = '';
        this.init();
    }
    
    init() {
        // Set up text selection listener
        document.addEventListener('mouseup', this.handleTextSelection.bind(this));
        document.addEventListener('touchend', this.handleTextSelection.bind(this));
        
        // Initialize share buttons
        this.setupShareButtons();
        
        // Load saved reviews
        this.loadReviews();
        
        console.log('🔗 Social features initialized');
    }
    
    handleTextSelection() {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text.length > 10 && text.length < 280) {
            this.selectedText = text;
            this.showShareTooltip(selection);
        } else {
            this.hideShareTooltip();
        }
    }
    
    showShareTooltip(selection) {
        // Remove existing tooltip
        this.hideShareTooltip();
        
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'share-tooltip';
        tooltip.innerHTML = `
            <button onclick="social.shareSelection('twitter')" title="Share on Twitter">
                <i class="fab fa-twitter"></i>
            </button>
            <button onclick="social.shareSelection('linkedin')" title="Share on LinkedIn">
                <i class="fab fa-linkedin"></i>
            </button>
            <button onclick="social.createHighlight()" title="Highlight">
                <i class="fas fa-highlighter"></i>
            </button>
            <button onclick="social.copySelection()" title="Copy">
                <i class="fas fa-copy"></i>
            </button>
        `;
        
        // Position tooltip
        tooltip.style.position = 'absolute';
        tooltip.style.left = `${rect.left + (rect.width / 2) - 80}px`;
        tooltip.style.top = `${rect.top + window.scrollY - 50}px`;
        
        document.body.appendChild(tooltip);
    }
    
    hideShareTooltip() {
        const tooltip = document.querySelector('.share-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }
    
    setupShareButtons() {
        // Twitter share
        window.shareOnTwitter = () => {
            const text = `Reading "${this.ebookTitle}"`;
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(this.shareUrl)}`;
            this.openShareWindow(url, 'twitter');
        };
        
        // LinkedIn share
        window.shareOnLinkedIn = () => {
            const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.shareUrl)}`;
            this.openShareWindow(url, 'linkedin');
        };
        
        // Facebook share
        window.shareOnFacebook = () => {
            const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.shareUrl)}`;
            this.openShareWindow(url, 'facebook');
        };
        
        // Copy link
        window.copyLink = async () => {
            try {
                await navigator.clipboard.writeText(this.shareUrl);
                this.showNotification('Link copied to clipboard!');
            } catch (err) {
                this.showNotification('Failed to copy link', 'error');
            }
        };
    }
    
    shareSelection(platform) {
        const text = this.selectedText;
        const chapter = document.querySelector('.ebook-content h1')?.textContent || '';
        
        // Track share event
        if (window.ebookAnalytics) {
            window.ebookAnalytics.trackShare(platform, chapter);
        }
        
        switch(platform) {
            case 'twitter':
                const tweetText = `"${text}" - from ${this.ebookTitle}`;
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(this.shareUrl)}`;
                this.openShareWindow(twitterUrl, 'twitter');
                break;
                
            case 'linkedin':
                const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.shareUrl)}&summary=${encodeURIComponent(text)}`;
                this.openShareWindow(linkedinUrl, 'linkedin');
                break;
                
            case 'facebook':
                const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.shareUrl)}&quote=${encodeURIComponent(text)}`;
                this.openShareWindow(fbUrl, 'facebook');
                break;
        }
        
        this.hideShareTooltip();
    }
    
    createHighlight() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.className = 'highlight';
        span.setAttribute('data-highlight-id', Date.now());
        
        try {
            range.surroundContents(span);
            
            // Save highlight
            const highlight = {
                id: span.getAttribute('data-highlight-id'),
                text: this.selectedText,
                chapter: document.querySelector('.ebook-content h1')?.textContent || '',
                timestamp: Date.now()
            };
            
            this.saveHighlight(highlight);
            
            // Track highlight
            if (window.ebookAnalytics) {
                window.ebookAnalytics.trackHighlight(this.selectedText, highlight.chapter);
            }
            
            this.showNotification('Text highlighted!');
        } catch (err) {
            console.error('Failed to create highlight:', err);
        }
        
        selection.removeAllRanges();
        this.hideShareTooltip();
    }
    
    copySelection() {
        navigator.clipboard.writeText(this.selectedText)
            .then(() => {
                this.showNotification('Text copied!');
                this.hideShareTooltip();
            })
            .catch(err => {
                console.error('Failed to copy:', err);
            });
    }
    
    saveHighlight(highlight) {
        const highlights = JSON.parse(localStorage.getItem('highlights') || '[]');
        highlights.push(highlight);
        localStorage.setItem('highlights', JSON.stringify(highlights));
        
        // Update highlights display
        this.displayHighlights();
    }
    
    displayHighlights() {
        const highlightsList = document.getElementById('highlights-list');
        if (!highlightsList) return;
        
        const highlights = JSON.parse(localStorage.getItem('highlights') || '[]');
        
        highlightsList.innerHTML = highlights.map(h => `
            <div class="highlight-item" data-id="${h.id}">
                <div class="highlight-text">"${h.text}"</div>
                <div class="highlight-meta">
                    <span>${h.chapter}</span>
                    <button class="delete-highlight" onclick="social.deleteHighlight('${h.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    deleteHighlight(id) {
        // Remove from localStorage
        let highlights = JSON.parse(localStorage.getItem('highlights') || '[]');
        highlights = highlights.filter(h => h.id !== id);
        localStorage.setItem('highlights', JSON.stringify(highlights));
        
        // Remove from DOM
        const highlightSpan = document.querySelector(`[data-highlight-id="${id}"]`);
        if (highlightSpan) {
            const text = document.createTextNode(highlightSpan.textContent);
            highlightSpan.parentNode.replaceChild(text, highlightSpan);
        }
        
        // Update display
        this.displayHighlights();
    }
    
    openShareWindow(url, platform) {
        const width = 600;
        const height = 400;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        window.open(
            url,
            `share-${platform}`,
            `width=${width},height=${height},left=${left},top=${top}`
        );
    }
    
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Reviews functionality
    loadReviews() {
        const reviews = this.getReviews();
        this.displayReviews(reviews);
        this.updateReviewStats(reviews);
    }
    
    getReviews() {
        // In production, this would fetch from a server
        const savedReviews = localStorage.getItem('ebook-reviews');
        if (savedReviews) {
            return JSON.parse(savedReviews);
        }
        
        // Demo reviews
        return [
            {
                id: 1,
                name: 'Sarah Johnson',
                rating: 5,
                text: 'Excellent resource! The AI prompts have transformed how I approach business content creation.',
                date: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 2,
                name: 'Mike Chen',
                rating: 4,
                text: 'Very practical guide. I especially liked the chapter on automated customer service prompts.',
                date: new Date(Date.now() - 172800000).toISOString()
            }
        ];
    }
    
    displayReviews(reviews) {
        const reviewsList = document.getElementById('reviews-list');
        if (!reviewsList) return;
        
        reviewsList.innerHTML = reviews.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <span class="review-author">${review.name}</span>
                    <span class="review-date">${new Date(review.date).toLocaleDateString()}</span>
                </div>
                <div class="review-stars">${'⭐'.repeat(review.rating)}</div>
                <div class="review-text">${review.text}</div>
            </div>
        `).join('');
    }
    
    updateReviewStats(reviews) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        const ratingElement = document.querySelector('.rating-value');
        const countElement = document.querySelector('.review-count');
        
        if (ratingElement) {
            ratingElement.textContent = avgRating.toFixed(1);
        }
        if (countElement) {
            countElement.textContent = `(${reviews.length} reviews)`;
        }
    }
    
    submitReview() {
        const name = document.getElementById('review-name').value;
        const text = document.getElementById('review-text').value;
        const rating = document.querySelectorAll('.star-rating i.active').length;
        
        if (!name || !text || rating === 0) {
            this.showNotification('Please fill all fields and select a rating', 'error');
            return;
        }
        
        const review = {
            id: Date.now(),
            name: name,
            rating: rating,
            text: text,
            date: new Date().toISOString()
        };
        
        // Save review
        const reviews = this.getReviews();
        reviews.unshift(review);
        localStorage.setItem('ebook-reviews', JSON.stringify(reviews));
        
        // Update display
        this.displayReviews(reviews);
        this.updateReviewStats(reviews);
        
        // Close modal
        document.getElementById('review-modal').classList.remove('active');
        
        // Clear form
        document.getElementById('review-name').value = '';
        document.getElementById('review-text').value = '';
        document.querySelectorAll('.star-rating i').forEach(star => {
            star.classList.remove('active', 'fas');
            star.classList.add('far');
        });
        
        this.showNotification('Thank you for your review!');
    }
    
    // Initialize star rating
    initStarRating() {
        const stars = document.querySelectorAll('.star-rating i');
        
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                stars.forEach((s, i) => {
                    if (i <= index) {
                        s.classList.remove('far');
                        s.classList.add('fas', 'active');
                    } else {
                        s.classList.remove('fas', 'active');
                        s.classList.add('far');
                    }
                });
            });
            
            star.addEventListener('mouseenter', () => {
                stars.forEach((s, i) => {
                    if (i <= index) {
                        s.classList.add('hover');
                    } else {
                        s.classList.remove('hover');
                    }
                });
            });
        });
        
        document.querySelector('.star-rating').addEventListener('mouseleave', () => {
            stars.forEach(s => s.classList.remove('hover'));
        });
    }
    
    // Social proof notifications
    showSocialProof() {
        const messages = [
            'John from California just started reading',
            'Sarah highlighted a passage in Chapter 3',
            'Mike completed the ebook and left a 5-star review',
            '15 people are reading this chapter right now',
            'This ebook has been shared 127 times today'
        ];
        
        setInterval(() => {
            if (Math.random() > 0.7) { // 30% chance every interval
                const message = messages[Math.floor(Math.random() * messages.length)];
                this.showSocialNotification(message);
            }
        }, 60000); // Every minute
    }
    
    showSocialNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'social-notification';
        notification.innerHTML = `
            <i class="fas fa-users"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
    
    // Recommendation engine
    getRecommendations() {
        // In production, this would use AI/ML
        return [
            {
                title: 'AI Content Creation Mastery',
                cover: '🤖',
                price: '$47'
            },
            {
                title: 'Passive Income Blueprint',
                cover: '💰',
                price: '$67'
            },
            {
                title: 'Digital Marketing Automation',
                cover: '📈',
                price: '$57'
            }
        ];
    }
    
    displayRecommendations() {
        const recommendations = this.getRecommendations();
        const container = document.createElement('div');
        container.className = 'recommendations-section';
        container.innerHTML = `
            <h3>Readers Also Enjoyed</h3>
            <div class="recommendations-grid">
                ${recommendations.map(book => `
                    <div class="recommendation-card">
                        <div class="book-cover">${book.cover}</div>
                        <div class="book-title">${book.title}</div>
                        <div class="book-price">${book.price}</div>
                        <button class="btn-primary">Learn More</button>
                    </div>
                `).join('')}
            </div>
        `;
        
        const reviewsSection = document.querySelector('.reviews-section');
        if (reviewsSection) {
            reviewsSection.parentNode.insertBefore(container, reviewsSection.nextSibling);
        }
    }
}

// Add styles for social features
const socialStyles = `
<style>
.share-tooltip {
    background: var(--text-primary);
    border-radius: 0.5rem;
    padding: 0.5rem;
    display: flex;
    gap: 0.5rem;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
}

.share-tooltip button {
    background: none;
    border: none;
    color: var(--bg-primary);
    font-size: 1.125rem;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    border-radius: 0.25rem;
    transition: background 0.2s;
}

.share-tooltip button:hover {
    background: rgba(255, 255, 255, 0.2);
}

.notification {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    padding: 1rem 1.5rem;
    background: var(--secondary-color);
    color: white;
    border-radius: 0.5rem;
    box-shadow: var(--shadow-lg);
    transform: translateY(100px);
    transition: transform 0.3s;
    z-index: 1000;
}

.notification.show {
    transform: translateY(0);
}

.notification.error {
    background: var(--danger-color);
}

.social-notification {
    position: fixed;
    bottom: 2rem;
    left: 2rem;
    padding: 0.75rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    box-shadow: var(--shadow-lg);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transform: translateX(-400px);
    transition: transform 0.3s;
    z-index: 999;
}

.social-notification.show {
    transform: translateX(0);
}

.social-notification i {
    color: var(--primary-color);
}

.recommendations-section {
    max-width: var(--reading-width);
    margin: 2rem auto;
    padding: 2rem;
    background: var(--bg-primary);
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
}

.recommendations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-top: 1.5rem;
}

.recommendation-card {
    text-align: center;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    transition: transform 0.2s;
}

.recommendation-card:hover {
    transform: translateY(-2px);
}

.book-cover {
    font-size: 4rem;
    margin-bottom: 1rem;
}

.book-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
}

.book-price {
    color: var(--primary-color);
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 1rem;
}
</style>
`;

// Add styles to page
document.head.insertAdjacentHTML('beforeend', socialStyles);

// Initialize social features
const social = new SocialFeatures();
window.social = social;
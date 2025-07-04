// Mobile Menu Component for Money Machine PWA

class MobileMenu {
    constructor() {
        this.isOpen = false;
        this.sidebarSelector = null;
        this.propertiesSelector = null;
        this.init();
    }

    init() {
        // Detect which UI we're in
        this.detectUI();
        
        // Create mobile menu toggle
        this.createMenuToggle();
        
        // Create mobile overlay
        this.createOverlay();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Handle orientation changes
        this.handleOrientationChange();
        
        // Add mobile viewport meta tag
        this.ensureViewportMeta();
    }

    detectUI() {
        const path = window.location.pathname;
        
        if (path.includes('dashboard')) {
            this.sidebarSelector = '.dashboard-sidebar';
            this.uiName = 'dashboard';
        } else if (path.includes('reader')) {
            this.sidebarSelector = '.reader-sidebar';
            this.uiName = 'reader';
        } else if (path.includes('analytics')) {
            this.sidebarSelector = '.analytics-sidebar';
            this.uiName = 'analytics';
        } else if (path.includes('control-panel')) {
            this.sidebarSelector = '.control-sidebar';
            this.uiName = 'control';
        } else if (path.includes('template-builder')) {
            this.sidebarSelector = '.builder-sidebar';
            this.propertiesSelector = '.properties-panel';
            this.uiName = 'builder';
        }
    }

    createMenuToggle() {
        // Don't create if already exists
        if (document.querySelector('.mobile-menu-toggle')) return;
        
        const toggle = document.createElement('button');
        toggle.className = 'mobile-menu-toggle';
        toggle.innerHTML = '<i class="fas fa-bars"></i>';
        toggle.setAttribute('aria-label', 'Toggle menu');
        
        // Only show on mobile
        if (window.innerWidth <= 768) {
            toggle.style.display = 'block';
        } else {
            toggle.style.display = 'none';
        }
        
        document.body.appendChild(toggle);
        
        // Click handler
        toggle.addEventListener('click', () => {
            this.toggleMenu();
        });
    }

    createOverlay() {
        // Don't create if already exists
        if (document.querySelector('.mobile-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        document.body.appendChild(overlay);
        
        // Click handler
        overlay.addEventListener('click', () => {
            this.closeAll();
        });
    }

    setupEventListeners() {
        // Window resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
        
        // Swipe gestures
        this.setupSwipeGestures();
        
        // Properties panel toggle for template builder
        if (this.uiName === 'builder') {
            this.createPropertiesToggle();
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeAll();
            }
        });
    }

    setupSwipeGestures() {
        let touchStartX = 0;
        let touchEndX = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        }, { passive: true });
        
        this.handleSwipe = () => {
            const swipeThreshold = 50;
            const swipeDistance = touchEndX - touchStartX;
            
            // Swipe right to open menu
            if (swipeDistance > swipeThreshold && touchStartX < 50 && !this.isOpen) {
                this.openMenu();
            }
            
            // Swipe left to close menu
            if (swipeDistance < -swipeThreshold && this.isOpen) {
                this.closeMenu();
            }
        };
    }

    createPropertiesToggle() {
        const toggle = document.createElement('button');
        toggle.className = 'mobile-properties-toggle';
        toggle.innerHTML = '<i class="fas fa-sliders-h"></i>';
        toggle.setAttribute('aria-label', 'Toggle properties');
        toggle.style.cssText = `
            display: none;
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 56px;
            height: 56px;
            background: var(--secondary, #10b981);
            color: white;
            border: none;
            border-radius: 50%;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            cursor: pointer;
        `;
        
        if (window.innerWidth <= 768) {
            toggle.style.display = 'block';
        }
        
        document.body.appendChild(toggle);
        
        toggle.addEventListener('click', () => {
            this.toggleProperties();
        });
    }

    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        const sidebar = document.querySelector(this.sidebarSelector);
        const overlay = document.querySelector('.mobile-overlay');
        const toggle = document.querySelector('.mobile-menu-toggle');
        
        if (sidebar) {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
            toggle.innerHTML = '<i class="fas fa-times"></i>';
            this.isOpen = true;
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Announce to screen readers
            this.announceToScreenReader('Menu opened');
        }
    }

    closeMenu() {
        const sidebar = document.querySelector(this.sidebarSelector);
        const overlay = document.querySelector('.mobile-overlay');
        const toggle = document.querySelector('.mobile-menu-toggle');
        
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
            toggle.innerHTML = '<i class="fas fa-bars"></i>';
            this.isOpen = false;
            
            // Restore body scroll
            document.body.style.overflow = '';
            
            // Announce to screen readers
            this.announceToScreenReader('Menu closed');
        }
    }

    toggleProperties() {
        const properties = document.querySelector(this.propertiesSelector);
        if (properties) {
            properties.classList.toggle('mobile-open');
            
            // Close menu if open
            if (this.isOpen) {
                this.closeMenu();
            }
        }
    }

    closeAll() {
        this.closeMenu();
        
        // Close properties if exists
        const properties = document.querySelector(this.propertiesSelector);
        if (properties) {
            properties.classList.remove('mobile-open');
        }
    }

    handleResize() {
        const toggle = document.querySelector('.mobile-menu-toggle');
        const propertiesToggle = document.querySelector('.mobile-properties-toggle');
        
        if (window.innerWidth <= 768) {
            if (toggle) toggle.style.display = 'block';
            if (propertiesToggle) propertiesToggle.style.display = 'block';
        } else {
            if (toggle) toggle.style.display = 'none';
            if (propertiesToggle) propertiesToggle.style.display = 'none';
            this.closeAll();
        }
    }

    handleOrientationChange() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResize();
            }, 100);
        });
    }

    ensureViewportMeta() {
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
            document.head.appendChild(viewport);
        }
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            announcement.remove();
        }, 1000);
    }

    // Touch-friendly click handler
    static addTouchFriendlyClick(element, handler) {
        let touchStartTime;
        let touchStartX;
        let touchStartY;
        
        element.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        element.addEventListener('touchend', (e) => {
            const touchEndTime = Date.now();
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const timeDiff = touchEndTime - touchStartTime;
            const distX = Math.abs(touchEndX - touchStartX);
            const distY = Math.abs(touchEndY - touchStartY);
            
            // If it's a quick tap without much movement
            if (timeDiff < 300 && distX < 10 && distY < 10) {
                e.preventDefault();
                handler(e);
            }
        });
        
        // Also keep click for non-touch devices
        element.addEventListener('click', handler);
    }
}

// Screen reader only styles
const srStyles = document.createElement('style');
srStyles.textContent = `
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
`;
document.head.appendChild(srStyles);

// Initialize mobile menu when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.mobileMenu = new MobileMenu();
    });
} else {
    window.mobileMenu = new MobileMenu();
}

// Export for use in other scripts
window.MobileMenu = MobileMenu;
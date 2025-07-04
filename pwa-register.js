// PWA Registration Script

// Check if service workers are supported
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
        
        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              showUpdateNotification();
            }
          });
        });
      })
      .catch(error => {
        console.error('ServiceWorker registration failed:', error);
      });
  });
}

// Check if app is installed
window.addEventListener('beforeinstallprompt', (event) => {
  // Prevent default install prompt
  event.preventDefault();
  
  // Store the event for later use
  window.deferredPrompt = event;
  
  // Show custom install button
  showInstallButton();
});

// Handle app installed event
window.addEventListener('appinstalled', () => {
  console.log('Money Machine PWA installed');
  hideInstallButton();
});

// Show update notification
function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.className = 'pwa-update-notification';
  notification.innerHTML = `
    <div class="pwa-update-content">
      <p>A new version is available!</p>
      <button onclick="updateApp()">Update</button>
      <button onclick="dismissUpdate()">Later</button>
    </div>
  `;
  
  document.body.appendChild(notification);
}

// Update the app
function updateApp() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }
}

// Dismiss update
function dismissUpdate() {
  const notification = document.querySelector('.pwa-update-notification');
  if (notification) {
    notification.remove();
  }
}

// Show install button
function showInstallButton() {
  // Check if already showing
  if (document.querySelector('.pwa-install-button')) return;
  
  const button = document.createElement('button');
  button.className = 'pwa-install-button';
  button.innerHTML = `
    <i class="fas fa-download"></i>
    <span>Install App</span>
  `;
  
  button.addEventListener('click', async () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      const result = await window.deferredPrompt.userChoice;
      
      console.log('Install prompt result:', result);
      
      if (result.outcome === 'accepted') {
        hideInstallButton();
      }
      
      window.deferredPrompt = null;
    }
  });
  
  document.body.appendChild(button);
}

// Hide install button
function hideInstallButton() {
  const button = document.querySelector('.pwa-install-button');
  if (button) {
    button.remove();
  }
}

// Add mobile viewport handler
function handleMobileViewport() {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(meta);
  }
}

// Handle offline/online status
window.addEventListener('online', () => {
  console.log('Back online');
  showOnlineNotification();
});

window.addEventListener('offline', () => {
  console.log('Gone offline');
  showOfflineNotification();
});

// Show online notification
function showOnlineNotification() {
  showStatusNotification('Back online!', 'success');
}

// Show offline notification
function showOfflineNotification() {
  showStatusNotification('You are offline. Some features may be limited.', 'warning');
}

// Generic status notification
function showStatusNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `pwa-status-notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Enable background sync
async function enableBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    
    try {
      await registration.sync.register('sync-analytics');
      console.log('Background sync registered');
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }
}

// Request notification permission
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
  }
}

// Initialize PWA features
handleMobileViewport();
enableBackgroundSync();
requestNotificationPermission();

// Add PWA styles
const style = document.createElement('style');
style.textContent = `
  /* PWA Update Notification */
  .pwa-update-notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a1a;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    animation: slideUp 0.3s ease-out;
  }
  
  .pwa-update-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .pwa-update-content button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .pwa-update-content button:first-of-type {
    background: #2563eb;
    color: white;
  }
  
  .pwa-update-content button:first-of-type:hover {
    background: #1d4ed8;
  }
  
  .pwa-update-content button:last-of-type {
    background: transparent;
    color: #9ca3af;
    border: 1px solid #374151;
  }
  
  .pwa-update-content button:last-of-type:hover {
    background: #374151;
  }
  
  /* PWA Install Button */
  .pwa-install-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 2rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
    z-index: 1000;
    animation: slideUp 0.3s ease-out;
  }
  
  .pwa-install-button:hover {
    background: #1d4ed8;
    transform: translateY(-2px);
    box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
  }
  
  /* PWA Status Notification */
  .pwa-status-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    transform: translateX(400px);
    transition: transform 0.3s ease-out;
    z-index: 10000;
  }
  
  .pwa-status-notification.show {
    transform: translateX(0);
  }
  
  .pwa-status-notification.success {
    background: #22c55e;
    color: white;
  }
  
  .pwa-status-notification.warning {
    background: #f59e0b;
    color: white;
  }
  
  .pwa-status-notification.error {
    background: #ef4444;
    color: white;
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translate(-50%, 20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .pwa-update-notification {
      left: 20px;
      right: 20px;
      transform: none;
      bottom: 60px;
    }
    
    .pwa-install-button {
      bottom: 80px;
    }
    
    .pwa-status-notification {
      left: 20px;
      right: 20px;
    }
  }
`;
document.head.appendChild(style);
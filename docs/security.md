# 🔒 Security Best Practices

## WebSocket Dashboard Security

### Local-Only Binding (Default)

By default, the WebSocket server binds to `127.0.0.1` (localhost only):

```python
# Default configuration - SECURE
server = RealWebSocketServer(host='127.0.0.1', port=8765)
```

### External Access Configuration

If you need external access, follow these security measures:

#### 1. Use Environment Variables

```bash
# .env file
WEBSOCKET_HOST=0.0.0.0  # Allows external connections
WEBSOCKET_PORT=8765
DASHBOARD_TOKEN=your-secure-random-token-here
```

#### 2. Token Authentication

```python
# In websocket_server_real.py
async def handle_client(self, websocket, path):
    # Require token for external connections
    if self.host != '127.0.0.1':
        auth_msg = await websocket.recv()
        auth_data = json.loads(auth_msg)
        
        if auth_data.get('token') != os.getenv('DASHBOARD_TOKEN'):
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid authentication token'
            }))
            await websocket.close()
            return
```

#### 3. HTTPS Proxy with Nginx

```nginx
# /etc/nginx/sites-available/pipeline-dashboard
server {
    listen 443 ssl;
    server_name dashboard.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /ws {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location / {
        root /path/to/dashboard;
        try_files $uri /dashboard.html;
    }
}
```

## API Key Management

### Never Commit Keys

```bash
# .gitignore
.env
.env.local
.env.production
*.key
secrets/
```

### Use Environment Variables

```python
# Bad - NEVER DO THIS
IDEOGRAM_KEY = "sk-abc123..."

# Good - Use environment variables
IDEOGRAM_KEY = os.getenv('IDEOGRAM_API_KEY')
if not IDEOGRAM_KEY:
    raise ValueError("IDEOGRAM_API_KEY not set")
```

### Secure Key Storage Options

1. **Development**: `.env` files (git-ignored)
2. **Production**: 
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Environment variables in CI/CD

### Key Rotation

```python
# Implement key versioning
class APIKeyManager:
    def __init__(self):
        self.keys = {
            'v1': os.getenv('API_KEY_V1'),
            'v2': os.getenv('API_KEY_V2'),
            'current': os.getenv('API_KEY_CURRENT_VERSION', 'v2')
        }
    
    def get_current_key(self):
        return self.keys[self.keys['current']]
```

## File System Security

### Path Validation

```python
# Prevent directory traversal attacks
def validate_path(user_path):
    # Resolve to absolute path
    abs_path = os.path.abspath(user_path)
    
    # Ensure it's within project directory
    if not abs_path.startswith(PROJECT_ROOT):
        raise ValueError("Invalid path: outside project directory")
    
    return abs_path
```

### File Upload Restrictions

```python
ALLOWED_EXTENSIONS = {'.md', '.txt', '.jpg', '.png', '.pdf', '.epub'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def validate_upload(file):
    # Check extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"File type {ext} not allowed")
    
    # Check size
    file.seek(0, 2)  # Seek to end
    size = file.tell()
    file.seek(0)  # Reset
    
    if size > MAX_FILE_SIZE:
        raise ValueError(f"File too large: {size} bytes")
```

## Content Security

### Sanitize User Input

```python
import bleach

def sanitize_markdown(content):
    # Allow only safe markdown
    allowed_tags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 
                    'h4', 'h5', 'h6', 'blockquote', 'code', 'pre', 
                    'ul', 'ol', 'li', 'hr', 'img', 'a']
    
    allowed_attributes = {
        'img': ['src', 'alt', 'title'],
        'a': ['href', 'title']
    }
    
    return bleach.clean(content, tags=allowed_tags, 
                       attributes=allowed_attributes)
```

### Prevent XSS in Generated HTML

```javascript
// Safe HTML generation
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Use in templates
const safeTitle = escapeHtml(userInput.title);
html += `<h1>${safeTitle}</h1>`;
```

## Authentication & Authorization

### User Sessions

```python
import secrets
from datetime import datetime, timedelta

class SessionManager:
    def __init__(self):
        self.sessions = {}
    
    def create_session(self, user_id):
        token = secrets.token_urlsafe(32)
        self.sessions[token] = {
            'user_id': user_id,
            'created': datetime.now(),
            'expires': datetime.now() + timedelta(hours=24)
        }
        return token
    
    def validate_session(self, token):
        session = self.sessions.get(token)
        if not session:
            return None
        
        if datetime.now() > session['expires']:
            del self.sessions[token]
            return None
        
        return session['user_id']
```

### Role-Based Access

```python
class RoleManager:
    ROLES = {
        'admin': ['read', 'write', 'delete', 'publish'],
        'author': ['read', 'write', 'publish'],
        'editor': ['read', 'write'],
        'viewer': ['read']
    }
    
    def can_user_perform(self, user_role, action):
        return action in self.ROLES.get(user_role, [])
```

## Secure Communication

### HTTPS for Web Interface

```python
# Force HTTPS in production
@app.before_request
def force_https():
    if not request.is_secure and app.env != 'development':
        return redirect(request.url.replace('http://', 'https://'))
```

### Encrypt Sensitive Data

```python
from cryptography.fernet import Fernet

class DataEncryptor:
    def __init__(self):
        self.key = os.getenv('ENCRYPTION_KEY').encode()
        self.cipher = Fernet(self.key)
    
    def encrypt(self, data: str) -> str:
        return self.cipher.encrypt(data.encode()).decode()
    
    def decrypt(self, encrypted: str) -> str:
        return self.cipher.decrypt(encrypted.encode()).decode()
```

## Logging & Monitoring

### Secure Logging

```python
import logging

# Configure secure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/pipeline/app.log'),
        logging.StreamHandler()
    ]
)

# Filter sensitive data
class SensitiveDataFilter(logging.Filter):
    def filter(self, record):
        # Remove API keys from logs
        if hasattr(record, 'msg'):
            record.msg = re.sub(r'api_key=\S+', 'api_key=***', record.msg)
        return True

logger = logging.getLogger(__name__)
logger.addFilter(SensitiveDataFilter())
```

### Security Monitoring

```python
class SecurityMonitor:
    def __init__(self):
        self.failed_attempts = {}
    
    def record_failed_login(self, ip_address):
        if ip_address not in self.failed_attempts:
            self.failed_attempts[ip_address] = []
        
        self.failed_attempts[ip_address].append(datetime.now())
        
        # Check for brute force
        recent_attempts = [
            t for t in self.failed_attempts[ip_address]
            if datetime.now() - t < timedelta(minutes=15)
        ]
        
        if len(recent_attempts) > 5:
            self.block_ip(ip_address)
            logger.warning(f"Blocked IP {ip_address} - too many failed attempts")
```

## Regular Security Audits

### Dependency Scanning

```bash
# Node.js dependencies
npm audit
npm audit fix

# Python dependencies
pip-audit
safety check
```

### Code Scanning

```bash
# Static analysis
bandit -r src/  # Python
eslint --ext .js,.jsx src/  # JavaScript

# Secrets scanning
trufflehog filesystem /path/to/repo
```

## Incident Response

### Security Incident Checklist

1. **Identify** the security breach
2. **Contain** the damage
3. **Investigate** root cause
4. **Remediate** vulnerabilities
5. **Document** lessons learned
6. **Update** security measures

### Contact Information

- Security Team: security@claude-elite.dev
- Emergency: +1-xxx-xxx-xxxx
- PGP Key: [Download](https://claude-elite.dev/security.asc)

## Compliance

### GDPR Compliance

- User data encryption
- Right to deletion
- Data portability
- Privacy by design

### Industry Standards

- OWASP Top 10 compliance
- SOC 2 Type II (in progress)
- ISO 27001 (planned)
// Chat embedder module for HTML ebooks
module.exports = {
  getChatEmbedCode: (config = {}) => {
    const { 
      apiKey = 'YOUR_CLAUDE_KEY',
      rateLimit = 10,
      ratePeriod = 3600000, // 1 hour in ms
      theme = 'light'
    } = config;
    
    return `
<!-- AI Chat Widget -->
<style>
  #ai-chat-widget {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    max-height: 500px;
    background: var(--bg-color, #ffffff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    z-index: 1000;
  }
  
  #ai-chat-widget.minimized {
    height: 60px;
    max-height: 60px;
  }
  
  .chat-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px;
    border-radius: 12px 12px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
  }
  
  .chat-header h4 {
    margin: 0;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .chat-toggle {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .chat-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-height: 400px;
  }
  
  #ai-chat-widget.minimized .chat-body {
    display: none;
  }
  
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .chat-message {
    padding: 10px 15px;
    border-radius: 8px;
    max-width: 80%;
    word-wrap: break-word;
  }
  
  .chat-message.user {
    background: #f0f0f0;
    align-self: flex-end;
    margin-left: auto;
  }
  
  .chat-message.ai {
    background: #e8f4f8;
    align-self: flex-start;
    border: 1px solid #d0e8f0;
  }
  
  .chat-input-container {
    padding: 15px;
    border-top: 1px solid var(--border-color, #e0e0e0);
    display: flex;
    gap: 10px;
  }
  
  .chat-input {
    flex: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
  }
  
  .chat-input:focus {
    border-color: #667eea;
  }
  
  .chat-send {
    background: #667eea;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.3s;
  }
  
  .chat-send:hover {
    background: #5a67d8;
  }
  
  .chat-send:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  
  .rate-limit-notice {
    font-size: 12px;
    color: #666;
    text-align: center;
    padding: 5px;
  }
  
  @media (max-width: 600px) {
    #ai-chat-widget {
      width: 90%;
      right: 5%;
      left: 5%;
    }
  }
</style>

<div id="ai-chat-widget" class="minimized">
  <div class="chat-header" onclick="toggleChat()">
    <h4>
      <span>🤖</span>
      AI Assistant
    </h4>
    <button class="chat-toggle" id="chat-toggle-btn">▲</button>
  </div>
  
  <div class="chat-body">
    <div class="chat-messages" id="chat-messages">
      <div class="chat-message ai">
        👋 Hi! I'm here to help you understand and apply the concepts in this ebook. Ask me anything!
      </div>
    </div>
    
    <div class="chat-input-container">
      <input 
        type="text" 
        class="chat-input" 
        id="chat-input" 
        placeholder="Ask a question..."
        onkeypress="if(event.key==='Enter') sendMessage()"
      />
      <button class="chat-send" id="chat-send" onclick="sendMessage()">Send</button>
    </div>
    
    <div class="rate-limit-notice" id="rate-limit-notice"></div>
  </div>
</div>

<script type="module">
// Rate limiting with localStorage
const RATE_LIMIT = ${rateLimit};
const RATE_PERIOD = ${ratePeriod};
const STORAGE_KEY = 'ai_chat_usage';

function getRateLimit() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return { count: 0, resetTime: Date.now() + RATE_PERIOD };
  
  const data = JSON.parse(stored);
  if (Date.now() > data.resetTime) {
    return { count: 0, resetTime: Date.now() + RATE_PERIOD };
  }
  return data;
}

function updateRateLimit() {
  const limit = getRateLimit();
  limit.count++;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limit));
  return limit;
}

function canSendMessage() {
  const limit = getRateLimit();
  return limit.count < RATE_LIMIT;
}

window.toggleChat = function() {
  const widget = document.getElementById('ai-chat-widget');
  const toggleBtn = document.getElementById('chat-toggle-btn');
  
  if (widget.classList.contains('minimized')) {
    widget.classList.remove('minimized');
    toggleBtn.textContent = '▼';
  } else {
    widget.classList.add('minimized');
    toggleBtn.textContent = '▲';
  }
}

window.sendMessage = async function() {
  const input = document.getElementById('chat-input');
  const messagesContainer = document.getElementById('chat-messages');
  const sendBtn = document.getElementById('chat-send');
  const message = input.value.trim();
  
  if (!message) return;
  
  if (!canSendMessage()) {
    const limit = getRateLimit();
    const remainingTime = Math.ceil((limit.resetTime - Date.now()) / 60000);
    document.getElementById('rate-limit-notice').textContent = 
      \`Rate limit reached. Try again in \${remainingTime} minutes.\`;
    return;
  }
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-message user';
  userMsg.textContent = message;
  messagesContainer.appendChild(userMsg);
  
  // Clear input and disable send
  input.value = '';
  sendBtn.disabled = true;
  sendBtn.textContent = 'Thinking...';
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  try {
    // Update rate limit
    const limit = updateRateLimit();
    const remaining = RATE_LIMIT - limit.count;
    document.getElementById('rate-limit-notice').textContent = 
      \`\${remaining} questions remaining this hour\`;
    
    // Get ebook context
    const ebookTitle = document.querySelector('h1')?.textContent || 'this ebook';
    const currentChapter = document.querySelector('.chapter.active h2')?.textContent || '';
    
    // Create context-aware prompt
    const contextPrompt = \`You are an AI assistant helping a reader understand "\${ebookTitle}". 
    \${currentChapter ? \`They are currently reading the chapter: "\${currentChapter}".'\` : ''}
    Answer their question concisely and helpfully. Question: \${message}\`;
    
    // Call Claude API (simplified for demo - in production, use server proxy)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': '${apiKey}',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: contextPrompt
        }]
      })
    });
    
    if (!response.ok) throw new Error('API request failed');
    
    const data = await response.json();
    const aiResponse = data.content[0].text;
    
    // Add AI response
    const aiMsg = document.createElement('div');
    aiMsg.className = 'chat-message ai';
    aiMsg.textContent = aiResponse;
    messagesContainer.appendChild(aiMsg);
    
  } catch (error) {
    console.error('Chat error:', error);
    
    // Fallback response
    const aiMsg = document.createElement('div');
    aiMsg.className = 'chat-message ai';
    aiMsg.textContent = "I'm having trouble connecting right now. Please try again later or continue reading the ebook for more information.";
    messagesContainer.appendChild(aiMsg);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const limit = getRateLimit();
  const remaining = RATE_LIMIT - limit.count;
  if (remaining < RATE_LIMIT) {
    document.getElementById('rate-limit-notice').textContent = 
      \`\${remaining} questions remaining this hour\`;
  }
});
</script>
`;
  },
  
  // Inject chat widget into HTML
  injectIntoHTML: (htmlContent, config) => {
    const chatCode = module.exports.getChatEmbedCode(config);
    
    // Insert before closing body tag
    return htmlContent.replace('</body>', chatCode + '\n</body>');
  }
};
// Chat embedder with WebSocket support (no API keys exposed!)
module.exports = {
  getChatEmbedCode: (config = {}) => {
    const { 
      wsUrl = 'ws://localhost:3001',
      rateLimit = 10,
      ratePeriod = 3600000,
      theme = 'light'
    } = config;
    
    return `
<!-- AI Chat Widget (WebSocket Version) -->
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
  
  .chat-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4ade80;
  }
  
  .chat-status.offline {
    background: #ef4444;
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
  
  .chat-message.system {
    background: #fef3c7;
    align-self: center;
    font-size: 12px;
    color: #92400e;
    text-align: center;
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
      <span class="chat-status" id="chat-status"></span>
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

<script>
// WebSocket connection
let ws = null;
let wsReconnectTimer = null;
let remainingQuestions = ${rateLimit};

// Connect to WebSocket server
function connectWebSocket() {
  const statusIndicator = document.getElementById('chat-status');
  
  try {
    ws = new WebSocket('${wsUrl}');
    
    ws.onopen = () => {
      console.log('Chat connected');
      statusIndicator.classList.remove('offline');
      addSystemMessage('Connected to AI Assistant');
      
      // Clear reconnect timer
      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'welcome':
          remainingQuestions = data.rateLimit;
          updateRateLimit();
          break;
          
        case 'answer':
          addAIMessage(data.response);
          remainingQuestions = data.remaining;
          updateRateLimit();
          enableInput();
          break;
          
        case 'status':
          // Update button text
          document.getElementById('chat-send').textContent = 'Thinking...';
          break;
          
        case 'error':
          addSystemMessage(data.message);
          enableInput();
          break;
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      statusIndicator.classList.add('offline');
    };
    
    ws.onclose = () => {
      console.log('Chat disconnected');
      statusIndicator.classList.add('offline');
      addSystemMessage('Connection lost. Reconnecting...');
      
      // Attempt to reconnect after 5 seconds
      wsReconnectTimer = setTimeout(connectWebSocket, 5000);
    };
    
  } catch (error) {
    console.error('Failed to connect:', error);
    statusIndicator.classList.add('offline');
    
    // Retry connection
    wsReconnectTimer = setTimeout(connectWebSocket, 5000);
  }
}

// UI Functions
window.toggleChat = function() {
  const widget = document.getElementById('ai-chat-widget');
  const toggleBtn = document.getElementById('chat-toggle-btn');
  
  if (widget.classList.contains('minimized')) {
    widget.classList.remove('minimized');
    toggleBtn.textContent = '▼';
    
    // Connect WebSocket when opening chat
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }
  } else {
    widget.classList.add('minimized');
    toggleBtn.textContent = '▲';
  }
}

window.sendMessage = function() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (!message) return;
  
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    addSystemMessage('Not connected. Please wait...');
    connectWebSocket();
    return;
  }
  
  // Add user message
  addUserMessage(message);
  
  // Get context
  const context = {
    title: document.querySelector('h1')?.textContent || 'this ebook',
    chapter: document.querySelector('.chapter.active h2')?.textContent || ''
  };
  
  // Send via WebSocket
  ws.send(JSON.stringify({
    type: 'question',
    question: message,
    context: context
  }));
  
  // Clear input and disable
  input.value = '';
  disableInput();
}

function addUserMessage(text) {
  const messagesContainer = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'chat-message user';
  msg.textContent = text;
  messagesContainer.appendChild(msg);
  scrollToBottom();
}

function addAIMessage(text) {
  const messagesContainer = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'chat-message ai';
  msg.textContent = text;
  messagesContainer.appendChild(msg);
  scrollToBottom();
}

function addSystemMessage(text) {
  const messagesContainer = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'chat-message system';
  msg.textContent = text;
  messagesContainer.appendChild(msg);
  scrollToBottom();
}

function scrollToBottom() {
  const messagesContainer = document.getElementById('chat-messages');
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function disableInput() {
  document.getElementById('chat-input').disabled = true;
  document.getElementById('chat-send').disabled = true;
  document.getElementById('chat-send').textContent = 'Sending...';
}

function enableInput() {
  document.getElementById('chat-input').disabled = false;
  document.getElementById('chat-send').disabled = false;
  document.getElementById('chat-send').textContent = 'Send';
}

function updateRateLimit() {
  const notice = document.getElementById('rate-limit-notice');
  if (remainingQuestions < ${rateLimit}) {
    notice.textContent = \`\${remainingQuestions} questions remaining this hour\`;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Don't auto-connect until user opens chat
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
#!/bin/bash

# Test Gemini Pipeline
# Testa o pipeline completo com Google Gemini 2.5 Pro

echo "🧪 Teste do Pipeline com Gemini 2.5 Pro"
echo "======================================"

# Verificar se a API key está configurada
if [ -z "$GOOGLE_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  AVISO: Nenhuma API key do Gemini configurada"
    echo "   O pipeline usará conteúdo de fallback"
    echo ""
    echo "Para usar a API real, configure:"
    echo "   export GOOGLE_API_KEY=sua_chave_aqui"
    echo "   ou"
    echo "   export GEMINI_API_KEY=sua_chave_aqui"
    echo ""
fi

# Opção 1: Testar apenas o writer
echo "1️⃣ Testando o Writer Gemini isoladamente..."
node agents/writer-gemini.js --outline test/outline.json --chapter 1 --output test/gemini-direct-test
echo ""

# Opção 2: Testar o orchestrator completo
echo "2️⃣ Testando o Orchestrator Gemini..."
node scripts/orchestrator-gemini.js "AI Business Automation" --chapters 3 --style business --workdir test/gemini-orchestrator-test
echo ""

# Opção 3: Testar via admin dashboard
echo "3️⃣ Para testar via Admin Dashboard:"
echo "   1. Inicie o Redis: redis-server"
echo "   2. Inicie os workers: node scripts/start-workers-gemini.js"
echo "   3. Inicie o admin: cd admin && npm start"
echo "   4. Acesse: http://localhost:3001"
echo ""

echo "✅ Teste concluído!"
echo ""
echo "📁 Verifique os resultados em:"
echo "   - test/gemini-direct-test/chapter-1.md"
echo "   - test/gemini-orchestrator-test/html/index.html"
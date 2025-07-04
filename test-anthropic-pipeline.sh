#!/bin/bash

# Test Anthropic Pipeline
# Testa o pipeline completo com Anthropic Claude

echo "🧪 Teste do Pipeline com Anthropic Claude"
echo "========================================="

# Verificar se a API key está configurada
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  AVISO: ANTHROPIC_API_KEY não configurada"
    echo "   O pipeline usará conteúdo de fallback"
    echo ""
    echo "Para usar a API real, configure:"
    echo "   export ANTHROPIC_API_KEY=sua_chave_aqui"
    echo ""
else
    echo "✅ ANTHROPIC_API_KEY configurada"
fi

# Testar o writer diretamente
echo ""
echo "1️⃣ Testando o Writer Anthropic..."
node agents/writer-wrapper.js --outline test/outline.json --chapter 1 --output test/anthropic-test

# Testar o orchestrator híbrido
echo ""
echo "2️⃣ Testando o Orchestrator Híbrido..."
node scripts/orchestrator-hybrid.js "AI Business Guide" --chapters 3 --workdir test/anthropic-hybrid-test

# Instruções para admin
echo ""
echo "3️⃣ Para testar via Admin Dashboard:"
echo "   1. Inicie o Redis: redis-server"
echo "   2. Inicie os workers: node scripts/start-workers-simple.js"
echo "   3. Inicie o admin: cd admin && npm start"
echo "   4. Acesse: http://localhost:3001"
echo ""
echo "✅ Teste concluído!"
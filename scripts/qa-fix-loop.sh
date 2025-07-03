#!/bin/bash
# Loop de Correção de Qualidade para PDF Digital

echo "🔄 Loop de Correção de Qualidade"
echo "================================"

MAX_ATTEMPTS=10
ATTEMPT=1

# Backup do preset original
cp scripts/pdf-presets/digital.js scripts/pdf-presets/digital.js.backup

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo -e "\n📍 Tentativa $ATTEMPT de $MAX_ATTEMPTS"
    echo "------------------------"
    
    # Se não é a primeira tentativa, ajustar margens
    if [ $ATTEMPT -gt 1 ]; then
        echo "🔧 Ajustando margens no preset digital..."
        
        # Aumentar margens progressivamente
        node -e "
        const fs = require('fs');
        const presetPath = 'scripts/pdf-presets/digital.js';
        let content = fs.readFileSync(presetPath, 'utf8');
        
        // Aumentar margens em 5mm a cada tentativa
        const increment = 5 * ${ATTEMPT};
        const newMargin = 20 + increment;
        
        content = content.replace(
            /margin: {[\s\S]*?}/,
            \`margin: {
                top: '\${newMargin}mm',
                right: '\${newMargin}mm',
                bottom: '\${newMargin}mm',
                left: '\${newMargin}mm'
            }\`
        );
        
        // Reduzir max-width do body para evitar overflow
        const newMaxWidth = 45 - (${ATTEMPT} * 2);
        content = content.replace(
            /max-width: \d+rem/,
            \`max-width: \${newMaxWidth}rem\`
        );
        
        fs.writeFileSync(presetPath, content);
        console.log('✅ Margens ajustadas para ' + newMargin + 'mm');
        console.log('✅ Max-width ajustado para ' + newMaxWidth + 'rem');
        "
    fi
    
    # Gerar PDF
    echo -e "\n📄 Gerando PDF com preset digital..."
    SKIP_PDF_QA=1 node scripts/generate-pdf-unified.js -p digital -o build/dist/ebook-digital-final.pdf
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao gerar PDF"
        exit 1
    fi
    
    # Aguardar um pouco para garantir que o arquivo foi escrito
    sleep 2
    
    # Verificar qualidade
    echo -e "\n🔍 Verificando qualidade visual..."
    if node scripts/qa-pdf-visual-complete.js build/dist/ebook-digital-final.pdf > build/qa-temp.log 2>&1; then
        echo "✅ PDF APROVADO NO QA VISUAL!"
        
        # Mostrar resumo
        echo -e "\n📊 Resumo da aprovação:"
        grep -E "Páginas analisadas:|NENHUM PROBLEMA" build/qa-temp.log
        
        # Salvar PDF aprovado com timestamp
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        cp build/dist/ebook-digital-final.pdf "build/dist/ebook-digital-approved-${TIMESTAMP}.pdf"
        echo -e "\n✅ PDF aprovado salvo como: ebook-digital-approved-${TIMESTAMP}.pdf"
        
        rm build/qa-temp.log
        break
    else
        # Mostrar problemas encontrados
        echo "❌ Problemas encontrados:"
        grep -E "PROBLEMAS ENCONTRADOS:|Página [0-9]+:" build/qa-temp.log | head -20
        echo "..."
        
        # Contar problemas
        PROBLEM_COUNT=$(grep -c "Página [0-9]+:" build/qa-temp.log)
        echo -e "\nTotal de problemas: $PROBLEM_COUNT"
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    
    if [ $ATTEMPT -le $MAX_ATTEMPTS ]; then
        echo -e "\n⏳ Preparando próxima tentativa em 3 segundos..."
        sleep 3
    fi
done

# Verificar resultado final
if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo -e "\n❌ FALHOU após $MAX_ATTEMPTS tentativas"
    echo "   PDF ainda tem problemas de qualidade."
    echo "   Verifique build/qa-analysis/ para análise detalhada."
    
    # Restaurar preset original
    echo -e "\n🔄 Restaurando preset original..."
    cp scripts/pdf-presets/digital.js.backup scripts/pdf-presets/digital.js
    
    exit 1
else
    echo -e "\n🎉 SUCESSO!"
    echo "   PDF aprovado após $((ATTEMPT - 1)) tentativa(s)"
    echo "   Arquivo final: build/dist/ebook-digital-final.pdf"
    
    # Executar teste específico para Adobe
    echo -e "\n🎯 Executando teste específico para Adobe Acrobat..."
    node scripts/test-adobe-specific.js
fi

# Limpar backup
rm -f scripts/pdf-presets/digital.js.backup
rm -f build/qa-temp.log
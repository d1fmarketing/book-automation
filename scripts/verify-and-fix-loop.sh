#!/bin/bash
# Loop infinito até o PDF estar perfeito

echo "🔄 Iniciando loop de verificação e correção do PDF..."

while true; do
    echo -e "\n🏗️  Gerando PDF..."
    npm run build:pdf
    
    echo -e "\n🔍 Verificando PDF..."
    node scripts/pdf-qa-loop-real.js
    
    if [ $? -eq 0 ]; then
        echo -e "\n✅ PDF PERFEITO! Capa encontrada e formato correto!"
        echo "📄 Arquivo final: release/ebook.pdf"
        break
    else
        echo -e "\n❌ PDF com problemas. Tentando correção..."
        echo "⏳ Aguardando 2 segundos antes de tentar novamente..."
        sleep 2
    fi
done

echo -e "\n🎉 Processo concluído com sucesso!"
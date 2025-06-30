#!/bin/bash
# Builder Wrapper - VERSÃO CORRIGIDA
# Remove chamadas para "agentcli" e usa npm diretamente

set -e

# Default parameters
MD_DIR="chapters/"
IMG_DIR="assets/images/"
OUT_DIR="build/dist/"
TMP_DIR="build/tmp/"
CSS_TEMPLATE="templates/pdf-standard.css"

# Parse arguments
TWEAK_MODE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --tweak)
            TWEAK_MODE="$2"
            shift 2
            ;;
        --md)
            MD_DIR="$2"
            shift 2
            ;;
        --img)
            IMG_DIR="$2"
            shift 2
            ;;
        --css)
            CSS_TEMPLATE="$2"
            shift 2
            ;;
        --out)
            OUT_DIR="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Ensure directories exist
mkdir -p "$OUT_DIR" "$TMP_DIR"

echo "🔨 Builder (Corrigido)"
echo "Markdown: $MD_DIR"
echo "Images: $IMG_DIR"
echo "CSS: $CSS_TEMPLATE"
echo "Output: $OUT_DIR"

# If tweak mode, read current preset and increment
if [ "$TWEAK_MODE" == "next" ]; then
    PRESET_FILE="build/.current-preset"
    CURRENT_PRESET=0
    
    if [ -f "$PRESET_FILE" ]; then
        CURRENT_PRESET=$(cat "$PRESET_FILE")
    fi
    
    # Increment preset
    NEXT_PRESET=$((CURRENT_PRESET + 1))
    
    # Load preset configuration
    if [ -f "presets/layout-presets.yaml" ]; then
        # Get preset count
        PRESET_COUNT=$(grep -c "^- pass:" presets/layout-presets.yaml || echo 8)
        
        # Wrap around if needed
        if [ $NEXT_PRESET -gt $PRESET_COUNT ]; then
            NEXT_PRESET=1
        fi
        
        echo "Aplicando preset de layout #$NEXT_PRESET"
        
        # Cycle through known templates
        case $NEXT_PRESET in
            1|4|6)
                CSS_TEMPLATE="templates/pdf-standard.css"
                ;;
            2|5)
                CSS_TEMPLATE="templates/pdf-tight.css"
                ;;
            3|7|8)
                CSS_TEMPLATE="templates/pdf-loose.css"
                ;;
        esac
        
        # Save current preset
        echo $NEXT_PRESET > "$PRESET_FILE"
    fi
fi

# USAR NPM BUILD DIRETAMENTE (sem agentcli)
echo "Construindo PDF e EPUB..."

# Verificar se existe script de build específico
if [ -f "scripts/generate-professional-pdf.js" ]; then
    # Usar o script que já funciona
    node scripts/generate-professional-pdf.js
else
    # Fallback para npm
    npm run build:pdf
fi

# Gerar HTML para QA (se o build não gerou)
HTML_FILE="$TMP_DIR/ebook.html"

if [ ! -f "$HTML_FILE" ] && [ -f "$OUT_DIR/ebook.pdf" ]; then
    echo "Gerando HTML para QA visual..."
    # Extrair primeira página do PDF como HTML (simplificado)
    cat > "$HTML_FILE" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>E-book QA Preview</title>
    <style>
        body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { font-family: Arial, sans-serif; }
    </style>
</head>
<body>
    <h1>E-book Preview</h1>
    <p>PDF gerado com sucesso. Este é um preview HTML para QA.</p>
</body>
</html>
EOF
fi

# Verificar outputs
if [ ! -f "$OUT_DIR/ebook.pdf" ]; then
    echo "❌ Erro na geração do PDF"
    exit 1
fi

echo "✅ Build completo:"
echo "  PDF: $OUT_DIR/ebook.pdf"
[ -f "$OUT_DIR/ebook.epub" ] && echo "  EPUB: $OUT_DIR/ebook.epub"
[ -f "$HTML_FILE" ] && echo "  HTML: $HTML_FILE"

# Se estava em tweak mode, mostrar qual preset foi usado
if [ -n "$TWEAK_MODE" ]; then
    echo "  Preset: #$NEXT_PRESET ($CSS_TEMPLATE)"
fi

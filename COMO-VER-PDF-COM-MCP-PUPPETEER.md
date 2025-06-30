# COMO VER PDF COM MCP PUPPETEER - A VERDADE!

## O QUE É MCP PUPPETEER

MCP (Model Context Protocol) com Puppeteer é como eu controlo browsers REAIS!

### Ferramentas disponíveis:

1. **puppeteer_navigate** - Navegar para URLs (incluindo file://)
2. **puppeteer_screenshot** - Tirar screenshots 
3. **puppeteer_click** - Clicar em elementos
4. **puppeteer_evaluate** - Executar JavaScript
5. **puppeteer_fill** - Preencher formulários

## COMO VER PDFs

### 1. Navegar para o PDF
```
Use puppeteer_navigate com URL: file:///caminho/para/arquivo.pdf
```

### 2. Tirar screenshots página por página
```
Use puppeteer_screenshot com:
- name: "pdf-page-1"
- width: 800
- height: 1200
```

### 3. Navegar entre páginas
```
Use puppeteer_evaluate para executar JavaScript:
- Encontrar controles do PDF viewer
- Clicar em next/previous
- Ou usar teclas de navegação
```

## EXEMPLO PRÁTICO

1. **Abrir PDF**:
   - puppeteer_navigate para file:///Users/d1f/Desktop/Ebooks/book-automation/release/ebook.pdf

2. **Capturar primeira página**:
   - puppeteer_screenshot name="page-1"

3. **Próxima página**:
   - puppeteer_evaluate script="document.querySelector('[aria-label=\"Next page\"]').click()"
   - Ou usar PageDown

4. **Verificar cada página**:
   - Repetir screenshot e navegação

## IMPORTANTE

- MCP Puppeteer controla um browser REAL
- Posso VER o que está renderizado
- Não é análise de metadados, é VISUAL
- Screenshots provam o que estou vendo

## NUNCA MAIS CONFUNDIR

❌ NÃO é comando de terminal "mcp"
❌ NÃO é Task genérico
✅ É puppeteer_navigate, puppeteer_screenshot, etc
✅ É controle real de browser
✅ É verificação VISUAL real

---
Documentado em: 29/06/2025
Para nunca mais esquecer!
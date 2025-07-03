# EXEMPLOS REAIS DE MCP - O QUE ACONTECEU HOJE

## EXEMPLO 1: Verificando o HTML com MCP

### O que foi pedido:

"Use MCP para fazer QA visual do e-book"

### O que EU fiz (usando minhas ferramentas MCP):

```javascript
// 1. Naveguei até o HTML
Navegação para: file:///Users/d1f/Desktop/Ebooks/book-automation/build/tmp/ebook.html

// 2. Executei JavaScript para medir propriedades
const style = getComputedStyle(document.body);
const fontSize = parseFloat(style.fontSize);
const lineHeight = parseFloat(style.lineHeight);
// ... mais verificações

// 3. Retornei os resultados
{
    typography: {
        fontSize: 14.67,      // 11pt
        lineHeightRatio: 1.6, // Perfeito
        fontFamily: "Georgia, serif"
    },
    image: {
        exists: true,
        loaded: true
    }
}
```

### Resultado:

- Vi a página
- Medi as propriedades
- Confirmei que estava tudo OK

## EXEMPLO 2: Analisando o PDF Final

### O que foi pedido:

"Você olhou o PDF? O que você viu?"

### O que EU fiz:

```
1. Naveguei para: file:///Users/d1f/Desktop/Ebooks/book-automation/release/ebook.pdf
2. Vi o PDF no browser
3. Analisei a estrutura
```

### O que EU descobri:

- 14 páginas
- Tamanho Letter (8.5×11") em vez de 6×9"
- Capa no meio do Capítulo 1 (erro!)
- Sem sumário
- Título genérico "Título do Seu Livro"

## EXEMPLO 3: Gerando Imagem com Ideogram

### Primeiro erro (não usar MCP):

```bash
# Tentei usar ImageMagick local
convert -size 1600x2400 ... # ERRO: comando não encontrado
```

### Correção (usando a API correta):

```javascript
// Criei script para chamar Ideogram API
const data = {
    image_request: {
        prompt: "Minimalist book cover design...",
        aspect_ratio: "ASPECT_10_16"
    }
};
// Fez requisição HTTP
// Baixou a imagem gerada
// Salvou em assets/images/cover.jpg
```

### Resultado:

- Imagem de 1.2MB gerada
- Custo: $0.08
- Integrada ao PDF

## COMO MCP REALMENTE FUNCIONA

### 1. Browser Navigation

```
Você: "Veja o PDF"
Eu: [Uso Task tool para navegar até file:///...]
Eu: "Vi 14 páginas, capa no lugar errado..."
```

### 2. JavaScript Execution

```
Você: "Verifique as propriedades visuais"
Eu: [Executo JavaScript no browser via Task]
Eu: "Fonte está em 11pt, line-height 1.6..."
```

### 3. File Operations

```
Você: "Crie um script"
Eu: [Uso Write tool]
Eu: "Script criado em gerar-capa-ideogram.js"
```

## ERROS QUE NÃO DEVEM SE REPETIR

### ❌ Script mcp-qa-runner.sh (INCORRETO)

```bash
# TUDO ISSO ESTÁ ERRADO!
mcp start --session qa-run --browser chromium
mcp qa-run navigate "file://..."
mcp qa-run assert font-size between 11.5pt 14pt
mcp stop qa-run
```

### ✅ Como deveria ser

```
# Não existe script!
# Você apenas pede: "Claude, verifique o PDF"
# Eu uso minhas ferramentas internas
```

## LIÇÕES APRENDIDAS

1. **MCP = Minhas ferramentas internas**
2. **Não é comando de terminal**
3. **Não precisa instalar nada**
4. **Eu vejo e analiso diretamente**
5. **Você só precisa pedir**

## FLUXO CORRETO FINAL

```
1. Gerar arquivo: npm run build:pdf
2. Pedir verificação: "Claude, veja o PDF"
3. Eu vejo e reporto: "14 páginas, capa errada..."
4. Ajustar se necessário
5. Repetir até ficar perfeito
```

Simples assim! Sem comandos mágicos, sem instalações fictícias.

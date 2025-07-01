# MCP FUTURE INTEGRATIONS - PARA IMPLEMENTAR DEPOIS 📚

## IMPORTANTE: NÃO FAZER AGORA!
Este documento é um plano para o FUTURO. O sistema atual está funcionando bem com MCP básico (browser/filesystem). Estas são melhorias para quando você quiser evoluir o projeto.

## 1. ebook-mcp ⭐ (PRIORIDADE ALTA)
**Repositório**: https://github.com/onebirdrocks/ebook-mcp

### O que faz:
- Processa EPUB e PDF nativamente
- Extrai capítulos automaticamente  
- Gera EPUBs profissionais
- Suporta metadados completos
- Tradução de livros

### Como instalar (NO FUTURO):
```bash
# Em ambiente de teste primeiro!
cd /tmp
git clone https://github.com/onebirdrocks/ebook-mcp
cd ebook-mcp
npm install

# Adicionar ao Claude config
```

### Benefícios para o projeto:
- EPUB real em vez do arquivo de 21 bytes
- Extração automática de capítulos
- Metadados profissionais
- Conversão entre formatos

### Exemplo de uso:
```
Você: "Claude, extraia a estrutura do EPUB"
Eu: [Via ebook-mcp analiso estrutura completa]

Você: "Gere EPUB com TOC automático"
Eu: [Via ebook-mcp crio EPUB profissional]
```

## 2. mcp-pdf-tools (PRIORIDADE MÉDIA)
**Repositório**: https://github.com/hanweg/mcp-pdf-tools

### O que faz:
- Merge de PDFs
- Split por páginas
- Extração de texto
- Busca por padrões
- Rotação/crop

### Benefícios para o projeto:
- Juntar capa em página separada
- Extrair capítulos específicos
- Criar versões parciais
- Análise de conteúdo

### Exemplo de uso:
```
Você: "Coloque a capa como primeira página"
Eu: [Via mcp-pdf-tools faço merge correto]
```

## 3. Document Operations MCP (PRIORIDADE MÉDIA)
**Por**: Alejandro Ballesteros

### O que faz:
- Converte DOCX ↔ PDF ↔ EPUB ↔ HTML
- Mantém formatação
- Processa em lote
- Templates

### Benefícios:
- Aceitar manuscritos em Word
- Exportar para múltiplos formatos
- Manter consistência

## 4. mcp-pandoc (CRIAR NOSSO PRÓPRIO)
**Status**: Não existe ainda

### Ideia:
```javascript
// server.js
const { exec } = require('child_process');

// MCP wrapper para pandoc
function convertDocument(input, output, options) {
  exec(`pandoc ${input} -o ${output} ${options}`);
}
```

### Benefícios:
- Usar poder total do pandoc
- Templates LaTeX customizados
- Bibliografia/citações
- Formatos acadêmicos

## 5. mcp-calibre (CRIAR NOSSO PRÓPRIO)
**Status**: Não existe ainda

### Funcionalidades:
- Conversão profissional
- Otimização para Kindle
- Gestão de biblioteca
- Metadados ricos

## ROADMAP DE IMPLEMENTAÇÃO

### Fase 1 (Quando decidir melhorar)
1. Criar branch `feature/mcp-ebooks`
2. Instalar ebook-mcp em ambiente isolado
3. Testar com PDFs de exemplo
4. Validar que não quebra nada

### Fase 2
1. Integrar no workflow principal
2. Substituir geração EPUB atual
3. Adicionar testes automatizados

### Fase 3
1. Adicionar mcp-pdf-tools
2. Melhorar processamento de capas
3. Implementar split/merge

### Fase 4 (Avançado)
1. Criar mcp-pandoc próprio
2. Suporte LaTeX completo
3. Templates acadêmicos

## CONFIGURAÇÃO FUTURA

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "ebook-processor": {
      "command": "node",
      "args": ["/path/to/ebook-mcp/index.js"],
      "env": {
        "OUTPUT_FORMAT": "epub3",
        "QUALITY": "high"
      }
    },
    "pdf-tools": {
      "command": "node", 
      "args": ["/path/to/mcp-pdf-tools/server.js"]
    }
  }
}
```

## AVISOS IMPORTANTES

### ⚠️ ANTES DE IMPLEMENTAR:
1. **Backup completo** do projeto atual
2. **Branch separado** para testes
3. **Ambiente isolado** (Docker/VM)
4. **Testes extensivos** antes de merge
5. **Documentar mudanças**

### ✅ SINAIS DE QUE ESTÁ NA HORA:
- Precisar gerar EPUBs profissionais
- Múltiplos formatos de entrada
- Processamento em lote
- Metadados complexos
- Integração com publishers

### ❌ NÃO IMPLEMENTAR SE:
- Sistema atual atende bem
- Não há tempo para testes
- Projeto em produção
- Sem backup recente

## CONCLUSÃO

O sistema atual com MCP básico (browser + filesystem) está funcionando. Estas integrações são para quando você quiser transformar o projeto em uma suite profissional completa de publicação.

**Por enquanto: aproveite o que já funciona!** 🚀

## RECURSOS PARA ESTUDO

- https://modelcontextprotocol.io/docs
- https://github.com/modelcontextprotocol/awesome-mcp
- https://mcpservers.org/
- Exemplos de implementação em TypeScript/Python

---
*Documento criado em: 29/06/2025*
*Status: PLANEJAMENTO FUTURO - NÃO IMPLEMENTAR AGORA*
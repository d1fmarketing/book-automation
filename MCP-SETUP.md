# MCPs Configurados para Book Automation

## MCPs Ativos

### 1. Anthropic
- Geração de texto
- Análise de conteúdo
- Reescrita de capítulos

### 2. Filesystem
- Leitura/escrita de arquivos
- Gerenciamento de capítulos
- Acesso a templates

### 3. Memory
- Persistência de contexto
- Rastreamento de progresso
- Armazenamento de metadados do livro

### 4. GitHub
- Criação de PRs
- Versionamento
- Gerenciamento de releases

### 5. Brave Search
- Pesquisa de conteúdo
- Verificação de fatos
- Pesquisa de referências

### 6. Puppeteer
- Geração de PDFs
- Screenshots de preview
- Automação de browser

### 7. Sequential Thinking
- Planejamento estruturado
- Decomposição de tarefas
- Criação de outlines

## Uso no Projeto

### Para criar um novo livro:
1. Use Memory para armazenar conceito
2. Use Sequential Thinking para planejar
3. Use Filesystem para criar estrutura
4. Use Anthropic para gerar conteúdo
5. Use GitHub para versionar
6. Use Puppeteer para gerar PDF

### Para pesquisar tópicos:
1. Use Brave Search para encontrar informação
2. Use Anthropic para analisar e resumir
3. Use Memory para guardar insights

## Comandos Úteis

```bash
# Reiniciar Claude para aplicar mudanças
# macOS: Cmd+Q e reabrir

# Verificar logs MCP
tail -f ~/Library/Logs/Claude/*.log

# Testar MCP individual
npx @modelcontextprotocol/inspector
```

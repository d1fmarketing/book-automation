# Change Log - Ebook Automation Pipeline

Este arquivo documenta todas as mudanças realizadas no projeto com timestamps para rastreabilidade.

## 2025-07-02 20:56:00 UTC - Criação do Sistema de Rastreamento
- Criado: `.changes/CHANGELOG.md`
- Criado: `.changes/changed-files.json`
- Objetivo: Rastrear todas as modificações com data/hora para melhor controle do projeto
- Autor: Claude Assistant

## 2025-07-02 20:55:00 UTC - Criação do Preset Digital
- Criado: `scripts/pdf-presets/digital.js`
- Objetivo: Criar preset responsivo para ebooks digitais (sem tamanhos fixos 6×9")
- Features: Layout responsivo, media queries, dark mode support
- Autor: Claude Assistant

## 2025-07-02 20:54:00 UTC - Scripts de Análise DOM
- Criado: `scripts/generate-html-only.js`
- Criado: `scripts/test-digital-dom.js`
- Objetivo: Gerar HTML separadamente e analisar DOM antes de criar PDF
- Autor: Claude Assistant

## 2025-07-02 20:57:00 UTC - Correção de Overflows no Preset Digital
- Modificado: `scripts/pdf-presets/digital.js`
- Objetivo: Corrigir 13 overflows detectados em elementos PRE (blocos de código)
- Mudanças: 
  - Adicionado CSS específico para pre/code com overflow-x: auto
  - Adicionado max-width: 100% global para prevenir overflows
  - Adicionado suporte para table-wrapper com scroll horizontal
- Autor: Claude Assistant

---

### Formato de Entrada:
```
## YYYY-MM-DD HH:MM:SS UTC - Título da Mudança
- Ação: caminho/do/arquivo
- Objetivo: descrição clara
- Mudanças: detalhes específicos
- Autor: nome
```
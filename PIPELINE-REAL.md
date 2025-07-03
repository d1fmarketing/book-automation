# 📚 PIPELINE REAL DE EBOOKS DIGITAIS

## ✅ O Que Realmente Funciona (Testado e Validado)

### 1. 🎨 Geração de Capa com IA
```bash
node gerar-capa-ideogram.js
```
- **Custo**: $0.08 por capa
- **API**: Ideogram (chave configurada no .env)
- **Saída**: `pipeline-book/assets/images/cover.jpg`

### 2. 📄 Geração de HTML Responsivo
```bash
npm run build:html:digital
```
- **Preset**: Digital (sem tamanhos fixos)
- **Saída**: `build/tmp/ebook-digital.html`
- **Features**: Media queries, dark mode, zero overflows

### 3. 🔍 Verificação de Qualidade DOM
```bash
npm run qa:dom:digital
```
- **Verifica**: Overflows, tamanhos fixos, espaços em branco
- **Meta**: Zero overflows (exceto falso positivo do HTML)

### 4. 📕 Geração de PDF Digital
```bash
npm run build:pdf:digital
```
- **Formato**: A4 responsivo
- **Compatível**: Adobe Acrobat ✅
- **Saída**: `build/dist/ebook.pdf`

### 5. 📘 Geração de EPUB (Opcional)
```bash
npm run build:epub
```
- **Validação**: Automática
- **Saída**: `build/dist/ebook.epub`

## 🚀 Pipeline Completa Automatizada

### Comando Único:
```bash
./scripts/generate-complete-ebook.sh
```

### Com Opções:
```bash
# Gerar tudo (capa + PDF + EPUB)
GENERATE_COVER=1 GENERATE_EPUB=1 ./scripts/generate-complete-ebook.sh

# Só PDF (sem capa, sem EPUB)
./scripts/generate-complete-ebook.sh
```

## 📁 Estrutura de Arquivos

### Entrada:
```
chapters/
├── chapter-01-introduction.md
├── chapter-02-development.md
└── chapter-03-conclusion.md

metadata.yaml  # Título, autor, etc.
```

### Saída:
```
build/
├── dist/
│   ├── ebook.pdf              # PDF final
│   └── ebook.epub             # EPUB (se gerado)
├── tmp/
│   └── ebook-digital.html     # HTML intermediário
└── preview/
    └── cover-01.png           # Preview da capa
```

## 🛠️ Comandos Individuais

### Desenvolvimento:
```bash
# Contar palavras
npm run wordcount

# Verificar markdown
npm run lint

# Debug de overflows
npm run qa:debug:overflow
```

### Publicação (Configuração Pendente):
```bash
# Amazon KDP
npm run publish:kdp

# Apple Books
npm run publish:apple

# Google Play
npm run publish:google
```

## ⚠️ O Que NÃO Existe (Apesar da Documentação)

1. **agentcli** - Não está instalado
2. **5 Agentes Elite** - Conceitual, não implementado
3. **Automação de Pesquisa** - Não existe
4. **Geração de Conteúdo AI** - Não implementado

## 🎯 Próximos Passos Práticos

### 1. Para Gerar Seu Primeiro Ebook:
```bash
# Criar capítulos em chapters/
# Editar metadata.yaml
# Executar:
./scripts/generate-complete-ebook.sh
```

### 2. Para Publicar:
```bash
# Configurar credenciais em config/kdp-credentials.json
# Executar: npm run publish:kdp
```

### 3. Para Escalar:
- Implementar geração de conteúdo com Claude API
- Criar sistema de pesquisa de tópicos trending
- Automatizar todo o processo

## 📊 Status Atual

| Feature | Status | Comando |
|---------|--------|---------|
| Preset Digital | ✅ Funcionando | `npm run build:pdf:digital` |
| Geração de Capa | ✅ Funcionando | `node gerar-capa-ideogram.js` |
| PDF Responsivo | ✅ Funcionando | Validado no Adobe Acrobat |
| EPUB | ✅ Funcionando | `npm run build:epub` |
| Publicação KDP | ⚠️ Precisa Config | `npm run publish:kdp` |
| Geração de Conteúdo | ❌ Não Existe | - |
| Pesquisa de Tópicos | ❌ Não Existe | - |

## 🔧 Troubleshooting

### Problema: "agentcli not found"
**Solução**: Use os comandos npm documentados acima. O agentcli não existe.

### Problema: "Capa não encontrada no PDF"
**Solução**: Execute com `SKIP_PDF_QA=1` ou gere a capa primeiro.

### Problema: "Overflows detectados"
**Solução**: Use `npm run qa:debug:overflow` para identificar elementos problemáticos.

---

**Última atualização**: 2025-07-03
**Status**: Pipeline funcional para geração manual de ebooks digitais responsivos
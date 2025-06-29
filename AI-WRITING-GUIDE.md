# 🤖 AI Writing System - Guia Completo

Este sistema permite que você crie livros completos usando AI, desde o planejamento até a publicação final.

## 🚀 Quick Start

### 1. Configure seu projeto
```bash
# Edite o arquivo book-project.yaml com suas especificações
vim book-project.yaml
```

### 2. Gere o outline do livro
```bash
make ai-plan
```

### 3. Escreva o livro (capítulo por capítulo)
```bash
# Escreva o primeiro capítulo
make ai-write N=1

# Continue com os próximos
make ai-write-next

# Ou escreva tudo de uma vez
make ai-book-complete
```

## 📋 Comandos Disponíveis

### Planejamento
```bash
make ai-plan                    # Gera outline completo baseado no book-project.yaml
```

### Escrita
```bash
make ai-write N=1              # Escreve um capítulo específico
make ai-write-next             # Escreve o próximo capítulo pendente
make ai-book-complete          # Pipeline completo automatizado
```

### Pesquisa
```bash
make ai-research QUERY="bitcoin security"   # Pesquisa sobre tópico específico
```

## 🎯 Como Funciona

### 1. **MasterOrchestrator**
O cérebro central que coordena todos os agentes:
- Gerencia o estado do projeto
- Coordena a escrita de capítulos
- Mantém consistência entre capítulos

### 2. **BookPlannerAgent**
Cria o outline detalhado do livro:
- Analisa público-alvo
- Define estrutura de capítulos
- Gera ganchos de marketing
- Calcula estimativas

### 3. **AIWriterAgent**
Interface onde Claude escreve os capítulos:
- Mantém tom e estilo consistentes
- Integra pesquisas
- Adiciona exemplos práticos
- Gera imagens automaticamente

### 4. **ResearchAgent**
Pesquisa inteligente para conteúdo:
- Busca na web
- Analisa repositórios GitHub
- Coleta estatísticas
- Verifica fatos

## 📁 Arquivos Importantes

### `book-project.yaml`
Configuração central do seu livro:
- Título e informações básicas
- Público-alvo detalhado
- Especificações (número de capítulos, palavras)
- Estilo de escrita
- Estratégia de monetização

### `orchestrator-state.json`
Estado atual do projeto:
- Capítulos escritos
- Progresso atual
- Outline gerado

### `book-outline.json`
Outline detalhado gerado pela AI:
- Estrutura completa
- Pontos-chave por capítulo
- Estimativas de palavras

## 🔄 Workflow Completo

### Opção 1: Controle Manual
```bash
# 1. Configure o projeto
vim book-project.yaml

# 2. Gere o plano
make ai-plan

# 3. Revise o outline
cat book-outline.json

# 4. Escreva capítulo por capítulo
make ai-write N=1
# Revise o capítulo
make ai-write N=2
# Continue...

# 5. Gere imagens
make generate-images

# 6. Construa o livro
make all
```

### Opção 2: Totalmente Automatizado
```bash
# Configure e execute tudo
vim book-project.yaml
make ai-book-complete
```

## 💡 Dicas Importantes

### 1. **Configuração Inicial**
- Seja específico no `book-project.yaml`
- Defina claramente o público-alvo
- Liste pain points reais
- Especifique o tom desejado

### 2. **Durante a Escrita**
- Revise cada capítulo gerado
- O sistema mantém consistência automaticamente
- Imagens são geradas com base no contexto
- Use `make ai-research` para tópicos específicos

### 3. **Qualidade**
- A AI usa o contexto dos capítulos anteriores
- Mantém terminologia consistente
- Segue o estilo definido
- Adiciona exemplos práticos automaticamente

## 🎨 Personalização

### Modificar Estilo
Edite `style` em `book-project.yaml`:
```yaml
style:
  tone: "casual e divertido"  # Mude o tom
  approach: "storytelling com humor"  # Mude a abordagem
  features:
    - personal_anecdotes
    - pop_culture_references
```

### Adicionar Pesquisa
Adicione fontes em `research_sources`:
```yaml
research_sources:
  - type: "academic"
    topics:
      - "blockchain research papers"
      - "cryptocurrency economics"
```

### Customizar Capítulos
Detalhe o outline em `chapters_outline`:
```yaml
chapters_outline:
  - number: 1
    title: "Meu Título Customizado"
    focus: "Foco específico"
    special_requirements: "Incluir estudo de caso da Tesla"
```

## 🚨 Resolução de Problemas

### "No outline found"
```bash
# Execute primeiro:
make ai-plan
```

### "Chapter already exists"
```bash
# Remova o capítulo e reescreva:
rm chapters/chapter-01-*.md
make ai-write N=1
```

### "API Key missing"
```bash
# Configure a chave da Ideogram:
export IDEOGRAM_API_KEY=your_key_here
```

## 🎯 Exemplo Real

### Livro sobre Criptomoedas
```bash
# 1. Configure (já incluído como exemplo)
cat book-project.yaml

# 2. Gere o plano
make ai-plan

# 3. Escreva o primeiro capítulo
make ai-write N=1

# 4. Resultado:
# - Capítulo profissional de 3000 palavras
# - 2 imagens AI relevantes
# - Exemplos práticos
# - Exercícios incluídos
# - Formatação perfeita
```

## 🌟 Recursos Avançados

### Multi-idioma
Configure `language` no projeto:
```yaml
project:
  language: "en"  # ou pt-BR, es, fr, etc.
```

### Séries de Livros
Use branches Git:
```bash
git checkout -b book/crypto-series-vol2
# Configure novo book-project.yaml
make ai-book-complete
```

### Colaboração
O sistema mantém estado, permitindo múltiplos autores:
```bash
# Autor 1 escreve capítulos 1-6
# Autor 2 escreve capítulos 7-12
# Sistema mantém consistência
```

## 📊 Métricas e Relatórios

Após escrever, veja estatísticas:
```bash
# Palavras por capítulo
make wordcount

# Estado do projeto
cat orchestrator-state.json

# Histórico de escrita
cat writing-history.json
```

---

**Lembre-se**: Este sistema transforma você em um autor prolífico. A AI faz o trabalho pesado, mas sua visão e direção são essenciais para criar um livro verdadeiramente valioso! 🚀📚
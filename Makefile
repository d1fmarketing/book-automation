# Configurações
BUILD_DIR = build
DIST_DIR = $(BUILD_DIR)/dist
TEMP_DIR = $(BUILD_DIR)/temp
DATE = $(shell date +%Y-%m-%d)
BOOK_NAME = ebook
SCRIPTS_DIR = scripts
CONTEXT_DIR = context
CHAPTERS_DIR = chapters

# Cores para output (compatível cross-platform)
ifeq ($(OS),Windows_NT)
    GREEN = 
    BLUE = 
    YELLOW = 
    RED = 
    NC = 
else
    # Use tput if available, fallback to ANSI codes, or empty if neither work
    GREEN = $(shell tput setaf 2 2>/dev/null || printf '\033[0;32m' 2>/dev/null || echo "")
    BLUE = $(shell tput setaf 4 2>/dev/null || printf '\033[0;34m' 2>/dev/null || echo "")
    YELLOW = $(shell tput setaf 3 2>/dev/null || printf '\033[1;33m' 2>/dev/null || echo "")
    RED = $(shell tput setaf 1 2>/dev/null || printf '\033[0;31m' 2>/dev/null || echo "")
    NC = $(shell tput sgr0 2>/dev/null || printf '\033[0m' 2>/dev/null || echo "")
endif

.PHONY: help
help:
	@echo "$(GREEN)Pipeline de Automação para eBooks$(NC)"
	@echo ""
	@echo "Comandos disponíveis:"
	@echo "  $(BLUE)make init$(NC)       - Configurar ambiente completo"
	@echo "  $(BLUE)make pdf$(NC)        - Gerar PDF profissional"
	@echo "  $(BLUE)make epub$(NC)       - Gerar EPUB otimizado"
	@echo "  $(BLUE)make all$(NC)        - Gerar todos os formatos"
	@echo "  $(BLUE)make test$(NC)       - Executar validações"
	@echo "  $(BLUE)make test-agents$(NC) - Testar agentes específicos"
	@echo "  $(BLUE)make clean$(NC)      - Limpar arquivos gerados"
	@echo "  $(BLUE)make wordcount$(NC)  - Atualizar contagem de palavras"
	@echo "  $(BLUE)make serve$(NC)      - Preview local do livro"
	@echo "  $(BLUE)make generate-images$(NC) - Gerar imagens AI"
	@echo ""
	@echo "Comandos de contexto:"
	@echo "  $(BLUE)make session-start$(NC)  - Iniciar sessão de escrita"
	@echo "  $(BLUE)make session-end$(NC)    - Finalizar sessão e atualizar contexto"
	@echo "  $(BLUE)make analyze$(NC)        - Analisar todos os capítulos"
	@echo "  $(BLUE)make check-continuity$(NC) - Verificar continuidade"
	@echo "  $(BLUE)make find$(NC) QUERY=\"texto\" - Buscar referências"
	@echo "  $(BLUE)make track-character$(NC) NAME=\"Nome\" - Rastrear personagem"
	@echo "  $(BLUE)make context-update$(NC) - Atualizar arquivos de contexto"
	@echo ""
	@echo "Comandos de Pipeline:"
	@echo "  $(BLUE)make pipeline$(NC)       - Execute complete Agent CLI pipeline"
	@echo "  $(BLUE)make writer$(NC)         - Run Agent CLI writer"
	@echo "  $(BLUE)make images$(NC)         - Run Agent CLI Ideogram"
	@echo "  $(BLUE)make builder$(NC)        - Run Agent CLI builder"
	@echo "  $(BLUE)make qa$(NC)             - Run Agent CLI QA (loops until perfect)"
	@echo ""
	@echo "Comandos AI para escrita automatizada:"
	@echo "  $(BLUE)make writer$(NC)         - Generate chapters with Agent CLI"
	@echo "  $(BLUE)make pipeline$(NC)       - Run complete Agent CLI pipeline"

.PHONY: init
init:
	@echo "$(GREEN)[INIT]$(NC) Configurando ambiente..."
	@chmod +x scripts/*.sh scripts/*.py
	@./scripts/bootstrap.sh
	@npm install
	@python3 -m venv venv
	@./venv/bin/pip install -r requirements.txt
	@npx husky install
	@echo "$(GREEN)[INIT]$(NC) Ambiente configurado com sucesso!"

.PHONY: pdf
pdf:
	@echo "$(BLUE)[BUILD]$(NC) Generating PDF via Agent CLI..."
	@agentcli call builder \
		--md chapters/ \
		--img assets/images/ \
		--css templates/pdf-standard.css \
		--out build/dist/

.PHONY: epub
epub:
	@npm run build:epub

.PHONY: generate-images images
generate-images images:
	@echo "$(BLUE)🎨 Agent CLI Ideogram v3 image generation...$(NC)"
	@agentcli call ideogram \
		--md chapters/ \
		--palette emotion \
		--out assets/images/

.PHONY: all
all: clean wordcount images builder qa
	@echo "$(GREEN)[BUILD]$(NC) All formats generated and QA passed!"

.PHONY: omnicreator
omnicreator:
	@echo "$(BLUE)🚀 Running OmniCreator-X Pipeline...$(NC)"
	@python3 omnicreator_run.py

.PHONY: test-npm
test-npm:
	@npm run test

.PHONY: wordcount
wordcount:
	@npm run wordcount

.PHONY: clean
clean:
	@echo "$(BLUE)[CLEAN]$(NC) Limpando arquivos gerados..."
	@rm -rf $(BUILD_DIR)/*

.PHONY: serve
serve:
	@echo "$(GREEN)[SERVE]$(NC) Iniciando servidor local..."
	@cd $(DIST_DIR) && python -m http.server 8000

.PHONY: verify
verify: lint test
	@echo "$(GREEN)[VERIFY]$(NC) Todas as verificações passaram!"

.PHONY: lint
lint:
	@echo "$(BLUE)[LINT]$(NC) Executando linting com ruff..."
	@python3 -m ruff check src --fix
	@echo "$(GREEN)✓ Linting concluído$(NC)"

.PHONY: test
test:
	@echo "$(BLUE)[TEST]$(NC) Executando testes..."
	@PYTHONPATH=src python3 -m pytest -q tests/
	@echo "$(GREEN)✓ Testes passaram$(NC)"

.PHONY: test-agents
test-agents:
	@echo "$(BLUE)[TEST-AGENTS]$(NC) Testando agentes..."
	@PYTHONPATH=src python3 -m pytest -q tests/test_agents.py
	@echo "$(GREEN)✓ Testes de agentes passaram$(NC)"

# ===== COMANDOS DE CONTEXTO =====

.PHONY: session-start
session-start:
	@echo "$(GREEN)[SESSION]$(NC) Iniciando sessão de escrita..."
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.analyze_chapters
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.generate_context
	@echo "$(GREEN)✓ Contexto atualizado! Leia $(CONTEXT_DIR)/CONTEXT.md antes de escrever.$(NC)"

.PHONY: session-end
session-end:
	@echo "$(BLUE)[SESSION]$(NC) Finalizando sessão..."
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.analyze_chapters
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.continuity_check
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.generate_context
	@git add context/*.json context/CONTEXT.md
	@git commit -m "chore: atualizar contexto da sessão" || true
	@echo "$(GREEN)✓ Sessão finalizada e contexto salvo!$(NC)"

.PHONY: analyze
analyze:
	@echo "$(BLUE)[ANALYZE]$(NC) Analisando capítulos..."
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.analyze_chapters

.PHONY: check-continuity
check-continuity:
	@echo "$(BLUE)[CHECK]$(NC) Verificando continuidade..."
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.continuity_check

.PHONY: find
find:
	@echo "$(BLUE)[FIND]$(NC) Buscando: $(QUERY)"
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.find_references "$(QUERY)"

.PHONY: track-character
track-character:
	@echo "$(BLUE)[TRACK]$(NC) Rastreando personagem: $(NAME)"
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.character_tracker "$(NAME)"

.PHONY: track-all-characters
track-all-characters:
	@echo "$(BLUE)[TRACK]$(NC) Rastreando todos os personagens..."
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.character_tracker --all

.PHONY: context-update
context-update:
	@echo "$(BLUE)[CONTEXT]$(NC) Atualizando todos os arquivos de contexto..."
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.analyze_chapters
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.continuity_check
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.character_tracker --all
	@PYTHONPATH=src python3 -m ebook_pipeline.utils.generate_context
	@echo "$(GREEN)✓ Contexto completamente atualizado!$(NC)"

.PHONY: context-backup
context-backup:
	@echo "$(BLUE)[BACKUP]$(NC) Fazendo backup do contexto..."
	@mkdir -p backups
	@tar -czf backups/context-$(DATE)-$(shell date +%H%M%S).tar.gz $(CONTEXT_DIR)/
	@echo "$(GREEN)✓ Backup salvo$(NC)"
	@# Manter apenas os últimos 5 backups
	@ls -t backups/context-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
	@echo "$(BLUE)Backups mantidos: $(shell ls backups/context-*.tar.gz 2>/dev/null | wc -l)$(NC)"

# ===== AGENT CLI PIPELINE =====

.PHONY: pipeline
pipeline:
	@echo "$(GREEN)🚀 [PIPELINE]$(NC) Running complete Agent CLI pipeline..."
	@node scripts/build-pipeline.js

.PHONY: writer
writer:
	@echo "$(GREEN)[WRITER]$(NC) Generating chapters with Agent CLI..."
	@agentcli call writer \
		--model $(AGENT_CLI_TEXT_MODEL) \
		--outline outline.yaml \
		--context context/CONTEXT.md \
		--out chapters/

.PHONY: builder
builder:
	@echo "$(BLUE)[BUILDER]$(NC) Building PDF/EPUB with Agent CLI..."
	@agentcli call builder \
		--md chapters/ \
		--img assets/images/ \
		--css templates/pdf-standard.css \
		--out build/dist/

.PHONY: qa
qa:
	@echo "$(YELLOW)[QA]$(NC) Running infinite QA loop until perfect..."
	@while true; do \
		agentcli call qa \
			--pdf build/dist/ebook.pdf \
			--epub build/dist/ebook.epub; \
		if [ $$? -eq 0 ]; then \
			echo "$(GREEN)✅ QA PASSED$(NC)"; \
			break; \
		fi; \
		echo "$(YELLOW)🔧 QA failed, tweaking layout...$(NC)"; \
		agentcli call builder --tweak next; \
	done

# ===== VALIDAÇÃO E SETUP =====

.PHONY: validate-setup
validate-setup:
	@# Verificar se diretórios existem
	@test -d $(CONTEXT_DIR) || (echo "$(RED)❌ Diretório $(CONTEXT_DIR) não encontrado$(NC)" && exit 1)
	@test -d $(CHAPTERS_DIR) || (echo "$(RED)❌ Diretório $(CHAPTERS_DIR) não encontrado$(NC)" && exit 1)
	@# Verificar Python
	@which python3 > /dev/null || which python > /dev/null || (echo "$(RED)❌ Python não encontrado$(NC)" && exit 1)
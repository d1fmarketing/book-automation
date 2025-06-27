# Configurações
BUILD_DIR = build
DIST_DIR = $(BUILD_DIR)/dist
TEMP_DIR = $(BUILD_DIR)/temp
DATE = $(shell date +%Y-%m-%d)
BOOK_NAME = ebook

# Cores para output
GREEN = \033[0;32m
BLUE = \033[0;34m
NC = \033[0m

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
	@echo "  $(BLUE)make clean$(NC)      - Limpar arquivos gerados"
	@echo "  $(BLUE)make wordcount$(NC)  - Atualizar contagem de palavras"
	@echo "  $(BLUE)make serve$(NC)      - Preview local do livro"
	@echo ""
	@echo "Comandos de contexto:"
	@echo "  $(BLUE)make session-start$(NC)  - Iniciar sessão de escrita"
	@echo "  $(BLUE)make session-end$(NC)    - Finalizar sessão e atualizar contexto"
	@echo "  $(BLUE)make analyze$(NC)        - Analisar todos os capítulos"
	@echo "  $(BLUE)make check-continuity$(NC) - Verificar continuidade"
	@echo "  $(BLUE)make find$(NC) QUERY=\"texto\" - Buscar referências"
	@echo "  $(BLUE)make track-character$(NC) NAME=\"Nome\" - Rastrear personagem"
	@echo "  $(BLUE)make context-update$(NC) - Atualizar arquivos de contexto"

.PHONY: init
init:
	@echo "$(GREEN)[INIT]$(NC) Configurando ambiente..."
	@chmod +x scripts/*.sh scripts/*.py
	@./scripts/bootstrap.sh
	@npm install
	@python -m venv venv
	@./venv/bin/pip install -r requirements.txt
	@npx husky install
	@echo "$(GREEN)[INIT]$(NC) Ambiente configurado com sucesso!"

.PHONY: pdf
pdf:
	@node scripts/generate-pdf-puppeteer.js

.PHONY: epub
epub:
	@npm run build:epub

.PHONY: all
all: clean wordcount pdf epub
	@echo "$(GREEN)[BUILD]$(NC) Todos os formatos gerados!"

.PHONY: test
test:
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

# ===== COMANDOS DE CONTEXTO =====

.PHONY: session-start
session-start:
	@echo "$(GREEN)[SESSION]$(NC) Iniciando sessão de escrita..."
	@python scripts/analyze-chapters.py
	@python scripts/generate-context.py
	@echo "$(GREEN)✓ Contexto atualizado! Leia context/CONTEXT.md antes de escrever.$(NC)"

.PHONY: session-end
session-end:
	@echo "$(BLUE)[SESSION]$(NC) Finalizando sessão..."
	@python scripts/analyze-chapters.py
	@python scripts/continuity-check.py
	@python scripts/generate-context.py
	@git add context/*.json context/CONTEXT.md
	@git commit -m "chore: atualizar contexto da sessão" || true
	@echo "$(GREEN)✓ Sessão finalizada e contexto salvo!$(NC)"

.PHONY: analyze
analyze:
	@echo "$(BLUE)[ANALYZE]$(NC) Analisando capítulos..."
	@python scripts/analyze-chapters.py

.PHONY: check-continuity
check-continuity:
	@echo "$(BLUE)[CHECK]$(NC) Verificando continuidade..."
	@python scripts/continuity-check.py

.PHONY: find
find:
	@echo "$(BLUE)[FIND]$(NC) Buscando: $(QUERY)"
	@python scripts/find-references.py "$(QUERY)"

.PHONY: track-character
track-character:
	@echo "$(BLUE)[TRACK]$(NC) Rastreando personagem: $(NAME)"
	@python scripts/character-tracker.py "$(NAME)"

.PHONY: track-all-characters
track-all-characters:
	@echo "$(BLUE)[TRACK]$(NC) Rastreando todos os personagens..."
	@python scripts/character-tracker.py --all

.PHONY: context-update
context-update:
	@echo "$(BLUE)[CONTEXT]$(NC) Atualizando todos os arquivos de contexto..."
	@python scripts/analyze-chapters.py
	@python scripts/continuity-check.py
	@python scripts/character-tracker.py --all
	@python scripts/generate-context.py
	@echo "$(GREEN)✓ Contexto completamente atualizado!$(NC)"

.PHONY: context-backup
context-backup:
	@echo "$(BLUE)[BACKUP]$(NC) Fazendo backup do contexto..."
	@mkdir -p backups
	@tar -czf backups/context-$(DATE).tar.gz context/
	@echo "$(GREEN)✓ Backup salvo em backups/context-$(DATE).tar.gz$(NC)"
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
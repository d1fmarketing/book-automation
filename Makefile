# Comandos simples que funcionam

.PHONY: ebook
ebook:
	@./ebook-build.sh

.PHONY: rebuild  
rebuild:
	@./ajustar-preset.sh

.PHONY: clean
clean:
	@echo "🧹 Running safe cleanup..."
	@./scripts/clean-build.sh -y

.PHONY: clean-dry
clean-dry:
	@echo "🔍 Dry run - showing what would be deleted..."
	@./scripts/clean-build.sh -d

.PHONY: clean-interactive
clean-interactive:
	@echo "🧹 Interactive cleanup..."
	@./scripts/clean-build.sh

# Atalho direto
.PHONY: pdf
pdf:
	npm run build:pdf

# PDF com verificação QA
.PHONY: pdf-qa
pdf-qa:
	npm run build:pdf
	node scripts/pdf-qa-loop-real.js

# PDF sem QA (desenvolvimento rápido)
.PHONY: pdf-fast
pdf-fast:
	SKIP_PDF_QA=1 npm run build:pdf

# Grammar checking commands
.PHONY: grammar-server
grammar-server:
	npm run grammar:server

.PHONY: grammar
grammar:
	npm run grammar

.PHONY: grammar-check
grammar-check:
	npm run grammar:check:chapters

.PHONY: grammar-fix
grammar-fix:
	npm run grammar:fix

.PHONY: grammar-report
grammar-report:
	npm run grammar:report

.PHONY: test-grammar
test-grammar:
	node scripts/test-grammar.js
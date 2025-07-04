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
	@find build dist -type f -name '*.pdf' -delete 2>/dev/null || true

.PHONY: clean-dry
clean-dry:
	@echo "🔍 Dry run - showing what would be deleted..."
	@./scripts/clean-build.sh -d

.PHONY: clean-interactive
clean-interactive:
	@echo "🧹 Interactive cleanup..."
	@./scripts/clean-build.sh

# HTML ebook generation
.PHONY: html
html:
	npm run build:html

# Engenheiro Bravo - Pipeline completo com zero tolerância
.PHONY: bravo
bravo:
	@echo "🚀 Executando Pipeline Engenheiro Bravo"
	@echo "   Zero tolerância - todos os 9 agentes obrigatórios"
	@rm -rf build/
	@npm run check:env
	@node scripts/orchestrator.js "Como fazer dinheiro com IA"
	@node scripts/assert-agents.js
	@echo "✅ Pipeline completo com sucesso!"

# Run QA on HTML
.PHONY: qa
qa:
	npm run qa:html

# Grammar checking commands
.PHONY: grammar-server
grammar-server:
	npm run grammar:server

.PHONY: grammar
grammar:
	npm run grammar

# Engenheiro Bravo commands
.PHONY: bravo
bravo:
	@echo "🔥 Starting Engenheiro Bravo pipeline..."
	ENGENHEIRO_BRAVO=true npm run money:generate

.PHONY: bravo-watch
bravo-watch:
	@echo "🐕 Starting pipeline watchdog..."
	npm run money:bravo:watch

.PHONY: bravo-pm2
bravo-pm2:
	@echo "🚀 Starting pipeline with PM2..."
	npm run money:bravo:pm2

.PHONY: manifest
manifest:
	@echo "📋 Checking manifest status..."
	@if [ -f build/run-manifest.json ]; then \
		cat build/run-manifest.json | jq .; \
	else \
		echo "No manifest found"; \
	fi

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

# Ultra-QA comprehensive testing
.PHONY: ultra-qa
ultra-qa:
	@echo "🚀 Running Ultra-QA tests..."
	@./scripts/run-ultra-qa.sh build/ebooks/latest test-results/ultra-qa

.PHONY: ultra-qa-html
ultra-qa-html:
	@echo "🧪 Running HTML validation tests..."
	@./scripts/run-ultra-qa.sh build/ebooks/latest test-results/ultra-qa html

.PHONY: ultra-qa-fast
ultra-qa-fast:
	@echo "⚡ Running fast Ultra-QA tests..."
	@./scripts/run-ultra-qa.sh build/ebooks/latest test-results/ultra-qa html,content --fail-fast

.PHONY: test-all
test-all: test-grammar ultra-qa
	@echo "✅ All tests completed"
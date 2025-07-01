# Comandos simples que funcionam

.PHONY: ebook
ebook:
	@./ebook-build.sh

.PHONY: rebuild  
rebuild:
	@./ajustar-preset.sh

.PHONY: clean
clean:
	rm -rf build/

# Atalho direto
.PHONY: pdf
pdf:
	npm run build:pdf
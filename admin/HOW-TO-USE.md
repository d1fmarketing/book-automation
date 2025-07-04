# Como usar o Admin Dashboard

## 🚀 Início Rápido

### 1. Iniciar Redis
```bash
redis-server
```

### 2. Iniciar Workers
```bash
# Workers com Anthropic (padrão)
node scripts/start-workers-simple.js

# Workers com Gemini (alternativa)
node scripts/start-workers-gemini.js
```

### 3. Iniciar Admin
```bash
cd admin
npm start
```

### 4. Acessar Dashboard
Abra: http://localhost:3001

## 🔑 Configuração de API Keys

### Para usar Anthropic Claude:
```bash
export ANTHROPIC_API_KEY=sua_chave_aqui
```

### Para usar Google Gemini:
```bash
export GOOGLE_API_KEY=sua_chave_aqui
# ou
export GEMINI_API_KEY=sua_chave_aqui
```

## 📝 Criando um Pipeline

1. Clique em "New Pipeline"
2. Digite o tópico do livro
3. Configure:
   - Número de capítulos (padrão: 10)
   - Estilo (business, conversational, etc)
4. Clique em "Start Pipeline"

## 🔧 Troubleshooting

### Erro "queueManager.startPipeline is not a function"
- Certifique-se de que os workers estão rodando
- Reinicie o admin server

### Conteúdo de fallback
- Configure a API key apropriada (veja acima)
- Verifique se a variável está exportada corretamente

### Pipeline travado
- Verifique se o Redis está rodando
- Reinicie workers e admin

## 🎯 Recursos

- **KPIs**: Métricas em tempo real
- **Terminal**: Logs ao vivo
- **Preview**: Visualização HTML do livro
- **Failed Jobs**: Reprocessar jobs com erro

## 🛠️ Scripts Úteis

### Testar Pipeline Completo
```bash
# Com Anthropic
./test-anthropic-pipeline.sh

# Com Gemini
./test-gemini-pipeline.sh
```

### Limpar Build
```bash
rm -rf build/*
```

### Verificar Redis
```bash
redis-cli ping
```
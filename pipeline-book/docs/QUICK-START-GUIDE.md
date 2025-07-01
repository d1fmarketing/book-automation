# 🚀 Quick Start Guide: 5-Agent Pipeline

## One Command to Rule Them All

```bash
npm run pipeline:complete
```

That's it. Seriously. 7 seconds later you have a perfect ebook.

## What Happens Behind the Scenes

```
1. Content Agent (1.04s)
   ├─ Loads metadata.yaml
   ├─ Processes 5 chapters
   ├─ Generates 15 images
   └─ Creates merged HTML

2. Format Agent (5.98s)
   ├─ Enhances HTML
   ├─ Generates PDF (attempt 1)
   ├─ Receives quality feedback
   └─ Regenerates PDF (attempt 2)

3. Quality Agent (5.86s)
   ├─ Validates PDF structure
   ├─ Checks visual quality
   ├─ Requests fixes if needed
   └─ Approves final output

4. Monitor Agent (real-time)
   └─ Tracks everything via WebSocket

5. Publish Agent (0.008s)
   ├─ Creates publication package
   ├─ Generates metadata
   └─ Deploys to platforms
```

## Advanced Usage

### Custom Project
```bash
npm run pipeline:complete -- --project my-book
```

### Publish to Multiple Platforms
```bash
npm run pipeline:complete -- --publish amazon,apple,google
```

### Development Mode
```bash
npm run pipeline:dev  # Verbose logging
```

## Output Structure

```
build/
├── dist/
│   ├── formatted-output.pdf      # Your perfect PDF
│   └── published/
│       └── the_claude_elite_pipeline/
│           ├── book.pdf          # Distribution copy
│           ├── index.html        # Web landing page
│           ├── metadata.json     # Book metadata
│           └── checksums.txt     # File integrity
└── metrics/
    └── pipeline_*.json           # Performance data
```

## Monitoring in Real-Time

The pipeline provides live updates via WebSocket:
- Agent status changes
- Progress percentage
- Error notifications
- Quality check results

## Troubleshooting

### Pipeline hangs?
```bash
# Check WebSocket server
lsof -i :8080

# Kill if needed
kill -9 <PID>
```

### Quality keeps failing?
```bash
# Run quality check separately
python -m src.ebook_pipeline.agents.quality_agent build/dist/formatted-output.pdf
```

### Need more details?
```bash
# Check pipeline metrics
cat build/metrics/pipeline_*.json | jq
```

## Configuration

Edit `src/ebook_pipeline/config.py` for:
- WebSocket port
- Quality thresholds
- Retry limits
- Agent timeouts

## Pro Tips

1. **Keep chapters under 5000 words** for optimal processing
2. **Use high-res images** (300+ DPI) for print quality
3. **Monitor first run** to understand the flow
4. **Check metrics** to optimize performance

## The Magic Formula

```
Good Content + 5 Agents + 7 Seconds = Professional Ebook
```

Remember: The pipeline is self-healing. If something's wrong, it'll fix itself or tell you exactly what to do.
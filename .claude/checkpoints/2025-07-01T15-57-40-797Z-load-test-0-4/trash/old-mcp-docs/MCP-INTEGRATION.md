# MCP Browser Automation Integration

This document describes how MCP (Model-Context Protocol) browser automation is integrated into the book-automation pipeline for literal "eyes on the page" QA validation.

## Overview

The pipeline uses MCP to drive a real Chromium browser that visually inspects every page, catching issues that DOM parsing alone would miss. This ensures professional-quality output by validating:

- Typography (font sizes, line heights)
- Color contrast (WCAG compliance)
- Layout integrity (margins, widows/orphans)
- Print geometry (bleed, page count)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Agent CLI      │────▶│ Builder Wrapper  │────▶│ PDF + HTML      │
│  Builder        │     │ (saves HTML too) │     │ Output          │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  MCP Browser    │◀────│ MCP QA Runner    │◀────│ Agent CLI QA    │
│  (Chromium)     │     │ (assertions)     │     │ Wrapper         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │ qa/last_fail.json│
                        │ (structured      │
                        │  report)         │
                        └──────────────────┘
```

## Components

### 1. Builder Wrapper (`scripts/agentcli-builder-wrapper.sh`)

- Ensures both PDF and HTML are generated
- HTML mirrors PDF exactly (same CSS, fonts, images)
- Supports `--tweak next` for layout preset cycling

### 2. MCP QA Runner (`scripts/mcp-qa-runner.sh`)

- Spawns MCP browser session
- Runs visual assertions on HTML (fast DOM checks)
- Runs print geometry checks on PDF
- Captures screenshots on failures
- Exports structured JSON report

### 3. Agent CLI QA Wrapper (`scripts/agentcli-qa-wrapper.sh`)

- Integrates MCP runner into Agent CLI workflow
- Ensures required files exist
- Returns proper exit codes for pipeline

### 4. Pipeline Orchestrator Updates

- Uses MCP-based QA instead of puppeteer
- Reads failure reports to guide preset selection
- Implements true infinite loop until perfect

## MCP Assertions

### HTML Phase (Fast DOM Checks)

```bash
mcp qa-run assert font-size between 11.5pt 14pt
mcp qa-run assert line-height between 1.3 1.6
mcp qa-run assert contrast-ratio min 4.5
mcp qa-run assert max-blank-page-percent 50
mcp qa-run assert widows-orphans max 2
```

### PDF Phase (Print Geometry)

```bash
mcp qa-run assert page-bleed within 3mm
mcp qa-run assert page-count equals $EXPECTED_PAGES
```

## Usage

### Single QA Pass

```bash
make qa-single
```

### Infinite QA Loop

```bash
make qa  # Loops until all checks pass
```

### Full Pipeline

```bash
make pipeline  # Includes MCP visual QA
```

## Failure Handling

When QA fails:

1. Screenshots are saved to `qa/screens/`
2. Detailed report written to `qa/last_fail.json`
3. Builder reads report and selects appropriate preset
4. Process repeats until success

## Benefits

1. **Real Visual Validation**: Not just parsing, actual browser rendering
2. **Fast Iteration**: HTML checks are quick, PDF only for geometry
3. **Smart Retries**: Failures guide which parameters to adjust
4. **No Arbitrary Limits**: Loops forever until perfect
5. **Visual Evidence**: Screenshots prove what went wrong

## Prerequisites

- MCP CLI installed and configured
- Chromium or Chrome browser available
- `jq` for JSON processing (optional but recommended)

## Debugging

To debug MCP sessions:

```bash
# Run without --headless to see browser
mcp start --session debug --browser chromium

# Check MCP logs
mcp logs debug
```

## Future Enhancements

- Add more visual assertions (image placement, header alignment)
- Support for accessibility checks (ARIA labels, tab order)
- Performance metrics (render time, memory usage)
- Multi-page spread validation for print

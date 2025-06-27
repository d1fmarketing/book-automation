# Agent Self-Test Scenario

This test scenario verifies that the Context Guardian agent is properly configured and functioning.

## Test 1: Context Awareness
**Prompt**: "Start writing chapter 3"
**Expected Behavior**: Agent should first read CONTEXT.md and story-bible.yaml before attempting to write.

## Test 2: Continuity Enforcement
**Setup**: Create a chapter 1 that establishes Alice has blue eyes.
**Prompt**: "Write chapter 2 where Alice has green eyes"
**Expected Behavior**: Agent should refuse and remind about established eye color.

## Test 3: Session Protocol
**Prompt**: "I'm done writing for today"
**Expected Behavior**: Agent should run `make session-end` to update context files.

## Test 4: Error Prevention
**Setup**: Modify a chapter file
**Prompt**: "Let me commit these changes"
**Expected Behavior**: Agent should remind to run `make session-end` first.

## Test 5: Cross-Reference Detection
**Setup**: Chapter 1 mentions a "silver key"
**Prompt**: "Write chapter 5, the protagonist finds a golden key"
**Expected Behavior**: Agent should ask if this is meant to be the same key from chapter 1.

## Running the Tests
1. Copy AGENT-DIRECTIVE.md content as system prompt
2. Test each scenario
3. Verify agent follows the Context Guardian protocol

## Success Criteria
- [ ] Agent always checks context before writing
- [ ] Agent prevents continuity errors
- [ ] Agent follows session protocols
- [ ] Agent maintains consistency across chapters
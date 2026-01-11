# Development Log Automation Rules

## Chat Capacity Management

When a chat session reaches 70-80% of its context capacity:

1. **Create Conversation Summary** with the following structure:
   - **Conversation Summary**: Key topics and changes made
   - **Files and Code Summary**: Modified files and their purposes
   - **Key Insights**: Technical learnings and architectural decisions
   - **Most Recent Topic**: Current focus area and progress

2. **Update DEVELOPMENT_LOG.md**:
   - Add new session summary to the top
   - Move previous "Latest Session Summary" to "Session Archive"
   - Include date and session identifier

3. **Prompt User**: "Chat capacity approaching limit. I'll update the development log and suggest starting a new session."

## New Chat Session Protocol

When starting a new chat for this workspace:

1. **Reference DEVELOPMENT_LOG.md** immediately
2. **Provide Context**: "I've reviewed the development log. The latest work focused on [key topics]."
3. **Offer Continuity**: "Would you like to continue from where we left off, or start a new topic?"

## Implementation Notes

- Use `@DEVELOPMENT_LOG.md` to reference the log in new sessions
- Keep summaries concise but comprehensive
- Focus on actionable insights and technical decisions
- Maintain chronological order in the archive section
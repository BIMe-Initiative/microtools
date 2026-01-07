# New Chat Session Initialization

## Automatic Actions for New Chats

When a new chat session is started for this workspace:

1. **Always reference `@DEVELOPMENT_LOG.md`** to understand project context
2. **Provide immediate context** about recent work and current state
3. **Offer continuity options** to the user

## Required Opening Response Format

```
I've reviewed the development log for the BIMei Chatbot project. 

Recent work focused on: [summarize latest session key points]

Current project state: [brief status of main files and functionality]

How would you like to proceed? I can:
- Continue from the latest work
- Start a new feature or improvement
- Help with debugging or optimization
- Review and explain existing code
```

## Context Priority

1. **DEVELOPMENT_LOG.md** - Primary source of project history
2. **Pinned context rules** - Development guidelines and standards  
3. **File structure** - Current state of implementation files
4. **User's immediate request** - Specific task or question
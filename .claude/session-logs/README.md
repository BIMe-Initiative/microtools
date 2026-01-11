# Claude Session Logs

This directory contains detailed logs of Claude Code sessions for the microtools repository.

## Purpose

Session logs provide:
- Historical record of changes and decisions
- Troubleshooting reference for future issues
- Knowledge transfer for team members
- Audit trail for security and compliance

## Log Format

Each session log follows this structure:

### Header
- Date and time
- Session duration
- Claude model version
- Session objective

### Main Sections
1. **Actions Taken** - Detailed record of what was done
2. **Issues Encountered** - Problems and their resolutions
3. **Files Modified** - Complete list of changed files
4. **Verification** - How changes were validated
5. **Final State** - End result and status
6. **Technical Notes** - Important implementation details
7. **Lessons Learned** - Key takeaways
8. **Next Steps** - Follow-up actions

## Naming Convention

Logs are named: `YYYY-MM-DD_brief-description.md`

Example: `2026-01-11_repository-cleanup-security-fixes.md`

## Usage

### During Session
- Claude uses TodoWrite tool to track real-time progress
- Focus on completing tasks without documentation overhead

### End of Session
- Comprehensive log generated with all details
- Includes commands, file references, and commit hashes
- Links to modified files for easy navigation

## Best Practices

1. **Be Specific**: Include exact commands, file paths, and line numbers
2. **Include Context**: Explain why decisions were made
3. **Record Failures**: Document what didn't work and why
4. **Link Resources**: Reference commits, PRs, documentation
5. **Future-Proof**: Write for someone encountering this 6 months later

## Template

A session log template is available at: `.claude/session-log-template.md`

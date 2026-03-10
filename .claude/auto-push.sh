#!/bin/bash
# Auto commit & push script for Claude Code hooks
# Triggered after Edit/Write tool use

REPO_DIR="/Users/root1/m1buff"
cd "$REPO_DIR" || exit 0

# Read tool input from stdin to get the modified file path
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Only process files inside the repo
case "$FILE_PATH" in
  "$REPO_DIR"*) ;;
  *) exit 0 ;;
esac

# Check if there are changes
if git -C "$REPO_DIR" diff --quiet && git -C "$REPO_DIR" diff --cached --quiet && [ -z "$(git -C "$REPO_DIR" ls-files --others --exclude-standard)" ]; then
  exit 0
fi

# Get relative file path for commit message
REL_PATH=$(echo "$FILE_PATH" | sed "s|$REPO_DIR/||")

# Stage, commit, and push
git -C "$REPO_DIR" add -A
git -C "$REPO_DIR" commit -m "Auto-update: $REL_PATH" --no-verify 2>/dev/null
git -C "$REPO_DIR" push origin main 2>/dev/null

exit 0

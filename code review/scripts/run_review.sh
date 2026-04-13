#!/bin/bash
set -e

REPO_DIR="/work/repo"
OUTPUT_FILE="/work/output/review_raw.txt"

if [ ! -d "$REPO_DIR" ]; then
    echo "ERROR: Repository directory not found at $REPO_DIR"
    exit 1
fi

cd "$REPO_DIR"

echo "Starting Cursor CLI security review..."
echo "Working directory: $(pwd)"
echo "Files to review: $(find . -type f -not -path './.git/*' | wc -l)"

PROMPT="This project is all about secured code review. Let's scan the project whole, file by file and find security vulnerabilities. We will go through guidelines of secured development. Output ONLY a valid JSON array of findings. Each finding must have these fields: finding_code (e.g. SEC-001), title, description, severity (Critical/High/Medium/Low), probability (Low/Medium/High/Very High), risk (Low/Medium/High/Critical), file_path, line_number (integer or null), code_snippet, recommendation, tags (array of strings). Do not include any text before or after the JSON array."

# Run Cursor CLI with the security review prompt
cursor --prompt "$PROMPT" > "$OUTPUT_FILE" 2>/work/logs/cursor_stderr.log || {
    echo "Cursor CLI exited with code $?"
    # If cursor CLI is not available, try with npx
    if ! command -v cursor &> /dev/null; then
        echo "Cursor CLI not found, attempting with npx..."
        npx @anthropic-ai/cursor-cli --prompt "$PROMPT" > "$OUTPUT_FILE" 2>/work/logs/cursor_stderr.log || {
            echo "npx cursor-cli also failed"
            exit 1
        }
    else
        exit 1
    fi
}

if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    echo "Review output written to $OUTPUT_FILE"
    echo "Output size: $(wc -c < "$OUTPUT_FILE") bytes"
else
    echo "ERROR: Review output file is empty or missing"
    exit 1
fi

echo "Cursor CLI review completed."

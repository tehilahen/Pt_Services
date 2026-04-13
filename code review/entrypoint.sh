#!/bin/bash
set -e

echo "=== Code Review Container Started ==="
echo "Task ID: $TASK_ID"
echo "Repo URL: $REPO_URL"
echo "Branch: $BRANCH"
echo "========================================="

LOG_FILE="/work/logs/run.log"
exec > >(tee -a "$LOG_FILE") 2>&1

# Step 1: Update status to Running
echo "[1/6] Updating status to Running..."
python3 /work/scripts/update_status.py "$TASK_ID" "Running"

# Step 2: Clone repository from TFS
echo "[2/6] Cloning repository..."
python3 /work/scripts/clone_repo.py || {
    echo "ERROR: Failed to clone repository"
    python3 /work/scripts/update_status.py "$TASK_ID" "Failed" "Failed to clone repository from TFS"
    exit 1
}

# Step 3: Run Cursor CLI code review
echo "[3/6] Running Cursor CLI security review..."
/work/scripts/run_review.sh || {
    echo "ERROR: Cursor CLI review failed"
    python3 /work/scripts/update_status.py "$TASK_ID" "Failed" "Cursor CLI review execution failed"
    exit 1
}

# Step 4: Parse Cursor output to structured JSON
echo "[4/6] Parsing review output..."
python3 /work/scripts/parse_output.py || {
    echo "ERROR: Failed to parse review output"
    python3 /work/scripts/update_status.py "$TASK_ID" "Failed" "Failed to parse review output"
    exit 1
}

# Step 5: Generate HTML report
echo "[5/6] Generating HTML report..."
python3 /work/scripts/generate_html.py || {
    echo "ERROR: Failed to generate HTML report"
    python3 /work/scripts/update_status.py "$TASK_ID" "Failed" "Failed to generate HTML report"
    exit 1
}

# Step 6: Push results to MSSQL
echo "[6/6] Pushing results to database..."
python3 /work/scripts/push_results.py || {
    echo "ERROR: Failed to push results to database"
    python3 /work/scripts/update_status.py "$TASK_ID" "Failed" "Failed to push results to database"
    exit 1
}

echo "=== Code Review Completed Successfully ==="

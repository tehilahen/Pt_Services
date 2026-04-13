"""
Update the CodeReview task status in SQLite.
Usage: python update_status.py <task_id> <status> [error_summary]
"""
import os
import sqlite3
import sys
import time


def update_status(task_id, status, error_summary=None, max_retries=3):
    path = os.environ.get("SQLITE_DB_PATH", "").strip()
    if not path:
        print("ERROR: SQLITE_DB_PATH not set")
        sys.exit(1)

    for attempt in range(1, max_retries + 1):
        try:
            conn = sqlite3.connect(path, timeout=30)
            cursor = conn.cursor()

            if status == "Running":
                cursor.execute(
                    "UPDATE CodeReviews SET Status = ?, StartedAt = datetime('now','localtime') WHERE TaskID = ?",
                    (status, task_id),
                )
            elif status in ("Succeeded", "Failed"):
                cursor.execute(
                    "UPDATE CodeReviews SET Status = ?, FinishedAt = datetime('now','localtime'), ErrorSummary = ? WHERE TaskID = ?",
                    (status, error_summary, task_id),
                )
            else:
                cursor.execute(
                    "UPDATE CodeReviews SET Status = ? WHERE TaskID = ?",
                    (status, task_id),
                )

            conn.commit()
            cursor.close()
            conn.close()
            print(f"Status updated to '{status}' for TaskID {task_id}")
            return

        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < max_retries:
                print(f"Database locked on attempt {attempt}, retrying in {attempt}s...")
                time.sleep(attempt)
                continue
            print(f"ERROR updating status: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"ERROR updating status: {e}")
            sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python update_status.py <task_id> <status> [error_summary]")
        sys.exit(1)

    task_id = int(sys.argv[1])
    status = sys.argv[2]
    error_summary = sys.argv[3] if len(sys.argv) > 3 else None

    update_status(task_id, status, error_summary)

"""
Update the CodeReview task status in MSSQL.
Usage: python update_status.py <task_id> <status> [error_summary]
"""
import os
import sys
import time
import pyodbc
from datetime import datetime


def update_status(task_id, status, error_summary=None, max_retries=3):
    conn_str = os.environ.get('MSSQL_CONNECTION_STRING', '') or os.environ.get('SQL_CONNECTION_STRING', '')
    if not conn_str:
        print("ERROR: MSSQL_CONNECTION_STRING not set")
        sys.exit(1)

    for attempt in range(1, max_retries + 1):
        try:
            conn = pyodbc.connect(conn_str, timeout=10)
            conn.timeout = 30
            cursor = conn.cursor()

            if status == 'Running':
                cursor.execute(
                    "UPDATE CodeReviews SET Status = ?, StartedAt = GETDATE() WHERE TaskID = ?",
                    status, task_id
                )
            elif status in ('Succeeded', 'Failed'):
                cursor.execute(
                    "UPDATE CodeReviews SET Status = ?, FinishedAt = GETDATE(), ErrorSummary = ? WHERE TaskID = ?",
                    status, error_summary, task_id
                )
            else:
                cursor.execute(
                    "UPDATE CodeReviews SET Status = ? WHERE TaskID = ?",
                    status, task_id
                )

            conn.commit()
            cursor.close()
            conn.close()
            print(f"Status updated to '{status}' for TaskID {task_id}")
            return

        except pyodbc.Error as e:
            if '40001' in str(e) and attempt < max_retries:
                print(f"Deadlock on attempt {attempt}, retrying in {attempt}s...")
                time.sleep(attempt)
                continue
            print(f"ERROR updating status: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"ERROR updating status: {e}")
            sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python update_status.py <task_id> <status> [error_summary]")
        sys.exit(1)

    task_id = int(sys.argv[1])
    status = sys.argv[2]
    error_summary = sys.argv[3] if len(sys.argv) > 3 else None

    update_status(task_id, status, error_summary)

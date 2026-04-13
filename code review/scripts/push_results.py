"""
Push code review findings and HTML report to SQLite.
Reads from /work/output/findings.json and /work/output/report.html

Deduplication logic:
- For each finding (by FindingCode), check if it already exists in a previous
  scan for the same system.
- If new: INSERT normally.
- If exists and open (בטיפול): UPDATE TaskID to current scan (no duplicate row).
- After processing all new findings, any old findings that did NOT reappear
  in the current scan are marked as fixed (טופל).
"""
import json
import os
import sqlite3
import sys


def get_system_id(cursor, task_id):
    """Get the SystemID for the current task."""
    cursor.execute("SELECT SystemID FROM CodeReviews WHERE TaskID = ?", (task_id,))
    row = cursor.fetchone()
    return row[0] if row else None


def get_existing_findings(cursor, system_id):
    """Get all existing findings for the same system across all previous scans.
    Returns a dict keyed by Title|Severity -> {FindingID, TaskID, Status}.
    Uses Title+Severity as the dedup key since FindingCode is auto-generated
    and unique per scan."""
    cursor.execute("""
        SELECT f.FindingID, f.FindingCode, f.TaskID, f.Status, f.Title, f.Severity
        FROM CodeReviewFindings f
        INNER JOIN CodeReviews cr ON f.TaskID = cr.TaskID
        WHERE cr.SystemID = ?
    """, (system_id,))

    existing = {}
    for row in cursor.fetchall():
        dedup_key = (row[4] or '') + '|' + (row[5] or '')
        if dedup_key not in existing or row[2] > existing[dedup_key]['TaskID']:
            existing[dedup_key] = {
                'FindingID': row[0],
                'FindingCode': row[1],
                'TaskID': row[2],
                'Status': row[3],
                'Title': row[4],
            }
    return existing


def _open_db():
    path = os.environ.get("SQLITE_DB_PATH", "").strip()
    if not path:
        print("ERROR: SQLITE_DB_PATH not set")
        sys.exit(1)
    return sqlite3.connect(path, timeout=30)


def push_results():
    task_id = os.environ.get("TASK_ID", "")

    if not task_id:
        print("ERROR: TASK_ID not set")
        sys.exit(1)

    task_id = int(task_id)
    work_dir = os.environ.get("WORK_DIR", "/work")
    findings_file = os.path.join(work_dir, "output", "findings.json")
    report_file = os.path.join(work_dir, "output", "report.html")

    try:
        with open(findings_file, "r", encoding="utf-8") as f:
            findings = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: {findings_file} not found")
        sys.exit(1)

    try:
        conn = _open_db()
        cursor = conn.cursor()

        system_id = get_system_id(cursor, task_id)

        existing = {}
        if system_id:
            existing = get_existing_findings(cursor, system_id)
            print(f"Found {len(existing)} existing findings for SystemID {system_id}")

        insert_sql = """
            INSERT INTO CodeReviewFindings
            (TaskID, FindingCode, Title, Description, Severity, Probability, Risk,
             FilePath, LineNumber, CodeSnippet, Recommendation, Tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        update_taskid_sql = """
            UPDATE CodeReviewFindings
            SET TaskID = ?, Title = ?, Description = ?, Severity = ?, Probability = ?,
                Risk = ?, FilePath = ?, LineNumber = ?, CodeSnippet = ?,
                Recommendation = ?, Tags = ?
            WHERE FindingID = ?
        """

        inserted_count = 0
        updated_count = 0
        reopened_count = 0
        current_finding_codes = set()

        for finding in findings:
            finding_code = finding.get("finding_code", "")
            title = finding.get("title", "")
            severity = finding.get("severity", "Medium")
            dedup_key = title + "|" + severity
            current_finding_codes.add(dedup_key)

            tags = finding.get("tags", [])
            tags_str = ",".join(tags) if isinstance(tags, list) else str(tags)

            if dedup_key in existing:
                prev = existing[dedup_key]
                prev_status = (prev.get("Status") or "").strip()

                if prev_status == "\u05d8\u05d5\u05e4\u05dc":
                    cursor.execute(
                        "UPDATE CodeReviewFindings SET TaskID = ?, Status = ? WHERE FindingID = ?",
                        (task_id, "\u05d1\u05d8\u05d9\u05e4\u05d5\u05dc", prev["FindingID"]),
                    )
                    reopened_count += 1
                    print(f"  REOPENED: {title} (was fixed, reappeared)")
                else:
                    cursor.execute(
                        update_taskid_sql,
                        (
                            task_id,
                            title,
                            finding.get("description", ""),
                            severity,
                            finding.get("probability", "Medium"),
                            finding.get("risk", "Medium"),
                            finding.get("file_path", ""),
                            finding.get("line_number"),
                            finding.get("code_snippet", ""),
                            finding.get("recommendation", ""),
                            tags_str,
                            prev["FindingID"],
                        ),
                    )
                    updated_count += 1
                    print(f"  UPDATED: {title} (TaskID -> {task_id})")
            else:
                cursor.execute(
                    insert_sql,
                    (
                        task_id,
                        finding_code,
                        finding.get("title", ""),
                        finding.get("description", ""),
                        finding.get("severity", "Medium"),
                        finding.get("probability", "Medium"),
                        finding.get("risk", "Medium"),
                        finding.get("file_path", ""),
                        finding.get("line_number"),
                        finding.get("code_snippet", ""),
                        finding.get("recommendation", ""),
                        tags_str,
                    ),
                )
                inserted_count += 1
                print(f"  NEW: {finding_code}")

        fixed_count = 0
        for code, prev in existing.items():
            if code not in current_finding_codes:
                prev_status = (prev.get("Status") or "").strip()
                if prev_status not in (
                    "\u05d8\u05d5\u05e4\u05dc",
                    "\u05e1\u05d2\u05d5\u05e8",
                    "\u05d4\u05ea\u05e2\u05dc\u05dd",
                ):
                    cursor.execute(
                        "UPDATE CodeReviewFindings SET Status = ? WHERE FindingID = ?",
                        ("\u05d8\u05d5\u05e4\u05dc", prev["FindingID"]),
                    )
                    fixed_count += 1
                    print(f"  FIXED: {code} (not found in current scan)")

        print(
            f"\nSummary: {inserted_count} new, {updated_count} updated, {reopened_count} reopened, {fixed_count} marked as fixed"
        )

        if os.path.exists(report_file):
            with open(report_file, "rb") as f:
                report_content = f.read()

            cursor.execute(
                """INSERT INTO CodeReviewArtifacts (TaskID, ArtifactName, MimeType, Content)
                   VALUES (?, ?, ?, ?)""",
                (task_id, "security-report.html", "text/html", report_content),
            )
            print(f"Inserted HTML report artifact ({len(report_content)} bytes)")

        log_file = os.path.join(work_dir, "logs", "run.log")
        if os.path.exists(log_file):
            with open(log_file, "rb") as f:
                log_content = f.read()

            cursor.execute(
                """INSERT INTO CodeReviewArtifacts (TaskID, ArtifactName, MimeType, Content)
                   VALUES (?, ?, ?, ?)""",
                (task_id, "run.log", "text/plain", log_content),
            )
            print(f"Inserted log artifact ({len(log_content)} bytes)")

        sev_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
        for f in findings:
            sev = f.get("severity", "Medium")
            if sev in sev_counts:
                sev_counts[sev] += 1
        total_count = len(findings)

        cursor.execute(
            """
            UPDATE CodeReviews
            SET Status = 'Succeeded', FinishedAt = datetime('now','localtime'),
                TotalCount = ?, CriticalCount = ?, HighCount = ?, MediumCount = ?, LowCount = ?
            WHERE TaskID = ?
        """,
            (
                total_count,
                sev_counts["Critical"],
                sev_counts["High"],
                sev_counts["Medium"],
                sev_counts["Low"],
                task_id,
            ),
        )

        conn.commit()
        cursor.close()
        conn.close()
        print("All results pushed to database successfully")

    except Exception as e:
        print(f"ERROR pushing results: {e}")
        try:
            conn2 = _open_db()
            cur2 = conn2.cursor()
            cur2.execute(
                "UPDATE CodeReviews SET Status = 'Failed', FinishedAt = datetime('now','localtime'), ErrorSummary = ? WHERE TaskID = ?",
                (str(e)[:4000], task_id),
            )
            conn2.commit()
            cur2.close()
            conn2.close()
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    push_results()

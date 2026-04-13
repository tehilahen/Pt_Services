"""
Generate an HTML security report from findings JSON using the report template.
Reads from /work/output/findings.json
Writes to /work/output/report.html

Supports:
- Grouping identical findings (by finding_code) with multiple locations
- Israel timezone (Asia/Jerusalem) for date/time display
- Dynamic version numbering based on scan count per system
"""
import json
import os
import sys
from collections import OrderedDict
from datetime import datetime

import pytz
from jinja2 import Environment, FileSystemLoader

ISRAEL_TZ = pytz.timezone('Asia/Jerusalem')


def get_scan_version(task_id, conn_str):
    """Query DB to determine scan version number based on how many scans
    have been performed on the same SystemID."""
    if not conn_str or not task_id:
        return '1.0'
    try:
        import pyodbc
        conn = pyodbc.connect(conn_str, timeout=10)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM CodeReviews WHERE SystemID = (
                SELECT SystemID FROM CodeReviews WHERE TaskID = ?
            )
        """, int(task_id))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if row:
            return f'{row[0]}.0'
    except Exception as e:
        print(f"WARNING: Could not determine scan version from DB: {e}")
    return '1.0'


def get_system_name(task_id, conn_str):
    """Query DB to get the system name for the report header."""
    if not conn_str or not task_id:
        return None
    try:
        import pyodbc
        conn = pyodbc.connect(conn_str, timeout=10)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.SystemName FROM Systems s
            INNER JOIN CodeReviews cr ON cr.SystemID = s.SystemID
            WHERE cr.TaskID = ?
        """, int(task_id))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if row:
            return row[0]
    except Exception as e:
        print(f"WARNING: Could not determine system name from DB: {e}")
    return None


def group_findings(findings):
    """Group findings by title+severity. Each unique vulnerability type appears
    once, with a 'locations' list containing all file_path/line_number/code_snippet
    occurrences where it was found."""
    grouped = OrderedDict()
    for f in findings:
        group_key = f.get('title', 'Untitled') + '|' + f.get('severity', 'Medium')
        if group_key in grouped:
            grouped[group_key]['locations'].append({
                'file_path': f.get('file_path', ''),
                'line_number': f.get('line_number'),
                'code_snippet': f.get('code_snippet', ''),
            })
            for tag in f.get('tags', []):
                if tag not in grouped[group_key]['tags']:
                    grouped[group_key]['tags'].append(tag)
        else:
            grouped[group_key] = {
                'finding_code': f.get('finding_code', ''),
                'title': f.get('title', 'Untitled Finding'),
                'description': f.get('description', ''),
                'severity': f.get('severity', 'Medium'),
                'probability': f.get('probability', 'Medium'),
                'risk': f.get('risk', f.get('severity', 'Medium')),
                'recommendation': f.get('recommendation', ''),
                'tags': list(f.get('tags', [])),
                'status': f.get('status', ''),
                'category': f.get('category', ''),
                'cwe': f.get('cwe', ''),
                'owasp': f.get('owasp', ''),
                'locations': [{
                    'file_path': f.get('file_path', ''),
                    'line_number': f.get('line_number'),
                    'code_snippet': f.get('code_snippet', ''),
                }],
            }
    return list(grouped.values())


def collect_categories(findings):
    """Build category list with counts and color assignments for navigation."""
    cat_colors = [
        'var(--cat1)', 'var(--cat2)', 'var(--cat3)', 'var(--cat4)',
        'var(--cat5)', 'var(--cat6)', 'var(--cat7)', 'var(--cat8)',
    ]
    cat_order = OrderedDict()
    for f in findings:
        cat = f.get('category', '') or 'General'
        if cat not in cat_order:
            cat_order[cat] = {
                'name': cat,
                'id': 'cat-' + cat.lower().replace(' ', '-').replace('&', 'and'),
                'color': cat_colors[len(cat_order) % len(cat_colors)],
                'count': 0,
                'findings': [],
            }
        cat_order[cat]['count'] += 1
        cat_order[cat]['findings'].append(f)
    return list(cat_order.values())


def collect_scanned_files(findings):
    """Extract unique file paths from all finding locations."""
    files = OrderedDict()
    for f in findings:
        for loc in f.get('locations', []):
            fp = loc.get('file_path', '')
            if fp and fp not in files:
                files[fp] = True
        tags = f.get('tags', [])
        for tag in tags:
            if '.' in tag and '/' in tag or tag.endswith(('.cs', '.json', '.csproj', '.py', '.js', '.ts')):
                if tag not in files:
                    files[tag] = True
    return list(files.keys())


def generate_html():
    work_dir = os.environ.get('WORK_DIR', '/work')
    findings_file = os.path.join(work_dir, 'output', 'findings.json')
    output_file = os.path.join(work_dir, 'output', 'report.html')
    template_dir = os.path.join(work_dir, 'templates')

    try:
        with open(findings_file, 'r', encoding='utf-8') as f:
            findings = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: {findings_file} not found")
        sys.exit(1)

    repo_url = os.environ.get('REPO_URL', 'N/A')
    branch = os.environ.get('BRANCH', 'master')
    task_id = os.environ.get('TASK_ID', 'N/A')
    conn_str = os.environ.get('MSSQL_CONNECTION_STRING', '') or os.environ.get('SQL_CONNECTION_STRING', '')

    grouped = group_findings(findings)

    severity_counts = {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}
    for finding in grouped:
        sev = finding.get('severity', 'Medium')
        if sev in severity_counts:
            severity_counts[sev] += 1

    total = len(grouped)
    now = datetime.now(ISRAEL_TZ).strftime('%B %d, %Y %H:%M')

    version = get_scan_version(task_id, conn_str)
    system_name = get_system_name(task_id, conn_str)

    categories = collect_categories(grouped)
    scanned_files = collect_scanned_files(grouped)

    status_counts = {'fixed': 0, 'partial': 0, 'open': 0}
    severity_status = {
        'Critical': {'fixed': 0, 'partial': 0, 'open': 0},
        'High': {'fixed': 0, 'partial': 0, 'open': 0},
        'Medium': {'fixed': 0, 'partial': 0, 'open': 0},
        'Low': {'fixed': 0, 'partial': 0, 'open': 0},
    }
    for f in grouped:
        s = (f.get('status') or '').lower()
        sev = f.get('severity', 'Medium')
        if sev not in severity_status:
            sev = 'Medium'
        if s in ('fixed', 'טופל', 'סגור'):
            status_counts['fixed'] += 1
            severity_status[sev]['fixed'] += 1
        elif s in ('partial', 'partially fixed'):
            status_counts['partial'] += 1
            severity_status[sev]['partial'] += 1
        else:
            status_counts['open'] += 1
            severity_status[sev]['open'] += 1

    risk_matrix = {
        'Critical': {'Low': 'High', 'Medium': 'Critical', 'High': 'Critical', 'Very High': 'Critical'},
        'High': {'Low': 'Medium', 'Medium': 'High', 'High': 'Critical', 'Very High': 'Critical'},
        'Medium': {'Low': 'Low', 'Medium': 'Medium', 'High': 'High', 'Very High': 'High'},
        'Low': {'Low': 'Low', 'Medium': 'Low', 'High': 'Medium', 'Very High': 'Medium'},
    }

    env = Environment(loader=FileSystemLoader(template_dir), autoescape=False)

    try:
        template = env.get_template('report_template.html')
    except Exception as e:
        print(f"ERROR: Could not load template: {e}")
        sys.exit(1)

    author = os.environ.get('REPORT_AUTHOR', 'PT Service - Automated Security Review')
    scope = os.environ.get('REPORT_SCOPE', f'{system_name or repo_url} (full codebase)')

    html = template.render(
        findings=grouped,
        severity_counts=severity_counts,
        total=total,
        raw_total=len(findings),
        date=now,
        repo_url=repo_url,
        branch=branch,
        task_id=task_id,
        risk_matrix=risk_matrix,
        version=version,
        system_name=system_name or repo_url,
        author=author,
        scope=scope,
        categories=categories,
        scanned_files=scanned_files,
        status_counts=status_counts,
        severity_status=severity_status,
    )

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"HTML report generated: {output_file} ({len(html)} bytes)")
    print(f"Version: {version} | Findings: {total} (grouped from {len(findings)} raw)")


if __name__ == '__main__':
    generate_html()

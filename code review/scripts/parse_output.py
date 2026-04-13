"""
Parse the raw Cursor CLI output into structured JSON findings.
Reads from /work/output/review_raw.txt
Writes to /work/output/findings.json
"""
import json
import os
import re
import sys


def extract_json_from_text(text):
    """Extract JSON array from text that may contain surrounding prose."""
    # Try parsing the whole text as JSON first
    text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and 'findings' in data:
            return data['findings']
    except json.JSONDecodeError:
        pass

    # Try to find a JSON array within the text
    bracket_depth = 0
    start_idx = None
    for i, ch in enumerate(text):
        if ch == '[':
            if bracket_depth == 0:
                start_idx = i
            bracket_depth += 1
        elif ch == ']':
            bracket_depth -= 1
            if bracket_depth == 0 and start_idx is not None:
                candidate = text[start_idx:i + 1]
                try:
                    data = json.loads(candidate)
                    if isinstance(data, list):
                        return data
                except json.JSONDecodeError:
                    start_idx = None
                    continue

    # Try extracting from markdown code fences
    code_block = re.search(r'```(?:json)?\s*\n(.*?)\n```', text, re.DOTALL)
    if code_block:
        try:
            data = json.loads(code_block.group(1))
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass

    return None


def normalize_finding(finding, index):
    """Normalize a finding dict to match the expected schema."""
    severity = finding.get('severity', 'Medium')
    if severity not in ('Critical', 'High', 'Medium', 'Low'):
        severity = 'Medium'

    return {
        'finding_code': finding.get('finding_code', f'SEC-{index + 1:03d}'),
        'title': finding.get('title', 'Untitled Finding'),
        'description': finding.get('description', ''),
        'severity': severity,
        'probability': finding.get('probability', 'Medium'),
        'risk': finding.get('risk', severity),
        'file_path': finding.get('file_path', ''),
        'line_number': finding.get('line_number'),
        'code_snippet': finding.get('code_snippet', ''),
        'recommendation': finding.get('recommendation', ''),
        'tags': finding.get('tags', [])
    }


def parse_output():
    work_dir = os.environ.get('WORK_DIR', '/work')
    input_file = os.path.join(work_dir, 'output', 'review_raw.txt')
    output_file = os.path.join(work_dir, 'output', 'findings.json')

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            raw_text = f.read()
    except FileNotFoundError:
        print(f"ERROR: {input_file} not found")
        sys.exit(1)

    if not raw_text.strip():
        print("ERROR: Review output is empty")
        sys.exit(1)

    print(f"Raw output size: {len(raw_text)} characters")

    findings = extract_json_from_text(raw_text)

    if findings is None:
        print("WARNING: Could not parse JSON from output. Creating single finding from raw text.")
        findings = [{
            'finding_code': 'SEC-001',
            'title': 'Unparsed Review Output',
            'description': raw_text[:4000],
            'severity': 'Medium',
            'probability': 'Medium',
            'risk': 'Medium',
            'file_path': '',
            'line_number': None,
            'code_snippet': '',
            'recommendation': 'Review the raw output manually.',
            'tags': ['unparsed']
        }]

    normalized = [normalize_finding(f, i) for i, f in enumerate(findings)]

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(normalized, f, indent=2, ensure_ascii=False)

    severity_counts = {}
    for finding in normalized:
        sev = finding['severity']
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    print(f"Parsed {len(normalized)} findings:")
    for sev in ['Critical', 'High', 'Medium', 'Low']:
        count = severity_counts.get(sev, 0)
        if count:
            print(f"  {sev}: {count}")


if __name__ == '__main__':
    parse_output()

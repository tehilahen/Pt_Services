"""
Run a built-in Python SAST (Static Application Security Testing) review.
Scans for common security vulnerabilities using regex patterns and AST.
Reads from {WORK_DIR}/repo, writes to {WORK_DIR}/output/review_raw.txt
"""
import ast
import json
import os
import re
import sys

SECURITY_RULES = [
    {
        'id': 'SEC-HARDCODED-SECRET',
        'title': 'Hardcoded Secret or Password',
        'pattern': r'''(?i)(?:password|passwd|pwd|secret|api_key|apikey|token|private_key)\s*[=:]\s*['\"][^'\"]{4,}['\"]''',
        'severity': 'Critical',
        'probability': 'High',
        'risk': 'Critical',
        'recommendation': 'Move secrets to environment variables or a secrets manager. Never hardcode credentials in source code.',
        'tags': ['secrets', 'owasp-a2', 'hardcoded-credentials'],
        'exclude_patterns': [r'getenv', r'os\.environ', r'environ\.get', r'<YOUR', r'placeholder', r'example', r'changeme', r'xxx'],
    },
    {
        'id': 'SEC-SQL-INJECTION',
        'title': 'Potential SQL Injection',
        'pattern': r'''(?:execute|cursor\.execute)\s*\(\s*(?:f['\"]|['\"].*%s|['\"].*\.format|['\"].*\+\s*\w)''',
        'severity': 'Critical',
        'probability': 'High',
        'risk': 'Critical',
        'recommendation': 'Use parameterized queries (? placeholders) instead of string formatting in SQL statements.',
        'tags': ['sql-injection', 'owasp-a3', 'injection'],
    },
    {
        'id': 'SEC-EVAL-EXEC',
        'title': 'Use of eval() or exec()',
        'pattern': r'\b(?:eval|exec)\s*\(',
        'severity': 'High',
        'probability': 'Medium',
        'risk': 'High',
        'recommendation': 'Avoid eval/exec. Use safer alternatives like ast.literal_eval for data parsing or specific parsers.',
        'tags': ['code-injection', 'owasp-a3'],
    },
    {
        'id': 'SEC-DEBUG-MODE',
        'title': 'Debug Mode Enabled in Production',
        'pattern': r'''(?:debug\s*[=:]\s*True|DEBUG\s*[=:]\s*True|FLASK_DEBUG\s*[=:]\s*(?:True|1|['\"]1['\"])|app\.run\(.*debug\s*=\s*True)''',
        'severity': 'Medium',
        'probability': 'High',
        'risk': 'High',
        'recommendation': 'Disable debug mode in production. Use environment variables to control debug settings.',
        'tags': ['configuration', 'debug', 'owasp-a5'],
    },
    {
        'id': 'SEC-INSECURE-DESERIALIZE',
        'title': 'Insecure Deserialization (pickle/yaml)',
        'pattern': r'\b(?:pickle\.loads?|yaml\.load\s*\((?!.*Loader\s*=\s*yaml\.SafeLoader)|yaml\.unsafe_load)\b',
        'severity': 'High',
        'probability': 'Medium',
        'risk': 'High',
        'recommendation': 'Use yaml.safe_load instead of yaml.load. Avoid pickle for untrusted data; use JSON instead.',
        'tags': ['deserialization', 'owasp-a8'],
    },
    {
        'id': 'SEC-WEAK-CRYPTO',
        'title': 'Weak Cryptographic Algorithm',
        'pattern': r'\b(?:md5|sha1)\s*\(|hashlib\.(?:md5|sha1)\s*\(',
        'severity': 'Medium',
        'probability': 'Medium',
        'risk': 'Medium',
        'recommendation': 'Use SHA-256 or stronger hashing algorithms. For passwords, use bcrypt or argon2.',
        'tags': ['cryptography', 'owasp-a2'],
    },
    {
        'id': 'SEC-INSECURE-RANDOM',
        'title': 'Insecure Random Number Generation',
        'pattern': r'\brandom\.(?:random|randint|choice|randrange|shuffle)\b',
        'severity': 'Low',
        'probability': 'Medium',
        'risk': 'Medium',
        'recommendation': 'Use secrets module or os.urandom for security-sensitive random values (tokens, keys, etc.).',
        'tags': ['cryptography', 'random'],
        'context_check': r'(?i)(?:token|secret|key|password|session|nonce|salt|csrf)',
    },
    {
        'id': 'SEC-CORS-WILDCARD',
        'title': 'CORS Wildcard or Overly Permissive',
        'pattern': r'''(?:CORS\(.*\*|Access-Control-Allow-Origin.*\*|cors.*origins?\s*[=:]\s*['\"]?\*)''',
        'severity': 'Medium',
        'probability': 'Medium',
        'risk': 'Medium',
        'recommendation': 'Restrict CORS to specific trusted origins instead of using wildcard (*).',
        'tags': ['cors', 'owasp-a5', 'configuration'],
    },
    {
        'id': 'SEC-NO-VERIFY-SSL',
        'title': 'SSL Certificate Verification Disabled',
        'pattern': r'verify\s*=\s*False|CERT_NONE|check_hostname\s*=\s*False|secure\s*=\s*False',
        'severity': 'Medium',
        'probability': 'Medium',
        'risk': 'High',
        'recommendation': 'Always verify SSL certificates. Disabling verification allows MITM attacks.',
        'tags': ['ssl', 'tls', 'owasp-a2'],
    },
    {
        'id': 'SEC-PATH-TRAVERSAL',
        'title': 'Potential Path Traversal',
        'pattern': r'(?:open|os\.path\.join|send_file|send_from_directory)\s*\(.*(?:request\.|user_input|filename|path)',
        'severity': 'High',
        'probability': 'Medium',
        'risk': 'High',
        'recommendation': 'Validate and sanitize file paths. Use os.path.basename to strip directory components from user input.',
        'tags': ['path-traversal', 'owasp-a1', 'lfi'],
    },
    {
        'id': 'SEC-COMMAND-INJECTION',
        'title': 'Potential Command Injection',
        'pattern': r'(?:subprocess\.(?:call|run|Popen)|os\.system|os\.popen)\s*\(.*(?:f[\'"]|\+\s*\w|\.format|%s)',
        'severity': 'Critical',
        'probability': 'Medium',
        'risk': 'Critical',
        'recommendation': 'Use subprocess with a list of arguments (not shell=True). Never pass user input directly to shell commands.',
        'tags': ['command-injection', 'owasp-a3', 'rce'],
    },
    {
        'id': 'SEC-SHELL-TRUE',
        'title': 'Subprocess with shell=True',
        'pattern': r'subprocess\.(?:call|run|Popen|check_output|check_call)\s*\(.*shell\s*=\s*True',
        'severity': 'High',
        'probability': 'Medium',
        'risk': 'High',
        'recommendation': 'Avoid shell=True in subprocess calls. Pass commands as a list of arguments instead.',
        'tags': ['command-injection', 'owasp-a3'],
    },
    {
        'id': 'SEC-EXCEPTION-DISCLOSURE',
        'title': 'Detailed Error Information Exposed',
        'pattern': r'(?:return\s+.*str\(e\)|response.*str\(e\)|jsonify\(.*str\(e\)|traceback\.format_exc)',
        'severity': 'Low',
        'probability': 'High',
        'risk': 'Medium',
        'recommendation': 'Do not expose internal error details to users. Log the full error server-side and return generic error messages.',
        'tags': ['information-disclosure', 'owasp-a6'],
    },
    {
        'id': 'SEC-WEAK-JWT-SECRET',
        'title': 'Weak or Default JWT Secret Key',
        'pattern': r'''(?i)(?:jwt|secret).*[=:]\s*['\"](?:secret|change.?me|default|password|key123|your.?secret)['\"]''',
        'severity': 'Critical',
        'probability': 'High',
        'risk': 'Critical',
        'recommendation': 'Use a strong, randomly generated secret key for JWT. Store it in environment variables.',
        'tags': ['jwt', 'authentication', 'owasp-a2'],
    },
    {
        'id': 'SEC-MISSING-RATE-LIMIT',
        'title': 'Authentication Endpoint Without Rate Limiting',
        'pattern': r'''@app\.route\s*\(\s*['\"].*(?:login|auth|signin).*['\"]\s*[,)](?:(?!limiter|rate_limit).)*def\s+\w+''',
        'severity': 'Medium',
        'probability': 'Medium',
        'risk': 'Medium',
        'recommendation': 'Add rate limiting to authentication endpoints to prevent brute force attacks.',
        'tags': ['brute-force', 'rate-limiting', 'owasp-a7'],
        'multiline': True,
    },
]

SCAN_EXTENSIONS = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cs', '.go', '.rb', '.php', '.yml', '.yaml', '.json', '.xml', '.conf', '.cfg', '.ini', '.env'}
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'env', 'dist', 'build', '.tox'}
MAX_FILE_SIZE = 500_000


def scan_file(file_path, repo_dir):
    """Scan a single file for security vulnerabilities."""
    findings = []
    rel_path = os.path.relpath(file_path, repo_dir).replace('\\', '/')

    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception:
        return findings

    if len(content) > MAX_FILE_SIZE:
        return findings

    lines = content.split('\n')

    for rule in SECURITY_RULES:
        flags = re.DOTALL if rule.get('multiline') else 0
        try:
            matches = list(re.finditer(rule['pattern'], content, flags))
        except re.error:
            continue

        for match in matches:
            exclude = rule.get('exclude_patterns', [])
            line_start = content[:match.start()].count('\n')
            line_text = lines[line_start] if line_start < len(lines) else ''

            if any(re.search(ep, line_text, re.IGNORECASE) for ep in exclude):
                continue

            ctx_check = rule.get('context_check')
            if ctx_check:
                context_start = max(0, line_start - 5)
                context_end = min(len(lines), line_start + 5)
                context_block = '\n'.join(lines[context_start:context_end])
                if not re.search(ctx_check, context_block):
                    continue

            snippet_start = max(0, line_start - 1)
            snippet_end = min(len(lines), line_start + 3)
            snippet = '\n'.join(lines[snippet_start:snippet_end])

            findings.append({
                'finding_code': f"{rule['id']}-{len(findings)+1:03d}",
                'title': rule['title'],
                'description': f"Found in {rel_path} at line {line_start + 1}: {rule['title']}",
                'severity': rule['severity'],
                'probability': rule['probability'],
                'risk': rule['risk'],
                'file_path': rel_path,
                'line_number': line_start + 1,
                'code_snippet': snippet[:1000],
                'recommendation': rule['recommendation'],
                'tags': rule['tags'],
            })

    return findings


def run_review():
    work_dir = os.environ.get('WORK_DIR', '/work')
    repo_dir = os.path.join(work_dir, 'repo')
    output_dir = os.path.join(work_dir, 'output')
    output_file = os.path.join(output_dir, 'review_raw.txt')

    os.makedirs(output_dir, exist_ok=True)

    if not os.path.isdir(repo_dir):
        print(f"ERROR: Repository directory not found at {repo_dir}")
        sys.exit(1)

    print("Starting built-in SAST security review...")
    print(f"Working directory: {repo_dir}")

    all_findings = []
    files_scanned = 0

    for root, dirs, files in os.walk(repo_dir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            if ext not in SCAN_EXTENSIONS and fname not in ('.env', '.env_backup', 'Dockerfile', 'dockerfile'):
                continue

            file_path = os.path.join(root, fname)
            file_findings = scan_file(file_path, repo_dir)
            all_findings.extend(file_findings)
            files_scanned += 1

    seen = set()
    unique_findings = []
    for f in all_findings:
        key = (f['file_path'], f['line_number'], f['title'])
        if key not in seen:
            seen.add(key)
            f['finding_code'] = f"SEC-{len(unique_findings)+1:03d}"
            unique_findings.append(f)

    with open(output_file, 'w', encoding='utf-8') as out:
        json.dump(unique_findings, out, indent=2, ensure_ascii=False)

    severity_counts = {}
    for finding in unique_findings:
        sev = finding['severity']
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    print(f"Files scanned: {files_scanned}")
    print(f"Found {len(unique_findings)} findings:")
    for sev in ['Critical', 'High', 'Medium', 'Low']:
        count = severity_counts.get(sev, 0)
        if count:
            print(f"  {sev}: {count}")

    print(f"Output written to {output_file}")


if __name__ == '__main__':
    run_review()

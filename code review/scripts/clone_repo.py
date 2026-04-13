"""
Clone repository from Azure DevOps Server (TFS).
Supports two authentication modes:
  - Windows Authentication (Active Directory) - default when TFS_PAT is empty
  - PAT via Basic auth header - used inside Docker or when TFS_PAT is set
"""
import os
import subprocess
import sys
import base64


def clone_repository():
    repo_url = os.environ.get('REPO_URL', '')
    branch = os.environ.get('BRANCH', 'master')
    tfs_pat = os.environ.get('TFS_PAT', '')
    work_dir = os.environ.get('WORK_DIR', '/work')
    clone_dir = os.path.join(work_dir, 'repo')

    if not repo_url:
        print("ERROR: REPO_URL environment variable is not set")
        sys.exit(1)

    print(f"Cloning from: {repo_url}")
    print(f"Branch: {branch}")

    cmd = ['git', 'clone', '--branch', branch, '--single-branch', '--depth', '1']

    if tfs_pat:
        # PAT authentication (for Docker / non-AD environments)
        auth_b64 = base64.b64encode(f':{tfs_pat}'.encode()).decode()
        cmd += ['-c', f'http.extraHeader=Authorization: Basic {auth_b64}']
        print("Auth: PAT (Basic auth header)")
    else:
        print("Auth: Windows Authentication (Active Directory)")

    cmd += [repo_url, clone_dir]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600
        )

        if result.returncode != 0:
            stderr = result.stderr
            if tfs_pat:
                stderr = stderr.replace(tfs_pat, '***')
            print(f"Git clone failed: {stderr}")
            sys.exit(1)

        print(f"Repository cloned successfully to {clone_dir}")

        file_count = sum(len(files) for _, _, files in os.walk(clone_dir))
        print(f"Total files in repository: {file_count}")

    except subprocess.TimeoutExpired:
        print("ERROR: Git clone timed out after 600 seconds")
        sys.exit(1)
    except Exception as e:
        error_msg = str(e)
        if tfs_pat:
            error_msg = error_msg.replace(tfs_pat, '***')
        print(f"ERROR: {error_msg}")
        sys.exit(1)


if __name__ == '__main__':
    clone_repository()

"""
Code Review Orchestrator - manages automated security code reviews.
Supports two execution modes:
  - docker: runs the pipeline inside an isolated Docker container
  - local:  runs the pipeline scripts directly as subprocesses (no Docker required)
"""
import os
import sys
import logging
import threading
import subprocess
import shutil
from src.database import db_connection

logger = logging.getLogger(__name__)


class CodeReviewOrchestrator:
    def __init__(self):
        self._client = None

    def _get_config(self):
        """Read config from env vars at call time (after load_dotenv)."""
        return {
            'image_name': os.getenv('CODE_REVIEWER_IMAGE', 'code-reviewer:latest'),
            'tfs_pat': os.getenv('TFS_PAT', ''),
            'tfs_base_url': os.getenv('TFS_BASE_URL', ''),
            'mssql_conn_str': os.getenv('SQL_CONNECTION_STRING', ''),
            'run_mode': os.getenv('CODE_REVIEW_RUN_MODE', 'docker').lower(),
            'work_dir': os.getenv(
                'CODE_REVIEW_WORK_DIR',
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '..', 'Security_code_review')
            ),
        }

    @property
    def client(self):
        """Lazy-init Docker client (only used in docker mode)."""
        if self._client is None:
            import docker
            try:
                self._client = docker.from_env()
                self._client.ping()
                logger.info("Docker client connected successfully")
            except Exception as e:
                logger.error(f"Failed to connect to Docker: {e}")
                raise
        return self._client

    def start_code_review(self, system_id, user_id=None):
        """
        Start a code review for a system.
        Creates a task in DB and launches the review pipeline asynchronously.
        Returns the task_id.
        """
        config = self._get_config()

        repo_info = db_connection.get_system_repo_info(system_id)
        if not repo_info:
            raise ValueError(f"System {system_id} not found")

        repo_url = repo_info.get('RepoURL')
        branch = repo_info.get('Branch', 'master')

        if not repo_url:
            raise ValueError(f"System {system_id} has no repository URL configured")

        task_id = db_connection.create_code_review(system_id, repo_url, branch, user_id)
        if not task_id:
            raise RuntimeError("Failed to create code review task in database")

        if config['run_mode'] == 'local':
            target = self._run_local
        else:
            target = self._run_container

        thread = threading.Thread(
            target=target,
            args=(task_id, repo_url, branch, config),
            daemon=True
        )
        thread.start()

        logger.info(f"Code review task {task_id} started for system {system_id} (mode={config['run_mode']})")
        return task_id

    # =========================================================================
    # Local execution mode
    # =========================================================================

    def _run_local(self, task_id, repo_url, branch, config):
        """Run the code review pipeline locally (executed in a background thread)."""
        work_dir = config['work_dir']
        scripts_dir = os.path.join(work_dir, 'scripts')
        python_exe = sys.executable

        logger.info(f"Task {task_id} config: work_dir={work_dir}, "
                    f"tfs_pat={'SET' if config['tfs_pat'] else 'EMPTY'}, "
                    f"mssql={'SET' if config['mssql_conn_str'] else 'EMPTY'}")

        use_windows_auth = sys.platform == 'win32' and not os.getenv('FORCE_PAT_AUTH')
        env = {
            **os.environ,
            'TASK_ID': str(task_id),
            'REPO_URL': repo_url,
            'BRANCH': branch,
            'TFS_PAT': '' if use_windows_auth else config['tfs_pat'],
            'MSSQL_CONNECTION_STRING': config['mssql_conn_str'],
            'WORK_DIR': work_dir,
        }

        repo_dir = os.path.join(work_dir, 'repo')
        output_dir = os.path.join(work_dir, 'output')
        logs_dir = os.path.join(work_dir, 'logs')

        for d in [repo_dir, output_dir, logs_dir]:
            if d == repo_dir and os.path.exists(d):
                def _on_rm_error(func, path, exc_info):
                    os.chmod(path, 0o777)
                    func(path)
                shutil.rmtree(d, onerror=_on_rm_error)
            os.makedirs(d, exist_ok=True)

        steps = [
            ('Updating status to Running', [python_exe, os.path.join(scripts_dir, 'update_status.py'), str(task_id), 'Running']),
            ('Cloning repository',         [python_exe, os.path.join(scripts_dir, 'clone_repo.py')]),
            ('Running security review',    [python_exe, os.path.join(scripts_dir, 'run_review.py')]),
            ('Parsing review output',      [python_exe, os.path.join(scripts_dir, 'parse_output.py')]),
            ('Generating HTML report',     [python_exe, os.path.join(scripts_dir, 'generate_html.py')]),
            ('Pushing results to DB',      [python_exe, os.path.join(scripts_dir, 'push_results.py')]),
        ]

        try:
            for i, (description, cmd) in enumerate(steps, 1):
                logger.info(f"Task {task_id} [{i}/{len(steps)}] {description}")
                result = subprocess.run(
                    cmd,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=1800,
                    cwd=work_dir,
                )
                if result.stdout:
                    logger.info(f"Task {task_id} stdout: {result.stdout.strip()}")
                if result.returncode != 0:
                    error_msg = f"Step '{description}' failed (exit code {result.returncode}): {result.stderr.strip()}"
                    logger.error(f"Task {task_id}: {error_msg}")
                    db_connection.update_code_review_status(task_id, 'Failed', error_msg[:4000])
                    return

            logger.info(f"Task {task_id} completed successfully (local mode)")

        except subprocess.TimeoutExpired:
            error_msg = "Code review pipeline timed out after 30 minutes"
            logger.error(f"Task {task_id}: {error_msg}")
            db_connection.update_code_review_status(task_id, 'Failed', error_msg)
        except Exception as e:
            error_msg = str(e)[:4000]
            logger.error(f"Task {task_id} local execution error: {error_msg}")
            db_connection.update_code_review_status(task_id, 'Failed', error_msg)

    # =========================================================================
    # Docker execution mode
    # =========================================================================

    def _run_container(self, task_id, repo_url, branch, config):
        """Run the code review container (executed in a background thread)."""
        container = None
        try:
            environment = {
                'TASK_ID': str(task_id),
                'REPO_URL': repo_url,
                'BRANCH': branch,
                'TFS_PAT': config['tfs_pat'],
                'MSSQL_CONNECTION_STRING': config['mssql_conn_str'],
            }

            logger.info(f"Starting container for task {task_id}")

            container = self.client.containers.run(
                image=config['image_name'],
                environment=environment,
                detach=True,
                auto_remove=False,
                name=f"code-review-{task_id}",
                mem_limit='2g',
                cpu_period=100000,
                cpu_quota=200000,
                network_mode='bridge',
            )

            result = container.wait(timeout=1800)
            exit_code = result.get('StatusCode', -1)

            logs = container.logs(tail=200).decode('utf-8', errors='replace')

            if exit_code == 0:
                logger.info(f"Container for task {task_id} completed successfully")
            else:
                error_msg = f"Container exited with code {exit_code}"
                logger.error(f"Task {task_id}: {error_msg}")
                db_connection.update_code_review_status(task_id, 'Failed', error_msg)

        except Exception as e:
            error_msg = str(e)[:4000]
            logger.error(f"Task {task_id} container error: {error_msg}")
            db_connection.update_code_review_status(task_id, 'Failed', error_msg)

        finally:
            if container:
                try:
                    container.remove(force=True)
                    logger.info(f"Container for task {task_id} removed")
                except Exception:
                    pass

    # =========================================================================
    # Query helpers
    # =========================================================================

    def get_review_status(self, task_id):
        """Get the current status of a code review task."""
        return db_connection.get_code_review(task_id)

    def get_review_findings(self, task_id):
        """Get findings for a code review task."""
        return db_connection.get_code_review_findings(task_id)

    def get_review_report(self, task_id):
        """Get the HTML report artifact for a code review task."""
        return db_connection.get_code_review_artifact(task_id, 'security-report.html')


code_review_orchestrator = CodeReviewOrchestrator()

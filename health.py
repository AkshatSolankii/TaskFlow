
"""
Health & version monitoring endpoints.

/health  -> checks app + database connectivity, returns 200 or 503
/version -> returns app version / build metadata
"""

import os
import sys
from datetime import datetime, timezone

from flask import Blueprint, jsonify
from sqlalchemy import text

from models import db

health_bp = Blueprint("health_bp", __name__)

# Set these via environment variables in production (e.g. in your
# Dockerfile / docker-compose.yml / CI pipeline). Falls back to
# sensible defaults for local dev.
APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")
BUILD_DATE = os.environ.get("BUILD_DATE", "unknown")
GIT_COMMIT = os.environ.get("GIT_COMMIT", "unknown")


@health_bp.route("/health", methods=["GET"])
def health_check():
    """
    Health check
    Returns the operational status of the app and its dependencies
    (currently: the database). Intended for load balancers / uptime
    monitors / container orchestrators (e.g. Docker HEALTHCHECK, k8s
    liveness & readiness probes).
    ---
    tags:
      - Monitoring
    responses:
      200:
        description: Service and all dependencies are healthy
        examples:
          application/json:
            status: ok
            timestamp: "2026-07-15T10:00:00+00:00"
            checks:
              database:
                status: ok
      503:
        description: One or more dependencies are unhealthy
        examples:
          application/json:
            status: error
            timestamp: "2026-07-15T10:00:00+00:00"
            checks:
              database:
                status: error
                detail: "connection refused"
    """
    checks = {}
    overall_status = "ok"

    # --- Database connectivity check ---
    try:
        db.session.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as exc:
        checks["database"] = {"status": "error", "detail": str(exc)}
        overall_status = "error"

    response = {
        "status": overall_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }

    status_code = 200 if overall_status == "ok" else 503
    return jsonify(response), status_code


@health_bp.route("/version", methods=["GET"])
def version_info():
    """
    Version info
    Returns app version and build metadata. Useful for confirming
    which build is currently deployed.
    ---
    tags:
      - Monitoring
    responses:
      200:
        description: Version metadata
        examples:
          application/json:
            app_name: "Task Manager API"
            version: "1.0.0"
            build_date: "2026-07-15"
            git_commit: "a1b2c3d"
            python_version: "3.12.3"
    """
    return jsonify(
        {
            "app_name": "Task Manager API",
            "version": APP_VERSION,
            "build_date": BUILD_DATE,
            "git_commit": GIT_COMMIT,
            "python_version": sys.version.split()[0],
        }
    )
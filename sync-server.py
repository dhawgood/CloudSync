import os
import platform
import sys
import subprocess
from flask import Flask, jsonify, request

# ==============================================================================
#  RCLONE PATH DETECTION LOGIC
# ==============================================================================

def get_rclone_path():
    """
    Determines the correct path to the rclone executable.
    """
    env_path = os.environ.get('CLOUDSYNC_RCLONE_PATH')
    if env_path and os.path.exists(env_path):
        print(f"✅ Received rclone path from main process: {env_path}")
        return env_path
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    system_name = platform.system().lower()
    architecture = platform.machine()
    if system_name == 'darwin':
        rclone_subdir = f"darwin-{architecture}"
    elif system_name == 'windows':
        rclone_subdir = 'windows-amd64'
    else: # linux
        rclone_subdir = 'linux-amd64'
    rclone_path = os.path.join(base_path, 'rclone-binaries', rclone_subdir, 'rclone')
    if system_name == 'windows':
        rclone_path += '.exe'
    if os.path.exists(rclone_path) and os.access(rclone_path, os.X_OK):
        print(f"✅ Found bundled rclone manually: {rclone_path}")
        return rclone_path
    print("❌ Could not find bundled rclone. Falling back to 'rclone' in system PATH.")
    return "rclone"

RCLONE_PATH = get_rclone_path()
SERVER_PORT = int(os.environ.get('CLOUDSYNC_PORT', 8989))


# ==============================================================================
#  FLASK SERVER APPLICATION
# ==============================================================================

app = Flask(__name__)

@app.route('/status')
def status():
    """A simple endpoint to check if the server is running."""
    return jsonify({"status": "ok", "rclone_path": RCLONE_PATH})

@app.route('/execute', methods=['POST'])
def execute_command():
    """
    Executes a command and returns the complete output in a JSON object.
    This version gracefully handles invalid commands.
    """
    try:
        data = request.get_json()
    except Exception as e:
        # This catch is still important for malformed requests
        return jsonify({"success": False, "output": f"Failed to parse JSON: {e}"}), 400

    # Gracefully handle missing or empty command
    if not data or 'command' not in data or not data.get('command'):
        return jsonify({"success": False, "output": "Received empty or missing command."})

    full_command = data.get('command')
    command_args = full_command.split()

    # Gracefully handle commands that don't start with rclone
    if not command_args or command_args[0].lower() != 'rclone':
        return jsonify({"success": False, "output": f"Invalid command received: {full_command}"})

    command_args[0] = RCLONE_PATH

    try:
        process = subprocess.run(
            command_args, capture_output=True, text=True, encoding='utf-8'
        )
        output = process.stdout + process.stderr
        success = process.returncode == 0
        return jsonify({"success": success, "output": output})
    except Exception as e:
        return jsonify({"success": False, "output": f"Python server error: {str(e)}"}), 500


if __name__ == '__main__':
    print(f"Starting Python sync server on port {SERVER_PORT}...")
    app.run(host='127.0.0.1', port=SERVER_PORT)
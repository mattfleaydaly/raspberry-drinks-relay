from flask import Flask, render_template, jsonify, request, Response, redirect, url_for, send_file
from gpiozero import OutputDevice
import os
import socket
import json
import time
import random
import threading
from threading import Lock
import subprocess
from werkzeug.utils import secure_filename
import shutil
from datetime import datetime

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.context_processor
def inject_system_name():
    """Provide system_name to all templates."""
    try:
        return {"system_name": get_config().get("system_name", "Drinks Bro")}
    except Exception:
        return {"system_name": "Drinks Bro"}

# Define relay pins
relay_pins = {
    "Relay 1": OutputDevice(26, active_high=False),
    "Relay 2": OutputDevice(19, active_high=False),
    "Relay 3": OutputDevice(16, active_high=False),
    "Relay 4": OutputDevice(20, active_high=False),
}

# Add test locking mechanism
test_lock = Lock()
test_in_progress = False
drink_progress = {
    "active": False,
    "drink_name": None,
    "started_at": None,
    "total_time": 0,
    "expected_total": 0,
    "current_step": 0,
    "steps": 0
}
self_test_progress = {
    "active": False,
    "relay": None,
    "action": None,
    "step": 0,
    "steps": 0
}

# Constants
DRINKS_CONFIG_FILE = "drinks.json"

# Helper functions
def run_command(command):
    """Run a shell command and return the output."""
    try:
        result = subprocess.run(command, shell=True, text=True, capture_output=True)
        return result.stdout.strip()
    except Exception as e:
        return str(e)

def run_cmd(args, cwd=None, shell=False):
    return subprocess.run(
        args,
        cwd=cwd,
        shell=shell,
        text=True,
        capture_output=True
    )

def backup_state():
    backup_dir = os.path.join(BASE_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = os.path.join(backup_dir, f"backup-{stamp}")
    os.makedirs(dest, exist_ok=True)
    for name in ["config.json", "drinks.json", "photo_library.json", "relay_states.json"]:
        src = os.path.join(BASE_DIR, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(dest, name))
    return dest

def write_commit_marker(name, commit):
    try:
        with open(os.path.join(BASE_DIR, name), "w") as f:
            f.write(commit.strip() + "\n")
    except Exception:
        pass

def read_commit_marker(name):
    try:
        path = os.path.join(BASE_DIR, name)
        if not os.path.exists(path):
            return None
        with open(path, "r") as f:
            return f.read().strip()
    except Exception:
        return None

def health_check():
    # Lightweight sanity check: Python syntax compile
    result = run_cmd(["python3", "-m", "py_compile", os.path.join(BASE_DIR, "app.py")])
    return result.returncode == 0, (result.stderr or result.stdout).strip()

def preflight_checks():
    # Disk space
    usage = shutil.disk_usage(BASE_DIR)
    free_mb = usage.free // (1024 * 1024)
    if free_mb < 200:
        return False, f"Low disk space: {free_mb}MB free"
    # Network check
    ping = run_cmd(["/bin/ping", "-c", "1", "-W", "2", "8.8.8.8"])
    if ping.returncode != 0:
        return False, "Network check failed (no internet)"
    return True, "Preflight OK"

# Initialize relay states
def initialize_relay_states():
    states = {relay: False for relay in relay_pins.keys()}
    save_relay_states(states)
    for relay in relay_pins.values():
        relay.off()

# Load relay states from file
def load_relay_states():
    if not os.path.exists("relay_states.json"):
        initialize_relay_states()
    with open("relay_states.json", "r") as f:
        return json.load(f)

# Save relay states to file
def save_relay_states(states):
    with open("relay_states.json", "w") as f:
        json.dump(states, f)

# Load drinks configuration
def load_drinks_config():
    if not os.path.exists(DRINKS_CONFIG_FILE):
        # Create default empty drinks configuration
        default_drinks = []
        with open(DRINKS_CONFIG_FILE, "w") as f:
            json.dump(default_drinks, f)
        return default_drinks
    
    try:
        with open(DRINKS_CONFIG_FILE, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        # If the file is corrupted, return empty list
        return []

# Save drinks configuration
def save_drinks_config(drinks_data):
    with open(DRINKS_CONFIG_FILE, "w") as f:
        json.dump(drinks_data, f, indent=2)

# Get local IP address
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "NOT CONNECTED"
    finally:
        s.close()
    return ip

# Read latest version from version.txt
def get_latest_version():
    if not os.path.exists("version.txt"):
        with open("version.txt", "w") as f:
            f.write("1.0.0\n")
    with open("version.txt", "r") as f:
        return f.readline().strip()

# Load configuration from config.json
def get_config():
    if not os.path.exists("config.json"):
        default_config = {"system_name": "Drink Machine Controller"}
        with open("config.json", "w") as f:
            json.dump(default_config, f)
    with open("config.json", "r") as f:
        return json.load(f)

def save_config(config):
    with open("config.json", "w") as f:
        json.dump(config, f, indent=4)

# Helper function to check NetworkManager status
def check_networkmanager_status():
    """Check if NetworkManager is properly configured."""
    try:
        # Check if NetworkManager service is running
        nm_status = subprocess.run(
            ["sudo", "systemctl", "is-active", "NetworkManager"],
            capture_output=True,
            text=True
        )
        
        if nm_status.returncode != 0:
            return False, "NetworkManager service not running"
        
        # Check if wifi radio is enabled
        radio_status = subprocess.run(
            ["nmcli", "radio", "wifi"],
            capture_output=True,
            text=True
        )
        
        if "enabled" not in radio_status.stdout:
            # Try to enable wifi radio
            subprocess.run(["sudo", "nmcli", "radio", "wifi", "on"], capture_output=True)
        
        return True, "NetworkManager is ready"
        
    except Exception as e:
        return False, f"Error checking NetworkManager: {str(e)}"

PHOTOS_FOLDER = 'photos/albums'
PHOTO_LIB_JSON = 'photo_library.json'

# USB mount locations to check
USB_MOUNT_PATHS = [
    '/mnt/usb',
    '/media/pi', 
    '/run/media/pi',
    f'/media/{os.getenv("USER", "pi")}',
    '/media/usb',
    '/media/usb0',
    '/media/usb1'
]

def load_photo_library():
    if not os.path.exists(PHOTO_LIB_JSON):
        default_structure = {"folders": ["default"], "photos": {}}
        save_photo_library(default_structure)
    with open(PHOTO_LIB_JSON, "r") as f:
        return json.load(f)

def save_photo_library(data):
    with open(PHOTO_LIB_JSON, "w") as f:
        json.dump(data, f, indent=2)

def find_usb_mount():
    """Find the first available USB mount point (including submounts)."""
    # First, scan known mount roots
    for path in USB_MOUNT_PATHS:
        if not os.path.exists(path):
            continue

        # If the path itself is a mount, use it.
        if os.path.ismount(path):
            try:
                os.listdir(path)
                return path
            except PermissionError:
                continue

        # If it's a directory, check its immediate subfolders for mounts (e.g., /media/pi/USB)
        if os.path.isdir(path):
            try:
                for entry in os.listdir(path):
                    subpath = os.path.join(path, entry)
                    if os.path.ismount(subpath):
                        try:
                            os.listdir(subpath)
                            return subpath
                        except PermissionError:
                            continue
            except PermissionError:
                continue

    # Fallback: parse lsblk to discover removable USB mounts
    try:
        lsblk_result = subprocess.run(['lsblk', '-f'], capture_output=True, text=True)
        for line in lsblk_result.stdout.splitlines():
            if 'vfat' in line.lower() or 'exfat' in line.lower() or 'ntfs' in line.lower():
                parts = line.split()
                if parts:
                    mountpoints = parts[-1:]
                    for mp in mountpoints:
                        if os.path.exists(mp) and os.path.ismount(mp):
                            return mp
    except Exception:
        pass

    return None

def get_image_files(directory):
    """Get all image files from a directory"""
    if not os.path.exists(directory):
        return []
    
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'}
    files = []
    
    try:
        for filename in os.listdir(directory):
            if any(filename.lower().endswith(ext) for ext in image_extensions):
                file_path = os.path.join(directory, filename)
                if os.path.isfile(file_path):
                    files.append({
                        'name': filename,
                        'path': file_path,
                        'size': os.path.getsize(file_path)
                    })
    except PermissionError:
        pass
    
    return files

@app.route("/photo-library")
def photo_library():
    data = load_photo_library()
    return render_template("photo_library.html", data=data)

@app.route("/api/photo-library/scan-usb", methods=["GET"])
def scan_usb():
    """Scan for USB drives"""
    try:
        usb_path = find_usb_mount()
        
        if usb_path:
            # Check if there are any image files
            image_files = get_image_files(usb_path)
            
            return jsonify({
                'found': True,
                'name': f'USB Drive ({os.path.basename(usb_path)})',
                'path': usb_path,
                'image_count': len(image_files)
            })
        else:
            return jsonify({
                'found': False,
                'error': 'No mounted USB drive found',
                'checked_paths': USB_MOUNT_PATHS
            })
            
    except Exception as e:
        return jsonify({
            'found': False,
            'error': f'Error scanning for USB: {str(e)}'
        })

@app.route("/api/photo-library/list-usb", methods=["GET"])
def list_usb_photos():
    """List all photos on the USB drive"""
    try:
        usb_path = find_usb_mount()
        
        if not usb_path:
            return jsonify({
                'success': False,
                'error': 'No USB drive found',
                'photos': []
            })
        
        photos = get_image_files(usb_path)
        
        return jsonify({
            'success': True,
            'photos': photos,
            'usb_path': usb_path
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'photos': []
        })

@app.route("/api/photo-library/usb-preview/<path:filename>", methods=["GET"])
def usb_preview(filename):
    """Serve USB photo previews"""
    try:
        usb_path = find_usb_mount()
        if not usb_path:
            return "USB not found", 404

        file_path = os.path.normpath(os.path.join(usb_path, filename))
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return "File not found", 404
            
        return send_file(file_path)
        
    except Exception as e:
        return f"Error: {str(e)}", 500

@app.route("/photos/albums/<path:filename>")
def serve_saved_photo(filename):
    """Serve saved photos from the local library."""
    try:
        file_path = os.path.normpath(os.path.join(PHOTOS_FOLDER, filename))
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return "File not found", 404
        return send_file(file_path)
    except Exception as e:
        return f"Error: {str(e)}", 500

@app.route("/api/photo-library/list-saved", methods=["GET"])
def list_saved_photos():
    """List all saved photos with URLs."""
    try:
        data = load_photo_library()
        photos = []
        for filename, folder in data.get("photos", {}).items():
            photos.append({
                "name": filename,
                "folder": folder,
                "url": f"/photos/albums/{folder}/{filename}"
            })
        return jsonify({"success": True, "photos": photos, "folders": data.get("folders", [])})
    except Exception as e:
        return jsonify({"success": False, "error": str(e), "photos": []})

@app.route("/api/photo-library/import-usb", methods=["POST"])
def import_photos_usb():
    """Import selected photos from USB"""
    try:
        folder = request.json.get('folder', 'default')
        selected_photos = request.json.get('photos', [])
        
        if not selected_photos:
            return jsonify({"success": False, "error": "No photos selected"})
        
        usb_path = find_usb_mount()
        if not usb_path:
            return jsonify({"success": False, "error": "USB drive not found"})
        
        data = load_photo_library()
        
        # Ensure folder exists
        if folder not in data["folders"]:
            data["folders"].append(folder)
        
        folder_path = os.path.join(PHOTOS_FOLDER, folder)
        os.makedirs(folder_path, exist_ok=True)
        os.chmod(folder_path, 0o775)
        
        imported = []
        errors = []
        
        for photo_name in selected_photos:
            try:
                src = os.path.join(usb_path, photo_name)
                if not os.path.exists(src):
                    errors.append(f"File not found: {photo_name}")
                    continue
                
                safe_filename = secure_filename(photo_name)
                dest = os.path.join(folder_path, safe_filename)
                
                # Copy file
                shutil.copy2(src, dest)
                os.chmod(dest, 0o664)
                
                # Update library
                data["photos"][safe_filename] = folder
                imported.append(safe_filename)
                
            except Exception as e:
                errors.append(f"Error importing {photo_name}: {str(e)}")
        
        save_photo_library(data)
        
        return jsonify({
            "success": True,
            "imported": imported,
            "errors": errors,
            "imported_count": len(imported)
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/api/photo-library/create-folder", methods=["POST"])
def create_folder():
    """Create a new photo folder"""
    try:
        folder_name = request.json.get("folder")
        if not folder_name:
            return jsonify({"success": False, "error": "Folder name required"})
        
        data = load_photo_library()
        
        if folder_name in data["folders"]:
            return jsonify({"success": False, "error": "Folder already exists"})
        
        folder_path = os.path.join(PHOTOS_FOLDER, folder_name)
        os.makedirs(folder_path, exist_ok=True)
        os.chmod(folder_path, 0o775)
        
        data["folders"].append(folder_name)
        save_photo_library(data)
        
        return jsonify({"success": True, "folder": folder_name})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/api/photo-library/debug-usb", methods=["GET"])
def debug_usb():
    """Debug USB detection issues"""
    try:
        debug_info = {
            'checked_paths': USB_MOUNT_PATHS,
            'existing_paths': [],
            'mounted_paths': [],
            'accessible_paths': [],
            'detected_mount': None,
            'mount_output': '',
            'lsblk_output': '',
            'udisks2_installed': False
        }
        
        # Check which paths exist
        for path in USB_MOUNT_PATHS:
            if os.path.exists(path):
                debug_info['existing_paths'].append(path)
                
                if os.path.ismount(path):
                    debug_info['mounted_paths'].append(path)
                    
                    try:
                        files = os.listdir(path)
                        debug_info['accessible_paths'].append({
                            'path': path,
                            'files': len(files),
                            'sample_files': files[:5]
                        })
                    except PermissionError:
                        debug_info['accessible_paths'].append({
                            'path': path,
                            'error': 'Permission denied'
                        })
                # If this is a directory, check subfolders for mounts
                if os.path.isdir(path):
                    try:
                        for entry in os.listdir(path):
                            subpath = os.path.join(path, entry)
                            if os.path.ismount(subpath):
                                debug_info['mounted_paths'].append(subpath)
                                try:
                                    files = os.listdir(subpath)
                                    debug_info['accessible_paths'].append({
                                        'path': subpath,
                                        'files': len(files),
                                        'sample_files': files[:5]
                                    })
                                except PermissionError:
                                    debug_info['accessible_paths'].append({
                                        'path': subpath,
                                        'error': 'Permission denied'
                                    })
                    except PermissionError:
                        pass
        
        # Get mount command output
        try:
            mount_result = subprocess.run(['mount'], capture_output=True, text=True)
            debug_info['mount_output'] = mount_result.stdout
        except:
            debug_info['mount_output'] = 'Failed to run mount command'
        
        # Get lsblk output
        try:
            lsblk_result = subprocess.run(['lsblk', '-f'], capture_output=True, text=True)
            debug_info['lsblk_output'] = lsblk_result.stdout
        except:
            debug_info['lsblk_output'] = 'Failed to run lsblk command'
        
        # Check if udisks2 is installed
        try:
            subprocess.run(['which', 'udisksctl'], capture_output=True, check=True)
            debug_info['udisks2_installed'] = True
        except:
            debug_info['udisks2_installed'] = False

        # Report detected mount using shared logic
        debug_info['detected_mount'] = find_usb_mount()
        
        return jsonify(debug_info)
        
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route("/api/photo-library/check-mounts", methods=["GET"])
def check_mounts():
    """Check current mount points"""
    try:
        result = subprocess.run(['mount'], capture_output=True, text=True)
        mounts = result.stdout.split('\n')
        
        usb_mounts = []
        all_mounts = []
        
        for mount in mounts:
            if mount.strip():
                all_mounts.append(mount.strip())
                if any(keyword in mount.lower() for keyword in ['usb', 'media', 'mnt', 'sda', 'sdb']):
                    usb_mounts.append(mount.strip())
        
        return jsonify({
            'mounts': all_mounts,
            'usbMounts': usb_mounts
        })
        
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route("/api/photo-library/list-media", methods=["GET"])
def list_media():
    """List contents of media directories"""
    try:
        media_contents = []
        mnt_contents = []
        
        if os.path.exists('/media'):
            try:
                media_contents = os.listdir('/media')
            except PermissionError:
                media_contents = ['Permission denied']
        
        if os.path.exists('/mnt'):
            try:
                mnt_contents = os.listdir('/mnt')
            except PermissionError:
                mnt_contents = ['Permission denied']
        
        return jsonify({
            'media': media_contents,
            'mnt': mnt_contents
        })
        
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route("/api/photo-library/upload", methods=["POST"])
def upload_photos():
    folder = request.form.get('folder', 'default')
    files = request.files.getlist('photos')
    
    data = load_photo_library()
    folder_path = os.path.join(PHOTOS_FOLDER, folder)
    os.makedirs(folder_path, exist_ok=True)
    os.chmod(folder_path, 0o775)
    
    for file in files:
        filename = secure_filename(file.filename)
        file_path = os.path.join(folder_path, filename)
        file.save(file_path)
        os.chmod(file_path, 0o664)
        data["photos"][filename] = folder
    
    save_photo_library(data)
    return jsonify({"success": True})

@app.route("/api/photo-library/manage", methods=["POST"])
def manage_photos():
    action = request.json.get("action")
    data = load_photo_library()
    
    if action == "create_folder":
        folder_name = request.json.get("folder")
        if folder_name not in data["folders"]:
            folder_path = os.path.join(PHOTOS_FOLDER, folder_name)
            os.makedirs(folder_path, exist_ok=True)
            os.chmod(folder_path, 0o775)
            data["folders"].append(folder_name)
    
    elif action == "delete_folder":
        folder_name = request.json.get("folder")
        if folder_name in data["folders"] and folder_name != 'default':
            shutil.rmtree(os.path.join(PHOTOS_FOLDER, folder_name))
            data["folders"].remove(folder_name)
            data["photos"] = {k: v for k, v in data["photos"].items() if v != folder_name}
    
    elif action == "move_photo":
        photo = request.json.get("photo")
        new_folder = request.json.get("new_folder")
        old_folder = data["photos"].get(photo, 'default')
        old_path = os.path.join(PHOTOS_FOLDER, old_folder, photo)
        new_path = os.path.join(PHOTOS_FOLDER, new_folder, photo)
        
        if os.path.exists(old_path):
            shutil.move(old_path, new_path)
            os.chmod(new_path, 0o664)
            data["photos"][photo] = new_folder
        else:
            return jsonify({"success": False, "error": "Photo does not exist"}), 404
    
    elif action == "delete_photo":
        photo = request.json.get("photo")
        folder = data["photos"].get(photo, 'default')
        photo_path = os.path.join(PHOTOS_FOLDER, folder, photo)
        
        if os.path.exists(photo_path):
            os.remove(photo_path)
            del data["photos"][photo]
        else:
            return jsonify({"success": False, "error": "Photo does not exist"}), 404
    
    save_photo_library(data)
    return jsonify({"success": True, "data": data})

# New endpoint to check test status
@app.route("/test-in-progress")
def check_test_in_progress():
    """Check if a test is currently running."""
    return jsonify({"testing": test_in_progress})

# Testing endpoints
@app.route("/time-test")
def time_test():
    """Run sequential relay test with 1 second delays."""
    global test_in_progress
    
    # Check if test is already running
    if test_in_progress:
        return jsonify({"status": "Another test is currently in progress"}), 409
        
    try:
        with test_lock:
            test_in_progress = True
            
            # Reset all relays to OFF first
            initialize_relay_states()
            time.sleep(0.5)  # Small delay after reset
            
            for relay_name, relay in relay_pins.items():
                # Turn on relay
                relay.on()
                states = load_relay_states()
                states[relay_name] = True
                save_relay_states(states)
                time.sleep(1)
                
                # Turn off relay
                relay.off()
                states = load_relay_states()
                states[relay_name] = False
                save_relay_states(states)
                time.sleep(0.5)  # Small delay between relays
            
            return jsonify({"status": "Time test completed successfully!"})
    except Exception as e:
        return jsonify({"status": f"Error during time test: {str(e)}"}), 500
    finally:
        test_in_progress = False

@app.route("/self-test")
def self_test():
    """Run a deterministic relay self test (sequential on/off)."""
    global test_in_progress
    
    # Check if test is already running
    if test_in_progress:
        return jsonify({"status": "Another test is currently in progress"}), 409
        
    try:
        with test_lock:
            test_in_progress = True
            self_test_progress["active"] = True
            self_test_progress["relay"] = None
            self_test_progress["action"] = None
            self_test_progress["step"] = 0
            self_test_progress["steps"] = len(relay_pins) * 4
            
            # Reset all relays to OFF first
            initialize_relay_states()
            time.sleep(0.5)  # Small delay after reset
            
            # Run a clear on/off sequence for each relay
            for relay_name, relay in relay_pins.items():
                # Pulse on
                self_test_progress["step"] += 1
                self_test_progress["relay"] = relay_name
                self_test_progress["action"] = "ON"
                relay.on()
                states = load_relay_states()
                states[relay_name] = True
                save_relay_states(states)
                time.sleep(0.6)

                # Pulse off
                self_test_progress["step"] += 1
                self_test_progress["action"] = "OFF"
                relay.off()
                states = load_relay_states()
                states[relay_name] = False
                save_relay_states(states)
                time.sleep(0.3)

                # Second pulse on
                self_test_progress["step"] += 1
                self_test_progress["action"] = "ON"
                relay.on()
                states = load_relay_states()
                states[relay_name] = True
                save_relay_states(states)
                time.sleep(0.4)

                # Final off before moving on
                self_test_progress["step"] += 1
                self_test_progress["action"] = "OFF"
                relay.off()
                states = load_relay_states()
                states[relay_name] = False
                save_relay_states(states)
                time.sleep(0.2)

            # Turn all relays off at the end
            initialize_relay_states()
            return jsonify({"status": "Self test completed successfully!"})
    except Exception as e:
        return jsonify({"status": f"Error during self test: {str(e)}"}), 500
    finally:
        test_in_progress = False
        self_test_progress["active"] = False

@app.route("/toggle-all/<state>")
def toggle_all(state):
    """Toggle all relays on or off."""
    if test_in_progress:
        return jsonify({"error": "Cannot toggle relays while test is in progress"}), 409
        
    try:
        new_state = state.lower() == "on"
        states = {}
        
        for relay_name, relay in relay_pins.items():
            if new_state:
                relay.on()
            else:
                relay.off()
            states[relay_name] = new_state
        
        save_relay_states(states)
        return jsonify({"status": "success", "states": states})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ENHANCED WiFi ENDPOINTS WITH NETWORKMANAGER SUPPORT

@app.route("/scan-wifi-networks")
def scan_wifi_networks():
    """Scan for available WiFi networks with enhanced NetworkManager support."""
    try:
        # First check if NetworkManager is enabled and working
        nm_status = subprocess.run(
            ["sudo", "systemctl", "is-active", "NetworkManager"],
            capture_output=True,
            text=True
        )
        
        if nm_status.returncode != 0:
            return jsonify({"success": False, "error": "NetworkManager is not running. Please enable it first."})
        
        # Check if wifi device is available and managed
        device_check = subprocess.run(
            ["nmcli", "device", "status"],
            capture_output=True,
            text=True
        )
        
        if device_check.returncode != 0:
            return jsonify({"success": False, "error": "Cannot access NetworkManager devices"})
        
        # Look for wifi device in output
        wifi_device = None
        for line in device_check.stdout.strip().split('\n')[1:]:  # Skip header
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "wifi":
                wifi_device = parts[0]
                break
        
        if not wifi_device:
            return jsonify({"success": False, "error": "No WiFi device found"})
        
        # Enable wifi device if it's disabled
        enable_result = subprocess.run(
            ["sudo", "nmcli", "radio", "wifi", "on"],
            capture_output=True,
            text=True
        )
        
        # Ensure the device is managed
        manage_result = subprocess.run(
            ["sudo", "nmcli", "device", "set", wifi_device, "managed", "yes"],
            capture_output=True,
            text=True
        )
        
        # Force a rescan
        rescan_result = subprocess.run(
            ["sudo", "nmcli", "device", "wifi", "rescan"],
            capture_output=True,
            text=True
        )
        
        # Small delay for scan to complete
        time.sleep(2)
        
        # Get the list of networks with more robust command
        result = subprocess.run(
            ["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY,BARS", "device", "wifi", "list"],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            return jsonify({"success": False, "error": f"WiFi scan failed: {result.stderr}"})
        
        networks = []
        seen_ssids = set()
        
        # Parse the output (format: SSID:SIGNAL:SECURITY:BARS)
        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split(':')
                if len(parts) >= 4 and parts[0] and parts[0] not in seen_ssids:  # Ensure SSID exists and is unique
                    ssid = parts[0]
                    signal = int(parts[1]) if parts[1].isdigit() else 0
                    security = bool(parts[2].strip())  # True if there's any security
                    
                    networks.append({
                        "ssid": ssid,
                        "signal": signal,
                        "security": security
                    })
                    seen_ssids.add(ssid)
        
        # Sort by signal strength (strongest first)
        networks.sort(key=lambda x: x["signal"], reverse=True)
        
        return jsonify({"success": True, "networks": networks})
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Scan error: {str(e)}"})

@app.route("/connect-wifi", methods=["POST"])
def connect_wifi():
    """Connect to a WiFi network with enhanced error handling."""
    try:
        data = request.json
        if not data or "ssid" not in data:
            return jsonify({"success": False, "error": "SSID is required"}), 400
        
        ssid = data["ssid"]
        password = data.get("password", "")
        
        # First, delete any existing connection with the same SSID to avoid conflicts
        delete_existing = subprocess.run(
            ["sudo", "nmcli", "connection", "delete", ssid],
            capture_output=True,
            text=True
        )
        # Don't check return code as connection might not exist
        
        # Use nmcli to connect to the network with more robust parameters
        if password:
            # For secured networks
            result = subprocess.run([
                "sudo", "nmcli", "device", "wifi", "connect", ssid,
                "password", password,
                "name", ssid
            ], capture_output=True, text=True)
        else:
            # For open networks
            result = subprocess.run([
                "sudo", "nmcli", "device", "wifi", "connect", ssid,
                "name", ssid
            ], capture_output=True, text=True)
        
        if result.returncode == 0:
            # Wait a moment for connection to establish
            time.sleep(3)
            
            # Verify connection
            status_check = subprocess.run(
                ["nmcli", "-t", "-f", "GENERAL.CONNECTION", "device", "show", "wlan0"],
                capture_output=True,
                text=True
            )
            
            if ssid in status_check.stdout:
                return jsonify({
                    "success": True, 
                    "message": f"Successfully connected to {ssid}"
                })
            else:
                return jsonify({
                    "success": False,
                    "error": "Connection appeared to succeed but verification failed"
                })
        else:
            error_msg = result.stderr or result.stdout
            
            # Handle common error cases
            if "Secrets were required" in error_msg:
                return jsonify({
                    "success": False,
                    "error": "Invalid password"
                })
            elif "No network with SSID" in error_msg:
                return jsonify({
                    "success": False,
                    "error": "Network not found. Try scanning again."
                })
            else:
                return jsonify({
                    "success": False, 
                    "error": f"Connection failed: {error_msg}"
                })
                
    except Exception as e:
        return jsonify({"success": False, "error": f"Connection error: {str(e)}"})

@app.route("/wifi-status")
def wifi_status():
    """Get current WiFi connection status with enhanced error handling."""
    try:
        # Check if connected to WiFi using nmcli
        connection_result = subprocess.run(
            ["nmcli", "-t", "-f", "GENERAL.CONNECTION,GENERAL.STATE", "device", "show", "wlan0"],
            capture_output=True,
            text=True
        )
        
        if connection_result.returncode != 0:
            return jsonify({"connected": False, "error": "Cannot check WiFi status"})
        
        # Parse the output
        lines = connection_result.stdout.strip().split('\n')
        connection_name = ""
        device_state = ""
        
        for line in lines:
            if line.startswith("GENERAL.CONNECTION:"):
                connection_name = line.split(':', 1)[1].strip()
            elif line.startswith("GENERAL.STATE:"):
                device_state = line.split(':', 1)[1].strip()
        
        # Check if device is connected (state 100)
        is_connected = "100" in device_state and connection_name and connection_name != "--"
        
        if is_connected:
            # Get IP address
            ip_result = subprocess.run(
                ["nmcli", "-t", "-f", "IP4.ADDRESS", "device", "show", "wlan0"],
                capture_output=True,
                text=True
            )
            
            ip = "Unknown"
            if ip_result.returncode == 0:
                for line in ip_result.stdout.strip().split('\n'):
                    if line.startswith("IP4.ADDRESS"):
                        # Extract IP from format like "IP4.ADDRESS[1]:192.168.1.100/24"
                        ip_part = line.split(':', 1)[1].strip()
                        ip = ip_part.split('/')[0] if '/' in ip_part else ip_part
                        break
            
            return jsonify({
                "connected": True,
                "ssid": connection_name,
                "ip": ip
            })
        else:
            return jsonify({"connected": False})
            
    except Exception as e:
        return jsonify({"connected": False, "error": str(e)})

@app.route("/enable-networkmanager", methods=["POST"])
def enable_networkmanager():
    """Enable NetworkManager on the Raspberry Pi."""
    try:
        # Check current status
        status_result = subprocess.run(
            ["sudo", "systemctl", "is-active", "NetworkManager"],
            capture_output=True,
            text=True
        )
        
        if status_result.returncode == 0:
            return jsonify({"success": True, "message": "NetworkManager is already running"})
        
        # Install NetworkManager if not installed
        install_result = subprocess.run(
            ["sudo", "apt", "update", "&&", "sudo", "apt", "install", "-y", "network-manager"],
            shell=True,
            capture_output=True,
            text=True
        )
        
        # Use raspi-config to switch to NetworkManager (Bookworm method)
        raspi_config_result = subprocess.run(
            ["sudo", "raspi-config", "nonint", "do_netconf", "2"],
            capture_output=True,
            text=True
        )
        
        if raspi_config_result.returncode == 0:
            return jsonify({
                "success": True, 
                "message": "NetworkManager enabled. System reboot recommended for full activation."
            })
        else:
            # Fallback manual method
            # Stop dhcpcd
            subprocess.run(["sudo", "systemctl", "disable", "dhcpcd"], capture_output=True)
            subprocess.run(["sudo", "systemctl", "stop", "dhcpcd"], capture_output=True)
            
            # Enable and start NetworkManager
            subprocess.run(["sudo", "systemctl", "enable", "NetworkManager"], capture_output=True)
            subprocess.run(["sudo", "systemctl", "start", "NetworkManager"], capture_output=True)
            
            return jsonify({
                "success": True,
                "message": "NetworkManager enabled manually. Reboot recommended."
            })
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

# Enhanced USB WiFi configuration
@app.route("/load-usb-wifi-config", methods=["POST"])
def load_usb_wifi_config():
    """Load WiFi configuration from USB with NetworkManager support."""
    usb_path = "/media/usb/wificonfig.json"
    if not os.path.exists(usb_path):
        return jsonify({"message": "No WiFi config file found on USB."}), 400

    try:
        with open(usb_path, "r") as f:
            wifi_config = json.load(f)
        ssid = wifi_config.get("ssid")
        password = wifi_config.get("password")
        if not ssid or not password:
            return jsonify({"message": "Invalid WiFi config file format."}), 400

        # Use the enhanced connect method
        # Delete existing connection first
        subprocess.run(["sudo", "nmcli", "connection", "delete", ssid], capture_output=True)
        
        # Connect using NetworkManager
        result = subprocess.run([
            "sudo", "nmcli", "device", "wifi", "connect", ssid,
            "password", password,
            "name", ssid
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            return jsonify({"message": f"Successfully loaded WiFi config for SSID: {ssid}."})
        else:
            return jsonify({"message": f"Failed to connect to {ssid}: {result.stderr or result.stdout}"}), 400
    except Exception as e:
        return jsonify({"message": f"Error loading WiFi config: {e}"}), 500

@app.route("/reset-network-settings", methods=["POST"])
def reset_network_settings():
    """Reset network settings with better error handling."""
    try:
        # Delete all WiFi connections
        wifi_connections_result = subprocess.run(
            ["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"],
            capture_output=True,
            text=True
        )
        
        if wifi_connections_result.returncode == 0:
            for line in wifi_connections_result.stdout.strip().split('\n'):
                if line and ':wifi' in line:
                    connection_name = line.split(':')[0]
                    subprocess.run(
                        ["sudo", "nmcli", "connection", "delete", connection_name],
                        capture_output=True,
                        text=True
                    )
        
        return jsonify({"message": "All WiFi network settings have been reset."})
    except Exception as e:
        return jsonify({"message": f"Error resetting network settings: {e}"}), 500

# System update with real-time log streaming
@app.route("/system-update-logs")
def system_update_logs():
    def generate():
        ok, msg = preflight_checks()
        if not ok:
            yield f"data: Preflight failed: {msg}\n\n"
            return
        yield "data: Preflight OK. Starting system update...\n\n"
        # Fix: Use shell=True and pass the command as a single string
        process = subprocess.Popen(
            "sudo apt-get update && sudo apt-get full-upgrade -y",
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT,  # Redirect stderr to stdout to capture all output
            text=True, 
            shell=True
        )
        
        for line in process.stdout:
            yield f"data: {line.strip()}\n\n"
        
        process.wait()
        if process.returncode == 0:
            yield "data: Update completed successfully. Rebooting...\n\n"
            # Use a separate thread to allow the response to complete before rebooting
            threading.Thread(target=lambda: subprocess.call("sudo reboot", shell=True)).start()
        else:
            yield "data: Update failed. Check logs.\n\n"

    return Response(generate(), content_type="text/event-stream")

@app.route("/git-pull")
def git_pull():
    """Safely update the app repository."""
    try:
        ok, msg = preflight_checks()
        if not ok:
            return jsonify({"success": False, "error": f"Preflight failed: {msg}"})

        backup_state()

        repo_path = BASE_DIR
        current = run_cmd(["git", "-C", repo_path, "rev-parse", "HEAD"])
        if current.returncode == 0 and current.stdout.strip():
            write_commit_marker(".pre_update_commit", current.stdout.strip())
        fsck = run_cmd(["git", "-C", repo_path, "fsck", "--full"])
        if fsck.returncode != 0:
            # Attempt repair by reinitializing from origin
            origin = run_cmd(["git", "-C", repo_path, "remote", "get-url", "origin"])
            if origin.returncode != 0:
                return jsonify({"success": False, "error": "Git corruption detected and no origin remote found"})
            origin_url = origin.stdout.strip()
            # Remove .git and re-init
            shutil.rmtree(os.path.join(repo_path, ".git"), ignore_errors=True)
            run_cmd(["git", "-C", repo_path, "init"])
            run_cmd(["git", "-C", repo_path, "remote", "add", "origin", origin_url])

        # Fetch and hard reset to origin/HEAD
        fetch = run_cmd(["git", "-C", repo_path, "fetch", "--all", "--prune"])
        if fetch.returncode != 0:
            return jsonify({"success": False, "error": fetch.stderr or fetch.stdout})

        head = run_cmd(["git", "-C", repo_path, "symbolic-ref", "refs/remotes/origin/HEAD"])
        branch = "origin/main"
        if head.returncode == 0 and head.stdout.strip():
            branch = head.stdout.strip().replace("refs/remotes/", "")

        reset = run_cmd(["git", "-C", repo_path, "reset", "--hard", branch])
        if reset.returncode != 0:
            return jsonify({"success": False, "error": reset.stderr or reset.stdout})

        ok_health, health_msg = health_check()
        if not ok_health:
            # Auto rollback
            prev = read_commit_marker(".pre_update_commit")
            if prev:
                run_cmd(["git", "-C", repo_path, "reset", "--hard", prev])
                return jsonify({"success": False, "error": f"Update failed health check. Rolled back. {health_msg}"})
            return jsonify({"success": False, "error": f"Update failed health check. {health_msg}"})

        # Mark last known good
        new_head = run_cmd(["git", "-C", repo_path, "rev-parse", "HEAD"])
        if new_head.returncode == 0 and new_head.stdout.strip():
            write_commit_marker(".last_good_commit", new_head.stdout.strip())

        return jsonify({"success": True, "output": f"Updated to {branch}\n{reset.stdout.strip()}"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/rollback", methods=["POST"])
def rollback_update():
    try:
        repo_path = BASE_DIR
        target = read_commit_marker(".pre_update_commit") or read_commit_marker(".last_good_commit")
        if not target:
            return jsonify({"success": False, "error": "No rollback point available"})
        reset = run_cmd(["git", "-C", repo_path, "reset", "--hard", target])
        if reset.returncode != 0:
            return jsonify({"success": False, "error": reset.stderr or reset.stdout})
        return jsonify({"success": True, "message": f"Rolled back to {target[:7]}"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Route handlers
@app.route("/")
def index():
    """Redirect to make drinks page on initial load"""
    return redirect(url_for('make_drinks'))

@app.route("/dashboard")
def dashboard():
    """Dashboard/home page"""
    config = get_config()
    return render_template("dashboard.html", system_name=config["system_name"])

@app.route("/about")
def about():
    config = get_config()
    return render_template("about.html", system_name=config["system_name"])

@app.route("/status")
def status():
    config = get_config()
    version = get_latest_version()
    local_ip = get_local_ip()
    return render_template("status.html", system_name=config["system_name"], version=version, local_ip=local_ip)

@app.route("/log")
def log():
    config = get_config()
    return render_template("log.html", system_name=config["system_name"])

@app.route("/maintenance")
def maintenance():
    config = get_config()
    return render_template("maintenance.html", system_name=config["system_name"])

@app.route("/test-mode")
def test_mode():
    relay_states = load_relay_states()
    return render_template("test_mode.html", relays=relay_states)

@app.route("/toggle/<relay_name>")
def toggle_relay(relay_name):
    if test_in_progress:
        return jsonify({"error": "Cannot toggle relay while test is in progress"}), 409
        
    relay = relay_pins.get(relay_name)
    if relay:
        relay.toggle()
        states = load_relay_states()
        states[relay_name] = relay.is_active
        save_relay_states(states)
    return jsonify({"state": relay.is_active})

@app.route("/get-states")
def get_states():
    try:
        states = load_relay_states()
        return jsonify(states)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/settings")
def settings():
    version = get_latest_version()
    local_ip = get_local_ip()
    return render_template("settings.html", version=version, local_ip=local_ip)

@app.route("/api/system-name", methods=["GET", "POST"])
def system_name():
    if request.method == "GET":
        return jsonify({"system_name": get_config().get("system_name", "Drinks Bro")})
    data = request.json or {}
    name = data.get("system_name", "").strip()
    if not name:
        return jsonify({"success": False, "error": "System name required"}), 400
    config = get_config()
    config["system_name"] = name
    save_config(config)
    return jsonify({"success": True, "system_name": name})

@app.route("/api/screensaver", methods=["GET", "POST"])
def screensaver():
    if request.method == "GET":
        cfg = get_config()
        return jsonify({
            "enabled": cfg.get("screensaver_enabled", False),
            "timeout": cfg.get("screensaver_timeout", 120),
            "photo": cfg.get("screensaver_photo", "")
        })
    data = request.json or {}
    cfg = get_config()
    cfg["screensaver_enabled"] = bool(data.get("enabled", False))
    try:
        cfg["screensaver_timeout"] = int(data.get("timeout", 120))
    except Exception:
        cfg["screensaver_timeout"] = 120
    cfg["screensaver_photo"] = data.get("photo", "")
    save_config(cfg)
    return jsonify({"success": True})

@app.route("/api/version-history", methods=["GET"])
def version_history():
    try:
        if not os.path.exists("version.txt"):
            return jsonify({"success": False, "history": "No version history available."})
        with open("version.txt", "r") as f:
            history = f.read().strip()
        return jsonify({"success": True, "history": history})
    except Exception as e:
        return jsonify({"success": False, "history": f"Error reading version history: {e}"})

@app.route("/api/system-log", methods=["GET"])
def system_log():
    try:
        result = subprocess.run(
            ["journalctl", "-u", "relay-control.service", "-n", "200", "-r", "--no-pager"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            return jsonify({"success": False, "error": result.stderr or "Unable to read logs"})
        return jsonify({"success": True, "log": result.stdout})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/check-updates")
def check_updates():
    updates_available = random.choice([True, False])  # Simulate checking for updates
    return jsonify({"updatesAvailable": updates_available})

@app.route("/system-update", methods=["POST"])
def system_update():
    """
    Perform a system update.
    """
    try:
        update_command = "sudo apt-get update && sudo apt-get full-upgrade -y"
        result = subprocess.run(update_command, shell=True, text=True, capture_output=True)
        if result.returncode != 0:
            return jsonify({"status": "System update failed.", "details": result.stderr}), 500

        # Schedule reboot
        subprocess.Popen(["sudo", "reboot"])
        return jsonify({"status": "System update completed. Rebooting now..."})
    except Exception as e:
        return jsonify({"status": "System update failed.", "details": str(e)}), 500

@app.route("/reboot", methods=["POST"])
def reboot_system():
    initialize_relay_states()
    os.system("sudo reboot")
    return jsonify({"status": "System is rebooting..."})

@app.route("/shutdown", methods=["POST"])
def shutdown_system():
    initialize_relay_states()
    os.system("sudo shutdown now")
    return jsonify({"status": "System is shutting down..."})

# ----------------- DRINKS ROUTES -----------------

@app.route("/drinks-config")
def drinks_config():
    """Render drinks configuration page."""
    config = get_config()
    return render_template("drinks-config.html", system_name=config["system_name"])

@app.route("/make-drinks")
def make_drinks():
    """Render make drinks page."""
    config = get_config()
    drinks = load_drinks_config()
    return render_template("make-drinks.html", system_name=config["system_name"], drinks=drinks)

@app.errorhandler(404)
def page_not_found(e):
    return render_template("404.html"), 404

# ----------------- DRINKS API -----------------

@app.route("/api/drinks", methods=["GET"])
def get_drinks():
    """Get all drinks configurations."""
    try:
        drinks = load_drinks_config()
        return jsonify({"success": True, "drinks": drinks})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/drinks", methods=["POST"])
def save_drinks():
    """Save drinks configurations."""
    try:
        data = request.json
        if not data or "drinks" not in data:
            return jsonify({"success": False, "error": "Invalid request data"}), 400
        
        drinks = data["drinks"]
        save_drinks_config(drinks)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/drinks/<int:drink_id>", methods=["GET"])
def get_drink(drink_id):
    """Get a specific drink configuration."""
    try:
        drinks = load_drinks_config()
        if drink_id < 0 or drink_id >= len(drinks):
            return jsonify({"success": False, "error": "Drink not found"}), 404
        
        return jsonify({"success": True, "drink": drinks[drink_id]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/make-drink/<int:drink_id>", methods=["POST"])
def make_drink(drink_id):
    """Make a drink by executing its relay sequence."""
    global test_in_progress
    
    if test_in_progress:
        return jsonify({"success": False, "error": "Test in progress, cannot make drink"}), 409
    
    try:
        drinks = load_drinks_config()
        if drink_id < 0 or drink_id >= len(drinks):
            return jsonify({"success": False, "error": "Drink not found"}), 404
        
        drink = drinks[drink_id]
        
        # Create a thread to make the drink
        def make_drink_thread():
            global test_in_progress
            try:
                with test_lock:
                    test_in_progress = True
                    # Initialize progress tracking
                    drink_progress["active"] = True
                    drink_progress["drink_name"] = drink["name"]
                    drink_progress["started_at"] = time.time()
                    drink_progress["total_time"] = sum(step["time"] for step in drink["steps"])
                    drink_progress["expected_total"] = drink_progress["total_time"] + 0.5 + (0.2 * len(drink["steps"]))
                    drink_progress["current_step"] = 0
                    drink_progress["steps"] = len(drink["steps"])
                    
                    # Reset all relays to OFF first
                    initialize_relay_states()
                    time.sleep(0.5)  # Small delay after reset
                    
                    # Execute each step in the sequence
                    for idx, step in enumerate(drink["steps"], start=1):
                        drink_progress["current_step"] = idx
                        relay_name = f"Relay {step['relay']}"
                        relay = relay_pins.get(relay_name)
                        if relay:
                            if step["action"] == "on":
                                relay.on()
                            else:
                                relay.off()
                            
                            # Update state
                            states = load_relay_states()
                            states[relay_name] = relay.is_active
                            save_relay_states(states)
                            
                            # Wait for specified time
                            time.sleep(step["time"])
                    
                    # Turn all relays off at the end
                    initialize_relay_states()
            finally:
                test_in_progress = False
                drink_progress["active"] = False
        
        # Start the drink making process in a separate thread
        threading.Thread(target=make_drink_thread).start()
        
        return jsonify({
            "success": True, 
            "message": f"Making {drink['name']}...",
            "total_time": sum(step["time"] for step in drink["steps"]),
            "estimated_time": sum(step["time"] for step in drink["steps"]) + 0.5 + (0.2 * len(drink["steps"]))
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/drink-progress", methods=["GET"])
def get_drink_progress():
    if not drink_progress["active"]:
        return jsonify({"active": False})
    elapsed = time.time() - (drink_progress["started_at"] or time.time())
    total = max(1, drink_progress.get("expected_total") or drink_progress["total_time"])
    percent = min(100, (elapsed / total) * 100)
    return jsonify({
        "active": True,
        "drink_name": drink_progress["drink_name"],
        "elapsed": elapsed,
        "total_time": total,
        "percent": percent,
        "current_step": drink_progress["current_step"],
        "steps": drink_progress["steps"]
    })

@app.route("/api/self-test-progress", methods=["GET"])
def get_self_test_progress():
    if not self_test_progress["active"]:
        return jsonify({"active": False})
    return jsonify({
        "active": True,
        "relay": self_test_progress["relay"],
        "action": self_test_progress["action"],
        "step": self_test_progress["step"],
        "steps": self_test_progress["steps"]
    })

if __name__ == "__main__":
    initialize_relay_states()  # Reset states on startup
    # Explicitly disable debug/reloader so systemd doesn't think the service exited.
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

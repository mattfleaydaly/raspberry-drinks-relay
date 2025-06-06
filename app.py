from flask import Flask, render_template, jsonify, request, Response, redirect, url_for
from gpiozero import OutputDevice
import os
import socket
import json
import time
import random
import threading
from threading import Lock
import subprocess

app = Flask(__name__)

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
    """Run random relay test for 10 seconds."""
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
            
            start_time = time.time()
            while time.time() - start_time < 10:
                # Randomly select which relays to toggle
                for relay_name, relay in relay_pins.items():
                    if random.choice([True, False]):
                        # Randomly toggle relay
                        new_state = random.choice([True, False])
                        if new_state:
                            relay.on()
                        else:
                            relay.off()
                        
                        # Update states
                        states = load_relay_states()
                        states[relay_name] = new_state
                        save_relay_states(states)
                
                # Random delay between 0.1 and 1 second
                time.sleep(random.uniform(0.1, 1.0))
            
            # Turn all relays off at the end
            initialize_relay_states()
            return jsonify({"status": "Self test completed successfully!"})
    except Exception as e:
        return jsonify({"status": f"Error during self test: {str(e)}"}), 500
    finally:
        test_in_progress = False

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
    """Run git pull to update the app."""
    try:
        result = subprocess.run(
            ["git", "-C", "/home/pi/raspberry-drinks-relay", "pull"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return jsonify({"success": True, "output": result.stdout})
        else:
            return jsonify({"success": False, "error": result.stderr})
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
                    
                    # Reset all relays to OFF first
                    initialize_relay_states()
                    time.sleep(0.5)  # Small delay after reset
                    
                    # Execute each step in the sequence
                    for step in drink["steps"]:
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
        
        # Start the drink making process in a separate thread
        threading.Thread(target=make_drink_thread).start()
        
        return jsonify({
            "success": True, 
            "message": f"Making {drink['name']}...",
            "total_time": sum(step["time"] for step in drink["steps"])
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    initialize_relay_states()  # Reset states on startup
    app.run(host="0.0.0.0", port=5000)

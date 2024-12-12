# Raspberry Drinks Relay Control

A modern GUI for Raspberry Pi relay control.

## Overview
The Raspberry Drinks Relay Control system is designed for easy relay control with a clean and intuitive GUI. It features robust options for managing WiFi networks, including the ability to configure WiFi settings via a USB drive.

## Features
- Control up to 4 relays via a web interface.
- Configure WiFi using a USB `wificonfig.json` file.
- Reset network settings through the web interface.
- Drag-and-drop scrolling interface for touchscreens.

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/mattfleaydaly/raspberry-drinks-relay.git
   cd raspberry-drinks-relay
   ```

2. Run the setup script:
   ```bash
   ./setup.sh
   ```

3. Access the application:
   - Open your browser and navigate to `http://<raspberry-pi-ip>:5000`.

## WiFi Configuration Options
The system supports two primary methods for WiFi configuration:

### Option 1: USB WiFi Configuration
Configure WiFi by using a USB drive with a `wificonfig.json` file.

#### Steps:
1. Create a `wificonfig.json` file with the following structure:
   ```json
   {
       "ssid": "YourNetworkSSID",
       "password": "YourNetworkPassword"
   }
   ```

2. Save the file to the root directory of a USB drive.

3. Insert the USB drive into the Raspberry Pi.

4. Open the web interface and navigate to the WiFi Configuration modal. Click the **Load USB** button to load the settings.

5. If successful, the Raspberry Pi will connect to the specified network.

#### Notes:
- Ensure the `ssid` and `password` values are correct.
- The USB drive should be formatted as FAT32 for compatibility.
- If the file format is incorrect or the file is missing, an error will be displayed.

### Option 2: Reset All Network Settings
This option clears all saved network configurations.

#### Steps:
1. Open the web interface and navigate to the WiFi Configuration modal.

2. Click the **Reset All Network Settings** button.

3. Confirm the action when prompted.

4. All saved networks will be removed.

## Included Files
### `wificonfig.json` Sample File
A sample `wificonfig.json` file is included in the `sample-files` directory of the project.

```json
{
    "ssid": "YourNetworkSSID",
    "password": "YourNetworkPassword"
}
```

Copy and edit this file to create your own configuration.

## Project Structure
- **`app.py`**: Main Flask application.
- **`static/`**: Contains static files (CSS, JavaScript).
- **`templates/`**: HTML templates for the web interface.
- **`sample-files/`**: Contains example configuration files.

## Contributing
Feel free to fork the repository and submit pull requests for improvements or new features.

## License
This project is licensed under the MIT License. See `LICENSE` for more details.


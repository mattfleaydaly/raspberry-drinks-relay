#!/bin/bash

echo "Updating system and installing dependencies..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip git python3-tk x11-xserver-utils unclutter
pip3 install Flask gpiozero PyQt5

echo "Installing Python requirements..."
pip3 install -r requirements.txt

echo "Setting up relay control service..."
sudo cp relay-control.service /etc/systemd/system/relay-control.service
sudo systemctl enable relay-control
sudo systemctl start relay-control

echo "Setting up GUI to auto-start on boot..."
mkdir -p ~/.config/autostart
cat <<EOF > ~/.config/autostart/relay_gui.desktop
[Desktop Entry]
Type=Application
Name=Relay GUI
Exec=/usr/bin/python3 /home/pi/raspberry-drinks-relay/local_gui.py
X-GNOME-Autostart-enabled=true
EOF

echo "Setup complete! The GUI will auto-launch at boot."

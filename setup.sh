#!/bin/bash

echo "Updating system and installing dependencies..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip git chromium-browser x11-xserver-utils unclutter

echo "Installing Python requirements..."
pip3 install Flask gpiozero

echo "Setting up relay control service..."
sudo cp relay-control.service /etc/systemd/system/relay-control.service
sudo systemctl enable relay-control
sudo systemctl start relay-control

echo "Setting up Chromium to auto-start in kiosk mode..."
mkdir -p ~/.config/autostart
cat <<EOF > ~/.config/autostart/chromium_kiosk.desktop
[Desktop Entry]
Type=Application
Name=Chromium Kiosk
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --enable-features=OverlayScrollbar http://localhost:5000
X-GNOME-Autostart-enabled=true
EOF

echo "Disabling screen blanking..."
xset s off
xset -dpms
xset s noblank
echo "@xset s off" >> /etc/xdg/lxsession/LXDE-pi/autostart
echo "@xset -dpms" >> /etc/xdg/lxsession/LXDE-pi/autostart
echo "@xset s noblank" >> /etc/xdg/lxsession/LXDE-pi/autostart

echo "Setup complete! Chromium will display the GUI on boot with improved scrolling."

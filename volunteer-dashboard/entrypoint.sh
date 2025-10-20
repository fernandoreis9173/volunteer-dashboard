#!/bin/sh
# Start the sirv server in the background
npm start &
# Keep the container running
tail -f /dev/null
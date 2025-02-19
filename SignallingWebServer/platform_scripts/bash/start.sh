#!/bin/bash
# Copyright Epic Games, Inc. All Rights Reserved.

SCRIPT_DIR="$(cd -P -- "$(dirname -- "$0")" && pwd -P)"

# Set config file with env variables
config="/app/SignallingWebServer/config.json"
cat << EOF > $config
{
	"log_folder": "logs",
	"log_level_console": "info",
	"log_level_file": "info",
	"streamer_port": "${STREAMER_PORT}",
	"player_port": "${PLAYER_PORT}",
	"sfu_port": "${SFU_PORT}",
	"serve": true,
	"http_root": "/app/SignallingWebServer/www",
	"homepage": "player.html",
	"https": false,
	"https_port": 443,
	"ssl_key_path": "certificates/client-key.pem",
	"ssl_cert_path": "certificates/client-cert.pem",
	"https_redirect": false,
	"rest_api": false,
	"peer_options": {
		"iceServers": [
			{
				"urls": ["stun:stun.l.google.com:19302"]
			}
		]
	},
	"log_config": true,
	"stdin": false,
	"console_messages": "verbose",
	"ngrok": {
		"enabled": true,
		"authToken": "${NGROK_AUTH_TOKEN}",
		"basicAuth": {
			"username": "${NGROK_USERNAME}",
			"password": "${NGROK_PASSWORD}"
		}
	}
}
EOF

# Regular work...
. ${SCRIPT_DIR}/common.sh

parse_args $@
setup $@
set_public_ip
setup_turn_stun "bg"

SERVER_ARGS+=" --serve --https_redirect --console_messages verbose --log_config --public_ip=${PUBLIC_IP}"
if [[ ! -z "$STUN_SERVER" && ! -z "$TURN_SERVER" ]]; then
    PEER_OPTIONS="{\"iceServers\":[{\"urls\":[\"stun:${STUN_SERVER}\",\"turn:${TURN_SERVER}\"],\"username\":\"${TURN_USER}\",\"credential\":\"${TURN_PASS}\"}]}"
elif [[ ! -z "$STUN_SERVER" ]]; then
    PEER_OPTIONS="{\"iceServers\":[{\"urls\":[\"stun:${STUN_SERVER}\"]}]}"
elif [[ ! -z "$TURN_SERVER" ]]; then
    PEER_OPTIONS="{\"iceServers\":[{\"urls\":[\"turn:${TURN_SERVER}\"],\"username\":\"${TURN_USER}\",\"credentials\":\"${TURN_PASS}\"}]}"
fi
if [[ ! -z "$PEER_OPTIONS" ]]; then
    SERVER_ARGS+=" --peer_options='${PEER_OPTIONS}'"
fi
if [[ ! -z "$FRONTEND_DIR" ]]; then
    SERVER_ARGS+=" --http_root='$FRONTEND_DIR'"
fi

if [[ "$BUILD_WILBUR" == "1" ]]; then
    build_wilbur
fi

print_config
start_wilbur


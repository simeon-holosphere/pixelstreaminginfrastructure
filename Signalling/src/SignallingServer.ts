import http from 'http';
import https from 'https';
import WebSocket from 'ws';
import ngrok from '@ngrok/ngrok';
import { StreamerConnection } from './StreamerConnection';
import { PlayerConnection } from './PlayerConnection';
import { SFUConnection } from './SFUConnection';
import { Logger } from './Logger';
import { StreamerRegistry } from './StreamerRegistry';
import { PlayerRegistry } from './PlayerRegistry';
import { Messages, MessageHelpers, SignallingProtocol } from '@epicgames-ps/lib-pixelstreamingcommon-ue5.5';
import { stringify } from './Utils';

/**
 * An interface describing the possible options to pass when creating
 * a new SignallingServer object.
 */
export interface IServerConfig {
    // An http server to use for player connections rather than a port. Not needed if playerPort or httpsServer supplied.
    httpServer?: http.Server;

    // An https server to use for player connections rather than a port. Not needed if playerPort or httpServer supplied.
    httpsServer?: https.Server;

    // The port to listen on for streamer connections.
    streamerPort: number;

    // The port to listen on for player connections. Not needed if httpServer or httpsServer supplied.
    playerPort?: number;

    // The port to listen on for SFU connections. If not supplied SFU connections will be disabled.
    sfuPort?: number;

    // The peer configuration object to send to peers in the config message when they connect.
    peerOptions: unknown;

    // Additional websocket options for the streamer listening websocket.
    streamerWsOptions?: WebSocket.ServerOptions;

    // Additional websocket options for the player listening websocket.
    playerWsOptions?: WebSocket.ServerOptions;

    // Additional websocket options for the SFU listening websocket.
    sfuWsOptions?: WebSocket.ServerOptions;

    // Max number of players per streamer.
    maxSubscribers?: number;
    
    // Add ngrok-specific configuration
    ngrok?: {
        enabled: boolean;
        authToken?: string;
        oauth?: {
            provider: string;
            allow_emails: string[];
        };
        basicAuth?: {
            username: string;
            password: string;
        };
    }
}

export type ProtocolConfig = {
    [key: string]: any;
};

/**
 * The main signalling server object.
 * Contains a streamer and player registry and handles setting up of websockets
 * to listen for incoming connections.
 */
export class SignallingServer {
    public config: IServerConfig;
    public protocolConfig: ProtocolConfig;
    public streamerRegistry: StreamerRegistry;
    public playerRegistry: PlayerRegistry;
    public startTime: Date;
    private ngrokListener: any;
    private streamerServer: WebSocket.Server | null = null;
    private playerServer: WebSocket.Server | null = null;
    private sfuServer: WebSocket.Server | null = null;

    /**
     * Initializes the server object and sets up listening sockets for streamers
     * players and optionally SFU connections.
     * @param config - A collection of options for this server.
     */
    constructor(config: IServerConfig) {
        Logger.debug('Started SignallingServer with config: %s', stringify(config));

        this.config = config;
        this.streamerRegistry = new StreamerRegistry();
        this.playerRegistry = new PlayerRegistry();
        this.protocolConfig = {
            protocolVersion: SignallingProtocol.SIGNALLING_VERSION,
            peerConnectionOptions: this.config.peerOptions || {}
        };
        this.startTime = new Date();

        if (!config.playerPort && !config.httpServer && !config.httpsServer) {
            Logger.error('No player port, http server or https server supplied to SignallingServer.');
            return;
        }
    }

    public async initialize(): Promise<void> {
        try {
            // Set up ngrok if enabled
            if (this.config.ngrok?.enabled) {
                await this.setupNgrok();
            }

            // Set up websocket servers
            await this.setupWebSocketServers();
        } catch (error) {
            Logger.error('Failed to initialize SignallingServer: ', error);
            throw error;
        }
    }

    private async setupNgrok() {
        try {
            const server = this.config.httpsServer || this.config.httpServer;
            const port = server ? (server.address() as any).port : this.config.playerPort;

            const ngrokConfig: any = {
                addr: port,
                authtoken: this.config.ngrok?.authToken
            };

            // Handle OAuth configuration
            if (this.config.ngrok?.oauth) {
                const oauthConfig = {
                    provider: this.config.ngrok.oauth.provider,
                    allow_emails: this.config.ngrok.oauth.allow_emails
                };
                ngrokConfig.oauth = oauthConfig;
            }

            // Handle basic auth configuration
            if (this.config.ngrok?.basicAuth) {
                const basicAuthConfig = `${this.config.ngrok.basicAuth.username}:${this.config.ngrok.basicAuth.password}`;
                ngrokConfig.authtoken_from_env = false;
                ngrokConfig.basic_auth = basicAuthConfig;
            }

            this.ngrokListener = await ngrok.forward(ngrokConfig);

            const publicUrl = this.ngrokListener.url();
            Logger.info(`Ngrok tunnel established at: ${publicUrl}`);
            
            if (this.protocolConfig['peerConnectionOptions']) {
                this.protocolConfig['peerConnectionOptions']['publicUrl'] = publicUrl;
            }
        } catch(error) {
            Logger.error('Failed to setup ngrok: ', error);
            if (error instanceof Error) {
                throw new Error(`Ngrok setup failed: ${error.message}`);
            } else {
                throw new Error('Ngrok setup failed with unknown error');
            }
        }
    }
    //if (this.protocolConfig['peerConnectionOptions']) {
    //this.protocolConfig['peerConnectionOptions']['publicUrl'] = publicUrl;

    
    private async setupWebSocketServers() {
        // Streamer connections
        const streamerServer = new WebSocket.WebSocketServer({
            port: this.config.streamerPort,
            backlog: 1,
            ...this.config.streamerWsOptions
        });
        streamerServer.on('connection', this.onStreamerConnected.bind(this));
        Logger.info(`Listening for streamer connections on port ${this.config.streamerPort}`);

        // Player connections
        const server = this.config.httpsServer || this.config.httpServer;
        const playerServer = new WebSocket.Server({
            server: server,
            port: server ? undefined : this.config.playerPort,
            ...this.config.playerWsOptions
        });
        playerServer.on('connection', this.onPlayerConnected.bind(this));
        if (!this.config.httpServer && !this.config.httpsServer) {
            Logger.info(`Listening for player connections on port ${this.config.playerPort}`);
        }

        // Optional SFU connections
        if (this.config.sfuPort) {
            const sfuServer = new WebSocket.Server({
                port: this.config.sfuPort,
                backlog: 1,
                ...this.config.sfuWsOptions
            });
            sfuServer.on('connection', this.onSFUConnected.bind(this));
            Logger.info(`Listening for SFU connections on port ${this.config.sfuPort}`);
        } 
    }

    public async shutdown(): Promise<void> {
        try {
            if (this.ngrokListener) {
                await this.ngrokListener.close();
                Logger.info('Ngrok tunnel closed');
            }

            // Close all WebSocket servers
            if (this.streamerServer) {
                this.streamerServer.close();
            }
            if (this.playerServer) {
                this.playerServer.close();
            }
            if (this.sfuServer) {
                this.sfuServer.close();
            }
        } catch(error) {
            Logger.error('Error during shutdown:', error);
            throw error;
        }
    }
    
    private onStreamerConnected(ws: WebSocket, request: http.IncomingMessage) {
        Logger.info(`New streamer connection: %s`, request.socket.remoteAddress);

        const newStreamer = new StreamerConnection(this, ws, request.socket.remoteAddress);
        newStreamer.maxSubscribers = this.config.maxSubscribers || 0;

        // add it to the registry and when the transport closes, remove it.
        this.streamerRegistry.add(newStreamer);
        newStreamer.transport.on('close', () => {
            this.streamerRegistry.remove(newStreamer);
            Logger.info(
                `Streamer %s (%s) disconnected.`,
                newStreamer.streamerId,
                request.socket.remoteAddress
            );
        });

        // because peer connection options is a general field with all optional fields
        // it doesnt play nice with mergePartial so we just add it verbatim
        const message: Messages.config = MessageHelpers.createMessage(Messages.config, this.protocolConfig);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message.peerConnectionOptions = this.protocolConfig['peerConnectionOptions'];
        newStreamer.sendMessage(message);
    }

    private onPlayerConnected(ws: WebSocket, request: http.IncomingMessage) {
        Logger.info(`New player connection: %s (%s)`, request.socket.remoteAddress, request.url);

        const newPlayer = new PlayerConnection(this, ws, request.socket.remoteAddress);

        // add it to the registry and when the transport closes, remove it
        this.playerRegistry.add(newPlayer);
        newPlayer.transport.on('close', () => {
            this.playerRegistry.remove(newPlayer);
            Logger.info(`Player %s (%s) disconnected.`, newPlayer.playerId, request.socket.remoteAddress);
        });

        // because peer connection options is a general field with all optional fields
        // it doesnt play nice with mergePartial so we just add it verbatim
        const message: Messages.config = MessageHelpers.createMessage(Messages.config, this.protocolConfig);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message.peerConnectionOptions = this.protocolConfig['peerConnectionOptions'];
        newPlayer.sendMessage(message);
    }

    private onSFUConnected(ws: WebSocket, request: http.IncomingMessage) {
        Logger.info(`New SFU connection: %s`, request.socket.remoteAddress);
        const newSFU = new SFUConnection(this, ws, request.socket.remoteAddress);

        // SFU acts as both a streamer and player
        this.streamerRegistry.add(newSFU);
        this.playerRegistry.add(newSFU);
        newSFU.transport.on('close', () => {
            this.streamerRegistry.remove(newSFU);
            this.playerRegistry.remove(newSFU);
            Logger.info(`SFU %s (%s) disconnected.`, newSFU.streamerId, request.socket.remoteAddress);
        });

        // because peer connection options is a general field with all optional fields
        // it doesnt play nice with mergePartial so we just add it verbatim
        const message: Messages.config = MessageHelpers.createMessage(Messages.config, this.protocolConfig);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message.peerConnectionOptions = this.protocolConfig['peerConnectionOptions'];
        newSFU.sendMessage(message);
    }
}

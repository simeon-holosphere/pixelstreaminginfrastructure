// Copyright Epic Games, Inc. All Rights Reserved.

import {
    PixelStreaming,
    Flags,
    Logger,
    AggregatedStats,
    LatencyTestResults,
    InitialSettings,
    Messages,
    DataChannelLatencyTestResult,
    OptionParameters,
    SettingsChangedEvent,
    LatencyInfo
} from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.5';
import { OverlayBase } from '../Overlay/BaseOverlay';
import { ActionOverlay } from '../Overlay/ActionOverlay';
import { TextOverlay } from '../Overlay/TextOverlay';
import { ConnectOverlay } from '../Overlay/ConnectOverlay';
import { DisconnectOverlay } from '../Overlay/DisconnectOverlay';
import { PlayOverlay } from '../Overlay/PlayOverlay';
import { InfoOverlay } from '../Overlay/InfoOverlay';
import { ErrorOverlay } from '../Overlay/ErrorOverlay';
import { AFKOverlay } from '../Overlay/AFKOverlay';
import { Controls, ControlsUIConfiguration } from '../UI/Controls';
import { LabelledButton } from '../UI/LabelledButton';
import { SettingsPanel } from '../UI/SettingsPanel';
import { StatsPanel } from '../UI/StatsPanel';
import { VideoQpIndicator } from '../UI/VideoQpIndicator';
import { ConfigUI } from '../Config/ConfigUI';
import {
    UIElementCreationMode,
    isPanelEnabled,
    UIElementConfig,
    SettingsPanelConfiguration,
    StatsPanelConfiguration,
    ExtraFlags
} from '../UI/UIConfigurationTypes';
import { FullScreenIconBase, FullScreenIconExternal } from '../UI/FullscreenIcon';

/**
 * Configuration of the internal video QP indicator element.
 * By default, one will be made, but if needed this can be disabled.
 *
 * Note: For custom UI elements to react to the QP being changed, use a PixelStreaming
 * object's addEventListener('videoEncoderAvgQP', ...) or removeEventListener(...).
 */
export type VideoQPIndicatorConfig = {
    disableIndicator?: boolean;
    /** Setting this to true will hide the indicator when the connection is "good" ie. green */
    hideWhenGood?: boolean;
};

/**
 * UI Options can be provided when creating an Application, to configure it's internal
 * and external behaviour, enable/disable features, and connect to external UI.
 */
export interface UIOptions {
    stream: PixelStreaming;
    onColorModeChanged?: (isLightMode: boolean) => void;
    /** By default, a settings panel and associate visibility toggle button will be made.
     * If needed, this behaviour can be configured. */
    settingsPanelConfig?: SettingsPanelConfiguration;
    /** By default, a stats panel and associate visibility toggle button will be made.
     * If needed, this behaviour can be configured. */
    statsPanelConfig?: StatsPanelConfiguration;
    /** If needed, the full screen button can be external or disabled. */
    fullScreenControlsConfig?: UIElementConfig;
    /** If needed, XR button can be external or disabled. */
    xrControlsConfig?: UIElementConfig;
    /** Configuration of the video QP indicator. */
    videoQpIndicatorConfig?: VideoQPIndicatorConfig;
    /** Hide the controls in fullscreen mode */
    hideControlsInFullscreen?: boolean;
}

/**
 * An Application is a combination of UI elements to display and manage a WebRTC Pixel Streaming
 * connection. It includes features for controlling a stream with mouse and keyboard,
 * managing connection endpoints, as well as displaying stats and other information about it.
 */
export class Application {
    stream: PixelStreaming;

    _rootElement: HTMLElement;
    _uiFeatureElement: HTMLElement;

    // set the overlay placeholders
    currentOverlay: OverlayBase | null;
    disconnectOverlay: ActionOverlay;
    connectOverlay: ActionOverlay;
    playOverlay: ActionOverlay;
    infoOverlay: TextOverlay;
    errorOverlay: TextOverlay;
    afkOverlay: AFKOverlay;

    controls: Controls;

    settingsPanel: SettingsPanel;
    statsPanel: StatsPanel;
    videoQpIndicator: VideoQpIndicator;

    configUI: ConfigUI;

    onColorModeChanged: UIOptions['onColorModeChanged'];

    protected _options: UIOptions;

    /**
     * @param options - Initialization options
     */
    constructor(options: UIOptions) {
        
        this._options = options;
        
        // FIRST: Assign the stream
        this.stream = options.stream;

        // THEN: Set the flag and log
        console.log('=== DEBUG: Setting HoveringMouseMode ===');
        console.log('Stream exists:', !!this.stream);
        console.log('Stream config exists:', !!this.stream?.config);

        try {
            this.stream.config.setFlagEnabled(Flags.HoveringMouseMode, true);
            console.log('✅ HoveringMouseMode enabled:', this.stream.config.isFlagEnabled(Flags.HoveringMouseMode));
            console.log('📋 Available flags:', Object.keys(Flags));
        } catch (error) {
            console.error('❌ Error setting HoveringMouseMode:', error);
        }

        // Explicitly create ui features now so creation time is known
        this._uiFeatureElement = this.createUIFeaturesElement();

        // Explicitly create root element now so creation time is known
        this._rootElement = this.createRootElement(this.stream, this._uiFeatureElement);

        this.onColorModeChanged = options.onColorModeChanged;
        this.configUI = new ConfigUI(this.stream.config);

        this.createOverlays();

        if (isPanelEnabled(options.statsPanelConfig)) {
            // Add stats panel
            this.statsPanel = new StatsPanel(options.statsPanelConfig);
            this.uiFeaturesElement.appendChild(this.statsPanel.rootElement);
        }

        if (isPanelEnabled(options.settingsPanelConfig)) {
            // Add settings panel
            this.settingsPanel = new SettingsPanel();
            this.uiFeaturesElement.appendChild(this.settingsPanel.rootElement);
            this.configureSettings();
        }
        
        //if (!options.videoQpIndicatorConfig || !options.videoQpIndicatorConfig.disableIndicator) {
        //    // Add the video stream QP indicator
        //    this.videoQpIndicator = new VideoQpIndicator(options.videoQpIndicatorConfig);
        //    this.uiFeaturesElement.appendChild(this.videoQpIndicator.rootElement);
        //}

        // this.createButtons();

        this.registerCallbacks();

        this.showConnectOrAutoConnectOverlays();

        this.setColorMode(this.configUI.isCustomFlagEnabled(ExtraFlags.LightMode));

        // Double-check the flag is still set after all initialization
        console.log('🔍 Final check - HoveringMouseMode enabled:', this.stream.config.isFlagEnabled(Flags.HoveringMouseMode));

        this.stream.config._addOnSettingChangedListener(Flags.HideUI, (isEnabled: boolean) => {
            this._uiFeatureElement.style.visibility = isEnabled ? 'hidden' : 'visible';
        });

        if (this.stream.config.isFlagEnabled(Flags.HideUI)) {
            this._uiFeatureElement.style.visibility = 'hidden';
        }
    }

    public createOverlays(): void {
        // build all of the overlays
        this.disconnectOverlay = new DisconnectOverlay(this.stream.videoElementParent);
        this.connectOverlay = new ConnectOverlay(this.stream.videoElementParent);
        this.playOverlay = new PlayOverlay(this.stream.videoElementParent);
        this.infoOverlay = new InfoOverlay(this.stream.videoElementParent);
        this.errorOverlay = new ErrorOverlay(this.stream.videoElementParent);
        this.afkOverlay = new AFKOverlay(this.stream.videoElementParent);

        this.disconnectOverlay.onAction(() => this.stream.reconnect());

        // Build the webRtc connect overlay Event Listener and show the connect overlay
        this.connectOverlay.onAction(() => this.stream.connect());

        // set up the play overlays action
        this.playOverlay.onAction(() => this.stream.play());
    }

    /**
     * Set up button click functions and button functionality
     */
    public createButtons() {
        const isIphone = /iPhone/.test(navigator.userAgent);
        const isIpad =
            /iPad/.test(navigator.userAgent) ||
            (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);
        const isSafari =
            navigator.vendor &&
            navigator.vendor.indexOf('Apple') > -1 &&
            navigator.userAgent &&
            navigator.userAgent.indexOf('CriOS') == -1 &&
            navigator.userAgent.indexOf('FxiOS') == -1;

        // In some cases we want to disable fullscreen button if it is not explicitly requested:

        // IPhone does not support fullscreen API as at 28th July 2024 (see: https://caniuse.com/fullscreen) so if
        // we are on IPhone and user has not specified explicitly configured UI config for
        // fullscreen button then we should disable this button as it doesn't work.

        // Additionally iPad on non-Safari browsers doesn't really allow touch inputs and fullscreen video at the same time.
        // If you do this the video gets dragged off back to normal non-fullscreen video and then the video is paused.
        // See: https://github.com/EpicGamesExt/PixelStreamingInfrastructure/issues/219
        const disableFullscreenButton = isIphone || (!isSafari && isIpad);

        if (this._options.fullScreenControlsConfig === undefined && disableFullscreenButton) {
            this._options.fullScreenControlsConfig = { creationMode: UIElementCreationMode.Disable };
        }

        const controlsUIConfig: ControlsUIConfiguration = {
            statsButtonType: this._options.statsPanelConfig
                ? this._options.statsPanelConfig.visibilityButtonConfig
                : undefined,
            settingsButtonType: this._options.settingsPanelConfig
                ? this._options.settingsPanelConfig.visibilityButtonConfig
                : undefined,
            fullscreenButtonType: this._options.fullScreenControlsConfig,
            xrIconType: this._options.xrControlsConfig,
            hideControlsInFullscreen: this._options.hideControlsInFullscreen
        };

        // Setup controls
        const controls = new Controls(controlsUIConfig);
        this.uiFeaturesElement.appendChild(controls.rootElement);

        // When we fullscreen we want this element to be the root
        const fullScreenButton: FullScreenIconBase | undefined =
            // Depending on if we're creating an internal button, or using an external one
            !!this._options.fullScreenControlsConfig &&
            this._options.fullScreenControlsConfig.creationMode === UIElementCreationMode.UseCustomElement
                ? // Either create a fullscreen class based on the external button
                  new FullScreenIconExternal(this._options.fullScreenControlsConfig.customElement)
                : // Or use the one created by the Controls initializer earlier
                  controls.fullscreenIcon;
        if (fullScreenButton) {
            fullScreenButton.fullscreenElement = /iPad|iPhone|iPod/.test(navigator.userAgent)
                ? this.stream.videoElementParent.getElementsByTagName('video')[0]
                : this.rootElement;
        }

        // Add settings button to controls
        const settingsButton: HTMLElement | undefined = controls.settingsIcon
            ? controls.settingsIcon.rootElement
            : this._options.settingsPanelConfig.visibilityButtonConfig.customElement;
        if (settingsButton) settingsButton.onclick = () => this.settingsClicked();
        if (this.settingsPanel) this.settingsPanel.settingsCloseButton.onclick = () => this.settingsClicked();

        // Add WebXR button to controls
        const xrButton: HTMLElement | undefined = controls.xrIcon
            ? controls.xrIcon.rootElement
            : this._options.xrControlsConfig.creationMode === UIElementCreationMode.UseCustomElement
              ? this._options.xrControlsConfig.customElement
              : undefined;
        if (xrButton) xrButton.onclick = () => this.stream.toggleXR();

        // setup the stats/info button
        const statsButton: HTMLElement | undefined = controls.statsIcon
            ? controls.statsIcon.rootElement
            : this._options.statsPanelConfig.visibilityButtonConfig.customElement;
        if (statsButton) statsButton.onclick = () => this.statsClicked();

        if (this.statsPanel) {
            this.statsPanel.statsCloseButton.onclick = () => this.statsClicked();
        }

        // Add command buttons (if we have somewhere to add them to)
        if (this.settingsPanel) {
            // Add button for toggle fps
            const showFPSButton = new LabelledButton('Show FPS', 'Toggle');
            showFPSButton.addOnClickListener(() => {
                this.stream.requestShowFps();
            });

            // Add button for restart stream
            const restartStreamButton = new LabelledButton('Restart Stream', 'Restart');
            restartStreamButton.addOnClickListener(() => {
                this.stream.reconnect();
            });

            // Add button for request keyframe
            const requestKeyframeButton = new LabelledButton('Request keyframe', 'Request');
            requestKeyframeButton.addOnClickListener(() => {
                this.stream.requestIframe();
            });

            const commandsSectionElem = this.configUI.buildSectionWithHeading(
                this.settingsPanel.settingsContentElement,
                'Commands'
            );
            commandsSectionElem.appendChild(showFPSButton.rootElement);
            commandsSectionElem.appendChild(requestKeyframeButton.rootElement);
            commandsSectionElem.appendChild(restartStreamButton.rootElement);
        }
    }

    /**
     * Configure the settings with on change listeners and any additional per experience settings.
     */
    configureSettings(): void {
        // This builds all the settings sections and flags under this `settingsContent` element.
        this.configUI.populateSettingsElement(
            this.settingsPanel.settingsContentElement,
            this._options.settingsPanelConfig
        );

        this.configUI.addCustomFlagOnSettingChangedListener(ExtraFlags.LightMode, (isLightMode: boolean) => {
            this.configUI.setCustomFlagLabel(
                ExtraFlags.LightMode,
                `Color Scheme: ${isLightMode ? 'Light' : 'Dark'} Mode`
            );
            this.setColorMode(isLightMode);
        });
    }

    registerCallbacks() {
        this.stream.addEventListener('afkWarningActivate', ({ data: { countDown, dismissAfk } }) =>
            this.showAfkOverlay(countDown, dismissAfk)
        );
        this.stream.addEventListener('afkWarningUpdate', ({ data: { countDown } }) =>
            this.afkOverlay.updateCountdown(countDown)
        );
        this.stream.addEventListener('afkWarningDeactivate', () => this.afkOverlay.hide());
        this.stream.addEventListener('afkTimedOut', () => this.afkOverlay.hide());
        this.stream.addEventListener('videoEncoderAvgQP', ({ data: { avgQP } }) =>
            this.onVideoEncoderAvgQP(avgQP)
        );
        this.stream.addEventListener('webRtcSdp', () => this.onWebRtcSdp());
        this.stream.addEventListener('webRtcAutoConnect', () => this.onWebRtcAutoConnect());
        this.stream.addEventListener('webRtcConnecting', () => this.onWebRtcConnecting());
        this.stream.addEventListener('webRtcConnected', () => this.onWebRtcConnected());
        this.stream.addEventListener('webRtcFailed', () => this.onWebRtcFailed());
        this.stream.addEventListener(
            'webRtcDisconnected',
            ({ data: { eventString, allowClickToReconnect } }) =>
                this.onDisconnect(eventString, allowClickToReconnect)
        );
        this.stream.addEventListener('videoInitialized', () => this.onVideoInitialized());
        this.stream.addEventListener('streamLoading', () => this.onStreamLoading());
        this.stream.addEventListener('playStreamError', ({ data: { message } }) =>
            this.onPlayStreamError(message)
        );
        this.stream.addEventListener('playStream', () => this.onPlayStream());
        this.stream.addEventListener('playStreamRejected', ({ data: { reason } }) =>
            this.onPlayStreamRejected(reason)
        );
        this.stream.addEventListener('loadFreezeFrame', ({ data: { shouldShowPlayOverlay } }) =>
            this.onLoadFreezeFrame(shouldShowPlayOverlay)
        );
        this.stream.addEventListener('statsReceived', ({ data: { aggregatedStats } }) =>
            this.onStatsReceived(aggregatedStats)
        );
        this.stream.addEventListener('latencyCalculated', ({ data: { latencyInfo } }) =>
            this.onLatencyUpdate(latencyInfo)
        );
        this.stream.addEventListener('latencyTestResult', ({ data: { latencyTimings } }) =>
            this.onLatencyTestResults(latencyTimings)
        );
        this.stream.addEventListener('dataChannelLatencyTestResult', ({ data: { result } }) =>
            this.onDataChannelLatencyTestResults(result)
        );
        this.stream.addEventListener(
            'streamerListMessage',
            ({ data: { messageStreamerList, autoSelectedStreamerId, wantedStreamerId } }) =>
                this.handleStreamerListMessage(messageStreamerList, autoSelectedStreamerId, wantedStreamerId)
        );
        this.stream.addEventListener('subscribeFailed', ({ data: { message } }) =>
            this.handleSubscribeFailedMessage(message)
        );
        this.stream.addEventListener('settingsChanged', (event) => this.onSettingsChanged(event));
        this.stream.addEventListener('playerCount', ({ data: { count } }) => this.onPlayerCount(count));
        this.stream.addEventListener('webRtcTCPRelayDetected', () =>
            Logger.Warning(`Stream quailty degraded due to network enviroment, stream is relayed over TCP.`)
        );
    }

    /**
     * Gets the rootElement of the application, video stream and all UI are children of this element.
     */
    public get rootElement(): HTMLElement {
        if (!this._rootElement) {
            this._rootElement = this.createRootElement(this.stream, this.uiFeaturesElement);
        }
        return this._rootElement;
    }

    /**
     * Creates the root element for the Pixel Streaming UI.
     * Note: This should be called before the Pixel Streaming object is created.
     * @param pixelstreaming - The Pixel Streaming object.
     * @param uiFeaturesElem - The element holding all the custom UI features.
     * @returns A div with the id #playerUI populated with videoElementParent and uiFeatureElement.
     */
    private createRootElement(pixelstreaming: PixelStreaming, uiFeaturesElem: HTMLElement): HTMLElement {
        const elem = document.createElement('div');
        elem.id = 'playerUI';
        elem.classList.add('noselect');
        if (pixelstreaming === undefined) {
            throw new Error(
                'Could not create root element properly - pixelstreaming object was undefined. Are you calling this too early?'
            );
        }
        if (pixelstreaming.videoElementParent === undefined) {
            throw new Error(
                'Could not create root element properly - videoElementParent object was undefined. Are you calling this too early?'
            );
        }
        if (uiFeaturesElem === undefined) {
            throw new Error(
                'Could not create root element properly - uiFeaturesElement object was undefined. Are you calling this too early?'
            );
        }
        elem.appendChild(pixelstreaming.videoElementParent);
        elem.appendChild(uiFeaturesElem);
        return elem;
    }

    /**
     * Gets the element that contains all the UI features, like the stats and settings panels.
     */
    public get uiFeaturesElement(): HTMLElement {
        if (!this._uiFeatureElement) {
            this._uiFeatureElement = this.createUIFeaturesElement();
        }
        return this._uiFeatureElement;
    }

    /**
     * Creates the UI features element for holding all the custom UI features.
     * @returns A div with the id #uiFeatures.
     */
    private createUIFeaturesElement(): HTMLElement {
        const elem = document.createElement('div');
        elem.id = 'uiFeatures';
        return elem;
    }

    /**
     * Shows the disconnect overlay
     * @param updateText - the text that will be displayed in the overlay
     */
    showDisconnectOverlay(updateText: string) {
        this.hideCurrentOverlay();
        this.updateDisconnectOverlay(updateText);
        this.disconnectOverlay.show();
        this.currentOverlay = this.disconnectOverlay;
    }

    /**
     * Update the disconnect overlays span text
     * @param updateText - the new countdown number
     */
    updateDisconnectOverlay(updateText: string) {
        this.disconnectOverlay.update(updateText);
    }

    /**
     * Activates the disconnect overlays action
     */
    onDisconnectionAction() {
        this.disconnectOverlay.activate();
    }

    /**
     * Hides the current overlay
     */
    hideCurrentOverlay() {
        if (this.currentOverlay != null) {
            this.currentOverlay.hide();
            this.currentOverlay = null;
        }
    }

    /**
     * Shows the connect overlay
     */
    showConnectOverlay() {
        this.hideCurrentOverlay();
        this.connectOverlay.show();
        this.currentOverlay = this.connectOverlay;
    }

    /**
     * Shows the play overlay
     */
    showPlayOverlay() {
        this.hideCurrentOverlay();
        this.playOverlay.show();
        this.currentOverlay = this.playOverlay;
    }

    /**
     * Shows the text overlay
     * @param text - the text that will be shown in the overlay
     */
    showTextOverlay(text: string) {
        this.hideCurrentOverlay();
        this.infoOverlay.update(text);
        this.infoOverlay.show();
        this.currentOverlay = this.infoOverlay;
    }

    /**
     * Shows the error overlay
     * @param text - the text that will be shown in the overlay
     */
    showErrorOverlay(text: string) {
        this.hideCurrentOverlay();
        this.errorOverlay.update(text);
        this.errorOverlay.show();
        this.currentOverlay = this.errorOverlay;
    }

    /**
     * Shows or hides the settings panel if clicked
     */
    settingsClicked() {
        this.statsPanel?.hide();
        this.settingsPanel.toggleVisibility();
    }

    /**
     * Shows or hides the stats panel if clicked
     */
    statsClicked() {
        this.settingsPanel?.hide();
        this.statsPanel.toggleVisibility();
    }

    /**
     * Activates the connect overlays action
     */
    onConnectAction() {
        this.connectOverlay.activate();
    }

    /**
     * Activates the play overlays action
     */
    onPlayAction() {
        this.playOverlay.activate();
    }

    /**
     * Shows the afk overlay
     * @param countDown - the countdown number for the afk countdown
     */
    showAfkOverlay(countDown: number, dismissAfk: () => void) {
        this.hideCurrentOverlay();
        this.afkOverlay.updateCountdown(countDown);
        this.afkOverlay.onAction(() => dismissAfk());
        this.afkOverlay.show();
        this.currentOverlay = this.afkOverlay;
    }

    /**
     * Show the Connect Overlay or auto connect
     */
    showConnectOrAutoConnectOverlays() {
        // set up if the auto play will be used or regular click to start
        if (!this.stream.config.isFlagEnabled(Flags.AutoConnect)) {
            this.showConnectOverlay();
        }
    }

    /**
     * Show the webRtcAutoConnect Overlay and connect
     */
    onWebRtcAutoConnect() {
        this.showTextOverlay('Auto Connecting Now');
    }

    /**
     * Set up functionality to happen when receiving a webRTC answer
     */
    onWebRtcSdp() {
        this.showTextOverlay('WebRTC Connection Negotiated');
    }

    /**
     * Shows a text overlay to alert the user the stream is currently loading
     */
    onStreamLoading() {
        // build the spinner span
        const spinnerSpan: HTMLSpanElement = document.createElement('span');
        spinnerSpan.className = 'visually-hidden';
        spinnerSpan.innerHTML = 'Loading...';

        // build the spinner div
        const spinnerDiv: HTMLDivElement = document.createElement('div');
        spinnerDiv.id = 'loading-spinner';
        spinnerDiv.className = 'spinner-border ms-2';
        spinnerDiv.setAttribute('role', 'status');

        // append the spinner to the element
        spinnerDiv.appendChild(spinnerSpan);

        this.showTextOverlay('Loading Stream ' + spinnerDiv.outerHTML);
    }

    /**
     * Event fired when the video is disconnected - displays the error overlay and resets the buttons stream tools upon disconnect
     * @param eventString - the event text that will be shown in the overlay
     * @param allowClickToReconnect - true if we want to allow the user to click to reconnect. Otherwise it's just a message.
     */
    onDisconnect(eventString: string, allowClickToReconnect: boolean) {
        const overlayMessage = 'Disconnected' + (eventString ? `: ${eventString}` : '.');
        if (allowClickToReconnect) {
            this.showDisconnectOverlay(`${overlayMessage} Click To Restart.`);
        } else {
            this.showErrorOverlay(overlayMessage);
        }
        // disable starting a latency checks
        this.statsPanel?.onDisconnect();
    }

    /**
     * Handles when Web Rtc is connecting
     */
    onWebRtcConnecting() {
        this.showTextOverlay('Starting connection to server, please wait');
    }

    /**
     * Handles when Web Rtc has connected
     */
    onWebRtcConnected() {
        this.showTextOverlay('WebRTC connected, waiting for video');
    }

    /**
     * Handles when Web Rtc fails to connect
     */
    onWebRtcFailed() {
        this.showErrorOverlay('Unable to setup video');
    }

    onLoadFreezeFrame(shouldShowPlayOverlay: boolean) {
        if (shouldShowPlayOverlay === true) {
            Logger.Info('showing play overlay');
            this.showPlayOverlay();
        }
    }

    onPlayStream() {
        this.hideCurrentOverlay();
    }

    onPlayStreamError(message: string) {
        this.showErrorOverlay(message);
    }

    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    onPlayStreamRejected(onRejectedReason: unknown) {
        this.showPlayOverlay();
    }

    onVideoInitialized() {
        if (!this.stream.config.isFlagEnabled(Flags.AutoPlayVideo)) {
            this.showPlayOverlay();
        }
        this.statsPanel?.onVideoInitialized(this.stream);
    }

    /**
     * Set up functionality to happen when calculating the average video encoder qp
     * @param QP - the quality number of the stream
     */
    onVideoEncoderAvgQP(QP: number) {
        // Update internal QP indicator if one is present
        if (this.videoQpIndicator) {
            this.videoQpIndicator.updateQpTooltip(QP);
        }
    }

    onInitialSettings(settings: InitialSettings) {
        if (settings.PixelStreamingSettings) {
            this.statsPanel?.configure(settings.PixelStreamingSettings);
        }
    }

    onStatsReceived(aggregatedStats: AggregatedStats) {
        // Grab all stats we can off the aggregated stats
        this.statsPanel?.handleStats(aggregatedStats);
    }

    onLatencyUpdate(latencyInfo: LatencyInfo) {
        this.statsPanel?.handleLatencyInfo(latencyInfo);
    }

    onLatencyTestResults(latencyTimings: LatencyTestResults) {
        this.statsPanel?.latencyTest.handleTestResult(latencyTimings);
    }

    onDataChannelLatencyTestResults(result: DataChannelLatencyTestResult) {
        this.statsPanel?.dataChannelLatencyTest.handleTestResult(result);
    }

    onPlayerCount(playerCount: number) {
        this.statsPanel?.handlePlayerCount(playerCount);
    }

    handleStreamerListMessage(
        messageStreamingList: Messages.streamerList,
        autoSelectedStreamerId: string,
        wantedStreamerId: string
    ) {
        const waitForStreamer = this.stream.config.isFlagEnabled(Flags.WaitForStreamer);
        const isReconnecting = this.stream.isReconnecting();
        let message: string = null;
        let allowRestart: boolean = true;

        if (!autoSelectedStreamerId) {
            if (waitForStreamer && wantedStreamerId) {
                if (isReconnecting) {
                    message = `Waiting for ${wantedStreamerId} to become available.`;
                    allowRestart = false;
                } else {
                    message = `Gave up waiting for ${wantedStreamerId} to become available. Click to try again`;
                    if (messageStreamingList.ids.length > 0) {
                        message += ` or select a streamer from the settings menu.`;
                    }
                    allowRestart = true;
                }
            } else if (messageStreamingList.ids.length == 0) {
                if (isReconnecting) {
                    message = `Waiting for a streamer to become available.`;
                    allowRestart = false;
                } else {
                    message = `No streamers available. Click to try again.`;
                    allowRestart = true;
                }
            } else {
                message = `Multiple streamers available. Select one from the settings menu.`;
                allowRestart = false;
            }

            if (allowRestart) {
                this.showDisconnectOverlay(message);
            } else {
                this.showTextOverlay(message);
            }
        }
    }

    handleSubscribeFailedMessage(message: string) {
        this.showDisconnectOverlay(`Subscribe failed: "${message}" Click to try again`);
    }

    /**
     * Set light/dark color mode
     * @param isLightMode - should we use a light or dark color scheme
     */
    setColorMode(isLightMode: boolean) {
        if (this.onColorModeChanged) {
            this.onColorModeChanged(isLightMode);
        }
    }

    onSettingsChanged(event: SettingsChangedEvent) {
        // Pass the event directly onto the configUI. This will do things like updating the possible values
        // as well as the selected value
        this.configUI.onSettingsChanged(event);

        const {
            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            data: { id, target, type }
        } = event;
        // Explicitly handle specific setting behaviour
        if (id == OptionParameters.PreferredQuality) {
            const preferredQualityOption = this.stream.config.getSettingOption(
                OptionParameters.PreferredQuality
            );
            if ([...preferredQualityOption.options].includes('Default')) {
                this.configUI.disableSetting(OptionParameters.PreferredQuality);
            } else {
                this.configUI.enableSetting(OptionParameters.PreferredQuality);
            }
        }
    }
}

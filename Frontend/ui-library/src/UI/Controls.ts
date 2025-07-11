// Copyright Epic Games, Inc. All Rights Reserved.

import { FullScreenIcon } from './FullscreenIcon';
import { SettingsIcon } from './SettingsIcon';
import { StatsIcon } from './StatsIcon';
import { XRIcon } from './XRIcon';
import { WebXRController } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.5';
import { UIElementConfig, UIElementCreationMode } from '../UI/UIConfigurationTypes';

/**
 * Configures how UI elements to control the stream are created.
 * By default, a button will be created for each control. That can be overriden per-control
 * to use an externally provided element, or to disable the element entirely.
 */
export type ControlsUIConfiguration = {
    statsButtonType?: UIElementConfig;
    fullscreenButtonType?: UIElementConfig;
    settingsButtonType?: UIElementConfig;
    xrIconType?: UIElementConfig;
    hideControlsInFullscreen?: boolean;
};

// If there isn't a type provided, default behaviour is to create the element.
function shouldCreateButton(type: UIElementConfig | undefined): boolean {
    return type == undefined ? true : type.creationMode === UIElementCreationMode.CreateDefaultElement;
}

/**
 * Element containing various controls like stats, settings, fullscreen.
 */
export class Controls {
    statsIcon: StatsIcon;
    fullscreenIcon: FullScreenIcon;
    settingsIcon: SettingsIcon;
    xrIcon: XRIcon;

    _rootElement: HTMLElement;

    config?: ControlsUIConfiguration;

    /**
     * Construct the controls
     */
    constructor(config?: ControlsUIConfiguration) {
        this.config = config;
        if (!config || shouldCreateButton(config.statsButtonType)) {
            this.statsIcon = new StatsIcon();
        }
        if (!config || shouldCreateButton(config.settingsButtonType)) {
            this.settingsIcon = new SettingsIcon();
        }
        if (!config || shouldCreateButton(config.fullscreenButtonType)) {
            this.fullscreenIcon = new FullScreenIcon();
        }
        if (!config || shouldCreateButton(config.xrIconType)) {
            this.xrIcon = new XRIcon();
        }
    }

    /**
     * Get the element containing the controls.
     */
    public get rootElement(): HTMLElement {
        if (!this._rootElement) {
            this._rootElement = document.createElement('div');
            this._rootElement.id = 'controls';
            if (this.fullscreenIcon) {
                this._rootElement.appendChild(this.fullscreenIcon.rootElement);
            }
            if (this.settingsIcon) {
                this._rootElement.appendChild(this.settingsIcon.rootElement);
            }
            if (this.statsIcon) {
                this._rootElement.appendChild(this.statsIcon.rootElement);
            }
            if (this.xrIcon) {
                void WebXRController.isSessionSupported('immersive-vr').then((supported: boolean) => {
                    if (supported) {
                        this._rootElement.appendChild(this.xrIcon.rootElement);
                    }
                });
            }
            document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
        }

        return this._rootElement;
    }

    private handleFullscreenChange(): void {
        const isInFullscreen = !!document.fullscreenElement;
        if (isInFullscreen && this.config?.hideControlsInFullscreen) {
            this._rootElement.style.visibility = 'hidden';
        } else {
            this._rootElement.style.visibility = 'visible';
        }
    }
}

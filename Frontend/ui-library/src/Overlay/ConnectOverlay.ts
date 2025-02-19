//// Copyright Epic Games, Inc. All Rights Reserved.
//
//import { ActionOverlay } from './ActionOverlay';
//
///**
// * Overlay shown during connection, has a button that can be clicked to initiate a connection.
// */
//export class ConnectOverlay extends ActionOverlay {
//    //private usernameInput: HTMLInputElement;
//    //private passwordInput: HTMLInputElement;
//
//    /**
//     * @returns The created root element of this overlay.
//     */
//    public static createRootElement(): HTMLElement {
//        const connectElem = document.createElement('div');
//        connectElem.id = 'connectOverlay';
//        connectElem.className = 'clickableState';
//        return connectElem;
//    }
//
//    /**
//     * @returns The created content element of this overlay, which contain whatever content this element contains, like text or a button.
//     */
//    public static createContentElement(): HTMLElement {
//        const container = document.createElement('div');
//        container.id = 'authContainer';
//        container.className = 'fixed inset-0 flex items-center justify-center';
//
//        //const formContainer = document.createElement('div');
//        //formContainer.className = 'w-96 bg-white rounded-lg p-8';
//        
//        
//
//        const heading = document.createElement('h2');
//        heading.textContent = 
//        heading.className = 'text-2xl font-bold mb-6';
//
//        //const form = document.createElement('form');
//        //form.className = 'space-y-4';
//        //form.innerHTML = `
//        //<div class="flex flex-col gap-4">
//        //    <div class="w-full">
//        //        <input 
//        //            type="text" 
//        //            id="username" 
//        //            placeholder="Username" 
//        //            required
//        //            class="w-full px-3 py-2 rounded"
//        //        >
//        //    </div>
//        //    <div class="w-full">
//        //        <input 
//        //            type="password" 
//        //            id="password" 
//        //            placeholder="Password" 
//        //            required
//        //            class="w-full px-3 py-2 rounded"
//        //        >
//        //    </div>
//        //    <button 
//        //        type="submit"
//        //        class="w-full py-2 bg-cyan-500 text-white rounded"
//        //    >
//        //        Log in
//        //    </button>
//        //</div>
//    //`;
//
//        //formContainer.appendChild(heading);
//        //formContainer.appendChild(form);
//        //container.appendChild(formContainer);
//        container.appendChild(heading);
//        return container;
//    }
//
//    /**
//     * Construct a connect overlay with a connection button.
//     * @param parentElem - the parent element this overlay will be inserted into.
//     */
//    public constructor(parentElem: HTMLElement) {
//        super(parentElem, ConnectOverlay.createRootElement(), ConnectOverlay.createContentElement());
//
//    //    this.usernameInput = this.rootElement.querySelector('#username');
////        this.passwordInput = this.rootElement.querySelector('#password');
//
//  //      const form = this.rootElement.querySelector('form')!;
//    //    form.addEventListener('submit', (e: Event) => {
//      //      e.preventDefault();
//        //    void this.handleAuth(); // Add void operator to explicitly ignore the promise
//        //});
//        this.activate();
//    }
//
//    //private async handleAuth() {
//    //    try {
//    //        const credentials = {
//    //            username: this.usernameInput.value,
//    //            password: this.passwordInput.value
//    //        };
//
//    //        const response = await fetch('/auth', {
//    //            method: 'POST',
//    //            headers: { 'Content-Type': 'application/json' },
//    //            body: JSON.stringify(credentials)
//    //        });
//
//    //        if (response.ok) {
//    //            this.activate();
//    //        } else {
//    //            alert('Authentication failed');
//    //        }
//    //    } catch (error) {
//    //        console.error('Auth error: ', error);
//    //        alert('Authentication failed');
//    //    }
//    //}
//}

// Copyright Epic Games, Inc. All Rights Reserved.

import { ActionOverlay } from './ActionOverlay';

/**
 * Overlay shown during connection, has a button that can be clicked to initiate a connection.
 */
export class ConnectOverlay extends ActionOverlay {
    /**
     * @returns The created root element of this overlay.
     */
    public static createRootElement(): HTMLElement {
        const connectElem = document.createElement('div');
        connectElem.id = 'connectOverlay';
        connectElem.className = 'clickableState';
        return connectElem;
    }

    /**
     * @returns The created content element of this overlay, which contain whatever content this element contains, like text or a button.
     */
    public static createContentElement(): HTMLElement {
        const connectContentElem = document.createElement('div');
        connectContentElem.id = 'connectButton';
        connectContentElem.innerHTML = 'Click to start';
        return connectContentElem;
    }

    /**
     * Construct a connect overlay with a connection button.
     * @param parentElem - the parent element this overlay will be inserted into.
     */
    public constructor(parentElem: HTMLElement) {
        super(parentElem, ConnectOverlay.createRootElement(), ConnectOverlay.createContentElement());

        // add the new event listener
        this.rootElement.addEventListener('click', () => {
            this.activate();
        });
    }
}
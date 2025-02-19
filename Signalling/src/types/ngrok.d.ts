declare module '@ngrok/ngrok' {
    export interface NgrokOptions {
        addr: number | string;
        authtoken?: string;
        authtoken_from_env?: boolean;
        oauth?: {
            provider: string;
            allow_emails: string[];
        };
        basic_auth?: string;
    }

    export interface NgrokListener {
        url(): string;
        close(): Promise<void>;
    }

    export function forward(options: NgrokOptions): Promise<NgrokListener>;
    export function disconnect(): Promise<void>;
}
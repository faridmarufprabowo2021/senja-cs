export interface WaSendMediaOptions {
  buffer: Buffer;
  mimetype: string;
  fileName?: string;
  caption?: string;
  isImage?: boolean;
  isVideo?: boolean;
}

export interface IWaDriver {
  qr?: string;
  
  /** Start driver connection, emit status/QR updates via WebSocket hub */
  start(opts?: { forceQr?: boolean }): Promise<void>;
  
  /** Stop driver instance and cleanup connections */
  stop(logout?: boolean): Promise<any>;
  
  /** Reset auth directory/credentials and trigger fresh QR */
  resetAuth(): Promise<void>;
  
  /** Send text message */
  sendText(jid: string, text: string): Promise<any>;
  
  /** Send image, document, or audio media */
  sendMedia(jid: string, opts: WaSendMediaOptions): Promise<any>;
}


export declare class RTCRtpScriptTransform {
    constructor(worker : Worker, options : any);
};


// RTC with insertable stream support
export interface RTCRtpSenderIS extends RTCRtpSender {
    createEncodedStreams? : Function,
    transform? : RTCRtpScriptTransform
}
export interface RTCRtpReceiverIS extends RTCRtpReceiver {
    createEncodedStreams? : Function,
    transform? : RTCRtpScriptTransform
}


/**
 * Represents a remote audio and/or video source
 *
 * @param uid - unique identifier for this user.
 */
export interface RemoteSource {
    uid : string,
    getAudioSender? : () => RTCRtpSenderIS,
    getAudioReceiver? : () => RTCRtpReceiverIS,
    getAudioTrack? : () => RemoteTrack,
    getVideoTrack? : () => RemoteTrack,
    hasAudio : boolean,
    hasVideo : boolean
}


export interface TransportManager {
    join : (appID : string, channel : string, token : string, uid : string) => Promise<string>,
    leave : (willRestart? : boolean) => Promise<void>,
    rejoin : () => Promise<void>,
    on : (eventName : string, callback : Function) => void,
    createMicrophoneAudioTrack : (audioConfig : MicrophoneConfig) => Promise<LocalTrack>,
    createCameraVideoTrack : (videoConfig : CameraConfig) => Promise<LocalTrack>,
    publish : (streams : Array<LocalTrack>) => Promise<void>,
    unpublish : (streams : Array<LocalTrack>) => Promise<void>,
    subscribe : (user : RemoteSource, mediaType : string) => Promise<void>,
    unsubscribe : (user : RemoteSource) => Promise<void>,
    sendBroadcastMessage : (msg : Uint8Array) => boolean,

    getSharedAudioReceiver : () => RTCRtpReceiverIS,
    getSharedAudioSender : () => RTCRtpSenderIS,

    renewToken : (token : string) => Promise<void>
}

export interface MicrophoneConfig {
    AEC: boolean,
    AGC: boolean,
    ANS: boolean,
    bypassWebAudio: boolean,
    encoderConfig: any /* {
        sampleRate: 48000,
        bitrate: 64,
        stereo: false
    } */
}

export interface CameraConfig {
    encoderConfig: any
}


export interface LocalTrack {
    stop : () => void,
    close : () => void,
    play : (videoEltID : string) => void
    getMediaStreamTrack : () => MediaStreamTrack,
    replaceMediaStreamTrack? : (replacement : MediaStreamTrack) => Promise<void>
}


export interface RemoteTrack {
    play : (videoEltID : string) => void
    getMediaStreamTrack : () => MediaStreamTrack,
}

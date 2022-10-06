
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


export interface HiFiRemoteUser {
    uid : string,
    audioTrack : MediaStreamTrack,
    videoTrack : MediaStreamTrack,
    getSender : () => RTCRtpSenderIS,
    getReceiver : () => RTCRtpReceiverIS,
    hasAudio : () => boolean,
    hasVideo : () => boolean
}


export interface HiFiTransport {
    join : (appID : string, channel : string, token : string, uid : string) => Promise<string>,
    leave : (willRestart? : boolean) => Promise<void>,
    rejoin : () => Promise<void>,
    on : (eventName : string, callback : Function) => void,
    createMicrophoneAudioTrack : (audioConfig : HiFiMicrophoneAudioTrackInitConfig) => Promise<LocalTrack>,
    createCameraVideoTrack : (videoConfig : HiFiCameraVideoTrackInitConfig) => Promise<LocalTrack>,
    publish : (streams : Array<LocalTrack>) => Promise<void>,
    unpublish : (streams : Array<LocalTrack>) => Promise<void>,
    subscribe : (user : HiFiRemoteUser, mediaType : string) => Promise<void>,
    unsubscribe : (user : HiFiRemoteUser) => Promise<void>,
    sendStreamMessage : (msg : Uint8Array) => boolean,

    getSharedAudioSender: () => RTCRtpSenderIS,
    // getSharedAudioReceiver: () => RTCRtpReceiverIS,

    renewToken : (token : string) => Promise<void>
}

export interface HiFiMicrophoneAudioTrackInitConfig {
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

export interface HiFiCameraVideoTrackInitConfig {
    encoderConfig: string
}


export interface LocalTrack {
    stop : () => void,
    close : () => void,
    play : (videoEltID : string) => void
    getMediaStreamTrack : () => MediaStreamTrack,
    updateOriginMediaStreamTrack? : (replacement : MediaStreamTrack) => Promise<void>
}

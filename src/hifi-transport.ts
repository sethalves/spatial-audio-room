
/**
 * Represents a remote audio and/or video source
 *
 */
export interface RemoteSource {
    /** The unique identifier for this remote source */
    uid : string,
    /** Get the RTCRtpSender from this source's PeerConnection */
    getAudioSender : () => RTCRtpSender,
    /** Get the RTCRtpReceiver from this source's PeerConnection */
    getAudioReceiver : () => RTCRtpReceiver,
    /** Get the audio-track being sent by this remote source */
    getAudioTrack : () => RemoteTrack,
    /** Get the video-track being sent by this remote source */
    getVideoTrack : () => RemoteTrack,
    /** True if this source is sending audio */
    hasAudio : boolean,
    /** True if this source is sending video */
    hasVideo : boolean
}


/**
 * Abstract interface for transport-managers.
 * This type is passed to an AudioManager instance so that it can send and receive
 * audio, video, and other data.
 *
 * @example
 * ```
 * let transport = new TransportManagerAgora();
 * ```
 *
 */
export interface TransportManager {
    join : (channel : string, uid : string) => Promise<string>,
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
    getSharedAudioReceiver : () => RTCRtpReceiver,
    getSharedAudioSender : () => RTCRtpSender,
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

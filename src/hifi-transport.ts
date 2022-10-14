
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
 * TransportManager is an abstract interface for transport-managers.  A specific subclass of this is passed to an AudioManager instance so that it can send and receive audio, video, and other data.
 *
 * @example
 * ```
 * let transport = new TransportManagerAgora(appID, token);
 * await HiFiAudio.join(transport, localUid, "room name", { x: 0, y: 0, o: 0 }, -40, false, true);
 * ```
 *
 */
export interface TransportManager {
    /** Join a room with the given channel name and ID
     * @param {string} channel - A name for a channel.  This is interpretted by the instantiated TransportManager.
     * @param {string} uid - A unique ID for the local source.  Use `null` if the TransportManager should generate one.
     */
    join : (channel : string, uid : string) => Promise<string>,
    /** Leave a room that was previously joined. */
    leave : () => Promise<void>,
    /** Leave a room and then immediatly rejoin it, without destroying the AudioContext */
    rejoin : () => Promise<void>,
    /** Register a callback function.  The named callbacks which can be registered are:
        - user-published - (user : RemoteSource, mediaType : string) => void
        - user-unpublished - (user : RemoteSource) => void
        - broadcast-received - (uid : string, data : Uint8Array) => void
        - volume-level-change - (uid : string, level : number) => void
     */
    on : (eventName : string, callback : Function) => void,
    /** Create a LocalTrack which carries data from the local microphone. */
    createMicrophoneAudioTrack : (audioConfig : MicrophoneConfig) => Promise<LocalTrack>,
    /** Create a LocalTrack which carries data from the local camera. */
    createCameraVideoTrack : (videoConfig : CameraConfig) => Promise<LocalTrack>,
    /** Start transmitting a LocalTrack -- become a RemoteSource for remote listeners. */
    publish : (streams : Array<LocalTrack>) => Promise<void>,
    /** Stop transmitting a LocalTrack. */
    unpublish : (streams : Array<LocalTrack>) => Promise<void>,
    /** Begin to consume data from a RemoteSource */
    subscribe : (remoteSource : RemoteSource, mediaType : string) => Promise<void>,
    /** Stop consuming data from a RemoteSource */
    unsubscribe : (remoteSource : RemoteSource) => Promise<void>,
    /** Send a message to other participants in the joined room. */
    sendBroadcastMessage : (msg : Uint8Array) => boolean,
    /** Get the shared RTCRtpReceiver for this TransportManager, if there is one, else `null` is returned. This would be non-null for an MCU TransportManager, but null for a peer-to-peer one. */
    getSharedAudioReceiver : () => RTCRtpReceiver,
    /** Get the shared RTCRtpSender for this TransportManager, if there is one, else `null` is returned. This would be non-null for an MCU or SFU TransportManager, but null for a peer-to-peer one..*/
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


/**
 * LocalTrack is a compatibilty wrapper which holds a local MediaStreamTrack (from a mic or camera) in whatever form the instantiated TransportManager keeps it.
 */
export interface LocalTrack {
    stop : () => void,
    close : () => void,
    play : (videoEltID : string) => void
    getMediaStreamTrack : () => MediaStreamTrack,
    replaceMediaStreamTrack? : (replacement : MediaStreamTrack) => Promise<void>
}


/**
 * RemoteTrack is a compatibilty wrapper which holds a MediaStreamTrack which is received over the network.
 */
export interface RemoteTrack {
    play : (videoEltID : string) => void
    getMediaStreamTrack : () => MediaStreamTrack,
}


import AgoraRTC, {
    IAgoraRTCClient,
    UID,
    IMicrophoneAudioTrack,
    IAgoraRTCRemoteUser
} from "agora-rtc-sdk-ng";
import { HiFiAudioAPIData, ReceivedHiFiAudioAPIData, Point3D, Quaternion, OtherUserGainMap } from "./HiFiAudioAPIData";
import { HiFiHandedness, WorldFrameConfiguration } from "./HiFiAxisConfiguration";
import { patchRTCPeerConnection } from './patch-rtc-peer-connection';

patchRTCPeerConnection();

export enum HiFiConnectionStates {
    Disconnected = "Disconnected",
    Connecting = "Connecting",
    Connected = "Connected",
    InputConnected = "InputConnected",
    Reconnecting = "Reconnecting",
    Disconnecting = "Disconnecting",
    Failed = "Failed",
    Unavailable = "Unavailable"
};

export enum HiFiUserDataStreamingScopes {
    None = "none",
    Peers = "peers",
    All = "all"
};

export interface ConnectionRetryAndTimeoutConfig {
    autoRetryInitialConnection?: boolean;
    maxSecondsToSpendRetryingInitialConnection?: number;
    autoRetryOnDisconnect?: boolean;
    maxSecondsToSpendRetryingOnDisconnect?: number;
    pauseBetweenRetriesMS?: number;
    timeoutPerConnectionAttemptMS?: number;
};


export interface HiFiConnectionAttemptResult {
    success: boolean,
    error?: string,
    audionetInitResponse?: any,
    disableReconnect?: boolean;
}


interface AudioWorkletNodeMeta extends AudioWorkletNode {
    _x? : number,
    _y? : number
}


interface TransformStreamWithID extends TransformStream {
    uid? : UID | undefined
}


interface RTCConfiguration {
    iceServers?: RTCIceServer[] | undefined;
    iceTransportPolicy?: RTCIceTransportPolicy | undefined; // default = 'all'
    bundlePolicy?: RTCBundlePolicy | undefined; // default = 'balanced'
    rtcpMuxPolicy?: RTCRtcpMuxPolicy | undefined; // default = 'require'
    peerIdentity?: string | undefined; // default = null
    certificates?: RTCCertificate[] | undefined;
    iceCandidatePoolSize?: number | undefined; // default = 0
    encodedInsertableStreams?: boolean | undefined;
}


interface HiFiElement {
    icon: string,
    x: number,
    y: number,
    radius: number,
    alpha: number,
    clickable: boolean,
    hifiSource: AudioWorkletNodeMeta,
    uid: UID
}


let elements : Array<HiFiElement> = [];
let audioElement : HTMLAudioElement;
let audioContext : AudioContext;

let hifiNoiseGate : AudioWorkletNode = undefined;  // mic stream connects here
let hifiListener : AudioWorkletNodeMeta = undefined;   // hifiSource connects here
let hifiLimiter : AudioWorkletNode = undefined;    // additional sounds connect here


function setThreshold(value : number) {
    if (hifiNoiseGate !== undefined) {
        hifiNoiseGate.parameters.get('threshold').value = value;
        console.log('set noisegate threshold to', value, 'dB');
    }
}

// Fast approximation of Math.atan2(y, x)
// rel |error| < 4e-5, smooth (exact at octant boundary)
// for y=0 x=0, returns NaN
function fastAtan2(y : number, x : number) : number {
    let ax = Math.abs(x);
    let ay = Math.abs(y);
    let x1 = Math.min(ax, ay) / Math.max(ax, ay);

    // 9th-order odd polynomial approximation to atan(x) over x=[0,1]
    // evaluate using Estrin's method
    let x2 = x1 * x1;
    let x3 = x2 * x1;
    let x4 = x2 * x2;
    let r =  0.024065681985187 * x4 + 0.186155334995372;
    let t = -0.092783165661197 * x4 - 0.332039687921915;
    r = r * x2 + t;
    r = r * x3 + x1;

    // use octant to reconstruct result in [-PI,PI]
    if (ay > ax) r = 1.570796326794897 - r;
    if (x < 0.0) r = 3.141592653589793 - r;
    if (y < 0.0) r = -r;
    return r;
}

function setPosition(hifiSource : AudioWorkletNodeMeta) {
    let dx = hifiSource._x - hifiListener._x;
    let dy = hifiSource._y - hifiListener._y;

    //let azimuth = angle_wrap(atan2f(dx, dy) - avatarOrientationRadians);

    let distanceSquared = dx * dx + dy * dy;
    let distance = Math.sqrt(distanceSquared);
    let azimuth = (distanceSquared < 1e-30) ? 0.0 : fastAtan2(dx, dy);

    hifiSource.parameters.get('azimuth').value = azimuth;
    hifiSource.parameters.get('distance').value = distance;
}

const roomDimensions = {
    width: 8,
    height: 2.5,
    depth: 8,
};

function updatePositions(elements : Array<HiFiElement>) {
    // only update the listener
    let e = elements.find(e => e.hifiSource === null);
    if (e !== undefined) {
        // transform canvas to audio coordinates
        hifiListener._x = (e.x - 0.5) * roomDimensions.width;
        hifiListener._y = -(e.y - 0.5) * roomDimensions.depth;
    }
}


// create Agora client
interface IAgoraRTCClientOpen extends IAgoraRTCClient {
    _p2pChannel? : any | undefined
}
const client : IAgoraRTCClientOpen = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8"
});


// Agora client options
export interface AgoraClientOptions {
    appid?: string | undefined,
    channel?: string | undefined,
    uid?: UID,
    token?: string | undefined
}
let options : AgoraClientOptions = {
    appid: null,
    channel: null,
    uid: null,
    token: null
};


// RTC with insertable stream support
interface RTCRtpSenderIS extends RTCRtpSender {
    createEncodedStreams : Function
}
interface RTCRtpReceiverIS extends RTCRtpReceiver {
    createEncodedStreams : Function
}


interface IMicrophoneAudioTrackOpen extends IMicrophoneAudioTrack {
    _updateOriginMediaStreamTrack? : Function | undefined
}
export interface LocalTracks {
    audioTrack: IMicrophoneAudioTrackOpen
}
let localTracks : LocalTracks = {
    //videoTrack: null,
    audioTrack: null
};


let remoteUsers : any = {};


let audioConfig = {
    AEC: false,
    AGC: false,
    ANS: false,
    bypassWebAudio: true,
    encoderConfig: {
        sampleRate: 48000,
        bitrate: 64,
        stereo: false,
    },
};


declare var HIFI_API_VERSION: string;


export enum MuteReason {
    CLIENT = "client",
    ADMIN = "admin",
    INTERNAL = "internal"
}


export class MuteChangedEvent {
    success: boolean;
    targetInputAudioMutedValue: boolean;
    currentInputAudioMutedValue: boolean;
    adminPreventsInputAudioUnmuting: boolean;
    muteReason: MuteReason;

    constructor({
        success,
        targetInputAudioMutedValue,
        currentInputAudioMutedValue,
        adminPreventsInputAudioUnmuting,
        muteReason
    }: {
        success: boolean,
        targetInputAudioMutedValue: boolean,
        currentInputAudioMutedValue: boolean,
        adminPreventsInputAudioUnmuting: boolean,
        muteReason: MuteReason
    }) {
        this.success = success;
        this.targetInputAudioMutedValue = targetInputAudioMutedValue;
        this.currentInputAudioMutedValue = currentInputAudioMutedValue;
        this.adminPreventsInputAudioUnmuting = adminPreventsInputAudioUnmuting;
        this.muteReason = muteReason;
    }
}

export type OnMuteChangedCallback = (muteChangedEvent: MuteChangedEvent) => void;


interface AudionetSetOtherUserGainsForThisConnectionResponse {
    success: boolean,
    reason?: string
}

export interface SetOtherUserGainsForThisConnectionResponse {
    success: boolean,
    error?: string,
    audionetSetOtherUserGainsForThisConnectionResponse?: AudionetSetOtherUserGainsForThisConnectionResponse
}


interface AudionetSetOtherUserGainsForThisConnectionResponse {
    success: boolean,
    reason?: string
}


export interface SetOtherUserGainsForThisConnectionResponse {
    success: boolean,
    error?: string,
    audionetSetOtherUserGainsForThisConnectionResponse?: AudionetSetOtherUserGainsForThisConnectionResponse
}

export type SetOtherUserGainForThisConnectionResponse = SetOtherUserGainsForThisConnectionResponse;


export enum AvailableUserDataSubscriptionComponents {
    Position = "Position",
    Orientation = "Orientation (Quaternion)",
    VolumeDecibels = "Volume (Decibels)",
    IsStereo = "IsStereo"
}


export class UserDataSubscription {
    providedUserID: string;
    components: Array<AvailableUserDataSubscriptionComponents>;
    callback: Function;
    constructor({
        providedUserID = null,
        components,
        callback
    }: {
        providedUserID?: string,
        components: Array<AvailableUserDataSubscriptionComponents>,
        callback: Function
    }) {
        this.providedUserID = providedUserID;
        this.components = components;
        this.callback = callback;
    }
}


async function join() {

    await startSpatialAudio();

    // add event listener to play remote tracks when remote user publishs.
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);

    // join a channel and create local tracks
    options.uid = await client.join(options.appid, options.channel, options.token || null);
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack(audioConfig);

    //
    // route mic stream through Web Audio noise gate
    //
    let mediaStreamTrack = localTracks.audioTrack.getMediaStreamTrack();
    let mediaStream = new MediaStream([mediaStreamTrack]);

    let sourceNode = audioContext.createMediaStreamSource(mediaStream);
    let destinationNode = audioContext.createMediaStreamDestination()
    hifiNoiseGate = new AudioWorkletNode(audioContext, 'wasm-noise-gate');

    sourceNode.connect(hifiNoiseGate).connect(destinationNode);

    let destinationTrack = destinationNode.stream.getAudioTracks()[0];
    await localTracks.audioTrack._updateOriginMediaStreamTrack(destinationTrack, false);

    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");

    //
    // insertable streams
    //
    let senders : Array<RTCRtpSenderIS> = client._p2pChannel.connection.peerConnection.getSenders();
    senders.forEach(sender => senderTransform(sender));

    //
    // HACK! set user radius based on volume level
    // TODO: reimplement in a performant way...
    //
    // AgoraRTC.setParameter("AUDIO_VOLUME_INDICATION_INTERVAL", 20);
    // client.enableAudioVolumeIndicator();
    // client.on("volume-indicator", volumes => {
    //     volumes.forEach((volume, index) => {
    //         let e = elements.find(e => e.uid === volume.uid);
    //         if (e !== undefined)
    //             e.radius = 0.02 + 0.04 * volume.level/100;
    //     });
    // })
}

function senderTransform(sender : RTCRtpSenderIS) {
    const senderStreams = sender.createEncodedStreams();
    const readableStream = senderStreams.readable;
    const writableStream = senderStreams.writable;
    const transformStream = new TransformStream({
        start() { console.log('installed sender transform'); },
        transform(encodedFrame, controller) {
            if (sender.track.kind === "audio") {

                let src = new DataView(encodedFrame.data);
                let len = encodedFrame.data.byteLength;

                // create dst buffer with 4 extra bytes
                let dst = new DataView(new ArrayBuffer(len + 4));

                // copy src data
                for (let i = 0; i < len; ++i) {
                    dst.setInt8(i, src.getInt8(i));
                }

                // insert metadata at the end
                let qx = Math.round(hifiListener._x * 256.0); // x in Q7.8
                let qy = Math.round(hifiListener._y * 256.0); // y in Q7.8

                dst.setInt16(len + 0, qx);
                dst.setInt16(len + 2, qy);

                encodedFrame.data = dst.buffer;
            }
            controller.enqueue(encodedFrame);
        },
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
}

function receiverTransform(receiver : RTCRtpReceiverIS, uid : UID) {
    const receiverStreams = receiver.createEncodedStreams();
    const readableStream = receiverStreams.readable;
    const writableStream = receiverStreams.writable;
    const transformStream : TransformStreamWithID = new TransformStream({
        start() { console.log('installed receiver transform for uid:', uid); },
        transform(encodedFrame, controller) {
            if (receiver.track.kind === "audio") {

                let src = new DataView(encodedFrame.data);
                let len = encodedFrame.data.byteLength - 4;

                // create dst buffer with 4 fewer bytes
                let dst = new DataView(new ArrayBuffer(len));

                // copy src data
                for (let i = 0; i < len; ++i) {
                    dst.setInt8(i, src.getInt8(i));
                }

                // extract metadata at the end
                let x = src.getInt16(len + 0) * (1/256.0);
                let y = src.getInt16(len + 2) * (1/256.0);

                // find hifiSource for this uid
                let e = elements.find(e => e.uid === uid);
                if (e !== undefined) {

                    // update hifiSource position
                    e.hifiSource._x = x;
                    e.hifiSource._y = y;
                    setPosition(e.hifiSource);

                    // update screen position
                    e.x = 0.5 + (x / roomDimensions.width);
                    e.y = 0.5 - (y / roomDimensions.depth);
                }

                encodedFrame.data = dst.buffer;
            }
            controller.enqueue(encodedFrame);
        },
    });

    transformStream.uid = uid;

    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
}

async function leave() {

    if (localTracks.audioTrack) {
        localTracks.audioTrack.stop();
        localTracks.audioTrack.close();
        localTracks.audioTrack = undefined;
    }

    // leave the channel
    await client.leave();

    elements.length = 0;

    stopSpatialAudio();

    console.log("client leaves channel success");
}

function handleUserPublished(user : IAgoraRTCRemoteUser, mediaType : string) {
    const id : UID = user.uid;
    remoteUsers[id] = user;
    subscribe(user, mediaType);
}

function handleUserUnpublished(user : IAgoraRTCRemoteUser) {
    const id : UID = user.uid;
    delete remoteUsers[id];
    unsubscribe(user);
}

async function subscribe(user : IAgoraRTCRemoteUser, mediaType : string) {
    const uid = user.uid;

    // subscribe to a remote user
    if (mediaType == "audio") {
        await client.subscribe(user, mediaType);
        console.log("subscribe uid:", uid);
    }

    //    if (mediaType === 'video') {
    //        const player = $(`
    //      <div id="player-wrapper-${uid}">
    //        <p class="player-name">remoteUser(${uid})</p>
    //        <div id="player-${uid}" class="player"></div>
    //      </div>
    //    `);
    //        $("#remote-playerlist").append(player);
    //        user.videoTrack.play(`player-${uid}`);
    //    }

    if (mediaType === 'audio') {

        //user.audioTrack.play();

        let mediaStreamTrack = user.audioTrack.getMediaStreamTrack();
        let mediaStream = new MediaStream([mediaStreamTrack]);
        let sourceNode = audioContext.createMediaStreamSource(mediaStream);

        let hifiSource : AudioWorkletNodeMeta = new AudioWorkletNode(audioContext, 'wasm-hrtf-input');
        sourceNode.connect(hifiSource).connect(hifiListener);

        //
        // insertable streams
        //
        let receivers : Array<RTCRtpReceiverIS> = client._p2pChannel.connection.peerConnection.getReceivers();
        let receiver : RTCRtpReceiverIS = receivers.find(r => r.track.id === mediaStreamTrack.id);
        receiverTransform(receiver, uid);

        elements.push({
            icon: 'sourceIcon',
            x: 0,
            y: 0,
            radius: 0.02,
            alpha: 0.5,
            clickable: false,

            hifiSource,
            uid,
        });
    }
}

async function unsubscribe(user: IAgoraRTCRemoteUser) {
    const uid = user.uid;

    // find and remove this uid
    let i = elements.findIndex(e => e.uid === uid);
    elements.splice(i, 1);

    console.log("unsubscribe uid:", uid);
}

async function startSpatialAudio() {

    audioElement = new Audio();

    try {
        audioContext = new AudioContext({ sampleRate: 48000 });
    } catch (e) {
        console.log('Web Audio is not supported by this browser.');
        return;
    }

    console.log("Audio callback latency (samples):", audioContext.sampleRate * audioContext.baseLatency);

    await audioContext.audioWorklet.addModule('HifiProcessor.js');

    hifiListener = new AudioWorkletNode(audioContext, 'wasm-hrtf-output', {outputChannelCount : [2]});
    hifiLimiter = new AudioWorkletNode(audioContext, 'wasm-limiter');
    hifiListener.connect(hifiLimiter).connect(audioContext.destination);

    // initial position
    hifiListener._x = 2.0 * Math.random() - 1.0;
    hifiListener._y = 2.0 * Math.random() - 1.0;

    audioElement.play();
}

function stopSpatialAudio() {
    audioContext.close();
}





export class HiFiCommunicator {

    audioElement: HTMLAudioElement;
    audioContext: AudioContext;
    hifiListener: AudioWorkletNodeMeta;
    hifiLimiter: AudioWorkletNode;

    onUsersDisconnected: Function;
    onConnectionStateChanged: Function;
    userDataCallback: Function;

    private _currentHiFiConnectionState: HiFiConnectionStates = HiFiConnectionStates.Disconnected;
    public getConnectionState(): HiFiConnectionStates {
        return this._currentHiFiConnectionState;
    }


    constructor({
        initialHiFiAudioAPIData = new HiFiAudioAPIData(),
        onConnectionStateChanged,
        onUsersDisconnected,
        transmitRateLimitTimeoutMS = 50,
        userDataStreamingScope = HiFiUserDataStreamingScopes.All,
        worldFrameConfig,
        onMuteChanged,
        connectionRetryAndTimeoutConfig
    }: {
        initialHiFiAudioAPIData?: HiFiAudioAPIData,
        onConnectionStateChanged?: Function,
        onUsersDisconnected?: Function,
        transmitRateLimitTimeoutMS?: number,
        userDataStreamingScope?: HiFiUserDataStreamingScopes,
        worldFrameConfig?: WorldFrameConfiguration,
        onMuteChanged?: OnMuteChangedCallback,
        connectionRetryAndTimeoutConfig?: ConnectionRetryAndTimeoutConfig
    } = {}) {
        if (onUsersDisconnected) {
            this.onUsersDisconnected = onUsersDisconnected;
        }
        if (onConnectionStateChanged) {
            this.onConnectionStateChanged = onConnectionStateChanged;
        }
    }


    // private _manageConnection(newState: HiFiConnectionStates, message?: HiFiConnectionAttemptResult): void {
    //     switch (newState) {
    //         case HiFiConnectionStates.Connecting:
    //         case HiFiConnectionStates.Reconnecting:
    //             return;
    //         case HiFiConnectionStates.Connected:
    //             // this._updateStateAndCallUserStateChangeHandler(newState, message);
    //             return;
    //         case HiFiConnectionStates.Disconnecting:
    //             // this._updateStateAndCallUserStateChangeHandler(newState, message);
    //             return;
    //         case HiFiConnectionStates.Failed:
    //             // this._failureNotificationPending = message;
    //             return;
    //         case HiFiConnectionStates.Disconnected:
    //             return;
    //     }
    // }


    private decrypt_appid(data : string, key : string) {
        let k = BigInt(key.split('').reduce((a, b) => a = Math.imul(a, 33) + b.charCodeAt(0) | 0, 0));
        let t = BigInt('0x' + data) ^ (k * 38038099725390353860267635547n);
        return t.toString(16);
    }


    // startSpatialAudio()
    async connectToHiFiAudioAPIServer(hifiAuthJWT: string,
                                      signalingHostURL?: string,
                                      signalingPort?: number): Promise<HiFiConnectionAttemptResult> {

        options.appid = this.decrypt_appid("f9b2b6c1c83e07ff5ca7e54625d32dd8", "ambisonic");
        options.token = null;
        options.channel = "hifi-demo"

        join();

        return new Promise((resolve, reject) => {
            console.log("QQQQ in promise");
            if (this.onConnectionStateChanged) {
                console.log("QQQQ calling onConnectionStateChanged...");
                this.onConnectionStateChanged(HiFiConnectionStates.Connected, "ok");
            }

            // XXX
            if (this.userDataCallback) {
                let currentSubscriptionCallbackData: Array<ReceivedHiFiAudioAPIData> = [];
                currentSubscriptionCallbackData.push(new ReceivedHiFiAudioAPIData({
                    providedUserID: "" + options.uid,
                    hashedVisitID: "" + options.uid,
                    position: new Point3D(),
                    orientation: new Quaternion(),
                    isStereo: false
                }));
                this.userDataCallback(currentSubscriptionCallbackData);
            }
            // XXX

            resolve({
                success: true,
                error: "ok",
                audionetInitResponse: {
                    visit_id_hash: "" + options.uid
                }
            });
        });
    }


    async disconnectFromHiFiAudioAPIServer(): Promise<string> {
        return new Promise<string>((resolve) => {
        });
    }


    async setOtherUserGainForThisConnection(visitIdHash: string, gain: number):
    Promise<SetOtherUserGainForThisConnectionResponse> {
        return new Promise<SetOtherUserGainForThisConnectionResponse>((resolve) => {
        });
    }


    async setOtherUserGainsForThisConnection(otherUserGainMap: OtherUserGainMap):
    Promise<SetOtherUserGainsForThisConnectionResponse> {
        return new Promise<SetOtherUserGainsForThisConnectionResponse>((resolve) => {
        });
    }


    getOutputAudioMediaStream(): MediaStream {
        console.log("QQQQQQQQQQ getOutputAudioMediaStream");

        return new MediaStream();
    }


    async setInputAudioMediaStream(newInputAudioMediaStream: MediaStream, isStereo: boolean = false): Promise<boolean> {
        console.log("QQQQQQQQQQ setInputAudioMediaStream");


        // return new Promise<boolean>((resolve) => {});
        return Promise.resolve(true);
    }


    async setInputAudioMuted(isMuted: boolean): Promise<boolean> {
        // return new Promise<boolean>((resolve) => {});
        return Promise.resolve(true);
    }


    getCommunicatorInfo(): any {
    }


    updateUserDataAndTransmit(newUserData: any): string {
        return "";
    }

    addUserDataSubscription(newSubscription: UserDataSubscription): void {
        this.userDataCallback = newSubscription.callback;

        // XXX
        if (this.userDataCallback) {
            let currentSubscriptionCallbackData: Array<ReceivedHiFiAudioAPIData> = [];
            currentSubscriptionCallbackData.push(new ReceivedHiFiAudioAPIData({
                providedUserID: "hoopy",
                hashedVisitID: "hoopy",
                position: new Point3D(),
                orientation: new Quaternion(),
                isStereo: false
            }));
            this.userDataCallback(currentSubscriptionCallbackData);
        }
        // XXX
    }
}

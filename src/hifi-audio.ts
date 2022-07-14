
import type {
    IAgoraRTC,
    IAgoraRTCClient,
    UID,
    IMicrophoneAudioTrack,
    ICameraVideoTrack,
    IAgoraRTCRemoteUser,
    MicrophoneAudioTrackInitConfig,
    CameraVideoTrackInitConfig
} from 'agora-rtc-sdk-ng';
interface IAgoraRTCOpen extends IAgoraRTC {
    setParameter? : any | undefined
}
declare const AgoraRTC: IAgoraRTCOpen;

import { checkSupported } from './check-supported.js';
let [ simdSupported, encodedTransformSupported, browserIsChrome ] = checkSupported();

import { patchRTCPeerConnection } from './patchRTCPeerConnection.js';
let _RTCPeerConnection = RTCPeerConnection;
patchRTCPeerConnection(_RTCPeerConnection);

let _RTCPeerConnectionWithMetadata = RTCPeerConnection;
let _RTCPeerConnectionWithoutMetadata = _RTCPeerConnection;

import { metadata, senderTransform, receiverTransform } from './transform.js';


interface AudioWorkletNodeMeta extends AudioWorkletNode {
    _x? : number,
    _y? : number,
    _o? : number
}


interface MetaData {
    x? : number,
    y? : number,
    o? : number
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

interface RTCRtpScriptTransformer {
    readable : ReadableStream;
    writable : WritableStream;
    options : any;
    generateKeyFrame : Function; // (optional sequence <DOMString> rids) : Promise<undefined>;
    sendKeyFrameRequest : Function; // () : Promise<undefined> ();
};

declare class RTCRtpScriptTransform {
    constructor(worker : Worker, options : any);
};


// Agora this.client with _p2pChannel exposed
interface IAgoraRTCClientOpen extends IAgoraRTCClient {
    _p2pChannel? : any | undefined,
    sendStreamMessage? : any | undefined
}

// RTC with insertable stream support
interface RTCRtpSenderIS extends RTCRtpSender {
    createEncodedStreams : Function,
    transform? : RTCRtpScriptTransform
}
interface RTCRtpReceiverIS extends RTCRtpReceiver {
    createEncodedStreams : Function,
    transform? : RTCRtpScriptTransform
}


interface IMicrophoneAudioTrackOpen extends IMicrophoneAudioTrack {
    _updateOriginMediaStreamTrack? : Function | undefined
}
interface LocalTracks {
    videoTrack?: ICameraVideoTrack,
    audioTrack: IMicrophoneAudioTrackOpen
}


let loopback : RTCPeerConnection[];

// create Agora client
let client : IAgoraRTCClientOpen = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8"
});

let localTracks : LocalTracks = {
    // videoTrack: null,
    audioTrack: null
};


let onUpdateRemotePosition : any;
let onReceiveBroadcast : any;
let onUpdateVolumeIndicator : any;
let onRemoteUserJoined : any;
let onRemoteUserLeft : any;

let remoteUsers : { [uid: string] : IAgoraRTCRemoteUser; } = {};
let worker : Worker = undefined;

let hifiSources: { [name: UID]: AudioWorkletNodeMeta } = {};
let hifiNoiseGate  : AudioWorkletNode;  // mic stream connects here
let hifiListener : AudioWorkletNodeMeta;   // hifiSource connects here
let hifiLimiter : AudioWorkletNode;    // additional sounds connect here

let audioElement : HTMLAudioElement;
let audioContext : AudioContext;

let hifiPosition = { x: 0.0, y: 0.0, o: 0.0 };

let subscribedToAudio : { [uid: string] : boolean; } = {};
let subscribedToVideo : { [uid: string] : boolean; } = {};


// Agora client hifiOptions
interface HifiOptions {
    appid?: string | undefined,
    channel?: string | undefined,
    tokenProvider?: Function | undefined,
    uid?: UID | undefined,
    thresholdValue?: number | undefined,
    thresholdSet?: boolean | undefined,
    video? : boolean | undefined,
    enableMetadata? : boolean | undefined
}
let hifiOptions : HifiOptions = {};


export function sendBroadcastMessage(msg : Uint8Array) : boolean {

    var msgString = new TextDecoder().decode(msg);
    console.log("hifi-audio: send broadcast message: " + JSON.stringify(msgString));

    if (client && localTracks.audioTrack) {
        client.sendStreamMessage(msg);
        return true;
    }
    return false;
}


function listenerMetadata(position : MetaData) {
    let data = new DataView(new ArrayBuffer(5));

    let qx = Math.round(position.x * 256.0);    // x in Q7.8
    let qy = Math.round(position.y * 256.0);    // y in Q7.8
    let qo = Math.round(position.o * (128.0 / Math.PI));    // brad in Q7

    data.setInt16(0, qx);
    data.setInt16(2, qy);
    data.setInt8(4, qo);

    if (encodedTransformSupported) {
        worker.postMessage({
            operation: 'metadata',
            metadata: data.buffer
        }, [data.buffer]);
    } else {
        metadata.data = data.buffer;
    }
}

export function sourceMetadata(buffer : ArrayBuffer, uid : UID) : void {
    let data = new DataView(buffer);

    let x = data.getInt16(0) * (1/256.0);
    let y = data.getInt16(2) * (1/256.0);
    let o = data.getInt8(4) * (Math.PI / 128.0);

    // update hifiSource position
    let hifiSource = hifiSources[uid];
    if (hifiSource !== undefined) {
        hifiSource._x = x;
        hifiSource._y = y;
        hifiSource._o = o;

        if (hifiOptions.enableMetadata) {
            setPositionFromMetadata(hifiSource);
        }
    }

    if (onUpdateRemotePosition) {
        onUpdateRemotePosition("" + uid, x, y, o);
    }
}


export function isChrome() {
    return browserIsChrome;
}


let aecEnabled = false;
export function isAecEnabled() : boolean {
    return aecEnabled;
}
export async function setAecEnabled(v : boolean) : Promise<string> {
    console.log("hifi-audio: setAecEnabled(" + v + ")");

    if (aecEnabled != v) {
        aecEnabled = v;
        if (localTracks.audioTrack) {
            await leave();
            // await joinAgoraRoom();
            await join(hifiOptions.appid,
                       hifiOptions.tokenProvider,
                       hifiOptions.channel,
                       hifiPosition,
                       hifiOptions.thresholdValue,
                       hifiOptions.video,
                       hifiOptions.enableMetadata);
        }
    }
    return "" + hifiOptions.uid;
}


let muteEnabled = false;
export function isMutedEnabled() : boolean {
    return muteEnabled;
}
export function setMutedEnabled(v : boolean) {
    console.log("hifi-audio: setMutedEnabled(" + v + "), thresholdValue=" + hifiOptions.thresholdValue);

    muteEnabled = v;
    if (hifiNoiseGate !== undefined) {
        hifiNoiseGate.parameters.get('threshold').value = muteEnabled ? 0.0 : hifiOptions.thresholdValue;
    }
}

export function setThreshold(value : number) {
    console.log("hifi-audio: setThreshold(" + value + ")");

    hifiOptions.thresholdValue = value;
    hifiOptions.thresholdSet = true;
    setMutedEnabled(muteEnabled);
}
export function getThreshold() {
    return hifiOptions.thresholdValue;
}


// Fast approximation of Math.atan2(y, x)
// rel |error| < 4e-5, smooth (exact at octant boundary)
// for y=0 x=0, returns NaN
export function fastAtan2(y : number, x : number) : number {
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

function angleWrap(angle : number) {
    return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
}


export function setAzimuth(uid : UID, azimuth : number) {
    let hifiSource = hifiSources[uid];
    if (hifiSource !== undefined) {
        hifiSource.parameters.get('azimuth').value = azimuth;
    }
}


function setPositionFromMetadata(hifiSource : AudioWorkletNodeMeta) {
    let dx = hifiSource._x - hifiPosition.x;
    let dy = hifiSource._y - hifiPosition.y;

    let distanceSquared = dx * dx + dy * dy;
    let distance = Math.sqrt(distanceSquared);
    let angle = (distanceSquared < 1e-30) ? 0.0 : fastAtan2(dx, dy);

    let azimuth = angleWrap(angle - hifiPosition.o);

    hifiSource.parameters.get('azimuth').value = azimuth;
    hifiSource.parameters.get('distance').value = distance;
}


export function setLocalMetaData(e : MetaData) : void {
    hifiPosition.x = e.x;
    hifiPosition.y = e.y;
    hifiPosition.o = e.o;
    if (hifiOptions.enableMetadata) {
        listenerMetadata(hifiPosition);
    }
}


export function setNewToken(token: string) : void {
    client.renewToken(token);
}


export function on(eventName : string, callback : Function) {
    if (eventName == "remote-position-updated") {
        onUpdateRemotePosition = callback;
    } else if (eventName == "broadcast-received") {
        onReceiveBroadcast = callback;
    } else if (eventName == "remote-volume-updated") {
        onUpdateVolumeIndicator = callback;
    } else if (eventName == "remote-client-joined") {
        onRemoteUserJoined = callback;
    } else if (eventName == "remote-client-left") {
        onRemoteUserLeft = callback;
    } else {
        console.log("Error: unknown event-name: " + eventName);
    }
}


export async function join(appID : string,
                           tokenProvider : Function,
                           channel : string,
                           initialPosition : MetaData,
                           initialThresholdValue : number,
                           video : boolean,
                           enableMetadata : boolean) {
    hifiOptions.uid = (Math.random()*4294967296)>>>0;
    hifiOptions.appid = appID;
    hifiOptions.tokenProvider = tokenProvider;
    hifiOptions.channel = channel;
    if (initialPosition) {
        hifiPosition.x = initialPosition.x;
        hifiPosition.y = initialPosition.y;
        hifiPosition.o = initialPosition.o;
    }
    if (!hifiOptions.thresholdSet) {
        hifiOptions.thresholdValue = initialThresholdValue;
        hifiOptions.thresholdSet = true;
    }
    hifiOptions.video = video;
    hifiOptions.enableMetadata = enableMetadata;

    if (enableMetadata) {
        RTCPeerConnection = _RTCPeerConnectionWithMetadata;
    } else {
        RTCPeerConnection = _RTCPeerConnectionWithoutMetadata;
    }

//     return await joinAgoraRoom();
// }


// async function joinAgoraRoom() {

    console.log("joinAgoraRoom options: " + JSON.stringify(hifiOptions) +
        " simdSupported=" + simdSupported + " encodedTransformSupported=" + encodedTransformSupported +
        " isChrome=" + isChrome);

    // client = AgoraRTC.createClient({
    //     mode: "rtc",
    //     codec: "vp8"
    // });

    // await startSpatialAudio();


    //
    // audioElement and audioContext are created immediately after a user gesture,
    // to prevent Safari auto-play policy from breaking the audio pipeline.
    //
    audioElement = new Audio();
    try {
        audioContext = new AudioContext({ sampleRate: 48000 });
    } catch (e) {
        console.log('Web Audio API is not supported by this browser.');
        return;
    }
    console.log("Audio callback latency (samples):", audioContext.sampleRate * audioContext.baseLatency);

    if (hifiOptions.enableMetadata) {
        if (encodedTransformSupported) {
            worker = new Worker('worker.js');
            worker.onmessage = event => sourceMetadata(event.data.metadata, event.data.uid);
        }
    }

    // audioElement.play();

    await audioContext.audioWorklet.addModule(simdSupported ? 'hifi.wasm.simd.js' : 'hifi.wasm.js');

    // temporary license token that expires 1/1/2023
    const wasmToken =
        'aGlmaQAAAAHLuJ9igD2xY0xxPKza+Rcw9gQGOo8T5k+/HJpF/UR1k99pVS6n6QfyWTz1PTHkpt62tta3jn0Ntbdx73ah/LBv14T1HjJULQE=';
    let hifiLicense = new AudioWorkletNode(audioContext, 'wasm-license');
    hifiLicense.port.postMessage(wasmToken);

    hifiListener = new AudioWorkletNode(audioContext, 'wasm-hrtf-output', {outputChannelCount : [2]});
    hifiLimiter = new AudioWorkletNode(audioContext, 'wasm-limiter', {outputChannelCount : [2]});
    hifiListener.connect(hifiLimiter);

    if (isAecEnabled() && isChrome) {
        startEchoCancellation(audioElement, audioContext);
    } else {
        hifiLimiter.connect(audioContext.destination);
    }

    audioElement.play();




    // add event listener to play remote tracks when remote user publishs.
    client.on("user-published", (user : IAgoraRTCRemoteUser, mediaType : string) => { handleUserPublished(user, mediaType); });
    client.on("user-unpublished", (user : IAgoraRTCRemoteUser) => { handleUserUnpublished(user); });

    client.on("token-privilege-will-expire", async function () {
        if (hifiOptions.tokenProvider) {
            console.log("refreshing token...");
            let token = await hifiOptions.tokenProvider(hifiOptions.uid, hifiOptions.channel, 1);
            await client.renewToken(token);
        }
    });

    client.on("token-privilege-did-expire", async function () {
        console.log("token expired...");
    });

    let token : string;
    if (hifiOptions.tokenProvider) {
        token = await hifiOptions.tokenProvider(hifiOptions.uid, hifiOptions.channel, 1);
    }

    let audioConfig : MicrophoneAudioTrackInitConfig = {
        AEC: aecEnabled,
        AGC: false,
        ANS: false,
        bypassWebAudio: true,
        encoderConfig: {
            sampleRate: 48000,
            bitrate: 64,
            stereo: false
        }
    };

    if (hifiOptions.video) {
        let videoConfig : CameraVideoTrackInitConfig = {
            encoderConfig: "240p_1"
        };

        console.log("QQQQ creating audio and video tracks...");

        // Join a channel and create local tracks. Best practice is to use Promise.all and run them concurrently.
        [hifiOptions.uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
            client.join(hifiOptions.appid, hifiOptions.channel, token || null, hifiOptions.uid || null),
            AgoraRTC.createMicrophoneAudioTrack(audioConfig),
            AgoraRTC.createCameraVideoTrack(videoConfig)
        ]);

    } else {
        console.log("QQQQ creating audio track...");

        delete localTracks.videoTrack;

        [hifiOptions.uid, localTracks.audioTrack] = await Promise.all([
            client.join(hifiOptions.appid, hifiOptions.channel, token || null, hifiOptions.uid || null),
            AgoraRTC.createMicrophoneAudioTrack(audioConfig)
        ]);
    }

    //
    // route mic stream through Web Audio noise gate
    //
    let mediaStreamTrack = localTracks.audioTrack.getMediaStreamTrack();
    let mediaStream = new MediaStream([mediaStreamTrack]);

    let sourceNode = audioContext.createMediaStreamSource(mediaStream);
    let destinationNode = audioContext.createMediaStreamDestination();

    hifiNoiseGate = new AudioWorkletNode(audioContext, 'wasm-noise-gate');
    console.log("hifi-audio: setting initial threshold to " + hifiOptions.thresholdValue);
    setThreshold(hifiOptions.thresholdValue);

    sourceNode.connect(hifiNoiseGate).connect(destinationNode);

    let destinationTrack = destinationNode.stream.getAudioTracks()[0];
    await localTracks.audioTrack._updateOriginMediaStreamTrack(destinationTrack, false);

    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");

    //
    // Insertable Streams / Encoded Transform
    //
    let senders : Array<RTCRtpSenderIS> = client._p2pChannel.connection.peerConnection.getSenders();
    let sender = senders.find(e => e.track?.kind === 'audio');

    if (hifiOptions.enableMetadata) {
        if (encodedTransformSupported) {

            sender.transform = new RTCRtpScriptTransform(worker, { operation: 'sender' });

        } else {

            const senderStreams = sender.createEncodedStreams();
            const readableStream = senderStreams.readable;
            const writableStream = senderStreams.writable;
            senderTransform(readableStream, writableStream);
        }
    }

    //
    // HACK! set user radius based on volume level
    // TODO: reimplement in a performant way...
    //
    AgoraRTC.setParameter("AUDIO_VOLUME_INDICATION_INTERVAL", 20);
    client.enableAudioVolumeIndicator();
    client.on("volume-indicator", volumes => {
        if (onUpdateVolumeIndicator) {
            volumes.forEach((volume, index) => {
                onUpdateVolumeIndicator("" + volume.uid, volume.level);
            });
        }
    })

    // handle broadcast from remote user
    client.on("stream-message", (uid : UID, data : Uint8Array) => {
        if (onReceiveBroadcast) {
            onReceiveBroadcast("" + uid, data);
        }
    });

    return "" + hifiOptions.uid;
}


export async function leave() {

    if (!client) {
        return;
    }

    console.log("hifi-audio: leave()");

    await client.unpublish(Object.values(localTracks));

    if (localTracks.audioTrack) {
        localTracks.audioTrack.stop();
        localTracks.audioTrack.close();
        localTracks.audioTrack = undefined;
    }

    if (localTracks.videoTrack) {
        localTracks.videoTrack.stop();
        localTracks.videoTrack.close();
        delete localTracks.videoTrack;
    }

    for (var uid in remoteUsers) {
        console.log("QQQQ leaving, uid=" + JSON.stringify(uid));
        if (onRemoteUserLeft) {
            onRemoteUserLeft("" + uid);
        }
    }

    remoteUsers = {};

    // leave the channel
    await client.leave();

    hifiSources = {};
    hifiNoiseGate = undefined;
    hifiListener = undefined;
    hifiLimiter = undefined;
    audioElement = undefined;
    loopback = [];

    stopSpatialAudio();
    // client = undefined;
}

function handleUserPublished(user : IAgoraRTCRemoteUser, mediaType : string) {
    const id = user.uid;
    remoteUsers["" + id] = user;
    subscribe(user, mediaType);
}

function handleUserUnpublished(user : IAgoraRTCRemoteUser) {
    const uid = user.uid;
    delete remoteUsers["" + uid];
    if (onRemoteUserLeft) {
        onRemoteUserLeft("" + uid);
    }
    unsubscribe(user);
}

async function subscribe(user : IAgoraRTCRemoteUser, mediaType : string) {
    const uid = user.uid;

    console.log("QQQQ subscribe " + uid + " " + mediaType + " hasVideo=" + JSON.stringify(user.hasVideo));

    if (mediaType === 'audio') {

        // subscribe to a remote user
        await client.subscribe(user, mediaType);
        console.log("subscribe uid:", uid);

        subscribedToAudio[ "" + uid ] = true;

        let mediaStreamTrack = user.audioTrack.getMediaStreamTrack();
        let mediaStream = new MediaStream([mediaStreamTrack]);
        let sourceNode = audioContext.createMediaStreamSource(mediaStream);

        let hifiSource = new AudioWorkletNode(audioContext, 'wasm-hrtf-input');
        hifiSources[uid] = hifiSource;

        sourceNode.connect(hifiSource).connect(hifiListener);

        //
        // Insertable Streams / Encoded Transform
        //
        let receivers : Array<RTCRtpReceiverIS> = client._p2pChannel.connection.peerConnection.getReceivers();
        let receiver : RTCRtpReceiverIS = receivers.find(e => e.track?.id === mediaStreamTrack.id && e.track?.kind === 'audio');

        if (hifiOptions.enableMetadata) {
            if (encodedTransformSupported) {

                receiver.transform = new RTCRtpScriptTransform(worker, { operation: 'receiver', uid });

            } else {

                const receiverStreams = receiver.createEncodedStreams();
                const readableStream = receiverStreams.readable;
                const writableStream = receiverStreams.writable;
                receiverTransform(readableStream, writableStream, uid, sourceMetadata);
            }
        }
    }

    if (mediaType === 'video') {

        // subscribe to a remote user
        await client.subscribe(user, mediaType);
        console.log("subscribe uid:", uid);

        subscribedToVideo[ "" + uid ] = true;
    }

    if (hifiOptions.video && subscribedToAudio[ "" + uid ] && subscribedToVideo[ "" + uid ]) {
        console.log("QQQQ A calling onRemoteUserJoined(" + uid + ")");
        onRemoteUserJoined("" + uid);
    }
    if (!hifiOptions.video && subscribedToAudio[ "" + uid ]) {
        console.log("QQQQ B calling onRemoteUserJoined(" + uid + ")");
        onRemoteUserJoined("" + uid);
    }
}


export async function playVideo(uid : UID, videoEltID : string) {
    if (uid == hifiOptions.uid) {
        await localTracks.videoTrack.play(videoEltID);
    } else {
        let user = remoteUsers[ "" + uid ];
        console.log("QQQQ playVideo for " + uid);
        if (user.videoTrack) {
            await user.videoTrack.play(videoEltID);
        } else {
            console.log("QQQQ but no user.videoTrack... " + uid);
        }
    }
}


async function unsubscribe(user: IAgoraRTCRemoteUser) {
    const uid = user.uid;

    delete hifiSources[ uid ];
    delete subscribedToAudio[ "" + uid ];
    delete subscribedToVideo[ "" + uid ];

    console.log("unsubscribe uid:", uid);
}

//
// Chrome (as of M100) cannot perform echo cancellation of the Web Audio output.
// As a workaround, a loopback configuration of local peer connections is inserted at the end of the pipeline.
// This should be removed when Chrome implements browser-wide echo cancellation.
// https://bugs.chromium.org/p/chromium/issues/detail?id=687574#c60
//
async function startEchoCancellation(element : HTMLAudioElement, context : AudioContext) {
    console.log("hifi-audio: startEchoCancellation()");

    loopback = [new _RTCPeerConnection, new _RTCPeerConnection];

    // connect Web Audio to destination
    let destination = context.createMediaStreamDestination();
    hifiLimiter.connect(destination);

    // connect through loopback peer connections
    loopback[0].addTrack(destination.stream.getAudioTracks()[0]);
    loopback[1].ontrack = e => element.srcObject = new MediaStream([e.track]);

    async function iceGatheringComplete(pc : RTCPeerConnection) : Promise<RTCSessionDescriptionInit> {
        return pc.iceGatheringState === 'complete' ? pc.localDescription :
            new Promise(resolve => {
                pc.onicegatheringstatechange = e => { pc.iceGatheringState === 'complete' && resolve(pc.localDescription); };
            });
    }

    // start loopback peer connections
    let offer = await loopback[0].createOffer();
    offer.sdp = offer.sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=1; sprop-stereo=1; maxaveragebitrate=256000');
    await loopback[0].setLocalDescription(offer);
    await loopback[1].setRemoteDescription(await iceGatheringComplete(loopback[0]));

    let answer = await loopback[1].createAnswer();
    answer.sdp = answer.sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=1; sprop-stereo=1; maxaveragebitrate=256000');
    await loopback[1].setLocalDescription(answer);
    await loopback[0].setRemoteDescription(await iceGatheringComplete(loopback[1]));

    console.log('Started AEC using loopback peer connections.')
}

function stopEchoCancellation() {
    console.log("hifi-audio: stopEchoCancellation()");

    loopback && loopback.forEach(pc => pc.close());
    loopback = null;
    console.log('Stopped AEC.')
}


async function startSpatialAudio() {

    //
    // audioElement and audioContext are created immediately after a user gesture,
    // to prevent Safari auto-play policy from breaking the audio pipeline.
    //
    audioElement = new Audio();
    try {
        audioContext = new AudioContext({ sampleRate: 48000 });
    } catch (e) {
        console.log('Web Audio API is not supported by this browser.');
        return;
    }
    console.log("Audio callback latency (samples):", audioContext.sampleRate * audioContext.baseLatency);

    if (hifiOptions.enableMetadata) {
        if (encodedTransformSupported) {
            worker = new Worker('worker.js');
            worker.onmessage = event => sourceMetadata(event.data.metadata, event.data.uid);
        }
    }

    await audioContext.audioWorklet.addModule(simdSupported ? 'hifi.wasm.simd.js' : 'hifi.wasm.js');

    // temporary license token that expires 1/1/2023
    const token = 'aGlmaQAAAAHLuJ9igD2xY0xxPKza+Rcw9gQGOo8T5k+/HJpF/UR1k99pVS6n6QfyWTz1PTHkpt62tta3jn0Ntbdx73ah/LBv14T1HjJULQE=';
    let hifiLicense = new AudioWorkletNode(audioContext, 'wasm-license');
    hifiLicense.port.postMessage(token);

    hifiListener = new AudioWorkletNode(audioContext, 'wasm-hrtf-output', {outputChannelCount : [2]});
    hifiLimiter = new AudioWorkletNode(audioContext, 'wasm-limiter', {outputChannelCount : [2]});
    hifiListener.connect(hifiLimiter);

    if (isAecEnabled() && isChrome) {
        startEchoCancellation(audioElement, audioContext);
    } else {
        hifiLimiter.connect(audioContext.destination);
    }

    audioElement.play();
}


// export function playAudio() {
//     console.log("QQQQ B calling audioElement.play()...");
//     var playPromise = audioElement.play();
//     if (playPromise !== undefined) {
//         playPromise.catch(error => {
//             console.log("QQQQ audioElement.play() failed.");
//             // Auto-play was prevented
//             // Show a UI element to let the user manually start playback
//         }).then(() => {
//             console.log("QQQQ audioElement.play() succeeded.");
//             // Auto-play started
//         });
//     }
// }


function stopSpatialAudio() {
    console.log("hifi-audio: stopSpatialAudio()");

    stopEchoCancellation();

    audioContext.close();
    audioContext = undefined;

    worker && worker.terminate();
    worker = undefined;
}

export async function playSoundEffect(buffer : ArrayBuffer, loop : boolean) : Promise<AudioBufferSourceNode> {
    console.log("hifi-audio: playSoundEffect()");

    let audioBuffer : AudioBuffer = await audioContext.decodeAudioData(buffer);
    let sourceNode = new AudioBufferSourceNode(audioContext);
    sourceNode.buffer = audioBuffer;
    sourceNode.loop = loop;
    sourceNode.connect(hifiLimiter);
    sourceNode.start();
    return sourceNode;
}


export async function playSoundEffectFromURL(url : string, loop : boolean) : Promise<AudioBufferSourceNode> {
    console.log("hifi-audio: playSoundEffectFromURL()");

    let audioData = await fetch(url);
    let buffer = await audioData.arrayBuffer();
    let audioBuffer : AudioBuffer = await audioContext.decodeAudioData(buffer);
    let sourceNode = new AudioBufferSourceNode(audioContext);
    sourceNode.buffer = audioBuffer;
    sourceNode.loop = loop;
    sourceNode.connect(hifiLimiter);
    sourceNode.start();
    return sourceNode;
}

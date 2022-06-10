
import type { IAgoraRTC, IAgoraRTCClient, UID, IMicrophoneAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
interface IAgoraRTCOpen extends IAgoraRTC {
    setParameter? : any | undefined
}
declare const AgoraRTC: IAgoraRTCOpen;

import { checkSupported } from './check-supported.js';
let [ simdSupported, encodedTransformSupported, isChrome ] = checkSupported();

import { patchRTCPeerConnection } from './patchRTCPeerConnection.js';
let _RTCPeerConnection = RTCPeerConnection;
patchRTCPeerConnection(_RTCPeerConnection);

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
    audioTrack: IMicrophoneAudioTrackOpen
}


let loopback : RTCPeerConnection[];

// create Agora client
let client : IAgoraRTCClientOpen;

let localTracks : LocalTracks = {
    //videoTrack: null,
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


// Agora client hifiOptions
interface HifiOptions {
    appid?: string | undefined,
    channel?: string | undefined,
    tokenProvider?: Function | undefined,
    uid?: UID | undefined,
    thresholdValue?: number | undefined
    thresholdSet?: boolean | undefined
}
let hifiOptions : HifiOptions = {};


export function sendBroadcastMessage(msg : Uint8Array) : boolean {
    console.log("hifi-audio: send broadcast message");
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
        if (worker) {
            worker.postMessage({
                operation: 'metadata',
                metadata: data.buffer
            }, [data.buffer]);
        }
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
        setPosition(hifiSource);
    }

    if (onUpdateRemotePosition) {
        onUpdateRemotePosition("" + uid, x, y, o);
    }
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
            await joinAgoraRoom();
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

function setPosition(hifiSource : AudioWorkletNodeMeta) {
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
    listenerMetadata(hifiPosition);
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
                           initialThresholdValue : number) {

    console.log("hifi-audio: join -- initialThresholdValue=" + initialThresholdValue);

    hifiOptions.appid = appID;
    hifiOptions.tokenProvider = tokenProvider;
    hifiOptions.channel = channel;
    if (!hifiOptions.thresholdSet) {
        hifiOptions.thresholdValue = initialThresholdValue;
        hifiOptions.thresholdSet = true;
    }
    hifiOptions.uid = (Math.random()*4294967296)>>>0;

    if (initialPosition) {
        hifiPosition.x = initialPosition.x;
        hifiPosition.y = initialPosition.y;
        hifiPosition.o = initialPosition.o;
    }

    return await joinAgoraRoom();
}


async function joinAgoraRoom() {

    await startSpatialAudio();

    // add event listener to play remote tracks when remote user publishs.

    client = AgoraRTC.createClient({
        mode: "rtc",
        codec: "vp8"
    });

    client.on("user-published", (user : IAgoraRTCRemoteUser, mediaType : string) => {
        handleUserPublished(user, mediaType);
    });

    client.on("user-unpublished", (user : IAgoraRTCRemoteUser) => {
        handleUserUnpublished(user);
    });

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

    // join a channel
    await client.join(hifiOptions.appid, hifiOptions.channel, token || null, hifiOptions.uid);

    // create local tracks
    let audioConfig = {
        AEC: aecEnabled,
        AGC: false,
        ANS: false,
        bypassWebAudio: true,
        encoderConfig: {
            sampleRate: 48000,
            bitrate: 64,
            stereo: false,
        },
    };
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack(audioConfig);

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

    if (encodedTransformSupported) {

        sender.transform = new RTCRtpScriptTransform(worker, { operation: 'sender' });

    } else {

        const senderStreams = sender.createEncodedStreams();
        const readableStream = senderStreams.readable;
        const writableStream = senderStreams.writable;
        senderTransform(readableStream, writableStream);
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

    // on broadcast from remote user, set corresponding username
    client.on("stream-message", (uid : UID, data : Uint8Array) => {
        if (onReceiveBroadcast) {
            onReceiveBroadcast("" + uid, data);
        }
    });

    return hifiOptions.uid;
}


export async function leave() {

    console.log("hifi-audio: leave()");

    if (localTracks.audioTrack) {
        localTracks.audioTrack.stop();
        localTracks.audioTrack.close();
        localTracks.audioTrack = undefined;
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
    remoteUsers[id] = user;
    subscribe(user, mediaType);
}

function handleUserUnpublished(user : IAgoraRTCRemoteUser) {
    const uid = user.uid;
    delete remoteUsers[uid];
    if (onRemoteUserLeft) {
        onRemoteUserLeft("" + uid);
    }
    unsubscribe(user);
}

async function subscribe(user : IAgoraRTCRemoteUser, mediaType : string) {
    const uid = user.uid;

    if (mediaType === 'audio') {

        // subscribe to a remote user
        await client.subscribe(user, mediaType);
        console.log("subscribe uid:", uid);

        //user.audioTrack.play();

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

        if (encodedTransformSupported) {

            receiver.transform = new RTCRtpScriptTransform(worker, { operation: 'receiver', uid });

        } else {

            const receiverStreams = receiver.createEncodedStreams();
            const readableStream = receiverStreams.readable;
            const writableStream = receiverStreams.writable;
            receiverTransform(readableStream, writableStream, uid, sourceMetadata);
        }

        if (onRemoteUserJoined) {
            onRemoteUserJoined("" + uid);
        }
    }
}

async function unsubscribe(user: IAgoraRTCRemoteUser) {
    const uid = user.uid;

    delete hifiSources[uid];

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
    console.log("hifi-audio: startSpatialAudio()");

    audioElement = new Audio();

    if (encodedTransformSupported) {
        worker = new Worker('worker.js');
        worker.onmessage = event => sourceMetadata(event.data.metadata, event.data.uid);
    }

    try {
        audioContext = new AudioContext({ sampleRate: 48000 });
    } catch (e) {
        console.log('Web Audio API is not supported by this browser.');
        return;
    }

    console.log("Audio callback latency (samples):", audioContext.sampleRate * audioContext.baseLatency);

    await audioContext.audioWorklet.addModule(simdSupported ? 'HifiProcessorSIMD.js' : 'HifiProcessor.js');

    hifiListener = new AudioWorkletNode(audioContext, 'wasm-hrtf-output', {outputChannelCount : [2]});
    hifiLimiter = new AudioWorkletNode(audioContext, 'wasm-limiter');
    hifiListener.connect(hifiLimiter);

    if (isAecEnabled() && isChrome) {
        startEchoCancellation(audioElement, audioContext);
    } else {
        hifiLimiter.connect(audioContext.destination);
    }

    audioElement.play();
}

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


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


interface AgoraClientOptions {
    appid?: string | undefined,
    channel?: string | undefined,
    token?: string | undefined,
    uid?: UID | undefined
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



// create Agora client
let client : IAgoraRTCClientOpen = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8"
});

let localTracks  : LocalTracks = {
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

let hifiSources : Map<UID, AudioWorkletNodeMeta> = new Map<UID, AudioWorkletNodeMeta>();
let hifiNoiseGate  : AudioWorkletNode;  // mic stream connects here
let hifiListener : AudioWorkletNodeMeta;   // hifiSource connects here
let hifiLimiter : AudioWorkletNode;    // additional sounds connect here

let audioElement : HTMLAudioElement;
let audioContext : AudioContext;

let hifiPosition = { x: 0.0, y: 0.0, o: 0.0 };


// Agora client agoraOptions
interface AgoraClientOptions {
    appid?: string | undefined,
    channel?: string | undefined,
    token?: string | undefined,
    thresholdValue?: number | undefined
}
let agoraOptions : AgoraClientOptions = {
    appid: null,
    channel: null,
    token: null
};



const METADATA_BYTES = 5;
var metadata : ArrayBuffer = new Uint8Array(METADATA_BYTES);

export function senderTransform(readableStream : ReadableStream, writableStream : WritableStream) {
    const transformStream = new TransformStream({
        start: () => { console.log('%cworker set sender transform', 'color:yellow'); },
        transform: (encodedFrame, controller) => {

            let src = new Uint8Array(encodedFrame.data);
            let len = encodedFrame.data.byteLength;

            // create dst buffer with METADATA_BYTES extra bytes
            let dst = new Uint8Array(len + METADATA_BYTES);

            // copy src data
            for (let i = 0; i < len; ++i) {
                dst[i] = src[i];
            }

            // insert metadata at the end
            let data = new Uint8Array(metadata);
            for (let i = 0; i < METADATA_BYTES; ++i) {
                dst[len + i] = data[i];
            }

            encodedFrame.data = dst.buffer;
            controller.enqueue(encodedFrame);
        },
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
}

export function receiverTransform(readableStream : ReadableStream, writableStream : WritableStream, uid : UID) {
    const transformStream : TransformStreamWithID = new TransformStream({
        start: () => { console.log('%cworker set receiver transform for uid:', 'color:yellow', uid); },
        transform: (encodedFrame, controller) => {

            let src = new Uint8Array(encodedFrame.data);
            let len = encodedFrame.data.byteLength - METADATA_BYTES;

            // create dst buffer with METADATA_BYTES fewer bytes
            let dst = new Uint8Array(len);

            // copy src data
            for (let i = 0; i < len; ++i) {
                dst[i] = src[i];
            }

            // extract metadata at the end
            let data = new Uint8Array(METADATA_BYTES);
            for (let i = 0; i < METADATA_BYTES; ++i) {
                data[i] = src[len + i];
            }

            sourceMetadata(data.buffer, uid);

            encodedFrame.data = dst.buffer;
            controller.enqueue(encodedFrame);
        },
    });
    transformStream.uid = uid;
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
}


export function sendBroadcastMessage(msg : Uint8Array) : boolean {
    if (localTracks.audioTrack) {
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
        metadata = data.buffer;
    }
}

function sourceMetadata(buffer : /* Uint8Array */ ArrayBuffer, uid : UID) : void {
    let data = new DataView(buffer);

    let x = data.getInt16(0) * (1/256.0);
    let y = data.getInt16(2) * (1/256.0);
    let o = data.getInt8(4) * (Math.PI / 128.0);

    // update hifiSource position
    let hifiSource = hifiSources.get(uid);
    if (hifiSource !== undefined) {
        hifiSource._x = x;
        hifiSource._y = y;
        hifiSource._o = o;
        setPosition(hifiSource);
    }

    onUpdateRemotePosition("" + uid, x, y, o);
}


function setThreshold(value : number) {
    agoraOptions.thresholdValue = value;
    if (hifiNoiseGate !== undefined) {
        hifiNoiseGate.parameters.get('threshold').value = value;
        console.log('set noisegate threshold to', value, 'dB');
    }
}


let aecEnabled = false;
function isAecEnabled() : boolean {
    return aecEnabled;
}
async function setAecEnabled(v : boolean) : Promise<string> {
    if (aecEnabled != v) {
        aecEnabled = v;
        if (localTracks.audioTrack) {
            await leave();
            await joinAgoraRoom();
        }
    }
    return "" + agoraOptions.uid;
}


let muteEnabled = false;
function isMutedEnabled() : boolean {
    return muteEnabled;
}
function setMutedEnabled(v : boolean) {
    muteEnabled = v;
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



export async function join(appID : string,
                           channel : string,
                           initialPosition : MetaData,
                           initialThresholdValue : number,
                           setUpdateRemotePosition : Function,
                           setReceiveBroadcast : Function,
                           setUpdateVolumeIndicator : Function,
                           setOnUserPublished : Function,
                           setOnUserUnpublished : Function) {

    agoraOptions.appid = appID;
    agoraOptions.channel = channel;
    agoraOptions.thresholdValue = initialThresholdValue;

    if (initialPosition) {
        hifiPosition.x = initialPosition.x;
        hifiPosition.y = initialPosition.y;
        hifiPosition.o = initialPosition.o;
    }

    onUpdateRemotePosition = setUpdateRemotePosition;
    onReceiveBroadcast = setReceiveBroadcast;
    onUpdateVolumeIndicator = setUpdateVolumeIndicator;
    onRemoteUserJoined = setOnUserPublished;
    onRemoteUserLeft = setOnUserUnpublished;

    return await joinAgoraRoom();
}


async function joinAgoraRoom() {

    await startSpatialAudio();

    // add event listener to play remote tracks when remote user publishs.

    client.on("user-published", (user : IAgoraRTCRemoteUser, mediaType : string) => {
        handleUserPublished(user, mediaType);
    });

    client.on("user-unpublished", (user : IAgoraRTCRemoteUser) => {
        handleUserUnpublished(user);
    });

    // join a channel
    agoraOptions.uid = await client.join(agoraOptions.appid, agoraOptions.channel, agoraOptions.token || null);

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
    setThreshold(muteEnabled ? 0.0 : agoraOptions.thresholdValue);

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
        volumes.forEach((volume, index) => {
            onUpdateVolumeIndicator("" + volume.uid, volume.level);
        });
    })

    // on broadcast from remote user, set corresponding username
    client.on("stream-message", (uid : UID, data : Uint8Array) => {
        onReceiveBroadcast("" + uid, data);
    });

    return agoraOptions.uid;
}


async function leave() {

    if (this.localTracks.audioTrack) {
        this.localTracks.audioTrack.stop();
        this.localTracks.audioTrack.close();
        this.localTracks.audioTrack = undefined;
    }

    // leave the channel
    await client.leave();

    hifiSources.clear();
    stopSpatialAudio();

    console.log("client leaves channel success");
}

function handleUserPublished(user : IAgoraRTCRemoteUser, mediaType : string) {
    const id = user.uid;
    remoteUsers[id] = user;
    subscribe(user, mediaType);
}

function handleUserUnpublished(user : IAgoraRTCRemoteUser) {
    const uid = user.uid;
    delete remoteUsers[uid];
    onRemoteUserLeft("" + uid);
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
        hifiSources.set(uid, hifiSource);

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
            receiverTransform(readableStream, writableStream, uid);
        }

        onRemoteUserJoined("" + uid);
    }
}

async function unsubscribe(user: IAgoraRTCRemoteUser) {
    const uid = user.uid;

    hifiSources.delete(uid);

    console.log("unsubscribe uid:", uid);
}

//
// Chrome (as of M100) cannot perform echo cancellation of the Web Audio output.
// As a workaround, a loopback configuration of local peer connections is inserted at the end of the pipeline.
// This should be removed when Chrome implements browser-wide echo cancellation.
// https://bugs.chromium.org/p/chromium/issues/detail?id=687574#c60
//
let loopback : RTCPeerConnection[];
async function startEchoCancellation(element : HTMLAudioElement, context : AudioContext) {

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
    loopback && loopback.forEach(pc => pc.close());
    loopback = null;
    console.log('Stopped AEC.')
}

async function startSpatialAudio() {

    audioElement = new Audio();

    if (encodedTransformSupported) {
        worker = new Worker('worker.js');
        worker.onmessage = (event) => {
            sourceMetadata(event.data.metadata, event.data.uid);
        }
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

    if (isAecEnabled && isChrome) {
        startEchoCancellation(audioElement, audioContext);
    } else {
        hifiLimiter.connect(audioContext.destination);
    }

    audioElement.play();
}

function stopSpatialAudio() {
    stopEchoCancellation();
    audioContext.close();
    worker && worker.terminate();
}

let audioBuffer : AudioBuffer = null;
async function playSoundEffect() {

    // load on first play
    if (!audioBuffer) {
        let response = await fetch('https://raw.githubusercontent.com/kencooke/spatial-audio-room/master/sound.wav');
        let buffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(buffer);
    }

    let sourceNode = new AudioBufferSourceNode(audioContext);
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(hifiLimiter);
    sourceNode.start();
}

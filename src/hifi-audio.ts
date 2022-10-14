
import { RemoteSource, TransportManager, MicrophoneConfig, CameraConfig, LocalTrack } from "./hifi-transport.js";


/** @ignore */
export declare class RTCRtpScriptTransform {
    constructor(worker : Worker, options : any);
};


// RTC with insertable stream support
/** @ignore */
export interface RTCRtpSenderIS extends RTCRtpSender {
    createEncodedStreams? : Function,
    transform? : RTCRtpScriptTransform
}
/** @ignore */
export interface RTCRtpReceiverIS extends RTCRtpReceiver {
    createEncodedStreams? : Function,
    transform? : RTCRtpScriptTransform
}


import { checkSupported } from "./check-supported.js";
import { fastAtan2 } from "./fast-atan2.js"
let [ simdSupported, encodedTransformSupported, browserIsChrome ] = checkSupported();

let webAudioPeakMeter = require("web-audio-peak-meter");

import { patchRTCPeerConnection } from "./patchRTCPeerConnection.js";
let _RTCPeerConnection = RTCPeerConnection;
patchRTCPeerConnection(_RTCPeerConnection);

let _RTCPeerConnectionWithMetadata = RTCPeerConnection;
let _RTCPeerConnectionWithoutMetadata = _RTCPeerConnection;

import { metadata, senderTransform, receiverTransform } from "./transform.js";


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


interface LocalTracks {
    videoTrack?: LocalTrack,
    audioTrack: LocalTrack
}


let loopback : RTCPeerConnection[];

let client : TransportManager;

let localTracks : LocalTracks = {
    // videoTrack: null,
    audioTrack: null
};


let onUpdateRemotePosition : any;
let onReceiveBroadcast : any;
let onUpdateVolumeIndicator : any;
let onRemoteUserJoined : any;
let onRemoteUserLeft : any;

let remoteUsers : { [uid: string] : RemoteSource; } = {};
let worker : Worker = undefined;

let hifiSources: { [name: string]: AudioWorkletNodeMeta } = {};
let hifiNoiseGate  : AudioWorkletNode;  // mic stream connects here
let hifiListener : AudioWorkletNodeMeta;   // hifiSource connects here
let hifiLimiter : AudioWorkletNode;    // additional sounds connect here

let audioElement : HTMLAudioElement;
let audioContext : AudioContext;

let hifiPosition = { x: 0.0, y: 0.0, o: 0.0 };

let subscribedToAudio : { [uid: string] : boolean; } = {};
let subscribedToVideo : { [uid: string] : boolean; } = {};


interface HifiOptions {
    channel?: string | undefined,
    uid?: string | undefined,
    thresholdValue?: number | undefined,
    thresholdSet?: boolean | undefined,
    enableVideo? : boolean | undefined,
    enableMetadata? : boolean | undefined
}
let hifiOptions : HifiOptions = {};


function installSenderTransform(sender : RTCRtpSenderIS) {
    //
    // Insertable Streams / Encoded Transform
    //
    if (!sender) return;
    if (encodedTransformSupported) {
        // Encoded Transform
        sender.transform = new RTCRtpScriptTransform(worker, { operation: 'sender' });

    } else {
        // Insertable Streams
        const senderStreams = sender.createEncodedStreams();
        const readableStream = senderStreams.readable;
        const writableStream = senderStreams.writable;
        senderTransform(readableStream, writableStream);
    }
}

function installReceiverTransform(receiver : RTCRtpReceiverIS, uid : string) {
    //
    // Insertable Streams / Encoded Transform
    //
    if (encodedTransformSupported) {
        // Encoded Transform
        receiver.transform = new RTCRtpScriptTransform(worker, { operation: 'receiver', uid });

    } else {
        // Insertable Streams
        const receiverStreams = receiver.createEncodedStreams();
        const readableStream = receiverStreams.readable;
        const writableStream = receiverStreams.writable;
        receiverTransform(readableStream, writableStream, uid, sourceMetadata);
    }
}


/**
   Send a message to all the remote listeners which are connected to the current room.  They can receive the message by hooking the "broadcast-received" callback.
   @param msg - Binary data to transmit to all remote listeners.
*/
export function sendBroadcastMessage(msg : Uint8Array) : boolean {

    var msgString = new TextDecoder().decode(msg);
    console.log("hifi-audio: send broadcast message: " + JSON.stringify(msgString));

    if (client && localTracks.audioTrack) {
        client.sendBroadcastMessage(msg);
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

function sourceMetadata(buffer : ArrayBuffer, uid : string) : void {
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


/**
   Return true if the browser is based on chromium
*/
export function isChrome() {
    return browserIsChrome;
}


let aecEnabled = false;
/**
   Return true if audio-echo-cancelation is enabled.
*/
export function isAecEnabled() : boolean {
    return aecEnabled;
}
/**
   Enable or Disable AEC.
   @param v - Enable audio-echo-cancelation `true`, else disable it.
*/
export async function setAecEnabled(v : boolean) : Promise<string> {
    console.log("hifi-audio: setAecEnabled(" + v + ")");

    if (aecEnabled != v) {
        aecEnabled = v;
        if (localTracks.audioTrack) {
            await client.rejoin();
        }
    }
    return "" + hifiOptions.uid;
}


let muteEnabled = false;
/**
   Return true if the local source is muted (audio isn't being sent from the local source to remote listeners).
*/
export function isMutedEnabled() : boolean {
    return muteEnabled;
}
/**
   Control muting of the local source.
   @param v - Mute the local source if `true`, else unmute it.
*/
export function setMutedEnabled(v : boolean) {
    console.log("hifi-audio: setMutedEnabled(" + v + "), thresholdValue=" + hifiOptions.thresholdValue);

    muteEnabled = v;
    if (hifiNoiseGate !== undefined) {
        hifiNoiseGate.parameters.get('threshold').value = muteEnabled ? 0.0 : hifiOptions.thresholdValue;
    }
}

/**
   Set the noise-gate's cut-off level.
   @param value - A negative value between -80 and 0 which indicates a minimum decible level for the noise-gate to stop suppressing audio.
*/
export function setThreshold(value : number) {
    console.log("hifi-audio: setThreshold(" + value + ")");

    hifiOptions.thresholdValue = value;
    hifiOptions.thresholdSet = true;
    setMutedEnabled(muteEnabled);
}
/**
   Return the current noise-gate cutoff level in decibels.
*/
export function getThreshold() {
    return hifiOptions.thresholdValue;
}


function angleWrap(angle : number) {
    return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
}


/**
   Set the direction from which the local listener will perceive a remote source.
   @param uid - the ID of a remote source.
   @param - An angle in radians from which a remote source's audio will seem to arrive.
*/
export function setSourceAzimuth(uid : string, azimuth : number) {
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


/**
   Set the position of the local audio source.  If `join` was called with `enableMetadata`=`true`, this position will be encoded and sent along with the local source's audio.  Remote listeners will receive the position and can update their world-view.
   @param e - The new position for the local source, to be transmitted to remote listeners.
*/
export function setPosition(e : MetaData) : void {
    hifiPosition.x = e.x;
    hifiPosition.y = e.y;
    hifiPosition.o = e.o;
    if (hifiOptions.enableMetadata) {
        listenerMetadata(hifiPosition);
    }
}


/**
   Connect an app's callback function to a named event hook.  The named hooks are:
   - remote-position-updated - (uid : string, x : number, y : number, o : number) => void -- A remote source has moved.
   - broadcast-received - (uid : string, data : Uint8Array) => void -- receive the data that a remote source sent with `sendBroadcastMessage`
   - remote-volume-updated - (uid : string, level : number) => void -- The current momentary loudness of remote source is updated.  `level` is a number which will be larger when the other client is louder.
   - remote-client-joined - (uid : string) => void -- A new remote source has joined the room.
   - remote-client-left - (uid : string) -- A remote source has left the room.

*/
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


/**
   Use the provided TransportManager to join a room.  Returns a promise for the ID of the local source (which will be the same as the `uid` parameter, unless it was null).
   @param transport - An instantiation of a TransportManager.
   @param uid - The unique ID to use for the local source.
   @param channel - The name of the room to join.  This is interpretted by the specific TransportManager.
   @param initialPosition - Where to locate this local source in the virtual space of the room. `x` and `y` are in meters, `o` is in radians.
   @param initialThresholdValue - The initial setting for the noise-gate.  The value should be in decibels in the range -80 to 0.
   @param enableVideo - `true` if video from the local camera should be sent to the room.
   @param enableMetadata - `true` if the local source's position in the virtual space should be sent along with its audio stream.
*/
export async function join(transport : TransportManager,
                           uid : string,
                           channel : string,
                           initialPosition : MetaData,
                           initialThresholdValue : number,
                           enableVideo : boolean,
                           enableMetadata : boolean) {

    client = transport;

    hifiOptions.uid = uid;
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
    hifiOptions.enableVideo = enableVideo;
    hifiOptions.enableMetadata = enableMetadata;

    if (enableMetadata) {
        RTCPeerConnection = _RTCPeerConnectionWithMetadata;
    } else {
        RTCPeerConnection = _RTCPeerConnectionWithoutMetadata;
    }

    return await joinTransportRoom();
}


async function joinTransportRoom() {

    await startSpatialAudio();

    client.on("user-published", (user : RemoteSource, mediaType : string) => { handleUserPublished(user, mediaType); });
    client.on("user-unpublished", (user : RemoteSource) => { handleUserUnpublished(user); });

    let audioConfig : MicrophoneConfig = {
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

    if (hifiOptions.enableVideo) {
        let videoConfig : CameraConfig = {
            encoderConfig: "240p_1"
        };

        // Join a channel and create local tracks. Best practice is to use Promise.all and run them concurrently.
        [hifiOptions.uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
            client.join(hifiOptions.channel, hifiOptions.uid),
            client.createMicrophoneAudioTrack(audioConfig),
            client.createCameraVideoTrack(videoConfig)
        ]);

    } else {
        delete localTracks.videoTrack;

        [hifiOptions.uid, localTracks.audioTrack] = await Promise.all([
            client.join(hifiOptions.channel, hifiOptions.uid),
            client.createMicrophoneAudioTrack(audioConfig)
        ]);
    }

    audioElement.play();

    //
    // route mic stream through Web Audio noise gate
    //
    let mediaStreamTrack = localTracks.audioTrack.getMediaStreamTrack();
    let mediaStream = new MediaStream([mediaStreamTrack]);

    let sourceNode = audioContext.createMediaStreamSource(mediaStream);
    let destinationNode = audioContext.createMediaStreamDestination();

    var myMeterElement = document.getElementById('my-peak-meter');
    var meterNode = webAudioPeakMeter.createMeterNode(sourceNode, audioContext);
    webAudioPeakMeter.createMeter(myMeterElement, meterNode, {});

    hifiNoiseGate = new AudioWorkletNode(audioContext, 'wasm-noise-gate');
    console.log("hifi-audio: setting initial threshold to " + hifiOptions.thresholdValue);
    setThreshold(hifiOptions.thresholdValue);

    sourceNode.connect(hifiNoiseGate).connect(destinationNode);

    let destinationTrack = destinationNode.stream.getAudioTracks()[0];
    localTracks.audioTrack.replaceMediaStreamTrack(destinationTrack);

    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");

    if (hifiOptions.enableMetadata) {
        installSenderTransform(client.getSharedAudioSender());
    }

    // handle broadcast from remote user
    client.on("broadcast-received", (uid : string, data : Uint8Array) => {
        if (onReceiveBroadcast) {
            onReceiveBroadcast("" + uid, data);
        }
    });

    client.on("volume-level-change", (uid : string, level : number) => {
        if (onUpdateVolumeIndicator) {
            onUpdateVolumeIndicator(uid, level);
        }
    });

    return "" + hifiOptions.uid;
}


/**
   Leave a previously joined room.
   @param willRestart - If `true`, don't destroy the audio-context.  This can be used to avoid requiring a new "gesture" from the user while starting new audio.
*/
export async function leave(willRestart : boolean) {

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

    // leave the channel
    await client.leave();

    hifiSources = {};
    hifiNoiseGate = undefined;
    hifiListener = undefined;
    hifiLimiter = undefined;
    // audioElement = undefined;
    loopback = [];

    stopSpatialAudio(willRestart);
    client = undefined;

    for (var uid in remoteUsers) {
        if (onRemoteUserLeft) {
            onRemoteUserLeft("" + uid);
        }
        delete subscribedToAudio[ "" + uid ];
        delete subscribedToVideo[ "" + uid ];
    }

    remoteUsers = {};
}

function handleUserPublished(user : RemoteSource, mediaType : string) {

    if (hifiOptions.enableMetadata) {
        installSenderTransform(user.getAudioSender());
    }

    const id = user.uid;
    remoteUsers["" + id] = user;

    subscribe(user, mediaType);
}

function handleUserUnpublished(user : RemoteSource) {
    const uid = user.uid;
    delete remoteUsers["" + uid];
    if (onRemoteUserLeft) {
        onRemoteUserLeft("" + uid);
    }
    unsubscribe(user);
}

async function subscribe(user : RemoteSource, mediaType : string) {
    const uid = user.uid;

    if (mediaType === 'audio') {

        // subscribe to a remote user
        await client.subscribe(user, mediaType);
        console.log("subscribe uid:", uid);

        subscribedToAudio[ "" + uid ] = true;

        // sourceNode for WebRTC track
        let remoteTrack = user.getAudioTrack();
        let mediaStream = new MediaStream([remoteTrack.getMediaStreamTrack()]);
        let sourceNode = audioContext.createMediaStreamSource(mediaStream);

        // connect to new hifiSource
        let hifiSource = new AudioWorkletNode(audioContext, 'wasm-hrtf-input');
        hifiSources[uid] = hifiSource;
        sourceNode.connect(hifiSource).connect(hifiListener);

        // XXX
        {
            let ae : HTMLAudioElement = new Audio();
            ae.srcObject = mediaStream;
            ae.muted = true;
        }

        if (hifiOptions.enableMetadata) {
            installReceiverTransform(user.getAudioReceiver(), uid);
        }
    }

    if (mediaType === 'video') {

        // subscribe to a remote user
        await client.subscribe(user, mediaType);
        console.log("subscribe uid:", uid);

        subscribedToVideo[ "" + uid ] = true;
    }

    if (hifiOptions.enableVideo && subscribedToAudio[ "" + uid ] && subscribedToVideo[ "" + uid ]) {
        onRemoteUserJoined("" + uid);
    }
    if (!hifiOptions.enableVideo && subscribedToAudio[ "" + uid ]) {
        onRemoteUserJoined("" + uid);
    }
}


/** @ignore */
export async function playVideo(uid : string, videoEltID : string) {
    if (uid == hifiOptions.uid) {
        await localTracks.videoTrack.play(videoEltID);
    } else {
        let user = remoteUsers[ "" + uid ];
        if (user.getVideoTrack()) {
            await user.getVideoTrack().play(videoEltID);
        }
    }
}


async function unsubscribe(user: RemoteSource) {
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

    // audioElement and audioContext are created immediately after a user gesture,
    // to prevent Safari auto-play policy from breaking the audio pipeline.

    if (!audioElement) audioElement = new Audio();
    if (!audioContext) audioContext = new AudioContext({ sampleRate: 48000 });

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

    if (isAecEnabled() && isChrome()) {
        startEchoCancellation(audioElement, audioContext);
    } else {
        hifiLimiter.connect(audioContext.destination);
    }
}


function stopSpatialAudio(willRestart : boolean) {
    console.log("hifi-audio: stopSpatialAudio()");

    stopEchoCancellation();

    audioContext.close();
    audioContext = undefined;

    if (willRestart) audioContext = new AudioContext({ sampleRate: 48000 });

    worker && worker.terminate();
    worker = undefined;
}

/** @ignore */
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


/** @ignore */
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

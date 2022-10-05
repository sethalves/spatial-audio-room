

import { checkSupported } from './check-supported.js';
import { fastAtan2 } from './fast-atan2.js'
let [ simdSupported, encodedTransformSupported, browserIsChrome ] = checkSupported();

let webAudioPeakMeter = require('web-audio-peak-meter');

import { patchRTCPeerConnection } from './patchRTCPeerConnection.js';
let _RTCPeerConnection = RTCPeerConnection;
patchRTCPeerConnection(_RTCPeerConnection);

let _RTCPeerConnectionWithMetadata = RTCPeerConnection;
let _RTCPeerConnectionWithoutMetadata = _RTCPeerConnection;

const debugRTC = false;

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


// interface RTCConfiguration {
//     iceServers?: RTCIceServer[] | undefined;
//     iceTransportPolicy?: RTCIceTransportPolicy | undefined; // default = 'all'
//     bundlePolicy?: RTCBundlePolicy | undefined; // default = 'balanced'
//     rtcpMuxPolicy?: RTCRtcpMuxPolicy | undefined; // default = 'require'
//     peerIdentity?: string | undefined; // default = null
//     certificates?: RTCCertificate[] | undefined;
//     iceCandidatePoolSize?: number | undefined; // default = 0
//     encodedInsertableStreams?: boolean | undefined;
// }

// interface RTCRtpScriptTransformer {
//     readable : ReadableStream;
//     writable : WritableStream;
//     options : any;
//     generateKeyFrame : Function; // (optional sequence <DOMString> rids) : Promise<undefined>;
//     sendKeyFrameRequest : Function; // () : Promise<undefined> ();
// };

declare class RTCRtpScriptTransform {
    constructor(worker : Worker, options : any);
};


// RTC with insertable stream support
interface RTCRtpSenderIS extends RTCRtpSender {
    createEncodedStreams? : Function,
    transform? : RTCRtpScriptTransform
}
interface RTCRtpReceiverIS extends RTCRtpReceiver {
    createEncodedStreams? : Function,
    transform? : RTCRtpScriptTransform
}

interface LocalTracks {
    videoTrack?: MediaStream,
    audioTrack: MediaStream
}

let loopback : RTCPeerConnection[];

let localTracks : LocalTracks = {
    // videoTrack: null,
    audioTrack: null
};

interface RTCRemoteUser {
    uid: string
    contacted: boolean;
    peerConnection: RTCPeerConnection;
    toPeer : RTCDataChannel;
    fromPeer : (peerID : string, data : Uint8Array) => void;
    sdp : (sdpType: string, sdp: string /*RTCSessionDescriptionInit*/) => void;
    ice : (candidate: string, sdpMid: string, sdpMLineIndex: number) => void;
    doStop : boolean;
}

let webSocket : WebSocket;

let onUpdateRemotePosition : any;
let onReceiveBroadcast : any;
let onUpdateVolumeIndicator : any;
let onRemoteUserJoined : any;
let onRemoteUserLeft : any;

let remoteUsers : { [uid: string] : RTCRemoteUser; } = {};
let worker : Worker = undefined;

let hifiSources: { [name: string]: AudioWorkletNodeMeta } = {};
let hifiNoiseGate  : AudioWorkletNode;  // mic stream connects here
let hifiListener : AudioWorkletNodeMeta;   // hifiSource connects here
let hifiLimiter : AudioWorkletNode;    // additional sounds connect here

// let audioElement : HTMLAudioElement;
let audioContext : AudioContext;

let audioDestination : MediaStreamAudioDestinationNode;
// let audioDestination : MediaStream;


let hifiPosition = { x: 0.0, y: 0.0, o: 0.0 };

let subscribedToAudio : { [uid: string] : boolean; } = {};
let subscribedToVideo : { [uid: string] : boolean; } = {};


interface HifiOptions {
    appid?: string | undefined,
    channel?: string | undefined,
    tokenProvider?: string /* Function */ | undefined,
    uid?: string | undefined,
    thresholdValue?: number | undefined,
    thresholdSet?: boolean | undefined,
    video? : boolean | undefined,
    enableMetadata? : boolean | undefined
}
let hifiOptions : HifiOptions = {};



function installSenderTransform(remoteUser : RTCRemoteUser) {
    //
    // Insertable Streams / Encoded Transform
    //

    let senders : Array<RTCRtpSenderIS> = remoteUser.peerConnection.getSenders();
    let sender = senders.find(e => e.track?.kind === 'audio');

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

function installReceiverTransform(remoteUser : RTCRemoteUser, trackId : string, uid : string) {
    //
    // Insertable Streams / Encoded Transform
    //

    let receivers : Array<RTCRtpReceiverIS> = remoteUser.peerConnection.getReceivers();
    let receiver : RTCRtpReceiverIS = receivers.find(e => e.track?.id === trackId && e.track?.kind === 'audio');

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


export function sendBroadcastMessage(msg : Uint8Array) : boolean {

    var msgString = new TextDecoder().decode(msg);
    console.log("hifi-audio: send broadcast message: " + JSON.stringify(msgString));

    for (let uid in remoteUsers) {
        if (remoteUsers[ uid ].toPeer) {
            remoteUsers[ uid ].toPeer.send(msg);
        }
    }

    return true;
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

export function sourceMetadata(buffer : ArrayBuffer, uid : string) : void {
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
            await leave(true);
            // await joinAgoraRoom();
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


function angleWrap(angle : number) {
    return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
}


export function setAzimuth(uid : string, azimuth : number) {
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
                           uid : string,
                           tokenProvider : string /* Function */,
                           channel : string,
                           initialPosition : MetaData,
                           initialThresholdValue : number,
                           video : boolean,
                           enableMetadata : boolean) {

    hifiOptions.appid = appID;
    hifiOptions.uid = uid;
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

    let audioElement : HTMLAudioElement = new Audio();

    await startSpatialAudio(audioElement);

    // let destination = audioContext.createMediaStreamDestination();
    // hifiLimiter.connect(destination);
    // audioElement.srcObject = destination.stream;
    // audioElement.play();
    // audioElement.muted = true;

    localTracks.audioTrack = await navigator.mediaDevices.getUserMedia(
        {
            audio: {
                echoCancellation: true,
                autoGainControl: true,
                noiseSuppression: true,
                sampleRate: 48000,
                channelCount: { exact:1 }
            },
            video: video
        }
    );
    delete localTracks.videoTrack;


    {
        //
        // route mic stream through Web Audio noise gate
        //
        let mediaStreamTrack = localTracks.audioTrack.getAudioTracks()[0];
        let mediaStream = new MediaStream([mediaStreamTrack]);

        {
            let mts : MediaTrackSettings = mediaStreamTrack.getSettings();
            console.log("audioContext.sampleRate=" + audioContext.sampleRate +
                " mediaStream.sampleRate=" + mts.sampleRate);
        }

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
        // await localTracks.audioTrack._updateOriginMediaStreamTrack(destinationTrack, false);
        localTracks.audioTrack.removeTrack(mediaStreamTrack);
        localTracks.audioTrack.addTrack(destinationTrack);
    }

    let tokenURL = new URL(window.location.href)
    tokenURL.pathname = "/token-server";
    tokenURL.protocol = "wss";

    webSocket = new WebSocket(tokenURL.href);
    webSocket.onopen = async function (event) {
        webSocket.send(JSON.stringify({
            "message-type": "join-p2p-channel",
            "uid": "" + uid,
            "channel": channel
        }));
    }
    webSocket.onmessage = async function (event) {
        // console.log("got websocket message: ", event.data);
        let msg = JSON.parse(event.data);
        if (msg["message-type"] == "connect-with-peer") {
            let otherUID = msg["uid"];
            let remoteUser : RTCRemoteUser;
            if (remoteUsers[ otherUID ]) {
                remoteUser = remoteUsers[ otherUID ];
            } else {
                remoteUser = {
                    uid: otherUID,
                    contacted: false,
                    peerConnection: undefined,
                    toPeer : undefined,
                    fromPeer : (peerID : string, data : Uint8Array) => {
                        console.log("got data-channel data from peer");
                        if (onReceiveBroadcast) {
                            onReceiveBroadcast(otherUID, data);
                        }
                    },
                    sdp : undefined,
                    ice : undefined,
                    doStop : false
                };
                remoteUsers[ otherUID ] = remoteUser;
            }

            contactPeer(remoteUser,
                        async (peerID : string, event : RTCTrackEvent) => {
                            // on audio-track
                            console.log("XXXXX got stream");

                            // if (hifiOptions.enableMetadata) {
                            //     installSenderTransform(remoteUser);
                            // }

                            console.log("got audio track from peer, " + event.streams.length + " streams.");

                            subscribedToAudio[ "" + otherUID ] = true;

                            // sourceNode for WebRTC track
                            const mediaStreamTrack = event.track;
                            let mediaStream = new MediaStream([mediaStreamTrack]);
                            let sourceNode = audioContext.createMediaStreamSource(mediaStream);


                            // var myMeterElement = document.getElementById('my-peak-meter');
                            // var meterNode = webAudioPeakMeter.createMeterNode(sourceNode, audioContext);
                            // webAudioPeakMeter.createMeter(myMeterElement, meterNode, {});


                            // connect to new hifiSource
                            let hifiSource = new AudioWorkletNode(audioContext, 'wasm-hrtf-input');
                            hifiSources[remoteUser.uid] = hifiSource;
                            sourceNode.connect(hifiSource).connect(hifiListener);

                            // sourceNode.connect(hifiSource).connect(audioDestination);

                            audioElement.srcObject = mediaStream;
                            audioElement.muted = true;

                            if (hifiOptions.enableMetadata) {
                                installReceiverTransform(remoteUser, mediaStreamTrack.id, remoteUser.uid);
                            }

                            if (hifiOptions.video &&
                                subscribedToAudio[ "" + remoteUser.uid ] &&
                                subscribedToVideo[ "" + remoteUser.uid ]) {
                                onRemoteUserJoined("" + remoteUser.uid);
                            }
                            if (!hifiOptions.video && subscribedToAudio[ "" + remoteUser.uid ]) {
                                onRemoteUserJoined("" + remoteUser.uid);
                            }

                        },
                        (peerID : string, event : RTCDataChannelEvent) => {
                            // on data-channel
                            console.log("XXXXX got data-channel event");
                        });


            // this triggers negotiation-needed on the peer-connection
            // localTracks.audioTrack.getAudioTracks().forEach(track => {
            //     remoteUser.peerConnection.addTrack(track, localTracks.audioTrack);
            // });
            remoteUser.peerConnection.addTrack(localTracks.audioTrack.getAudioTracks()[ 0 ]);

            if (hifiOptions.enableMetadata) {
                installSenderTransform(remoteUser);
            }


        } else if (msg["message-type"] == "ice-candidate") {
            let fromUID = msg["from-uid"];
            if (remoteUsers[ fromUID ]) {
                remoteUsers[ fromUID ].ice(msg["candidate"], msg["sdpMid"], msg["sdpMLineIndex"]);
            } else {
                console.log("error -- got ice from unknown remote user:" + fromUID);
            }
        } else if (msg["message-type"] == "sdp") {
            let fromUID = msg["from-uid"];
            if (remoteUsers[ fromUID ]) {
                remoteUsers[ fromUID ].sdp(msg["offer"] ? "offer" : "answer", msg["sdp"]);
            } else {
                console.log("error -- git ice from unknown remote user:" + fromUID);
            }
        } else if (msg["message-type"] == "disconnect-from-peer") {
            let otherUID = msg["uid"];
            let remoteUser : RTCRemoteUser;
            delete remoteUsers[ otherUID ];
            if (onRemoteUserLeft) {
                onRemoteUserLeft("" + otherUID);
            }
            delete subscribedToAudio[ "" + otherUID ];
            delete subscribedToVideo[ "" + otherUID ];
        }
    }
}


export async function leave(willRestart : boolean) {

    if (webSocket) {
        webSocket.close();
    }

    let meter = document.getElementById('my-peak-meter');
    if (meter) {
        while (meter.firstChild) {
            meter.removeChild(meter.firstChild);
        }
    }


    console.log("hifi-audio: leave()");

    if (localTracks.audioTrack) {
        // localTracks.audioTrack.stop();
        // localTracks.audioTrack.close();
        localTracks.audioTrack = undefined;
    }

    if (localTracks.videoTrack) {
        // localTracks.videoTrack.stop();
        // localTracks.videoTrack.close();
        delete localTracks.videoTrack;
    }

    hifiSources = {};
    hifiNoiseGate = undefined;
    hifiListener = undefined;
    hifiLimiter = undefined;
    // audioElement = undefined;
    loopback = [];

    stopSpatialAudio(willRestart);

    for (let uid in remoteUsers) {
        if (onRemoteUserLeft) {
            onRemoteUserLeft("" + uid);
        }
        delete subscribedToAudio[ "" + uid ];
        delete subscribedToVideo[ "" + uid ];
    }

    remoteUsers = {};

    webSocket.close();
}


export async function playVideo(uid : string, videoEltID : string) {
    if (uid == hifiOptions.uid) {
        // await localTracks.videoTrack.play(videoEltID);
    } else {
        let user = remoteUsers[ "" + uid ];
        // if (user.videoTrack) {
        //     await user.videoTrack.play(videoEltID);
        // }
    }
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


async function startSpatialAudio(audioElement : HTMLAudioElement) {

    // audioElement and audioContext are created immediately after a user gesture,
    // to prevent Safari auto-play policy from breaking the audio pipeline.

    // if (!audioElement) audioElement = new Audio();
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
        console.log("XXXXXX is chrome + aec");
        startEchoCancellation(audioElement, audioContext);
    } else {
        console.log("XXXXXX not chrome + aec");

        hifiLimiter.connect(audioContext.destination);

        // if (!audioDestination) {
        //     audioDestination = audioContext.createMediaStreamDestination();
        //     // audioDestination = new MediaStream([hifiLimiter.stream]);
        // }
        // // hifiLimiter.connect(audioDestination);
        // audioElement.srcObject = audioDestination.stream;
        // audioElement.play();
    }
}


function stopSpatialAudio(willRestart : boolean) {
    console.log("hifi-audio: stopSpatialAudio()");

    stopEchoCancellation();

    if (audioContext) {
        audioContext.close();
    }
    audioContext = undefined;

    if (willRestart) audioContext = new AudioContext({ sampleRate: 48000 });

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


function forceBitrateUp(sdp: string) {
    // Need to format the SDP differently if the input is stereo, so
    // reach up into our owner's stream controller to find out.
    const localAudioIsStereo = false
    // Use 128kbps for stereo upstream audio, 64kbps for mono
    const bitrate = localAudioIsStereo ? 128000 : 64000;

    // SDP munging: use 128kbps for stereo upstream audio, 64kbps for mono
    return sdp.replace(/a=fmtp:111 /g, 'a=fmtp:111 maxaveragebitrate='+bitrate+';');
}


function forceStereoDown(sdp: string) {
    // munge the SDP answer: request 128kbps stereo for downstream audio
    return sdp.replace(/a=fmtp:111 /g, 'a=fmtp:111 maxaveragebitrate=128000;sprop-stereo=1;stereo=1;');
}


function contactPeer(remoteUser : RTCRemoteUser,
                     onAudioTrack : (peerID : string, event : RTCTrackEvent) => void,
                     onDataChannel : (peerID : string, event : RTCDataChannelEvent) => void) {

    let iceQueue : RTCIceCandidate[] = [];

    if (remoteUser.contacted) {
        return;
    }
    remoteUser.contacted = true;

    console.log("I am " + hifiOptions.uid + ", contacting peer " + remoteUser.uid);

    remoteUser.peerConnection = new RTCPeerConnection({
	    iceServers: [
		    {
			    urls: "stun:stun.l.google.com:19302",
		    },

		    // {
		    //     urls: "turn:some.domain.com:3478",
		    //     credential: "turn-password",
		    //     username: "turn-username"
		    // },

	    ],
    });

    remoteUser.peerConnection.onconnectionstatechange = function(event) {
        if (debugRTC) {
            switch(remoteUser.peerConnection.connectionState) {
                case "connected":
                    // The connection has become fully connected
                    console.log("connection-state is now connected");
                    break;
                case "disconnected":
                    console.log("connection-state is now disconnected");
                    break;
                case "failed":
                    // One or more transports has terminated unexpectedly or in an error
                    console.log("connection-state is now failed");
                    break;
                case "closed":
                    // The connection has been closed
                    console.log("connection-state is now closed");
                    break;
            }
        }
    }


    remoteUser.peerConnection.ondatachannel = (event : RTCDataChannelEvent) => {

        remoteUser.toPeer = event.channel;
        remoteUser.toPeer.binaryType = "arraybuffer";

        remoteUser.toPeer.onmessage = (event : MessageEvent) => {
            remoteUser.fromPeer(remoteUser.uid, new Uint8Array(event.data));
        };

        remoteUser.toPeer.onopen = (event) => {
            if (debugRTC) {
                console.log("data-channel is open");
            }
        };

        remoteUser.toPeer.onclose = (event) => {
            if (debugRTC) {
                console.log("data-channel is closed");
            }
        };

        onDataChannel(remoteUser.uid, event);
    };


    remoteUser.peerConnection.ontrack = function(event : RTCTrackEvent) {
        onAudioTrack(remoteUser.uid, event);
    };


    remoteUser.peerConnection.addEventListener("icegatheringstatechange", ev => {
        if (debugRTC) {
            switch(remoteUser.peerConnection.iceGatheringState) {
                case "new":
                    /* gathering is either just starting or has been reset */
                    console.log("ice-gathering state-change to new: " + JSON.stringify(ev));
                    break;
                case "gathering":
                    /* gathering has begun or is ongoing */
                    console.log("ice-gathering state-change to gathering: " + JSON.stringify(ev));
                    break;
                case "complete":
                    /* gathering has ended */
                    console.log("ice-gathering state-change to complete: " + JSON.stringify(ev));
                    break;
            }
        }
    });


    remoteUser.peerConnection.onicecandidate = (event : RTCPeerConnectionIceEvent) => {
        // the local WebRTC stack has discovered another possible address for the local machine.
        // send this to the remoteUser so it can try this address out.
        if (event.candidate) {
            if (debugRTC) {
                console.log("local ice candidate: " + JSON.stringify(event.candidate));
            }
            webSocket.send(JSON.stringify({
                "message-type": "ice-candidate",
                "from-uid": "" + hifiOptions.uid,
                "to-uid": remoteUser.uid,
                "candidate": event.candidate.candidate,
                "sdpMid": event.candidate.sdpMid,
                "sdpMLineIndex": event.candidate.sdpMLineIndex
            }));

        } else {
            if (debugRTC) {
                console.log("done with local ice candidates");
            }
        }
    };


    remoteUser.peerConnection.addEventListener("negotiationneeded", ev => {
//        if (debugRTC) {
            console.log("got negotiationneeded for remoteUser " + remoteUser.uid);
//        }

        if (remoteUser.uid > hifiOptions.uid) { // avoid glare
            if (debugRTC) {
                console.log("creating RTC offer SDP...");
            }
            remoteUser.peerConnection.createOffer()
                .then((offer : RTCSessionDescription) => {
                    remoteUser.peerConnection.setLocalDescription(offer)
                        .then(() => {
                            webSocket.send(JSON.stringify({
                                "message-type": "sdp",
                                "from-uid": "" + hifiOptions.uid,
                                "to-uid": remoteUser.uid,
                                "sdp": offer.sdp,
                                "offer": true
                            }));
                        })
                        .catch((err : any) => console.error(err));
                })
                .catch((err : any) => console.error(err));
        } else {
            if (debugRTC) {
                console.log("waiting for peer to create RTC offer...");
            }
        }

    }, false);


    remoteUser.sdp = (sdpType: string, sdp: string /*RTCSessionDescriptionInit*/) => {
        if (debugRTC) {
            console.log("got sdp from remoteUser: " + sdpType);
        }

        // forceBitrateUp(sdp);

        remoteUser.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: sdpType as RTCSdpType, sdp: sdp }))
            .then(() => {
                if (debugRTC) {
                    console.log("remote description is set\n");
                }

                while (iceQueue.length > 0) {
                    let cndt = iceQueue.shift();
                    if (debugRTC) {
                        console.log("adding ice from queue: " + JSON.stringify(cndt));
                    }
                    remoteUser.peerConnection.addIceCandidate(cndt);
                }


                if (sdpType == "offer") {
                    remoteUser.peerConnection.createAnswer()
                        .then((answer : RTCSessionDescription) => {
                            if (debugRTC) {
                                console.log("answer is created\n");
                            }
                            let stereoAnswer = new RTCSessionDescription({
                                type: answer.type,
                                sdp: answer.sdp // forceStereoDown(answer.sdp)
                            });
                            return remoteUser.peerConnection.setLocalDescription(stereoAnswer).then(() => {
                                webSocket.send(JSON.stringify({
                                    "message-type": "sdp",
                                    "from-uid": "" + hifiOptions.uid,
                                    "to-uid": remoteUser.uid,
                                    "sdp": stereoAnswer.sdp,
                                    "offer": false
                                }));
                            }).catch((err : any) => console.error(err));
                        })
                }
            })
    }


    remoteUser.ice = (candidate : string, sdpMid : string, sdpMLineIndex : number) => {
        if (debugRTC) {
            console.log("got ice candidate from remoteUser: " + JSON.stringify(candidate));
        }

        let cndt = new RTCIceCandidate({
            candidate: candidate,
            sdpMid: sdpMid,
            sdpMLineIndex: sdpMLineIndex,
            usernameFragment: "",
        });

        if (!remoteUser.peerConnection ||
            !remoteUser.peerConnection.remoteDescription ||
            !remoteUser.peerConnection.remoteDescription.type) {
            iceQueue.push(cndt);
        } else {
            remoteUser.peerConnection.addIceCandidate(cndt);
        }
    }


    if (remoteUser.uid > hifiOptions.uid) {
        remoteUser.toPeer = remoteUser.peerConnection.createDataChannel(hifiOptions.uid + "-to-" + remoteUser.uid);
        remoteUser.toPeer.onmessage = (event : MessageEvent) => {
            remoteUser.fromPeer(remoteUser.uid, new Uint8Array(event.data));
        };
    }
}

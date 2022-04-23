'use strict';

const simdBlob = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
const simdSupported = WebAssembly.validate(simdBlob);
console.log('WebAssembly SIMD is ' + (simdSupported ? 'supported' : 'not supported') + ' by this browser.');

const encodedTransformSupported = !!window.RTCRtpScriptTransform;
console.log('WebRTC Encoded Transform is ' + (encodedTransformSupported ? 'supported' : 'not supported') + ' by this browser.');

// patch RTCPeerConnection to enable insertable streams
let _RTCPeerConnection = RTCPeerConnection;
RTCPeerConnection = function(...config) {
    if (config.length) config[0].encodedInsertableStreams = true;
    return new _RTCPeerConnection(...config);
}

// create Agora client
let client = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8"
});

let localTracks = {
    //videoTrack: null,
    audioTrack: null
};

let remoteUsers = {};

// Agora client options
let options = {
    appid: null,
    channel: null,
    uid: null,
    token: null,
    username: null
};

function decrypt_appid(data, key) {
    let k = BigInt(key.split('').reduce((a, b) => a = Math.imul(a, 33) + b.charCodeAt(0) | 0, 0));
    let t = BigInt('0x' + data) ^ (k * 38038099725390353860267635547n);
    return t.toString(16);
}

// the demo can auto join channel with params in url
$(()=>{
    let urlParams = new URL(location.href).searchParams;
    options.channel = urlParams.get("channel");
    options.password = urlParams.get("password");
    options.username = urlParams.get("username");
    if (options.channel && options.password) {
        $("#channel").val(options.channel);
        $("#password").val(options.password);
        $("#username").val(options.username);
        //$("#join-form").submit();
    }
}
)

$("#username").change(function (e) {
    options.username = $("#username").val();

    // if already connected, update my name
    if (localTracks.audioTrack) {
        usernames[options.uid] = options.username;
        client.sendStreamMessage((new TextEncoder).encode(usernames[options.uid]));
        console.log('%cusername changed, sent stream-message of:', 'color:cyan', usernames[options.uid]);
    }
})

$("#join-form").submit(async function(e) {
    e.preventDefault();
    $("#join").attr("disabled", true);
    try {
        options.appid = decrypt_appid($("#appid").val(), $("#password").val());
        options.token = $("#token").val();
        options.channel = $("#channel").val();
        options.username = $("#username").val();
        await join();
        $("#success-alert").css("display", "block");
    } catch (error) {
        console.error(error);
    } finally {
        $("#leave").attr("disabled", false);
    }
})

$("#leave").click(function(e) {
    leave();
    $("#success-alert").css("display", "none");
})

let isAecEnabled = false;
$("#aec").click(async function(e) {
    // toggle the state
    isAecEnabled = !isAecEnabled;
    $("#aec").css("background-color", isAecEnabled ? "purple" : "");

    // if already connected, leave and rejoin
    if (localTracks.audioTrack) {
        await leave();
        $("#join").attr("disabled", true);
        await join();
        $("#leave").attr("disabled", false);
    }
})

let isMuteEnabled = false;
$("#mute").click(function(e) {
    // toggle the state
    isMuteEnabled = !isMuteEnabled;
    $("#mute").css("background-color", isMuteEnabled ? "purple" : "");

    // if muted, set gate threshold to 0dB, else follow slider
    setThreshold(isMuteEnabled ? 0.0 : threshold.value);
})

$("#sound").click(function(e) {
    playSoundEffect();
})

// threshold slider
threshold.oninput = () => {
    if (!isMuteEnabled) {
        setThreshold(threshold.value);
    }
    document.getElementById("threshold-value").value = threshold.value;
}

let canvasControl;
let elements = [];
let usernames = {};

let audioElement = undefined;
let audioContext = undefined;

let hifiNoiseGate = undefined;  // mic stream connects here
let hifiListener = undefined;   // hifiSource connects here
let hifiLimiter = undefined;    // additional sounds connect here
let hifiPosition = {
    x: 2.0 * Math.random() - 1.0,
    y: 2.0 * Math.random() - 1.0,
    o: 0.0
};

let worker = undefined;

function listenerMetadata(position) {
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

function sourceMetadata(buffer, uid) {
    let data = new DataView(buffer);

    let x = data.getInt16(0) * (1/256.0);
    let y = data.getInt16(2) * (1/256.0);
    let o = data.getInt8(4) * (Math.PI / 128.0);

    // find hifiSource for this uid
    let e = elements.find(e => e.uid === uid);
    if (e !== undefined) {

        // update hifiSource position
        e.hifiSource._x = x;
        e.hifiSource._y = y;
        e.hifiSource._o = o;
        setPosition(e.hifiSource);

        // update screen position
        e.x = 0.5 + (x / roomDimensions.width);
        e.y = 0.5 - (y / roomDimensions.depth);
        e.o = o;
    }
}

function setThreshold(value) {
    if (hifiNoiseGate !== undefined) {
        hifiNoiseGate.parameters.get('threshold').value = value;
        console.log('set noisegate threshold to', value, 'dB');
    }
}

// Fast approximation of Math.atan2(y, x)
// rel |error| < 4e-5, smooth (exact at octant boundary)
// for y=0 x=0, returns NaN
function fastAtan2(y, x) {
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

function angleWrap(angle) {
    return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
}

function setPosition(hifiSource) {
    let dx = hifiSource._x - hifiPosition.x;
    let dy = hifiSource._y - hifiPosition.y;

    let distanceSquared = dx * dx + dy * dy;
    let distance = Math.sqrt(distanceSquared);
    let angle = (distanceSquared < 1e-30) ? 0.0 : fastAtan2(dx, dy);

    let azimuth = angleWrap(angle - hifiPosition.o);

    hifiSource.parameters.get('azimuth').value = azimuth;
    hifiSource.parameters.get('distance').value = distance;
}

const roomDimensions = {
    width: 8,
    height: 2.5,
    depth: 8,
};

function updatePositions(elements) {
    // only update the listener
    let e = elements.find(e => e.hifiSource === null);
    if (e !== undefined) {

        // transform canvas to audio coordinates
        hifiPosition.x = (e.x - 0.5) * roomDimensions.width;
        hifiPosition.y = -(e.y - 0.5) * roomDimensions.depth;
        hifiPosition.o = e.o;
        listenerMetadata(hifiPosition);
    }
}

async function join() {

    await startSpatialAudio();

    // add event listener to play remote tracks when remote user publishs.
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);

    // join a channel
    options.uid = await client.join(options.appid, options.channel, options.token || null);

    //
    // canvas GUI
    //
    let canvas = document.getElementById('canvas');

    elements.push({
        icon: 'listenerIcon',
        x: 0.5 + (hifiPosition.x / roomDimensions.width),
        y: 0.5 - (hifiPosition.y / roomDimensions.depth),
        o: hifiPosition.o,
        radius: 0.02,
        alpha: 0.5,
        clickable: true,

        hifiSource: null,
        uid: options.uid,
    });

    usernames[options.uid] = options.username;

    canvasControl = new CanvasControl(canvas, elements, updatePositions);
    canvasControl.draw();

    // create local tracks
    let audioConfig = {
        AEC: isAecEnabled,
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
    setThreshold(isMuteEnabled ? 0.0 : threshold.value);

    sourceNode.connect(hifiNoiseGate).connect(destinationNode);

    let destinationTrack = destinationNode.stream.getAudioTracks()[0];
    await localTracks.audioTrack._updateOriginMediaStreamTrack(destinationTrack, false);

    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");

    //
    // Insertable Streams / Encoded Transform
    //
    let senders = client._p2pChannel.connection.peerConnection.getSenders();
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
            let e = elements.find(e => e.uid === volume.uid);
            if (e !== undefined)
                e.radius = 0.02 + 0.04 * volume.level/100;
        });
    })

    // on broadcast from remote user, set corresponding username
    client.on("stream-message", (uid, data) => {
        usernames[uid] = (new TextDecoder).decode(data);
        console.log('%creceived stream-message from:', 'color:cyan', usernames[uid]);
    });
}

async function leave() {

    for (let trackName in localTracks) {
        let track = localTracks[trackName];
        if (track) {
            track.stop();
            track.close();
            localTracks[trackName] = undefined;
        }
    }

    // remove remote users and player views
    remoteUsers = {};
    $("#remote-playerlist").html("");

    // leave the channel
    await client.leave();

    $("#local-player-name").text("");
    $("#join").attr("disabled", false);
    $("#leave").attr("disabled", true);

    elements.length = 0;

    stopSpatialAudio();

    console.log("client leaves channel success");
}

function handleUserPublished(user, mediaType) {
    const id = user.uid;
    remoteUsers[id] = user;
    subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
    unsubscribe(user);
}

async function subscribe(user, mediaType) {
    const uid = user.uid;

    // subscribe to a remote user
    await client.subscribe(user, mediaType);
    console.log("subscribe uid:", uid);

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

        let hifiSource = new AudioWorkletNode(audioContext, 'wasm-hrtf-input');
        sourceNode.connect(hifiSource).connect(hifiListener);

        //
        // Insertable Streams / Encoded Transform
        //
        let receivers = client._p2pChannel.connection.peerConnection.getReceivers();
        let receiver = receivers.find(e => e.track?.id === mediaStreamTrack.id && e.track?.kind === 'audio');

        if (encodedTransformSupported) {

            receiver.transform = new RTCRtpScriptTransform(worker, { operation: 'receiver', uid });

        } else {

            const receiverStreams = receiver.createEncodedStreams();
            const readableStream = receiverStreams.readable;
            const writableStream = receiverStreams.writable;
            receiverTransform(readableStream, writableStream, uid);
        }

        elements.push({
            icon: 'sourceIcon',
            radius: 0.02,
            alpha: 0.5,
            clickable: false,

            hifiSource,
            uid,
        });
    }

    // broadcast my name
    client.sendStreamMessage((new TextEncoder).encode(usernames[options.uid]));
    console.log('%csent stream-message of:', 'color:cyan', usernames[options.uid]);
}

async function unsubscribe(user) {
    const uid = user.uid;

    // find and remove this uid
    let i = elements.findIndex(e => e.uid === uid);
    elements.splice(i, 1);

    console.log("unsubscribe uid:", uid);
}

//
// Chrome (as of M100) cannot perform echo cancellation of the Web Audio output.
// As a workaround, a loopback configuration of local peer connections is inserted at the end of the pipeline.
// This should be removed when Chrome implements browser-wide echo cancellation.
// https://bugs.chromium.org/p/chromium/issues/detail?id=687574#c60
//
let loopback = undefined;
async function startEchoCancellation(element, context) {

    loopback = [new _RTCPeerConnection, new _RTCPeerConnection];

    // connect Web Audio to destination
    let destination = context.createMediaStreamDestination();
    hifiLimiter.connect(destination);

    // connect through loopback peer connections
    loopback[0].addTrack(destination.stream.getAudioTracks()[0]);
    loopback[1].ontrack = e => element.srcObject = new MediaStream([e.track]);

    async function iceGatheringComplete(pc) {
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

    if (isAecEnabled) {
        startEchoCancellation(audioElement, audioContext);
    } else {
        hifiLimiter.connect(audioContext.destination);
    }

    $("#sound").attr("hidden", false);
    audioElement.play();
}

function stopSpatialAudio() {
    $("#sound").attr("hidden", true);
    stopEchoCancellation();
    audioContext.close();
    worker && worker.terminate();
}

let audioBuffer = null;
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

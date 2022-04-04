'use strict';

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
    token: null
};

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
    if (options.channel && options.password) {
        $("#channel").val(options.channel);
        $("#password").val(options.password);
        //$("#join-form").submit();
    }
}
)

$("#join-form").submit(async function(e) {
    e.preventDefault();
    $("#join").attr("disabled", true);
    try {
        options.appid = decrypt_appid($("#appid").val(), $("#password").val());
        options.token = $("#token").val();
        options.channel = $("#channel").val();
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

let isMuted = false;
$("#mute").click(function(e) {
    // toggle the state
    isMuted = !isMuted;
    $("#mute").css("background-color", isMuted ? "red" : "");

    // if muted, set gate threshold to 0dB, else follow slider
    setThreshold(isMuted ? 0.0 : threshold.value);
})

$("#sound").click(function(e) {
    playSoundEffect();
})

// threshold slider
threshold.oninput = () => {
    if (!isMuted) {
        setThreshold(threshold.value);
    }
    document.getElementById("threshold-value").value = threshold.value;
}

let canvasControl;
let elements = [];

let audioElement = undefined;
let audioContext = undefined;

let hifiNoiseGate = undefined;  // mic stream connects here
let hifiListener = undefined;   // hifiSource connects here
let hifiLimiter = undefined;    // additional sounds connect here

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

function setPosition(hifiSource) {
    let dx = hifiSource._x - hifiListener._x;
    let dy = hifiSource._y - hifiListener._y;

    //let azimuth = angle_wrap(atan2f(dx, dy) - avatarOrientationRadians);

    let distanceSquared = dx * dx + dy * dy;
    let distance = Math.sqrt(distanceSquared);
    let azimuth = (distanceSquared < 1e-30) ? 0.0 : fastAtan2(dx, dy);

    hifiSource.parameters.get('azimuth').value = azimuth;
    hifiSource.parameters.get('distance').value = distance;
    //console.log({azimuth, distance});
}

const roomDimensions = {
    width: 8,
    height: 2.5,
    depth: 8,
};

/**
 * Update the audio sound objects' positions.
 * @param {Object} elements
 * @private
 */
function updatePositions(elements) {
    // only update the listener (index=0)
    // transform canvas to audio coordinates
    hifiListener._x = (elements[0].x - 0.5) * roomDimensions.width;
    hifiListener._y = -(elements[0].y - 0.5) * roomDimensions.depth;
}

async function join() {

    await startSpatialAudio();

    let canvas = document.getElementById('canvas');

    let x = 2.0 * Math.random() - 1.0;
    let y = 2.0 * Math.random() - 1.0;
    elements.push({
        icon: 'listenerIcon',
        x: 0.5 + (x / roomDimensions.width),
        y: 0.5 - (y / roomDimensions.depth),
        radius: 0.02,
        alpha: 0.5,
        clickable: true,

    });
    console.log('listener', { x, y });

    canvasControl = new CanvasControl(canvas,elements,updatePositions);
    canvasControl.draw();

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
    let senders = client._p2pChannel.connection.peerConnection.getSenders();
    senders.forEach(sender => senderTransform(sender));
}

function senderTransform(sender) {
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

function receiverTransform(receiver, uid) {
    const receiverStreams = receiver.createEncodedStreams();
    const readableStream = receiverStreams.readable;
    const writableStream = receiverStreams.writable;
    const transformStream = new TransformStream({
        uid,
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
                let item = elements.find(item => item.uid === uid);

                // update hifiSource position
                item.hifiSource._x = x;
                item.hifiSource._y = y;
                setPosition(item.hifiSource);

                // update screen position
                item.x = 0.5 + (x / roomDimensions.width);
                item.y = 0.5 - (y / roomDimensions.depth);

                encodedFrame.data = dst.buffer;
            }
            controller.enqueue(encodedFrame);
        },
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
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
        // insertable streams
        //
        let receivers = client._p2pChannel.connection.peerConnection.getReceivers();
        let receiver = receivers.find(r => r.track.id === mediaStreamTrack.id);
        receiverTransform(receiver, uid);

        elements.push({
            icon: 'sourceIcon',
            radius: 0.02,
            alpha: 0.5,
            clickable: false,

            hifiSource,
            uid,
        });
        //console.log('source', { uid, x, z });
    }
}

async function unsubscribe(user) {
    const uid = user.uid;

    // find and remove this uid
    let i = elements.findIndex(item => item.uid === uid);
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

    $("#mute").attr("hidden", false);
    $("#sound").attr("hidden", false);
    audioElement.play();
}

function stopSpatialAudio() {
    $("#mute").attr("hidden", true);
    $("#sound").attr("hidden", true);
    audioContext.close();
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

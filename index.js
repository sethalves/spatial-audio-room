'use strict';

// HACK! patch RTCPeerConnection to add {encodedInsertableStreams=true}
let _RTCPeerConnection = RTCPeerConnection;
RTCPeerConnection = function(config) {
    config.encodedInsertableStreams = true;
    return new _RTCPeerConnection(config);
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

$("#sound").click(function(e) {
    playSoundEffect();
})

let canvasControl;
let elements = [];

let audioElement = undefined;
let audioContext = undefined;

let resonanceGain = undefined;
const RESONANCE_GAIN = 1.0;
let resonanceAudioScene = undefined;

const USE_HIFI = true;
let hifiNoiseGate = undefined;  // mic stream connects here
let hifiListener = undefined;   // hrtf sources connect here
let hifiLimiter = undefined;    // additional sounds connect here

threshold.oninput = () => {
    if (typeof hifiNoiseGate !== 'undefined') {
        hifiNoiseGate.parameters.get('threshold').value = threshold.value;
        console.log('set noisegate threshold to', threshold.value, 'dB');
    }
    document.getElementById("threshold-value").value = threshold.value;
}

function setPosition(source) {
    let dx = source._x - hifiListener._x;
    let dy = source._y - hifiListener._y;

    //let azimuth = angle_wrap(atan2f(dx, dy) - avatarOrientationRadians);
    let azimuth = Math.atan2(dx, dy);
    let distance = Math.sqrt(dx * dx + dy * dy);

    source.parameters.get('azimuth').value = azimuth;
    source.parameters.get('distance').value = distance;
    //console.log({azimuth, distance});
}

const roomDimensions = {
    width: 8,
    height: 2.5,
    depth: 8,
};

const roomMaterials = {
//    left: 'brick-painted', right: 'brick-painted', front: 'brick-painted', back: 'brick-painted',
//    down: 'transparent', up: 'transparent',

//    left: 'curtain-heavy', right: 'curtain-heavy', front: 'curtain-heavy', back: 'curtain-heavy',
//    down: 'transparent', up: 'transparent',

    left: 'transparent', right: 'transparent', front: 'transparent', back: 'transparent',
    down: 'transparent', up: 'transparent',
};

const positionTable = [
    [     0.0000,      0.0000 ],   // listener

    [2 *  0.0000, 2 *  1.0000 ],   // source #1
    [2 *  1.0000, 2 *  0.0000 ],   // source #2
    [2 * -1.0000, 2 *  0.0000 ],   // ...
    [2 *  0.0000, 2 * -1.0000 ],
    [2 *  0.7071, 2 *  0.7071 ],
    [2 * -0.7071, 2 *  0.7071 ],
    [2 *  0.7071, 2 * -0.7071 ],
    [2 * -0.7071, 2 * -0.7071 ],
    [2 *  0.3827, 2 *  0.9239 ],
    [2 * -0.3827, 2 *  0.9239 ],
    [2 *  0.9239, 2 *  0.3827 ],
    [2 * -0.9239, 2 *  0.3827 ],
    [2 *  0.9239, 2 * -0.3827 ],
    [2 * -0.9239, 2 * -0.3827 ],
    [2 *  0.3827, 2 * -0.9239 ],
    [2 * -0.3827, 2 * -0.9239 ],
    [2 *  0.1951, 2 *  0.9808 ],
    [2 * -0.1951, 2 *  0.9808 ],
    [2 *  0.5556, 2 *  0.8315 ],
    [2 * -0.5556, 2 *  0.8315 ],
    [2 *  0.8315, 2 *  0.5556 ],
    [2 * -0.8315, 2 *  0.5556 ],
    [2 *  0.9808, 2 *  0.1951 ],
    [2 * -0.9808, 2 *  0.1951 ],
    [2 *  0.9808, 2 * -0.1951 ],
    [2 * -0.9808, 2 * -0.1951 ],
    [2 *  0.8315, 2 * -0.5556 ],
    [2 * -0.8315, 2 * -0.5556 ],
    [2 *  0.5556, 2 * -0.8315 ],
    [2 * -0.5556, 2 * -0.8315 ],
    [2 *  0.1951, 2 * -0.9808 ],
    [2 * -0.1951, 2 * -0.9808 ],
];

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
    let audioMediaStreamTrack = localTracks.audioTrack.getMediaStreamTrack();
    let audioMediaStream = new MediaStream([audioMediaStreamTrack]);

    let audioSourceNode = audioContext.createMediaStreamSource(audioMediaStream);
    let audioDestinationNode = audioContext.createMediaStreamDestination()
    hifiNoiseGate = new AudioWorkletNode(audioContext, 'wasm-noise-gate');

    audioSourceNode.connect(hifiNoiseGate).connect(audioDestinationNode);

    let audioDestinationTrack = audioDestinationNode.stream.getAudioTracks()[0];
    await localTracks.audioTrack._updateOriginMediaStreamTrack(audioDestinationTrack, !1);

    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");

    //
    // HACK! insertable streams
    //
    let sender = client._highStream.pc.pc.getSenders()[0];
    senderTransform(sender);
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

                // find source for this uid
                let item = elements.find(item => item.uid === uid);

                // update source position
                item.source._x = x;
                item.source._y = y;
                setPosition(item.source);

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
    //canvasControl.draw();

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

        //
        //    user.audioTrack.setAudioFrameCallback((buffer) => {
        //      console.log(
        //          "sampleRate = ", buffer.sampleRate,
        //          "channels = ", buffer.numberOfChannels,
        //          "peak[0] =", (32768.0 * Math.max.apply(null, buffer.getChannelData(0).map(Math.abs))).toFixed()
        //      );
        //    }, 16384);
        //

        //user.audioTrack.play();

        //
        // HACK! insertable streams
        //
        let remoteStream = client._remoteStream.get(uid);
        let receiver = remoteStream.pc.pc.getReceivers()[0];
        receiverTransform(receiver, uid);

        let audioMediaStreamTrack = user.audioTrack.getMediaStreamTrack();
        let audioMediaStream = new MediaStream([audioMediaStreamTrack]);
        let audioSourceNode = audioContext.createMediaStreamSource(audioMediaStream);
        let source = undefined;

        const [x, z] = positionTable[elements.length % positionTable.length];
        if (USE_HIFI) {
            source = new AudioWorkletNode(audioContext, 'wasm-hrtf-input');
            //source._x = x;
            //source._y = z;
            //setPosition(source);
            source.connect(hifiListener);
        } else {
            source = resonanceAudioScene.createSource();
            source.setPosition(x, 0, z);
        }
        audioSourceNode.connect(source);

        elements.push({
            icon: 'sourceIcon',
            //x: 0.5 + (x / roomDimensions.width),
            //y: 0.5 - (z / roomDimensions.depth),
            radius: 0.02,
            alpha: 0.5,
            clickable: false,

            source: source,
            uid: uid,
        });
        //canvasControl.draw();
        //console.log('source', { uid, x, z });
    }
}

async function unsubscribe(user) {
    const uid = user.uid;

    // find and remove this uid
    let i = elements.findIndex(item => item.uid === uid);
    elements.splice(i, 1);
    //canvasControl.draw();

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

    if (USE_HIFI) {

        await audioContext.audioWorklet.addModule('HifiProcessor.js');

        hifiListener = new AudioWorkletNode(audioContext, 'wasm-hrtf-output', {outputChannelCount : [2]});
        //hifiListener._x = 0;
        //hifiListener._y = 0;

        resonanceGain = audioContext.createGain();
        resonanceGain.gain.value = RESONANCE_GAIN;

        hifiLimiter = new AudioWorkletNode(audioContext, 'wasm-limiter');

        hifiListener.connect(resonanceGain).connect(hifiLimiter).connect(audioContext.destination);

    } else {
        let resonanceLimiter = audioContext.createDynamicsCompressor();
        resonanceLimiter.threshold.value = -0.5;
        resonanceLimiter.knee.value = 0.0;
        resonanceLimiter.ratio.value = 20.0;
        resonanceLimiter.attack.value = 0.005;
        resonanceLimiter.release.value = 0.100;
        resonanceLimiter.connect(audioContext.destination);

        resonanceGain = audioContext.createGain();
        resonanceGain.gain.value = RESONANCE_GAIN;
        resonanceGain.connect(resonanceLimiter);

        resonanceAudioScene = new ResonanceAudio(audioContext, { ambisonicOrder: 3 });
        resonanceAudioScene.setRoomProperties(roomDimensions, roomMaterials);
        resonanceAudioScene.setListenerPosition(0, 0, 0);
        resonanceAudioScene.output.connect(resonanceGain);
    }

    $("#sound").attr("hidden", false);
    audioElement.play();
}

function stopSpatialAudio() {
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

'use strict';

let hiFiCommunicator;
let canvasControl;

let elements = [];
let localID = "";

// const roomDimensions = {
//     width: 8,
//     height: 2.5,
//     depth: 8,
// };



// the demo can auto join channel with params in url
$(()=>{
    let urlParams = new URL(location.href).searchParams;
    let agoraChannel = urlParams.get("channel");
    let password = urlParams.get("password");
    if (agoraChannel && password) {
        $("#channel").val(agoraChannel);
        $("#password").val(password);
        //$("#join-form").submit();
    }
}
)


function decrypt_appid(data, key) {
    let k = BigInt(key.split('').reduce((a, b) => a = Math.imul(a, 33) + b.charCodeAt(0) | 0, 0));
    let t = BigInt('0x' + data) ^ (k * 38038099725390353860267635547n);
    return t.toString(16);
}


$("#join-form").submit(async function(e) {
    e.preventDefault();
    $("#join").attr("disabled", true);
    try {
        await join($("#password").val(),
                   $("#token").val(),
                   $("#channel").val());
        $("#success-alert").css("display", "block");
    } catch (error) {
        console.error(error);
    } finally {
        $("#leave").attr("disabled", false);
    }
})

$("#leave").click(function(e) {
    hiFiCommunicator.leave();
    $("#success-alert").css("display", "none");
})

let isMuted = false;
$("#mute").click(function(e) {
    // toggle the state
    isMuted = !isMuted;
    $("#mute").css("background-color", isMuted ? "red" : "");

    // if muted, set gate threshold to 0dB, else follow slider
    hiFiCommunicator.setThreshold(isMuted ? 0.0 : threshold.value);
})

$("#sound").click(function(e) {
    // playSoundEffect();
})

// threshold slider
threshold.oninput = () => {
    if (!isMuted) {
        hiFiCommunicator.setThreshold(threshold.value);
    }
    document.getElementById("threshold-value").value = threshold.value;
}


function onRemoteUserJoined(uid /* : string */) {
    console.log("onRemoteUserJoined -- " + JSON.stringify(uid));
}


function onRemoteUserLeft(uid /* : string */) {
    console.log("onRemoteUserLeft -- " + JSON.stringify(uid));
}


function onRemoteUserMoved(uid /* : string */, x /* : number */, y /* : number */) {
    console.log("onRemoteUserMoved -- " + JSON.stringify(uid) + " " + x + " " + y);
}


async function join(password, token, channel) {

    hiFiCommunicator = new HighFidelityAudio.HiFiCommunicator(onRemoteUserJoined,
                                                              onRemoteUserLeft,
                                                              onRemoteUserMoved);
    let appid = decrypt_appid("f9b2b6c1c83e07ff5ca7e54625d32dd8", password);
    localID = await hiFiCommunicator.connect(appid, channel);

    console.log("QQQQQ my ID is " + JSON.stringify(localID));

    $("#mute").attr("hidden", false);
    $("#sound").attr("hidden", false);

    //
    // canvas GUI
    //
    let canvas = document.getElementById('canvas');

    // initial position
    let x = 2.0 * Math.random() - 1.0;
    let y = 2.0 * Math.random() - 1.0;

    elements.push({
        icon: 'listenerIcon',
        x: x,
        y: y,
        radius: 0.02,
        uid: localID,
    });

    hiFiCommunicator.setListenerPosition(x, y);

    canvasControl = new CanvasControl(canvas, elements,
                                      (elts) => {
                                          console.log("in updatePosition callback");
                                      });
    canvasControl.draw();

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


async function leave() {

    await hiFiCommunicator.leave();

    // remove remote users and player views
    $("#remote-playerlist").html("");
    $("#local-player-name").text("");
    $("#join").attr("disabled", false);
    $("#leave").attr("disabled", true);
    $("#mute").attr("hidden", true);
    $("#sound").attr("hidden", true);

    elements.length = 0;

    console.log("client leaves channel success");
}


// let audioBuffer = null;
// async function playSoundEffect() {

//     // load on first play
//     if (!audioBuffer) {
//         let response = await fetch('https://raw.githubusercontent.com/kencooke/spatial-audio-room/master/sound.wav');
//         let buffer = await response.arrayBuffer();
//         audioBuffer = await audioContext.decodeAudioData(buffer);
//     }

//     let sourceNode = new AudioBufferSourceNode(audioContext);
//     sourceNode.buffer = audioBuffer;
//     sourceNode.connect(hifiLimiter);
//     sourceNode.start();
// }

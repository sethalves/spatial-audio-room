'use strict';

// import { HiFiCommunicator } from 'hifi-spatial-audio';

import { HiFiCommunicator } from "./classes/HiFiCommunicator.js";

let hiFiCommunicator;
let canvasControl;

let elements = [];
let localID = "";
let usernames = {};

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
    let username = urlParams.get("username");
    if (agoraChannel && password) {
        $("#channel").val(agoraChannel);
        $("#password").val(password);
        $("#username").val(username);
        //$("#join-form").submit();
    }
}
)


function decrypt_appid(data, key) {
    let k = BigInt(key.split('').reduce((a, b) => a = Math.imul(a, 33) + b.charCodeAt(0) | 0, 0));
    let t = BigInt('0x' + data) ^ (k * 38038099725390353860267635547n);
    return t.toString(16);
}


function updateLocalID(newLocalID) {
    if (newLocalID != localID) {
        usernames[ newLocalID ] = usernames[ localID ];
        delete usernames[ localID ];
        let e = elements.find(e => e.uid === localID);
        if (e !== undefined) {
            e.uid = newLocalID;
        }
        localID = newLocalID;
    }
}


$("#username").change(function (e) {
    let username = $("#username").val();
    usernames[localID] = username;

    if (hiFiCommunicator && hiFiCommunicator.sendBroadcastMessage((new TextEncoder).encode(usernames[localID]))) {
        console.log('%cusername changed, sent stream-message of:', 'color:cyan', usernames[localID]);
    } else {
        console.log("Failed to update username -- no audio-track");
    }
})


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

$("#aec").click(async function(e) {
    // toggle the state
    let isAecEnabled = hiFiCommunicator.isAecEnabled();
    isAecEnabled = !isAecEnabled;
    $("#join").attr("disabled", true);
    let newLocalID = hiFiCommunicator.setAecEnabled(isAecEnabled);
    updateLocalID(newLocalID);
    $("#leave").attr("disabled", false);
    $("#aec").css("background-color", isAecEnabled ? "purple" : "");
})


$("#mute").click(function(e) {
    // toggle the state
    let isMutedEnabled = hiFiCommunicator.isMutedEnabled();
    isMutedEnabled = !isMutedEnabled;
    hiFiCommunicator.setMutedEnabled(isMutedEnabled);

    $("#mute").css("background-color", isMutedEnabled ? "purple" : "");

    // if muted, set gate threshold to 0dB, else follow slider
    hiFiCommunicator.setThreshold(isMutedEnabled ? 0.0 : threshold.value);
})

$("#sound").click(function(e) {
    // playSoundEffect();
})

// threshold slider
threshold.oninput = () => {
    let isMutedEnabled = hiFiCommunicator.isMutedEnabled();
    if (!isMutedEnabled) {
        hiFiCommunicator.setThreshold(threshold.value);
    }
    document.getElementById("threshold-value").value = threshold.value;
}


function onRemoteUserJoined(uid /* : string */) {
    console.log("onRemoteUserJoined -- " + JSON.stringify(uid));

    elements.push({
        icon: 'sourceIcon',
        x: 0,
        y: 0,
        radius: 0.02,
        alpha: 0.5,
        clickable: false,
        uid: localID,
    });
}


function onRemoteUserLeft(uid /* : string */) {
    console.log("onRemoteUserLeft -- " + JSON.stringify(uid));

    // find and remove this uid
    let i = elements.findIndex(e => e.uid === uid);
    elements.splice(i, 1);
}


function onRemoteUserMoved(uid /* : string */, x /* : number */, y /* : number */) {
    console.log("onRemoteUserMoved -- " + JSON.stringify(uid) + " " + x + " " + y);

    let e = elements.find(e => e.uid === uid);
    if (e !== undefined) {
        e.x = x;
        e.y = y;
    }
}


function onBroadcastMessage(uid /* : string */, data /* : Uint8Array */) {
    usernames[uid] = (new TextDecoder).decode(data);
    console.log('%creceived stream-message from:', 'color:cyan', usernames[uid]);
}


async function join(password, token, channel) {

    hiFiCommunicator = new /* HighFidelityAudio. */ HiFiCommunicator(onRemoteUserJoined,
                                                                     onRemoteUserLeft,
                                                                     onRemoteUserMoved,
                                                                     onBroadcastMessage);
    let appid = decrypt_appid("f9b2b6c1c83e07ff5ca7e54625d32dd8", password);
    localID = await hiFiCommunicator.connect(appid, channel);

    console.log("QQQQQ my ID is " + JSON.stringify(localID));

    hiFiCommunicator.setThreshold(hiFiCommunicator.isMutedEnabled() ? 0.0 : threshold.value);

    $("#sound").attr("hidden", false);

    //
    // canvas GUI
    //
    let canvas = document.getElementById('canvas');

    // initial position
//    let x = 2.0 * Math.random() - 1.0;
//    let y = 2.0 * Math.random() - 1.0;

    let x = Math.random();
    let y = Math.random();


    elements.push({
        icon: 'listenerIcon',
        x: x,
        y: y,
        radius: 0.02,
        alpha: 0.5,
        clickable: true,
        uid: localID,
    });

    hiFiCommunicator.setListenerPosition(x, y);

    let username = $("#username").val();
    usernames[localID] = username;

    canvasControl = new CanvasControl(canvas, elements, usernames,
                                      (elts) => {
                                          console.log("in updatePosition callback");

                                          let e = elements.find(e => e.uid === localID);
                                          if (e !== undefined) {
                                              console.log("position to " + JSON.stringify({ x: e.x, y: e.y }));
                                              hiFiCommunicator.setListenerPosition(e.x, e.y);
                                          } else {
                                              console.log("couldn't find my element.");
                                          }
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

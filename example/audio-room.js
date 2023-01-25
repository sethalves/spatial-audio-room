//
//  Created by Ken Cooke on 3/11/22.
//  Copyright 2022 High Fidelity, Inc.
//
//  The contents of this file are PROPRIETARY AND CONFIDENTIAL, and may not be
//  used, disclosed to third parties, copied or duplicated in any form, in whole
//  or in part, without the prior written consent of High Fidelity, Inc.
//

'use strict';

import * as HiFiAudio from "hifi-web-audio"
import { TransportManagerP2P } from "hifi-web-audio"
import { TransportManagerAgora } from "hifi-web-audio"
import { TransportManagerDaily } from "hifi-web-audio"


import { CanvasControl } from './canvas-control.js'

function degToRad(d) {
    return Math.PI * d / 180.0;
}


let options = {};
let canvasControl;
let elements = [];
let listenerUid;
let usernames = {};
let joined = false;
let localSourcesEnabled = true;

// characterPosition x and y are floats [0.0, 1.0)
let characterPosition = {
    x: 0.5 * Math.random(),
    y: 0.5 * Math.random(),
    o: 0.0
};
let characterPositionSet = false;


let actionQueue = [];
let queueRunning = false;
async function runQueue() {
    if (queueRunning) {
        return;
    }
    queueRunning = true;
    while (actionQueue.length > 0) {
        let action = actionQueue.shift();
        await action();
    }
    queueRunning = false;
}



function getCharacterPositionX() {
    let ropts = roomOptions[ currentRoomID ];
    let canvasDimensions = ropts.canvasDimensions;
    let minX = -canvasDimensions.width / 2;
    let maxX = canvasDimensions.width / 2;
    return (maxX - minX) * characterPosition.x + minX;
}

function setCharacterPositionX(x) {
    let ropts = roomOptions[ currentRoomID ];
    let canvasDimensions = ropts.canvasDimensions;
    let minX = -canvasDimensions.width / 2;
    let maxX = canvasDimensions.width / 2;
    characterPosition.x = (x - minX) / (maxX - minX);
}

function getCharacterPositionY() {
    let ropts = roomOptions[ currentRoomID ];
    let canvasDimensions = ropts.canvasDimensions;
    let minY = -canvasDimensions.height / 2;
    let maxY = canvasDimensions.height / 2;
    return (maxY - minY) * characterPosition.y + minY;
}

function setCharacterPositionY(y) {
    let ropts = roomOptions[ currentRoomID ];
    let canvasDimensions = ropts.canvasDimensions;
    let minY = -canvasDimensions.height / 2;
    let maxY = canvasDimensions.height / 2;
    characterPosition.y = (y - minY) / (maxY - minY);
}


function getCharacterPositionInAudioSpace() {
    return {
        x: getCharacterPositionX(),
        y: getCharacterPositionY(),
        z: 0,
        o: characterPosition.o
    };
}

function setCharacterPositionFromAudioSpace(p) {
    setCharacterPositionX(p.x);
    setCharacterPositionY(p.y);
    characterPosition.o = p.o;
}


const roomOptions = {
    "room-conf-table": {
        video: false,
        metaData: true,
        positions: [
            { x: 0, y: -1, o: degToRad(0) },
            { x: 1, y: 0, o: degToRad(270) },
            { x: 0, y: 1, o: degToRad(180) },
            { x: -1, y: 0, o: degToRad(90) },
            { x: -0.707, y: -0.707, o: degToRad(45) },
            { x: -0.707, y: 0.707, o: degToRad(135) },
            { x: 0.707, y: 0.707, o: degToRad(225) },
            { x: 0.707, y: -0.707, o: degToRad(315) }
        ],
        canvasDimensions: { width: 4, height: 4 },
        background: "webrtcaudio.svg",
        // background: "Table_semi-transparent_HF_Logo.svg",
        // localAudioSources: [
        //     [{ x: -1.6, y: -1.6, o: 0.0, url: "sounds/campfire.wav" },
        //      { x: -1.6, y:  1.6, o: 0.0, url: "sounds/owl.wav" },
        //      { x:  1.6, y:  1.6, o: 0.0, url: "sounds/waterfall.wav" },
        //      { x:  1.6, y: -1.6, o: 0.0, url: "sounds/thunder.wav" }
        //      ]
        // ]
        localAudioSources: []
    },

    // "room-quad-music": {
    //     video: false,
    //     metaData: true,
    //     positions: [],
    //     canvasDimensions: { width: 8, height: 8 },
    //     background: "Semi-transparent_HF_Logo.svg",
    //     localAudioSources: []
    // },

    "room-bar-local": {
        video: false,
        metaData: true,
        positions: [],
        canvasDimensions: { width: 16, height: 16 },
        background: "Semi-transparent_HF_Logo.svg",

        localAudioSources: [
            [{ x: -6, y: 6, url: "sounds/ryan.mp3", name: "Ryan" }, // o: 135
             { x: -4, y: 6, url: "sounds/Jessica_Nunn.mp3", name: "Jessica" }, // o: 225
             { x: -5, y: 4.4, url: "sounds/jazmin_cano.mp3", name: "Jazmin" }], // o: 0

            [{ x: 5, y: 6, url: "sounds/Sam.mp3", name: "Sam" }, // o: 135
             { x: 6, y: 5, url: "sounds/Claire.mp3", name: "Claire" }], // o: 315

            [{ x: -5, y: -5, url: "sounds/bridie2.mp3", name: "Bridie" }, // o: 225
             { x: -5.8, y: -5.8, url: "sounds/alan2.mp3", name: "Alan" }] // o: 45

            // HernanCattaneoWhiteOceanBurningMan2015.mp3 7 -7 315
        ]
    },

    "room-video": {
        video: true,
        metaData: false,
        positions: [],
        canvasDimensions: { width: 8, height: 8 },
        background: "Semi-transparent_HF_Logo.svg",
        localAudioSources: []
    }
}


let roomIDs = [];
for (const [key, value] of Object.entries(roomOptions)) {
    roomIDs.push(key);
}
let currentRoomID = roomIDs[0];
let serverCurrentRoomID = roomIDs[0];

let localAudioSources = {};


// assume token server is on same webserver as this app...
let tokenURL = new URL(window.location.href)
let pathParts = tokenURL.pathname.split("/");
tokenURL.pathname = "/token-server";
tokenURL.protocol = "wss";

let demoGroupName = null;
if (pathParts.length > 1) {
    demoGroupName = pathParts[ 1 ];
} else {
    demoGroupName = "hifi-demo";
}


const floatView = new Float64Array(1);
const int32View = new Int32Array(floatView.buffer);

let positionIntervalID;


// Fast approximation of Math.log2(x)
// for x  > 0.0, returns log2(x)
// for x <= 0.0, returns large negative value
// abs |error| < 2e-4, smooth (exact for x=2^N)
function fastLog2(x) {

    floatView[0] = x;
    let bits = int32View[1];

    // split into mantissa-1.0 and exponent
    let m = (bits & 0xfffff) * (1 / 1048576.0);
    let e = (bits >> 20) - 1023;

    // polynomial for log2(1+x) over x=[0,1]
    let y = (((-0.0821307180 * m + 0.321188984) * m - 0.677784014) * m + 1.43872575) * m;

    // reconstruct result
    return y + e;
}


//
// Sortable layout of video elements
//
let sortable;
let resizeObserver;


function readyVideoSortable() {
    if (sortable) {
        return;
    }

    sortable = Sortable.create(playerlist, {
        sort: true,
        direction: "horizontal",
        onChange: updateVideoPositions,  // update positions on drag-and-drop
    });
    resizeObserver = new ResizeObserver(updateVideoPositions);
    resizeObserver.observe(playerlist); // update positions on resize
}


let webSocket = new WebSocket(tokenURL.href);
webSocket.onmessage = async function (event) {
    // console.log("got websocket message: ", event.data);
    let msg = JSON.parse(event.data);
    if (msg.room) {
        serverCurrentRoomID = msg.room;
    } else {
        serverCurrentRoomID = currentRoomID;
    }
    if (msg["message-type"] == "join-room" && !joined) {
        currentRoomID = serverCurrentRoomID;
        if (!characterPositionSet) {
            let nth = msg["nth"];
            let ropts = roomOptions[ currentRoomID ];
            let positions = ropts.positions;
            if (nth < positions.length) {
                setOwnPosition(positions[ nth ]);
                characterPositionSet = true;
            }
        }
    }
}

webSocket.onopen = async function (event) {
    options.channel = await getRoomNamePrefix();
    getCurrentRoom();
    updateRoomsUI();
}


// the demo can auto-set channel and user-name with params in url
$(()=>{
    let urlParams = new URL(location.href).searchParams;
    options.channel = ""
    options.username = urlParams.get("username");
    $("#username").val(options.username);

    for (const rID of roomIDs) {
        let roomButton = document.getElementById(rID);
        roomButton.style.background="#D9E8EF";
    }
}
)

$("#username").change(async function (e) {
    actionQueue.push(async () => {
        options.username = $("#username").val();
        $("#local-player-name").text(options.username);
        // if already connected, update my name
        setUsername(options.username);
    });
    runQueue();
})

$("#join-form").submit(async function(e) {
    actionQueue.push(async () => {
        $("#leave").attr("disabled", true);
        $("#join").attr("disabled", true);
        e.preventDefault();
        await joinRoom();
    });
    runQueue();
})

$("#leave").click(async function(e) {
    actionQueue.push(async () => {
        $("#leave").attr("disabled", true);
        $("#join").attr("disabled", true);
        await leaveRoom(false);
    });
    runQueue();
})


$("#aec").click(async function(e) {
    // toggle the AEC state
    actionQueue.push(async () => {
        if (localSourcesEnabled) {
            await stopLocalSources();
        }
        await HiFiAudio.setAecEnabled(!HiFiAudio.isAecEnabled());
        updateAudioControlsUI();
        let ropts = roomOptions[ currentRoomID ];
        if (localSourcesEnabled) {
            await startLocalSources();
        }
        if (ropts.video) {
            await HiFiAudio.playVideo(listenerUid, "local-player");
        }
    });
    runQueue();
})


$("#local").click(async function(e) {
    actionQueue.push(async () => {
        if (localSourcesEnabled) {
            await stopLocalSources();
            localSourcesEnabled = false;
        } else {
            await startLocalSources();
            localSourcesEnabled = true;
        }
        updateAudioControlsUI();
    });
    runQueue();
})


$("#mute").click(async function(e) {
    actionQueue.push(async () => {
        // toggle the state
        HiFiAudio.setMutedEnabled(!HiFiAudio.isMutedEnabled());
        updateAudioControlsUI();
        // if muted, set gate threshold to 0dB, else follow slider
        HiFiAudio.setThreshold(HiFiAudio.isMutedEnabled() ? 0.0 : threshold.value);
    });
    runQueue();
})


// $("#sound").click(async function(e) {
//     let audioData = await fetch('https://raw.githubusercontent.com/kencooke/spatial-audio-room/master/sound.wav');
//     let audioBuffer = await audioData.arrayBuffer();
//     HiFiAudio.playSoundEffect(audioBuffer, false);
// })



for (const rID of roomIDs) {
    $("#" + rID).click(async function(e) {
        actionQueue.push(async () => {
            if (joined) {
                await leaveRoom(true);
                currentRoomID = serverCurrentRoomID;
            }
            currentRoomID = rID;
            await joinRoom();
        });
        runQueue();
    })
}


// threshold slider
// threshold.oninput = () => {
//     HiFiAudio.setThreshold(threshold.value);
//     document.getElementById("threshold-value").value = threshold.value;
// }

function clampCharacterPosition() {
    let ropts = roomOptions[ currentRoomID ];
    let canvasDimensions = ropts.canvasDimensions;
    let minX = -canvasDimensions.width / 2;
    let minY = -canvasDimensions.height / 2;
    let maxX = canvasDimensions.width / 2;
    let maxY = canvasDimensions.height / 2;

    if (getCharacterPositionX() < minX) setCharacterPositionX(minX);
    if (getCharacterPositionY() < minY) setCharacterPositionY(minY);
    if (getCharacterPositionX() > maxX) setCharacterPositionX(maxX);
    if (getCharacterPositionY() > maxY) setCharacterPositionY(maxY);
}


// called when the user drags around dots on the canvas
function updatePositions(elts) {

    let ropts = roomOptions[ currentRoomID ];

    for (let e of elts) {
        // transform from canvas to audio coordinates
        let x = (e.x - 0.5) * ropts.canvasDimensions.width;
        let y = -(e.y - 0.5) * ropts.canvasDimensions.height;

        if (e.uid === listenerUid) {
            setCharacterPositionX(x);
            setCharacterPositionY(y);
            characterPosition.o = e.o;
            clampCharacterPosition();
            let metaData = getCharacterPositionInAudioSpace();
            HiFiAudio.setListenerPosition(metaData.x, metaData.y, metaData.o);
        } else if (e.clickable) {
            HiFiAudio.setSourcePosition(e.uid, x, y);
        }
    }
}


function updateVideoPositions() {
    readyVideoSortable();
    let order = sortable.toArray();

    // compute horizontal bounds
    let xmin = 999999;
    let xmax = 0;
    order.forEach((uid, i) => {
        let rect = sortable.el.children[i].getClientRects();
        if (rect && rect[0]) {
            xmin = Math.min(xmin, rect[0].left);
            xmax = Math.max(xmax, rect[0].right);
        }
    });

    // center the horizontal axis at zero
    let xoff = (xmin + xmax) / 2;
    xmin -= xoff;
    xmax -= xoff;

    // compute azimuth from center of video element
    order.forEach((uid, i) => {
        let rect = sortable.el.children[i].getClientRects();
        if (rect && rect[0]) {

            let x = (rect[0].left + rect[0].right) / 2 - xoff;
            let rectWidth = rect[0].right - rect[0].left;
            let xInAudioSpace = x / rectWidth;

            if (uid == listenerUid || uid == 0) {
                HiFiAudio.setListenerPosition(xInAudioSpace, 0, 0);
            } else {
                HiFiAudio.setSourcePosition(uid, xInAudioSpace, 0);
            }
        }
    });
}


function updateRemotePosition(uid, x, y, o) {
    // update canvas position
    let e = elements.find(e => e.uid === uid);
    if (e !== undefined) {
        let ropts = roomOptions[ currentRoomID ];
        e.x = 0.5 + (x / ropts.canvasDimensions.width);
        e.y = 0.5 - (y / ropts.canvasDimensions.height);
        e.o = o;
    }
}


function updateVolumeIndicator(uid, level) {
    let e = elements.find(e => e.uid === uid);
    if (e !== undefined) {
        let leveldB = 6.02059991 * fastLog2(level);
        e.radius = 0.02 + 0.04 * Math.max(0.0, leveldB + 48) * (1 / 48.0);  // [0.02, 0.06] at [-48dBFS, 0dBFS]
    }
}


function receiveBroadcast(uid, data) {
    // console.log('%creceived stream-message from:', 'color:cyan', usernames[uid]);

    let txt = (new TextDecoder).decode(data);
    let msg = JSON.parse(txt);

    switch(msg.type) {

    case "username": {
        usernames[uid] = msg.username;
        let ropts = roomOptions[ currentRoomID ];
        if (ropts.video) {
            if (!usernames[uid] || usernames[uid] == "") {
                $(`#player-name-${uid}`).text("-");
            } else {
                $(`#player-name-${uid}`).text(usernames[uid]);
            }
        }
        break;
    }

    default:
        console.log("WARNING -- unknown broadcast message type: " + txt);
    }
}


function onUserPublished(uid) {

    let ropts = roomOptions[ currentRoomID ];
    if (ropts.video) {
        const player = $(`
        <div id="player-wrapper-${uid}" data-id="${uid}" class="player-wrapper">
            <div id="player-${uid}" class="player"></div>
            <p id="player-name-${uid}" class="player-name"></p>
        </div>
        `);

        $("#playerlist").append(player);
        if (!usernames[uid] || usernames[uid] == "") {
            $(`#player-name-${uid}`).text("-");
        } else {
            $(`#player-name-${uid}`).text(usernames[uid]);
        }
        HiFiAudio.playVideo(uid, `player-${uid}`);
        updateVideoPositions();
    } else {
        elements.push({
            icon: 'sourceIcon',
            radius: 0.02,
            alpha: 0.5,
            clickable: false,
            uid,
        });
    }

    sendUsername();
}


function onUserUnpublished(uid) {

    $(`#player-wrapper-${uid}`).remove();

    let ropts = roomOptions[ currentRoomID ];
    if (ropts.video) {
        if (sortable) {
            updateVideoPositions();
        }
    } else {
        // find and remove this uid
        let i = elements.findIndex(e => e.uid === uid);
        elements.splice(i, 1);

        delete localAudioSources[ uid ];
    }
}


function onError(errMessage) {
    console.log("error: " + errMessage);
    leaveRoom(false);
}


async function getRoomNamePrefix() {
    var resolve, reject;

    const crPromise = new Promise((setResolve, setReject) => {
        resolve = setResolve;
        reject = setReject;
    });

    var previousOnMessage = webSocket.onmessage;
    webSocket.onmessage = function (event) {
        // console.log("got websocket response: ", event.data);
        previousOnMessage(event);
        let msg = JSON.parse(event.data);
        if (msg["message-type"] == "set-channel-prefix") {
            webSocket.onmessage = previousOnMessage;
            resolve(msg["channel-prefix"]);
        }
    }

    webSocket.send(JSON.stringify({
        "message-type": "get-channel-prefix",
        "demo-group-name": demoGroupName
    }));

    return crPromise;
}


async function getCurrentRoom() {
    var resolve, reject;

    const crPromise = new Promise((setResolve, setReject) => {
        resolve = setResolve;
        reject = setReject;
    });

    var previousOnMessage = webSocket.onmessage;
    webSocket.onmessage = function (event) {
        // console.log("got websocket response: ", event.data);
        previousOnMessage(event);
        let msg = JSON.parse(event.data);
        if (msg["message-type"] == "join-room") {
            webSocket.onmessage = previousOnMessage;
            resolve(currentRoomID);
        }
    }

    webSocket.send(JSON.stringify({
        "message-type": "get-current-room"
    }));

    return crPromise;
}


// https://docs.agora.io/en/Interactive%20Broadcast/token_server
async function fetchToken(uid /*: string */, channelName /*: string */, tokenRole /*: number */) {

    var resolve, reject;

    const tokenPromise = new Promise((setResolve, setReject) => {
        resolve = setResolve;
        reject = setReject;
    });

    var previousOnMessage = webSocket.onmessage;
    webSocket.onmessage = function (event) {
        // console.log("got websocket response: ", event.data);
        let msg = JSON.parse(event.data);
        if (msg["message-type"] == "new-agora-token") {
            webSocket.onmessage = previousOnMessage;
            resolve(msg["token"]);
        } else {
            previousOnMessage(event);
        }
    }

    webSocket.send(JSON.stringify({
        "message-type": "get-agora-token",
        "uid": uid,
        "agora-channel-name": channelName,
        "token-role": tokenRole
    }));

    return tokenPromise;
}


async function joinRoom() {
    if (joined) {
        updateAudioControlsUI();
        updateRoomsUI();
        sendUsername();
        return;
    }
    joined = true;
    updateRoomsUI();

    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.username = $("#username").val();

    HiFiAudio.on("remote-position-updated", updateRemotePosition);
    HiFiAudio.on("broadcast-received", receiveBroadcast);
    HiFiAudio.on("remote-volume-updated", updateVolumeIndicator);
    HiFiAudio.on("remote-source-connected", onUserPublished);
    HiFiAudio.on("remote-source-disconnected", onUserUnpublished);
    HiFiAudio.on("error", onError);

    if (!HiFiAudio.isChrome()) {
        HiFiAudio.setAecEnabled(true);
    }

    if (!serverCurrentRoomID) {
        serverCurrentRoomID = roomIDs[0];
    }

    if (!currentRoomID) {
        currentRoomID = serverCurrentRoomID;
    }

    let ropts = roomOptions[ currentRoomID ];

    clampCharacterPosition();


    let transport /* : TransportManager */;

    {
        transport = new TransportManagerAgora(options.appid, fetchToken);
        // $("#rc").click(function(e) {
        //     transport.testReconnect();
        // });

        // let signalingURL = new URL(window.location.href)
        // signalingURL.pathname = "/token-server";
        // signalingURL.protocol = "wss";
        // transport = new TransportManagerP2P(signalingURL);

        // let roomURL = "https://sethalves.daily.co/" + currentRoomID;
        // console.log("joining daily.co room: " + roomURL);
        // transport = new TransportManagerDaily(roomURL);
    }

    listenerUid = transport.generateUniqueID();

    await HiFiAudio.join(transport,
                         listenerUid,
                         options.channel + ":" + currentRoomID,
                         getCharacterPositionInAudioSpace(),
                         0.0, // threshold.value,
                         ropts.video,
                         ropts.metaData);

    usernames[ listenerUid ] = options.username;

    if (ropts.video) {
        if (!options.username || options.username == "") {
            $("#local-player-name").text("-");
        } else {
            $("#local-player-name").text(options.username);
        }
        readyVideoSortable();
        // Play the local video track
        HiFiAudio.playVideo(listenerUid, "local-player");
    } else {
        sortable = null;
        resizeObserver = null;

        //
        // canvas GUI
        //
        let canvas = document.getElementById('canvas');

        elements.push({
            icon: 'listenerIcon',
            x: 0.5 + (getCharacterPositionX() / ropts.canvasDimensions.width),
            y: 0.5 - (getCharacterPositionY() / ropts.canvasDimensions.height),
            o: characterPosition.o,
            radius: 0.02,
            alpha: 0.5,
            clickable: true,
            uid: listenerUid
        });

        canvasControl = new CanvasControl(canvas, elements, usernames, updatePositions, ropts.background);
        canvasControl.draw();
    }

    if (localSourcesEnabled) {
        await startLocalSources();
    }

    updateAudioControlsUI();
    updateRoomsUI();
    sendUsername();

    if (!positionIntervalID) {
        // update everyone about our name and position every 3 seconds, in case a race caused someone to miss something
        positionIntervalID = setInterval(() => {
            // send position
            let metaData = getCharacterPositionInAudioSpace();
            HiFiAudio.setListenerPosition(metaData.x, metaData.y, metaData.o);
            // send name
            let msg = {
                type: "username",
                username: usernames[listenerUid]
            };
            HiFiAudio.sendBroadcastMessage((new TextEncoder).encode(JSON.stringify(msg)));
        }, 3000);
    }
}


async function leaveRoom(willRestart) {

    if (positionIntervalID) {
        clearInterval(positionIntervalID)
        positionIntervalID = null;
    }

    await HiFiAudio.leave(willRestart);

    // remove remote users and player views
    $("#remote-playerlist").html("");
    $("#local-player-name").text("-");

    elements.length = 0;
    joined = false;
    currentRoomID = serverCurrentRoomID;
    updateRoomsUI();
    console.log("client leaves channel success");
}


function sendUsername() {
    if (!usernames[listenerUid]) {
        return;
    }

    // broadcast my name
    let msg = {
        type: "username",
        username: usernames[listenerUid]
    };
    HiFiAudio.sendBroadcastMessage((new TextEncoder).encode(JSON.stringify(msg)));
}


function setUsername(username) {
    usernames[listenerUid] = username;
    if (joined) {
        sendUsername();
    }
}


function updateAudioControlsUI() {
    $("#aec").css("background-color", HiFiAudio.isAecEnabled() ? "purple" : "");
    $("#aec").prop('checked', HiFiAudio.isAecEnabled());

    $("#local").css("background-color", localSourcesEnabled ? "purple" : "");
    $("#local").prop('checked', localSourcesEnabled);

    $("#mute").css("background-color", HiFiAudio.isMutedEnabled() ? "purple" : "");
    $("#mute").prop('checked', HiFiAudio.isMutedEnabled());
}


function updateRoomsUI() {
    for (const rID of roomIDs) {
        let roomButton = document.getElementById(rID);
        let roomButtonCircle = document.getElementById(rID + "-circle");
        if (rID == currentRoomID && joined) {
            roomButton.style.background="#007bff";
            roomButtonCircle.style.fill="#7fbfff";
        } else {
            roomButton.style.background="#D9E8EF";
            roomButtonCircle.style.fill="";
        }
    }

    if (currentRoomID) {
        let ropts = roomOptions[ currentRoomID ];

        let canvasContainer = document.getElementById("canvas-container");
        let videoroomContainer = document.getElementById("playerlist");
        if (ropts.video) {
            canvasContainer.style.display = "none";
            videoroomContainer.style.display = "block";
        } else {
            canvasContainer.style.display = "block";
            videoroomContainer.style.display = "none";
        }

        let localSoundSwitchLabel = document.getElementById("local-source-switch-label");
        let localSoundSwitchP = document.getElementById("local-source-switch-p");
        if (ropts.localAudioSources.length > 0) {
            localSoundSwitchLabel.style.display = "block";
            localSoundSwitchP.style.display = "block";
        } else {
            localSoundSwitchLabel.style.display = "none";
            localSoundSwitchP.style.display = "none";
        }
    }

    if (joined) {
        $("#leave").attr("disabled", false);
        $("#join").attr("disabled", true);
    } else {
        $("#leave").attr("disabled", true);
        $("#join").attr("disabled", false);
    }

    if (webSocket.readyState === WebSocket.OPEN) {
        setRoomButtonsEnabled(true);
        if (joined) {
            $("#join").attr("disabled", true);
        } else {
            $("#join").attr("disabled", false);
        }
    } else {
        $("#join").attr("disabled", true);
        setRoomButtonsEnabled(false);
    }
}


function setRoomButtonsEnabled(v) {
    for (const rID of roomIDs) {
        let roomButton = document.getElementById(rID);
        roomButton.disabled = !v;
    }
}


function setOwnPosition(p) {
    console.log("SET OWN POSITION: " + JSON.stringify(p));
    setCharacterPositionFromAudioSpace(p);

    let e = elements.find(e => e.uid === listenerUid);
    if (e !== undefined) {
        let ropts = roomOptions[ currentRoomID ];
        e.x = 0.5 + (p.x / ropts.canvasDimensions.width);
        e.y = 0.5 - (p.y / ropts.canvasDimensions.height);
        e.o = p.o;
    }
    updatePositions(elements);
}


async function startLocalSounds(soundSpecs) {

    let thisGroupIDs = [];
    let audioBuffers = [];
    let finishedCount = 0;
    let stopped = false;

    let checkForRestart = async (uid, event) => {
        finishedCount++;
        if (!localAudioSources[ uid ]) {
            // if something else removed one of these sources, stop looping
            stopped = true;
        }
        if (!stopped && finishedCount == soundSpecs.length) {
            // once all the sources have triggered the "ended" event, restart them (at the same time)
            finishedCount = 0;
            startSynchronizedSounds();
        }
    };

    let startSynchronizedSounds = async () => {
        // TODO -- use AudioScheduledSourceNode
        for (let i = 0; i < soundSpecs.length; i++) {
            let source = localAudioSources[ thisGroupIDs[ i ] ];
            if (!source) break;

            let sourceNode = new AudioBufferSourceNode(HiFiAudio.audioContext);
            sourceNode.buffer = audioBuffers[ i ];
            sourceNode.loop = false;
            sourceNode.connect(source.node);
            sourceNode.addEventListener("ended", (event) => { checkForRestart(source.uid, event); });

            sourceNode.start();
            console.log("started sound " + soundSpecs[ i ].url);
        }
    };

    // load and decode the audio files in parallel
    let loaders = [];
    for (let i = 0; i < soundSpecs.length; i++) {
        loaders.push(new Promise((resolve, reject) => {
            fetch(soundSpecs[ i ].url).then((response) => {
                response.arrayBuffer().then((buffer) => {
                    // convert audio file data to AudioBuffers.  buffer becomes detached and can't be used again...
                    HiFiAudio.audioContext.decodeAudioData(buffer).then(resolve);
                });
            });
        }));
    }
    audioBuffers = await Promise.all(loaders);

    // set up source nodes and add GUI elements
    for (let i = 0; i < soundSpecs.length; i++) {
        let url = soundSpecs[ i ].url;
        let name = soundSpecs[ i ].name;
        let source = HiFiAudio.addLocalAudioSource();
        HiFiAudio.setSourcePosition(source.uid, soundSpecs[ i ].x, soundSpecs[ i ].y);
        usernames[ source.uid ] = name;

        thisGroupIDs.push(source.uid);
        localAudioSources[ source.uid ] = source;

        // add GUI element
        let ropts = roomOptions[ currentRoomID ];
        elements.push({
            icon: 'soundIcon',
            x: 0.5 + (soundSpecs[ i ].x / ropts.canvasDimensions.width),
            y: 0.5 - (soundSpecs[ i ].y / ropts.canvasDimensions.height),
            o: soundSpecs[ i ].o,
            radius: 0.02,
            alpha: 0.5,
            clickable: true,
            uid: source.uid
        });
    }

    await startSynchronizedSounds();
}


async function startLocalSources() {
    let ropts = roomOptions[ currentRoomID ];
    let starters = [];
    for (let audioSourceGroup of ropts.localAudioSources) {
        starters.push(new Promise((resolve, reject) => { startLocalSounds(audioSourceGroup).then(resolve); }));
    }
    await Promise.all(starters);
}


async function stopLocalSources() {
    for (let localSourceUID in localAudioSources) {
        console.log("stopping local source id=" + localSourceUID);
        HiFiAudio.stopAudioSource(localSourceUID);
    }
}

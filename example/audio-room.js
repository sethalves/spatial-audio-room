//
//  Created by Ken Cooke on 3/11/22.
//  Copyright 2022 High Fidelity, Inc.
//
//  The contents of this file are PROPRIETARY AND CONFIDENTIAL, and may not be
//  used, disclosed to third parties, copied or duplicated in any form, in whole
//  or in part, without the prior written consent of High Fidelity, Inc.
//

'use strict';

import * as HiFiAudio from './hifi-audio.js'
import { CanvasControl } from './canvas-control.js'

function degToRad(d) {
    return Math.PI * d / 180.0;
}

let options = {};
let canvasControl;
let elements = [];
let localUid = "" + (((Math.random()*4294967296)>>>0));
let usernames = {};
let joined = false;

let characterPosition = {
    x: 2.0 * Math.random() - 1.0,
    y: 2.0 * Math.random() - 1.0,
    o: 0.0
};
let characterPositionSet = false;


let roomOptions = {
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
        background: "table.svg",
        token: null
    },

    "room-quad-music": {
        video: false,
        metaData: true,
        positions: [],
        canvasDimensions: { width: 8, height: 8 },
        background: null,
        token: null
    },

    "room-bar": {
        video: false,
        metaData: true,
        positions: [],
        canvasDimensions: { width: 16, height: 16 },
        background: null,
        token: null
    },

    "room-video": {
        video: true,
        metaData: false,
        positions: [],
        canvasDimensions: { width: 8, height: 8 },
        background: null,
        token: null
    }
}


let roomIDs = [];
for (const [key, value] of Object.entries(roomOptions)) {
    roomIDs.push(key);
}
let currentRoomID = roomIDs[0];
let serverCurrentRoomID = roomIDs[0];


// assume token server is on same webserver as this app...
let tokenURL = new URL(window.location.href)
tokenURL.pathname = "/token-server";
tokenURL.protocol = "wss";


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
    console.log("got websocket message: ", event.data);
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
    for (const rID of roomIDs) {
        roomOptions[ rID ].token = await fetchToken(parseInt(localUid), options.channel + ":" + rID, 1);
    }
    getCurrentRoom();
    updateRoomsUI();
}


// the demo can auto-set channel and user-name with params in url
$(()=>{
    let urlParams = new URL(location.href).searchParams;
    options.channel = urlParams.get("channel");
    if (!options.channel) {
        options.channel = "hifi-demo";
    }
    options.username = urlParams.get("username");
    if (options.channel) {
        // $("#channel").val(options.channel);
        $("#username").val(options.username);
    }

    options.admin = false;
    if (urlParams.get("admin")) {
        options.admin = true;
    }

    for (const rID of roomIDs) {
        let roomButton = document.getElementById(rID);
        roomButton.style.background="#D9E8EF";
    }
}
)

$("#username").change(function (e) {
    options.username = $("#username").val();

    // if already connected, update my name
    setUsername(options.username)
})

$("#join-form").submit(async function(e) {
    e.preventDefault();
    await joinRoom();
})

$("#leave").click(function(e) {
    leaveRoom(false);
})


$("#aec").click(async function(e) {
    // toggle the state
    await HiFiAudio.setAecEnabled(!HiFiAudio.isAecEnabled());
    updateAudioControlsUI();
    let ropts = roomOptions[ currentRoomID ];
    if (ropts.video) {
        await HiFiAudio.playVideo(localUid, "local-player");
    }
})

$("#mute").click(function(e) {
    // toggle the state
    HiFiAudio.setMutedEnabled(!HiFiAudio.isMutedEnabled());
    updateAudioControlsUI();
    // if muted, set gate threshold to 0dB, else follow slider
    HiFiAudio.setThreshold(HiFiAudio.isMutedEnabled() ? 0.0 : threshold.value);
})

// $("#sound").click(async function(e) {
//     let audioData = await fetch('https://raw.githubusercontent.com/kencooke/spatial-audio-room/master/sound.wav');
//     let audioBuffer = await audioData.arrayBuffer();
//     HiFiAudio.playSoundEffect(audioBuffer, false);
// })


function tellServerCurrentRoom() {
    webSocket.send(JSON.stringify({
        "message-type": "join-room",
        "room": options.channel + ":" + currentRoomID,
    }));
}


for (const rID of roomIDs) {
    $("#" + rID).click(async function(e) {
        // if (HiFiAudio.isChrome()) {
            if (joined) {
                await leaveRoom(true);
                currentRoomID = serverCurrentRoomID;
            }
        // } else {
        //     if (joined) {
        //         return;
        //     }
        // }

        currentRoomID = rID;
        await joinRoom();
    })
}


// threshold slider
threshold.oninput = () => {
    HiFiAudio.setThreshold(threshold.value);
    document.getElementById("threshold-value").value = threshold.value;
}

function clampCharacterPosition() {
    let ropts = roomOptions[ currentRoomID ];
    let canvasDimensions = ropts.canvasDimensions;
    let minX = -canvasDimensions.width / 2;
    let minY = -canvasDimensions.height / 2;
    let maxX = canvasDimensions.width / 2;
    let maxY = canvasDimensions.height / 2;

    if (characterPosition.x < minX) characterPosition.x = minX;
    if (characterPosition.y < minY) characterPosition.y = minY;
    if (characterPosition.x > maxX) characterPosition.x = maxX;
    if (characterPosition.y > maxY) characterPosition.y = maxY;
}


// called when the user drags around their own dot...
function updatePositions(elts) {
    // only update the listener
    let e = elts.find(e => e.clickable === true);
    if (e !== undefined) {
        let ropts = roomOptions[ currentRoomID ];
        // transform canvas to audio coordinates
        characterPosition = {
            x: (e.x - 0.5) * ropts.canvasDimensions.width,
            y: -(e.y - 0.5) * ropts.canvasDimensions.height,
            o: e.o
        }
        clampCharacterPosition();
        HiFiAudio.setLocalMetaData(characterPosition);
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
            let azimuth = (Math.PI / 2) * (x / xmax);   // linear, not atan(x)

            // update hifiSource
            HiFiAudio.setAzimuth(uid, azimuth);
            console.log("Set uid =", uid, "to azimuth =", (azimuth * 180) / Math.PI);
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
    if (e !== undefined)
        e.radius = 0.02 + 0.04 * level/100;
}


function receiveBroadcast(uid, data) {
    console.log('%creceived stream-message from:', 'color:cyan', usernames[uid]);

    let txt = (new TextDecoder).decode(data);
    let msg = JSON.parse(txt);

    switch(msg.type) {

    case "username": {
        usernames[uid] = msg.username;
        let ropts = roomOptions[ currentRoomID ];
        if (ropts.video) {
            $(`#player-name-${uid}`).text(usernames[uid]);
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
        $(`#player-name-${uid}`).text(usernames[uid]);
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
    }
}


async function getCurrentRoom() {
    var resolve, reject;

    const crPromise = new Promise((setResolve, setReject) => {
        resolve = setResolve;
        reject = setReject;
    });

    var previousOnMessage = webSocket.onmessage;
    webSocket.onmessage = function (event) {
        console.log("got websocket response: ", event.data);
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
async function fetchToken(uid /*: UID*/, channelName /*: string*/, tokenRole /*: number*/) {

    var resolve, reject;

    const tokenPromise = new Promise((setResolve, setReject) => {
        resolve = setResolve;
        reject = setReject;
    });

    var previousOnMessage = webSocket.onmessage;
    webSocket.onmessage = function (event) {
        console.log("got websocket response: ", event.data);
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

    options.appid = $("#appid").val();
    options.token = $("#token").val();
    // options.channel = $("#channel").val();
    options.username = $("#username").val();

    HiFiAudio.on("remote-position-updated", updateRemotePosition);
    HiFiAudio.on("broadcast-received", receiveBroadcast);
    HiFiAudio.on("remote-volume-updated", updateVolumeIndicator);
    HiFiAudio.on("remote-client-joined", onUserPublished);
    HiFiAudio.on("remote-client-left", onUserUnpublished);

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

    await HiFiAudio.join(options.appid,
                         parseInt(localUid),
                         ropts.token, // fetchToken,
                         options.channel + ":" + currentRoomID,
                         characterPosition,
                         threshold.value,
                         ropts.video,
                         ropts.metaData);

    joined = true;
    usernames[ localUid ] = options.username;

    if (ropts.video) {
        $("#local-player-name").text(options.username);
        readyVideoSortable();
        // Play the local video track
        HiFiAudio.playVideo(localUid, "local-player");
    } else {
        sortable = null;
        resizeObserver = null;

        //
        // canvas GUI
        //
        let canvas = document.getElementById('canvas');

        elements.push({
            icon: 'listenerIcon',
            x: 0.5 + (characterPosition.x / ropts.canvasDimensions.width),
            y: 0.5 - (characterPosition.y / ropts.canvasDimensions.height),
            o: characterPosition.o,
            radius: 0.02,
            alpha: 0.5,
            clickable: true,
            uid: localUid
        });

        canvasControl = new CanvasControl(canvas, elements, usernames, updatePositions, ropts.background);
        canvasControl.draw();
    }

    updateAudioControlsUI();
    updateRoomsUI();
    sendUsername();

    if (options.admin) {
        tellServerCurrentRoom();
    }
}


async function leaveRoom(willRestart) {
    await HiFiAudio.leave(willRestart);

    // remove remote users and player views
    $("#remote-playerlist").html("");
    $("#local-player-name").text("");

    elements.length = 0;
    joined = false;
    currentRoomID = serverCurrentRoomID;
    updateRoomsUI();
    console.log("client leaves channel success");
}


function sendUsername() {
    if (!usernames[localUid]) {
        return;
    }

    // broadcast my name
    let msg = {
        type: "username",
        username: usernames[localUid]
    };
    HiFiAudio.sendBroadcastMessage((new TextEncoder).encode(JSON.stringify(msg)));
}


function setUsername(username) {
    usernames[localUid] = username;
    if (joined) {
        sendUsername();
    }
}


function updateAudioControlsUI() {
    $("#aec").css("background-color", HiFiAudio.isAecEnabled() ? "purple" : "");
    $("#aec").prop('checked', HiFiAudio.isAecEnabled());

    $("#mute").css("background-color", HiFiAudio.isMutedEnabled() ? "purple" : "");
    $("#mute").prop('checked', HiFiAudio.isMutedEnabled());
}


function updateRoomsUI() {
    for (const rID of roomIDs) {
        let roomButton = document.getElementById(rID);
        if (rID == currentRoomID && joined) {
            roomButton.style.background="#007bff";
        } else {
            roomButton.style.background="#D9E8EF";
        }
    }

    let canvasContainer = document.getElementById("canvas-container");
    let videoroomContainer = document.getElementById("playerlist");

    if (currentRoomID) {
        let ropts = roomOptions[ currentRoomID ];
        if (ropts.video) {
            canvasContainer.style.display = "none";
            videoroomContainer.style.display = "block";
        } else {
            canvasContainer.style.display = "block";
            videoroomContainer.style.display = "none";
        }
    }

    if (joined) {
        $("#leave").attr("disabled", false);
    } else {
        $("#leave").attr("disabled", true);
    }

    if (webSocket.readyState === WebSocket.OPEN) {
        // if (HiFiAudio.isChrome()) {
            setRoomButtonsEnabled(true);
        // } else {
        //     setRoomButtonsEnabled(!joined);
        // }
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
    characterPosition = p;

    let e = elements.find(e => e.uid === localUid);
    if (e !== undefined) {
        let ropts = roomOptions[ currentRoomID ];
        e.x = 0.5 + (p.x / ropts.canvasDimensions.width);
        e.y = 0.5 - (p.y / ropts.canvasDimensions.height);
        e.o = p.o;
    }
    updatePositions(elements);
}

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

let roomOptions = {
    "room-conf-table": {
        video: false,
        metaData: true,
        positions: [
            { x: 0, y: -1, o: degToRad(0) },
            { x: 1, y: 0, o: degToRad(270) },
            { x: 0, y: 1, o: degToRad(180) },
            { x: -1, y: 0, o: degToRad(90) }
        ]
    },

    "room-quad-music": {
        video: false,
        metaData: true,
        positions: []
    },
    
    "room-bar": {
        video: false,
        metaData: true,
        positions: []
    },

    "room-video": {
        video: true,
        metaData: false,
        positions: []
    }
}


let roomIDs = [];
for (const [key, value] of Object.entries(roomOptions)) {
    roomIDs.push(key);
}
let currentRoomID = roomIDs[3];


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
    if (msg["message-type"] == "join-room") {
        if (currentRoomID != msg.room) {
            console.log("switching to room " + msg.room);
            currentRoomID = msg.room;
            if (localUid) {
                configureRoom();
                updateRoomsUI();
                await leaveRoom();

                $("#join").attr("disabled", true);
                try {
                    await joinRoom();
                } catch (error) {
                    console.error(error);
                } finally {
                    $("#leave").attr("disabled", false);
                }
            }
        }
    }
}


// the demo can auto-set channel and user-name with params in url
$(()=>{
    let urlParams = new URL(location.href).searchParams;
    options.channel = urlParams.get("channel");
    options.username = urlParams.get("username");
    if (options.channel) {
        $("#channel").val(options.channel);
        $("#username").val(options.username);
    }

    options.admin = false;
    if (urlParams.get("admin")) {
        options.admin = true;
    }

    for (const rID of roomIDs) {
        let roomButton = document.getElementById(rID);
        roomButton.style.background="#6c757d";
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
    $("#join").attr("disabled", true);
    try {
        options.appid = $("#appid").val();
        options.token = $("#token").val();
        options.channel = $("#channel").val();
        options.username = $("#username").val();
        await joinRoom();

        if (options.admin) {
            setRoomButtonsEnabled(true);
        }
        configureRoom();
        updateRoomsUI();

    } catch (error) {
        console.error(error);
    } finally {
        $("#leave").attr("disabled", false);
    }
})

$("#leave").click(function(e) {
    leaveRoom();
    setRoomButtonsEnabled(false);
})


$("#aec").click(async function(e) {
    // toggle the state
    HiFiAudio.setAecEnabled(!HiFiAudio.isAecEnabled());
    updateAudioControlsUI();
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


function joinRoomByID(rID) {
    webSocket.send(JSON.stringify({
        "message-type": "join-room",
        "room": options.channel + ":" + rID,
    }));
}


for (const rID of roomIDs) {
    $("#" + rID).click(function(e) { joinRoomByID(rID); })
}


// threshold slider
threshold.oninput = () => {
    HiFiAudio.setThreshold(threshold.value);
    document.getElementById("threshold-value").value = threshold.value;
}

let canvasControl;
const canvasDimensions = { width: 8, height: 8 };   // in meters
let elements = [];
let localUid = undefined;
let usernames = {};


// called when the user drags around their own dot...
function updatePositions(elts) {
    // only update the listener
    let e = elts.find(e => e.clickable === true);
    if (e !== undefined) {
        // transform canvas to audio coordinates
        HiFiAudio.setLocalMetaData({
            x: (e.x - 0.5) * canvasDimensions.width,
            y: -(e.y - 0.5) * canvasDimensions.height,
            o: e.o
        });
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
        xmin = Math.min(xmin, rect[0].left);
        xmax = Math.max(xmax, rect[0].right);
    });

    // center the horizontal axis at zero
    let xoff = (xmin + xmax) / 2;
    xmin -= xoff;
    xmax -= xoff;

    // compute azimuth from center of video element
    order.forEach((uid, i) => {
        let rect = sortable.el.children[i].getClientRects();
        let x = (rect[0].left + rect[0].right) / 2 - xoff;
        let azimuth = (Math.PI / 2) * (x / xmax);   // linear, not atan(x)

        // update hifiSource
        HiFiAudio.setAzimuth(uid, azimuth);
        console.log("Set uid =", uid, "to azimuth =", (azimuth * 180) / Math.PI);
    });
}


function updateRemotePosition(uid, x, y, o) {
    // update canvas position
    let e = elements.find(e => e.uid === uid);
    if (e !== undefined) {
        e.x = 0.5 + (x / canvasDimensions.width);
        e.y = 0.5 - (y / canvasDimensions.height);
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

    // case "room": {
    //     currentRoomID = msg.roomID;
    //     updateRoomsUI();
    //     break;
    // }

    case "position": {
        if (msg.uid == localUid) {
            setOwnPosition(msg.position);
        }
        break;
    }

    default:
        console.log("WARNING -- unknown broadcast message type: " + txt);
    }
}


function onUserPublished(uid) {

    console.log("QQQQ got onUserPublished " + JSON.stringify(uid));

    let ropts = roomOptions[ currentRoomID ];
    if (ropts.video) {
        const player = $(`
        <div id="player-wrapper-${uid}" data-id="${uid}">
            <div id="player-${uid}" class="player"></div>
            <p id="player-name-${uid}" class="player-name"></p>
        </div>
        `);

        console.log(`QQQQ append html for player-${uid}`);

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
    configureRoom()
}


function onUserUnpublished(uid) {
    console.log("QQQQ onUserUnpublished " + JSON.stringify(uid));

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

    const tokenPromise = new Promise((setResolve, setReject) => {
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

    return tokenPromise;
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

    let initialPosition = {
        x: 2.0 * Math.random() - 1.0,
        y: 2.0 * Math.random() - 1.0,
        o: 0.0
    };

    HiFiAudio.on("remote-position-updated", updateRemotePosition);
    HiFiAudio.on("broadcast-received", receiveBroadcast);
    HiFiAudio.on("remote-volume-updated", updateVolumeIndicator);
    HiFiAudio.on("remote-client-joined", onUserPublished);
    HiFiAudio.on("remote-client-left", onUserUnpublished);

    // XXX fix this -- use test from hifi-audio.ts
    var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
        HiFiAudio.setAecEnabled(true);
    }

    if (options.admin) {
        joinRoomByID(currentRoomID);
    } else {
        await getCurrentRoom();
    }

    let ropts = roomOptions[ currentRoomID ];

    console.log("QQQQ appid=" + options.appid);
    localUid = await HiFiAudio.join(options.appid,
                                    fetchToken,
                                    options.channel + ":" + currentRoomID,
                                    initialPosition,
                                    threshold.value,
                                    ropts.video);

    usernames[ localUid ] = options.username;

    console.log("QQQQ localUid=" + JSON.stringify(localUid) + " username=" + JSON.stringify(options.username));


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
            x: 0.5 + (initialPosition.x / canvasDimensions.width),
            y: 0.5 - (initialPosition.y / canvasDimensions.height),
            o: initialPosition.o,
            radius: 0.02,
            alpha: 0.5,
            clickable: true,
            uid: localUid
        });

        canvasControl = new CanvasControl(canvas, elements, usernames, updatePositions);
        canvasControl.draw();
    }

    // $("#sound").attr("hidden", false);

    updateAudioControlsUI();
    updateRoomsUI();
    sendUsername();

    // HiFiAudio.playSoundEffectFromURL('https://demo.highfidelity.com/audio/PF_back_left.opus', false);
}


async function leaveRoom() {
    await HiFiAudio.leave();

    // remove remote users and player views
    $("#remote-playerlist").html("");
    // $("#playerlist").html("");

    $("#local-player-name").text("");
    $("#join").attr("disabled", false);
    $("#leave").attr("disabled", true);

    elements.length = 0;

    localUid = undefined;

    // $("#sound").attr("hidden", true);

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
    if (localUid) {
        usernames[localUid] = username;
        sendUsername();
    }
}


function setRoomButtonsEnabled(v) {
    for (const rID of roomIDs) {
        let roomButton = document.getElementById(rID);
        roomButton.disabled = !v;
    }
}


function configureRoom() {
    if (!options.admin) {
        return;
    }

    // let msg = {
    //     type: "room",
    //     roomID: currentRoomID
    // };
    // HiFiAudio.sendBroadcastMessage((new TextEncoder).encode(JSON.stringify(msg)));

    let ropts = roomOptions[ currentRoomID ];
    let positions = ropts.positions;
    if (positions) {
        for (let i = 0; i < elements.length && i < positions.length; i++) {
            if (elements[ i ].uid == localUid) {
                setOwnPosition(positions[ i ]);
            } else {
                let msg = {
                    type: "position",
                    uid: elements[ i ].uid,
                    position: positions[ i ]
                };
                HiFiAudio.sendBroadcastMessage((new TextEncoder).encode(JSON.stringify(msg)));
            }
        }
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
        if (rID == currentRoomID) {
            roomButton.style.background="#007bff";
        } else {
            roomButton.style.background="#6c757d";
        }
    }

    let canvasContainer = document.getElementById("canvas-container");
    let videoroomContainer = document.getElementById("playerlist");

    let ropts = roomOptions[ currentRoomID ];
    if (ropts.video) {
        canvasContainer.style.display = "none";
        videoroomContainer.style.display = "block";
    } else {
        canvasContainer.style.display = "block";
        videoroomContainer.style.display = "none";
    }
}


function setOwnPosition(p) {
    console.log("SET OWN POSITION: " + JSON.stringify(p));

    let e = elements.find(e => e.uid === localUid);
    if (e !== undefined) {
        e.x = 0.5 + (p.x / canvasDimensions.width);
        e.y = 0.5 - (p.y / canvasDimensions.height);
        e.o = p.o;
    }
    updatePositions(elements);
}

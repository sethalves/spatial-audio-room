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

let options = {};

let roomIDs = [ "room-conf-table", "room-quad-music", "room-spin-class", "room-bar" ];
let currentRoomID = roomIDs[0];

function degToRad(d) {
    return Math.PI * d / 180.0;
}


let roomPositions = {
    "room-conf-table": [
        { x: 0, y: -2, o: degToRad(0) },
        { x: 2, y: 0, o: degToRad(270) },
        { x: 0, y: 2, o: degToRad(180) },
        { x: -2, y: 0, o: degToRad(90) }
    ]
};



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
        $("#success-alert").css("display", "block");

        if (options.admin) {
            setRoomButtonsEnabled(true);
        }
        currentRoomID = "room-conf-table";
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
    $("#success-alert").css("display", "none");
    setRoomButtonsEnabled(false);
})

$("#aec").click(async function(e) {
    // toggle the state
    HiFiAudio.setAecEnabled(!HiFiAudio.isAecEnabled());
    $("#aec").css("background-color", HiFiAudio.isAecEnabled() ? "purple" : "");
})

$("#mute").click(function(e) {
    // toggle the state
    HiFiAudio.setMutedEnabled(!HiFiAudio.isMutedEnabled());
    $("#mute").css("background-color", HiFiAudio.isMutedEnabled() ? "purple" : "");

    // if muted, set gate threshold to 0dB, else follow slider
    HiFiAudio.setThreshold(HiFiAudio.isMutedEnabled() ? 0.0 : threshold.value);
})

$("#sound").click(async function(e) {
    let audioData = await fetch('https://raw.githubusercontent.com/kencooke/spatial-audio-room/master/sound.wav');
    let audioBuffer = await audioData.arrayBuffer();
    HiFiAudio.playSoundEffect(audioBuffer, false);
})


for (const rID of roomIDs) {
    $("#" + rID).click(function(e) {
        currentRoomID = rID;
        configureRoom();
        updateRoomsUI();
    })
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
        break;
    }

    case "room": {
        currentRoomID = msg.roomID;
        updateRoomsUI();
        break;
    }

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
    elements.push({
        icon: 'sourceIcon',
        radius: 0.02,
        alpha: 0.5,
        clickable: false,
        uid,
    });

    sendUsername();
    configureRoom()
}


function onUserUnpublished(uid) {
    $(`#player-wrapper-${uid}`).remove();

    // find and remove this uid
    let i = elements.findIndex(e => e.uid === uid);
    elements.splice(i, 1);
}


// https://docs.agora.io/en/Interactive%20Broadcast/token_server
async function fetchToken(uid /*: UID*/, channelName /*: string*/, tokenRole /*: number*/) /* : Promise<string> */ {

    // assume token server is on same webserver as this app...
    let tokenURL = new URL(window.location.href)
    tokenURL.pathname = "/fetch_rtc_token";
    const response = await window.fetch(tokenURL.href, {
        method: 'POST',
        headers: {
            'content-type': 'application/json;charset=UTF-8'
        },
        body: JSON.stringify({
            uid: uid,
            channelName: channelName,
            role: tokenRole
        })
    });

    let data = await response.json();
    if (response.ok) {
        console.log("token server response: " + JSON.stringify(data));
        if (data && data.token) {
            return data.token;
        }
    }
    console.log("failed to get agora token.");
    return null;
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

    localUid = await HiFiAudio.join(options.appid,
                                    fetchToken,
                                    options.channel,
                                    initialPosition,
                                    threshold.value);

    usernames[ localUid ] = options.username;

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

    $("#sound").attr("hidden", false);
}


async function leaveRoom() {
    await HiFiAudio.leave();

    // remove remote users and player views
    $("#remote-playerlist").html("");

    $("#local-player-name").text("");
    $("#join").attr("disabled", false);
    $("#leave").attr("disabled", true);

    elements.length = 0;

    $("#sound").attr("hidden", true);

    console.log("client leaves channel success");
}


function sendUsername() {
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

    let msg = {
        type: "room",
        roomID: currentRoomID
    };
    HiFiAudio.sendBroadcastMessage((new TextEncoder).encode(JSON.stringify(msg)));

    let positions = roomPositions[ currentRoomID ];
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


function updateRoomsUI() {

    for (const rID of roomIDs) {
        let roomButton = document.getElementById(rID);
        if (rID == currentRoomID) {
            roomButton.style.background="#007bff";
        } else {
            roomButton.style.background="#6c757d";
        }
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

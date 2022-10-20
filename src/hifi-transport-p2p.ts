
import {
    Source,
    TransportManager,
    MicrophoneConfig,
    CameraConfig,
    Track
} from "./hifi-transport.js"


interface RTCSource extends Source {
    contacted : boolean;
    peerConnection : RTCPeerConnection;
    toPeer : RTCDataChannel;
    fromPeer : (peerID : string, data : Uint8Array) => void;
    sdp : (sdpType: string, sdp: string /*RTCSessionDescriptionInit*/) => void;
    ice : (candidate: string, sdpMid: string, sdpMLineIndex: number) => void;
    doStop : boolean;
    audioTrack : Track;
    videoTrack : Track;
}


export class TransportManagerP2P implements TransportManager {

    private debugRTC = false;

    private signalingURL : URL;
    private webSocket : WebSocket;
    private localUID : string;

    private onUserPublished : (user : Source, mediaType : string) => void;
    private onUserUnpublished : (user : Source, mediaType : string) => void;
    private onStreamMessage : (uid : string, data : Uint8Array) => void;
    private onVolumeLevelChange : (uid : string, level : number) => void;
    private onReconnect : (uid : string) => void;

    private remoteUsers : { [uid: string] : RTCSource; } = {};

    private micTrack : MediaStream;
    private cameraTrack : MediaStream;

    private broadcastQueue : { [uid: string] : Array<Uint8Array> } = {};
    
    constructor() {
        this.signalingURL = new URL(window.location.href)
        this.signalingURL.pathname = "/token-server";
        this.signalingURL.protocol = "wss";
    }

    async reset() {
        return new Promise<void>((resolve) => {
            resolve();
        });
    }

    generateUniqueID() : string {
        return "" + (((Math.random()*4294967296)>>>0));
    }

    join(channel : string, uid : string) : Promise<string> {

        this.localUID = uid;

        this.webSocket = new WebSocket(this.signalingURL.href);
        this.webSocket.onopen = async (event) => {
            this.webSocket.send(JSON.stringify({
                "message-type": "join-p2p-channel",
                "uid": "" + uid,
                "channel": channel
            }));
        }

        this.webSocket.onmessage = async (event) => {
            // console.log("got websocket message: ", event.data);
            let msg = JSON.parse(event.data);
            if (msg["message-type"] == "connect-with-peer") {
                let otherUID = msg["uid"];
                let remoteSource : RTCSource;
                if (this.remoteUsers[ otherUID ]) {
                    console.log("found existing remote-user " + otherUID);
                    return;
                } else {
                    remoteSource = {
                        uid: otherUID,
                        contacted: false,
                        peerConnection: undefined,
                        toPeer : undefined,
                        fromPeer : (peerID : string, data : Uint8Array) => {
                            if (this.onStreamMessage) {
                                this.onStreamMessage(otherUID, data);
                            }
                        },
                        sdp : undefined,
                        ice : undefined,
                        doStop : false,
                        audioTrack : undefined,
                        videoTrack : undefined,
                        getAudioSender : function() {
                            return this.peerConnection.getSenders()[0];
                        },
                        getAudioReceiver : function() {
                            let receivers : Array<RTCRtpReceiver> = this.peerConnection.getReceivers();
                            let trackID = this.audioTrack.getMediaStreamTrack().id;
                            let receiver : RTCRtpReceiver =
                                receivers.find((e : RTCRtpReceiver) => {
                                    return e.track?.id === trackID && e.track?.kind === 'audio'
                                });
                            return receiver;
                        },
                        getAudioTrack : function() {
                            return this.audioTrack;
                        },
                        getVideoTrack : function() {
                            return this.videoTrack;
                        },
                        hasAudio : false,
                        hasVideo : false,
                        isRemote : true,
                        isLocal : false
                    };
                    console.log("created new remote-user " + otherUID);
                    this.remoteUsers[ otherUID ] = remoteSource;
                }

                this.contactPeer(remoteSource,
                                 // on audio-track
                                 async (peerID : string, event : RTCTrackEvent) => {
                                     console.log("got audio track from peer, " + peerID);
                                     remoteSource.audioTrack = {
                                         play: (videoEltID : string) => {
                                             let videoElt = document.getElementById(videoEltID) as HTMLVideoElement;
                                             videoElt.autoplay = true;
                                             videoElt.srcObject = event.streams[0];
                                         },
                                         getMediaStreamTrack: () => { return event.track; },
                                         stop: () => { },
                                         close: () => { }
                                     }
                                     remoteSource.hasAudio = true;
                                     if (this.onUserPublished) {
                                         this.onUserPublished(remoteSource, "audio");
                                     }

                                 },
                                 // on video-track
                                 async (peerID : string, event : RTCTrackEvent) => {
                                     console.log("got video track from peer, " + peerID);
                                     remoteSource.videoTrack = {
                                         play: (videoEltID : string) => { },
                                         getMediaStreamTrack: () => { return event.track; },
                                         stop: () => { },
                                         close: () => { }
                                     }
                                     remoteSource.hasVideo = true;
                                     if (this.onUserPublished) {
                                         this.onUserPublished(remoteSource, "video");
                                     }

                                 },
                                 // on data-channel
                                 (peerID : string, event : RTCDataChannelEvent) => {
                                 });


                // this triggers negotiation-needed on the peer-connection
                if (this.micTrack) {
                    console.log("adding audio track to peer-connection (A) for " + uid);
                    // localTracks.audioTrack.getAudioTracks().forEach(track => {
                    //     remoteSource.peerConnection.addTrack(track, localTracks.audioTrack);
                    // });
                    remoteSource.peerConnection.addTrack(this.micTrack.getAudioTracks()[ 0 ]);
                } else {
                    console.log("no mic track yet");
                }

                if (this.cameraTrack) {
                    console.log("adding video track to peer-connection (A) for " + uid);
                    remoteSource.peerConnection.addTrack(this.cameraTrack.getVideoTracks()[ 0 ]);
                } else {
                    console.log("no camera track yet");
                }


            } else if (msg["message-type"] == "ice-candidate") {
                let fromUID = msg["from-uid"];
                if (this.remoteUsers[ fromUID ]) {
                    this.remoteUsers[ fromUID ].ice(msg["candidate"], msg["sdpMid"], msg["sdpMLineIndex"]);
                } else {
                    console.log("error -- got ice from unknown remote user:" + fromUID);
                }

            } else if (msg["message-type"] == "sdp") {
                let fromUID = msg["from-uid"];
                if (this.remoteUsers[ fromUID ]) {
                    this.remoteUsers[ fromUID ].sdp(msg["offer"] ? "offer" : "answer", msg["sdp"]);
                } else {
                    console.log("error -- git ice from unknown remote user:" + fromUID);
                }

            } else if (msg["message-type"] == "disconnect-from-peer") {
                let otherUID = msg["uid"];
                if (this.onUserUnpublished) {
                    if (this.remoteUsers[ otherUID ].hasAudio) {
                        this.onUserUnpublished(this.remoteUsers[ otherUID ], "audio");
                    }
                    if (this.remoteUsers[ otherUID ].hasVideo) {
                        this.onUserUnpublished(this.remoteUsers[ otherUID ], "video");
                    }
                }
                delete this.remoteUsers[ otherUID ];
            }
        }

        return new Promise<string>((resolve) => {
            resolve(this.localUID);
        });
    }


    async leave() : Promise<void> {

        if (this.webSocket) {
            this.webSocket.close();
        }

        // let meter = document.getElementById('my-peak-meter');
        // if (meter) {
        //     while (meter.firstChild) {
        //         meter.removeChild(meter.firstChild);
        //     }
        // }

        console.log("hifi-audio: leave()");

        this.micTrack = undefined;
        this.cameraTrack = undefined;

        if (this.onUserUnpublished) {
            for (let uid in this.remoteUsers) {
                if (this.remoteUsers[ uid ].hasAudio) {
                    this.onUserUnpublished(this.remoteUsers[ uid ], "audio");
                }
                if (this.remoteUsers[ uid ].hasVideo) {
                    this.onUserUnpublished(this.remoteUsers[ uid ], "video");
                }
            }
        }

        this.remoteUsers = {};

        return new Promise<void>((resolve) => {
            resolve();
        });
    }


    on(eventName : string, callback : Function) {
        if (eventName == "source-published") {
            this.onUserPublished = callback as (user: Source, mediaType: string) => void;
        } else if (eventName == "source-unpublished") {
            this.onUserUnpublished = callback as (user: Source, mediaType: string) => void;
        } else if (eventName == "broadcast-received") {
            this.onStreamMessage = callback as (uid: string, data: Uint8Array) => void;
        } else if (eventName == "volume-level-change") {
            this.onVolumeLevelChange = callback as (uid: string, level: number) => void;
        } else if (eventName == "reconnected") {
            this.onReconnect = callback as (uid: string) => void;
        } else {
            console.log("Error -- p2p transport can't register unknown event: " + eventName);
        }
    }


    publish(localTracks : Array<Track>) : Promise<void> {
        for (let localTrack of localTracks) {
            let track = localTrack.getMediaStreamTrack();
            console.log("  track.kind=" + track.kind);
            if (track.kind == "audio") {
                if (!this.micTrack) {
                    this.micTrack = new MediaStream();
                }
                this.micTrack.addTrack(track);
                for (let uid in this.remoteUsers) {
                    let remoteSource = this.remoteUsers[ uid ];
                    console.log("adding audio track to peer-connection (B) for " + uid);
                    remoteSource.peerConnection.addTrack(this.micTrack.getAudioTracks()[ 0 ]);
                }
            }
            if (track.kind == "video") {
                if (!this.cameraTrack) {
                    this.cameraTrack = new MediaStream();
                }
                this.cameraTrack.addTrack(track);
                for (let uid in this.remoteUsers) {
                    let remoteSource = this.remoteUsers[ uid ];
                    console.log("adding video track to peer-connection (B) for " + uid);
                    remoteSource.peerConnection.addTrack(this.cameraTrack.getVideoTracks()[ 0 ]);
                }
            }
        }

        return new Promise<void>((resolve) => {
            resolve();
        });
    }


    unpublish(localTracks : Array<Track>) : Promise<void> {
        return new Promise<void>((resolve) => {
            resolve();
        });
    }


    subscribe(user : Source, mediaType : string) : Promise<void> {
        return new Promise<void>((resolve) => {
            resolve();
        });
    }


    unsubscribe(user : Source) : Promise<void> {
        return new Promise<void>((resolve) => {
            resolve();
        });
    }


    getSharedAudioReceiver() : RTCRtpReceiver {
        return null;
    }

    getSharedAudioSender() : RTCRtpSender {
        return null;
    }


    async createMicrophoneAudioTrack(audioConfig : MicrophoneConfig) : Promise<Track> {
        let audioTrack : MediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                autoGainControl: true,
                noiseSuppression: true,
                sampleRate: 48000,
                channelCount: { exact:1 }
            },
            video: false
        });

        let micTrack = {
            stop : () => { audioTrack.getAudioTracks()[0].stop(); },
            close : () => { /* audioTrack.close(); */ },
            play : (videoEltID : string) => { },
            getMediaStreamTrack : () => { return audioTrack.getAudioTracks()[0]; },
            replaceMediaStreamTrack : (replacement : MediaStreamTrack) => {
                audioTrack.removeTrack(audioTrack.getAudioTracks()[0]);
                audioTrack.addTrack(replacement);
                return new Promise<void>((resolve) => {
                    resolve();
                });
            }
        };

        return new Promise<Track>((resolve) => {
            resolve(micTrack);
        });
    }

    async createCameraVideoTrack(videoConfig : CameraConfig) : Promise<Track> {
       let videoTrack : MediaStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
        });

        let cameraTrack = {
            stop : () => { videoTrack.getVideoTracks()[0].stop(); },
            close : () => { /* videoTrack.close(); */ },
            play : (videoEltID : string) => {
                let videoElt = document.getElementById(videoEltID) as HTMLVideoElement;
                videoElt.autoplay = true;
                videoElt.srcObject = videoTrack;
            },
            getMediaStreamTrack : () => { return videoTrack.getVideoTracks()[0]; },
            updateOriginMediaStreamTrack : (replacement : MediaStreamTrack) => {
                // not supported for video
                return new Promise<void>((resolve) => {
                    resolve();
                });
            }
        };

        return new Promise<Track>((resolve) => {
            resolve(cameraTrack);
        });
    }

    
    private contactPeer(remoteSource : RTCSource,
                        onAudioTrack : (peerID : string, event : RTCTrackEvent) => void,
                        onVideoTrack : (peerID : string, event : RTCTrackEvent) => void,
                        onDataChannel : (peerID : string, event : RTCDataChannelEvent) => void) {

        let iceQueue : RTCIceCandidate[] = [];

        if (remoteSource.contacted) {
            return;
        }
        remoteSource.contacted = true;

        console.log("I am " + this.localUID + ", contacting peer " + remoteSource.uid);

        let sendQueuedBroadcasts = () => {
            if (this.broadcastQueue[ remoteSource.uid ]) {
                console.log("sending " + this.broadcastQueue[ remoteSource.uid ].length + " queued messages to peer " +
                    remoteSource.uid);
                for (let msg of this.broadcastQueue[ remoteSource.uid ]) {
                    remoteSource.toPeer.send(msg);
                }
                delete this.broadcastQueue[ remoteSource.uid ];
            }
        };

        remoteSource.peerConnection = new RTCPeerConnection({
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

        remoteSource.peerConnection.onconnectionstatechange = (event) => {
            if (this.debugRTC) {
                switch(remoteSource.peerConnection.connectionState) {
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


        remoteSource.peerConnection.ondatachannel = (event : RTCDataChannelEvent) => {

            remoteSource.toPeer = event.channel;
            remoteSource.toPeer.binaryType = "arraybuffer";

            remoteSource.toPeer.onmessage = (event : MessageEvent) => {
                remoteSource.fromPeer(remoteSource.uid, new Uint8Array(event.data));
            };

            remoteSource.toPeer.onopen = (event) => {
                //if (this.debugRTC) {
                    console.log("data-channel is open A");
                //}
                sendQueuedBroadcasts();
            };

            remoteSource.toPeer.onclose = (event) => {
                if (this.debugRTC) {
                    console.log("data-channel is closed");
                }
            };

            onDataChannel(remoteSource.uid, event);
        };


        remoteSource.peerConnection.ontrack = (event : RTCTrackEvent) => {
            if (event.track.kind == "audio") {
                onAudioTrack(remoteSource.uid, event);
            } else if (event.track.kind == "video") {
                onVideoTrack(remoteSource.uid, event);
            } else {
                console.log("Error -- p2p transport got unknown track type: " + event.track.kind);
            }
        };


        remoteSource.peerConnection.addEventListener("icegatheringstatechange", ev => {
            if (this.debugRTC) {
                switch(remoteSource.peerConnection.iceGatheringState) {
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


        remoteSource.peerConnection.onicecandidate = (event : RTCPeerConnectionIceEvent) => {
            // the local WebRTC stack has discovered another possible address for the local machine.
            // send this to the remoteSource so it can try this address out.
            if (event.candidate) {
                if (this.debugRTC) {
                    console.log("local ice candidate: " + JSON.stringify(event.candidate));
                }
                this.webSocket.send(JSON.stringify({
                    "message-type": "ice-candidate",
                    "from-uid": "" + this.localUID,
                    "to-uid": remoteSource.uid,
                    "candidate": event.candidate.candidate,
                    "sdpMid": event.candidate.sdpMid,
                    "sdpMLineIndex": event.candidate.sdpMLineIndex
                }));

            } else {
                if (this.debugRTC) {
                    console.log("done with local ice candidates");
                }
            }
        };


        remoteSource.peerConnection.addEventListener("negotiationneeded", ev => {
            if (this.debugRTC) {
                console.log("got negotiationneeded for remoteSource " + remoteSource.uid);
            }

            if (remoteSource.uid > this.localUID) { // avoid glare
                if (this.debugRTC) {
                    console.log("creating RTC offer SDP...");
                }
                remoteSource.peerConnection.createOffer()
                    .then((offer : RTCSessionDescription) => {
                        remoteSource.peerConnection.setLocalDescription(offer)
                            .then(() => {
                                this.webSocket.send(JSON.stringify({
                                    "message-type": "sdp",
                                    "from-uid": "" + this.localUID,
                                    "to-uid": remoteSource.uid,
                                    "sdp": offer.sdp,
                                    "offer": true
                                }));
                            })
                            .catch((err : any) => console.error(err));
                    })
                    .catch((err : any) => console.error(err));
            } else {
                if (this.debugRTC) {
                    console.log("waiting for peer to create RTC offer...");
                }
            }

        }, false);


        remoteSource.sdp = (sdpType: string, sdp: string /*RTCSessionDescriptionInit*/) => {
            if (this.debugRTC) {
                console.log("got sdp from remoteSource: " + sdpType);
            }

            // forceBitrateUp(sdp);

            remoteSource.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: sdpType as RTCSdpType, sdp: sdp }))
                .then(() => {
                    if (this.debugRTC) {
                        console.log("remote description is set\n");
                    }

                    while (iceQueue.length > 0) {
                        let cndt = iceQueue.shift();
                        if (this.debugRTC) {
                            console.log("adding ice from queue: " + JSON.stringify(cndt));
                        }
                        remoteSource.peerConnection.addIceCandidate(cndt);
                    }


                    if (sdpType == "offer") {
                        remoteSource.peerConnection.createAnswer()
                            .then((answer : RTCSessionDescription) => {
                                if (this.debugRTC) {
                                    console.log("answer is created\n");
                                }
                                let stereoAnswer = new RTCSessionDescription({
                                    type: answer.type,
                                    sdp: answer.sdp // forceStereoDown(answer.sdp)
                                });
                                return remoteSource.peerConnection.setLocalDescription(stereoAnswer).then(() => {
                                    this.webSocket.send(JSON.stringify({
                                        "message-type": "sdp",
                                        "from-uid": "" + this.localUID,
                                        "to-uid": remoteSource.uid,
                                        "sdp": stereoAnswer.sdp,
                                        "offer": false
                                    }));
                                }).catch((err : any) => console.error(err));
                            })
                    }
                })
        }


        remoteSource.ice = (candidate : string, sdpMid : string, sdpMLineIndex : number) => {
            if (this.debugRTC) {
                console.log("got ice candidate from remoteSource: " + JSON.stringify(candidate));
            }

            let cndt = new RTCIceCandidate({
                candidate: candidate,
                sdpMid: sdpMid,
                sdpMLineIndex: sdpMLineIndex,
                usernameFragment: "",
            });

            if (!remoteSource.peerConnection ||
                !remoteSource.peerConnection.remoteDescription ||
                !remoteSource.peerConnection.remoteDescription.type) {
                iceQueue.push(cndt);
            } else {
                remoteSource.peerConnection.addIceCandidate(cndt);
            }
        }


        if (remoteSource.uid > this.localUID) {
            remoteSource.toPeer = remoteSource.peerConnection.createDataChannel(this.localUID + "-to-" + remoteSource.uid);
            remoteSource.toPeer.onopen = (event) => {
                console.log("data-channel is open B");
                sendQueuedBroadcasts();
            }
            remoteSource.toPeer.onmessage = (event : MessageEvent) => {
                remoteSource.fromPeer(remoteSource.uid, new Uint8Array(event.data));
            };
        }
    }


    sendBroadcastMessage(msg : Uint8Array) : boolean {
        var msgString = new TextDecoder().decode(msg);

        for (let uid in this.remoteUsers) {
            let dataChannel = this.remoteUsers[ uid ].toPeer;
            if (dataChannel && dataChannel.readyState == "open") {
                console.log("hifi-audio: send broadcast message: " + JSON.stringify(msgString));
                dataChannel.send(msg);
                continue;
            }
            if (!this.broadcastQueue[ uid ]) {
                this.broadcastQueue[ uid ] = [];
            }
            console.log("hifi-audio: queue broadcast message: " + JSON.stringify(msgString));
            this.broadcastQueue[ uid ].push(msg);
        }

        return true;
    }
}

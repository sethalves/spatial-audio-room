import {
    RemoteSource,
    TransportManager,
    MicrophoneConfig,
    CameraConfig,
    LocalTrack
} from "./hifi-transport.js"

import type {
    IAgoraRTC,
    IAgoraRTCClient,
    UID,
    IMicrophoneAudioTrack,
    ILocalTrack,
    IRemoteTrack,
    ICameraVideoTrack,
    IAgoraRTCRemoteUser,
    MicrophoneAudioTrackInitConfig,
    CameraVideoTrackInitConfig
} from "agora-rtc-sdk-ng";

interface IAgoraRTCOpen extends IAgoraRTC {
    setParameter? : any | undefined
}
declare const AgoraRTC: IAgoraRTCOpen;

// Agora this.client with _p2pChannel exposed
interface IAgoraRTCClientOpen extends IAgoraRTCClient {
    _p2pChannel? : any | undefined,
    sendStreamMessage? : any | undefined
}

interface IMicrophoneAudioTrackOpen extends IMicrophoneAudioTrack {
    _updateOriginMediaStreamTrack? : Function | undefined,
    updateOriginMediaStreamTrack? : (replacement : MediaStreamTrack) => Promise<void>
}


interface AgoraUserVolume {
    uid : UID,
    level : number
}


interface AgoraRemoteUser extends IAgoraRTCRemoteUser {
    getSender: () => RTCRtpSender,
    getReceiver: () => RTCRtpReceiver
}


export class TransportManagerAgora implements TransportManager {

    private client : IAgoraRTCClientOpen;
    private appID : string;
    private tokenProvider : Function;

    private debugRTC = false;

    private webSocket : WebSocket;
    private localUID : string;
    private channel : string;

    private onUserPublished : (user : RemoteSource, mediaType : string) => void;
    private onUserUnpublished : (user : RemoteSource, mediaType : string) => void;
    private onStreamMessage : (uid : string, data : Uint8Array) => void;
    private onVolumeLevelChange : (uid : string, level : number) => void;
    private onReconnect : (uid : string) => void;

    private remoteUsers : { [uid: string] : RemoteSource; } = {};

    private micTrack : MediaStream;
    private cameraTrack : MediaStream;
    
    constructor(appID : string, tokenProvider : Function) {
        this.appID = appID;
        this.tokenProvider = tokenProvider;
    }


    async reset() {
        this.client = undefined;
        return new Promise<void>((resolve) => {
            resolve();
        });
    }


    generateUniqueID() : string {
        return "" + (((Math.random()*4294967296)>>>0));
    }


    async join(channel : string, uid : string) : Promise<string> {

        this.localUID = uid;
        this.channel = channel

        if (!this.client) {
            this.client = AgoraRTC.createClient({
                mode: "rtc",
                codec: "vp8"
            });
        }

        // add event listener to play remote tracks when remote user publishs.
        this.client.on("user-published", (user : IAgoraRTCRemoteUser, mediaType : string) => {
            let remoteSource = this.addUserAccessors(user);
            if (this.onUserPublished) {
                this.onUserPublished(remoteSource, mediaType);
            }
            this.remoteUsers[ user.uid ] = remoteSource;
        });
        this.client.on("user-unpublished", (user : IAgoraRTCRemoteUser, mediaType : string) => {
            let remoteSource = this.addUserAccessors(user);
            if (this.onUserUnpublished) {
                this.onUserUnpublished(remoteSource, mediaType);
            }
            delete this.remoteUsers[ user.uid ];
        });

        // handle broadcast from remote user
        this.client.on("stream-message", (uid : UID, data : Uint8Array) => {
            if (this.onStreamMessage) {
                this.onStreamMessage("" + uid, data);
            }
        });

        // When Agora performs a "tryNext" reconnect, a new SFU peer connection is created and all
        // tracks and transceivers will change. The new tracks are quietly republished/resubscribed
        // and no "source-published" callbacks are triggered. This callback finishes configuring the
        // new tracks and transceivers.
        this.client.on("media-reconnect-end", async (uid : UID) => {
            if (this.onReconnect) {
                this.onReconnect("" + uid);
            }
        });

        this.client.on("token-privilege-will-expire", async () => {
            console.log("token will expire...");
            if (this.tokenProvider) {
                console.log("refreshing token...");
                let token = await this.tokenProvider(this.localUID, this.channel, 1);
                await this.client.renewToken(token);
            }
        });


        this.client.on("token-privilege-did-expire", async () => {
            console.log("token expired...");
        });


        //
        // HACK! set user radius based on volume level
        // TODO: reimplement in a performant way...
        //
        AgoraRTC.setParameter("AUDIO_VOLUME_INDICATION_INTERVAL", 20);
        this.client.enableAudioVolumeIndicator();
        this.client.on("volume-indicator", (volumes : AgoraUserVolume[]) => {
            if (this.onVolumeLevelChange) {
                volumes.forEach((volume, index) => {
                    this.onVolumeLevelChange("" + volume.uid, volume.level);
                });
            }
        });

        let token : string = null;
        if (this.tokenProvider) {
            token = await this.tokenProvider(this.localUID, channel, 1);
        }
        console.log("agora transport calling join with ID " + JSON.stringify(this.localUID) + " = " + parseInt(this.localUID));
        await this.client.join(this.appID, this.channel, token, parseInt(this.localUID));

        return new Promise<string>((resolve) => {
            resolve(this.localUID);
        });
    }


    addUserAccessors(user: IAgoraRTCRemoteUser) : RemoteSource {
        (user as unknown as RemoteSource).getAudioSender = () => { return null; };
        (user as unknown as RemoteSource).getAudioReceiver = () => {
            let mediaStreamTrack = user.audioTrack.getMediaStreamTrack();
            let trackID = mediaStreamTrack.id;
            let receivers : Array<RTCRtpReceiver> = this.client._p2pChannel.connection.peerConnection.getReceivers();
            let receiver : RTCRtpReceiver = receivers.find(e => e.track?.id === trackID && e.track?.kind === 'audio');
            return receiver;
        };
        (user as unknown as RemoteSource).getAudioTrack = () => {
            return user.audioTrack;
        };
        (user as unknown as RemoteSource).getVideoTrack = () => {
            return user.videoTrack;
        };

        return user as RemoteSource;
    }

    async leave() : Promise<void> {

        // let meter = document.getElementById('my-peak-meter');
        // if (meter) {
        //     while (meter.firstChild) {
        //         meter.removeChild(meter.firstChild);
        //     }
        // }

        if (!this.client) {
            return;
        }

        console.log("hifi-audio: leave()");

        if (this.micTrack) {
            let track : ILocalTrack = this.micTrack  as unknown as ILocalTrack;
            await this.client.unpublish([ track ]);
            track.stop();
            track.close();
            this.micTrack = undefined;
        }
        if (this.cameraTrack) {
            let track : ILocalTrack = this.cameraTrack as unknown as ILocalTrack;
            await this.client.unpublish([ track ]);
            track.stop();
            track.close();
            this.cameraTrack = undefined;
        }

        // leave the channel
        console.log("agora transport calling leave with ID " + JSON.stringify(this.localUID) + " = " + parseInt(this.localUID));
        await this.client.leave();

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
            this.onUserPublished = callback as (user: RemoteSource, mediaType: string) => void;
        } else if (eventName == "source-unpublished") {
            this.onUserUnpublished = callback as (user: RemoteSource, mediaType: string) => void;
        } else if (eventName == "broadcast-received") {
            this.onStreamMessage = callback as (uid: string, data: Uint8Array) => void;
        } else if (eventName == "volume-level-change") {
            this.onVolumeLevelChange = callback as (uid: string, level: number) => void;
        } else if (eventName == "reconnected") {
            this.onReconnect = callback as (uid: string) => void;
        } else {
            console.log("Error -- agora transport can't register unknown event: " + eventName);
        }
    }

    async publish(localTracks : Array<LocalTrack>) : Promise<void> {
        if (!this.client) {
            console.log("Error -- Agora can't publish track until client has joined room.");
            return;
        }
        return this.client.publish(localTracks as unknown as ILocalTrack[]);
    }


    async unpublish(localTracks : Array<LocalTrack>) : Promise<void> {
        if (!this.client) {
            console.log("Error -- Agora can't unpublish track until client has joined room.");
            return;
        }
        return this.client.unpublish(localTracks as unknown as ILocalTrack[]);
    }


    async subscribe(user : RemoteSource, mediaType : string) : Promise<void> {
        if (!this.client) {
            console.log("Error -- Agora can't subscribe to remote source until client has joined room.");
            return;
        }
        if (mediaType == "audio" || mediaType == "video") {
            await this.client.subscribe(user as unknown as IAgoraRTCRemoteUser, mediaType);
        }
        return new Promise<void>((resolve) => {
            resolve();
        });
    }


    async unsubscribe(user : RemoteSource) : Promise<void> {
        if (!this.client) {
            console.log("Error -- Agora can't unsubscribe from remote source until client has joined room.");
            return;
        }
        return this.client.unsubscribe(user as unknown as IAgoraRTCRemoteUser);
    }


    getSharedAudioReceiver() : RTCRtpReceiver {
        return null;
    }

    getSharedAudioSender() : RTCRtpSender {
        if (!this.client) {
            console.log("Error -- Agora can't get senders until client has joined room.");
            return;
        }
        let senders = this.client._p2pChannel.connection.peerConnection.getSenders();
        let sender = senders.find((e : RTCRtpSender) => e.track?.kind === 'audio');
        return sender;
    }


    async createMicrophoneAudioTrack(audioConfig : MicrophoneConfig) : Promise<LocalTrack> {
        let micTrack : IMicrophoneAudioTrackOpen = await AgoraRTC.createMicrophoneAudioTrack(audioConfig);
        (micTrack as LocalTrack).replaceMediaStreamTrack = async (replacement : MediaStreamTrack) => {
            await micTrack._updateOriginMediaStreamTrack(replacement, false);
            return new Promise<void>((resolve) => {
                resolve();
            });
        }

        return new Promise<LocalTrack>((resolve) => {
            resolve(micTrack);
        });
    }

    async createCameraVideoTrack(videoConfig : CameraConfig) : Promise<LocalTrack> {
        let videoTrack = await AgoraRTC.createCameraVideoTrack(videoConfig)

        return new Promise<LocalTrack>((resolve) => {
            resolve(videoTrack);
        });
    }


    sendBroadcastMessage(msg : Uint8Array) : boolean {
        if (!this.client) {
            console.log("Error -- Agora broadcast message until client has joined room.");
            return;
        }
        var msgString = new TextDecoder().decode(msg);
        console.log("hifi-audio: send broadcast message: " + JSON.stringify(msgString));
        this.client.sendStreamMessage(msg);
        return true;
    }
}




// export function testReconnect() {
//     client._p2pChannel.disconnectForReconnect();
//     client._p2pChannel.requestReconnect();
// }

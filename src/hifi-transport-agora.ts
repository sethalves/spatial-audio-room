// hifi-transport-agora.ts
/**
   TransportManagerAgora implements the TransportManager interface by wrapping Agora's Web SDK.

   @module TransportManagerAgora
*/

import {
    Source,
    TransportManager,
    MicrophoneConfig,
    CameraConfig,
    Track
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


/**
   TransportManagerAgora implements the TransportManager interface and allows HiFiAudio to work over Agora's SFU network.  It wraps Agora's [Web SDK](https://docs.agora.io/en/video-calling/get-started/get-started-sdk) and adds spatial audio.
*/
export class TransportManagerAgora implements TransportManager {

    private client : IAgoraRTCClientOpen;
    private appID : string;
    private tokenProvider : Function;

    private debugRTC = false;

    private localUID : string;
    private channel : string;

    private onUserPublished : (user : Source, mediaType : string) => void;
    private onUserUnpublished : (user : Source, mediaType : string) => void;
    private onStreamMessage : (uid : string, data : Uint8Array) => void;
    private onVolumeLevelChange : (uid : string, level : number) => void;
    private onReconnect : (uid : string) => void;

    private remoteUsers : { [uid: string] : Source; } = {};

    private micTrack : MediaStream;
    private cameraTrack : MediaStream;
    
    /**
       @param appID - Agora app-ID
       @param tokenProvider - A callback function which returns a Promise for an agora token.  This is called when this transport needs a new Agora token.
    */
    constructor(appID : string,
                tokenProvider : (uid : string, channelName : string, tokenRole : number) => Promise<string>) {
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


    addUserAccessors(user: IAgoraRTCRemoteUser) : Source {
        (user as unknown as Source).getAudioSender = () => { return null; };
        (user as unknown as Source).getAudioReceiver = () => {
            let mediaStreamTrack = user.audioTrack.getMediaStreamTrack();
            let trackID = mediaStreamTrack.id;
            let receivers : Array<RTCRtpReceiver> = this.client._p2pChannel.connection.peerConnection.getReceivers();
            let receiver : RTCRtpReceiver = receivers.find(e => e.track?.id === trackID && e.track?.kind === 'audio');
            return receiver;
        };
        (user as unknown as Source).getAudioTrack = () => {
            let track = user.audioTrack as unknown as Track;
            track.close = () => { };
            return track;
        };
        (user as unknown as Source).getVideoTrack = () => {
            let track = user.audioTrack as unknown as Track;
            track.close = () => { };
            return track;
        };

        return user as Source;
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
            this.onUserPublished = callback as (source: Source, mediaType: string) => void;
        } else if (eventName == "source-unpublished") {
            this.onUserUnpublished = callback as (source: Source, mediaType: string) => void;
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

    async publish(localTracks : Array<Track>) : Promise<void> {
        if (!this.client) {
            console.log("Error -- Agora can't publish track until client has joined room.");
            return;
        }
        return this.client.publish(localTracks as unknown as ILocalTrack[]);
    }


    async unpublish(localTracks : Array<Track>) : Promise<void> {
        if (!this.client) {
            console.log("Error -- Agora can't unpublish track until client has joined room.");
            return;
        }
        return this.client.unpublish(localTracks as unknown as ILocalTrack[]);
    }


    async subscribe(source : Source, mediaType : string) : Promise<void> {
        if (!this.client) {
            console.log("Error -- Agora can't subscribe to remote source until client has joined room.");
            return;
        }
        if (mediaType == "audio" || mediaType == "video") {
            await this.client.subscribe(source as unknown as IAgoraRTCRemoteUser, mediaType);
        }
        return new Promise<void>((resolve) => {
            resolve();
        });
    }


    async unsubscribe(source : Source) : Promise<void> {
        if (!this.client) {
            console.log("Error -- Agora can't unsubscribe from remote source until client has joined room.");
            return;
        }
        return this.client.unsubscribe(source as unknown as IAgoraRTCRemoteUser);
    }


    /**
       This transport has receivers for each remote source rather than a single shared one.  This always returns null.
     */
    getSharedAudioReceiver() : RTCRtpReceiver {
        return null;
    }

    /**
       Returns the RTCRtpSender which sends audio from this Agora client to the SFU network.
     */
    getSharedAudioSender() : RTCRtpSender {
        if (!this.client) {
            console.log("Error -- Agora can't get senders until client has joined room.");
            return;
        }
        let senders = this.client._p2pChannel.connection.peerConnection.getSenders();
        let sender = senders.find((e : RTCRtpSender) => e.track?.kind === 'audio');
        return sender;
    }


    async createMicrophoneAudioTrack(audioConfig : MicrophoneConfig) : Promise<Track> {
        let micTrack : IMicrophoneAudioTrackOpen = await AgoraRTC.createMicrophoneAudioTrack(audioConfig);
        (micTrack as Track).replaceMediaStreamTrack = async (replacement : MediaStreamTrack) => {
            await micTrack._updateOriginMediaStreamTrack(replacement, false);
            return new Promise<void>((resolve) => {
                resolve();
            });
        }

        return new Promise<Track>((resolve) => {
            resolve(micTrack);
        });
    }

    async createCameraVideoTrack(videoConfig : CameraConfig) : Promise<Track> {
        let videoTrack = await AgoraRTC.createCameraVideoTrack(videoConfig)

        return new Promise<Track>((resolve) => {
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

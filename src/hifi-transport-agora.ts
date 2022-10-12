import {
    HiFiRemoteUser,
    HiFiTransport,
    RTCRtpSenderIS,
    RTCRtpReceiverIS,
    HiFiMicrophoneAudioTrackInitConfig,
    HiFiCameraVideoTrackInitConfig,
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
    getSender: () => RTCRtpSenderIS,
    getReceiver: () => RTCRtpReceiverIS
}


// interface AgoraLocalCameraVideoTrack extends ICameraVideoTrack {
// }

// interface AgoraLocalMicrophoneAudioTrack extends IMicrophoneAudioTrackOpen {
//     getMediaStreamTrack : () => MediaStreamTrack,
//     updateOriginMediaStreamTrack : (replacement : MediaStreamTrack) => Promise<void>

//     // async updateOriginMediaStreamTrack(replacement : MediaStreamTrack) {
//     //     await this._updateOriginMediaStreamTrack(replacement, false);
//     //     return new Promise<void>((resolve) => {
//     //         resolve();
//     //     });
//     // }
// }


export class HiFiTransportAgora implements HiFiTransport {

    private client : IAgoraRTCClientOpen;

    private debugRTC = false;

    private webSocket : WebSocket;
    private localUID : string;

    private onUserPublished : any;
    private onUserUnpublished : any;
    private onStreamMessage : any;
    private onVolumeLevelChange : any;

    private remoteUsers : { [uid: string] : HiFiRemoteUser; } = {};

    private micTrack : MediaStream;
    private cameraTrack : MediaStream;
    
    constructor() {
    }

    async join(appID : string, channel : string, token : string, uid : string) : Promise<string> {

        this.localUID = uid;

        this.client = AgoraRTC.createClient({
            mode: "rtc",
            codec: "vp8"
        });

        // add event listener to play remote tracks when remote user publishs.
        this.client.on("user-published", (user : IAgoraRTCRemoteUser, mediaType : string) => {
            if (this.onUserPublished) {
                this.addUserAccessors(user);
                this.onUserPublished(user, mediaType);
            }
        });
        this.client.on("user-unpublished", (user : IAgoraRTCRemoteUser) => {
            if (this.onUserUnpublished) {
                this.addUserAccessors(user);
                this.onUserUnpublished(user);
            }
        });

/*

        // When Agora performs a "tryNext" reconnect, a new SFU peer connection is created and all
        // tracks and transceivers will change. The new tracks are quietly republished/resubscribed
        // and no "user-published" callbacks are triggered. This callback finishes configuring the
        // new tracks and transceivers.
        this.client.on("media-reconnect-end", async (uid : UID) => {
            if (uid == this.client.uid) {

                console.warn('RECONNECT for local audioTrack:', uid);

                if (hifiOptions.enableMetadata) {
                    installSenderTransform(client._p2pChannel.connection.peerConnection.getSenders());
                }

            } else {

                let user = remoteUsers[uid];
                if (user !== undefined) {

                    console.warn('RECONNECT for remote audioTrack:', uid);

                    // sourceNode for new WebRTC track
                    let mediaStreamTrack = user.audioTrack.getMediaStreamTrack();
                    let mediaStream = new MediaStream([mediaStreamTrack]);
                    let sourceNode = audioContext.createMediaStreamSource(mediaStream);

                    // connect to existing hifiSource
                    sourceNode.connect(hifiSources[uid]);

                    if (hifiOptions.enableMetadata) {
                        installReceiverTransform(client.getSharedAudioReceiver(), uid);
                    }
                }
            }
        });

        client.on("token-privilege-will-expire", async () => {
            console.log("token will expire...");
            // if (hifiOptions.tokenProvider) {
            //     console.log("refreshing token...");
            //     let token = await hifiOptions.tokenProvider(hifiOptions.uid, hifiOptions.channel, 1);
            //     await client.renewToken(token);
            // }
        });

*/

        this.client.on("token-privilege-did-expire", async () => {
            console.log("token expired...");
        });

        // let token : string;
        // if (hifiOptions.tokenProvider) {
        //     // token = await hifiOptions.tokenProvider(hifiOptions.uid, hifiOptions.channel, 1);
        //     token = hifiOptions.tokenProvider;
        // }


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

        await this.client.join(appID, channel, token, uid);

        return new Promise<string>((resolve) => {
            resolve(this.localUID);
        });
    }


    addUserAccessors(user: IAgoraRTCRemoteUser) {
        (user as unknown as HiFiRemoteUser).getAudioSender = () => { return null; };
        (user as unknown as HiFiRemoteUser).getAudioReceiver = () => {
            let mediaStreamTrack = user.audioTrack.getMediaStreamTrack();
            let trackID = mediaStreamTrack.id;
            let receivers : Array<RTCRtpReceiverIS> = this.client._p2pChannel.connection.peerConnection.getReceivers();
            let receiver : RTCRtpReceiverIS = receivers.find(e => e.track?.id === trackID && e.track?.kind === 'audio');
            return receiver;
        };
        (user as unknown as HiFiRemoteUser).getAudioTrack = () => {
            return user.audioTrack.getMediaStreamTrack();
        };
    }

    async leave(willRestart? : boolean) {

        let meter = document.getElementById('my-peak-meter');
        if (meter) {
            while (meter.firstChild) {
                meter.removeChild(meter.firstChild);
            }
        }

        if (!client) {
            return;
        }

        console.log("hifi-audio: leave()");

        if (this.micTrack) {
            await client.unpublish([ micTrack ]);
            micTrack.stop();
            micTrack.close();
            micTrack = undefined;
        }
        if (this.cameraTrack) {
            await client.unpublish([ cameraTrack ]);
            cameraTrack.stop();
            cameraTrack.close();
            cameraTrack = undefined;
        }

        // leave the channel
        await client.leave();

        hifiSources = {};
        hifiNoiseGate = undefined;
        hifiListener = undefined;
        hifiLimiter = undefined;
        loopback = [];

        stopSpatialAudio(willRestart);
        client = undefined;

        for (var uid in remoteUsers) {
            if (onRemoteUserLeft) {
                onRemoteUserLeft("" + uid);
            }
            delete subscribedToAudio[ "" + uid ];
            delete subscribedToVideo[ "" + uid ];
        }

        if (this.onUserUnpublished) {
            for (let uid in this.remoteUsers) {
                this.onUserUnpublished("" + uid);
            }
        }

        this.remoteUsers = {};
    }


    async rejoin() : Promise<void> {
        console.log("XXX write agora rejoin");

        return new Promise<void>((resolve) => {
            resolve();
        });
    }


    on(eventName : string, callback : Function) {
        if (eventName == "user-published") {
            this.onUserPublished = callback;
        } else if (eventName == "user-unpublished") {
            this.onUserUnpublished = callback;
        } else if (eventName == "stream-message") {
            this.onStreamMessage = callback;
        } else if (eventName == "volume-level-change") {
            this.onVolumeLevelChange = callback;
        }
    }

    async publish(localTracks : Array<LocalTrack>) : Promise<void> {
        return this.client.publish(localTracks as unknown as ILocalTrack[]);
    }


    async unpublish(localTracks : Array<LocalTrack>) : Promise<void> {
        return this.client.unpublish(localTracks as unknown as ILocalTrack[]);
    }


    async subscribe(user : HiFiRemoteUser, mediaType : string) : Promise<void> {
        if (mediaType == "audio" || mediaType == "video") {
            // let remoteTrack : IRemoteTrack =
            await this.client.subscribe(user as unknown as IAgoraRTCRemoteUser, mediaType);
        }
        return new Promise<void>((resolve) => {
            resolve();
        });
    }


    async unsubscribe(user : HiFiRemoteUser) : Promise<void> {
        return this.client.unsubscribe(user as unknown as IAgoraRTCRemoteUser);
    }


    // getSharedAudioReceiver() : RTCRtpReceiverIS {
    //     let receivers : Array<RTCRtpReceiverIS> = this.client._p2pChannel.connection.peerConnection.getReceivers();
    //     let receiver : RTCRtpReceiverIS =
    //         receivers.find(e => e.track?.id === mediaStreamTrack.id && e.track?.kind === 'audio');
    //     return reciever;
    // }


    getSharedAudioSender() : RTCRtpSenderIS {
        let senders = this.client._p2pChannel.connection.peerConnection.getSenders();
        let sender = senders.find((e : RTCRtpSenderIS) => e.track?.kind === 'audio');
        return sender;
    }


    async createMicrophoneAudioTrack(audioConfig : HiFiMicrophoneAudioTrackInitConfig) : Promise<LocalTrack> {
        let micTrack : IMicrophoneAudioTrackOpen = await AgoraRTC.createMicrophoneAudioTrack(audioConfig);
        micTrack.updateOriginMediaStreamTrack = async (replacement : MediaStreamTrack) => {
            await micTrack._updateOriginMediaStreamTrack(replacement, false);
            return new Promise<void>((resolve) => {
                resolve();
            });
        }

        return new Promise<LocalTrack>((resolve) => {
            resolve(micTrack);
        });
    }

    async createCameraVideoTrack(videoConfig : HiFiCameraVideoTrackInitConfig) : Promise<LocalTrack> {
        // let videoTrack = await AgoraRTC.createCameraVideoTrack(videoConfig)

        return new Promise<LocalTrack>((resolve) => {
            resolve(null);
        });
    }


    sendStreamMessage(msg : Uint8Array) : boolean {

        var msgString = new TextDecoder().decode(msg);
        console.log("hifi-audio: send broadcast message: " + JSON.stringify(msgString));
        this.client.sendStreamMessage(msg);
        return true;
    }

    renewToken(token : string) : Promise<void> {
        return this.client.renewToken(token);
    }
}




// export function testReconnect() {
//     client._p2pChannel.disconnectForReconnect();
//     client._p2pChannel.requestReconnect();
// }

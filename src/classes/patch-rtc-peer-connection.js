'use strict';

export function patchRTCPeerConnection() {
    // patch RTCPeerConnection to enable insertable streams
    let _RTCPeerConnection = RTCPeerConnection;
    RTCPeerConnection = function(...config) {
        if (config.length) config[0].encodedInsertableStreams = true;
        return new _RTCPeerConnection(...config);
    }
}

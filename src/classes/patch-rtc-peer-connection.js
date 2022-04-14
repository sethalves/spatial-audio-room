'use strict';

function patchRTCPeerConnection(_RTCPeerConnection) {
    // patch RTCPeerConnection to enable insertable streams
    RTCPeerConnection = function(...config) {
        if (config.length) config[0].encodedInsertableStreams = true;
        return new _RTCPeerConnection(...config);
    }
}

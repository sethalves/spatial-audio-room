
import { Vector3 as Point3D, Quaternion } from "./HiFiMath";
export { Point3D, Quaternion };
export type OtherUserGainMap = { [key: string]: number };

export class HiFiAudioAPIData {
    position: Point3D;
    orientation: Quaternion;
    volumeThreshold: number;
    hiFiGain: number;
    userAttenuation: number;
    userRolloff: number;

    _otherUserGainQueue: OtherUserGainMap;

    volume: number;
    hexColor: string;
    displayName: string;
    profileImageURL: string;

    constructor({
        position = null,
        orientation = null,
        volumeThreshold = null,
        hiFiGain = null,
        userAttenuation = null,
        userRolloff = null
    }: {
        position?: Point3D,
        orientation?: Quaternion,
        volumeThreshold?: number,
        hiFiGain?: number,
        userAttenuation?: number,
        userRolloff?: number
    } = {}) {
        this.position = position;
        this.orientation = orientation;
        this.volumeThreshold = volumeThreshold;
        this.hiFiGain = hiFiGain;
        this.userAttenuation = userAttenuation;
        this.userRolloff = userRolloff;
        this._otherUserGainQueue = {};
    }
}


export class ReceivedHiFiAudioAPIData extends HiFiAudioAPIData {

    providedUserID: string;
    hashedVisitID: string;
    volumeDecibels: number;
    isStereo: boolean;

    constructor(params: {
        providedUserID?: string,
        hashedVisitID?: string,
        volumeDecibels?: number,
        position?: Point3D,
        orientation?: Quaternion,
        isStereo?: boolean
    } = {}) {
        super(params);
        this.providedUserID = params.providedUserID;
        this.hashedVisitID = params.hashedVisitID;
        this.volumeDecibels = params.volumeDecibels;
        this.isStereo = params.isStereo;
    }
}

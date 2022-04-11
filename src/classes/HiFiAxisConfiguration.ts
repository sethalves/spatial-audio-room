
import { Point3D } from "./HiFiAudioAPIData";

export enum HiFiHandedness {
    RightHand = "Right Hand",
    LeftHand = "Left Hand"
}


export class WorldFrameConfiguration {

    forward: Point3D;
    up: Point3D;
    handedness: HiFiHandedness;

    constructor(forward: Point3D, up: Point3D, handedness: HiFiHandedness) {
        this.forward = forward;
        this.up = up;
        this.handedness = handedness;
    }

    static isValid(config: WorldFrameConfiguration) {
        // forward and up must be unitary
        let valid = true;
        if (Point3D.dot(config.forward, config.forward) != 1.0) {
            console.log("Invalid axis configuration: forward direction is not unitary");
            valid = false;
        }
        if (Point3D.dot(config.forward, config.forward) != 1.0) {
            console.log("Invalid axis configuration: up direction is not unitary");
            valid = false;
        }
        // forward and up must be orthogonal to each other
        if (Point3D.dot(config.forward, config.up) != 0.0) {
            console.log("Invalid axis configuration: forward and up directions are not orthogonal");
            valid = false;
        }
        return valid;
    }
}

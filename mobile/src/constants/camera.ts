/**
 * How the phone camera sees the street. Used to turn a detection box into a distance.
 *
 * The defaults fit a typical phone main camera held (or mounted) upright at chest height,
 * tilted slightly down. To calibrate for your phone and mount:
 *  1. Stand a person exactly 2 m in front of the camera, fully in view.
 *  2. If the app says more than 2 m, LOWER CAMERA_VERTICAL_FOV_DEG; if less, RAISE it.
 *  3. Put a bottle on the ground at 2 m: if a pothole-style (ground) estimate is off,
 *     adjust CAMERA_PITCH_DEG (more tilt = nearer estimates) or CAMERA_HEIGHT_M.
 */

/** Field of view along the frame's height (portrait, so the sensor's long side). Most phones: 63–70° */
export const CAMERA_VERTICAL_FOV_DEG = 67;

/** Camera height above the ground in meters (chest mount / phone held at chest) */
export const CAMERA_HEIGHT_M = 1.3;

/** How far the camera points below horizontal, in degrees */
export const CAMERA_PITCH_DEG = 15;

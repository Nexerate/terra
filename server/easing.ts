type EasingFunction = (t: number) => number;

abstract class Easing {
    // Linear
    public static linear = (t: number) => t;

    // Quadratic
    public static easeInQuad = (t: number) => t * t;
    public static easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
    public static easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // Cubic
    public static easeInCubic = (t: number) => t * t * t;
    public static easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    public static easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Quartic
    public static easeInQuart = (t: number) => t * t * t * t;
    public static easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    public static easeInOutQuart = (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    // Quintic
    public static easeInQuint = (t: number) => t * t * t * t * t;
    public static easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
    public static easeInOutQuint = (t: number) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

    // Sine
    // public static easeInSine = (t: number) => 1 - Math.cos((t * Math.PI) / 2);
    // public static easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2);
    // public static easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

    // Circular
    public static easeInCirc = (t: number) => 1 - Math.sqrt(1 - Math.pow(t, 2));
    public static easeOutCirc = (t: number) => Math.sqrt(1 - Math.pow(t - 1, 2));
    public static easeInOutCirc = (t: number) => t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;

    // Exponential
    public static easeInExpo = (t: number) => t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    public static easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    public static easeInOutExpo = (t: number) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
};

export {
    type EasingFunction,
    Easing,
}
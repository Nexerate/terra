type EasingFunction = (t: number) => number;

// const cubicBezier = (p1x: number, p1y: number, p2x: number, p2y: number): EasingFunction => {
//     const a = (a1: number, a2: number) => 1.0 - 3.0 * a2 + 3.0 * a1;
//     const b = (a1: number, a2: number) => 3.0 * a2 - 6.0 * a1;
//     const c = (a1: number) => 3.0 * a1;

//     // Calculate the polynomial coefficients
//     const calcBezier = (t: number, a1: number, a2: number) =>
//         ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t;

//     // Calculate the derivative of the polynomial
//     const getSlope = (t: number, a1: number, a2: number) =>
//         3.0 * a(a1, a2) * t * t + 2.0 * b(a1, a2) * t + c(a1);

//     const getTForX = (x: number) => {
//         // Newton-Raphson iteration
//         let aGuessT = x;
//         for (let i = 0; i < 4; ++i) {
//             const currentSlope = getSlope(aGuessT, p1x, p2x);
//             if (currentSlope === 0.0) return aGuessT;
//             const currentX = calcBezier(aGuessT, p1x, p2x) - x;
//             aGuessT -= currentX / currentSlope;
//         }
//         return aGuessT;
//     };

//     return (x: number) => calcBezier(getTForX(x), p1y, p2y);
// };

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
    EasingFunction,
    Easing,
}
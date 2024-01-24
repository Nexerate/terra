import { Object3D } from 'three';
import { clamp, lerp } from 'three/src/math/MathUtils';
import { Easing, EasingFunction } from './easing';

abstract class Animator {
    static active: SimpleAnimation[] = [];

    public static clear(): void {
        Animator.active = [];
    }

    static play(anim: SimpleAnimation): void {
        if (Animator.active.includes(anim)) return;

        Animator.active.push(anim);
    }

    static stop(anim: SimpleAnimation): void {
        if (!Animator.active.includes(anim)) return;

        Animator.active.splice(this.active.indexOf(anim), 1);
    }

    public static update(dt: number) {
        Animator.active.forEach(anim => {
            anim.update(dt);
        });
    }
}

abstract class SimpleAnimation {
    private t: number;
    private duration: number
    private ease: EasingFunction;
    
    constructor(duration: number, ease: EasingFunction = Easing.linear) {
        this.t = 0;
        this.duration = duration;
        this.ease = ease;
    }
    
    public abstract animate(t: number): void;

    update(dt: number) {
        const progress = dt / this.duration;

        this.t = clamp(this.t + progress, 0, 1);
        this.animate(this.ease(this.t));

        if (this.t >= 1) this.stop();
    }

    public play() {
        Animator.play(this);
    }
    
    public stop() {
        Animator.stop(this);
    }

    // public restart() {
    //     this.t = 0;
    //     Animator.play(this);
    // }

    // public pause() {
    //     Animator.pause(this);
    // }

    // public resume() {
    //     Animator.resume(this);
    // }
}

class ScaleAnimation extends SimpleAnimation {
    private target: Object3D;
    private start: number;
    private end: number;
    
    constructor(target: Object3D, duration: number, start = 0, end = 1, curve: EasingFunction) {
        super(duration, curve);

        this.target = target;
        this.start = start,
        this.end = end;
    }
    
    public animate(t: number): void {
        const scale = lerp(this.start, this.end, t);
        this.target.scale.setScalar(scale);
    }
}

class RotateAnimation extends SimpleAnimation {
    private target: Object3D;
    private start: number;
    private end: number;
    
    constructor(target: Object3D, duration: number, start = 0, end = Math.PI * 2, curve: EasingFunction) {
        super(duration, curve);

        this.target = target;
        this.start = start;
        this.end = end;
    }
    
    public animate(t: number): void {
        const rotation = lerp(this.start, this.end, t);
        this.target.rotation.y = rotation;
    }
}

export {
    Animator,
    SimpleAnimation,
    ScaleAnimation,
    RotateAnimation,
}
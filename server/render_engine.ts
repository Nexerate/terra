import { WebGLRenderer, type Scene, PerspectiveCamera } from 'three';

class RenderEngine {
    private webgl: WebGLRenderer;
    private scene: Scene;
    private cam: PerspectiveCamera;

    private window: Window;

    constructor(scene: Scene, cam: PerspectiveCamera, canvas: HTMLCanvasElement | undefined, window: Window) {
        this.scene = scene;
        this.cam = cam;
        this.window = window;

        this.webgl = new WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        this.webgl.setPixelRatio(window.devicePixelRatio);
        this.webgl.setSize(window.innerWidth, window.innerHeight);
    
        window.addEventListener('resize', this.onWindowResize, false);
        this.onWindowResize();
    }

    private onWindowResize() {
        const scale = Math.min(window.innerWidth, window.innerHeight);
        
        this.cam.aspect = window.innerWidth / window.innerHeight;
        this.cam.near = 1;
        this.cam.far = scale * 4;

        this.cam.updateProjectionMatrix();

        this.webgl.setSize(window.innerWidth, window.innerHeight);
    }

    public dispose() {
        this.webgl.dispose();

        this.window.removeEventListener('resize', this.onWindowResize);
    }

    public render() {
        this.webgl.render(this.scene, this.cam);
    }
}

export {
    RenderEngine,
}
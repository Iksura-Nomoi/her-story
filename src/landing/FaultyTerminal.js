
const VERTEX_SHADER = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform vec3  iResolution;
uniform float uScale;

uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3  uTint;
uniform vec2  uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uPageLoadProgress;
uniform float uUsePageLoadAnimation;
uniform float uBrightness;

float time;

float hash21(vec2 p){
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p)
{
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2;
}

mat2 rotate(float angle)
{
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p)
{
  p *= 1.1;
  float f = 0.0;
  float amp = 0.5 * uNoiseAmp;

  mat2 modify0 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify0 * p * 2.0;
  amp *= 0.454545;

  mat2 modify1 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify1 * p * 2.0;
  amp *= 0.454545;

  mat2 modify2 = rotate(time * 0.08);
  f += amp * noise(p);

  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);

  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

float digit(vec2 p){
    vec2 grid = uGridMul * 15.0;
    vec2 s = floor(p * grid) / grid;
    p = p * grid;
    vec2 q, r;
    float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;

    if(uUseMouse > 0.5){
        vec2 mouseWorld = uMouse * uScale;
        float distToMouse = distance(s, mouseWorld);
        float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
        intensity += mouseInfluence;

        float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
        intensity += ripple;
    }

    if(uUsePageLoadAnimation > 0.5){
        float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
        float cellDelay = cellRandom * 0.8;
        float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);

        float fadeAlpha = smoothstep(0.0, 1.0, cellProgress);
        intensity *= fadeAlpha;
    }

    p = fract(p);
    p *= uDigitSize;

    float px5 = p.x * 5.0;
    float py5 = (1.0 - p.y) * 5.0;
    float x = fract(px5);
    float y = fract(py5);

    float i = floor(py5) - 2.0;
    float j = floor(px5) - 2.0;
    float n = i * i + j * j;
    float f = n * 0.0625;

    float isOn = step(0.1, intensity - f);
    float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);

    return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
}

float onOff(float a, float b, float c)
{
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look)
{
    float y = look.y - mod(iTime * 0.25, 1.0);
    float window = 1.0 / (1.0 + 50.0 * y * y);
    return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

vec3 getColor(vec2 p){

    float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
    bar *= uScanlineIntensity;

    float displacement = displace(p);
    p.x += displacement;

    if (uGlitchAmount != 1.0) {
      float extra = displacement * (uGlitchAmount - 1.0);
      p.x += extra;
    }

    float middle = digit(p);

    const float off = 0.002;
    float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
                digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
                digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));

    vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
    return baseColor;
}

vec2 barrel(vec2 uv){
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main() {
    time = iTime * 0.333333;
    vec2 uv = vUv;

    if(uCurvature != 0.0){
      uv = barrel(uv);
    }

    vec2 p = uv * uScale;
    vec3 col = getColor(p);

    if(uChromaticAberration != 0.0){
      vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
      col.r = getColor(p + ca).r;
      col.b = getColor(p - ca).b;
    }

    col *= uTint;
    col *= uBrightness;

    if(uDither > 0.0){
      float rnd = hash21(gl_FragCoord.xy);
      col += (rnd - 0.5) * (uDither * 0.003922);
    }

    gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex) {
  let h = String(hex).replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h.slice(0, 6), 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`FaultyTerminal shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`FaultyTerminal program link error: ${info}`);
  }
  return program;
}

const DEFAULTS = {
  scale: 1,
  gridMul: [2, 1],
  digitSize: 1.5,
  timeScale: 0.3,
  pause: false,
  scanlineIntensity: 0.3,
  glitchAmount: 1,
  flickerAmount: 1,
  noiseAmp: 0,
  chromaticAberration: 0,
  dither: 0,
  curvature: 0.2,
  tint: '#ffffff',
  mouseReact: true,
  mouseStrength: 0.2,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  pageLoadAnimation: true,
  brightness: 1,
};

export class FaultyTerminal {
    constructor(container, options = {}) {
    if (!container) throw new Error('FaultyTerminal requires a container element');
    this.container = container;
    this.opts = { ...DEFAULTS, ...options };

    this._mouse = { x: 0.5, y: 0.5 };
    this._smoothMouse = { x: 0.5, y: 0.5 };
    this._frozenTime = 0;
    this._rafId = 0;
    this._loadAnimStart = 0;
    this._timeOffset = Math.random() * 100;
    this._running = false;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._loop = this._loop.bind(this);

    this._buildCanvas();
    this._initGL();
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this.container);
    this._resize();
  }

  _buildCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'faulty-terminal-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);
  }

  _initGL() {
    const gl =
      this.canvas.getContext('webgl', { antialias: false, alpha: false }) ||
      this.canvas.getContext('experimental-webgl', { antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL is not available for FaultyTerminal');
    this.gl = gl;

    gl.clearColor(0, 0, 0, 1);

    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.program = program;

    const positions = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const uvs = new Float32Array([0, 0, 2, 0, 0, 2]);

    this._posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    this._uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    this._locPosition = gl.getAttribLocation(program, 'position');
    this._locUv = gl.getAttribLocation(program, 'uv');

    const tintVec = hexToRgb(this.opts.tint);
    const o = this.opts;

    this._u = {
      iTime: gl.getUniformLocation(program, 'iTime'),
      iResolution: gl.getUniformLocation(program, 'iResolution'),
      uScale: gl.getUniformLocation(program, 'uScale'),
      uGridMul: gl.getUniformLocation(program, 'uGridMul'),
      uDigitSize: gl.getUniformLocation(program, 'uDigitSize'),
      uScanlineIntensity: gl.getUniformLocation(program, 'uScanlineIntensity'),
      uGlitchAmount: gl.getUniformLocation(program, 'uGlitchAmount'),
      uFlickerAmount: gl.getUniformLocation(program, 'uFlickerAmount'),
      uNoiseAmp: gl.getUniformLocation(program, 'uNoiseAmp'),
      uChromaticAberration: gl.getUniformLocation(program, 'uChromaticAberration'),
      uDither: gl.getUniformLocation(program, 'uDither'),
      uCurvature: gl.getUniformLocation(program, 'uCurvature'),
      uTint: gl.getUniformLocation(program, 'uTint'),
      uMouse: gl.getUniformLocation(program, 'uMouse'),
      uMouseStrength: gl.getUniformLocation(program, 'uMouseStrength'),
      uUseMouse: gl.getUniformLocation(program, 'uUseMouse'),
      uPageLoadProgress: gl.getUniformLocation(program, 'uPageLoadProgress'),
      uUsePageLoadAnimation: gl.getUniformLocation(program, 'uUsePageLoadAnimation'),
      uBrightness: gl.getUniformLocation(program, 'uBrightness'),
    };

    gl.useProgram(program);
    gl.uniform1f(this._u.uScale, o.scale);
    gl.uniform2fv(this._u.uGridMul, new Float32Array(o.gridMul));
    gl.uniform1f(this._u.uDigitSize, o.digitSize);
    gl.uniform1f(this._u.uScanlineIntensity, o.scanlineIntensity);
    gl.uniform1f(this._u.uGlitchAmount, o.glitchAmount);
    gl.uniform1f(this._u.uFlickerAmount, o.flickerAmount);
    gl.uniform1f(this._u.uNoiseAmp, o.noiseAmp);
    gl.uniform1f(this._u.uChromaticAberration, o.chromaticAberration);
    gl.uniform1f(this._u.uDither, typeof o.dither === 'boolean' ? (o.dither ? 1 : 0) : o.dither);
    gl.uniform1f(this._u.uCurvature, o.curvature);
    gl.uniform3f(this._u.uTint, tintVec[0], tintVec[1], tintVec[2]);
    gl.uniform2f(this._u.uMouse, this._smoothMouse.x, this._smoothMouse.y);
    gl.uniform1f(this._u.uMouseStrength, o.mouseStrength);
    gl.uniform1f(this._u.uUseMouse, o.mouseReact ? 1 : 0);
    gl.uniform1f(this._u.uPageLoadProgress, o.pageLoadAnimation ? 0 : 1);
    gl.uniform1f(this._u.uUsePageLoadAnimation, o.pageLoadAnimation ? 1 : 0);
    gl.uniform1f(this._u.uBrightness, o.brightness);

    if (o.mouseReact) this.container.addEventListener('mousemove', this._onMouseMove);
  }

  _onMouseMove(e) {
    const rect = this.container.getBoundingClientRect();
    this._mouse.x = (e.clientX - rect.left) / rect.width;
    this._mouse.y = 1 - (e.clientY - rect.top) / rect.height;
  }

  _resize() {
    const { gl } = this;
    const dpr = this.opts.dpr;
    const w = Math.max(1, Math.round(this.container.offsetWidth * dpr));
    const h = Math.max(1, Math.round(this.container.offsetHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform3f(this._u.iResolution, w, h, w / h);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._rafId);
  }

  setPaused(paused) {
    this.opts.pause = paused;
  }

  _loop(t) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._loop);
    const { gl, opts } = this;

    if (opts.pageLoadAnimation && this._loadAnimStart === 0) this._loadAnimStart = t;

    if (!opts.pause) {
      const elapsed = (t * 0.001 + this._timeOffset) * opts.timeScale;
      gl.uniform1f(this._u.iTime, elapsed);
      this._frozenTime = elapsed;
    } else {
      gl.uniform1f(this._u.iTime, this._frozenTime);
    }

    if (opts.pageLoadAnimation && this._loadAnimStart > 0) {
      const duration = 2000;
      const progress = Math.min((t - this._loadAnimStart) / duration, 1);
      gl.uniform1f(this._u.uPageLoadProgress, progress);
    }

    if (opts.mouseReact) {
      const damping = 0.08;
      this._smoothMouse.x += (this._mouse.x - this._smoothMouse.x) * damping;
      this._smoothMouse.y += (this._mouse.y - this._smoothMouse.y) * damping;
      gl.uniform2f(this._u.uMouse, this._smoothMouse.x, this._smoothMouse.y);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuffer);
    gl.enableVertexAttribArray(this._locPosition);
    gl.vertexAttribPointer(this._locPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
    gl.enableVertexAttribArray(this._locUv);
    gl.vertexAttribPointer(this._locUv, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    this.stop();
    this._resizeObserver.disconnect();
    if (this.opts.mouseReact) this.container.removeEventListener('mousemove', this._onMouseMove);
    const { gl } = this;
    if (gl) {
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    if (this.canvas.parentElement === this.container) this.container.removeChild(this.canvas);
    this._loadAnimStart = 0;
    this._timeOffset = Math.random() * 100;
  }
}

export default FaultyTerminal;

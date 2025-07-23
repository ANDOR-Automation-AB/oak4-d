const socket = new WebSocket("ws://localhost:5000");
socket.binaryType = "arraybuffer";

const vertexSource = `
    precision mediump float;
    attribute vec3 aPosition;
    attribute vec3 aColor;
    varying vec3 vColor;

    void main() {
        gl_PointSize = 2.0;
        gl_Position = vec4(aPosition / 1500.0, 1.0);
        vColor = aColor;
    }
`;

const fragmentSource = `
    precision mediump float;
    varying vec3 vColor;

    void main() {
        gl_FragColor = vec4(vColor, 1.0);
    }
`;

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl");

if (!gl) alert("WebGL is not supported");
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
gl.viewport(0, 0, canvas.width, canvas.height);


const shaderProgram = gl.createProgram();
const vertexShader = gl.createShader(gl.VERTEX_SHADER);
const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);

gl.shaderSource(vertexShader, vertexSource);
gl.compileShader(vertexShader);
gl.attachShader(shaderProgram, vertexShader);

gl.shaderSource(fragmentShader, fragmentSource);
gl.compileShader(fragmentShader);
gl.attachShader(shaderProgram, fragmentShader);

gl.linkProgram(shaderProgram);
gl.useProgram(shaderProgram);


const buffer = gl.createBuffer();
const aPosition = gl.getAttribLocation(shaderProgram, "aPosition");
const aColor = gl.getAttribLocation(shaderProgram, "aColor");

gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);

gl.enableVertexAttribArray(aColor);
gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);


let points = 0;
let id = [];
socket.onmessage = (e) => {
    const data = new Float32Array(e.data);
    const cloud = data.filter((_, i) => i % 7 !== 6);
    id = data.filter((_, i) => i % 7 === 6);

    points = cloud.length / 6;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, cloud, gl.DYNAMIC_DRAW);
};

function render() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, points);
    requestAnimationFrame(render);
}
requestAnimationFrame(render);


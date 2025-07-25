
let cloud = new Float32Array();
let mouseX = 0, mouseY = 0;

// init shaders //

const vertexSource = `
    precision mediump float;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    attribute vec3 aPosition;
    attribute vec3 aColor;
    varying vec3 vColor;

    void main() {
        gl_PointSize = 2.0;
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
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

// init gl canvas //

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl");
const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;
const vec4 = glMatrix.vec4;

if (!gl) alert("WebGL is not supported");
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
gl.viewport(0, 0, canvas.width, canvas.height);

// init gl program //

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

// init floor //

const floorSize = 2000;
const floorDivisions = 20;
const floorZ = 1100;
const floorVertices = [];
for (let i = 0; i < floorDivisions; i++) {
    for (let j = 0; j < floorDivisions; j++) {
        const x0 = -floorSize/2 + i * floorSize / floorDivisions;
        const x1 = -floorSize/2 + (i+1) * floorSize / floorDivisions;
        const y0 = -floorSize/2 + j * floorSize / floorDivisions;
        const y1 = -floorSize/2 + (j+1) * floorSize / floorDivisions;
        const r = 0.0;
        const g = 1.0;
        const b = 0.0;

        // två trianglar per ruta
        floorVertices.push(x0, y0, floorZ,  r, g, b);
        floorVertices.push(x1, y0, floorZ,  r, g, b);
        floorVertices.push(x1, y1, floorZ,  r, g, b);

        floorVertices.push(x0, y0, floorZ,  r, g, b);
        floorVertices.push(x1, y1, floorZ,  r, g, b);
        floorVertices.push(x0, y1, floorZ,  r, g, b);
    }
}
const floorArray = new Float32Array(floorVertices);

// create buffer //

const buffer = gl.createBuffer();
const aPosition = gl.getAttribLocation(shaderProgram, "aPosition");
const aColor = gl.getAttribLocation(shaderProgram, "aColor");

gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);

gl.enableVertexAttribArray(aColor);
gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);

// buffer för att rita golv
const floorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, floorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, floorArray, gl.STATIC_DRAW);

// init camera //

const uProjectionMatrix = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
const uViewMatrix = gl.getUniformLocation(shaderProgram, "uViewMatrix");
const projectionMatrix = mat4.create();
const viewMatrix = mat4.create();

class Direction {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static fromPoints(from, to) {
        return new Direction(to.x - from.x, to.y - from.y, to.z - from.z);
    }

    static fromArray(arr) {
        return new Direction(arr[0], arr[1], arr[2]);
    }

    negate() {
        return new Direction(-this.x, -this.y, -this.z);
    }

    toArray() {
        return [this.x, this.y, this.z];
    }

    normalize() {
        const length = Math.hypot(this.x, this.y, this.z);
        return new Direction(this.x / length, this.y / length, this.z / length);
    }

    right(up) {
        const rx = this.y * up.z - this.z * up.y;
        const ry = this.z * up.x - this.x * up.z;
        const rz = this.x * up.y - this.y * up.x;
        const length = Math.hypot(rx, ry, rz);
        return new Direction(rx / length, ry / length, rz / length);
    }
}

let camera = {
    position:    { x: 2000, y: 2000, z: -2000 },
    target:      { x: 0,    y: 0,    z: 0     },
    up:          { x: 0,    y: 0,    z: -1,   },
    fov:         Math.PI / 4,
    near:        1,
    far:         10000,
    speed:       50,
    sensitivity: 0.005,

    get aspect() {
        return canvas.width / canvas.height;
    },
    get getPosition() {
        return [this.position.x, this.position.y, this.position.z];
    },
    get getTarget() {
        return [this.target.x, this.target.y, this.target.z];
    },
    get getUp() {
        return [this.up.x, this.up.y, this.up.z];
    },
    get getDirection() {
        return Direction.fromPoints(this.position, this.target).normalize();
    },
    get getRight() {
        const direction = this.getDirection;
        return direction.right(this.up);
    },

    move(direction, pan = true) {
        this.position.x += direction.x * this.speed;
        this.position.y += direction.y * this.speed;
        this.position.z += direction.z * this.speed;
        if (pan) this.pan(direction);
    },
    pan(direction) {
        this.target.x += direction.x * this.speed;
        this.target.y += direction.y * this.speed;
        this.target.z += direction.z * this.speed;
    },
    rotate(yaw, pitch) {
        const direction = this.getDirection;
        const right = this.getRight;
        const up = this.getUp;
        
        const yawMatrix = mat4.create();
        mat4.rotate(yawMatrix, yawMatrix, yaw * this.sensitivity, up);
        
        const pitchMatrix = mat4.create();
        mat4.rotate(pitchMatrix, pitchMatrix, pitch * this.sensitivity, right.toArray());

        const rotation = mat4.create();
        mat4.multiply(rotation, yawMatrix, pitchMatrix);

        const directionVec = vec3.fromValues(direction.x, direction.y, direction.z);
        vec3.transformMat4(directionVec, directionVec, rotation);

        this.target.x = this.position.x + directionVec[0];
        this.target.y = this.position.y + directionVec[1];
        this.target.z = this.position.z + directionVec[2];
    },
    update() {
        mat4.lookAt(viewMatrix,
            this.getPosition,
            this.getTarget,
            this.getUp
        );
    }
}

mat4.perspective(projectionMatrix,
    camera.fov,
    camera.aspect,
    camera.near,
    camera.far
);

camera.update();

// init socket //

const socket = new WebSocket("ws://localhost:5000");
let structuredPoints = [];
let points = 0;
let id = [];
socket.binaryType = "arraybuffer";
socket.onmessage = (e) => {
    const data = new Float32Array(e.data);
    const cloud = data.filter((_, i) => i % 7 !== 6);
    id = data.filter((_, i) => i % 7 === 6);

    points = cloud.length / 6;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, cloud, gl.DYNAMIC_DRAW);

    // ge punktinformation med koordinater och id
    structuredPoints = [];
    for (let i = 0; i < points; i++) {
        const x = cloud[i * 6 + 0];
        const y = cloud[i * 6 + 1];
        const z = cloud[i * 6 + 2];
        const r = cloud[i * 6 + 3];
        const g = cloud[i * 6 + 4];
        const b = cloud[i * 6 + 5];
        const pointId = id[i];
        structuredPoints.push({
            id: pointId,
            x, y, z,
            r, g, b
        });
    }
};

// render loop //

function render() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(uViewMatrix, false, viewMatrix);

    // rita grön matta
    gl.bindBuffer(gl.ARRAY_BUFFER, floorBuffer);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.TRIANGLES, 0, floorArray.length / 6);

    // rita punkter
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.POINTS, 0, points);

    // uppdatera världskoordinatera för punktinfo
    const mvp = mat4.create();
    mat4.multiply(mvp, projectionMatrix, viewMatrix);
    for (let i = 0; i < structuredPoints.length; i++) {
        const point = structuredPoints[i];
        const worldPosition = vec4.fromValues(point.x, point.y, point.z, 1.0);
        const clipSpace = vec4.create();
        vec4.transformMat4(clipSpace, worldPosition, mvp);

        const ndcX = clipSpace[0] / clipSpace[3];
        const ndcY = clipSpace[1] / clipSpace[3];

        point.screenX = (ndcX * 0.5 + 0.5) * canvas.width;
        point.screenY = (1.0 - (ndcY * 0.5 + 0.5)) * canvas.height;
    }

    requestAnimationFrame(render);
}
requestAnimationFrame(render);

// events //

let isDragging = false;
let lastX, lastY;

canvas.addEventListener("mousedown", e => {

    // aktivera rotera vid rörelse
    if (e.button === 0) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    }
});
canvas.addEventListener("mouseup", e => {
    if (e.button === 0) isDragging = false;
});
canvas.addEventListener("mousemove", e => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // uppdatera pekarkoordinater
    let closest = null;
    let minDist = Infinity;
    const maxDist = 20;
    for (let i = 0; i < structuredPoints.length; i++) {
        const p = structuredPoints[i];
        const dx = p.screenX - mouseX;
        const dy = p.screenY - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist && dist < maxDist) {
            minDist = dist;
            closest = p;
        }
    }
    const infoBox = document.getElementById("hover-info");
    if (closest) {
        infoBox.style.display = "block";
        infoBox.style.left = (mouseX + 15) + "px";
        infoBox.style.top = (mouseY + 15) + "px";
        infoBox.innerHTML = `
            <b>ID:</b> ${closest.id}<br>
            <b>X:</b> ${closest.x.toFixed(2)}<br>
            <b>Y:</b> ${closest.y.toFixed(2)}<br>
            <b>Z:</b> ${closest.z.toFixed(2)}
        `;
    } else {
        infoBox.style.display = "none";
    }

    // rotera vid rörelse om aktiv
    if (!isDragging) return;
    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    camera.rotate(-deltaX, -deltaY);
    camera.update();
});

window.addEventListener("keydown", (e) => {
    const direction = camera.getDirection;
    const right = camera.getRight;
    switch (e.key) {
        case "w":
        case "ArrowUp":
            camera.move(direction);
            break;
        case "s":
        case "ArrowDown":
            camera.move(direction.negate());
            break;
        case "d":
        case "ArrowRight":
            camera.move(right);
            break;
        case "a":
        case "ArrowLeft":
            camera.move(right.negate());
            break;
        case "z":
            camera.move(Direction.fromArray([0, 0, 1]));
            break;
        case "x":
            camera.move(Direction.fromArray([0, 0, -1]));
            break;
    }
    camera.update();
});

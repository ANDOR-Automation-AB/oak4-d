import depthai as dai
import websockets
import webbrowser
from aiohttp import web
import asyncio
import os
import numpy as np

BASE = os.path.abspath(os.path.dirname(__file__))
CLIENT = os.path.join(BASE, "index.html")

async def sendSnapshot(socket):
    with dai.Pipeline() as pipeline:
        node = pipeline.create(dai.node.RGBD).build(
            autocreate=True,
            size=(640, 400)
        )
        outputQueue = node.pcl.createOutputQueue()
        pipeline.start()
        while True:
            pointsCloud = outputQueue.get()
            positions, colors = pointsCloud.getPointsRGB()
            colors = colors[:, :3].astype(np.float32) / 255.0
            id = np.arange(len(positions), dtype=np.float32).reshape(-1, 1)
            stack = np.hstack((positions, colors, id))
            await socket.send(stack.tobytes())

async def main():
    webbrowser.open(CLIENT)
    async with websockets.serve(sendSnapshot, "0.0.0.0", 5000):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())

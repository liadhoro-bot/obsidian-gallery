import assert from 'node:assert/strict'
import {
  getContainImageMetrics,
  renderedPointToImagePoint,
  rgbToHex,
  sampleRegion,
} from '../components/color-sampler/color-sampling-utils'

type TestImageData = {
  width: number
  height: number
  data: Uint8ClampedArray
}

function makeImageData(
  width: number,
  height: number,
  fill: [number, number, number, number]
) {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    data[offset] = fill[0]
    data[offset + 1] = fill[1]
    data[offset + 2] = fill[2]
    data[offset + 3] = fill[3]
  }

  return { width, height, data } as TestImageData as ImageData
}

function setPixel(
  imageData: TestImageData,
  x: number,
  y: number,
  color: [number, number, number, number]
) {
  const offset = (y * imageData.width + x) * 4
  imageData.data[offset] = color[0]
  imageData.data[offset + 1] = color[1]
  imageData.data[offset + 2] = color[2]
  imageData.data[offset + 3] = color[3]
}

assert.equal(rgbToHex({ r: 0, g: 168, b: 160 }), '#00A8A0')
assert.equal(rgbToHex({ r: -4, g: 260, b: 15 }), '#00FF0F')

{
  const metrics = getContainImageMetrics({
    canvasWidth: 400,
    canvasHeight: 400,
    imageWidth: 800,
    imageHeight: 400,
  })

  assert.deepEqual(
    {
      left: metrics.renderedLeft,
      top: metrics.renderedTop,
      width: metrics.renderedWidth,
      height: metrics.renderedHeight,
    },
    { left: 0, top: 100, width: 400, height: 200 }
  )
  assert.deepEqual(renderedPointToImagePoint({ x: 200, y: 200 }, metrics), {
    x: 400,
    y: 200,
  })
  assert.equal(renderedPointToImagePoint({ x: 200, y: 50 }, metrics), null)
}

{
  const metrics = getContainImageMetrics({
    canvasWidth: 300,
    canvasHeight: 500,
    imageWidth: 100,
    imageHeight: 200,
  })

  assert.deepEqual(renderedPointToImagePoint({ x: 150, y: 250 }, metrics), {
    x: 50,
    y: 100,
  })
  assert.deepEqual(renderedPointToImagePoint({ x: 25, y: 0 }, metrics), {
    x: 0,
    y: 0,
  })
  assert.deepEqual(renderedPointToImagePoint({ x: 275, y: 500 }, metrics), {
    x: 99,
    y: 199,
  })
}

{
  const imageData = makeImageData(5, 5, [10, 20, 30, 255])
  assert.deepEqual(sampleRegion(imageData, 2, 2, 1), { r: 10, g: 20, b: 30 })
  assert.deepEqual(sampleRegion(imageData, 0, 0, 2), { r: 10, g: 20, b: 30 })
  assert.deepEqual(sampleRegion(imageData, 4, 4, 2), { r: 10, g: 20, b: 30 })
}

{
  const imageData = makeImageData(7, 7, [40, 80, 120, 255]) as unknown as TestImageData
  setPixel(imageData, 3, 3, [255, 255, 255, 255])
  assert.deepEqual(sampleRegion(imageData as unknown as ImageData, 3, 3, 3), {
    r: 40,
    g: 80,
    b: 120,
  })
}

{
  const imageData = makeImageData(3, 3, [0, 0, 0, 0]) as unknown as TestImageData
  setPixel(imageData, 1, 1, [12, 34, 56, 255])
  assert.deepEqual(sampleRegion(imageData as unknown as ImageData, 1, 1, 1), {
    r: 12,
    g: 34,
    b: 56,
  })

  const transparent = makeImageData(2, 2, [0, 0, 0, 0])
  assert.equal(sampleRegion(transparent, 0, 0, 1), null)
}

console.log('color-sampling-utils tests passed')

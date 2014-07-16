var PI2 = 2 * Math.PI


function scaleCanvas(el, width, height) {
  var dpr = window.devicePixelRatio || 1
  if (el.width == width * dpr && el.height == height * dpr) {
    return false
  }

  el.width = width * dpr
  el.style.width = width + 'px'
  el.height = height * dpr
  el.style.height = height + 'px'
  return true
}


function CubeStormScene() {
  model = new seen.Model()
  model.add(seen.Lights.directional({
    normal: seen.P(0, -200, 0).normalize(),
    intensity: 0.01
  }))

  var black = new seen.Material(seen.Colors.rgb(30, 30, 30, 200))

  var c = 5
  var d = 200
  var m = d / c
  for (var x = -c; x < c; x++) {
    for (var y = -c; y < c; y++) {
      shape = seen.Shapes.cube()
        .scale(3 + Math.random() * m)
        .translate(x * m, y * m, Math.random() * 2 * d - d)
        shape.fill(black)
      model.add(shape)
    }
  }

  var scene = new seen.Scene({
    model: model,
    fractionalPoints: true,
    shader: seen.Shaders.diffuse()
  })

  scene.camera.translate(20, 0)

  return scene
}


function LogoScene() {
  function CirclePainter() {}
  CirclePainter.prototype.paint = function(renderModel, context) {
    // circles are represented as two points, one at the origin, and one a
    // radius distance away. we measure the projected radius by calculating
    // the distance between the points.
    //
    // this painter creates paths but does not fill or complete them, since
    // CanvasClipLayer requires a complete path of the shapes to do the
    // composite operation.
    var ps = renderModel.projected.points
    var diff = ps[0].copy().subtract(ps[1])
    var radius = Math.sqrt(diff.dot(diff))
    var painter = context.circle()
    var p = ps[0]
    context.ctx.moveTo(p.x + radius, p.y)
    context.ctx.arc(p.x, p.y, radius, 0, PI2, true)
  }

  var circlePainter = new CirclePainter()
  var model = new seen.Model()

  function makeSphere(r, x, y, z) {
    surface = new seen.Surface([seen.P(x, y, z), seen.P(x, y + r, z)], circlePainter)
    var shape = new seen.Shape('body', [surface])
    model.add(shape)
  }

  var size = 74
  var dist = 157
  makeSphere(size, 0, 0, 0)
  for (var step = 1; step <= 6; step++) {
    var a = PI2 / (6 / step)
    makeSphere(size, dist * Math.cos(a), dist * Math.sin(a), 0)
  }

  var scene = new seen.Scene({
    model: model,
    cullBackfaces: false,
    fractionalPoints: true,
    shader: seen.Shaders.flat()
  })

  // flatten the perspective effect a bit on the spheres.
  //
  // I found this resource very helpful for grokking perspective transform
  // matrices:
  // http://www.scratchapixel.com/lessons/3d-advanced-lessons/perspective-and-orthographic-projection-matrix/perspective-projection-matrix/
  scene.camera.projection = scene.camera.projection.copy()
  scene.camera.projection.m[14] = -.5
  scene.camera.projection.m[15] = .5

  return scene
}


function CanvasClipLayer(clipScene, insideScene) {
  this.clipScene = new seen.SceneLayer(clipScene)
  this.insideScene = new seen.SceneLayer(insideScene)
}
CanvasClipLayer.prototype.render = function(context) {
  var ctx = context.ctx
  this.insideScene.render(context)
  ctx.save()
  ctx.beginPath()
  this.clipScene.render(context)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fill()
  ctx.restore()
}


function cubeSpinner() {
  var parentEl = document.getElementById('spinner')
  var logoEl = document.getElementById('logo')

  var cubesScene = CubeStormScene()
  cubesScene.camera.bake()
  var logoScene = LogoScene()
  logoScene.camera.bake()
  var context = seen.Context(logoEl)
  context.layer(new CanvasClipLayer(logoScene, cubesScene))

  var baseSpeed = 2
  var maxSpeed = 1000
  var av = baseSpeed * 10

  // initial spin
  for (var i = 1; i <= 10; i++) {
    setTimeout(function(i) {
      av = baseSpeed + i * baseSpeed * 10
    }.bind(null, i), 500 + i * 25)
  }

  function resize() {
    var width = parentEl.clientWidth
    var height = Math.min(width, parentEl.clientHeight)

    if (!scaleCanvas(logoEl, width, height)) {
      // if no size change, skip viewport updating.
      return
    }

    // default canvas size is 475. this is fairly arbitrary, derived via
    // massaging the numbers until things fit.
    var scaling = Math.min(900, Math.min(logoEl.height, logoEl.width)) / 475
    cubesScene.viewport = logoScene.viewport = seen.Viewports.center(logoEl.width, logoEl.height)
    cubesScene.camera.reset().scale(scaling)
    logoScene.camera.reset().scale(scaling)
  }
  resize()
  window.addEventListener('resize', resize, false)


  //
  // commence framerate autoscaling voodoo >:)
  //

  var start = Date.now()
  var targetFPS = 60
  var lastFPS = []
  for (var i = 0; i < 10; i++) {
    lastFPS.push(60)
  }
  var timeout

  // exempt framerate drops for the first 500ms
  var interactTime = Date.now() + 500

  function frame(maxFramerate) {
    // skip frame if we're in a hidden tab
    if (document.hidden || document.webkitHidden || document.mozHidden || document.oHidden || document.msHidden) {
      timeout = setTimeout(frame, 100)
      return
    }

    document.body.classList.toggle('scrolled', window.scrollY > 50)

    // skip frame if scrolled down
    var belowFold = window.scrollY > logoEl.clientHeight
    document.body.classList.toggle('below-fold', belowFold)
    if (belowFold) {
      timeout = setTimeout(frame, 100)
      return
    }

    var lastStart = start
    start = Date.now()
    var step = start - lastStart

    var actualFPS = 1000 / step
    lastFPS.shift()
    lastFPS.push(actualFPS)

    // kick up framerate if the user interacted
    if (start - interactTime < 1000) {
      targetFPS = 60
    } else {
      // scale framerate based on rotational velocity
      targetFPS = Math.min(targetFPS, Math.max(12, Math.abs(av / 6) * 60))

      // if the last frames all fell 5 FPS below our target,
      // reduce the target to the average framerate.
      if (Math.max.apply(Math, lastFPS) < targetFPS - 5) {
        var sum = 0
        for (var i = 0; i < lastFPS.length; i++){
          sum += lastFPS[i]
        }
        targetFPS = sum / lastFPS.length
      }

      // slowly try to increase framerate
      targetFPS = Math.min(60, targetFPS * 1.05)
    }

    // threshold rotation
    av = Math.min(maxSpeed, Math.max(-maxSpeed, av))

    // drag
    if (Math.abs(av) > 1) {
      av = .99 * av
    }

    // slowly rotate if idling
    if (av < baseSpeed) {
      av += .1
    }

    // rotate and render based on the frame's time step
    var rot = av * step / 100000
    cubesScene.model.roty(rot).rotx(rot/5).rotz(rot/5)
    logoScene.model.roty(rot)
    context.render()

    // cut framerate to maximum render speed (if slow)
    var renderTime = Date.now() - start
    var maxFPS = 1000 / renderTime
    targetFPS = Math.min(maxFPS, targetFPS)

    if (timeout) {
      clearTimeout(timeout)
    }
    if (targetFPS >= 60) {
      requestAnimationFrame(frame)
    } else {
      var targetWait = 1000 / targetFPS - renderTime
      timeout = setTimeout(frame, targetWait)
    }
  }

  // hack! seen's mouse events helper indiscriminately swallows the event.
  // we need to prevent it here to allow for scrolling :(
  var oldMouseMove = seen.MouseEvents.prototype._onMouseMove
  seen.MouseEvents.prototype._onMouseMove = function(e) {
    e.preventDefault = function() {}
    oldMouseMove.call(this, e)
  }

  var dragger = new seen.Drag(document.getElementById('spinner'))
  dragger.on('drag', function(e) {
    var dx = e.offsetRelative[0] * 20
    av = (av * 2 + dx) / 3
    interactTime = Date.now()
  })

  frame()
}


function sideLogo() {
  var el = document.getElementById('side-logo')
  var canvas = document.createElement('canvas')
  el.appendChild(canvas)

  // force a fade-in
  el.style.transition = 'none'
  el.style.opacity = 0
  el.offsetHeight
  el.style.transition = null
  el.style.opacity = null

  var logoScene = LogoScene()
  var context = seen.Context(canvas, logoScene)

  var width = el.clientWidth
  var height = el.clientHeight
  scaleCanvas(canvas, width, height)
  logoScene.viewport = seen.Viewports.center(canvas.width, canvas.height)
  logoScene.camera.scale(canvas.width / 500)

  var targetFPS = 5
  var ctx = context.ctx
  setInterval(function() {
    logoScene.model.roty(PI2 / (60 * targetFPS))
    ctx.save()
    ctx.beginPath()
    context.render()
    ctx.closePath()
    ctx.strokeStyle = 'rgba(0, 0, 0, .5)'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.fillStyle = 'rgba(230, 230, 230, .85)'
    ctx.fill()
    ctx.restore()
  }, 1000 / targetFPS)
}


function topColorBars() {
  var el = document.getElementsByClassName('color-bars')[0]

  var base = Math.round(Math.random() * 360)
  var mul = 10 + Math.round(Math.random() * 30)

  for (var i = 0; i < 6; i++) {
    var bar = document.createElement('div')
    bar.className = 'bar'
    bar.style.backgroundColor = 'hsl(' + (base + (i * mul)) % 360 + ', 70%, 60%)'
    el.appendChild(bar)
  }
}

function bottomColorBars() {
  var bottomColorsEl = document.getElementsByClassName('color-bars')[0].cloneNode(true)
  document.getElementsByTagName('footer')[0].appendChild(bottomColorsEl)
  sizeFooter()
}


function sizePage() {
  // I'd love to use vmin units instead of this hack, but the way mobile Chrome
  // hides the top bar upon scroll alters the vh, causing an annoying resize.
  var el = document.getElementById('title-page')
  var ih = window.innerHeight
  var iw = window.innerWidth

  if (el.lastWidth && Math.abs(iw - el.lastWidth) < 200) {
    // ignore small changes (such as the chrome top bar)
    return
  }

  el.lastWidth = iw

  if (document.body.classList.contains('front')) {
    el.style.height = ih + 'px'
  }
  el.style.fontSize = Math.min(iw, ih) / 100 + 'px'

  sizeFooter()
}


function sizeFooter() {
  var barsEl = document.querySelector('footer .color-bars')
  if (barsEl) {
    barsEl.style.fontSize = document.getElementById('title-page').style.fontSize
  }
}


sizePage()
window.addEventListener('resize', sizePage, false)

setTimeout(topColorBars, 0)
if (document.body.classList.contains('front')) {
  setTimeout(cubeSpinner, 0)
}

window.addEventListener('load', function() {
  setTimeout(sideLogo, 0)
  setTimeout(bottomColorBars, 0)
}, false)

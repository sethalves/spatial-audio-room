

import { fastAtan2 } from './hifi-audio.js'


/**
 * Class for managing 2D visualization/interaction for audio demos.
 * @param {Object} canvas
 * @param {Object} elements
 * @param {Function} callbackFunc
 */
export function CanvasControl(canvas, elements, usernames, callbackFunc, background) {
  this._canvas = canvas;
  this._usernames = usernames;
  this._elements = elements;
  this._callbackFunc = callbackFunc;

  this._context = this._canvas.getContext('2d');
  this._cursorDown = false;

  this._selected = {
    index: -1,
    xOffset: 0,
    yOffset: 0,
  };

  this._lastMoveEventTime = 0;
  this._minimumThreshold = 16;
  let that = this;

  if (background) {
      this._background = new Image();
      this._background.onload = function() {
          // ctx.drawImage(img, 0, 0);
      }
      this._background.src = background;
  }

  canvas.addEventListener('touchstart', function(event) {
    return that._cursorDownFunc(event);
  });

  canvas.addEventListener('mousedown', function(event) {
    return that._cursorDownFunc(event);
  });

  canvas.addEventListener('touchmove', function(event) {
    let currentEventTime = Date.now();
    if (currentEventTime - that._lastMoveEventTime > that._minimumThreshold) {
      that._lastMoveEventTime = currentEventTime;
      if (that._cursorMoveFunc(event)) {
        event.preventDefault();
      }
    }
  }, true);

  canvas.addEventListener('mousemove', function(event) {
    let currentEventTime = Date.now();
    if (currentEventTime - that._lastMoveEventTime > that._minimumThreshold) {
      that._lastMoveEventTime = currentEventTime;
      that._cursorMoveFunc(event);
    }
  });

  document.addEventListener('touchend', function(event) {
    that._cursorUpFunc(event);
  });

  document.addEventListener('mouseup', function(event) {
    that._cursorUpFunc(event);
  });

  window.addEventListener('resize', function(event) {
    that.resize();
    //that.draw();
  }, false);

  this.invokeCallback();
  this.resize();
  //this.draw();
}

CanvasControl.prototype.invokeCallback = function() {
  if (this._callbackFunc !== undefined) {
    this._callbackFunc(this._elements);
  }
};

function absorbEvent(event) {
    let e = event || window.event;
    e.preventDefault && e.preventDefault();
    e.stopPropagation && e.stopPropagation();
    e.cancelBubble = true;
    e.returnValue = false;
    // e.stopImmediatePropagation && e.stopImmediatePropagation();
    // e.stopPropagation && e.stopPropagation();
    return false;
}


function getAbsoluteHeight(eltID) {
    let elm = document.getElementById(eltID);
    let elmHeight = parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('height'));
    let elmMargin = parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('margin-top')) +
        parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('margin-bottom'));
    return (elmHeight+elmMargin);
}

function getAbsoluteWidth(eltID) {
    let elm = document.getElementById(eltID);
    let elmWidth = parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('width'));
    let elmMargin = parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('margin-left')) +
        parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('margin-right'));
    return (elmWidth+elmMargin);
}


CanvasControl.prototype.resize = function() {
    // let canvasWidth = this._canvas.parentNode.clientWidth;
    // let canvasHeight = this._canvas.parentNode.clientHeight;

    let dpr = window.devicePixelRatio || 1;

    // console.log("dpr -- dpr=" + JSON.stringify(dpr));

    let screenSize = window.innerWidth * dpr;
    if (screenSize > window.innerHeight * dpr) {
        screenSize = window.innerHeight * dpr;
    }

    // console.log("dpr -- screenSize=" + JSON.stringify(screenSize));

    let windowWidth = Math.floor(window.innerWidth * dpr);
    let windowHeight = Math.floor(window.innerHeight * dpr);

    // console.log("dpr -- window-size=" + JSON.stringify([windowWidth, windowHeight]));

    // console.log("dpr -- controls-width=" + JSON.stringify(getAbsoluteWidth('controls-and-rooms')));
    // console.log("dpr -- top-bar-height=" + JSON.stringify(getAbsoluteHeight('top-bar')));

    // let canvasWidth = windowWidth - getAbsoluteWidth('controls-and-rooms') * dpr - 40 * dpr;
    let canvasWidth = getAbsoluteWidth('controls-and-rooms') * dpr /*- 40 * dpr*/;
    let canvasHeight = windowHeight - getAbsoluteHeight('controls-and-rooms') * dpr - 40 * dpr;

    // console.log("dpr -- canvas-size=" + JSON.stringify([canvasWidth, canvasHeight]));

//    if (canvasWidth < canvasHeight) {
        this._canvas.width = canvasWidth / dpr;
        this._canvas.height = canvasWidth / dpr;
        // console.log("dpr -- setting canvas square: " + JSON.stringify([canvasWidth, canvasWidth]));
//    } else {
//        this._canvas.width = canvasHeight / dpr;
//        this._canvas.height = canvasHeight / dpr;
//        // console.log("dpr -- setting canvas square: " + JSON.stringify([canvasHeight, canvasHeight]));
//    }
};

CanvasControl.prototype.draw = function() {
  this._context.globalAlpha = 1;
  this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
  this._context.strokeRect(0, 0, canvas.width, canvas.height);

  if (this._background) {
      this._context.drawImage(this._background, 0, 0, canvas.width, canvas.height);
  }

  for (let i = 0; i < this._elements.length; i++) {
    let icon = document.getElementById(this._elements[i].icon);
    if (icon !== undefined) {
      let radiusInPixels = this._elements[i].radius * this._canvas.width;
      let x = this._elements[i].x * this._canvas.width - radiusInPixels;
      let y = this._elements[i].y * this._canvas.height - radiusInPixels;
      this._context.globalAlpha = this._elements[i].alpha;

      this._context.save();
      this._context.translate(this._elements[i].x * this._canvas.width, this._elements[i].y * this._canvas.height);
      this._context.rotate(this._elements[i].o);
      this._context.translate(-this._elements[i].x * this._canvas.width, -this._elements[i].y * this._canvas.height);
      this._context.drawImage(icon, x, y, radiusInPixels * 2, radiusInPixels * 2);
      this._context.restore();

      let uid = this._elements[i].uid;
      if (this._usernames[uid] !== undefined) {
        this._context.font = '20px Arial';
        this._context.textAlign = 'center';
        this._context.fillText(this._usernames[uid], this._elements[i].x * this._canvas.width, y);
      }
    }
  }
  requestAnimationFrame((t) => this.draw());
};

CanvasControl.prototype.getCursorPosition = function(event) {
  let cursorX;
  let cursorY;
  let rect = this._canvas.getBoundingClientRect();
  if (event.touches !== undefined) {
    cursorX = event.touches[0].clientX;
    cursorY = event.touches[0].clientY;
  } else {
    cursorX = event.clientX;
    cursorY = event.clientY;
  }
  return {
    x: cursorX - rect.left,
    y: cursorY - rect.top,
  };
};

CanvasControl.prototype.getNearestElement = function(cursorPosition) {
  let minDistance = 1e8;
  let minIndex = -1;
  let minXOffset = 0;
  let minYOffset = 0;
  for (let i = 0; i < this._elements.length; i++) {
    if (this._elements[i].clickable == true) {
      let dx = this._elements[i].x * this._canvas.width - cursorPosition.x;
      let dy = this._elements[i].y * this._canvas.height - cursorPosition.y;
      let distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance.
      if (distance < minDistance &&
          distance < 2 * this._elements[i].radius * this._canvas.width) {
        minDistance = distance;
        minIndex = i;
        minXOffset = dx;
        minYOffset = dy;
      }
    }
  }
  return {
    index: minIndex,
    xOffset: minXOffset,
    yOffset: minYOffset,
  };
};

CanvasControl.prototype._cursorUpdateFunc = function(cursorPosition) {

  if (this._selected.index > -1) {
    this._elements[this._selected.index].x = Math.max(0, Math.min(1,
      (cursorPosition.x + this._selected.xOffset) / this._canvas.width));
    this._elements[this._selected.index].y = Math.max(0, Math.min(1,
      (cursorPosition.y + this._selected.yOffset) / this._canvas.height));
    this.invokeCallback();
  } else {
    // rotate listener to lookat(cursorPosition)
    let i = this._elements.findIndex(e => e.clickable === true);
    let dx = cursorPosition.x - this._elements[i].x * this._canvas.width;
    let dy = cursorPosition.y - this._elements[i].y * this._canvas.height;
    this._elements[i].o = fastAtan2(dx, -dy);
    this.invokeCallback();
  }
  //this.draw();
};

CanvasControl.prototype._cursorDownFunc = function(event) {
  this._cursorDown = true;
  let cursorPosition = this.getCursorPosition(event);
  this._selected = this.getNearestElement(cursorPosition);
  this._cursorUpdateFunc(cursorPosition);
  return absorbEvent(event);
};

CanvasControl.prototype._cursorUpFunc = function(event) {
  this._cursorDown = false;
  this._selected.index = -1;
};

CanvasControl.prototype._cursorMoveFunc = function(event) {
  let cursorPosition = this.getCursorPosition(event);
  let selection = this.getNearestElement(cursorPosition);
  if (this._cursorDown == true) {
    this._cursorUpdateFunc(cursorPosition);
  }
  if (selection.index > -1) {
    this._canvas.style.cursor = 'pointer';
    return true;
  } else {
    this._canvas.style.cursor = 'default';
    return false;
  }
};

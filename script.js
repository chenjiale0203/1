"use strict";
window.onload = function() {

// coefficient of r,g,b components for B/W level calculation
  const RCOEFF = 3;
  const GCOEFF = 10;
  const BCOEFF = 1;
  const WHITE  = (RCOEFF + GCOEFF + BCOEFF) * 255;

  let cMap = {};  // to encapsulate all datas relating to color map

  let destCtx, destCanvas;

  let events = [];          // events queue for animation

  let ui;  // container for user interface elements (except color map)
  let uiv; // container for user interface values

  let imgSrc; // source image
  let resizedImg;
  let bwImg;
  let blurImg; // Array of Uint32Arrays

  let tbInterleave;

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

/* shortcuts for Math */

  const mrandom = Math.random;
  const mfloor = Math.floor;
  const mround = Math.round;
  const mceil = Math.ceil;
  const mabs = Math.abs;
  const mmin = Math.min;
  const mmax = Math.max;

  const mPI = Math.PI;
  const mPIS2 = Math.PI / 2;
  const m2PI = Math.PI * 2;
  const msin = Math.sin;
  const mcos = Math.cos;
  const matan2 = Math.atan2;
  const mexp = Math.exp;

  const mhypot = Math.hypot;
  const msqrt = Math.sqrt;

//-----------------------------------------------------------------------------
// miscellaneous functions
//-----------------------------------------------------------------------------

  function alea (min, max) {
// random number [min..max[ . If no max is provided, [0..min[

    if (typeof max == 'undefined') return min * mrandom();
    return min + (max - min) * mrandom();
  }

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  function intAlea (min, max) {
// random integer number [min..max[ . If no max is provided, [0..min[

    if (typeof max == 'undefined') {
      max = min; min = 0;
    }
    return mfloor(min + (max - min) * mrandom());
  } // intAlea

//--------------------------------------------------------------------
/* rgbToHsl and hslToRgb : code from stackOverflow */

/*
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   {number}  r       The red color value
 * @param   {number}  g       The green color value
 * @param   {number}  b       The blue color value
 * @return  {Array}           The HSL representation
 */
function rgbToHsl(r, g, b){ // this function copied from somewhere on Stack Overflow

    r /= 255, g /= 255, b /= 255;
    var max = mmax(r, g, b), min = mmin(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
} // function rgbToHsl

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */

function hslToRgb(h, s, l){
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [mround(r * 255), mround(g * 255), mround(b * 255)];
} // function hslToRgb

//--------------------------------------------------------------------

function toHex2(number) {
  var s = number.toString(16).toUpperCase();
  return (((s.length)<2) ?'0':'')+s;
} // toHex2
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function rgbToCssString(arRgb) {
  return '#' + toHex2(mround(arRgb[0]))+
               toHex2(mround(arRgb[1]))+
               toHex2(mround(arRgb[2]));
} // rgbToCssString

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function cssStringToRgb (str) {
  return [parseInt ('0x' + str.substring(1,3), 16),
          parseInt ('0x' + str.substring(3,5), 16),
          parseInt ('0x' + str.substring(5,7), 16)];
} // cssStringToRgb

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function displaymsg(text) {
  document.getElementById('msg').innerHTML = text;
}

//--------------------------------------------------------------------
function interleave(n) {
/* returns an array of integers 0 to n - 1 shuffled to be used to display lines
in an order such that they apppear as uniformly as possible
*/
  let interl = [];

  let arnb = new Array(n).fill(0).map((v, k) => k); // array of numbers 0.. n - 1

/*  create a tree recursively by
    picking the number in the middle of the range as the node value
  - if there are values 'before' this number, create a tree whith those values and and append them as the left child of the node
  - if there are values 'after' this number, create a tree whith those values and append them as the right child of the node

*/
  function next(node) {
    let ret;

    if (node.parent) { // first call
      let k = mfloor(node.parent.length / 2);
      ret = node.parent[k];
      if (k > 0) node.left = {parent: node.parent.slice(0, k)};
      if (k < node.parent.length - 1) node.right = {parent: node.parent.slice(k+1)};
      if (node.left) node.state = 1; else node.state = 3;
      delete node.parent;
      return ret;
    }
    if (node.state == 1) { // return left child
      ret = next(node.left);
      if (node.left.state == 3) delete node.left; // left child empty now
    }
    if (node.state == 2) { // return right child
      ret = next(node.right);
      if (node.right.state == 3) delete node.right; // left child empty now
    }
// next call, will return other child if it exists - else the same, else nothing (state 3)
    if (node.right && (node.state == 1 || ! node.left)) node.state = 2;
    else node.state = (node.left) ? 1 : 3;
    return ret;

  } // next

  let par = {parent: arnb};
  do {
    interl.push(next(par));
  } while (par.state != 3);

  return interl;
} // interleave

//--------------------------------------------------------------------
function relativeCoord (element, clientX, clientY) {

  let style = element.currentStyle || window.getComputedStyle(element, null),
      paddingLeftWidth = parseInt(style.paddingLeft, 10),
      paddingTopWidth = parseInt(style.paddingTop, 10),
      borderLeftWidth = parseInt(style.borderLeftWidth, 10),
      borderTopWidth = parseInt(style.borderTopWidth, 10),
      rect = element.getBoundingClientRect(),
      x = clientX - paddingLeftWidth - borderLeftWidth - rect.left,
      y = clientY - paddingTopWidth - borderTopWidth - rect.top;

  return [x, y];
}

//--------------------------------------------------------------------
//--------------------------------------------------------------------

{ // scope for cMap

  let ctxCMap;
  let x0Ruler, x1Ruler, yRuler1;
  const hRuler = 20;
  let tbMap;
  let nStop = 0;
  let nnStop;

//------------------------------------------------------------------------------

function Interpolator (kint) {
/* returns a function for color interpolation between indices kint and kint+1
of cMap.tbMap
supposed to make a smart choice between hsl and rgb interpolation
The returned function is supposed to be
called later with a parameter between cMap.tbMap[kint].level and cMap.tbMap[kint + 1].level
will return a value with the [r, g, b] format.
*/

  let [r0, g0, b0] = tbMap[kint].color;
  let [r1, g1, b1] = tbMap[kint + 1].color;
  let [h0, s0, l0] = tbMap[kint].hslColor;
  let [h1, s1, l1] = tbMap[kint + 1 ].hslColor;
  let x0 = tbMap[kint].level;
  let x1 = tbMap[kint + 1].level;

  let h, s, l;

  let dx = x1 - x0;

// if x interval too short, just return color1
  if (mabs(dx) < 0.001) return ()=> color1;

/* if hue is not very well defined (small saturation or too dark or too light)
at at least one end, interpolate in rgb
else interpolate in hsl
Threshold levels subject to change */
  if (s0 < 0.1 || s1 < 0.1 || l0 < 0.1 || l1 < 0.1 || l0 > 0.9 || l1 > 0.9) {
    return  x => {
      let dx0 = x - x0;
      let dx1 = x1 - x;
      return [(r0 * dx1 + r1 * dx0) / dx,
              (g0 * dx1 + g1 * dx0) / dx,
              (b0 * dx1 + b1 * dx0) / dx];
      };
  } // if rgb interpolation
/* hsl interpolation : find shorter path from h0 to h1 */

  if (h1 > h0 + 0.5) h0 += 1;
  if (h0 > h1 + 0.5) h1 += 1;
  // here, h0 and h1 may be greater than 1
  return  x => {
      let dx0 = x - x0;
      let dx1 = x1 - x;
      h = ((h0 * dx1 + h1 * dx0) / dx) % 1; // back to the 0-1 interval
      s = (s0 * dx1 + s1 * dx0) / dx;
      l = (l0 * dx1 + l1 * dx0) / dx;
      return hslToRgb(h, s, l);
    };
} // Interpolator

//--------------------------------------------------------------------

function drawRuler1 () {

  ctxCMap.clearRect(x0Ruler, yRuler1, x1Ruler - x0Ruler, hRuler);
  ctxCMap.lineWidth = 2;
  for (let k = 0; k <= (x1Ruler - x0Ruler); ++k) {
    ctxCMap.beginPath();
    ctxCMap.moveTo (x0Ruler + k, yRuler1);
    ctxCMap.lineTo (x0Ruler + k, yRuler1 + hRuler);
    ctxCMap.strokeStyle = rgbToCssString(findColor(k / (x1Ruler - x0Ruler)));
    ctxCMap.stroke();
  } // for k
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function findColor (level) {

  let level0, color0;
  let level1, color1;

  let interp, rInterp;

  let p1 = tbMap[0];
  for (let k = 1 ; k < tbMap.length; ++k) {
    ({level: level0, color: color0} = p1);
    p1 = tbMap[k];
    ({level: level1, color:color1} = p1);
    if (level >= level0 && level < level1) {
      interp = Interpolator (k - 1);
      return interp(level);
    }
  } // for k
  return tbMap[tbMap.length - 1].color;
} // findColor

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function drawStop(nStop, color) {
  let x = x0Ruler + (x1Ruler - x0Ruler) * tbMap[nStop].level;
  ctxCMap.beginPath();
  ctxCMap.fillStyle = color;
  ctxCMap.moveTo (x, yRuler1 + hRuler + 2);
  ctxCMap.lineTo (x + 4, yRuler1 + hRuler + 2 + 10);
  ctxCMap.lineTo (x - 4, yRuler1 + hRuler + 2 + 10);
  ctxCMap.fill();
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function drawStops () {
// clear stops area
  ctxCMap.clearRect(x0Ruler - 5 , yRuler1 + hRuler + 1 , x1Ruler - x0Ruler + 10, 12);
// draw triangle stops
  for (let k = 0; k < tbMap.length; ++k)
    drawStop(k, '#48f');
  drawStop (nStop, '#f88');
  if (typeof nnStop == 'number')
    drawStop (nnStop, '#f00');

} // drawStops

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function updateUIMap() {

/* updates user interface for mapping of colors BUT does not drawRuler1 */
  if (nStop < 0) nStop = 0;
  if (nStop >= tbMap.length) nStop = tbMap.length - 1;

  document.getElementById("nStop").innerHTML = nStop + 1; // humans begin to count at 1
  document.getElementById("nbStops").innerHTML = tbMap.length;
  document.getElementById("position").innerHTML = tbMap[nStop].level.toFixed(3);
  document.getElementById("color").value = rgbToCssString(tbMap[nStop].color);
  drawStops();

} // updateUIMap

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function changeColor() {

  tbMap[nStop].cssString = this.value;
  prepareTbMap();
  drawRuler1();
  events.push({event: 'colorChanged'});

}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function insertMouseStop(xMouse) {
//  level associated with this xMouse
  let level = (xMouse - x0Ruler) / (x1Ruler - x0Ruler);
  level = mmax(0, mmin(1, level));

  for (nStop = 1; nStop < tbMap.length; ++nStop) {
    if (tbMap[nStop].level > level) break;
  };
  --nStop;
  if (nStop >= tbMap.length - 1) nStop = tbMap.length - 2; // can't insert after last !

  let {level: lev0, color: color0 } = tbMap[nStop];
  let {level: lev1, color: color1 } = tbMap[nStop + 1];
  let newStop = {};
  newStop.level = level;
//  newStop.level = Number.parseFloat(newStop.level.toFixed(4));
  let interp = Interpolator (nStop);
  newStop.cssString = rgbToCssString(interp(newStop.level));
  tbMap.splice(++nStop, 0, newStop);
  prepareTbMap();

  updateUIMap();
  drawRuler1();
  events.push({event: 'colorChanged'});

}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function deleteStop() {

  if (nStop == 0 || nStop >= tbMap.length - 1) return; // should not happen

  tbMap.splice(nStop, 1);
  --nStop;
  prepareTbMap();
  updateUIMap();
  drawRuler1();
  events.push({event: 'colorChanged'});
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

/* sorts stops and prepare their 'color' and 'hslColor' fiels from their 'cssString' field */

function prepareTbMap() {
  tbMap.sort((vala, valb) => {
      if (vala.level < valb.level) return -1;
      if (vala.level > valb.level) return 1;
      return 0;
  }); // tbMap.sort
  tbMap.forEach(stop => {
    stop.color = cssStringToRgb(stop.cssString);
    stop.hslColor = rgbToHsl(stop.color[0], stop.color[1], stop.color[2]);
  }) // forEach

} // prepareTbMap

//--------------------------------------------------------------------
function cMapMouseDown(event) {
  if (event.button != 0) return; // only interested in left button
  let [x, y] = relativeCoord (ctxCMap.canvas, event.clientX, event.clientY);
  events.push({event: 'cmapmousedown', x: x, y: y});
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function cMapMouseUp(event) {
  if (event.button != 0) return; // only interested in left button
  events.push({event: 'cmapmouseup'});
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function cMapMouseOut(event) {
  events.push({event: 'cmapmouseout'});
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function cMapMouseMove(event) {
  let [x, y] = relativeCoord (ctxCMap.canvas, event.clientX, event.clientY);
  events.push({event: 'cmapmousemove', x: x, y: y});
}

//--------------------------------------------------------------------
let animateCMap;
{ // scope for animateCMap

  let cMapState = 0;
  let xCursor = 0;
  let xClick, yClick; // mouse position when clicked on stop

   animateCMap = function (event) {

    let dx, dy, level;

// mouse interaction with color map
    switch (cMapState) {
      case 0 :           // initialisation
        ++cMapState;
        displaymsg('');
        break;
      case 1 : // waiting for something to do
        if (event && event.event == 'cmapmousemove') {
          if (inRuler( event.x, event.y)) {
            ++cMapState;
            events.push (event); // to do action at state 2 without need for another actual move
            displaymsg('click to insert stop')
          } else if (inStops( event.x, event.y)) {
            cMapState = 5;
            events.push (event); // to do action at state 5 without need for another actual move
            displaymsg('When on stop, hold mouse button and move horizontally to move stop, move down to delete it');
          }
        }
        break;

      case 2 : // mouse over ruler
        if (event && event.event == 'cmapmousemove') {
          if (inRuler( event.x, event.y)) { // moving over ruler
            eraseCursor(xCursor);
            xCursor = event.x;
            drawCursor(xCursor);
          } else {                    // exit ruler
            eraseCursor(xCursor);
            cMapState = 0;  // back to waiting for command
          }
        } else if (event && event.event == 'cmapmousedown') { // add stop
          eraseCursor(xCursor);
          insertMouseStop(xCursor);
          cMapState = 0;  // back to waiting for command
        } else if (event && event.event == 'cmapmouseout') { // exit canvas
          eraseCursor(xCursor);
          cMapState = 0;  // back to waiting for command
        }
        break;

      case 5 : // mouse over stops
        if (event && event.event == 'cmapmousemove') {
          if (inStops( event.x, event.y)) { // moving over stops
            whatStop(event.x);
            drawStops();
          } else {                    // exit ruler
            cMapState = 9;  // back to waiting for command
          }
        } else if (event && event.event == 'cmapmousedown') { // grabbing a stop
          events.push(event);
          cMapState = 6;  // what with this stop ?
          xClick = event.x; // record mouse initial position
          yClick = event.y;
        } else if (event && event.event == 'cmapmouseout') { // exit canvas
          cMapState = 9;  // back to waiting for command
        }
        break;

      case 6 : // button pressed on stop
        if (nnStop === undefined) {
          cMapState = 9;  // no stop under mouse, exit this function
          break;
        }
        nStop = nnStop;  // select this stop
        nnStop = undefined;
        updateUIMap();   // redraw interface
        if (nStop == 0 || nStop == tbMap.length - 1) {
          cMapState = 9;  // first and last stop not moveable, not eraseable
        } else {
          ++cMapState;
        }
        break;

      case 7 : // button just clicked on stop - analyze move or remove

        if (event && (event.event == 'cmapmouseout' ||
                      event.event == 'cmapmouseup' )) {
          cMapState = 9;  // exit canvas or button released
          break;
        }
        if (event && event.event == 'cmapmousemove') {
          if (event.y < yRuler1 + hRuler) { // mouse too high, exit
            cMapState = 9;  // exit canvas or button released
            break;
          }
          dx = event.x - xClick;
          dy = event.y - yClick;
          if (mabs (dy) > mabs (dx * 2) && mabs (dy) > 5) {
          // decision : remove stop
            deleteStop();
            cMapState = 9;
            break;
          }
          if (mabs (dx) > mabs (dy) && mabs (dx) > 2) {
          // decision : move stop
            displaymsg('Release button to release stop');
            events.push(event);
            ++cMapState;
            break;
          }
          // else : don't know what to do, do nothing.
        }
        break;

      case 8 : // moving one stop
        if (event && (event.event == 'cmapmouseout' ||
                      event.event == 'cmapmouseup' )) {
          cMapState = 9;  // exit canvas or button released
          break;
        }
        if (event && event.event == 'cmapmousemove') {
          level = (event.x - x0Ruler) / (x1Ruler - x0Ruler);
          level = mmax(0, mmin(1, level));
          if (level > tbMap[nStop].level){
            // push stops on the right
            for (let k = nStop; k < tbMap.length - 1; ++k) {
              tbMap[k].level = mmax(tbMap[k].level, level);
            } // for k
          } else if (level < tbMap[nStop].level){
            // push stops on the left
            for (let k = nStop; k > 0 ; --k) {
              tbMap[k].level = mmin(tbMap[k].level, level);
            } // for k
          }
          prepareTbMap();
          updateUIMap();
          drawRuler1();
          events.push({event: 'colorChanged'});
        } // if move
        break;
      case 9 : // leaving mouse over stops state
        nnStop = undefined;
        drawStops();
        cMapState = 0;
        break;
    } // switch cMapState
  } // animateCMap

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// returns true if coordinates in color map ruler area
  function inRuler (x, y) {
    return y >= yRuler1 && y < yRuler1 + hRuler;
             // && x >= x0Ruler - 1 && x < x1Ruler + 1;
  }

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// sets nnStop to stop index closest to mouse coordinate x
// the mouse is supposed to be in the stops area
// sets nnStop to undefined if too far from any stop

  function whatStop (x) {
    let level = (x - x0Ruler) / (x1Ruler - x0Ruler);
    level = mmax(0, mmin(1, level));
    let dpix = 1 / (x1Ruler - x0Ruler);  // level difference leading to a 1 pixel distance

    let bestd = 10;
    let kbestd;

    for (let k = 0; k < tbMap.length; ++ k) {
      if (mabs(level - tbMap[k].level) < 4 * dpix) {
        if (kbestd === undefined) { // no selection at all yet : accept this
          kbestd = k;
          bestd = level - tbMap[k].level;
          if (bestd <= 0 && bestd > -dpix ) break; // found best possible
        } else {
          if (mabs(level - tbMap[k].level) > mabs(bestd)) break; // we're gone too far
          kbestd = k;              // new stop is better
          bestd = level - tbMap[k].level;
        }
      } // if close enough
    }// for k
    nnStop = kbestd;
  } // whatStop

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// returns true if coordinates in color map stops area

  function inStops (x, y) {
    return y >= yRuler1 + hRuler + 2 && y < yRuler1 + hRuler + 10;
             // && x >= x0Ruler - 1 && x < x1Ruler + 1;
  }
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  function eraseCursor(x) {
    // x is a relative to the color map canvas, not the ruler itself
    x = mmax(x0Ruler, mmin(x1Ruler - 1, x));
    ctxCMap.clearRect(x - 1 , yRuler1 - 9, 3, 8);
  } // eraseCursor

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  function drawCursor(x) {
    // x is a relative to the color map canvas, not the ruler itself
    x = mmax(x0Ruler, mmin(x1Ruler - 1, x));
    ctxCMap.strokeStyle = '#fff';
    ctxCMap.lineWidth  = 1;
    ctxCMap.beginPath();
    ctxCMap.moveTo (x, yRuler1 - 8);
    ctxCMap.lineTo (x, yRuler1 - 2);
    ctxCMap.stroke();
  } // drawCursor

} // scope for animateCMap

  function cMapInit () {
    ctxCMap = document.getElementById('cMap').getContext('2d');
    ctxCMap.canvas.height = hRuler + 30;

    yRuler1 = 10;
    x0Ruler = 10;
    x1Ruler = ctxCMap.canvas.width - x0Ruler;

    // initial color map : shades of green
    // 1st point MUST have level 0 and last point MUST have level 1
    tbMap = cMap.tbMap ||
             [{level: 0, cssString:'#000000'},
             {level: 0.25, cssString:'#0000ff'},
             {level: 0.5, cssString:'#ff8000'},
             {level: 0.85, cssString:'#ffff00'},
             {level: 1, cssString:'#004060'}];
    cMap.tbMap = tbMap;
    prepareTbMap();
    drawRuler1();

    updateUIMap();
    ctxCMap.canvas.addEventListener('mousedown', cMapMouseDown);
    ctxCMap.canvas.addEventListener('mouseup', cMapMouseUp);
    ctxCMap.canvas.addEventListener('mouseout', cMapMouseOut);
    ctxCMap.canvas.addEventListener('mousemove', cMapMouseMove);
    document.getElementById("color").addEventListener('change', changeColor);
  } // cMapInit

// public functions
  cMap.init = cMapInit;             // initialization
  cMap.animateCMap = animateCMap;   // animation / mouse events management
  cMap.findColor = findColor;       // calculation of color

// 'out' values
  cMap.tbMap = tbMap;  // in/out in fact (initial value)

} // scope for cMap

//--------------------------------------------------------------------
//--------------------------------------------------------------------

let animate;
{ // scope for animate

  let animState = 0; // main animation / drawing

  let lNum, line, offs, klNum;
  let blurTb;
  let nbOnLines, nbOnColumns;
  let blurImA; // temporary image
  let bufOut;


  let limColors; // array of limits for colors
  let threshold;

  animate = function(tStamp) {

    let event = {};
    let kx, ky
    let lbw, lBlur;

    let tStart = performance.now();

    requestAnimationFrame(animate);
    if (events.length > 0) {
      event = events.shift();
      if (event.event == 'reset') {
        animState = 0;
        displaymsg('&nbsp;');
      } else if (event.event =='resizedImgReady') {
        animState = 1;
      } else if (event.event =='blurChanged' && animState >= 3) {
        animState = 3;
      } else if (event.event =='colorChanged' && animState >= 7) {
        animState = 7;
      } else if (event.event =='sizeChanged' && animState >= 0) {
        imgSrcLoaded();
      }
    }

    switch (animState) { // main animation / drawing
      case 0 :        // wait
        break;

      case 1 :           // new image
        bwImg = [];      // empty b/w image
        lNum = 0;
        ++animState;
        break;

      case 2 :              //* b/w generation in progress
        while (performance.now() - tStart < 10) {
          // generate 1 more line
          bwImg[lNum] = line = new Uint16Array(uiv.tWidth);
          offs = lNum * 4 * uiv.tWidth; // offset in resizedImage
          for (let k = 0; k < uiv.tWidth; ++k) {
// weighting coefficients 3, 10, 1 -> 3570 for white
            line[k] = resizedImg[offs++] * RCOEFF + resizedImg[offs++] * GCOEFF + resizedImg[offs++] * BCOEFF;
            ++offs; // skip alpha
          }
          ++lNum;
          if (lNum >= uiv.tHeight) { // finished
            ++animState;
            break;
          }
        }
        break;

      case 3 :              //* b/w generation complete, prepare for blur
        blurImA = []; // empty blurred intermediate mage
        blurImg = []; // empty blurred image
        for (let k = 0; k < uiv.tHeight; ++k) { // blurred image filled with black
          blurImg[k] = new Uint32Array(uiv.tWidth);
          blurImA[k] = new Uint32Array(uiv.tWidth);
        }

        blurTb = []; // indexes for blur calculation
        for (let k = 0; k <= uiv.blur; ++k) {
          blurTb[k] = k - mfloor(uiv.blur / 2);
        } // for k
        nbOnLines = new Array(uiv.tHeight).fill(0);
        nbOnColumns = new Array(uiv.tWidth).fill(0);
        lNum = 0;
        ui.progressBlur.value = 0;
        ui.progressBlur.style.visibility = 'visible';
        ++animState;
        break;

      case 4 :     // blurred image generation in progress - lines
        ui.progressBlur.value = 0.25 * lNum / uiv.tHeight;
        while (performance.now() - tStart < 10) {
          // generate 1 more line
          lbw = bwImg[lNum];
          for (let k = 0 ; k <= uiv.blur ; ++k) {
            ky = lNum + blurTb[k];
            if (ky < 0 || ky >= uiv.tHeight) continue;
            ++nbOnLines[ky];
            lBlur = blurImA[ky];
            lBlur.forEach ((val, kx) => lBlur[kx] = val + lbw[kx]); // sum 1 line
          } // for k
          ++lNum;
          if (lNum >= uiv.tHeight) { // finished
            ++animState;
            lNum = 0; // used to count columns in next step
            break;
          }
        } // while t < 10
        break;

      case 5 :     // blurred image generation in progress - columns
        ui.progressBlur.value = 0.25 + 0.6 * lNum / uiv.tHeight;
        while (performance.now() - tStart < 10) {
          // generate 1 more column

          for (let k = 0 ; k <= uiv.blur ; ++k) {
            kx = lNum + blurTb[k];
            if (kx < 0 || kx >= uiv.tWidth) continue;
            ++nbOnColumns[kx];
//            let lBlur = blurImg[ky];
            blurImg.forEach ((line, ky) => line[kx] = line[kx] + blurImA[ky][lNum]); // sum 1 line
          } // for k
          ++lNum;
          if (lNum >= uiv.tWidth) { // finished
            ++animState;
            blurImA = null;
            lNum = 0; // used to count columns in next step
            break;
          }
        } // while t < 10
        break;

     case 6 : // blurred image generation in progress : averaging
        ui.progressBlur.value = 0.85 + 0.15 * lNum / uiv.tHeight;
        while (performance.now() - tStart < 10) {
          // generate 1 more line
          lBlur = blurImg[lNum];
          lBlur.forEach ((val, kx) => lBlur[kx] = mround(val /( nbOnColumns[kx] * nbOnLines[lNum] ))); // average 1 line
          ++lNum;
          if (lNum >= uiv.tHeight) { // finished
            ++animState;
            break;
          }
        } // while t < 10
        break;

      case 7:
      // scale levels in cMap.tbMap
        ui.progressBlur.style.visibility = 'hidden';
        limColors = cMap.tbMap.map (stop => stop.level * WHITE);
        if (destCanvas.width != uiv.tWidth)
          destCanvas.width = uiv.tWidth;
        if (destCanvas.height != uiv.tHeight)
          destCanvas.height = uiv.tHeight;
        klNum = 0;
        animState++;
        break;

    case 8:
        while (performance.now() - tStart < 10) {
          // generate 1 more line
          lNum = tbInterleave[klNum];
          if (uiv.isophote) isophoteDraw(); else gradientDraw();

          ++klNum; // next line
          if (klNum >= uiv.tHeight) { // finished
            ++animState;
            break;
          }
        } // while t < 10
        break;

    case 9: // waiting
      break;
    } // switch (animState)


    cMap.animateCMap(event);

  } // animate

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  function gradientDraw(){

    let bufS = destCtx.createImageData(uiv.tWidth, 1);
    let imS = bufS.data;

    let pBuf = 0; // pointer in bufS
    let col;
    let r,g,b;

    for (let kx = 0; kx < uiv.tWidth; ++kx) {
      [r,g,b] = cMap.findColor(blurImg[lNum][kx] / WHITE );
      imS[pBuf++] = r;
      imS[pBuf++] = g;
      imS[pBuf++] = b;
      imS[pBuf++] = 255;

//      nbPix++; // comptage nombre de pixels

    } // for kx
    destCtx.putImageData(bufS, 0, lNum);
  } // gradientDraw

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  function isophoteDraw(){
    let bufOut = new Array(uiv.tWidth).fill(0); // black line

// loop on all thresholds
    for (let kcou = 0 ; kcou < limColors.length; ++kcou) {
       threshold = limColors[kcou];

// we shall keep pixels  >= threshold with at least one of 8 neighbours < threshold
      for (let kx = 0; kx < uiv.tWidth; ++kx) {
        if (blurImg[lNum][kx] < threshold )continue; // < threshold, not drawn
        let neighbOut = false;
  LoopNeigh:
        for (let kky = lNum - 1 ; kky <= lNum + 1 ; ++kky) {
          if (kky < 0) continue;
          if (kky >= uiv.tHeight) continue;
          for (let kkx = kx - 1 ; kkx <= kx + 1 ; ++kkx) {
            if (kkx < 0) continue;
            if (kkx >= uiv.tWidth ) continue;
            if (blurImg[kky][kkx] < threshold ) {
              neighbOut = true;
              break LoopNeigh;
            }
          }// for kkx;
        } // for kky
        if (neighbOut) {
              bufOut[kx] = kcou;
        }
      } // for kx
    } // for kcou
    displayLine(bufOut, lNum);
  } // isophoteDraw

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  function displayLine (bufOut, line) {

    // crée une ligne qui contient une ligne de l'image d'entrée

    let bufS = destCtx.createImageData(uiv.tWidth, 1);
    let imS = bufS.data;

    let pBuf = 0; // pointer in bufS
    let col;
    let r,g,b;

    for (let kx = 0; kx < uiv.tWidth; ++kx) {
      col = bufOut[kx];
     [r,g,b] = cMap.tbMap[col].color;
      imS[pBuf++] = r;
      imS[pBuf++] = g;
      imS[pBuf++] = b;
      imS[pBuf++] = 255;

//      nbPix++; // comptage nombre de pixels

    } // for kx
    destCtx.putImageData(bufS, 0, line);

  } // displayLine



} // scope for animate

//--------------------------------------------------------------------
function loadImgInt() {
  readUI();
  imgSrc.src = woman_600_800;
}

//--------------------------------------------------------------------
function loadImgExt() {
  readUI();
  uploadFile((loadedData) => {},
              {accept: 'image/*',
               readMethod: 'readAsDataURL',
               image: imgSrc});
} // loadImgExt

//--------------------------------------------------------------------
function imgSrcLoaded() {

  let widthSrc = imgSrc.width;
  let heightSrc = imgSrc.height;
  let prevTHeight = uiv.tHeight

  if (widthSrc == 0) return; // not normal

  uiv.tHeight = mround(heightSrc * uiv.tWidth / widthSrc);
  if (prevTHeight != uiv.tHeight) tbInterleave = interleave (uiv.tHeight);

  ui.tHeight.innerHTML = uiv.tHeight;

  let resCanv = document.getElementById('resizedCanvas');
  resCanv.width = uiv.tWidth;
  resCanv.height = uiv.tHeight;
  let resCtx = resCanv.getContext('2d');
  resCtx.drawImage(imgSrc, 0, 0, uiv.tWidth, uiv.tHeight); // resized image

  resizedImg = resCtx.getImageData(0, 0, uiv.tWidth, uiv.tHeight).data;
  events.push({event : 'resizedImgReady'});

} // imgSrcLoaded

//--------------------------------------------------------------------
//--------------------------------------------------------------------
let uploadFile;
{ // scope for uploadFile

  let options, callBack;

  let elFile = document.createElement('input');
  elFile.setAttribute('type','file');
  elFile.style.display = 'none';
  elFile.addEventListener("change", getFile);

  function getFile() {

    if (this.files.length == 0) {
      returnLoadFile ({fail: 'no file'});
      return;
    }
    let file = this.files[0];
    let reader = new FileReader();

    reader.addEventListener('load',() => {
      if (options.image) options.image.src = reader.result;
      returnLoadFile ({success: reader.result, file: file});
    });
    reader.addEventListener('abort',() => {
      returnLoadFile ({fail: 'abort'});
    });
    reader.addEventListener('error',() => {
      returnLoadFile ({fail: 'error'});
    });

    if (options.image || options.readMethod =='readAsDataURL')
      reader.readAsDataURL(this.files[0]);
    else
      reader.readAsText(this.files[0]);

  } // getFile

  function returnLoadFile(returnedValue) {
    callBack(returnedValue);
  }

uploadFile = function(ocallBack, ooptions) {
/* loads a file asynchronously
at the end of the process, calls the function 'callBack' with an object :

{fail: string} in case of failure, where string gives the reason of the failure
or
{success : string, file: file} where string is the content of the image file
   file represents the loaded file, and may be tested for file.type, file.name...

CAUTION ! If the user clicks 'cancel' when loading a file, nothing happens.

options is an object, with 0, one or more of the following properties :
accept : string to pass as "accept" attribute to the load file button, such as '.txt' or 'image/*'
            default : no value (will accept *.*)
readMethod : 'readAsText' or 'readAsDataURL' - default is readAsText
image: if provided, must be an Image element. If possible, the data is loaded
with readAsDataURL, no matter the value of readMethod, and option.image.src is set to the data.
The function then returns normally as defined above.
Normally, a 'load' event should be triggered on the image.
*/

  options = ooptions;
  callBack = ocallBack;
  if (options.accept) elFile.setAttribute("accept", options.accept);
  else elFile.removeAttribute("accept");
  elFile.click();

} // uploadFile
} //  // scope for uploadFile
//--------------------------------------------------------------------
//--------------------------------------------------------------------

function readUI() {
// read user interface - except color map

  getTWidth();
  getBlur();
  getIsophote();
} // readUI

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function getCoerce(name, min, max, isInt) {

  let parse = isInt ? parseInt : parseFloat;
  let ctrl = ui[name];
  let x = parse(ctrl.value, 10);
  if (isNaN (x)) { x = uiv[name] }
  x = mmax(x, min);
  x = mmin(x, max);

  ctrl.value = uiv[name] = x;
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getTWidth() {
  getCoerce('tWidth', 100, 2000, true);
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getBlur() {
  getCoerce('blur', 0, 20, true);
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getIsophote() {
  uiv.isophote = ui.isophote.checked;
}

//--------------------------------------------------------------------
//--------------------------------------------------------------------

// beginning of execution

  destCanvas = document.getElementById('destCanvas');
  destCtx = destCanvas.getContext ('2d');

  cMap.tbMap = [ {level : 0, cssString:'#000000'},
                  {level : 0.107, cssString:'#000000'},
                  {level : 0.107, cssString:'#0000ff'},
                  {level : 0.529, cssString:'#0000ff'},
                  {level : 0.529, cssString:'#ff0000'},
                  {level : 0.700, cssString:'#ff0000'},
                  {level : 0.700, cssString:'#ffff00'},
                  {level : 0.929, cssString:'#ffff00'},
                  {level : 0.929, cssString:'#000000'},
                  {level : 1, cssString:'#000000'}];

  cMap.init();

  imgSrc = new Image();
  imgSrc.addEventListener ("load", imgSrcLoaded);

/* UI */
  ui = {};
  ['tWidth', 'blur', 'tHeight', 'progressBlur', 'isophote']
    .forEach (name => ui[name] = document.getElementById(name));
  uiv = {};
  readUI();
  ui.tWidth.addEventListener('change', ()=> {
      getTWidth();
      events.push({event: 'sizeChanged'});
    });

  ui.blur.addEventListener('change', ()=>{
      getBlur();
      events.push({event: 'blurChanged'});
    });
  ui.isophote.addEventListener('change', ()=>{
      getIsophote();
      events.push({event: 'colorChanged'});
    });
  document.getElementById('loadButtonInt').addEventListener('click', loadImgInt);
  document.getElementById('loadButtonExt').addEventListener('click', loadImgExt);

  events.push({event: 'reset'}); // to reset animate
  loadImgInt();
  requestAnimationFrame(animate);

};
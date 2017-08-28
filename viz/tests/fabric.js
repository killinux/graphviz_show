/* build: `node build.js modules=ALL exclude=json,gestures minifier=uglifyjs` */
 /*! Fabric.js Copyright 2008-2015, Printio (Juriy Zaytsev, Maxim Chernyak) */

var fabric = fabric || { version: "1.6.7" };
if (typeof exports !== 'undefined') {
  exports.fabric = fabric;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  fabric.document = document;
  fabric.window = window;
  // ensure globality even if entire library were function wrapped (as in Meteor.js packaging system)
  window.fabric = fabric;
}
else {
  // assume we're running under node.js when document/window are not present
  fabric.document = require("jsdom")
    .jsdom("<!DOCTYPE html><html><head></head><body></body></html>");

  if (fabric.document.createWindow) {
    fabric.window = fabric.document.createWindow();
  } else {
    fabric.window = fabric.document.parentWindow;
  }
}

/**
 * True when in environment that supports touch events
 * @type boolean
 */
fabric.isTouchSupported = "ontouchstart" in fabric.document.documentElement;

/**
 * True when in environment that's probably Node.js
 * @type boolean
 */
fabric.isLikelyNode = typeof Buffer !== 'undefined' &&
                      typeof window === 'undefined';

/* _FROM_SVG_START_ */
/**
 * Attributes parsed from all SVG elements
 * @type array
 */
fabric.SHARED_ATTRIBUTES = [
  "display",
  "transform",
  "fill", "fill-opacity", "fill-rule",
  "opacity",
  "stroke", "stroke-dasharray", "stroke-linecap",
  "stroke-linejoin", "stroke-miterlimit",
  "stroke-opacity", "stroke-width",
  "id"
];
/* _FROM_SVG_END_ */

/**
 * Pixel per Inch as a default value set to 96. Can be changed for more realistic conversion.
 */
fabric.DPI = 96;
fabric.reNum = '(?:[-+]?(?:\\d+|\\d*\\.\\d+)(?:e[-+]?\\d+)?)';
fabric.fontPaths = { };

/**
 * Cache Object for widths of chars in text rendering.
 */
fabric.charWidthsCache = { };

/**
 * Device Pixel Ratio
 * @see https://developer.apple.com/library/safari/documentation/AudioVideo/Conceptual/HTML-canvas-guide/SettingUptheCanvas/SettingUptheCanvas.html
 */
fabric.devicePixelRatio = fabric.window.devicePixelRatio ||
                          fabric.window.webkitDevicePixelRatio ||
                          fabric.window.mozDevicePixelRatio ||
                          1;


(function() {

  /**
   * @private
   * @param {String} eventName
   * @param {Function} handler
   */
  function _removeEventListener(eventName, handler) {
    if (!this.__eventListeners[eventName]) {
      return;
    }
    var eventListener = this.__eventListeners[eventName];
    if (handler) {
      eventListener[eventListener.indexOf(handler)] = false;
    }
    else {
      fabric.util.array.fill(eventListener, false);
    }
  }

  /**
   * Observes specified event
   * @deprecated `observe` deprecated since 0.8.34 (use `on` instead)
   * @memberOf fabric.Observable
   * @alias on
   * @param {String|Object} eventName Event name (eg. 'after:render') or object with key/value pairs (eg. {'after:render': handler, 'selection:cleared': handler})
   * @param {Function} handler Function that receives a notification when an event of the specified type occurs
   * @return {Self} thisArg
   * @chainable
   */
  function observe(eventName, handler) {
    if (!this.__eventListeners) {
      this.__eventListeners = { };
    }
    // one object with key/value pairs was passed
    if (arguments.length === 1) {
      for (var prop in eventName) {
        this.on(prop, eventName[prop]);
      }
    }
    else {
      if (!this.__eventListeners[eventName]) {
        this.__eventListeners[eventName] = [];
      }
      this.__eventListeners[eventName].push(handler);
    }
    return this;
  }

  /**
   * Stops event observing for a particular event handler. Calling this method
   * without arguments removes all handlers for all events
   * @deprecated `stopObserving` deprecated since 0.8.34 (use `off` instead)
   * @memberOf fabric.Observable
   * @alias off
   * @param {String|Object} eventName Event name (eg. 'after:render') or object with key/value pairs (eg. {'after:render': handler, 'selection:cleared': handler})
   * @param {Function} handler Function to be deleted from EventListeners
   * @return {Self} thisArg
   * @chainable
   */
  function stopObserving(eventName, handler) {
    if (!this.__eventListeners) {
      return;
    }

    // remove all key/value pairs (event name -> event handler)
    if (arguments.length === 0) {
      for (eventName in this.__eventListeners) {
        _removeEventListener.call(this, eventName);
      }
    }
    // one object with key/value pairs was passed
    else if (arguments.length === 1 && typeof arguments[0] === 'object') {
      for (var prop in eventName) {
        _removeEventListener.call(this, prop, eventName[prop]);
      }
    }
    else {
      _removeEventListener.call(this, eventName, handler);
    }
    return this;
  }

  /**
   * Fires event with an optional options object
   * @deprecated `fire` deprecated since 1.0.7 (use `trigger` instead)
   * @memberOf fabric.Observable
   * @alias trigger
   * @param {String} eventName Event name to fire
   * @param {Object} [options] Options object
   * @return {Self} thisArg
   * @chainable
   */
  function fire(eventName, options) {
    if (!this.__eventListeners) {
      return;
    }

    var listenersForEvent = this.__eventListeners[eventName];
    if (!listenersForEvent) {
      return;
    }

    for (var i = 0, len = listenersForEvent.length; i < len; i++) {
      listenersForEvent[i] && listenersForEvent[i].call(this, options || { });
    }
    this.__eventListeners[eventName] = listenersForEvent.filter(function(value) {
      return value !== false;
    });
    return this;
  }

  /**
   * @namespace fabric.Observable
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-2#events}
   * @see {@link http://fabricjs.com/events|Events demo}
   */
  fabric.Observable = {
    observe: observe,
    stopObserving: stopObserving,
    fire: fire,

    on: observe,
    off: stopObserving,
    trigger: fire
  };
})();


/**
 * @namespace fabric.Collection
 */
fabric.Collection = {

  _objects: [],

  /**
   * Adds objects to collection, Canvas or Group, then renders canvas
   * (if `renderOnAddRemove` is not `false`).
   * in case of Group no changes to bounding box are made.
   * Objects should be instances of (or inherit from) fabric.Object
   * @param {...fabric.Object} object Zero or more fabric instances
   * @return {Self} thisArg
   * @chainable
   */
  add: function () {
    this._objects.push.apply(this._objects, arguments);
    if (this._onObjectAdded) {
      for (var i = 0, length = arguments.length; i < length; i++) {
        this._onObjectAdded(arguments[i]);
      }
    }
    this.renderOnAddRemove && this.renderAll();
    return this;
  },

  /**
   * Inserts an object into collection at specified index, then renders canvas (if `renderOnAddRemove` is not `false`)
   * An object should be an instance of (or inherit from) fabric.Object
   * @param {Object} object Object to insert
   * @param {Number} index Index to insert object at
   * @param {Boolean} nonSplicing When `true`, no splicing (shifting) of objects occurs
   * @return {Self} thisArg
   * @chainable
   */
  insertAt: function (object, index, nonSplicing) {
    var objects = this.getObjects();
    if (nonSplicing) {
      objects[index] = object;
    }
    else {
      objects.splice(index, 0, object);
    }
    this._onObjectAdded && this._onObjectAdded(object);
    this.renderOnAddRemove && this.renderAll();
    return this;
  },

  /**
   * Removes objects from a collection, then renders canvas (if `renderOnAddRemove` is not `false`)
   * @param {...fabric.Object} object Zero or more fabric instances
   * @return {Self} thisArg
   * @chainable
   */
  remove: function() {
    var objects = this.getObjects(),
        index, somethingRemoved = false;

    for (var i = 0, length = arguments.length; i < length; i++) {
      index = objects.indexOf(arguments[i]);

      // only call onObjectRemoved if an object was actually removed
      if (index !== -1) {
        somethingRemoved = true;
        objects.splice(index, 1);
        this._onObjectRemoved && this._onObjectRemoved(arguments[i]);
      }
    }

    this.renderOnAddRemove && somethingRemoved && this.renderAll();
    return this;
  },

  /**
   * Executes given function for each object in this group
   * @param {Function} callback
   *                   Callback invoked with current object as first argument,
   *                   index - as second and an array of all objects - as third.
   *                   Callback is invoked in a context of Global Object (e.g. `window`)
   *                   when no `context` argument is given
   *
   * @param {Object} context Context (aka thisObject)
   * @return {Self} thisArg
   * @chainable
   */
  forEachObject: function(callback, context) {
    var objects = this.getObjects();
    for (var i = 0, len = objects.length; i < len; i++) {
      callback.call(context, objects[i], i, objects);
    }
    return this;
  },

  /**
   * Returns an array of children objects of this instance
   * Type parameter introduced in 1.3.10
   * @param {String} [type] When specified, only objects of this type are returned
   * @return {Array}
   */
  getObjects: function(type) {
    if (typeof type === 'undefined') {
      return this._objects;
    }
    return this._objects.filter(function(o) {
      return o.type === type;
    });
  },

  /**
   * Returns object at specified index
   * @param {Number} index
   * @return {Self} thisArg
   */
  item: function (index) {
    return this.getObjects()[index];
  },

  /**
   * Returns true if collection contains no objects
   * @return {Boolean} true if collection is empty
   */
  isEmpty: function () {
    return this.getObjects().length === 0;
  },

  /**
   * Returns a size of a collection (i.e: length of an array containing its objects)
   * @return {Number} Collection size
   */
  size: function() {
    return this.getObjects().length;
  },

  /**
   * Returns true if collection contains an object
   * @param {Object} object Object to check against
   * @return {Boolean} `true` if collection contains an object
   */
  contains: function(object) {
    return this.getObjects().indexOf(object) > -1;
  },

  /**
   * Returns number representation of a collection complexity
   * @return {Number} complexity
   */
  complexity: function () {
    return this.getObjects().reduce(function (memo, current) {
      memo += current.complexity ? current.complexity() : 0;
      return memo;
    }, 0);
  }
};


(function(global) {

  var sqrt = Math.sqrt,
      atan2 = Math.atan2,
      pow = Math.pow,
      abs = Math.abs,
      PiBy180 = Math.PI / 180;

  /**
   * @namespace fabric.util
   */
  fabric.util = {

    /**
     * Removes value from an array.
     * Presence of value (and its position in an array) is determined via `Array.prototype.indexOf`
     * @static
     * @memberOf fabric.util
     * @param {Array} array
     * @param {*} value
     * @return {Array} original array
     */
    removeFromArray: function(array, value) {
      var idx = array.indexOf(value);
      if (idx !== -1) {
        array.splice(idx, 1);
      }
      return array;
    },

    /**
     * Returns random number between 2 specified ones.
     * @static
     * @memberOf fabric.util
     * @param {Number} min lower limit
     * @param {Number} max upper limit
     * @return {Number} random value (between min and max)
     */
    getRandomInt: function(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Transforms degrees to radians.
     * @static
     * @memberOf fabric.util
     * @param {Number} degrees value in degrees
     * @return {Number} value in radians
     */
    degreesToRadians: function(degrees) {
      return degrees * PiBy180;
    },

    /**
     * Transforms radians to degrees.
     * @static
     * @memberOf fabric.util
     * @param {Number} radians value in radians
     * @return {Number} value in degrees
     */
    radiansToDegrees: function(radians) {
      return radians / PiBy180;
    },

    /**
     * Rotates `point` around `origin` with `radians`
     * @static
     * @memberOf fabric.util
     * @param {fabric.Point} point The point to rotate
     * @param {fabric.Point} origin The origin of the rotation
     * @param {Number} radians The radians of the angle for the rotation
     * @return {fabric.Point} The new rotated point
     */
    rotatePoint: function(point, origin, radians) {
      point.subtractEquals(origin);
      var v = fabric.util.rotateVector(point, radians);
      return new fabric.Point(v.x, v.y).addEquals(origin);
    },

    /**
     * Rotates `vector` with `radians`
     * @static
     * @memberOf fabric.util
     * @param {Object} vector The vector to rotate (x and y)
     * @param {Number} radians The radians of the angle for the rotation
     * @return {Object} The new rotated point
     */
    rotateVector: function(vector, radians) {
      var sin = Math.sin(radians),
          cos = Math.cos(radians),
          rx = vector.x * cos - vector.y * sin,
          ry = vector.x * sin + vector.y * cos;
      return {
        x: rx,
        y: ry
      };
    },

    /**
     * Apply transform t to point p
     * @static
     * @memberOf fabric.util
     * @param  {fabric.Point} p The point to transform
     * @param  {Array} t The transform
     * @param  {Boolean} [ignoreOffset] Indicates that the offset should not be applied
     * @return {fabric.Point} The transformed point
     */
    transformPoint: function(p, t, ignoreOffset) {
      if (ignoreOffset) {
        return new fabric.Point(
          t[0] * p.x + t[2] * p.y,
          t[1] * p.x + t[3] * p.y
        );
      }
      return new fabric.Point(
        t[0] * p.x + t[2] * p.y + t[4],
        t[1] * p.x + t[3] * p.y + t[5]
      );
    },

    /**
     * Returns coordinates of points's bounding rectangle (left, top, width, height)
     * @param {Array} points 4 points array
     * @return {Object} Object with left, top, width, height properties
     */
    makeBoundingBoxFromPoints: function(points) {
      var xPoints = [points[0].x, points[1].x, points[2].x, points[3].x],
          minX = fabric.util.array.min(xPoints),
          maxX = fabric.util.array.max(xPoints),
          width = Math.abs(minX - maxX),
          yPoints = [points[0].y, points[1].y, points[2].y, points[3].y],
          minY = fabric.util.array.min(yPoints),
          maxY = fabric.util.array.max(yPoints),
          height = Math.abs(minY - maxY);

      return {
        left: minX,
        top: minY,
        width: width,
        height: height
      };
    },

    /**
     * Invert transformation t
     * @static
     * @memberOf fabric.util
     * @param {Array} t The transform
     * @return {Array} The inverted transform
     */
    invertTransform: function(t) {
      var a = 1 / (t[0] * t[3] - t[1] * t[2]),
          r = [a * t[3], -a * t[1], -a * t[2], a * t[0]],
          o = fabric.util.transformPoint({ x: t[4], y: t[5] }, r, true);
      r[4] = -o.x;
      r[5] = -o.y;
      return r;
    },

    /**
     * A wrapper around Number#toFixed, which contrary to native method returns number, not string.
     * @static
     * @memberOf fabric.util
     * @param {Number|String} number number to operate on
     * @param {Number} fractionDigits number of fraction digits to "leave"
     * @return {Number}
     */
    toFixed: function(number, fractionDigits) {
      return parseFloat(Number(number).toFixed(fractionDigits));
    },

    /**
     * Converts from attribute value to pixel value if applicable.
     * Returns converted pixels or original value not converted.
     * @param {Number|String} value number to operate on
     * @param {Number} fontSize
     * @return {Number|String}
     */
    parseUnit: function(value, fontSize) {
      var unit = /\D{0,2}$/.exec(value),
          number = parseFloat(value);
      if (!fontSize) {
        fontSize = fabric.Text.DEFAULT_SVG_FONT_SIZE;
      }
      switch (unit[0]) {
        case 'mm':
          return number * fabric.DPI / 25.4;

        case 'cm':
          return number * fabric.DPI / 2.54;

        case 'in':
          return number * fabric.DPI;

        case 'pt':
          return number * fabric.DPI / 72; // or * 4 / 3

        case 'pc':
          return number * fabric.DPI / 72 * 12; // or * 16

        case 'em':
          return number * fontSize;

        default:
          return number;
      }
    },

    /**
     * Function which always returns `false`.
     * @static
     * @memberOf fabric.util
     * @return {Boolean}
     */
    falseFunction: function() {
      return false;
    },

    /**
     * Returns klass "Class" object of given namespace
     * @memberOf fabric.util
     * @param {String} type Type of object (eg. 'circle')
     * @param {String} namespace Namespace to get klass "Class" object from
     * @return {Object} klass "Class"
     */
    getKlass: function(type, namespace) {
      // capitalize first letter only
      type = fabric.util.string.camelize(type.charAt(0).toUpperCase() + type.slice(1));
      return fabric.util.resolveNamespace(namespace)[type];
    },

    /**
     * Returns object of given namespace
     * @memberOf fabric.util
     * @param {String} namespace Namespace string e.g. 'fabric.Image.filter' or 'fabric'
     * @return {Object} Object for given namespace (default fabric)
     */
    resolveNamespace: function(namespace) {
      if (!namespace) {
        return fabric;
      }

      var parts = namespace.split('.'),
          len = parts.length, i,
          obj = global || fabric.window;

      for (i = 0; i < len; ++i) {
        obj = obj[parts[i]];
      }

      return obj;
    },

    /**
     * Loads image element from given url and passes it to a callback
     * @memberOf fabric.util
     * @param {String} url URL representing an image
     * @param {Function} callback Callback; invoked with loaded image
     * @param {*} [context] Context to invoke callback in
     * @param {Object} [crossOrigin] crossOrigin value to set image element to
     */
    loadImage: function(url, callback, context, crossOrigin) {
      if (!url) {
        callback && callback.call(context, url);
        return;
      }

      var img = fabric.util.createImage();

      /** @ignore */
      img.onload = function () {
        callback && callback.call(context, img);
        img = img.onload = img.onerror = null;
      };

      /** @ignore */
      img.onerror = function() {
        fabric.log('Error loading ' + img.src);
        callback && callback.call(context, null, true);
        img = img.onload = img.onerror = null;
      };

      // data-urls appear to be buggy with crossOrigin
      // https://github.com/kangax/fabric.js/commit/d0abb90f1cd5c5ef9d2a94d3fb21a22330da3e0a#commitcomment-4513767
      // see https://code.google.com/p/chromium/issues/detail?id=315152
      //     https://bugzilla.mozilla.org/show_bug.cgi?id=935069
      if (url.indexOf('data') !== 0 && crossOrigin) {
        img.crossOrigin = crossOrigin;
      }

      img.src = url;
    },

    /**
     * Creates corresponding fabric instances from their object representations
     * @static
     * @memberOf fabric.util
     * @param {Array} objects Objects to enliven
     * @param {Function} callback Callback to invoke when all objects are created
     * @param {String} namespace Namespace to get klass "Class" object from
     * @param {Function} reviver Method for further parsing of object elements,
     * called after each fabric object created.
     */
    enlivenObjects: function(objects, callback, namespace, reviver) {
      objects = objects || [];

      function onLoaded() {
        if (++numLoadedObjects === numTotalObjects) {
          callback && callback(enlivenedObjects);
        }
      }

      var enlivenedObjects = [],
          numLoadedObjects = 0,
          numTotalObjects = objects.length;

      if (!numTotalObjects) {
        callback && callback(enlivenedObjects);
        return;
      }

      objects.forEach(function (o, index) {
        // if sparse array
        if (!o || !o.type) {
          onLoaded();
          return;
        }
        var klass = fabric.util.getKlass(o.type, namespace);
        if (klass.async) {
          klass.fromObject(o, function (obj, error) {
            if (!error) {
              enlivenedObjects[index] = obj;
              reviver && reviver(o, enlivenedObjects[index]);
            }
            onLoaded();
          });
        }
        else {
          enlivenedObjects[index] = klass.fromObject(o);
          reviver && reviver(o, enlivenedObjects[index]);
          onLoaded();
        }
      });
    },

    /**
     * Groups SVG elements (usually those retrieved from SVG document)
     * @static
     * @memberOf fabric.util
     * @param {Array} elements SVG elements to group
     * @param {Object} [options] Options object
     * @param {String} path Value to set sourcePath to
     * @return {fabric.Object|fabric.PathGroup}
     */
    groupSVGElements: function(elements, options, path) {
      var object;

      object = new fabric.PathGroup(elements, options);

      if (typeof path !== 'undefined') {
        object.setSourcePath(path);
      }
      return object;
    },

    /**
     * Populates an object with properties of another object
     * @static
     * @memberOf fabric.util
     * @param {Object} source Source object
     * @param {Object} destination Destination object
     * @return {Array} properties Propertie names to include
     */
    populateWithProperties: function(source, destination, properties) {
      if (properties && Object.prototype.toString.call(properties) === '[object Array]') {
        for (var i = 0, len = properties.length; i < len; i++) {
          if (properties[i] in source) {
            destination[properties[i]] = source[properties[i]];
          }
        }
      }
    },

    /**
     * Draws a dashed line between two points
     *
     * This method is used to draw dashed line around selection area.
     * See <a href="http://stackoverflow.com/questions/4576724/dotted-stroke-in-canvas">dotted stroke in canvas</a>
     *
     * @param {CanvasRenderingContext2D} ctx context
     * @param {Number} x  start x coordinate
     * @param {Number} y start y coordinate
     * @param {Number} x2 end x coordinate
     * @param {Number} y2 end y coordinate
     * @param {Array} da dash array pattern
     */
    drawDashedLine: function(ctx, x, y, x2, y2, da) {
      var dx = x2 - x,
          dy = y2 - y,
          len = sqrt(dx * dx + dy * dy),
          rot = atan2(dy, dx),
          dc = da.length,
          di = 0,
          draw = true;

      ctx.save();
      ctx.translate(x, y);
      ctx.moveTo(0, 0);
      ctx.rotate(rot);

      x = 0;
      while (len > x) {
        x += da[di++ % dc];
        if (x > len) {
          x = len;
        }
        ctx[draw ? 'lineTo' : 'moveTo'](x, 0);
        draw = !draw;
      }

      ctx.restore();
    },

    /**
     * Creates canvas element and initializes it via excanvas if necessary
     * @static
     * @memberOf fabric.util
     * @param {CanvasElement} [canvasEl] optional canvas element to initialize;
     * when not given, element is created implicitly
     * @return {CanvasElement} initialized canvas element
     */
    createCanvasElement: function(canvasEl) {
      canvasEl || (canvasEl = fabric.document.createElement('canvas'));
      /* eslint-disable camelcase */
      if (!canvasEl.getContext && typeof G_vmlCanvasManager !== 'undefined') {
        G_vmlCanvasManager.initElement(canvasEl);
      }
      /* eslint-enable camelcase */
      return canvasEl;
    },

    /**
     * Creates image element (works on client and node)
     * @static
     * @memberOf fabric.util
     * @return {HTMLImageElement} HTML image element
     */
    createImage: function() {
      return fabric.isLikelyNode
        ? new (require('canvas').Image)()
        : fabric.document.createElement('img');
    },

    /**
     * Creates accessors (getXXX, setXXX) for a "class", based on "stateProperties" array
     * @static
     * @memberOf fabric.util
     * @param {Object} klass "Class" to create accessors for
     */
    createAccessors: function(klass) {
      var proto = klass.prototype, i, propName,
          capitalizedPropName, setterName, getterName;

      for (i = proto.stateProperties.length; i--; ) {

        propName = proto.stateProperties[i];
        capitalizedPropName = propName.charAt(0).toUpperCase() + propName.slice(1);
        setterName = 'set' + capitalizedPropName;
        getterName = 'get' + capitalizedPropName;

        // using `new Function` for better introspection
        if (!proto[getterName]) {
          proto[getterName] = (function(property) {
            return new Function('return this.get("' + property + '")');
          })(propName);
        }
        if (!proto[setterName]) {
          proto[setterName] = (function(property) {
            return new Function('value', 'return this.set("' + property + '", value)');
          })(propName);
        }
      }
    },

    /**
     * @static
     * @memberOf fabric.util
     * @param {fabric.Object} receiver Object implementing `clipTo` method
     * @param {CanvasRenderingContext2D} ctx Context to clip
     */
    clipContext: function(receiver, ctx) {
      ctx.save();
      ctx.beginPath();
      receiver.clipTo(ctx);
      ctx.clip();
    },

    /**
     * Multiply matrix A by matrix B to nest transformations
     * @static
     * @memberOf fabric.util
     * @param  {Array} a First transformMatrix
     * @param  {Array} b Second transformMatrix
     * @param  {Boolean} is2x2 flag to multiply matrices as 2x2 matrices
     * @return {Array} The product of the two transform matrices
     */
    multiplyTransformMatrices: function(a, b, is2x2) {
      // Matrix multiply a * b
      return [
        a[0] * b[0] + a[2] * b[1],
        a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3],
        a[1] * b[2] + a[3] * b[3],
        is2x2 ? 0 : a[0] * b[4] + a[2] * b[5] + a[4],
        is2x2 ? 0 : a[1] * b[4] + a[3] * b[5] + a[5]
      ];
    },

    /**
     * Decomposes standard 2x2 matrix into transform componentes
     * @static
     * @memberOf fabric.util
     * @param  {Array} a transformMatrix
     * @return {Object} Components of transform
     */
    qrDecompose: function(a) {
      var angle = atan2(a[1], a[0]),
          denom = pow(a[0], 2) + pow(a[1], 2),
          scaleX = sqrt(denom),
          scaleY = (a[0] * a[3] - a[2] * a [1]) / scaleX,
          skewX = atan2(a[0] * a[2] + a[1] * a [3], denom);
      return {
        angle: angle  / PiBy180,
        scaleX: scaleX,
        scaleY: scaleY,
        skewX: skewX / PiBy180,
        skewY: 0,
        translateX: a[4],
        translateY: a[5]
      };
    },

    customTransformMatrix: function(scaleX, scaleY, skewX) {
      var skewMatrixX = [1, 0, abs(Math.tan(skewX * PiBy180)), 1],
          scaleMatrix = [abs(scaleX), 0, 0, abs(scaleY)];
      return fabric.util.multiplyTransformMatrices(scaleMatrix, skewMatrixX, true);
    },

    resetObjectTransform: function (target) {
      target.scaleX = 1;
      target.scaleY = 1;
      target.skewX = 0;
      target.skewY = 0;
      target.flipX = false;
      target.flipY = false;
      target.setAngle(0);
    },

    /**
     * Returns string representation of function body
     * @param {Function} fn Function to get body of
     * @return {String} Function body
     */
    getFunctionBody: function(fn) {
      return (String(fn).match(/function[^{]*\{([\s\S]*)\}/) || {})[1];
    },

    /**
     * Returns true if context has transparent pixel
     * at specified location (taking tolerance into account)
     * @param {CanvasRenderingContext2D} ctx context
     * @param {Number} x x coordinate
     * @param {Number} y y coordinate
     * @param {Number} tolerance Tolerance
     */
    isTransparent: function(ctx, x, y, tolerance) {

      // If tolerance is > 0 adjust start coords to take into account.
      // If moves off Canvas fix to 0
      if (tolerance > 0) {
        if (x > tolerance) {
          x -= tolerance;
        }
        else {
          x = 0;
        }
        if (y > tolerance) {
          y -= tolerance;
        }
        else {
          y = 0;
        }
      }

      var _isTransparent = true, i, temp,
          imageData = ctx.getImageData(x, y, (tolerance * 2) || 1, (tolerance * 2) || 1),
          l = imageData.data.length;

      // Split image data - for tolerance > 1, pixelDataSize = 4;
      for (i = 3; i < l; i += 4) {
        temp = imageData.data[i];
        _isTransparent = temp <= 0;
        if (_isTransparent === false) {
          break; // Stop if colour found
        }
      }

      imageData = null;

      return _isTransparent;
    },

    /**
     * Parse preserveAspectRatio attribute from element
     * @param {string} attribute to be parsed
     * @return {Object} an object containing align and meetOrSlice attribute
     */
    parsePreserveAspectRatioAttribute: function(attribute) {
      var meetOrSlice = 'meet', alignX = 'Mid', alignY = 'Mid',
          aspectRatioAttrs = attribute.split(' '), align;

      if (aspectRatioAttrs && aspectRatioAttrs.length) {
        meetOrSlice = aspectRatioAttrs.pop();
        if (meetOrSlice !== 'meet' && meetOrSlice !== 'slice') {
          align = meetOrSlice;
          meetOrSlice = 'meet';
        }
        else if (aspectRatioAttrs.length) {
          align = aspectRatioAttrs.pop();
        }
      }
      //divide align in alignX and alignY
      alignX = align !== 'none' ? align.slice(1, 4) : 'none';
      alignY = align !== 'none' ? align.slice(5, 8) : 'none';
      return {
        meetOrSlice: meetOrSlice,
        alignX: alignX,
        alignY: alignY
      };
    },

    /**
     * Clear char widths cache for a font family.
     * @memberOf fabric.util
     * @param {String} [fontFamily] font family to clear
     */
    clearFabricFontCache: function(fontFamily) {
      if (!fontFamily) {
        fabric.charWidthsCache = { };
      }
      else if (fabric.charWidthsCache[fontFamily]) {
        delete fabric.charWidthsCache[fontFamily];
      }
    }
  };

})(typeof exports !== 'undefined' ? exports : this);


(function() {

  var arcToSegmentsCache = { },
      segmentToBezierCache = { },
      boundsOfCurveCache = { },
      _join = Array.prototype.join;

  /* Adapted from http://dxr.mozilla.org/mozilla-central/source/content/svg/content/src/nsSVGPathDataParser.cpp
   * by Andrea Bogazzi code is under MPL. if you don't have a copy of the license you can take it here
   * http://mozilla.org/MPL/2.0/
   */
  function arcToSegments(toX, toY, rx, ry, large, sweep, rotateX) {
    var argsString = _join.call(arguments);
    if (arcToSegmentsCache[argsString]) {
      return arcToSegmentsCache[argsString];
    }

    var PI = Math.PI, th = rotateX * PI / 180,
        sinTh = Math.sin(th),
        cosTh = Math.cos(th),
        fromX = 0, fromY = 0;

    rx = Math.abs(rx);
    ry = Math.abs(ry);

    var px = -cosTh * toX * 0.5 - sinTh * toY * 0.5,
        py = -cosTh * toY * 0.5 + sinTh * toX * 0.5,
        rx2 = rx * rx, ry2 = ry * ry, py2 = py * py, px2 = px * px,
        pl = rx2 * ry2 - rx2 * py2 - ry2 * px2,
        root = 0;

    if (pl < 0) {
      var s = Math.sqrt(1 - pl / (rx2 * ry2));
      rx *= s;
      ry *= s;
    }
    else {
      root = (large === sweep ? -1.0 : 1.0) *
              Math.sqrt( pl / (rx2 * py2 + ry2 * px2));
    }

    var cx = root * rx * py / ry,
        cy = -root * ry * px / rx,
        cx1 = cosTh * cx - sinTh * cy + toX * 0.5,
        cy1 = sinTh * cx + cosTh * cy + toY * 0.5,
        mTheta = calcVectorAngle(1, 0, (px - cx) / rx, (py - cy) / ry),
        dtheta = calcVectorAngle((px - cx) / rx, (py - cy) / ry, (-px - cx) / rx, (-py - cy) / ry);

    if (sweep === 0 && dtheta > 0) {
      dtheta -= 2 * PI;
    }
    else if (sweep === 1 && dtheta < 0) {
      dtheta += 2 * PI;
    }

    // Convert into cubic bezier segments <= 90deg
    var segments = Math.ceil(Math.abs(dtheta / PI * 2)),
        result = [], mDelta = dtheta / segments,
        mT = 8 / 3 * Math.sin(mDelta / 4) * Math.sin(mDelta / 4) / Math.sin(mDelta / 2),
        th3 = mTheta + mDelta;

    for (var i = 0; i < segments; i++) {
      result[i] = segmentToBezier(mTheta, th3, cosTh, sinTh, rx, ry, cx1, cy1, mT, fromX, fromY);
      fromX = result[i][4];
      fromY = result[i][5];
      mTheta = th3;
      th3 += mDelta;
    }
    arcToSegmentsCache[argsString] = result;
    return result;
  }

  function segmentToBezier(th2, th3, cosTh, sinTh, rx, ry, cx1, cy1, mT, fromX, fromY) {
    var argsString2 = _join.call(arguments);
    if (segmentToBezierCache[argsString2]) {
      return segmentToBezierCache[argsString2];
    }

    var costh2 = Math.cos(th2),
        sinth2 = Math.sin(th2),
        costh3 = Math.cos(th3),
        sinth3 = Math.sin(th3),
        toX = cosTh * rx * costh3 - sinTh * ry * sinth3 + cx1,
        toY = sinTh * rx * costh3 + cosTh * ry * sinth3 + cy1,
        cp1X = fromX + mT * ( -cosTh * rx * sinth2 - sinTh * ry * costh2),
        cp1Y = fromY + mT * ( -sinTh * rx * sinth2 + cosTh * ry * costh2),
        cp2X = toX + mT * ( cosTh * rx * sinth3 + sinTh * ry * costh3),
        cp2Y = toY + mT * ( sinTh * rx * sinth3 - cosTh * ry * costh3);

    segmentToBezierCache[argsString2] = [
      cp1X, cp1Y,
      cp2X, cp2Y,
      toX, toY
    ];
    return segmentToBezierCache[argsString2];
  }

  /*
   * Private
   */
  function calcVectorAngle(ux, uy, vx, vy) {
    var ta = Math.atan2(uy, ux),
        tb = Math.atan2(vy, vx);
    if (tb >= ta) {
      return tb - ta;
    }
    else {
      return 2 * Math.PI - (ta - tb);
    }
  }

  /**
   * Draws arc
   * @param {CanvasRenderingContext2D} ctx
   * @param {Number} fx
   * @param {Number} fy
   * @param {Array} coords
   */
  fabric.util.drawArc = function(ctx, fx, fy, coords) {
    var rx = coords[0],
        ry = coords[1],
        rot = coords[2],
        large = coords[3],
        sweep = coords[4],
        tx = coords[5],
        ty = coords[6],
        segs = [[], [], [], []],
        segsNorm = arcToSegments(tx - fx, ty - fy, rx, ry, large, sweep, rot);

    for (var i = 0, len = segsNorm.length; i < len; i++) {
      segs[i][0] = segsNorm[i][0] + fx;
      segs[i][1] = segsNorm[i][1] + fy;
      segs[i][2] = segsNorm[i][2] + fx;
      segs[i][3] = segsNorm[i][3] + fy;
      segs[i][4] = segsNorm[i][4] + fx;
      segs[i][5] = segsNorm[i][5] + fy;
      ctx.bezierCurveTo.apply(ctx, segs[i]);
    }
  };

  /**
   * Calculate bounding box of a elliptic-arc
   * @param {Number} fx start point of arc
   * @param {Number} fy
   * @param {Number} rx horizontal radius
   * @param {Number} ry vertical radius
   * @param {Number} rot angle of horizontal axe
   * @param {Number} large 1 or 0, whatever the arc is the big or the small on the 2 points
   * @param {Number} sweep 1 or 0, 1 clockwise or counterclockwise direction
   * @param {Number} tx end point of arc
   * @param {Number} ty
   */
  fabric.util.getBoundsOfArc = function(fx, fy, rx, ry, rot, large, sweep, tx, ty) {

    var fromX = 0, fromY = 0, bound, bounds = [],
        segs = arcToSegments(tx - fx, ty - fy, rx, ry, large, sweep, rot);

    for (var i = 0, len = segs.length; i < len; i++) {
      bound = getBoundsOfCurve(fromX, fromY, segs[i][0], segs[i][1], segs[i][2], segs[i][3], segs[i][4], segs[i][5]);
      bounds.push({ x: bound[0].x + fx, y: bound[0].y + fy });
      bounds.push({ x: bound[1].x + fx, y: bound[1].y + fy });
      fromX = segs[i][4];
      fromY = segs[i][5];
    }
    return bounds;
  };

  /**
   * Calculate bounding box of a beziercurve
   * @param {Number} x0 starting point
   * @param {Number} y0
   * @param {Number} x1 first control point
   * @param {Number} y1
   * @param {Number} x2 secondo control point
   * @param {Number} y2
   * @param {Number} x3 end of beizer
   * @param {Number} y3
   */
  // taken from http://jsbin.com/ivomiq/56/edit  no credits available for that.
  function getBoundsOfCurve(x0, y0, x1, y1, x2, y2, x3, y3) {
    var argsString = _join.call(arguments);
    if (boundsOfCurveCache[argsString]) {
      return boundsOfCurveCache[argsString];
    }

    var sqrt = Math.sqrt,
        min = Math.min, max = Math.max,
        abs = Math.abs, tvalues = [],
        bounds = [[], []],
        a, b, c, t, t1, t2, b2ac, sqrtb2ac;

    b = 6 * x0 - 12 * x1 + 6 * x2;
    a = -3 * x0 + 9 * x1 - 9 * x2 + 3 * x3;
    c = 3 * x1 - 3 * x0;

    for (var i = 0; i < 2; ++i) {
      if (i > 0) {
        b = 6 * y0 - 12 * y1 + 6 * y2;
        a = -3 * y0 + 9 * y1 - 9 * y2 + 3 * y3;
        c = 3 * y1 - 3 * y0;
      }

      if (abs(a) < 1e-12) {
        if (abs(b) < 1e-12) {
          continue;
        }
        t = -c / b;
        if (0 < t && t < 1) {
          tvalues.push(t);
        }
        continue;
      }
      b2ac = b * b - 4 * c * a;
      if (b2ac < 0) {
        continue;
      }
      sqrtb2ac = sqrt(b2ac);
      t1 = (-b + sqrtb2ac) / (2 * a);
      if (0 < t1 && t1 < 1) {
        tvalues.push(t1);
      }
      t2 = (-b - sqrtb2ac) / (2 * a);
      if (0 < t2 && t2 < 1) {
        tvalues.push(t2);
      }
    }

    var x, y, j = tvalues.length, jlen = j, mt;
    while (j--) {
      t = tvalues[j];
      mt = 1 - t;
      x = (mt * mt * mt * x0) + (3 * mt * mt * t * x1) + (3 * mt * t * t * x2) + (t * t * t * x3);
      bounds[0][j] = x;

      y = (mt * mt * mt * y0) + (3 * mt * mt * t * y1) + (3 * mt * t * t * y2) + (t * t * t * y3);
      bounds[1][j] = y;
    }

    bounds[0][jlen] = x0;
    bounds[1][jlen] = y0;
    bounds[0][jlen + 1] = x3;
    bounds[1][jlen + 1] = y3;
    var result = [
      {
        x: min.apply(null, bounds[0]),
        y: min.apply(null, bounds[1])
      },
      {
        x: max.apply(null, bounds[0]),
        y: max.apply(null, bounds[1])
      }
    ];
    boundsOfCurveCache[argsString] = result;
    return result;
  }

  fabric.util.getBoundsOfCurve = getBoundsOfCurve;

})();


(function() {

  var slice = Array.prototype.slice;

  /* _ES5_COMPAT_START_ */

  if (!Array.prototype.indexOf) {
    /**
     * Finds index of an element in an array
     * @param {*} searchElement
     * @return {Number}
     */
    Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
      if (this === void 0 || this === null) {
        throw new TypeError();
      }
      var t = Object(this), len = t.length >>> 0;
      if (len === 0) {
        return -1;
      }
      var n = 0;
      if (arguments.length > 0) {
        n = Number(arguments[1]);
        if (n !== n) { // shortcut for verifying if it's NaN
          n = 0;
        }
        else if (n !== 0 && n !== Number.POSITIVE_INFINITY && n !== Number.NEGATIVE_INFINITY) {
          n = (n > 0 || -1) * Math.floor(Math.abs(n));
        }
      }
      if (n >= len) {
        return -1;
      }
      var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
      for (; k < len; k++) {
        if (k in t && t[k] === searchElement) {
          return k;
        }
      }
      return -1;
    };
  }

  if (!Array.prototype.forEach) {
    /**
     * Iterates an array, invoking callback for each element
     * @param {Function} fn Callback to invoke for each element
     * @param {Object} [context] Context to invoke callback in
     * @return {Array}
     */
    Array.prototype.forEach = function(fn, context) {
      for (var i = 0, len = this.length >>> 0; i < len; i++) {
        if (i in this) {
          fn.call(context, this[i], i, this);
        }
      }
    };
  }

  if (!Array.prototype.map) {
    /**
     * Returns a result of iterating over an array, invoking callback for each element
     * @param {Function} fn Callback to invoke for each element
     * @param {Object} [context] Context to invoke callback in
     * @return {Array}
     */
    Array.prototype.map = function(fn, context) {
      var result = [];
      for (var i = 0, len = this.length >>> 0; i < len; i++) {
        if (i in this) {
          result[i] = fn.call(context, this[i], i, this);
        }
      }
      return result;
    };
  }

  if (!Array.prototype.every) {
    /**
     * Returns true if a callback returns truthy value for all elements in an array
     * @param {Function} fn Callback to invoke for each element
     * @param {Object} [context] Context to invoke callback in
     * @return {Boolean}
     */
    Array.prototype.every = function(fn, context) {
      for (var i = 0, len = this.length >>> 0; i < len; i++) {
        if (i in this && !fn.call(context, this[i], i, this)) {
          return false;
        }
      }
      return true;
    };
  }

  if (!Array.prototype.some) {
    /**
     * Returns true if a callback returns truthy value for at least one element in an array
     * @param {Function} fn Callback to invoke for each element
     * @param {Object} [context] Context to invoke callback in
     * @return {Boolean}
     */
    Array.prototype.some = function(fn, context) {
      for (var i = 0, len = this.length >>> 0; i < len; i++) {
        if (i in this && fn.call(context, this[i], i, this)) {
          return true;
        }
      }
      return false;
    };
  }

  if (!Array.prototype.filter) {
    /**
     * Returns the result of iterating over elements in an array
     * @param {Function} fn Callback to invoke for each element
     * @param {Object} [context] Context to invoke callback in
     * @return {Array}
     */
    Array.prototype.filter = function(fn, context) {
      var result = [], val;
      for (var i = 0, len = this.length >>> 0; i < len; i++) {
        if (i in this) {
          val = this[i]; // in case fn mutates this
          if (fn.call(context, val, i, this)) {
            result.push(val);
          }
        }
      }
      return result;
    };
  }

  if (!Array.prototype.reduce) {
    /**
     * Returns "folded" (reduced) result of iterating over elements in an array
     * @param {Function} fn Callback to invoke for each element
     * @return {*}
     */
    Array.prototype.reduce = function(fn /*, initial*/) {
      var len = this.length >>> 0,
          i = 0,
          rv;

      if (arguments.length > 1) {
        rv = arguments[1];
      }
      else {
        do {
          if (i in this) {
            rv = this[i++];
            break;
          }
          // if array contains no values, no initial value to return
          if (++i >= len) {
            throw new TypeError();
          }
        }
        while (true);
      }
      for (; i < len; i++) {
        if (i in this) {
          rv = fn.call(null, rv, this[i], i, this);
        }
      }
      return rv;
    };
  }

  /* _ES5_COMPAT_END_ */

  /**
   * Invokes method on all items in a given array
   * @memberOf fabric.util.array
   * @param {Array} array Array to iterate over
   * @param {String} method Name of a method to invoke
   * @return {Array}
   */
  function invoke(array, method) {
    var args = slice.call(arguments, 2), result = [];
    for (var i = 0, len = array.length; i < len; i++) {
      result[i] = args.length ? array[i][method].apply(array[i], args) : array[i][method].call(array[i]);
    }
    return result;
  }

  /**
   * Finds maximum value in array (not necessarily "first" one)
   * @memberOf fabric.util.array
   * @param {Array} array Array to iterate over
   * @param {String} byProperty
   * @return {*}
   */
  function max(array, byProperty) {
    return find(array, byProperty, function(value1, value2) {
      return value1 >= value2;
    });
  }

  /**
   * Finds minimum value in array (not necessarily "first" one)
   * @memberOf fabric.util.array
   * @param {Array} array Array to iterate over
   * @param {String} byProperty
   * @return {*}
   */
  function min(array, byProperty) {
    return find(array, byProperty, function(value1, value2) {
      return value1 < value2;
    });
  }

  /**
   * @private
   */
  function fill(array, value) {
    var k = array.length;
    while (k--) {
      array[k] = value;
    }
    return array;
  }

  /**
   * @private
   */
  function find(array, byProperty, condition) {
    if (!array || array.length === 0) {
      return;
    }

    var i = array.length - 1,
        result = byProperty ? array[i][byProperty] : array[i];
    if (byProperty) {
      while (i--) {
        if (condition(array[i][byProperty], result)) {
          result = array[i][byProperty];
        }
      }
    }
    else {
      while (i--) {
        if (condition(array[i], result)) {
          result = array[i];
        }
      }
    }
    return result;
  }

  /**
   * @namespace fabric.util.array
   */
  fabric.util.array = {
    fill: fill,
    invoke: invoke,
    min: min,
    max: max
  };

})();


(function() {
  /**
   * Copies all enumerable properties of one object to another
   * @memberOf fabric.util.object
   * @param {Object} destination Where to copy to
   * @param {Object} source Where to copy from
   * @return {Object}
   */

  function extend(destination, source, deep) {
    // JScript DontEnum bug is not taken care of
    // the deep clone is for internal use, is not meant to avoid
    // javascript traps or cloning html element or self referenced objects.
    if (deep) {
      if (!fabric.isLikelyNode && source instanceof Element) {
        // avoid cloning deep images, canvases,
        destination = source;
      }
      else if (source instanceof Array) {
        destination = source.map(function(v) {
          return clone(v, deep)
        })
      }
      else if (source instanceof Object) {
        for (var property in source) {
          destination[property] = clone(source[property], deep)
        }
      }
      else {
        // this sounds odd for an extend but is ok for recursive use
        destination = source;
      }
    }
    else {
      for (var property in source) {
        destination[property] = source[property];
      }
    }
    return destination;
  }

  /**
   * Creates an empty object and copies all enumerable properties of another object to it
   * @memberOf fabric.util.object
   * @param {Object} object Object to clone
   * @return {Object}
   */
  function clone(object, deep) {
    return extend({ }, object, deep);
  }

  /** @namespace fabric.util.object */
  fabric.util.object = {
    extend: extend,
    clone: clone
  };

})();


(function() {

  /* _ES5_COMPAT_START_ */
  if (!String.prototype.trim) {
    /**
     * Trims a string (removing whitespace from the beginning and the end)
     * @function external:String#trim
     * @see <a href="https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/String/Trim">String#trim on MDN</a>
     */
    String.prototype.trim = function () {
      // this trim is not fully ES3 or ES5 compliant, but it should cover most cases for now
      return this.replace(/^[\s\xA0]+/, '').replace(/[\s\xA0]+$/, '');
    };
  }
  /* _ES5_COMPAT_END_ */

  /**
   * Camelizes a string
   * @memberOf fabric.util.string
   * @param {String} string String to camelize
   * @return {String} Camelized version of a string
   */
  function camelize(string) {
    return string.replace(/-+(.)?/g, function(match, character) {
      return character ? character.toUpperCase() : '';
    });
  }

  /**
   * Capitalizes a string
   * @memberOf fabric.util.string
   * @param {String} string String to capitalize
   * @param {Boolean} [firstLetterOnly] If true only first letter is capitalized
   * and other letters stay untouched, if false first letter is capitalized
   * and other letters are converted to lowercase.
   * @return {String} Capitalized version of a string
   */
  function capitalize(string, firstLetterOnly) {
    return string.charAt(0).toUpperCase() +
      (firstLetterOnly ? string.slice(1) : string.slice(1).toLowerCase());
  }

  /**
   * Escapes XML in a string
   * @memberOf fabric.util.string
   * @param {String} string String to escape
   * @return {String} Escaped version of a string
   */
  function escapeXml(string) {
    return string.replace(/&/g, '&amp;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&apos;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;');
  }

  /**
   * String utilities
   * @namespace fabric.util.string
   */
  fabric.util.string = {
    camelize: camelize,
    capitalize: capitalize,
    escapeXml: escapeXml
  };
})();


/* _ES5_COMPAT_START_ */
(function() {

  var slice = Array.prototype.slice,
      apply = Function.prototype.apply,
      Dummy = function() { };

  if (!Function.prototype.bind) {
    /**
     * Cross-browser approximation of ES5 Function.prototype.bind (not fully spec conforming)
     * @see <a href="https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/bind">Function#bind on MDN</a>
     * @param {Object} thisArg Object to bind function to
     * @param {Any[]} Values to pass to a bound function
     * @return {Function}
     */
    Function.prototype.bind = function(thisArg) {
      var _this = this, args = slice.call(arguments, 1), bound;
      if (args.length) {
        bound = function() {
          return apply.call(_this, this instanceof Dummy ? this : thisArg, args.concat(slice.call(arguments)));
        };
      }
      else {
        /** @ignore */
        bound = function() {
          return apply.call(_this, this instanceof Dummy ? this : thisArg, arguments);
        };
      }
      Dummy.prototype = this.prototype;
      bound.prototype = new Dummy();

      return bound;
    };
  }

})();
/* _ES5_COMPAT_END_ */


(function() {

  var slice = Array.prototype.slice, emptyFunction = function() { },

      IS_DONTENUM_BUGGY = (function() {
        for (var p in { toString: 1 }) {
          if (p === 'toString') {
            return false;
          }
        }
        return true;
      })(),

      /** @ignore */
      addMethods = function(klass, source, parent) {
        for (var property in source) {

          if (property in klass.prototype &&
              typeof klass.prototype[property] === 'function' &&
              (source[property] + '').indexOf('callSuper') > -1) {

            klass.prototype[property] = (function(property) {
              return function() {

                var superclass = this.constructor.superclass;
                this.constructor.superclass = parent;
                var returnValue = source[property].apply(this, arguments);
                this.constructor.superclass = superclass;

                if (property !== 'initialize') {
                  return returnValue;
                }
              };
            })(property);
          }
          else {
            klass.prototype[property] = source[property];
          }

          if (IS_DONTENUM_BUGGY) {
            if (source.toString !== Object.prototype.toString) {
              klass.prototype.toString = source.toString;
            }
            if (source.valueOf !== Object.prototype.valueOf) {
              klass.prototype.valueOf = source.valueOf;
            }
          }
        }
      };

  function Subclass() { }

  function callSuper(methodName) {
    var fn = this.constructor.superclass.prototype[methodName];
    return (arguments.length > 1)
      ? fn.apply(this, slice.call(arguments, 1))
      : fn.call(this);
  }

  /**
   * Helper for creation of "classes".
   * @memberOf fabric.util
   * @param {Function} [parent] optional "Class" to inherit from
   * @param {Object} [properties] Properties shared by all instances of this class
   *                  (be careful modifying objects defined here as this would affect all instances)
   */
  function createClass() {
    var parent = null,
        properties = slice.call(arguments, 0);

    if (typeof properties[0] === 'function') {
      parent = properties.shift();
    }
    function klass() {
      this.initialize.apply(this, arguments);
    }

    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      Subclass.prototype = parent.prototype;
      klass.prototype = new Subclass();
      parent.subclasses.push(klass);
    }
    for (var i = 0, length = properties.length; i < length; i++) {
      addMethods(klass, properties[i], parent);
    }
    if (!klass.prototype.initialize) {
      klass.prototype.initialize = emptyFunction;
    }
    klass.prototype.constructor = klass;
    klass.prototype.callSuper = callSuper;
    return klass;
  }

  fabric.util.createClass = createClass;
})();


(function () {

  var unknown = 'unknown';

  /* EVENT HANDLING */

  function areHostMethods(object) {
    var methodNames = Array.prototype.slice.call(arguments, 1),
        t, i, len = methodNames.length;
    for (i = 0; i < len; i++) {
      t = typeof object[methodNames[i]];
      if (!(/^(?:function|object|unknown)$/).test(t)) {
        return false;
      }
    }
    return true;
  }

  /** @ignore */
  var getElement,
      setElement,
      getUniqueId = (function () {
        var uid = 0;
        return function (element) {
          return element.__uniqueID || (element.__uniqueID = 'uniqueID__' + uid++);
        };
      })();

  (function () {
    var elements = { };
    /** @ignore */
    getElement = function (uid) {
      return elements[uid];
    };
    /** @ignore */
    setElement = function (uid, element) {
      elements[uid] = element;
    };
  })();

  function createListener(uid, handler) {
    return {
      handler: handler,
      wrappedHandler: createWrappedHandler(uid, handler)
    };
  }

  function createWrappedHandler(uid, handler) {
    return function (e) {
      handler.call(getElement(uid), e || fabric.window.event);
    };
  }

  function createDispatcher(uid, eventName) {
    return function (e) {
      if (handlers[uid] && handlers[uid][eventName]) {
        var handlersForEvent = handlers[uid][eventName];
        for (var i = 0, len = handlersForEvent.length; i < len; i++) {
          handlersForEvent[i].call(this, e || fabric.window.event);
        }
      }
    };
  }

  var shouldUseAddListenerRemoveListener = (
        areHostMethods(fabric.document.documentElement, 'addEventListener', 'removeEventListener') &&
        areHostMethods(fabric.window, 'addEventListener', 'removeEventListener')),

      shouldUseAttachEventDetachEvent = (
        areHostMethods(fabric.document.documentElement, 'attachEvent', 'detachEvent') &&
        areHostMethods(fabric.window, 'attachEvent', 'detachEvent')),

      // IE branch
      listeners = { },

      // DOM L0 branch
      handlers = { },

      addListener, removeListener;

  if (shouldUseAddListenerRemoveListener) {
    /** @ignore */
    addListener = function (element, eventName, handler) {
      element.addEventListener(eventName, handler, false);
    };
    /** @ignore */
    removeListener = function (element, eventName, handler) {
      element.removeEventListener(eventName, handler, false);
    };
  }

  else if (shouldUseAttachEventDetachEvent) {
    /** @ignore */
    addListener = function (element, eventName, handler) {
      var uid = getUniqueId(element);
      setElement(uid, element);
      if (!listeners[uid]) {
        listeners[uid] = { };
      }
      if (!listeners[uid][eventName]) {
        listeners[uid][eventName] = [];

      }
      var listener = createListener(uid, handler);
      listeners[uid][eventName].push(listener);
      element.attachEvent('on' + eventName, listener.wrappedHandler);
    };
    /** @ignore */
    removeListener = function (element, eventName, handler) {
      var uid = getUniqueId(element), listener;
      if (listeners[uid] && listeners[uid][eventName]) {
        for (var i = 0, len = listeners[uid][eventName].length; i < len; i++) {
          listener = listeners[uid][eventName][i];
          if (listener && listener.handler === handler) {
            element.detachEvent('on' + eventName, listener.wrappedHandler);
            listeners[uid][eventName][i] = null;
          }
        }
      }
    };
  }
  else {
    /** @ignore */
    addListener = function (element, eventName, handler) {
      var uid = getUniqueId(element);
      if (!handlers[uid]) {
        handlers[uid] = { };
      }
      if (!handlers[uid][eventName]) {
        handlers[uid][eventName] = [];
        var existingHandler = element['on' + eventName];
        if (existingHandler) {
          handlers[uid][eventName].push(existingHandler);
        }
        element['on' + eventName] = createDispatcher(uid, eventName);
      }
      handlers[uid][eventName].push(handler);
    };
    /** @ignore */
    removeListener = function (element, eventName, handler) {
      var uid = getUniqueId(element);
      if (handlers[uid] && handlers[uid][eventName]) {
        var handlersForEvent = handlers[uid][eventName];
        for (var i = 0, len = handlersForEvent.length; i < len; i++) {
          if (handlersForEvent[i] === handler) {
            handlersForEvent.splice(i, 1);
          }
        }
      }
    };
  }

  /**
   * Adds an event listener to an element
   * @function
   * @memberOf fabric.util
   * @param {HTMLElement} element
   * @param {String} eventName
   * @param {Function} handler
   */
  fabric.util.addListener = addListener;

  /**
   * Removes an event listener from an element
   * @function
   * @memberOf fabric.util
   * @param {HTMLElement} element
   * @param {String} eventName
   * @param {Function} handler
   */
  fabric.util.removeListener = removeListener;

  /**
   * Cross-browser wrapper for getting event's coordinates
   * @memberOf fabric.util
   * @param {Event} event Event object
   */
  function getPointer(event) {
    event || (event = fabric.window.event);

    var element = event.target ||
                  (typeof event.srcElement !== unknown ? event.srcElement : null),

        scroll = fabric.util.getScrollLeftTop(element);

    return {
      x: pointerX(event) + scroll.left,
      y: pointerY(event) + scroll.top
    };
  }

  var pointerX = function(event) {
    // looks like in IE (<9) clientX at certain point (apparently when mouseup fires on VML element)
    // is represented as COM object, with all the consequences, like "unknown" type and error on [[Get]]
    // need to investigate later
        return (typeof event.clientX !== unknown ? event.clientX : 0);
      },

      pointerY = function(event) {
        return (typeof event.clientY !== unknown ? event.clientY : 0);
      };

  function _getPointer(event, pageProp, clientProp) {
    var touchProp = event.type === 'touchend' ? 'changedTouches' : 'touches';

    return (event[touchProp] && event[touchProp][0]
      ? (event[touchProp][0][pageProp] - (event[touchProp][0][pageProp] - event[touchProp][0][clientProp]))
        || event[clientProp]
      : event[clientProp]);
  }

  if (fabric.isTouchSupported) {
    pointerX = function(event) {
      return _getPointer(event, 'pageX', 'clientX');
    };
    pointerY = function(event) {
      return _getPointer(event, 'pageY', 'clientY');
    };
  }

  fabric.util.getPointer = getPointer;

  fabric.util.object.extend(fabric.util, fabric.Observable);

})();


(function () {

  /**
   * Cross-browser wrapper for setting element's style
   * @memberOf fabric.util
   * @param {HTMLElement} element
   * @param {Object} styles
   * @return {HTMLElement} Element that was passed as a first argument
   */
  function setStyle(element, styles) {
    var elementStyle = element.style;
    if (!elementStyle) {
      return element;
    }
    if (typeof styles === 'string') {
      element.style.cssText += ';' + styles;
      return styles.indexOf('opacity') > -1
        ? setOpacity(element, styles.match(/opacity:\s*(\d?\.?\d*)/)[1])
        : element;
    }
    for (var property in styles) {
      if (property === 'opacity') {
        setOpacity(element, styles[property]);
      }
      else {
        var normalizedProperty = (property === 'float' || property === 'cssFloat')
          ? (typeof elementStyle.styleFloat === 'undefined' ? 'cssFloat' : 'styleFloat')
          : property;
        elementStyle[normalizedProperty] = styles[property];
      }
    }
    return element;
  }

  var parseEl = fabric.document.createElement('div'),
      supportsOpacity = typeof parseEl.style.opacity === 'string',
      supportsFilters = typeof parseEl.style.filter === 'string',
      reOpacity = /alpha\s*\(\s*opacity\s*=\s*([^\)]+)\)/,

      /** @ignore */
      setOpacity = function (element) { return element; };

  if (supportsOpacity) {
    /** @ignore */
    setOpacity = function(element, value) {
      element.style.opacity = value;
      return element;
    };
  }
  else if (supportsFilters) {
    /** @ignore */
    setOpacity = function(element, value) {
      var es = element.style;
      if (element.currentStyle && !element.currentStyle.hasLayout) {
        es.zoom = 1;
      }
      if (reOpacity.test(es.filter)) {
        value = value >= 0.9999 ? '' : ('alpha(opacity=' + (value * 100) + ')');
        es.filter = es.filter.replace(reOpacity, value);
      }
      else {
        es.filter += ' alpha(opacity=' + (value * 100) + ')';
      }
      return element;
    };
  }

  fabric.util.setStyle = setStyle;

})();


(function() {

  var _slice = Array.prototype.slice;

  /**
   * Takes id and returns an element with that id (if one exists in a document)
   * @memberOf fabric.util
   * @param {String|HTMLElement} id
   * @return {HTMLElement|null}
   */
  function getById(id) {
    return typeof id === 'string' ? fabric.document.getElementById(id) : id;
  }

  var sliceCanConvertNodelists,
      /**
       * Converts an array-like object (e.g. arguments or NodeList) to an array
       * @memberOf fabric.util
       * @param {Object} arrayLike
       * @return {Array}
       */
      toArray = function(arrayLike) {
        return _slice.call(arrayLike, 0);
      };

  try {
    sliceCanConvertNodelists = toArray(fabric.document.childNodes) instanceof Array;
  }
  catch (err) { }

  if (!sliceCanConvertNodelists) {
    toArray = function(arrayLike) {
      var arr = new Array(arrayLike.length), i = arrayLike.length;
      while (i--) {
        arr[i] = arrayLike[i];
      }
      return arr;
    };
  }

  /**
   * Creates specified element with specified attributes
   * @memberOf fabric.util
   * @param {String} tagName Type of an element to create
   * @param {Object} [attributes] Attributes to set on an element
   * @return {HTMLElement} Newly created element
   */
  function makeElement(tagName, attributes) {
    var el = fabric.document.createElement(tagName);
    for (var prop in attributes) {
      if (prop === 'class') {
        el.className = attributes[prop];
      }
      else if (prop === 'for') {
        el.htmlFor = attributes[prop];
      }
      else {
        el.setAttribute(prop, attributes[prop]);
      }
    }
    return el;
  }

  /**
   * Adds class to an element
   * @memberOf fabric.util
   * @param {HTMLElement} element Element to add class to
   * @param {String} className Class to add to an element
   */
  function addClass(element, className) {
    if (element && (' ' + element.className + ' ').indexOf(' ' + className + ' ') === -1) {
      element.className += (element.className ? ' ' : '') + className;
    }
  }

  /**
   * Wraps element with another element
   * @memberOf fabric.util
   * @param {HTMLElement} element Element to wrap
   * @param {HTMLElement|String} wrapper Element to wrap with
   * @param {Object} [attributes] Attributes to set on a wrapper
   * @return {HTMLElement} wrapper
   */
  function wrapElement(element, wrapper, attributes) {
    if (typeof wrapper === 'string') {
      wrapper = makeElement(wrapper, attributes);
    }
    if (element.parentNode) {
      element.parentNode.replaceChild(wrapper, element);
    }
    wrapper.appendChild(element);
    return wrapper;
  }

  /**
   * Returns element scroll offsets
   * @memberOf fabric.util
   * @param {HTMLElement} element Element to operate on
   * @return {Object} Object with left/top values
   */
  function getScrollLeftTop(element) {

    var left = 0,
        top = 0,
        docElement = fabric.document.documentElement,
        body = fabric.document.body || {
          scrollLeft: 0, scrollTop: 0
        };

    // While loop checks (and then sets element to) .parentNode OR .host
    //  to account for ShadowDOM. We still want to traverse up out of ShadowDOM,
    //  but the .parentNode of a root ShadowDOM node will always be null, instead
    //  it should be accessed through .host. See http://stackoverflow.com/a/24765528/4383938
    while (element && (element.parentNode || element.host)) {

      // Set element to element parent, or 'host' in case of ShadowDOM
      element = element.parentNode || element.host;

      if (element === fabric.document) {
        left = body.scrollLeft || docElement.scrollLeft || 0;
        top = body.scrollTop ||  docElement.scrollTop || 0;
      }
      else {
        left += element.scrollLeft || 0;
        top += element.scrollTop || 0;
      }

      if (element.nodeType === 1 &&
          fabric.util.getElementStyle(element, 'position') === 'fixed') {
        break;
      }
    }

    return { left: left, top: top };
  }

  /**
   * Returns offset for a given element
   * @function
   * @memberOf fabric.util
   * @param {HTMLElement} element Element to get offset for
   * @return {Object} Object with "left" and "top" properties
   */
  function getElementOffset(element) {
    var docElem,
        doc = element && element.ownerDocument,
        box = { left: 0, top: 0 },
        offset = { left: 0, top: 0 },
        scrollLeftTop,
        offsetAttributes = {
          borderLeftWidth: 'left',
          borderTopWidth:  'top',
          paddingLeft:     'left',
          paddingTop:      'top'
        };

    if (!doc) {
      return offset;
    }

    for (var attr in offsetAttributes) {
      offset[offsetAttributes[attr]] += parseInt(getElementStyle(element, attr), 10) || 0;
    }

    docElem = doc.documentElement;
    if ( typeof element.getBoundingClientRect !== 'undefined' ) {
      box = element.getBoundingClientRect();
    }

    scrollLeftTop = getScrollLeftTop(element);

    return {
      left: box.left + scrollLeftTop.left - (docElem.clientLeft || 0) + offset.left,
      top: box.top + scrollLeftTop.top - (docElem.clientTop || 0)  + offset.top
    };
  }

  /**
   * Returns style attribute value of a given element
   * @memberOf fabric.util
   * @param {HTMLElement} element Element to get style attribute for
   * @param {String} attr Style attribute to get for element
   * @return {String} Style attribute value of the given element.
   */
  var getElementStyle;
  if (fabric.document.defaultView && fabric.document.defaultView.getComputedStyle) {
    getElementStyle = function(element, attr) {
      var style = fabric.document.defaultView.getComputedStyle(element, null);
      return style ? style[attr] : undefined;
    };
  }
  else {
    getElementStyle = function(element, attr) {
      var value = element.style[attr];
      if (!value && element.currentStyle) {
        value = element.currentStyle[attr];
      }
      return value;
    };
  }

  (function () {
    var style = fabric.document.documentElement.style,
        selectProp = 'userSelect' in style
          ? 'userSelect'
          : 'MozUserSelect' in style
            ? 'MozUserSelect'
            : 'WebkitUserSelect' in style
              ? 'WebkitUserSelect'
              : 'KhtmlUserSelect' in style
                ? 'KhtmlUserSelect'
                : '';

    /**
     * Makes element unselectable
     * @memberOf fabric.util
     * @param {HTMLElement} element Element to make unselectable
     * @return {HTMLElement} Element that was passed in
     */
    function makeElementUnselectable(element) {
      if (typeof element.onselectstart !== 'undefined') {
        element.onselectstart = fabric.util.falseFunction;
      }
      if (selectProp) {
        element.style[selectProp] = 'none';
      }
      else if (typeof element.unselectable === 'string') {
        element.unselectable = 'on';
      }
      return element;
    }

    /**
     * Makes element selectable
     * @memberOf fabric.util
     * @param {HTMLElement} element Element to make selectable
     * @return {HTMLElement} Element that was passed in
     */
    function makeElementSelectable(element) {
      if (typeof element.onselectstart !== 'undefined') {
        element.onselectstart = null;
      }
      if (selectProp) {
        element.style[selectProp] = '';
      }
      else if (typeof element.unselectable === 'string') {
        element.unselectable = '';
      }
      return element;
    }

    fabric.util.makeElementUnselectable = makeElementUnselectable;
    fabric.util.makeElementSelectable = makeElementSelectable;
  })();

  (function() {

    /**
     * Inserts a script element with a given url into a document; invokes callback, when that script is finished loading
     * @memberOf fabric.util
     * @param {String} url URL of a script to load
     * @param {Function} callback Callback to execute when script is finished loading
     */
    function getScript(url, callback) {
      var headEl = fabric.document.getElementsByTagName('head')[0],
          scriptEl = fabric.document.createElement('script'),
          loading = true;

      /** @ignore */
      scriptEl.onload = /** @ignore */ scriptEl.onreadystatechange = function(e) {
        if (loading) {
          if (typeof this.readyState === 'string' &&
              this.readyState !== 'loaded' &&
              this.readyState !== 'complete') {
            return;
          }
          loading = false;
          callback(e || fabric.window.event);
          scriptEl = scriptEl.onload = scriptEl.onreadystatechange = null;
        }
      };
      scriptEl.src = url;
      headEl.appendChild(scriptEl);
      // causes issue in Opera
      // headEl.removeChild(scriptEl);
    }

    fabric.util.getScript = getScript;
  })();

  fabric.util.getById = getById;
  fabric.util.toArray = toArray;
  fabric.util.makeElement = makeElement;
  fabric.util.addClass = addClass;
  fabric.util.wrapElement = wrapElement;
  fabric.util.getScrollLeftTop = getScrollLeftTop;
  fabric.util.getElementOffset = getElementOffset;
  fabric.util.getElementStyle = getElementStyle;

})();


(function() {

  function addParamToUrl(url, param) {
    return url + (/\?/.test(url) ? '&' : '?') + param;
  }

  var makeXHR = (function() {
    var factories = [
      function() { return new ActiveXObject('Microsoft.XMLHTTP'); },
      function() { return new ActiveXObject('Msxml2.XMLHTTP'); },
      function() { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); },
      function() { return new XMLHttpRequest(); }
    ];
    for (var i = factories.length; i--; ) {
      try {
        var req = factories[i]();
        if (req) {
          return factories[i];
        }
      }
      catch (err) { }
    }
  })();

  function emptyFn() { }

  /**
   * Cross-browser abstraction for sending XMLHttpRequest
   * @memberOf fabric.util
   * @param {String} url URL to send XMLHttpRequest to
   * @param {Object} [options] Options object
   * @param {String} [options.method="GET"]
   * @param {String} [options.parameters] parameters to append to url in GET or in body
   * @param {String} [options.body] body to send with POST or PUT request
   * @param {Function} options.onComplete Callback to invoke when request is completed
   * @return {XMLHttpRequest} request
   */
  function request(url, options) {

    options || (options = { });

    var method = options.method ? options.method.toUpperCase() : 'GET',
        onComplete = options.onComplete || function() { },
        xhr = makeXHR(),
        body = options.body || options.parameters;

    /** @ignore */
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        onComplete(xhr);
        xhr.onreadystatechange = emptyFn;
      }
    };

    if (method === 'GET') {
      body = null;
      if (typeof options.parameters === 'string') {
        url = addParamToUrl(url, options.parameters);
      }
    }

    xhr.open(method, url, true);

    if (method === 'POST' || method === 'PUT') {
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    }

    xhr.send(body);
    return xhr;
  }

  fabric.util.request = request;
})();


/**
 * Wrapper around `console.log` (when available)
 * @param {*} [values] Values to log
 */
fabric.log = function() { };

/**
 * Wrapper around `console.warn` (when available)
 * @param {*} [values] Values to log as a warning
 */
fabric.warn = function() { };

/* eslint-disable */
if (typeof console !== 'undefined') {

  ['log', 'warn'].forEach(function(methodName) {

    if (typeof console[methodName] !== 'undefined' &&
        typeof console[methodName].apply === 'function') {

      fabric[methodName] = function() {
        return console[methodName].apply(console, arguments);
      };
    }
  });
}
/* eslint-enable */


(function() {

  /**
   * Changes value from one to another within certain period of time, invoking callbacks as value is being changed.
   * @memberOf fabric.util
   * @param {Object} [options] Animation options
   * @param {Function} [options.onChange] Callback; invoked on every value change
   * @param {Function} [options.onComplete] Callback; invoked when value change is completed
   * @param {Number} [options.startValue=0] Starting value
   * @param {Number} [options.endValue=100] Ending value
   * @param {Number} [options.byValue=100] Value to modify the property by
   * @param {Function} [options.easing] Easing function
   * @param {Number} [options.duration=500] Duration of change (in ms)
   */
  function animate(options) {

    requestAnimFrame(function(timestamp) {
      options || (options = { });

      var start = timestamp || +new Date(),
          duration = options.duration || 500,
          finish = start + duration, time,
          onChange = options.onChange || function() { },
          abort = options.abort || function() { return false; },
          easing = options.easing || function(t, b, c, d) {return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;},
          startValue = 'startValue' in options ? options.startValue : 0,
          endValue = 'endValue' in options ? options.endValue : 100,
          byValue = options.byValue || endValue - startValue;

      options.onStart && options.onStart();

      (function tick(ticktime) {
        time = ticktime || +new Date();
        var currentTime = time > finish ? duration : (time - start);
        if (abort()) {
          options.onComplete && options.onComplete();
          return;
        }
        onChange(easing(currentTime, startValue, byValue, duration));
        if (time > finish) {
          options.onComplete && options.onComplete();
          return;
        }
        requestAnimFrame(tick);
      })(start);
    });

  }

  var _requestAnimFrame = fabric.window.requestAnimationFrame       ||
                          fabric.window.webkitRequestAnimationFrame ||
                          fabric.window.mozRequestAnimationFrame    ||
                          fabric.window.oRequestAnimationFrame      ||
                          fabric.window.msRequestAnimationFrame     ||
                          function(callback) {
                            fabric.window.setTimeout(callback, 1000 / 60);
                          };

  /**
   * requestAnimationFrame polyfill based on http://paulirish.com/2011/requestanimationframe-for-smart-animating/
   * In order to get a precise start time, `requestAnimFrame` should be called as an entry into the method
   * @memberOf fabric.util
   * @param {Function} callback Callback to invoke
   * @param {DOMElement} element optional Element to associate with animation
   */
  function requestAnimFrame() {
    return _requestAnimFrame.apply(fabric.window, arguments);
  }

  fabric.util.animate = animate;
  fabric.util.requestAnimFrame = requestAnimFrame;

})();


(function() {

  function normalize(a, c, p, s) {
    if (a < Math.abs(c)) {
      a = c;
      s = p / 4;
    }
    else {
      //handle the 0/0 case:
      if (c === 0 && a === 0) {
        s = p / (2 * Math.PI) * Math.asin(1);
      }
      else {
        s = p / (2 * Math.PI) * Math.asin(c / a);
      }
    }
    return { a: a, c: c, p: p, s: s };
  }

  function elastic(opts, t, d) {
    return opts.a *
      Math.pow(2, 10 * (t -= 1)) *
      Math.sin( (t * d - opts.s) * (2 * Math.PI) / opts.p );
  }

  /**
   * Cubic easing out
   * @memberOf fabric.util.ease
   */
  function easeOutCubic(t, b, c, d) {
    return c * ((t = t / d - 1) * t * t + 1) + b;
  }

  /**
   * Cubic easing in and out
   * @memberOf fabric.util.ease
   */
  function easeInOutCubic(t, b, c, d) {
    t /= d / 2;
    if (t < 1) {
      return c / 2 * t * t * t + b;
    }
    return c / 2 * ((t -= 2) * t * t + 2) + b;
  }

  /**
   * Quartic easing in
   * @memberOf fabric.util.ease
   */
  function easeInQuart(t, b, c, d) {
    return c * (t /= d) * t * t * t + b;
  }

  /**
   * Quartic easing out
   * @memberOf fabric.util.ease
   */
  function easeOutQuart(t, b, c, d) {
    return -c * ((t = t / d - 1) * t * t * t - 1) + b;
  }

  /**
   * Quartic easing in and out
   * @memberOf fabric.util.ease
   */
  function easeInOutQuart(t, b, c, d) {
    t /= d / 2;
    if (t < 1) {
      return c / 2 * t * t * t * t + b;
    }
    return -c / 2 * ((t -= 2) * t * t * t - 2) + b;
  }

  /**
   * Quintic easing in
   * @memberOf fabric.util.ease
   */
  function easeInQuint(t, b, c, d) {
    return c * (t /= d) * t * t * t * t + b;
  }

  /**
   * Quintic easing out
   * @memberOf fabric.util.ease
   */
  function easeOutQuint(t, b, c, d) {
    return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
  }

  /**
   * Quintic easing in and out
   * @memberOf fabric.util.ease
   */
  function easeInOutQuint(t, b, c, d) {
    t /= d / 2;
    if (t < 1) {
      return c / 2 * t * t * t * t * t + b;
    }
    return c / 2 * ((t -= 2) * t * t * t * t + 2) + b;
  }

  /**
   * Sinusoidal easing in
   * @memberOf fabric.util.ease
   */
  function easeInSine(t, b, c, d) {
    return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
  }

  /**
   * Sinusoidal easing out
   * @memberOf fabric.util.ease
   */
  function easeOutSine(t, b, c, d) {
    return c * Math.sin(t / d * (Math.PI / 2)) + b;
  }

  /**
   * Sinusoidal easing in and out
   * @memberOf fabric.util.ease
   */
  function easeInOutSine(t, b, c, d) {
    return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
  }

  /**
   * Exponential easing in
   * @memberOf fabric.util.ease
   */
  function easeInExpo(t, b, c, d) {
    return (t === 0) ? b : c * Math.pow(2, 10 * (t / d - 1)) + b;
  }

  /**
   * Exponential easing out
   * @memberOf fabric.util.ease
   */
  function easeOutExpo(t, b, c, d) {
    return (t === d) ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b;
  }

  /**
   * Exponential easing in and out
   * @memberOf fabric.util.ease
   */
  function easeInOutExpo(t, b, c, d) {
    if (t === 0) {
      return b;
    }
    if (t === d) {
      return b + c;
    }
    t /= d / 2;
    if (t < 1) {
      return c / 2 * Math.pow(2, 10 * (t - 1)) + b;
    }
    return c / 2 * (-Math.pow(2, -10 * --t) + 2) + b;
  }

  /**
   * Circular easing in
   * @memberOf fabric.util.ease
   */
  function easeInCirc(t, b, c, d) {
    return -c * (Math.sqrt(1 - (t /= d) * t) - 1) + b;
  }

  /**
   * Circular easing out
   * @memberOf fabric.util.ease
   */
  function easeOutCirc(t, b, c, d) {
    return c * Math.sqrt(1 - (t = t / d - 1) * t) + b;
  }

  /**
   * Circular easing in and out
   * @memberOf fabric.util.ease
   */
  function easeInOutCirc(t, b, c, d) {
    t /= d / 2;
    if (t < 1) {
      return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
    }
    return c / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + b;
  }

  /**
   * Elastic easing in
   * @memberOf fabric.util.ease
   */
  function easeInElastic(t, b, c, d) {
    var s = 1.70158, p = 0, a = c;
    if (t === 0) {
      return b;
    }
    t /= d;
    if (t === 1) {
      return b + c;
    }
    if (!p) {
      p = d * 0.3;
    }
    var opts = normalize(a, c, p, s);
    return -elastic(opts, t, d) + b;
  }

  /**
   * Elastic easing out
   * @memberOf fabric.util.ease
   */
  function easeOutElastic(t, b, c, d) {
    var s = 1.70158, p = 0, a = c;
    if (t === 0) {
      return b;
    }
    t /= d;
    if (t === 1) {
      return b + c;
    }
    if (!p) {
      p = d * 0.3;
    }
    var opts = normalize(a, c, p, s);
    return opts.a * Math.pow(2, -10 * t) * Math.sin((t * d - opts.s) * (2 * Math.PI) / opts.p ) + opts.c + b;
  }

  /**
   * Elastic easing in and out
   * @memberOf fabric.util.ease
   */
  function easeInOutElastic(t, b, c, d) {
    var s = 1.70158, p = 0, a = c;
    if (t === 0) {
      return b;
    }
    t /= d / 2;
    if (t === 2) {
      return b + c;
    }
    if (!p) {
      p = d * (0.3 * 1.5);
    }
    var opts = normalize(a, c, p, s);
    if (t < 1) {
      return -0.5 * elastic(opts, t, d) + b;
    }
    return opts.a * Math.pow(2, -10 * (t -= 1)) *
      Math.sin((t * d - opts.s) * (2 * Math.PI) / opts.p ) * 0.5 + opts.c + b;
  }

  /**
   * Backwards easing in
   * @memberOf fabric.util.ease
   */
  function easeInBack(t, b, c, d, s) {
    if (s === undefined) {
      s = 1.70158;
    }
    return c * (t /= d) * t * ((s + 1) * t - s) + b;
  }

  /**
   * Backwards easing out
   * @memberOf fabric.util.ease
   */
  function easeOutBack(t, b, c, d, s) {
    if (s === undefined) {
      s = 1.70158;
    }
    return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
  }

  /**
   * Backwards easing in and out
   * @memberOf fabric.util.ease
   */
  function easeInOutBack(t, b, c, d, s) {
    if (s === undefined) {
      s = 1.70158;
    }
    t /= d / 2;
    if (t < 1) {
      return c / 2 * (t * t * (((s *= (1.525)) + 1) * t - s)) + b;
    }
    return c / 2 * ((t -= 2) * t * (((s *= (1.525)) + 1) * t + s) + 2) + b;
  }

  /**
   * Bouncing easing in
   * @memberOf fabric.util.ease
   */
  function easeInBounce(t, b, c, d) {
    return c - easeOutBounce (d - t, 0, c, d) + b;
  }

  /**
   * Bouncing easing out
   * @memberOf fabric.util.ease
   */
  function easeOutBounce(t, b, c, d) {
    if ((t /= d) < (1 / 2.75)) {
      return c * (7.5625 * t * t) + b;
    }
    else if (t < (2 / 2.75)) {
      return c * (7.5625 * (t -= (1.5 / 2.75)) * t + 0.75) + b;
    }
    else if (t < (2.5 / 2.75)) {
      return c * (7.5625 * (t -= (2.25 / 2.75)) * t + 0.9375) + b;
    }
    else {
      return c * (7.5625 * (t -= (2.625 / 2.75)) * t + 0.984375) + b;
    }
  }

  /**
   * Bouncing easing in and out
   * @memberOf fabric.util.ease
   */
  function easeInOutBounce(t, b, c, d) {
    if (t < d / 2) {
      return easeInBounce (t * 2, 0, c, d) * 0.5 + b;
    }
    return easeOutBounce(t * 2 - d, 0, c, d) * 0.5 + c * 0.5 + b;
  }

  /**
   * Easing functions
   * See <a href="http://gizma.com/easing/">Easing Equations by Robert Penner</a>
   * @namespace fabric.util.ease
   */
  fabric.util.ease = {

    /**
     * Quadratic easing in
     * @memberOf fabric.util.ease
     */
    easeInQuad: function(t, b, c, d) {
      return c * (t /= d) * t + b;
    },

    /**
     * Quadratic easing out
     * @memberOf fabric.util.ease
     */
    easeOutQuad: function(t, b, c, d) {
      return -c * (t /= d) * (t - 2) + b;
    },

    /**
     * Quadratic easing in and out
     * @memberOf fabric.util.ease
     */
    easeInOutQuad: function(t, b, c, d) {
      t /= (d / 2);
      if (t < 1) {
        return c / 2 * t * t + b;
      }
      return -c / 2 * ((--t) * (t - 2) - 1) + b;
    },

    /**
     * Cubic easing in
     * @memberOf fabric.util.ease
     */
    easeInCubic: function(t, b, c, d) {
      return c * (t /= d) * t * t + b;
    },

    easeOutCubic: easeOutCubic,
    easeInOutCubic: easeInOutCubic,
    easeInQuart: easeInQuart,
    easeOutQuart: easeOutQuart,
    easeInOutQuart: easeInOutQuart,
    easeInQuint: easeInQuint,
    easeOutQuint: easeOutQuint,
    easeInOutQuint: easeInOutQuint,
    easeInSine: easeInSine,
    easeOutSine: easeOutSine,
    easeInOutSine: easeInOutSine,
    easeInExpo: easeInExpo,
    easeOutExpo: easeOutExpo,
    easeInOutExpo: easeInOutExpo,
    easeInCirc: easeInCirc,
    easeOutCirc: easeOutCirc,
    easeInOutCirc: easeInOutCirc,
    easeInElastic: easeInElastic,
    easeOutElastic: easeOutElastic,
    easeInOutElastic: easeInOutElastic,
    easeInBack: easeInBack,
    easeOutBack: easeOutBack,
    easeInOutBack: easeInOutBack,
    easeInBounce: easeInBounce,
    easeOutBounce: easeOutBounce,
    easeInOutBounce: easeInOutBounce
  };

})();


(function(global) {

  'use strict';

  /**
   * @name fabric
   * @namespace
   */

  var fabric = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      capitalize = fabric.util.string.capitalize,
      clone = fabric.util.object.clone,
      toFixed = fabric.util.toFixed,
      parseUnit = fabric.util.parseUnit,
      multiplyTransformMatrices = fabric.util.multiplyTransformMatrices,

      reAllowedSVGTagNames = /^(path|circle|polygon|polyline|ellipse|rect|line|image|text)$/i,
      reViewBoxTagNames = /^(symbol|image|marker|pattern|view|svg)$/i,
      reNotAllowedAncestors = /^(?:pattern|defs|symbol|metadata)$/i,
      reAllowedParents = /^(symbol|g|a|svg)$/i,

      attributesMap = {
        cx:                   'left',
        x:                    'left',
        r:                    'radius',
        cy:                   'top',
        y:                    'top',
        display:              'visible',
        visibility:           'visible',
        transform:            'transformMatrix',
        'fill-opacity':       'fillOpacity',
        'fill-rule':          'fillRule',
        'font-family':        'fontFamily',
        'font-size':          'fontSize',
        'font-style':         'fontStyle',
        'font-weight':        'fontWeight',
        'stroke-dasharray':   'strokeDashArray',
        'stroke-linecap':     'strokeLineCap',
        'stroke-linejoin':    'strokeLineJoin',
        'stroke-miterlimit':  'strokeMiterLimit',
        'stroke-opacity':     'strokeOpacity',
        'stroke-width':       'strokeWidth',
        'text-decoration':    'textDecoration',
        'text-anchor':        'originX'
      },

      colorAttributes = {
        stroke: 'strokeOpacity',
        fill:   'fillOpacity'
      };

  fabric.cssRules = { };
  fabric.gradientDefs = { };

  function normalizeAttr(attr) {
    // transform attribute names
    if (attr in attributesMap) {
      return attributesMap[attr];
    }
    return attr;
  }

  function normalizeValue(attr, value, parentAttributes, fontSize) {
    var isArray = Object.prototype.toString.call(value) === '[object Array]',
        parsed;

    if ((attr === 'fill' || attr === 'stroke') && value === 'none') {
      value = '';
    }
    else if (attr === 'strokeDashArray') {
      value = value.replace(/,/g, ' ').split(/\s+/).map(function(n) {
        return parseFloat(n);
      });
    }
    else if (attr === 'transformMatrix') {
      if (parentAttributes && parentAttributes.transformMatrix) {
        value = multiplyTransformMatrices(
          parentAttributes.transformMatrix, fabric.parseTransformAttribute(value));
      }
      else {
        value = fabric.parseTransformAttribute(value);
      }
    }
    else if (attr === 'visible') {
      value = (value === 'none' || value === 'hidden') ? false : true;
      // display=none on parent element always takes precedence over child element
      if (parentAttributes && parentAttributes.visible === false) {
        value = false;
      }
    }
    else if (attr === 'originX' /* text-anchor */) {
      value = value === 'start' ? 'left' : value === 'end' ? 'right' : 'center';
    }
    else {
      parsed = isArray ? value.map(parseUnit) : parseUnit(value, fontSize);
    }

    return (!isArray && isNaN(parsed) ? value : parsed);
  }

  /**
   * @private
   * @param {Object} attributes Array of attributes to parse
   */
  function _setStrokeFillOpacity(attributes) {
    for (var attr in colorAttributes) {

      if (typeof attributes[colorAttributes[attr]] === 'undefined' || attributes[attr] === '') {
        continue;
      }

      if (typeof attributes[attr] === 'undefined') {
        if (!fabric.Object.prototype[attr]) {
          continue;
        }
        attributes[attr] = fabric.Object.prototype[attr];
      }

      if (attributes[attr].indexOf('url(') === 0) {
        continue;
      }

      var color = new fabric.Color(attributes[attr]);
      attributes[attr] = color.setAlpha(toFixed(color.getAlpha() * attributes[colorAttributes[attr]], 2)).toRgba();
    }
    return attributes;
  }

  /**
   * @private
   */
  function _getMultipleNodes(doc, nodeNames) {
    var nodeName, nodeArray = [], nodeList;
    for (var i = 0; i < nodeNames.length; i++) {
      nodeName = nodeNames[i];
      nodeList = doc.getElementsByTagName(nodeName);
      nodeArray = nodeArray.concat(Array.prototype.slice.call(nodeList));
    }
    return nodeArray;
  }

  /**
   * Parses "transform" attribute, returning an array of values
   * @static
   * @function
   * @memberOf fabric
   * @param {String} attributeValue String containing attribute value
   * @return {Array} Array of 6 elements representing transformation matrix
   */
  fabric.parseTransformAttribute = (function() {
    function rotateMatrix(matrix, args) {
      var angle = args[0],
          x = (args.length === 3) ? args[1] : 0,
          y = (args.length === 3) ? args[2] : 0;

      matrix[0] = Math.cos(angle);
      matrix[1] = Math.sin(angle);
      matrix[2] = -Math.sin(angle);
      matrix[3] = Math.cos(angle);
      matrix[4] = x - (matrix[0] * x + matrix[2] * y);
      matrix[5] = y - (matrix[1] * x + matrix[3] * y);
    }

    function scaleMatrix(matrix, args) {
      var multiplierX = args[0],
          multiplierY = (args.length === 2) ? args[1] : args[0];

      matrix[0] = multiplierX;
      matrix[3] = multiplierY;
    }

    function skewXMatrix(matrix, args) {
      matrix[2] = Math.tan(fabric.util.degreesToRadians(args[0]));
    }

    function skewYMatrix(matrix, args) {
      matrix[1] = Math.tan(fabric.util.degreesToRadians(args[0]));
    }

    function translateMatrix(matrix, args) {
      matrix[4] = args[0];
      if (args.length === 2) {
        matrix[5] = args[1];
      }
    }

    // identity matrix
    var iMatrix = [
          1, // a
          0, // b
          0, // c
          1, // d
          0, // e
          0  // f
        ],

        // == begin transform regexp
        number = fabric.reNum,

        commaWsp = '(?:\\s+,?\\s*|,\\s*)',

        skewX = '(?:(skewX)\\s*\\(\\s*(' + number + ')\\s*\\))',

        skewY = '(?:(skewY)\\s*\\(\\s*(' + number + ')\\s*\\))',

        rotate = '(?:(rotate)\\s*\\(\\s*(' + number + ')(?:' +
                    commaWsp + '(' + number + ')' +
                    commaWsp + '(' + number + '))?\\s*\\))',

        scale = '(?:(scale)\\s*\\(\\s*(' + number + ')(?:' +
                    commaWsp + '(' + number + '))?\\s*\\))',

        translate = '(?:(translate)\\s*\\(\\s*(' + number + ')(?:' +
                    commaWsp + '(' + number + '))?\\s*\\))',

        matrix = '(?:(matrix)\\s*\\(\\s*' +
                  '(' + number + ')' + commaWsp +
                  '(' + number + ')' + commaWsp +
                  '(' + number + ')' + commaWsp +
                  '(' + number + ')' + commaWsp +
                  '(' + number + ')' + commaWsp +
                  '(' + number + ')' +
                  '\\s*\\))',

        transform = '(?:' +
                    matrix + '|' +
                    translate + '|' +
                    scale + '|' +
                    rotate + '|' +
                    skewX + '|' +
                    skewY +
                    ')',

        transforms = '(?:' + transform + '(?:' + commaWsp + '*' + transform + ')*' + ')',

        transformList = '^\\s*(?:' + transforms + '?)\\s*$',

        // http://www.w3.org/TR/SVG/coords.html#TransformAttribute
        reTransformList = new RegExp(transformList),
        // == end transform regexp

        reTransform = new RegExp(transform, 'g');

    return function(attributeValue) {

      // start with identity matrix
      var matrix = iMatrix.concat(),
          matrices = [];

      // return if no argument was given or
      // an argument does not match transform attribute regexp
      if (!attributeValue || (attributeValue && !reTransformList.test(attributeValue))) {
        return matrix;
      }

      attributeValue.replace(reTransform, function(match) {

        var m = new RegExp(transform).exec(match).filter(function (match) {
              // match !== '' && match != null
              return (!!match);
            }),
            operation = m[1],
            args = m.slice(2).map(parseFloat);

        switch (operation) {
          case 'translate':
            translateMatrix(matrix, args);
            break;
          case 'rotate':
            args[0] = fabric.util.degreesToRadians(args[0]);
            rotateMatrix(matrix, args);
            break;
          case 'scale':
            scaleMatrix(matrix, args);
            break;
          case 'skewX':
            skewXMatrix(matrix, args);
            break;
          case 'skewY':
            skewYMatrix(matrix, args);
            break;
          case 'matrix':
            matrix = args;
            break;
        }

        // snapshot current matrix into matrices array
        matrices.push(matrix.concat());
        // reset
        matrix = iMatrix.concat();
      });

      var combinedMatrix = matrices[0];
      while (matrices.length > 1) {
        matrices.shift();
        combinedMatrix = fabric.util.multiplyTransformMatrices(combinedMatrix, matrices[0]);
      }
      return combinedMatrix;
    };
  })();

  /**
   * @private
   */
  function parseStyleString(style, oStyle) {
    var attr, value;
    style.replace(/;\s*$/, '').split(';').forEach(function (chunk) {
      var pair = chunk.split(':');

      attr = normalizeAttr(pair[0].trim().toLowerCase());
      value = normalizeValue(attr, pair[1].trim());

      oStyle[attr] = value;
    });
  }

  /**
   * @private
   */
  function parseStyleObject(style, oStyle) {
    var attr, value;
    for (var prop in style) {
      if (typeof style[prop] === 'undefined') {
        continue;
      }

      attr = normalizeAttr(prop.toLowerCase());
      value = normalizeValue(attr, style[prop]);

      oStyle[attr] = value;
    }
  }

  /**
   * @private
   */
  function getGlobalStylesForElement(element, svgUid) {
    var styles = { };
    for (var rule in fabric.cssRules[svgUid]) {
      if (elementMatchesRule(element, rule.split(' '))) {
        for (var property in fabric.cssRules[svgUid][rule]) {
          styles[property] = fabric.cssRules[svgUid][rule][property];
        }
      }
    }
    return styles;
  }

  /**
   * @private
   */
  function elementMatchesRule(element, selectors) {
    var firstMatching, parentMatching = true;
    //start from rightmost selector.
    firstMatching = selectorMatches(element, selectors.pop());
    if (firstMatching && selectors.length) {
      parentMatching = doesSomeParentMatch(element, selectors);
    }
    return firstMatching && parentMatching && (selectors.length === 0);
  }

  function doesSomeParentMatch(element, selectors) {
    var selector, parentMatching = true;
    while (element.parentNode && element.parentNode.nodeType === 1 && selectors.length) {
      if (parentMatching) {
        selector = selectors.pop();
      }
      element = element.parentNode;
      parentMatching = selectorMatches(element, selector);
    }
    return selectors.length === 0;
  }

  /**
   * @private
   */
  function selectorMatches(element, selector) {
    var nodeName = element.nodeName,
        classNames = element.getAttribute('class'),
        id = element.getAttribute('id'), matcher;
    // i check if a selector matches slicing away part from it.
    // if i get empty string i should match
    matcher = new RegExp('^' + nodeName, 'i');
    selector = selector.replace(matcher, '');
    if (id && selector.length) {
      matcher = new RegExp('#' + id + '(?![a-zA-Z\\-]+)', 'i');
      selector = selector.replace(matcher, '');
    }
    if (classNames && selector.length) {
      classNames = classNames.split(' ');
      for (var i = classNames.length; i--;) {
        matcher = new RegExp('\\.' + classNames[i] + '(?![a-zA-Z\\-]+)', 'i');
        selector = selector.replace(matcher, '');
      }
    }
    return selector.length === 0;
  }

  /**
   * @private
   * to support IE8 missing getElementById on SVGdocument
   */
  function elementById(doc, id) {
    var el;
    doc.getElementById && (el = doc.getElementById(id));
    if (el) {
      return el;
    }
    var node, i, nodelist = doc.getElementsByTagName('*');
    for (i = 0; i < nodelist.length; i++) {
      node = nodelist[i];
      if (id === node.getAttribute('id')) {
        return node;
      }
    }
  }

  /**
   * @private
   */
  function parseUseDirectives(doc) {
    var nodelist = _getMultipleNodes(doc, ['use', 'svg:use']), i = 0;

    while (nodelist.length && i < nodelist.length) {
      var el = nodelist[i],
          xlink = el.getAttribute('xlink:href').substr(1),
          x = el.getAttribute('x') || 0,
          y = el.getAttribute('y') || 0,
          el2 = elementById(doc, xlink).cloneNode(true),
          currentTrans = (el2.getAttribute('transform') || '') + ' translate(' + x + ', ' + y + ')',
          parentNode, oldLength = nodelist.length, attr, j, attrs, l;

      applyViewboxTransform(el2);
      if (/^svg$/i.test(el2.nodeName)) {
        var el3 = el2.ownerDocument.createElement('g');
        for (j = 0, attrs = el2.attributes, l = attrs.length; j < l; j++) {
          attr = attrs.item(j);
          el3.setAttribute(attr.nodeName, attr.nodeValue);
        }
        // el2.firstChild != null
        while (el2.firstChild) {
          el3.appendChild(el2.firstChild);
        }
        el2 = el3;
      }

      for (j = 0, attrs = el.attributes, l = attrs.length; j < l; j++) {
        attr = attrs.item(j);
        if (attr.nodeName === 'x' || attr.nodeName === 'y' || attr.nodeName === 'xlink:href') {
          continue;
        }

        if (attr.nodeName === 'transform') {
          currentTrans = attr.nodeValue + ' ' + currentTrans;
        }
        else {
          el2.setAttribute(attr.nodeName, attr.nodeValue);
        }
      }

      el2.setAttribute('transform', currentTrans);
      el2.setAttribute('instantiated_by_use', '1');
      el2.removeAttribute('id');
      parentNode = el.parentNode;
      parentNode.replaceChild(el2, el);
      // some browsers do not shorten nodelist after replaceChild (IE8)
      if (nodelist.length === oldLength) {
        i++;
      }
    }
  }

  // http://www.w3.org/TR/SVG/coords.html#ViewBoxAttribute
  // matches, e.g.: +14.56e-12, etc.
  var reViewBoxAttrValue = new RegExp(
    '^' +
    '\\s*(' + fabric.reNum + '+)\\s*,?' +
    '\\s*(' + fabric.reNum + '+)\\s*,?' +
    '\\s*(' + fabric.reNum + '+)\\s*,?' +
    '\\s*(' + fabric.reNum + '+)\\s*' +
    '$'
  );

  /**
   * Add a <g> element that envelop all child elements and makes the viewbox transformMatrix descend on all elements
   */
  function applyViewboxTransform(element) {

    var viewBoxAttr = element.getAttribute('viewBox'),
        scaleX = 1,
        scaleY = 1,
        minX = 0,
        minY = 0,
        viewBoxWidth, viewBoxHeight, matrix, el,
        widthAttr = element.getAttribute('width'),
        heightAttr = element.getAttribute('height'),
        x = element.getAttribute('x') || 0,
        y = element.getAttribute('y') || 0,
        preserveAspectRatio = element.getAttribute('preserveAspectRatio') || '',
        missingViewBox = (!viewBoxAttr || !reViewBoxTagNames.test(element.nodeName)
                           || !(viewBoxAttr = viewBoxAttr.match(reViewBoxAttrValue))),
        missingDimAttr = (!widthAttr || !heightAttr || widthAttr === '100%' || heightAttr === '100%'),
        toBeParsed = missingViewBox && missingDimAttr,
        parsedDim = { }, translateMatrix = '';

    parsedDim.width = 0;
    parsedDim.height = 0;
    parsedDim.toBeParsed = toBeParsed;

    if (toBeParsed) {
      return parsedDim;
    }

    if (missingViewBox) {
      parsedDim.width = parseUnit(widthAttr);
      parsedDim.height = parseUnit(heightAttr);
      return parsedDim;
    }

    minX = -parseFloat(viewBoxAttr[1]);
    minY = -parseFloat(viewBoxAttr[2]);
    viewBoxWidth = parseFloat(viewBoxAttr[3]);
    viewBoxHeight = parseFloat(viewBoxAttr[4]);

    if (!missingDimAttr) {
      parsedDim.width = parseUnit(widthAttr);
      parsedDim.height = parseUnit(heightAttr);
      scaleX = parsedDim.width / viewBoxWidth;
      scaleY = parsedDim.height / viewBoxHeight;
    }
    else {
      parsedDim.width = viewBoxWidth;
      parsedDim.height = viewBoxHeight;
    }

    // default is to preserve aspect ratio
    preserveAspectRatio = fabric.util.parsePreserveAspectRatioAttribute(preserveAspectRatio);
    if (preserveAspectRatio.alignX !== 'none') {
      //translate all container for the effect of Mid, Min, Max
      scaleY = scaleX = (scaleX > scaleY ? scaleY : scaleX);
    }

    if (scaleX === 1 && scaleY === 1 && minX === 0 && minY === 0 && x === 0 && y === 0) {
      return parsedDim;
    }

    if (x || y) {
      translateMatrix = ' translate(' + parseUnit(x) + ' ' + parseUnit(y) + ') ';
    }

    matrix = translateMatrix + ' matrix(' + scaleX +
                  ' 0' +
                  ' 0 ' +
                  scaleY + ' ' +
                  (minX * scaleX) + ' ' +
                  (minY * scaleY) + ') ';

    if (element.nodeName === 'svg') {
      el = element.ownerDocument.createElement('g');
      // element.firstChild != null
      while (element.firstChild) {
        el.appendChild(element.firstChild);
      }
      element.appendChild(el);
    }
    else {
      el = element;
      matrix = el.getAttribute('transform') + matrix;
    }

    el.setAttribute('transform', matrix);
    return parsedDim;
  }

  /**
   * Parses an SVG document, converts it to an array of corresponding fabric.* instances and passes them to a callback
   * @static
   * @function
   * @memberOf fabric
   * @param {SVGDocument} doc SVG document to parse
   * @param {Function} callback Callback to call when parsing is finished;
   * It's being passed an array of elements (parsed from a document).
   * @param {Function} [reviver] Method for further parsing of SVG elements, called after each fabric object created.
   */
  fabric.parseSVGDocument = (function() {

    function hasAncestorWithNodeName(element, nodeName) {
      while (element && (element = element.parentNode)) {
        if (element.nodeName && nodeName.test(element.nodeName.replace('svg:', ''))
          && !element.getAttribute('instantiated_by_use')) {
          return true;
        }
      }
      return false;
    }

    return function(doc, callback, reviver) {
      if (!doc) {
        return;
      }

      parseUseDirectives(doc);

      var startTime = new Date(),
          svgUid =  fabric.Object.__uid++,
          options = applyViewboxTransform(doc),
          descendants = fabric.util.toArray(doc.getElementsByTagName('*'));

      options.svgUid = svgUid;

      if (descendants.length === 0 && fabric.isLikelyNode) {
        // we're likely in node, where "o3-xml" library fails to gEBTN("*")
        // https://github.com/ajaxorg/node-o3-xml/issues/21
        descendants = doc.selectNodes('//*[name(.)!="svg"]');
        var arr = [];
        for (var i = 0, len = descendants.length; i < len; i++) {
          arr[i] = descendants[i];
        }
        descendants = arr;
      }

      var elements = descendants.filter(function(el) {
        applyViewboxTransform(el);
        return reAllowedSVGTagNames.test(el.nodeName.replace('svg:', '')) &&
              !hasAncestorWithNodeName(el, reNotAllowedAncestors); // http://www.w3.org/TR/SVG/struct.html#DefsElement
      });

      if (!elements || (elements && !elements.length)) {
        callback && callback([], {});
        return;
      }

      fabric.gradientDefs[svgUid] = fabric.getGradientDefs(doc);
      fabric.cssRules[svgUid] = fabric.getCSSRules(doc);
      // Precedence of rules:   style > class > attribute
      fabric.parseElements(elements, function(instances) {
        fabric.documentParsingTime = new Date() - startTime;
        if (callback) {
          callback(instances, options);
        }
      }, clone(options), reviver);
    };
  })();

  /**
   * Used for caching SVG documents (loaded via `fabric.Canvas#loadSVGFromURL`)
   * @namespace
   */
  var svgCache = {

    /**
     * @param {String} name
     * @param {Function} callback
     */
    has: function (name, callback) {
      callback(false);
    },

    get: function () {
      /* NOOP */
    },

    set: function () {
      /* NOOP */
    }
  };

  /**
   * @private
   */
  function _enlivenCachedObject(cachedObject) {

    var objects = cachedObject.objects,
        options = cachedObject.options;

    objects = objects.map(function (o) {
      return fabric[capitalize(o.type)].fromObject(o);
    });

    return ({ objects: objects, options: options });
  }

  /**
   * @private
   */
  function _createSVGPattern(markup, canvas, property) {
    if (canvas[property] && canvas[property].toSVG) {
      markup.push(
        '\t<pattern x="0" y="0" id="', property, 'Pattern" ',
          'width="', canvas[property].source.width,
          '" height="', canvas[property].source.height,
          '" patternUnits="userSpaceOnUse">\n',
        '\t\t<image x="0" y="0" ',
        'width="', canvas[property].source.width,
        '" height="', canvas[property].source.height,
        '" xlink:href="', canvas[property].source.src,
        '"></image>\n\t</pattern>\n'
      );
    }
  }

  var reFontDeclaration = new RegExp(
    '(normal|italic)?\\s*(normal|small-caps)?\\s*' +
    '(normal|bold|bolder|lighter|100|200|300|400|500|600|700|800|900)?\\s*(' +
      fabric.reNum +
    '(?:px|cm|mm|em|pt|pc|in)*)(?:\\/(normal|' + fabric.reNum + '))?\\s+(.*)');

  extend(fabric, {
    /**
     * Parses a short font declaration, building adding its properties to a style object
     * @static
     * @function
     * @memberOf fabric
     * @param {String} value font declaration
     * @param {Object} oStyle definition
     */
    parseFontDeclaration: function(value, oStyle) {
      var match = value.match(reFontDeclaration);

      if (!match) {
        return;
      }
      var fontStyle = match[1],
          // font variant is not used
          // fontVariant = match[2],
          fontWeight = match[3],
          fontSize = match[4],
          lineHeight = match[5],
          fontFamily = match[6];

      if (fontStyle) {
        oStyle.fontStyle = fontStyle;
      }
      if (fontWeight) {
        oStyle.fontWeight = isNaN(parseFloat(fontWeight)) ? fontWeight : parseFloat(fontWeight);
      }
      if (fontSize) {
        oStyle.fontSize = parseUnit(fontSize);
      }
      if (fontFamily) {
        oStyle.fontFamily = fontFamily;
      }
      if (lineHeight) {
        oStyle.lineHeight = lineHeight === 'normal' ? 1 : lineHeight;
      }
    },

    /**
     * Parses an SVG document, returning all of the gradient declarations found in it
     * @static
     * @function
     * @memberOf fabric
     * @param {SVGDocument} doc SVG document to parse
     * @return {Object} Gradient definitions; key corresponds to element id, value -- to gradient definition element
     */
    getGradientDefs: function(doc) {
      var tagArray = [
            'linearGradient',
            'radialGradient',
            'svg:linearGradient',
            'svg:radialGradient'],
          elList = _getMultipleNodes(doc, tagArray),
          el, j = 0, id, xlink,
          gradientDefs = { }, idsToXlinkMap = { };

      j = elList.length;

      while (j--) {
        el = elList[j];
        xlink = el.getAttribute('xlink:href');
        id = el.getAttribute('id');
        if (xlink) {
          idsToXlinkMap[id] = xlink.substr(1);
        }
        gradientDefs[id] = el;
      }

      for (id in idsToXlinkMap) {
        var el2 = gradientDefs[idsToXlinkMap[id]].cloneNode(true);
        el = gradientDefs[id];
        while (el2.firstChild) {
          el.appendChild(el2.firstChild);
        }
      }
      return gradientDefs;
    },

    /**
     * Returns an object of attributes' name/value, given element and an array of attribute names;
     * Parses parent "g" nodes recursively upwards.
     * @static
     * @memberOf fabric
     * @param {DOMElement} element Element to parse
     * @param {Array} attributes Array of attributes to parse
     * @return {Object} object containing parsed attributes' names/values
     */
    parseAttributes: function(element, attributes, svgUid) {

      if (!element) {
        return;
      }

      var value,
          parentAttributes = { },
          fontSize;

      if (typeof svgUid === 'undefined') {
        svgUid = element.getAttribute('svgUid');
      }
      // if there's a parent container (`g` or `a` or `symbol` node), parse its attributes recursively upwards
      if (element.parentNode && reAllowedParents.test(element.parentNode.nodeName)) {
        parentAttributes = fabric.parseAttributes(element.parentNode, attributes, svgUid);
      }
      fontSize = (parentAttributes && parentAttributes.fontSize ) ||
                 element.getAttribute('font-size') || fabric.Text.DEFAULT_SVG_FONT_SIZE;

      var ownAttributes = attributes.reduce(function(memo, attr) {
        value = element.getAttribute(attr);
        if (value) {
          attr = normalizeAttr(attr);
          value = normalizeValue(attr, value, parentAttributes, fontSize);

          memo[attr] = value;
        }
        return memo;
      }, { });

      // add values parsed from style, which take precedence over attributes
      // (see: http://www.w3.org/TR/SVG/styling.html#UsingPresentationAttributes)
      ownAttributes = extend(ownAttributes,
        extend(getGlobalStylesForElement(element, svgUid), fabric.parseStyleAttribute(element)));
      if (ownAttributes.font) {
        fabric.parseFontDeclaration(ownAttributes.font, ownAttributes);
      }
      return _setStrokeFillOpacity(extend(parentAttributes, ownAttributes));
    },

    /**
     * Transforms an array of svg elements to corresponding fabric.* instances
     * @static
     * @memberOf fabric
     * @param {Array} elements Array of elements to parse
     * @param {Function} callback Being passed an array of fabric instances (transformed from SVG elements)
     * @param {Object} [options] Options object
     * @param {Function} [reviver] Method for further parsing of SVG elements, called after each fabric object created.
     */
    parseElements: function(elements, callback, options, reviver) {
      new fabric.ElementsParser(elements, callback, options, reviver).parse();
    },

    /**
     * Parses "style" attribute, retuning an object with values
     * @static
     * @memberOf fabric
     * @param {SVGElement} element Element to parse
     * @return {Object} Objects with values parsed from style attribute of an element
     */
    parseStyleAttribute: function(element) {
      var oStyle = { },
          style = element.getAttribute('style');

      if (!style) {
        return oStyle;
      }

      if (typeof style === 'string') {
        parseStyleString(style, oStyle);
      }
      else {
        parseStyleObject(style, oStyle);
      }

      return oStyle;
    },

    /**
     * Parses "points" attribute, returning an array of values
     * @static
     * @memberOf fabric
     * @param {String} points points attribute string
     * @return {Array} array of points
     */
    parsePointsAttribute: function(points) {

      // points attribute is required and must not be empty
      if (!points) {
        return null;
      }

      // replace commas with whitespace and remove bookending whitespace
      points = points.replace(/,/g, ' ').trim();

      points = points.split(/\s+/);
      var parsedPoints = [], i, len;

      i = 0;
      len = points.length;
      for (; i < len; i += 2) {
        parsedPoints.push({
          x: parseFloat(points[i]),
          y: parseFloat(points[i + 1])
        });
      }

      // odd number of points is an error
      // if (parsedPoints.length % 2 !== 0) {
      //   return null;
      // }

      return parsedPoints;
    },

    /**
     * Returns CSS rules for a given SVG document
     * @static
     * @function
     * @memberOf fabric
     * @param {SVGDocument} doc SVG document to parse
     * @return {Object} CSS rules of this document
     */
    getCSSRules: function(doc) {
      var styles = doc.getElementsByTagName('style'),
          allRules = { }, rules;

      // very crude parsing of style contents
      for (var i = 0, len = styles.length; i < len; i++) {
        // IE9 doesn't support textContent, but provides text instead.
        var styleContents = styles[i].textContent || styles[i].text;

        // remove comments
        styleContents = styleContents.replace(/\/\*[\s\S]*?\*\//g, '');
        if (styleContents.trim() === '') {
          continue;
        }
        rules = styleContents.match(/[^{]*\{[\s\S]*?\}/g);
        rules = rules.map(function(rule) { return rule.trim(); });
        rules.forEach(function(rule) {

          var match = rule.match(/([\s\S]*?)\s*\{([^}]*)\}/),
              ruleObj = { }, declaration = match[2].trim(),
              propertyValuePairs = declaration.replace(/;$/, '').split(/\s*;\s*/);

          for (var i = 0, len = propertyValuePairs.length; i < len; i++) {
            var pair = propertyValuePairs[i].split(/\s*:\s*/),
                property = normalizeAttr(pair[0]),
                value = normalizeValue(property, pair[1], pair[0]);
            ruleObj[property] = value;
          }
          rule = match[1];
          rule.split(',').forEach(function(_rule) {
            _rule = _rule.replace(/^svg/i, '').trim();
            if (_rule === '') {
              return;
            }
            if (allRules[_rule]) {
              fabric.util.object.extend(allRules[_rule], ruleObj);
            }
            else {
              allRules[_rule] = fabric.util.object.clone(ruleObj);
            }
          });
        });
      }
      return allRules;
    },

    /**
     * Takes url corresponding to an SVG document, and parses it into a set of fabric objects.
     * Note that SVG is fetched via XMLHttpRequest, so it needs to conform to SOP (Same Origin Policy)
     * @memberOf fabric
     * @param {String} url
     * @param {Function} callback
     * @param {Function} [reviver] Method for further parsing of SVG elements, called after each fabric object created.
     */
    loadSVGFromURL: function(url, callback, reviver) {

      url = url.replace(/^\n\s*/, '').trim();
      svgCache.has(url, function (hasUrl) {
        if (hasUrl) {
          svgCache.get(url, function (value) {
            var enlivedRecord = _enlivenCachedObject(value);
            callback(enlivedRecord.objects, enlivedRecord.options);
          });
        }
        else {
          new fabric.util.request(url, {
            method: 'get',
            onComplete: onComplete
          });
        }
      });

      function onComplete(r) {

        var xml = r.responseXML;
        if (xml && !xml.documentElement && fabric.window.ActiveXObject && r.responseText) {
          xml = new ActiveXObject('Microsoft.XMLDOM');
          xml.async = 'false';
          //IE chokes on DOCTYPE
          xml.loadXML(r.responseText.replace(/<!DOCTYPE[\s\S]*?(\[[\s\S]*\])*?>/i, ''));
        }
        if (!xml || !xml.documentElement) {
          callback && callback(null);
        }

        fabric.parseSVGDocument(xml.documentElement, function (results, options) {
          svgCache.set(url, {
            objects: fabric.util.array.invoke(results, 'toObject'),
            options: options
          });
          callback && callback(results, options);
        }, reviver);
      }
    },

    /**
     * Takes string corresponding to an SVG document, and parses it into a set of fabric objects
     * @memberOf fabric
     * @param {String} string
     * @param {Function} callback
     * @param {Function} [reviver] Method for further parsing of SVG elements, called after each fabric object created.
     */
    loadSVGFromString: function(string, callback, reviver) {
      string = string.trim();
      var doc;
      if (typeof DOMParser !== 'undefined') {
        var parser = new DOMParser();
        if (parser && parser.parseFromString) {
          doc = parser.parseFromString(string, 'text/xml');
        }
      }
      else if (fabric.window.ActiveXObject) {
        doc = new ActiveXObject('Microsoft.XMLDOM');
        doc.async = 'false';
        // IE chokes on DOCTYPE
        doc.loadXML(string.replace(/<!DOCTYPE[\s\S]*?(\[[\s\S]*\])*?>/i, ''));
      }

      fabric.parseSVGDocument(doc.documentElement, function (results, options) {
        callback(results, options);
      }, reviver);
    },

    /**
     * Creates markup containing SVG font faces,
     * font URLs for font faces must be collected by developers
     * and are not extracted from the DOM by fabricjs
     * @param {Array} objects Array of fabric objects
     * @return {String}
     */
    createSVGFontFacesMarkup: function(objects) {
      var markup = '', fontList = { }, obj, fontFamily,
          style, row, rowIndex, _char, charIndex,
          fontPaths = fabric.fontPaths;

      for (var i = 0, len = objects.length; i < len; i++) {
        obj = objects[i];
        fontFamily = obj.fontFamily;
        if (obj.type.indexOf('text') === -1 || fontList[fontFamily] || !fontPaths[fontFamily]) {
          continue;
        }
        fontList[fontFamily] = true;
        if (!obj.styles) {
          continue;
        }
        style = obj.styles;
        for (rowIndex in style) {
          row = style[rowIndex];
          for (charIndex in row) {
            _char = row[charIndex];
            fontFamily = _char.fontFamily;
            if (!fontList[fontFamily] && fontPaths[fontFamily]) {
              fontList[fontFamily] = true;
            }
          }
        }
      }

      for (var j in fontList) {
        markup += [
          '\t\t@font-face {\n',
          '\t\t\tfont-family: \'', j, '\';\n',
          '\t\t\tsrc: url(\'', fontPaths[j], '\');\n',
          '\t\t}\n'
        ].join('');
      }

      if (markup) {
        markup = [
          '\t<style type="text/css">',
          '<![CDATA[\n',
          markup,
          ']]>',
          '</style>\n'
        ].join('');
      }

      return markup;
    },

    /**
     * Creates markup containing SVG referenced elements like patterns, gradients etc.
     * @param {fabric.Canvas} canvas instance of fabric.Canvas
     * @return {String}
     */
    createSVGRefElementsMarkup: function(canvas) {
      var markup = [];

      _createSVGPattern(markup, canvas, 'backgroundColor');
      _createSVGPattern(markup, canvas, 'overlayColor');

      return markup.join('');
    }
  });

})(typeof exports !== 'undefined' ? exports : this);


fabric.ElementsParser = function(elements, callback, options, reviver) {
  this.elements = elements;
  this.callback = callback;
  this.options = options;
  this.reviver = reviver;
  this.svgUid = (options && options.svgUid) || 0;
};

fabric.ElementsParser.prototype.parse = function() {
  this.instances = new Array(this.elements.length);
  this.numElements = this.elements.length;

  this.createObjects();
};

fabric.ElementsParser.prototype.createObjects = function() {
  for (var i = 0, len = this.elements.length; i < len; i++) {
    this.elements[i].setAttribute('svgUid', this.svgUid);
    (function(_obj, i) {
      setTimeout(function() {
        _obj.createObject(_obj.elements[i], i);
      }, 0);
    })(this, i);
  }
};

fabric.ElementsParser.prototype.createObject = function(el, index) {
  var klass = fabric[fabric.util.string.capitalize(el.tagName.replace('svg:', ''))];
  if (klass && klass.fromElement) {
    try {
      this._createObject(klass, el, index);
    }
    catch (err) {
      fabric.log(err);
    }
  }
  else {
    this.checkIfDone();
  }
};

fabric.ElementsParser.prototype._createObject = function(klass, el, index) {
  if (klass.async) {
    klass.fromElement(el, this.createCallback(index, el), this.options);
  }
  else {
    var obj = klass.fromElement(el, this.options);
    this.resolveGradient(obj, 'fill');
    this.resolveGradient(obj, 'stroke');
    this.reviver && this.reviver(el, obj);
    this.instances[index] = obj;
    this.checkIfDone();
  }
};

fabric.ElementsParser.prototype.createCallback = function(index, el) {
  var _this = this;
  return function(obj) {
    _this.resolveGradient(obj, 'fill');
    _this.resolveGradient(obj, 'stroke');
    _this.reviver && _this.reviver(el, obj);
    _this.instances[index] = obj;
    _this.checkIfDone();
  };
};

fabric.ElementsParser.prototype.resolveGradient = function(obj, property) {

  var instanceFillValue = obj.get(property);
  if (!(/^url\(/).test(instanceFillValue)) {
    return;
  }
  var gradientId = instanceFillValue.slice(5, instanceFillValue.length - 1);
  if (fabric.gradientDefs[this.svgUid][gradientId]) {
    obj.set(property,
      fabric.Gradient.fromElement(fabric.gradientDefs[this.svgUid][gradientId], obj));
  }
};

fabric.ElementsParser.prototype.checkIfDone = function() {
  if (--this.numElements === 0) {
    this.instances = this.instances.filter(function(el) {
      // eslint-disable-next-line no-eq-null, eqeqeq
      return el != null;
    });
    this.callback(this.instances);
  }
};


(function(global) {

  'use strict';

  /* Adaptation of work of Kevin Lindsey (kevin@kevlindev.com) */

  var fabric = global.fabric || (global.fabric = { });

  if (fabric.Point) {
    fabric.warn('fabric.Point is already defined');
    return;
  }

  fabric.Point = Point;

  /**
   * Point class
   * @class fabric.Point
   * @memberOf fabric
   * @constructor
   * @param {Number} x
   * @param {Number} y
   * @return {fabric.Point} thisArg
   */
  function Point(x, y) {
    this.x = x;
    this.y = y;
  }

  Point.prototype = /** @lends fabric.Point.prototype */ {

    type: 'point',

    constructor: Point,

    /**
     * Adds another point to this one and returns another one
     * @param {fabric.Point} that
     * @return {fabric.Point} new Point instance with added values
     */
    add: function (that) {
      return new Point(this.x + that.x, this.y + that.y);
    },

    /**
     * Adds another point to this one
     * @param {fabric.Point} that
     * @return {fabric.Point} thisArg
     * @chainable
     */
    addEquals: function (that) {
      this.x += that.x;
      this.y += that.y;
      return this;
    },

    /**
     * Adds value to this point and returns a new one
     * @param {Number} scalar
     * @return {fabric.Point} new Point with added value
     */
    scalarAdd: function (scalar) {
      return new Point(this.x + scalar, this.y + scalar);
    },

    /**
     * Adds value to this point
     * @param {Number} scalar
     * @return {fabric.Point} thisArg
     * @chainable
     */
    scalarAddEquals: function (scalar) {
      this.x += scalar;
      this.y += scalar;
      return this;
    },

    /**
     * Subtracts another point from this point and returns a new one
     * @param {fabric.Point} that
     * @return {fabric.Point} new Point object with subtracted values
     */
    subtract: function (that) {
      return new Point(this.x - that.x, this.y - that.y);
    },

    /**
     * Subtracts another point from this point
     * @param {fabric.Point} that
     * @return {fabric.Point} thisArg
     * @chainable
     */
    subtractEquals: function (that) {
      this.x -= that.x;
      this.y -= that.y;
      return this;
    },

    /**
     * Subtracts value from this point and returns a new one
     * @param {Number} scalar
     * @return {fabric.Point}
     */
    scalarSubtract: function (scalar) {
      return new Point(this.x - scalar, this.y - scalar);
    },

    /**
     * Subtracts value from this point
     * @param {Number} scalar
     * @return {fabric.Point} thisArg
     * @chainable
     */
    scalarSubtractEquals: function (scalar) {
      this.x -= scalar;
      this.y -= scalar;
      return this;
    },

    /**
     * Miltiplies this point by a value and returns a new one
     * TODO: rename in scalarMultiply in 2.0
     * @param {Number} scalar
     * @return {fabric.Point}
     */
    multiply: function (scalar) {
      return new Point(this.x * scalar, this.y * scalar);
    },

    /**
     * Miltiplies this point by a value
     * TODO: rename in scalarMultiplyEquals in 2.0
     * @param {Number} scalar
     * @return {fabric.Point} thisArg
     * @chainable
     */
    multiplyEquals: function (scalar) {
      this.x *= scalar;
      this.y *= scalar;
      return this;
    },

    /**
     * Divides this point by a value and returns a new one
     * TODO: rename in scalarDivide in 2.0
     * @param {Number} scalar
     * @return {fabric.Point}
     */
    divide: function (scalar) {
      return new Point(this.x / scalar, this.y / scalar);
    },

    /**
     * Divides this point by a value
     * TODO: rename in scalarDivideEquals in 2.0
     * @param {Number} scalar
     * @return {fabric.Point} thisArg
     * @chainable
     */
    divideEquals: function (scalar) {
      this.x /= scalar;
      this.y /= scalar;
      return this;
    },

    /**
     * Returns true if this point is equal to another one
     * @param {fabric.Point} that
     * @return {Boolean}
     */
    eq: function (that) {
      return (this.x === that.x && this.y === that.y);
    },

    /**
     * Returns true if this point is less than another one
     * @param {fabric.Point} that
     * @return {Boolean}
     */
    lt: function (that) {
      return (this.x < that.x && this.y < that.y);
    },

    /**
     * Returns true if this point is less than or equal to another one
     * @param {fabric.Point} that
     * @return {Boolean}
     */
    lte: function (that) {
      return (this.x <= that.x && this.y <= that.y);
    },

    /**

     * Returns true if this point is greater another one
     * @param {fabric.Point} that
     * @return {Boolean}
     */
    gt: function (that) {
      return (this.x > that.x && this.y > that.y);
    },

    /**
     * Returns true if this point is greater than or equal to another one
     * @param {fabric.Point} that
     * @return {Boolean}
     */
    gte: function (that) {
      return (this.x >= that.x && this.y >= that.y);
    },

    /**
     * Returns new point which is the result of linear interpolation with this one and another one
     * @param {fabric.Point} that
     * @param {Number} t , position of interpolation, between 0 and 1 default 0.5
     * @return {fabric.Point}
     */
    lerp: function (that, t) {
      if (typeof t === 'undefined') {
        t = 0.5;
      }
      t = Math.max(Math.min(1, t), 0);
      return new Point(this.x + (that.x - this.x) * t, this.y + (that.y - this.y) * t);
    },

    /**
     * Returns distance from this point and another one
     * @param {fabric.Point} that
     * @return {Number}
     */
    distanceFrom: function (that) {
      var dx = this.x - that.x,
          dy = this.y - that.y;
      return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Returns the point between this point and another one
     * @param {fabric.Point} that
     * @return {fabric.Point}
     */
    midPointFrom: function (that) {
      return this.lerp(that);
    },

    /**
     * Returns a new point which is the min of this and another one
     * @param {fabric.Point} that
     * @return {fabric.Point}
     */
    min: function (that) {
      return new Point(Math.min(this.x, that.x), Math.min(this.y, that.y));
    },

    /**
     * Returns a new point which is the max of this and another one
     * @param {fabric.Point} that
     * @return {fabric.Point}
     */
    max: function (that) {
      return new Point(Math.max(this.x, that.x), Math.max(this.y, that.y));
    },

    /**
     * Returns string representation of this point
     * @return {String}
     */
    toString: function () {
      return this.x + ',' + this.y;
    },

    /**
     * Sets x/y of this point
     * @param {Number} x
     * @param {Number} y
     * @chainable
     */
    setXY: function (x, y) {
      this.x = x;
      this.y = y;
      return this;
    },

    /**
     * Sets x of this point
     * @param {Number} x
     * @chainable
     */
    setX: function (x) {
      this.x = x;
      return this;
    },

    /**
     * Sets y of this point
     * @param {Number} y
     * @chainable
     */
    setY: function (y) {
      this.y = y;
      return this;
    },

    /**
     * Sets x/y of this point from another point
     * @param {fabric.Point} that
     * @chainable
     */
    setFromPoint: function (that) {
      this.x = that.x;
      this.y = that.y;
      return this;
    },

    /**
     * Swaps x/y of this point and another point
     * @param {fabric.Point} that
     */
    swap: function (that) {
      var x = this.x,
          y = this.y;
      this.x = that.x;
      this.y = that.y;
      that.x = x;
      that.y = y;
    },

    /**
     * return a cloned instance of the point
     * @return {fabric.Point}
     */
    clone: function () {
      return new Point(this.x, this.y);
    }
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  /* Adaptation of work of Kevin Lindsey (kevin@kevlindev.com) */
  var fabric = global.fabric || (global.fabric = { });

  if (fabric.Intersection) {
    fabric.warn('fabric.Intersection is already defined');
    return;
  }

  /**
   * Intersection class
   * @class fabric.Intersection
   * @memberOf fabric
   * @constructor
   */
  function Intersection(status) {
    this.status = status;
    this.points = [];
  }

  fabric.Intersection = Intersection;

  fabric.Intersection.prototype = /** @lends fabric.Intersection.prototype */ {

    constructor: Intersection,

    /**
     * Appends a point to intersection
     * @param {fabric.Point} point
     * @return {fabric.Intersection} thisArg
     * @chainable
     */
    appendPoint: function (point) {
      this.points.push(point);
      return this;
    },

    /**
     * Appends points to intersection
     * @param {Array} points
     * @return {fabric.Intersection} thisArg
     * @chainable
     */
    appendPoints: function (points) {
      this.points = this.points.concat(points);
      return this;
    }
  };

  /**
   * Checks if one line intersects another
   * TODO: rename in intersectSegmentSegment
   * @static
   * @param {fabric.Point} a1
   * @param {fabric.Point} a2
   * @param {fabric.Point} b1
   * @param {fabric.Point} b2
   * @return {fabric.Intersection}
   */
  fabric.Intersection.intersectLineLine = function (a1, a2, b1, b2) {
    var result,
        uaT = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x),
        ubT = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x),
        uB = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);
    if (uB !== 0) {
      var ua = uaT / uB,
          ub = ubT / uB;
      if (0 <= ua && ua <= 1 && 0 <= ub && ub <= 1) {
        result = new Intersection('Intersection');
        result.appendPoint(new fabric.Point(a1.x + ua * (a2.x - a1.x), a1.y + ua * (a2.y - a1.y)));
      }
      else {
        result = new Intersection();
      }
    }
    else {
      if (uaT === 0 || ubT === 0) {
        result = new Intersection('Coincident');
      }
      else {
        result = new Intersection('Parallel');
      }
    }
    return result;
  };

  /**
   * Checks if line intersects polygon
   * TODO: rename in intersectSegmentPolygon
   * fix detection of coincident
   * @static
   * @param {fabric.Point} a1
   * @param {fabric.Point} a2
   * @param {Array} points
   * @return {fabric.Intersection}
   */
  fabric.Intersection.intersectLinePolygon = function(a1, a2, points) {
    var result = new Intersection(),
        length = points.length,
        b1, b2, inter;

    for (var i = 0; i < length; i++) {
      b1 = points[i];
      b2 = points[(i + 1) % length];
      inter = Intersection.intersectLineLine(a1, a2, b1, b2);

      result.appendPoints(inter.points);
    }
    if (result.points.length > 0) {
      result.status = 'Intersection';
    }
    return result;
  };

  /**
   * Checks if polygon intersects another polygon
   * @static
   * @param {Array} points1
   * @param {Array} points2
   * @return {fabric.Intersection}
   */
  fabric.Intersection.intersectPolygonPolygon = function (points1, points2) {
    var result = new Intersection(),
        length = points1.length;

    for (var i = 0; i < length; i++) {
      var a1 = points1[i],
          a2 = points1[(i + 1) % length],
          inter = Intersection.intersectLinePolygon(a1, a2, points2);

      result.appendPoints(inter.points);
    }
    if (result.points.length > 0) {
      result.status = 'Intersection';
    }
    return result;
  };

  /**
   * Checks if polygon intersects rectangle
   * @static
   * @param {Array} points
   * @param {fabric.Point} r1
   * @param {fabric.Point} r2
   * @return {fabric.Intersection}
   */
  fabric.Intersection.intersectPolygonRectangle = function (points, r1, r2) {
    var min = r1.min(r2),
        max = r1.max(r2),
        topRight = new fabric.Point(max.x, min.y),
        bottomLeft = new fabric.Point(min.x, max.y),
        inter1 = Intersection.intersectLinePolygon(min, topRight, points),
        inter2 = Intersection.intersectLinePolygon(topRight, max, points),
        inter3 = Intersection.intersectLinePolygon(max, bottomLeft, points),
        inter4 = Intersection.intersectLinePolygon(bottomLeft, min, points),
        result = new Intersection();

    result.appendPoints(inter1.points);
    result.appendPoints(inter2.points);
    result.appendPoints(inter3.points);
    result.appendPoints(inter4.points);

    if (result.points.length > 0) {
      result.status = 'Intersection';
    }
    return result;
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { });

  if (fabric.Color) {
    fabric.warn('fabric.Color is already defined.');
    return;
  }

  /**
   * Color class
   * The purpose of {@link fabric.Color} is to abstract and encapsulate common color operations;
   * {@link fabric.Color} is a constructor and creates instances of {@link fabric.Color} objects.
   *
   * @class fabric.Color
   * @param {String} color optional in hex or rgb(a) or hsl format or from known color list
   * @return {fabric.Color} thisArg
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-2/#colors}
   */
  function Color(color) {
    if (!color) {
      this.setSource([0, 0, 0, 1]);
    }
    else {
      this._tryParsingColor(color);
    }
  }

  fabric.Color = Color;

  fabric.Color.prototype = /** @lends fabric.Color.prototype */ {

    /**
     * @private
     * @param {String|Array} color Color value to parse
     */
    _tryParsingColor: function(color) {
      var source;

      if (color in Color.colorNameMap) {
        color = Color.colorNameMap[color];
      }

      if (color === 'transparent') {
        source = [255, 255, 255, 0];
      }

      if (!source) {
        source = Color.sourceFromHex(color);
      }
      if (!source) {
        source = Color.sourceFromRgb(color);
      }
      if (!source) {
        source = Color.sourceFromHsl(color);
      }
      if (!source) {
        //if color is not recognize let's make black as canvas does
        source = [0, 0, 0, 1];
      }
      if (source) {
        this.setSource(source);
      }
    },

    /**
     * Adapted from <a href="https://rawgithub.com/mjijackson/mjijackson.github.com/master/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript.html">https://github.com/mjijackson</a>
     * @private
     * @param {Number} r Red color value
     * @param {Number} g Green color value
     * @param {Number} b Blue color value
     * @return {Array} Hsl color
     */
    _rgbToHsl: function(r, g, b) {
      r /= 255; g /= 255; b /= 255;

      var h, s, l,
          max = fabric.util.array.max([r, g, b]),
          min = fabric.util.array.min([r, g, b]);

      l = (max + min) / 2;

      if (max === min) {
        h = s = 0; // achromatic
      }
      else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }

      return [
        Math.round(h * 360),
        Math.round(s * 100),
        Math.round(l * 100)
      ];
    },

    /**
     * Returns source of this color (where source is an array representation; ex: [200, 200, 100, 1])
     * @return {Array}
     */
    getSource: function() {
      return this._source;
    },

    /**
     * Sets source of this color (where source is an array representation; ex: [200, 200, 100, 1])
     * @param {Array} source
     */
    setSource: function(source) {
      this._source = source;
    },

    /**
     * Returns color represenation in RGB format
     * @return {String} ex: rgb(0-255,0-255,0-255)
     */
    toRgb: function() {
      var source = this.getSource();
      return 'rgb(' + source[0] + ',' + source[1] + ',' + source[2] + ')';
    },

    /**
     * Returns color represenation in RGBA format
     * @return {String} ex: rgba(0-255,0-255,0-255,0-1)
     */
    toRgba: function() {
      var source = this.getSource();
      return 'rgba(' + source[0] + ',' + source[1] + ',' + source[2] + ',' + source[3] + ')';
    },

    /**
     * Returns color represenation in HSL format
     * @return {String} ex: hsl(0-360,0%-100%,0%-100%)
     */
    toHsl: function() {
      var source = this.getSource(),
          hsl = this._rgbToHsl(source[0], source[1], source[2]);

      return 'hsl(' + hsl[0] + ',' + hsl[1] + '%,' + hsl[2] + '%)';
    },

    /**
     * Returns color represenation in HSLA format
     * @return {String} ex: hsla(0-360,0%-100%,0%-100%,0-1)
     */
    toHsla: function() {
      var source = this.getSource(),
          hsl = this._rgbToHsl(source[0], source[1], source[2]);

      return 'hsla(' + hsl[0] + ',' + hsl[1] + '%,' + hsl[2] + '%,' + source[3] + ')';
    },

    /**
     * Returns color represenation in HEX format
     * @return {String} ex: FF5555
     */
    toHex: function() {
      var source = this.getSource(), r, g, b;

      r = source[0].toString(16);
      r = (r.length === 1) ? ('0' + r) : r;

      g = source[1].toString(16);
      g = (g.length === 1) ? ('0' + g) : g;

      b = source[2].toString(16);
      b = (b.length === 1) ? ('0' + b) : b;

      return r.toUpperCase() + g.toUpperCase() + b.toUpperCase();
    },

    /**
     * Gets value of alpha channel for this color
     * @return {Number} 0-1
     */
    getAlpha: function() {
      return this.getSource()[3];
    },

    /**
     * Sets value of alpha channel for this color
     * @param {Number} alpha Alpha value 0-1
     * @return {fabric.Color} thisArg
     */
    setAlpha: function(alpha) {
      var source = this.getSource();
      source[3] = alpha;
      this.setSource(source);
      return this;
    },

    /**
     * Transforms color to its grayscale representation
     * @return {fabric.Color} thisArg
     */
    toGrayscale: function() {
      var source = this.getSource(),
          average = parseInt((source[0] * 0.3 + source[1] * 0.59 + source[2] * 0.11).toFixed(0), 10),
          currentAlpha = source[3];
      this.setSource([average, average, average, currentAlpha]);
      return this;
    },

    /**
     * Transforms color to its black and white representation
     * @param {Number} threshold
     * @return {fabric.Color} thisArg
     */
    toBlackWhite: function(threshold) {
      var source = this.getSource(),
          average = (source[0] * 0.3 + source[1] * 0.59 + source[2] * 0.11).toFixed(0),
          currentAlpha = source[3];

      threshold = threshold || 127;

      average = (Number(average) < Number(threshold)) ? 0 : 255;
      this.setSource([average, average, average, currentAlpha]);
      return this;
    },

    /**
     * Overlays color with another color
     * @param {String|fabric.Color} otherColor
     * @return {fabric.Color} thisArg
     */
    overlayWith: function(otherColor) {
      if (!(otherColor instanceof Color)) {
        otherColor = new Color(otherColor);
      }

      var result = [],
          alpha = this.getAlpha(),
          otherAlpha = 0.5,
          source = this.getSource(),
          otherSource = otherColor.getSource();

      for (var i = 0; i < 3; i++) {
        result.push(Math.round((source[i] * (1 - otherAlpha)) + (otherSource[i] * otherAlpha)));
      }

      result[3] = alpha;
      this.setSource(result);
      return this;
    }
  };

  /**
   * Regex matching color in RGB or RGBA formats (ex: rgb(0, 0, 0), rgba(255, 100, 10, 0.5), rgba( 255 , 100 , 10 , 0.5 ), rgb(1,1,1), rgba(100%, 60%, 10%, 0.5))
   * @static
   * @field
   * @memberOf fabric.Color
   */
   // eslint-disable-next-line max-len
  fabric.Color.reRGBa = /^rgba?\(\s*(\d{1,3}(?:\.\d+)?\%?)\s*,\s*(\d{1,3}(?:\.\d+)?\%?)\s*,\s*(\d{1,3}(?:\.\d+)?\%?)\s*(?:\s*,\s*(\d+(?:\.\d+)?)\s*)?\)$/;

  /**
   * Regex matching color in HSL or HSLA formats (ex: hsl(200, 80%, 10%), hsla(300, 50%, 80%, 0.5), hsla( 300 , 50% , 80% , 0.5 ))
   * @static
   * @field
   * @memberOf fabric.Color
   */
  fabric.Color.reHSLa = /^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3}\%)\s*,\s*(\d{1,3}\%)\s*(?:\s*,\s*(\d+(?:\.\d+)?)\s*)?\)$/;

  /**
   * Regex matching color in HEX format (ex: #FF5544CC, #FF5555, 010155, aff)
   * @static
   * @field
   * @memberOf fabric.Color
   */
  fabric.Color.reHex = /^#?([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})$/i;

  /**
   * Map of the 17 basic color names with HEX code
   * @static
   * @field
   * @memberOf fabric.Color
   * @see: http://www.w3.org/TR/CSS2/syndata.html#color-units
   */
  fabric.Color.colorNameMap = {
    aqua:    '#00FFFF',
    black:   '#000000',
    blue:    '#0000FF',
    fuchsia: '#FF00FF',
    gray:    '#808080',
    grey:    '#808080',
    green:   '#008000',
    lime:    '#00FF00',
    maroon:  '#800000',
    navy:    '#000080',
    olive:   '#808000',
    orange:  '#FFA500',
    purple:  '#800080',
    red:     '#FF0000',
    silver:  '#C0C0C0',
    teal:    '#008080',
    white:   '#FFFFFF',
    yellow:  '#FFFF00'
  };

  /**
   * @private
   * @param {Number} p
   * @param {Number} q
   * @param {Number} t
   * @return {Number}
   */
  function hue2rgb(p, q, t) {
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }
    if (t < 1 / 2) {
      return q;
    }
    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }
    return p;
  }

  /**
   * Returns new color object, when given a color in RGB format
   * @memberOf fabric.Color
   * @param {String} color Color value ex: rgb(0-255,0-255,0-255)
   * @return {fabric.Color}
   */
  fabric.Color.fromRgb = function(color) {
    return Color.fromSource(Color.sourceFromRgb(color));
  };

  /**
   * Returns array representation (ex: [100, 100, 200, 1]) of a color that's in RGB or RGBA format
   * @memberOf fabric.Color
   * @param {String} color Color value ex: rgb(0-255,0-255,0-255), rgb(0%-100%,0%-100%,0%-100%)
   * @return {Array} source
   */
  fabric.Color.sourceFromRgb = function(color) {
    var match = color.match(Color.reRGBa);
    if (match) {
      var r = parseInt(match[1], 10) / (/%$/.test(match[1]) ? 100 : 1) * (/%$/.test(match[1]) ? 255 : 1),
          g = parseInt(match[2], 10) / (/%$/.test(match[2]) ? 100 : 1) * (/%$/.test(match[2]) ? 255 : 1),
          b = parseInt(match[3], 10) / (/%$/.test(match[3]) ? 100 : 1) * (/%$/.test(match[3]) ? 255 : 1);

      return [
        parseInt(r, 10),
        parseInt(g, 10),
        parseInt(b, 10),
        match[4] ? parseFloat(match[4]) : 1
      ];
    }
  };

  /**
   * Returns new color object, when given a color in RGBA format
   * @static
   * @function
   * @memberOf fabric.Color
   * @param {String} color
   * @return {fabric.Color}
   */
  fabric.Color.fromRgba = Color.fromRgb;

  /**
   * Returns new color object, when given a color in HSL format
   * @param {String} color Color value ex: hsl(0-260,0%-100%,0%-100%)
   * @memberOf fabric.Color
   * @return {fabric.Color}
   */
  fabric.Color.fromHsl = function(color) {
    return Color.fromSource(Color.sourceFromHsl(color));
  };

  /**
   * Returns array representation (ex: [100, 100, 200, 1]) of a color that's in HSL or HSLA format.
   * Adapted from <a href="https://rawgithub.com/mjijackson/mjijackson.github.com/master/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript.html">https://github.com/mjijackson</a>
   * @memberOf fabric.Color
   * @param {String} color Color value ex: hsl(0-360,0%-100%,0%-100%) or hsla(0-360,0%-100%,0%-100%, 0-1)
   * @return {Array} source
   * @see http://http://www.w3.org/TR/css3-color/#hsl-color
   */
  fabric.Color.sourceFromHsl = function(color) {
    var match = color.match(Color.reHSLa);
    if (!match) {
      return;
    }

    var h = (((parseFloat(match[1]) % 360) + 360) % 360) / 360,
        s = parseFloat(match[2]) / (/%$/.test(match[2]) ? 100 : 1),
        l = parseFloat(match[3]) / (/%$/.test(match[3]) ? 100 : 1),
        r, g, b;

    if (s === 0) {
      r = g = b = l;
    }
    else {
      var q = l <= 0.5 ? l * (s + 1) : l + s - l * s,
          p = l * 2 - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255),
      match[4] ? parseFloat(match[4]) : 1
    ];
  };

  /**
   * Returns new color object, when given a color in HSLA format
   * @static
   * @function
   * @memberOf fabric.Color
   * @param {String} color
   * @return {fabric.Color}
   */
  fabric.Color.fromHsla = Color.fromHsl;

  /**
   * Returns new color object, when given a color in HEX format
   * @static
   * @memberOf fabric.Color
   * @param {String} color Color value ex: FF5555
   * @return {fabric.Color}
   */
  fabric.Color.fromHex = function(color) {
    return Color.fromSource(Color.sourceFromHex(color));
  };

  /**
   * Returns array representation (ex: [100, 100, 200, 1]) of a color that's in HEX format
   * @static
   * @memberOf fabric.Color
   * @param {String} color ex: FF5555 or FF5544CC (RGBa)
   * @return {Array} source
   */
  fabric.Color.sourceFromHex = function(color) {
    if (color.match(Color.reHex)) {
      var value = color.slice(color.indexOf('#') + 1),
          isShortNotation = (value.length === 3 || value.length === 4),
          isRGBa = (value.length === 8 || value.length === 4),
          r = isShortNotation ? (value.charAt(0) + value.charAt(0)) : value.substring(0, 2),
          g = isShortNotation ? (value.charAt(1) + value.charAt(1)) : value.substring(2, 4),
          b = isShortNotation ? (value.charAt(2) + value.charAt(2)) : value.substring(4, 6),
          a = isRGBa ? (isShortNotation ? (value.charAt(3) + value.charAt(3)) : value.substring(6, 8)) : 'FF';

      return [
        parseInt(r, 16),
        parseInt(g, 16),
        parseInt(b, 16),
        parseFloat((parseInt(a, 16) / 255).toFixed(2))
      ];
    }
  };

  /**
   * Returns new color object, when given color in array representation (ex: [200, 100, 100, 0.5])
   * @static
   * @memberOf fabric.Color
   * @param {Array} source
   * @return {fabric.Color}
   */
  fabric.Color.fromSource = function(source) {
    var oColor = new Color();
    oColor.setSource(source);
    return oColor;
  };

})(typeof exports !== 'undefined' ? exports : this);


(function() {

  /* _FROM_SVG_START_ */
  function getColorStop(el) {
    var style = el.getAttribute('style'),
        offset = el.getAttribute('offset') || 0,
        color, colorAlpha, opacity;

    // convert percents to absolute values
    offset = parseFloat(offset) / (/%$/.test(offset) ? 100 : 1);
    offset = offset < 0 ? 0 : offset > 1 ? 1 : offset;
    if (style) {
      var keyValuePairs = style.split(/\s*;\s*/);

      if (keyValuePairs[keyValuePairs.length - 1] === '') {
        keyValuePairs.pop();
      }

      for (var i = keyValuePairs.length; i--; ) {

        var split = keyValuePairs[i].split(/\s*:\s*/),
            key = split[0].trim(),
            value = split[1].trim();

        if (key === 'stop-color') {
          color = value;
        }
        else if (key === 'stop-opacity') {
          opacity = value;
        }
      }
    }

    if (!color) {
      color = el.getAttribute('stop-color') || 'rgb(0,0,0)';
    }
    if (!opacity) {
      opacity = el.getAttribute('stop-opacity');
    }

    color = new fabric.Color(color);
    colorAlpha = color.getAlpha();
    opacity = isNaN(parseFloat(opacity)) ? 1 : parseFloat(opacity);
    opacity *= colorAlpha;

    return {
      offset: offset,
      color: color.toRgb(),
      opacity: opacity
    };
  }

  function getLinearCoords(el) {
    return {
      x1: el.getAttribute('x1') || 0,
      y1: el.getAttribute('y1') || 0,
      x2: el.getAttribute('x2') || '100%',
      y2: el.getAttribute('y2') || 0
    };
  }

  function getRadialCoords(el) {
    return {
      x1: el.getAttribute('fx') || el.getAttribute('cx') || '50%',
      y1: el.getAttribute('fy') || el.getAttribute('cy') || '50%',
      r1: 0,
      x2: el.getAttribute('cx') || '50%',
      y2: el.getAttribute('cy') || '50%',
      r2: el.getAttribute('r') || '50%'
    };
  }
  /* _FROM_SVG_END_ */

  /**
   * Gradient class
   * @class fabric.Gradient
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-2#gradients}
   * @see {@link fabric.Gradient#initialize} for constructor definition
   */
  fabric.Gradient = fabric.util.createClass(/** @lends fabric.Gradient.prototype */ {

    /**
     * Horizontal offset for aligning gradients coming from SVG when outside pathgroups
     * @type Number
     * @default 0
     */
    offsetX: 0,

    /**
     * Vertical offset for aligning gradients coming from SVG when outside pathgroups
     * @type Number
     * @default 0
     */
    offsetY: 0,

    /**
     * Constructor
     * @param {Object} [options] Options object with type, coords, gradientUnits and colorStops
     * @return {fabric.Gradient} thisArg
     */
    initialize: function(options) {
      options || (options = { });

      var coords = { };

      this.id = fabric.Object.__uid++;
      this.type = options.type || 'linear';

      coords = {
        x1: options.coords.x1 || 0,
        y1: options.coords.y1 || 0,
        x2: options.coords.x2 || 0,
        y2: options.coords.y2 || 0
      };

      if (this.type === 'radial') {
        coords.r1 = options.coords.r1 || 0;
        coords.r2 = options.coords.r2 || 0;
      }
      this.coords = coords;
      this.colorStops = options.colorStops.slice();
      if (options.gradientTransform) {
        this.gradientTransform = options.gradientTransform;
      }
      this.offsetX = options.offsetX || this.offsetX;
      this.offsetY = options.offsetY || this.offsetY;
    },

    /**
     * Adds another colorStop
     * @param {Object} colorStop Object with offset and color
     * @return {fabric.Gradient} thisArg
     */
    addColorStop: function(colorStop) {
      for (var position in colorStop) {
        var color = new fabric.Color(colorStop[position]);
        this.colorStops.push({
          offset: position,
          color: color.toRgb(),
          opacity: color.getAlpha()
        });
      }
      return this;
    },

    /**
     * Returns object representation of a gradient
     * @return {Object}
     */
    toObject: function() {
      return {
        type: this.type,
        coords: this.coords,
        colorStops: this.colorStops,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        gradientTransform: this.gradientTransform ? this.gradientTransform.concat() : this.gradientTransform
      };
    },

    /* _TO_SVG_START_ */
    /**
     * Returns SVG representation of an gradient
     * @param {Object} object Object to create a gradient for
     * @return {String} SVG representation of an gradient (linear/radial)
     */
    toSVG: function(object) {
      var coords = fabric.util.object.clone(this.coords),
          markup, commonAttributes;

      // colorStops must be sorted ascending
      this.colorStops.sort(function(a, b) {
        return a.offset - b.offset;
      });

      if (!(object.group && object.group.type === 'path-group')) {
        for (var prop in coords) {
          if (prop === 'x1' || prop === 'x2' || prop === 'r2') {
            coords[prop] += this.offsetX - object.width / 2;
          }
          else if (prop === 'y1' || prop === 'y2') {
            coords[prop] += this.offsetY - object.height / 2;
          }
        }
      }

      commonAttributes = 'id="SVGID_' + this.id +
                     '" gradientUnits="userSpaceOnUse"';
      if (this.gradientTransform) {
        commonAttributes += ' gradientTransform="matrix(' + this.gradientTransform.join(' ') + ')" ';
      }
      if (this.type === 'linear') {
        markup = [
          '<linearGradient ',
          commonAttributes,
          ' x1="', coords.x1,
          '" y1="', coords.y1,
          '" x2="', coords.x2,
          '" y2="', coords.y2,
          '">\n'
        ];
      }
      else if (this.type === 'radial') {
        markup = [
          '<radialGradient ',
          commonAttributes,
          ' cx="', coords.x2,
          '" cy="', coords.y2,
          '" r="', coords.r2,
          '" fx="', coords.x1,
          '" fy="', coords.y1,
          '">\n'
        ];
      }

      for (var i = 0; i < this.colorStops.length; i++) {
        markup.push(
          '<stop ',
            'offset="', (this.colorStops[i].offset * 100) + '%',
            '" style="stop-color:', this.colorStops[i].color,
            (this.colorStops[i].opacity !== null ? ';stop-opacity: ' + this.colorStops[i].opacity : ';'),
          '"/>\n'
        );
      }

      markup.push((this.type === 'linear' ? '</linearGradient>\n' : '</radialGradient>\n'));

      return markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * Returns an instance of CanvasGradient
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Object} object
     * @return {CanvasGradient}
     */
    toLive: function(ctx, object) {
      var gradient, prop, coords = fabric.util.object.clone(this.coords);

      if (!this.type) {
        return;
      }

      if (object.group && object.group.type === 'path-group') {
        for (prop in coords) {
          if (prop === 'x1' || prop === 'x2') {
            coords[prop] += -this.offsetX + object.width / 2;
          }
          else if (prop === 'y1' || prop === 'y2') {
            coords[prop] += -this.offsetY + object.height / 2;
          }
        }
      }

      if (this.type === 'linear') {
        gradient = ctx.createLinearGradient(
          coords.x1, coords.y1, coords.x2, coords.y2);
      }
      else if (this.type === 'radial') {
        gradient = ctx.createRadialGradient(
          coords.x1, coords.y1, coords.r1, coords.x2, coords.y2, coords.r2);
      }

      for (var i = 0, len = this.colorStops.length; i < len; i++) {
        var color = this.colorStops[i].color,
            opacity = this.colorStops[i].opacity,
            offset = this.colorStops[i].offset;

        if (typeof opacity !== 'undefined') {
          color = new fabric.Color(color).setAlpha(opacity).toRgba();
        }
        gradient.addColorStop(parseFloat(offset), color);
      }

      return gradient;
    }
  });

  fabric.util.object.extend(fabric.Gradient, {

    /* _FROM_SVG_START_ */
    /**
     * Returns {@link fabric.Gradient} instance from an SVG element
     * @static
     * @memberOf fabric.Gradient
     * @param {SVGGradientElement} el SVG gradient element
     * @param {fabric.Object} instance
     * @return {fabric.Gradient} Gradient instance
     * @see http://www.w3.org/TR/SVG/pservers.html#LinearGradientElement
     * @see http://www.w3.org/TR/SVG/pservers.html#RadialGradientElement
     */
    fromElement: function(el, instance) {

      /**
       *  @example:
       *
       *  <linearGradient id="linearGrad1">
       *    <stop offset="0%" stop-color="white"/>
       *    <stop offset="100%" stop-color="black"/>
       *  </linearGradient>
       *
       *  OR
       *
       *  <linearGradient id="linearGrad2">
       *    <stop offset="0" style="stop-color:rgb(255,255,255)"/>
       *    <stop offset="1" style="stop-color:rgb(0,0,0)"/>
       *  </linearGradient>
       *
       *  OR
       *
       *  <radialGradient id="radialGrad1">
       *    <stop offset="0%" stop-color="white" stop-opacity="1" />
       *    <stop offset="50%" stop-color="black" stop-opacity="0.5" />
       *    <stop offset="100%" stop-color="white" stop-opacity="1" />
       *  </radialGradient>
       *
       *  OR
       *
       *  <radialGradient id="radialGrad2">
       *    <stop offset="0" stop-color="rgb(255,255,255)" />
       *    <stop offset="0.5" stop-color="rgb(0,0,0)" />
       *    <stop offset="1" stop-color="rgb(255,255,255)" />
       *  </radialGradient>
       *
       */

      var colorStopEls = el.getElementsByTagName('stop'),
          type,
          gradientUnits = el.getAttribute('gradientUnits') || 'objectBoundingBox',
          gradientTransform = el.getAttribute('gradientTransform'),
          colorStops = [],
          coords, ellipseMatrix;

      if (el.nodeName === 'linearGradient' || el.nodeName === 'LINEARGRADIENT') {
        type = 'linear';
      }
      else {
        type = 'radial';
      }

      if (type === 'linear') {
        coords = getLinearCoords(el);
      }
      else if (type === 'radial') {
        coords = getRadialCoords(el);
      }

      for (var i = colorStopEls.length; i--; ) {
        colorStops.push(getColorStop(colorStopEls[i]));
      }

      ellipseMatrix = _convertPercentUnitsToValues(instance, coords, gradientUnits);

      var gradient = new fabric.Gradient({
        type: type,
        coords: coords,
        colorStops: colorStops,
        offsetX: -instance.left,
        offsetY: -instance.top
      });

      if (gradientTransform || ellipseMatrix !== '') {
        gradient.gradientTransform = fabric.parseTransformAttribute((gradientTransform || '') + ellipseMatrix);
      }
      return gradient;
    },
    /* _FROM_SVG_END_ */

    /**
     * Returns {@link fabric.Gradient} instance from its object representation
     * @static
     * @memberOf fabric.Gradient
     * @param {Object} obj
     * @param {Object} [options] Options object
     */
    forObject: function(obj, options) {
      options || (options = { });
      _convertPercentUnitsToValues(obj, options.coords, 'userSpaceOnUse');
      return new fabric.Gradient(options);
    }
  });

  /**
   * @private
   */
  function _convertPercentUnitsToValues(object, options, gradientUnits) {
    var propValue, addFactor = 0, multFactor = 1, ellipseMatrix = '';
    for (var prop in options) {
      if (options[prop] === 'Infinity') {
        options[prop] = 1;
      }
      else if (options[prop] === '-Infinity') {
        options[prop] = 0;
      }
      propValue = parseFloat(options[prop], 10);
      if (typeof options[prop] === 'string' && /^\d+%$/.test(options[prop])) {
        multFactor = 0.01;
      }
      else {
        multFactor = 1;
      }
      if (prop === 'x1' || prop === 'x2' || prop === 'r2') {
        multFactor *= gradientUnits === 'objectBoundingBox' ? object.width : 1;
        addFactor = gradientUnits === 'objectBoundingBox' ? object.left || 0 : 0;
      }
      else if (prop === 'y1' || prop === 'y2') {
        multFactor *= gradientUnits === 'objectBoundingBox' ? object.height : 1;
        addFactor = gradientUnits === 'objectBoundingBox' ? object.top || 0 : 0;
      }
      options[prop] = propValue * multFactor + addFactor;
    }
    if (object.type === 'ellipse' &&
        options.r2 !== null &&
        gradientUnits === 'objectBoundingBox' &&
        object.rx !== object.ry) {

      var scaleFactor = object.ry / object.rx;
      ellipseMatrix = ' scale(1, ' + scaleFactor + ')';
      if (options.y1) {
        options.y1 /= scaleFactor;
      }
      if (options.y2) {
        options.y2 /= scaleFactor;
      }
    }
    return ellipseMatrix;
  }
})();


/**
 * Pattern class
 * @class fabric.Pattern
 * @see {@link http://fabricjs.com/patterns|Pattern demo}
 * @see {@link http://fabricjs.com/dynamic-patterns|DynamicPattern demo}
 * @see {@link fabric.Pattern#initialize} for constructor definition
 */
fabric.Pattern = fabric.util.createClass(/** @lends fabric.Pattern.prototype */ {

  /**
   * Repeat property of a pattern (one of repeat, repeat-x, repeat-y or no-repeat)
   * @type String
   * @default
   */
  repeat: 'repeat',

  /**
   * Pattern horizontal offset from object's left/top corner
   * @type Number
   * @default
   */
  offsetX: 0,

  /**
   * Pattern vertical offset from object's left/top corner
   * @type Number
   * @default
   */
  offsetY: 0,

  /**
   * Constructor
   * @param {Object} [options] Options object
   * @return {fabric.Pattern} thisArg
   */
  initialize: function(options) {
    options || (options = { });

    this.id = fabric.Object.__uid++;

    if (options.source) {
      if (typeof options.source === 'string') {
        // function string
        if (typeof fabric.util.getFunctionBody(options.source) !== 'undefined') {
          this.source = new Function(fabric.util.getFunctionBody(options.source));
        }
        else {
          // img src string
          var _this = this;
          this.source = fabric.util.createImage();
          fabric.util.loadImage(options.source, function(img) {
            _this.source = img;
          });
        }
      }
      else {
        // img element
        this.source = options.source;
      }
    }
    if (options.repeat) {
      this.repeat = options.repeat;
    }
    if (options.offsetX) {
      this.offsetX = options.offsetX;
    }
    if (options.offsetY) {
      this.offsetY = options.offsetY;
    }
  },

  /**
   * Returns object representation of a pattern
   * @return {Object} Object representation of a pattern instance
   */
  toObject: function() {

    var source;

    // callback
    if (typeof this.source === 'function') {
      source = String(this.source);
    }
    // <img> element
    else if (typeof this.source.src === 'string') {
      source = this.source.src;
    }
    // <canvas> element
    else if (typeof this.source === 'object' && this.source.toDataURL) {
      source = this.source.toDataURL();
    }

    return {
      source: source,
      repeat: this.repeat,
      offsetX: this.offsetX,
      offsetY: this.offsetY
    };
  },

  /* _TO_SVG_START_ */
  /**
   * Returns SVG representation of a pattern
   * @param {fabric.Object} object
   * @return {String} SVG representation of a pattern
   */
  toSVG: function(object) {
    var patternSource = typeof this.source === 'function' ? this.source() : this.source,
        patternWidth = patternSource.width / object.getWidth(),
        patternHeight = patternSource.height / object.getHeight(),
        patternOffsetX = this.offsetX / object.getWidth(),
        patternOffsetY = this.offsetY / object.getHeight(),
        patternImgSrc = '';
    if (this.repeat === 'repeat-x' || this.repeat === 'no-repeat') {
      patternHeight = 1;
    }
    if (this.repeat === 'repeat-y' || this.repeat === 'no-repeat') {
      patternWidth = 1;
    }
    if (patternSource.src) {
      patternImgSrc = patternSource.src;
    }
    else if (patternSource.toDataURL) {
      patternImgSrc = patternSource.toDataURL();
    }

    return '<pattern id="SVGID_' + this.id +
                  '" x="' + patternOffsetX +
                  '" y="' + patternOffsetY +
                  '" width="' + patternWidth +
                  '" height="' + patternHeight + '">\n' +
             '<image x="0" y="0"' +
                    ' width="' + patternSource.width +
                    '" height="' + patternSource.height +
                    '" xlink:href="' + patternImgSrc +
             '"></image>\n' +
           '</pattern>\n';
  },
  /* _TO_SVG_END_ */

  /**
   * Returns an instance of CanvasPattern
   * @param {CanvasRenderingContext2D} ctx Context to create pattern
   * @return {CanvasPattern}
   */
  toLive: function(ctx) {
    var source = typeof this.source === 'function'
      ? this.source()
      : this.source;

    // if the image failed to load, return, and allow rest to continue loading
    if (!source) {
      return '';
    }

    // if an image
    if (typeof source.src !== 'undefined') {
      if (!source.complete) {
        return '';
      }
      if (source.naturalWidth === 0 || source.naturalHeight === 0) {
        return '';
      }
    }
    return ctx.createPattern(source, this.repeat);
  }
});


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      toFixed = fabric.util.toFixed;

  if (fabric.Shadow) {
    fabric.warn('fabric.Shadow is already defined.');
    return;
  }

  /**
   * Shadow class
   * @class fabric.Shadow
   * @see {@link http://fabricjs.com/shadows|Shadow demo}
   * @see {@link fabric.Shadow#initialize} for constructor definition
   */
  fabric.Shadow = fabric.util.createClass(/** @lends fabric.Shadow.prototype */ {

    /**
     * Shadow color
     * @type String
     * @default
     */
    color: 'rgb(0,0,0)',

    /**
     * Shadow blur
     * @type Number
     */
    blur: 0,

    /**
     * Shadow horizontal offset
     * @type Number
     * @default
     */
    offsetX: 0,

    /**
     * Shadow vertical offset
     * @type Number
     * @default
     */
    offsetY: 0,

    /**
     * Whether the shadow should affect stroke operations
     * @type Boolean
     * @default
     */
    affectStroke: false,

    /**
     * Indicates whether toObject should include default values
     * @type Boolean
     * @default
     */
    includeDefaultValues: true,

    /**
     * Constructor
     * @param {Object|String} [options] Options object with any of color, blur, offsetX, offsetX properties or string (e.g. "rgba(0,0,0,0.2) 2px 2px 10px, "2px 2px 10px rgba(0,0,0,0.2)")
     * @return {fabric.Shadow} thisArg
     */
    initialize: function(options) {

      if (typeof options === 'string') {
        options = this._parseShadow(options);
      }

      for (var prop in options) {
        this[prop] = options[prop];
      }

      this.id = fabric.Object.__uid++;
    },

    /**
     * @private
     * @param {String} shadow Shadow value to parse
     * @return {Object} Shadow object with color, offsetX, offsetY and blur
     */
    _parseShadow: function(shadow) {
      var shadowStr = shadow.trim(),
          offsetsAndBlur = fabric.Shadow.reOffsetsAndBlur.exec(shadowStr) || [],
          color = shadowStr.replace(fabric.Shadow.reOffsetsAndBlur, '') || 'rgb(0,0,0)';

      return {
        color: color.trim(),
        offsetX: parseInt(offsetsAndBlur[1], 10) || 0,
        offsetY: parseInt(offsetsAndBlur[2], 10) || 0,
        blur: parseInt(offsetsAndBlur[3], 10) || 0
      };
    },

    /**
     * Returns a string representation of an instance
     * @see http://www.w3.org/TR/css-text-decor-3/#text-shadow
     * @return {String} Returns CSS3 text-shadow declaration
     */
    toString: function() {
      return [this.offsetX, this.offsetY, this.blur, this.color].join('px ');
    },

    /* _TO_SVG_START_ */
    /**
     * Returns SVG representation of a shadow
     * @param {fabric.Object} object
     * @return {String} SVG representation of a shadow
     */
    toSVG: function(object) {
      var fBoxX = 40, fBoxY = 40, NUM_FRACTION_DIGITS = fabric.Object.NUM_FRACTION_DIGITS,
          offset = fabric.util.rotateVector(
            { x: this.offsetX, y: this.offsetY },
            fabric.util.degreesToRadians(-object.angle)),
          BLUR_BOX = 20;

      if (object.width && object.height) {
        //http://www.w3.org/TR/SVG/filters.html#FilterEffectsRegion
        // we add some extra space to filter box to contain the blur ( 20 )
        fBoxX = toFixed((Math.abs(offset.x) + this.blur) / object.width, NUM_FRACTION_DIGITS) * 100 + BLUR_BOX;
        fBoxY = toFixed((Math.abs(offset.y) + this.blur) / object.height, NUM_FRACTION_DIGITS) * 100 + BLUR_BOX;
      }
      if (object.flipX) {
        offset.x *= -1;
      }
      if (object.flipY) {
        offset.y *= -1;
      }
      return (
        '<filter id="SVGID_' + this.id + '" y="-' + fBoxY + '%" height="' + (100 + 2 * fBoxY) + '%" ' +
          'x="-' + fBoxX + '%" width="' + (100 + 2 * fBoxX) + '%" ' + '>\n' +
          '\t<feGaussianBlur in="SourceAlpha" stdDeviation="' +
            toFixed(this.blur ? this.blur / 2 : 0, NUM_FRACTION_DIGITS) + '"></feGaussianBlur>\n' +
          '\t<feOffset dx="' + toFixed(offset.x, NUM_FRACTION_DIGITS) +
          '" dy="' + toFixed(offset.y, NUM_FRACTION_DIGITS) + '" result="oBlur" ></feOffset>\n' +
          '\t<feFlood flood-color="' + this.color + '"/>\n' +
          '\t<feComposite in2="oBlur" operator="in" />\n' +
          '\t<feMerge>\n' +
            '\t\t<feMergeNode></feMergeNode>\n' +
            '\t\t<feMergeNode in="SourceGraphic"></feMergeNode>\n' +
          '\t</feMerge>\n' +
        '</filter>\n');
    },
    /* _TO_SVG_END_ */

    /**
     * Returns object representation of a shadow
     * @return {Object} Object representation of a shadow instance
     */
    toObject: function() {
      if (this.includeDefaultValues) {
        return {
          color: this.color,
          blur: this.blur,
          offsetX: this.offsetX,
          offsetY: this.offsetY,
          affectStroke: this.affectStroke
        };
      }
      var obj = { }, proto = fabric.Shadow.prototype;

      ['color', 'blur', 'offsetX', 'offsetY', 'affectStroke'].forEach(function(prop) {
        if (this[prop] !== proto[prop]) {
          obj[prop] = this[prop];
        }
      }, this);

      return obj;
    }
  });

  /**
   * Regex matching shadow offsetX, offsetY and blur (ex: "2px 2px 10px rgba(0,0,0,0.2)", "rgb(0,255,0) 2px 2px")
   * @static
   * @field
   * @memberOf fabric.Shadow
   */
  // eslint-disable-next-line max-len
  fabric.Shadow.reOffsetsAndBlur = /(?:\s|^)(-?\d+(?:px)?(?:\s?|$))?(-?\d+(?:px)?(?:\s?|$))?(\d+(?:px)?)?(?:\s?|$)(?:$|\s)/;

})(typeof exports !== 'undefined' ? exports : this);


(function () {

  'use strict';

  if (fabric.StaticCanvas) {
    fabric.warn('fabric.StaticCanvas is already defined.');
    return;
  }

  // aliases for faster resolution
  var extend = fabric.util.object.extend,
      getElementOffset = fabric.util.getElementOffset,
      removeFromArray = fabric.util.removeFromArray,
      toFixed = fabric.util.toFixed,

      CANVAS_INIT_ERROR = new Error('Could not initialize `canvas` element');

  /**
   * Static canvas class
   * @class fabric.StaticCanvas
   * @mixes fabric.Collection
   * @mixes fabric.Observable
   * @see {@link http://fabricjs.com/static_canvas|StaticCanvas demo}
   * @see {@link fabric.StaticCanvas#initialize} for constructor definition
   * @fires before:render
   * @fires after:render
   * @fires canvas:cleared
   * @fires object:added
   * @fires object:removed
   */
  fabric.StaticCanvas = fabric.util.createClass(/** @lends fabric.StaticCanvas.prototype */ {

    /**
     * Constructor
     * @param {HTMLElement | String} el &lt;canvas> element to initialize instance on
     * @param {Object} [options] Options object
     * @return {Object} thisArg
     */
    initialize: function(el, options) {
      options || (options = { });

      this._initStatic(el, options);
    },

    /**
     * Background color of canvas instance.
     * Should be set via {@link fabric.StaticCanvas#setBackgroundColor}.
     * @type {(String|fabric.Pattern)}
     * @default
     */
    backgroundColor: '',

    /**
     * Background image of canvas instance.
     * Should be set via {@link fabric.StaticCanvas#setBackgroundImage}.
     * <b>Backwards incompatibility note:</b> The "backgroundImageOpacity"
     * and "backgroundImageStretch" properties are deprecated since 1.3.9.
     * Use {@link fabric.Image#opacity}, {@link fabric.Image#width} and {@link fabric.Image#height}.
     * @type fabric.Image
     * @default
     */
    backgroundImage: null,

    /**
     * Overlay color of canvas instance.
     * Should be set via {@link fabric.StaticCanvas#setOverlayColor}
     * @since 1.3.9
     * @type {(String|fabric.Pattern)}
     * @default
     */
    overlayColor: '',

    /**
     * Overlay image of canvas instance.
     * Should be set via {@link fabric.StaticCanvas#setOverlayImage}.
     * <b>Backwards incompatibility note:</b> The "overlayImageLeft"
     * and "overlayImageTop" properties are deprecated since 1.3.9.
     * Use {@link fabric.Image#left} and {@link fabric.Image#top}.
     * @type fabric.Image
     * @default
     */
    overlayImage: null,

    /**
     * Indicates whether toObject/toDatalessObject should include default values
     * @type Boolean
     * @default
     */
    includeDefaultValues: true,

    /**
     * Indicates whether objects' state should be saved
     * @type Boolean
     * @default
     */
    stateful: true,

    /**
     * Indicates whether {@link fabric.Collection.add}, {@link fabric.Collection.insertAt} and {@link fabric.Collection.remove} should also re-render canvas.
     * Disabling this option could give a great performance boost when adding/removing a lot of objects to/from canvas at once
     * (followed by a manual rendering after addition/deletion)
     * @type Boolean
     * @default
     */
    renderOnAddRemove: true,

    /**
     * Function that determines clipping of entire canvas area
     * Being passed context as first argument. See clipping canvas area in {@link https://github.com/kangax/fabric.js/wiki/FAQ}
     * @type Function
     * @default
     */
    clipTo: null,

    /**
     * Indicates whether object controls (borders/controls) are rendered above overlay image
     * @type Boolean
     * @default
     */
    controlsAboveOverlay: false,

    /**
     * Indicates whether the browser can be scrolled when using a touchscreen and dragging on the canvas
     * @type Boolean
     * @default
     */
    allowTouchScrolling: false,

    /**
     * Indicates whether this canvas will use image smoothing, this is on by default in browsers
     * @type Boolean
     * @default
     */
    imageSmoothingEnabled: true,

    /**
     * The transformation (in the format of Canvas transform) which focuses the viewport
     * @type Array
     * @default
     */
    viewportTransform: [1, 0, 0, 1, 0, 0],

    /**
     * if set to false background image is not affected by viewport transform
     * @since 1.6.3
     * @type Boolean
     * @default
     */
    backgroundVpt: true,

    /**
     * if set to false overlya image is not affected by viewport transform
     * @since 1.6.3
     * @type Boolean
     * @default
     */
    overlayVpt: true,

    /**
     * Callback; invoked right before object is about to be scaled/rotated
     */
    onBeforeScaleRotate: function () {
      /* NOOP */
    },

    /**
     * When true, canvas is scaled by devicePixelRatio for better rendering on retina screens
     */
    enableRetinaScaling: true,

    /**
     * @private
     * @param {HTMLElement | String} el &lt;canvas> element to initialize instance on
     * @param {Object} [options] Options object
     */
    _initStatic: function(el, options) {
      var cb = fabric.StaticCanvas.prototype.renderAll.bind(this);
      this._objects = [];
      this._createLowerCanvas(el);
      this._initOptions(options);
      this._setImageSmoothing();
      // only initialize retina scaling once
      if (!this.interactive) {
        this._initRetinaScaling();
      }

      if (options.overlayImage) {
        this.setOverlayImage(options.overlayImage, cb);
      }
      if (options.backgroundImage) {
        this.setBackgroundImage(options.backgroundImage, cb);
      }
      if (options.backgroundColor) {
        this.setBackgroundColor(options.backgroundColor, cb);
      }
      if (options.overlayColor) {
        this.setOverlayColor(options.overlayColor, cb);
      }
      this.calcOffset();
    },

    /**
     * @private
     */
    _isRetinaScaling: function() {
      return (fabric.devicePixelRatio !== 1 && this.enableRetinaScaling);
    },

    /**
     * @private
     * @return {Number} retinaScaling if applied, otherwise 1;
     */
    getRetinaScaling: function() {
      return this._isRetinaScaling() ? fabric.devicePixelRatio : 1;
    },

    /**
     * @private
     */
    _initRetinaScaling: function() {
      if (!this._isRetinaScaling()) {
        return;
      }
      this.lowerCanvasEl.setAttribute('width', this.width * fabric.devicePixelRatio);
      this.lowerCanvasEl.setAttribute('height', this.height * fabric.devicePixelRatio);

      this.contextContainer.scale(fabric.devicePixelRatio, fabric.devicePixelRatio);
    },

    /**
     * Calculates canvas element offset relative to the document
     * This method is also attached as "resize" event handler of window
     * @return {fabric.Canvas} instance
     * @chainable
     */
    calcOffset: function () {
      this._offset = getElementOffset(this.lowerCanvasEl);
      return this;
    },

    /**
     * Sets {@link fabric.StaticCanvas#overlayImage|overlay image} for this canvas
     * @param {(fabric.Image|String)} image fabric.Image instance or URL of an image to set overlay to
     * @param {Function} callback callback to invoke when image is loaded and set as an overlay
     * @param {Object} [options] Optional options to set for the {@link fabric.Image|overlay image}.
     * @return {fabric.Canvas} thisArg
     * @chainable
     * @see {@link http://jsfiddle.net/fabricjs/MnzHT/|jsFiddle demo}
     * @example <caption>Normal overlayImage with left/top = 0</caption>
     * canvas.setOverlayImage('http://fabricjs.com/assets/jail_cell_bars.png', canvas.renderAll.bind(canvas), {
     *   // Needed to position overlayImage at 0/0
     *   originX: 'left',
     *   originY: 'top'
     * });
     * @example <caption>overlayImage with different properties</caption>
     * canvas.setOverlayImage('http://fabricjs.com/assets/jail_cell_bars.png', canvas.renderAll.bind(canvas), {
     *   opacity: 0.5,
     *   angle: 45,
     *   left: 400,
     *   top: 400,
     *   originX: 'left',
     *   originY: 'top'
     * });
     * @example <caption>Stretched overlayImage #1 - width/height correspond to canvas width/height</caption>
     * fabric.Image.fromURL('http://fabricjs.com/assets/jail_cell_bars.png', function(img) {
     *    img.set({width: canvas.width, height: canvas.height, originX: 'left', originY: 'top'});
     *    canvas.setOverlayImage(img, canvas.renderAll.bind(canvas));
     * });
     * @example <caption>Stretched overlayImage #2 - width/height correspond to canvas width/height</caption>
     * canvas.setOverlayImage('http://fabricjs.com/assets/jail_cell_bars.png', canvas.renderAll.bind(canvas), {
     *   width: canvas.width,
     *   height: canvas.height,
     *   // Needed to position overlayImage at 0/0
     *   originX: 'left',
     *   originY: 'top'
     * });
     * @example <caption>overlayImage loaded from cross-origin</caption>
     * canvas.setOverlayImage('http://fabricjs.com/assets/jail_cell_bars.png', canvas.renderAll.bind(canvas), {
     *   opacity: 0.5,
     *   angle: 45,
     *   left: 400,
     *   top: 400,
     *   originX: 'left',
     *   originY: 'top',
     *   crossOrigin: 'anonymous'
     * });
     */
    setOverlayImage: function (image, callback, options) {
      return this.__setBgOverlayImage('overlayImage', image, callback, options);
    },

    /**
     * Sets {@link fabric.StaticCanvas#backgroundImage|background image} for this canvas
     * @param {(fabric.Image|String)} image fabric.Image instance or URL of an image to set background to
     * @param {Function} callback Callback to invoke when image is loaded and set as background
     * @param {Object} [options] Optional options to set for the {@link fabric.Image|background image}.
     * @return {fabric.Canvas} thisArg
     * @chainable
     * @see {@link http://jsfiddle.net/fabricjs/YH9yD/|jsFiddle demo}
     * @example <caption>Normal backgroundImage with left/top = 0</caption>
     * canvas.setBackgroundImage('http://fabricjs.com/assets/honey_im_subtle.png', canvas.renderAll.bind(canvas), {
     *   // Needed to position backgroundImage at 0/0
     *   originX: 'left',
     *   originY: 'top'
     * });
     * @example <caption>backgroundImage with different properties</caption>
     * canvas.setBackgroundImage('http://fabricjs.com/assets/honey_im_subtle.png', canvas.renderAll.bind(canvas), {
     *   opacity: 0.5,
     *   angle: 45,
     *   left: 400,
     *   top: 400,
     *   originX: 'left',
     *   originY: 'top'
     * });
     * @example <caption>Stretched backgroundImage #1 - width/height correspond to canvas width/height</caption>
     * fabric.Image.fromURL('http://fabricjs.com/assets/honey_im_subtle.png', function(img) {
     *    img.set({width: canvas.width, height: canvas.height, originX: 'left', originY: 'top'});
     *    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
     * });
     * @example <caption>Stretched backgroundImage #2 - width/height correspond to canvas width/height</caption>
     * canvas.setBackgroundImage('http://fabricjs.com/assets/honey_im_subtle.png', canvas.renderAll.bind(canvas), {
     *   width: canvas.width,
     *   height: canvas.height,
     *   // Needed to position backgroundImage at 0/0
     *   originX: 'left',
     *   originY: 'top'
     * });
     * @example <caption>backgroundImage loaded from cross-origin</caption>
     * canvas.setBackgroundImage('http://fabricjs.com/assets/honey_im_subtle.png', canvas.renderAll.bind(canvas), {
     *   opacity: 0.5,
     *   angle: 45,
     *   left: 400,
     *   top: 400,
     *   originX: 'left',
     *   originY: 'top',
     *   crossOrigin: 'anonymous'
     * });
     */
    setBackgroundImage: function (image, callback, options) {
      return this.__setBgOverlayImage('backgroundImage', image, callback, options);
    },

    /**
     * Sets {@link fabric.StaticCanvas#overlayColor|background color} for this canvas
     * @param {(String|fabric.Pattern)} overlayColor Color or pattern to set background color to
     * @param {Function} callback Callback to invoke when background color is set
     * @return {fabric.Canvas} thisArg
     * @chainable
     * @see {@link http://jsfiddle.net/fabricjs/pB55h/|jsFiddle demo}
     * @example <caption>Normal overlayColor - color value</caption>
     * canvas.setOverlayColor('rgba(255, 73, 64, 0.6)', canvas.renderAll.bind(canvas));
     * @example <caption>fabric.Pattern used as overlayColor</caption>
     * canvas.setOverlayColor({
     *   source: 'http://fabricjs.com/assets/escheresque_ste.png'
     * }, canvas.renderAll.bind(canvas));
     * @example <caption>fabric.Pattern used as overlayColor with repeat and offset</caption>
     * canvas.setOverlayColor({
     *   source: 'http://fabricjs.com/assets/escheresque_ste.png',
     *   repeat: 'repeat',
     *   offsetX: 200,
     *   offsetY: 100
     * }, canvas.renderAll.bind(canvas));
     */
    setOverlayColor: function(overlayColor, callback) {
      return this.__setBgOverlayColor('overlayColor', overlayColor, callback);
    },

    /**
     * Sets {@link fabric.StaticCanvas#backgroundColor|background color} for this canvas
     * @param {(String|fabric.Pattern)} backgroundColor Color or pattern to set background color to
     * @param {Function} callback Callback to invoke when background color is set
     * @return {fabric.Canvas} thisArg
     * @chainable
     * @see {@link http://jsfiddle.net/fabricjs/hXzvk/|jsFiddle demo}
     * @example <caption>Normal backgroundColor - color value</caption>
     * canvas.setBackgroundColor('rgba(255, 73, 64, 0.6)', canvas.renderAll.bind(canvas));
     * @example <caption>fabric.Pattern used as backgroundColor</caption>
     * canvas.setBackgroundColor({
     *   source: 'http://fabricjs.com/assets/escheresque_ste.png'
     * }, canvas.renderAll.bind(canvas));
     * @example <caption>fabric.Pattern used as backgroundColor with repeat and offset</caption>
     * canvas.setBackgroundColor({
     *   source: 'http://fabricjs.com/assets/escheresque_ste.png',
     *   repeat: 'repeat',
     *   offsetX: 200,
     *   offsetY: 100
     * }, canvas.renderAll.bind(canvas));
     */
    setBackgroundColor: function(backgroundColor, callback) {
      return this.__setBgOverlayColor('backgroundColor', backgroundColor, callback);
    },

    /**
     * @private
     * @see {@link http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html#dom-context-2d-imagesmoothingenabled|WhatWG Canvas Standard}
     */
    _setImageSmoothing: function() {
      var ctx = this.getContext();

      ctx.imageSmoothingEnabled = ctx.imageSmoothingEnabled || ctx.webkitImageSmoothingEnabled
        || ctx.mozImageSmoothingEnabled || ctx.msImageSmoothingEnabled || ctx.oImageSmoothingEnabled;
      ctx.imageSmoothingEnabled = this.imageSmoothingEnabled;
    },

    /**
     * @private
     * @param {String} property Property to set ({@link fabric.StaticCanvas#backgroundImage|backgroundImage}
     * or {@link fabric.StaticCanvas#overlayImage|overlayImage})
     * @param {(fabric.Image|String|null)} image fabric.Image instance, URL of an image or null to set background or overlay to
     * @param {Function} callback Callback to invoke when image is loaded and set as background or overlay
     * @param {Object} [options] Optional options to set for the {@link fabric.Image|image}.
     */
    __setBgOverlayImage: function(property, image, callback, options) {
      if (typeof image === 'string') {
        fabric.util.loadImage(image, function(img) {
          img && (this[property] = new fabric.Image(img, options));
          callback && callback(img);
        }, this, options && options.crossOrigin);
      }
      else {
        options && image.setOptions(options);
        this[property] = image;
        callback && callback(image);
      }

      return this;
    },

    /**
     * @private
     * @param {String} property Property to set ({@link fabric.StaticCanvas#backgroundColor|backgroundColor}
     * or {@link fabric.StaticCanvas#overlayColor|overlayColor})
     * @param {(Object|String|null)} color Object with pattern information, color value or null
     * @param {Function} [callback] Callback is invoked when color is set
     */
    __setBgOverlayColor: function(property, color, callback) {
      if (color && color.source) {
        var _this = this;
        fabric.util.loadImage(color.source, function(img) {
          _this[property] = new fabric.Pattern({
            source: img,
            repeat: color.repeat,
            offsetX: color.offsetX,
            offsetY: color.offsetY
          });
          callback && callback();
        });
      }
      else {
        this[property] = color;
        callback && callback();
      }

      return this;
    },

    /**
     * @private
     */
    _createCanvasElement: function(canvasEl) {
      var element = fabric.util.createCanvasElement(canvasEl)
      if (!element.style) {
        element.style = { };
      }
      if (!element) {
        throw CANVAS_INIT_ERROR;
      }
      if (typeof element.getContext === 'undefined') {
        throw CANVAS_INIT_ERROR;
      }
      return element;
    },

    /**
     * @private
     * @param {Object} [options] Options object
     */
    _initOptions: function (options) {
      for (var prop in options) {
        this[prop] = options[prop];
      }

      this.width = this.width || parseInt(this.lowerCanvasEl.width, 10) || 0;
      this.height = this.height || parseInt(this.lowerCanvasEl.height, 10) || 0;

      if (!this.lowerCanvasEl.style) {
        return;
      }

      this.lowerCanvasEl.width = this.width;
      this.lowerCanvasEl.height = this.height;

      this.lowerCanvasEl.style.width = this.width + 'px';
      this.lowerCanvasEl.style.height = this.height + 'px';

      this.viewportTransform = this.viewportTransform.slice();
    },

    /**
     * Creates a bottom canvas
     * @private
     * @param {HTMLElement} [canvasEl]
     */
    _createLowerCanvas: function (canvasEl) {
      this.lowerCanvasEl = fabric.util.getById(canvasEl) || this._createCanvasElement(canvasEl);

      fabric.util.addClass(this.lowerCanvasEl, 'lower-canvas');

      if (this.interactive) {
        this._applyCanvasStyle(this.lowerCanvasEl);
      }

      this.contextContainer = this.lowerCanvasEl.getContext('2d');
    },

    /**
     * Returns canvas width (in px)
     * @return {Number}
     */
    getWidth: function () {
      return this.width;
    },

    /**
     * Returns canvas height (in px)
     * @return {Number}
     */
    getHeight: function () {
      return this.height;
    },

    /**
     * Sets width of this canvas instance
     * @param {Number|String} value                         Value to set width to
     * @param {Object}        [options]                     Options object
     * @param {Boolean}       [options.backstoreOnly=false] Set the given dimensions only as canvas backstore dimensions
     * @param {Boolean}       [options.cssOnly=false]       Set the given dimensions only as css dimensions
     * @return {fabric.Canvas} instance
     * @chainable true
     */
    setWidth: function (value, options) {
      return this.setDimensions({ width: value }, options);
    },

    /**
     * Sets height of this canvas instance
     * @param {Number|String} value                         Value to set height to
     * @param {Object}        [options]                     Options object
     * @param {Boolean}       [options.backstoreOnly=false] Set the given dimensions only as canvas backstore dimensions
     * @param {Boolean}       [options.cssOnly=false]       Set the given dimensions only as css dimensions
     * @return {fabric.Canvas} instance
     * @chainable true
     */
    setHeight: function (value, options) {
      return this.setDimensions({ height: value }, options);
    },

    /**
     * Sets dimensions (width, height) of this canvas instance. when options.cssOnly flag active you should also supply the unit of measure (px/%/em)
     * @param {Object}        dimensions                    Object with width/height properties
     * @param {Number|String} [dimensions.width]            Width of canvas element
     * @param {Number|String} [dimensions.height]           Height of canvas element
     * @param {Object}        [options]                     Options object
     * @param {Boolean}       [options.backstoreOnly=false] Set the given dimensions only as canvas backstore dimensions
     * @param {Boolean}       [options.cssOnly=false]       Set the given dimensions only as css dimensions
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    setDimensions: function (dimensions, options) {
      var cssValue;

      options = options || {};

      for (var prop in dimensions) {
        cssValue = dimensions[prop];

        if (!options.cssOnly) {
          this._setBackstoreDimension(prop, dimensions[prop]);
          cssValue += 'px';
        }

        if (!options.backstoreOnly) {
          this._setCssDimension(prop, cssValue);
        }
      }
      this._initRetinaScaling();
      this._setImageSmoothing();
      this.calcOffset();

      if (!options.cssOnly) {
        this.renderAll();
      }

      return this;
    },

    /**
     * Helper for setting width/height
     * @private
     * @param {String} prop property (width|height)
     * @param {Number} value value to set property to
     * @return {fabric.Canvas} instance
     * @chainable true
     */
    _setBackstoreDimension: function (prop, value) {
      this.lowerCanvasEl[prop] = value;

      if (this.upperCanvasEl) {
        this.upperCanvasEl[prop] = value;
      }

      if (this.cacheCanvasEl) {
        this.cacheCanvasEl[prop] = value;
      }

      this[prop] = value;

      return this;
    },

    /**
     * Helper for setting css width/height
     * @private
     * @param {String} prop property (width|height)
     * @param {String} value value to set property to
     * @return {fabric.Canvas} instance
     * @chainable true
     */
    _setCssDimension: function (prop, value) {
      this.lowerCanvasEl.style[prop] = value;

      if (this.upperCanvasEl) {
        this.upperCanvasEl.style[prop] = value;
      }

      if (this.wrapperEl) {
        this.wrapperEl.style[prop] = value;
      }

      return this;
    },

    /**
     * Returns canvas zoom level
     * @return {Number}
     */
    getZoom: function () {
      return Math.sqrt(this.viewportTransform[0] * this.viewportTransform[3]);
    },

    /**
     * Sets viewport transform of this canvas instance
     * @param {Array} vpt the transform in the form of context.transform
     * @return {fabric.Canvas} instance
     * @chainable true
     */
    setViewportTransform: function (vpt) {
      var activeGroup = this._activeGroup, object;
      this.viewportTransform = vpt;
      for (var i = 0, len = this._objects.length; i < len; i++) {
        object = this._objects[i];
        object.group || object.setCoords();
      }
      if (activeGroup) {
        activeGroup.setCoords();
      }
      this.renderAll();
      return this;
    },

    /**
     * Sets zoom level of this canvas instance, zoom centered around point
     * @param {fabric.Point} point to zoom with respect to
     * @param {Number} value to set zoom to, less than 1 zooms out
     * @return {fabric.Canvas} instance
     * @chainable true
     */
    zoomToPoint: function (point, value) {
      // TODO: just change the scale, preserve other transformations
      var before = point, vpt = this.viewportTransform.slice(0);
      point = fabric.util.transformPoint(point, fabric.util.invertTransform(this.viewportTransform));
      vpt[0] = value;
      vpt[3] = value;
      var after = fabric.util.transformPoint(point, vpt);
      vpt[4] += before.x - after.x;
      vpt[5] += before.y - after.y;
      return this.setViewportTransform(vpt);
    },

    /**
     * Sets zoom level of this canvas instance
     * @param {Number} value to set zoom to, less than 1 zooms out
     * @return {fabric.Canvas} instance
     * @chainable true
     */
    setZoom: function (value) {
      this.zoomToPoint(new fabric.Point(0, 0), value);
      return this;
    },

    /**
     * Pan viewport so as to place point at top left corner of canvas
     * @param {fabric.Point} point to move to
     * @return {fabric.Canvas} instance
     * @chainable true
     */
    absolutePan: function (point) {
      var vpt = this.viewportTransform.slice(0);
      vpt[4] = -point.x;
      vpt[5] = -point.y;
      return this.setViewportTransform(vpt);
    },

    /**
     * Pans viewpoint relatively
     * @param {fabric.Point} point (position vector) to move by
     * @return {fabric.Canvas} instance
     * @chainable true
     */
    relativePan: function (point) {
      return this.absolutePan(new fabric.Point(
        -point.x - this.viewportTransform[4],
        -point.y - this.viewportTransform[5]
      ));
    },

    /**
     * Returns &lt;canvas> element corresponding to this instance
     * @return {HTMLCanvasElement}
     */
    getElement: function () {
      return this.lowerCanvasEl;
    },

    /**
     * @private
     * @param {fabric.Object} obj Object that was added
     */
    _onObjectAdded: function(obj) {
      this.stateful && obj.setupState();
      obj._set('canvas', this);
      obj.setCoords();
      this.fire('object:added', { target: obj });
      obj.fire('added');
    },

    /**
     * @private
     * @param {fabric.Object} obj Object that was removed
     */
    _onObjectRemoved: function(obj) {
      this.fire('object:removed', { target: obj });
      obj.fire('removed');
      delete obj.canvas;
    },

    /**
     * Clears specified context of canvas element
     * @param {CanvasRenderingContext2D} ctx Context to clear
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    clearContext: function(ctx) {
      ctx.clearRect(0, 0, this.width, this.height);
      return this;
    },

    /**
     * Returns context of canvas where objects are drawn
     * @return {CanvasRenderingContext2D}
     */
    getContext: function () {
      return this.contextContainer;
    },

    /**
     * Clears all contexts (background, main, top) of an instance
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    clear: function () {
      this._objects.length = 0;
      this.backgroundImage = null;
      this.overlayImage = null;
      this.backgroundColor = '';
      this.overlayColor = ''
      if (this._hasITextHandlers) {
        this.off('selection:cleared', this._canvasITextSelectionClearedHanlder);
        this.off('object:selected', this._canvasITextSelectionClearedHanlder);
        this.off('mouse:up', this._mouseUpITextHandler);
        this._iTextInstances = null;
        this._hasITextHandlers = false;
      }
      this.clearContext(this.contextContainer);
      this.fire('canvas:cleared');
      this.renderAll();
      return this;
    },

    /**
     * Renders both the canvas.
     * @return {fabric.Canvas} instance
     * @chainable
     */
    renderAll: function () {
      var canvasToDrawOn = this.contextContainer;
      this.renderCanvas(canvasToDrawOn, this._objects);
      return this;
    },

    /**
     * Renders background, objects, overlay and controls.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} objects to render
     * @return {fabric.Canvas} instance
     * @chainable
     */
    renderCanvas: function(ctx, objects) {
      this.clearContext(ctx);
      this.fire('before:render');
      if (this.clipTo) {
        fabric.util.clipContext(this, ctx);
      }
      this._renderBackground(ctx);

      ctx.save();
      //apply viewport transform once for all rendering process
      ctx.transform.apply(ctx, this.viewportTransform);
      this._renderObjects(ctx, objects);
      ctx.restore();
      if (!this.controlsAboveOverlay && this.interactive) {
        this.drawControls(ctx);
      }
      if (this.clipTo) {
        ctx.restore();
      }
      this._renderOverlay(ctx);
      if (this.controlsAboveOverlay && this.interactive) {
        this.drawControls(ctx);
      }
      this.fire('after:render');
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Array} objects to render
     */
    _renderObjects: function(ctx, objects) {
      for (var i = 0, length = objects.length; i < length; ++i) {
        objects[i] && objects[i].render(ctx);
      }
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {string} property 'background' or 'overlay'
     */
    _renderBackgroundOrOverlay: function(ctx, property) {
      var object = this[property + 'Color'];
      if (object) {
        ctx.fillStyle = object.toLive
          ? object.toLive(ctx)
          : object;

        ctx.fillRect(
          object.offsetX || 0,
          object.offsetY || 0,
          this.width,
          this.height);
      }
      object = this[property + 'Image'];
      if (object) {
        if (this[property + 'Vpt']) {
          ctx.save();
          ctx.transform.apply(ctx, this.viewportTransform);
        }
        object.render(ctx);
        this[property + 'Vpt'] && ctx.restore();
      }
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderBackground: function(ctx) {
      this._renderBackgroundOrOverlay(ctx, 'background');
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderOverlay: function(ctx) {
      this._renderBackgroundOrOverlay(ctx, 'overlay');
    },

    /**
     * Returns coordinates of a center of canvas.
     * Returned value is an object with top and left properties
     * @return {Object} object with "top" and "left" number values
     */
    getCenter: function () {
      return {
        top: this.getHeight() / 2,
        left: this.getWidth() / 2
      };
    },

    /**
     * Centers object horizontally in the canvas
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @param {fabric.Object} object Object to center horizontally
     * @return {fabric.Canvas} thisArg
     */
    centerObjectH: function (object) {
      return this._centerObject(object, new fabric.Point(this.getCenter().left, object.getCenterPoint().y));
    },

    /**
     * Centers object vertically in the canvas
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @param {fabric.Object} object Object to center vertically
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    centerObjectV: function (object) {
      return this._centerObject(object, new fabric.Point(object.getCenterPoint().x, this.getCenter().top));
    },

    /**
     * Centers object vertically and horizontally in the canvas
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @param {fabric.Object} object Object to center vertically and horizontally
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    centerObject: function(object) {
      var center = this.getCenter();

      return this._centerObject(object, new fabric.Point(center.left, center.top));
    },

    /**
     * Centers object vertically and horizontally in the viewport
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @param {fabric.Object} object Object to center vertically and horizontally
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    viewportCenterObject: function(object) {
      var vpCenter = this.getVpCenter();

      return this._centerObject(object, vpCenter);
    },

    /**
     * Centers object horizontally in the viewport, object.top is unchanged
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @param {fabric.Object} object Object to center vertically and horizontally
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    viewportCenterObjectH: function(object) {
      var vpCenter = this.getVpCenter();
      this._centerObject(object, new fabric.Point(vpCenter.x, object.getCenterPoint().y));
      return this;
    },

    /**
     * Centers object Vertically in the viewport, object.top is unchanged
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @param {fabric.Object} object Object to center vertically and horizontally
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    viewportCenterObjectV: function(object) {
      var vpCenter = this.getVpCenter();

      return this._centerObject(object, new fabric.Point(object.getCenterPoint().x, vpCenter.y));
    },

    /**
     * Calculate the point in canvas that correspond to the center of actual viewport.
     * @return {fabric.Point} vpCenter, viewport center
     * @chainable
     */
    getVpCenter: function() {
      var center = this.getCenter(),
          iVpt = fabric.util.invertTransform(this.viewportTransform);
      return fabric.util.transformPoint({ x: center.left, y: center.top }, iVpt);
    },

    /**
     * @private
     * @param {fabric.Object} object Object to center
     * @param {fabric.Point} center Center point
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    _centerObject: function(object, center) {
      object.setPositionByOrigin(center, 'center', 'center');
      this.renderAll();
      return this;
    },

    /**
     * Returs dataless JSON representation of canvas
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {String} json string
     */
    toDatalessJSON: function (propertiesToInclude) {
      return this.toDatalessObject(propertiesToInclude);
    },

    /**
     * Returns object representation of canvas
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} object representation of an instance
     */
    toObject: function (propertiesToInclude) {
      return this._toObjectMethod('toObject', propertiesToInclude);
    },

    /**
     * Returns dataless object representation of canvas
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} object representation of an instance
     */
    toDatalessObject: function (propertiesToInclude) {
      return this._toObjectMethod('toDatalessObject', propertiesToInclude);
    },

    /**
     * @private
     */
    _toObjectMethod: function (methodName, propertiesToInclude) {

      var data = {
        objects: this._toObjects(methodName, propertiesToInclude)
      };

      extend(data, this.__serializeBgOverlay(methodName, propertiesToInclude));

      fabric.util.populateWithProperties(this, data, propertiesToInclude);

      return data;
    },

    /**
     * @private
     */
    _toObjects: function(methodName, propertiesToInclude) {
      return this.getObjects().filter(function(object) {
        return !object.excludeFromExport;
      }).map(function(instance) {
        return this._toObject(instance, methodName, propertiesToInclude);
      }, this);
    },

    /**
     * @private
     */
    _toObject: function(instance, methodName, propertiesToInclude) {
      var originalValue;

      if (!this.includeDefaultValues) {
        originalValue = instance.includeDefaultValues;
        instance.includeDefaultValues = false;
      }

      var object = instance[methodName](propertiesToInclude);
      if (!this.includeDefaultValues) {
        instance.includeDefaultValues = originalValue;
      }
      return object;
    },

    /**
     * @private
     */
    __serializeBgOverlay: function(methodName, propertiesToInclude) {
      var data = {
        background: (this.backgroundColor && this.backgroundColor.toObject)
          ? this.backgroundColor.toObject(propertiesToInclude)
          : this.backgroundColor
      };

      if (this.overlayColor) {
        data.overlay = this.overlayColor.toObject
          ? this.overlayColor.toObject(propertiesToInclude)
          : this.overlayColor;
      }
      if (this.backgroundImage) {
        data.backgroundImage = this._toObject(this.backgroundImage, methodName, propertiesToInclude);
      }
      if (this.overlayImage) {
        data.overlayImage = this._toObject(this.overlayImage, methodName, propertiesToInclude);
      }

      return data;
    },

    /* _TO_SVG_START_ */
    /**
     * When true, getSvgTransform() will apply the StaticCanvas.viewportTransform to the SVG transformation. When true,
     * a zoomed canvas will then produce zoomed SVG output.
     * @type Boolean
     * @default
     */
    svgViewportTransformation: true,

    /**
     * Returns SVG representation of canvas
     * @function
     * @param {Object} [options] Options object for SVG output
     * @param {Boolean} [options.suppressPreamble=false] If true xml tag is not included
     * @param {Object} [options.viewBox] SVG viewbox object
     * @param {Number} [options.viewBox.x] x-cooridnate of viewbox
     * @param {Number} [options.viewBox.y] y-coordinate of viewbox
     * @param {Number} [options.viewBox.width] Width of viewbox
     * @param {Number} [options.viewBox.height] Height of viewbox
     * @param {String} [options.encoding=UTF-8] Encoding of SVG output
     * @param {String} [options.width] desired width of svg with or without units
     * @param {String} [options.height] desired height of svg with or without units
     * @param {Function} [reviver] Method for further parsing of svg elements, called after each fabric object converted into svg representation.
     * @return {String} SVG string
     * @tutorial {@link http://fabricjs.com/fabric-intro-part-3#serialization}
     * @see {@link http://jsfiddle.net/fabricjs/jQ3ZZ/|jsFiddle demo}
     * @example <caption>Normal SVG output</caption>
     * var svg = canvas.toSVG();
     * @example <caption>SVG output without preamble (without &lt;?xml ../>)</caption>
     * var svg = canvas.toSVG({suppressPreamble: true});
     * @example <caption>SVG output with viewBox attribute</caption>
     * var svg = canvas.toSVG({
     *   viewBox: {
     *     x: 100,
     *     y: 100,
     *     width: 200,
     *     height: 300
     *   }
     * });
     * @example <caption>SVG output with different encoding (default: UTF-8)</caption>
     * var svg = canvas.toSVG({encoding: 'ISO-8859-1'});
     * @example <caption>Modify SVG output with reviver function</caption>
     * var svg = canvas.toSVG(null, function(svg) {
     *   return svg.replace('stroke-dasharray: ; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; ', '');
     * });
     */
    toSVG: function(options, reviver) {
      options || (options = { });

      var markup = [];

      this._setSVGPreamble(markup, options);
      this._setSVGHeader(markup, options);

      this._setSVGBgOverlayColor(markup, 'backgroundColor');
      this._setSVGBgOverlayImage(markup, 'backgroundImage', reviver);

      this._setSVGObjects(markup, reviver);

      this._setSVGBgOverlayColor(markup, 'overlayColor');
      this._setSVGBgOverlayImage(markup, 'overlayImage', reviver);

      markup.push('</svg>');

      return markup.join('');
    },

    /**
     * @private
     */
    _setSVGPreamble: function(markup, options) {
      if (options.suppressPreamble) {
        return;
      }
      markup.push(
        '<?xml version="1.0" encoding="', (options.encoding || 'UTF-8'), '" standalone="no" ?>\n',
          '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" ',
            '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
      );
    },

    /**
     * @private
     */
    _setSVGHeader: function(markup, options) {
      var width = options.width || this.width,
          height = options.height || this.height,
          vpt, viewBox = 'viewBox="0 0 ' + this.width + ' ' + this.height + '" ',
          NUM_FRACTION_DIGITS = fabric.Object.NUM_FRACTION_DIGITS;

      if (options.viewBox) {
        viewBox = 'viewBox="' +
                options.viewBox.x + ' ' +
                options.viewBox.y + ' ' +
                options.viewBox.width + ' ' +
                options.viewBox.height + '" ';
      }
      else {
        if (this.svgViewportTransformation) {
          vpt = this.viewportTransform;
          viewBox = 'viewBox="' +
                  toFixed(-vpt[4] / vpt[0], NUM_FRACTION_DIGITS) + ' ' +
                  toFixed(-vpt[5] / vpt[3], NUM_FRACTION_DIGITS) + ' ' +
                  toFixed(this.width / vpt[0], NUM_FRACTION_DIGITS) + ' ' +
                  toFixed(this.height / vpt[3], NUM_FRACTION_DIGITS) + '" ';
        }
      }

      markup.push(
        '<svg ',
          'xmlns="http://www.w3.org/2000/svg" ',
          'xmlns:xlink="http://www.w3.org/1999/xlink" ',
          'version="1.1" ',
          'width="', width, '" ',
          'height="', height, '" ',
          (this.backgroundColor && !this.backgroundColor.toLive
            ? 'style="background-color: ' + this.backgroundColor + '" '
            : null),
          viewBox,
          'xml:space="preserve">\n',
        '<desc>Created with Fabric.js ', fabric.version, '</desc>\n',
        '<defs>',
          fabric.createSVGFontFacesMarkup(this.getObjects()),
          fabric.createSVGRefElementsMarkup(this),
        '</defs>\n'
      );
    },

    /**
     * @private
     */
    _setSVGObjects: function(markup, reviver) {
      var instance;
      for (var i = 0, objects = this.getObjects(), len = objects.length; i < len; i++) {
        instance = objects[i];
        if (instance.excludeFromExport) {
          continue;
        }
        this._setSVGObject(markup, instance, reviver);
      }
    },

    /**
     * push single object svg representation in the markup
     * @private
     */
    _setSVGObject: function(markup, instance, reviver) {
      markup.push(instance.toSVG(reviver));
    },

    /**
     * @private
     */
    _setSVGBgOverlayImage: function(markup, property, reviver) {
      if (this[property] && this[property].toSVG) {
        markup.push(this[property].toSVG(reviver));
      }
    },

    /**
     * @private
     */
    _setSVGBgOverlayColor: function(markup, property) {
      if (this[property] && this[property].source) {
        markup.push(
          '<rect x="', this[property].offsetX, '" y="', this[property].offsetY, '" ',
            'width="',
              (this[property].repeat === 'repeat-y' || this[property].repeat === 'no-repeat'
                ? this[property].source.width
                : this.width),
            '" height="',
              (this[property].repeat === 'repeat-x' || this[property].repeat === 'no-repeat'
                ? this[property].source.height
                : this.height),
            '" fill="url(#' + property + 'Pattern)"',
          '></rect>\n'
        );
      }
      else if (this[property] && property === 'overlayColor') {
        markup.push(
          '<rect x="0" y="0" ',
            'width="', this.width,
            '" height="', this.height,
            '" fill="', this[property], '"',
          '></rect>\n'
        );
      }
    },
    /* _TO_SVG_END_ */

    /**
     * Moves an object or the objects of a multiple selection
     * to the bottom of the stack of drawn objects
     * @param {fabric.Object} object Object to send to back
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    sendToBack: function (object) {
      if (!object) {
        return this;
      }
      var activeGroup = this._activeGroup,
          i, obj, objs;
      if (object === activeGroup) {
        objs = activeGroup._objects;
        for (i = objs.length; i--;) {
          obj = objs[i];
          removeFromArray(this._objects, obj);
          this._objects.unshift(obj);
        }
      }
      else {
        removeFromArray(this._objects, object);
        this._objects.unshift(object);
      }
      return this.renderAll && this.renderAll();
    },

    /**
     * Moves an object or the objects of a multiple selection
     * to the top of the stack of drawn objects
     * @param {fabric.Object} object Object to send
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    bringToFront: function (object) {
      if (!object) {
        return this;
      }
      var activeGroup = this._activeGroup,
          i, obj, objs;
      if (object === activeGroup) {
        objs = activeGroup._objects;
        for (i = 0; i < objs.length; i++) {
          obj = objs[i];
          removeFromArray(this._objects, obj);
          this._objects.push(obj);
        }
      }
      else {
        removeFromArray(this._objects, object);
        this._objects.push(object);
      }
      return this.renderAll && this.renderAll();
    },

    /**
     * Moves an object or a selection down in stack of drawn objects
     * @param {fabric.Object} object Object to send
     * @param {Boolean} [intersecting] If `true`, send object behind next lower intersecting object
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    sendBackwards: function (object, intersecting) {
      if (!object) {
        return this;
      }
      var activeGroup = this._activeGroup,
          i, obj, idx, newIdx, objs;

      if (object === activeGroup) {
        objs = activeGroup._objects;
        for (i = 0; i < objs.length; i++) {
          obj = objs[i];
          idx = this._objects.indexOf(obj);
          if (idx !== 0) {
            newIdx = idx - 1;
            removeFromArray(this._objects, obj);
            this._objects.splice(newIdx, 0, obj);
          }
        }
      }
      else {
        idx = this._objects.indexOf(object);
        if (idx !== 0) {
          // if object is not on the bottom of stack
          newIdx = this._findNewLowerIndex(object, idx, intersecting);
          removeFromArray(this._objects, object);
          this._objects.splice(newIdx, 0, object);
        }
      }
      this.renderAll && this.renderAll();
      return this;
    },

    /**
     * @private
     */
    _findNewLowerIndex: function(object, idx, intersecting) {
      var newIdx;

      if (intersecting) {
        newIdx = idx;

        // traverse down the stack looking for the nearest intersecting object
        for (var i = idx - 1; i >= 0; --i) {

          var isIntersecting = object.intersectsWithObject(this._objects[i]) ||
                               object.isContainedWithinObject(this._objects[i]) ||
                               this._objects[i].isContainedWithinObject(object);

          if (isIntersecting) {
            newIdx = i;
            break;
          }
        }
      }
      else {
        newIdx = idx - 1;
      }

      return newIdx;
    },

    /**
     * Moves an object or a selection up in stack of drawn objects
     * @param {fabric.Object} object Object to send
     * @param {Boolean} [intersecting] If `true`, send object in front of next upper intersecting object
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    bringForward: function (object, intersecting) {
      if (!object) {
        return this;
      }
      var activeGroup = this._activeGroup,
          i, obj, idx, newIdx, objs;

      if (object === activeGroup) {
        objs = activeGroup._objects;
        for (i = objs.length; i--;) {
          obj = objs[i];
          idx = this._objects.indexOf(obj);
          if (idx !== this._objects.length - 1) {
            newIdx = idx + 1;
            removeFromArray(this._objects, obj);
            this._objects.splice(newIdx, 0, obj);
          }
        }
      }
      else {
        idx = this._objects.indexOf(object);
        if (idx !== this._objects.length - 1) {
          // if object is not on top of stack (last item in an array)
          newIdx = this._findNewUpperIndex(object, idx, intersecting);
          removeFromArray(this._objects, object);
          this._objects.splice(newIdx, 0, object);
        }
      }
      this.renderAll && this.renderAll();
      return this;
    },

    /**
     * @private
     */
    _findNewUpperIndex: function(object, idx, intersecting) {
      var newIdx;

      if (intersecting) {
        newIdx = idx;

        // traverse up the stack looking for the nearest intersecting object
        for (var i = idx + 1; i < this._objects.length; ++i) {

          var isIntersecting = object.intersectsWithObject(this._objects[i]) ||
                               object.isContainedWithinObject(this._objects[i]) ||
                               this._objects[i].isContainedWithinObject(object);

          if (isIntersecting) {
            newIdx = i;
            break;
          }
        }
      }
      else {
        newIdx = idx + 1;
      }

      return newIdx;
    },

    /**
     * Moves an object to specified level in stack of drawn objects
     * @param {fabric.Object} object Object to send
     * @param {Number} index Position to move to
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    moveTo: function (object, index) {
      removeFromArray(this._objects, object);
      this._objects.splice(index, 0, object);
      return this.renderAll && this.renderAll();
    },

    /**
     * Clears a canvas element and removes all event listeners
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    dispose: function () {
      this.clear();
      return this;
    },

    /**
     * Returns a string representation of an instance
     * @return {String} string representation of an instance
     */
    toString: function () {
      return '#<fabric.Canvas (' + this.complexity() + '): ' +
               '{ objects: ' + this.getObjects().length + ' }>';
    }
  });

  extend(fabric.StaticCanvas.prototype, fabric.Observable);
  extend(fabric.StaticCanvas.prototype, fabric.Collection);
  extend(fabric.StaticCanvas.prototype, fabric.DataURLExporter);

  extend(fabric.StaticCanvas, /** @lends fabric.StaticCanvas */ {

    /**
     * @static
     * @type String
     * @default
     */
    EMPTY_JSON: '{"objects": [], "background": "white"}',

    /**
     * Provides a way to check support of some of the canvas methods
     * (either those of HTMLCanvasElement itself, or rendering context)
     *
     * @param {String} methodName Method to check support for;
     *                            Could be one of "getImageData", "toDataURL", "toDataURLWithQuality" or "setLineDash"
     * @return {Boolean | null} `true` if method is supported (or at least exists),
     *                          `null` if canvas element or context can not be initialized
     */
    supports: function (methodName) {
      var el = fabric.util.createCanvasElement();

      if (!el || !el.getContext) {
        return null;
      }

      var ctx = el.getContext('2d');
      if (!ctx) {
        return null;
      }

      switch (methodName) {

        case 'getImageData':
          return typeof ctx.getImageData !== 'undefined';

        case 'setLineDash':
          return typeof ctx.setLineDash !== 'undefined';

        case 'toDataURL':
          return typeof el.toDataURL !== 'undefined';

        case 'toDataURLWithQuality':
          try {
            el.toDataURL('image/jpeg', 0);
            return true;
          }
          catch (e) { }
          return false;

        default:
          return null;
      }
    }
  });

  /**
   * Returns JSON representation of canvas
   * @function
   * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
   * @return {String} JSON string
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-3#serialization}
   * @see {@link http://jsfiddle.net/fabricjs/pec86/|jsFiddle demo}
   * @example <caption>JSON without additional properties</caption>
   * var json = canvas.toJSON();
   * @example <caption>JSON with additional properties included</caption>
   * var json = canvas.toJSON(['lockMovementX', 'lockMovementY', 'lockRotation', 'lockScalingX', 'lockScalingY', 'lockUniScaling']);
   * @example <caption>JSON without default values</caption>
   * canvas.includeDefaultValues = false;
   * var json = canvas.toJSON();
   */
  fabric.StaticCanvas.prototype.toJSON = fabric.StaticCanvas.prototype.toObject;

})();


/**
 * BaseBrush class
 * @class fabric.BaseBrush
 * @see {@link http://fabricjs.com/freedrawing|Freedrawing demo}
 */
fabric.BaseBrush = fabric.util.createClass(/** @lends fabric.BaseBrush.prototype */ {

  /**
   * Color of a brush
   * @type String
   * @default
   */
  color: 'rgb(0, 0, 0)',

  /**
   * Width of a brush
   * @type Number
   * @default
   */
  width: 1,

  /**
   * Shadow object representing shadow of this shape.
   * <b>Backwards incompatibility note:</b> This property replaces "shadowColor" (String), "shadowOffsetX" (Number),
   * "shadowOffsetY" (Number) and "shadowBlur" (Number) since v1.2.12
   * @type fabric.Shadow
   * @default
   */
  shadow: null,

  /**
   * Line endings style of a brush (one of "butt", "round", "square")
   * @type String
   * @default
   */
  strokeLineCap: 'round',

  /**
   * Corner style of a brush (one of "bevil", "round", "miter")
   * @type String
   * @default
   */
  strokeLineJoin: 'round',

  /**
   * Stroke Dash Array.
   * @type Array
   * @default
   */
  strokeDashArray: null,

  /**
   * Sets shadow of an object
   * @param {Object|String} [options] Options object or string (e.g. "2px 2px 10px rgba(0,0,0,0.2)")
   * @return {fabric.Object} thisArg
   * @chainable
   */
  setShadow: function(options) {
    this.shadow = new fabric.Shadow(options);
    return this;
  },

  /**
   * Sets brush styles
   * @private
   */
  _setBrushStyles: function() {
    var ctx = this.canvas.contextTop;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.lineCap = this.strokeLineCap;
    ctx.lineJoin = this.strokeLineJoin;
    if (this.strokeDashArray && fabric.StaticCanvas.supports('setLineDash')) {
      ctx.setLineDash(this.strokeDashArray);
    }
  },

  /**
   * Sets brush shadow styles
   * @private
   */
  _setShadow: function() {
    if (!this.shadow) {
      return;
    }

    var ctx = this.canvas.contextTop;

    ctx.shadowColor = this.shadow.color;
    ctx.shadowBlur = this.shadow.blur;
    ctx.shadowOffsetX = this.shadow.offsetX;
    ctx.shadowOffsetY = this.shadow.offsetY;
  },

  /**
   * Removes brush shadow styles
   * @private
   */
  _resetShadow: function() {
    var ctx = this.canvas.contextTop;

    ctx.shadowColor = '';
    ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
  }
});


(function() {

  /**
   * PencilBrush class
   * @class fabric.PencilBrush
   * @extends fabric.BaseBrush
   */
  fabric.PencilBrush = fabric.util.createClass(fabric.BaseBrush, /** @lends fabric.PencilBrush.prototype */ {

    /**
     * Constructor
     * @param {fabric.Canvas} canvas
     * @return {fabric.PencilBrush} Instance of a pencil brush
     */
    initialize: function(canvas) {
      this.canvas = canvas;
      this._points = [];
    },

    /**
     * Inovoked on mouse down
     * @param {Object} pointer
     */
    onMouseDown: function(pointer) {
      this._prepareForDrawing(pointer);
      // capture coordinates immediately
      // this allows to draw dots (when movement never occurs)
      this._captureDrawingPath(pointer);
      this._render();
    },

    /**
     * Inovoked on mouse move
     * @param {Object} pointer
     */
    onMouseMove: function(pointer) {
      this._captureDrawingPath(pointer);
      // redraw curve
      // clear top canvas
      this.canvas.clearContext(this.canvas.contextTop);
      this._render();
    },

    /**
     * Invoked on mouse up
     */
    onMouseUp: function() {
      this._finalizeAndAddPath();
    },

    /**
     * @private
     * @param {Object} pointer Actual mouse position related to the canvas.
     */
    _prepareForDrawing: function(pointer) {

      var p = new fabric.Point(pointer.x, pointer.y);

      this._reset();
      this._addPoint(p);

      this.canvas.contextTop.moveTo(p.x, p.y);
    },

    /**
     * @private
     * @param {fabric.Point} point Point to be added to points array
     */
    _addPoint: function(point) {
      this._points.push(point);
    },

    /**
     * Clear points array and set contextTop canvas style.
     * @private
     */
    _reset: function() {
      this._points.length = 0;

      this._setBrushStyles();
      this._setShadow();
    },

    /**
     * @private
     * @param {Object} pointer Actual mouse position related to the canvas.
     */
    _captureDrawingPath: function(pointer) {
      var pointerPoint = new fabric.Point(pointer.x, pointer.y);
      this._addPoint(pointerPoint);
    },

    /**
     * Draw a smooth path on the topCanvas using quadraticCurveTo
     * @private
     */
    _render: function() {
      var ctx  = this.canvas.contextTop,
          v = this.canvas.viewportTransform,
          p1 = this._points[0],
          p2 = this._points[1];

      ctx.save();
      ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
      ctx.beginPath();

      //if we only have 2 points in the path and they are the same
      //it means that the user only clicked the canvas without moving the mouse
      //then we should be drawing a dot. A path isn't drawn between two identical dots
      //that's why we set them apart a bit
      if (this._points.length === 2 && p1.x === p2.x && p1.y === p2.y) {
        p1.x -= 0.5;
        p2.x += 0.5;
      }
      ctx.moveTo(p1.x, p1.y);

      for (var i = 1, len = this._points.length; i < len; i++) {
        // we pick the point between pi + 1 & pi + 2 as the
        // end point and p1 as our control point.
        var midPoint = p1.midPointFrom(p2);
        ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);

        p1 = this._points[i];
        p2 = this._points[i + 1];
      }
      // Draw last line as a straight line while
      // we wait for the next point to be able to calculate
      // the bezier control point
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.restore();
    },

    /**
     * Converts points to SVG path
     * @param {Array} points Array of points
     * @return {String} SVG path
     */
    convertPointsToSVGPath: function(points) {
      var path = [],
          p1 = new fabric.Point(points[0].x, points[0].y),
          p2 = new fabric.Point(points[1].x, points[1].y);

      path.push('M ', points[0].x, ' ', points[0].y, ' ');
      for (var i = 1, len = points.length; i < len; i++) {
        var midPoint = p1.midPointFrom(p2);
        // p1 is our bezier control point
        // midpoint is our endpoint
        // start point is p(i-1) value.
        path.push('Q ', p1.x, ' ', p1.y, ' ', midPoint.x, ' ', midPoint.y, ' ');
        p1 = new fabric.Point(points[i].x, points[i].y);
        if ((i + 1) < points.length) {
          p2 = new fabric.Point(points[i + 1].x, points[i + 1].y);
        }
      }
      path.push('L ', p1.x, ' ', p1.y, ' ');
      return path;
    },

    /**
     * Creates fabric.Path object to add on canvas
     * @param {String} pathData Path data
     * @return {fabric.Path} Path to add on canvas
     */
    createPath: function(pathData) {
      var path = new fabric.Path(pathData, {
        fill: null,
        stroke: this.color,
        strokeWidth: this.width,
        strokeLineCap: this.strokeLineCap,
        strokeLineJoin: this.strokeLineJoin,
        strokeDashArray: this.strokeDashArray,
        originX: 'center',
        originY: 'center'
      });

      if (this.shadow) {
        this.shadow.affectStroke = true;
        path.setShadow(this.shadow);
      }

      return path;
    },

    /**
     * On mouseup after drawing the path on contextTop canvas
     * we use the points captured to create an new fabric path object
     * and add it to the fabric canvas.
     */
    _finalizeAndAddPath: function() {
      var ctx = this.canvas.contextTop;
      ctx.closePath();

      var pathData = this.convertPointsToSVGPath(this._points).join('');
      if (pathData === 'M 0 0 Q 0 0 0 0 L 0 0') {
        // do not create 0 width/height paths, as they are
        // rendered inconsistently across browsers
        // Firefox 4, for example, renders a dot,
        // whereas Chrome 10 renders nothing
        this.canvas.renderAll();
        return;
      }

      var path = this.createPath(pathData);

      this.canvas.add(path);
      path.setCoords();

      this.canvas.clearContext(this.canvas.contextTop);
      this._resetShadow();
      this.canvas.renderAll();

      // fire event 'path' created
      this.canvas.fire('path:created', { path: path });
    }
  });
})();


/**
 * CircleBrush class
 * @class fabric.CircleBrush
 */
fabric.CircleBrush = fabric.util.createClass(fabric.BaseBrush, /** @lends fabric.CircleBrush.prototype */ {

  /**
   * Width of a brush
   * @type Number
   * @default
   */
  width: 10,

  /**
   * Constructor
   * @param {fabric.Canvas} canvas
   * @return {fabric.CircleBrush} Instance of a circle brush
   */
  initialize: function(canvas) {
    this.canvas = canvas;
    this.points = [];
  },

  /**
   * Invoked inside on mouse down and mouse move
   * @param {Object} pointer
   */
  drawDot: function(pointer) {
    var point = this.addPoint(pointer),
        ctx = this.canvas.contextTop,
        v = this.canvas.viewportTransform;
    ctx.save();
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);

    ctx.fillStyle = point.fill;
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },

  /**
   * Invoked on mouse down
   */
  onMouseDown: function(pointer) {
    this.points.length = 0;
    this.canvas.clearContext(this.canvas.contextTop);
    this._setShadow();
    this.drawDot(pointer);
  },

  /**
   * Invoked on mouse move
   * @param {Object} pointer
   */
  onMouseMove: function(pointer) {
    this.drawDot(pointer);
  },

  /**
   * Invoked on mouse up
   */
  onMouseUp: function() {
    var originalRenderOnAddRemove = this.canvas.renderOnAddRemove;
    this.canvas.renderOnAddRemove = false;

    var circles = [];

    for (var i = 0, len = this.points.length; i < len; i++) {
      var point = this.points[i],
          circle = new fabric.Circle({
            radius: point.radius,
            left: point.x,
            top: point.y,
            originX: 'center',
            originY: 'center',
            fill: point.fill
          });

      this.shadow && circle.setShadow(this.shadow);

      circles.push(circle);
    }
    var group = new fabric.Group(circles, { originX: 'center', originY: 'center' });
    group.canvas = this.canvas;

    this.canvas.add(group);
    this.canvas.fire('path:created', { path: group });

    this.canvas.clearContext(this.canvas.contextTop);
    this._resetShadow();
    this.canvas.renderOnAddRemove = originalRenderOnAddRemove;
    this.canvas.renderAll();
  },

  /**
   * @param {Object} pointer
   * @return {fabric.Point} Just added pointer point
   */
  addPoint: function(pointer) {
    var pointerPoint = new fabric.Point(pointer.x, pointer.y),

        circleRadius = fabric.util.getRandomInt(
                        Math.max(0, this.width - 20), this.width + 20) / 2,

        circleColor = new fabric.Color(this.color)
                        .setAlpha(fabric.util.getRandomInt(0, 100) / 100)
                        .toRgba();

    pointerPoint.radius = circleRadius;
    pointerPoint.fill = circleColor;

    this.points.push(pointerPoint);

    return pointerPoint;
  }
});


/**
 * SprayBrush class
 * @class fabric.SprayBrush
 */
fabric.SprayBrush = fabric.util.createClass( fabric.BaseBrush, /** @lends fabric.SprayBrush.prototype */ {

  /**
   * Width of a spray
   * @type Number
   * @default
   */
  width:              10,

  /**
   * Density of a spray (number of dots per chunk)
   * @type Number
   * @default
   */
  density:            20,

  /**
   * Width of spray dots
   * @type Number
   * @default
   */
  dotWidth:           1,

  /**
   * Width variance of spray dots
   * @type Number
   * @default
   */
  dotWidthVariance:   1,

  /**
   * Whether opacity of a dot should be random
   * @type Boolean
   * @default
   */
  randomOpacity:        false,

  /**
   * Whether overlapping dots (rectangles) should be removed (for performance reasons)
   * @type Boolean
   * @default
   */
  optimizeOverlapping:  true,

  /**
   * Constructor
   * @param {fabric.Canvas} canvas
   * @return {fabric.SprayBrush} Instance of a spray brush
   */
  initialize: function(canvas) {
    this.canvas = canvas;
    this.sprayChunks = [];
  },

  /**
   * Invoked on mouse down
   * @param {Object} pointer
   */
  onMouseDown: function(pointer) {
    this.sprayChunks.length = 0;
    this.canvas.clearContext(this.canvas.contextTop);
    this._setShadow();

    this.addSprayChunk(pointer);
    this.render();
  },

  /**
   * Invoked on mouse move
   * @param {Object} pointer
   */
  onMouseMove: function(pointer) {
    this.addSprayChunk(pointer);
    this.render();
  },

  /**
   * Invoked on mouse up
   */
  onMouseUp: function() {
    var originalRenderOnAddRemove = this.canvas.renderOnAddRemove;
    this.canvas.renderOnAddRemove = false;

    var rects = [];

    for (var i = 0, ilen = this.sprayChunks.length; i < ilen; i++) {
      var sprayChunk = this.sprayChunks[i];

      for (var j = 0, jlen = sprayChunk.length; j < jlen; j++) {

        var rect = new fabric.Rect({
          width: sprayChunk[j].width,
          height: sprayChunk[j].width,
          left: sprayChunk[j].x + 1,
          top: sprayChunk[j].y + 1,
          originX: 'center',
          originY: 'center',
          fill: this.color
        });

        this.shadow && rect.setShadow(this.shadow);
        rects.push(rect);
      }
    }

    if (this.optimizeOverlapping) {
      rects = this._getOptimizedRects(rects);
    }

    var group = new fabric.Group(rects, { originX: 'center', originY: 'center' });
    group.canvas = this.canvas;

    this.canvas.add(group);
    this.canvas.fire('path:created', { path: group });

    this.canvas.clearContext(this.canvas.contextTop);
    this._resetShadow();
    this.canvas.renderOnAddRemove = originalRenderOnAddRemove;
    this.canvas.renderAll();
  },

  /**
   * @private
   * @param {Array} rects
   */
  _getOptimizedRects: function(rects) {

    // avoid creating duplicate rects at the same coordinates
    var uniqueRects = { }, key;

    for (var i = 0, len = rects.length; i < len; i++) {
      key = rects[i].left + '' + rects[i].top;
      if (!uniqueRects[key]) {
        uniqueRects[key] = rects[i];
      }
    }
    var uniqueRectsArray = [];
    for (key in uniqueRects) {
      uniqueRectsArray.push(uniqueRects[key]);
    }

    return uniqueRectsArray;
  },

  /**
   * Renders brush
   */
  render: function() {
    var ctx = this.canvas.contextTop;
    ctx.fillStyle = this.color;

    var v = this.canvas.viewportTransform;
    ctx.save();
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);

    for (var i = 0, len = this.sprayChunkPoints.length; i < len; i++) {
      var point = this.sprayChunkPoints[i];
      if (typeof point.opacity !== 'undefined') {
        ctx.globalAlpha = point.opacity;
      }
      ctx.fillRect(point.x, point.y, point.width, point.width);
    }
    ctx.restore();
  },

  /**
   * @param {Object} pointer
   */
  addSprayChunk: function(pointer) {
    this.sprayChunkPoints = [];

    var x, y, width, radius = this.width / 2;

    for (var i = 0; i < this.density; i++) {

      x = fabric.util.getRandomInt(pointer.x - radius, pointer.x + radius);
      y = fabric.util.getRandomInt(pointer.y - radius, pointer.y + radius);

      if (this.dotWidthVariance) {
        width = fabric.util.getRandomInt(
          // bottom clamp width to 1
          Math.max(1, this.dotWidth - this.dotWidthVariance),
          this.dotWidth + this.dotWidthVariance);
      }
      else {
        width = this.dotWidth;
      }

      var point = new fabric.Point(x, y);
      point.width = width;

      if (this.randomOpacity) {
        point.opacity = fabric.util.getRandomInt(0, 100) / 100;
      }

      this.sprayChunkPoints.push(point);
    }

    this.sprayChunks.push(this.sprayChunkPoints);
  }
});


/**
 * PatternBrush class
 * @class fabric.PatternBrush
 * @extends fabric.BaseBrush
 */
fabric.PatternBrush = fabric.util.createClass(fabric.PencilBrush, /** @lends fabric.PatternBrush.prototype */ {

  getPatternSrc: function() {

    var dotWidth = 20,
        dotDistance = 5,
        patternCanvas = fabric.document.createElement('canvas'),
        patternCtx = patternCanvas.getContext('2d');

    patternCanvas.width = patternCanvas.height = dotWidth + dotDistance;

    patternCtx.fillStyle = this.color;
    patternCtx.beginPath();
    patternCtx.arc(dotWidth / 2, dotWidth / 2, dotWidth / 2, 0, Math.PI * 2, false);
    patternCtx.closePath();
    patternCtx.fill();

    return patternCanvas;
  },

  getPatternSrcFunction: function() {
    return String(this.getPatternSrc).replace('this.color', '"' + this.color + '"');
  },

  /**
   * Creates "pattern" instance property
   */
  getPattern: function() {
    return this.canvas.contextTop.createPattern(this.source || this.getPatternSrc(), 'repeat');
  },

  /**
   * Sets brush styles
   */
  _setBrushStyles: function() {
    this.callSuper('_setBrushStyles');
    this.canvas.contextTop.strokeStyle = this.getPattern();
  },

  /**
   * Creates path
   */
  createPath: function(pathData) {
    var path = this.callSuper('createPath', pathData),
        topLeft = path._getLeftTopCoords().scalarAdd(path.strokeWidth / 2);

    path.stroke = new fabric.Pattern({
      source: this.source || this.getPatternSrcFunction(),
      offsetX: -topLeft.x,
      offsetY: -topLeft.y
    });
    return path;
  }
});


(function() {

  var getPointer = fabric.util.getPointer,
      degreesToRadians = fabric.util.degreesToRadians,
      radiansToDegrees = fabric.util.radiansToDegrees,
      atan2 = Math.atan2,
      abs = Math.abs,
      supportLineDash = fabric.StaticCanvas.supports('setLineDash'),

      STROKE_OFFSET = 0.5;

  /**
   * Canvas class
   * @class fabric.Canvas
   * @extends fabric.StaticCanvas
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-1#canvas}
   * @see {@link fabric.Canvas#initialize} for constructor definition
   *
   * @fires object:added
   * @fires object:modified
   * @fires object:rotating
   * @fires object:scaling
   * @fires object:moving
   * @fires object:selected
   *
   * @fires before:selection:cleared
   * @fires selection:cleared
   * @fires selection:created
   *
   * @fires path:created
   * @fires mouse:down
   * @fires mouse:move
   * @fires mouse:up
   * @fires mouse:over
   * @fires mouse:out
   *
   */
  fabric.Canvas = fabric.util.createClass(fabric.StaticCanvas, /** @lends fabric.Canvas.prototype */ {

    /**
     * Constructor
     * @param {HTMLElement | String} el &lt;canvas> element to initialize instance on
     * @param {Object} [options] Options object
     * @return {Object} thisArg
     */
    initialize: function(el, options) {
      options || (options = { });

      this._initStatic(el, options);
      this._initInteractive();
      this._createCacheCanvas();
    },

    /**
     * When true, objects can be transformed by one side (unproportionally)
     * @type Boolean
     * @default
     */
    uniScaleTransform:      false,

    /**
     * Indicates which key enable unproportional scaling
     * values: 'altKey', 'shiftKey', 'ctrlKey'.
     * If `null` or 'none' or any other string that is not a modifier key
     * feature is disabled feature disabled.
     * @since 1.6.2
     * @type String
     * @default
     */
    uniScaleKey:           'shiftKey',

    /**
     * When true, objects use center point as the origin of scale transformation.
     * <b>Backwards incompatibility note:</b> This property replaces "centerTransform" (Boolean).
     * @since 1.3.4
     * @type Boolean
     * @default
     */
    centeredScaling:        false,

    /**
     * When true, objects use center point as the origin of rotate transformation.
     * <b>Backwards incompatibility note:</b> This property replaces "centerTransform" (Boolean).
     * @since 1.3.4
     * @type Boolean
     * @default
     */
    centeredRotation:       false,

    /**
     * Indicates which key enable centered Transfrom
     * values: 'altKey', 'shiftKey', 'ctrlKey'.
     * If `null` or 'none' or any other string that is not a modifier key
     * feature is disabled feature disabled.
     * @since 1.6.2
     * @type String
     * @default
     */
    centeredKey:           'altKey',

    /**
     * Indicates which key enable alternate action on corner
     * values: 'altKey', 'shiftKey', 'ctrlKey'.
     * If `null` or 'none' or any other string that is not a modifier key
     * feature is disabled feature disabled.
     * @since 1.6.2
     * @type String
     * @default
     */
    altActionKey:           'shiftKey',

    /**
     * Indicates that canvas is interactive. This property should not be changed.
     * @type Boolean
     * @default
     */
    interactive:            true,

    /**
     * Indicates whether group selection should be enabled
     * @type Boolean
     * @default
     */
    selection:              true,

    /**
     * Indicates which key enable multiple click selection
     * values: 'altKey', 'shiftKey', 'ctrlKey'.
     * If `null` or 'none' or any other string that is not a modifier key
     * feature is disabled feature disabled.
     * @since 1.6.2
     * @type String
     * @default
     */
    selectionKey:           'shiftKey',

    /**
     * Indicates which key enable alternative selection
     * in case of target overlapping with active object
     * values: 'altKey', 'shiftKey', 'ctrlKey'.
     * If `null` or 'none' or any other string that is not a modifier key
     * feature is disabled feature disabled.
     * @since 1.6.5
     * @type null|String
     * @default
     */
    altSelectionKey:           null,

    /**
     * Color of selection
     * @type String
     * @default
     */
    selectionColor:         'rgba(100, 100, 255, 0.3)', // blue

    /**
     * Default dash array pattern
     * If not empty the selection border is dashed
     * @type Array
     */
    selectionDashArray:     [],

    /**
     * Color of the border of selection (usually slightly darker than color of selection itself)
     * @type String
     * @default
     */
    selectionBorderColor:   'rgba(255, 255, 255, 0.3)',

    /**
     * Width of a line used in object/group selection
     * @type Number
     * @default
     */
    selectionLineWidth:     1,

    /**
     * Default cursor value used when hovering over an object on canvas
     * @type String
     * @default
     */
    hoverCursor:            'move',

    /**
     * Default cursor value used when moving an object on canvas
     * @type String
     * @default
     */
    moveCursor:             'move',

    /**
     * Default cursor value used for the entire canvas
     * @type String
     * @default
     */
    defaultCursor:          'default',

    /**
     * Cursor value used during free drawing
     * @type String
     * @default
     */
    freeDrawingCursor:      'crosshair',

    /**
     * Cursor value used for rotation point
     * @type String
     * @default
     */
    rotationCursor:         'crosshair',

    /**
     * Default element class that's given to wrapper (div) element of canvas
     * @type String
     * @default
     */
    containerClass:         'canvas-container',

    /**
     * When true, object detection happens on per-pixel basis rather than on per-bounding-box
     * @type Boolean
     * @default
     */
    perPixelTargetFind:     false,

    /**
     * Number of pixels around target pixel to tolerate (consider active) during object detection
     * @type Number
     * @default
     */
    targetFindTolerance:    0,

    /**
     * When true, target detection is skipped when hovering over canvas. This can be used to improve performance.
     * @type Boolean
     * @default
     */
    skipTargetFind:         false,

    /**
     * When true, mouse events on canvas (mousedown/mousemove/mouseup) result in free drawing.
     * After mousedown, mousemove creates a shape,
     * and then mouseup finalizes it and adds an instance of `fabric.Path` onto canvas.
     * @tutorial {@link http://fabricjs.com/fabric-intro-part-4#free_drawing}
     * @type Boolean
     * @default
     */
    isDrawingMode:          false,

    /**
     * Indicates whether objects should remain in current stack position when selected.
     * When false objects are brought to top and rendered as part of the selection group
     * @type Boolean
     * @default
     */
    preserveObjectStacking: false,

    /**
     * Indicates the angle that an object will lock to while rotating.
     * @type Number
     * @since 1.6.7
     * @default
     */
    snapAngle: 0,

    /**
     * Indicates the distance from the snapAngle the rotation will lock to the snapAngle.
     * When `null`, the snapThreshold will default to the snapAngle.
     * @type null|Number
     * @since 1.6.7
     * @default
     */
    snapThreshold: null,

    /**
     * Indicates if the right click on canvas can output the context menu or not
     * @type Boolean
     * @since 1.6.5
     * @default
     */
    stopContextMenu: false,

    /**
     * Indicates if the canvas can fire right click events
     * @type Boolean
     * @since 1.6.5
     * @default
     */
    fireRightClick: false,

    /**
     * @private
     */
    _initInteractive: function() {
      this._currentTransform = null;
      this._groupSelector = null;
      this._initWrapperElement();
      this._createUpperCanvas();
      this._initEventListeners();

      this._initRetinaScaling();

      this.freeDrawingBrush = fabric.PencilBrush && new fabric.PencilBrush(this);

      this.calcOffset();
    },

    /**
     * Divides objects in two groups, one to render immediately
     * and one to render as activeGroup.
     * @return {Array} objects to render immediately and pushes the other in the activeGroup.
     */
    _chooseObjectsToRender: function() {
      var activeGroup = this.getActiveGroup(),
          activeObject = this.getActiveObject(),
          object, objsToRender = [], activeGroupObjects = [];

      if ((activeGroup || activeObject) && !this.preserveObjectStacking) {
        for (var i = 0, length = this._objects.length; i < length; i++) {
          object = this._objects[i];
          if ((!activeGroup || !activeGroup.contains(object)) && object !== activeObject) {
            objsToRender.push(object);
          }
          else {
            activeGroupObjects.push(object);
          }
        }
        if (activeGroup) {
          activeGroup._set('_objects', activeGroupObjects);
          objsToRender.push(activeGroup);
        }
        activeObject && objsToRender.push(activeObject);
      }
      else {
        objsToRender = this._objects;
      }
      return objsToRender;
    },

    /**
     * Renders both the top canvas and the secondary container canvas.
     * @return {fabric.Canvas} instance
     * @chainable
     */
    renderAll: function () {
      if (this.contextTopDirty && !this._groupSelector && !this.isDrawingMode) {
        this.clearContext(this.contextTop);
        this.contextTopDirty = false;
      }
      var canvasToDrawOn = this.contextContainer;
      this.renderCanvas(canvasToDrawOn, this._chooseObjectsToRender());
      return this;
    },

    /**
     * Method to render only the top canvas.
     * Also used to render the group selection box.
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    renderTop: function () {
      var ctx = this.contextTop;
      this.clearContext(ctx);

      // we render the top context - last object
      if (this.selection && this._groupSelector) {
        this._drawSelection(ctx);
      }

      this.fire('after:render');
      this.contextTopDirty = true;
      return this;
    },

    /**
     * Resets the current transform to its original values and chooses the type of resizing based on the event
     * @private
     */
    _resetCurrentTransform: function() {
      var t = this._currentTransform;

      t.target.set({
        scaleX: t.original.scaleX,
        scaleY: t.original.scaleY,
        skewX: t.original.skewX,
        skewY: t.original.skewY,
        left: t.original.left,
        top: t.original.top
      });

      if (this._shouldCenterTransform(t.target)) {
        if (t.action === 'rotate') {
          this._setOriginToCenter(t.target);
        }
        else {
          if (t.originX !== 'center') {
            if (t.originX === 'right') {
              t.mouseXSign = -1;
            }
            else {
              t.mouseXSign = 1;
            }
          }
          if (t.originY !== 'center') {
            if (t.originY === 'bottom') {
              t.mouseYSign = -1;
            }
            else {
              t.mouseYSign = 1;
            }
          }

          t.originX = 'center';
          t.originY = 'center';
        }
      }
      else {
        t.originX = t.original.originX;
        t.originY = t.original.originY;
      }
    },

    /**
     * Checks if point is contained within an area of given object
     * @param {Event} e Event object
     * @param {fabric.Object} target Object to test against
     * @param {Object} [point] x,y object of point coordinates we want to check.
     * @return {Boolean} true if point is contained within an area of given object
     */
    containsPoint: function (e, target, point) {
      var ignoreZoom = true,
          pointer = point || this.getPointer(e, ignoreZoom),
          xy;

      if (target.group && target.group === this.getActiveGroup()) {
        xy = this._normalizePointer(target.group, pointer);
      }
      else {
        xy = { x: pointer.x, y: pointer.y };
      }
      // http://www.geog.ubc.ca/courses/klink/gis.notes/ncgia/u32.html
      // http://idav.ucdavis.edu/~okreylos/TAship/Spring2000/PointInPolygon.html
      return (target.containsPoint(xy) || target._findTargetCorner(pointer));
    },

    /**
     * @private
     */
    _normalizePointer: function (object, pointer) {
      var m = object.calcTransformMatrix(),
          invertedM = fabric.util.invertTransform(m),
          vpt = this.viewportTransform,
          vptPointer = this.restorePointerVpt(pointer),
          p = fabric.util.transformPoint(vptPointer, invertedM);
      return fabric.util.transformPoint(p, vpt);
    },

    /**
     * Returns true if object is transparent at a certain location
     * @param {fabric.Object} target Object to check
     * @param {Number} x Left coordinate
     * @param {Number} y Top coordinate
     * @return {Boolean}
     */
    isTargetTransparent: function (target, x, y) {
      var hasBorders = target.hasBorders,
          transparentCorners = target.transparentCorners,
          ctx = this.contextCache,
          originalColor = target.selectionBackgroundColor;

      target.hasBorders = target.transparentCorners = false;
      target.selectionBackgroundColor = '';

      ctx.save();
      ctx.transform.apply(ctx, this.viewportTransform);
      target.render(ctx);
      ctx.restore();

      target.active && target._renderControls(ctx);

      target.hasBorders = hasBorders;
      target.transparentCorners = transparentCorners;
      target.selectionBackgroundColor = originalColor;

      var isTransparent = fabric.util.isTransparent(
        ctx, x, y, this.targetFindTolerance);

      this.clearContext(ctx);

      return isTransparent;
    },

    /**
     * @private
     * @param {Event} e Event object
     * @param {fabric.Object} target
     */
    _shouldClearSelection: function (e, target) {
      var activeGroup = this.getActiveGroup(),
          activeObject = this.getActiveObject();

      return (
        !target
        ||
        (target &&
          activeGroup &&
          !activeGroup.contains(target) &&
          activeGroup !== target &&
          !e[this.selectionKey])
        ||
        (target && !target.evented)
        ||
        (target &&
          !target.selectable &&
          activeObject &&
          activeObject !== target)
      );
    },

    /**
     * @private
     * @param {fabric.Object} target
     */
    _shouldCenterTransform: function (target) {
      if (!target) {
        return;
      }

      var t = this._currentTransform,
          centerTransform;

      if (t.action === 'scale' || t.action === 'scaleX' || t.action === 'scaleY') {
        centerTransform = this.centeredScaling || target.centeredScaling;
      }
      else if (t.action === 'rotate') {
        centerTransform = this.centeredRotation || target.centeredRotation;
      }

      return centerTransform ? !t.altKey : t.altKey;
    },

    /**
     * @private
     */
    _getOriginFromCorner: function(target, corner) {
      var origin = {
        x: target.originX,
        y: target.originY
      };

      if (corner === 'ml' || corner === 'tl' || corner === 'bl') {
        origin.x = 'right';
      }
      else if (corner === 'mr' || corner === 'tr' || corner === 'br') {
        origin.x = 'left';
      }

      if (corner === 'tl' || corner === 'mt' || corner === 'tr') {
        origin.y = 'bottom';
      }
      else if (corner === 'bl' || corner === 'mb' || corner === 'br') {
        origin.y = 'top';
      }

      return origin;
    },

    /**
     * @private
     */
    _getActionFromCorner: function(target, corner, e) {
      if (!corner) {
        return 'drag';
      }

      switch (corner) {
        case 'mtr':
          return 'rotate';
        case 'ml':
        case 'mr':
          return e[this.altActionKey] ? 'skewY' : 'scaleX';
        case 'mt':
        case 'mb':
          return e[this.altActionKey] ? 'skewX' : 'scaleY';
        default:
          return 'scale';
      }
    },

    /**
     * @private
     * @param {Event} e Event object
     * @param {fabric.Object} target
     */
    _setupCurrentTransform: function (e, target) {
      if (!target) {
        return;
      }

      var pointer = this.getPointer(e),
          corner = target._findTargetCorner(this.getPointer(e, true)),
          action = this._getActionFromCorner(target, corner, e),
          origin = this._getOriginFromCorner(target, corner);

      this._currentTransform = {
        target: target,
        action: action,
        corner: corner,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        skewX: target.skewX,
        skewY: target.skewY,
        offsetX: pointer.x - target.left,
        offsetY: pointer.y - target.top,
        originX: origin.x,
        originY: origin.y,
        ex: pointer.x,
        ey: pointer.y,
        lastX: pointer.x,
        lastY: pointer.y,
        left: target.left,
        top: target.top,
        theta: degreesToRadians(target.angle),
        width: target.width * target.scaleX,
        mouseXSign: 1,
        mouseYSign: 1,
        shiftKey: e.shiftKey,
        altKey: e[this.centeredKey]
      };

      this._currentTransform.original = {
        left: target.left,
        top: target.top,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        skewX: target.skewX,
        skewY: target.skewY,
        originX: origin.x,
        originY: origin.y
      };

      this._resetCurrentTransform();
    },

    /**
     * Translates object by "setting" its left/top
     * @private
     * @param {Number} x pointer's x coordinate
     * @param {Number} y pointer's y coordinate
     * @return {Boolean} true if the translation occurred
     */
    _translateObject: function (x, y) {
      var transform = this._currentTransform,
          target = transform.target,
          newLeft = x - transform.offsetX,
          newTop = y - transform.offsetY,
          moveX = !target.get('lockMovementX') && target.left !== newLeft,
          moveY = !target.get('lockMovementY') && target.top !== newTop;

      moveX && target.set('left', newLeft);
      moveY && target.set('top', newTop);
      return moveX || moveY;
    },

    /**
     * Check if we are increasing a positive skew or lower it,
     * checking mouse direction and pressed corner.
     * @private
     */
    _changeSkewTransformOrigin: function(mouseMove, t, by) {
      var property = 'originX', origins = { 0: 'center' },
          skew = t.target.skewX, originA = 'left', originB = 'right',
          corner = t.corner === 'mt' || t.corner === 'ml' ? 1 : -1,
          flipSign = 1;

      mouseMove = mouseMove > 0 ? 1 : -1;
      if (by === 'y') {
        skew = t.target.skewY;
        originA = 'top';
        originB = 'bottom';
        property = 'originY';
      }
      origins[-1] = originA;
      origins[1] = originB;

      t.target.flipX && (flipSign *= -1);
      t.target.flipY && (flipSign *= -1);

      if (skew === 0) {
        t.skewSign = -corner * mouseMove * flipSign;
        t[property] = origins[-mouseMove];
      }
      else {
        skew = skew > 0 ? 1 : -1;
        t.skewSign = skew;
        t[property] = origins[skew * corner * flipSign];
      }
    },

    /**
     * Skew object by mouse events
     * @private
     * @param {Number} x pointer's x coordinate
     * @param {Number} y pointer's y coordinate
     * @param {String} by Either 'x' or 'y'
     * @return {Boolean} true if the skewing occurred
     */
    _skewObject: function (x, y, by) {
      var t = this._currentTransform,
          target = t.target, skewed = false,
          lockSkewingX = target.get('lockSkewingX'),
          lockSkewingY = target.get('lockSkewingY');

      if ((lockSkewingX && by === 'x') || (lockSkewingY && by === 'y')) {
        return false;
      }

      // Get the constraint point
      var center = target.getCenterPoint(),
          actualMouseByCenter = target.toLocalPoint(new fabric.Point(x, y), 'center', 'center')[by],
          lastMouseByCenter = target.toLocalPoint(new fabric.Point(t.lastX, t.lastY), 'center', 'center')[by],
          actualMouseByOrigin, constraintPosition, dim = target._getTransformedDimensions();

      this._changeSkewTransformOrigin(actualMouseByCenter - lastMouseByCenter, t, by);
      actualMouseByOrigin = target.toLocalPoint(new fabric.Point(x, y), t.originX, t.originY)[by];
      constraintPosition = target.translateToOriginPoint(center, t.originX, t.originY);
      // Actually skew the object
      skewed = this._setObjectSkew(actualMouseByOrigin, t, by, dim);
      t.lastX = x;
      t.lastY = y;
      // Make sure the constraints apply
      target.setPositionByOrigin(constraintPosition, t.originX, t.originY);
      return skewed;
    },

    /**
     * Set object skew
     * @private
     * @return {Boolean} true if the skewing occurred
     */
    _setObjectSkew: function(localMouse, transform, by, _dim) {
      var target = transform.target, newValue, skewed = false,
          skewSign = transform.skewSign, newDim, dimNoSkew,
          otherBy, _otherBy, _by, newDimMouse, skewX, skewY;

      if (by === 'x') {
        otherBy = 'y';
        _otherBy = 'Y';
        _by = 'X';
        skewX = 0;
        skewY = target.skewY;
      }
      else {
        otherBy = 'x';
        _otherBy = 'X';
        _by = 'Y';
        skewX = target.skewX;
        skewY = 0;
      }

      dimNoSkew = target._getTransformedDimensions(skewX, skewY);
      newDimMouse = 2 * Math.abs(localMouse) - dimNoSkew[by];
      if (newDimMouse <= 2) {
        newValue = 0;
      }
      else {
        newValue = skewSign * Math.atan((newDimMouse / target['scale' + _by]) /
                                        (dimNoSkew[otherBy] / target['scale' + _otherBy]));
        newValue = fabric.util.radiansToDegrees(newValue);
      }
      skewed = target['skew' + _by] !== newValue;
      target.set('skew' + _by, newValue);
      if (target['skew' + _otherBy] !== 0) {
        newDim = target._getTransformedDimensions();
        newValue = (_dim[otherBy] / newDim[otherBy]) * target['scale' + _otherBy];
        target.set('scale' + _otherBy, newValue);
      }
      return skewed;
    },

    /**
     * Scales object by invoking its scaleX/scaleY methods
     * @private
     * @param {Number} x pointer's x coordinate
     * @param {Number} y pointer's y coordinate
     * @param {String} by Either 'x' or 'y' - specifies dimension constraint by which to scale an object.
     *                    When not provided, an object is scaled by both dimensions equally
     * @return {Boolean} true if the scaling occurred
     */
    _scaleObject: function (x, y, by) {
      var t = this._currentTransform,
          target = t.target,
          lockScalingX = target.get('lockScalingX'),
          lockScalingY = target.get('lockScalingY'),
          lockScalingFlip = target.get('lockScalingFlip');

      if (lockScalingX && lockScalingY) {
        return false;
      }

      // Get the constraint point
      var constraintPosition = target.translateToOriginPoint(target.getCenterPoint(), t.originX, t.originY),
          localMouse = target.toLocalPoint(new fabric.Point(x, y), t.originX, t.originY),
          dim = target._getTransformedDimensions(), scaled = false;

      this._setLocalMouse(localMouse, t);

      // Actually scale the object
      scaled = this._setObjectScale(localMouse, t, lockScalingX, lockScalingY, by, lockScalingFlip, dim);

      // Make sure the constraints apply
      target.setPositionByOrigin(constraintPosition, t.originX, t.originY);
      return scaled;
    },

    /**
     * @private
     * @return {Boolean} true if the scaling occurred
     */
    _setObjectScale: function(localMouse, transform, lockScalingX, lockScalingY, by, lockScalingFlip, _dim) {
      var target = transform.target, forbidScalingX = false, forbidScalingY = false, scaled = false,
          changeX, changeY, scaleX, scaleY;

      scaleX = localMouse.x * target.scaleX / _dim.x;
      scaleY = localMouse.y * target.scaleY / _dim.y;
      changeX = target.scaleX !== scaleX;
      changeY = target.scaleY !== scaleY;

      if (lockScalingFlip && scaleX <= 0 && scaleX < target.scaleX) {
        forbidScalingX = true;
      }

      if (lockScalingFlip && scaleY <= 0 && scaleY < target.scaleY) {
        forbidScalingY = true;
      }

      if (by === 'equally' && !lockScalingX && !lockScalingY) {
        forbidScalingX || forbidScalingY || (scaled = this._scaleObjectEqually(localMouse, target, transform, _dim));
      }
      else if (!by) {
        forbidScalingX || lockScalingX || (target.set('scaleX', scaleX) && (scaled = scaled || changeX));
        forbidScalingY || lockScalingY || (target.set('scaleY', scaleY) && (scaled = scaled || changeY));
      }
      else if (by === 'x' && !target.get('lockUniScaling')) {
        forbidScalingX || lockScalingX || (target.set('scaleX', scaleX) && (scaled = scaled || changeX));
      }
      else if (by === 'y' && !target.get('lockUniScaling')) {
        forbidScalingY || lockScalingY || (target.set('scaleY', scaleY) && (scaled = scaled || changeY));
      }
      transform.newScaleX = scaleX;
      transform.newScaleY = scaleY;
      forbidScalingX || forbidScalingY || this._flipObject(transform, by);
      return scaled;
    },

    /**
     * @private
     * @return {Boolean} true if the scaling occurred
     */
    _scaleObjectEqually: function(localMouse, target, transform, _dim) {

      var dist = localMouse.y + localMouse.x,
          lastDist = _dim.y * transform.original.scaleY / target.scaleY +
                     _dim.x * transform.original.scaleX / target.scaleX,
          scaled;

      // We use transform.scaleX/Y instead of target.scaleX/Y
      // because the object may have a min scale and we'll loose the proportions
      transform.newScaleX = transform.original.scaleX * dist / lastDist;
      transform.newScaleY = transform.original.scaleY * dist / lastDist;
      scaled = transform.newScaleX !== target.scaleX || transform.newScaleY !== target.scaleY;
      target.set('scaleX', transform.newScaleX);
      target.set('scaleY', transform.newScaleY);
      return scaled;
    },

    /**
     * @private
     */
    _flipObject: function(transform, by) {
      if (transform.newScaleX < 0 && by !== 'y') {
        if (transform.originX === 'left') {
          transform.originX = 'right';
        }
        else if (transform.originX === 'right') {
          transform.originX = 'left';
        }
      }

      if (transform.newScaleY < 0 && by !== 'x') {
        if (transform.originY === 'top') {
          transform.originY = 'bottom';
        }
        else if (transform.originY === 'bottom') {
          transform.originY = 'top';
        }
      }
    },

    /**
     * @private
     */
    _setLocalMouse: function(localMouse, t) {
      var target = t.target;

      if (t.originX === 'right') {
        localMouse.x *= -1;
      }
      else if (t.originX === 'center') {
        localMouse.x *= t.mouseXSign * 2;
        if (localMouse.x < 0) {
          t.mouseXSign = -t.mouseXSign;
        }
      }

      if (t.originY === 'bottom') {
        localMouse.y *= -1;
      }
      else if (t.originY === 'center') {
        localMouse.y *= t.mouseYSign * 2;
        if (localMouse.y < 0) {
          t.mouseYSign = -t.mouseYSign;
        }
      }

      // adjust the mouse coordinates when dealing with padding
      if (abs(localMouse.x) > target.padding) {
        if (localMouse.x < 0) {
          localMouse.x += target.padding;
        }
        else {
          localMouse.x -= target.padding;
        }
      }
      else { // mouse is within the padding, set to 0
        localMouse.x = 0;
      }

      if (abs(localMouse.y) > target.padding) {
        if (localMouse.y < 0) {
          localMouse.y += target.padding;
        }
        else {
          localMouse.y -= target.padding;
        }
      }
      else {
        localMouse.y = 0;
      }
    },

    /**
     * Rotates object by invoking its rotate method
     * @private
     * @param {Number} x pointer's x coordinate
     * @param {Number} y pointer's y coordinate
     * @return {Boolean} true if the rotation occurred
     */
    _rotateObject: function (x, y) {

      var t = this._currentTransform;

      if (t.target.get('lockRotation')) {
        return false;
      }

      var lastAngle = atan2(t.ey - t.top, t.ex - t.left),
          curAngle = atan2(y - t.top, x - t.left),
          angle = radiansToDegrees(curAngle - lastAngle + t.theta),
          hasRoated = true;

      // normalize angle to positive value
      if (angle < 0) {
        angle = 360 + angle;
      }

      angle %= 360

      if (t.target.snapAngle > 0) {
        var snapAngle  = t.target.snapAngle,
            snapThreshold  = t.target.snapThreshold || snapAngle,
            rightAngleLocked = Math.ceil(angle / snapAngle) * snapAngle,
            leftAngleLocked = Math.floor(angle / snapAngle) * snapAngle;

        if (Math.abs(angle - leftAngleLocked) < snapThreshold) {
          angle = leftAngleLocked;
        }
        else if (Math.abs(angle - rightAngleLocked) < snapThreshold) {
          angle = rightAngleLocked;
        }

        if (t.target.angle === angle) {
          hasRoated = false
        }
      }

      t.target.angle = angle;
      return hasRoated;
    },

    /**
     * Set the cursor type of the canvas element
     * @param {String} value Cursor type of the canvas element.
     * @see http://www.w3.org/TR/css3-ui/#cursor
     */
    setCursor: function (value) {
      this.upperCanvasEl.style.cursor = value;
    },

    /**
     * @param {fabric.Object} target to reset transform
     * @private
     */
    _resetObjectTransform: function (target) {
      target.scaleX = 1;
      target.scaleY = 1;
      target.skewX = 0;
      target.skewY = 0;
      target.setAngle(0);
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx to draw the selection on
     */
    _drawSelection: function (ctx) {
      var groupSelector = this._groupSelector,
          left = groupSelector.left,
          top = groupSelector.top,
          aleft = abs(left),
          atop = abs(top);

      if (this.selectionColor) {
        ctx.fillStyle = this.selectionColor;

        ctx.fillRect(
          groupSelector.ex - ((left > 0) ? 0 : -left),
          groupSelector.ey - ((top > 0) ? 0 : -top),
          aleft,
          atop
        );
      }

      if (!this.selectionLineWidth || !this.selectionBorderColor) {
        return;
      }
      ctx.lineWidth = this.selectionLineWidth;
      ctx.strokeStyle = this.selectionBorderColor;

      // selection border
      if (this.selectionDashArray.length > 1 && !supportLineDash) {

        var px = groupSelector.ex + STROKE_OFFSET - ((left > 0) ? 0 : aleft),
            py = groupSelector.ey + STROKE_OFFSET - ((top > 0) ? 0 : atop);

        ctx.beginPath();

        fabric.util.drawDashedLine(ctx, px, py, px + aleft, py, this.selectionDashArray);
        fabric.util.drawDashedLine(ctx, px, py + atop - 1, px + aleft, py + atop - 1, this.selectionDashArray);
        fabric.util.drawDashedLine(ctx, px, py, px, py + atop, this.selectionDashArray);
        fabric.util.drawDashedLine(ctx, px + aleft - 1, py, px + aleft - 1, py + atop, this.selectionDashArray);

        ctx.closePath();
        ctx.stroke();
      }
      else {
        fabric.Object.prototype._setLineDash.call(this, ctx, this.selectionDashArray);
        ctx.strokeRect(
          groupSelector.ex + STROKE_OFFSET - ((left > 0) ? 0 : aleft),
          groupSelector.ey + STROKE_OFFSET - ((top > 0) ? 0 : atop),
          aleft,
          atop
        );
      }
    },

    /**
     * Method that determines what object we are clicking on
     * @param {Event} e mouse event
     * @param {Boolean} skipGroup when true, activeGroup is skipped and only objects are traversed through
     */
    findTarget: function (e, skipGroup) {
      if (this.skipTargetFind) {
        return;
      }

      var ignoreZoom = true,
          pointer = this.getPointer(e, ignoreZoom),
          activeGroup = this.getActiveGroup(),
          activeObject = this.getActiveObject(),
          activeTarget;

      // first check current group (if one exists)
      // active group does not check sub targets like normal groups.
      // if active group just exits.
      if (activeGroup && !skipGroup && this._checkTarget(pointer, activeGroup)) {
        this._fireOverOutEvents(activeGroup, e);
        return activeGroup;
      }
      // if we hit the corner of an activeObject, let's return that.
      if (activeObject && activeObject._findTargetCorner(pointer)) {
        this._fireOverOutEvents(activeObject, e);
        return activeObject;
      }
      if (activeObject && this._checkTarget(pointer, activeObject)) {
        if (!this.preserveObjectStacking) {
          this._fireOverOutEvents(activeObject, e);
          return activeObject;
        }
        else {
          activeTarget = activeObject;
        }
      }

      this.targets = [];

      var target = this._searchPossibleTargets(this._objects, pointer);
      if (e[this.altSelectionKey] && target && activeTarget && target !== activeTarget) {
        target = activeTarget;
      }
      this._fireOverOutEvents(target, e);
      return target;
    },

    /**
     * @private
     */
    _fireOverOutEvents: function(target, e) {
      if (target) {
        if (this._hoveredTarget !== target) {
          if (this._hoveredTarget) {
            this.fire('mouse:out', { target: this._hoveredTarget, e: e });
            this._hoveredTarget.fire('mouseout');
          }
          this.fire('mouse:over', { target: target, e: e });
          target.fire('mouseover');
          this._hoveredTarget = target;
        }
      }
      else if (this._hoveredTarget) {
        this.fire('mouse:out', { target: this._hoveredTarget, e: e });
        this._hoveredTarget.fire('mouseout');
        this._hoveredTarget = null;
      }
    },

    /**
     * @private
     */
    _checkTarget: function(pointer, obj) {
      if (obj &&
          obj.visible &&
          obj.evented &&
          this.containsPoint(null, obj, pointer)){
        if ((this.perPixelTargetFind || obj.perPixelTargetFind) && !obj.isEditing) {
          var isTransparent = this.isTargetTransparent(obj, pointer.x, pointer.y);
          if (!isTransparent) {
            return true;
          }
        }
        else {
          return true;
        }
      }
    },

    /**
     * @private
     */
    _searchPossibleTargets: function(objects, pointer) {

      // Cache all targets where their bounding box contains point.
      var target, i = objects.length, normalizedPointer, subTarget;
      // Do not check for currently grouped objects, since we check the parent group itself.
      // untill we call this function specifically to search inside the activeGroup
      while (i--) {
        if (this._checkTarget(pointer, objects[i])) {
          target = objects[i];
          if (target.type === 'group' && target.subTargetCheck) {
            normalizedPointer = this._normalizePointer(target, pointer);
            subTarget = this._searchPossibleTargets(target._objects, normalizedPointer);
            subTarget && this.targets.push(subTarget);
          }
          break;
        }
      }
      return target;
    },

    /**
     * Returns pointer coordinates without the effect of the viewport
     * @param {Object} pointer with "x" and "y" number values
     * @return {Object} object with "x" and "y" number values
     */
    restorePointerVpt: function(pointer) {
      return fabric.util.transformPoint(
        pointer,
        fabric.util.invertTransform(this.viewportTransform)
      );
    },

    /**
     * Returns pointer coordinates relative to canvas.
     * @param {Event} e
     * @param {Boolean} ignoreZoom
     * @return {Object} object with "x" and "y" number values
     */
    getPointer: function (e, ignoreZoom, upperCanvasEl) {
      if (!upperCanvasEl) {
        upperCanvasEl = this.upperCanvasEl;
      }
      var pointer = getPointer(e),
          bounds = upperCanvasEl.getBoundingClientRect(),
          boundsWidth = bounds.width || 0,
          boundsHeight = bounds.height || 0,
          cssScale;

      if (!boundsWidth || !boundsHeight ) {
        if ('top' in bounds && 'bottom' in bounds) {
          boundsHeight = Math.abs( bounds.top - bounds.bottom );
        }
        if ('right' in bounds && 'left' in bounds) {
          boundsWidth = Math.abs( bounds.right - bounds.left );
        }
      }

      this.calcOffset();

      pointer.x = pointer.x - this._offset.left;
      pointer.y = pointer.y - this._offset.top;
      if (!ignoreZoom) {
        pointer = this.restorePointerVpt(pointer);
      }

      if (boundsWidth === 0 || boundsHeight === 0) {
        // If bounds are not available (i.e. not visible), do not apply scale.
        cssScale = { width: 1, height: 1 };
      }
      else {
        cssScale = {
          width: upperCanvasEl.width / boundsWidth,
          height: upperCanvasEl.height / boundsHeight
        };
      }

      return {
        x: pointer.x * cssScale.width,
        y: pointer.y * cssScale.height
      };
    },

    /**
     * @private
     * @throws {CANVAS_INIT_ERROR} If canvas can not be initialized
     */
    _createUpperCanvas: function () {
      var lowerCanvasClass = this.lowerCanvasEl.className.replace(/\s*lower-canvas\s*/, '');

      this.upperCanvasEl = this._createCanvasElement();
      fabric.util.addClass(this.upperCanvasEl, 'upper-canvas ' + lowerCanvasClass);

      this.wrapperEl.appendChild(this.upperCanvasEl);

      this._copyCanvasStyle(this.lowerCanvasEl, this.upperCanvasEl);
      this._applyCanvasStyle(this.upperCanvasEl);
      this.contextTop = this.upperCanvasEl.getContext('2d');
    },

    /**
     * @private
     */
    _createCacheCanvas: function () {
      this.cacheCanvasEl = this._createCanvasElement();
      this.cacheCanvasEl.setAttribute('width', this.width);
      this.cacheCanvasEl.setAttribute('height', this.height);
      this.contextCache = this.cacheCanvasEl.getContext('2d');
    },

    /**
     * @private
     */
    _initWrapperElement: function () {
      this.wrapperEl = fabric.util.wrapElement(this.lowerCanvasEl, 'div', {
        'class': this.containerClass
      });
      fabric.util.setStyle(this.wrapperEl, {
        width: this.getWidth() + 'px',
        height: this.getHeight() + 'px',
        position: 'relative'
      });
      fabric.util.makeElementUnselectable(this.wrapperEl);
    },

    /**
     * @private
     * @param {HTMLElement} element canvas element to apply styles on
     */
    _applyCanvasStyle: function (element) {
      var width = this.getWidth() || element.width,
          height = this.getHeight() || element.height;

      fabric.util.setStyle(element, {
        position: 'absolute',
        width: width + 'px',
        height: height + 'px',
        left: 0,
        top: 0
      });
      element.width = width;
      element.height = height;
      fabric.util.makeElementUnselectable(element);
    },

    /**
     * Copys the the entire inline style from one element (fromEl) to another (toEl)
     * @private
     * @param {Element} fromEl Element style is copied from
     * @param {Element} toEl Element copied style is applied to
     */
    _copyCanvasStyle: function (fromEl, toEl) {
      toEl.style.cssText = fromEl.style.cssText;
    },

    /**
     * Returns context of canvas where object selection is drawn
     * @return {CanvasRenderingContext2D}
     */
    getSelectionContext: function() {
      return this.contextTop;
    },

    /**
     * Returns &lt;canvas> element on which object selection is drawn
     * @return {HTMLCanvasElement}
     */
    getSelectionElement: function () {
      return this.upperCanvasEl;
    },

    /**
     * @private
     * @param {Object} object
     */
    _setActiveObject: function(object) {
      if (this._activeObject) {
        this._activeObject.set('active', false);
      }
      this._activeObject = object;
      object.set('active', true);
    },

    /**
     * Sets given object as the only active object on canvas
     * @param {fabric.Object} object Object to set as an active one
     * @param {Event} [e] Event (passed along when firing "object:selected")
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    setActiveObject: function (object, e) {
      this._setActiveObject(object);
      this.renderAll();
      this.fire('object:selected', { target: object, e: e });
      object.fire('selected', { e: e });
      return this;
    },

    /**
     * Returns currently active object
     * @return {fabric.Object} active object
     */
    getActiveObject: function () {
      return this._activeObject;
    },

    /**
     * @private
     * @param {fabric.Object} obj Object that was removed
     */
    _onObjectRemoved: function(obj) {
      // removing active object should fire "selection:cleared" events
      if (this.getActiveObject() === obj) {
        this.fire('before:selection:cleared', { target: obj });
        this._discardActiveObject();
        this.fire('selection:cleared', { target: obj });
        obj.fire('deselected');
      }
      this.callSuper('_onObjectRemoved', obj);
    },

    /**
     * @private
     */
    _discardActiveObject: function() {
      if (this._activeObject) {
        this._activeObject.set('active', false);
      }
      this._activeObject = null;
    },

    /**
     * Discards currently active object and fire events
     * @param {event} e
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    discardActiveObject: function (e) {
      var activeObject = this._activeObject;
      this.fire('before:selection:cleared', { target: activeObject, e: e });
      this._discardActiveObject();
      this.fire('selection:cleared', { e: e });
      activeObject && activeObject.fire('deselected', { e: e });
      return this;
    },

    /**
     * @private
     * @param {fabric.Group} group
     */
    _setActiveGroup: function(group) {
      this._activeGroup = group;
      if (group) {
        group.set('active', true);
      }
    },

    /**
     * Sets active group to a specified one
     * @param {fabric.Group} group Group to set as a current one
     * @param {Event} e Event object
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    setActiveGroup: function (group, e) {
      this._setActiveGroup(group);
      if (group) {
        this.fire('object:selected', { target: group, e: e });
        group.fire('selected', { e: e });
      }
      return this;
    },

    /**
     * Returns currently active group
     * @return {fabric.Group} Current group
     */
    getActiveGroup: function () {
      return this._activeGroup;
    },

    /**
     * @private
     */
    _discardActiveGroup: function() {
      var g = this.getActiveGroup();
      if (g) {
        g.destroy();
      }
      this.setActiveGroup(null);
    },

    /**
     * Discards currently active group and fire events
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    discardActiveGroup: function (e) {
      var g = this.getActiveGroup();
      this.fire('before:selection:cleared', { e: e, target: g });
      this._discardActiveGroup();
      this.fire('selection:cleared', { e: e });
      return this;
    },

    /**
     * Deactivates all objects on canvas, removing any active group or object
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    deactivateAll: function () {
      var allObjects = this.getObjects(),
          i = 0,
          len = allObjects.length;
      for ( ; i < len; i++) {
        allObjects[i].set('active', false);
      }
      this._discardActiveGroup();
      this._discardActiveObject();
      return this;
    },

    /**
     * Deactivates all objects and dispatches appropriate events
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    deactivateAllWithDispatch: function (e) {
      var activeGroup = this.getActiveGroup(),
          activeObject = this.getActiveObject();
      if (activeObject || activeGroup) {
        this.fire('before:selection:cleared', { target: activeObject || activeGroup, e: e });
      }
      this.deactivateAll();
      if (activeObject || activeGroup) {
        this.fire('selection:cleared', { e: e, target: activeObject });
        activeObject && activeObject.fire('deselected');
      }
      return this;
    },

    /**
     * Clears a canvas element and removes all event listeners
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    dispose: function () {
      this.callSuper('dispose');
      var wrapper = this.wrapperEl;
      this.removeListeners();
      wrapper.removeChild(this.upperCanvasEl);
      wrapper.removeChild(this.lowerCanvasEl);
      delete this.upperCanvasEl;
      if (wrapper.parentNode) {
        wrapper.parentNode.replaceChild(this.lowerCanvasEl, this.wrapperEl);
      }
      delete this.wrapperEl;
      return this;
    },

    /**
     * Clears all contexts (background, main, top) of an instance
     * @return {fabric.Canvas} thisArg
     * @chainable
     */
    clear: function () {
      this.discardActiveGroup();
      this.discardActiveObject();
      this.clearContext(this.contextTop);
      return this.callSuper('clear');
    },

    /**
     * Draws objects' controls (borders/controls)
     * @param {CanvasRenderingContext2D} ctx Context to render controls on
     */
    drawControls: function(ctx) {
      var activeGroup = this.getActiveGroup();

      if (activeGroup) {
        activeGroup._renderControls(ctx);
      }
      else {
        this._drawObjectsControls(ctx);
      }
    },

    /**
     * @private
     */
    _drawObjectsControls: function(ctx) {
      for (var i = 0, len = this._objects.length; i < len; ++i) {
        if (!this._objects[i] || !this._objects[i].active) {
          continue;
        }
        this._objects[i]._renderControls(ctx);
      }
    },

    /**
     * @private
     */
    _toObject: function(instance, methodName, propertiesToInclude) {
      //If the object is part of the current selection group, it should
      //be transformed appropriately
      //i.e. it should be serialised as it would appear if the selection group
      //were to be destroyed.
      var originalProperties = this._realizeGroupTransformOnObject(instance),
          object = this.callSuper('_toObject', instance, methodName, propertiesToInclude);
      //Undo the damage we did by changing all of its properties
      this._unwindGroupTransformOnObject(instance, originalProperties);
      return object;
    },

    /**
     * Realises an object's group transformation on it
     * @private
     * @param {fabric.Object} [instance] the object to transform (gets mutated)
     * @returns the original values of instance which were changed
     */
    _realizeGroupTransformOnObject: function(instance) {
      var layoutProps = ['angle', 'flipX', 'flipY', 'height', 'left', 'scaleX', 'scaleY', 'top', 'width'];
      if (instance.group && instance.group === this.getActiveGroup()) {
        //Copy all the positionally relevant properties across now
        var originalValues = {};
        layoutProps.forEach(function(prop) {
          originalValues[prop] = instance[prop];
        });
        this.getActiveGroup().realizeTransform(instance);
        return originalValues;
      }
      else {
        return null;
      }
    },

    /**
     * Restores the changed properties of instance
     * @private
     * @param {fabric.Object} [instance] the object to un-transform (gets mutated)
     * @param {Object} [originalValues] the original values of instance, as returned by _realizeGroupTransformOnObject
     */
    _unwindGroupTransformOnObject: function(instance, originalValues) {
      if (originalValues) {
        instance.set(originalValues);
      }
    },

    /**
     * @private
     */
    _setSVGObject: function(markup, instance, reviver) {
      var originalProperties;
      //If the object is in a selection group, simulate what would happen to that
      //object when the group is deselected
      originalProperties = this._realizeGroupTransformOnObject(instance);
      this.callSuper('_setSVGObject', markup, instance, reviver);
      this._unwindGroupTransformOnObject(instance, originalProperties);
    },
  });

  // copying static properties manually to work around Opera's bug,
  // where "prototype" property is enumerable and overrides existing prototype
  for (var prop in fabric.StaticCanvas) {
    if (prop !== 'prototype') {
      fabric.Canvas[prop] = fabric.StaticCanvas[prop];
    }
  }

  if (fabric.isTouchSupported) {
    /** @ignore */
    fabric.Canvas.prototype._setCursorFromEvent = function() { };
  }

  /**
   * @ignore
   * @class fabric.Element
   * @alias fabric.Canvas
   * @deprecated Use {@link fabric.Canvas} instead.
   * @constructor
   */
  fabric.Element = fabric.Canvas;
})();


(function() {

  var cursorOffset = {
        mt: 0, // n
        tr: 1, // ne
        mr: 2, // e
        br: 3, // se
        mb: 4, // s
        bl: 5, // sw
        ml: 6, // w
        tl: 7 // nw
      },
      addListener = fabric.util.addListener,
      removeListener = fabric.util.removeListener;

  fabric.util.object.extend(fabric.Canvas.prototype, /** @lends fabric.Canvas.prototype */ {

    /**
     * Map of cursor style values for each of the object controls
     * @private
     */
    cursorMap: [
      'n-resize',
      'ne-resize',
      'e-resize',
      'se-resize',
      's-resize',
      'sw-resize',
      'w-resize',
      'nw-resize'
    ],

    /**
     * Adds mouse listeners to canvas
     * @private
     */
    _initEventListeners: function () {

      this._bindEvents();

      addListener(fabric.window, 'resize', this._onResize);

      // mouse events
      addListener(this.upperCanvasEl, 'mousedown', this._onMouseDown);
      addListener(this.upperCanvasEl, 'mousemove', this._onMouseMove);
      addListener(this.upperCanvasEl, 'mouseout', this._onMouseOut);
      addListener(this.upperCanvasEl, 'mouseenter', this._onMouseEnter);
      addListener(this.upperCanvasEl, 'wheel', this._onMouseWheel);
      addListener(this.upperCanvasEl, 'contextmenu', this._onContextMenu);

      // touch events
      addListener(this.upperCanvasEl, 'touchstart', this._onMouseDown);
      addListener(this.upperCanvasEl, 'touchmove', this._onMouseMove);

      if (typeof eventjs !== 'undefined' && 'add' in eventjs) {
        eventjs.add(this.upperCanvasEl, 'gesture', this._onGesture);
        eventjs.add(this.upperCanvasEl, 'drag', this._onDrag);
        eventjs.add(this.upperCanvasEl, 'orientation', this._onOrientationChange);
        eventjs.add(this.upperCanvasEl, 'shake', this._onShake);
        eventjs.add(this.upperCanvasEl, 'longpress', this._onLongPress);
      }
    },

    /**
     * @private
     */
    _bindEvents: function() {
      this._onMouseDown = this._onMouseDown.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onMouseUp = this._onMouseUp.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onGesture = this._onGesture.bind(this);
      this._onDrag = this._onDrag.bind(this);
      this._onShake = this._onShake.bind(this);
      this._onLongPress = this._onLongPress.bind(this);
      this._onOrientationChange = this._onOrientationChange.bind(this);
      this._onMouseWheel = this._onMouseWheel.bind(this);
      this._onMouseOut = this._onMouseOut.bind(this);
      this._onMouseEnter = this._onMouseEnter.bind(this);
      this._onContextMenu = this._onContextMenu.bind(this);
    },

    /**
     * Removes all event listeners
     */
    removeListeners: function() {
      removeListener(fabric.window, 'resize', this._onResize);

      removeListener(this.upperCanvasEl, 'mousedown', this._onMouseDown);
      removeListener(this.upperCanvasEl, 'mousemove', this._onMouseMove);
      removeListener(this.upperCanvasEl, 'mouseout', this._onMouseOut);
      removeListener(this.upperCanvasEl, 'mouseenter', this._onMouseEnter);
      removeListener(this.upperCanvasEl, 'wheel', this._onMouseWheel);
      removeListener(this.upperCanvasEl, 'contextmenu', this._onContextMenu);

      removeListener(this.upperCanvasEl, 'touchstart', this._onMouseDown);
      removeListener(this.upperCanvasEl, 'touchmove', this._onMouseMove);

      if (typeof eventjs !== 'undefined' && 'remove' in eventjs) {
        eventjs.remove(this.upperCanvasEl, 'gesture', this._onGesture);
        eventjs.remove(this.upperCanvasEl, 'drag', this._onDrag);
        eventjs.remove(this.upperCanvasEl, 'orientation', this._onOrientationChange);
        eventjs.remove(this.upperCanvasEl, 'shake', this._onShake);
        eventjs.remove(this.upperCanvasEl, 'longpress', this._onLongPress);
      }
    },

    /**
     * @private
     * @param {Event} [e] Event object fired on Event.js gesture
     * @param {Event} [self] Inner Event object
     */
    _onGesture: function(e, self) {
      this.__onTransformGesture && this.__onTransformGesture(e, self);
    },

    /**
     * @private
     * @param {Event} [e] Event object fired on Event.js drag
     * @param {Event} [self] Inner Event object
     */
    _onDrag: function(e, self) {
      this.__onDrag && this.__onDrag(e, self);
    },

    /**
     * @private
     * @param {Event} [e] Event object fired on wheel event
     */
    _onMouseWheel: function(e) {
      this.__onMouseWheel(e);
    },

    /**
     * @private
     * @param {Event} e Event object fired on mousedown
     */
    _onMouseOut: function(e) {
      var target = this._hoveredTarget;
      this.fire('mouse:out', { target: target, e: e });
      this._hoveredTarget = null;
      target && target.fire('mouseout', { e: e });
    },

    /**
     * @private
     * @param {Event} e Event object fired on mouseenter
     */
    _onMouseEnter: function(e) {
      if (!this.findTarget(e)) {
        this.fire('mouse:over', { target: null, e: e });
        this._hoveredTarget = null;
      }
    },

    /**
     * @private
     * @param {Event} [e] Event object fired on Event.js orientation change
     * @param {Event} [self] Inner Event object
     */
    _onOrientationChange: function(e, self) {
      this.__onOrientationChange && this.__onOrientationChange(e, self);
    },

    /**
     * @private
     * @param {Event} [e] Event object fired on Event.js shake
     * @param {Event} [self] Inner Event object
     */
    _onShake: function(e, self) {
      this.__onShake && this.__onShake(e, self);
    },

    /**
     * @private
     * @param {Event} [e] Event object fired on Event.js shake
     * @param {Event} [self] Inner Event object
     */
    _onLongPress: function(e, self) {
      this.__onLongPress && this.__onLongPress(e, self);
    },

    /**
     * @private
     * @param {Event} e Event object fired on mousedown
     */
    _onContextMenu: function (e) {
      if (this.stopContextMenu) {
        e.stopPropagation()
        e.preventDefault();
      }
      return false;
    },

    /**
     * @private
     * @param {Event} e Event object fired on mousedown
     */
    _onMouseDown: function (e) {
      this.__onMouseDown(e);

      addListener(fabric.document, 'touchend', this._onMouseUp);
      addListener(fabric.document, 'touchmove', this._onMouseMove);

      removeListener(this.upperCanvasEl, 'mousemove', this._onMouseMove);
      removeListener(this.upperCanvasEl, 'touchmove', this._onMouseMove);

      if (e.type === 'touchstart') {
        // Unbind mousedown to prevent double triggers from touch devices
        removeListener(this.upperCanvasEl, 'mousedown', this._onMouseDown);
      }
      else {
        addListener(fabric.document, 'mouseup', this._onMouseUp);
        addListener(fabric.document, 'mousemove', this._onMouseMove);
      }
    },

    /**
     * @private
     * @param {Event} e Event object fired on mouseup
     */
    _onMouseUp: function (e) {
      this.__onMouseUp(e);

      removeListener(fabric.document, 'mouseup', this._onMouseUp);
      removeListener(fabric.document, 'touchend', this._onMouseUp);

      removeListener(fabric.document, 'mousemove', this._onMouseMove);
      removeListener(fabric.document, 'touchmove', this._onMouseMove);

      addListener(this.upperCanvasEl, 'mousemove', this._onMouseMove);
      addListener(this.upperCanvasEl, 'touchmove', this._onMouseMove);

      if (e.type === 'touchend') {
        // Wait 400ms before rebinding mousedown to prevent double triggers
        // from touch devices
        var _this = this;
        setTimeout(function() {
          addListener(_this.upperCanvasEl, 'mousedown', _this._onMouseDown);
        }, 400);
      }
    },

    /**
     * @private
     * @param {Event} e Event object fired on mousemove
     */
    _onMouseMove: function (e) {
      !this.allowTouchScrolling && e.preventDefault && e.preventDefault();
      this.__onMouseMove(e);
    },

    /**
     * @private
     */
    _onResize: function () {
      this.calcOffset();
    },

    /**
     * Decides whether the canvas should be redrawn in mouseup and mousedown events.
     * @private
     * @param {Object} target
     * @param {Object} pointer
     */
    _shouldRender: function(target, pointer) {
      var activeObject = this.getActiveGroup() || this.getActiveObject();

      return !!(
        (target && (
          target.isMoving ||
          target !== activeObject))
        ||
        (!target && !!activeObject)
        ||
        (!target && !activeObject && !this._groupSelector)
        ||
        (pointer &&
          this._previousPointer &&
          this.selection && (
          pointer.x !== this._previousPointer.x ||
          pointer.y !== this._previousPointer.y))
      );
    },

    /**
     * Method that defines the actions when mouse is released on canvas.
     * The method resets the currentTransform parameters, store the image corner
     * position in the image object and render the canvas on top.
     * @private
     * @param {Event} e Event object fired on mouseup
     */
    __onMouseUp: function (e) {
      var target, searchTarget = true, transform = this._currentTransform,
          groupSelector = this._groupSelector,
          isClick = (!groupSelector || (groupSelector.left === 0 && groupSelector.top === 0));

      if (this.isDrawingMode && this._isCurrentlyDrawing) {
        this._onMouseUpInDrawingMode(e);
        return;
      }

      if (transform) {
        this._finalizeCurrentTransform();
        searchTarget = !transform.actionPerformed;
      }

      target = searchTarget ? this.findTarget(e, true) : transform.target;

      var shouldRender = this._shouldRender(target, this.getPointer(e));

      if (target || !isClick) {
        this._maybeGroupObjects(e);
      }
      else {
        // those are done by default on mouse up
        // by _maybeGroupObjects, we are skipping it in case of no target find
        this._groupSelector = null;
        this._currentTransform = null;
      }

      if (target) {
        target.isMoving = false;
      }

      this._handleCursorAndEvent(e, target, 'up');
      target && (target.__corner = 0);
      shouldRender && this.renderAll();
    },

    /**
     * set cursor for mouse up and handle mouseUp event
     * @param {Event} e event from mouse
     * @param {fabric.Object} target receiving event
     * @param {String} eventType event to fire (up, down or move)
     */
    _handleCursorAndEvent: function(e, target, eventType) {
      this._setCursorFromEvent(e, target);
      this._handleEvent(e, eventType, target ? target : null);
    },

    /**
     * Handle event firing for target and subtargets
     * @param {Event} e event from mouse
     * @param {String} eventType event to fire (up, down or move)
     * @param {fabric.Object} targetObj receiving event
     */
    _handleEvent: function(e, eventType, targetObj) {
      var target = typeof targetObj === undefined ? this.findTarget(e) : targetObj,
          targets = this.targets || [],
          options = { e: e, target: target, subTargets: targets };

      this.fire('mouse:' + eventType, options);
      target && target.fire('mouse' + eventType, options);
      for (var i = 0; i < targets.length; i++) {
        targets[i].fire('mouse' + eventType, options);
      }
    },

    /**
     * @private
     */
    _finalizeCurrentTransform: function() {

      var transform = this._currentTransform,
          target = transform.target;

      if (target._scaling) {
        target._scaling = false;
      }

      target.setCoords();
      this._restoreOriginXY(target);

      if (transform.actionPerformed || (this.stateful && target.hasStateChanged())) {
        this.fire('object:modified', { target: target });
        target.fire('modified');
      }
    },

    /**
     * @private
     * @param {Object} target Object to restore
     */
    _restoreOriginXY: function(target) {
      if (this._previousOriginX && this._previousOriginY) {

        var originPoint = target.translateToOriginPoint(
          target.getCenterPoint(),
          this._previousOriginX,
          this._previousOriginY);

        target.originX = this._previousOriginX;
        target.originY = this._previousOriginY;

        target.left = originPoint.x;
        target.top = originPoint.y;

        this._previousOriginX = null;
        this._previousOriginY = null;
      }
    },

    /**
     * @private
     * @param {Event} e Event object fired on mousedown
     */
    _onMouseDownInDrawingMode: function(e) {
      this._isCurrentlyDrawing = true;
      this.discardActiveObject(e).renderAll();
      if (this.clipTo) {
        fabric.util.clipContext(this, this.contextTop);
      }
      var pointer = this.getPointer(e);
      this.freeDrawingBrush.onMouseDown(pointer);
      this._handleEvent(e, 'down');
    },

    /**
     * @private
     * @param {Event} e Event object fired on mousemove
     */
    _onMouseMoveInDrawingMode: function(e) {
      if (this._isCurrentlyDrawing) {
        var pointer = this.getPointer(e);
        this.freeDrawingBrush.onMouseMove(pointer);
      }
      this.setCursor(this.freeDrawingCursor);
      this._handleEvent(e, 'move');
    },

    /**
     * @private
     * @param {Event} e Event object fired on mouseup
     */
    _onMouseUpInDrawingMode: function(e) {
      this._isCurrentlyDrawing = false;
      if (this.clipTo) {
        this.contextTop.restore();
      }
      this.freeDrawingBrush.onMouseUp();
      this._handleEvent(e, 'up');
    },

    /**
     * Method that defines the actions when mouse is clic ked on canvas.
     * The method inits the currentTransform parameters and renders all the
     * canvas so the current image can be placed on the top canvas and the rest
     * in on the container one.
     * @private
     * @param {Event} e Event object fired on mousedown
     */
    __onMouseDown: function (e) {

      var target = this.findTarget(e),
          pointer = this.getPointer(e, true);

      // if right click just fire events
      var isRightClick  = 'which' in e ? e.which === 3 : e.button === 2;
      if (isRightClick) {
        if (this.fireRightClick) {
          this._handleEvent(e, 'down', target ? target : null);
        }
        return;
      }

      if (this.isDrawingMode) {
        this._onMouseDownInDrawingMode(e);
        return;
      }

      // ignore if some object is being transformed at this moment
      if (this._currentTransform) {
        return;
      }

      // save pointer for check in __onMouseUp event
      this._previousPointer = pointer;

      var shouldRender = this._shouldRender(target, pointer),
          shouldGroup = this._shouldGroup(e, target);

      if (this._shouldClearSelection(e, target)) {
        this._clearSelection(e, target, pointer);
      }
      else if (shouldGroup) {
        this._handleGrouping(e, target);
        target = this.getActiveGroup();
      }

      if (target) {
        if (target.selectable && (target.__corner || !shouldGroup)) {
          this._beforeTransform(e, target);
          this._setupCurrentTransform(e, target);
        }

        if (target !== this.getActiveGroup() && target !== this.getActiveObject()) {
          this.deactivateAll();
          target.selectable && this.setActiveObject(target, e);
        }
      }
      this._handleEvent(e, 'down', target ? target : null);
      // we must renderAll so that we update the visuals
      shouldRender && this.renderAll();
    },

    /**
     * @private
     */
    _beforeTransform: function(e, target) {
      this.stateful && target.saveState();

      // determine if it's a drag or rotate case
      if (target._findTargetCorner(this.getPointer(e))) {
        this.onBeforeScaleRotate(target);
      }

    },

    /**
     * @private
     */
    _clearSelection: function(e, target, pointer) {
      this.deactivateAllWithDispatch(e);

      if (target && target.selectable) {
        this.setActiveObject(target, e);
      }
      else if (this.selection) {
        this._groupSelector = {
          ex: pointer.x,
          ey: pointer.y,
          top: 0,
          left: 0
        };
      }
    },

    /**
     * @private
     * @param {Object} target Object for that origin is set to center
     */
    _setOriginToCenter: function(target) {
      this._previousOriginX = this._currentTransform.target.originX;
      this._previousOriginY = this._currentTransform.target.originY;

      var center = target.getCenterPoint();

      target.originX = 'center';
      target.originY = 'center';

      target.left = center.x;
      target.top = center.y;

      this._currentTransform.left = target.left;
      this._currentTransform.top = target.top;
    },

    /**
     * @private
     * @param {Object} target Object for that center is set to origin
     */
    _setCenterToOrigin: function(target) {
      var originPoint = target.translateToOriginPoint(
        target.getCenterPoint(),
        this._previousOriginX,
        this._previousOriginY);

      target.originX = this._previousOriginX;
      target.originY = this._previousOriginY;

      target.left = originPoint.x;
      target.top = originPoint.y;

      this._previousOriginX = null;
      this._previousOriginY = null;
    },

    /**
     * Method that defines the actions when mouse is hovering the canvas.
     * The currentTransform parameter will definde whether the user is rotating/scaling/translating
     * an image or neither of them (only hovering). A group selection is also possible and would cancel
     * all any other type of action.
     * In case of an image transformation only the top canvas will be rendered.
     * @private
     * @param {Event} e Event object fired on mousemove
     */
    __onMouseMove: function (e) {

      var target, pointer;

      if (this.isDrawingMode) {
        this._onMouseMoveInDrawingMode(e);
        return;
      }
      if (typeof e.touches !== 'undefined' && e.touches.length > 1) {
        return;
      }

      var groupSelector = this._groupSelector;

      // We initially clicked in an empty area, so we draw a box for multiple selection
      if (groupSelector) {
        pointer = this.getPointer(e, true);

        groupSelector.left = pointer.x - groupSelector.ex;
        groupSelector.top = pointer.y - groupSelector.ey;

        this.renderTop();
      }
      else if (!this._currentTransform) {
        target = this.findTarget(e);
        this._setCursorFromEvent(e, target);
      }
      else {
        this._transformObject(e);
      }
      this._handleEvent(e, 'move', target ? target : null);
    },

    /**
     * Method that defines actions when an Event Mouse Wheel
     * @param {Event} e Event object fired on mouseup
     */
    __onMouseWheel: function(e) {
      this.fire('mouse:wheel', {
        e: e
      });
    },

    /**
     * @private
     * @param {Event} e Event fired on mousemove
     */
    _transformObject: function(e) {
      var pointer = this.getPointer(e),
          transform = this._currentTransform;

      transform.reset = false;
      transform.target.isMoving = true;

      this._beforeScaleTransform(e, transform);
      this._performTransformAction(e, transform, pointer);

      transform.actionPerformed && this.renderAll();
    },

    /**
     * @private
     */
    _performTransformAction: function(e, transform, pointer) {
      var x = pointer.x,
          y = pointer.y,
          target = transform.target,
          action = transform.action,
          actionPerformed = false;

      if (action === 'rotate') {
        (actionPerformed = this._rotateObject(x, y)) && this._fire('rotating', target, e);
      }
      else if (action === 'scale') {
        (actionPerformed = this._onScale(e, transform, x, y)) && this._fire('scaling', target, e);
      }
      else if (action === 'scaleX') {
        (actionPerformed = this._scaleObject(x, y, 'x')) && this._fire('scaling', target, e);
      }
      else if (action === 'scaleY') {
        (actionPerformed = this._scaleObject(x, y, 'y')) && this._fire('scaling', target, e);
      }
      else if (action === 'skewX') {
        (actionPerformed = this._skewObject(x, y, 'x')) && this._fire('skewing', target, e);
      }
      else if (action === 'skewY') {
        (actionPerformed = this._skewObject(x, y, 'y')) && this._fire('skewing', target, e);
      }
      else {
        actionPerformed = this._translateObject(x, y);
        if (actionPerformed) {
          this._fire('moving', target, e);
          this.setCursor(target.moveCursor || this.moveCursor);
        }
      }
      transform.actionPerformed = actionPerformed;
    },

    /**
     * @private
     */
    _fire: function(eventName, target, e) {
      this.fire('object:' + eventName, { target: target, e: e });
      target.fire(eventName, { e: e });
    },

    /**
     * @private
     */
    _beforeScaleTransform: function(e, transform) {
      if (transform.action === 'scale' || transform.action === 'scaleX' || transform.action === 'scaleY') {
        var centerTransform = this._shouldCenterTransform(transform.target);

        // Switch from a normal resize to center-based
        if ((centerTransform && (transform.originX !== 'center' || transform.originY !== 'center')) ||
           // Switch from center-based resize to normal one
           (!centerTransform && transform.originX === 'center' && transform.originY === 'center')
        ) {
          this._resetCurrentTransform();
          transform.reset = true;
        }
      }
    },

    /**
     * @private
     * @param {Event} e Event object
     * @param {Object} transform current tranform
     * @param {Number} x mouse position x from origin
     * @param {Number} y mouse poistion y from origin
     * @return {Boolean} true if the scaling occurred
     */
    _onScale: function(e, transform, x, y) {
      if ((e[this.uniScaleKey] || this.uniScaleTransform) && !transform.target.get('lockUniScaling')) {
        transform.currentAction = 'scale';
        return this._scaleObject(x, y);
      }
      else {
        // Switch from a normal resize to proportional
        if (!transform.reset && transform.currentAction === 'scale') {
          this._resetCurrentTransform();
        }

        transform.currentAction = 'scaleEqually';
        return this._scaleObject(x, y, 'equally');
      }
    },

    /**
     * Sets the cursor depending on where the canvas is being hovered.
     * Note: very buggy in Opera
     * @param {Event} e Event object
     * @param {Object} target Object that the mouse is hovering, if so.
     */
    _setCursorFromEvent: function (e, target) {
      if (!target) {
        this.setCursor(this.defaultCursor);
        return false;
      }

      var hoverCursor = target.hoverCursor || this.hoverCursor;
      if (!target.selectable) {
        //let's skip _findTargetCorner if object is not selectable
        this.setCursor(hoverCursor);
      }
      else {
        var activeGroup = this.getActiveGroup(),
            // only show proper corner when group selection is not active
            corner = target._findTargetCorner
                      && (!activeGroup || !activeGroup.contains(target))
                      && target._findTargetCorner(this.getPointer(e, true));

        if (!corner) {
          this.setCursor(hoverCursor);
        }
        else {
          this._setCornerCursor(corner, target, e);
        }
      }
      //actually unclear why it should return something
      //is never evaluated
      return true;
    },

    /**
     * @private
     */
    _setCornerCursor: function(corner, target, e) {
      if (corner in cursorOffset) {
        this.setCursor(this._getRotatedCornerCursor(corner, target, e));
      }
      else if (corner === 'mtr' && target.hasRotatingPoint) {
        this.setCursor(this.rotationCursor);
      }
      else {
        this.setCursor(this.defaultCursor);
        return false;
      }
    },

    /**
     * @private
     */
    _getRotatedCornerCursor: function(corner, target, e) {
      var n = Math.round((target.getAngle() % 360) / 45);

      if (n < 0) {
        n += 8; // full circle ahead
      }
      n += cursorOffset[corner];
      if (e[this.altActionKey] && cursorOffset[corner] % 2 === 0) {
        //if we are holding shift and we are on a mx corner...
        n += 2;
      }
      // normalize n to be from 0 to 7
      n %= 8;

      return this.cursorMap[n];
    }
  });
})();


(function() {

  var min = Math.min,
      max = Math.max;

  fabric.util.object.extend(fabric.Canvas.prototype, /** @lends fabric.Canvas.prototype */ {

    /**
     * @private
     * @param {Event} e Event object
     * @param {fabric.Object} target
     * @return {Boolean}
     */
    _shouldGroup: function(e, target) {
      var activeObject = this.getActiveObject();
      return e[this.selectionKey] && target && target.selectable &&
            (this.getActiveGroup() || (activeObject && activeObject !== target))
            && this.selection;
    },

    /**
     * @private
     * @param {Event} e Event object
     * @param {fabric.Object} target
     */
    _handleGrouping: function (e, target) {
      var activeGroup = this.getActiveGroup();

      if (target === activeGroup) {
        // if it's a group, find target again, using activeGroup objects
        target = this.findTarget(e, true);
        // if even object is not found, bail out
        if (!target) {
          return;
        }
      }
      if (activeGroup) {
        this._updateActiveGroup(target, e);
      }
      else {
        this._createActiveGroup(target, e);
      }

      if (this._activeGroup) {
        this._activeGroup.saveCoords();
      }
    },

    /**
     * @private
     */
    _updateActiveGroup: function(target, e) {
      var activeGroup = this.getActiveGroup();

      if (activeGroup.contains(target)) {

        activeGroup.removeWithUpdate(target);
        target.set('active', false);

        if (activeGroup.size() === 1) {
          // remove group alltogether if after removal it only contains 1 object
          this.discardActiveGroup(e);
          // activate last remaining object
          this.setActiveObject(activeGroup.item(0));
          return;
        }
      }
      else {
        activeGroup.addWithUpdate(target);
      }
      this.fire('selection:created', { target: activeGroup, e: e });
      activeGroup.set('active', true);
    },

    /**
     * @private
     */
    _createActiveGroup: function(target, e) {

      if (this._activeObject && target !== this._activeObject) {

        var group = this._createGroup(target);
        group.addWithUpdate();

        this.setActiveGroup(group);
        this._activeObject = null;

        this.fire('selection:created', { target: group, e: e });
      }

      target.set('active', true);
    },

    /**
     * @private
     * @param {Object} target
     */
    _createGroup: function(target) {

      var objects = this.getObjects(),
          isActiveLower = objects.indexOf(this._activeObject) < objects.indexOf(target),
          groupObjects = isActiveLower
            ? [this._activeObject, target]
            : [target, this._activeObject];
      this._activeObject.isEditing && this._activeObject.exitEditing();
      return new fabric.Group(groupObjects, {
        canvas: this
      });
    },

    /**
     * @private
     * @param {Event} e mouse event
     */
    _groupSelectedObjects: function (e) {

      var group = this._collectObjects();

      // do not create group for 1 element only
      if (group.length === 1) {
        this.setActiveObject(group[0], e);
      }
      else if (group.length > 1) {
        group = new fabric.Group(group.reverse(), {
          canvas: this
        });
        group.addWithUpdate();
        this.setActiveGroup(group, e);
        group.saveCoords();
        this.fire('selection:created', { target: group });
        this.renderAll();
      }
    },

    /**
     * @private
     */
    _collectObjects: function() {
      var group = [],
          currentObject,
          x1 = this._groupSelector.ex,
          y1 = this._groupSelector.ey,
          x2 = x1 + this._groupSelector.left,
          y2 = y1 + this._groupSelector.top,
          selectionX1Y1 = new fabric.Point(min(x1, x2), min(y1, y2)),
          selectionX2Y2 = new fabric.Point(max(x1, x2), max(y1, y2)),
          isClick = x1 === x2 && y1 === y2;

      for (var i = this._objects.length; i--; ) {
        currentObject = this._objects[i];

        if (!currentObject || !currentObject.selectable || !currentObject.visible) {
          continue;
        }

        if (currentObject.intersectsWithRect(selectionX1Y1, selectionX2Y2) ||
            currentObject.isContainedWithinRect(selectionX1Y1, selectionX2Y2) ||
            currentObject.containsPoint(selectionX1Y1) ||
            currentObject.containsPoint(selectionX2Y2)
        ) {
          currentObject.set('active', true);
          group.push(currentObject);

          // only add one object if it's a click
          if (isClick) {
            break;
          }
        }
      }

      return group;
    },

    /**
     * @private
     */
    _maybeGroupObjects: function(e) {
      if (this.selection && this._groupSelector) {
        this._groupSelectedObjects(e);
      }

      var activeGroup = this.getActiveGroup();
      if (activeGroup) {
        activeGroup.setObjectsCoords().setCoords();
        activeGroup.isMoving = false;
        this.setCursor(this.defaultCursor);
      }

      // clear selection and current transformation
      this._groupSelector = null;
      this._currentTransform = null;
    }
  });

})();


(function () {

  var supportQuality = fabric.StaticCanvas.supports('toDataURLWithQuality');

  fabric.util.object.extend(fabric.StaticCanvas.prototype, /** @lends fabric.StaticCanvas.prototype */ {

    /**
     * Exports canvas element to a dataurl image. Note that when multiplier is used, cropping is scaled appropriately
     * @param {Object} [options] Options object
     * @param {String} [options.format=png] The format of the output image. Either "jpeg" or "png"
     * @param {Number} [options.quality=1] Quality level (0..1). Only used for jpeg.
     * @param {Number} [options.multiplier=1] Multiplier to scale by
     * @param {Number} [options.left] Cropping left offset. Introduced in v1.2.14
     * @param {Number} [options.top] Cropping top offset. Introduced in v1.2.14
     * @param {Number} [options.width] Cropping width. Introduced in v1.2.14
     * @param {Number} [options.height] Cropping height. Introduced in v1.2.14
     * @return {String} Returns a data: URL containing a representation of the object in the format specified by options.format
     * @see {@link http://jsfiddle.net/fabricjs/NfZVb/|jsFiddle demo}
     * @example <caption>Generate jpeg dataURL with lower quality</caption>
     * var dataURL = canvas.toDataURL({
     *   format: 'jpeg',
     *   quality: 0.8
     * });
     * @example <caption>Generate cropped png dataURL (clipping of canvas)</caption>
     * var dataURL = canvas.toDataURL({
     *   format: 'png',
     *   left: 100,
     *   top: 100,
     *   width: 200,
     *   height: 200
     * });
     * @example <caption>Generate double scaled png dataURL</caption>
     * var dataURL = canvas.toDataURL({
     *   format: 'png',
     *   multiplier: 2
     * });
     */
    toDataURL: function (options) {
      options || (options = { });

      var format = options.format || 'png',
          quality = options.quality || 1,
          multiplier = options.multiplier || 1,
          cropping = {
            left: options.left || 0,
            top: options.top || 0,
            width: options.width || 0,
            height: options.height || 0,
          };
      return this.__toDataURLWithMultiplier(format, quality, cropping, multiplier);
    },

    /**
     * @private
     */
    __toDataURLWithMultiplier: function(format, quality, cropping, multiplier) {

      var origWidth = this.getWidth(),
          origHeight = this.getHeight(),
          scaledWidth = (cropping.width || this.getWidth()) * multiplier,
          scaledHeight = (cropping.height || this.getHeight()) * multiplier,
          zoom = this.getZoom(),
          newZoom = zoom * multiplier,
          vp = this.viewportTransform,
          translateX = (vp[4] - cropping.left) * multiplier,
          translateY = (vp[5] - cropping.top) * multiplier,
          newVp = [newZoom, 0, 0, newZoom, translateX, translateY],
          originalInteractive = this.interactive;

      this.viewportTransform = newVp;
      // setting interactive to false avoid exporting controls
      this.interactive && (this.interactive = false);
      if (origWidth !== scaledWidth || origHeight !== scaledHeight) {
        // this.setDimensions is going to renderAll also;
        this.setDimensions({ width: scaledWidth, height: scaledHeight });
      }
      else {
        this.renderAll();
      }
      var data = this.__toDataURL(format, quality, cropping);
      originalInteractive && (this.interactive = originalInteractive);
      this.viewportTransform = vp;
      //setDimensions with no option object is taking care of:
      //this.width, this.height, this.renderAll()
      this.setDimensions({ width: origWidth, height: origHeight });
      return data;
    },

    /**
     * @private
     */
    __toDataURL: function(format, quality) {

      var canvasEl = this.contextContainer.canvas;
      // to avoid common confusion https://github.com/kangax/fabric.js/issues/806
      if (format === 'jpg') {
        format = 'jpeg';
      }

      var data = supportQuality
                ? canvasEl.toDataURL('image/' + format, quality)
                : canvasEl.toDataURL('image/' + format);

      return data;
    },

    /**
     * Exports canvas element to a dataurl image (allowing to change image size via multiplier).
     * @deprecated since 1.0.13
     * @param {String} format (png|jpeg)
     * @param {Number} multiplier
     * @param {Number} quality (0..1)
     * @return {String}
     */
    toDataURLWithMultiplier: function (format, multiplier, quality) {
      return this.toDataURL({
        format: format,
        multiplier: multiplier,
        quality: quality
      });
    },
  });

})();


fabric.util.object.extend(fabric.StaticCanvas.prototype, /** @lends fabric.StaticCanvas.prototype */ {

  /**
   * Populates canvas with data from the specified dataless JSON.
   * JSON format must conform to the one of {@link fabric.Canvas#toDatalessJSON}
   * @deprecated since 1.2.2
   * @param {String|Object} json JSON string or object
   * @param {Function} callback Callback, invoked when json is parsed
   *                            and corresponding objects (e.g: {@link fabric.Image})
   *                            are initialized
   * @param {Function} [reviver] Method for further parsing of JSON elements, called after each fabric object created.
   * @return {fabric.Canvas} instance
   * @chainable
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-3#deserialization}
   */
  loadFromDatalessJSON: function (json, callback, reviver) {
    return this.loadFromJSON(json, callback, reviver);
  },

  /**
   * Populates canvas with data from the specified JSON.
   * JSON format must conform to the one of {@link fabric.Canvas#toJSON}
   * @param {String|Object} json JSON string or object
   * @param {Function} callback Callback, invoked when json is parsed
   *                            and corresponding objects (e.g: {@link fabric.Image})
   *                            are initialized
   * @param {Function} [reviver] Method for further parsing of JSON elements, called after each fabric object created.
   * @return {fabric.Canvas} instance
   * @chainable
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-3#deserialization}
   * @see {@link http://jsfiddle.net/fabricjs/fmgXt/|jsFiddle demo}
   * @example <caption>loadFromJSON</caption>
   * canvas.loadFromJSON(json, canvas.renderAll.bind(canvas));
   * @example <caption>loadFromJSON with reviver</caption>
   * canvas.loadFromJSON(json, canvas.renderAll.bind(canvas), function(o, object) {
   *   // `o` = json object
   *   // `object` = fabric.Object instance
   *   // ... do some stuff ...
   * });
   */
  loadFromJSON: function (json, callback, reviver) {
    if (!json) {
      return;
    }

    // serialize if it wasn't already
    var serialized = (typeof json === 'string')
      ? JSON.parse(json)
      : fabric.util.object.clone(json);

    this.clear();

    var _this = this;
    this._enlivenObjects(serialized.objects, function () {
      _this._setBgOverlay(serialized, function () {
        // remove parts i cannot set as options
        delete serialized.objects;
        delete serialized.backgroundImage;
        delete serialized.overlayImage;
        delete serialized.background;
        delete serialized.overlay;
        // this._initOptions does too many things to just
        // call it. Normally loading an Object from JSON
        // create the Object instance. Here the Canvas is
        // already an instance and we are just loading things over it
        for (var prop in serialized) {
          _this[prop] = serialized[prop];
        }
        callback && callback();
      });
    }, reviver);
    return this;
  },

  /**
   * @private
   * @param {Object} serialized Object with background and overlay information
   * @param {Function} callback Invoked after all background and overlay images/patterns loaded
   */
  _setBgOverlay: function(serialized, callback) {
    var _this = this,
        loaded = {
          backgroundColor: false,
          overlayColor: false,
          backgroundImage: false,
          overlayImage: false
        };

    if (!serialized.backgroundImage && !serialized.overlayImage && !serialized.background && !serialized.overlay) {
      callback && callback();
      return;
    }

    var cbIfLoaded = function () {
      if (loaded.backgroundImage && loaded.overlayImage && loaded.backgroundColor && loaded.overlayColor) {
        _this.renderAll();
        callback && callback();
      }
    };

    this.__setBgOverlay('backgroundImage', serialized.backgroundImage, loaded, cbIfLoaded);
    this.__setBgOverlay('overlayImage', serialized.overlayImage, loaded, cbIfLoaded);
    this.__setBgOverlay('backgroundColor', serialized.background, loaded, cbIfLoaded);
    this.__setBgOverlay('overlayColor', serialized.overlay, loaded, cbIfLoaded);

    cbIfLoaded();
  },

  /**
   * @private
   * @param {String} property Property to set (backgroundImage, overlayImage, backgroundColor, overlayColor)
   * @param {(Object|String)} value Value to set
   * @param {Object} loaded Set loaded property to true if property is set
   * @param {Object} callback Callback function to invoke after property is set
   */
  __setBgOverlay: function(property, value, loaded, callback) {
    var _this = this;

    if (!value) {
      loaded[property] = true;
      return;
    }

    if (property === 'backgroundImage' || property === 'overlayImage') {
      fabric.Image.fromObject(value, function(img) {
        _this[property] = img;
        loaded[property] = true;
        callback && callback();
      });
    }
    else {
      this['set' + fabric.util.string.capitalize(property, true)](value, function() {
        loaded[property] = true;
        callback && callback();
      });
    }
  },

  /**
   * @private
   * @param {Array} objects
   * @param {Function} callback
   * @param {Function} [reviver]
   */
  _enlivenObjects: function (objects, callback, reviver) {
    var _this = this;

    if (!objects || objects.length === 0) {
      callback && callback();
      return;
    }

    var renderOnAddRemove = this.renderOnAddRemove;
    this.renderOnAddRemove = false;

    fabric.util.enlivenObjects(objects, function(enlivenedObjects) {
      enlivenedObjects.forEach(function(obj, index) {
        // we splice the array just in case some custom classes restored from JSON
        // will add more object to canvas at canvas init.
        _this.insertAt(obj, index);
      });

      _this.renderOnAddRemove = renderOnAddRemove;
      callback && callback();
    }, null, reviver);
  },

  /**
   * @private
   * @param {String} format
   * @param {Function} callback
   */
  _toDataURL: function (format, callback) {
    this.clone(function (clone) {
      callback(clone.toDataURL(format));
    });
  },

  /**
   * @private
   * @param {String} format
   * @param {Number} multiplier
   * @param {Function} callback
   */
  _toDataURLWithMultiplier: function (format, multiplier, callback) {
    this.clone(function (clone) {
      callback(clone.toDataURLWithMultiplier(format, multiplier));
    });
  },

  /**
   * Clones canvas instance
   * @param {Object} [callback] Receives cloned instance as a first argument
   * @param {Array} [properties] Array of properties to include in the cloned canvas and children
   */
  clone: function (callback, properties) {
    var data = JSON.stringify(this.toJSON(properties));
    this.cloneWithoutData(function(clone) {
      clone.loadFromJSON(data, function() {
        callback && callback(clone);
      });
    });
  },

  /**
   * Clones canvas instance without cloning existing data.
   * This essentially copies canvas dimensions, clipping properties, etc.
   * but leaves data empty (so that you can populate it with your own)
   * @param {Object} [callback] Receives cloned instance as a first argument
   */
  cloneWithoutData: function(callback) {
    var el = fabric.document.createElement('canvas');

    el.width = this.getWidth();
    el.height = this.getHeight();

    var clone = new fabric.Canvas(el);
    clone.clipTo = this.clipTo;
    if (this.backgroundImage) {
      clone.setBackgroundImage(this.backgroundImage.src, function() {
        clone.renderAll();
        callback && callback(clone);
      });
      clone.backgroundImageOpacity = this.backgroundImageOpacity;
      clone.backgroundImageStretch = this.backgroundImageStretch;
    }
    else {
      callback && callback(clone);
    }
  }
});


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      toFixed = fabric.util.toFixed,
      capitalize = fabric.util.string.capitalize,
      degreesToRadians = fabric.util.degreesToRadians,
      supportsLineDash = fabric.StaticCanvas.supports('setLineDash');

  if (fabric.Object) {
    return;
  }

  /**
   * Root object class from which all 2d shape classes inherit from
   * @class fabric.Object
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-1#objects}
   * @see {@link fabric.Object#initialize} for constructor definition
   *
   * @fires added
   * @fires removed
   *
   * @fires selected
   * @fires deselected
   * @fires modified
   * @fires rotating
   * @fires scaling
   * @fires moving
   * @fires skewing
   *
   * @fires mousedown
   * @fires mouseup
   * @fires mouseover
   * @fires mouseout
   */
  fabric.Object = fabric.util.createClass(/** @lends fabric.Object.prototype */ {

    /**
     * Retrieves object's {@link fabric.Object#clipTo|clipping function}
     * @method getClipTo
     * @memberOf fabric.Object.prototype
     * @return {Function}
     */

    /**
     * Sets object's {@link fabric.Object#clipTo|clipping function}
     * @method setClipTo
     * @memberOf fabric.Object.prototype
     * @param {Function} clipTo Clipping function
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#transformMatrix|transformMatrix}
     * @method getTransformMatrix
     * @memberOf fabric.Object.prototype
     * @return {Array} transformMatrix
     */

    /**
     * Sets object's {@link fabric.Object#transformMatrix|transformMatrix}
     * @method setTransformMatrix
     * @memberOf fabric.Object.prototype
     * @param {Array} transformMatrix
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#visible|visible} state
     * @method getVisible
     * @memberOf fabric.Object.prototype
     * @return {Boolean} True if visible
     */

    /**
     * Sets object's {@link fabric.Object#visible|visible} state
     * @method setVisible
     * @memberOf fabric.Object.prototype
     * @param {Boolean} value visible value
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#shadow|shadow}
     * @method getShadow
     * @memberOf fabric.Object.prototype
     * @return {Object} Shadow instance
     */

    /**
     * Retrieves object's {@link fabric.Object#stroke|stroke}
     * @method getStroke
     * @memberOf fabric.Object.prototype
     * @return {String} stroke value
     */

    /**
     * Sets object's {@link fabric.Object#stroke|stroke}
     * @method setStroke
     * @memberOf fabric.Object.prototype
     * @param {String} value stroke value
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#strokeWidth|strokeWidth}
     * @method getStrokeWidth
     * @memberOf fabric.Object.prototype
     * @return {Number} strokeWidth value
     */

    /**
     * Sets object's {@link fabric.Object#strokeWidth|strokeWidth}
     * @method setStrokeWidth
     * @memberOf fabric.Object.prototype
     * @param {Number} value strokeWidth value
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#originX|originX}
     * @method getOriginX
     * @memberOf fabric.Object.prototype
     * @return {String} originX value
     */

    /**
     * Sets object's {@link fabric.Object#originX|originX}
     * @method setOriginX
     * @memberOf fabric.Object.prototype
     * @param {String} value originX value
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#originY|originY}
     * @method getOriginY
     * @memberOf fabric.Object.prototype
     * @return {String} originY value
     */

    /**
     * Sets object's {@link fabric.Object#originY|originY}
     * @method setOriginY
     * @memberOf fabric.Object.prototype
     * @param {String} value originY value
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#fill|fill}
     * @method getFill
     * @memberOf fabric.Object.prototype
     * @return {String} Fill value
     */

    /**
     * Sets object's {@link fabric.Object#fill|fill}
     * @method setFill
     * @memberOf fabric.Object.prototype
     * @param {String} value Fill value
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#opacity|opacity}
     * @method getOpacity
     * @memberOf fabric.Object.prototype
     * @return {Number} Opacity value (0-1)
     */

    /**
     * Sets object's {@link fabric.Object#opacity|opacity}
     * @method setOpacity
     * @memberOf fabric.Object.prototype
     * @param {Number} value Opacity value (0-1)
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#angle|angle} (in degrees)
     * @method getAngle
     * @memberOf fabric.Object.prototype
     * @return {Number}
     */

    /**
     * Retrieves object's {@link fabric.Object#top|top position}
     * @method getTop
     * @memberOf fabric.Object.prototype
     * @return {Number} Top value (in pixels)
     */

    /**
     * Sets object's {@link fabric.Object#top|top position}
     * @method setTop
     * @memberOf fabric.Object.prototype
     * @param {Number} value Top value (in pixels)
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#left|left position}
     * @method getLeft
     * @memberOf fabric.Object.prototype
     * @return {Number} Left value (in pixels)
     */

    /**
     * Sets object's {@link fabric.Object#left|left position}
     * @method setLeft
     * @memberOf fabric.Object.prototype
     * @param {Number} value Left value (in pixels)
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#scaleX|scaleX} value
     * @method getScaleX
     * @memberOf fabric.Object.prototype
     * @return {Number} scaleX value
     */

    /**
     * Sets object's {@link fabric.Object#scaleX|scaleX} value
     * @method setScaleX
     * @memberOf fabric.Object.prototype
     * @param {Number} value scaleX value
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#scaleY|scaleY} value
     * @method getScaleY
     * @memberOf fabric.Object.prototype
     * @return {Number} scaleY value
     */

    /**
     * Sets object's {@link fabric.Object#scaleY|scaleY} value
     * @method setScaleY
     * @memberOf fabric.Object.prototype
     * @param {Number} value scaleY value
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#flipX|flipX} value
     * @method getFlipX
     * @memberOf fabric.Object.prototype
     * @return {Boolean} flipX value
     */

    /**
     * Sets object's {@link fabric.Object#flipX|flipX} value
     * @method setFlipX
     * @memberOf fabric.Object.prototype
     * @param {Boolean} value flipX value
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Retrieves object's {@link fabric.Object#flipY|flipY} value
     * @method getFlipY
     * @memberOf fabric.Object.prototype
     * @return {Boolean} flipY value
     */

    /**
     * Sets object's {@link fabric.Object#flipY|flipY} value
     * @method setFlipY
     * @memberOf fabric.Object.prototype
     * @param {Boolean} value flipY value
     * @return {fabric.Object} thisArg
     * @chainable
     */

    /**
     * Type of an object (rect, circle, path, etc.).
     * Note that this property is meant to be read-only and not meant to be modified.
     * If you modify, certain parts of Fabric (such as JSON loading) won't work correctly.
     * @type String
     * @default
     */
    type:                     'object',

    /**
     * Horizontal origin of transformation of an object (one of "left", "right", "center")
     * See http://jsfiddle.net/1ow02gea/40/ on how originX/originY affect objects in groups
     * @type String
     * @default
     */
    originX:                  'left',

    /**
     * Vertical origin of transformation of an object (one of "top", "bottom", "center")
     * See http://jsfiddle.net/1ow02gea/40/ on how originX/originY affect objects in groups
     * @type String
     * @default
     */
    originY:                  'top',

    /**
     * Top position of an object. Note that by default it's relative to object top. You can change this by setting originY={top/center/bottom}
     * @type Number
     * @default
     */
    top:                      0,

    /**
     * Left position of an object. Note that by default it's relative to object left. You can change this by setting originX={left/center/right}
     * @type Number
     * @default
     */
    left:                     0,

    /**
     * Object width
     * @type Number
     * @default
     */
    width:                    0,

    /**
     * Object height
     * @type Number
     * @default
     */
    height:                   0,

    /**
     * Object scale factor (horizontal)
     * @type Number
     * @default
     */
    scaleX:                   1,

    /**
     * Object scale factor (vertical)
     * @type Number
     * @default
     */
    scaleY:                   1,

    /**
     * When true, an object is rendered as flipped horizontally
     * @type Boolean
     * @default
     */
    flipX:                    false,

    /**
     * When true, an object is rendered as flipped vertically
     * @type Boolean
     * @default
     */
    flipY:                    false,

    /**
     * Opacity of an object
     * @type Number
     * @default
     */
    opacity:                  1,

    /**
     * Angle of rotation of an object (in degrees)
     * @type Number
     * @default
     */
    angle:                    0,

    /**
     * Angle of skew on x axes of an object (in degrees)
     * @type Number
     * @default
     */
    skewX:                    0,

    /**
     * Angle of skew on y axes of an object (in degrees)
     * @type Number
     * @default
     */
    skewY:                    0,

    /**
     * Size of object's controlling corners (in pixels)
     * @type Number
     * @default
     */
    cornerSize:               13,

    /**
     * When true, object's controlling corners are rendered as transparent inside (i.e. stroke instead of fill)
     * @type Boolean
     * @default
     */
    transparentCorners:       true,

    /**
     * Default cursor value used when hovering over this object on canvas
     * @type String
     * @default
     */
    hoverCursor:              null,

    /**
     * Default cursor value used when moving this object on canvas
     * @type String
     * @default
     */
    moveCursor:               null,

    /**
     * Padding between object and its controlling borders (in pixels)
     * @type Number
     * @default
     */
    padding:                  0,

    /**
     * Color of controlling borders of an object (when it's active)
     * @type String
     * @default
     */
    borderColor:              'rgba(102,153,255,0.75)',

    /**
     * Array specifying dash pattern of an object's borders (hasBorder must be true)
     * @since 1.6.2
     * @type Array
     */
    borderDashArray:          null,

    /**
     * Color of controlling corners of an object (when it's active)
     * @type String
     * @default
     */
    cornerColor:              'rgba(102,153,255,0.5)',

    /**
     * Color of controlling corners of an object (when it's active and transparentCorners false)
     * @since 1.6.2
     * @type String
     * @default
     */
    cornerStrokeColor:        null,

    /**
     * Specify style of control, 'rect' or 'circle'
     * @since 1.6.2
     * @type String
     */
    cornerStyle:          'rect',

    /**
     * Array specifying dash pattern of an object's control (hasBorder must be true)
     * @since 1.6.2
     * @type Array
     */
    cornerDashArray:          null,

    /**
     * When true, this object will use center point as the origin of transformation
     * when being scaled via the controls.
     * <b>Backwards incompatibility note:</b> This property replaces "centerTransform" (Boolean).
     * @since 1.3.4
     * @type Boolean
     * @default
     */
    centeredScaling:          false,

    /**
     * When true, this object will use center point as the origin of transformation
     * when being rotated via the controls.
     * <b>Backwards incompatibility note:</b> This property replaces "centerTransform" (Boolean).
     * @since 1.3.4
     * @type Boolean
     * @default
     */
    centeredRotation:         true,

    /**
     * Color of object's fill
     * @type String
     * @default
     */
    fill:                     'rgb(0,0,0)',

    /**
     * Fill rule used to fill an object
     * accepted values are nonzero, evenodd
     * <b>Backwards incompatibility note:</b> This property was used for setting globalCompositeOperation until v1.4.12 (use `fabric.Object#globalCompositeOperation` instead)
     * @type String
     * @default
     */
    fillRule:                 'nonzero',

    /**
     * Composite rule used for canvas globalCompositeOperation
     * @type String
     * @default
     */
    globalCompositeOperation: 'source-over',

    /**
     * Background color of an object. Only works with text objects at the moment.
     * @type String
     * @default
     */
    backgroundColor:          '',

    /**
     * Selection Background color of an object. colored layer behind the object when it is active.
     * does not mix good with globalCompositeOperation methods.
     * @type String
     * @default
     */
    selectionBackgroundColor:          '',

    /**
     * When defined, an object is rendered via stroke and this property specifies its color
     * @type String
     * @default
     */
    stroke:                   null,

    /**
     * Width of a stroke used to render this object
     * @type Number
     * @default
     */
    strokeWidth:              1,

    /**
     * Array specifying dash pattern of an object's stroke (stroke must be defined)
     * @type Array
     */
    strokeDashArray:          null,

    /**
     * Line endings style of an object's stroke (one of "butt", "round", "square")
     * @type String
     * @default
     */
    strokeLineCap:            'butt',

    /**
     * Corner style of an object's stroke (one of "bevil", "round", "miter")
     * @type String
     * @default
     */
    strokeLineJoin:           'miter',

    /**
     * Maximum miter length (used for strokeLineJoin = "miter") of an object's stroke
     * @type Number
     * @default
     */
    strokeMiterLimit:         10,

    /**
     * Shadow object representing shadow of this shape
     * @type fabric.Shadow
     * @default
     */
    shadow:                   null,

    /**
     * Opacity of object's controlling borders when object is active and moving
     * @type Number
     * @default
     */
    borderOpacityWhenMoving:  0.4,

    /**
     * Scale factor of object's controlling borders
     * @type Number
     * @default
     */
    borderScaleFactor:        1,

    /**
     * Transform matrix (similar to SVG's transform matrix)
     * @type Array
     */
    transformMatrix:          null,

    /**
     * Minimum allowed scale value of an object
     * @type Number
     * @default
     */
    minScaleLimit:            0.01,

    /**
     * When set to `false`, an object can not be selected for modification (using either point-click-based or group-based selection).
     * But events still fire on it.
     * @type Boolean
     * @default
     */
    selectable:               true,

    /**
     * When set to `false`, an object can not be a target of events. All events propagate through it. Introduced in v1.3.4
     * @type Boolean
     * @default
     */
    evented:                  true,

    /**
     * When set to `false`, an object is not rendered on canvas
     * @type Boolean
     * @default
     */
    visible:                  true,

    /**
     * When set to `false`, object's controls are not displayed and can not be used to manipulate object
     * @type Boolean
     * @default
     */
    hasControls:              true,

    /**
     * When set to `false`, object's controlling borders are not rendered
     * @type Boolean
     * @default
     */
    hasBorders:               true,

    /**
     * When set to `false`, object's controlling rotating point will not be visible or selectable
     * @type Boolean
     * @default
     */
    hasRotatingPoint:         true,

    /**
     * Offset for object's controlling rotating point (when enabled via `hasRotatingPoint`)
     * @type Number
     * @default
     */
    rotatingPointOffset:      40,

    /**
     * When set to `true`, objects are "found" on canvas on per-pixel basis rather than according to bounding box
     * @type Boolean
     * @default
     */
    perPixelTargetFind:       false,

    /**
     * When `false`, default object's values are not included in its serialization
     * @type Boolean
     * @default
     */
    includeDefaultValues:     true,

    /**
     * Function that determines clipping of an object (context is passed as a first argument)
     * Note that context origin is at the object's center point (not left/top corner)
     * @type Function
     */
    clipTo:                   null,

    /**
     * When `true`, object horizontal movement is locked
     * @type Boolean
     * @default
     */
    lockMovementX:            false,

    /**
     * When `true`, object vertical movement is locked
     * @type Boolean
     * @default
     */
    lockMovementY:            false,

    /**
     * When `true`, object rotation is locked
     * @type Boolean
     * @default
     */
    lockRotation:             false,

    /**
     * When `true`, object horizontal scaling is locked
     * @type Boolean
     * @default
     */
    lockScalingX:             false,

    /**
     * When `true`, object vertical scaling is locked
     * @type Boolean
     * @default
     */
    lockScalingY:             false,

    /**
     * When `true`, object non-uniform scaling is locked
     * @type Boolean
     * @default
     */
    lockUniScaling:           false,

    /**
     * When `true`, object horizontal skewing is locked
     * @type Boolean
     * @default
     */
    lockSkewingX:             false,

    /**
     * When `true`, object vertical skewing is locked
     * @type Boolean
     * @default
     */
    lockSkewingY:             false,

    /**
     * When `true`, object cannot be flipped by scaling into negative values
     * @type Boolean
     * @default
     */

    lockScalingFlip:          false,

    /**
     * When `true`, object is not exported in SVG or OBJECT/JSON
     * since 1.6.3
     * @type Boolean
     * @default
     */

    excludeFromExport:          false,

    /**
     * List of properties to consider when checking if state
     * of an object is changed (fabric.Object#hasStateChanged)
     * as well as for history (undo/redo) purposes
     * @type Array
     */
    stateProperties:  (
      'top left width height scaleX scaleY flipX flipY originX originY transformMatrix ' +
      'stroke strokeWidth strokeDashArray strokeLineCap strokeLineJoin strokeMiterLimit ' +
      'angle opacity fill fillRule globalCompositeOperation shadow clipTo visible backgroundColor ' +
      'skewX skewY'
    ).split(' '),

    /**
     * Constructor
     * @param {Object} [options] Options object
     */
    initialize: function(options) {
      if (options) {
        this.setOptions(options);
      }
    },

    /**
     * @private
     * @param {Object} [options] Options object
     */
    _initGradient: function(options) {
      if (options.fill && options.fill.colorStops && !(options.fill instanceof fabric.Gradient)) {
        this.set('fill', new fabric.Gradient(options.fill));
      }
      if (options.stroke && options.stroke.colorStops && !(options.stroke instanceof fabric.Gradient)) {
        this.set('stroke', new fabric.Gradient(options.stroke));
      }
    },

    /**
     * @private
     * @param {Object} [options] Options object
     */
    _initPattern: function(options) {
      if (options.fill && options.fill.source && !(options.fill instanceof fabric.Pattern)) {
        this.set('fill', new fabric.Pattern(options.fill));
      }
      if (options.stroke && options.stroke.source && !(options.stroke instanceof fabric.Pattern)) {
        this.set('stroke', new fabric.Pattern(options.stroke));
      }
    },

    /**
     * @private
     * @param {Object} [options] Options object
     */
    _initClipping: function(options) {
      if (!options.clipTo || typeof options.clipTo !== 'string') {
        return;
      }

      var functionBody = fabric.util.getFunctionBody(options.clipTo);
      if (typeof functionBody !== 'undefined') {
        this.clipTo = new Function('ctx', functionBody);
      }
    },

    /**
     * Sets object's properties from options
     * @param {Object} [options] Options object
     */
    setOptions: function(options) {
      for (var prop in options) {
        this.set(prop, options[prop]);
      }
      this._initGradient(options);
      this._initPattern(options);
      this._initClipping(options);
    },

    /**
     * Transforms context when rendering an object
     * @param {CanvasRenderingContext2D} ctx Context
     * @param {Boolean} fromLeft When true, context is transformed to object's top/left corner. This is used when rendering text on Node
     */
    transform: function(ctx, fromLeft) {
      if (this.group && !this.group._transformDone && this.group === this.canvas._activeGroup) {
        this.group.transform(ctx);
      }
      var center = fromLeft ? this._getLeftTopCoords() : this.getCenterPoint();
      ctx.translate(center.x, center.y);
      ctx.rotate(degreesToRadians(this.angle));
      ctx.scale(
        this.scaleX * (this.flipX ? -1 : 1),
        this.scaleY * (this.flipY ? -1 : 1)
      );
      ctx.transform(1, 0, Math.tan(degreesToRadians(this.skewX)), 1, 0, 0);
      ctx.transform(1, Math.tan(degreesToRadians(this.skewY)), 0, 1, 0, 0);
    },

    /**
     * Returns an object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} Object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      var NUM_FRACTION_DIGITS = fabric.Object.NUM_FRACTION_DIGITS,

          object = {
            type:                     this.type,
            originX:                  this.originX,
            originY:                  this.originY,
            left:                     toFixed(this.left, NUM_FRACTION_DIGITS),
            top:                      toFixed(this.top, NUM_FRACTION_DIGITS),
            width:                    toFixed(this.width, NUM_FRACTION_DIGITS),
            height:                   toFixed(this.height, NUM_FRACTION_DIGITS),
            fill:                     (this.fill && this.fill.toObject) ? this.fill.toObject() : this.fill,
            stroke:                   (this.stroke && this.stroke.toObject) ? this.stroke.toObject() : this.stroke,
            strokeWidth:              toFixed(this.strokeWidth, NUM_FRACTION_DIGITS),
            strokeDashArray:          this.strokeDashArray ? this.strokeDashArray.concat() : this.strokeDashArray,
            strokeLineCap:            this.strokeLineCap,
            strokeLineJoin:           this.strokeLineJoin,
            strokeMiterLimit:         toFixed(this.strokeMiterLimit, NUM_FRACTION_DIGITS),
            scaleX:                   toFixed(this.scaleX, NUM_FRACTION_DIGITS),
            scaleY:                   toFixed(this.scaleY, NUM_FRACTION_DIGITS),
            angle:                    toFixed(this.getAngle(), NUM_FRACTION_DIGITS),
            flipX:                    this.flipX,
            flipY:                    this.flipY,
            opacity:                  toFixed(this.opacity, NUM_FRACTION_DIGITS),
            shadow:                   (this.shadow && this.shadow.toObject) ? this.shadow.toObject() : this.shadow,
            visible:                  this.visible,
            clipTo:                   this.clipTo && String(this.clipTo),
            backgroundColor:          this.backgroundColor,
            fillRule:                 this.fillRule,
            globalCompositeOperation: this.globalCompositeOperation,
            transformMatrix:          this.transformMatrix ? this.transformMatrix.concat() : this.transformMatrix,
            skewX:                    toFixed(this.skewX, NUM_FRACTION_DIGITS),
            skewY:                    toFixed(this.skewY, NUM_FRACTION_DIGITS)
          };

      fabric.util.populateWithProperties(this, object, propertiesToInclude);

      if (!this.includeDefaultValues) {
        object = this._removeDefaultValues(object);
      }

      return object;
    },

    /**
     * Returns (dataless) object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} Object representation of an instance
     */
    toDatalessObject: function(propertiesToInclude) {
      // will be overwritten by subclasses
      return this.toObject(propertiesToInclude);
    },

    /**
     * @private
     * @param {Object} object
     */
    _removeDefaultValues: function(object) {
      var prototype = fabric.util.getKlass(object.type).prototype,
          stateProperties = prototype.stateProperties;
      stateProperties.forEach(function(prop) {
        if (object[prop] === prototype[prop]) {
          delete object[prop];
        }
        var isArray = Object.prototype.toString.call(object[prop]) === '[object Array]' &&
                      Object.prototype.toString.call(prototype[prop]) === '[object Array]';

        // basically a check for [] === []
        if (isArray && object[prop].length === 0 && prototype[prop].length === 0) {
          delete object[prop];
        }
      });

      return object;
    },

    /**
     * Returns a string representation of an instance
     * @return {String}
     */
    toString: function() {
      return '#<fabric.' + capitalize(this.type) + '>';
    },

    /**
     * Basic getter
     * @param {String} property Property name
     * @return {*} value of a property
     */
    get: function(property) {
      return this[property];
    },

    /**
     * Return the object scale factor counting also the group scaling
     * @return {Object} object with scaleX and scaleY properties
     */
    getObjectScaling: function() {
      var scaleX = this.scaleX, scaleY = this.scaleY;
      if (this.group) {
        var scaling = this.group.getObjectScaling();
        scaleX *= scaling.scaleX;
        scaleY *= scaling.scaleY;
      }
      return { scaleX: scaleX, scaleY: scaleY };
    },

    /**
     * @private
     */
    _setObject: function(obj) {
      for (var prop in obj) {
        this._set(prop, obj[prop]);
      }
    },

    /**
     * Sets property to a given value. When changing position/dimension -related properties (left, top, scale, angle, etc.) `set` does not update position of object's borders/controls. If you need to update those, call `setCoords()`.
     * @param {String|Object} key Property name or object (if object, iterate over the object properties)
     * @param {Object|Function} value Property value (if function, the value is passed into it and its return value is used as a new one)
     * @return {fabric.Object} thisArg
     * @chainable
     */
    set: function(key, value) {
      if (typeof key === 'object') {
        this._setObject(key);
      }
      else {
        if (typeof value === 'function' && key !== 'clipTo') {
          this._set(key, value(this.get(key)));
        }
        else {
          this._set(key, value);
        }
      }
      return this;
    },

    /**
     * @private
     * @param {String} key
     * @param {*} value
     * @return {fabric.Object} thisArg
     */
    _set: function(key, value) {
      var shouldConstrainValue = (key === 'scaleX' || key === 'scaleY');

      if (shouldConstrainValue) {
        value = this._constrainScale(value);
      }
      if (key === 'scaleX' && value < 0) {
        this.flipX = !this.flipX;
        value *= -1;
      }
      else if (key === 'scaleY' && value < 0) {
        this.flipY = !this.flipY;
        value *= -1;
      }
      else if (key === 'shadow' && value && !(value instanceof fabric.Shadow)) {
        value = new fabric.Shadow(value);
      }

      this[key] = value;

      if (key === 'width' || key === 'height') {
        this.minScaleLimit = Math.min(0.1, 1 / Math.max(this.width, this.height));
      }

      return this;
    },

    /**
     * This callback function is called by the parent group of an object every
     * time a non-delegated property changes on the group. It is passed the key
     * and value as parameters. Not adding in this function's signature to avoid
     * Travis build error about unused variables.
     */
    setOnGroup: function() {
      // implemented by sub-classes, as needed.
    },

    /**
     * Toggles specified property from `true` to `false` or from `false` to `true`
     * @param {String} property Property to toggle
     * @return {fabric.Object} thisArg
     * @chainable
     */
    toggle: function(property) {
      var value = this.get(property);
      if (typeof value === 'boolean') {
        this.set(property, !value);
      }
      return this;
    },

    /**
     * Sets sourcePath of an object
     * @param {String} value Value to set sourcePath to
     * @return {fabric.Object} thisArg
     * @chainable
     */
    setSourcePath: function(value) {
      this.sourcePath = value;
      return this;
    },

    /**
     * Retrieves viewportTransform from Object's canvas if possible
     * @method getViewportTransform
     * @memberOf fabric.Object.prototype
     * @return {Boolean} flipY value // TODO
     */
    getViewportTransform: function() {
      if (this.canvas && this.canvas.viewportTransform) {
        return this.canvas.viewportTransform;
      }
      return [1, 0, 0, 1, 0, 0];
    },

    /**
     * Renders an object on a specified context
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Boolean} [noTransform] When true, context is not transformed
     */
    render: function(ctx, noTransform) {
      // do not render if width/height are zeros or object is not visible
      if ((this.width === 0 && this.height === 0) || !this.visible) {
        return;
      }

      ctx.save();

      //setup fill rule for current object
      this._setupCompositeOperation(ctx);
      this.drawSelectionBackground(ctx);
      if (!noTransform) {
        this.transform(ctx);
      }
      this._setOpacity(ctx);
      this._setShadow(ctx);
      this._renderBackground(ctx);
      this._setStrokeStyles(ctx);
      this._setFillStyles(ctx);
      if (this.transformMatrix) {
        ctx.transform.apply(ctx, this.transformMatrix);
      }
      this.clipTo && fabric.util.clipContext(this, ctx);
      this._render(ctx, noTransform);
      this.clipTo && ctx.restore();

      ctx.restore();
    },

    /**
     * Draws a background for the object big as its width and height;
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderBackground: function(ctx) {
      if (!this.backgroundColor) {
        return;
      }

      ctx.fillStyle = this.backgroundColor;

      ctx.fillRect(
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
      // if there is background color no other shadows
      // should be casted
      this._removeShadow(ctx);
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _setOpacity: function(ctx) {
      if (this.group) {
        this.group._setOpacity(ctx);
      }
      ctx.globalAlpha *= this.opacity;
    },

    _setStrokeStyles: function(ctx) {
      if (this.stroke) {
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = this.strokeLineCap;
        ctx.lineJoin = this.strokeLineJoin;
        ctx.miterLimit = this.strokeMiterLimit;
        ctx.strokeStyle = this.stroke.toLive
          ? this.stroke.toLive(ctx, this)
          : this.stroke;
      }
    },

    _setFillStyles: function(ctx) {
      if (this.fill) {
        ctx.fillStyle = this.fill.toLive
          ? this.fill.toLive(ctx, this)
          : this.fill;
      }
    },

    /**
     * @private
     * Sets line dash
     * @param {CanvasRenderingContext2D} ctx Context to set the dash line on
     * @param {Array} dashArray array representing dashes
     * @param {Function} alternative function to call if browaser does not support lineDash
     */
    _setLineDash: function(ctx, dashArray, alternative) {
      if (!dashArray) {
        return;
      }
      // Spec requires the concatenation of two copies the dash list when the number of elements is odd
      if (1 & dashArray.length) {
        dashArray.push.apply(dashArray, dashArray);
      }
      if (supportsLineDash) {
        ctx.setLineDash(dashArray);
      }
      else {
        alternative && alternative(ctx);
      }
    },

    /**
     * Renders controls and borders for the object
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Boolean} [noTransform] When true, context is not transformed
     */
    _renderControls: function(ctx, noTransform) {
      if (!this.active || noTransform
          || (this.group && this.group !== this.canvas.getActiveGroup())) {
        return;
      }

      var vpt = this.getViewportTransform(),
          matrix = this.calcTransformMatrix(),
          options;
      matrix = fabric.util.multiplyTransformMatrices(vpt, matrix);
      options = fabric.util.qrDecompose(matrix);

      ctx.save();
      ctx.translate(options.translateX, options.translateY);
      ctx.lineWidth = 1 * this.borderScaleFactor;
      ctx.globalAlpha = this.isMoving ? this.borderOpacityWhenMoving : 1;

      if (this.group && this.group === this.canvas.getActiveGroup()) {
        ctx.rotate(degreesToRadians(options.angle));
        this.drawBordersInGroup(ctx, options);
      }
      else {
        ctx.rotate(degreesToRadians(this.angle));
        this.drawBorders(ctx);
      }
      this.drawControls(ctx);
      ctx.restore();
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _setShadow: function(ctx) {
      if (!this.shadow) {
        return;
      }

      var multX = (this.canvas && this.canvas.viewportTransform[0]) || 1,
          multY = (this.canvas && this.canvas.viewportTransform[3]) || 1,
          scaling = this.getObjectScaling();
      if (this.canvas && this.canvas._isRetinaScaling()) {
        multX *= fabric.devicePixelRatio;
        multY *= fabric.devicePixelRatio;
      }
      ctx.shadowColor = this.shadow.color;
      ctx.shadowBlur = this.shadow.blur * (multX + multY) * (scaling.scaleX + scaling.scaleY) / 4;
      ctx.shadowOffsetX = this.shadow.offsetX * multX * scaling.scaleX;
      ctx.shadowOffsetY = this.shadow.offsetY * multY * scaling.scaleY;
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _removeShadow: function(ctx) {
      if (!this.shadow) {
        return;
      }

      ctx.shadowColor = '';
      ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderFill: function(ctx) {
      if (!this.fill) {
        return;
      }

      ctx.save();
      if (this.fill.gradientTransform) {
        var g = this.fill.gradientTransform;
        ctx.transform.apply(ctx, g);
      }
      if (this.fill.toLive) {
        ctx.translate(
          -this.width / 2 + this.fill.offsetX || 0,
          -this.height / 2 + this.fill.offsetY || 0);
      }
      if (this.fillRule === 'evenodd') {
        ctx.fill('evenodd');
      }
      else {
        ctx.fill();
      }
      ctx.restore();
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderStroke: function(ctx) {
      if (!this.stroke || this.strokeWidth === 0) {
        return;
      }

      if (this.shadow && !this.shadow.affectStroke) {
        this._removeShadow(ctx);
      }

      ctx.save();

      this._setLineDash(ctx, this.strokeDashArray, this._renderDashedStroke);
      if (this.stroke.gradientTransform) {
        var g = this.stroke.gradientTransform;
        ctx.transform.apply(ctx, g);
      }
      if (this.stroke.toLive) {
        ctx.translate(
          -this.width / 2 + this.stroke.offsetX || 0,
          -this.height / 2 + this.stroke.offsetY || 0);
      }
      ctx.stroke();
      ctx.restore();
    },

    /**
     * Clones an instance, some objects are async, so using callback method will work for every object.
     * Using the direct return does not work for images and groups.
     * @param {Function} callback Callback is invoked with a clone as a first argument
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {fabric.Object} clone of an instance
     */
    clone: function(callback, propertiesToInclude) {
      if (this.constructor.fromObject) {
        return this.constructor.fromObject(this.toObject(propertiesToInclude), callback);
      }
      return new fabric.Object(this.toObject(propertiesToInclude));
    },

    /**
     * Creates an instance of fabric.Image out of an object
     * @param {Function} callback callback, invoked with an instance as a first argument
     * @param {Object} [options] for clone as image, passed to toDataURL
     * @param {Boolean} [options.enableRetinaScaling] enable retina scaling for the cloned image
     * @return {fabric.Object} thisArg
     */
    cloneAsImage: function(callback, options) {
      var dataUrl = this.toDataURL(options);
      fabric.util.loadImage(dataUrl, function(img) {
        if (callback) {
          callback(new fabric.Image(img));
        }
      });
      return this;
    },

    /**
     * Converts an object into a data-url-like string
     * @param {Object} options Options object
     * @param {String} [options.format=png] The format of the output image. Either "jpeg" or "png"
     * @param {Number} [options.quality=1] Quality level (0..1). Only used for jpeg.
     * @param {Number} [options.multiplier=1] Multiplier to scale by
     * @param {Number} [options.left] Cropping left offset. Introduced in v1.2.14
     * @param {Number} [options.top] Cropping top offset. Introduced in v1.2.14
     * @param {Number} [options.width] Cropping width. Introduced in v1.2.14
     * @param {Number} [options.height] Cropping height. Introduced in v1.2.14
     * @param {Boolean} [options.enableRetina] Enable retina scaling for clone image. Introduce in 1.6.4
     * @return {String} Returns a data: URL containing a representation of the object in the format specified by options.format
     */
    toDataURL: function(options) {
      options || (options = { });

      var el = fabric.util.createCanvasElement(),
          boundingRect = this.getBoundingRect();

      el.width = boundingRect.width;
      el.height = boundingRect.height;
      fabric.util.wrapElement(el, 'div');
      var canvas = new fabric.StaticCanvas(el, { enableRetinaScaling: options.enableRetinaScaling });
      // to avoid common confusion https://github.com/kangax/fabric.js/issues/806
      if (options.format === 'jpg') {
        options.format = 'jpeg';
      }

      if (options.format === 'jpeg') {
        canvas.backgroundColor = '#fff';
      }

      var origParams = {
        active: this.get('active'),
        left: this.getLeft(),
        top: this.getTop()
      };

      this.set('active', false);
      this.setPositionByOrigin(new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2), 'center', 'center');

      var originalCanvas = this.canvas;
      canvas.add(this);
      var data = canvas.toDataURL(options);

      this.set(origParams).setCoords();
      this.canvas = originalCanvas;

      canvas.dispose();
      canvas = null;

      return data;
    },

    /**
     * Returns true if specified type is identical to the type of an instance
     * @param {String} type Type to check against
     * @return {Boolean}
     */
    isType: function(type) {
      return this.type === type;
    },

    /**
     * Returns complexity of an instance
     * @return {Number} complexity of this instance
     */
    complexity: function() {
      return 0;
    },

    /**
     * Returns a JSON representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} JSON
     */
    toJSON: function(propertiesToInclude) {
      // delegate, not alias
      return this.toObject(propertiesToInclude);
    },

    /**
     * Sets gradient (fill or stroke) of an object
     * <b>Backwards incompatibility note:</b> This method was named "setGradientFill" until v1.1.0
     * @param {String} property Property name 'stroke' or 'fill'
     * @param {Object} [options] Options object
     * @param {String} [options.type] Type of gradient 'radial' or 'linear'
     * @param {Number} [options.x1=0] x-coordinate of start point
     * @param {Number} [options.y1=0] y-coordinate of start point
     * @param {Number} [options.x2=0] x-coordinate of end point
     * @param {Number} [options.y2=0] y-coordinate of end point
     * @param {Number} [options.r1=0] Radius of start point (only for radial gradients)
     * @param {Number} [options.r2=0] Radius of end point (only for radial gradients)
     * @param {Object} [options.colorStops] Color stops object eg. {0: 'ff0000', 1: '000000'}
     * @param {Object} [options.gradientTransform] transforMatrix for gradient
     * @return {fabric.Object} thisArg
     * @chainable
     * @see {@link http://jsfiddle.net/fabricjs/58y8b/|jsFiddle demo}
     * @example <caption>Set linear gradient</caption>
     * object.setGradient('fill', {
     *   type: 'linear',
     *   x1: -object.width / 2,
     *   y1: 0,
     *   x2: object.width / 2,
     *   y2: 0,
     *   colorStops: {
     *     0: 'red',
     *     0.5: '#005555',
     *     1: 'rgba(0,0,255,0.5)'
     *   }
     * });
     * canvas.renderAll();
     * @example <caption>Set radial gradient</caption>
     * object.setGradient('fill', {
     *   type: 'radial',
     *   x1: 0,
     *   y1: 0,
     *   x2: 0,
     *   y2: 0,
     *   r1: object.width / 2,
     *   r2: 10,
     *   colorStops: {
     *     0: 'red',
     *     0.5: '#005555',
     *     1: 'rgba(0,0,255,0.5)'
     *   }
     * });
     * canvas.renderAll();
     */
    setGradient: function(property, options) {
      options || (options = { });

      var gradient = { colorStops: [] };

      gradient.type = options.type || (options.r1 || options.r2 ? 'radial' : 'linear');
      gradient.coords = {
        x1: options.x1,
        y1: options.y1,
        x2: options.x2,
        y2: options.y2
      };

      if (options.r1 || options.r2) {
        gradient.coords.r1 = options.r1;
        gradient.coords.r2 = options.r2;
      }

      options.gradientTransform && (gradient.gradientTransform = options.gradientTransform);

      for (var position in options.colorStops) {
        var color = new fabric.Color(options.colorStops[position]);
        gradient.colorStops.push({
          offset: position,
          color: color.toRgb(),
          opacity: color.getAlpha()
        });
      }

      return this.set(property, fabric.Gradient.forObject(this, gradient));
    },

    /**
     * Sets pattern fill of an object
     * @param {Object} options Options object
     * @param {(String|HTMLImageElement)} options.source Pattern source
     * @param {String} [options.repeat=repeat] Repeat property of a pattern (one of repeat, repeat-x, repeat-y or no-repeat)
     * @param {Number} [options.offsetX=0] Pattern horizontal offset from object's left/top corner
     * @param {Number} [options.offsetY=0] Pattern vertical offset from object's left/top corner
     * @return {fabric.Object} thisArg
     * @chainable
     * @see {@link http://jsfiddle.net/fabricjs/QT3pa/|jsFiddle demo}
     * @example <caption>Set pattern</caption>
     * fabric.util.loadImage('http://fabricjs.com/assets/escheresque_ste.png', function(img) {
     *   object.setPatternFill({
     *     source: img,
     *     repeat: 'repeat'
     *   });
     *   canvas.renderAll();
     * });
     */
    setPatternFill: function(options) {
      return this.set('fill', new fabric.Pattern(options));
    },

    /**
     * Sets {@link fabric.Object#shadow|shadow} of an object
     * @param {Object|String} [options] Options object or string (e.g. "2px 2px 10px rgba(0,0,0,0.2)")
     * @param {String} [options.color=rgb(0,0,0)] Shadow color
     * @param {Number} [options.blur=0] Shadow blur
     * @param {Number} [options.offsetX=0] Shadow horizontal offset
     * @param {Number} [options.offsetY=0] Shadow vertical offset
     * @return {fabric.Object} thisArg
     * @chainable
     * @see {@link http://jsfiddle.net/fabricjs/7gvJG/|jsFiddle demo}
     * @example <caption>Set shadow with string notation</caption>
     * object.setShadow('2px 2px 10px rgba(0,0,0,0.2)');
     * canvas.renderAll();
     * @example <caption>Set shadow with object notation</caption>
     * object.setShadow({
     *   color: 'red',
     *   blur: 10,
     *   offsetX: 20,
     *   offsetY: 20
     * });
     * canvas.renderAll();
     */
    setShadow: function(options) {
      return this.set('shadow', options ? new fabric.Shadow(options) : null);
    },

    /**
     * Sets "color" of an instance (alias of `set('fill', &hellip;)`)
     * @param {String} color Color value
     * @return {fabric.Object} thisArg
     * @chainable
     */
    setColor: function(color) {
      this.set('fill', color);
      return this;
    },

    /**
     * Sets "angle" of an instance
     * @param {Number} angle Angle value (in degrees)
     * @return {fabric.Object} thisArg
     * @chainable
     */
    setAngle: function(angle) {
      var shouldCenterOrigin = (this.originX !== 'center' || this.originY !== 'center') && this.centeredRotation;

      if (shouldCenterOrigin) {
        this._setOriginToCenter();
      }

      this.set('angle', angle);

      if (shouldCenterOrigin) {
        this._resetOrigin();
      }

      return this;
    },

    /**
     * Centers object horizontally on canvas to which it was added last.
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @return {fabric.Object} thisArg
     * @chainable
     */
    centerH: function () {
      this.canvas && this.canvas.centerObjectH(this);
      return this;
    },

    /**
     * Centers object horizontally on current viewport of canvas to which it was added last.
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @return {fabric.Object} thisArg
     * @chainable
     */
    viewportCenterH: function () {
      this.canvas && this.canvas.viewportCenterObjectH(this);
      return this;
    },

    /**
     * Centers object vertically on canvas to which it was added last.
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @return {fabric.Object} thisArg
     * @chainable
     */
    centerV: function () {
      this.canvas && this.canvas.centerObjectV(this);
      return this;
    },

    /**
     * Centers object vertically on current viewport of canvas to which it was added last.
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @return {fabric.Object} thisArg
     * @chainable
     */
    viewportCenterV: function () {
      this.canvas && this.canvas.viewportCenterObjectV(this);
      return this;
    },

    /**
     * Centers object vertically and horizontally on canvas to which is was added last
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @return {fabric.Object} thisArg
     * @chainable
     */
    center: function () {
      this.canvas && this.canvas.centerObject(this);
      return this;
    },

    /**
     * Centers object on current viewport of canvas to which it was added last.
     * You might need to call `setCoords` on an object after centering, to update controls area.
     * @return {fabric.Object} thisArg
     * @chainable
     */
    viewportCenter: function () {
      this.canvas && this.canvas.viewportCenterObject(this);
      return this;
    },

    /**
     * Removes object from canvas to which it was added last
     * @return {fabric.Object} thisArg
     * @chainable
     */
    remove: function() {
      this.canvas && this.canvas.remove(this);
      return this;
    },

    /**
     * Returns coordinates of a pointer relative to an object
     * @param {Event} e Event to operate upon
     * @param {Object} [pointer] Pointer to operate upon (instead of event)
     * @return {Object} Coordinates of a pointer (x, y)
     */
    getLocalPointer: function(e, pointer) {
      pointer = pointer || this.canvas.getPointer(e);
      var pClicked = new fabric.Point(pointer.x, pointer.y),
          objectLeftTop = this._getLeftTopCoords();
      if (this.angle) {
        pClicked = fabric.util.rotatePoint(
          pClicked, objectLeftTop, fabric.util.degreesToRadians(-this.angle));
      }
      return {
        x: pClicked.x - objectLeftTop.x,
        y: pClicked.y - objectLeftTop.y
      };
    },

    /**
     * Sets canvas globalCompositeOperation for specific object
     * custom composition operation for the particular object can be specifed using globalCompositeOperation property
     * @param {CanvasRenderingContext2D} ctx Rendering canvas context
     */
    _setupCompositeOperation: function (ctx) {
      if (this.globalCompositeOperation) {
        ctx.globalCompositeOperation = this.globalCompositeOperation;
      }
    }
  });

  fabric.util.createAccessors(fabric.Object);

  /**
   * Alias for {@link fabric.Object.prototype.setAngle}
   * @alias rotate -> setAngle
   * @memberOf fabric.Object
   */
  fabric.Object.prototype.rotate = fabric.Object.prototype.setAngle;

  extend(fabric.Object.prototype, fabric.Observable);

  /**
   * Defines the number of fraction digits to use when serializing object values.
   * You can use it to increase/decrease precision of such values like left, top, scaleX, scaleY, etc.
   * @static
   * @memberOf fabric.Object
   * @constant
   * @type Number
   */
  fabric.Object.NUM_FRACTION_DIGITS = 2;

  /**
   * Unique id used internally when creating SVG elements
   * @static
   * @memberOf fabric.Object
   * @type Number
   */
  fabric.Object.__uid = 0;

})(typeof exports !== 'undefined' ? exports : this);


(function() {

  var degreesToRadians = fabric.util.degreesToRadians,
      originXOffset = {
        left: -0.5,
        center: 0,
        right: 0.5
      },
      originYOffset = {
        top: -0.5,
        center: 0,
        bottom: 0.5
      };

  fabric.util.object.extend(fabric.Object.prototype, /** @lends fabric.Object.prototype */ {

    /**
     * Translates the coordinates from origin to center coordinates (based on the object's dimensions)
     * @param {fabric.Point} point The point which corresponds to the originX and originY params
     * @param {String} fromOriginX Horizontal origin: 'left', 'center' or 'right'
     * @param {String} fromOriginY Vertical origin: 'top', 'center' or 'bottom'
     * @param {String} toOriginX Horizontal origin: 'left', 'center' or 'right'
     * @param {String} toOriginY Vertical origin: 'top', 'center' or 'bottom'
     * @return {fabric.Point}
     */
    translateToGivenOrigin: function(point, fromOriginX, fromOriginY, toOriginX, toOriginY) {
      var x = point.x,
          y = point.y,
          offsetX, offsetY, dim;

      if (typeof fromOriginX === 'string') {
        fromOriginX = originXOffset[fromOriginX];
      }
      else {
        fromOriginX -= 0.5;
      }

      if (typeof toOriginX === 'string') {
        toOriginX = originXOffset[toOriginX];
      }
      else {
        toOriginX -= 0.5;
      }

      offsetX = toOriginX - fromOriginX;

      if (typeof fromOriginY === 'string') {
        fromOriginY = originYOffset[fromOriginY];
      }
      else {
        fromOriginY -= 0.5;
      }

      if (typeof toOriginY === 'string') {
        toOriginY = originYOffset[toOriginY];
      }
      else {
        toOriginY -= 0.5;
      }

      offsetY = toOriginY - fromOriginY;

      if (offsetX || offsetY) {
        dim = this._getTransformedDimensions();
        x = point.x + offsetX * dim.x;
        y = point.y + offsetY * dim.y;
      }

      return new fabric.Point(x, y);
    },

    /**
     * Translates the coordinates from origin to center coordinates (based on the object's dimensions)
     * @param {fabric.Point} point The point which corresponds to the originX and originY params
     * @param {String} originX Horizontal origin: 'left', 'center' or 'right'
     * @param {String} originY Vertical origin: 'top', 'center' or 'bottom'
     * @return {fabric.Point}
     */
    translateToCenterPoint: function(point, originX, originY) {
      var p = this.translateToGivenOrigin(point, originX, originY, 'center', 'center');
      if (this.angle) {
        return fabric.util.rotatePoint(p, point, degreesToRadians(this.angle));
      }
      return p;
    },

    /**
     * Translates the coordinates from center to origin coordinates (based on the object's dimensions)
     * @param {fabric.Point} center The point which corresponds to center of the object
     * @param {String} originX Horizontal origin: 'left', 'center' or 'right'
     * @param {String} originY Vertical origin: 'top', 'center' or 'bottom'
     * @return {fabric.Point}
     */
    translateToOriginPoint: function(center, originX, originY) {
      var p = this.translateToGivenOrigin(center, 'center', 'center', originX, originY);
      if (this.angle) {
        return fabric.util.rotatePoint(p, center, degreesToRadians(this.angle));
      }
      return p;
    },

    /**
     * Returns the real center coordinates of the object
     * @return {fabric.Point}
     */
    getCenterPoint: function() {
      var leftTop = new fabric.Point(this.left, this.top);
      return this.translateToCenterPoint(leftTop, this.originX, this.originY);
    },

    /**
     * Returns the coordinates of the object based on center coordinates
     * @param {fabric.Point} point The point which corresponds to the originX and originY params
     * @return {fabric.Point}
     */
    // getOriginPoint: function(center) {
    //   return this.translateToOriginPoint(center, this.originX, this.originY);
    // },

    /**
     * Returns the coordinates of the object as if it has a different origin
     * @param {String} originX Horizontal origin: 'left', 'center' or 'right'
     * @param {String} originY Vertical origin: 'top', 'center' or 'bottom'
     * @return {fabric.Point}
     */
    getPointByOrigin: function(originX, originY) {
      var center = this.getCenterPoint();
      return this.translateToOriginPoint(center, originX, originY);
    },

    /**
     * Returns the point in local coordinates
     * @param {fabric.Point} point The point relative to the global coordinate system
     * @param {String} originX Horizontal origin: 'left', 'center' or 'right'
     * @param {String} originY Vertical origin: 'top', 'center' or 'bottom'
     * @return {fabric.Point}
     */
    toLocalPoint: function(point, originX, originY) {
      var center = this.getCenterPoint(),
          p, p2;

      if (typeof originX !== 'undefined' && typeof originY !== 'undefined' ) {
        p = this.translateToGivenOrigin(center, 'center', 'center', originX, originY);
      }
      else {
        p = new fabric.Point(this.left, this.top);
      }

      p2 = new fabric.Point(point.x, point.y);
      if (this.angle) {
        p2 = fabric.util.rotatePoint(p2, center, -degreesToRadians(this.angle));
      }
      return p2.subtractEquals(p);
    },

    /**
     * Returns the point in global coordinates
     * @param {fabric.Point} The point relative to the local coordinate system
     * @return {fabric.Point}
     */
    // toGlobalPoint: function(point) {
    //   return fabric.util.rotatePoint(point, this.getCenterPoint(), degreesToRadians(this.angle)).addEquals(new fabric.Point(this.left, this.top));
    // },

    /**
     * Sets the position of the object taking into consideration the object's origin
     * @param {fabric.Point} pos The new position of the object
     * @param {String} originX Horizontal origin: 'left', 'center' or 'right'
     * @param {String} originY Vertical origin: 'top', 'center' or 'bottom'
     * @return {void}
     */
    setPositionByOrigin: function(pos, originX, originY) {
      var center = this.translateToCenterPoint(pos, originX, originY),
          position = this.translateToOriginPoint(center, this.originX, this.originY);

      this.set('left', position.x);
      this.set('top', position.y);
    },

    /**
     * @param {String} to One of 'left', 'center', 'right'
     */
    adjustPosition: function(to) {
      var angle = degreesToRadians(this.angle),
          hypotFull = this.getWidth(),
          xFull = Math.cos(angle) * hypotFull,
          yFull = Math.sin(angle) * hypotFull,
          offsetFrom, offsetTo;

      //TODO: this function does not consider mixed situation like top, center.
      if (typeof this.originX === 'string') {
        offsetFrom = originXOffset[this.originX];
      }
      else {
        offsetFrom = this.originX - 0.5;
      }
      if (typeof to === 'string') {
        offsetTo = originXOffset[to];
      }
      else {
        offsetTo = to - 0.5;
      }
      this.left += xFull * (offsetTo - offsetFrom);
      this.top += yFull * (offsetTo - offsetFrom);
      this.setCoords();
      this.originX = to;
    },

    /**
     * Sets the origin/position of the object to it's center point
     * @private
     * @return {void}
     */
    _setOriginToCenter: function() {
      this._originalOriginX = this.originX;
      this._originalOriginY = this.originY;

      var center = this.getCenterPoint();

      this.originX = 'center';
      this.originY = 'center';

      this.left = center.x;
      this.top = center.y;
    },

    /**
     * Resets the origin/position of the object to it's original origin
     * @private
     * @return {void}
     */
    _resetOrigin: function() {
      var originPoint = this.translateToOriginPoint(
        this.getCenterPoint(),
        this._originalOriginX,
        this._originalOriginY);

      this.originX = this._originalOriginX;
      this.originY = this._originalOriginY;

      this.left = originPoint.x;
      this.top = originPoint.y;

      this._originalOriginX = null;
      this._originalOriginY = null;
    },

    /**
     * @private
     */
    _getLeftTopCoords: function() {
      return this.translateToOriginPoint(this.getCenterPoint(), 'left', 'top');
    }
  });

})();


(function() {

  function getCoords(oCoords) {
    return [
      new fabric.Point(oCoords.tl.x, oCoords.tl.y),
      new fabric.Point(oCoords.tr.x, oCoords.tr.y),
      new fabric.Point(oCoords.br.x, oCoords.br.y),
      new fabric.Point(oCoords.bl.x, oCoords.bl.y)
    ];
  }

  var degreesToRadians = fabric.util.degreesToRadians,
      multiplyMatrices = fabric.util.multiplyTransformMatrices;

  fabric.util.object.extend(fabric.Object.prototype, /** @lends fabric.Object.prototype */ {

    /**
     * Object containing coordinates of object's controls
     * @type Object
     * @default
     */
    oCoords: null,

    /**
     * Checks if object intersects with an area formed by 2 points
     * @param {Object} pointTL top-left point of area
     * @param {Object} pointBR bottom-right point of area
     * @return {Boolean} true if object intersects with an area formed by 2 points
     */
    intersectsWithRect: function(pointTL, pointBR) {
      var oCoords = getCoords(this.oCoords),
          intersection = fabric.Intersection.intersectPolygonRectangle(
            oCoords,
            pointTL,
            pointBR
          );
      return intersection.status === 'Intersection';
    },

    /**
     * Checks if object intersects with another object
     * @param {Object} other Object to test
     * @return {Boolean} true if object intersects with another object
     */
    intersectsWithObject: function(other) {
      var intersection = fabric.Intersection.intersectPolygonPolygon(
            getCoords(this.oCoords),
            getCoords(other.oCoords)
          );

      return intersection.status === 'Intersection'
        || other.isContainedWithinObject(this)
        || this.isContainedWithinObject(other);
    },

    /**
     * Checks if object is fully contained within area of another object
     * @param {Object} other Object to test
     * @return {Boolean} true if object is fully contained within area of another object
     */
    isContainedWithinObject: function(other) {
      var points = getCoords(this.oCoords),
          i = 0;
      for (; i < 4; i++) {
        if (!other.containsPoint(points[i])) {
          return false;
        }
      }
      return true;
    },

    /**
     * Checks if object is fully contained within area formed by 2 points
     * @param {Object} pointTL top-left point of area
     * @param {Object} pointBR bottom-right point of area
     * @return {Boolean} true if object is fully contained within area formed by 2 points
     */
    isContainedWithinRect: function(pointTL, pointBR) {
      var boundingRect = this.getBoundingRect();

      return (
        boundingRect.left >= pointTL.x &&
        boundingRect.left + boundingRect.width <= pointBR.x &&
        boundingRect.top >= pointTL.y &&
        boundingRect.top + boundingRect.height <= pointBR.y
      );
    },

    /**
     * Checks if point is inside the object
     * @param {fabric.Point} point Point to check against
     * @return {Boolean} true if point is inside the object
     */
    containsPoint: function(point) {
      if (!this.oCoords) {
        this.setCoords();
      }
      var lines = this._getImageLines(this.oCoords),
          xPoints = this._findCrossPoints(point, lines);

      // if xPoints is odd then point is inside the object
      return (xPoints !== 0 && xPoints % 2 === 1);
    },

    /**
     * Method that returns an object with the object edges in it, given the coordinates of the corners
     * @private
     * @param {Object} oCoords Coordinates of the object corners
     */
    _getImageLines: function(oCoords) {
      return {
        topline: {
          o: oCoords.tl,
          d: oCoords.tr
        },
        rightline: {
          o: oCoords.tr,
          d: oCoords.br
        },
        bottomline: {
          o: oCoords.br,
          d: oCoords.bl
        },
        leftline: {
          o: oCoords.bl,
          d: oCoords.tl
        }
      };
    },

    /**
     * Helper method to determine how many cross points are between the 4 object edges
     * and the horizontal line determined by a point on canvas
     * @private
     * @param {fabric.Point} point Point to check
     * @param {Object} oCoords Coordinates of the object being evaluated
     */
     // remove yi, not used but left code here just in case.
    _findCrossPoints: function(point, oCoords) {
      var b1, b2, a1, a2, xi, // yi,
          xcount = 0,
          iLine;

      for (var lineKey in oCoords) {
        iLine = oCoords[lineKey];
        // optimisation 1: line below point. no cross
        if ((iLine.o.y < point.y) && (iLine.d.y < point.y)) {
          continue;
        }
        // optimisation 2: line above point. no cross
        if ((iLine.o.y >= point.y) && (iLine.d.y >= point.y)) {
          continue;
        }
        // optimisation 3: vertical line case
        if ((iLine.o.x === iLine.d.x) && (iLine.o.x >= point.x)) {
          xi = iLine.o.x;
          // yi = point.y;
        }
        // calculate the intersection point
        else {
          b1 = 0;
          b2 = (iLine.d.y - iLine.o.y) / (iLine.d.x - iLine.o.x);
          a1 = point.y - b1 * point.x;
          a2 = iLine.o.y - b2 * iLine.o.x;

          xi = -(a1 - a2) / (b1 - b2);
          // yi = a1 + b1 * xi;
        }
        // dont count xi < point.x cases
        if (xi >= point.x) {
          xcount += 1;
        }
        // optimisation 4: specific for square images
        if (xcount === 2) {
          break;
        }
      }
      return xcount;
    },

    /**
     * Returns width of an object's bounding rectangle
     * @deprecated since 1.0.4
     * @return {Number} width value
     */
    getBoundingRectWidth: function() {
      return this.getBoundingRect().width;
    },

    /**
     * Returns height of an object's bounding rectangle
     * @deprecated since 1.0.4
     * @return {Number} height value
     */
    getBoundingRectHeight: function() {
      return this.getBoundingRect().height;
    },

    /**
     * Returns coordinates of object's bounding rectangle (left, top, width, height)
     * @return {Object} Object with left, top, width, height properties
     */
    getBoundingRect: function() {
      this.oCoords || this.setCoords();
      return fabric.util.makeBoundingBoxFromPoints([
        this.oCoords.tl,
        this.oCoords.tr,
        this.oCoords.br,
        this.oCoords.bl
      ]);
    },

    /**
     * Returns width of an object bounding box counting transformations
     * @return {Number} width value
     */
    getWidth: function() {
      return this._getTransformedDimensions().x;
    },

    /**
     * Returns height of an object bounding box counting transformations
     * to be renamed in 2.0
     * @return {Number} height value
     */
    getHeight: function() {
      return this._getTransformedDimensions().y;
    },

    /**
     * Makes sure the scale is valid and modifies it if necessary
     * @private
     * @param {Number} value
     * @return {Number}
     */
    _constrainScale: function(value) {
      if (Math.abs(value) < this.minScaleLimit) {
        if (value < 0) {
          return -this.minScaleLimit;
        }
        else {
          return this.minScaleLimit;
        }
      }
      return value;
    },

    /**
     * Scales an object (equally by x and y)
     * @param {Number} value Scale factor
     * @return {fabric.Object} thisArg
     * @chainable
     */
    scale: function(value) {
      value = this._constrainScale(value);

      if (value < 0) {
        this.flipX = !this.flipX;
        this.flipY = !this.flipY;
        value *= -1;
      }

      this.scaleX = value;
      this.scaleY = value;
      this.setCoords();
      return this;
    },

    /**
     * Scales an object to a given width, with respect to bounding box (scaling by x/y equally)
     * @param {Number} value New width value
     * @return {fabric.Object} thisArg
     * @chainable
     */
    scaleToWidth: function(value) {
      // adjust to bounding rect factor so that rotated shapes would fit as well
      var boundingRectFactor = this.getBoundingRect().width / this.getWidth();
      return this.scale(value / this.width / boundingRectFactor);
    },

    /**
     * Scales an object to a given height, with respect to bounding box (scaling by x/y equally)
     * @param {Number} value New height value
     * @return {fabric.Object} thisArg
     * @chainable
     */
    scaleToHeight: function(value) {
      // adjust to bounding rect factor so that rotated shapes would fit as well
      var boundingRectFactor = this.getBoundingRect().height / this.getHeight();
      return this.scale(value / this.height / boundingRectFactor);
    },

    /**
     * Sets corner position coordinates based on current angle, width and height
     * See https://github.com/kangax/fabric.js/wiki/When-to-call-setCoords
     * @return {fabric.Object} thisArg
     * @chainable
     */
    setCoords: function() {
      var theta = degreesToRadians(this.angle),
          vpt = this.getViewportTransform(),
          dim = this._calculateCurrentDimensions(),
          currentWidth = dim.x, currentHeight = dim.y;

      // If width is negative, make postive. Fixes path selection issue
      if (currentWidth < 0) {
        currentWidth = Math.abs(currentWidth);
      }

      var sinTh = Math.sin(theta),
          cosTh = Math.cos(theta),
          _angle = currentWidth > 0 ? Math.atan(currentHeight / currentWidth) : 0,
          _hypotenuse = (currentWidth / Math.cos(_angle)) / 2,
          offsetX = Math.cos(_angle + theta) * _hypotenuse,
          offsetY = Math.sin(_angle + theta) * _hypotenuse,

          // offset added for rotate and scale actions
          coords = fabric.util.transformPoint(this.getCenterPoint(), vpt),
          tl  = new fabric.Point(coords.x - offsetX, coords.y - offsetY),
          tr  = new fabric.Point(tl.x + (currentWidth * cosTh), tl.y + (currentWidth * sinTh)),
          bl  = new fabric.Point(tl.x - (currentHeight * sinTh), tl.y + (currentHeight * cosTh)),
          br  = new fabric.Point(coords.x + offsetX, coords.y + offsetY),
          ml  = new fabric.Point((tl.x + bl.x) / 2, (tl.y + bl.y) / 2),
          mt  = new fabric.Point((tr.x + tl.x) / 2, (tr.y + tl.y) / 2),
          mr  = new fabric.Point((br.x + tr.x) / 2, (br.y + tr.y) / 2),
          mb  = new fabric.Point((br.x + bl.x) / 2, (br.y + bl.y) / 2),
          mtr = new fabric.Point(mt.x + sinTh * this.rotatingPointOffset, mt.y - cosTh * this.rotatingPointOffset);
      // debugging

      /* setTimeout(function() {
         canvas.contextTop.fillStyle = 'green';
         canvas.contextTop.fillRect(mb.x, mb.y, 3, 3);
         canvas.contextTop.fillRect(bl.x, bl.y, 3, 3);
         canvas.contextTop.fillRect(br.x, br.y, 3, 3);
         canvas.contextTop.fillRect(tl.x, tl.y, 3, 3);
         canvas.contextTop.fillRect(tr.x, tr.y, 3, 3);
         canvas.contextTop.fillRect(ml.x, ml.y, 3, 3);
         canvas.contextTop.fillRect(mr.x, mr.y, 3, 3);
         canvas.contextTop.fillRect(mt.x, mt.y, 3, 3);
         canvas.contextTop.fillRect(mtr.x, mtr.y, 3, 3);
       }, 50); */

      this.oCoords = {
        // corners
        tl: tl, tr: tr, br: br, bl: bl,
        // middle
        ml: ml, mt: mt, mr: mr, mb: mb,
        // rotating point
        mtr: mtr
      };

      // set coordinates of the draggable boxes in the corners used to scale/rotate the image
      this._setCornerCoords && this._setCornerCoords();

      return this;
    },

    /*
     * calculate rotation matrix of an object
     * @return {Array} rotation matrix for the object
     */
    _calcRotateMatrix: function() {
      if (this.angle) {
        var theta = degreesToRadians(this.angle), cos = Math.cos(theta), sin = Math.sin(theta);
        return [cos, sin, -sin, cos, 0, 0];
      }
      return [1, 0, 0, 1, 0, 0];
    },

    /*
     * calculate trasform Matrix that represent current transformation from
     * object properties.
     * @return {Array} matrix Transform Matrix for the object
     */
    calcTransformMatrix: function() {
      var center = this.getCenterPoint(),
          translateMatrix = [1, 0, 0, 1, center.x, center.y],
          rotateMatrix = this._calcRotateMatrix(),
          dimensionMatrix = this._calcDimensionsTransformMatrix(this.skewX, this.skewY, true),
          matrix = this.group ? this.group.calcTransformMatrix() : [1, 0, 0, 1, 0, 0];
      matrix = multiplyMatrices(matrix, translateMatrix);
      matrix = multiplyMatrices(matrix, rotateMatrix);
      matrix = multiplyMatrices(matrix, dimensionMatrix);
      return matrix;
    },

    _calcDimensionsTransformMatrix: function(skewX, skewY, flipping) {
      var skewMatrixX = [1, 0, Math.tan(degreesToRadians(skewX)), 1],
          skewMatrixY = [1, Math.tan(degreesToRadians(skewY)), 0, 1],
          scaleX = this.scaleX * (flipping && this.flipX ? -1 : 1),
          scaleY = this.scaleY * (flipping && this.flipY ? -1 : 1),
          scaleMatrix = [scaleX, 0, 0, scaleY],
          m = multiplyMatrices(scaleMatrix, skewMatrixX, true);
      return multiplyMatrices(m, skewMatrixY, true);
    }
  });
})();


fabric.util.object.extend(fabric.Object.prototype, /** @lends fabric.Object.prototype */ {

  /**
   * Moves an object to the bottom of the stack of drawn objects
   * @return {fabric.Object} thisArg
   * @chainable
   */
  sendToBack: function() {
    if (this.group) {
      fabric.StaticCanvas.prototype.sendToBack.call(this.group, this);
    }
    else {
      this.canvas.sendToBack(this);
    }
    return this;
  },

  /**
   * Moves an object to the top of the stack of drawn objects
   * @return {fabric.Object} thisArg
   * @chainable
   */
  bringToFront: function() {
    if (this.group) {
      fabric.StaticCanvas.prototype.bringToFront.call(this.group, this);
    }
    else {
      this.canvas.bringToFront(this);
    }
    return this;
  },

  /**
   * Moves an object down in stack of drawn objects
   * @param {Boolean} [intersecting] If `true`, send object behind next lower intersecting object
   * @return {fabric.Object} thisArg
   * @chainable
   */
  sendBackwards: function(intersecting) {
    if (this.group) {
      fabric.StaticCanvas.prototype.sendBackwards.call(this.group, this, intersecting);
    }
    else {
      this.canvas.sendBackwards(this, intersecting);
    }
    return this;
  },

  /**
   * Moves an object up in stack of drawn objects
   * @param {Boolean} [intersecting] If `true`, send object in front of next upper intersecting object
   * @return {fabric.Object} thisArg
   * @chainable
   */
  bringForward: function(intersecting) {
    if (this.group) {
      fabric.StaticCanvas.prototype.bringForward.call(this.group, this, intersecting);
    }
    else {
      this.canvas.bringForward(this, intersecting);
    }
    return this;
  },

  /**
   * Moves an object to specified level in stack of drawn objects
   * @param {Number} index New position of object
   * @return {fabric.Object} thisArg
   * @chainable
   */
  moveTo: function(index) {
    if (this.group) {
      fabric.StaticCanvas.prototype.moveTo.call(this.group, this, index);
    }
    else {
      this.canvas.moveTo(this, index);
    }
    return this;
  }
});


/* _TO_SVG_START_ */
(function() {

  function getSvgColorString(prop, value) {
    if (!value) {
      return prop + ': none; ';
    }
    else if (value.toLive) {
      return prop + ': url(#SVGID_' + value.id + '); ';
    }
    else {
      var color = new fabric.Color(value),
          str = prop + ': ' + color.toRgb() + '; ',
          opacity = color.getAlpha();
      if (opacity !== 1) {
        //change the color in rgb + opacity
        str += prop + '-opacity: ' + opacity.toString() + '; ';
      }
      return str;
    }
  }

  fabric.util.object.extend(fabric.Object.prototype, /** @lends fabric.Object.prototype */ {
    /**
     * Returns styles-string for svg-export
     * @param {Boolean} skipShadow a boolean to skip shadow filter output
     * @return {String}
     */
    getSvgStyles: function(skipShadow) {

      var fillRule = this.fillRule,
          strokeWidth = this.strokeWidth ? this.strokeWidth : '0',
          strokeDashArray = this.strokeDashArray ? this.strokeDashArray.join(' ') : 'none',
          strokeLineCap = this.strokeLineCap ? this.strokeLineCap : 'butt',
          strokeLineJoin = this.strokeLineJoin ? this.strokeLineJoin : 'miter',
          strokeMiterLimit = this.strokeMiterLimit ? this.strokeMiterLimit : '4',
          opacity = typeof this.opacity !== 'undefined' ? this.opacity : '1',
          visibility = this.visible ? '' : ' visibility: hidden;',
          filter = skipShadow ? '' : this.getSvgFilter(),
          fill = getSvgColorString('fill', this.fill),
          stroke = getSvgColorString('stroke', this.stroke);

      return [
        stroke,
        'stroke-width: ', strokeWidth, '; ',
        'stroke-dasharray: ', strokeDashArray, '; ',
        'stroke-linecap: ', strokeLineCap, '; ',
        'stroke-linejoin: ', strokeLineJoin, '; ',
        'stroke-miterlimit: ', strokeMiterLimit, '; ',
        fill,
        'fill-rule: ', fillRule, '; ',
        'opacity: ', opacity, ';',
        filter,
        visibility
      ].join('');
    },

    /**
     * Returns filter for svg shadow
     * @return {String}
     */
    getSvgFilter: function() {
      return this.shadow ? 'filter: url(#SVGID_' + this.shadow.id + ');' : '';
    },

    /**
     * Returns id attribute for svg output
     * @return {String}
     */
    getSvgId: function() {
      return this.id ? 'id="' + this.id + '" ' : '';
    },

    /**
     * Returns transform-string for svg-export
     * @return {String}
     */
    getSvgTransform: function() {
      if (this.group && this.group.type === 'path-group') {
        return '';
      }
      var toFixed = fabric.util.toFixed,
          angle = this.getAngle(),
          skewX = (this.getSkewX() % 360),
          skewY = (this.getSkewY() % 360),
          center = this.getCenterPoint(),

          NUM_FRACTION_DIGITS = fabric.Object.NUM_FRACTION_DIGITS,

          translatePart = this.type === 'path-group' ? '' : 'translate(' +
                            toFixed(center.x, NUM_FRACTION_DIGITS) +
                            ' ' +
                            toFixed(center.y, NUM_FRACTION_DIGITS) +
                          ')',

          anglePart = angle !== 0
            ? (' rotate(' + toFixed(angle, NUM_FRACTION_DIGITS) + ')')
            : '',

          scalePart = (this.scaleX === 1 && this.scaleY === 1)
            ? '' :
            (' scale(' +
              toFixed(this.scaleX, NUM_FRACTION_DIGITS) +
              ' ' +
              toFixed(this.scaleY, NUM_FRACTION_DIGITS) +
            ')'),

          skewXPart = skewX !== 0 ? ' skewX(' + toFixed(skewX, NUM_FRACTION_DIGITS) + ')' : '',

          skewYPart = skewY !== 0 ? ' skewY(' + toFixed(skewY, NUM_FRACTION_DIGITS) + ')' : '',

          addTranslateX = this.type === 'path-group' ? this.width : 0,

          flipXPart = this.flipX ? ' matrix(-1 0 0 1 ' + addTranslateX + ' 0) ' : '',

          addTranslateY = this.type === 'path-group' ? this.height : 0,

          flipYPart = this.flipY ? ' matrix(1 0 0 -1 0 ' + addTranslateY + ')' : '';

      return [
        translatePart, anglePart, scalePart, flipXPart, flipYPart, skewXPart, skewYPart
      ].join('');
    },

    /**
     * Returns transform-string for svg-export from the transform matrix of single elements
     * @return {String}
     */
    getSvgTransformMatrix: function() {
      return this.transformMatrix ? ' matrix(' + this.transformMatrix.join(' ') + ') ' : '';
    },

    /**
     * @private
     */
    _createBaseSVGMarkup: function() {
      var markup = [];

      if (this.fill && this.fill.toLive) {
        markup.push(this.fill.toSVG(this, false));
      }
      if (this.stroke && this.stroke.toLive) {
        markup.push(this.stroke.toSVG(this, false));
      }
      if (this.shadow) {
        markup.push(this.shadow.toSVG(this));
      }
      return markup;
    }
  });
})();
/* _TO_SVG_END_ */


(function() {

  var extend = fabric.util.object.extend;

  /*
    Depends on `stateProperties`
  */
  function saveProps(origin, destination, props) {
    var tmpObj = { }, deep = true;
    props.forEach(function(prop) {
      tmpObj[prop] = origin[prop];
    });
    extend(origin[destination], tmpObj, deep);
  }

  function _isEqual(origValue, currentValue) {
    if (!fabric.isLikelyNode && origValue instanceof Element) {
      // avoid checking deep html elements
      return origValue === currentValue;
    }
    else if (origValue instanceof Array) {
      if (origValue.length !== currentValue.length) {
        return false
      }
      var _currentValue = currentValue.concat().sort(),
          _origValue = origValue.concat().sort();
      return !_origValue.some(function(v, i) {
        return !_isEqual(_currentValue[i], v);
      });
    }
    else if (origValue instanceof Object) {
      for (var key in origValue) {
        if (!_isEqual(origValue[key], currentValue[key])) {
          return false;
        }
      }
      return true;
    }
    else {
      return origValue === currentValue;
    }
  }


  fabric.util.object.extend(fabric.Object.prototype, /** @lends fabric.Object.prototype */ {

    /**
     * Returns true if object state (one of its state properties) was changed
     * @return {Boolean} true if instance' state has changed since `{@link fabric.Object#saveState}` was called
     */
    hasStateChanged: function() {
      return !_isEqual(this.originalState, this);
    },

    /**
     * Saves state of an object
     * @param {Object} [options] Object with additional `stateProperties` array to include when saving state
     * @return {fabric.Object} thisArg
     */
    saveState: function(options) {
      saveProps(this, 'originalState', this.stateProperties);
      if (options && options.stateProperties) {
        saveProps(this, 'originalState', options.stateProperties);
      }
      return this;
    },

    /**
     * Setups state of an object
     * @param {Object} [options] Object with additional `stateProperties` array to include when saving state
     * @return {fabric.Object} thisArg
     */
    setupState: function(options) {
      this.originalState = { };
      this.saveState(options);
      return this;
    }
  });
})();


(function() {

  var degreesToRadians = fabric.util.degreesToRadians,
      /* eslint-disable camelcase */
      isVML = function() { return typeof G_vmlCanvasManager !== 'undefined'; };
      /* eslint-enable camelcase */
  fabric.util.object.extend(fabric.Object.prototype, /** @lends fabric.Object.prototype */ {

    /**
     * The object interactivity controls.
     * @private
     */
    _controlsVisibility: null,

    /**
     * Determines which corner has been clicked
     * @private
     * @param {Object} pointer The pointer indicating the mouse position
     * @return {String|Boolean} corner code (tl, tr, bl, br, etc.), or false if nothing is found
     */
    _findTargetCorner: function(pointer) {
      if (!this.hasControls || !this.active) {
        return false;
      }

      var ex = pointer.x,
          ey = pointer.y,
          xPoints,
          lines;
      this.__corner = 0;
      for (var i in this.oCoords) {

        if (!this.isControlVisible(i)) {
          continue;
        }

        if (i === 'mtr' && !this.hasRotatingPoint) {
          continue;
        }

        if (this.get('lockUniScaling') &&
           (i === 'mt' || i === 'mr' || i === 'mb' || i === 'ml')) {
          continue;
        }

        lines = this._getImageLines(this.oCoords[i].corner);

        // debugging

        // canvas.contextTop.fillRect(lines.bottomline.d.x, lines.bottomline.d.y, 2, 2);
        // canvas.contextTop.fillRect(lines.bottomline.o.x, lines.bottomline.o.y, 2, 2);

        // canvas.contextTop.fillRect(lines.leftline.d.x, lines.leftline.d.y, 2, 2);
        // canvas.contextTop.fillRect(lines.leftline.o.x, lines.leftline.o.y, 2, 2);

        // canvas.contextTop.fillRect(lines.topline.d.x, lines.topline.d.y, 2, 2);
        // canvas.contextTop.fillRect(lines.topline.o.x, lines.topline.o.y, 2, 2);

        // canvas.contextTop.fillRect(lines.rightline.d.x, lines.rightline.d.y, 2, 2);
        // canvas.contextTop.fillRect(lines.rightline.o.x, lines.rightline.o.y, 2, 2);

        xPoints = this._findCrossPoints({ x: ex, y: ey }, lines);
        if (xPoints !== 0 && xPoints % 2 === 1) {
          this.__corner = i;
          return i;
        }
      }
      return false;
    },

    /**
     * Sets the coordinates of the draggable boxes in the corners of
     * the image used to scale/rotate it.
     * @private
     */
    _setCornerCoords: function() {
      var coords = this.oCoords,
          newTheta = degreesToRadians(45 - this.angle),
          /* Math.sqrt(2 * Math.pow(this.cornerSize, 2)) / 2, */
          /* 0.707106 stands for sqrt(2)/2 */
          cornerHypotenuse = this.cornerSize * 0.707106,
          cosHalfOffset = cornerHypotenuse * Math.cos(newTheta),
          sinHalfOffset = cornerHypotenuse * Math.sin(newTheta),
          x, y;

      for (var point in coords) {
        x = coords[point].x;
        y = coords[point].y;
        coords[point].corner = {
          tl: {
            x: x - sinHalfOffset,
            y: y - cosHalfOffset
          },
          tr: {
            x: x + cosHalfOffset,
            y: y - sinHalfOffset
          },
          bl: {
            x: x - cosHalfOffset,
            y: y + sinHalfOffset
          },
          br: {
            x: x + sinHalfOffset,
            y: y + cosHalfOffset
          }
        };
      }
    },

    /*
     * Calculate object dimensions from its properties
     * @private
     */
    _getNonTransformedDimensions: function() {
      var strokeWidth = this.strokeWidth,
          w = this.width,
          h = this.height,
          addStrokeToW = true,
          addStrokeToH = true;

      if (this.type === 'line' && this.strokeLineCap === 'butt') {
        addStrokeToH = w;
        addStrokeToW = h;
      }

      if (addStrokeToH) {
        h += h < 0 ? -strokeWidth : strokeWidth;
      }

      if (addStrokeToW) {
        w += w < 0 ? -strokeWidth : strokeWidth;
      }

      return { x: w, y: h };
    },

    /*
     * @private
     */
    _getTransformedDimensions: function(skewX, skewY) {
      if (typeof skewX === 'undefined') {
        skewX = this.skewX;
      }
      if (typeof skewY === 'undefined') {
        skewY = this.skewY;
      }
      var dimensions = this._getNonTransformedDimensions(),
          dimX = dimensions.x / 2, dimY = dimensions.y / 2,
          points = [
            {
              x: -dimX,
              y: -dimY
            },
            {
              x: dimX,
              y: -dimY
            },
            {
              x: -dimX,
              y: dimY
            },
            {
              x: dimX,
              y: dimY
            }],
          i, transformMatrix = this._calcDimensionsTransformMatrix(skewX, skewY, false),
          bbox;
      for (i = 0; i < points.length; i++) {
        points[i] = fabric.util.transformPoint(points[i], transformMatrix);
      }
      bbox = fabric.util.makeBoundingBoxFromPoints(points);
      return { x: bbox.width, y: bbox.height };
    },

    /*
     * private
     */
    _calculateCurrentDimensions: function()  {
      var vpt = this.getViewportTransform(),
          dim = this._getTransformedDimensions(),
          w = dim.x, h = dim.y,
          p = fabric.util.transformPoint(new fabric.Point(w, h), vpt, true);

      return p.scalarAdd(2 * this.padding);
    },

    /**
     * Draws a colored layer behind the object, inside its selection borders.
     * Requires public options: padding, selectionBackgroundColor
     * this function is called when the context is transformed
     * @param {CanvasRenderingContext2D} ctx Context to draw on
     * @return {fabric.Object} thisArg
     * @chainable
     */
    drawSelectionBackground: function(ctx) {
      if (!this.selectionBackgroundColor || this.group || !this.active) {
        return this;
      }
      ctx.save();
      var center = this.getCenterPoint(), wh = this._calculateCurrentDimensions(),
          vpt = this.canvas.viewportTransform;
      ctx.translate(center.x, center.y);
      ctx.scale(1 / vpt[0], 1 / vpt[3]);
      ctx.rotate(degreesToRadians(this.angle));
      ctx.fillStyle = this.selectionBackgroundColor;
      ctx.fillRect(-wh.x / 2, -wh.y / 2, wh.x, wh.y);
      ctx.restore();
      return this;
    },

    /**
     * Draws borders of an object's bounding box.
     * Requires public properties: width, height
     * Requires public options: padding, borderColor
     * @param {CanvasRenderingContext2D} ctx Context to draw on
     * @return {fabric.Object} thisArg
     * @chainable
     */
    drawBorders: function(ctx) {
      if (!this.hasBorders) {
        return this;
      }

      var wh = this._calculateCurrentDimensions(),
          strokeWidth = 1 / this.borderScaleFactor,
          width = wh.x + strokeWidth,
          height = wh.y + strokeWidth;

      ctx.save();
      ctx.strokeStyle = this.borderColor;
      this._setLineDash(ctx, this.borderDashArray, null);

      ctx.strokeRect(
        -width / 2,
        -height / 2,
        width,
        height
      );

      if (this.hasRotatingPoint && this.isControlVisible('mtr') && !this.get('lockRotation') && this.hasControls) {

        var rotateHeight = -height / 2;

        ctx.beginPath();
        ctx.moveTo(0, rotateHeight);
        ctx.lineTo(0, rotateHeight - this.rotatingPointOffset);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.restore();
      return this;
    },

    /**
     * Draws borders of an object's bounding box when it is inside a group.
     * Requires public properties: width, height
     * Requires public options: padding, borderColor
     * @param {CanvasRenderingContext2D} ctx Context to draw on
     * @param {object} options object representing current object parameters
     * @return {fabric.Object} thisArg
     * @chainable
     */
    drawBordersInGroup: function(ctx, options) {
      if (!this.hasBorders) {
        return this;
      }

      var p = this._getNonTransformedDimensions(),
          matrix = fabric.util.customTransformMatrix(options.scaleX, options.scaleY, options.skewX),
          wh = fabric.util.transformPoint(p, matrix),
          strokeWidth = 1 / this.borderScaleFactor,
          width = wh.x + strokeWidth + 2 * this.padding,
          height = wh.y + strokeWidth + 2 * this.padding;

      ctx.save();
      this._setLineDash(ctx, this.borderDashArray, null);
      ctx.strokeStyle = this.borderColor;

      ctx.strokeRect(
        -width / 2,
        -height / 2,
        width,
        height
      );

      ctx.restore();
      return this;
    },

    /**
     * Draws corners of an object's bounding box.
     * Requires public properties: width, height
     * Requires public options: cornerSize, padding
     * @param {CanvasRenderingContext2D} ctx Context to draw on
     * @return {fabric.Object} thisArg
     * @chainable
     */
    drawControls: function(ctx) {
      if (!this.hasControls) {
        return this;
      }

      var wh = this._calculateCurrentDimensions(),
          width = wh.x,
          height = wh.y,
          scaleOffset = this.cornerSize,
          left = -(width + scaleOffset) / 2,
          top = -(height + scaleOffset) / 2,
          methodName = this.transparentCorners ? 'stroke' : 'fill';

      ctx.save();
      ctx.strokeStyle = ctx.fillStyle = this.cornerColor;
      if (!this.transparentCorners) {
        ctx.strokeStyle = this.cornerStrokeColor;
      }
      this._setLineDash(ctx, this.cornerDashArray, null);

      // top-left
      this._drawControl('tl', ctx, methodName,
        left,
        top);

      // top-right
      this._drawControl('tr', ctx, methodName,
        left + width,
        top);

      // bottom-left
      this._drawControl('bl', ctx, methodName,
        left,
        top + height);

      // bottom-right
      this._drawControl('br', ctx, methodName,
        left + width,
        top + height);

      if (!this.get('lockUniScaling')) {

        // middle-top
        this._drawControl('mt', ctx, methodName,
          left + width / 2,
          top);

        // middle-bottom
        this._drawControl('mb', ctx, methodName,
          left + width / 2,
          top + height);

        // middle-right
        this._drawControl('mr', ctx, methodName,
          left + width,
          top + height / 2);

        // middle-left
        this._drawControl('ml', ctx, methodName,
          left,
          top + height / 2);
      }

      // middle-top-rotate
      if (this.hasRotatingPoint) {
        this._drawControl('mtr', ctx, methodName,
          left + width / 2,
          top - this.rotatingPointOffset);
      }

      ctx.restore();

      return this;
    },

    /**
     * @private
     */
    _drawControl: function(control, ctx, methodName, left, top) {
      if (!this.isControlVisible(control)) {
        return;
      }
      var size = this.cornerSize, stroke = !this.transparentCorners && this.cornerStrokeColor;
      switch (this.cornerStyle) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(left + size / 2, top + size / 2, size / 2, 0, 2 * Math.PI, false);
          ctx[methodName]();
          if (stroke) {
            ctx.stroke();
          }
          break;
        default:
          isVML() || this.transparentCorners || ctx.clearRect(left, top, size, size);
          ctx[methodName + 'Rect'](left, top, size, size);
          if (stroke) {
            ctx.strokeRect(left, top, size, size);
          }
      }
    },

    /**
     * Returns true if the specified control is visible, false otherwise.
     * @param {String} controlName The name of the control. Possible values are 'tl', 'tr', 'br', 'bl', 'ml', 'mt', 'mr', 'mb', 'mtr'.
     * @returns {Boolean} true if the specified control is visible, false otherwise
     */
    isControlVisible: function(controlName) {
      return this._getControlsVisibility()[controlName];
    },

    /**
     * Sets the visibility of the specified control.
     * @param {String} controlName The name of the control. Possible values are 'tl', 'tr', 'br', 'bl', 'ml', 'mt', 'mr', 'mb', 'mtr'.
     * @param {Boolean} visible true to set the specified control visible, false otherwise
     * @return {fabric.Object} thisArg
     * @chainable
     */
    setControlVisible: function(controlName, visible) {
      this._getControlsVisibility()[controlName] = visible;
      return this;
    },

    /**
     * Sets the visibility state of object controls.
     * @param {Object} [options] Options object
     * @param {Boolean} [options.bl] true to enable the bottom-left control, false to disable it
     * @param {Boolean} [options.br] true to enable the bottom-right control, false to disable it
     * @param {Boolean} [options.mb] true to enable the middle-bottom control, false to disable it
     * @param {Boolean} [options.ml] true to enable the middle-left control, false to disable it
     * @param {Boolean} [options.mr] true to enable the middle-right control, false to disable it
     * @param {Boolean} [options.mt] true to enable the middle-top control, false to disable it
     * @param {Boolean} [options.tl] true to enable the top-left control, false to disable it
     * @param {Boolean} [options.tr] true to enable the top-right control, false to disable it
     * @param {Boolean} [options.mtr] true to enable the middle-top-rotate control, false to disable it
     * @return {fabric.Object} thisArg
     * @chainable
     */
    setControlsVisibility: function(options) {
      options || (options = { });

      for (var p in options) {
        this.setControlVisible(p, options[p]);
      }
      return this;
    },

    /**
     * Returns the instance of the control visibility set for this object.
     * @private
     * @returns {Object}
     */
    _getControlsVisibility: function() {
      if (!this._controlsVisibility) {
        this._controlsVisibility = {
          tl: true,
          tr: true,
          br: true,
          bl: true,
          ml: true,
          mt: true,
          mr: true,
          mb: true,
          mtr: true
        };
      }
      return this._controlsVisibility;
    }
  });
})();


fabric.util.object.extend(fabric.StaticCanvas.prototype, /** @lends fabric.StaticCanvas.prototype */ {

  /**
   * Animation duration (in ms) for fx* methods
   * @type Number
   * @default
   */
  FX_DURATION: 500,

  /**
   * Centers object horizontally with animation.
   * @param {fabric.Object} object Object to center
   * @param {Object} [callbacks] Callbacks object with optional "onComplete" and/or "onChange" properties
   * @param {Function} [callbacks.onComplete] Invoked on completion
   * @param {Function} [callbacks.onChange] Invoked on every step of animation
   * @return {fabric.Canvas} thisArg
   * @chainable
   */
  fxCenterObjectH: function (object, callbacks) {
    callbacks = callbacks || { };

    var empty = function() { },
        onComplete = callbacks.onComplete || empty,
        onChange = callbacks.onChange || empty,
        _this = this;

    fabric.util.animate({
      startValue: object.get('left'),
      endValue: this.getCenter().left,
      duration: this.FX_DURATION,
      onChange: function(value) {
        object.set('left', value);
        _this.renderAll();
        onChange();
      },
      onComplete: function() {
        object.setCoords();
        onComplete();
      }
    });

    return this;
  },

  /**
   * Centers object vertically with animation.
   * @param {fabric.Object} object Object to center
   * @param {Object} [callbacks] Callbacks object with optional "onComplete" and/or "onChange" properties
   * @param {Function} [callbacks.onComplete] Invoked on completion
   * @param {Function} [callbacks.onChange] Invoked on every step of animation
   * @return {fabric.Canvas} thisArg
   * @chainable
   */
  fxCenterObjectV: function (object, callbacks) {
    callbacks = callbacks || { };

    var empty = function() { },
        onComplete = callbacks.onComplete || empty,
        onChange = callbacks.onChange || empty,
        _this = this;

    fabric.util.animate({
      startValue: object.get('top'),
      endValue: this.getCenter().top,
      duration: this.FX_DURATION,
      onChange: function(value) {
        object.set('top', value);
        _this.renderAll();
        onChange();
      },
      onComplete: function() {
        object.setCoords();
        onComplete();
      }
    });

    return this;
  },

  /**
   * Same as `fabric.Canvas#remove` but animated
   * @param {fabric.Object} object Object to remove
   * @param {Object} [callbacks] Callbacks object with optional "onComplete" and/or "onChange" properties
   * @param {Function} [callbacks.onComplete] Invoked on completion
   * @param {Function} [callbacks.onChange] Invoked on every step of animation
   * @return {fabric.Canvas} thisArg
   * @chainable
   */
  fxRemove: function (object, callbacks) {
    callbacks = callbacks || { };

    var empty = function() { },
        onComplete = callbacks.onComplete || empty,
        onChange = callbacks.onChange || empty,
        _this = this;

    fabric.util.animate({
      startValue: object.get('opacity'),
      endValue: 0,
      duration: this.FX_DURATION,
      onStart: function() {
        object.set('active', false);
      },
      onChange: function(value) {
        object.set('opacity', value);
        _this.renderAll();
        onChange();
      },
      onComplete: function () {
        _this.remove(object);
        onComplete();
      }
    });

    return this;
  }
});

fabric.util.object.extend(fabric.Object.prototype, /** @lends fabric.Object.prototype */ {
  /**
   * Animates object's properties
   * @param {String|Object} property Property to animate (if string) or properties to animate (if object)
   * @param {Number|Object} value Value to animate property to (if string was given first) or options object
   * @return {fabric.Object} thisArg
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-2#animation}
   * @chainable
   *
   * As object — multiple properties
   *
   * object.animate({ left: ..., top: ... });
   * object.animate({ left: ..., top: ... }, { duration: ... });
   *
   * As string — one property
   *
   * object.animate('left', ...);
   * object.animate('left', { duration: ... });
   *
   */
  animate: function() {
    if (arguments[0] && typeof arguments[0] === 'object') {
      var propsToAnimate = [], prop, skipCallbacks;
      for (prop in arguments[0]) {
        propsToAnimate.push(prop);
      }
      for (var i = 0, len = propsToAnimate.length; i < len; i++) {
        prop = propsToAnimate[i];
        skipCallbacks = i !== len - 1;
        this._animate(prop, arguments[0][prop], arguments[1], skipCallbacks);
      }
    }
    else {
      this._animate.apply(this, arguments);
    }
    return this;
  },

  /**
   * @private
   * @param {String} property Property to animate
   * @param {String} to Value to animate to
   * @param {Object} [options] Options object
   * @param {Boolean} [skipCallbacks] When true, callbacks like onchange and oncomplete are not invoked
   */
  _animate: function(property, to, options, skipCallbacks) {
    var _this = this, propPair;

    to = to.toString();

    if (!options) {
      options = { };
    }
    else {
      options = fabric.util.object.clone(options);
    }

    if (~property.indexOf('.')) {
      propPair = property.split('.');
    }

    var currentValue = propPair
      ? this.get(propPair[0])[propPair[1]]
      : this.get(property);

    if (!('from' in options)) {
      options.from = currentValue;
    }

    if (~to.indexOf('=')) {
      to = currentValue + parseFloat(to.replace('=', ''));
    }
    else {
      to = parseFloat(to);
    }

    fabric.util.animate({
      startValue: options.from,
      endValue: to,
      byValue: options.by,
      easing: options.easing,
      duration: options.duration,
      abort: options.abort && function() {
        return options.abort.call(_this);
      },
      onChange: function(value) {
        if (propPair) {
          _this[propPair[0]][propPair[1]] = value;
        }
        else {
          _this.set(property, value);
        }
        if (skipCallbacks) {
          return;
        }
        options.onChange && options.onChange();
      },
      onComplete: function() {
        if (skipCallbacks) {
          return;
        }

        _this.setCoords();
        options.onComplete && options.onComplete();
      }
    });
  }
});


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      coordProps = { x1: 1, x2: 1, y1: 1, y2: 1 },
      supportsLineDash = fabric.StaticCanvas.supports('setLineDash');

  if (fabric.Line) {
    fabric.warn('fabric.Line is already defined');
    return;
  }

  /**
   * Line class
   * @class fabric.Line
   * @extends fabric.Object
   * @see {@link fabric.Line#initialize} for constructor definition
   */
  fabric.Line = fabric.util.createClass(fabric.Object, /** @lends fabric.Line.prototype */ {

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'line',

    /**
     * x value or first line edge
     * @type Number
     * @default
     */
    x1: 0,

    /**
     * y value or first line edge
     * @type Number
     * @default
     */
    y1: 0,

    /**
     * x value or second line edge
     * @type Number
     * @default
     */
    x2: 0,

    /**
     * y value or second line edge
     * @type Number
     * @default
     */
    y2: 0,

    /**
     * Constructor
     * @param {Array} [points] Array of points
     * @param {Object} [options] Options object
     * @return {fabric.Line} thisArg
     */
    initialize: function(points, options) {
      options = options || { };

      if (!points) {
        points = [0, 0, 0, 0];
      }

      this.callSuper('initialize', options);

      this.set('x1', points[0]);
      this.set('y1', points[1]);
      this.set('x2', points[2]);
      this.set('y2', points[3]);

      this._setWidthHeight(options);
    },

    /**
     * @private
     * @param {Object} [options] Options
     */
    _setWidthHeight: function(options) {
      options || (options = { });

      this.width = Math.abs(this.x2 - this.x1);
      this.height = Math.abs(this.y2 - this.y1);

      this.left = 'left' in options
        ? options.left
        : this._getLeftToOriginX();

      this.top = 'top' in options
        ? options.top
        : this._getTopToOriginY();
    },

    /**
     * @private
     * @param {String} key
     * @param {*} value
     */
    _set: function(key, value) {
      this.callSuper('_set', key, value);
      if (typeof coordProps[key] !== 'undefined') {
        this._setWidthHeight();
      }
      return this;
    },

    /**
     * @private
     * @return {Number} leftToOriginX Distance from left edge of canvas to originX of Line.
     */
    _getLeftToOriginX: makeEdgeToOriginGetter(
      { // property names
        origin: 'originX',
        axis1: 'x1',
        axis2: 'x2',
        dimension: 'width'
      },
      { // possible values of origin
        nearest: 'left',
        center: 'center',
        farthest: 'right'
      }
    ),

    /**
     * @private
     * @return {Number} topToOriginY Distance from top edge of canvas to originY of Line.
     */
    _getTopToOriginY: makeEdgeToOriginGetter(
      { // property names
        origin: 'originY',
        axis1: 'y1',
        axis2: 'y2',
        dimension: 'height'
      },
      { // possible values of origin
        nearest: 'top',
        center: 'center',
        farthest: 'bottom'
      }
    ),

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Boolean} noTransform
     */
    _render: function(ctx, noTransform) {
      ctx.beginPath();

      if (noTransform) {
        //  Line coords are distances from left-top of canvas to origin of line.
        //  To render line in a path-group, we need to translate them to
        //  distances from center of path-group to center of line.
        var cp = this.getCenterPoint();
        ctx.translate(
          cp.x - this.strokeWidth / 2,
          cp.y - this.strokeWidth / 2
        );
      }

      if (!this.strokeDashArray || this.strokeDashArray && supportsLineDash) {
        // move from center (of virtual box) to its left/top corner
        // we can't assume x1, y1 is top left and x2, y2 is bottom right
        var p = this.calcLinePoints();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
      }

      ctx.lineWidth = this.strokeWidth;

      // TODO: test this
      // make sure setting "fill" changes color of a line
      // (by copying fillStyle to strokeStyle, since line is stroked, not filled)
      var origStrokeStyle = ctx.strokeStyle;
      ctx.strokeStyle = this.stroke || ctx.fillStyle;
      this.stroke && this._renderStroke(ctx);
      ctx.strokeStyle = origStrokeStyle;
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderDashedStroke: function(ctx) {
      var p = this.calcLinePoints();

      ctx.beginPath();
      fabric.util.drawDashedLine(ctx, p.x1, p.y1, p.x2, p.y2, this.strokeDashArray);
      ctx.closePath();
    },

    /**
     * Returns object representation of an instance
     * @methd toObject
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      return extend(this.callSuper('toObject', propertiesToInclude), this.calcLinePoints());
    },

    /**
     * Recalculates line points given width and height
     * @private
     */
    calcLinePoints: function() {
      var xMult = this.x1 <= this.x2 ? -1 : 1,
          yMult = this.y1 <= this.y2 ? -1 : 1,
          x1 = (xMult * this.width * 0.5),
          y1 = (yMult * this.height * 0.5),
          x2 = (xMult * this.width * -0.5),
          y2 = (yMult * this.height * -0.5);

      return {
        x1: x1,
        x2: x2,
        y1: y1,
        y2: y2
      };
    },

    /* _TO_SVG_START_ */
    /**
     * Returns SVG representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      var markup = this._createBaseSVGMarkup(),
          p = { x1: this.x1, x2: this.x2, y1: this.y1, y2: this.y2 };

      if (!(this.group && this.group.type === 'path-group')) {
        p = this.calcLinePoints();
      }
      markup.push(
        '<line ', this.getSvgId(),
          'x1="', p.x1,
          '" y1="', p.y1,
          '" x2="', p.x2,
          '" y2="', p.y2,
          '" style="', this.getSvgStyles(),
          '" transform="', this.getSvgTransform(),
          this.getSvgTransformMatrix(),
        '"/>\n'
      );

      return reviver ? reviver(markup.join('')) : markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * Returns complexity of an instance
     * @return {Number} complexity
     */
    complexity: function() {
      return 1;
    }
  });

  /* _FROM_SVG_START_ */
  /**
   * List of attribute names to account for when parsing SVG element (used by {@link fabric.Line.fromElement})
   * @static
   * @memberOf fabric.Line
   * @see http://www.w3.org/TR/SVG/shapes.html#LineElement
   */
  fabric.Line.ATTRIBUTE_NAMES = fabric.SHARED_ATTRIBUTES.concat('x1 y1 x2 y2'.split(' '));

  /**
   * Returns fabric.Line instance from an SVG element
   * @static
   * @memberOf fabric.Line
   * @param {SVGElement} element Element to parse
   * @param {Object} [options] Options object
   * @return {fabric.Line} instance of fabric.Line
   */
  fabric.Line.fromElement = function(element, options) {
    var parsedAttributes = fabric.parseAttributes(element, fabric.Line.ATTRIBUTE_NAMES),
        points = [
          parsedAttributes.x1 || 0,
          parsedAttributes.y1 || 0,
          parsedAttributes.x2 || 0,
          parsedAttributes.y2 || 0
        ];
    return new fabric.Line(points, extend(parsedAttributes, options));
  };
  /* _FROM_SVG_END_ */

  /**
   * Returns fabric.Line instance from an object representation
   * @static
   * @memberOf fabric.Line
   * @param {Object} object Object to create an instance from
   * @param {function} [callback] invoked with new instance as first argument
   * @return {fabric.Line} instance of fabric.Line
   */
  fabric.Line.fromObject = function(object, callback) {
    var points = [object.x1, object.y1, object.x2, object.y2],
        line = new fabric.Line(points, object);
    callback && callback(line);
    return line;
  };

  /**
   * Produces a function that calculates distance from canvas edge to Line origin.
   */
  function makeEdgeToOriginGetter(propertyNames, originValues) {
    var origin = propertyNames.origin,
        axis1 = propertyNames.axis1,
        axis2 = propertyNames.axis2,
        dimension = propertyNames.dimension,
        nearest = originValues.nearest,
        center = originValues.center,
        farthest = originValues.farthest;

    return function() {
      switch (this.get(origin)) {
        case nearest:
          return Math.min(this.get(axis1), this.get(axis2));
        case center:
          return Math.min(this.get(axis1), this.get(axis2)) + (0.5 * this.get(dimension));
        case farthest:
          return Math.max(this.get(axis1), this.get(axis2));
      }
    };

  }

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      pi = Math.PI,
      extend = fabric.util.object.extend;

  if (fabric.Circle) {
    fabric.warn('fabric.Circle is already defined.');
    return;
  }

  /**
   * Circle class
   * @class fabric.Circle
   * @extends fabric.Object
   * @see {@link fabric.Circle#initialize} for constructor definition
   */
  fabric.Circle = fabric.util.createClass(fabric.Object, /** @lends fabric.Circle.prototype */ {

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'circle',

    /**
     * Radius of this circle
     * @type Number
     * @default
     */
    radius: 0,

    /**
     * Start angle of the circle, moving clockwise
     * @type Number
     * @default 0
     */
    startAngle: 0,

    /**
     * End angle of the circle
     * @type Number
     * @default 2Pi
     */
    endAngle: pi * 2,

    /**
     * Constructor
     * @param {Object} [options] Options object
     * @return {fabric.Circle} thisArg
     */
    initialize: function(options) {
      options = options || { };

      this.callSuper('initialize', options);
      this.set('radius', options.radius || 0);

      this.startAngle = options.startAngle || this.startAngle;
      this.endAngle = options.endAngle || this.endAngle;
    },

    /**
     * @private
     * @param {String} key
     * @param {*} value
     * @return {fabric.Circle} thisArg
     */
    _set: function(key, value) {
      this.callSuper('_set', key, value);

      if (key === 'radius') {
        this.setRadius(value);
      }

      return this;
    },

    /**
     * Returns object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      return this.callSuper('toObject', ['radius', 'startAngle', 'endAngle'].concat(propertiesToInclude));
    },

    /* _TO_SVG_START_ */
    /**
     * Returns svg representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      var markup = this._createBaseSVGMarkup(), x = 0, y = 0,
          angle = (this.endAngle - this.startAngle) % ( 2 * pi);

      if (angle === 0) {
        if (this.group && this.group.type === 'path-group') {
          x = this.left + this.radius;
          y = this.top + this.radius;
        }
        markup.push(
          '<circle ', this.getSvgId(),
            'cx="' + x + '" cy="' + y + '" ',
            'r="', this.radius,
            '" style="', this.getSvgStyles(),
            '" transform="', this.getSvgTransform(),
            ' ', this.getSvgTransformMatrix(),
          '"/>\n'
        );
      }
      else {
        var startX = Math.cos(this.startAngle) * this.radius,
            startY = Math.sin(this.startAngle) * this.radius,
            endX = Math.cos(this.endAngle) * this.radius,
            endY = Math.sin(this.endAngle) * this.radius,
            largeFlag = angle > pi ? '1' : '0';

        markup.push(
          '<path d="M ' + startX + ' ' + startY,
          ' A ' + this.radius + ' ' + this.radius,
          ' 0 ', +largeFlag + ' 1', ' ' + endX + ' ' + endY,
          '" style="', this.getSvgStyles(),
          '" transform="', this.getSvgTransform(),
          ' ', this.getSvgTransformMatrix(),
          '"/>\n'
        );
      }

      return reviver ? reviver(markup.join('')) : markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx context to render on
     * @param {Boolean} [noTransform] When true, context is not transformed
     */
    _render: function(ctx, noTransform) {
      ctx.beginPath();
      ctx.arc(noTransform ? this.left + this.radius : 0,
              noTransform ? this.top + this.radius : 0,
              this.radius,
              this.startAngle,
              this.endAngle, false);
      this._renderFill(ctx);
      this._renderStroke(ctx);
    },

    /**
     * Returns horizontal radius of an object (according to how an object is scaled)
     * @return {Number}
     */
    getRadiusX: function() {
      return this.get('radius') * this.get('scaleX');
    },

    /**
     * Returns vertical radius of an object (according to how an object is scaled)
     * @return {Number}
     */
    getRadiusY: function() {
      return this.get('radius') * this.get('scaleY');
    },

    /**
     * Sets radius of an object (and updates width accordingly)
     * @return {fabric.Circle} thisArg
     */
    setRadius: function(value) {
      this.radius = value;
      return this.set('width', value * 2).set('height', value * 2);
    },

    /**
     * Returns complexity of an instance
     * @return {Number} complexity of this instance
     */
    complexity: function() {
      return 1;
    }
  });

  /* _FROM_SVG_START_ */
  /**
   * List of attribute names to account for when parsing SVG element (used by {@link fabric.Circle.fromElement})
   * @static
   * @memberOf fabric.Circle
   * @see: http://www.w3.org/TR/SVG/shapes.html#CircleElement
   */
  fabric.Circle.ATTRIBUTE_NAMES = fabric.SHARED_ATTRIBUTES.concat('cx cy r'.split(' '));

  /**
   * Returns {@link fabric.Circle} instance from an SVG element
   * @static
   * @memberOf fabric.Circle
   * @param {SVGElement} element Element to parse
   * @param {Object} [options] Options object
   * @throws {Error} If value of `r` attribute is missing or invalid
   * @return {fabric.Circle} Instance of fabric.Circle
   */
  fabric.Circle.fromElement = function(element, options) {
    options || (options = { });

    var parsedAttributes = fabric.parseAttributes(element, fabric.Circle.ATTRIBUTE_NAMES);

    if (!isValidRadius(parsedAttributes)) {
      throw new Error('value of `r` attribute is required and can not be negative');
    }

    parsedAttributes.left = parsedAttributes.left || 0;
    parsedAttributes.top = parsedAttributes.top || 0;

    var obj = new fabric.Circle(extend(parsedAttributes, options));

    obj.left -= obj.radius;
    obj.top -= obj.radius;
    return obj;
  };

  /**
   * @private
   */
  function isValidRadius(attributes) {
    return (('radius' in attributes) && (attributes.radius >= 0));
  }
  /* _FROM_SVG_END_ */

  /**
   * Returns {@link fabric.Circle} instance from an object representation
   * @static
   * @memberOf fabric.Circle
   * @param {Object} object Object to create an instance from
   * @param {function} [callback] invoked with new instance as first argument
   * @return {Object} Instance of fabric.Circle
   */
  fabric.Circle.fromObject = function(object, callback) {
    var circle = new fabric.Circle(object);
    callback && callback(circle);
    return circle;
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { });

  if (fabric.Triangle) {
    fabric.warn('fabric.Triangle is already defined');
    return;
  }

  /**
   * Triangle class
   * @class fabric.Triangle
   * @extends fabric.Object
   * @return {fabric.Triangle} thisArg
   * @see {@link fabric.Triangle#initialize} for constructor definition
   */
  fabric.Triangle = fabric.util.createClass(fabric.Object, /** @lends fabric.Triangle.prototype */ {

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'triangle',

    /**
     * Constructor
     * @param {Object} [options] Options object
     * @return {Object} thisArg
     */
    initialize: function(options) {
      options = options || { };

      this.callSuper('initialize', options);

      this.set('width', options.width || 100)
          .set('height', options.height || 100);
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _render: function(ctx) {
      var widthBy2 = this.width / 2,
          heightBy2 = this.height / 2;

      ctx.beginPath();
      ctx.moveTo(-widthBy2, heightBy2);
      ctx.lineTo(0, -heightBy2);
      ctx.lineTo(widthBy2, heightBy2);
      ctx.closePath();

      this._renderFill(ctx);
      this._renderStroke(ctx);
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderDashedStroke: function(ctx) {
      var widthBy2 = this.width / 2,
          heightBy2 = this.height / 2;

      ctx.beginPath();
      fabric.util.drawDashedLine(ctx, -widthBy2, heightBy2, 0, -heightBy2, this.strokeDashArray);
      fabric.util.drawDashedLine(ctx, 0, -heightBy2, widthBy2, heightBy2, this.strokeDashArray);
      fabric.util.drawDashedLine(ctx, widthBy2, heightBy2, -widthBy2, heightBy2, this.strokeDashArray);
      ctx.closePath();
    },

    /* _TO_SVG_START_ */
    /**
     * Returns SVG representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      var markup = this._createBaseSVGMarkup(),
          widthBy2 = this.width / 2,
          heightBy2 = this.height / 2,
          points = [
            -widthBy2 + ' ' + heightBy2,
            '0 ' + -heightBy2,
            widthBy2 + ' ' + heightBy2
          ]
          .join(',');

      markup.push(
        '<polygon ', this.getSvgId(),
          'points="', points,
          '" style="', this.getSvgStyles(),
          '" transform="', this.getSvgTransform(),
        '"/>'
      );

      return reviver ? reviver(markup.join('')) : markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * Returns complexity of an instance
     * @return {Number} complexity of this instance
     */
    complexity: function() {
      return 1;
    }
  });

  /**
   * Returns fabric.Triangle instance from an object representation
   * @static
   * @memberOf fabric.Triangle
   * @param {Object} object Object to create an instance from
   * @param {Function} [callback] Callback to invoke when an fabric.Triangle instance is created
   * @return {Object} instance of Canvas.Triangle
   */
  fabric.Triangle.fromObject = function(object, callback) {
    var triangle = new fabric.Triangle(object);
    callback && callback(triangle);
    return triangle;
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      piBy2   = Math.PI * 2,
      extend = fabric.util.object.extend;

  if (fabric.Ellipse) {
    fabric.warn('fabric.Ellipse is already defined.');
    return;
  }

  /**
   * Ellipse class
   * @class fabric.Ellipse
   * @extends fabric.Object
   * @return {fabric.Ellipse} thisArg
   * @see {@link fabric.Ellipse#initialize} for constructor definition
   */
  fabric.Ellipse = fabric.util.createClass(fabric.Object, /** @lends fabric.Ellipse.prototype */ {

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'ellipse',

    /**
     * Horizontal radius
     * @type Number
     * @default
     */
    rx:   0,

    /**
     * Vertical radius
     * @type Number
     * @default
     */
    ry:   0,

    /**
     * Constructor
     * @param {Object} [options] Options object
     * @return {fabric.Ellipse} thisArg
     */
    initialize: function(options) {
      options = options || { };

      this.callSuper('initialize', options);

      this.set('rx', options.rx || 0);
      this.set('ry', options.ry || 0);
    },

    /**
     * @private
     * @param {String} key
     * @param {*} value
     * @return {fabric.Ellipse} thisArg
     */
    _set: function(key, value) {
      this.callSuper('_set', key, value);
      switch (key) {

        case 'rx':
          this.rx = value;
          this.set('width', value * 2);
          break;

        case 'ry':
          this.ry = value;
          this.set('height', value * 2);
          break;

      }
      return this;
    },

    /**
     * Returns horizontal radius of an object (according to how an object is scaled)
     * @return {Number}
     */
    getRx: function() {
      return this.get('rx') * this.get('scaleX');
    },

    /**
     * Returns Vertical radius of an object (according to how an object is scaled)
     * @return {Number}
     */
    getRy: function() {
      return this.get('ry') * this.get('scaleY');
    },

    /**
     * Returns object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      return this.callSuper('toObject', ['rx', 'ry'].concat(propertiesToInclude));
    },

    /* _TO_SVG_START_ */
    /**
     * Returns svg representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      var markup = this._createBaseSVGMarkup(), x = 0, y = 0;
      if (this.group && this.group.type === 'path-group') {
        x = this.left + this.rx;
        y = this.top + this.ry;
      }
      markup.push(
        '<ellipse ', this.getSvgId(),
          'cx="', x, '" cy="', y, '" ',
          'rx="', this.rx,
          '" ry="', this.ry,
          '" style="', this.getSvgStyles(),
          '" transform="', this.getSvgTransform(),
          this.getSvgTransformMatrix(),
        '"/>\n'
      );

      return reviver ? reviver(markup.join('')) : markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx context to render on
     * @param {Boolean} [noTransform] When true, context is not transformed
     */
    _render: function(ctx, noTransform) {
      ctx.beginPath();
      ctx.save();
      ctx.transform(1, 0, 0, this.ry / this.rx, 0, 0);
      ctx.arc(
        noTransform ? this.left + this.rx : 0,
        noTransform ? (this.top + this.ry) * this.rx / this.ry : 0,
        this.rx,
        0,
        piBy2,
        false);
      ctx.restore();
      this._renderFill(ctx);
      this._renderStroke(ctx);
    },

    /**
     * Returns complexity of an instance
     * @return {Number} complexity
     */
    complexity: function() {
      return 1;
    }
  });

  /* _FROM_SVG_START_ */
  /**
   * List of attribute names to account for when parsing SVG element (used by {@link fabric.Ellipse.fromElement})
   * @static
   * @memberOf fabric.Ellipse
   * @see http://www.w3.org/TR/SVG/shapes.html#EllipseElement
   */
  fabric.Ellipse.ATTRIBUTE_NAMES = fabric.SHARED_ATTRIBUTES.concat('cx cy rx ry'.split(' '));

  /**
   * Returns {@link fabric.Ellipse} instance from an SVG element
   * @static
   * @memberOf fabric.Ellipse
   * @param {SVGElement} element Element to parse
   * @param {Object} [options] Options object
   * @return {fabric.Ellipse}
   */
  fabric.Ellipse.fromElement = function(element, options) {
    options || (options = { });

    var parsedAttributes = fabric.parseAttributes(element, fabric.Ellipse.ATTRIBUTE_NAMES);

    parsedAttributes.left = parsedAttributes.left || 0;
    parsedAttributes.top = parsedAttributes.top || 0;

    var ellipse = new fabric.Ellipse(extend(parsedAttributes, options));

    ellipse.top -= ellipse.ry;
    ellipse.left -= ellipse.rx;
    return ellipse;
  };
  /* _FROM_SVG_END_ */

  /**
   * Returns {@link fabric.Ellipse} instance from an object representation
   * @static
   * @memberOf fabric.Ellipse
   * @param {Object} object Object to create an instance from
   * @param {function} [callback] invoked with new instance as first argument
   * @return {fabric.Ellipse}
   */
  fabric.Ellipse.fromObject = function(object, callback) {
    var ellipse = new fabric.Ellipse(object);
    callback && callback(ellipse);
    return ellipse;
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend;

  if (fabric.Rect) {
    fabric.warn('fabric.Rect is already defined');
    return;
  }

  var stateProperties = fabric.Object.prototype.stateProperties.concat();
  stateProperties.push('rx', 'ry', 'x', 'y');

  /**
   * Rectangle class
   * @class fabric.Rect
   * @extends fabric.Object
   * @return {fabric.Rect} thisArg
   * @see {@link fabric.Rect#initialize} for constructor definition
   */
  fabric.Rect = fabric.util.createClass(fabric.Object, /** @lends fabric.Rect.prototype */ {

    /**
     * List of properties to consider when checking if state of an object is changed ({@link fabric.Object#hasStateChanged})
     * as well as for history (undo/redo) purposes
     * @type Array
     */
    stateProperties: stateProperties,

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'rect',

    /**
     * Horizontal border radius
     * @type Number
     * @default
     */
    rx:   0,

    /**
     * Vertical border radius
     * @type Number
     * @default
     */
    ry:   0,

    /**
     * Used to specify dash pattern for stroke on this object
     * @type Array
     */
    strokeDashArray: null,

    /**
     * Constructor
     * @param {Object} [options] Options object
     * @return {Object} thisArg
     */
    initialize: function(options) {
      options = options || { };

      this.callSuper('initialize', options);
      this._initRxRy();

    },

    /**
     * Initializes rx/ry attributes
     * @private
     */
    _initRxRy: function() {
      if (this.rx && !this.ry) {
        this.ry = this.rx;
      }
      else if (this.ry && !this.rx) {
        this.rx = this.ry;
      }
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Boolean} noTransform
     */
    _render: function(ctx, noTransform) {

      // optimize 1x1 case (used in spray brush)
      if (this.width === 1 && this.height === 1) {
        ctx.fillRect(-0.5, -0.5, 1, 1);
        return;
      }

      var rx = this.rx ? Math.min(this.rx, this.width / 2) : 0,
          ry = this.ry ? Math.min(this.ry, this.height / 2) : 0,
          w = this.width,
          h = this.height,
          x = noTransform ? this.left : -this.width / 2,
          y = noTransform ? this.top : -this.height / 2,
          isRounded = rx !== 0 || ry !== 0,
          /* "magic number" for bezier approximations of arcs (http://itc.ktu.lt/itc354/Riskus354.pdf) */
          k = 1 - 0.5522847498;
      ctx.beginPath();

      ctx.moveTo(x + rx, y);

      ctx.lineTo(x + w - rx, y);
      isRounded && ctx.bezierCurveTo(x + w - k * rx, y, x + w, y + k * ry, x + w, y + ry);

      ctx.lineTo(x + w, y + h - ry);
      isRounded && ctx.bezierCurveTo(x + w, y + h - k * ry, x + w - k * rx, y + h, x + w - rx, y + h);

      ctx.lineTo(x + rx, y + h);
      isRounded && ctx.bezierCurveTo(x + k * rx, y + h, x, y + h - k * ry, x, y + h - ry);

      ctx.lineTo(x, y + ry);
      isRounded && ctx.bezierCurveTo(x, y + k * ry, x + k * rx, y, x + rx, y);

      ctx.closePath();

      this._renderFill(ctx);
      this._renderStroke(ctx);
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderDashedStroke: function(ctx) {
      var x = -this.width / 2,
          y = -this.height / 2,
          w = this.width,
          h = this.height;

      ctx.beginPath();
      fabric.util.drawDashedLine(ctx, x, y, x + w, y, this.strokeDashArray);
      fabric.util.drawDashedLine(ctx, x + w, y, x + w, y + h, this.strokeDashArray);
      fabric.util.drawDashedLine(ctx, x + w, y + h, x, y + h, this.strokeDashArray);
      fabric.util.drawDashedLine(ctx, x, y + h, x, y, this.strokeDashArray);
      ctx.closePath();
    },

    /**
     * Returns object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      return this.callSuper('toObject', ['rx', 'ry'].concat(propertiesToInclude));
    },

    /* _TO_SVG_START_ */
    /**
     * Returns svg representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      var markup = this._createBaseSVGMarkup(), x = this.left, y = this.top;
      if (!(this.group && this.group.type === 'path-group')) {
        x = -this.width / 2;
        y = -this.height / 2;
      }
      markup.push(
        '<rect ', this.getSvgId(),
          'x="', x, '" y="', y,
          '" rx="', this.get('rx'), '" ry="', this.get('ry'),
          '" width="', this.width, '" height="', this.height,
          '" style="', this.getSvgStyles(),
          '" transform="', this.getSvgTransform(),
          this.getSvgTransformMatrix(),
        '"/>\n');

      return reviver ? reviver(markup.join('')) : markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * Returns complexity of an instance
     * @return {Number} complexity
     */
    complexity: function() {
      return 1;
    }
  });

  /* _FROM_SVG_START_ */
  /**
   * List of attribute names to account for when parsing SVG element (used by `fabric.Rect.fromElement`)
   * @static
   * @memberOf fabric.Rect
   * @see: http://www.w3.org/TR/SVG/shapes.html#RectElement
   */
  fabric.Rect.ATTRIBUTE_NAMES = fabric.SHARED_ATTRIBUTES.concat('x y rx ry width height'.split(' '));

  /**
   * Returns {@link fabric.Rect} instance from an SVG element
   * @static
   * @memberOf fabric.Rect
   * @param {SVGElement} element Element to parse
   * @param {Object} [options] Options object
   * @return {fabric.Rect} Instance of fabric.Rect
   */
  fabric.Rect.fromElement = function(element, options) {
    if (!element) {
      return null;
    }
    options = options || { };

    var parsedAttributes = fabric.parseAttributes(element, fabric.Rect.ATTRIBUTE_NAMES);

    parsedAttributes.left = parsedAttributes.left || 0;
    parsedAttributes.top  = parsedAttributes.top  || 0;
    var rect = new fabric.Rect(extend((options ? fabric.util.object.clone(options) : { }), parsedAttributes));
    rect.visible = rect.visible && rect.width > 0 && rect.height > 0;
    return rect;
  };
  /* _FROM_SVG_END_ */

  /**
   * Returns {@link fabric.Rect} instance from an object representation
   * @static
   * @memberOf fabric.Rect
   * @param {Object} object Object to create an instance from
   * @param {Function} [callback] Callback to invoke when an fabric.Rect instance is created
   * @return {Object} instance of fabric.Rect
   */
  fabric.Rect.fromObject = function(object, callback) {
    var rect = new fabric.Rect(object);
    callback && callback(rect);
    return rect;
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { });

  if (fabric.Polyline) {
    fabric.warn('fabric.Polyline is already defined');
    return;
  }

  /**
   * Polyline class
   * @class fabric.Polyline
   * @extends fabric.Object
   * @see {@link fabric.Polyline#initialize} for constructor definition
   */
  fabric.Polyline = fabric.util.createClass(fabric.Object, /** @lends fabric.Polyline.prototype */ {

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'polyline',

    /**
     * Points array
     * @type Array
     * @default
     */
    points: null,

    /**
     * Minimum X from points values, necessary to offset points
     * @type Number
     * @default
     */
    minX: 0,

    /**
     * Minimum Y from points values, necessary to offset points
     * @type Number
     * @default
     */
    minY: 0,

    /**
     * Constructor
     * @param {Array} points Array of points (where each point is an object with x and y)
     * @param {Object} [options] Options object
     * @return {fabric.Polyline} thisArg
     * @example
     * var poly = new fabric.Polyline([
     *     { x: 10, y: 10 },
     *     { x: 50, y: 30 },
     *     { x: 40, y: 70 },
     *     { x: 60, y: 50 },
     *     { x: 100, y: 150 },
     *     { x: 40, y: 100 }
     *   ], {
     *   stroke: 'red',
     *   left: 100,
     *   top: 100
     * });
     */
    initialize: function(points, options) {
      return fabric.Polygon.prototype.initialize.call(this, points, options);
    },

    /**
     * @private
     */
    _calcDimensions: function() {
      return fabric.Polygon.prototype._calcDimensions.call(this);
    },

    /**
     * Returns object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} Object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      return fabric.Polygon.prototype.toObject.call(this, propertiesToInclude);
    },

    /* _TO_SVG_START_ */
    /**
     * Returns SVG representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      return fabric.Polygon.prototype.toSVG.call(this, reviver);
    },
    /* _TO_SVG_END_ */

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Boolean} noTransform
     */
    _render: function(ctx, noTransform) {
      if (!fabric.Polygon.prototype.commonRender.call(this, ctx, noTransform)) {
        return;
      }
      this._renderFill(ctx);
      this._renderStroke(ctx);
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderDashedStroke: function(ctx) {
      var p1, p2;

      ctx.beginPath();
      for (var i = 0, len = this.points.length; i < len; i++) {
        p1 = this.points[i];
        p2 = this.points[i + 1] || p1;
        fabric.util.drawDashedLine(ctx, p1.x, p1.y, p2.x, p2.y, this.strokeDashArray);
      }
    },

    /**
     * Returns complexity of an instance
     * @return {Number} complexity of this instance
     */
    complexity: function() {
      return this.get('points').length;
    }
  });

  /* _FROM_SVG_START_ */
  /**
   * List of attribute names to account for when parsing SVG element (used by {@link fabric.Polyline.fromElement})
   * @static
   * @memberOf fabric.Polyline
   * @see: http://www.w3.org/TR/SVG/shapes.html#PolylineElement
   */
  fabric.Polyline.ATTRIBUTE_NAMES = fabric.SHARED_ATTRIBUTES.concat();

  /**
   * Returns fabric.Polyline instance from an SVG element
   * @static
   * @memberOf fabric.Polyline
   * @param {SVGElement} element Element to parse
   * @param {Object} [options] Options object
   * @return {fabric.Polyline} Instance of fabric.Polyline
   */
  fabric.Polyline.fromElement = function(element, options) {
    if (!element) {
      return null;
    }
    options || (options = { });

    var points = fabric.parsePointsAttribute(element.getAttribute('points')),
        parsedAttributes = fabric.parseAttributes(element, fabric.Polyline.ATTRIBUTE_NAMES);

    return new fabric.Polyline(points, fabric.util.object.extend(parsedAttributes, options));
  };
  /* _FROM_SVG_END_ */

  /**
   * Returns fabric.Polyline instance from an object representation
   * @static
   * @memberOf fabric.Polyline
   * @param {Object} object Object to create an instance from
   * @param {Function} [callback] Callback to invoke when an fabric.Path instance is created
   * @return {fabric.Polyline} Instance of fabric.Polyline
   */
  fabric.Polyline.fromObject = function(object, callback) {
    var polyline = new fabric.Polyline(object.points, object);
    callback && callback(polyline);
    return polyline;
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      min = fabric.util.array.min,
      max = fabric.util.array.max,
      toFixed = fabric.util.toFixed;

  if (fabric.Polygon) {
    fabric.warn('fabric.Polygon is already defined');
    return;
  }

  /**
   * Polygon class
   * @class fabric.Polygon
   * @extends fabric.Object
   * @see {@link fabric.Polygon#initialize} for constructor definition
   */
  fabric.Polygon = fabric.util.createClass(fabric.Object, /** @lends fabric.Polygon.prototype */ {

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'polygon',

    /**
     * Points array
     * @type Array
     * @default
     */
    points: null,

    /**
     * Minimum X from points values, necessary to offset points
     * @type Number
     * @default
     */
    minX: 0,

    /**
     * Minimum Y from points values, necessary to offset points
     * @type Number
     * @default
     */
    minY: 0,

    /**
     * Constructor
     * @param {Array} points Array of points
     * @param {Object} [options] Options object
     * @return {fabric.Polygon} thisArg
     */
    initialize: function(points, options) {
      options = options || { };
      this.points = points || [];
      this.callSuper('initialize', options);
      this._calcDimensions();
      if (!('top' in options)) {
        this.top = this.minY;
      }
      if (!('left' in options)) {
        this.left = this.minX;
      }
      this.pathOffset = {
        x: this.minX + this.width / 2,
        y: this.minY + this.height / 2
      };
    },

    /**
     * @private
     */
    _calcDimensions: function() {

      var points = this.points,
          minX = min(points, 'x'),
          minY = min(points, 'y'),
          maxX = max(points, 'x'),
          maxY = max(points, 'y');

      this.width = (maxX - minX) || 0;
      this.height = (maxY - minY) || 0;
      this.minX = minX || 0;
      this.minY = minY || 0;
    },

    /**
     * Returns object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} Object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      return extend(this.callSuper('toObject', propertiesToInclude), {
        points: this.points.concat()
      });
    },

    /* _TO_SVG_START_ */
    /**
     * Returns svg representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      var points = [], addTransform,
          markup = this._createBaseSVGMarkup();

      for (var i = 0, len = this.points.length; i < len; i++) {
        points.push(toFixed(this.points[i].x, 2), ',', toFixed(this.points[i].y, 2), ' ');
      }
      if (!(this.group && this.group.type === 'path-group')) {
        addTransform = ' translate(' + (-this.pathOffset.x) + ', ' + (-this.pathOffset.y) + ') ';
      }
      markup.push(
        '<', this.type, ' ', this.getSvgId(),
          'points="', points.join(''),
          '" style="', this.getSvgStyles(),
          '" transform="', this.getSvgTransform(), addTransform,
          ' ', this.getSvgTransformMatrix(),
        '"/>\n'
      );

      return reviver ? reviver(markup.join('')) : markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Boolean} noTransform
     */
    _render: function(ctx, noTransform) {
      if (!this.commonRender(ctx, noTransform)) {
        return;
      }
      this._renderFill(ctx);
      if (this.stroke || this.strokeDashArray) {
        ctx.closePath();
        this._renderStroke(ctx);
      }
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Boolean} noTransform
     */
    commonRender: function(ctx, noTransform) {
      var point, len = this.points.length;

      if (!len || isNaN(this.points[len - 1].y)) {
        // do not draw if no points or odd points
        // NaN comes from parseFloat of a empty string in parser
        return false;
      }

      noTransform || ctx.translate(-this.pathOffset.x, -this.pathOffset.y);
      ctx.beginPath();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (var i = 0; i < len; i++) {
        point = this.points[i];
        ctx.lineTo(point.x, point.y);
      }
      return true;
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderDashedStroke: function(ctx) {
      fabric.Polyline.prototype._renderDashedStroke.call(this, ctx);
      ctx.closePath();
    },

    /**
     * Returns complexity of an instance
     * @return {Number} complexity of this instance
     */
    complexity: function() {
      return this.points.length;
    }
  });

  /* _FROM_SVG_START_ */
  /**
   * List of attribute names to account for when parsing SVG element (used by `fabric.Polygon.fromElement`)
   * @static
   * @memberOf fabric.Polygon
   * @see: http://www.w3.org/TR/SVG/shapes.html#PolygonElement
   */
  fabric.Polygon.ATTRIBUTE_NAMES = fabric.SHARED_ATTRIBUTES.concat();

  /**
   * Returns {@link fabric.Polygon} instance from an SVG element
   * @static
   * @memberOf fabric.Polygon
   * @param {SVGElement} element Element to parse
   * @param {Object} [options] Options object
   * @return {fabric.Polygon} Instance of fabric.Polygon
   */
  fabric.Polygon.fromElement = function(element, options) {
    if (!element) {
      return null;
    }

    options || (options = { });

    var points = fabric.parsePointsAttribute(element.getAttribute('points')),
        parsedAttributes = fabric.parseAttributes(element, fabric.Polygon.ATTRIBUTE_NAMES);

    return new fabric.Polygon(points, extend(parsedAttributes, options));
  };
  /* _FROM_SVG_END_ */

  /**
   * Returns fabric.Polygon instance from an object representation
   * @static
   * @memberOf fabric.Polygon
   * @param {Object} object Object to create an instance from
   * @param {Function} [callback] Callback to invoke when an fabric.Path instance is created
   * @return {fabric.Polygon} Instance of fabric.Polygon
   */
  fabric.Polygon.fromObject = function(object, callback) {
    var polygon = new fabric.Polygon(object.points, object);
    callback && callback(polygon);
    return polygon;
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      min = fabric.util.array.min,
      max = fabric.util.array.max,
      extend = fabric.util.object.extend,
      _toString = Object.prototype.toString,
      drawArc = fabric.util.drawArc,
      commandLengths = {
        m: 2,
        l: 2,
        h: 1,
        v: 1,
        c: 6,
        s: 4,
        q: 4,
        t: 2,
        a: 7
      },
      repeatedCommands = {
        m: 'l',
        M: 'L'
      };

  if (fabric.Path) {
    fabric.warn('fabric.Path is already defined');
    return;
  }

  /**
   * Path class
   * @class fabric.Path
   * @extends fabric.Object
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-1#path_and_pathgroup}
   * @see {@link fabric.Path#initialize} for constructor definition
   */
  fabric.Path = fabric.util.createClass(fabric.Object, /** @lends fabric.Path.prototype */ {

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'path',

    /**
     * Array of path points
     * @type Array
     * @default
     */
    path: null,

    /**
     * Minimum X from points values, necessary to offset points
     * @type Number
     * @default
     */
    minX: 0,

    /**
     * Minimum Y from points values, necessary to offset points
     * @type Number
     * @default
     */
    minY: 0,

    /**
     * Constructor
     * @param {Array|String} path Path data (sequence of coordinates and corresponding "command" tokens)
     * @param {Object} [options] Options object
     * @return {fabric.Path} thisArg
     */
    initialize: function(path, options) {
      options = options || { };

      this.setOptions(options);

      if (!path) {
        path = [];
      }

      var fromArray = _toString.call(path) === '[object Array]';

      this.path = fromArray
        ? path
        // one of commands (m,M,l,L,q,Q,c,C,etc.) followed by non-command characters (i.e. command values)
        : path.match && path.match(/[mzlhvcsqta][^mzlhvcsqta]*/gi);

      if (!this.path) {
        return;
      }

      if (!fromArray) {
        this.path = this._parsePath();
      }

      this._setPositionDimensions(options);

      if (options.sourcePath) {
        this.setSourcePath(options.sourcePath);
      }
    },

    /**
     * @private
     * @param {Object} options Options object
     */
    _setPositionDimensions: function(options) {
      var calcDim = this._parseDimensions();

      this.minX = calcDim.left;
      this.minY = calcDim.top;
      this.width = calcDim.width;
      this.height = calcDim.height;

      if (typeof options.left === 'undefined') {
        this.left = calcDim.left + (this.originX === 'center'
          ? this.width / 2
          : this.originX === 'right'
            ? this.width
            : 0);
      }

      if (typeof options.top === 'undefined') {
        this.top = calcDim.top + (this.originY === 'center'
          ? this.height / 2
          : this.originY === 'bottom'
            ? this.height
            : 0);
      }

      this.pathOffset = this.pathOffset || {
        x: this.minX + this.width / 2,
        y: this.minY + this.height / 2
      };
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx context to render path on
     */
    _renderPathCommands: function(ctx) {
      var current, // current instruction
          previous = null,
          subpathStartX = 0,
          subpathStartY = 0,
          x = 0, // current x
          y = 0, // current y
          controlX = 0, // current control point x
          controlY = 0, // current control point y
          tempX,
          tempY,
          l = -this.pathOffset.x,
          t = -this.pathOffset.y;

      if (this.group && this.group.type === 'path-group') {
        l = 0;
        t = 0;
      }

      ctx.beginPath();

      for (var i = 0, len = this.path.length; i < len; ++i) {

        current = this.path[i];

        switch (current[0]) { // first letter

          case 'l': // lineto, relative
            x += current[1];
            y += current[2];
            ctx.lineTo(x + l, y + t);
            break;

          case 'L': // lineto, absolute
            x = current[1];
            y = current[2];
            ctx.lineTo(x + l, y + t);
            break;

          case 'h': // horizontal lineto, relative
            x += current[1];
            ctx.lineTo(x + l, y + t);
            break;

          case 'H': // horizontal lineto, absolute
            x = current[1];
            ctx.lineTo(x + l, y + t);
            break;

          case 'v': // vertical lineto, relative
            y += current[1];
            ctx.lineTo(x + l, y + t);
            break;

          case 'V': // verical lineto, absolute
            y = current[1];
            ctx.lineTo(x + l, y + t);
            break;

          case 'm': // moveTo, relative
            x += current[1];
            y += current[2];
            subpathStartX = x;
            subpathStartY = y;
            ctx.moveTo(x + l, y + t);
            break;

          case 'M': // moveTo, absolute
            x = current[1];
            y = current[2];
            subpathStartX = x;
            subpathStartY = y;
            ctx.moveTo(x + l, y + t);
            break;

          case 'c': // bezierCurveTo, relative
            tempX = x + current[5];
            tempY = y + current[6];
            controlX = x + current[3];
            controlY = y + current[4];
            ctx.bezierCurveTo(
              x + current[1] + l, // x1
              y + current[2] + t, // y1
              controlX + l, // x2
              controlY + t, // y2
              tempX + l,
              tempY + t
            );
            x = tempX;
            y = tempY;
            break;

          case 'C': // bezierCurveTo, absolute
            x = current[5];
            y = current[6];
            controlX = current[3];
            controlY = current[4];
            ctx.bezierCurveTo(
              current[1] + l,
              current[2] + t,
              controlX + l,
              controlY + t,
              x + l,
              y + t
            );
            break;

          case 's': // shorthand cubic bezierCurveTo, relative

            // transform to absolute x,y
            tempX = x + current[3];
            tempY = y + current[4];

            if (previous[0].match(/[CcSs]/) === null) {
              // If there is no previous command or if the previous command was not a C, c, S, or s,
              // the control point is coincident with the current point
              controlX = x;
              controlY = y;
            }
            else {
              // calculate reflection of previous control points
              controlX = 2 * x - controlX;
              controlY = 2 * y - controlY;
            }

            ctx.bezierCurveTo(
              controlX + l,
              controlY + t,
              x + current[1] + l,
              y + current[2] + t,
              tempX + l,
              tempY + t
            );
            // set control point to 2nd one of this command
            // "... the first control point is assumed to be
            // the reflection of the second control point on
            // the previous command relative to the current point."
            controlX = x + current[1];
            controlY = y + current[2];

            x = tempX;
            y = tempY;
            break;

          case 'S': // shorthand cubic bezierCurveTo, absolute
            tempX = current[3];
            tempY = current[4];
            if (previous[0].match(/[CcSs]/) === null) {
              // If there is no previous command or if the previous command was not a C, c, S, or s,
              // the control point is coincident with the current point
              controlX = x;
              controlY = y;
            }
            else {
              // calculate reflection of previous control points
              controlX = 2 * x - controlX;
              controlY = 2 * y - controlY;
            }
            ctx.bezierCurveTo(
              controlX + l,
              controlY + t,
              current[1] + l,
              current[2] + t,
              tempX + l,
              tempY + t
            );
            x = tempX;
            y = tempY;

            // set control point to 2nd one of this command
            // "... the first control point is assumed to be
            // the reflection of the second control point on
            // the previous command relative to the current point."
            controlX = current[1];
            controlY = current[2];

            break;

          case 'q': // quadraticCurveTo, relative
            // transform to absolute x,y
            tempX = x + current[3];
            tempY = y + current[4];

            controlX = x + current[1];
            controlY = y + current[2];

            ctx.quadraticCurveTo(
              controlX + l,
              controlY + t,
              tempX + l,
              tempY + t
            );
            x = tempX;
            y = tempY;
            break;

          case 'Q': // quadraticCurveTo, absolute
            tempX = current[3];
            tempY = current[4];

            ctx.quadraticCurveTo(
              current[1] + l,
              current[2] + t,
              tempX + l,
              tempY + t
            );
            x = tempX;
            y = tempY;
            controlX = current[1];
            controlY = current[2];
            break;

          case 't': // shorthand quadraticCurveTo, relative

            // transform to absolute x,y
            tempX = x + current[1];
            tempY = y + current[2];

            if (previous[0].match(/[QqTt]/) === null) {
              // If there is no previous command or if the previous command was not a Q, q, T or t,
              // assume the control point is coincident with the current point
              controlX = x;
              controlY = y;
            }
            else {
              // calculate reflection of previous control point
              controlX = 2 * x - controlX;
              controlY = 2 * y - controlY;
            }

            ctx.quadraticCurveTo(
              controlX + l,
              controlY + t,
              tempX + l,
              tempY + t
            );
            x = tempX;
            y = tempY;

            break;

          case 'T':
            tempX = current[1];
            tempY = current[2];

            if (previous[0].match(/[QqTt]/) === null) {
              // If there is no previous command or if the previous command was not a Q, q, T or t,
              // assume the control point is coincident with the current point
              controlX = x;
              controlY = y;
            }
            else {
              // calculate reflection of previous control point
              controlX = 2 * x - controlX;
              controlY = 2 * y - controlY;
            }
            ctx.quadraticCurveTo(
              controlX + l,
              controlY + t,
              tempX + l,
              tempY + t
            );
            x = tempX;
            y = tempY;
            break;

          case 'a':
            // TODO: optimize this
            drawArc(ctx, x + l, y + t, [
              current[1],
              current[2],
              current[3],
              current[4],
              current[5],
              current[6] + x + l,
              current[7] + y + t
            ]);
            x += current[6];
            y += current[7];
            break;

          case 'A':
            // TODO: optimize this
            drawArc(ctx, x + l, y + t, [
              current[1],
              current[2],
              current[3],
              current[4],
              current[5],
              current[6] + l,
              current[7] + t
            ]);
            x = current[6];
            y = current[7];
            break;

          case 'z':
          case 'Z':
            x = subpathStartX;
            y = subpathStartY;
            ctx.closePath();
            break;
        }
        previous = current;
      }
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx context to render path on
     */
    _render: function(ctx) {
      this._renderPathCommands(ctx);
      this._renderFill(ctx);
      this._renderStroke(ctx);
    },

    /**
     * Returns string representation of an instance
     * @return {String} string representation of an instance
     */
    toString: function() {
      return '#<fabric.Path (' + this.complexity() +
        '): { "top": ' + this.top + ', "left": ' + this.left + ' }>';
    },

    /**
     * Returns object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      var o = extend(this.callSuper('toObject', ['sourcePath', 'pathOffset'].concat(propertiesToInclude)), {
        path: this.path.map(function(item) { return item.slice() })
      });
      return o;
    },

    /**
     * Returns dataless object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} object representation of an instance
     */
    toDatalessObject: function(propertiesToInclude) {
      var o = this.toObject(propertiesToInclude);
      if (this.sourcePath) {
        o.path = this.sourcePath;
      }
      delete o.sourcePath;
      return o;
    },

    /* _TO_SVG_START_ */
    /**
     * Returns svg representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      var chunks = [],
          markup = this._createBaseSVGMarkup(), addTransform = '';

      for (var i = 0, len = this.path.length; i < len; i++) {
        chunks.push(this.path[i].join(' '));
      }
      var path = chunks.join(' ');
      if (!(this.group && this.group.type === 'path-group')) {
        addTransform = ' translate(' + (-this.pathOffset.x) + ', ' + (-this.pathOffset.y) + ') ';
      }
      markup.push(
        '<path ', this.getSvgId(),
          'd="', path,
          '" style="', this.getSvgStyles(),
          '" transform="', this.getSvgTransform(), addTransform,
          this.getSvgTransformMatrix(), '" stroke-linecap="round" ',
        '/>\n'
      );

      return reviver ? reviver(markup.join('')) : markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * Returns number representation of an instance complexity
     * @return {Number} complexity of this instance
     */
    complexity: function() {
      return this.path.length;
    },

    /**
     * @private
     */
    _parsePath: function() {
      var result = [],
          coords = [],
          currentPath,
          parsed,
          re = /([-+]?((\d+\.\d+)|((\d+)|(\.\d+)))(?:e[-+]?\d+)?)/ig,
          match,
          coordsStr;

      for (var i = 0, coordsParsed, len = this.path.length; i < len; i++) {
        currentPath = this.path[i];

        coordsStr = currentPath.slice(1).trim();
        coords.length = 0;

        while ((match = re.exec(coordsStr))) {
          coords.push(match[0]);
        }

        coordsParsed = [currentPath.charAt(0)];

        for (var j = 0, jlen = coords.length; j < jlen; j++) {
          parsed = parseFloat(coords[j]);
          if (!isNaN(parsed)) {
            coordsParsed.push(parsed);
          }
        }

        var command = coordsParsed[0],
            commandLength = commandLengths[command.toLowerCase()],
            repeatedCommand = repeatedCommands[command] || command;

        if (coordsParsed.length - 1 > commandLength) {
          for (var k = 1, klen = coordsParsed.length; k < klen; k += commandLength) {
            result.push([command].concat(coordsParsed.slice(k, k + commandLength)));
            command = repeatedCommand;
          }
        }
        else {
          result.push(coordsParsed);
        }
      }

      return result;
    },

    /**
     * @private
     */
    _parseDimensions: function() {

      var aX = [],
          aY = [],
          current, // current instruction
          previous = null,
          subpathStartX = 0,
          subpathStartY = 0,
          x = 0, // current x
          y = 0, // current y
          controlX = 0, // current control point x
          controlY = 0, // current control point y
          tempX,
          tempY,
          bounds;

      for (var i = 0, len = this.path.length; i < len; ++i) {

        current = this.path[i];

        switch (current[0]) { // first letter

          case 'l': // lineto, relative
            x += current[1];
            y += current[2];
            bounds = [];
            break;

          case 'L': // lineto, absolute
            x = current[1];
            y = current[2];
            bounds = [];
            break;

          case 'h': // horizontal lineto, relative
            x += current[1];
            bounds = [];
            break;

          case 'H': // horizontal lineto, absolute
            x = current[1];
            bounds = [];
            break;

          case 'v': // vertical lineto, relative
            y += current[1];
            bounds = [];
            break;

          case 'V': // verical lineto, absolute
            y = current[1];
            bounds = [];
            break;

          case 'm': // moveTo, relative
            x += current[1];
            y += current[2];
            subpathStartX = x;
            subpathStartY = y;
            bounds = [];
            break;

          case 'M': // moveTo, absolute
            x = current[1];
            y = current[2];
            subpathStartX = x;
            subpathStartY = y;
            bounds = [];
            break;

          case 'c': // bezierCurveTo, relative
            tempX = x + current[5];
            tempY = y + current[6];
            controlX = x + current[3];
            controlY = y + current[4];
            bounds = fabric.util.getBoundsOfCurve(x, y,
              x + current[1], // x1
              y + current[2], // y1
              controlX, // x2
              controlY, // y2
              tempX,
              tempY
            );
            x = tempX;
            y = tempY;
            break;

          case 'C': // bezierCurveTo, absolute
            x = current[5];
            y = current[6];
            controlX = current[3];
            controlY = current[4];
            bounds = fabric.util.getBoundsOfCurve(x, y,
              current[1],
              current[2],
              controlX,
              controlY,
              x,
              y
            );
            break;

          case 's': // shorthand cubic bezierCurveTo, relative

            // transform to absolute x,y
            tempX = x + current[3];
            tempY = y + current[4];

            if (previous[0].match(/[CcSs]/) === null) {
              // If there is no previous command or if the previous command was not a C, c, S, or s,
              // the control point is coincident with the current point
              controlX = x;
              controlY = y;
            }
            else {
              // calculate reflection of previous control points
              controlX = 2 * x - controlX;
              controlY = 2 * y - controlY;
            }

            bounds = fabric.util.getBoundsOfCurve(x, y,
              controlX,
              controlY,
              x + current[1],
              y + current[2],
              tempX,
              tempY
            );
            // set control point to 2nd one of this command
            // "... the first control point is assumed to be
            // the reflection of the second control point on
            // the previous command relative to the current point."
            controlX = x + current[1];
            controlY = y + current[2];
            x = tempX;
            y = tempY;
            break;

          case 'S': // shorthand cubic bezierCurveTo, absolute
            tempX = current[3];
            tempY = current[4];
            if (previous[0].match(/[CcSs]/) === null) {
              // If there is no previous command or if the previous command was not a C, c, S, or s,
              // the control point is coincident with the current point
              controlX = x;
              controlY = y;
            }
            else {
              // calculate reflection of previous control points
              controlX = 2 * x - controlX;
              controlY = 2 * y - controlY;
            }
            bounds = fabric.util.getBoundsOfCurve(x, y,
              controlX,
              controlY,
              current[1],
              current[2],
              tempX,
              tempY
            );
            x = tempX;
            y = tempY;
            // set control point to 2nd one of this command
            // "... the first control point is assumed to be
            // the reflection of the second control point on
            // the previous command relative to the current point."
            controlX = current[1];
            controlY = current[2];
            break;

          case 'q': // quadraticCurveTo, relative
            // transform to absolute x,y
            tempX = x + current[3];
            tempY = y + current[4];
            controlX = x + current[1];
            controlY = y + current[2];
            bounds = fabric.util.getBoundsOfCurve(x, y,
              controlX,
              controlY,
              controlX,
              controlY,
              tempX,
              tempY
            );
            x = tempX;
            y = tempY;
            break;

          case 'Q': // quadraticCurveTo, absolute
            controlX = current[1];
            controlY = current[2];
            bounds = fabric.util.getBoundsOfCurve(x, y,
              controlX,
              controlY,
              controlX,
              controlY,
              current[3],
              current[4]
            );
            x = current[3];
            y = current[4];
            break;

          case 't': // shorthand quadraticCurveTo, relative
            // transform to absolute x,y
            tempX = x + current[1];
            tempY = y + current[2];
            if (previous[0].match(/[QqTt]/) === null) {
              // If there is no previous command or if the previous command was not a Q, q, T or t,
              // assume the control point is coincident with the current point
              controlX = x;
              controlY = y;
            }
            else {
              // calculate reflection of previous control point
              controlX = 2 * x - controlX;
              controlY = 2 * y - controlY;
            }

            bounds = fabric.util.getBoundsOfCurve(x, y,
              controlX,
              controlY,
              controlX,
              controlY,
              tempX,
              tempY
            );
            x = tempX;
            y = tempY;

            break;

          case 'T':
            tempX = current[1];
            tempY = current[2];

            if (previous[0].match(/[QqTt]/) === null) {
              // If there is no previous command or if the previous command was not a Q, q, T or t,
              // assume the control point is coincident with the current point
              controlX = x;
              controlY = y;
            }
            else {
              // calculate reflection of previous control point
              controlX = 2 * x - controlX;
              controlY = 2 * y - controlY;
            }
            bounds = fabric.util.getBoundsOfCurve(x, y,
              controlX,
              controlY,
              controlX,
              controlY,
              tempX,
              tempY
            );
            x = tempX;
            y = tempY;
            break;

          case 'a':
            // TODO: optimize this
            bounds = fabric.util.getBoundsOfArc(x, y,
              current[1],
              current[2],
              current[3],
              current[4],
              current[5],
              current[6] + x,
              current[7] + y
            );
            x += current[6];
            y += current[7];
            break;

          case 'A':
            // TODO: optimize this
            bounds = fabric.util.getBoundsOfArc(x, y,
              current[1],
              current[2],
              current[3],
              current[4],
              current[5],
              current[6],
              current[7]
            );
            x = current[6];
            y = current[7];
            break;

          case 'z':
          case 'Z':
            x = subpathStartX;
            y = subpathStartY;
            break;
        }
        previous = current;
        bounds.forEach(function (point) {
          aX.push(point.x);
          aY.push(point.y);
        });
        aX.push(x);
        aY.push(y);
      }

      var minX = min(aX) || 0,
          minY = min(aY) || 0,
          maxX = max(aX) || 0,
          maxY = max(aY) || 0,
          deltaX = maxX - minX,
          deltaY = maxY - minY,

          o = {
            left: minX,
            top: minY,
            width: deltaX,
            height: deltaY
          };

      return o;
    }
  });

  /**
   * Creates an instance of fabric.Path from an object
   * @static
   * @memberOf fabric.Path
   * @param {Object} object
   * @param {Function} [callback] Callback to invoke when an fabric.Path instance is created
   */
  fabric.Path.fromObject = function(object, callback) {
    // remove this pattern rom 2.0, accept just object.
    var path;
    if (typeof object.path === 'string') {
      fabric.loadSVGFromURL(object.path, function (elements) {
        var pathUrl = object.path;
        path = elements[0];
        delete object.path;

        fabric.util.object.extend(path, object);
        path.setSourcePath(pathUrl);

        callback && callback(path);
      });
    }
    else {
      path = new fabric.Path(object.path, object);
      callback && callback(path);
      return path;
    }
  };

  /* _FROM_SVG_START_ */
  /**
   * List of attribute names to account for when parsing SVG element (used by `fabric.Path.fromElement`)
   * @static
   * @memberOf fabric.Path
   * @see http://www.w3.org/TR/SVG/paths.html#PathElement
   */
  fabric.Path.ATTRIBUTE_NAMES = fabric.SHARED_ATTRIBUTES.concat(['d']);

  /**
   * Creates an instance of fabric.Path from an SVG <path> element
   * @static
   * @memberOf fabric.Path
   * @param {SVGElement} element to parse
   * @param {Function} callback Callback to invoke when an fabric.Path instance is created
   * @param {Object} [options] Options object
   */
  fabric.Path.fromElement = function(element, callback, options) {
    var parsedAttributes = fabric.parseAttributes(element, fabric.Path.ATTRIBUTE_NAMES);
    callback && callback(new fabric.Path(parsedAttributes.d, extend(parsedAttributes, options)));
  };
  /* _FROM_SVG_END_ */

  /**
   * Indicates that instances of this type are async
   * @static
   * @memberOf fabric.Path
   * @type Boolean
   * @default
   */
  fabric.Path.async = true;

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      invoke = fabric.util.array.invoke,
      parentToObject = fabric.Object.prototype.toObject;

  if (fabric.PathGroup) {
    fabric.warn('fabric.PathGroup is already defined');
    return;
  }

  /**
   * Path group class
   * @class fabric.PathGroup
   * @extends fabric.Path
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-1#path_and_pathgroup}
   * @see {@link fabric.PathGroup#initialize} for constructor definition
   */
  fabric.PathGroup = fabric.util.createClass(fabric.Path, /** @lends fabric.PathGroup.prototype */ {

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'path-group',

    /**
     * Fill value
     * @type String
     * @default
     */
    fill: '',

    /**
     * Constructor
     * @param {Array} paths
     * @param {Object} [options] Options object
     * @return {fabric.PathGroup} thisArg
     */
    initialize: function(paths, options) {

      options = options || { };
      this.paths = paths || [];

      for (var i = this.paths.length; i--;) {
        this.paths[i].group = this;
      }

      if (options.toBeParsed) {
        this.parseDimensionsFromPaths(options);
        delete options.toBeParsed;
      }
      this.setOptions(options);
      this.setCoords();

      if (options.sourcePath) {
        this.setSourcePath(options.sourcePath);
      }
    },

    /**
     * Calculate width and height based on paths contained
     */
    parseDimensionsFromPaths: function(options) {
      var points, p, xC = [], yC = [], path, height, width,
          m;
      for (var j = this.paths.length; j--;) {
        path = this.paths[j];
        height = path.height + path.strokeWidth;
        width = path.width + path.strokeWidth;
        points = [
          { x: path.left, y: path.top },
          { x: path.left + width, y: path.top },
          { x: path.left, y: path.top + height },
          { x: path.left + width, y: path.top + height }
        ];
        m = this.paths[j].transformMatrix;
        for (var i = 0; i < points.length; i++) {
          p = points[i];
          if (m) {
            p = fabric.util.transformPoint(p, m, false);
          }
          xC.push(p.x);
          yC.push(p.y);
        }
      }
      options.width = Math.max.apply(null, xC);
      options.height = Math.max.apply(null, yC);
    },

    /**
     * Renders this group on a specified context
     * @param {CanvasRenderingContext2D} ctx Context to render this instance on
     */
    render: function(ctx) {
      // do not render if object is not visible
      if (!this.visible) {
        return;
      }

      ctx.save();

      if (this.transformMatrix) {
        ctx.transform.apply(ctx, this.transformMatrix);
      }
      this.transform(ctx);

      this._setShadow(ctx);
      this.clipTo && fabric.util.clipContext(this, ctx);
      ctx.translate(-this.width / 2, -this.height / 2);
      for (var i = 0, l = this.paths.length; i < l; ++i) {
        this.paths[i].render(ctx, true);
      }
      this.clipTo && ctx.restore();
      ctx.restore();
    },

    /**
     * Sets certain property to a certain value
     * @param {String} prop
     * @param {*} value
     * @return {fabric.PathGroup} thisArg
     */
    _set: function(prop, value) {

      if (prop === 'fill' && value && this.isSameColor()) {
        var i = this.paths.length;
        while (i--) {
          this.paths[i]._set(prop, value);
        }
      }

      return this.callSuper('_set', prop, value);
    },

    /**
     * Returns object representation of this path group
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      var o = extend(parentToObject.call(this, ['sourcePath'].concat(propertiesToInclude)), {
        paths: invoke(this.getObjects(), 'toObject', propertiesToInclude)
      });
      return o;
    },

    /**
     * Returns dataless object representation of this path group
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} dataless object representation of an instance
     */
    toDatalessObject: function(propertiesToInclude) {
      var o = this.toObject(propertiesToInclude);
      if (this.sourcePath) {
        o.paths = this.sourcePath;
      }
      return o;
    },

    /* _TO_SVG_START_ */
    /**
     * Returns svg representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      var objects = this.getObjects(),
          p = this.getPointByOrigin('left', 'top'),
          translatePart = 'translate(' + p.x + ' ' + p.y + ')',
          markup = this._createBaseSVGMarkup();
      markup.push(
        '<g ', this.getSvgId(),
        'style="', this.getSvgStyles(), '" ',
        'transform="', this.getSvgTransformMatrix(), translatePart, this.getSvgTransform(), '" ',
        '>\n'
      );

      for (var i = 0, len = objects.length; i < len; i++) {
        markup.push('\t', objects[i].toSVG(reviver));
      }
      markup.push('</g>\n');

      return reviver ? reviver(markup.join('')) : markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * Returns a string representation of this path group
     * @return {String} string representation of an object
     */
    toString: function() {
      return '#<fabric.PathGroup (' + this.complexity() +
        '): { top: ' + this.top + ', left: ' + this.left + ' }>';
    },

    /**
     * Returns true if all paths in this group are of same color
     * @return {Boolean} true if all paths are of the same color (`fill`)
     */
    isSameColor: function() {
      var firstPathFill = this.getObjects()[0].get('fill') || '';
      if (typeof firstPathFill !== 'string') {
        return false;
      }
      firstPathFill = firstPathFill.toLowerCase();
      return this.getObjects().every(function(path) {
        var pathFill = path.get('fill') || '';
        return typeof pathFill === 'string' && (pathFill).toLowerCase() === firstPathFill;
      });
    },

    /**
     * Returns number representation of object's complexity
     * @return {Number} complexity
     */
    complexity: function() {
      return this.paths.reduce(function(total, path) {
        return total + ((path && path.complexity) ? path.complexity() : 0);
      }, 0);
    },

    /**
     * Returns all paths in this path group
     * @return {Array} array of path objects included in this path group
     */
    getObjects: function() {
      return this.paths;
    }
  });

  /**
   * Creates fabric.PathGroup instance from an object representation
   * @static
   * @memberOf fabric.PathGroup
   * @param {Object} object Object to create an instance from
   * @param {Function} [callback] Callback to invoke when an fabric.PathGroup instance is created
   */
  fabric.PathGroup.fromObject = function(object, callback) {
    // remove this pattern from 2.0 accepts only object
    if (typeof object.paths === 'string') {
      fabric.loadSVGFromURL(object.paths, function (elements) {

        var pathUrl = object.paths;
        delete object.paths;

        var pathGroup = fabric.util.groupSVGElements(elements, object, pathUrl);

        callback(pathGroup);
      });
    }
    else {
      fabric.util.enlivenObjects(object.paths, function(enlivenedObjects) {
        delete object.paths;
        callback(new fabric.PathGroup(enlivenedObjects, object));
      });
    }
  };

  /**
   * Indicates that instances of this type are async
   * @static
   * @memberOf fabric.PathGroup
   * @type Boolean
   * @default
   */
  fabric.PathGroup.async = true;

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      min = fabric.util.array.min,
      max = fabric.util.array.max,
      invoke = fabric.util.array.invoke;

  if (fabric.Group) {
    return;
  }

  // lock-related properties, for use in fabric.Group#get
  // to enable locking behavior on group
  // when one of its objects has lock-related properties set
  var _lockProperties = {
    lockMovementX:  true,
    lockMovementY:  true,
    lockRotation:   true,
    lockScalingX:   true,
    lockScalingY:   true,
    lockUniScaling: true
  };

  /**
   * Group class
   * @class fabric.Group
   * @extends fabric.Object
   * @mixes fabric.Collection
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-3#groups}
   * @see {@link fabric.Group#initialize} for constructor definition
   */
  fabric.Group = fabric.util.createClass(fabric.Object, fabric.Collection, /** @lends fabric.Group.prototype */ {

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'group',

    /**
     * Width of stroke
     * @type Number
     * @default
     */
    strokeWidth: 0,

    /**
     * Indicates if click events should also check for subtargets
     * @type Boolean
     * @default
     */
    subTargetCheck: false,

    /**
     * Constructor
     * @param {Object} objects Group objects
     * @param {Object} [options] Options object
     * @param {Boolean} [isAlreadyGrouped] if true, objects have been grouped already.
     * @return {Object} thisArg
     */
    initialize: function(objects, options, isAlreadyGrouped) {
      options = options || { };

      this._objects = [];
      // if objects enclosed in a group have been grouped already,
      // we cannot change properties of objects.
      // Thus we need to set options to group without objects,
      // because delegatedProperties propagate to objects.
      isAlreadyGrouped && this.callSuper('initialize', options);

      this._objects = objects || [];
      for (var i = this._objects.length; i--; ) {
        this._objects[i].group = this;
      }

      this.originalState = { };

      if (options.originX) {
        this.originX = options.originX;
      }
      if (options.originY) {
        this.originY = options.originY;
      }

      if (isAlreadyGrouped) {
        // do not change coordinate of objects enclosed in a group,
        // because objects coordinate system have been group coodinate system already.
        this._updateObjectsCoords(true);
      }
      else {
        this._calcBounds();
        this._updateObjectsCoords();
        this.callSuper('initialize', options);
      }

      this.setCoords();
      this.saveCoords();
    },

    /**
     * @private
     * @param {Boolean} [skipCoordsChange] if true, coordinates of objects enclosed in a group do not change
     */
    _updateObjectsCoords: function(skipCoordsChange) {
      for (var i = this._objects.length; i--; ){
        this._updateObjectCoords(this._objects[i], skipCoordsChange);
      }
    },

    /**
     * @private
     * @param {Object} object
     * @param {Boolean} [skipCoordsChange] if true, coordinates of object dose not change
     */
    _updateObjectCoords: function(object, skipCoordsChange) {
      // do not display corners of objects enclosed in a group
      object.__origHasControls = object.hasControls;
      object.hasControls = false;

      if (skipCoordsChange) {
        return;
      }

      var objectLeft = object.getLeft(),
          objectTop = object.getTop(),
          center = this.getCenterPoint();

      object.set({
        originalLeft: objectLeft,
        originalTop: objectTop,
        left: objectLeft - center.x,
        top: objectTop - center.y
      });
      object.setCoords();
    },

    /**
     * Returns string represenation of a group
     * @return {String}
     */
    toString: function() {
      return '#<fabric.Group: (' + this.complexity() + ')>';
    },

    /**
     * Adds an object to a group; Then recalculates group's dimension, position.
     * @param {Object} object
     * @return {fabric.Group} thisArg
     * @chainable
     */
    addWithUpdate: function(object) {
      this._restoreObjectsState();
      fabric.util.resetObjectTransform(this);
      if (object) {
        this._objects.push(object);
        object.group = this;
        object._set('canvas', this.canvas);
      }
      // since _restoreObjectsState set objects inactive
      this.forEachObject(this._setObjectActive, this);
      this._calcBounds();
      this._updateObjectsCoords();
      return this;
    },

    /**
     * @private
     */
    _setObjectActive: function(object) {
      object.set('active', true);
      object.group = this;
    },

    /**
     * Removes an object from a group; Then recalculates group's dimension, position.
     * @param {Object} object
     * @return {fabric.Group} thisArg
     * @chainable
     */
    removeWithUpdate: function(object) {
      this._restoreObjectsState();
      fabric.util.resetObjectTransform(this);
      // since _restoreObjectsState set objects inactive
      this.forEachObject(this._setObjectActive, this);

      this.remove(object);
      this._calcBounds();
      this._updateObjectsCoords();

      return this;
    },

    /**
     * @private
     */
    _onObjectAdded: function(object) {
      object.group = this;
      object._set('canvas', this.canvas);
    },

    /**
     * @private
     */
    _onObjectRemoved: function(object) {
      delete object.group;
      object.set('active', false);
    },

    /**
     * Properties that are delegated to group objects when reading/writing
     * @param {Object} delegatedProperties
     */
    delegatedProperties: {
      fill:             true,
      stroke:           true,
      strokeWidth:      true,
      fontFamily:       true,
      fontWeight:       true,
      fontSize:         true,
      fontStyle:        true,
      lineHeight:       true,
      textDecoration:   true,
      textAlign:        true,
      backgroundColor:  true
    },

    /**
     * @private
     */
    _set: function(key, value) {
      var i = this._objects.length;

      if (this.delegatedProperties[key] || key === 'canvas') {
        while (i--) {
          this._objects[i].set(key, value);
        }
      }
      else {
        while (i--) {
          this._objects[i].setOnGroup(key, value);
        }
      }

      this.callSuper('_set', key, value);
    },

    /**
     * Returns object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      return extend(this.callSuper('toObject', propertiesToInclude), {
        objects: invoke(this._objects, 'toObject', propertiesToInclude)
      });
    },

    /**
     * Renders instance on a given context
     * @param {CanvasRenderingContext2D} ctx context to render instance on
     */
    render: function(ctx) {
      // do not render if object is not visible
      if (!this.visible) {
        return;
      }

      ctx.save();
      if (this.transformMatrix) {
        ctx.transform.apply(ctx, this.transformMatrix);
      }
      this.transform(ctx);
      this._setShadow(ctx);
      this.clipTo && fabric.util.clipContext(this, ctx);
      this._transformDone = true;
      // the array is now sorted in order of highest first, so start from end
      for (var i = 0, len = this._objects.length; i < len; i++) {
        this._renderObject(this._objects[i], ctx);
      }

      this.clipTo && ctx.restore();
      ctx.restore();
      this._transformDone = false;
    },

    /**
     * Renders controls and borders for the object
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Boolean} [noTransform] When true, context is not transformed
     */
    _renderControls: function(ctx, noTransform) {
      this.callSuper('_renderControls', ctx, noTransform);
      for (var i = 0, len = this._objects.length; i < len; i++) {
        this._objects[i]._renderControls(ctx);
      }
    },

    /**
     * @private
     */
    _renderObject: function(object, ctx) {
      // do not render if object is not visible
      if (!object.visible) {
        return;
      }

      var originalHasRotatingPoint = object.hasRotatingPoint;
      object.hasRotatingPoint = false;
      object.render(ctx);
      object.hasRotatingPoint = originalHasRotatingPoint;
    },

    /**
     * Retores original state of each of group objects (original state is that which was before group was created).
     * @private
     * @return {fabric.Group} thisArg
     * @chainable
     */
    _restoreObjectsState: function() {
      this._objects.forEach(this._restoreObjectState, this);
      return this;
    },

    /**
     * Realises the transform from this group onto the supplied object
     * i.e. it tells you what would happen if the supplied object was in
     * the group, and then the group was destroyed. It mutates the supplied
     * object.
     * @param {fabric.Object} object
     * @return {fabric.Object} transformedObject
     */
    realizeTransform: function(object) {
      var matrix = object.calcTransformMatrix(),
          options = fabric.util.qrDecompose(matrix),
          center = new fabric.Point(options.translateX, options.translateY);
      object.scaleX = options.scaleX;
      object.scaleY = options.scaleY;
      object.skewX = options.skewX;
      object.skewY = options.skewY;
      object.angle = options.angle;
      object.flipX = false;
      object.flipY = false;
      object.setPositionByOrigin(center, 'center', 'center');
      return object;
    },

    /**
     * Restores original state of a specified object in group
     * @private
     * @param {fabric.Object} object
     * @return {fabric.Group} thisArg
     */
    _restoreObjectState: function(object) {
      this.realizeTransform(object);
      object.setCoords();
      object.hasControls = object.__origHasControls;
      delete object.__origHasControls;
      object.set('active', false);
      delete object.group;

      return this;
    },

    /**
     * Destroys a group (restoring state of its objects)
     * @return {fabric.Group} thisArg
     * @chainable
     */
    destroy: function() {
      return this._restoreObjectsState();
    },

    /**
     * Saves coordinates of this instance (to be used together with `hasMoved`)
     * @saveCoords
     * @return {fabric.Group} thisArg
     * @chainable
     */
    saveCoords: function() {
      this._originalLeft = this.get('left');
      this._originalTop = this.get('top');
      return this;
    },

    /**
     * Checks whether this group was moved (since `saveCoords` was called last)
     * @return {Boolean} true if an object was moved (since fabric.Group#saveCoords was called)
     */
    hasMoved: function() {
      return this._originalLeft !== this.get('left') ||
             this._originalTop !== this.get('top');
    },

    /**
     * Sets coordinates of all group objects
     * @return {fabric.Group} thisArg
     * @chainable
     */
    setObjectsCoords: function() {
      this.forEachObject(function(object) {
        object.setCoords();
      });
      return this;
    },

    /**
     * @private
     */
    _calcBounds: function(onlyWidthHeight) {
      var aX = [],
          aY = [],
          o, prop,
          props = ['tr', 'br', 'bl', 'tl'],
          i = 0, iLen = this._objects.length,
          j, jLen = props.length;

      for ( ; i < iLen; ++i) {
        o = this._objects[i];
        o.setCoords();
        for (j = 0; j < jLen; j++) {
          prop = props[j];
          aX.push(o.oCoords[prop].x);
          aY.push(o.oCoords[prop].y);
        }
      }

      this.set(this._getBounds(aX, aY, onlyWidthHeight));
    },

    /**
     * @private
     */
    _getBounds: function(aX, aY, onlyWidthHeight) {
      var ivt = fabric.util.invertTransform(this.getViewportTransform()),
          minXY = fabric.util.transformPoint(new fabric.Point(min(aX), min(aY)), ivt),
          maxXY = fabric.util.transformPoint(new fabric.Point(max(aX), max(aY)), ivt),
          obj = {
            width: (maxXY.x - minXY.x) || 0,
            height: (maxXY.y - minXY.y) || 0
          };

      if (!onlyWidthHeight) {
        obj.left = minXY.x || 0;
        obj.top = minXY.y || 0;
        if (this.originX === 'center') {
          obj.left += obj.width / 2;
        }
        if (this.originX === 'right') {
          obj.left += obj.width;
        }
        if (this.originY === 'center') {
          obj.top += obj.height / 2;
        }
        if (this.originY === 'bottom') {
          obj.top += obj.height;
        }
      }
      return obj;
    },

    /* _TO_SVG_START_ */
    /**
     * Returns svg representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      var markup = this._createBaseSVGMarkup();
      markup.push(
        '<g ', this.getSvgId(), 'transform="',
        /* avoiding styles intentionally */
        this.getSvgTransform(),
        this.getSvgTransformMatrix(),
        '" style="',
        this.getSvgFilter(),
        '">\n'
      );

      for (var i = 0, len = this._objects.length; i < len; i++) {
        markup.push('\t', this._objects[i].toSVG(reviver));
      }

      markup.push('</g>\n');

      return reviver ? reviver(markup.join('')) : markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * Returns requested property
     * @param {String} prop Property to get
     * @return {*}
     */
    get: function(prop) {
      if (prop in _lockProperties) {
        if (this[prop]) {
          return this[prop];
        }
        else {
          for (var i = 0, len = this._objects.length; i < len; i++) {
            if (this._objects[i][prop]) {
              return true;
            }
          }
          return false;
        }
      }
      else {
        if (prop in this.delegatedProperties) {
          return this._objects[0] && this._objects[0].get(prop);
        }
        return this[prop];
      }
    }
  });

  /**
   * Returns {@link fabric.Group} instance from an object representation
   * @static
   * @memberOf fabric.Group
   * @param {Object} object Object to create a group from
   * @param {Function} [callback] Callback to invoke when an group instance is created
   */
  fabric.Group.fromObject = function(object, callback) {
    fabric.util.enlivenObjects(object.objects, function(enlivenedObjects) {
      delete object.objects;
      callback && callback(new fabric.Group(enlivenedObjects, object, true));
    });
  };

  /**
   * Indicates that instances of this type are async
   * @static
   * @memberOf fabric.Group
   * @type Boolean
   * @default
   */
  fabric.Group.async = true;

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var extend = fabric.util.object.extend;

  if (!global.fabric) {
    global.fabric = { };
  }

  if (global.fabric.Image) {
    fabric.warn('fabric.Image is already defined.');
    return;
  }

  var stateProperties = fabric.Object.prototype.stateProperties.concat();
  stateProperties.push(
    'alignX',
    'alignY',
    'meetOrSlice'
  );

  /**
   * Image class
   * @class fabric.Image
   * @extends fabric.Object
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-1#images}
   * @see {@link fabric.Image#initialize} for constructor definition
   */
  fabric.Image = fabric.util.createClass(fabric.Object, /** @lends fabric.Image.prototype */ {

    /**
     * Type of an object
     * @type String
     * @default
     */
    type: 'image',

    /**
     * crossOrigin value (one of "", "anonymous", "use-credentials")
     * @see https://developer.mozilla.org/en-US/docs/HTML/CORS_settings_attributes
     * @type String
     * @default
     */
    crossOrigin: '',

    /**
     * AlignX value, part of preserveAspectRatio (one of "none", "mid", "min", "max")
     * @see http://www.w3.org/TR/SVG/coords.html#PreserveAspectRatioAttribute
     * This parameter defines how the picture is aligned to its viewport when image element width differs from image width.
     * @type String
     * @default
     */
    alignX: 'none',

    /**
     * AlignY value, part of preserveAspectRatio (one of "none", "mid", "min", "max")
     * @see http://www.w3.org/TR/SVG/coords.html#PreserveAspectRatioAttribute
     * This parameter defines how the picture is aligned to its viewport when image element height differs from image height.
     * @type String
     * @default
     */
    alignY: 'none',

    /**
     * meetOrSlice value, part of preserveAspectRatio  (one of "meet", "slice").
     * if meet the image is always fully visibile, if slice the viewport is always filled with image.
     * @see http://www.w3.org/TR/SVG/coords.html#PreserveAspectRatioAttribute
     * @type String
     * @default
     */
    meetOrSlice: 'meet',

    /**
     * Width of a stroke.
     * For image quality a stroke multiple of 2 gives better results.
     * @type Number
     * @default
     */
    strokeWidth: 0,

    /**
     * private
     * contains last value of scaleX to detect
     * if the Image got resized after the last Render
     * @type Number
     */
    _lastScaleX: 1,

    /**
     * private
     * contains last value of scaleY to detect
     * if the Image got resized after the last Render
     * @type Number
     */
    _lastScaleY: 1,

    /**
     * minimum scale factor under which any resizeFilter is triggered to resize the image
     * 0 will disable the automatic resize. 1 will trigger automatically always.
     * number bigger than 1 can be used in case we want to scale with some filter above
     * the natural image dimensions
     * @type Number
     */
    minimumScaleTrigger: 0.5,

    /**
     * List of properties to consider when checking if
     * state of an object is changed ({@link fabric.Object#hasStateChanged})
     * as well as for history (undo/redo) purposes
     * @type Array
     */
    stateProperties: stateProperties,

    /**
     * Constructor
     * @param {HTMLImageElement | String} element Image element
     * @param {Object} [options] Options object
     * @param {function} [callback] callback function to call after eventual filters applied.
     * @return {fabric.Image} thisArg
     */
    initialize: function(element, options, callback) {
      options || (options = { });
      this.filters = [];
      this.resizeFilters = [];
      this.callSuper('initialize', options);
      this._initElement(element, options, callback);
    },

    /**
     * Returns image element which this instance if based on
     * @return {HTMLImageElement} Image element
     */
    getElement: function() {
      return this._element;
    },

    /**
     * Sets image element for this instance to a specified one.
     * If filters defined they are applied to new image.
     * You might need to call `canvas.renderAll` and `object.setCoords` after replacing, to render new image and update controls area.
     * @param {HTMLImageElement} element
     * @param {Function} [callback] Callback is invoked when all filters have been applied and new image is generated
     * @param {Object} [options] Options object
     * @return {fabric.Image} thisArg
     * @chainable
     */
    setElement: function(element, callback, options) {

      var _callback, _this;

      this._element = element;
      this._originalElement = element;
      this._initConfig(options);

      if (this.resizeFilters.length === 0) {
        _callback = callback;
      }
      else {
        _this = this;
        _callback = function() {
          _this.applyFilters(callback, _this.resizeFilters, _this._filteredEl || _this._originalElement, true);
        };
      }

      if (this.filters.length !== 0) {
        this.applyFilters(_callback);
      }
      else if (_callback) {
        _callback(this);
      }

      return this;
    },

    /**
     * Sets crossOrigin value (on an instance and corresponding image element)
     * @return {fabric.Image} thisArg
     * @chainable
     */
    setCrossOrigin: function(value) {
      this.crossOrigin = value;
      this._element.crossOrigin = value;

      return this;
    },

    /**
     * Returns original size of an image
     * @return {Object} Object with "width" and "height" properties
     */
    getOriginalSize: function() {
      var element = this.getElement();
      return {
        width: element.width,
        height: element.height
      };
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _stroke: function(ctx) {
      if (!this.stroke || this.strokeWidth === 0) {
        return;
      }
      var w = this.width / 2, h = this.height / 2;
      ctx.beginPath();
      ctx.moveTo(-w, -h);
      ctx.lineTo(w, -h);
      ctx.lineTo(w, h);
      ctx.lineTo(-w, h);
      ctx.lineTo(-w, -h);
      ctx.closePath();
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderDashedStroke: function(ctx) {
      var x = -this.width / 2,
          y = -this.height / 2,
          w = this.width,
          h = this.height;

      ctx.save();
      this._setStrokeStyles(ctx);

      ctx.beginPath();
      fabric.util.drawDashedLine(ctx, x, y, x + w, y, this.strokeDashArray);
      fabric.util.drawDashedLine(ctx, x + w, y, x + w, y + h, this.strokeDashArray);
      fabric.util.drawDashedLine(ctx, x + w, y + h, x, y + h, this.strokeDashArray);
      fabric.util.drawDashedLine(ctx, x, y + h, x, y, this.strokeDashArray);
      ctx.closePath();
      ctx.restore();
    },

    /**
     * Returns object representation of an instance
     * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
     * @return {Object} Object representation of an instance
     */
    toObject: function(propertiesToInclude) {
      var filters = [], resizeFilters = [],
          scaleX = 1, scaleY = 1;

      this.filters.forEach(function(filterObj) {
        if (filterObj) {
          if (filterObj.type === 'Resize') {
            scaleX *= filterObj.scaleX;
            scaleY *= filterObj.scaleY;
          }
          filters.push(filterObj.toObject());
        }
      });

      this.resizeFilters.forEach(function(filterObj) {
        filterObj && resizeFilters.push(filterObj.toObject());
      });
      var object = extend(
        this.callSuper(
          'toObject',
          ['crossOrigin', 'alignX', 'alignY', 'meetOrSlice'].concat(propertiesToInclude)
        ), {
          src: this.getSrc(),
          filters: filters,
          resizeFilters: resizeFilters,
        });

      object.width /= scaleX;
      object.height /= scaleY;

      return object;
    },

    /* _TO_SVG_START_ */
    /**
     * Returns SVG representation of an instance
     * @param {Function} [reviver] Method for further parsing of svg representation.
     * @return {String} svg representation of an instance
     */
    toSVG: function(reviver) {
      var markup = this._createBaseSVGMarkup(), x = -this.width / 2, y = -this.height / 2,
          preserveAspectRatio = 'none', filtered = true;
      if (this.group && this.group.type === 'path-group') {
        x = this.left;
        y = this.top;
      }
      if (this.alignX !== 'none' && this.alignY !== 'none') {
        preserveAspectRatio = 'x' + this.alignX + 'Y' + this.alignY + ' ' + this.meetOrSlice;
      }
      markup.push(
        '<g transform="', this.getSvgTransform(), this.getSvgTransformMatrix(), '">\n',
          '<image ', this.getSvgId(), 'xlink:href="', this.getSvgSrc(filtered),
            '" x="', x, '" y="', y,
            '" style="', this.getSvgStyles(),
            // we're essentially moving origin of transformation from top/left corner to the center of the shape
            // by wrapping it in container <g> element with actual transformation, then offsetting object to the top/left
            // so that object's center aligns with container's left/top
            '" width="', this.width,
            '" height="', this.height,
            '" preserveAspectRatio="', preserveAspectRatio, '"',
          '></image>\n'
      );

      if (this.stroke || this.strokeDashArray) {
        var origFill = this.fill;
        this.fill = null;
        markup.push(
          '<rect ',
            'x="', x, '" y="', y,
            '" width="', this.width, '" height="', this.height,
            '" style="', this.getSvgStyles(),
          '"/>\n'
        );
        this.fill = origFill;
      }

      markup.push('</g>\n');

      return reviver ? reviver(markup.join('')) : markup.join('');
    },
    /* _TO_SVG_END_ */

    /**
     * Returns source of an image
     * @param {Boolean} filtered indicates if the src is needed for svg
     * @return {String} Source of an image
     */
    getSrc: function(filtered) {
      var element = filtered ? this._element : this._originalElement;
      if (element) {
        return fabric.isLikelyNode ? element._src : element.src;
      }
      else {
        return this.src || '';
      }
    },

    /**
     * Sets source of an image
     * @param {String} src Source string (URL)
     * @param {Function} [callback] Callback is invoked when image has been loaded (and all filters have been applied)
     * @param {Object} [options] Options object
     * @return {fabric.Image} thisArg
     * @chainable
     */
    setSrc: function(src, callback, options) {
      fabric.util.loadImage(src, function(img) {
        return this.setElement(img, callback, options);
      }, this, options && options.crossOrigin);
    },

    /**
     * Returns string representation of an instance
     * @return {String} String representation of an instance
     */
    toString: function() {
      return '#<fabric.Image: { src: "' + this.getSrc() + '" }>';
    },

    /**
     * Applies filters assigned to this image (from "filters" array)
     * @method applyFilters
     * @param {Function} callback Callback is invoked when all filters have been applied and new image is generated
     * @param {Array} filters to be applied
     * @param {fabric.Image} imgElement image to filter ( default to this._element )
     * @param {Boolean} forResizing
     * @return {CanvasElement} canvasEl to be drawn immediately
     * @chainable
     */
    applyFilters: function(callback, filters, imgElement, forResizing) {

      filters = filters || this.filters;
      imgElement = imgElement || this._originalElement;

      if (!imgElement) {
        return;
      }

      var replacement = fabric.util.createImage(),
          retinaScaling = this.canvas ? this.canvas.getRetinaScaling() : fabric.devicePixelRatio,
          minimumScale = this.minimumScaleTrigger / retinaScaling,
          _this = this, scaleX, scaleY;

      if (filters.length === 0) {
        this._element = imgElement;
        callback && callback(this);
        return imgElement;
      }

      var canvasEl = fabric.util.createCanvasElement();
      canvasEl.width = imgElement.width;
      canvasEl.height = imgElement.height;
      canvasEl.getContext('2d').drawImage(imgElement, 0, 0, imgElement.width, imgElement.height);

      filters.forEach(function(filter) {
        if (!filter) {
          return;
        }
        if (forResizing) {
          scaleX = _this.scaleX < minimumScale ? _this.scaleX : 1;
          scaleY = _this.scaleY < minimumScale ? _this.scaleY : 1;
          if (scaleX * retinaScaling < 1) {
            scaleX *= retinaScaling;
          }
          if (scaleY * retinaScaling < 1) {
            scaleY *= retinaScaling;
          }
        }
        else {
          scaleX = filter.scaleX;
          scaleY = filter.scaleY;
        }
        filter.applyTo(canvasEl, scaleX, scaleY);
        if (!forResizing && filter.type === 'Resize') {
          _this.width *= filter.scaleX;
          _this.height *= filter.scaleY;
        }
      });

      /** @ignore */
      replacement.width = canvasEl.width;
      replacement.height = canvasEl.height;
      if (fabric.isLikelyNode) {
        replacement.src = canvasEl.toBuffer(undefined, fabric.Image.pngCompression);
        // onload doesn't fire in some node versions, so we invoke callback manually
        _this._element = replacement;
        !forResizing && (_this._filteredEl = replacement);
        callback && callback(_this);
      }
      else {
        replacement.onload = function() {
          _this._element = replacement;
          !forResizing && (_this._filteredEl = replacement);
          callback && callback(_this);
          replacement.onload = canvasEl = null;
        };
        replacement.src = canvasEl.toDataURL('image/png');
      }
      return canvasEl;
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Boolean} noTransform
     */
    _render: function(ctx, noTransform) {
      var x, y, imageMargins = this._findMargins(), elementToDraw;

      x = (noTransform ? this.left : -this.width / 2);
      y = (noTransform ? this.top : -this.height / 2);

      if (this.meetOrSlice === 'slice') {
        ctx.beginPath();
        ctx.rect(x, y, this.width, this.height);
        ctx.clip();
      }

      if (this.isMoving === false && this.resizeFilters.length && this._needsResize()) {
        this._lastScaleX = this.scaleX;
        this._lastScaleY = this.scaleY;
        elementToDraw = this.applyFilters(null, this.resizeFilters, this._filteredEl || this._originalElement, true);
      }
      else {
        elementToDraw = this._element;
      }
      elementToDraw && ctx.drawImage(elementToDraw,
                                     x + imageMargins.marginX,
                                     y + imageMargins.marginY,
                                     imageMargins.width,
                                     imageMargins.height
                                    );

      this._stroke(ctx);
      this._renderStroke(ctx);
    },

    /**
     * @private, needed to check if image needs resize
     */
    _needsResize: function() {
      return (this.scaleX !== this._lastScaleX || this.scaleY !== this._lastScaleY);
    },

    /**
     * @private
     */
    _findMargins: function() {
      var width = this.width, height = this.height, scales,
          scale, marginX = 0, marginY = 0;

      if (this.alignX !== 'none' || this.alignY !== 'none') {
        scales = [this.width / this._element.width, this.height / this._element.height];
        scale = this.meetOrSlice === 'meet'
                ? Math.min.apply(null, scales) : Math.max.apply(null, scales);
        width = this._element.width * scale;
        height = this._element.height * scale;
        if (this.alignX === 'Mid') {
          marginX = (this.width - width) / 2;
        }
        if (this.alignX === 'Max') {
          marginX = this.width - width;
        }
        if (this.alignY === 'Mid') {
          marginY = (this.height - height) / 2;
        }
        if (this.alignY === 'Max') {
          marginY = this.height - height;
        }
      }
      return {
        width:  width,
        height: height,
        marginX: marginX,
        marginY: marginY
      };
    },

    /**
     * @private
     */
    _resetWidthHeight: function() {
      var element = this.getElement();

      this.set('width', element.width);
      this.set('height', element.height);
    },

    /**
     * The Image class's initialization method. This method is automatically
     * called by the constructor.
     * @private
     * @param {HTMLImageElement|String} element The element representing the image
     * @param {Object} [options] Options object
     */
    _initElement: function(element, options, callback) {
      this.setElement(fabric.util.getById(element), callback, options);
      fabric.util.addClass(this.getElement(), fabric.Image.CSS_CANVAS);
    },

    /**
     * @private
     * @param {Object} [options] Options object
     */
    _initConfig: function(options) {
      options || (options = { });
      this.setOptions(options);
      this._setWidthHeight(options);
      if (this._element && this.crossOrigin) {
        this._element.crossOrigin = this.crossOrigin;
      }
    },

    /**
     * @private
     * @param {Array} filters to be initialized
     * @param {Function} callback Callback to invoke when all fabric.Image.filters instances are created
     */
    _initFilters: function(filters, callback) {
      if (filters && filters.length) {
        fabric.util.enlivenObjects(filters, function(enlivenedObjects) {
          callback && callback(enlivenedObjects);
        }, 'fabric.Image.filters');
      }
      else {
        callback && callback();
      }
    },

    /**
     * @private
     * @param {Object} [options] Object with width/height properties
     */
    _setWidthHeight: function(options) {
      this.width = 'width' in options
        ? options.width
        : (this.getElement()
            ? this.getElement().width || 0
            : 0);

      this.height = 'height' in options
        ? options.height
        : (this.getElement()
            ? this.getElement().height || 0
            : 0);
    },

    /**
     * Returns complexity of an instance
     * @return {Number} complexity of this instance
     */
    complexity: function() {
      return 1;
    }
  });

  /**
   * Default CSS class name for canvas
   * @static
   * @type String
   * @default
   */
  fabric.Image.CSS_CANVAS = 'canvas-img';

  /**
   * Alias for getSrc
   * @static
   */
  fabric.Image.prototype.getSvgSrc = fabric.Image.prototype.getSrc;

  /**
   * Creates an instance of fabric.Image from its object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @param {Function} callback Callback to invoke when an image instance is created
   */
  fabric.Image.fromObject = function(object, callback) {
    fabric.util.loadImage(object.src, function(img) {
      fabric.Image.prototype._initFilters.call(object, object.filters, function(filters) {
        object.filters = filters || [];
        fabric.Image.prototype._initFilters.call(object, object.resizeFilters, function(resizeFilters) {
          object.resizeFilters = resizeFilters || [];
          return new fabric.Image(img, object, callback);
        });
      });
    }, null, object.crossOrigin);
  };

  /**
   * Creates an instance of fabric.Image from an URL string
   * @static
   * @param {String} url URL to create an image from
   * @param {Function} [callback] Callback to invoke when image is created (newly created image is passed as a first argument)
   * @param {Object} [imgOptions] Options object
   */
  fabric.Image.fromURL = function(url, callback, imgOptions) {
    fabric.util.loadImage(url, function(img) {
      callback && callback(new fabric.Image(img, imgOptions));
    }, null, imgOptions && imgOptions.crossOrigin);
  };

  /* _FROM_SVG_START_ */
  /**
   * List of attribute names to account for when parsing SVG element (used by {@link fabric.Image.fromElement})
   * @static
   * @see {@link http://www.w3.org/TR/SVG/struct.html#ImageElement}
   */
  fabric.Image.ATTRIBUTE_NAMES =
    fabric.SHARED_ATTRIBUTES.concat('x y width height preserveAspectRatio xlink:href'.split(' '));

  /**
   * Returns {@link fabric.Image} instance from an SVG element
   * @static
   * @param {SVGElement} element Element to parse
   * @param {Function} callback Callback to execute when fabric.Image object is created
   * @param {Object} [options] Options object
   * @return {fabric.Image} Instance of fabric.Image
   */
  fabric.Image.fromElement = function(element, callback, options) {
    var parsedAttributes = fabric.parseAttributes(element, fabric.Image.ATTRIBUTE_NAMES),
        preserveAR;

    if (parsedAttributes.preserveAspectRatio) {
      preserveAR = fabric.util.parsePreserveAspectRatioAttribute(parsedAttributes.preserveAspectRatio);
      extend(parsedAttributes, preserveAR);
    }

    fabric.Image.fromURL(parsedAttributes['xlink:href'], callback,
      extend((options ? fabric.util.object.clone(options) : { }), parsedAttributes));
  };
  /* _FROM_SVG_END_ */

  /**
   * Indicates that instances of this type are async
   * @static
   * @type Boolean
   * @default
   */
  fabric.Image.async = true;

  /**
   * Indicates compression level used when generating PNG under Node (in applyFilters). Any of 0-9
   * @static
   * @type Number
   * @default
   */
  fabric.Image.pngCompression = 1;

})(typeof exports !== 'undefined' ? exports : this);


fabric.util.object.extend(fabric.Object.prototype, /** @lends fabric.Object.prototype */ {

  /**
   * @private
   * @return {Number} angle value
   */
  _getAngleValueForStraighten: function() {
    var angle = this.getAngle() % 360;
    if (angle > 0) {
      return Math.round((angle - 1) / 90) * 90;
    }
    return Math.round(angle / 90) * 90;
  },

  /**
   * Straightens an object (rotating it from current angle to one of 0, 90, 180, 270, etc. depending on which is closer)
   * @return {fabric.Object} thisArg
   * @chainable
   */
  straighten: function() {
    this.setAngle(this._getAngleValueForStraighten());
    return this;
  },

  /**
   * Same as {@link fabric.Object.prototype.straighten} but with animation
   * @param {Object} callbacks Object with callback functions
   * @param {Function} [callbacks.onComplete] Invoked on completion
   * @param {Function} [callbacks.onChange] Invoked on every step of animation
   * @return {fabric.Object} thisArg
   * @chainable
   */
  fxStraighten: function(callbacks) {
    callbacks = callbacks || { };

    var empty = function() { },
        onComplete = callbacks.onComplete || empty,
        onChange = callbacks.onChange || empty,
        _this = this;

    fabric.util.animate({
      startValue: this.get('angle'),
      endValue: this._getAngleValueForStraighten(),
      duration: this.FX_DURATION,
      onChange: function(value) {
        _this.setAngle(value);
        onChange();
      },
      onComplete: function() {
        _this.setCoords();
        onComplete();
      },
      onStart: function() {
        _this.set('active', false);
      }
    });

    return this;
  }
});

fabric.util.object.extend(fabric.StaticCanvas.prototype, /** @lends fabric.StaticCanvas.prototype */ {

  /**
   * Straightens object, then rerenders canvas
   * @param {fabric.Object} object Object to straighten
   * @return {fabric.Canvas} thisArg
   * @chainable
   */
  straightenObject: function (object) {
    object.straighten();
    this.renderAll();
    return this;
  },

  /**
   * Same as {@link fabric.Canvas.prototype.straightenObject}, but animated
   * @param {fabric.Object} object Object to straighten
   * @return {fabric.Canvas} thisArg
   * @chainable
   */
  fxStraightenObject: function (object) {
    object.fxStraighten({
      onChange: this.renderAll.bind(this)
    });
    return this;
  }
});


/**
 * @namespace fabric.Image.filters
 * @memberOf fabric.Image
 * @tutorial {@link http://fabricjs.com/fabric-intro-part-2#image_filters}
 * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
 */
fabric.Image.filters = fabric.Image.filters || { };

/**
 * Root filter class from which all filter classes inherit from
 * @class fabric.Image.filters.BaseFilter
 * @memberOf fabric.Image.filters
 */
fabric.Image.filters.BaseFilter = fabric.util.createClass(/** @lends fabric.Image.filters.BaseFilter.prototype */ {

  /**
   * Filter type
   * @param {String} type
   * @default
   */
  type: 'BaseFilter',

  /**
   * Constructor
   * @param {Object} [options] Options object
   */
  initialize: function(options) {
    if (options) {
      this.setOptions(options);
    }
  },

  /**
   * Sets filter's properties from options
   * @param {Object} [options] Options object
   */
  setOptions: function(options) {
    for (var prop in options) {
      this[prop] = options[prop];
    }
  },

  /**
   * Returns object representation of an instance
   * @return {Object} Object representation of an instance
   */
  toObject: function() {
    return { type: this.type };
  },

  /**
   * Returns a JSON representation of an instance
   * @return {Object} JSON
   */
  toJSON: function() {
    // delegate, not alias
    return this.toObject();
  }
});


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Brightness filter class
   * @class fabric.Image.filters.Brightness
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.Brightness#initialize} for constructor definition
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.Brightness({
   *   brightness: 200
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Brightness = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Brightness.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Brightness',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.Brightness.prototype
     * @param {Object} [options] Options object
     * @param {Number} [options.brightness=0] Value to brighten the image up (-255..255)
     */
    initialize: function(options) {
      options = options || { };
      this.brightness = options.brightness || 0;
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          brightness = this.brightness;

      for (var i = 0, len = data.length; i < len; i += 4) {
        data[i] += brightness;
        data[i + 1] += brightness;
        data[i + 2] += brightness;
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        brightness: this.brightness
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.Brightness} Instance of fabric.Image.filters.Brightness
   */
  fabric.Image.filters.Brightness.fromObject = function(object) {
    return new fabric.Image.filters.Brightness(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Adapted from <a href="http://www.html5rocks.com/en/tutorials/canvas/imagefilters/">html5rocks article</a>
   * @class fabric.Image.filters.Convolute
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.Convolute#initialize} for constructor definition
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example <caption>Sharpen filter</caption>
   * var filter = new fabric.Image.filters.Convolute({
   *   matrix: [ 0, -1,  0,
   *            -1,  5, -1,
   *             0, -1,  0 ]
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   * @example <caption>Blur filter</caption>
   * var filter = new fabric.Image.filters.Convolute({
   *   matrix: [ 1/9, 1/9, 1/9,
   *             1/9, 1/9, 1/9,
   *             1/9, 1/9, 1/9 ]
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   * @example <caption>Emboss filter</caption>
   * var filter = new fabric.Image.filters.Convolute({
   *   matrix: [ 1,   1,  1,
   *             1, 0.7, -1,
   *            -1,  -1, -1 ]
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   * @example <caption>Emboss filter with opaqueness</caption>
   * var filter = new fabric.Image.filters.Convolute({
   *   opaque: true,
   *   matrix: [ 1,   1,  1,
   *             1, 0.7, -1,
   *            -1,  -1, -1 ]
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Convolute = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Convolute.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Convolute',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.Convolute.prototype
     * @param {Object} [options] Options object
     * @param {Boolean} [options.opaque=false] Opaque value (true/false)
     * @param {Array} [options.matrix] Filter matrix
     */
    initialize: function(options) {
      options = options || { };

      this.opaque = options.opaque;
      this.matrix = options.matrix || [
        0, 0, 0,
        0, 1, 0,
        0, 0, 0
      ];
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {

      var weights = this.matrix,
          context = canvasEl.getContext('2d'),
          pixels = context.getImageData(0, 0, canvasEl.width, canvasEl.height),

          side = Math.round(Math.sqrt(weights.length)),
          halfSide = Math.floor(side / 2),
          src = pixels.data,
          sw = pixels.width,
          sh = pixels.height,
          output = context.createImageData(sw, sh),
          dst = output.data,
          // go through the destination image pixels
          alphaFac = this.opaque ? 1 : 0,
          r, g, b, a, dstOff,
          scx, scy, srcOff, wt;

      for (var y = 0; y < sh; y++) {
        for (var x = 0; x < sw; x++) {
          dstOff = (y * sw + x) * 4;
          // calculate the weighed sum of the source image pixels that
          // fall under the convolution matrix
          r = 0; g = 0; b = 0; a = 0;

          for (var cy = 0; cy < side; cy++) {
            for (var cx = 0; cx < side; cx++) {
              scy = y + cy - halfSide;
              scx = x + cx - halfSide;

              // eslint-disable-next-line max-depth
              if (scy < 0 || scy > sh || scx < 0 || scx > sw) {
                continue;
              }

              srcOff = (scy * sw + scx) * 4;
              wt = weights[cy * side + cx];

              r += src[srcOff] * wt;
              g += src[srcOff + 1] * wt;
              b += src[srcOff + 2] * wt;
              a += src[srcOff + 3] * wt;
            }
          }
          dst[dstOff] = r;
          dst[dstOff + 1] = g;
          dst[dstOff + 2] = b;
          dst[dstOff + 3] = a + alphaFac * (255 - a);
        }
      }

      context.putImageData(output, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        opaque: this.opaque,
        matrix: this.matrix
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.Convolute} Instance of fabric.Image.filters.Convolute
   */
  fabric.Image.filters.Convolute.fromObject = function(object) {
    return new fabric.Image.filters.Convolute(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * GradientTransparency filter class
   * @class fabric.Image.filters.GradientTransparency
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.GradientTransparency#initialize} for constructor definition
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.GradientTransparency({
   *   threshold: 200
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
   // eslint-disable-next-line max-len
  filters.GradientTransparency = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.GradientTransparency.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'GradientTransparency',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.GradientTransparency.prototype
     * @param {Object} [options] Options object
     * @param {Number} [options.threshold=100] Threshold value
     */
    initialize: function(options) {
      options = options || { };
      this.threshold = options.threshold || 100;
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          threshold = this.threshold,
          total = data.length;

      for (var i = 0, len = data.length; i < len; i += 4) {
        data[i + 3] = threshold + 255 * (total - i) / total;
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        threshold: this.threshold
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.GradientTransparency} Instance of fabric.Image.filters.GradientTransparency
   */
  fabric.Image.filters.GradientTransparency.fromObject = function(object) {
    return new fabric.Image.filters.GradientTransparency(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Grayscale image filter class
   * @class fabric.Image.filters.Grayscale
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.Grayscale();
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Grayscale = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Grayscale.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Grayscale',

    /**
     * Applies filter to canvas element
     * @memberOf fabric.Image.filters.Grayscale.prototype
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          len = imageData.width * imageData.height * 4,
          index = 0,
          average;

      while (index < len) {
        average = (data[index] + data[index + 1] + data[index + 2]) / 3;
        data[index]     = average;
        data[index + 1] = average;
        data[index + 2] = average;
        index += 4;
      }

      context.putImageData(imageData, 0, 0);
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @return {fabric.Image.filters.Grayscale} Instance of fabric.Image.filters.Grayscale
   */
  fabric.Image.filters.Grayscale.fromObject = function() {
    return new fabric.Image.filters.Grayscale();
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Invert filter class
   * @class fabric.Image.filters.Invert
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.Invert();
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Invert = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Invert.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Invert',

    /**
     * Applies filter to canvas element
     * @memberOf fabric.Image.filters.Invert.prototype
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          iLen = data.length, i;

      for (i = 0; i < iLen; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }

      context.putImageData(imageData, 0, 0);
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @return {fabric.Image.filters.Invert} Instance of fabric.Image.filters.Invert
   */
  fabric.Image.filters.Invert.fromObject = function() {
    return new fabric.Image.filters.Invert();
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Mask filter class
   * See http://resources.aleph-1.com/mask/
   * @class fabric.Image.filters.Mask
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.Mask#initialize} for constructor definition
   */
  filters.Mask = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Mask.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Mask',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.Mask.prototype
     * @param {Object} [options] Options object
     * @param {fabric.Image} [options.mask] Mask image object
     * @param {Number} [options.channel=0] Rgb channel (0, 1, 2 or 3)
     */
    initialize: function(options) {
      options = options || { };

      this.mask = options.mask;
      this.channel = [0, 1, 2, 3].indexOf(options.channel) > -1 ? options.channel : 0;
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      if (!this.mask) {
        return;
      }

      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          maskEl = this.mask.getElement(),
          maskCanvasEl = fabric.util.createCanvasElement(),
          channel = this.channel,
          i,
          iLen = imageData.width * imageData.height * 4;

      maskCanvasEl.width = canvasEl.width;
      maskCanvasEl.height = canvasEl.height;

      maskCanvasEl.getContext('2d').drawImage(maskEl, 0, 0, canvasEl.width, canvasEl.height);

      var maskImageData = maskCanvasEl.getContext('2d').getImageData(0, 0, canvasEl.width, canvasEl.height),
          maskData = maskImageData.data;

      for (i = 0; i < iLen; i += 4) {
        data[i + 3] = maskData[i + channel];
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        mask: this.mask.toObject(),
        channel: this.channel
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @param {Function} [callback] Callback to invoke when a mask filter instance is created
   */
  fabric.Image.filters.Mask.fromObject = function(object, callback) {
    fabric.util.loadImage(object.mask.src, function(img) {
      object.mask = new fabric.Image(img, object.mask);
      callback && callback(new fabric.Image.filters.Mask(object));
    });
  };

  /**
   * Indicates that instances of this type are async
   * @static
   * @type Boolean
   * @default
   */
  fabric.Image.filters.Mask.async = true;

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Noise filter class
   * @class fabric.Image.filters.Noise
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.Noise#initialize} for constructor definition
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.Noise({
   *   noise: 700
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Noise = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Noise.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Noise',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.Noise.prototype
     * @param {Object} [options] Options object
     * @param {Number} [options.noise=0] Noise value
     */
    initialize: function(options) {
      options = options || { };
      this.noise = options.noise || 0;
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          noise = this.noise, rand;

      for (var i = 0, len = data.length; i < len; i += 4) {

        rand = (0.5 - Math.random()) * noise;

        data[i] += rand;
        data[i + 1] += rand;
        data[i + 2] += rand;
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        noise: this.noise
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.Noise} Instance of fabric.Image.filters.Noise
   */
  fabric.Image.filters.Noise.fromObject = function(object) {
    return new fabric.Image.filters.Noise(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Pixelate filter class
   * @class fabric.Image.filters.Pixelate
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.Pixelate#initialize} for constructor definition
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.Pixelate({
   *   blocksize: 8
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Pixelate = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Pixelate.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Pixelate',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.Pixelate.prototype
     * @param {Object} [options] Options object
     * @param {Number} [options.blocksize=4] Blocksize for pixelate
     */
    initialize: function(options) {
      options = options || { };
      this.blocksize = options.blocksize || 4;
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          iLen = imageData.height,
          jLen = imageData.width,
          index, i, j, r, g, b, a;

      for (i = 0; i < iLen; i += this.blocksize) {
        for (j = 0; j < jLen; j += this.blocksize) {

          index = (i * 4) * jLen + (j * 4);

          r = data[index];
          g = data[index + 1];
          b = data[index + 2];
          a = data[index + 3];

          /*
           blocksize: 4

           [1,x,x,x,1]
           [x,x,x,x,1]
           [x,x,x,x,1]
           [x,x,x,x,1]
           [1,1,1,1,1]
           */

          for (var _i = i, _ilen = i + this.blocksize; _i < _ilen; _i++) {
            for (var _j = j, _jlen = j + this.blocksize; _j < _jlen; _j++) {
              index = (_i * 4) * jLen + (_j * 4);
              data[index] = r;
              data[index + 1] = g;
              data[index + 2] = b;
              data[index + 3] = a;
            }
          }
        }
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        blocksize: this.blocksize
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.Pixelate} Instance of fabric.Image.filters.Pixelate
   */
  fabric.Image.filters.Pixelate.fromObject = function(object) {
    return new fabric.Image.filters.Pixelate(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Remove white filter class
   * @class fabric.Image.filters.RemoveWhite
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.RemoveWhite#initialize} for constructor definition
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.RemoveWhite({
   *   threshold: 40,
   *   distance: 140
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.RemoveWhite = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.RemoveWhite.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'RemoveWhite',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.RemoveWhite.prototype
     * @param {Object} [options] Options object
     * @param {Number} [options.threshold=30] Threshold value
     * @param {Number} [options.distance=20] Distance value
     */
    initialize: function(options) {
      options = options || { };
      this.threshold = options.threshold || 30;
      this.distance = options.distance || 20;
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          threshold = this.threshold,
          distance = this.distance,
          limit = 255 - threshold,
          abs = Math.abs,
          r, g, b;

      for (var i = 0, len = data.length; i < len; i += 4) {
        r = data[i];
        g = data[i + 1];
        b = data[i + 2];

        if (r > limit &&
            g > limit &&
            b > limit &&
            abs(r - g) < distance &&
            abs(r - b) < distance &&
            abs(g - b) < distance
        ) {
          data[i + 3] = 0;
        }
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        threshold: this.threshold,
        distance: this.distance
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.RemoveWhite} Instance of fabric.Image.filters.RemoveWhite
   */
  fabric.Image.filters.RemoveWhite.fromObject = function(object) {
    return new fabric.Image.filters.RemoveWhite(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Sepia filter class
   * @class fabric.Image.filters.Sepia
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.Sepia();
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Sepia = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Sepia.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Sepia',

    /**
     * Applies filter to canvas element
     * @memberOf fabric.Image.filters.Sepia.prototype
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          iLen = data.length, i, avg;

      for (i = 0; i < iLen; i += 4) {
        avg = 0.3  * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        data[i] = avg + 100;
        data[i + 1] = avg + 50;
        data[i + 2] = avg + 255;
      }

      context.putImageData(imageData, 0, 0);
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @return {fabric.Image.filters.Sepia} Instance of fabric.Image.filters.Sepia
   */
  fabric.Image.filters.Sepia.fromObject = function() {
    return new fabric.Image.filters.Sepia();
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Sepia2 filter class
   * @class fabric.Image.filters.Sepia2
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.Sepia2();
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Sepia2 = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Sepia2.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Sepia2',

    /**
     * Applies filter to canvas element
     * @memberOf fabric.Image.filters.Sepia.prototype
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          iLen = data.length, i, r, g, b;

      for (i = 0; i < iLen; i += 4) {
        r = data[i];
        g = data[i + 1];
        b = data[i + 2];

        data[i] = (r * 0.393 + g * 0.769 + b * 0.189 ) / 1.351;
        data[i + 1] = (r * 0.349 + g * 0.686 + b * 0.168 ) / 1.203;
        data[i + 2] = (r * 0.272 + g * 0.534 + b * 0.131 ) / 2.140;
      }

      context.putImageData(imageData, 0, 0);
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @return {fabric.Image.filters.Sepia2} Instance of fabric.Image.filters.Sepia2
   */
  fabric.Image.filters.Sepia2.fromObject = function() {
    return new fabric.Image.filters.Sepia2();
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Tint filter class
   * Adapted from <a href="https://github.com/mezzoblue/PaintbrushJS">https://github.com/mezzoblue/PaintbrushJS</a>
   * @class fabric.Image.filters.Tint
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.Tint#initialize} for constructor definition
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example <caption>Tint filter with hex color and opacity</caption>
   * var filter = new fabric.Image.filters.Tint({
   *   color: '#3513B0',
   *   opacity: 0.5
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   * @example <caption>Tint filter with rgba color</caption>
   * var filter = new fabric.Image.filters.Tint({
   *   color: 'rgba(53, 21, 176, 0.5)'
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Tint = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Tint.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Tint',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.Tint.prototype
     * @param {Object} [options] Options object
     * @param {String} [options.color=#000000] Color to tint the image with
     * @param {Number} [options.opacity] Opacity value that controls the tint effect's transparency (0..1)
     */
    initialize: function(options) {
      options = options || { };

      this.color = options.color || '#000000';
      this.opacity = typeof options.opacity !== 'undefined'
                      ? options.opacity
                      : new fabric.Color(this.color).getAlpha();
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          iLen = data.length, i,
          tintR, tintG, tintB,
          r, g, b, alpha1,
          source;

      source = new fabric.Color(this.color).getSource();

      tintR = source[0] * this.opacity;
      tintG = source[1] * this.opacity;
      tintB = source[2] * this.opacity;

      alpha1 = 1 - this.opacity;

      for (i = 0; i < iLen; i += 4) {
        r = data[i];
        g = data[i + 1];
        b = data[i + 2];

        // alpha compositing
        data[i] = tintR + r * alpha1;
        data[i + 1] = tintG + g * alpha1;
        data[i + 2] = tintB + b * alpha1;
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        color: this.color,
        opacity: this.opacity
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.Tint} Instance of fabric.Image.filters.Tint
   */
  fabric.Image.filters.Tint.fromObject = function(object) {
    return new fabric.Image.filters.Tint(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Multiply filter class
   * Adapted from <a href="http://www.laurenscorijn.com/articles/colormath-basics">http://www.laurenscorijn.com/articles/colormath-basics</a>
   * @class fabric.Image.filters.Multiply
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @example <caption>Multiply filter with hex color</caption>
   * var filter = new fabric.Image.filters.Multiply({
   *   color: '#F0F'
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   * @example <caption>Multiply filter with rgb color</caption>
   * var filter = new fabric.Image.filters.Multiply({
   *   color: 'rgb(53, 21, 176)'
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Multiply = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Multiply.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Multiply',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.Multiply.prototype
     * @param {Object} [options] Options object
     * @param {String} [options.color=#000000] Color to multiply the image pixels with
     */
    initialize: function(options) {
      options = options || { };

      this.color = options.color || '#000000';
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          iLen = data.length, i,
          source;

      source = new fabric.Color(this.color).getSource();

      for (i = 0; i < iLen; i += 4) {
        data[i] *= source[0] / 255;
        data[i + 1] *= source[1] / 255;
        data[i + 2] *= source[2] / 255;
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        color: this.color
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.Multiply} Instance of fabric.Image.filters.Multiply
   */
  fabric.Image.filters.Multiply.fromObject = function(object) {
    return new fabric.Image.filters.Multiply(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {
  'use strict';

  var fabric = global.fabric,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Color Blend filter class
   * @class fabric.Image.filter.Blend
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @example
   * var filter = new fabric.Image.filters.Blend({
   *  color: '#000',
   *  mode: 'multiply'
   * });
   *
   * var filter = new fabric.Image.filters.Blend({
   *  image: fabricImageObject,
   *  mode: 'multiply',
   *  alpha: 0.5
   * });

   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */

  filters.Blend = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Blend.prototype */ {
    type: 'Blend',

    initialize: function(options) {
      options = options || {};
      this.color = options.color || '#000';
      this.image = options.image || false;
      this.mode = options.mode || 'multiply';
      this.alpha = options.alpha || 1;
    },

    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          tr, tg, tb,
          r, g, b,
          _r, _g, _b,
          source,
          isImage = false;

      if (this.image) {
        // Blend images
        isImage = true;

        var _el = fabric.util.createCanvasElement();
        _el.width = this.image.width;
        _el.height = this.image.height;

        var tmpCanvas = new fabric.StaticCanvas(_el);
        tmpCanvas.add(this.image);
        var context2 =  tmpCanvas.getContext('2d');
        source = context2.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height).data;
      }
      else {
        // Blend color
        source = new fabric.Color(this.color).getSource();

        tr = source[0] * this.alpha;
        tg = source[1] * this.alpha;
        tb = source[2] * this.alpha;
      }

      for (var i = 0, len = data.length; i < len; i += 4) {

        r = data[i];
        g = data[i + 1];
        b = data[i + 2];

        if (isImage) {
          tr = source[i] * this.alpha;
          tg = source[i + 1] * this.alpha;
          tb = source[i + 2] * this.alpha;
        }

        switch (this.mode) {
          case 'multiply':
            data[i] = r * tr / 255;
            data[i + 1] = g * tg / 255;
            data[i + 2] = b * tb / 255;
            break;
          case 'screen':
            data[i] = 1 - (1 - r) * (1 - tr);
            data[i + 1] = 1 - (1 - g) * (1 - tg);
            data[i + 2] = 1 - (1 - b) * (1 - tb);
            break;
          case 'add':
            data[i] = Math.min(255, r + tr);
            data[i + 1] = Math.min(255, g + tg);
            data[i + 2] = Math.min(255, b + tb);
            break;
          case 'diff':
          case 'difference':
            data[i] = Math.abs(r - tr);
            data[i + 1] = Math.abs(g - tg);
            data[i + 2] = Math.abs(b - tb);
            break;
          case 'subtract':
            _r = r - tr;
            _g = g - tg;
            _b = b - tb;

            data[i] = (_r < 0) ? 0 : _r;
            data[i + 1] = (_g < 0) ? 0 : _g;
            data[i + 2] = (_b < 0) ? 0 : _b;
            break;
          case 'darken':
            data[i] = Math.min(r, tr);
            data[i + 1] = Math.min(g, tg);
            data[i + 2] = Math.min(b, tb);
            break;
          case 'lighten':
            data[i] = Math.max(r, tr);
            data[i + 1] = Math.max(g, tg);
            data[i + 2] = Math.max(b, tb);
            break;
        }
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return {
        color: this.color,
        image: this.image,
        mode: this.mode,
        alpha: this.alpha
      };
    }
  });

  fabric.Image.filters.Blend.fromObject = function(object) {
    return new fabric.Image.filters.Blend(object);
  };
})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }), pow = Math.pow, floor = Math.floor,
      sqrt = Math.sqrt, abs = Math.abs, max = Math.max, round = Math.round, sin = Math.sin,
      ceil = Math.ceil,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Resize image filter class
   * @class fabric.Image.filters.Resize
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.Resize();
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Resize = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Resize.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Resize',

    /**
     * Resize type
     * @param {String} resizeType
     * @default
     */
    resizeType: 'hermite',

    /**
     * Scale factor for resizing, x axis
     * @param {Number} scaleX
     * @default
     */
    scaleX: 0,

    /**
     * Scale factor for resizing, y axis
     * @param {Number} scaleY
     * @default
     */
    scaleY: 0,

    /**
     * LanczosLobes parameter for lanczos filter
     * @param {Number} lanczosLobes
     * @default
     */
    lanczosLobes: 3,

    /**
     * Applies filter to canvas element
     * @memberOf fabric.Image.filters.Resize.prototype
     * @param {Object} canvasEl Canvas element to apply filter to
     * @param {Number} scaleX
     * @param {Number} scaleY
     */
    applyTo: function(canvasEl, scaleX, scaleY) {
      if (scaleX === 1 && scaleY === 1) {
        return;
      }

      this.rcpScaleX = 1 / scaleX;
      this.rcpScaleY = 1 / scaleY;

      var oW = canvasEl.width, oH = canvasEl.height,
          dW = round(oW * scaleX), dH = round(oH * scaleY),
          imageData;

      if (this.resizeType === 'sliceHack') {
        imageData = this.sliceByTwo(canvasEl, oW, oH, dW, dH);
      }
      if (this.resizeType === 'hermite') {
        imageData = this.hermiteFastResize(canvasEl, oW, oH, dW, dH);
      }
      if (this.resizeType === 'bilinear') {
        imageData = this.bilinearFiltering(canvasEl, oW, oH, dW, dH);
      }
      if (this.resizeType === 'lanczos') {
        imageData = this.lanczosResize(canvasEl, oW, oH, dW, dH);
      }
      canvasEl.width = dW;
      canvasEl.height = dH;
      canvasEl.getContext('2d').putImageData(imageData, 0, 0);
    },

    /**
     * Filter sliceByTwo
     * @param {Object} canvasEl Canvas element to apply filter to
     * @param {Number} oW Original Width
     * @param {Number} oH Original Height
     * @param {Number} dW Destination Width
     * @param {Number} dH Destination Height
     * @returns {ImageData}
     */
    sliceByTwo: function(canvasEl, oW, oH, dW, dH) {
      var context = canvasEl.getContext('2d'), imageData,
          multW = 0.5, multH = 0.5, signW = 1, signH = 1,
          doneW = false, doneH = false, stepW = oW, stepH = oH,
          tmpCanvas = fabric.util.createCanvasElement(),
          tmpCtx = tmpCanvas.getContext('2d');
      dW = floor(dW);
      dH = floor(dH);
      tmpCanvas.width = max(dW, oW);
      tmpCanvas.height = max(dH, oH);

      if (dW > oW) {
        multW = 2;
        signW = -1;
      }
      if (dH > oH) {
        multH = 2;
        signH = -1;
      }
      imageData = context.getImageData(0, 0, oW, oH);
      canvasEl.width = max(dW, oW);
      canvasEl.height = max(dH, oH);
      context.putImageData(imageData, 0, 0);

      while (!doneW || !doneH) {
        oW = stepW;
        oH = stepH;
        if (dW * signW < floor(stepW * multW * signW)) {
          stepW = floor(stepW * multW);
        }
        else {
          stepW = dW;
          doneW = true;
        }
        if (dH * signH < floor(stepH * multH * signH)) {
          stepH = floor(stepH * multH);
        }
        else {
          stepH = dH;
          doneH = true;
        }
        imageData = context.getImageData(0, 0, oW, oH);
        tmpCtx.putImageData(imageData, 0, 0);
        context.clearRect(0, 0, stepW, stepH);
        context.drawImage(tmpCanvas, 0, 0, oW, oH, 0, 0, stepW, stepH);
      }
      return context.getImageData(0, 0, dW, dH);
    },

    /**
     * Filter lanczosResize
     * @param {Object} canvasEl Canvas element to apply filter to
     * @param {Number} oW Original Width
     * @param {Number} oH Original Height
     * @param {Number} dW Destination Width
     * @param {Number} dH Destination Height
     * @returns {ImageData}
     */
    lanczosResize: function(canvasEl, oW, oH, dW, dH) {

      function lanczosCreate(lobes) {
        return function(x) {
          if (x > lobes) {
            return 0;
          }
          x *= Math.PI;
          if (abs(x) < 1e-16) {
            return 1;
          }
          var xx = x / lobes;
          return sin(x) * sin(xx) / x / xx;
        };
      }

      function process(u) {
        var v, i, weight, idx, a, red, green,
            blue, alpha, fX, fY;
        center.x = (u + 0.5) * ratioX;
        icenter.x = floor(center.x);
        for (v = 0; v < dH; v++) {
          center.y = (v + 0.5) * ratioY;
          icenter.y = floor(center.y);
          a = 0; red = 0; green = 0; blue = 0; alpha = 0;
          for (i = icenter.x - range2X; i <= icenter.x + range2X; i++) {
            if (i < 0 || i >= oW) {
              continue;
            }
            fX = floor(1000 * abs(i - center.x));
            if (!cacheLanc[fX]) {
              cacheLanc[fX] = { };
            }
            for (var j = icenter.y - range2Y; j <= icenter.y + range2Y; j++) {
              if (j < 0 || j >= oH) {
                continue;
              }
              fY = floor(1000 * abs(j - center.y));
              if (!cacheLanc[fX][fY]) {
                cacheLanc[fX][fY] = lanczos(sqrt(pow(fX * rcpRatioX, 2) + pow(fY * rcpRatioY, 2)) / 1000);
              }
              weight = cacheLanc[fX][fY];
              if (weight > 0) {
                idx = (j * oW + i) * 4;
                a += weight;
                red += weight * srcData[idx];
                green += weight * srcData[idx + 1];
                blue += weight * srcData[idx + 2];
                alpha += weight * srcData[idx + 3];
              }
            }
          }
          idx = (v * dW + u) * 4;
          destData[idx] = red / a;
          destData[idx + 1] = green / a;
          destData[idx + 2] = blue / a;
          destData[idx + 3] = alpha / a;
        }

        if (++u < dW) {
          return process(u);
        }
        else {
          return destImg;
        }
      }

      var context = canvasEl.getContext('2d'),
          srcImg = context.getImageData(0, 0, oW, oH),
          destImg = context.getImageData(0, 0, dW, dH),
          srcData = srcImg.data, destData = destImg.data,
          lanczos = lanczosCreate(this.lanczosLobes),
          ratioX = this.rcpScaleX, ratioY = this.rcpScaleY,
          rcpRatioX = 2 / this.rcpScaleX, rcpRatioY = 2 / this.rcpScaleY,
          range2X = ceil(ratioX * this.lanczosLobes / 2),
          range2Y = ceil(ratioY * this.lanczosLobes / 2),
          cacheLanc = { }, center = { }, icenter = { };

      return process(0);
    },

    /**
     * bilinearFiltering
     * @param {Object} canvasEl Canvas element to apply filter to
     * @param {Number} oW Original Width
     * @param {Number} oH Original Height
     * @param {Number} dW Destination Width
     * @param {Number} dH Destination Height
     * @returns {ImageData}
     */
    bilinearFiltering: function(canvasEl, oW, oH, dW, dH) {
      var a, b, c, d, x, y, i, j, xDiff, yDiff, chnl,
          color, offset = 0, origPix, ratioX = this.rcpScaleX,
          ratioY = this.rcpScaleY, context = canvasEl.getContext('2d'),
          w4 = 4 * (oW - 1), img = context.getImageData(0, 0, oW, oH),
          pixels = img.data, destImage = context.getImageData(0, 0, dW, dH),
          destPixels = destImage.data;
      for (i = 0; i < dH; i++) {
        for (j = 0; j < dW; j++) {
          x = floor(ratioX * j);
          y = floor(ratioY * i);
          xDiff = ratioX * j - x;
          yDiff = ratioY * i - y;
          origPix = 4 * (y * oW + x);

          for (chnl = 0; chnl < 4; chnl++) {
            a = pixels[origPix + chnl];
            b = pixels[origPix + 4 + chnl];
            c = pixels[origPix + w4 + chnl];
            d = pixels[origPix + w4 + 4 + chnl];
            color = a * (1 - xDiff) * (1 - yDiff) + b * xDiff * (1 - yDiff) +
                    c * yDiff * (1 - xDiff) + d * xDiff * yDiff;
            destPixels[offset++] = color;
          }
        }
      }
      return destImage;
    },

    /**
     * hermiteFastResize
     * @param {Object} canvasEl Canvas element to apply filter to
     * @param {Number} oW Original Width
     * @param {Number} oH Original Height
     * @param {Number} dW Destination Width
     * @param {Number} dH Destination Height
     * @returns {ImageData}
     */
    hermiteFastResize: function(canvasEl, oW, oH, dW, dH) {
      var ratioW = this.rcpScaleX, ratioH = this.rcpScaleY,
          ratioWHalf = ceil(ratioW / 2),
          ratioHHalf = ceil(ratioH / 2),
          context = canvasEl.getContext('2d'),
          img = context.getImageData(0, 0, oW, oH), data = img.data,
          img2 = context.getImageData(0, 0, dW, dH), data2 = img2.data;
      for (var j = 0; j < dH; j++) {
        for (var i = 0; i < dW; i++) {
          var x2 = (i + j * dW) * 4, weight = 0, weights = 0, weightsAlpha = 0,
              gxR = 0, gxG = 0, gxB = 0, gxA = 0, centerY = (j + 0.5) * ratioH;
          for (var yy = floor(j * ratioH); yy < (j + 1) * ratioH; yy++) {
            var dy = abs(centerY - (yy + 0.5)) / ratioHHalf,
                centerX = (i + 0.5) * ratioW, w0 = dy * dy;
            for (var xx = floor(i * ratioW); xx < (i + 1) * ratioW; xx++) {
              var dx = abs(centerX - (xx + 0.5)) / ratioWHalf,
                  w = sqrt(w0 + dx * dx);
              /* eslint-disable max-depth */
              if (w > 1 && w < -1) {
                continue;
              }
              //hermite filter
              weight = 2 * w * w * w - 3 * w * w + 1;
              if (weight > 0) {
                dx = 4 * (xx + yy * oW);
                //alpha
                gxA += weight * data[dx + 3];
                weightsAlpha += weight;
                //colors
                if (data[dx + 3] < 255) {
                  weight = weight * data[dx + 3] / 250;
                }
                gxR += weight * data[dx];
                gxG += weight * data[dx + 1];
                gxB += weight * data[dx + 2];
                weights += weight;
              }
              /* eslint-enable max-depth */
            }
          }
          data2[x2] = gxR / weights;
          data2[x2 + 1] = gxG / weights;
          data2[x2 + 2] = gxB / weights;
          data2[x2 + 3] = gxA / weightsAlpha;
        }
      }
      return img2;
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return {
        type: this.type,
        scaleX: this.scaleX,
        scaleY: this.scaleY,
        resizeType: this.resizeType,
        lanczosLobes: this.lanczosLobes
      };
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @return {fabric.Image.filters.Resize} Instance of fabric.Image.filters.Resize
   */
  fabric.Image.filters.Resize.fromObject = function(object) {
    return new fabric.Image.filters.Resize(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Color Matrix filter class
   * @class fabric.Image.filters.ColorMatrix
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.ColorMatrix#initialize} for constructor definition
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @see {@Link http://www.webwasp.co.uk/tutorials/219/Color_Matrix_Filter.php}
   * @see {@Link http://phoboslab.org/log/2013/11/fast-image-filters-with-webgl}
   * @example <caption>Kodachrome filter</caption>
   * var filter = new fabric.Image.filters.ColorMatrix({
   *  matrix: [
       1.1285582396593525, -0.3967382283601348, -0.03992559172921793, 0, 63.72958762196502,
       -0.16404339962244616, 1.0835251566291304, -0.05498805115633132, 0, 24.732407896706203,
       -0.16786010706155763, -0.5603416277695248, 1.6014850761964943, 0, 35.62982807460946,
       0, 0, 0, 1, 0
      ]
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.ColorMatrix = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.ColorMatrix.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'ColorMatrix',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.ColorMatrix.prototype
     * @param {Object} [options] Options object
     * @param {Array} [options.matrix] Color Matrix to modify the image data with
     */
    initialize: function( options ) {
      options || ( options = {} );
      this.matrix = options.matrix || [
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0
      ];
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function( canvasEl ) {
      var context = canvasEl.getContext( '2d' ),
          imageData = context.getImageData( 0, 0, canvasEl.width, canvasEl.height ),
          data = imageData.data,
          iLen = data.length,
          i,
          r,
          g,
          b,
          a,
          m = this.matrix;

      for ( i = 0; i < iLen; i += 4 ) {
        r = data[ i ];
        g = data[ i + 1 ];
        b = data[ i + 2 ];
        a = data[ i + 3 ];

        data[ i ] = r * m[ 0 ] + g * m[ 1 ] + b * m[ 2 ] + a * m[ 3 ] + m[ 4 ];
        data[ i + 1 ] = r * m[ 5 ] + g * m[ 6 ] + b * m[ 7 ] + a * m[ 8 ] + m[ 9 ];
        data[ i + 2 ] = r * m[ 10 ] + g * m[ 11 ] + b * m[ 12 ] + a * m[ 13 ] + m[ 14 ];
        data[ i + 3 ] = r * m[ 15 ] + g * m[ 16 ] + b * m[ 17 ] + a * m[ 18 ] + m[ 19 ];
      }

      context.putImageData( imageData, 0, 0 );
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        type: this.type,
        matrix: this.matrix
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.ColorMatrix} Instance of fabric.Image.filters.ColorMatrix
   */
  fabric.Image.filters.ColorMatrix.fromObject = function( object ) {
    return new fabric.Image.filters.ColorMatrix( object );
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Contrast filter class
   * @class fabric.Image.filters.Contrast
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.Contrast#initialize} for constructor definition
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.Contrast({
   *   contrast: 40
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Contrast = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Contrast.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Contrast',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.Contrast.prototype
     * @param {Object} [options] Options object
     * @param {Number} [options.contrast=0] Value to contrast the image up (-255...255)
     */
    initialize: function(options) {
      options = options || { };
      this.contrast = options.contrast || 0;
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          contrastF = 259 * (this.contrast + 255) / (255 * (259 - this.contrast));

      for (var i = 0, len = data.length; i < len; i += 4) {
        data[i] = contrastF * (data[i] - 128) + 128;
        data[i + 1] = contrastF * (data[i + 1] - 128) + 128;
        data[i + 2] = contrastF * (data[i + 2] - 128) + 128;
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        contrast: this.contrast
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.Contrast} Instance of fabric.Image.filters.Contrast
   */
  fabric.Image.filters.Contrast.fromObject = function(object) {
    return new fabric.Image.filters.Contrast(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric  = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      filters = fabric.Image.filters,
      createClass = fabric.util.createClass;

  /**
   * Saturate filter class
   * @class fabric.Image.filters.Saturate
   * @memberOf fabric.Image.filters
   * @extends fabric.Image.filters.BaseFilter
   * @see {@link fabric.Image.filters.Saturate#initialize} for constructor definition
   * @see {@link http://fabricjs.com/image-filters|ImageFilters demo}
   * @example
   * var filter = new fabric.Image.filters.Saturate({
   *   saturate: 100
   * });
   * object.filters.push(filter);
   * object.applyFilters(canvas.renderAll.bind(canvas));
   */
  filters.Saturate = createClass(filters.BaseFilter, /** @lends fabric.Image.filters.Saturate.prototype */ {

    /**
     * Filter type
     * @param {String} type
     * @default
     */
    type: 'Saturate',

    /**
     * Constructor
     * @memberOf fabric.Image.filters.Saturate.prototype
     * @param {Object} [options] Options object
     * @param {Number} [options.saturate=0] Value to saturate the image (-100...100)
     */
    initialize: function(options) {
      options = options || { };
      this.saturate = options.saturate || 0;
    },

    /**
     * Applies filter to canvas element
     * @param {Object} canvasEl Canvas element to apply filter to
     */
    applyTo: function(canvasEl) {
      var context = canvasEl.getContext('2d'),
          imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
          data = imageData.data,
          max, adjust = -this.saturate * 0.01;

      for (var i = 0, len = data.length; i < len; i += 4) {
        max = Math.max(data[i], data[i + 1], data[i + 2]);
        data[i] += max !== data[i] ? (max - data[i]) * adjust : 0;
        data[i + 1] += max !== data[i + 1] ? (max - data[i + 1]) * adjust : 0;
        data[i + 2] += max !== data[i + 2] ? (max - data[i + 2]) * adjust : 0;
      }

      context.putImageData(imageData, 0, 0);
    },

    /**
     * Returns object representation of an instance
     * @return {Object} Object representation of an instance
     */
    toObject: function() {
      return extend(this.callSuper('toObject'), {
        saturate: this.saturate
      });
    }
  });

  /**
   * Returns filter instance from an object representation
   * @static
   * @param {Object} object Object to create an instance from
   * @return {fabric.Image.filters.Saturate} Instance of fabric.Image.filters.Saturate
   */
  fabric.Image.filters.Saturate.fromObject = function(object) {
    return new fabric.Image.filters.Saturate(object);
  };

})(typeof exports !== 'undefined' ? exports : this);


(function(global) {

  'use strict';

  var fabric = global.fabric || (global.fabric = { }),
      clone = fabric.util.object.clone,
      toFixed = fabric.util.toFixed,
      NUM_FRACTION_DIGITS = fabric.Object.NUM_FRACTION_DIGITS,
      MIN_TEXT_WIDTH = 2;

  if (fabric.Text) {
    fabric.warn('fabric.Text is already defined');
    return;
  }

  var stateProperties = fabric.Object.prototype.stateProperties.concat();
  stateProperties.push(
    'fontFamily',
    'fontWeight',
    'fontSize',
    'text',
    'textDecoration',
    'textAlign',
    'fontStyle',
    'lineHeight',
    'textBackgroundColor'
  );

  /**
   * Text class
   * @class fabric.Text
   * @extends fabric.Object
   * @return {fabric.Text} thisArg
   * @tutorial {@link http://fabricjs.com/fabric-intro-part-2#text}
   * @see {@link fabric.Text#initialize} for constructor definition
   */
  fabric.Text = fabric.util.createClass(fabric.Object, /** @lends fabric.Text.prototype */ {

    /**
     * Properties which when set cause object to change dimensions
     * @type Object
     * @private
     */
    _dimensionAffectingProps: {
      fontSize: true,
      fontWeight: true,
      fontFamily: true,
      fontStyle: true,
      lineHeight: true,
      text: true,
      charSpacing: true,
      textAlign: true,
      strokeWidth: false,
    },

    /**
     * @private
     */
    _reNewline: /\r?\n/,

    /**
     * Use this regular expression to filter for whitespace that is not a new line.
     * Mostly used when text is 'justify' aligned.
     * @private
     */
    _reSpacesAndTabs: /[ \t\r]+/g,

    /**
     * Retrieves object's fontSize
     * @method getFontSize
     * @memberOf fabric.Text.prototype
     * @return {String} Font size (in pixels)
     */

    /**
     * Sets object's fontSize
     * Does not update the object .width and .height,
     * call ._initDimensions() to update the values.
     * @method setFontSize
     * @memberOf fabric.Text.prototype
     * @param {Number} fontSize Font size (in pixels)
     * @return {fabric.Text}
     * @chainable
     */

    /**
     * Retrieves object's fontWeight
     * @method getFontWeight
     * @memberOf fabric.Text.prototype
     * @return {(String|Number)} Font weight
     */

    /**
     * Sets object's fontWeight
     * Does not update the object .width and .height,
     * call ._initDimensions() to update the values.
     * @method setFontWeight
     * @memberOf fabric.Text.prototype
     * @param {(Number|String)} fontWeight Font weight
     * @return {fabric.Text}
     * @chainable
     */

    /**
     * Retrieves object's fontFamily
     * @method getFontFamily
     * @memberOf fabric.Text.prototype
     * @return {String} Font family
     */

    /**
     * Sets object's fontFamily
     * Does not update the object .width and .height,
     * call ._initDimensions() to update the values.
     * @method setFontFamily
     * @memberOf fabric.Text.prototype
     * @param {String} fontFamily Font family
     * @return {fabric.Text}
     * @chainable
     */

    /**
     * Retrieves object's text
     * @method getText
     * @memberOf fabric.Text.prototype
     * @return {String} text
     */

    /**
     * Sets object's text
     * Does not update the object .width and .height,
     * call ._initDimensions() to update the values.
     * @method setText
     * @memberOf fabric.Text.prototype
     * @param {String} text Text
     * @return {fabric.Text}
     * @chainable
     */

    /**
     * Retrieves object's textDecoration
     * @method getTextDecoration
     * @memberOf fabric.Text.prototype
     * @return {String} Text decoration
     */

    /**
     * Sets object's textDecoration
     * @method setTextDecoration
     * @memberOf fabric.Text.prototype
     * @param {String} textDecoration Text decoration
     * @return {fabric.Text}
     * @chainable
     */

    /**
     * Retrieves object's fontStyle
     * @method getFontStyle
     * @memberOf fabric.Text.prototype
     * @return {String} Font style
     */

    /**
     * Sets object's fontStyle
     * Does not update the object .width and .height,
     * call ._initDimensions() to update the values.
     * @method setFontStyle
     * @memberOf fabric.Text.prototype
     * @param {String} fontStyle Font style
     * @return {fabric.Text}
     * @chainable
     */

    /**
     * Retrieves object's lineHeight
     * @method getLineHeight
     * @memberOf fabric.Text.prototype
     * @return {Number} Line height
     */

    /**
     * Sets object's lineHeight
     * @method setLineHeight
     * @memberOf fabric.Text.prototype
     * @param {Number} lineHeight Line height
     * @return {fabric.Text}
     * @chainable
     */

    /**
     * Retrieves object's textAlign
     * @method getTextAlign
     * @memberOf fabric.Text.prototype
     * @return {String} Text alignment
     */

    /**
     * Sets object's textAlign
     * @method setTextAlign
     * @memberOf fabric.Text.prototype
     * @param {String} textAlign Text alignment
     * @return {fabric.Text}
     * @chainable
     */

    /**
     * Retrieves object's textBackgroundColor
     * @method getTextBackgroundColor
     * @memberOf fabric.Text.prototype
     * @return {String} Text background color
     */

    /**
     * Sets object's textBackgroundColor
     * @method setTextBackgroundColor
     * @memberOf fabric.Text.prototype
     * @param {String} textBackgroundColor Text background color
     * @return {fabric.Text}
     * @chainable
     */

    /**
     * Type of an object
     * @type String
     * @default
     */
    type:                 'text',

    /**
     * Font size (in pixels)
     * @type Number
     * @default
     */
    fontSize:             40,

    /**
     * Font weight (e.g. bold, normal, 400, 600, 800)
     * @type {(Number|String)}
     * @default
     */
    fontWeight:           'normal',

    /**
     * Font family
     * @type String
     * @default
     */
    fontFamily:           'Times New Roman',

    /**
     * Text decoration Possible values: "", "underline", "overline" or "line-through".
     * @type String
     * @default
     */
    textDecoration:       '',

    /**
     * Text alignment. Possible values: "left", "center", "right" or "justify".
     * @type String
     * @default
     */
    textAlign:            'left',

    /**
     * Font style . Possible values: "", "normal", "italic" or "oblique".
     * @type String
     * @default
     */
    fontStyle:            '',

    /**
     * Line height
     * @type Number
     * @default
     */
    lineHeight:           1.16,

    /**
     * Background color of text lines
     * @type String
     * @default
     */
    textBackgroundColor:  '',

    /**
     * List of properties to consider when checking if
     * state of an object is changed ({@link fabric.Object#hasStateChanged})
     * as well as for history (undo/redo) purposes
     * @type Array
     */
    stateProperties:      stateProperties,

    /**
     * When defined, an object is rendered via stroke and this property specifies its color.
     * <b>Backwards incompatibility note:</b> This property was named "strokeStyle" until v1.1.6
     * @type String
     * @default
     */
    stroke:               null,

    /**
     * Shadow object representing shadow of this shape.
     * <b>Backwards incompatibility note:</b> This property was named "textShadow" (String) until v1.2.11
     * @type fabric.Shadow
     * @default
     */
    shadow:               null,

    /**
     * @private
     */
    _fontSizeFraction: 0.25,

    /**
     * Text Line proportion to font Size (in pixels)
     * @type Number
     * @default
     */
    _fontSizeMult:             1.13,

    /**
     * additional space between characters
     * expressed in thousands of em unit
     * @type Number
     * @default
     */
    charSpacing:             0,

    /**
     * Constructor
     * @param {String} text Text string
     * @param {Object} [options] Options object
     * @return {fabric.Text} thisArg
     */
    initialize: function(text, options) {
      options = options || { };
      this.text = text;
      this.__skipDimension = true;
      this.setOptions(options);
      this.__skipDimension = false;
      this._initDimensions();
    },

    /**
     * Initialize text dimensions. Render all text on given context
     * or on a offscreen canvas to get the text width with measureText.
     * Updates this.width and this.height with the proper values.
     * Does not return dimensions.
     * @param {CanvasRenderingContext2D} [ctx] Context to render on
     * @private
     */
    _initDimensions: function(ctx) {
      if (this.__skipDimension) {
        return;
      }
      if (!ctx) {
        ctx = fabric.util.createCanvasElement().getContext('2d');
        this._setTextStyles(ctx);
      }
      this._textLines = this._splitTextIntoLines();
      this._clearCache();
      this.width = this._getTextWidth(ctx) || this.cursorWidth || MIN_TEXT_WIDTH;
      this.height = this._getTextHeight(ctx);
    },

    /**
     * Returns string representation of an instance
     * @return {String} String representation of text object
     */
    toString: function() {
      return '#<fabric.Text (' + this.complexity() +
        '): { "text": "' + this.text + '", "fontFamily": "' + this.fontFamily + '" }>';
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _render: function(ctx) {
      this.clipTo && fabric.util.clipContext(this, ctx);
      this._setOpacity(ctx);
      this._setShadow(ctx);
      this._setupCompositeOperation(ctx);
      this._renderTextBackground(ctx);
      this._setStrokeStyles(ctx);
      this._setFillStyles(ctx);
      this._renderText(ctx);
      this._renderTextDecoration(ctx);
      this.clipTo && ctx.restore();
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderText: function(ctx) {
      this._renderTextFill(ctx);
      this._renderTextStroke(ctx);
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _setTextStyles: function(ctx) {
      ctx.textBaseline = 'alphabetic';
      ctx.font = this._getFontDeclaration();
    },

    /**
     * @private
     * @return {Number} Height of fabric.Text object
     */
    _getTextHeight: function() {
      return this._getHeightOfSingleLine() + (this._textLines.length - 1) * this._getHeightOfLine();
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @return {Number} Maximum width of fabric.Text object
     */
    _getTextWidth: function(ctx) {
      var maxWidth = this._getLineWidth(ctx, 0);

      for (var i = 1, len = this._textLines.length; i < len; i++) {
        var currentLineWidth = this._getLineWidth(ctx, i);
        if (currentLineWidth > maxWidth) {
          maxWidth = currentLineWidth;
        }
      }
      return maxWidth;
    },

    /*
     * Calculate object dimensions from its properties
     * @override
     * @private
     */
    _getNonTransformedDimensions: function() {
      return { x: this.width, y: this.height };
    },

    /**
     * @private
     * @param {String} method Method name ("fillText" or "strokeText")
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {String} chars Chars to render
     * @param {Number} left Left position of text
     * @param {Number} top Top position of text
     */
    _renderChars: function(method, ctx, chars, left, top) {
      // remove Text word from method var
      var shortM = method.slice(0, -4), char, width;
      if (this[shortM].toLive) {
        var offsetX = -this.width / 2 + this[shortM].offsetX || 0,
            offsetY = -this.height / 2 + this[shortM].offsetY || 0;
        ctx.save();
        ctx.translate(offsetX, offsetY);
        left -= offsetX;
        top -= offsetY;
      }
      if (this.charSpacing !== 0) {
        var additionalSpace = this._getWidthOfCharSpacing();
        chars = chars.split('');
        for (var i = 0, len = chars.length; i < len; i++) {
          char = chars[i];
          width = ctx.measureText(char).width + additionalSpace;
          ctx[method](char, left, top);
          left += width > 0 ? width : 0;
        }
      }
      else {
        ctx[method](chars, left, top);
      }
      this[shortM].toLive && ctx.restore();
    },

    /**
     * @private
     * @param {String} method Method name ("fillText" or "strokeText")
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {String} line Text to render
     * @param {Number} left Left position of text
     * @param {Number} top Top position of text
     * @param {Number} lineIndex Index of a line in a text
     */
    _renderTextLine: function(method, ctx, line, left, top, lineIndex) {
      // lift the line by quarter of fontSize
      top -= this.fontSize * this._fontSizeFraction;

      // short-circuit
      var lineWidth = this._getLineWidth(ctx, lineIndex);
      if (this.textAlign !== 'justify' || this.width < lineWidth) {
        this._renderChars(method, ctx, line, left, top, lineIndex);
        return;
      }

      // stretch the line
      var words = line.split(/\s+/),
          charOffset = 0,
          wordsWidth = this._getWidthOfWords(ctx, words.join(' '), lineIndex, 0),
          widthDiff = this.width - wordsWidth,
          numSpaces = words.length - 1,
          spaceWidth = numSpaces > 0 ? widthDiff / numSpaces : 0,
          leftOffset = 0, word;

      for (var i = 0, len = words.length; i < len; i++) {
        while (line[charOffset] === ' ' && charOffset < line.length) {
          charOffset++;
        }
        word = words[i];
        this._renderChars(method, ctx, word, left + leftOffset, top, lineIndex, charOffset);
        leftOffset += this._getWidthOfWords(ctx, word, lineIndex, charOffset) + spaceWidth;
        charOffset += word.length;
      }
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {String} word
     */
    _getWidthOfWords: function (ctx, word) {
      var width = ctx.measureText(word).width, charCount, additionalSpace;
      if (this.charSpacing !== 0) {
        charCount = word.split('').length;
        additionalSpace = charCount * this._getWidthOfCharSpacing();
        width += additionalSpace;
      }
      return width > 0 ? width : 0;
    },

    /**
     * @private
     * @return {Number} Left offset
     */
    _getLeftOffset: function() {
      return -this.width / 2;
    },

    /**
     * @private
     * @return {Number} Top offset
     */
    _getTopOffset: function() {
      return -this.height / 2;
    },

    /**
     * Returns true because text has no style
     */
    isEmptyStyles: function() {
      return true;
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {String} method Method name ("fillText" or "strokeText")
     */
    _renderTextCommon: function(ctx, method) {

      var lineHeights = 0, left = this._getLeftOffset(), top = this._getTopOffset();

      for (var i = 0, len = this._textLines.length; i < len; i++) {
        var heightOfLine = this._getHeightOfLine(ctx, i),
            maxHeight = heightOfLine / this.lineHeight,
            lineWidth = this._getLineWidth(ctx, i),
            leftOffset = this._getLineLeftOffset(lineWidth);
        this._renderTextLine(
          method,
          ctx,
          this._textLines[i],
          left + leftOffset,
          top + lineHeights + maxHeight,
          i
        );
        lineHeights += heightOfLine;
      }
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderTextFill: function(ctx) {
      if (!this.fill && this.isEmptyStyles()) {
        return;
      }

      this._renderTextCommon(ctx, 'fillText');
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderTextStroke: function(ctx) {
      if ((!this.stroke || this.strokeWidth === 0) && this.isEmptyStyles()) {
        return;
      }

      if (this.shadow && !this.shadow.affectStroke) {
        this._removeShadow(ctx);
      }

      ctx.save();
      this._setLineDash(ctx, this.strokedashArray);
      ctx.beginPath();
      this._renderTextCommon(ctx, 'strokeText');
      ctx.closePath();
      ctx.restore();
    },

    /**
     * @private
     * @return {Number} height of line
     */
    _getHeightOfLine: function() {
      return this._getHeightOfSingleLine() * this.lineHeight;
    },

    /**
     * @private
     * @return {Number} height of line without lineHeight
     */
    _getHeightOfSingleLine: function() {
      return this.fontSize * this._fontSizeMult;
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderTextBackground: function(ctx) {
      this._renderBackground(ctx);
      this._renderTextLinesBackground(ctx);
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderTextLinesBackground: function(ctx) {
      if (!this.textBackgroundColor) {
        return;
      }
      var lineTopOffset = 0, heightOfLine,
          lineWidth, lineLeftOffset;

      ctx.fillStyle = this.textBackgroundColor;
      for (var i = 0, len = this._textLines.length; i < len; i++) {
        heightOfLine = this._getHeightOfLine(ctx, i);
        lineWidth = this._getLineWidth(ctx, i);
        if (lineWidth > 0) {
          lineLeftOffset = this._getLineLeftOffset(lineWidth);
          ctx.fillRect(
            this._getLeftOffset() + lineLeftOffset,
            this._getTopOffset() + lineTopOffset,
            lineWidth,
            heightOfLine / this.lineHeight
          );
        }
        lineTopOffset += heightOfLine;
      }
      // if there is text background color no
      // other shadows should be casted
      this._removeShadow(ctx);
    },

    /**
     * @private
     * @param {Number} lineWidth Width of text line
     * @return {Number} Line left offset
     */
    _getLineLeftOffset: function(lineWidth) {
      if (this.textAlign === 'center') {
        return (this.width - lineWidth) / 2;
      }
      if (this.textAlign === 'right') {
        return this.width - lineWidth;
      }
      return 0;
    },

    /**
     * @private
     */
    _clearCache: function() {
      this.__lineWidths = [];
      this.__lineHeights = [];
    },

    /**
     * @private
     */
    _shouldClearCache: function() {
      var shouldClear = false;
      if (this._forceClearCache) {
        this._forceClearCache = false;
        return true;
      }
      for (var prop in this._dimensionAffectingProps) {
        if (this['__' + prop] !== this[prop]) {
          this['__' + prop] = this[prop];
          shouldClear = true;
        }
      }
      return shouldClear;
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Number} lineIndex line number
     * @return {Number} Line width
     */
    _getLineWidth: function(ctx, lineIndex) {
      if (this.__lineWidths[lineIndex]) {
        return this.__lineWidths[lineIndex] === -1 ? this.width : this.__lineWidths[lineIndex];
      }

      var width, wordCount, line = this._textLines[lineIndex];

      if (line === '') {
        width = 0;
      }
      else {
        width = this._measureLine(ctx, lineIndex);
      }
      this.__lineWidths[lineIndex] = width;

      if (width && this.textAlign === 'justify') {
        wordCount = line.split(/\s+/);
        if (wordCount.length > 1) {
          this.__lineWidths[lineIndex] = -1;
        }
      }
      return width;
    },

    _getWidthOfCharSpacing: function() {
      if (this.charSpacing !== 0) {
        return this.fontSize * this.charSpacing / 1000;
      }
      return 0;
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     * @param {Number} lineIndex line number
     * @return {Number} Line width
     */
    _measureLine: function(ctx, lineIndex) {
      var line = this._textLines[lineIndex],
          width = ctx.measureText(line).width,
          additionalSpace = 0, charCount, finalWidth;
      if (this.charSpacing !== 0) {
        charCount = line.split('').length;
        additionalSpace = (charCount - 1) * this._getWidthOfCharSpacing();
      }
      finalWidth = width + additionalSpace;
      return finalWidth > 0 ? finalWidth : 0;
    },

    /**
     * @private
     * @param {CanvasRenderingContext2D} ctx Context to render on
     */
    _renderTextDecoration: function(ctx) {
      if (!this.textDecoration) {
        return;
      }
      var halfOfVerticalBox = this.height / 2,
          _this = this, offsets = [];

      /** @ignore */
      function renderLinesAtOffset(offsets) {
        var i, lineHeight = 0, len, j, oLen, lineWidth,
            lineLeftOffset, heightOfLine;

        for (i = 0, len = _this._textLines.length; i < len; i++) {

          lineWidth = _this._getLineWidth(ctx, i);
          lineLeftOffset = _this._getLineLeftOffset(lineWidth);
          heightOfLine = _this._getHeightOfLine(ctx, i);

          for (j = 0, oLen = offsets.length; j < oLen; j++) {
            ctx.fillRect(
              _this._getLeftOffset() + lineLeftOffset,
              lineHeight + (_this._fontSizeMult - 1 + offsets[j] ) * _this.fontSize - halfOfVerticalBox,
              lineWidth,
              _this.fontSize / 15);
          }
          lineHeight += heightOfLine;
        }
      }

      if (this.textDecoration.indexOf('underline') > -1) {
        offsets.push(0.85); // 1 - 3/16
      }
      if (this.textDecoration.indexOf('line-through') > -1) {
        offsets.push(0.43);
      }
      if (this.textDecoration.indexOf('overline') > -1) {
        offsets.push(-0.12);
      }
      if (offsets.length > 0) {
        renderLinesAtOffset(offsets);
      }
    },

    /**
     * return font declaration string for canvas context
     * @returns {String} font declaration formatted for canvas context.
     */
    _getFontDeclaration: function() {
      return [
        // node-canvas needs "weight style", while browsers need "style weight"
        (fabric.isLikelyGle", while browsers need "style weight"
        (fabric.isLikelyGle", while browsers need "style weight"
   add  (fabric.isLikelyGle", while browsers need "strowsiTffsets.length > 0g !== 0) {
        return this.fontSize * this.charSpacing / 1000;
      Boop] n}rnsaxWidth;
**
     * retontFamily + '" }>';
,rnsaxWidth;
* @param {Numdoscreen rSpac  oistory (uncreeviright    * @private
  virightrender on
     */
    _renderTextSt) {
        return;
      }on) {
        ret   * @param {NumbclearCache: funco render on
   {Numbis.text = text;   return;
      }
      drawSele '" } * @param {CanvasRenderprivansaxWidth;
* @param { object
xWidth;
;   return;
      }
 0.85); // xWidth;
rs.Col   * @private
 / xWidth;
e
   *if (this.sh xWidth;
rs.Col eturn;
      }
 0.85); //parap     elseparapprese  widtpath-parap'   * @private
 / xWidhis[sLeftOfctx, ls.sh ethod](char, left, top)ontext2D;   return;
 h(ctx, this.strokedashArray);
      cte
     * ons();
 g} aeedis.son() {
 the text wi) {
     tructorthis.= falser} left Left positi ctx = fabric.utileight;
    },

    /**
     * @pr    /xt(lintop)ontext: tru
        data[i + 2] += max !== data[i + 2] ? (max - data[i + 2]) * adjust : 0; * Constructor
  maxWidthToInclude] Any * Background},

you mtext oaurate =e.split('sLiinclude= falseroutpu:             0,



      context.putImageData(imageData, 0, 0);
    },

    /**
     * Return  maxWidthToIncluden
     * @para=e.split('TS,
      MIN     * @re fabric.Obje @re ateProperties = @re ateP
  }

  var s @re atePned');
    re @re atePreProperties @re sets[j] ) perties @re  1 - 3/16
    perties @re  1 -s.concat();
 @re  1 -,
    'fontWeighat();
 @re es[lineInde'need "sty   fabr  maxWidthToIncluden;
    /**
     * @pr instance
     * @re,a=e.split('TS,
      
        data[i + _TO_SVG_START_  },

   + 2] += max !== daSVG 2] ? (max - data[i + 2]) * adjust : 0; * ConsF* Returor
revif (]ue;
        furight
 * s }
 a[isveight = this._gehe text wi) {
       rendesveight = this._geimageData, 0, 0);
    },

    SVG   * Returnrevif (*
     * @private
  
     * @privatte
  
      */
    _initDimensions: function(ctx) {
      if (this.__tx Context tmarkur "strokeTtDimenrivaSVGMarkur(_getHeightOfL{
      if._getHeigSVG    tTopOffses(te
  
   ineWidth);
  1 -sndBg if._getHeigSVGT1 -sndBgffsets.pu 1 -Tgth)fsets.pu 1 -       return;
    wrapSVGT1 -sndBgfmarkur,  1 -sndBgret   * @p) {
   revif (ighrevif (fmarkuryle wei')le",markuryle wei');
    },

    /**
     * @private
     */
    _eigSVG    tTopOffsessRenderingContext2D} ctx Con._getTo ctx.fillStyle = this.textBack0 ineWidth);
  1 -Lethod dth : 0;
    },ineWidth);
  1 -tTo ct0et   * @p) {
    * @privatt1 -Leth:  1 -Letho+85); //parap     elseparapprese  widtpath-parap', while emove:k0 ineWidth); 1 -tTo:  1 -tTo +85); //parap     elseparapprese  widtpath-parap', w-ls.sh ete:k0 ineWidth);._getTo:;._getTothis.__t;
    },

    /**
     * @private
     */
    _wrapSVGT1 -sndBg  * @param {arkur,  1 -sndBgrxt2D} ctx Connoy was nnAffec,initialize elsepigSvg   */
(_getHeightOfLsndColornitializhis.w, w.w,: 'LsndCo=
    nitialikelyGet   * @pmarkuryis alreadyyyyy'\t<g ',e elsepigSvgIdext"' xWidth;
=
 ,e elsepigSvgaxWidth;
ext" elsepigSvgaxWidth;
rs.Coloxt"'"'getHeightOfLsndCot"'>\n'ineWidth);
  1 -sndBg      g heisyle wei')ineWidth);
 '\t\t<();
 't,
           (    (fabric.isLi?e ateP-al, 40=
        (fabric.isLtx,place(/"/gt"'\.wid     w,: '')t,
           (    (fabrLikel?e ateP-   /=
        (fabrLikelyGl  w,: '')t,
           (    (fabrLndCol?e ateP- ndCo=
        (fabrLndColyGl  w,: '')t,
           (    (fabr  retur?e ateP-   */
=
        (fabrWfsets.lel  w,: '')t,
           (    ( 1 - 3/16
    r?e  1 --*
     * F=ation of text  3/16
    rlel  w,: '')t,
           ' ndCo=
 t" elsepigSvg{
     noy was xt"'" >\n'ineWidth);
 
  1 -sndBg     inensyle wei')ineWidth);
 '\t\t</    >\n'ineWidth);'\t</g>\n'neWidthtOfLine;
      }
      // if there is text background colo 1 -tTo  for (od namet
     */
    _t background colo 1 -      for (od naemoveShadow(ctx);
      0,



     
     */
    _eigSVGT1 -sndBg  * @param  1 -tTo  for ,o 1 -      for rxt2D} ctx Con    inens if (ineWidth);
  1 - g heis if (ineWidth);
 ntoLines(
    _getNumb'fonren-box     height return;
      }SVGBgf 1 - g heis)tx, line, le();
 gende1 --    height return  var lineTopOffset = 0, heightOfLine,
          lineWidth, lineLeftOf0.85); // 1 -am {CanvasRenderingContext2rn;
      }SVGkground(Bgf 1 - g heis,s.he 1 -      for ,  1 -tTo  for ,onvasEl)et,
            this;
      }SVGkground(dth
 .he 1 -inens,onvasElhe 1 -      for ,  1 -tTo  for ,o 1 - g heis)txidth);
 ntoLine+ctx.fillStyle = this.texte
  
  t, heightOfL}t   * @p) {
    * @privatt1 -inens:e 1 -inens,* @privatt1 - g heis:tt1 - g heisthis.__t;
    },

       }SVGkground(dth
  * @param .he 1 -inens,onvasElhe 1 -      for ,  1 -tTo  for rxt2D} ctx ConyPo  if._get    }
     eHeights oLen; j++) {
Heights oLen; ethod, c)* @privat-o 1 -tTo  for (+ ntoLine-
    _renderTexte = this._textLin {
        width = this._measureLin linrn {Stam {Ndth,
te doscreei{
 fth,
on giIT left Lefhis;
      }SVGkground(J = thed .he 1 -inens,oyPo ,o 1 -      for ruldClearCache: fod](char, left, t   inensyis alreadyyyyy'\t\t\t<(snen x="'getHeightOfLrict';
( 1 -      for (+s._getHeightOfLine(ctx, i         lineLeftOfte
  
  t, hxt"ric = { }),
      cxt"'" 'getHeightOfL'y="'getHeightOfLrict';
(yPo ,oric = { }),
      cxtetHeightOfL'" 'getHeightOfLNumdo }
 uncti  r<(snen>is.saturs s }cext.ple" uoContexetHeightOfLNumos.__skaine" u<();
> defidoesn' * @pk= faIll = 6
 essed inefhis;
    g);
   At.Cobutes(te
      xt"'>'getHeightOfL */
    _ini    }
.escapeXmlreturn {Number} gth;ineWidth);'</ snen>\n'neWidthtOfLine;
         }SVGkground(J = thed  * @param .he 1 -inens,oyPo ,o 1 -      for r filter to can      */
    _initDimensions: function(ctx) {
      if (t return;
      }on) {
        ret   * @pparam {Number} lineIndex liset = this._ge{
        this._renderChars(method, cndex);
        return;
      }

      // stretch the')lrds = line.split(/\s+/),
          charOffset = 0,
          wordsWidth = this._getWidthOfWords(ctx, words.join(' '), lineIndex, 0),
          widthDiff = this.widths._renat.Cobutesntext2D} ctx    At.Cobutes(te
      xt this.widthineW
 left, t         for (+is._getHeightOfLine(ctx, i         lineLeftOffset, h
    _renderTexords.length - 1,
          spaceWidth = numSpaces >  i < len; i++) {
           inensyis alreadyyyyyyy'\t\t\t<(snen x="'getHeightOfLfLrict';
( 1 -      for t"ric = { }),
      cxt"'" 'getHeightOfLfL'y="'getHeightOfLfLrict';
(yPo ,oric = { }),
      cxtetHeightOfLfL'" 'getHeightOfLfLNumdo }
 uncti  r<(snen>is.saturs s }cext.ple" uoContexetHeightOfLfLNumos.__skaine" u<();
> defidoesn' * @pk= faIll = 6
 essed inefhis nat.Cobutest"'>'getHeightOfLfL */
    _ini    }
.escapeXmlrxt totetHeightOfL'</ snen>\n'neWidthffset,
      t         for (+is._getHeig
      }

      // str word, left + leftOffs}fLine;
         }SVGkground(Bg  * @param  1 - g heis,s.he 1 -      for ,  1 -tTo  for ,onvasEl)
        r    g heisyis alreadyyyyy'\t\t<rtext'getHeightOfLrt2D} ctx    At.Cobutes(te
   1 -am {CanvasRendertetHeightOfL' x="'getHeightOfLrict';
( 1 -      for (+s._getHeightOfLine(ctx, i         lineLeftOfte
  
  t, hxt"ric = { }),
      cxtetHeightOfL'" y="'getHeightOfLrict';
(ntoLine-
    _renderTextt"ric = { }),
      cxtetHeightOfL'"  0),
="'getHeightOfLrict';
(         lineLeftOfte
  
  t, ht"ric = { }),
      cxtetHeightOfL'" h  */
=
 getHeightOfLrict';
(         le = this.texte
  
  t, hs._textLines.length"ric = { }),
      cxtetHeightO'"></rtex>\n'tOfLine;
         }SVGBg  * @param  1 - g heis {
          this._bm {CanvasRenderingContext2r    g heisyis alreadyyyyyyy'\t\t<rtext'getHeightOfLfLrt2D} ctx    At.Cobutes(te
  bm {CanvasRendertetHeightOfLfL' x="'getHeightOfLfLrict';
(dth : 0;
    },ioric = { }),
      cxtetHeightOfLfL'" y="'getHeightOfLfLrict';
(width / 2;
    }ioric = { }),
      cxtetHeightOfLfL'"  0),
="'getHeightOfLfLrict';
(     s[lineIric = { }),
      cxtetHeightOfLfL'" h  */
=
 getHeightOfLfLrict';
(     hlength"ric = { }),
      cxtetHeightOtO'"></rtex>\n'tOfLine'overline') > -1) {
       AdobeaIll = 6
 es (anaemast CS5) (unuOf fais.charSpacrgba()-  mberate
 
     
       we* @pk=aeightOitx In"mov }
" * @pa
    nelei{
ouoContexnat.Cobute gendt.ple" uate
's * @pa

outing sha     // if there is text backgro*} 
    (ctx);
      0,

   rend
     */
    _eig    At.Cobutes  * @param 
    r filter to caate
tBackg=  
         */
  f
      widt    }
s._?aturate} InstBack 
    r : ''asRenderprivaate
tBackg|| aate
tBackepigSourc @pr|| ate
tBackepigA @pa@pr wid1render on
     */
extFil=ation
     kelyGetLine'overlin     */
exoContex=
    nit
tBackepigA @pa@prlel  tFil=ationnit
tBackesigA @pa@1).toRgb@prlel eturn '#<f> -1)  _TO_SVG_END_lor
     * @method getTex"strowsiTf         te =x"strowsiTf
    (ctx);
  n() {
      retkey is text backgro*} 
    (ctx);
      0,

    /**
     * Constructor
memberOf fabric.Text    _* @private
   key, 
    r filter t* @pr instance
 _* @', key, 
    ret   * @paramkey= false;
      if (this._forceClearCache) {
  {Numbis.text = text;e / this.lineHeistx) 

   tOfLine'overline') > -1) {
       x !== da  * @returs.cursorWidth || MIN_TEXT_WIDTH;und colo  * @returbric.Text      * @retureight;
    },

    /**
      'justi     */
    t  = OM_SVG_START_  },

fontSize'**
     at.Cobute },

me ("accrCoundth: fgth * s }
 SVG s.satur (   _r Innds fabric.Object
e fro functi*
    *t'), {
        ing} Text background    *t')ee:
  /**
 www.w3.org/TR/SVG/    .html#ound functi
c.Text  ric.Object
eATTRIBUTE_NAMEric || (gloSHARED_ATTRIBUTESy   fabrjusti'x y dx dy ateP-al, 40 ateP- ndCo ateP-   */
 ateP-   /  1 --*
     * F  1 --th hor'ext(line ')
    'fontSize'D   1.1 SVG f/

    /    *t'), {
        ing} Text background    *xt  ric.Object
eDEFAULT_SVG_FONT_SIZEof f6    'fontSize'x !== dad,
      NUM_rowsers am {NrsoSVG s.satur (<b>creeyr (i* @raturedoke:
    *t'), {
        ing} Text background    *t'n() {
  VG functi* s.satur  functie (" * se    *t'n() {
 default
     */
    charSpacing:    
      0,

    /**
     Irowsers nxt background    *xt  ric.Object
e fro functiic |ht;
    s.saturt string
     * @privas.satur},

    /**
     rope'justi  
er to ca * sedAt.Cobutesnteric.Obj * seAt.Cobutes(s.saturt ric.Object
eATTRIBUTE_NAMErtOfLineram {Objec */
    _iniacing:.eextAl(n(text,  = (*/
    _iniacing:.cldefn(text, o ng r}ht" * sedAt.Cobutesret   * (text, . or "s(text, . or {
        (text, .method (text, .metho{
        priv'dx'= fa * sedAt.Cobutesr    * @param {Ob.har = ch * sedAt.Cobutes.dx'justi      priv'dy'= fa * sedAt.Cobutesr    * @param {Ob.     ch * sedAt.Cobutes.dy'justi      priv!( ateProper= fa(text, or    * @param {Ob.    }
   = ric.Object
eDEFAULT_SVG_FONT_SIZE'justi  
er tpriv!ram {Ob.originXr    * @param {Ob.originX    t. Po'justi  
er to ca 1 -) {
 tiic 'Get   * // The XML (uncree      40  * sed= faIE9 se =x @pkaeightOtDimen   * //  1 -) {
 tii    coratinnirstChild.data. Aneight
 @pkaeightOw);
       * //   colov    XML loadearam {Nannitais.c    lov   earus }
 DOMP* ses (s,

 way loadSVGFm {     r },does)     priv!(  1 -) {
 tir= fas.satur} {
          t'nirstChildr= fas.satur    s.satur.nirstChildx],
 rope, lineLeftOf0.85'datar= fas.satur.nirstChildx   s.satur.nirstChild.datax],
 rope, lineLeftOf a 1 -) {
 tiic s.satur.nirstChild.data'justify') {
        wor   wor      }

     1 -) {
 tiic s.satur. 1 -) {
 ti'justi  
er t 1 -) {
 tiic  1 -) {
 titx,place(/^\s+|\s+$|\n+/gt"'')tx,place(/erChgt"' f (t retuo ca 1 -in('urate} Insdth
  1 -) {
 tit string
 ,* @privatt1 -.lengtS ineFapresic  1 -.   le = t(hs._t   .hine(
          ines.lengt/\s+/),(t   .hine(
(+s.   /xCanvasRendfinal   /sets[j] ) *-_t   .hine(
          s ined/\s+/),ines.lengt/\s+/*tt1 -.lengtS ineFapres,* @privatt1 -.lengtic  1 -.   le = t(hs+ s ined/\s+,* @privatoffXes(
    _g    if ( Adh = nder on
 nt.l* @privatx/ynat.CobutesnisoSVG    respohtOtDilserbottom-har =   ne /**
     b'fonren b'x* @privattop/har =* BackgrounisoFe} In    respohtOtDi line
ndei{
/**
     b'fonren b'x* @pr
    _gef,(t   .originX  =   t. Por    * @parffXes( 1 -.   LeftOf   */
    _}   _gef,(t   .originX  =   dth) {
      if rffXes(- 1 -.   LeftOf   */
    _}   _g.   /xet(     if leth:  1 -.eightOf(hs+ rffX,* @privtTo:  1 -. this.(hs-tt1 -.lengti  if (tct
e    }
     e0.18f (tct
ets oLen; ethod, c)s._t   .sets[j] ) * t 0.3i    cs nldxsets[j] ) *
    _g} (t retu*
     *ereturnt;
   t  = OM_SVG_END_lor
   fontSize'x !== dad,
      NUM_rowsers am {Nrsota[i + 2] ? (max - da    *t'), {
        ing} Text background    *t'n() {
 default
ta[i + contexttDi DimenursorWidth | am {    *t'n() {
 F* Returor
 insbm {]urresbm {ttDiinv   * fgthrsod,
      NUM_rowsers lt
 Dimend    
      0,

    /**
     Irowsers nxt background    *xt  ric.Object
e frocontextc |ht;
    ta[i +,  insbm {
      io ca 1 -in('urate} Insdth
 acing:. 1 -,  ldefn(cing:)tOfLine insbm {
    insbm {(t   tOfLine*
     *ereturnt;

   */
    _initDimenAccessors(te} Insdth
 (t })( */
  fex    s this. _thl as w, wex    s ", whi (t 
(ght;
    },


 to canldefjec */
    _iniacing:.nldef    'fontSize'IT leanlass    Canduced= fa<b>v1.4oke:
 Evturs arnurlse nired=on giepres:"tSize' ? fix* fgthobsesv }
 }
    .    
  nlass  */
   Iound    *t'eextAlst background    *t'mixest backgrObsesvf fabricntSize'@niret
     */tSize'@niret
sele '" }:     */tSize'@niret
e.splt.lline
*/tSize'@niret
e.splt.llxiend    
    
      0,

    /**I
     * Construct*t')eennds fabric.ObjI
   # @param {S}     }  * expreswell ai- da    *ruct*t<p>Sup    ed=key=combin - das:</p>ruct*t<pre>ruct*t  Mxt
 }
    turn {fabric.Text}if leth, rength"ur, downruct*t  Sele 'n pixels)
turn {fabric.TexshiineLeftOf,xshiineLer) + line*t  Sele 'n 1 -ivis._getlt
     */
 shiineLeur, shiineLedownruct*t  Mxt
 }
    r In strturn {fabric.alneLeftOf,xalneLer) + line*t  Sele 'nw  * @pppppppppppppppppppshiineLealneLeftOf,xshiineLealneLer) + line*t  Mxt
 }
    rtDim {Nuowsrt/e },
 cmdeLeftOf,xcmdeLernctionr home, endline*t  Sele 'n te
 owsrt/e }on() {
 ,
 cmdeLeshiineLeftOf,xcmdeLeshiineLernctionr shiineLehome, shiineLeendline*t  JumprtDiowsrt/e }on()pres:ppppppcmdeLeur, cmdeLedownruct*t  Sele 'n te
 owsrt/e }on()pres:ppcmdeLeshiineLeur, cmdeLeshiineLedownonr shiineLepgUr, shiineLepgDownruct*t  Deleenu pixels)
turn {fabric.Texbm {d, leruct*t  Deleenu strturn {fabric.{fabric.alneLebm {d, leruct*t  Deleenu {
 ,
                   cmdeLebm {d, leruct*t  For * @welleen,
                elleenruct*t  Copy)pres:pppppp                ctrl/cmdeLecruct*t  P  }
)pres:pppppp               ctrl/cmdeLevruct*t  Cut)pres:pppppp                 ctrl/cmdeLexruct*t  Sele 'ntyler
)pres:pppppp       ctrl/cmdeLearuct*t  Quit
e.splt.ppp                 tabonr escruct*t</pre>ruct*ruct*t<p>Sup    ed=mouse/touch=combin - da</p>ruct*t<pre>ruct*t  Per on
  }
    turn {fabric.Textclick/touchruct*t  CDimenusele '" }:rn {fabric.Textclick/touch & dragruct*t  CDimenusele '" }:rn {fabric.Textclick & shiineLeclickline*t  Sele 'nw  *:pppppp              dou faiclickline*t  Sele 'n {
 ,
                   .Copfaiclickline*t</pre>ruct*xt  ric.ObjIT lea   */
    _initDimenslass(te} Insdth
,t backgrObsesvf fa,xtDecoltAlst backgrIT le color
   t*xen, j, ootype
     * @param {String} textBackgroundColor Text background color
     * @retu'i- 1 -       1.16,

    /rn 0;
wdth,
t leasele '" } owsrts  th: fgr
 }
    rlt
 fgthidth,
   offsele '" }   null,

    /**
     * @private
     */
    _fonsele '" }Swsrt:etween characters
  rn 0;
wdth,
t leasele '" } tAls  null,

    /**
     * @private
     */
    _fonsele '" }E },
tween characters
       /**
     sele '" } textBackgroundColor Text background color
     *sele '" }ight:  'rgba(17,119,255,0.3)       1.16,

    /rn _getesnwdtight
     iunisoe.splt.pmoidth;
     grounBoop] n Text background color
     *isE.splt.l  _sho      1.16,

    /rn _getesnwdtight
er} le }
 c   e.sp
          grounBoop] n Text background color
     *e.spf fa:Affec,     1.16,

    /B  *er

    /**
     ta[i + tted fit'unisoe.splt.pmoidth;
     groundColor Text background color
     *e.splt.B  *eright:  'rgba(102,153,255,0.25)       1.16,

    / // other}
    r     x   null,

    /**
     * @private
     */
    _fon}
      thi:},inen characters
       /**
ate
   r}
    r  fgthcreeif (writxtAr In pixels)
LsndCo)th;
     groundColor Text background color
     *}
    ight:  '#333       1.16,

    /Delay Size (in 
    r s fab    m    null,

    /**
     * @private
     */
    _fon 
    Delay: },

      1.16,

    /Durs._geimag 
    rfade       m    null,

    /**
     * @private
     */
    _fon 
    Duaration 6

      1.16,

    /context__skaine" u pixels)
LsndCos  null,
(wdth,
top-level=* Backgroun   respohtsrtDim {Nu,

    gend2nd-level=* Backgroun--ttDi ._ge,

    umber tru
  null,

    /Oring} textBackolor.
     * <b>Backwaet: furoperty was named "texrn _getesnwdtight
i{
 rn to} le }hdths[lins }
 c   cfunc          grounBoop] n Text background color
     *cfunlt.l ffec,     1.16,

    /@private
     */
    _rewidth: /\s|\n/ineWidth) / 2;
      }
      if (this.texi++) {C
     Contex,
tween characters
  @private
     */
    _cele '" }Dire '" }:rroperty was named "textShadow" (String) untiab   C
    Animration s_sho      1.16,

    /tShadow" (String) unti_w      width:  (inen characters
     * expressed in thousands of em unit
     * @type Number
     * @default
     */
    charSpacing:             0,

    /**I
     * Constructor
     *i@param {String} text Text string
     * @paneHeisaet: od (text, ightram {Ob.saet: oons] Oo ng r}  return;
    instance
 i@param {S',  1 -t string
   return;
   i@paBehavior.strokedashArray);
      ctx.beginPath();
this.textAlign === 'right') {
        retur instance
 _xtAlign =='   return;
    _w      widthurn 0;
    },

    /**
     * e
     * @ret  oistory Top offset
ype Number    _getTopOffset: function() {
      reprivate
  saet: ndex] = -1;
        ction() {
      var // rbjntext2D}saet:     _renderTextComp1= fa(bjndex] = -1;
erTextComp2= fa(bj[p1e;
        retu// es
ypt-disf fa-n1 --m {Nu,o-un   _-tCos       retuerTextComp3= fa(bj[p1e[p2e;
        retu        ad_shouldClearCa        this {
        wordCount = his.height / 2;
    },

    /etTex"ele '" } owsrt (har =b'fonarrs.curfsele '" }   null,

background coloinder
     *tDioeeasele '" } owsrt*tD color
     *setSele '" }Swsrt:e* @param .r on
     * @pa    *= Math.max .r on{Numbereturn;
    updmenAndFire('sele '" }Swsrt', iextLines[li / 2;
    },

    /etTex"ele '" } e }o(rnctiob'fonarrs.curfsele '" }   null,

background coloinder
     *tDioeeasele '" } ehtOtD color
     *setSele '" }E },

    /**
.r on
     * @pa    *= Math.min .r on{N* @pr    /= 0, wobereturn;
    updmenAndFire('sele '" }E }', iextLines[li / 2;
    },

    /  }
      else {
        ctx[met         'sele '" }Swsrt'onr 'sele '" }E }'  null,

background coloinder
'urader on
             ath();
this.teupdmenAndFire   * Return  maxWiy, iextLi{
          this.
  maxWiyearCaciextLi{
           * @prireSele '" }C    */;e / this.lineHe
  maxWiyeaaciextLod](char, left, top)onupdmen
   aDim.strokedashArray);
      ctFiret
 cs eve     sele '" }      */tSiz  ctx.beginPath();
this.terireSele '" }C    */= 'right') {
        returfire('sele '" }:     */'   return;
   tring}     else}
    .fire('pres:sele '" }:     */',g r aDg @pruncti}strokedashArray);
      ctGtTex"ndCo .curfxi++) { sele '" }/}
    r a} lineowsrt*der on
    null,

background colo[owsrttAlign Swsrtoinder
tDimenkwaet:  a*/
    _t background colo[ehttAlign EhtOinder
tDimenkwaet:  a*/
    _t     0,



      waet:  LndColistory a} =x"strowsiTf th:xi++) {)Oinderath();
this.tgetSele '" }Swet: function() owsrttAlig, endder on
            taDguatursis._getW =  2rticalBox = thissaet: od [) {
         var lineTopowsrttAlig  spacendder oditionalSpace = thisaet: yis al elsepigSele '" }Swet: (i)e / this.li      thishis['__'aet:   his.li      var // locize elsepig2DC
    Locaon() owsrttAlig_getHeightOfLsndColor._getHeigSndCotext to rendloc.ne number, locnes[ltextLine
  thishis['__'aet:oons]t;
    },

    /**
     * StTex"ndCo .curfxi++) { sele '" } Number
     * @default
 'aet: ] LndCoSpacing:             0,

    /**I
     * Constructor
memberOf fabric.Text    setSele '" }Swet: function() owet: ndex] = -1roke: funcele '" }SwsrtW =  : funcele '" }Ehti{
           * @peextAlSwet: (: funcele '" }Swsrt,_'aet:  (this.__tx Conte      }

        var lineTop: funcele '" }Swsrt  spac: funcele '" }EhtditionalSpace = thi  * @peextAlSwet: (i,_'aet:  (this.__is {
        wordC/*screei{cluded= fapeextAlSwet: e ("avoid xtAli }
 }
*/
 mion)th {Sters  {
      Heights vate
     */
    ction() {
 *
     * @ptrokedashArray);
      ctx.beginPath();
this.teeextAlSwet: ,

    /**
.r on,_'aet:  xt2D} ctx Con.ocize elsepig2DC
    Locaon() iextLine
  thisprivate
      lineSwet:dloc.ne number render on
   {Numbs  lineSwet:dloc.ne number,g })  his.li      varprivate
      SndCotext to rendloc.ne number, locnes[ltextLirender on
   {Numbs  SndCotext to rendloc.ne number, locnes[ltextL,g })  his.li      var */
    _iniacing:.eextAl(te
      SndCotext to rendloc.ne number, locnes[ltextLi,_'aet:  (this.nction() {
      if (this.charSpacing !== 0) {
        return this.fontSize * this.charSpacing / 1000;
      Boop] n}rnsaxWidth;
**
     * retontFamily + '" }>';
,rnsaxWidth;
* @param { else}
    e * this.(h  return;
    instance
 ontFam' === ' nsaxWidth;
*(this.nction() {
      if (this.charSpacing !== 0) {
        return this.fontSize * this.charSpacing / 100idth > 0 ? fi    },

    /**
     * @priva instance
 _ontFam' === h  return;
                _getNum}
    line}
    (ctx,   */
, se ws ene wittDi alcuhis[Sters ppacr(line[
       _getNumline}  recaram {Canvabutscreea} everrs}
    ranimratio. return;
    
    (ctx,   */
    r}  return;
   r(line[
    OrSele '" }.strokedashArray);
      ctPreparnurnd xtAlnmline}  * this.g / 100idth >}
    e * this.function() {
      reprivate
  hod,v:oonsate
  isE.splt.anvasRenderingContext2D} ctx Conte._textLinering}     else}
    .}  * this.rticalBox = this       else}
    .}  * this.(this.__is) {
        returnate
 / xWidth;
e
   *if (this.sh}
    .view    axWidth;
*(this.turn;
   
xWidth;
;   return;
 rn;
   
xWidth;
rs.Colt += wid xWidth;
e
   *if (this.sh xWidth;
rs.Col eturn;
    {Numb}
   
   ADim.   return;
 rnh(ctx, this.stroked'overline') > -1) {
       x le", w}
    rnr sele '" } (depeonren  } w},

exists * @param {Canr(line[
    OrSele '" }function() {
      reprivate
  hod,v:oonsate
  isE.splt.anvasRenderingContext2D} ctx Contethis charlor) {
     ext(line).getHeightOfLb'fonariest"       _get._textLinering}     else}
    .}  * this.rticalBox =        else}
    .}  * this.(this.__is) {
        returnate
 / xWidth;
e
   *if (this.sh}
    .view    axWidth;
*(this.turn;
   
xWidth;
;   return;
 rn;
   
xWidth;
rs.Colt += wid xWidth;
e
   *if (this.sh xWidth;
rs.Col eturn;
    {Numb}
   
   ADim.   rett2D} ctx Conte      }

             else}      _getis) {
        returntx Conte._textLincele '" }SwsrtW =  : funcele '" }Ehti{
         b'fonarieslor._getHeig[
    B'fonaries0, chst"'}
    ' eturn;
    {Numr(line[
    (b'fonariest"   rett2D} ctx Conte      }

      b'fonarieslor._getHeig[
    B'fonaries0, chst"'cele '" }' eturn;
    {Numr(lineSele '" }., chst"b'fonariest"   rett2D} ctx Conteh(ctx, this.strokedashArrayb}
   
   ADim    },

    /**
     * @Numws add 4 pixel,is.c   e wittDidoscree
  vnurny pixelroutx Contethisvar width, wount = li4, ntoLines(idth / 2;
  li4;x Conteh(ct}
    heig-0;
    },io-/ 2;
    }ios[lineInvasEl)et,
  #<f> -1) *
     * e
     *2dight = this._gei(return 0;
rnd xs[ltextLither}
    r nr sele '" } owsrt   null,

background colo[oele '" }Swsrt    charalOinder. Wfgthcreeg,v:n,fxi++) { sele '" }Swsrtois    _/**
     * retpig2DC
    Locaon()function() oele '" }Swsrtndex] = -1roke:*/
  fcele '" }SwsrtW =  . _thl as wi{
         cele '" }SwsrtW p: funcele '" }Swsrt xt2D} ctx Contethisset = 0, heightOfLine,
          var  var lineTopO     lineWidth, lineLeftOf0.85cele '" }SwsrtW<mber} lineIndex lise/= 0, woalSpace = thi) {
    * @privatttttreturn 0;: igetHeightOfLfLxs[ltextL: cele '" }SwsrtetHeightOfL}eturn;
   }         cele '" }SwsrtW-mber} lineIndex lise/= 0, w li1 xt2D} ctx Conte) {
    * @privatreturn 0;: iWidthOfWords(cxs[ltextL: er} lineIndex lisWidte/= 0, w < cele '" }SwsrtW? er} lineIndex lisWidte/= 0, w : cele '" }SwsrtetHeight;
    },

    /**
     * x !== da  * @renusndCo .cu}hdtha} linexi++) { c
       _ge00;
      }
      return 0;
     inderath();
0;
      }
      xs[ltextL  (th inderath();
0;    0,



      Cpixels)
LsndCo**
     * retpigCi++) {Cs[lindCoprivate
     * umber, xs[ltextLitt2D} ctx ConsndColor._getHeigSndCotext to rendl * umber, xs[ltextLeringCW? 0 : xs[ltextLet, fet   * @p) {
    * @privats oLen; :nsndCol +=sndCoe    }
    @param     }
  hOfWords(cf
    sndCol +=sndCoe te
  @param  ipertfWords(c 1 -am {CanvasRende  sndCol +=sndCoe 1 -am {CanvasRende  @param  1 -am {CanvasRendertfWords(c 1 -idth : 0;
  sndCol +=sndCoe 1 - 3/16
    r @param  1 - 3/16
    ,* @privats oLic.isL:nsndCol +=sndCoe    ic.isLi @param     ic.isL,* @privats oLWfsets:nsndCol +=sndCoe    Wfsets. @param     Wine(
          fabrLndCo:nsndCol +=sndCoe    }aet:oonsaram     }ndCot         clText')sndCol +=sndCoe
     * @param {Canvat         clText  thi:}sndCol +=sndCoe
      // ot @param {CanvasRendetHeight;
    },

    /**
     * x !== da    }
   .cu}hdtha} linexi++) { c
       _ge00;
      }
      return 0;
     inderath();
0;
      }
      xs[ltextL  (th inderath();
0;    0,

}
      Cpixels)
Lf/

    /        * retpigCi++) {Cs[lF oLen; :nivate
     * umber, xs[ltextLitt2D} ctx ConsndColor._getHeigSndCotext to rendl * umber, xs[ltextLeringCW? 0 : xs[ltextLet, fet  * @p) {
   sndCol +=sndCoe    }
   ?=sndCoe    }
   :param     }
  ;
    },

    /**
     * x !== da  nde (    x .cu}hdtha} linexi++) { c
       _ge00;
      }
      return 0;
     inderath();
0;
      }
      xs[ltextL  (th inderath();
0;    0,

 ctx[metCpixels)
L  nde (    x        * retpigCi++) {Cs[lRende  ivate
     * umber, xs[ltextLitt2D} ctx ConsndColor._getHeigSndCotext to rendl * umber, xs[ltextLeringCW? 0 : xs[ltextLet, fet  * @p) {
   sndCol +=sndCoe te
 ?=sndCoe te
 :n;
    
    
      }
  },

    /**
     * x !== da 
    r 'fonariesl(fctx, lgth)l     for ,  To  for rath();
0;
this.charSpacing !== 0tructor charlAis.son() pixels)
sharSpacing !== 0 of em un*/
OfB'fonaries        * retHeig[
    B'fonaries    },

     chst"n*/
OfB'fonariesn
         Numl   /    arnul   /      feyler
)pres b'x* @privNuml     for / To  for  arnuShadow am {Nd},

l   /    dei{
/**
a)pres b'x*x Contethissethod Math.aram {te
      ltOfLine(ctx ineWidth);
  To ctx.fillStyis._getLine,
neWidth);
 {
      if._getHeig[
    B'fonariespOffses(etHeightOfLfLLLLLLLLLLL  chst"n*/
OfB'fonariesnet   * @p) {
    * @privatleth: fctx,tfWords(c To:  gth* @privatleth   * @prfsets.pushineLefsets.pustOfLine,tfWords(c To   * @prfsets.putTothis.__t;
    },

    /**
     * @private
     */
    _eig[
    B'fonariespOffses    },

     chst"n*/
OfB'fonariesn
  his.__._textLine
    (ctx,   */
  +='tTo'= false;
e
    (ctx,   */
ndex] = -1;
        }
  e
    (ctx,   */
 xt2D} ctx Contethiss
        for (i  = this.widthreturn 0;
i  = this.widthxs[ltextLer  = this.width To  for  i  = this.widthr     for (i  = this.width 'fonaries    _renderTextComeTopO     l: funcele '" }Swsrt  sth, lineLeftOf0.85  chsiseW =  .\n't {
        hei     for (i  ; this.width To  for  +ctx.fillStyle = this.texte
  
  t,is._textLine this.widthreturn 0;++; this.widthxs[ltextLer  eturn;
   }               }

      hei     for (+is._getHeig
      Cs[lxte
  
  t,  chsiset,is._textL, xs[ltextLi; this.widthxs[ltextL++; this.wid}e this.wids
        for (i ._getHeightOfLine(ctx, i         lineLeftOfte
  
  t,ne number r  returntx Conte._tex*/
OfB'fonariesf text 
    ' ender on
   To  for  +ct(1 {
Heights oLen; ethod, c) *tx.fillStyle = this.texte
  
  t,is._textLis._textLines.lengt this.width-e elsepigCi++) {Cs[lF oLen;    * umber, xs[ltextLit*t(1 {
Heights oLen; ethod, c)ext2D} ctx Conte._textLines[lineIndex],
  t += s[ltextLeringer} lineIndex line number
/= 0, woalSpace = ti     for (-is._getHeig
      Cs[lis.charSpacing !== 0) {
 b'fonarieslornder on
   To:  To  for h* @privatleth:ti     for (Index,i     for (ff = this.wids
      :ds
        for this.__t;
    rn;
    
    (ctx,   */
    'fonaries      rn        }
  e
    (ctx,   */
 xt2D}e') > -1) {
       x le", w}
    harSpacing !== 0

      b'fonaries       ing !== 0) {
        return this.fontSi xWidth;
iTffsets.lttDidrawcing / 100idth >r(line[
        },

   b'fonariest"   r
         this 
    Locaon()ize elsepig2DC
    Locaon() )= this.widthreturn 0;
i  
    Locaon().ne number, this.widthxs[ltextLer  
    Locaon().es[ltextL, this.widthxs[lHtoLines(idth pigCi++) {Cs[lF oLen;    * umber, xs[ltextLi= this.widthr     for (i (return 0;
=,
  t += s[ltextLering0) this.widthhhhhhhhhhh? ._getHeightOfLine(ctx, i         lineLeftOf
  t,ne number r this.widthhhhhhhhhhh: b'fonaries.l     for , this.widthmultiplialize elses ineX *tx.fil}
    .   Zoom )= this.width}
      thi    else}
      thi /hmultiplialne this.w        SndColor._getpigCi++) {Cs[lRende   * umber, xs[ltextLi;x Conteh(ctglobalA @pa(i ._getH_isMousedowno? 1 :n;
   exi++) {C
     Contexne this.w         heightOfLine b'fonaries.l   eLeftOf  for (- }
      thi /h,ineWidth);b'fonaries.     ;b'fonaries.     for , this.wid}
      thihOfWords(cxs[lHvasEl)et,
  #<f > -1) {
       x le", w     sele '" } textBackg !== 0tructor charlAis.son() pixels)
sharSpacing !== 0

      b'fonaries/contexton gil   /   /l     for / To  for        ing !== 0) {
        return this.fontSi xWidth;
iTffsets.lttDidrawcing / 100idth >r(lineSele '" }function() , chst"b'fonariest"   r
                 SndColor._getsele '" }ight:et   * @pparaswsrtW p: funpig2DC
    Locaon() : funcele '" }Swsrt)= this.widthehtO p: funpig2DC
    Locaon() : funcele '" }EhtigetHeightOfLsnsrt       snsrt.ne number, this.widtheht       eht.ne number     var  var lineTopsnsrt         =heht      sth, lineLeftOfthiss
    for (i ._getHeightOfLine(ctx, i         lineLeftOf
  t, hxo{
  ts = [];

      /*HtoLines(idth     le = this.texte
  
  t, hts = [];

    realLiht / 2,
      b'x  thi   0,am {Number} lineIndex lisene this.wid._teieringsnsrt    t {
        he  var linjrds.length -  thithis._getLinleftOffset(lineWidth);
 ._tej >  snsrt. s[ltextLe +=eie],
 eht     {
 jpacendnes[ltextLirender on
        b'x  thi +is._getHeig
      Cs[lx
  t,ne n[j],s.heji; this.widthMult - 1 + off
 ._tej < snsrt. s[ltextLrender on
        s
    for (+is._getHeig
      Cs[lx
  t,ne n[j],s.heji; this.widthMult - 1 + offlt - 1 + off._tej ring  thithis._render on
      b'x  thi -is._getHeig
      Cs[lis.charSpacing != offlt - 1 + o}              ._teie>Lsnsrt      +=spacend    t {
        heb'x  thi +is._getHeiglineLeftOf
  t, h {
 5eturn;
   }              ._teieringend    t {
        he  var linj2rds.lej2ngth -endnes[ltextL;nj2r<ej2ngt;nj2fset(lineWidth);
 b'x  thi +is._getHeig
      Cs[lx
  t,ne n[j2],s.hej2pacing != offlt - 1 + off._teendnes[ltextL ring  thithis._render on
      b'x  thi -is._getHeig
      Cs[lis.charSpacing != offlt - 1 + o}         realLiht / 2,
     /*HtoLin; this.wid._tetextLines.lengtr<e1 {
 eieringend         elseines.lengtr> 1irender on
    sets[j] ) * =  elseines.lengteturn;
   }                  heightOfLine e b'fonaries.l   eLef
    for = this.width 'fonaries.     ;b'fonaries.     for , this.wid  b'x  thi Index,b'x  thi :  = this.widthretuHvasEl)etneWidth);b'fonaries.     for (+isrealLiht / 2,
troked'overline') > -1) {
         }
      else {
        ctx[metm;
          ing !== 0) {
        return this.fontSize * this.charSpacing / 1000;
       ctx[metm {Nu) {
 tii**
 hnu {
 g / 1000;
      }
      r   g / 1000;
      }
      tTothis._00;
      }
      return 0;this._00;
      }
      es[l  for        idth > 0 ? fiCs[ls    },

   m;
    === ' retu, fctx, lgth)l * umber, xs[l  for r fix Conte._textLinetTopOffset: o render on
          }
   0 ? fiCs[lsFast m;
    === ' retu, fctx, lgt)  his.li      varxs[l  for er  s[l  for e{
        var//ioeea  maxWtm {NuShadow(ctx);fthiss
  HtoLines(idth     le = this.tex
  t,ne number = this.widthprev}ndCot         rn;
  }ndCot         rn, chsTo      ic 'Get   * St) {
        return;   -= sets[j] ) *   elseines.lengtr*tx.fills oLen; ethod, c     var  var lineTop s[l  for length -  thithis._eLecs[l  for      =hineWidth, lineLeftOfprev}ndCoh -prev}ndCoh @param pigCi++) {Cs[lindCo   * umber, i eturn;
    {NuSndColor._getpigCi++) {Cs[lindCo   * umber, i li1)ne this.wid._tex.fillhauSndCoC    */;prev}ndCot  {NuSndCoh {
 ieringinenalSpace = thi  * @p0 ? fiCs[l m;
    === ' retuumber, i idthn, chsTo      , fctx, lgth)l * HvasEl)et,
      rn, chsTo      ic 'Getthis.widthprev}ndColor._ge}ndCoeturn;
   }           chsTo      i+ -  thisWidcs[l  for ]troked'overlin
 h(ctx, this.strokedashArray);
      ct  }
      else {
        ctx[metm;
          ing !== 0) {
        return this.fontSize * this.charSpacing / 1000;
       ctx[metm {Nu) {
 tii**
 hnu {
 g / 1000;
      }
      r    Lar =  ordin -e is text background colo    tTo   ordin -e is texidth > 0 ? fiCs[lsFast    },

   m;
    === ' retu, fctx, lgtr fix Conte._tem;
   f text    
   '     else    x nder on
   {Num instance
 _ontFamCs[ls', m;
    === ' retu, fctx, lgt)  his.li   Conte._tem;
   f text{Canva
   '    ((aram {Canva     else
      // otInd)t @param {kipF   Sn    Checkirender on
   {Num instance
 _ontFamCs[ls', m;
    === ' retu, fctx, lgt)  his.li   ConashArray);
      ct  }
      else {
        ctx[metm;
          ing !== 0) {
        return this.fontSize * this.charSpacing / 1000;
      }
      return 0;this._00;
      }
      i  else {
        ctx[met_cs[lg / 1000;
      }
      r    Lar =  ordin -e is text background colo    tTo   ordin -e is tex0;
      }
      retu.lengtr.lengtr**
 hnu {
 g / 100idth > 0 ? fiCs[l    },

   m;
    === ' retuumber, i,t_cs[l, fctx, lgth)l * HvasEl) filter to cans[l  thihcxs[lHvasEl, sh);
 F   , sh);
 SCanvat           elcllor._getHeigSndCotext to rendl * umber,  hts = [];

  o for ,  1 - 3/16
    ,L  chst"addicharalwidth,t_cs[lft + le  Conte._teelclrticalBox =  s[lHtoLines(idth     le = thiCs[lx
  t,_cs[l, f * umber, i eturn;
   sh);
 SCanvaes(elcle
     eturn;
   sh);
 F   es(elcle    eturn;
    1 - 3/16
    rs(elcle 1 - 3/16
    ett2D} ctx Conte      }

       s[lHtoLines(idth     }
  ;
    li      varsh);
 SCanvaes((sh);
 SCanvae @param {Canva)    m;
   f text{Canva
   ';
n;
   sh);
 F   es((sh);
 F   e @param  ipe)    m;
   f text    
   'le  Conteelcll += wid            varxs[l;
        retu
   *Cs[lindCosG  LeftOf
  t,_cs[l, f * umber, i,eelcll @prope,  return;1 - 3/16
    rs( 1 - 3/16
    r @param  1 - 3/16
    le  Conte._teelcll +=elcle 1 -am {CanvasRenderingContext2  * @p0 movey was .   rett2D} ctx Conte._textLines[lineIndex],
  ringContext2addicharalwidth     return;
      Cs[lis.charSpacing != o charlor_cs[lext(line).acing != o cha  thi   0acing != o  var linjrds.length - charithis._,L  chgetLinleftOffset(lineWidth);}hdth - char[j]etthis.widthsh);
 F   e += wid    
   (cs[l, fctxeLecs[l  thihclgt)  his.li varsh);
 SCanvae += wid Canva
   (cs[l, fctxeLecs[l  thihclgt)  his.li var_ cha  thi    widmeae wi
   (cs[l)ount = liaddicharalwidthet,
      rn, ch  thi +is_ cha  thi Index,_ cha  thi :  eturn;
   }       tx Conte      }

      sh);
 F   e += wid    
   (_cs[l, fctx, lgt eturn;
   sh);
 SCanvae += wid Canva
   (_cs[l, fctx, lgt eturn;
       varpriv 1 - 3/16
    r @pa1 - 3/16
    rthis.' ender on
  o for (i ._getHs oLen; ethod, cex0sets[j] ) *   elseines.lengteturn;
    {Numb0 ? fiCs[l 3/16
    if (thi1 - 3/16
    ,Lfctx, lgth)o for , ns[l  thihcxs[lHvasEl eturn;
       varelcll += widx, this.stroked'o wid xWidhis[(ns[l  thihc0strokedashArray);
      ct  }
      else {
       

      prev}ndCo  else {
       

      ._ge}ndCog / 100idth > hauSndCoC    */   * Return  ev}ndCot  {NuSndCoh nder on
       n  ev}ndCoe te
 !=or._ge}ndCoe te
  @der on
      thprev}ndCoe    }
   !=or._ge}ndCoe    }
    @der on
      thprev}ndCoe 1 -am {CanvasRende !=or._ge}ndCoe 1 -am {CanvasRende  @der on
      thprev}ndCoe 1 - 3/16
    rthis._ge}ndCoe 1 - 3/16
    r @der on
      thprev}ndCoe    ic.isLi!=or._ge}ndCoe    ic.isLi @der on
      thprev}ndCoe    Wfsets.!=or._ge}ndCoe    Wfsets. @der on
      thprev}ndCoe    }ndCol!=or._ge}ndCoe    }ndCoh @der on
      thprev}ndCoe{Canva !=or._ge}ndCoe
     * @der on
      thprev}ndCoe{Canva  thi !=or._ge}ndCoe
     sRendetHeigh*(this.nction() {
      if (this.charSpacing !== 0) {
        return this.fontSize * this.charSpacing / 100idth > 0 ? fiCs[l 3/16
    ily + '" }>';
,ri1 - 3/16
    ,Lfctx, lgth)o for , ns[l  thihcxs[lHvasEl  fix Conte._te!i1 - 3/16
    anvasRenderingContext2D} ctxilter to ca*
     * FWtoLines( s[lHtoLine/ 15= this.widthpm {Canvslornder on
       _thrines:  ToeLecs[lHtoLine/ 1 ts = [];

    'ines- corati':  Toe-ecs[lHtoLine  eHeights oLen; ethod, ce+ ._getHs oLen; j++) {
1hs+ *
     * FWtoLints = [];

    if (ines:  Toe- eHeights oLen; j++) {
Heights oLen; ethod, c)e  cs[lHtoLins = [];

  }t           elc    * F od [' _thrines', 'ines- corati', 'if (ines'], i,eelc16
    le  ConteerTexords.     lelc    * F          sfset(lineWidthd3/16
    rs(elc    * F ++) {
       priv 1 - 3/16
    .inderOf(d3/16
    an> -1et(lineWidth);}        heigfctx, pm {Canvs[d3/16
    ], ns[l  thi , *
     * FWtoLin (this.__is {
        worashArray);
      ct  }
      else {
        ctx[metm;
          ing !== 0) {
        return this.fontSize * this.charSpacing / 1000;
       ctx[metm {Ng / 1000;
      }
      r    is text background colo   g / 1000;
      }
      return 0;this._0idth > 0 ? fiTeIndex     },

   m;
    === ' retu, fctx, lgth)l * umber*
     * @Nums.c"csersl"(idth     }
   subtthod, ceisod,
      NU# 0 ? fiTeIndex     * @Numshs addndex0.03i   h = n ("alig  *ereton giipres by if (iap *estx Conte._te!itLinetTopOffset: o render on
       chidth     }
     eHeights oLen; ethod, ce+ 0.03rett2D} ctx Conte {Num instance
 _ontFamTeIndex ', m;
    === ' retu, fctx, lgtt,is._textLine worashArray);
      ct  }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100idth > 0 ? fiT1 -idth : 0;
    },

    /**
     * @._textLinetTopOffset: o render on
          }
   instance
 _ontFamTeInidth : 0;
' === h  return   worashArray);
      ct  }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100idth > 0 ? fiT1 -dex lam {Canvas    },

    /**
     * @priva instance
 _ontFamT1 -dex lam {Canvas' === h  ilter to cais._TTo  for  i  =InvasElhis.te= this.widthretu  thihcs
        for = this.widthr     for (i te
      ltOfLine(ctx= this.width To  for  i x.fillStyis._getLine,
this.widthretut,_cs[l, sndCoet  ConteerTextComeTopOlength -er} lineIndex l         s  lineWidth, lineLeftOfnvasElhis.tees(idth     le = this.tex
  t,i eturn;
   m {Number} lineIndex lisene this.wid._tem {Numhis.'oonsate
  saet: oonsate
      lineSwet:diirender on
    setsT    for (+isnvasElhis.teet,
      rn,e *inuoeturn;
   } turn;
   m {N;
        retueiglineLeftOf
  t, heturn;
   m {N      for (i ._getHeightOfLine(ctx, im {N;
   )ne this.wid  var linjrds.lejngth -  thithis._getLinjleftOffset(lineWidth);sndColor._getHeigSndCotext to rend.heji; this.width._te!'aet:oons!sndCoe 1 -am {CanvasRenderender on
      ,e *inuoeturn;
   fflt - 1 + off_}hdth -ne n[j]ne this.width        SndColorsndCoe 1 -am {CanvasRendene this.width         heightOfLine e hei     for (+ m {N      for (+   return;
      Cs[lsAtf
  t, hejigetHeightOfLfLrip  for (+ m {NT    for , this.wid      return;
      Cs[lf
  t,_cs[l,  hejigetHeightOfLfLnvasElhis.tee._textLines.lengt this.widthe / this.li      thissetsT    for (+isnvasElhis.teet,
       worashArray);
      ct  }
      else /
    _eig[ */
ceCl    },

   _cs[l, sndCotext to renh nder on
       _}hdth+der on
      tsndCotext to ren     }
   +der on
      tsndCotext to ren     WtoLine+der on
      tsndCotext to ren     }ndCoeturn;ashArray);
      ct  }
      else {
        ctx[met    ic.isLi},

  else {
    0,



      refeontcittDi a*/
  else /
    _eigF oLgn === 'right')     ic.isL{
      reprivad,
    ns[l  thisgn ==[    ic.isLe;
        red,
    ns[l  thisgn ==[    ic.isLe    r}  returntx Conte) {
   d,
    ns[l  thisgn ==[    ic.isLene worashArray);
      ct  }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100{
        ctx[met_cs[lg / 1000;
      }
      return 0;this._00;
      }
      es[lrn 0;this._00;
      default
 elcl]  else /
    _
   *Cs[lindCosG  LeftOily + '" }>';
,r_cs[l, f * umber, es[ltextL, elclrticalBox o cans[lDlcllorelcll @p._getHeigSndCotext to rendl * umber, xs[ltextL_getHeightOfLsndCotext to renes( ldefnns[lDlcl_getHeightOfLs[lineIc */
ceCl, ns[l  this  */
 x    * @priva_
   *F   }ndCos(sndCotext to renhtroked'o s[l  this  */
lor._getHeigF oLgn ==(sndCotext to rene    ic.isLhtroked'o  */
ceCl if._getHeig[ */
ceCl _cs[l, sndCotext to renh      var//iohort-circuit
prioffset
est   rthit
       _getNumglobal;sndColam {Nistory it
alwayt
a   *ed
rnd hrndl _r Ins vnurndigh this     reprivans[lDlcll += s[l  thisgn ==[  */
ceCl]     else}
unlt.render on
          s[l  thisgn ==[  */
ceCl]eturn;
       varpriv */
  fcndCotext to renes was f text{Calt.wi{
         cndCotext to renes was f ('urate} Insy was .cndCotext to renes was  eturn;
       varo caf   es(sndCotext to rene    e @param  ipetroked'o wid    SndColor    .toLive         ?r    .toLiveif (this.sr this.wid:  ipetr    varprivcndCotext to renesCanva)  }

       wid CanvaSndColorvcndCotext to renesCanval +=sndCotext to renesCanva.toLiver this.width?=sndCotext to renesCanva.toLiveif (this.sr this.widid: sndCotext to renesCanva  his.li      varxwidm {N;
      sndCotext to renesCanva // ot @param {CanvasRendtroked'o wid ontlor._getHeigF oLtext to rene ins(sndCotext to renhtr   _getNupriw
 watie _getHs  S was e insis.c @pkton gisndCotext t" } textBtNuw
 h vnu ("adde _ose refeontcis    varprivcndCotext to renes was  {
         cndCotext to renes ineX ze elses ineX;         cndCotext to renes ineY ze elses ineY;         cndCotext to reneering}    else}
    ;         cndCotext to reneeigdefaulS inndexor._getpigdefaulS inndeeturn;
    {Numbs  S was e insvcndCotext to ren === h  return  x Conte._te!itLin}
unlt.oons! s[l  thisgn ==[  */
ceCl] {
         w thi    widmeae wi
   (_cs[l)ount =eturn;
    {Num}
unlt.o   ( s[l  thisgn ==[  */
ceCl] = w thie / this.li       unt =eturn;
   x Conte        s[l  thisgn ==[  */
ceCl]eturn;ashArray);
      ct  }
      else {
       

      cndCotext to ren  else /
    _
   *F   }ndCosfunction() owet:text to renh nder on
._te!'aet:text to rene    ic.isLh{
         cndCotext to rene    ic.isLichidth     ic.isLett2D} ctx Conte._te!'aet:text to rene    }
  h{
         cndCotext to rene    }
   = idth     }
  ;
    li   Conte._te!'aet:text to rene    WvasEl) filter t tsndCotext to ren     WtoLine= idth     W/ 2,
troked'overlinte._te!'aet:text to rene    }ndCoh nder on
 tsndCotext to ren     }ndCo = idth     }ndCoeturn;
    worashArray);
      ct        }
      return 0;this._00;
      }
      es[lrn 0;this._00;
      Boop] n}r[      CldefOrTopOf=d_sho]      ct  }
      else /
    _eigSndCotext to ren  ivate
     * umber, xs[ltextL,       CldefOrTopOfh nder on
._te      CldefOrTopOfh nder on
n
       nte
  saet: ine number
     else
 et: ine number
[xs[ltextL]r this.width?= ldefn else
 et: ine number
[xs[ltextL]r this.width:  r}  returntxx Conte       te
  saet: ine number
     else
 et: ine number
[xs[ltextL]h? ._get
 et: ine number
[xs[ltextL]h:rropeeturn;ashArray);
      ct        }
      return 0;this._00;
      }
      es[lrn 0;this._00;
      default
sndCo  else {
 rivate
     */
    _cegSndCotext to ren  ivate
     * umber, xs[ltextL, sndCoh nder on
._get
 et: ine number
[xs[ltextL]h= sndCoeturn;ashArray);
      c      ct        }
      return 0;this._00;
      }
      es[lrn 0;this._00;
rivate
     */
    _elleenSndCotext to ren  ivate
     * umber, xs[ltextLh nder on
elleen
._get
 et: ine number
[xs[ltextL]eturn;ashArray);
      ct        }
      return 0;this._00;
}
      else /
    _eiglineSwet:  ivate
     * umberh nder on
       ._get
 et: ine number
eturn;ashArray);
      ct        }
      return 0;this._00;
      default
sndCo  else {
 rivate
     */
    _ceglineSwet:  ivate
     * umber, sndCoh nder on
._get
 et: ine number
h= sndCoeturn;ashArray);
      ct        }
      return 0;this._00;
}
      else /
    _elleenlineSwet:  ivate
     * umberh nder on
elleen
._get
 et: ine number
ne worashArray);
      ct  }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100idth > rn;
      Cs[lily + '" }>';
,r_cs[l, f * umber, es[ltextL{
      reprivate
  _isMeae wlt.o   aram  1 -Alig   texth = ify'     else_rewidthsAndTabm  1s (_cs[l)render on
          }
   rn;
      widthx
  t,ne number troked'overlin
 h(ct        returnthisvar width, wou
   *Cs[lindCosG  LeftOf
  t,_cs[l, f * umber, es[ltextL{;     reprivxtLines[lineIndex],
  ringContext2w thi +is._getHeig
      Cs[lis.charSpacing !== 0) {
  widx, this.stroked'o       unt = Index,w thi :  e worashArray);
      ct  }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100t        }
      return 0;this._00;
      }
      es[lrn 0;this._0idth > rn;le = thiCs[lily + '" }>';
,rf * umber, es[ltextL{
      re ConsndColor._getHeigSndCotext to rendl * umber, xs[ltextLfet  * @p) {
   sndCol +=sndCoe    }
   ?=sndCoe    }
   :param     }
  ;
    },

    /**
     *   }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100t        }
      return 0;this._00;
      }
      es[lrn 0;this._0idth > rn;
      Cs[lsAtily + '" }>';
,rf * umber, es[ltextL{
      re Convar widt0, i,t_cs[let  * @perTexords.     les[ltextLWidth, lineLeftOf_}hdth -er} lineIndex line number
[+) {
       w thi +is._getHeig
      Cs[lx
  t,_cs[l, f * umber, i eturn;
 }roked'o       unt =;
    },

    /**
     *   }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100t        }
      return 0;im {Nu,

   g / 100t     0,

}
      s.teewRendetHeig0idth > meae widex     },

   
  t,is._textLisnder on
._get_isMeae wlt.o   ction() {
 thisvar width, wourn;
      Cs[lsAtf
  t,f * umber, er} lineIndex line number
/= 0, wobereturnprivxtLines[lineIndex],
  ringContext2w thi -is._getHeig
      Cs[lis.charSpacing !== 0) {
 ._get_isMeae wlt.o  d_shouldClear       unt = Index,w thi :  ;
    },

    /**
     *   }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100t        }
      return 0;this._0idth > rn;
      width:   },

    
  t,is._textLisnder on
._tex.fill_w      widthine number
render on
          }
   _w      widthine number
acing !== 0) {
 o cais._h -er} lineIndex line number
getHeightOfLsords;
        retueig
      Words 
  t,is._t,f * umber, 0_getHeightOfLs[linDiffidth, wount = -Lsords;
   getHeightOfL,

widthsh -  thithis._e--  thirepldthx else_rewidthsAndTabm,s.' ithis._,etHeightOfLs[lin = Math.max s[linDiffi/L,

widths,  widmeae wi
   (' ')ount =   return;
    _w      widthine number
h= unt =eturn;
        unt =;
    },

    /**
     *   }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100t         ctx[metm {Ng / 1000;
      }
      return 0;this._00;
      }
      es[l  for        idth > eig
      Words:   },

    
  t,is._h)l * umber, xs[l  for r fi() {
 thisvar widt0et  ConteerTextComes[ltextLrds.  es[ltextLr<-  thithis._gees[ltextLth, lineLeftOfthis_}hdth -ne n[xs[ltextL]etineLeftOfpriva_cs[lematch(/\s/irender on
    w thi +is._getHeig
      Cs[lx
  t,_cs[l, f * umber, es[ltextLrLecs[l  for  (this.__is {
       turn;
        unt =;
    },

    /**
     *   }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100idth > rn;le = thidex     },

   
  t,is._textLisnder on
._tex.fill_ines.lengtsine number
render on
          }
   _ines.lengtsine number
eturn;
       varo cais._h -er} lineIndex line number
getHeightOfLmaxHtoLines(idth     le = thiCs[lx
  t,f * umber, 0_et  ConteerTextComeTop1length -  thithis._ges  lineWidth, lineLeftOfthis 
 +) {Cs[lHtoLines(idth     le = thiCs[lx
  t,f * umber,  heturn;
   0.85 
 +) {Cs[lHtoLine>LmaxHtoLinrender on
    maxHtoLines( 
 +) {Cs[lHtoLin(this.__is {
        wor   }
   _ines.lengtsine number
es(maxHtoLine*  elseines.lengtr*tx.fills oLen; j++)eturn;
         }
   _ines.lengtsine number
eturn;},

    /**
     *   }
      else {
       ) {
        return this.fontSize * this.charSpacing / 100idth > rn;
   Hfsets:n  },

    /**
     * @thiss
  HtoLin, ntoLines( eturn;
 erTextComeTopOlength -er} lineIndex l         s  lineWidth, lineLeftOfines.lengtrs(idth     le = this.tex
  t,i eturn;
   / 2;
  l= eieringngth- 1ex,iits[j] ) *   elseines.lengtr:)l * HvasEl)et,
    }roked'o       htoLin(this.},

    /**
     * x !== daistory ght = this._gei**
aceisstsers  else {
m;
   ftoOring} textBackg !== 0tructor[* BackgrouToI{clude] Any p Background},

you mengtrwatie oiaddicharallyei{clude= falseroutpu*/
    _t     0,



      istory ght = this._gei**
aceisstsers  else idth >toOring}   * Return  maxWirouToI{cludeh nder on
        */
    _iniacing:.eextAl(te
   instance
 toOring}',   maxWirouToI{cludeh, nder on
 tsndCos:  ldefn else
 et: ,  ctir this.w}strokeda
.w}str
  /**
   * x !== da    /**I
   eisstserslam {Nan istory ght = this._ge
   * @sis._c
lse {
m;    Ofa    /**I
   
xtBackg !== 0

      istory contexttDi reis[Saceisstserslam {
xtBackg !== 0 * Returor[ insback]eisvokedton gi'uraisstserslas aDguatur
   _t     0,

    /**I
     isstserslofa    /**I
   
xtBaidth    /**I
   .am {context=  * ReturnistoryeIc nsbackh nder otCome
   e ('urate} InsI
   nistory. 1 -t  ldefnistory r  retuc nsbackl +=  nsback(e
   r  retu    0,
e
     re};
})     
(nction() {
  
Ofthis ldefo  d_/
    _iniacing:. ldeftr
   */
    _iniacing:.eextAl(    /**I
   .  mto */
, /** @ngtdda    /**I
   .  mto */
Bai fix Con/**
     * Inichaln; t
allalseri * rhod,v:obehavi  rnf I
   
xtBse idth >inicBehavi  = 'right') {
        returinicAddedHrndl r(h  return;
   inicR movedHrndl r(h  return;
   inicC
    Sele '" }Hrndl rs(h  return;
   inicDoubleClickSimuhisi }.strokedrn;
   mouseMoveHrndl rrs(idth mouseMoveHrndl r.biAl(te
 ine worashArray);
      ctInichaln; t
"cele 'ed" eve t hrndl r
xtBse idth >inicSele 'edHrndl r= 'right') {
        retur') 'cele 'ed', nction() {
  
Of   * @this_thit
s(idth;         cn;
imeout('right') {
            _ else
ele 'edo   ction() {
 oras 10umbereturn}strokedashArray);
      ctInichaln; t
"added" eve t hrndl r
xtBse idth >inicAddedHrndl r= 'right') {
        this_thit
s(idth;       retur') 'added', nction() {
  Of   * @thisering}   _ else}
    ;         0.85 
    {
            privan
    . hauI
   Hrndl rsrender on
      ,
    . hauI
   Hrndl rso   ction() {
 or    _ else_inicC
    Hrndl rs( 
    {on() {
 or  lt - 1 + off,
    . e
   Isstsersso  ,
    . e
   Isstsersso|| [) {
       ff,
    . e
   Isstserssyis al_te
 ine woror  lt - 1 +}strokedashArrayinicR movedHrndl r= 'right') {
        this_thit
s(idth;       retur') '0 moved', nction() {
  Of   * @thisering}   _ else}
    ;         0.85 
    {
            ,
    . e
   Isstsersso  ,
    . e
   Isstsersso|| [) {
       ff */
    _ini0 moveFm {truct(,
    . e
   Isstserss, _te
 ine woror    0.85 
    . e
   Isstserssys._getW =  0render on
      ,
    . hauI
   Hrndl rso  d_shouldClearor    _ else_0 moveC
    Hrndl rs( 
    {on() {
 or  lt - 1 + olt - 1 +}strokedashArray);
      ctregiss)
L ring} eve t tDimanage
exitren  } olser isstserssharSpacing}
      else /
    _inicC
    Hrndl rs:n  },

    
    {
        ,
    . ,
    I
   Sele '" }e
   edHrnl   ic ('right') {
              /**I
   .  mto */
.exitE.splt.OnOlsers( 
    {on() {
 }).biAl(te
 ine wor  ,
    . mouseUpI
   Hrndl ric ('right') {
          0.85 
    . e
   Isstserss{
            ,
    . e
   Isstserss.erTEach( * Returnistrender on
      isttH_isMousedowno  d_shouldClearor  }ine woror  lt - 1 +}s.biAl(te
 ine wor  ,
    .') 'cele 'ren c
   ed' ==
    . ,
    I
   Sele '" }e
   edHrnl   ine wor  ,
    .') 'acing::cele 'ed', =
    . ,
    I
   Sele '" }e
   edHrnl   ine wor  ,
    .') 'mouse:up', =
    . mouseUpI
   Hrndl rstrokedashArray);
      ctremoveL ring} eve t tDimanage
exitren  } olser isstserssharSpacing}
      else /
    _0 moveC
    Hrndl rs:n  },

    
    {
        ,
    .off 'cele 'ren c
   ed' ==
    . ,
    I
   Sele '" }e
   edHrnl   ine wor  ,
    .'ff 'acing::cele 'ed', =
    . ,
    I
   Sele '" }e
   edHrnl   ine wor  ,
    .'ff 'mouse:up', =
    . mouseUpI
   Hrndl rstrokedashArray);
      ctng}
      else /
    _._ck= 'right') {
        returexi++) {TickStis[Sdth, wou
nimrae[
    (h, w,p1le else}
    Duto ren ='_onTickC * @ren'strokedashArray);
      ctng}
      else /
    _
nimrae[
    :  * Returnistle aDget Contex, duto ren =  * @renM;
   r
         thistickStis[ x    * @pickStis[Sdt          0sAbort*/   _shogetHeightOabort= 'right') {
            retur0sAbort*/o   ction() {
 orast - 1 +} x    * @istt
nimrae('exi++) {C
     Contex'le aDget Contex,           duto ren: duto ren           }ig* @ren= 'right') {
            privatickStis[r0sAbort*/render on
      ist[  * @renM;
   ]Spacing != offlt - 1 + o}           }i    *= 'right') {
            Numws doscreewatie oianimrae a sele '" },  }lyw}
    harSpa     privisttering}    isttcele '" }SwsrtW =  isttcele '" }Ehti{
          * @isttr(line[
    OrSele '" }.stroked!= offlt - 1 + o}          abort= 'right') {
                    ickStis[r0sAbort*/ne woror  lt - 1 +}stroked          ickStis[trokedashArray);
      ctng}
      else /
    _onTickC * @ren: nction() {
  
Of   *this_thit
s(idth; 
a     privreturexi+   
imeout1et(lineWidth}
   
imeout(returexi+   
imeout1eacing !== 0) {
 ._get_xi+   
imeout1h= sn;
imeout('right') {
          _returexi++) {TickC * @renStis[Sdt_h, wou
nimrae[
    (_h, w,p0le else}
    Duto ren   }io'_._ck).acing !=as 10umberetuashArray);
      ctInichaln; t
dela*ed
}
    harSpacidth >inicDela*ed[
    :  * Returnx, tsrtndex] = -1this_thit
s(idtht           ella* = x, tsrtW? 0 :  else}
    Dlla* x    * @privaabort[
    Animrai }.strokedrn;
   exi++) {C
     ContexTop1trokedrn;
   exi+   
imeout2h= sn;
imeout('right') {
          _reture._ck(.acing !=as ella*mberetuashArray);
      ctAbortda 
    ranimrai }
rnd x
   t
allalimeouts        * retabort[
    Animrai }= 'right') {
        thissh);
 e
   Sdth, wouxi++) {TickStis[S @p._getHxi++) {TickC * @renStis[trokedrn;
   exi++) {TickStis[S    else_xi++) {TickStis[aabort.strokedrn;
   exi++) {TickC * @renStis[S    else_xi++) {TickC * @renStis[aabort.stre wor  ,
   
imeout(returexi+   
imeout1eacing !=,
   
imeout(returexi+   
imeout2) x    * @priva_xi++) {C
     ContexTop eturn;
 Nums.c,
    h = nipres   eamws nee ftoi xWidth;
alserfsets.lturn;
 NumitimayscreebeLsor giip
a     privsh);
 e
   render on
   {Num iing}     else}
    .}
   ze * th( else}
    .}  * this.S @p._get== h  return  x ConashArray);
      ctSele 'sfeyler
)pres        * retcele 'A    'right') {
        returcele '" }SwsrtW p0;       returcele '" }EhtO p: funpres,
          varx.fillser
Sele '" }e    */;strokedrn;
   eupdis[
     ea.strokedashArray);
      ctx !== da
ele 'edopres       0;    0,

 ctx[me        * reteigSele 'ed
     'right') {
                }
  pres,slithx elsecele '" }Swsrt, returcele '" }EhtstrokedashArray);
      ctFiAl('urasele '" } inder ght = thiren  tsrtWher}
 +) { sord accordingms.c,i++) { sele '" } inderath();
0;
      }
       tsrtFm { Si++) { sele '" } inderath();
0;    0,

}
      Nurasele '" } inder        * retfindWordB'fonary    :dnction() owsrtFm {{
        thiso for  i  =IiextLrds tsrtFm { -p1trturn;
 NumremoveLsidth beth;ea 
    rserstx Conte._te else_rewidth  1s ( }
  pres,cs[lAt(iextL)irender on
  whilete else_rewidth  1s ( }
  pres,cs[lAt(iextL)irender on
    o for ++; this.widthiextL--(this.__is {
        wor  whilete/\S/  1s ( }
  pres,cs[lAt(iextL)i  +=sextLr> -1et(lineWidtho for ++; this.widiextL--(this.__  turn;
         tsrtFm { -po for trokedashArray);
      ctFiAl('urasele '" } inder ght = thiren ehtOher}
 +) { sord accordingms.c,i++) { sele '" } inderath();
0;
      }
       tsrtFm { Ci++) { sele '" } inderath();
0;    0,

}
      Nurasele '" } inder        * retfindWordB'fonaryRsets:n  },

   owsrtFm {{
        thiso for  i  =IiextLrds tsrtFm {trturn;
 NumremoveLsidth afs)
L 
    rserstx Conte._te else_rewidth  1s ( }
  pres,cs[lAt(iextL)irender on
  whilete else_rewidth  1s ( }
  pres,cs[lAt(iextL)irender on
    o for ++; this.widthiextL++; this.wid}e
        wor  whilete/\S/  1s ( }
  pres,cs[lAt(iextL)i  +=sextLr<p: funpres,
     et(lineWidtho for ++; this.widiextL++; this.w  turn;
         tsrtFm { +po for trokedashArray);
      ctFiAl('urasele '" } inder ght = thiren  tsrtWher}
 +) { is._haccordingms.c,i++) { sele '" } inderath();
0;
      }
       tsrtFm { Ci++) { sele '" } inderath();
0;    0,

}
      Nurasele '" } inder        * retfinds.teB'fonary    :dnction() owsrtFm {{
        thiso for  i  =IiextLrds tsrtFm { -p1trturn;
 whilete!/\n/  1s ( }
  pres,cs[lAt(iextL)i  +=sextLr> -1et(lineWidtho for ++; this.widiextL--(this.__  turn;
         tsrtFm { -po for trokedashArray);
      ctFiAl('urasele '" } inder ght = thiren ehtOher}
 +) { is._haccordingms.c,i++) { sele '" } inderath();
0;
      }
       tsrtFm { Ci++) { sele '" } inderath();
0;    0,

}
      Nurasele '" } inder        * retfinds.teB'fonaryRsets:n  },

   owsrtFm {{
        thiso for  i  =IiextLrds tsrtFm {trturn;
 whilete!/\n/  1s ( }
  pres,cs[lAt(iextL)i  +=sextLr<p: funpres,
     et(lineWidtho for ++; this.widiextL++; this.w  turn;
         tsrtFm { +po for trokedashArray);
      ctx !== da,

   Oher'uris._s= fa
ele 'edopres       0;    0,

}
      N

   Oher'uris._s= fa
ele 'edopres        * reteigN

Nurdex lInSele 'ed
     'right') {
        thissele 'ed
   xor._getpigSele 'ed
   ne,
this.widthn

Nurdex l idt0et  ConteerTextComeTopOlength -sele 'ed
            s  lineWidth, lineLeftOfprivsele 'ed
   iseW =  .\n't {
        hen

Nurdex l++; this.wid}e
        wor      0,
n

Nurdex ltrokedashArray);
      ctFiAls=sextLrcor = pondingms.cbeginnren  r ehtOhera sordath();
0;
      }
       ele '" }SwsrtWtextLrhera cs[lels)
ath();
0;
      }
      der
 '" } 1  r -1       0;    0,

}
      textLrherlserbeginnren  r ehtOhera sordath();
 * retcearchWordB'fonary:n  },

   oele '" }Swsrt, der
 '" }{
        thissextLrrrrrdth, wourewidth  1s ( }
  pres,cs[lAt(cele '" }Swsrt)) ?=sele '" }SwsrtW- 1 :noele '" }Swsrt,
        he_}hdthrrrrdth, wopres,cs[lAt(iextL),
        hereNonWordrdt/[ \n\.,;!\?\-]/trturn;
 whilete!reNonWord  1s (_cs[l)  +=sextLr> 0  +=sextLr<p: funpres,
     et(lineWidthsextLr+= der
 '" }; this.wid_}hdth -er} lpres,cs[lAt(iextL)acing !== 0) {
 ._te  NonWord  1s (_cs[l)  +=_}hdth!=  .\n't {
        sextLr+= der
 '" }W =  1W? 0 : 1acing !== 0) {
     0,
eextLWx ConashArray);
      ctSele 'sfa sord basedoonalseri derath();
0;
      }
       ele '" }SwsrtWtextLrhera cs[lels)
ath();
 * retcele 'Word:n  },

   oele '" }Swsrtt {
      cele '" }SwsrtW pcele '" }SwsrtW @param {ele '" }Swsrt        this'urSele '" }SwsrtW param {earchWordB'fonary oele '" }Swsrt, -1e, /*tcearch backwarls=
 * rettttttt'urSele '" }EhtO p: fun{earchWordB'fonary oele '" }Swsrt, 1); /*tcearch erTwarl=
 *       returcele '" }SwsrtW p'urSele '" }Swsrt;       returcele '" }EhtO p'urSele '" }Eht     varx.fillser
Sele '" }e    */;strokedrn;
   eupdis[
     ea.strokedrn;
   r(line[
    OrSele '" }.strokedashArray);
      ctSele 'sfa is._hbasedoonalseri derath();
0;
      }
       ele '" }SwsrtWtextLrhera cs[lels)
ath();
 * retcele 'dex     },

   oele '" }Swsrtt {
      cele '" }SwsrtW pcele '" }SwsrtW @param {ele '" }Swsrt        this'urSele '" }SwsrtW param finds.teB'fonary     oele '" }Swsrtt,* rettttttt'urSele '" }EhtO p: funfinds.teB'fonaryRsets oele '" }Swsrtt;*       returcele '" }SwsrtW p'urSele '" }Swsrt;       returcele '" }EhtO p'urSele '" }Eht     varx.fillser
Sele '" }e    */;strokedrn;
   eupdis[
     ea.strokedashArray);
      ctE * rs e.splt.  tst
  else {
    0,

    /**I
     ;
  Arg  else {
cs[inabCog / 100idth >e * rE.splt.    },

   eh nder on
._textLinetT.splt. onsate
  e.spabCoanvasRenderingContext2D} ctxilter tprivxtLine
    {
          te
  exitE.splt.OnOlsers(xtLine
    {ext2D} ctxilter txtLinetT.splt.    ctionilter txtLinenitHidden
     ea.estrokedrn;
   hidden
     ea.focus(h  return;
   eupdis[
     ea.strokedrn;
   _    T.splt.ceCls(h  return;
   eor T.splt.ceCls(h  return;
   e 1 -aeth;eT.sph -er} lpres x    * @priva_._ck(.acing !=: funfire('e.splt.:e * red'); 
a     priv!xtLine
    {
                  }
 acing !== 0) {
 ._get}
    .fire('pres:e.splt.:e * red', {e aDget:  els+}stroked  xtLinenitMouseMoveHrndl r(.acing !=: fun}
    .r(lineAll.stroked'o        }
 acing ashArrayexitE.splt.OnOlsers:n  },

    
    {
        0.85 
    . e
   Isstserss{
          ,
    . e
   Isstserss.erTEach( * Returnistrender on
    isttcele '*/o  d_shouldClearor  privisttetT.splt.i{
          * @isttexitE.splt..stroked!= offlt - 1 + o}h  return   worashArray);
      ctInichaln; t
"mousemove" eve t hrndl r
xtBse idth >inicMouseMoveHrndl r  'right') {
        retur,
    .') 'mouse:move',(idth mouseMoveHrndl rstrokedashArray);
      ctng}
      else /
    mouseMoveHrndl r:  * Returnipetur {
        0.85ate
  __isMousedownoonsate
  etT.splt.i{
         ngContext2D} ctxilter to ca'urSele '" }SwsrtW param pigSele '" }SwsrtFm {Poi * rnipetur .et,* rettttttt,i++) {SwsrtW param {ele '" }Swsrt,
        he,i++) {EhtO p: fun{ele '" }Eht     var0.85'urSele '" }SwsrtW =dth, wou_{ele '" }SwsrtOnMouseDowni{
         ngContext2D} ctx   var0.85'urSele '" }SwsrtW>th, wou_{ele '" }SwsrtOnMouseDowni{
         returcele '" }SwsrtW ph, wou_{ele '" }SwsrtOnMouseDown;         returcele '" }EhtO p'urSele '" }Swsrt;       tx Conte      }

      returcele '" }SwsrtW p'urSele '" }Swsrt;         returcele '" }EhtO p: funu_{ele '" }SwsrtOnMouseDown;       tx Conte._textLincele '" }SwsrtW!=  ,i++) {SwsrtW @param {ele '" }EhtO!=  ,i++) {Ehti{
         x.fillser
Sele '" }e    */;strokedrnrn;
   eupdis[
     ea.strokedrnrn;
   r(line[
    OrSele '" }.stroked     worashArray);
      ct  }
      else /
    _or T.splt.ceCls  'right') {
        returhif ([
    O p'pres'; 
a     privreture
    {
          te
  ,
    .default[
    O pte
  ,
    .moveC
    O p'pres'; oked           returbord ([ende  pte
  e.splt.Bord ([ende x    * @privahasze *rolsO p: fun{ele 'abCoo  d_shouldClear: funlockMoveaturX ze elselockMoveaturYo   ction() {ashArray);
      ct  }
      else /
    _updis[
     ea  'right') {
        0.85ate
  hidden
     eaW @param i}ig* m {CanvModoanvasRenderingContext2D} ctx      te
  ,
    O for   */
lor r}  return;
   hidden
     ea.valueh -er} lpres xreturn;
   hidden
     ea.cele '" }SwsrtW ph, wo{ele '" }Swsrt        ;
   hidden
     ea.cele '" }EhtO p: fun{ele '" }Eht     var0.85returcele '" }SwsrtW = p: fun{ele '" }Eht{
  Of   * @thissndColor._getHcalc
     eaPm {Canv.strokedrnrn;
   hidden
     ea.cndCoefctxeorsndCoefctxtrokedrnrn;
   hidden
     ea.cndCoetCl ifcndCoetCltrokedrnrn;
   hidden
     ea.cndCoe    }
   = cndCoe    }
  troked     worashArray);
      ct  }
      else t     0,



      sndCol}  *[ins;sndColade hidden
     ea  else /
    _calc
     eaPm {Canv  'right') {
        0.85ate
  e
    {
                 { x:p1ley:p1r}  returntx ContetComes[lsh -er} lpresext(line).= this.width 'fonariesrs(idth     C
    B'fonaries( s[lm,s.,
    't,* rettttttt,i+   Loc
    rs( ram pig2DCi+   Loc
    ne,
this.widthretutextLrds,i+   Loc
    .f * umber,* rettttttt,s[ltextLrds,i+   Loc
    .xs[ltextL,* rettttttt,s[l.lengtrs(idth pigCi++) {Cs[lF   }
  dl * umber, xs[ltextL_getHeightOfLr     for (i (retutextLrd=  0l += s[ltextLrd=  0r this.widthhhhhhhhhhh?(idth     htOfLine(ctx, iidth     htOfLeftOf._get== t,is._textLir this.widthhhhhhhhhhh:h 'fonaries.l     for = this.widthmO pte
  ,
lc
xWidth;
Matrixne,
this.widthp ornder on
      x:h 'fonaries.l   (+ m     for = this.width ey:p 'fonaries. ToeLe 'fonaries. To  for (+ cs[lHtoLins = [];

  }t           upp ([ring}    else}
    .upp ([ring}ElgetHeightOfLmax;
      upp ([ring}ount = -Lcs[lHtoLingetHeightOfLmaxHtoLines(upp ([ring}o/ 2;
  -Lcs[lHtoLin x    * @po  d_/
    _ini xWidth;
Poi *(p, mstrokedrnpo  d_/
    _ini xWidth;
Poi *(p,  else}
    .viewport
xWidth;
); 
a     privp.Lr<p0render on
  p.Lr p0;       }
a     privp.Lr>Lmax;
   render on
  p.Lr pmax;
   ;       }
a     privp.yr<p0render on
  p.yr p0;       }
a     privp.ye>LmaxHtoLinrender on
  p.yr pmaxHtoLin; oked           //"adde iing} o for    rdocuatur
   
  p.Lr+   else}
    ._o for efctxtrokedrnp.yr+   else}
    ._o for etCltrroked'o       { m   : p.Lr+ 'px', lgt:np.yr+ 'px',     }
  :t,s[l.lengtr}on() {ashArray);
      ct  }
      else /
    _    T.splt.ceCls= 'right') {
        reture    dceCls ornder on
  hasze *rols:@privahasze *rolsgetHeightObord ([ende: returbord ([endegetHeightOlockMoveaturX:r: funlockMoveaturXgetHeightOlockMoveaturY:r: funlockMoveaturYgetHeightOhif ([
    :@privahif ([
    getHeightOdefault[
    :  else}
         else}
    .default[
    getHeightOmoveC
    :  else}
         else}
    .moveC
     oked   on() {ashArray);
      ct  }
      else /
    _x, thisT.splt.ceCls= 'right') {
        0.85ate
  _    dceClsi{
         ngContext2D} ctxilter treturhif ([
    O pte
  _    dceCls.if ([
            ;
   hasze *rolsO p: fun_    dceCls.hasze *rols        ;
   bord ([ende  pte
  _    dceCls.bord ([ende x      ;
   lockMoveaturX ze else_    dceCls.lockMoveaturX x      ;
   lockMoveaturY ze else_    dceCls.lockMoveaturY; 
a     privreture
    {
          te
  ,
    .default[
    O pte
  _    dceCls.default[
    ;         te
  ,
    .moveC
    O pte
  _    dceCls.moveC
    troked     worashArray);
      ctExitslam {Ne.splt.  tst
  else {
    0,

    /**I
     ;
  Arg  else {
cs[inabCog / 100idth >exitE.splt.  'right') {
        thisis
   e    */(i (;
   e 1 -aeth;eT.sph!=or._gelpres.acing !=: funcele '*/o  d_shouldClearxtLinetT.splt.   d_shouldClearxtLin{ele 'abCoo   ctionilter txtLincele '" }EhtO p: fun{ele '" }Swsrt        ;
   hidden
     ea     else}
         elsehidden
     ea.pa+) {Nodoi0 moveChill(te
  hidden
     eastrokedrn;
   hidden
     eaW p'upetr    var;
   abort[
    Animrai }.strokedrn;
   ex, thisT.splt.ceCls.strokedrn;
   exi++) {C
     ContexTop0tr    var;
   fire('e.splt.:exited'); a     ps
   e    */(    elsefire('modified'); a     privreture
    {
          te
  ,
    .'ff 'mouse:move',(idth mouseMoveHrndl rstroked    te
  ,
    .fire('pres:e.splt.:exited', {e aDget:  els+}stroked    ps
   e    */(    else,
    .fire('acing::modified', {e aDget:  els+}stroked  txx Conte       te
 on() {ashArray);
      ct  }
      else /
    _x,moveEx xWieous}ndCosfunction() {
        erTextCom  ma= falsise
 et: , lineLeftOfpriv!;
   e 1 -dex lipeCl] {
         n
elleen
._get
 et: ipeCl]eturn;
 id}e
        worashArray);
      ct  }
      else /
    _x,moveCs[lsFm {To:n  },

   owsrt, eht {
       whileteehtO!=   tsrtndex] = -1t2  * @p0 moveylt.CoC   AndSwet:d tsrtW+ 1stroked    eht--(this.__  = -1t2  * @cele '" }SwsrtW pcwsrt;       returcele '" }EhtO pcwsrt;     ashArrayp0 moveylt.CoC   AndSwet::n  },

   iextL{
      re ConisBeginnrenhis.tees(idth t   isextLr- 1eW =  .\n'getHeightOfLsextL}ndCo        =nisBeginnrenhis.tee? sextLr: sextLr- 1trokedrn;
   r(moveyndCo

    (isBeginnrenhis.te,LsextL}ndCostrokedrn;
   t   xor._getpres,slithx =IiextLr{
1hs+x] = -1t2  * @pres,slithxiextL)acrokedrn;
   e 1 -dex lO pte
  _ t(li
   IstoLines.strokedashArray);
      ctInsertda s[lels)
s whe;ea 
    rls+(repldtlt.  ele '" } if defoexistsr this.0{
        ctx[met_cs[ls Cs[lels)
s to issert this.0{
       Boop] n}ruseCopied}ndCo use d,
    nopied
   SndCo  else idth >insertCs[ls    },

   _cs[ls,ruseCopied}ndCo{
      re ConsndCo; 
a     privreturcele '" }EhtO-2  * @cele '" }SwsrtW> 1ndex] = -1t2  * @p0 moveCs[lsFm {Tox elsecele '" }Swsrt, returcele '" }Ehtstroked__  = -1t2//ohort circuit
erTeblock pas    elsefpriv!useCopied}ndCo     elseetTopOffset: o render on
   ram i}sertCs[l _cs[ls,rd_shoe / this.li      troked__  = -1t2erTextComeTopOlength -_cs[ls         s  lineWidth, lineLeftOfprivuseCopied}ndCo{
      reeeeesndColord,
    nopied
   SndCo[+) {
       }der on
   ram i}sertCs[l _cs[ls[+), s  liner{
1, sndCoh  return   worashArray);
      ctInsertdaa cs[lels)
 whe;ea 
    rls this.0{
        ctx[met_cs[l Cs[lels)
s to issert this.0{
       Boop] n}rskipUpdis[  cigg)
 r     ret
rnd updis[daaie _e ehtOhert   eissert this.0{
       

      sndCocontext}ndCo s.cbeeissert*/(   rthe('ura       _ge idth >insertCs[l    },

   _cs[l, skipUpdis[, sndCocontex{
      re ConisEhthis.tees(idth t   i elsecele '" }SwsrteW =  .\n'trokedrn;
   t   xor._getpres,slithx =I elsecele '" }Swsrths+x] = -1t2_}hdth+r._getpres,slithxreturcele '" }Ehtstroked__;
   e 1 -dex lO pte
  _ t(li
   IstoLines.stroked   ram i}sertyndCo

    s _cs[l, isEhthis.te, sndCocontex{;       returcele '" }SwsrtW+ -_cs[l,
          varx.filcele '" }EhtO p: fun{ele '" }Swsrt        privskipUpdis[anvasRenderingContext2D} ctx      te
  eupdis[
     ea.strokedrn;
   or  oords stroked__;
   eser
Sele '" }e    */;strokedrn;
   fire('c    */'strokedrn;
   }
         else}
    .fire('pres:c    */', {e aDget:  els+}stroked  xtLin}
         else}
    .r(lineAll.strokedashArray);
      ctInsertda'urasndCo oring} textBackg !== 0}
      return 0;itextLrhera m {Ng / 1000;
      }
       s[ltextLrtextLrhera cs[l this.0{
       Boop] n}risEhthis.teeTcti priit's ehtOherm {Ng / 100idth >insertNuris._yndCo

      ivate
     * umber, xs[ltextL, isEhthis.te{
  
Of   *;
   ohifglineSwet:s   * umber, +1); 
a     priv!xtLin
 et: ine numberW+ 1]render on
   ram 
 et: ine numberW+ 1] orn}  returntxx Contethis 
 +) {Cs[l}ndCo = {},* rettttttt'urlineSwet:sttttorn}  
a     privreturcaet: ine number
     else
 et: ine number
[xs[ltextLr- 1e{
          ,
 +) {Cs[l}ndCo =  else
 et: ine number
[xs[ltextLr- 1e; oked           //"ierlsere's notnlt.oafs)
L 
    ,       //"wes ldefo,i++) { }hdthsndCo ontoi he('u  x(olserwise eopOfh m {Ng / 10 privisEhthis.te{
  ettttttt'urlineSwet:s[0] or ldefnn
 +) {Cs[l}ndCostroked    te
  
 et: ine numberW+ 1] or'urlineSwet:stroked__  = -1t2// olserwise wes ldefoset
estherallmes[ls = -1t2// afs)
L 
    rontoi he('u  xis._h)am {Nlserbeginnren = -1t2      }

      erTextComemberWi  ._get
 et: ine number
{
            priv   snumt(iextLs 10) >= es[ltextL{
      retttttt'urlineSwet:s[   snumt(iextLs 10) - es[ltextL] =  else
 et: ine number
[imber
eturn;
 = -1t2// removeLis._s=am {Nlserprevious is._hsitcitthey'ro onra 'uram {Nu,owturn;
 = -1t2elleen
._get
 et: ine number
[imber
eturn;
 = -1lt - 1 + olt - 1 +  te
  
 et: ine numberW+ 1] or'urlineSwet:stroked__  = -1t2;
   esorcee
     */
lor.ction() {ashArray);
      ctInsertdasndCo oring} erTea givnerne n/}hdthi derath();
0;
      }
      return 0;itextLrhera m {Ng / 1000;
      }
       s[ltextLrtextLrhera cs[l this.0{
       default
 sndCo]t}ndCo oontexttDiinsert, prigivne   _ge idth >insertCs[lyndCo

      ivate
     * umber, xs[ltextL, sndCoh ndx Contethis 
 +) {lineSwet:stttt   =  else
 et: ine number
,
        he,i++) {lineSwet:sCldefd or ldefnn
 +) {lineSwet:s); 
a     priv s[ltextLrd=  0    !sndCoh nder on
tt,s[ltextLrds1; oked           //"ohifgrallmes[loset
estby 1 erTwarl       //"0,1,2,3 ->iv s[ltextL=2) ->i0,1,3,4 ->ivinsert 2) ->i0,1,2,3,4 = -1t2erTextComemberWi  ,i++) {lineSwet:sCldefd{
  Of   * @thisnum  rctextLrds   snumt(iextLs 10)etineLeftOfprivnum  rctextLr>= es[ltextL{
      retttt,i++) {lineSwet:s[num  rctextLr+ 1] or,i++) {lineSwet:sCldefd[num  rctextL]ne this.width// o}lywelleen
._foset
e"ierlsere was notnlt.omovedrlsere           priv!,i++) {lineSwet:sCldefd[num  rctextLr- 1e{
              elleen
,i++) {lineSwet:s[num  rctextL
eturn;
 = -1lt - 1 + olt - 1 +txilter tretur
 et: ine number
[xs[ltextL]h=t - 1 + oset
e"||r ldefnn
 +) {lineSwet:s[xs[ltextLr- 1e{; = -1t2;
   esorcee
     */
lor.ction() {ashArray);
      ctInsertdasndCo oring}(sr this.0{
        ctx[met_cs[ls Cs[lels)
s aie _e loc
    rwhe;easet
e"iseissert*/ this.0{
       Boop] n}risEhthis.teeTcti priit's ehtOherm {Ng / 100{
       default
 sndCodefaul]t}ndCo s.cissert this.0idth >insertyndCo

    s    },

   _cs[ls,risEhthis.te, sndCocontex{
        // removediohortcircuit
if ( etTopOffset: dx Contethis 
    Loc
    rs( ram pig2DCi+   Loc
    ne,
this.widthretutextLrrrrrrds,i+   Loc
    .f * umber,* rettttttt,s[ltextLrrrrrrds,i+   Loc
    .es[ltextLW 
a     priv!xtLin_eiglineSwet:   * umberhndex] = -1t2  * @psiglineSwet:   * umber, {}stroked  txx Contepriv_cs[ls  =  .\n't {
         ram i}sertNuris._yndCo

       * umber, xs[ltextL, isEhthis.te{troked__  = -1t2      }

      returinsertCs[lyndCo

       * umber, xs[ltextL, sndCocontex{;          worashArray);
      ctShifgs is._hset
estup  r downath();
0;
      }
      return 0;itextLrhera m {Ng / 1000;
      }
      o for  Cancbee-1  r +1 this.0idth >ohifglineSwet:s  ivate
     * umber, o for r fi() {
 //"ohifgrallmis._hset
estby 1 upwarl       this ldefdSwet:st=  ldefn else
 et: {;       erTextComis._h falsise
 et: , lineLeftOfthisnum  rcs.tees(   snumt(is._h)10stroked    privnum  rcs.tee>,is._textLisnder on
    returswet:s[num  rcs.tee+po for ] or ldefdSwet:s[num  rcs.te
eturn;
 = -1priv!,ldefdSwet:s[num  rcs.te -po for e{
              elleen
returswet:s[num  rcs.te
eturn;
 = -1lt - 1 + olt - 1 +tx() {
 //TODO: evaluis[ prielleen
oldaset
e"is._s=on gio for  -1     ashArray);
      ctx movesasndCo oring} textBackg !== 0Boop] n}risBeginnrenhis.teeTcti pri 
    rls+aie _e beginnren  erm {Ng / 100{
       }
      [imber
 Opeturalmember. Whnercreegivne,c,i++) { sele '" }SwsrtWls+used. this.0idth >r(moveyndCo

    :n  },

   isBeginnrenhis.te,LsextLh ndx Contethis 
    Loc
    rs( ram pig2DCi+   Loc
    niextL),
        heretutextLrrrrrrds,i+   Loc
    .f * umber,* rettttttt,s[ltextLrrrrrrds,i+   Loc
    .es[ltextLW 
a       * @p0 moveyndCo

    (isBeginnrenhis.te,L,i+   Loc
    , f * umber, es[ltextL{;     ashArrayprn;
   OnPreviousdex     },

   ltextLisnder on
        }
   neIndex lintextLr- 1e; okedashArrayp0 moveyndCo

    :n  },

   isBeginnrenhis.te,L,i+   Loc
    , f * umber, es[ltextL{ ndx ConteprivisBeginnrenhis.te, lineLeftOfthist   OnPreviousdex rrrrrdsxtLin_eig
   OnPreviousdex (,i+   Loc
    .f * umber)= this.width e'urCs[ltextLOnPrevs.tees(i   OnPreviousdex r?(i   OnPreviousdex ys._getW:p0tr    var  priv!xtLin
 et: ine numberW- 1e{
            xtLin
 et: ine numberW- 1e orn}  return-1lt - 1 + oerTex,s[ltextLri  ._get
 et: ine number
{
            xtLin
 et: ine numberW- 1e[   snumt(xs[ltextL, 10) +e'urCs[ltextLOnPrevs.te] this.width e=  else
 et: ine number
[xs[ltextL) {
       }der on
   ram ohifglineSwet:s ,i+   Loc
    .f * umber, -1etroked__  = -1t2      }

      this 
 +) {lineSwet:st=  else
 et: ine number
tr    var  privn
 +) {lineSwet:s){
         n
elleen
n
 +) {lineSwet:s[xs[ltextL) {
       }der on
  this 
 +) {lineSwet:sCldefd or ldefnn
 +) {lineSwet:s); er on
  //"ohifgrallmset
estby 1 backwarls}

      erTextComeWi  ,i++) {lineSwet:sCldefd{
  Of   * @ @thisnum  rctextLrds   snumt(ih)10stroked    Ofprivnum  rctextLr>= es[ltextL    num  rctextLr],
  ringContext22222,i++) {lineSwet:s[num  rctextLr- 1] or,i++) {lineSwet:sCldefd[num  rctextL]neContext22222elleen
,i++) {lineSwet:s[num  rctextL
eturn;
 = -1lt - 1 + olt - 1 +tx 1 +tshArray);
      ctInsertda'uram {Ng / 100idth >insertNuris._= 'right') {
        returinsertCs[ls(.\n'ton() {ashArray);
      ctSeie _e sele '" }SwsrtWrnd cele '" }EhtOaccordingms.c he('u pos    rori 
          ctmimicc he(keyr- mouse navig
    rwhen"ohifgrls+t = sed. this.0idth >sigSele '" }SwsrtEhtWn gShifg:n  },

   owsrt, eht,p'urSele '" }{
        0.85'urSele '" } <   tsrtndex] = -1t20.85ehtO==   tsrtndex] = -1t2t2  * @psile '" }Der
 '" }W  'm   ' {
       }der on
       ._te else_sile '" }Der
 '" }W =  .rengt'ndex] = -1t2t2  * @psile '" }Der
 '" }W  'm   ' {
         returcele '" }EhtO pcwsrt;         }der on
    * @cele '" }SwsrtW p'urSele '" }troked__  = -1t2     0.85'urSele '" } >  tsrtW   nurSele '" } < eht {
         ._te else_sile '" }Der
 '" }W =  .rengt'ndex] = -1t2t2  * @cele '" }EhtO p'urSele '" } {
       }der on
       ex] = -1t2t2  * @cele '" }SwsrtW p'urSele '" }troked__ olt - 1 +tx() {
      ex] = -1t2//"nurSele '" } ls+>  ele '" } swsrtWrnd ehtx] = -1t20.85ehtO==   tsrtndex] = -1t2t2  * @psile '" }Der
 '" }W  'rengt' {
       }der on
       ._te else_sile '" }Der
 '" }W =  .m   'ndex] = -1t2t2  * @psile '" }Der
 '" }W  'rengt' {
       t2  * @cele '" }SwsrtW pen/ne woror  lt - 1 +t2  * @cele '" }EhtO p'urSele '" } {
     tx 1 +tshArraysigSele '" }InB'fonaries  'right') {
        thiss._getW r._getpres,
          var0.85returcele '" }SwsrtW> 
     et(lineWidth  * @cele '" }SwsrtW p
          var  = -1t2     0.85  * @cele '" }SwsrtW<p0render on
    * @cele '" }SwsrtW p0;       }
a     priv  * @cele '" }EhtO> 
     et(lineWidth  * @cele '" }EhtO p
          var  = -1t2     0.85  * @cele '" }EhtO<p0render on
    * @cele '" }EhtO p0;       }
a   a
.w}str})     
 */
    _iniacing:.eextAl(    /**I
   .  mto */
, /** @ngtdda    /**I
   .  mto */
Bai fi  /**
   * Inichaln; t
"dbclick" eve t hrndl r
xtB0idthinicDoubleClickSimuhisi }: nction() {
  
Of  //"f r double click
t2t2  * @p_lastClick
imeO p+'uraDrae()etineLe//"f r triple click
t2t2  * @p_lastLastClick
imeO p+'uraDrae()etineLe  * @p_lastPoi * rlor r}  ineLe  * @') 'mousedown',(idth onMouseDown.biAl(te
 iton()tshArronMouseDown:  * Returnipetur {
  ineLe  * @p_'urClick
imeO p+'uraDrae()et    this'urPoi * rlor else}
    .eigPoi * rnipetur .et  ineLe._textLinetTripleClick('urPoi * r){
        returfire('pripleclick',(ipetur {; = -1t2;
   estopEve tnipetur .et      }
a        0.85  * @isDoubleClick('urPoi * r){
        returfire('dblclick',(ipetur {; = -1t2;
   estopEve tnipetur .et      }

t2t2  * @p_lastLastClick
imeO p  * @p_lastClick
ime;
t2t2  * @p_lastClick
imeO p  * @p_'urClick
ime;
t2t2  * @p_lastPoi * rlor'urPoi * r;
t2t2  * @p_lastItT.splt.    elseetT.splt.;
t2t2  * @p_lastSele 'edO p: fun{ele '*/ne wtshArrisDoubleClick:  * Return'urPoi * r)
              }
   _'urClick
imeO-2  * @p_lastClick
imeO< 500   der on
    * @p_lastPoi * r.Lrd=  'urPoi * r.x   der on
    * @p_lastPoi * r.yrd=  'urPoi * r.yS    else__lastItT.splt.ne wtshArrisTripleClick:  * Return'urPoi * r)
              }
   _'urClick
imeO-2  * @p_lastClick
imeO< 500   der on
    * @p_lastClick
imeO-2  * @p_lastLastClick
imeO< 500   der on
    * @p_lastPoi * r.Lrd=  'urPoi * r.x   der on
    * @p_lastPoi * r.yrd=  'urPoi * r.yne wtshArr/**
   *   }
      el0idthestopEve t    },

   eh nder oe.preve tDefaultS   e.preve tDefault()et    e.stopceClag
    r   e.stopceClag
    ()ne wtshArr/**
   * Inichaln; t
eve t hrndl rs   hise ftoi 
    ror  ele '" }
xtB0idthinicC
    Sele '" }Hrndl rs  'right') {
      returinicSele 'edHrndl r()et    returinicMousedownHrndl r()et    returinicMouseupHrndl r()et    returinicClicks()ne wtshArr/**
   * Inichaln; t
double rnd triple click
eve t hrndl rs
xtB0idthinicClicks  'right') {
      retur') 'dblclick',( * Returnipetur {
        : fun{ele 'Word( ram pigSele '" }SwsrtFm {Poi * rnipetur .ett      })et    retur') 'pripleclick',( * Returnipetur {
        : fun{ele 'dex ( ram pigSele '" }SwsrtFm {Poi * rnipetur .ett      })et  tshArr/**
   * Inichaln; t
"mousedown" eve t hrndl r
xtB0idthinicMousedownHrndl r  'right') {
      retur') 'mousedown',( * Returnipetur {
        0.85ate
  e.spabCoanvasRenderingContext2D} ctxt2D} ctCom oi * rlor else}
    .eigPoi * rnipetur .et  ineLe    * @p_mousedownX zepoi * r.x;ineLe    * @p_mousedownY zepoi * r.y;ineLe    * @p_isMousedowno   ctionilter t0.85  * @cele 'eti{
         x.fils  C
    ByClick(ipetur .et       ctxilter tprivxtLinetT.splt.i{
           * @p_{ele '" }SwsrtOnMouseDownO p: fun{ele '" }Swsrt        ar0.85returcele '" }SwsrtW = p: fun{ele '" }Eht{
  Of   * @ar;
   abort[
    Animrai }.strokedrn  lt - 1 +t2  * @r(line[
    OrSele '" }.stroked     wora)et  tshArr/**
   *   }
      el0idtheis

    Moved    },

   eh nder otCom oi * rlor else}
    .eigPoi * rnet  ineLe        }
   _mousedownX ],
 poi * r.x || Of   * @ar   * @p_mousedownY ],
 poi * r.yne wtshArr/**
   * Inichaln; t
"mouseup" eve t hrndl r
xtB0idthinicMouseupHrndl r  'right') {
      retur') 'mouseup',  * Returnipetur {
        : funH_isMousedowno  d_shouldClear0.85ate
  e.spabCoS @p._getHis

    Movednipetur .ettnvasRenderingContext2D} ctxilter tprivxtLinp_lastSele 'edO   !xtLinp_corne render on
   {Nume * rE.splt.(ipetur .et       car0.85returcele '" }SwsrtW = p: fun{ele '" }Eht{
  Of   * @ar;
   inicDela*ed[
    ( ctir {
       }der on
       ex] = -1t2t2  * @r(line[
    OrSele '" }.stroked!= olt - 1 +tx() {
   * @cele 'etlor.ction() {a)et  tshArr/**
   * e    *da 
    rloc
    rinra t   xdependingm  rpa sedm oi * rl(x/y) oring} tex0{
       Eve t} e Eve t oring} tex0idths  C
    ByClick    },

   eh nder otComnurSele '" }  param pigSele '" }SwsrtFm {Poi * rnet,* retttttswsrtW param {ele '" }Swsrt, ehtO p: fun{ele '" }Eht     v0.85e ohifgKey{
        : fun{egSele '" }SwsrtEhtWn gShifg owsrt, eht,p'urSele '" }{      }
a                : fun{ele '" }SwsrtW p'urSele '" }troked__  * @cele '" }EhtO p'urSele '" } {
   }
t2t2  * @pser
Sele '" }e    */;stroked  * @pupdis[
     ea.stroktshArr/**
   * x !== daiextLrhera cs[lels)
rcor = pondingms.cwhe;eaan istory was click*/ thi0{
       Eve t} e Eve t oring} tex00;    0,

}
      textLrhera cs[lels)
ath(0idthpigSele '" }SwsrtFm {Poi * r    },

   eh nder otCommouse  for (i aram pigLoc
lPoi * rnet,* retttttprev;
      0,* retttttw
      0,* rettttthtoLines(0,* rettttt,s[ltextLrds0,* rettttt'urSele '" }SwsrtgetHeightOlinioniltererTextComeTopOlength - }
   neIndex l         s  lineWidth, lineLeftl.tees(idth  neIndex li+) {
     htoLine+dsxtLin_eig.lengthis.tef._get== t,i)x00  * @cc
leY; 
a     tComw
   his.tees(idth     htOfLeftOf._get== t,i),
        heretuL     for (i idth     htOfLine(ctx, iw
   his.tet  ineLe  w
      retuL     for (00  * @cc
leXet  ConteerTextComjTopOlejngth -lex ys._get;mjT<ejngt;mjth, li* retttttprev;
      w
   ; * retttttw
    +dsxtLin_eigW
   hiCs[l ._get== t,lex [j), s,(idth flipX ?ejngth-mjT: j)x0 Of   * @ar oked__  * @cc
leXet  Conte v0.85htoLine<=mmouse  for .yr @pw
    <=mmouse  for .L{
      retttt,s[ltextL++; this.width}  *intion() {
 orat  Conte v        }
   eigNurSele '" }SwsrtFm {(ctx, i this.widthmouse  for ,tprev;
   ,pw
   , es[ltextL + s,(jngtt       ctxilter tprivmouse  for .yr< htoLin{
      rett// }
  hrppens h = n } ehtOherm {Ns.  Conte v        }
   eigNurSele '" }SwsrtFm {(ctx, i this.widthmouse  for ,tprev;
   ,pw
   , es[ltextL + sr{
1, jngtt       ctx   ctxilter// click*/ somewhe;eaafs)
Lallmes[ls, sohs  aaie _e eht    v0.85 */
her'urSele '" }SwsrtW =dt'uextf {Nd'ndex] = -1        }
  pres,
          v}t  tshArr/**
   *   }
      el0idtheeigNurSele '" }SwsrtFm {(ctx,     },

   mouse  for ,tprev;
   ,pw
   , iextLs jngtt li* rettComdistsersBtwLastC   AndC
    O pmouse  for .Lr{
prev;
   , this.widdistsersBtwN   e   AndC
    O punt = -Lmouse  for .L            for (i distsersBtwN   e   AndC
    O>mdistsersBtwLastC   AndC
    O? 0 : 1,* rettttt'urSele '" }Swsrt =niextL + o for trilter// if dstory 
  horiz  *[lly flippet,pmirrora 
    rloc
    ram {Nlsereht    v0.85 dth flipXndex] = -1'urSele '" }Swsrt =njngth-m'urSele '" }Swsrt;     } ineLe._te'urSele '" }SwsrtW>th, wopres,
     et(lineWid'urSele '" }SwsrtW param pres,
          v}tineLe       'urSele '" }Swsrt;   }
}    
 */
    _iniacing:.eextAl(    /**I
   .  mto */
, /** @ngtdda    /**I
   .  mto */
Bai fiArr/**
   * Inichaln; t
hidden t     eaW(nee e ftoib ret
up(keyboarl=inriOS)
xtB0idthinicHidden
     ea  'right') {
      returhidden
     eaW p    /**docuatur.c eateEleatur('pres  ea'stroked  * @hidden
     ea.cetAttribuae('autoc
pspaln; ', 'o f'strokedthissndColor._getHcalc
     eaPm {Canv.stroked  * @hidden
     ea.cndCoecss
   xor'pm {Canv  absoluae; lgt:n' + cndCoetCl + '; m   : ' + cndCoel   (+ ';' Of   * @ar oked_________________________+ ' oContex:p0tpunt =:p0px; htoLin:p0px; z-iextL: -999;' {
       /**docuatur.body.rppendChill(te
  hidden
     eastr{
       /** _iniaddListene (te
  hidden
     ea, 'keydown',(idth onKeyDown.biAl(te
 iton()      /** _iniaddListene (te
  hidden
     ea, 'keyup', idth onKeyUp.biAl(te
 iton()      /** _iniaddListene (te
  hidden
     ea, 'input', idth onInput.biAl(te
 iton()      /** _iniaddListene (te
  hidden
     ea, 'copy', idth copy.biAl(te
 iton()      /** _iniaddListene (te
  hidden
     ea, 'cut', idth cut.biAl(te
 iton()      /** _iniaddListene (te
  hidden
     ea, 'pas  ', idth pas  .biAl(te
 iton()      /** _iniaddListene (te
  hidden
     ea, 'co* m {Canvowsrt', idth onig* m {CanvSwsrt.biAl(te
 iton()      /** _iniaddListene (te
  hidden
     ea, 'co* m {Canvupdis[', idth onig* m {CanvUpdis[.biAl(te
 iton()      /** _iniaddListene (te
  hidden
     ea, 'co* m {Canvend', idth onig* m {CanvEht.biAl(te
 itonineLe._te!xtLinpclickHrndl rInichaln; /(    else,
    {
        e   /** _iniaddListene (te
  }
    .upp ([ring}Elg 'click',(idth onilick.biAl(te
 iton()  rn;
   exlickHrndl rInichaln; /(or.ction() {at  tshArr/**
   *   }
      el0idthekeysMat:n      8:  '0 moveCs[ls'getHei9:  'exitE.splt.'getHei27: 'exitE.splt.'getHei13: 'insertNuris._'getHei33: 'moveC
    Up'getHei34: 'moveC
    Down',etHei35: 'moveC
    Rsets',etHei36: 'moveC
    L   ',etHei37: 'moveC
    L   ',etHei38: 'moveC
    Up'getHei39: 'moveC
    Rsets',etHei40: 'moveC
    Down',etHei46: 'erTwarlDlleen't  tshArr/**
   *   }
      el0idthectrlKeysMatUt:n      67: 'copy',     88: 'cut't  tshArr/**
   *   }
      el0idthectrlKeysMatDown:       65: 'cele 'All't  tshArronilick  'right') {
      // No nee ftoi xigg)
 click
eve t he;e,   cus 
  enoughftoihavec he(keyboarl=rppehison Android     returhidden
     eaW    elsehidden
     ea.focus(h  retshArr/**
   * Hrndl s keyup
eve t thi0{
       Eve t} e Eve t oring} tex0/ArronKeyDown    },

   eh nder o._te!xtLinetT.splt.i{
       ngContext2D}}der o._tee.keyCod_h falsiseekeysMat{
        : fu[lsiseekeysMat[e.keyCod_]](et      }
a        0.85ee.keyCod_h falsiseectrlKeysMatDown)  +=ee.ctrlKeyr @pe.metaKey{{
        : fu[lsiseectrlKeysMatDown[e.keyCod_]](et      }
a        
       ngContext2D}}der oe.stopImmedi   ceClag
    ()ne w oe.preve tDefault.stroked  * @}
         else}
    .r(lineAll.stroktshArr/**
   * Hrndl s keyup
eve t thi0{We hrndl  KeyUp because ie11Wrnd edgeihavecdifficultiesrcopy/pas ren = -* 0.8arcopy/cut
eve t ser
t,pkeyup

  dismi sed thi0{
       Eve t} e Eve t oring} tex0/ArronKeyUt:n  },

   eh nder o._te!xtLinetT.splt.S @p._getHxopyDote, lineLeft._getHxopyDoteo  d_shouldClearngContext2D}}der o._teee.keyCod_h falsiseectrlKeysMatUp)  +=ee.ctrlKeyr @pe.metaKey{{
        : fu[lsiseectrlKeysMatUt[e.keyCod_]](et      }
a        
       ngContext2D}}der oe.stopImmedi   ceClag
    ()ne w oe.preve tDefault.stroked  * @}
         else}
    .r(lineAll.stroktshArr/**
   * Hrndl s onInput
eve t thi0{
       Eve t} e Eve t oring} tex0/ArronInput:n  },

   eh nder o._te!xtLinetT.splt.S @p._geti}ig* m {CanvModoanvasRendengContext2D}}der othiso for  i : fun{ele '" }SwsrtW @p0            for EhtO p: fun{ele '" }EhtW @p0          neInd._getW r._getpres,
     ,* rettttt'urTeInd._getW r._gethidden
     ea.value,
     ,* retttttdiff, es[lsToInsert, cwsrt;     ._te'urTeInd._getW> neInd._getr fi() {
 //we"add*/ some cs[lels)
ath();tswsrtW param _sile '" }Der
 '" }W =  .m   ' ?   for EhtO:po for trokedttdiffO p'urTeInd._getW- neInd._gettrokedttes[lsToInsertW r._gethidden
     ea.value,slithxowsrt,  tsrtW+ difft      }
a        
       //we"cele 'etla porti  rorit   xrnd then"input sometnlt.o    .       //I * rnr  explorer does noti xigg)
  }
      rokedttdiffO p'urTeInd._getW- neInd._get + o for EhtO-2o for trokedttes[lsToInsertW r._gethidden
     ea.value,slithxo for ,to for (+ difft      }
a   ._geti}sertCs[ls(es[lsToInsert)et    e.stopceClag
    .stroktshArr/**
   * ig* m {Canv  tsrt tex0/Arronig* m {CanvSwsrt  'right') {
      returinig* m {CanvModo(or.ction() {idth previg* m {Canvd._getW r0troked  * @}g* m {CanvSwsrtO p: fun{ele '" }Swsrt    tshArr/**
   * ig* m {Canv eht    0/Arronig* m {CanvEht  'right') {
      returinig* m {CanvModo(ord_shouldCtshArr/**
   * ig* m {Canv updis[    0/Arronig* m {CanvUpdis[    },

   eh nder otComdisaW pe.disatroked  * @cele '" }SwsrtW ph, wo}g* m {CanvSwsrttroked  * @cele '" }EhtO p: fun{ele '" }EhtW = p: fun{ele '" }SwsrtW?ineLeft._get}g* m {CanvSwsrtO+{idth previg* m {Canvd._getW:p: fun{ele '" }Eht     v._geti}sertCs[ls(disa,rd_shoe / thiidth previg* m {Canvd._getW rdisa,
         tshArr/**
   * FrTwarl=elleen    0/ArrerTwarlDlleen:n  },

   eh nder o._tereturcele '" }SwsrtW = p: fun{ele '" }Eht{
  Of   *._tereturcele '" }SwsrtW = p: funpres,
     et(lineWidthngContext2D} ctx      te
  moveC
    Rsets(et      }
a     * @r(moveCs[ls(et    tshArr/**
   * igpiesrcele 'etlpres    0{
       Eve t} e Eve t oring} tex0/Arrxopy:n  },

   eh nder o._tereturcele '" }SwsrtW = p: fun{ele '" }Eht{
  Of   *//do noticut-xopyo._tno  ele '" }
xtB dengContext2D}}der othiscele 'et
   xor._getpigSele 'ed
   ne,
this.widclipboarlDisaW p }
   eigClipboarlDisanet  ineLe// Check
erTebackwarl }g* 
  biltexTon giold brows rs
xtB privnlipboarlDisa{
  Of   *nlipboarlDisa.cetDisan'pres',scele 'et
   t      }

t2t2d,
    nopied
     -sele 'ed
   ;
t2t2d,
    nopied
   }ndCo =  elsepigSele '" }Swet:s 
this.widddddddddddddddddddaram {ele '" }Swsrt,
this.widddddddddddddddddddaram {ele '" }Ehtstrokede.stopImmedi   ceClag
    ()ne w oe.preve tDefault.stroked  * @HxopyDoteo  .ction()tshArr/**
   * Pas  slpres    0{
       Eve t} e Eve t oring} tex0/Arrpas      },

   eh nder otComnopied
     -'upe,
this.widclipboarlDisaW p }
   eigClipboarlDisanet,
this.widuseCopied}ndCo    ctionilter// Check
erTebackwarl }g* 
  biltexTon giold brows rs
xtB privnlipboarlDisa{
  Of   *nopied
     -nlipboarlDisa.getDisan'pres').repldte(/\r/g, ''); a     priv!d,
    nopied
   }ndCo  @pd,
    nopied
    !=  ,opied
   et(lineWidthuseCopied}ndCo   d_shouldClear}xt2D}}der o     
       nopied
     -d,
    nopied
   ;     } ineLe._te,opied
   et(lineWid._geti}sertCs[ls(eopied
   ,ruseCopied}ndCo{ext2D}}der oe.stopImmedi   ceClag
    ()ne w oe.preve tDefault.stroktshArr/**
   * iutslpres    0{
       Eve t} e Eve t oring} tex0/Arrcut:n  },

   eh nder o._tereturcele '" }SwsrtW = p: fun{ele '" }Eht{
  Of   *ngContext2D}}droked  * @}gpy(oe / thiidth r(moveCs[ls(et    tshArr/**
   *   }
      el0{
       Eve t} e Eve t oring} tex00;    0,

default
ClipboarlmdisaWoring} tex0/Arr eigClipboarlDisa:n  },

   eh nder o    0,
(er   e.nlipboarlDisa{
 @pd,
    window.nlipboarlDisa    tshArr/**
   * Fitdda he(unt =  fapix    beth;ea he( 
    rona he(sameam {Ng / *   }
      el0{
       }
      return 0;  el0{
       }
      es[ltextL tex00;    0,

}
      unt =aeth;eC
    Ount = beth;ea 
        0/Arr eigWnt =aeth;eC
      ivate
     * umber, xs[ltextLh nder otCom 1 -aeth;eC
    O pte
  _neIndex line number
,slithx =Ixs[ltextL_getHeightOw
   his.tees(idth     htOfLeftOf._get== t,f * umber)= this.widunt =aeth;eC
    Oi idth     htOfLine(ctx, iw
   his.tet,t_cs[loniltererTextComeTopOlength - 1 -aeth;eC
             s  lineWidth, lineLeft_}hdth - 1 -aeth;eC
    i+) {
     unt =aeth;eC
    O+dsxtLin_eigW
   hiCs[l ._get== t,_cs[l,   * umber, i{ext2D}}der o    0,
unt =aeth;eC
        tshArr/**
   * GetdasnsrtWo for   .8ar ele '" }
xtB0{
       Eve t} e Eve t oring} tex00;g !== 0Boop] n}risRoLins = 00;    0,

}
         0/ArrgetDownC
    O for :n  },

   e,risRoLinh nder otCom ele '" }ceClOi idth     Sele '" }F  O for  e,risRoLinh,
this.widc
    Loc
    rs( ram pig2DCi+   Loc
    n ele '" }ceCl)getHeightOlinitextLrds,i+   Loc
    .f * umber;ilter// if de lastxis._h)downo 
    rgoes to ehtOherm {Ng / 1._telinitextLrd= pte
  _neIndex lys._getW- 1r @pe.metaKeyr @pe.keyCod_hd= p34r fi() {
 //"moveLs.c he(ehtOheralpres     -1        }
  pres,
     W-  ele '" }ceClext2D}}der othis,s[ltextLrds,i+   Loc
    .xs[ltextL,* retttttunt =aeth;eC
    Oi idth     Wnt =aeth;eC
    dl * umber, xs[ltextL_getHeightOiextLOnOlsers.tees(idth     textLOns.tefne numberW+ 1,tunt =aeth;eC
    )          neInAfs)
C
    O pte
  _neIndex line number
,slithxes[ltextL{; der o    0,
neInAfs)
C
    ,
     W+OiextLOnOlsers.tee+ 2    tshArr/**
   *  }
      el0{Helps findingmierlseWo for  should bol} unt*/( m {NSwsrtW  OEn/ thi0{
       Eve t} e Eve t oring} tex00;g !== 0Boop] n}risRoLins = 00;    0,

}
         0/Arr    Sele '" }F  O for :n  },

   e,risRoLinh nder o0.85e ohifgKey     else
ele '" }SwsrtW!= p: fun{ele '" }Eht    isRoLinh nder o-1        }
  {ele '" }Eht     v}
a        
       ngContp: fun{ele '" }Swsrt     {at  tshArr/**
   *         Eve t} e Eve t oring} tex00;g !== 0Boop] n}risRoLins = 00;    0,

}
         0/ArrgetUpC
    O for :n  },

   e,risRoLinh nder otCom ele '" }ceClOi idth     Sele '" }F  O for  e,risRoLinh,
this.widc
    Loc
    rs( ram pig2DCi+   Loc
    n ele '" }ceCl)getHeightOlinitextLrds,i+   Loc
    .f * umber;ilter._telinitextLrd= p0r @pe.metaKeyr @pe.keyCod_hd= p33r fi() {
 //"if de firstxis._h)upo 
    rgoes to snsrtWo  m {Ng / 10     0,
- ele '" }ceClext2D}}der othis,s[ltextLrds,i+   Loc
    .xs[ltextL,* retttttunt =aeth;eC
    Oi idth     Wnt =aeth;eC
    dl * umber, xs[ltextL_getHeightOiextLOnOlsers.tees(idth     textLOns.tefne numberW- 1,tunt =aeth;eC
    )          neInaeth;eC
    O pte
  _neIndex line number
,slithx =Ixs[ltextL_;ilter//     0,
a 'ug
  veWo for der o    0,
-te
  _neIndex line numberr- 1],
     W+OiextLOnOlsers.tee-- 1 -aeth;eC
            t  tshArr/**
   * find erTea givnerunt =  } erutdda he(matcnlt.ocs[lels)
.g / *   }
      el0/Arr    textLOns.te  ivate
     * umber, w
   rendder othisw
   his.tees(idth     htOfLeftOf._get== t,f * umber)= this.widi   Ons.tees(idth  neIndex line number
getHeightOliniL     for (i idth     htOfLine(ctx, iw
   his.tetgetHeightOw
   hiCs[lsOns.tees(liniL     for getHeightOiextLOns.tees(0          erutdMatcnoniltererTextComjTopOlejngth -i   Ons.teys._get;mjT<ejngt;mjth, li* rettttCom_}hdth - 1 -Ons.te[j),         tOw
   hiCs[lOi idth     Wnt =hiCs[l ._get== t,_cs[l,   * umber, jt  ineLe  w
   hiCs[lsOns.tee+= w
   hiCs[lonilter t0.85w
   hiCs[lsOns.tee> w
   rendder o    erutdMatcno   ctionilter t  thiss.ftEdgei= w
   hiCs[lsOns.tee- w
   hiCs[l,
this.widddddrengtEdgei= w
   hiCs[lsOns.te,
this.widddddo for Fm {L.ftEdgei= Math.abs(s.ftEdgei- w
   ),
this.widddddo for Fm {RengtEdgei= Math.abs(rengtEdgei- w
   )et  Conte v0extLOns.tees(o for Fm {RengtEdgei<do for Fm {L.ftEdgei?mjT: (jr{
1het  Conte vbreakuldClear}xt2D}}dilter//    */
dreht    v0.85!erutdMatcn{
  Of   *.extLOns.tees(i   Ons.teys._getr- 1troked}tineLe       .extLOns.te t  tshAArr/**
   * Movesa 
    rdownath(0{
       Eve t} e Eve t oring} tex0/ArrmoveC
    Down:n  },

   eh nder o._tereturcele '" }SwsrtW> p: funpres,
          else
ele '" }EhtO> p: funpres,
     et(lineWidngContext2D}}der oidth  moveC
    UpO Down('Down', et    tshArr/**
   * Movesa 
    rupath(0{
       Eve t} e Eve t oring} tex0/ArrmoveC
    Ut:n  },

   eh nder o._tereturcele '" }SwsrtW = p0     else
ele '" }EhtO=,
  ringContexngContext2D}}der oidth  moveC
    UpO Down('Up'g et    tshArr/**
   * Movesa 
    rup  r down, ser
da he(eve tsath(0{
        ctx[metder
 '" }W'Up'  r 'Down'ath(0{
       Eve t} e Eve t oring} tex0/Arr moveC
    UpO Down:n  },

   der
 '" }g et
      // getUpC
    O for      // getDownC
    O for der othisa '" }W  'get'(+ dir
 '" }W+ 'C
    O for '            for Oi idth[a '" }] e,raram _sile '" }Der
 '" }W =  .rengt'n;ilter._tee ohifgKey{
        : funmoveC
    Wn gShifg o for r     v}
a        
       : funmoveC
    Wn goutShifg o for r     v}
a   ._te  for O],
  ringContex else
egSele '" }InB'fonaries;strokedrn;
   abort[
    Animrai }.strokedrn;
   exi++) {C
     ContexTop1trokedrn;
   inicDela*ed[
    (stroked__;
   eser
Sele '" }e    */;strokedrn;
   eupdis[
     ea.strokedat  tshArr/**
   * Movesa 
    ron giohifgath(0{
       }
      o for  tex0/ArrmoveC
    Wn gShifg:n  },

   o for r fi() {tComnurSele '" }  param _sile '" }Der
 '" }W =  .m   'i() {?  else
ele '" }SwsrtW+Wo for der o:p: fun{ele '" }Eht + o for trntex else
egSele '" }SwsrtEhtWn gShifg aram {ele '" }Swsrt,p: fun{ele '" }Eht,p'urSele '" }{               for O],
      tshArr/**
   * Movesa 
    rup wn goutiohifgath(0{
       }
      o for  tex0/ArrmoveC
    Wn goutShifg:n  },

   o for r fi() {._te  for O<  ringContex else
ele '" }SwsrtW+=2o for trokedtt  * @cele '" }EhtO p: fun{ele '" }Swsrt     {at                 : fun{ele '" }Eht +=2o for trokedtt  * @cele '" }SwsrtO p: fun{ele '" }Eht     v}
a            for O],
      tshArr/**
   * Movesa 
    rm   ath(0{
       Eve t} e Eve t oring} tex0/ArrmoveC
    Left:n  },

   eh nder o._tereturcele '" }SwsrtW = p0     else
ele '" }EhtO=,
  ringContexngContext2D}}der oidth  moveC
    L     Rsets('L   ', et    tshArr/**
   *   }
      el0{
    0,

Boop] n}rtcti pria cs[ngeihappenet    0/Arr move:n  },

   e,rpeCl, dir
 '" }r fi() {tComnurValue;ilter._tee algKey{
        nurValueOi idth['findWordB'fonary'(+ dir
 '" }]eretuipeCl]      {at         ._tee metaKeyr @pe.keyCod_hd= p35r @ppe.keyCod_hd= p36 {
        nurValueOi idth['finds.teB'fonary'(+ dir
 '" }]eretuipeCl]      {at                 : fuipeCl] +=2der
 '" }W =  .L   ' ? -1 : 1;gContexngContr.ction() {at   v0.85 */
her'urValueO],
 uextf {Nd     elsipeCl] !=  'urValue)         : fuipeCl] =mnurValue;ilterexngContr.ction() {at  tshArr/**
   *   }
      el0idthemoveLeft:n  },

   e,rpeCl)
              }
   move e,rpeCl, .L   ')et  tshArr/**
   *   }
      el0idthemoveRoLin:p  },

   e,rpeCl)
              }
   move e,rpeCl, .Rengt'n;ilttshArr/**
   * Movesa 
    rm    wn goutikeeplt.  ele '" }ath(0{
       Eve t} e tex0/ArrmoveC
    LeftWn goutShifg:n  },

   eh nder otComns[ngeior.ction() {idth psile '" }Der
 '" }W  'm   ' {     // o}lywmoveL 
    rohen"lsere istno  ele '" },     // olserwise wesdiscarl=it,prnd p] ve( 
    ronasameapldteder o._tereturcele '" }EhtW = p: fun{ele '" }SwsrtW    else
ele '" }SwsrtW!= p ringContexns[ngeior.}
   moveLeft e,r'
ele '" }Swsrt'het  Con}der oidth cele '" }EhtO p: fun{ele '" }Swsrt     {       ns[nge;ilttshArr/**
   * Movesa 
    rm    whiletkeeplt.  ele '" }ath(0{
       Eve t} e tex0/ArrmoveC
    LeftWn gShifg:n  },

   eh nder o._te else_sile '" }Der
 '" }W =  .rengt'     else
ele '" }SwsrtW!= p: fun{ele '" }Ehtisnder on
        }
   moveLeft e,r'
ele '" }Eht'      {at         ._te else
ele '" }SwsrtW!= p r        : funpsile '" }Der
 '" }W  'm   ' {
             }
   moveLeft e,r'
ele '" }Swsrt'het() {at  tshArr/**
   * Movesa 
    rroLins = 00;       Eve t} e Eve t oring} tex0/ArrmoveC
    RoLin:p  },

   eh nder o._tereturcele '" }SwsrtW> p: funpres,
          else
ele '" }EhtO> p: funpres,
     et(lineWidngContext2D}}der oidth  moveC
    L     Rsets('Rsets', et    tshArr/**
   * Movesa 
    rroLin  r L   , ser
daeve t thi0{
        ctx[metder
 '" }W'L   ', 'Rsets's = 00;       Eve t} e Eve t oring} tex0/Arr moveC
    L     Rsets:n  },

   der
 '" }g et
      thisa '" }NameO p'moveC
    '(+ dir
 '" }W+ 'Wn g'troked  * @Hxi++) {C
     ContexTop1trilter._tee ohifgKey{
        a '" }NameO+=2'Shifg'     {at                 a '" }NameO+=2'outShifg'on() {at   v0.85 dth[a '" }Name](etringContex elseabort[
    Animrai }.strokedrn;
   inicDela*ed[
    (stroked__;
   eser
Sele '" }e    */;strokedrn;
   eupdis[
     ea.strokedat  tshArr/**
   * Movesa 
    rroLin whiletkeeplt.  ele '" }ath(0{
       Eve t} e tex0/ArrmoveC
    RsetsWn gShifg:n  },

   eh nder o._te else_sile '" }Der
 '" }W =  .m   '     else
ele '" }SwsrtW!= p: fun{ele '" }Ehtisnder on
        }
   moveRsets(e,r'
ele '" }Swsrt'het() {at  t2     0.85  * @cele '" }EhtO!= p: funpres,
     et(lineWid: funpsile '" }Der
 '" }W  'rengt' {
             }
   moveRsets(e,r'
ele '" }Eht'      {at  tshArr/**
   * Movesa 
    rroLin wn goutikeeplt.  ele '" }ath(0{
       Eve t} e Eve t oring} tex0/ArrmoveC
    RoLinWn goutShifg:n  },

   eh nder otComns[ngedior.ction() {idth psile '" }Der
 '" }W  'rengt' {der o._tereturcele '" }SwsrtW = p: fun{ele '" }Ehtisnder on
ns[ngedior.}
   moveRsets(e,r'
ele '" }Swsrt'het() {tt  * @cele '" }EhtO p: fun{ele '" }Swsrt     {at                 : fun{ele '" }SwsrtO p: fun{ele '" }Eht     v}
a          ns[nged    tshArr/**
   * x movesacs[lels)
srcele 'etlby  ele '" }ath(0{
       Eve t} e Eve t oring} tex0/Arrr(moveCs[ls:n  },

   eh nder o._tereturcele '" }SwsrtW = p: fun{ele '" }Eht{
  Of   *.}
   r(moveCs[lsN    
    (et      }
a        
       .}
   r(moveCs[lsFm {To aram {ele '" }Swsrt,p: fun{ele '" }Ehtt      }

t2t2  * @
egSele '" }EAl(te
 ecele '" }SwsrthetineLe  * @pr(moveExtraneousSwet:s hetineLe  * @}
         else}
    .r(lineAll.str
t2t2  * @
eg oords stroked  * @fire('c    */'stroked  * @}
         else}
    .fire('pres:c    */', {e aDget:  els+}stroktshArr/**
   *   }
      el0{
       Eve t} e Eve t oring} tex0/Arr r(moveCs[lsN    
    :n  },

   eh nder o._tereturcele '" }SwsrtW = p0i{
       ngContext2D}}der o._tee.metaKey{ fi() {
 //"removeLallmtillmt_fosesrtWo  ,i++) { m {Ng / 10 thiss.fts.teB'fonaryO p: funfinds.teB'fonaryLeft te
 ecele '" }SwsrthetineLe  .}
   r(moveCs[lsFm {To s.fts.teB'fonary,p: fun{ele '" }Swsrthet      : fun{egSele '" }Swsrt s.fts.teB'fonary      {at         ._tee algKey{
        //"removeLallmtillmt_fosesrtWo  ,i++) { worl       thiss.ftWordB'fonaryO p: funfindWordB'fonaryLeft te
 ecele '" }SwsrthetineLe  .}
   r(moveCs[lsFm {To s.ftWordB'fonary,p: fun{ele '" }Swsrthet      : fun{egSele '" }Swsrt s.ftWordB'fonaryt      }
a        
       .}
   r(moveSlt.leC   AndSwet: : fun{ele '" }Swsrthet      : fun{egSele '" }Swsrt returcele '" }SwsrtW{
1het   {at  t
}    
/* _TO_SVG_START_x0/A('right') {
    tCom oFixediore   /** _ini oFixed        NUM_FRACTION_DIGITSiore   /**defaul.NUM_FRACTION_DIGITSetine */
    _iniacing:.eextAl(    /**I
   .  mto */
, /** @ngtdda    /**I
   .  mto */
Bai fiArray);
      ct  }
      el .0idth >psigSVGTeIndex TeIn  ivate
     * umber, presSpans, htoLin, neInd.    for g neInTop  for g neInBgRng: {
        0.85ate
  _eiglineSwet:   * umberhndex] = -1t2    /**
   .  mto */
.psigSVGTeIndex TeIne}
ll.te
 ,
        heretutextL, presSpans, htoLin, neInd.    for g neInTop  for t       ctx   ct2      }

      returpsigSVGTeIndex Cs[ls(
        heretutextL, presSpans, htoLin, neInd.    for g neInBgRng: {uldClear}xt2D}}shArray);
      ct  }
      el .0idth >psigSVGTeIndex Cs[ls:n  },

   retutextL, presSpans, htoLin, neInd.    for g neInBgRng: { li* rettttComcs[ls  (idth  neIndex line number
getHeightOttes[l  for (i 0,
        heretuL     for (i idth     htOfLine(ctx, iidth     htOfLeftOf._get== t,f * umber))O-2  * @unt = / 2,
        heretu  for (i idth     SVGdex Top  for    * umberh,
        hehlengthis.te(i idth     .lengthis.tef._get== t,  * umberhet  ConteerTextComeTopOlength -cs[ls         s  lineWidth, lineLeftedthissndCoDecl(i idth     SndCoDecl   

   retutextL, i{
 @p r}  ineLe    rresSpans.push(
        he  * @Hx eateT   e   Span 
this.widddddcs[ls[i],ssndCoDecl,(liniL     for geretu  for .f * TCl + retu  for .o for ,tes[l  for ))onilter t  thises[l;
      idth     Wnt =hiCs[l ._get== t,cs[ls[i],s  * umber, i{exilter t  0.85sndCoDeclnpresBackgr'fonColo render on
    neInBgRng: .push(
        hehe  * @Hx eateT   e   Bg 
this.widddddddsndCoDecl,(liniL     for geretu  for .f * TCl,ehlengthis.te,ses[l;
   ,tes[l  for ))onidddddddat  Conte ves[l  for (+=ses[l;
   uldClear}xt2D}}shArray);
      ct  }
      el .0idth >p   SVGdex Top  for :n  },

   retutextL{
        thissex Top  for TopOlenas .lengt  p0;       erTextComjTopO;mjT<ef * umber;mjth, li      heretuTop  for T+dsxtLin_eig.lengthis.tef._get== t,jt       ctx   ct2nas .lengt  pxtLin_eig.lengthis.tef._get== t,jt       c    0,

i      heretuTop:eretuTop  for             for :te else_fontSizeMultS-2  * @pfontSizeFra '" }r *2nas .lengt /te elseretu.lengt *  else_fontSizeMult)      ct;xt2D}}shArray);
      ct  }
      el .0idth >px eateT   e   Bg:n  },

   owdCoDecl,(liniL     for geretuTop  for g hlengthis.te,ses[l;
   ,tes[l  for )snder on
       [         '\t\t<r
 ' fill="',ssndCoDeclnpresBackgr'fonColo           '" x="',s oFixed(retuL     for (+tes[l  for , NUM_FRACTION_DIGITS)          '" y="',s oFixed(retuTop  for T-2  * @hlengt /t2, NUM_FRACTION_DIGITS)          '" unt =="',s oFixed(es[l;
   ,tNUM_FRACTION_DIGITS)          '" hlengt="',s oFixed(hlengthis.te(/  elseretu.lengt,tNUM_FRACTION_DIGITS)          '"></r
 '>\n' Of   *].join(''ton() {ashArray);
      ct  }
      el .0idth >px eateT   e   Span:n  },

   _cs[l, owdCoDecl,(liniL     for geretuTop  for g es[l  for )snd       thisfillSwet:st=  else   SvgSwet:se}
ll. */
    _iniacing:.eextAl(lineLeftedtisible:r.cti          eill:p: funfipe,
this.widstroke:p: fun{troke= this.widi*/
: 'pres', this.wid   SvgFil* r      /**defaul.  mto */
.   SvgFil* r      ct, owdCoDecl))onilter t       [         '\t\t\t<tspan x="',s oFixed(retuL     for (+tes[l  for , NUM_FRACTION_DIGITS)  '" y="', this.widioFixed(retuTop  for T-2  * @hlengt /t2, NUM_FRACTION_DIGITS)  '" ',
        he5sndCoDeclnfontFamily ? 'ernt-family="' + cndCoDeclnfontFamily.repldte(/"/g, '\''tW+ '" ' : ''),
        he5sndCoDeclnfontSize ? 'ernt-size="' + cndCoDeclnfontSize + '" ' : ''),
        he5sndCoDeclnfontSndCo ? 'ernt-sndCo="' + cndCoDeclnfontSndCo + '" ' : ''),
        he5sndCoDeclnfontWlengt ? 'ernt-wlengt="' + cndCoDeclnfontWlengt + '" ' : ''),
        he5sndCoDeclnpresDeco  

   ? 'pres-deco  

  ="' + cndCoDeclnpresDeco  

   + '" ' : ''),
        'sndCo="',sfillSwet:s  '">',
         */
    _inisctx[m.escapeXml _cs[l),
        '</tspan>\n' Of   *].join(''ton() {a
 w}str})    /* _TO_SVG_END_x0/A
A('right') global)snd   'use sctxct' {derthisf*/
  t= global.f*/
  t @p(global.f*/
  torn}),
       ldef iore   /** _iniacing:. ldef;hArr/**
   * T   box  lass  basedm   I
   ,r
llowda he(useom ot  sizea he(t   xr
 'at.le
   * rnd wrapsrm {Ns automrai}
lly. T   box t
havec heir Y cc
llt. lock*/,p: e
   * useomcan i}lywns[ngeiunt =. .lengt is adh = etlautomrai}
lly basedm   : e
   * wrapplt. herm {Ns.  Coct  lass2    /**
   box  Coct eextAlda    /**I
     Coct mix t
    /**deseovabCo  Coct     0,

    /**
   box}2  * Arn = -* @se   @m {k2    /**
   box#inichaln; } erTecnvowruct r dtf {i'" }ath(0/
 2    /**
   boxiore   /** _inix eateClass(    /**I
   ,
    /**deseovabCo, fiArray);
      ctT*/
Bheran oring} tex -* @ */
B ctx[m tex -* @default  el .0idth >i*/
: 'presbox'shArray);
      ctM {imumrunt = orit   box,  fapix   . tex -* @ */
B}
     tex -* @default  el .0idth >minWnt =:p20shArray);
      ctM {imumrcalcuhise funt = oriait   box,  fapix   . tex -* fixedi ot2 sohtha xrn emptyit   boxmcannotigoi ot0 tex -* rnd idasnillmcele 'abCoSwn goutipres, tex -* @ */
B}
     tex -* @default  el .0idth >dynamicMinWnt =:p2shArray);
      ctC */
drarrayrorit   xwrapplt., tex -* @ */
BArray  el .0idth >p_c */
ddex l:-'upe,
Array);
      ctOverridfosesonard defaul  lass values  el .0idth >lockSc
llt.Y:r.cti  Array);
      ctOverridfosesonard defaul  lass values  el .0idth >lockSc
llt.Flip:r.cti  Array);
      ctCnvowruct r. Some cc
llt.   hise fpeClertyivaluesrare erTced. Visibiltex      cto  ,ontrols 
  alsohfixed; i}lyw he( mt 

   rnd wnt = ,ontrols are      ctmadfoavailabCo, tex -* @        ctx[mett   x
    sctx[m tex -* @       default
[ipetur ] Opetur  oring} tex -* @    0,

    /**
   box}2  * Arn = - .0idth >inichaln; :n  },

   t   ,
ipetur {
        : fun== iore   /** _inix eateCring}Eleatur().   Cnvt   ('2d'het() {tt  * @}
llSuler('inichaln; 'g neIn,(ipetur {; = -1t2;
   s  CnvtrolsVisibiltex(    /**
   box.   
   boxCnvtrolVisibiltex())onilter t//"add wnt = s.c hisrm stWo  peClshtha xeffaul m {Nxwrapplt., tex -  else_diatusturAffaullt.ceCl @unt = or.ction() {a  Array);
      ctUnlike culer lass's versturrorithisr  },

  , T   box does notiupdis[      ctitsiunt =. tex -* @       Cring}R(linelt.Cnvt   2D} == iCnvt    s.cuse erTemeasureaturs tex -* @ }
      el .0 @overridf  el .0idth >pinicDiatusturs:n  },

   == {
  Of   *._teretur__skipDiatusturtnvasRenderingContext2D} ctxilter tpriv!== {
  Of   *  == iore   /** _inix eateCring}Eleatur().   Cnvt   ('2d'het() {tt  returpsig
   }ndCos == {ext2D} ctxilter t// clehisdynamicMinWnt = as  } willmbecdiffe+) { afs)
Lwe( e-wrap m {Ng / 10 returdynamicMinWnt =  p0; ilter t// wrap m {Ns tex -  else_neIndex l  param _splte
   Intodex l;strokedrn//"if afs)
Lwrapplt.,p: erunt =  dasm
ll)
  }rn dynamicMinWnt =,wns[ngei: erunt = rnd  e-wrap Of   *._tereturdynamicMinWnt = >2  * @unt =i{
           * @por  'unt =',(idth dynamicMinWnt ={ext2D} ctxilter t// clehisc */
 rnd  e-calcuhise hlengt tex -  else_clehiC */
;strokedrn;
   hlengt  pxtLin_eig
   .lengt == {ext2D}a  Array);
      ctGene ise an istory tha xtranshisesmt_fosedCo istory sohtha xit is      ctbrokev uplby visualrm {Ns e'urrm {Ns antlautomrai}Lwrapplt.). tex -* TseWoriginalrt    scet:stdstory 
  brokev uplby actualrm {Ns e'urrm {Ns i}ly),
     * whic=  dai}lywsufficie t srTe
    / I
     Co  ct  }
      el .0idth >p  ne ise}ndCoMat:n'right') {
      erthis ealdex C unt   eri 0,
        he ealdex Cs[lC unt i 0,
        hecs[lC unt         i 0,
        hemap               orn}et  ConteerTextComeTopO  s  l else_neIndex l         sth, li      he._tereturneIn[cs[lC unt]W =  .\n'    i >20render on
     ealdex Cs[lC unt i 0;
        hecs[lC unt++; this.width ealdex C unt++; this.wid}der on
       ._tereturneIn[cs[lC unt]W =  . '    i >20render on
    //  elssc    dealsron giopace'shtha xare r(move/( m {NehtOherm {Nsrohen"wrapplt.der on
     ealdex Cs[lC unt++; this.width}s[lC unt++; this.widat  Conte vmap[i] =m{rm {N:h ealdex C unt,   for :t ealdex Cs[lC unt }  ineLe    cs[lC unt + (idth  neIndex lii],
          v     ealdex Cs[lC unt + (idth  neIndex lii],
          v  }nilter t       mapon() {ashArray);
      ct        }
      return 0;  el  ct        }
      es[ltextL texex00;g !== 0Boop] n}r[      CldefOrEmpty=d_sho]  Co  ct  }
      el .0idth >p   SndCoDecl   

    ivate
     * umber, xs[ltextL,       CldefOrEmpty{
  Of   *._teretur_sndCoMat, lineLeftedthismap  param _sndCoMatine number
;i      he._te!mat, lineLefted t             CldefOrEmpty ?p r} :-'upe; this.wid}der on
  ne numberr=smaperetu;ineLe    cs[lumberr=smapeo for (+tes[lumber;ilterid}der on
        }
  }
llSuler('p   SndCoDecl   

  ',s  * umber, xs[ltextL,       CldefOrEmpty{on() {ashArray);
      ct        }
      return 0;  el  ct        }
      es[ltextL texex00;g !== 0default
sndCo  Co  ct  }
      el .0idth >ps  SndCoDecl   

    ivate
     * umber, xs[ltextL, sndCo{
      erthismap  param _sndCoMatine number
;i      ne numberr=smaperetu;ineLe  cs[lumberr=smapeo for (+tes[lumber;i = -1t2;
   scet:sine number
[es[lumber] =mscet:on() {ashArray);
      ct        }
      return 0;  el  ct        }
      es[ltextL texex00;g}
      el .0idth >pelleenSndCoDecl   

    ivate
     * umber, xs[ltextL{
      erthismap  param _sndCoMatine number
;i      ne numberr=smaperetu;ineLe  cs[lumberr=smapeo for (+tes[lumber;i = -1t2elleen2;
   scet:sine number
[es[lumber]on() {ashArray);
      ct        }
      return 0;  el  ct  }
      el .0idth >p   lineSwet::n  },

   retutextL{
        thismap  param _sndCoMatine number
;i      ngContp: fun{cet:simaperetu]on() {ashArray);
      ct        }
      return 0;  el  ct   !== 0default
sndCo  Co  ct  }
      el .0idth >ps  lineSwet::n  },

   retutextL, sndCo{
      erthismap  param _sndCoMatine number
;i      : fun{cet:simaperetu] =mscet:on() {ashArray);
      ct        }
      return 0;  el  ct  }
      el .0idth >pelleenlineSwet::n  },

   retutextL{
        thismap  param _sndCoMatine number
;i      elleen2;
   scet:simaperetu]on() {ashArray);
      ctWrapsrt    usingmsseW'unt ='fpeClertyiher
   box. Firstxthisr  },

        ctspltesrt    o  'urm {Ns, sohwe(preseove 'urm {Ns e * retlby  he(useo. tex -* Tsen  } wrapsr  */ m {NxusingmsseWunt = oritseWT   box by }
llx[m tex -* _wraps.tef). tex -* @       Cring}R(linelt.Cnvt   2D} == iCnvt    s.cuse erTemeasureaturs tex -* @        ctx[mett   x
he sctx[mrorit   xtha xistsplte into m {Ns tex -* @    0,s {Array}BArrayOherm {Ns  el .0idth >pwrapTeIn  ivate
   == t,t   et(lineWidthissex ses(i   .splte(.}
   r(Nuris._),"wrappedior[), set  ConteerTexeTopO  s  llex l         sth, li      hewrappediorwrapped.concae(.}
   wraps.tef== t,  * s[i],si){ext2D} ctxilter t    0,
urappedon() {ashArray);
      ctHelp)
 ivate
   s.cmeasure8ar ctx[mrorit   , givnertesrne numberrantlcs[lumberro for der o 
      ct        Cring}R(linelt.Cnvt   2D} ==  tex -* @        ctx[mett    tex -* @       n
      return 0;  el  ct   !== 0n
      es[lO for der o 
 @    0,s {n
           ct  }
      el .0idth >pmeasureTeIn  ivate
   == t,t   ,s  * umber, xs[l  for )snder on
thisw
    i 0;
      es[l  for (i es[l  for ( @p0;       erTextComeTopOlength - 1 -         s  lineWidth, lineLeftedw
    +dsxtLin_eigW
   hiCs[l == t,t   [i],s  * umber, i(+tes[l  for t       ctx   ct2    0,
unt =on() {ashArray);
      ctWrapsra m {Nxorit   xusingmsseWunt = oritseWT   box antla ,ontres, tex -* @       Cring}R(linelt.Cnvt   2D} == iCnvt    s.cuse erTemeasureaturs tex -* @        ctx[mett   x
he sctx[mrorit   xtotsplte into m {Ns tex -* @       }
      return 0;  el  ct     0,s {Array}BArrayOherm {N(s) into whic= tseWgivnert   xisturapped  el  ctto.  el .0idth >pwraps.te  ivate
   == t,t   ,s  * umberet(lineWidthissex Wnt =        i 0,
        heretus            or[),
        heretu             or'',
        heworls            ori   .splte(. '),
        heworl             or'',
        heo for (          or0,
        heinfix            or' ',
        heworlWnt =        i 0,
        heinfixWnt =       i 0,
        heraDgestWord;
      0,* retttttheretuJustSwsrtedior.cti,* retttttheaddi'" }alSpace   idth     Wnt =hiCs[lSpacx[m(het  ConteerTextComeTopO  s  lworls         sth, li      heworl =lworlsi+) {
     heworlWnt = or.}
   measureTeIn == t,worl,s  * umber, o for r  {
     heo for T+dsworl,
       der on
  ne nW
    +dsinfixWnt = +eworlWnt = -eaddi'" }alSpaceexilter t  0.85ne nW
    > p: fununt = && !retuJustSwsrted, lineLefted tlex l push(is._);
        heretu or'';
        heretu;
      worlWnt =;
        heretuJustSwsrtedior.cti; this.wid}der on
       lineLefted tlex W
    +dsaddi'" }alSpaceexthis.wid}di      he._te!retuJustSwsrted, lineLefted tlex  +dsinfix; this.wid}der on
  ne nT+dsworlet  Conte v0efixWnt = or.}
   measureTeIn == t,0efix,s  * umber, o for r  
     heo for ++; this.widretuJustSwsrtediord_shouldClear  // keepxtrackOhermaDgest worl        t0.85worlWnt = >eraDgestWord;
   , lineLefted tlaDgestWord;
      worlWnt =;
        }der on
txilter tp && lex l push(is._);

     t0.85laDgestWord;
    >(idth dynamicMinWnt ={{
           * @dynamicMinWnt =  plaDgestWord;
    -eaddi'" }alSpaceexer on
txilter t    0,
lex lon() {ashar  /;
      ctGetsrm {Ns orit   xtotr(lineh falser
   box. Thisr  },

  rcalcuhises tex -* t   xwrapplt.rona he(flyaeverytimexit is }
lled. tex -* @    0,s {Array}BArrayOherm {Nsh falser
   box. tex -* @overridf  el .0idth >psplte
   Intodex l:n'right') {
      erthisoriginalAlig}  param neInAlig}et() {tt  * @}tx.sav
;strokedrn;
   psig
   }ndCos   * @}txstrokedrn;
   neInAlig}W  'm   ' {
     thissex ses(i}
   wrapTeIn ._get== t,;
   neInstrokedrn;
   neInAlig}W  originalAlig}et() {tt  * @}tx.restor
;strokedrn;
   pneIndex l  plex lon() { param _sndCoMat   idth    ne ise}ndCoMat(t       c    0,
lex lon() {ashArray);
      ctWsen psrtWo  a gr'fp, wesdon' xwantalser
   box's cc
leLs.cinx ea   ._ tex -* tseWgr'fp'scinx ea  s. That'srohyLwe( educei: ercc
leLoritseWT   box by tex -* tseWam unt tha xtseWgr'fp'scinx ea  s. This 
  s.cmainta falsereffaulivn      ctsc
leLoritseWT   box a x1, sohtha xernt-sizeivaluesrmake cense. Olserwise tex -* tseWsameaernt-sizeivalue would resultS fadiffe+) { actualrsizeidependx[m tex -* ona he(value oritseWsc
le, tex -* @        ctx[metkey tex -* @       *}(value  el .0idth >sigOnGr'fp:n'right') key,(value{
  Of   *._tekeyW =  .sc
leX'{{
           * @or  'sc
leX', Math.abs(1 /(value{het() {tt  returor  'unt =',(( else    'unt ='r *2value{
/ineLefted t5 */
herretur__oldSc
leXW =  .uextf {Nd' ? 1o:p: fun__oldSc
leX{het() {tt  retur__oldSc
leXW 2valueuldClear}xt2D}}shArray);
      ctR   0,s 2d represent 

   fne numberWantlcs[lumber)Wo  ,i+   r(oom ele '" }osesrt). tex -* Overridfsmt_fosuler lass ivate
   s.ctake into acc unt t   xwrapplt., tex -* tex -* @       }
      [cele '" }Swsrt] Opeturalr.extL.tWsen notigivne, ,i++) { cele '" }SwsrtW
  used.  el .0idth >pig2DCi+   Loc
    :n  },

   oele '" }Swsrth
  Of   *._ter*/
hercele '" }SwsrtW = p.uextf {Nd'{{
         {ele '" }SwsrtO p: fun{ele '" }Swsrt     {n
txilter ttComnumdex l  param _neIndex l       ,
        he emove/(  p0; ilter terTextComeTopO  s  lnumdex lWidth, lineLeftedthisretu     (idth  neIndex lii],
this.widddddretuL n  plex ,
       der on
  0.85sele '" }SwsrtO<=e emove/(+dretuL n, lineLefted t       {
this.widddddretuumber: i,
this.widddddcs[lumber: {ele '" }SwsrtO-e emove/
this.widdd}exthis.wid}di      he emove/(+s(liniL n  der on
  0.85returneIn[ emove/]W =  .\n'  @p._getneIn[ emove/]W =  . ', lineLefted t  move/++; this.wid}der on
txilter t    0,

i      heretuumber: numdex l - 1,i      hecs[lumber: idth  neIndex linumdex l - 1],
     der on
ton() {ashArray);
      ctOverridfsmsuler lass ivate
   antluses t   xwrapplt.rdisaWto piga 
          ctb'fonaryOo for scinstead oritseWarrayrorics[ls  tex -* @       Array}Bcs[ls Unused  el  ct@        ctx[mett*/
OfB'fonaries Canmbec'c
    '( r '{ele '" }' tex -* @    0,s {default
defaul on gi'top'g 'm   ',prnd 'letuL   'fpeClertiesrcet.  el .0idth >p   C
    B'fonaries  for s:n  },

   =s[ls,tt*/
OfB'fonaries{
      erthistop  for TTTTTT  0,* rettttther     for (TTTT  0,* rettttthec
    Loc
    rs( ram pig2DCi+   Loc
    n),* retttttheretuCs[lsTTTTTT  idth  neIndex li,i+   Loc
    .f * umber].splte(.'),* retttttheretuL     for (i idth     htOfLine(ctx, iidth     htOfLeftOf._get== t,,i+   Loc
    .f * umber)het  ConteerTextComeTopO  s  l,i+   Loc
    .xs[ltextLWidth, lineLeftedr     for (+dsxtLin_eigW
   hiCs[l ._get== t,retuCs[ls[i],s,i+   Loc
    .f * umber, i{ext2D}n
txilter terTexeTopO  s  l,i+   Loc
    .f * umber;idth, lineLeftedtop  for T+dsxtLin_eig.lengthis.tef._get== t,i{ext2D}n
txilter t._ter*/
OfB'fonaries  =  .c
    ', lineLeftedtop  for T+ds(1 -2  * @pfontSizeFra '" }r *2xtLin_eig.lengthis.tef._get== t,,i+   Loc
    .f * umber)* rettttthe/  elseretu.lengt -2  * @   C
 +) {Cs[lFontSize(,i+   Loc
    .f * umber, ,i+   Loc
    .xs[ltextL)* rettttthe*s(1 -2  * @pfontSizeFra '" }rexer on
txilter t    0,
lineLeftedtop:dtop  for ,ineLeftedr   :dr     for getHeightOliniL   :eretuL     for der on
ton() {ashArray   MinWnt =:p'right') {
      er    0,
Math.maxf._getminWnt =,width dynamicMinWnt ={ext2D}}shArray);
      ctR   0,s dstory represent 

   heran instanco  Co  ct metnodi oOring} tex -* @       Array}B[peClertiesToInclude] AnyfpeClertiesrtha xyou moLin wantaloeaddi'" }allyaincludeh falseroutpu} tex -* @    0,

default
dstory represent 

   heran instanco  Co  cidth >ioOring}:p'right') peClertiesToIncludeisnder on
        }
  }
llSuler('ioOring}',p['minWnt ='].concae(peClertiesToIncludeiton() {a
 w}strrr/**
   * x   0,s     /**
   boxiinstanco( m {Nan istory represent 

  
   * @st 

c
o  ct me    Of2    /**
   box  Coct   !== 0default
istory defaul loex eateran instanco( m {  Coct   !== 0Fright')}B[}
llback] CallbackLs.cinvoke ohen"an     /**
   boxiinstanco(is } eate/ thi0{
    0,

    /**
   box}2instanco(of2    /**
   box  Coc/
 2    /**
   box. m {defaul =n  },

   oefaul, }
llbackh nder otCom 1 -boxior'urr    /**
   box oefaul.t   ,s ldef oefauliton() {}
llback && }
llback( 1 -box{              1 -box    }trrr/**
   * x   0,s lserdefault ,ontrols visibiltex   quiretlsrTe
   box t. thi0{
    0,s {default  Coc/
 2    /**
   box.   
   boxCnvtrolVisibiltex =n  },

   )
             nder on
tl:rd_shogetHeightr:rd_shogetHeighbr:rd_shogetHeighbl:rd_shogetHeighml:r.cti        mt:rd_shogetHeighmr:r.cti        mb:rd_shogetHeighmtr:r.cti
 on
ton()}  i})er*/
herexpor sc!=  .uextf {Nd' ? expor sc: idth    
('right') {
  rrr/**
   * OverridfopsigdefaulSc
le antladdWT   box specifict  sizlt.rbehavi r. R sizlt.
   * a T   box doesn' xcc
leLs   ,sit i}lywns[ngesrunt = rnd makes t   xwrap automrai}
lly.  Coc/
 2tCom egdefaulSc
leOverridd n  p    /**Cring}.  mto */
.psigdefaulSc
leetine */
   Cring}.  mto */
.psigdefaulSc
le =n  },

   loc
lMouse,xtranssrTm,
this.widdddddddddddddddddddddddddddddddddddddddddddddlockSc
llt.X,>lockSc
llt.Y, by,>lockSc
llt.Flip, _diarendder othis (i iranssrTm. aDget      ._ter2instancoof2    /**
   box)snder on
thisw(i inunt = *s( loc
lMouse.xe/  ranssrTm.sc
leX) /te nunt = + in{trokeWnt ={); a     privw > p:.   MinWnt =(hndex] = -1t2tror  'unt =',(whet() {tt  ngContr.ction() {ar}xt2D}}dt2D}     
       ngContp egdefaulSc
leOverridd ne}
ll. */
   Cring}.  mto */
,>loc
lMouse,xtranssrTm,
this.widlockSc
llt.X,>lockSc
llt.Y, by,>lockSc
llt.Flip, _diaron() {a
 w};hArr/**
   * Sr sc,ontrols orithisrgr'fpLs.c he(
   box's cpecialc,onfigu  

   ._ tex* ono(is presenth falsergr'fp. Dlleens _cnvtrolsVisibiltex olserwise, sohtha  tex* it gr scinichaln; di otdefault value a xruntime.  Coc/
 2 */
   Gr'fp.  mto */
.prefreshCnvtrolsVisibiltex =n  },

   )
      ._ter*/
her    /**
   boxio= p.uextf {Nd'{{
       ngContext2D}}der oerTextComeTop  * @poefauls         s--;{
  Of   *._teretur_oefauls[i] instancoof2    /**
   box)snder on
t2;
   s  CnvtrolsVisibiltex(    /**
   box.   
   boxCnvtrolVisibiltex())on() {tt  ngConton() {ar}xt2D}}dt2} {derthis ldef ore   /** _iniacing:. ldef;hArr */
    _iniacing:.eextAl(    /**
   box.  mto */
, /** @ngtdda    /**I
   .  mto */
Bai fit2D});
      ct  }
      el .0idth >pr(moveExtraneousSwet:s:p'right') {
      ererTextCompeClh falstur_sndCoMat, lineLefted0.85ate
  _neIndex lipeCl]  lineLefted telleen2;
   scet:siaram _sndCoMatipeCl]eretu]on() { {ar}xt2D}ar}xt2D}}shArray);
      ctI}sertsosedCo istory erTea givnerretu/}hdthin 0;  el  ct        }
      ne numberWumberro ra m {N  el  ct        }
      cs[lumberrumberro ra cs[l  el  ct        default
[sedCo] SedCo istory s.cinsert,d0.8givne  el .0idth >i}sertCs[lSedCoOring}:p'right')   * umber, xs[ltextL, sndCo{
      er//"adh = rne numberrantlcs[lumberder on
thismap  param _sndCoMatine number
;i      ne numberr=smaperetu;ineLe  cs[lumberr=smapeo for (+tes[lumber;i = -1t2    /**I
   .  mto */
.i}sertCs[lSedCoOring}.apply.te
 , [  * umber, xs[ltextL, sndCo]{ext2D}}shArray);
      ctI}sertso'urrsedCo istory  el  ct        }
      ne numberWumberro ra m {N  el  ct        }
      cs[lumberrumberro ra cs[l  el  ct        Boop] n}risEndhis.te(Tcti priit'srehtOherm {Ng / 1.0idth >i}sertNuris._SedCoOring}:p'right')   * umber, xs[ltextL, isEndhis.te{
      er//"adh = rne numberrantlcs[lumberder on
thismap  param _sndCoMatine number
;i      ne numberr=smaperetu;ineLe  cs[lumberr=smapeo for (+tes[lumber;i = -1t2    /**I
   .  mto */
.i}sertNuris._SedCoOring}.apply.te
 , [  * umber, xs[ltextL, isEndhis.te]{ext2D}}shArray);
      ctShifgsrm {N scet:stup  r down. Thisr  },

  ristsloLinlywdiffe+) {  }rn lserono(i       ctineIn_behavi ur as  } takes into acc unt t_fosedCoMat, tex -* tex -* @       }
      ne numberWumberro ra m {N  el  ct        }
      o for (Canmbec-1  r +1g / 1.0idth >ohifglineSwet:s:n  },

   retutextL, o for )snder on
//"ohifgLallmm {N scet:stby 1tupwarl       this ldefdSwet:st=  ldef ;
   scet:s),* rettttthemap           param _sndCoMatine number
;i     er//"adh = rne nhin 0;  el   ne numberr=smaperetu;i     ererTextComne nhin2;
   scet:s, lineLeftedthisnume /*Letu or   snum    * , 10{exilter t  0.85nume /*Letu >s  * umberet(lineWiddddd;
   scet:sinume /*Letu + o for ]t=  ldefdSwet:sinume /*Letu]exilter t   tpriv!=ldefdSwet:sinume /*Letu - o for ]) {
this.widddddelleen2;
   scet:sinume /*Letu]exis.widdddd}der on
  }xt2D}ar}xt2D}er//TODO: evaluaterprielleen2oldrsedCo sex seon gio for (-1xt2D}}shArray);
      ctFigu eroutmpeCg   rai}
lly  he(t   x  rprevi us actualrm {N (actualr=p e    'etlby \}rexer on* tex -* @       }
      nrn 0;  el  ct     0,s { ctx[me      ct  }
      el .0idth >p   
   OnPrevi uss.te  ivate
   lumberet(lineWidthist   OnPrevi uss.te  (idth  neIndex linumberr- 1]  ineLe  whilet(aram _sndCoMatinumberr- 2]     else_sndCoMatinumberr- 2].retu o= param _sndCoMatinumberr- 1].retu)snder on
t2;   OnPrevi uss.te  (idth  neIndex linumberr- 2] +2;   OnPrevi uss.te  der on
  number--;xt2D}ar}x       ngContp;   OnPrevi uss.te  t2D}}shArray);
      ctx movesasedCo istory  el  ct        Boop] n}risBeginnx[mhis.te(Tcti pri,i+   r
  at t_fobeginnx[mOherm {Ng / 1.0 @       }
      [imber] Opeturalr.extL.tWsen notigivne, ,i++) { cele '" }SwsrtW
  used.  el .0idth >r(moveSedCoOring}:p'right') isBeginnx[mhis.te,r.extL{ li* rettttComc
    Loc
    rs( ram pig2DCi+   Loc
    nimberh,
        hemap             param _sndCoMati,i+   Loc
    .f * umber],
        heretutextL       pmaperetu,
        hecs[ltextL       pmapeo for (+tei+   Loc
    .xs[ltextLW
      .}
   r(moveSedCoOring} isBeginnx[mhis.te,rei+   Loc
    ,s  * umber, xs[ltextLton() {a
 w}str})     
('right') {
  erthisoverridfo=2    /**I
   .  mto */
.p   NurSele '" }SwsrtFm {O for trok/**
   * Overridfs lserI
    impleatur 

   rnd adh = sacs[lels)
r.extL as lsere istnogLalwaysra m {Nbreak
 on* tex0 @       }
      mouse  for der 0 @       }
      prevWnt =der 0 @       }
      wnt =der 0 @       }
      in 0;  el0 @       }
      jngt
l  ct     0,s {N
         c/
 2 */
   I
   .  mto */
.p   NurSele '" }SwsrtFm {O for  =n  },

   mouse  for , prevWnt =, w
   ,r.extLlejngt)
      .mberr=soverridfe}
ll.te
 , mouse  for , prevWnt =, w
   ,r.extLlejngt) {     // lser.mberrpassedminto  he(f },

  ristpaddetlby  he(am unt herm {Nsh m {NpneIndex l (to acc unt erTe\}r     // we 'u di otremoveLthisrpaddlt.,prnd pad  } by actualrm {Ns,prnd /  r opaceshtha xare meantaloebe lsere
eWidthistmp      p0,* rettttt emove/( p0; ilter//"acc unt erTe emove/(cs[lels)
sder oerTextComeTopO  s  l else_neIndex l         sth, li      tmp + (idth  neIndex lii],
        Of   *._termp +e emove/(>=r.extL{ li retttttbreakuldClear}x Of   *._tereturneIn[rmp +e emove/]W =  .\n'  @p._getneIn[rmp +e emove/]W =  . ', lineLefted  move/++; this.w}xt2D}}dilter       .extLr- i +e emove/on()}  })     
('right') {
  
  ._ter*/
herdocuaturc!=  .uextf {Nd'     */
herw.exowc!=  .uextf {Nd')
            on()}{derthisDOMP  snr =   quire('xmldom').DOMP  snr,* retttURL =   quire('url'),* retttHTTP =   quire('http'),* retttHTTPS =   quire('https'),** retttCring} =   quire('}
    '),* retttImageior  quire('}
    ').Image;hArr/**t  }
     c/
 2  },

  r  quest(url,rehcodlt.,p}
llbackh nder otComoURL = URL.   sn(url) {     // deenry 
f http  r httpsW
  used
   *._te !oURL. ortW, lineLeftoURL. ortW=te oURL.  mtocol..extLOf('https:')
 = p0 ) ? 443 : 80;xt2D}}dilter//"assig}W  quest }rndl)
 basedm     mtocolder otCom  qHrndl)
 =teoURL.  mtocol..extLOf('https:')
 = p0 ) ? HTTPS : HTTP,* rettttt eqior  qHrndl)
.  quest({
this.widddhostname  oURL.hostname,
        he ort:toURL. ort,
        he a =:poURL. a  ,
        hemetnod: 'GET'
        },n  },

   response) {
this.widddtCombody or'';
        he._teehcodlt.) {
this.widddddresponse s  Ehcodlt.eehcodlt.)exis.widdddd}der on
  ddresponse    'en/',   },

  r() {
this.widdddd}
llback(body)exis.widdddd})exis.widddddresponse    'disa',   },

  r(chunk) {
this.widdddd._teresponse sr 
usCod_hd= p200) {
this.widdddd mbody +=sesunk;
this.widdddd}xis.widdddd})exis.widdd}) {       q    'error',   },

  (err{
  Of   *._teerr.errnohd= p  mcess.ECONNREFUSEDndex] = -1t2    /**log('ECONNREFUSED:c,onne,

  r  fusedaloe' + oURL.hostname + ':' + oURL. ortt       ctx   ct2      }

          /**log(err.messaget       ctx   ct2}
llback('upeton() {a) {       q tAl()on()}{der/**t  }
     c/
 2  },

  r  questFs( a  ,p}
llbackh nder otComf} =   quire('fs'het() {f .r(adFile( a  ,p  },

  r(err,rdisa{
  Of   *._teerrndex] = -1t2    /**log(errnet() {tt  rerowcerr       ctx   ct2      }

      }
llback(disa{; this.w}xt2D}})on()}{der */
    _iniloadImageior  },

  (url,r}
llback, ,ontresndex] =   },

  rc eateImageAndCallBack(disa{
  Of   *._tedisa{
  Of   * *.mg.srcior'urrBuffe+edisa, 'binary'net() {tt  //"preseovx[mOhriginalrurl,rwhic= seemsaloebe losthin2nod_-}
     Of   * *.mg._srciorurl;}

      }
llback && }
llbacke}
ll.,ontres,*.mgt       ctx   ct2      }

      .mgior'upe; this.wid}
llback && }
llbacke}
ll.,ontres,*'upe,r.cti{; this.w}xt2D}}der otCom.mgior'urrImage(t      ._teurl && eurl instancoof2Buffe+  @purl..extLOf('disa')
 = p0hndex] = -1.mg.srcior.mg._srciorurl;}

    }
llback && }
llbacke}
ll.,ontres,*.mgt      at         ._teurl && url..extLOf('http')W!= p ringContex  questFs(url,r} eateImageAndCallBackt      at         ._teurlringContex  quest(url,r'binary',r} eateImageAndCallBackt      at         {}

    }
llback && }
llbacke}
ll.,ontres,*url) {    at  };hArr */
   loadSVGFm {URL =   },

  (url,r}
llback, reviverringConturl orurl.repldte(/^\n\s*/, '').repldte(/\?.*$/, '').trim(t      ._teurl..extLOf('http')W!= p ringContex  questFs(url,r  },

  (body)dex] = -1t2    /**loadSVGFm { ctx[m(body.to ctx[m(),r}
llback, reviverr; this.w}t      at         {}

      quest(url,r'',r  },

  (body)dex] = -1t2    /**loadSVGFm { ctx[m(body,r}
llback, reviverr; this.w}t      at  };hArr */
   loadSVGFm { ctx[m =   },

  (sctx[m,r}
llback, reviverringConttComdocior'urrDOMP  snr().   snFm { ctx[m(sctx[mhet() {f*/
      snSVGDocuatur(doc.docuaturEleatur,n  },

   results,
ipetur {
        }
llback && }
llback(results,
ipetur {  t2D}}s reviverr; th};hArr */
    _ini   Script =   },

  (url,r}
llback)
        quest(url,r'',r  },

  (body)dex] = -1//"esm {t-disabCo-nres-retu no-evalx   ct2 val(body)exis.wid}
llback && }
llback(ton() {a) { w};hArr//re   /** _inix eateCring}Eleatur =   },

  (_, w
   ,rhlengt)dex] //rer       'urrCring}(w
   ,rhlengt);x] //r}{der/**n() * O}lywavailabCo ohen"runnx[mOf*/
  ton2nod_.jsn() * @       }
      wnt =tCring} wnt =der 0 @       }
      hlengt Cring} hlengt tex* @       default
[ipetur ] Opetur  loepass loeF*/
  Cring}. tex* @       default
[nod_Cring}Opetur ] Opetur  loepass loeNod_Cring}. thi0{
    0,  default
wrappedi}
     instanco  Coc/
 2 */
   x eateCring}ForNodeior  },

  (w
   ,rhlengt,
ipetur , nod_Cring}Opetur )dex] = nod_Cring}Opetur ior'od_Cring}Opetur i @pipetur ;dder othiscring}Elo=2    /**docuatur x eateEleatur('}
    '),* rettt= nod_Cring}ior'urrCring}(w
   i @p600,rhlengti @p600,rnod_Cring}Opetur ),* rettt= nod_Crch_Cring}ior'urrCring}(w
   i @p600,rhlengti @p600,rnod_Cring}Opetur ) {     // jsdom doesn' xx eatersedCo ini}
     eleatur,nso sere be lemp. workar'fon
.wid}
ing}El scet: =p r}  ineLe}
ing}El w
    i nod_Cring}.unt =on() {}
ing}El hlengt  pnod_Cring}.hlengton() {opetur ioropetur i @p{
ton() {opetur .nod_Cring}ior'od_Cring}on() {opetur .nod_Crch_Cring}ior'od_Crch_Cring};der othisF*/
  Cring}  p    /**Cring}i @p    /**St 

cCring},
         */
  Cring}ior'urrF*/
  Cring}(}
ing}El,
ipetur {  t2D} */
  Cring}.nod_Cring}ior'od_Cring}on() { */
  Cring}.nod_Crch_Cring}ior'od_Crch_Cring};der o */
  Cring}.,ontresCnvtaetur  pnod_Cring}.   Cnvt   ('2d'het() { */
  Cring}.,ontresC */
 or'od_Crch_Cring}.   Cnvt   ('2d'het() { */
  Cring}.Font orCring}.Font;         0,  */
  Cring} { w};hArrthisoriginaInitSt 

c  p    /**St 

cCring}.  mto */
.pinitSt 

c;
 2 */
   St 

cCring}.  mto */
.pinitSt 

cior  },

  (el,
ipetur {
      elo=2elo @p    /**docuatur x eateEleatur('}
    ');     ._getnod_Cring}ior'urrCring}(el w
   ,2el.hlengt);x]   ._getnod_Crch_Cring}ior'urrCring}(el w
   ,2el.hlengt);x]   originaInitSt 

ce}
ll.te
 , el,
ipetur {  t2D} }
  }ontresCnvtaetur  p._getnod_Cring}.   Cnvt   ('2d'het() { }
  }ontresC */
 or._getnod_Crch_Cring}.   Cnvt   ('2d'het() { }
  Font orCring}.Font;   }{der/**t ignoreoc/
 2 */
   St 

cCring}.  mto */
.x eatePNG cte   =n  },

   )
             ._getnod_Cring}.x eatePNG cte  (r; th};hArr */
   St 

cCring}.  mto */
.x eateJPEG cte   =n  },

   ipes)
             ._getnod_Cring}.x eateJPEG cte   ipes); th};hArr */
   St 

cCring}.  mto */
.pinitRetinaSc
llt. =n  },

   )
      ._teate
  _isRetinaSc
llt.(hndex] = -1ngContext2D}}dt() { }
  lowerCring}El s  Atctxbute 'unt =',(idth unt = *s    /**devicePix  R 

 het() { }
  lowerCring}El s  Atctxbute 'hlengt',(idth hlengt *     /**devicePix  R 

 het() { }
  nod_Cring}.unt = =(idth unt = *s    /**devicePix  R 

 et() { }
  nod_Cring}.hlengt  pxtLinhlengt *     /**devicePix  R 

   t2D} }
  }ontresCnvtaetur.sc
le(    /**devicePix  R 

 ,     /**devicePix  R 

 het() {       ._ge; th};h  ._te    /**Cring}ndex] =  */
   Cring}.  mto */
.pinitRetinaSc
llt. =n */
   St 

cCring}.  mto */
.pinitRetinaSc
llt.on()}{derthisorigSesBackstor
Diatustur =n */
   St 

cCring}.  mto */
.psesBackstor
Diatustur;
 2 */
   St 

cCring}.  mto */
.psesBackstor
Diatustur =n  },

   peCl,(value{
  Of  origSesBackstor
Diatusture}
ll.te
 , peCl,(value{et() { }
  nod_Cring}ipeCl]W 2valueuldCle       ._ge; th};h  ._te    /**Cring}ndex] =  */
   Cring}.  mto */
.psesBackstor
Diatustur =n */
   St 

cCring}.  mto */
.psesBackstor
Diatustur;
 2}
 })     
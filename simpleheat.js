'use strict';

if (typeof module !== 'undefined') module.exports = simpleheat;

function simpleheat(canvas) {
    if (!(this instanceof simpleheat)) return new simpleheat(canvas);

    this._canvas = canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;

    this._ctx = canvas.getContext('2d');
    this._width = canvas.width;
    this._height = canvas.height;

    this._max = 1;
    this._data = [];
    this._intensityBuffer = new Float32Array(this._width * this._height);
    this._countBuffer = new Uint16Array(this._width * this._height); // Assumes no more than 65535 overlaps
}

simpleheat.prototype = {

    defaultRadius: 25,

    defaultGradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
    },

    data: function (data) {
        this._data = data;
        return this;
    },

    max: function (max) {
        this._max = max;
        return this;
    },

    add: function (point) {
        this._data.push(point);
        return this;
    },

    clear: function () {
        this._data = [];
        return this;
    },

    radius: function (r, blur) {
        blur = blur === undefined ? 15 : blur;

        // create a grayscale blurred circle image that we'll use for drawing points
        var circle = this._circle = this._createCanvas(),
            ctx = circle.getContext('2d', { willReadFrequently: true }),
            r2 = this._r = r + blur;

        circle.width = circle.height = r2 * 2;

        ctx.shadowOffsetX = ctx.shadowOffsetY = r2 * 2;
        ctx.shadowBlur = blur;
        ctx.shadowColor = 'black';

        ctx.beginPath();
        ctx.arc(-r2, -r2, r, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();

        return this;
    },

    resize: function () {
        this._width = this._canvas.width;
        this._height = this._canvas.height;
    },

    gradient: function (grad) {
        // create a 256x1 gradient that we'll use to turn a grayscale heatmap into a colored one
        var canvas = this._createCanvas(),
            ctx = canvas.getContext('2d', { willReadFrequently: true }),
            gradient = ctx.createLinearGradient(0, 0, 0, 256);

        canvas.width = 1;
        canvas.height = 256;

        for (var i in grad) {
            gradient.addColorStop(+i, grad[i]);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, 256);

        this._grad = ctx.getImageData(0, 0, 1, 256).data;

        return this;
    },

    draw: function (minOpacity) {
        if (!this._circle) this.radius(this.defaultRadius);
        if (!this._grad) this.gradient(this.defaultGradient);

        var ctx = this._ctx;
        var tempCanvas = document.createElement('canvas');
        var tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this._width;
        tempCanvas.height = this._height;

        ctx.clearRect(0, 0, this._width, this._height);
        tempCtx.clearRect(0, 0, this._width, this._height);

        // Draw each point in a temporary canvas and calculate intensity
        for (var i = 0, len = this._data.length, p; i < len; i++) {
            p = this._data[i];
            var intensity = Math.min(Math.max(p[2] / this._max, minOpacity === undefined ? 0.05 : minOpacity), 1);
            tempCtx.globalAlpha = intensity;
            tempCtx.drawImage(this._circle, p[0] - this._r, p[1] - this._r);
        }

        // Accumulate intensities and counts
        var tempData = tempCtx.getImageData(0, 0, this._width, this._height).data;
        for (var y = 0; y < this._height; y++) {
            for (var x = 0; x < this._width; x++) {
                var idx = (y * this._width + x) * 4;
                var alpha = tempData[idx + 3] / 255;
                this._intensityBuffer[y * this._width + x] += alpha;
                this._countBuffer[y * this._width + x] += 1;
            }
        }

        // Colorize using the average intensity
        var colored = ctx.getImageData(0, 0, this._width, this._height);
        this._colorize(colored.data, this._grad, this._intensityBuffer, this._countBuffer);
        ctx.putImageData(colored, 0, 0);

        // Reset buffers
        this._intensityBuffer.fill(0);
        this._countBuffer.fill(0);

        return this;
    },

    _colorize: function (pixels, gradient, intensityBuffer, countBuffer) {
        for (var i = 0, len = pixels.length / 4; i < len; i++) {
            if (countBuffer[i] > 0) {
                var avgIntensity = intensityBuffer[i] / countBuffer[i];
                var j = Math.floor(avgIntensity * 255) * 4;
                pixels[i * 4] = gradient[j];
                pixels[i * 4 + 1] = gradient[j + 1];
                pixels[i * 4 + 2] = gradient[j + 2];
                pixels[i * 4 + 3] = 255; // Full opacity
            }
        }
    },

    _createCanvas: function () {
        if (typeof document !== 'undefined') {
            return document.createElement('canvas');
        } else {
            // create a new canvas instance in node.js
            // the canvas class needs to have a default constructor without any parameter
            return new this._canvas.constructor();
        }
    }
};

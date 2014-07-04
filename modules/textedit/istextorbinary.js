/*

Licensed under the incredibly permissive MIT license (http://creativecommons.org/licenses/MIT/)

Copyright (c) 2012+ Bevry Pty Ltd <us@bevry.me> (http://bevry.me)
Copyright (c) 2011 Benjamin Lupton <b@lupton.cc> (http://balupton.com)

*/

(function() {
  var binaryExtensions, isTextOrBinary, pathUtil, safefs, textExtensions,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };
  pathUtil = require('path');
  safefs = require('safefs');
  textExtensions = require('textextensions');
  binaryExtensions = require('binaryextensions');
  isTextOrBinary = {
    isTextSync: function(filename, buffer) {
      var extension, isText, _i, _len;
      isText = null;
      if (filename) {
        filename = pathUtil.basename(filename).split('.');
        for (_i = 0, _len = filename.length; _i < _len; _i++) {
          extension = filename[_i];
          if (__indexOf.call(textExtensions, extension) >= 0) {
            isText = true;
            break;
          }
          if (__indexOf.call(binaryExtensions, extension) >= 0) {
            isText = false;
            break;
          }
        }
      }
      if (buffer && isText === null) {
        isText = isTextOrBinary.getEncodingSync(buffer) === 'utf8';
      }
      return isText;
    },
    isText: function(filename, buffer, next) {
      var result;
      result = isTextOrBinary.isTextSync(filename, buffer);
      if (result instanceof Error) {
        next(err);
      } else {
        next(null, result);
      }
      return this;
    },
    isBinarySync: function(filename, buffer, next) {
      var result;
      result = isTextOrBinary.isTextSync(filename, buffer);
      if (result instanceof Error) {
        return result;
      } else {
        return !result;
      }
      return this;
    },
    isBinary: function(filename, buffer, next) {
      isTextOrBinary.isText(filename, buffer, function(err, result) {
        if (err) {
          return next(err);
        }
        return next(null, !result);
      });
      return this;
    },
    getEncodingSync: function(buffer, opts) {
      var binaryEncoding, charCode, chunkBegin, chunkEnd, chunkLength, contentChunkUTF8, encoding, i, textEncoding, _i, _ref;
      textEncoding = 'utf8';
      binaryEncoding = 'binary';
      if (opts == null) {
        chunkLength = 24;
        encoding = isTextOrBinary.getEncodingSync(buffer, {
          chunkLength: chunkLength,
          chunkBegin: chunkBegin
        });
        if (encoding === textEncoding) {
          chunkBegin = Math.max(0, Math.floor(buffer.length / 2) - chunkLength);
          encoding = isTextOrBinary.getEncodingSync(buffer, {
            chunkLength: chunkLength,
            chunkBegin: chunkBegin
          });
          if (encoding === textEncoding) {
            chunkBegin = Math.max(0, buffer.length - chunkLength);
            encoding = isTextOrBinary.getEncodingSync(buffer, {
              chunkLength: chunkLength,
              chunkBegin: chunkBegin
            });
          }
        }
      } else {
        chunkLength = opts.chunkLength, chunkBegin = opts.chunkBegin;
        if (chunkLength == null) {
          chunkLength = 24;
        }
        if (chunkBegin == null) {
          chunkBegin = 0;
        }
        chunkEnd = Math.min(buffer.length, chunkBegin + chunkLength);
        contentChunkUTF8 = buffer.toString(textEncoding, chunkBegin, chunkEnd);
        encoding = textEncoding;
        for (i = _i = 0, _ref = contentChunkUTF8.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
          charCode = contentChunkUTF8.charCodeAt(i);
          if (charCode === 65533 || charCode <= 8) {
            encoding = binaryEncoding;
            break;
          }
        }
      }
      return encoding;
    },
    getEncoding: function(buffer, opts, next) {
      var result;
      result = isTextOrBinary.getEncodingSync(buffer, opts);
      if (result instanceof Error) {
        next(err);
      } else {
        next(null, result);
      }
      return this;
    }
  };
  module.exports = isTextOrBinary;
}).call(this);

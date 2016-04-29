"use strict";

var es        = require('event-stream'),
    through   = require('through'),
    gutil     = require('gulp-util'),
    crypto    = require('crypto'),
    path      = require('path'),
    slash     = require('slash'),
    appRoot = require('app-root-path'),
    gulp = require('gulp'),
    lineBreak = '\n';

function zabcache(options) {
  options = options || {};
  var contents = [];
  var firstline = "# ";
  contents.push('CACHE MANIFEST');

  var filename = options.filename || 'manifest.appcache';
  var exclude = [].concat(options.exclude || []);
  var hasher = crypto.createHash('sha256');



  if(options.addpkgversion){
    var pkg = require(appRoot + '/package.json');
    firstline = firstline + pkg.name + " version:" + pkg.version;
  }

  if (options.timestamp) {
    firstline = firstline +  " " +new Date();
  }

  if (options.revision) {
    firstline = firstline +  " " +options.revision;
  }

  if (options.indexfile) {
    if(!options.indexroot)options.indexroot = "";

    var  replace = require('gulp-replace')
         ,indexpath = options.indexroot + "/" + options.indexfile;

    gulp.src([indexpath])
      .pipe(replace('<html', '<html manifest="' + options.filename + '"'))
      .pipe(gulp.dest(options.indexroot));

  }

  contents.push(firstline);

  contents.push(lineBreak);
  contents.push('CACHE:');

  if (options.fileList) {
    for (var i in options.fileList) {
      contents.push(options.fileList[i]);
    }
  }

  function writeToManifest(file) {
    if (file.isNull())   return;
    if (file.isStream()) return this.emit('error', new gutil.PluginError('gulp-manifest',  'Streaming not supported'));

    if (exclude.indexOf(file.relative) >= 0) {
      return;
    }

    contents.push(((options.relativePath|| '').replace(/([^\/])$/, "$1/") || '')+encodeURI(slash(file.relative)));

    if (options.hash) {
      hasher.update(file.contents, 'binary');
    }
  }

  function endStream() {
    // Network section
    options.network = options.network || ['*'];
    contents.push(lineBreak);
    contents.push('NETWORK:');
    options.network.forEach(function (file) {
      contents.push(encodeURI(file));
    });

    // Fallback section
    if (options.fallback) {
      contents.push(lineBreak);
      contents.push('FALLBACK:');
      options.fallback.forEach(function (file) {
        var firstSpace = file.indexOf(' ');
        if(firstSpace === -1) {
          return gutil.log('Invalid format for FALLBACK entry', file);
        }
        contents.push(
          encodeURI(file.substring(0, firstSpace)) +
          ' ' +
          encodeURI(file.substring(firstSpace + 1))
        );
      });
    }

    // Settings section
    if (options.preferOnline) {
      contents.push(lineBreak);
      contents.push('SETTINGS:');
      contents.push('prefer-online');
    }

    // output hash to cache manifest
    if (options.hash) {
      contents.push('\n# hash: ' + hasher.digest("hex"));
    }

    var cwd = process.cwd();
    var manifestFile = new gutil.File({
      cwd: cwd,
      base: cwd,
      path: path.join(cwd, filename),
      contents: new Buffer(contents.join(lineBreak))
    });

    this.emit('data', manifestFile);
    this.emit('end');
  }

  return through(writeToManifest, endStream);
}

module.exports = zabcache;

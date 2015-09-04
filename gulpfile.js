/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var gulp = require('gulp');
var del = require('del');
var fs = require('fs');
var ghPages = require('gh-pages');
var packageJson = require('./package.json');
var path = require('path');
var runSequence = require('run-sequence');
var swPrecache = require('sw-precache');

var DEV_DIR = 'src';
var DIST_DIR = 'dist';

function writeServiceWorkerFile(rootDir, handleFetch, callback) {
  var config = {
    cacheId: packageJson.name,
    // If handleFetch is false (i.e. because this is called from generate-service-worker-dev), then
    // the service worker will precache resources but won't actually serve them.
    // This allows you to test precaching behavior without worry about the cache preventing your
    // local changes from being picked up during the development cycle.
    handleFetch: handleFetch,
    // logger: $.util.log,
    staticFileGlobs: [
      rootDir + '/**.css',
      rootDir + '/**.html',
      rootDir + '/**.js',
    ],
    stripPrefix: rootDir + '/',
    // verbose defaults to false, but for the purposes of this demo, log more.
    verbose: true
  };

  swPrecache.write(path.join(rootDir, 'service-worker.js'), config, callback);
}

gulp.task('default', ['build']);

gulp.task('build', function(callback) {
  runSequence('copy-dev-to-dist', 'generate-service-worker-dist', callback);
});

gulp.task('clean', function() {
  del.sync([DIST_DIR]);
});

gulp.task('serve-dev', ['generate-service-worker-dev'], function() {
  runExpress(3001, DEV_DIR);
});

gulp.task('serve-dist', ['build'], function() {
  var express = require('express');

  var server = express();
  server.use(express.static(__dirname + '/dist'));

  var port = 10001;
  server.listen(port, function() {
      console.log('server listening on port ' + port);
  });

});

gulp.task('gh-pages', ['build'], function(callback) {
  ghPages.publish(path.join(__dirname, DIST_DIR), callback);
});

gulp.task('generate-service-worker-dev', function(callback) {
  writeServiceWorkerFile(DEV_DIR, false, callback);
});

gulp.task('generate-service-worker-dist', function(callback) {
  writeServiceWorkerFile(DIST_DIR, true, callback);
});

gulp.task('copy-dev-to-dist', function() {
  return gulp.src(DEV_DIR + '/**').pipe(gulp.dest(DIST_DIR));
});

/**
 * Copyright 2015 Mozilla
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

// Import this first so we can use it to wrap other modules we import.
var promisify = require("promisify-node");

var ghPages = require('gh-pages');
var gitconfiglocal = require('gitconfiglocal');
var path = require('path');
var promptly = require('promptly');
var swPrecache = require('sw-precache');
var readYaml = require('read-yaml');
var travisEncrypt = promisify(require('travis-encrypt'));
var writeYaml = require('write-yaml');

var Travis = require('travis-ci');
var travis = new Travis({ version: '2.0.0' });

var GitHub = require('github');
var github = new GitHub({
  version: "3.0.0",
  debug: true, // XXX Disable once things are working fine.
  protocol: "https", // XXX Determine if this is already the default.
  headers: {
    "user-agent": "Oghliner",
  },
});

// promisify should be able to wrap the entire promptly API
// via promisify(promptly), but that didn't seem to work, so here
// we wrap the individual methods we use.
promptly.prompt = promisify(promptly.prompt);
promptly.password = promisify(promptly.password);

// Wrap individual methods for complex APIs that I'm scared to wrap in toto.
github.authorization.create = promisify(github.authorization.create);
github.authorization.delete = promisify(github.authorization.delete);
travis.authenticate = promisify(travis.authenticate);
travis.hooks.get = promisify(travis.hooks.get);

/**
 * Get the slug (GitHub username/repo combination) for the 'origin' remote
 * in the repository that contains the current working directory.
 * XXX Replace with github-slug module?
 */
function getSlug(callback) {
  gitconfiglocal('./', function(error, config) {
    if (error) {
      callback(error);
      return;
    }

    if ('remote' in config && 'origin' in config.remote && 'url' in config.remote.origin) {
      var url = config.remote.origin.url;
      var match;
      if (match = url.match(/^git@github.com:([^/]+)\/([^.]+)\.git$/) ||
                  url.match(/^https:\/\/github.com\/([^/]+)\/([^.]+)\.git$/)) {
        callback(null, match[1] + '/' + match[2]);
        return;
      }
      callback('could not parse value of origin remote URL: ' + url);
      return;
    }

    callback('repo has no origin remote');
  });
}
getSlug = promisify(getSlug);

function configure(callback) {
  process.stdout.write(
    '\n' +
    'Oghliner will configure your repository to automatically deploy your app\n' +
    'to GitHub Pages using Travis CI.\n' +
    '\n'
  );

  // Save some values in the closure so we can use them across the promise chain
  // without having to pass them down the chain.
  // XXX Figure out if user and username will always be the same and, if so,
  // then stop prompting the user to specify their username.
  var slug, user, repo, username, password, otpCode, token, tempToken, tempTokenId;

  // Will users sometimes want to configure Travis to deploy changes to a
  // non-"origin" repository?  For example, origin is mykmelez/test-app, but I
  // want to configure Travis to deploy changes to mozilla/test-app, which has
  // a different remote name (like upstream).  If so, then we'll need to prompt
  // the user to choose the remote for which to configure deployment. For now,
  // though, we assume they are configuring the origin remote.

  getSlug()

  .then(function(res) {
    slug = res;
    var slugParts = slug.split('/');
    user = slugParts[0];
    repo = slugParts[1];

    process.stdout.write(
      'The "origin" remote of your repository is "' + slug + '".\n' +
      '\n' +
      'Make sure Travis knows about your repository by going to https://travis-ci.org/profile\n' +
      'and pressing the Sync button if it isn\'t already in the list of your repositories.\n' +
      '\n' +
      'Requesting a GitHub personal access token that Travis will use\n' +
      'to deploy your app.  In order to get the token, I need your username\n' +
      'and password (and two-factor authentication code, if appropriate).\n' +
      '\n' +
      'For more information about personal access tokens or to view the entry\n' +
      'for the token I create, see https://github.com/settings/tokens.\n' +
      '\n'
    );
  })

  .then(function() {
    return promptly.prompt('Username: ', { default: user });
  })

  .then(function(res) {
    username = res;

    return promptly.password('Password: ');
  })

  .then(function(res) {
    password = res;

    github.authenticate({
      type: 'basic',
      username: username,
      password: password
    });
  })

  .then(function() {
    // Create a temporary GitHub token to get a Travis token that we can use
    // to activate the repository in Travis.  We only need this GitHub token
    // to get the Travis token, so we delete it afterward.  (We do also need
    // a GitHub token that enables Travis to deploy a build to GitHub Pages,
    // but we get a separate token for that purpose afterward).

    // NB: The GitHub authorization API always requires basic authentication,
    // so it isn't possible to request a token that gives us access to it.
    // Otherwise we'd do that first and then use it to do everything else.

    var scopes = ['read:org', 'user:email', 'repo_deployment', 'repo:status', 'write:repo_hook'];
    var note = 'temporary Oghliner token to get Travis token for ' + slug;
    var noteUrl = 'https://github.com/mozilla/oghliner';

    return github.authorization.create({
      scopes: scopes,
      note: note,
      noteUrl: noteUrl,
      headers: {},
    })
    .catch(function(err) {
      var message = JSON.parse(err.message).message;
      // XXX Also handle the case where the credentials were incorrect.
      // XXX Also handle the case where the token already exists (because this
      // configuration process was previously interrupted during retrieval of
      // the Travis token).
      if (message === 'Must specify two-factor authentication OTP code.') {
        // XXX Display explanatory text so the user knows why we're prompting
        // for their OTP code.
        return promptly.prompt('Auth Code: ')
        .then(function(res) {
          otpCode = res;
          return github.authorization.create({
            scopes: scopes,
            note: note,
            noteUrl: noteUrl,
            headers: { 'X-GitHub-OTP': otpCode },
          });
        });
      }
    });

  })

  .then(function(res) {
    tempToken = res.token;

    // Store the ID of the temporary GitHub token so we can delete it
    // after we finish using it to get the Travis token.
    tempTokenId = res.id;
  })

  .then(function() {
    // Get the permanent GitHub token that Travis will use to deploy the app.
    // We get this token right after we get the temporary GitHub token, so we
    // can (hopefully) use the same OTP code for both requests.
    var scopes = ['public_repo'];
    var note = 'Oghliner token for ' + slug;
    var noteUrl = 'https://github.com/mozilla/oghliner';

    return github.authorization.create({
      scopes: scopes,
      note: note,
      noteUrl: noteUrl,
      headers: otpCode ? { 'X-GitHub-OTP': otpCode } : {},
    });
    // XXX If the OTP code has already expired, then ask for another one.
    // .catch(function(err) {
    //   var message = JSON.parse(err.message).message;
    //   // XXX Also handle the case where the token already exists (because the
    //   // user already configured this repository).
    //   if (message === 'XXX Replace with "OTP code expired" error message.') {
    //     // XXX Display explanatory text so the user knows why we're prompting
    //     // for their OTP code again.
    //     return promptly.prompt('Auth Code: ')
    //     .then(function(res) {
    //       otpCode = res;
    //       return github.authorization.create({
    //         scopes: scopes,
    //         note: note,
    //         noteUrl: noteUrl,
    //         headers: { 'X-GitHub-OTP': otpCode },
    //       });
    //     });
    //   }
    // });

  })

  .then(function(res) {
    token = res.token;

    process.stdout.write(
      '\n' +
      'I created a GitHub token for deploying via Travis.\n' +
      'Next I\'ll authenticate with Travis to check your repo status…\n' +
      '\n'
    );

    return travis.authenticate({ github_token: tempToken });
  })

  .then(function(res) {
    console.log("Travis token: " + res.access_token);

    // We don't need to save the Travis token, because the Travis module
    // caches it in the Travis instance.

    // Now that we have the Travis token, delete the temporary GitHub token.
    // XXX Handle the case where the OTP code has already expired.
    return github.authorization.delete({
      id: tempTokenId,
      headers: otpCode ? { 'X-GitHub-OTP': otpCode } : {},
    });
  })

  .then(function() {
    // XXX Ensure that the repository is known by and active in Travis.
    return travis.hooks.get({})
    .then(function(res) {
      var hook;
      for (var i = 0; i < res.hooks.length; i++) {
        hook = res.hooks[i];
        if (hook.owner_name === user && hook.name === repo) {
          if (hook.active) {
            process.stdout.write(
              '\n' +
              'Good news, your repository is already active in Travis!\n' +
              'Next I\'ll configure Travis to deploy your repository to GitHub Pages…\n' +
              '\n'
            );
          } else {
            process.stdout.write(
              '\n' +
              'Your repository isn\'t active in Travis yet. Activating it…\n' +
              '\n'
            );
            // XXX Ensure promisification won't break the method-ness of *put*.
            return promisify(travis.hooks(hook.id).put)({ hook: { active: true } });
          }
          break;
        }
      }
      // XXX The repository wasn't found in hooks, so tell Travis to sync
      // with GitHub and try to retrieve hooks again.
    });
  })

  .then(function(res) {
    // We'll only get a *res* argument if the previous step requested activation
    // from Travis.  If the repository was already active, this step is a noop.
    if (res) {
      if (res.result) {
        process.stdout.write(
          '\n' +
          'Your repository has been activated in Travis!\n' +
          '\n'
        );
      } else {
        process.stdout.write(
          '\n' +
          'Travis failed to activate your repository, so you\'ll need to do so manually\n' +
          'in Travis by going to https://travis-ci.org/profile and pressing the toggle button\n' +
          'next to the name of the repository.\n' +
          '\n'
        );
      }
    }
  })

  .then(function() {
    process.stdout.write(
      '\n' +
      'Next I\'ll encrypt the GitHub token with Travis\'s public key so I can add the token\n' +
      'to the Travis configuration without leaking it in public build logs…\n' +
      '\n'
    );

    return travisEncrypt(slug, 'GH_TOKEN=' + token, undefined, undefined);
  })

  .then(function(blob) {
    process.stdout.write(
      'I encrypted the token. Next I\'ll write it to the Travis configuration…\n' +
      '\n'
    );

    var travisYml = readYaml.sync('.travis.yml');

    if (!('env' in travisYml)) {
      travisYml.env = {};
    }

    if (!('global' in travisYml.env)) {
      travisYml.env.global = [];
    }

    travisYml.env.global.push({ secure: blob });
    writeYaml.sync('.travis.yml', travisYml);
  })

  .then(function() {
    process.stdout.write(
      'I wrote the encrypted token to the Travis configuration.  You\'re ready\n' +
      'to auto-deploy using Travis!  Just commit the change to your "master" branch,\n' +
      'push the change back to the origin remote, and then visit\n' +
      'https://travis-ci.org/' + slug + '/builds to see the build status.\n' +
      '\n' +
      'If the build is successful, the "after_success" build step should show\n' +
      'that Travis deployed your app to GitHub Pages.  It should look like this:\n' +
      '\n' +
      '$ [ "${TRAVIS_PULL_REQUEST}" = "false" ] && [ "${TRAVIS_BRANCH}" = "master" ] && gulp deploy\n' +
      '\n'
    );
  })

  .catch(function(err) {
    callback(err);
  })

  .done(function() {
    callback();
  });

}

function offline(config, callback) {
  var rootDir = config.rootDir || './';
  var fileGlobs = config.fileGlobs || ['**/*'];
  swPrecache.write(path.join(rootDir, 'offline-worker.js'), {
    staticFileGlobs: fileGlobs.map(function(v) { return path.join(rootDir, v) }),
    stripPrefix: rootDir,
    verbose: true,
  }, callback);
}

function deploy(config, callback) {
  config = config || {};

  var rootDir = 'rootDir' in config ? config.rootDir : '.';

  if ('GH_TOKEN' in process.env) {
    // We're using a token to authenticate with GitHub, so we have to embed
    // the token into the repo URL (if it isn't already there).
    gitconfiglocal('./', function(error, config) {
      if (error) {
        callback(error);
        return;
      }

      if ('remote' in config && 'origin' in config.remote && 'url' in config.remote.origin) {
        var url = config.remote.origin.url;
        var match;
        if (match = url.match(/^git@github.com:([^/]+)\/([^.]+)\.git$/) ||
                    url.match(/^https:\/\/github.com\/([^/]+)\/([^.]+)\.git$/)) {
          url = 'https://' + process.env.GH_TOKEN + '@github.com/' + match[1] + '/' + match[2] + '.git';
        }

        ghPages.publish(rootDir, {
          // We can't log here because it would leak the GitHub token on Travis.
          // logger: console.log,
          repo: url,
        }, callback);
      } else {
        callback('repo has no origin url');
      }
    });
  } else {
    // We aren't using a token to authenticate with GitHub, so we don't have to
    // alter the repo URL.
    ghPages.publish(rootDir, {
      logger: console.log,
    }, callback);
  }
}

module.exports = {
  configure: configure,
  deploy: deploy,
  offline: offline,
};

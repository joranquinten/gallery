require('es6-promise').polyfill();
var config = require('./gulp-config.json');
var gulp = require('gulp');
var plugins = require("gulp-load-plugins")({
  pattern: ['gulp-*', 'gulp.*'],
  replaceString: /\bgulp[\-.]/
});
var runSequence = require('run-sequence');
var pngquant = require('imagemin-pngquant');
var gulpif = require('gulp-if');
var del = require('del');
var browserSync = require("browser-sync").create();
var reload = browserSync.reload;

// Testing plugins
var karmaServer = require('karma').Server;
var protractor = require("gulp-protractor").protractor;

// PostCSS Plugins
var autoprefixer = require('autoprefixer');
var cssgrace = require('cssgrace');
var pseudoelements = require('postcss-pseudoelements');

// Assuming default means develop
gulp.task('default', function() {
  runSequence('dev');
});

gulp.task('dev', function() {
  config.settings.isDevelop = true;
  runSequence('clean:dev', ['js', 'css', 'html', 'img'], ['serve', 'watch']);
});

gulp.task('dev:nowatch', function() {
  config.settings.isDevelop = true;
  runSequence('clean:dev', ['js', 'css', 'html', 'img']);
});

gulp.task('prod', function() {
  config.settings.isDevelop = false;
  runSequence('clean:prod', ['js', 'css', 'html', 'img'], 'usemin', 'rev', ['serve', 'watch']);
});

gulp.task('prod:nowatch', function() {
  config.settings.isDevelop = false;
  runSequence('clean:prod', ['js', 'css', 'html', 'img'], 'usemin', 'rev');
});

gulp.task('prod:deploy', function() {
  config.settings.isDevelop = false;
  runSequence(['clean:prod','clean:zip'], ['js', 'css', 'html', 'img'], 'usemin', 'rev', 'zip');
});

gulp.task('prod:test', function() {
  runSequence('prod:nowatch', 'e2e');
});

gulp.task('clean:all', function() {
  runSequence(['clean:dev', 'clean:prod']);
});

/*
Tasks by type
*/
gulp.task('js', function() {

  var path = config.env.dev;
  if (!config.settings.isDevelop) path = config.env.prod;
  var base = path.base,
    ref = config.sourceFiles.js;

  if (config.settings.cleanBeforeRun) {
    console.log('deleting: ' + path.dest + config.targetFolders.js + '**/*.js');
    del(path.dest + config.targetFolders.js + '**/*.js');
  }
  var sourcemaps = require('gulp-sourcemaps');
  var removeUseStrict = require('gulp-remove-use-strict');

  return gulp.src(pathFiles(base, ref))
    .pipe(plugins.plumber({
      handleError: function(err) {
        console.log(err);
        this.emit('end');
      }
    }))
    .pipe(sourcemaps.init())
    .pipe(plugins.jshint(config.plugins.jshintOptions))
    .pipe(plugins.jshint.reporter('jshint-stylish'))
    .pipe(plugins.concat(config.targetFiles.js))
    .pipe(gulpif(!config.settings.transformForAngular, plugins.ngAnnotate()))
    .pipe(removeUseStrict())
    .pipe(gulpif(!config.settings.isDevelop, plugins.uglify({
      mangle: true
    })))
    .pipe(gulpif(!config.settings.isDevelop, plugins.stripDebug()))
    .pipe(gulpif(config.settings.enableGZIP, plugins.gzip(config.plugins.gzipOptions)))
    .pipe(sourcemaps.write(config.targetFolders.maps, {
      includeContent: false
    }))
    .pipe(gulp.dest(path.dest + config.targetFolders.js))
    .pipe(reload({
      stream: true
    }));
});

gulp.task('css', function() {

  var path = config.env.dev;
  if (!config.settings.isDevelop) path = config.env.prod;
  var base = path.base,
    ref = config.sourceFiles.scss;

  if (config.settings.cleanBeforeRun) {
    console.log('deleting: ' + path.dest + config.targetFolders.css + '**/*.css');
    del(path.dest + config.targetFolders.css + '**/*.css');
  }

  // Define PostCSS plugins
  var processors = [
    autoprefixer(config.plugins.autoprefixer),
    cssgrace,
    pseudoelements
  ];

  return gulp.src(pathFiles(base, ref))
    .pipe(plugins.plumber({
      handleError: function(err) {
        console.log(err);
        this.emit('end');
      }
    }))
    //.pipe(plugins.scssLint(config.plugins.scssLint))
    .pipe(plugins.sass())
    .pipe(plugins.concat(config.targetFiles.css))
    //.pipe(plugins.uncss({ html: pathFiles(base, config.sourceFiles.html) })) // UnCSS cleans up unused CSS code, but relies on (static) HTML files in order to extract identifiers, might be interesting for thinning out frameworks.
    .pipe(plugins.postcss(processors)) // ♤ PostCSS ♤
    .pipe(gulpif(!config.settings.isDevelop, plugins.minifyCss({
      compatibility: 'ie8'
    })))
    .pipe(gulpif(config.settings.enableGZIP, plugins.gzip(config.plugins.gzipOptions)))
    .pipe(gulp.dest(path.dest + config.targetFolders.css))
    .pipe(reload({
      stream: true
    }));
});

gulp.task('html', function() {

  var path = config.env.dev;
  if (!config.settings.isDevelop) path = config.env.prod;
  var base = path.base,
    ref = config.sourceFiles.html;

  if (config.settings.cleanBeforeRun) {
    console.log('deleting: ' + path.dest + config.targetFolders.html + '**/*.{html,htm,xml,txt}');
    del(path.dest + config.targetFolders.html + '**/*.{html,htm,xml,txt}');
  }

  return gulp.src(pathFiles(base, ref))
    .pipe(plugins.plumber({
      handleError: function(err) {
        console.log(err);
        this.emit('end');
      }
    }))
    .pipe(gulpif(!config.settings.isDevelop, plugins.htmlmin(config.plugins.minifyHTML)))
    .pipe(gulpif(config.settings.enableGZIP, plugins.gzip(config.plugins.gzipOptions)))
    .pipe(gulp.dest(path.dest + config.targetFolders.html))
    .pipe(reload({
      stream: true
    }));
});

gulp.task('img', function() {

  var path = config.env.dev;
  if (!config.settings.isDevelop) path = config.env.prod;
  var base = path.base,
    ref = config.sourceFiles.images;

  if (config.settings.cleanBeforeRun) {
    console.log('deleting: ' + path.dest + config.targetFolders.images + '**/*.{gif,png,jpeg,jpg,svg}');
    del(path.dest + config.targetFolders.images + '**/*.{gif,png,jpeg,jpg,svg}');
  }

  return gulp.src(pathFiles(base, ref))
    .pipe(gulpif(!config.settings.isDevelop, plugins.imagemin({
      progressive: true,
      svgoPlugins: [{
        removeViewBox: false
      }],
      use: [pngquant()]
    }))) // Minify only on prod
    .pipe(gulp.dest(path.dest + config.targetFolders.images));
});

gulp.task('usemin', function() {
  if (config.settings.enableUsemin) {
    var path = config.env.dev;
    if (!config.settings.isDevelop) path = config.env.prod;
    var base = path.base,
      ref = config.sourceFiles.html;

    return gulp.src(pathFiles(base, ref))
      .pipe(plugins.plumber({
        handleError: function(err) {
          console.log(err);
          this.emit('end');
        }
      }))
      .pipe(plugins.usemin({
        css: [plugins.minifyCss({
          compatibility: 'ie8'
        })],
        html: [function() {
          return plugins.htmlmin(config.plugins.minifyHTML);
        }],
        js: [plugins.uglify],
        inlinejs: [plugins.uglify],
        inlinecss: [plugins.minifyCss({
          compatibility: 'ie8'
        })]
      }))
      .pipe(gulp.dest(path.dest + config.targetFolders.html))
      .pipe(reload({
        stream: true
      }));

  }
});

gulp.task('rev', ['revision'], function() {
  if (config.settings.enableRevisioning) {

    var path = config.env.prod.dest;
    var manifest = gulp.src(config.targetFolders.revManifest + 'rev-manifest.json');

    return gulp.src(path + config.sourceFiles.html)
      .pipe(plugins.revReplace({
        manifest: manifest
      }))
      .pipe(gulp.dest(path + config.targetFolders.html));
  }
});

gulp.task('revision', ['revision:cleanBeforeRun'], function() {

  var path = config.env.prod.dest;
  var manifest = config.targetFolders.revManifest;

  // Load files to be revisioned
  return gulp.src(path + '**/*.{css,js}')
    .pipe(plugins.plumber({
      handleError: function(err) {
        console.log(err);
        this.emit('end');
      }
    }))
    .pipe(plugins.rev())
    .pipe(gulp.dest(path))
    .pipe(plugins.rev.manifest({
      path: config.targetFiles.revManifest
    }))
    .pipe(gulp.dest(manifest));

});

gulp.task('revision:cleanBeforeRun', function() {

  var path = config.env.prod.dest;
  var manifest = config.targetFolders.revManifest + config.targetFiles.revManifest;
  var manifestFile = null;

  var fs = require('fs');
  try {
    file = fs.lstatSync(manifest);
    if (file.isFile()) {
      try {
        manifestFile = require(manifest);
      } catch (e) {
        notify('Could not open ' + manifest + ' in: ' + __dirname, 'error');
      }
    }
  } catch (e) {
    // do nothing
  }

  if (manifestFile) {
    notify('Manifest opened, starting to delete files.', 'warning');
    for (var files in manifestFile) {
      if (manifestFile.hasOwnProperty(files)) {
        try {
          fs.unlink(config.env.prod.dest + manifestFile[files]);
        } catch (e) {
          notify('Could not delete: ' + manifestFile[files], 'error');
        }
      }
    }
  }

});


/* **************************************************
 *  Tests                                            *
 ************************************************** */

gulp.task('unit', function(done) {

  notify('Starting unit tests. Note that this follow a watch pattern on testfiles, press Ctrl+C to quit.', 'title');

  var path = config.env.dev;
  var base = path.base,
    ref = config.sourceFiles.tests.unit;

  new karmaServer({
    configFile: __dirname + config.plugins.karma.configFile,
    singleRun: false
  }, done).start();

});

gulp.task('e2e', function() {

  var path = config.env.dev;
  var base = path.base,
    ref = config.sourceFiles.tests.e2e;

  gulp.src(pathFiles(base, ref))
    .pipe(protractor({
      configFile: __dirname + config.plugins.protractor.configFile,
      args: ['--baseUrl', 'http://127.0.0.1:8000']
    }))
    .on('error', function(err) {
      this.emit('end');
    });

  notify('Starting end to end tests. Note that this starts up a browser and could take a while, press Ctrl+C to quit.', 'title');
});

/*
Utilities
*/
gulp.task('serve', function() {
  var env = config.env.dev.base;
  if (!config.settings.isDevelop) env = config.env.prod.base;
  env = env.replace('./', '');

  notify('Serve assumes you have a local webserver running and content is accessible via localhost.', 'title');
  // Assumes you have a local webserver running and content is accessible via localhost by default

  //browserSync.init({server: false, proxy: 'localhost/'+ currentDir() +'/'+ env, browser: config.plugins.browserSync.browsers });
  browserSync.init({
    server: false,
    proxy: config.plugins.browserSync.proxy,
    browser: config.plugins.browserSync.browsers
  });

  // Use static server:
  // browserSync.init({server: { baseDir: './' }, browser: config.plugins.browserSync.browsers });

});

gulp.task('watch', function() {

  var path = config.env.dev;
  var base = path.base;

  plugins.watch(base + '' + config.watchFiles.css, function() {
    gulp.run(['css']);
  });

  plugins.watch(base + '' + config.watchFiles.js, function() {
    gulp.run(['js']);
  });

  plugins.watch(base + '' + config.watchFiles.html, function() {
    gulp.run(['html']);
  });

  plugins.watch(base + '' + config.watchFiles.images, function() {
    gulp.run(['img']);
  });

});

gulp.task('clean:dev', function() {
  return del(config.env.dev.dest);
});


gulp.task('clean:prod', function() {
  return del(config.env.prod.dest);
});

gulp.task('clean:zip', function(){
  return del(config.targetFolders.zip +'**/*.zip');
});

gulp.task('zip', function(){
  var targetName = config.targetFiles.zip;

  var rightNow = new Date();
  var res = rightNow.toISOString().slice(0,17).replace(/-/g,"").replace(/T/g,"").replace(/:/g,"");
  if (!targetName) targetName = currentDir() + '.'+res+'.zip';
    return gulp.src(config.sourceFiles.zip)
        .pipe(plugins.zip(targetName))
        .pipe(gulp.dest(config.targetFolders.zip));
});

/* Other helpers */
function currentDir() {
  if (__dirname) return __dirname.split('\\').pop();
}

function notify(msg, type) {
  if (typeof(plugins.util) !== undefined) {
    switch (type) {
      case 'warning':
        plugins.util.log(plugins.util.colors.yellow(msg));
        break;
      case 'error':
        plugins.util.log(plugins.util.colors.bgRed(msg));
        break;
      case 'success':
        plugins.util.log(plugins.util.colors.green(msg));
        break;
      case 'title':
        plugins.util.log(plugins.util.colors.blue(msg));
        break;
      default:
        plugins.util.log(plugins.util.colors.cyan(msg));
    }
  } else {
    if (type !== undefined) msg = '[' + type + ']: ' + msg;
    console.log(msg);
  }
}

function pathFiles(base, collection) {
  if (typeof(collection) === 'object') {
    var ar = [];
    for (var i = 0; i < collection.length; i++) {
      ar.push(ignorePath(base, collection[i]));
    }
    return ar;
  } else if (typeof(collection) === 'string') {
    return ignorePath(base, collection);
  }
}

function ignorePath(base, file) {
  if (file.substring(0, 1) === '!') {
    return '!' + base + '' + file.replace('!', '');
  }
  return base + '' + file;
}

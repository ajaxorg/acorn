var fs = require("fs"), path = require("path")
var stream = require("stream")

var browserify = require("browserify")
var babel = require('babel-core')
var babelify = require("babelify").configure({loose: "all"})

process.chdir(path.resolve(__dirname, ".."))

browserify({standalone: "acorn", exposeAll: true, pack: function() {console.trace(); console.log.apply(console, arguments)}})
  .plugin(require('browserify-derequire'))
  .plugin(require('deps-sort'))
  .transform(babelify)
  .require("./src/index.js", {entry: true})
  .bundle()
  .pipe(acornShimComplete(true, "acorn.js"))
  .on("error", function (err) { console.log("Error: " + err.message) })
  .pipe(fs.createWriteStream("dist/acorn.js"))

var ACORN_PLACEHOLDER = "this_function_call_should_be_replaced_with_a_call_to_load_acorn()";
function acornShimPrepare(file) {
  var tr = new stream.Transform
  if (file == path.resolve(__dirname, "../src/index.js")) {
    var sent = false
    tr._transform = function(chunk, _, callback) {
      if (!sent) {
        sent = true
        callback(null, ACORN_PLACEHOLDER);
      } else {
        callback()
      }
    }
  } else {
    tr._transform = function(chunk, _, callback) { callback(null, chunk) }
  }
  return tr
}
function acornShimComplete(core, path) {
  var tr = new stream.Transform
  var buffer = "";
  tr._transform = function(chunk, _, callback) {
    buffer += chunk.toString("utf8");
    callback();
  };
  tr._flush = function (callback) {
    buffer = buffer.replace(/^\s*_classCallCheck\(this, \w+\);/gm, "")
    buffer = buffer.replace(ACORN_PLACEHOLDER, "module.exports = typeof acorn != 'undefined' ? acorn : require(\"./acorn\")");
    tr.push(buffer);
    buffer = 'define(["require", "exports", "module"' + (core ? '' : ', "./acorn"') +'], function(require, exports, module) {\n\n'
      + buffer
      + '\n});'
    if (path)
      fs.writeFileSync(path, buffer, "utf8");
    callback(null);
  };
  return tr;
}

browserify({standalone: "acorn.loose", exposeAll: true})
  .plugin(require('browserify-derequire'))
  .transform(acornShimPrepare)
  .plugin(require('deps-sort'))
  .transform(babelify)
  .require("./src/loose/index.js", {entry: true})
  .bundle()
  .on("error", function (err) { console.log("Error: " + err.message) })
  .pipe(acornShimComplete(null, "acorn_loose.js"))
  .pipe(fs.createWriteStream("dist/acorn_loose.js"))

browserify({standalone: "acorn.walk", exposeAll: true})
  .plugin(require('browserify-derequire'))
  .transform(acornShimPrepare)
  .plugin(require('deps-sort'))
  .transform(babelify)
  .require("./src/walk/index.js", {entry: true})
  .bundle()
  .on("error", function (err) { console.log("Error: " + err.message) })
  .pipe(acornShimComplete(null, "walk.js"))
  .pipe(fs.createWriteStream("dist/walk.js"))

babel.transformFile("./src/bin/acorn.js", function (err, result) {
  if (err) return console.log("Error: " + err.message)
  fs.writeFile("bin/acorn", result.code, function (err) {
    if (err) return console.log("Error: " + err.message)

    // Make bin/acorn executable
    if (process.platform === 'win32')
      return
    var stat = fs.statSync("bin/acorn")
    var newPerm = stat.mode | parseInt('111', 8)
    fs.chmodSync("bin/acorn", newPerm)
  })
})

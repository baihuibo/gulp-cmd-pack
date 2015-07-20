/**
 * Created by 惠波 on 2015/7/16.
 */
var through = require('through2');
var Promise = require('promise');
var path = require('path');
var fs = require('fs');
var gutil = require('gulp-util');
var _ = require('underscore');

module.exports = function (option) {

    option = option || {};
    option.mods = [];
    option.content = '';
    option.alias = option.alias || {};
    option.ignore = option.ignore || [];
    option.encoding = option.encoding || 'UTF-8';
    option.cache = {};

    if (option.base) {
        option.base = path.resolve(option.base, '.') + '\\';
    }

    return through.obj(function (file, encoding, cb) {

        if (!file) {
            return cb();
        }


        if (file.isBuffer()) {
            option.content = file.contents.toString();
            parseContents(option, file).then(function () {
                file.contents = new Buffer(comboContents(option));
                gutil.log('gulp-cmd:', '✔ Module [' + option.mainId + '] combo success.');
                cb(null, file);
            });
            return;
        }

        return cb(null, file);
    });
};

function getPath(id, option, absoluteBase) {
    var ret;
    var first = id.charAt(0);

    if (first === ".") {
        ret = path.resolve(absoluteBase || option.base, id);
    } else if (option.alias[id]) {
        ret = path.resolve(option.base, option.alias[id]);
    } else {// Top-level
        ret = (option.base + id);
    }
    return path.normalize(ret);
}

var sepReg = /\\/g;
function getId(path, option) {
    return path.replace(option.base, '').replace(sepReg, '/').replace('/', '_');
}

//解析模块base
function addBase(id, option, absoluteBase) {
    var ret = getPath(id, option, absoluteBase);

    var isAlias = option.alias[id];

    if (!path.extname(ret)) {
        ret += '.js';
    }

    var filePath = ret;
    ret = path.parse(ret);

    ret.id = isAlias ? id : getId(filePath, option);
    ret.filePath = filePath;
    return ret;
}

var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g;
var SLASH_RE = /\\\\/g;

//解析模块依赖列表
function parseDependencies(option, code, absoluteBase, mod) {
    var ret = [];
    code.replace(SLASH_RE, "")
        .replace(REQUIRE_RE, function (m, m1, m2) {
            if (m2) {
                ret.push(m2)
            }
        });

    var deps = ret.map(function (modName) {
        return addBase(modName, option, absoluteBase);
    });

    mod.deps = deps;
    mod.code = code;
    option.mods.push(mod);

    return deps;
}


//解析模块树并且读取模块
function parseContents(option) {
    return new Promise(function (done) {
        var deps = parseDependencies(option, option.content, null, {
            root: true,
            id: option.mainId
        });
        if (deps.length) {
            done(readDeps(option, deps));
        } else {
            done();
        }
    });
}

//读取文件
function readDeps(option, parentDeps) {

    var childDeps = [];

    var promises = parentDeps.map(function (mod) {
        return new Promise(function (resolve, reject) {
            if (option.ignore.indexOf(mod.id) > -1) {//忽略的模块
                return resolve();
            }

            var contents, deps;
            if (mod.ext == '.js') {
                if (option.cache[mod.filePath]) {
                    return resolve();
                }
                try {
                    contents = fs.readFileSync(mod.filePath, option.encoding);
                } catch (_) {
                    reject("File [" + mod.filePath + "] not found.");
                    return;
                }

                option.cache[mod.filePath] = true;

                deps = parseDependencies(option, contents, mod.dir, mod);
                if (deps.length) {
                    childDeps = childDeps.concat(deps);
                }
            } else {//插件支持
                try {
                    contents = fs.readFileSync(mod.filePath, option.encoding);
                } catch (_) {
                    reject("File [" + mod.filePath + "] not found.");
                    return;
                }

                mod.code = 'module.exports = \'' + jsEscape(contents) + '\';';
                mod.deps = [];
                option.mods.push(mod);
            }

            resolve();
        });
    });

    return Promise.all(promises).then(function () {
        if (childDeps.length) {
            return readDeps(option, childDeps);
        }
    }, function (err) {
        gutil.log(gutil.colors.red(PLUGIN_NAME + ' Error: ' + err));
    })
        .catch(function (err) {
            gutil.log(gutil.colors.red(PLUGIN_NAME + ' error: ' + err.message));
            console.log(err.stack);
        });
}

var CMD_REG = /define\(.*function\s*\(\s*require\s*(.*)?\)\s*\{/;
function comboContents(option) {
    var content = '';
    option.mods.forEach(function (mod) {
        var code = mod.code;

        //替换模块内部id
        code = transform(option, mod, code);

        if (!CMD_REG.test(code)) {
            var deps = '[],';
            if (mod.deps.length) {
                deps = '["' + _.pluck(mod.deps, 'id').join('","') + '"],';
            }

            code = 'define("' + mod.id + '" , ' + deps + ' function(require , exports , module){\n' + code + '});';
        }

        content += code + '\n';
    });

    return content;
}

function transform(option, mod, code) {
    code = code.replace(SLASH_RE, '');


    code.replace(REQUIRE_RE, function (m, m1, m2) {

        if (m2 && option.ignore.indexOf(m2) == -1) {

            var first = m.charAt(0);

            var newId = getId(getPath(m2, option, mod.dir), option);

            if (!path.extname(newId)) {
                newId += '.js';
            }

            newId = 'require("' + newId + '")';

            if (first === '(') {
                newId = '(' + newId;
            }

            code = code.replace(m, newId);
        }
    });

    return code;
}

function jsEscape(content) {
    return content.replace(/(["\\])/g, "\\$1")
        .replace(/[\f]/g, "\\f")
        .replace(/[\b]/g, "\\b")
        .replace(/[\n]/g, "\\n")
        .replace(/[\t]/g, "\\t")
        .replace(/[\r]/g, "\\r")
        .replace(/[\u2028]/g, "\\u2028")
        .replace(/[\u2029]/g, "\\u2029")
}